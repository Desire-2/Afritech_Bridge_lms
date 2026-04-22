# MOMO Payment Method - Testing & Implementation Guide

## 📋 Quick Overview

Your system has **three MOMO payment integration options**:

1. **MTN MADAPI** (Primary) - RequestToPay flow
2. **MTN MoMo Developer API** (Secondary) - Account validation & enrichment
3. **Flutterwave** (Optional) - Multi-network support (MTN, Airtel, Vodafone, etc.)

---

## ✅ Current Configuration Status

### Already Configured ✓
```env
MTN_CLIENT_ID=8GEeeYqfsGvo8Y69WGVdiVCLQdjxK3yS
MTN_CLIENT_SECRET=m0edPTEOfgZQw16v
MTN_COUNTRY_CODE=RW
```

### Needs Setup (Optional but Recommended for Full Features)
```env
# Commented out in .env - uncomment after setup:
# MTN_COLLECTION_USER_ID=<your-uuid>
# MTN_COLLECTION_API_KEY=<your-api-key>
# MTN_SUBSCRIPTION_KEY=<your-subscription-key>
# MTN_API_BASE=https://sandbox.momodeveloper.mtn.com
# MTN_ENV=sandbox
```

---

## 🔧 Setup Instructions

### Step 1: Enable MTN MoMo Developer API (for Full Testing)

**Duration**: ~5 minutes

#### 1.1 Register & Get Subscription Key
1. Go to https://momodeveloper.mtn.com/signup
2. Create an account
3. Go to Profile → Copy your **Primary Key** (Subscription Key)

#### 1.2 Generate API Credentials
Run the automated setup script:

```bash
cd backend
python3 setup_mtn_sandbox.py
```

Or manually:

```bash
# Generate UUID for your API User ID
python3 -c "import uuid; print(uuid.uuid4())"
# Output: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# Create API User (replace with your Subscription Key)
curl -X POST https://sandbox.momodeveloper.mtn.com/v1_0/apiuser \
  -H "X-Reference-Id: YOUR-UUID-HERE" \
  -H "Ocp-Apim-Subscription-Key: YOUR-SUBSCRIPTION-KEY-HERE" \
  -H "Content-Type: application/json" \
  -d '{"providerCallbackHost": "https://webhook.site"}'

# Response: Status 201 Created ✓

# Then create API Key for that user
curl -X POST https://sandbox.momodeveloper.mtn.com/v1_0/apiuser/YOUR-UUID-HERE/apikey \
  -H "Ocp-Apim-Subscription-Key: YOUR-SUBSCRIPTION-KEY-HERE"

# Response: {"apiKey": "YOUR-API-KEY"}
```

#### 1.3 Update .env File

```env
# Uncomment these lines:
MTN_COLLECTION_USER_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
MTN_COLLECTION_API_KEY=your-api-key-from-response
MTN_SUBSCRIPTION_KEY=your-subscription-key
MTN_API_BASE=https://sandbox.momodeveloper.mtn.com
MTN_ENV=sandbox
```

#### 1.4 Restart Backend
```bash
# Kill existing server
pkill -f "python.*main.py" || true

# Start with hot reload
./run.sh
```

---

## 📱 How to Fill & Test MOMO Payment Form

### On Student/Application Page

#### Form Fields to Fill:

1. **Payment Method**: Select `Mobile Money`
2. **Phone Number**: 
   - Format: `0780000000` (local format without +250)
   - Or: `250780000000` (country code format)
   - Or: `+250780000000` (international format)
   - System auto-normalizes all formats ✓

3. **Network** (if using Flutterwave):
   - `MTN` (most common)
   - `AIRTEL`
   - `VODAFONE`
   - Other providers depending on country

4. **Payer Name** (optional):
   - Auto-filled from MOMO account if available
   - Manual entry allowed

5. **Amount** & **Currency**:
   - Automatically set from course price
   - Currency auto-converts: RWF, UGX, KES, NGN, GHS, etc.

---

## 🧪 Test Cases & Expected Results

