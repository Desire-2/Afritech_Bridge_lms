#!/bin/bash

##############################################################################
# MOMO Payment Method - Quick Start Testing Script
# Usage: bash test_momo_payments.sh
##############################################################################

set -e

RESET='\033[0m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'

# Configuration
API_URL="${API_URL:-http://localhost:5000/api/v1}"
PHONE_NUMBER="${PHONE_NUMBER:-0780000000}"
COURSE_ID="${COURSE_ID:-1}"
AMOUNT="${AMOUNT:-50000}"
CURRENCY="${CURRENCY:-RWF}"
PAYER_NAME="${PAYER_NAME:-Test User}"

echo -e "${BLUE}========================================${RESET}"
echo -e "${BLUE}MOMO Payment Testing Suite${RESET}"
echo -e "${BLUE}========================================${RESET}\n"

# Function to print headers
print_header() {
    echo -e "\n${BLUE}>>> $1${RESET}"
}

# Function to print success
print_success() {
    echo -e "${GREEN}✓ $1${RESET}"
}

# Function to print error
print_error() {
    echo -e "${RED}✗ $1${RESET}"
}

# Function to print info
print_info() {
    echo -e "${YELLOW}ℹ $1${RESET}"
}

# Test 1: Check Backend Connectivity
print_header "Test 1: Backend Connectivity"
print_info "Connecting to: $API_URL"

if curl -s "$API_URL" > /dev/null 2>&1; then
    print_success "Backend is reachable"
else
    print_error "Backend is not reachable at $API_URL"
    print_info "Make sure backend is running: cd backend && ./run.sh"
    exit 1
fi

# Test 2: Validate MOMO Account
print_header "Test 2: Validate MOMO Account"
print_info "Phone Number: $PHONE_NUMBER"

VALIDATION_RESPONSE=$(curl -s -X POST "$API_URL/applications/validate-momo-account" \
  -H "Content-Type: application/json" \
  -d "{\"phone_number\": \"$PHONE_NUMBER\"}")

echo "Response: $VALIDATION_RESPONSE"

if echo "$VALIDATION_RESPONSE" | grep -q '"valid"'; then
    VALID=$(echo "$VALIDATION_RESPONSE" | grep -o '"valid":[^,}]*' | cut -d':' -f2)
    if [ "$VALID" == "true" ]; then
        print_success "Account is valid and active"
        # Extract name if available
        NAME=$(echo "$VALIDATION_RESPONSE" | grep -o '"name":"[^"]*"' | head -1 | cut -d'"' -f4)
        if [ ! -z "$NAME" ] && [ "$NAME" != "null" ]; then
            print_success "Account holder: $NAME"
            PAYER_NAME="$NAME"
        fi
    else
        print_error "Account is not a registered MOMO account"
        print_info "Please use an active MTN Mobile Money number"
    fi
else
    print_error "Could not validate account (API may not be configured)"
    print_info "Continuing with payment test..."
fi

# Test 3: Initiate Payment
print_header "Test 3: Initiate Payment"
print_info "Amount: $AMOUNT $CURRENCY"
print_info "Course ID: $COURSE_ID"

PAYMENT_PAYLOAD="{
  \"course_id\": \"$COURSE_ID\",
  \"payment_method\": \"mobile_money\",
  \"amount\": $AMOUNT,
  \"currency\": \"$CURRENCY\",
  \"phone_number\": \"$PHONE_NUMBER\",
  \"payer_name\": \"$PAYER_NAME\"
}"

echo "Payload: $PAYMENT_PAYLOAD"

PAYMENT_RESPONSE=$(curl -s -X POST "$API_URL/applications/initiate-payment" \
  -H "Content-Type: application/json" \
  -d "$PAYMENT_PAYLOAD")

echo "Response: $PAYMENT_RESPONSE"

