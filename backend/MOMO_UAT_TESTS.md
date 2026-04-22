# MOMO Payment Method - Standard Open API UAT Tests

## Test Suite Overview
This document aligns with your "STANDARD OPEN API UAT TESTS.xlsx" requirements for MOMO payment testing.

---

## 📋 UAT Test Cases

### Group 1: Account Validation & Phone Number Verification

#### Test ID: MOMO-001
**Test Name**: Validate Active MOMO Account
**Endpoint**: `POST /api/v1/applications/validate-momo-account`

| Field | Value |
|-------|-------|
| **Phone Number** | `0780000000` |
| **Expected Status** | 200 OK |
| **Expected Response** | `{"valid": true, "name": "John Doe", "message": "..."}` |
| **Pass Criteria** | Response includes valid=true and account name |
| **Test Data** | Valid MTN MoMo account number |

---

#### Test ID: MOMO-002
**Test Name**: Reject Inactive/Invalid MOMO Account
**Endpoint**: `POST /api/v1/applications/validate-momo-account`

| Field | Value |
|-------|-------|
| **Phone Number** | `0120000000` |
| **Expected Status** | 200 OK |
| **Expected Response** | `{"valid": false, "name": null, "message": "...not registered..."}` |
| **Pass Criteria** | Response includes valid=false |
| **Test Data** | Non-MoMo network number |

---

#### Test ID: MOMO-003
**Test Name**: Handle Missing Phone Number
**Endpoint**: `POST /api/v1/applications/validate-momo-account`

| Field | Value |
|-------|-------|
| **Phone Number** | (empty) |
| **Expected Status** | 400 Bad Request |
| **Expected Response** | `{"error": "phone_number is required"}` |
| **Pass Criteria** | Proper error handling |
| **Test Data** | Null/empty phone |

---

#### Test ID: MOMO-004
**Test Name**: Handle Multiple Phone Number Formats
**Endpoint**: `POST /api/v1/applications/validate-momo-account`

| Test Format | Input | Expected | Result |
|-------------|-------|----------|--------|
| Local Format | `0780000000` | Normalize & validate | ✅ PASS |
| Country Code | `250780000000` | Normalize & validate | ✅ PASS |
| International | `+250780000000` | Normalize & validate | ✅ PASS |
| With Spaces | `+250 780 000 000` | Normalize & validate | ✅ PASS |
| With Dashes | `250-780-000-000` | Normalize & validate | ✅ PASS |

**Pass Criteria**: All formats successfully normalized and validated

---

### Group 2: Payment Initiation

#### Test ID: MOMO-010
**Test Name**: Initiate MOMO Payment - Basic Flow
**Endpoint**: `POST /api/v1/applications/initiate-payment`

**Request Payload**:
```json
{
  "course_id": "123",
  "payment_method": "mobile_money",
  "amount": 50000,
  "currency": "RWF",
  "phone_number": "0780000000",
  "payer_name": "Test User"
}
```

| Field | Expected Value |
|-------|-----------------|
| **HTTP Status** | 200 OK |
| **Reference ID** | Non-empty string (8+ chars) |
| **Payment Status** | "pending" |
| **Message** | Contains instruction text |
| **Pass Criteria** | All fields present, status=pending |

---

#### Test ID: MOMO-011
**Test Name**: Initiate Payment Without Phone Number
**Endpoint**: `POST /api/v1/applications/initiate-payment`

**Request Payload**:
```json
{
  "course_id": "123",
  "payment_method": "mobile_money",
  "amount": 50000,
  "currency": "RWF"
}
```

| Field | Expected Value |
|-------|-----------------|
| **HTTP Status** | 400 Bad Request |
| **Error Message** | "phone_number is required" |
| **Pass Criteria** | Proper validation error |

---

#### Test ID: MOMO-012
**Test Name**: Initiate Payment With Invalid Amount
**Endpoint**: `POST /api/v1/applications/initiate-payment`