### Test Case 1: Basic MOMO Payment Flow (MADAPI)

**Preconditions**:
- MTN_CLIENT_ID, MTN_CLIENT_SECRET configured ✓
- Course with price set
- Student enrolled/applying

**Steps**:

1. Go to course → Select "Mobile Money"
2. Enter phone: `0780000000`
3. Enter payer name: `Test User`
4. Click "Pay Now"

**Expected Results**:
- ✅ Payment initiated
- ✅ Reference ID returned (8-character format)
- ✅ Status: `pending`
- ✅ Message: "A mobile money prompt has been sent to your phone"
- ✅ USSD/App prompt appears on customer's phone
- ✅ Customer approves payment
- ✅ System polls every 5 seconds for completion
- ✅ After approval: Status changes to `completed`

**API Call Flow**:
```
POST /api/v1/applications/initiate-payment
├─ Validate phone number
├─ Call mtn_request_to_pay()
├─ Return reference & pending status
└─ Frontend polls verify-payment every 5s
```

---

### Test Case 2: Account Validation (with Developer API)

**Preconditions**:
- All MoMo Developer API credentials configured
- Valid MTN phone number

**Steps**:

1. Go to form → Enter phone: `0780000000`
2. System auto-validates in background
3. Observe validation result

**Expected Results**:
- ✅ Phone validated as active MoMo account
- ✅ Account name auto-populated (if available)
- ✅ `valid=true` returned in response
- ✅ Payer name field auto-filled

**Response Example**:
```json
{
  "valid": true,
  "name": "John Doe",
  "message": "Verified MoMo account: John Doe"
}
```

---

### Test Case 3: Invalid Phone Number

**Steps**:

1. Enter phone: `0120000000` (non-MoMo network)
2. Click "Pay Now"

**Expected Results**:
- ❌ Error: "This phone number is not a registered MTN Mobile Money account"
- ❌ Payment blocked
- ❌ User must enter valid MoMo number

---

### Test Case 4: Payment Verification/Polling

**Preconditions**:
- Payment initiated with reference: `ATB123456` (example)

**API Endpoint**:
```
POST /api/v1/applications/verify-payment

Body:
{
  "payment_method": "mobile_money",
  "reference": "ATB123456"
}
```

**Response Examples**:

**Pending**:
```json
{
  "status": "pending",
  "reference": "ATB123456"
}
```

**Completed**:
```json
{
  "status": "completed",
  "reference": "ATB123456",
  "amount": 50000,
  "currency": "RWF"
}
```

**Failed**:
```json
{
  "status": "failed",
  "reference": "ATB123456",
  "reason": "Declined by user"
}
```

---

## 🔌 API Integration Points

### 1. Initiate Payment
```python
POST /api/v1/applications/initiate-payment

{
  "course_id": "123",
  "payment_method": "mobile_money",
  "amount": 50000,
  "currency": "RWF",
  "phone_number": "0780000000",
  "payer_name": "John Doe"
}
```

**Response**:
```json
{
  "payment_method": "mobile_money",
  "reference": "ATB123456",
  "status": "pending",
  "payer_name": "John Doe",
  "message": "Enter the USSD code sent to your phone"
}
```

### 2. Validate MOMO Account
```python
POST /api/v1/applications/validate-momo-account

{
  "phone_number": "0780000000"
}
```

**Response**:
```json
{
  "valid": true,
  "name": "John Doe",
  "message": "Verified MoMo account: John Doe"
}
```

### 3. Verify Payment Status
```python
POST /api/v1/applications/verify-payment

{
  "payment_method": "mobile_money",
  "reference": "ATB123456"
}
```

**Response**:
```json
{
  "status": "completed",
  "reference": "ATB123456",
  "amount": 50000,
  "currency": "RWF"
}
```

---

## 📊 HTTP Status Codes

| Code | Scenario | Action |
|------|----------|--------|
| 200 | Payment initiated successfully | Show polling UI |
| 400 | Invalid phone/amount/course | Show error, allow retry |
| 404 | Course not found | Check course ID |
| 401 | Unauthorized | User must login |
| 500 | Backend error | Show "Try again later" |