if echo "$PAYMENT_RESPONSE" | grep -q '"reference"'; then
    REFERENCE=$(echo "$PAYMENT_RESPONSE" | grep -o '"reference":"[^"]*"' | head -1 | cut -d'"' -f4)
    print_success "Payment initiated with reference: $REFERENCE"
    
    STATUS=$(echo "$PAYMENT_RESPONSE" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    print_success "Payment status: $STATUS"
    
    # Save reference for next test
    echo "PAYMENT_REFERENCE=$REFERENCE" > /tmp/momo_test_ref.txt
    
else
    print_error "Failed to initiate payment"
    print_error "$PAYMENT_RESPONSE"
    exit 1
fi

# Test 4: Verify Payment (Polling Simulation)
print_header "Test 4: Verify Payment Status (Polling)"

if [ ! -f /tmp/momo_test_ref.txt ]; then
    print_error "No payment reference found, skipping verification test"
    exit 1
fi

source /tmp/momo_test_ref.txt

print_info "Payment Reference: $PAYMENT_REFERENCE"
print_info "Polling for payment status (max 5 attempts)..."

MAX_POLLS=5
POLL_COUNT=0
PAYMENT_COMPLETED=false

while [ $POLL_COUNT -lt $MAX_POLLS ]; do
    POLL_COUNT=$((POLL_COUNT + 1))
    
    echo -ne "\rPoll attempt $POLL_COUNT/$MAX_POLLS..."
    
    VERIFY_RESPONSE=$(curl -s -X POST "$API_URL/applications/verify-payment" \
      -H "Content-Type: application/json" \
      -d "{\"payment_method\": \"mobile_money\", \"reference\": \"$PAYMENT_REFERENCE\"}")
    
    PAYMENT_STATUS=$(echo "$VERIFY_RESPONSE" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    
    if [ "$PAYMENT_STATUS" == "completed" ] || [ "$PAYMENT_STATUS" == "successful" ]; then
        echo ""
        print_success "Payment completed!"
        PAYMENT_COMPLETED=true
        break
    elif [ "$PAYMENT_STATUS" == "failed" ]; then
        echo ""
        print_error "Payment failed"
        REASON=$(echo "$VERIFY_RESPONSE" | grep -o '"reason":"[^"]*"' | cut -d'"' -f4)
        if [ ! -z "$REASON" ]; then
            print_info "Reason: $REASON"
        fi
        break
    fi
    
    sleep 2
done

echo ""

if [ "$PAYMENT_COMPLETED" == true ]; then
    print_success "Payment verification successful"
    
    # Extract payment details
    AMOUNT_PAID=$(echo "$VERIFY_RESPONSE" | grep -o '"amount":[^,}]*' | cut -d':' -f2)
    CURRENCY_PAID=$(echo "$VERIFY_RESPONSE" | grep -o '"currency":"[^"]*"' | cut -d'"' -f4)
    
    if [ ! -z "$AMOUNT_PAID" ]; then
        print_info "Amount paid: $AMOUNT_PAID $CURRENCY_PAID"
    fi
else
    if [ "$PAYMENT_STATUS" == "pending" ]; then
        print_info "Payment still pending (this is normal - user hasn't approved on phone)"
        print_info "In production, the frontend would continue polling every 5 seconds"
        print_info "Max polling duration: 2 minutes (24 attempts)"
    elif [ "$PAYMENT_STATUS" == "failed" ]; then
        print_error "Payment was declined"
    else
        print_info "Payment status: $PAYMENT_STATUS"
    fi
fi

# Test 5: Database Check
print_header "Test 5: Database Check"
print_info "Checking if payment record was created..."

if command -v sqlite3 &> /dev/null; then
    DB_FILE="${DB_FILE:-backend/instance/afritec_lms_db.db}"
    if [ -f "$DB_FILE" ]; then
        RECORD_COUNT=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM application_windows WHERE payment_reference='$PAYMENT_REFERENCE';" 2>/dev/null || echo "0")
        if [ "$RECORD_COUNT" -gt 0 ]; then
            print_success "Payment record found in database"
            sqlite3 "$DB_FILE" "SELECT id, payment_method, payment_status, payment_reference, amount, currency FROM application_windows WHERE payment_reference='$PAYMENT_REFERENCE' LIMIT 1;" 2>/dev/null
        else
            print_info "No payment record found (database may not be updated yet)"
        fi
    else
        print_info "SQLite database not found at $DB_FILE"
    fi
else
    print_info "SQLite not installed, skipping database check"
fi

# Test 6: Error Handling - Invalid Phone
print_header "Test 6: Error Handling - Invalid Phone"
print_info "Testing with invalid phone number..."

ERROR_PAYLOAD="{
  \"course_id\": \"$COURSE_ID\",
  \"payment_method\": \"mobile_money\",
  \"amount\": $AMOUNT,
  \"currency\": \"$CURRENCY\",
  \"phone_number\": \"0120000000\",
  \"payer_name\": \"Test User\"
}"

ERROR_RESPONSE=$(curl -s -X POST "$API_URL/applications/initiate-payment" \
  -H "Content-Type: application/json" \
  -d "$ERROR_PAYLOAD")

if echo "$ERROR_RESPONSE" | grep -q '"error"'; then
    ERROR_MSG=$(echo "$ERROR_RESPONSE" | grep -o '"error":"[^"]*"' | cut -d'"' -f4)
    print_success "Error handling works: $ERROR_MSG"
else
    print_info "No error validation (this might be expected depending on configuration)"
fi

# Test 7: Error Handling - Missing Phone
print_header "Test 7: Error Handling - Missing Phone"
print_info "Testing without phone number..."

ERROR_PAYLOAD="{
  \"course_id\": \"$COURSE_ID\",
  \"payment_method\": \"mobile_money\",
  \"amount\": $AMOUNT,
  \"currency\": \"$CURRENCY\",
  \"payer_name\": \"Test User\"
}"

ERROR_RESPONSE=$(curl -s -X POST "$API_URL/applications/initiate-payment" \
  -H "Content-Type: application/json" \
  -d "$ERROR_PAYLOAD")

if echo "$ERROR_RESPONSE" | grep -q '"error"'; then
    ERROR_MSG=$(echo "$ERROR_RESPONSE" | grep -o '"error":"[^"]*"' | cut -d'"' -f4)
    print_success "Validation works: Phone number required"
else
    print_info "No validation error (check if phone_number is truly required)"
fi

# Summary
echo -e "\n${BLUE}========================================${RESET}"
echo -e "${BLUE}Test Summary${RESET}"
echo -e "${BLUE}========================================${RESET}\n"

print_info "Configuration Used:"
echo "  API URL: $API_URL"
echo "  Phone: $PHONE_NUMBER"
echo "  Amount: $AMOUNT $CURRENCY"
echo "  Course ID: $COURSE_ID"

echo -e "\n${GREEN}Testing complete!${RESET}"

if [ -f /tmp/momo_test_ref.txt ]; then
    echo -e "\nLastest payment reference: $PAYMENT_REFERENCE"
    echo "Use this to check payment status later:"
    echo "  curl -X POST $API_URL/applications/verify-payment \\"
    echo "    -H 'Content-Type: application/json' \\"
    echo "    -d '{\"payment_method\": \"mobile_money\", \"reference\": \"$PAYMENT_REFERENCE\"}'"
fi

echo ""