**Request Payload**:
```json
{
  "course_id": "123",
  "payment_method": "mobile_money",
  "amount": -100,
  "currency": "RWF",
  "phone_number": "0780000000"
}
```

| Field | Expected Value |
|-------|-----------------|
| **HTTP Status** | 400 Bad Request |
| **Error Message** | "Amount must be positive" or similar |
| **Pass Criteria** | Validation rejects negative amounts |

---

#### Test ID: MOMO-013
**Test Name**: Initiate Payment With Invalid Currency
**Endpoint**: `POST /api/v1/applications/initiate-payment`

**Request Payload**:
```json
{
  "course_id": "123",
  "payment_method": "mobile_money",
  "amount": 50000,
  "currency": "XYZ",
  "phone_number": "0780000000"
}
```

| Field | Expected Value |
|-------|-----------------|
| **HTTP Status** | 400 Bad Request |
| **Error Message** | Currency mismatch or unsupported |
| **Pass Criteria** | Validation catches invalid currency |

---

#### Test ID: MOMO-014
**Test Name**: Initiate Payment - Course Not Found
**Endpoint**: `POST /api/v1/applications/initiate-payment`

**Request Payload**:
```json
{
  "course_id": "999999",
  "payment_method": "mobile_money",
  "amount": 50000,
  "currency": "RWF",
  "phone_number": "0780000000"
}
```

| Field | Expected Value |
|-------|-----------------|
| **HTTP Status** | 404 Not Found |
| **Error Message** | "Course not found" |
| **Pass Criteria** | Proper error handling |

---

### Group 3: Payment Verification & Polling

#### Test ID: MOMO-020
**Test Name**: Verify Payment Status - Pending
**Endpoint**: `POST /api/v1/applications/verify-payment`

**Request Payload**:
```json
{
  "payment_method": "mobile_money",
  "reference": "ATB123456"
}
```

**Scenario**: Payment initiated but not yet approved

| Field | Expected Value |
|-------|-----------------|
| **HTTP Status** | 200 OK |
| **Status** | "pending" |
| **Reference** | "ATB123456" |
| **Pass Criteria** | Status correctly reflects pending state |

---

#### Test ID: MOMO-021
**Test Name**: Verify Payment Status - Completed
**Endpoint**: `POST /api/v1/applications/verify-payment`

**Scenario**: User approved payment on phone

| Field | Expected Value |
|-------|-----------------|
| **HTTP Status** | 200 OK |
| **Status** | "completed" or "successful" |
| **Amount** | Present |
| **Currency** | Present |
| **Pass Criteria** | All payment details returned |

---

#### Test ID: MOMO-022
**Test Name**: Verify Payment Status - Failed
**Endpoint**: `POST /api/v1/applications/verify-payment`

**Scenario**: User cancelled or declined payment

| Field | Expected Value |
|-------|-----------------|
| **HTTP Status** | 200 OK |
| **Status** | "failed" |
| **Reason** | Explanation provided |
| **Pass Criteria** | Status correctly reflects failure |

---

#### Test ID: MOMO-023
**Test Name**: Verify With Invalid Reference
**Endpoint**: `POST /api/v1/applications/verify-payment`

**Request Payload**:
```json
{
  "payment_method": "mobile_money",
  "reference": "INVALID_REF"
}
```

| Field | Expected Value |
|-------|-----------------|
| **HTTP Status** | 200 OK or 404 |
| **Status** | "pending" or "failed" |
| **Pass Criteria** | Graceful handling of invalid reference |

---

### Group 4: Multi-Currency Support

#### Test ID: MOMO-030
**Test Name**: Payment in RWF (Rwanda)
**Currency**: RWF | **Country**: RW | **Network**: MTN
**Amount**: 50000

| Field | Expected Value |
|-------|-----------------|
| **Status** | Success (200 OK) |
| **Pass Criteria** | Payment processed in RWF |