---

## 🐛 Common Issues & Solutions

### Issue 1: "Bad Request" with statusCode 4000
**Cause**: Invalid MTN credentials
**Solution**:
```bash
# Verify credentials
echo "CLIENT_ID: $MTN_CLIENT_ID"
echo "CLIENT_SECRET: $MTN_CLIENT_SECRET"

# Test token generation
python3 -c "
from src.services.payment_service import _mtn_get_access_token
token = _mtn_get_access_token()
print(f'Token: {token[:20]}...')
"
```

---

### Issue 2: "Could not validate MoMo account"
**Cause**: MoMo Developer API not configured
**Solution**:
```env
# These 3 must be set together:
MTN_COLLECTION_USER_ID=your-uuid
MTN_COLLECTION_API_KEY=your-api-key
MTN_SUBSCRIPTION_KEY=your-subscription-key
```

---

### Issue 3: Payment stuck in "pending" forever
**Cause**: 
- User never approved on phone
- Polling timeout (24 polls = 2 minutes max)

**Solution**:
- Frontend shows "Payment timeout - try again"
- User can retry with new reference
- Check backend logs: `backend/logs/payment_*.log`

---

### Issue 4: Phone number format errors
**Solved by**: Auto-normalization in `flutterwave_initiate_mobile_money()`

All formats work:
- ✅ `0780000000` (local)
- ✅ `250780000000` (with country code)
- ✅ `+250780000000` (international)
- ✅ `+250 780 000 000` (with spaces)

---

## 🔍 Debugging & Logs

### View Real-Time Logs
```bash
# Terminal 1: Start backend
cd backend && ./run.sh

# Terminal 2: Watch logs
tail -f backend/logs/payment_*.log
# or for Flask logs
tail -f backend/logs/app.log
```

### Check Payment Status in Database
```python
# backend/main.py or Python shell
from src.models import ApplicationWindow
from src.models import db

# Find payment record
app = ApplicationWindow.query.filter_by(payment_status='completed').first()
print(f"Reference: {app.payment_reference}")
print(f"Amount: {app.amount} {app.currency}")
print(f"Status: {app.payment_status}")
```

---

## 🚀 Deployment Checklist

### Before Going to Production:

- [ ] Update `.env` with **production** MTN credentials (not sandbox)
- [ ] Change `MTN_ENV=sandbox` → `MTN_ENV=mtnrwanda` (or other country)
- [ ] Update `MTN_API_BASE` to production endpoint
- [ ] Set `FLASK_ENV=production`
- [ ] Configure `ALLOWED_ORIGINS` for frontend domain
- [ ] Enable Redis for JWT blocklist (instead of in-memory)
- [ ] Set up Firebase/Sentry for error tracking
- [ ] Test with real MOMO account (not sandbox)
- [ ] Load test: 10+ concurrent payment requests
- [ ] Set up automated payment reconciliation cronjob
- [ ] Enable payment timeout recovery workflow

---

## 📞 Support Resources

**MTN Documentation**:
- MADAPI: https://developers.mtn.com/
- MoMo Developer: https://momodeveloper.mtn.com/docs

**Flutterwave Docs**:
- https://developer.flutterwave.com/docs/mobile-money

**Backend Code References**:
- `src/services/payment_service.py` - Payment logic
- `src/routes/application_routes.py` - Payment endpoints
- `src/utils/payment_notifications.py` - Email notifications

---

## ✨ Next Steps

### Immediate (Today):
1. Set up MTN Developer credentials ✓
2. Test basic flow (initiate-payment) ✓
3. Verify payment endpoint works ✓

### Short-term (This Week):
1. Load test with 10 concurrent payments
2. Test error scenarios (invalid phone, network down)
3. Set up payment reconciliation job

### Long-term (Before Launch):
1. Switch to production credentials
2. Enable payment audit trail
3. Set up payment dashboard for admins