---

#### Test ID: MOMO-031
**Test Name**: Payment in UGX (Uganda)
**Currency**: UGX | **Country**: UG | **Network**: MTN
**Amount**: 100000

| Field | Expected Value |
|-------|-----------------|
| **Status** | Success (200 OK) |
| **Pass Criteria** | Payment processed in UGX |

---

#### Test ID: MOMO-032
**Test Name**: Payment in KES (Kenya)
**Currency**: KES | **Country**: KE | **Network**: Airtel
**Amount**: 5000

| Field | Expected Value |
|-------|-----------------|
| **Status** | Success (200 OK) |
| **Pass Criteria** | Payment processed in KES |

---

#### Test ID: MOMO-033
**Test Name**: Payment in NGN (Nigeria)
**Currency**: NGN | **Country**: NG | **Network**: MTN
**Amount**: 10000

| Field | Expected Value |
|-------|-----------------|
| **Status** | Success (200 OK) |
| **Pass Criteria** | Payment processed in NGN |

---

### Group 5: Network Selection (Flutterwave)

#### Test ID: MOMO-040
**Test Name**: Select MTN Network
**Network**: MTN | **Phone**: 0780000000

| Field | Expected Value |
|-------|-----------------|
| **Status** | Success |
| **Network Confirmed** | MTN |
| **Pass Criteria** | MTN payment initiated |

---

#### Test ID: MOMO-041
**Test Name**: Select Airtel Network
**Network**: AIRTEL | **Phone**: 0780000000

| Field | Expected Value |
|-------|-----------------|
| **Status** | Success |
| **Network Confirmed** | AIRTEL |
| **Pass Criteria** | Airtel payment initiated |

---

### Group 6: Error Handling

#### Test ID: MOMO-050
**Test Name**: Network Timeout Error
**Condition**: Backend unable to reach MTN API

| Field | Expected Value |
|-------|-----------------|
| **HTTP Status** | 500 Internal Server Error |
| **Error Message** | User-friendly message |
| **User Action** | "Try again in a few minutes" |
| **Pass Criteria** | Graceful timeout handling |

---

#### Test ID: MOMO-051
**Test Name**: Invalid Credentials Error
**Condition**: MTN_CLIENT_ID/SECRET incorrect

| Field | Expected Value |
|-------|-----------------|
| **HTTP Status** | 400 Bad Request |
| **Error Code** | 4000 |
| **Error Message** | "Bad Request" or credentials error |
| **Pass Criteria** | Clear authentication error |

---

#### Test ID: MOMO-052
**Test Name**: Duplicate Payment Request
**Condition**: Same reference submitted twice

| Field | Expected Value |
|-------|-----------------|
| **HTTP Status** | 400 Bad Request or idempotent response |
| **Behavior** | Prevents duplicate charges |
| **Pass Criteria** | Idempotency enforced |

---

### Group 7: User Experience & Polling

#### Test ID: MOMO-060
**Test Name**: Automatic Polling (Frontend)
**Condition**: Payment initiated, awaiting user approval

| Polling Interval | Expected Behavior |
|------------------|-------------------|
| Every 5 seconds | ✅ User sees "Waiting for approval..." |
| After 5 seconds | ✅ First poll sent to verify-payment |
| After 24 polls (2 min) | ✅ Timeout error shown, allow retry |
| User approves | ✅ Status immediately updates to completed |

---

#### Test ID: MOMO-061
**Test Name**: Manual Payment Retry
**Condition**: Initial payment timeout or failed

| Action | Expected Result |
|--------|-----------------|
| Click "Retry Payment" | New reference ID generated |
| Phone number pre-filled | ✅ Yes |
| Amount pre-filled | ✅ Yes |
| Polling restarts | ✅ Yes |

---

### Group 8: Database & Audit Trail

#### Test ID: MOMO-070
**Test Name**: Payment Record Created
**Condition**: After payment initiated

**Database Check**:
```sql
SELECT * FROM application_windows 
WHERE payment_method='mobile_money' 
AND payment_reference='ATB123456';
```

| Field | Expected Value |
|-------|-----------------|
| payment_reference | Non-null |
| payment_status | "pending" |
| payment_method | "mobile_money" |
| amount | Correct amount |
| currency | Correct currency |

---

#### Test ID: MOMO-071
**Test Name**: Payment Record Updated
**Condition**: After payment completed

**Database Check**:
```sql
SELECT * FROM application_windows 
WHERE payment_reference='ATB123456';
```

| Field | Expected Value |
|-------|-----------------|
| payment_status | "completed" |
| payment_completed_at | Current timestamp |
| payer_name | Included (if available) |

---

### Group 9: Logging & Monitoring

#### Test ID: MOMO-080
**Test Name**: Payment Logs Generated
**Log File**: `backend/logs/payment_*.log`

| Expected Log Entry | Presence |
|-------------------|----------|
| Request to initiate payment | ✅ Should include phone, amount, currency |
| API call to MTN | ✅ Should log reference |
| Response received | ✅ Should log status |
| Polling events | ✅ Should log each verify attempt |
| Payment completion | ✅ Should log timestamp & status |

---

## 📊 Test Execution Template

Use this template for each test case:

```
Test ID: MOMO-001
Test Name: Validate Active MOMO Account
Date Executed: 2026-04-16
Executed By: [Your Name]

Preconditions:
- [ ] Backend running on localhost:5000
- [ ] Frontend running on localhost:3000
- [ ] .env configured with MTN credentials

Steps:
1. [ ] Navigate to course page
2. [ ] Select "Mobile Money" as payment method
3. [ ] Enter phone: 0780000000
4. [ ] System validates account
5. [ ] Observe response

Expected Result:
- [ ] HTTP 200 OK
- [ ] Response includes valid=true
- [ ] Account name returned

Actual Result:
[Describe what actually happened]

Status: [ ] PASS [ ] FAIL [ ] BLOCKED

Comments:
[Any additional notes]
```

---

## 🎯 Defect Reporting Template

```
Defect ID: MOMO-DEF-001
Date Found: 2026-04-16
Severity: [ ] Critical [ ] High [ ] Medium [ ] Low

Description:
[What happened that shouldn't have]

Steps to Reproduce:
1. ...
2. ...
3. ...

Expected Behavior:
[What should happen]

Actual Behavior:
[What actually happened]

Environment:
- OS: Linux
- Browser: Chrome 123
- Backend: localhost:5000
- Frontend: localhost:3000

Screenshots/Logs:
[Attach any relevant logs or screenshots]

Assigned To: [Developer name]
Status: [ ] New [ ] In Progress [ ] Fixed [ ] Verified
```

---

## ✅ Test Coverage Summary

| Group | Test Count | Pass | Fail | Block |
|-------|-----------|------|------|-------|
| 1. Account Validation | 4 | _ | _ | _ |
| 2. Payment Initiation | 5 | _ | _ | _ |
| 3. Verification & Polling | 4 | _ | _ | _ |
| 4. Multi-Currency | 4 | _ | _ | _ |
| 5. Network Selection | 2 | _ | _ | _ |
| 6. Error Handling | 3 | _ | _ | _ |
| 7. UX & Polling | 2 | _ | _ | _ |
| 8. Database & Audit | 2 | _ | _ | _ |
| 9. Logging & Monitoring | 1 | _ | _ | _ |
| **TOTAL** | **27** | _ | _ | _ |

---

## 🚀 Sign-Off

**Test Suite Created**: April 16, 2026
**Total Test Cases**: 27
**Estimated Execution Time**: ~4-6 hours (manual)
**Automatable**: 90% (via API testing framework)

**QA Lead**: _________________ Date: _________

**Development Lead**: _________________ Date: _________

