# MOMO Payment - Quick Start Testing Guide 🚀

## 📱 What is MOMO?
**Mobile Money (MOMO)** - A payment method for African markets. Your system supports:
- **MTN MoMo** (Rwanda, Uganda, Ghana, etc.)
- **Airtel Money**
- **Other providers** (via Flutterwave)

---

## ⚡ Quick Start (5 minutes)

### Step 1: Start Backend
```bash
cd backend
./run.sh
```
Expected output: `* Running on http://127.0.0.1:5000`

### Step 2: Open Another Terminal & Run Test
```bash
cd backend

# Option A: Python test (recommended)
python3 test_momo_payments.py

# Option B: Bash test (simple)
./test_momo_payments.sh

# Option C: With custom phone number
python3 test_momo_payments.py --phone 0780000000 --amount 50000 --verbose
```

### Step 3: Check Output
You'll see:
- ✅ Account validation result
- ✅ Payment reference ID
- ✅ Real-time polling status

---

## 📋 Document Reference

| Document | Purpose | Location |
|----------|---------|----------|
| **MOMO_PAYMENT_TESTING_GUIDE.md** | Complete setup & testing guide | `backend/` |
| **MOMO_UAT_TESTS.md** | 27 UAT test cases with expected results | `backend/` |
| **test_momo_payments.sh** | Bash testing script | `backend/` |
| **test_momo_payments.py** | Python testing tool (recommended) | `backend/` |

---

## 🎯 Frontend Form Fields to Fill

When testing payments through the UI (on course page):

```
1. Payment Method:        [Mobile Money 📱]
2. Phone Number:          [0780000000]
3. Network (optional):    [MTN ▼]
4. Payer Name:            [Test User] (auto-filled)
5. Amount:                [50000] (auto-filled from course)
6. Currency:              [RWF] (auto-filled)
```

**Click**: "Pay Now" → User receives USSD/app prompt → Approve → Status updates

---

## 🔧 Backend API Endpoints

### 1. Validate Account
```bash
curl -X POST http://localhost:5000/api/v1/applications/validate-momo-account \
  -H "Content-Type: application/json" \
  -d '{"phone_number": "0780000000"}'

# Response:
{
  "valid": true,
  "name": "John Doe",
  "message": "Verified MoMo account: John Doe"
}
```

### 2. Initiate Payment
```bash
curl -X POST http://localhost:5000/api/v1/applications/initiate-payment \
  -H "Content-Type: application/json" \
  -d '{
    "course_id": "1",
    "payment_method": "mobile_money",
    "amount": 50000,
    "currency": "RWF",
    "phone_number": "0780000000",
    "payer_name": "Test User"
  }'

# Response:
{
  "payment_method": "mobile_money",
  "reference": "ATB123456",
  "status": "pending",
  "message": "Enter the USSD code sent to your phone"
}
```

### 3. Verify Payment Status
```bash
curl -X POST http://localhost:5000/api/v1/applications/verify-payment \
  -H "Content-Type: application/json" \
  -d '{
    "payment_method": "mobile_money",
    "reference": "ATB123456"
  }'

# Response:
{
  "status": "completed",
  "reference": "ATB123456",
  "amount": 50000,
  "currency": "RWF"
}
```

---

## ✅ Test Checklist

Use this to manually test MOMO payments:

```
□ Test 1: Backend Running
  - Check if http://localhost:5000 responds

□ Test 2: Account Validation
  - POST /validate-momo-account
  - Phone: 0780000000
  - Expected: valid=true

□ Test 3: Payment Initiation
  - POST /initiate-payment
  - Course ID, amount, phone filled
  - Expected: reference ID generated, status=pending

□ Test 4: Payment Polling (every 5 seconds)
  - POST /verify-payment
  - Use reference from Test 3
  - Expected: Eventually status=completed

□ Test 5: Error Handling
  - Test with invalid phone
  - Test without phone field
  - Expected: 400 Bad Request with error message

□ Test 6: Database
  - Check SQLite for new payment record
  - Verify fields: reference, status, amount
```

---

## 🚨 Configuration Status

### ✅ Already Configured
```env
MTN_CLIENT_ID=8GEeeYqfsGvo8Y69WGVdiVCLQdjxK3yS ✓
MTN_CLIENT_SECRET=m0edPTEOfgZQw16v ✓
MTN_COUNTRY_CODE=RW ✓
```

### ⏳ Optional (for Full Features)
```env
# Currently commented out - uncomment to enable
# MTN_COLLECTION_USER_ID=<your-uuid>
# MTN_COLLECTION_API_KEY=<your-api-key>
# MTN_SUBSCRIPTION_KEY=<your-key>
# MTN_API_BASE=https://sandbox.momodeveloper.mtn.com
# MTN_ENV=sandbox
```

To setup these (optional): Run `python3 backend/setup_mtn_sandbox.py`

---

## 📊 Expected Payment Flow

```
┌─────────────────────────────────────────────────────┐
│                  Student Initiates Payment           │
│  Selects "Mobile Money", enters phone, clicks "Pay" │
└─────────────────────────────────┬───────────────────┘
                                  │
                    ┌─────────────▼──────────────┐
                    │  Backend: Validate Phone   │
                    │  (Optional enrichment)     │
                    └─────────────┬──────────────┘
                                  │
                    ┌─────────────▼──────────────┐
                    │ Backend: Request to Pay    │
                    │ (Generate reference ID)    │
                    └─────────────┬──────────────┘
                                  │
                    ┌─────────────▼──────────────┐
                    │  MTN API: Queue Payment    │
                    │  (USSD/App prompt sent)    │
                    └─────────────┬──────────────┘
                                  │
                    ┌─────────────▼──────────────┐
                    │  Frontend: Poll Status     │
                    │  Every 5 seconds (max 24x) │
                    └─────────────┬──────────────┘
                                  │
                                  │
                ┌─────────────────┴──────────────────┐
                │                                    │
   ┌────────────▼─────────────┐       ┌────────────▼──────────────┐
   │  User Approves on Phone  │       │  User Cancels/Timeout    │
   └────────────┬─────────────┘       └────────────┬──────────────┘
                │                                  │
   ┌────────────▼─────────────┐       ┌────────────▼──────────────┐
   │  Payment Status:          │       │  Payment Status:          │
   │  ✅ COMPLETED             │       │  ❌ FAILED                │
   │                            │       │                           │
   │  • Enrollment updated      │       │  • Allow retry            │
   │  • Confirmation email      │       │  • Show error message     │
   │  • Certificate available   │       │  • Return to signup       │
   └────────────────────────────┘       └───────────────────────────┘
```

---

## 🐛 Common Issues & Solutions

### Issue: "Backend not reachable"
```bash
# Solution:
cd backend
./run.sh
# Then try test again in new terminal
```

### Issue: "Account is not registered MoMo"
```
Using test phone? Try these:
- 0780000000 (Sandbox)
- 0790000000 (Sandbox)
- Contact your MTN Business for sandbox test numbers
```

### Issue: "Payment stuck in pending forever"
```
This is NORMAL in sandbox:
- No real phone to approve payment
- Automatically times out after 2 minutes (24 polls)
- In production, real MOMO account holders approve via phone
```

### Issue: "Credentials authentication failed"
```env
Check in .env:
- MTN_CLIENT_ID is not placeholder value
- MTN_CLIENT_SECRET is not placeholder value
- Try with new credentials from MTN Developer Portal
```

### Issue: "Can't import tabulate" (Python script)
```bash
pip install tabulate requests
# Then try again
```

---

## 📞 Need Help?

### Code References
- **Payment Logic**: `backend/src/services/payment_service.py`
- **Payment Routes**: `backend/src/routes/application_routes.py`
- **Frontend Payment**: `frontend/src/components/payments/FlutterwaveCheckoutModal.tsx`

### External Resources
- **MTN MADAPI Docs**: https://developers.mtn.com/
- **MTN MoMo Developer**: https://momodeveloper.mtn.com/
- **Flutterwave Docs**: https://developer.flutterwave.com/

### Your Test Scripts
- **Python**: `python3 backend/test_momo_payments.py --help`
- **Bash**: `bash backend/test_momo_payments.sh`

---

## 🎓 Learning Path

### Beginner (Today)
1. ✅ Read this guide
2. ✅ Run `python3 test_momo_payments.py`
3. ✅ Observe test results
4. ✅ Check API responses

### Intermediate (This Week)
1. Study the UAT test cases in `MOMO_UAT_TESTS.md`
2. Run each test case manually
3. Document results in Excel
4. Test error scenarios

### Advanced (Before Launch)
1. Load test with concurrent payments
2. Setup production credentials
3. Enable payment reconciliation
4. Configure admin dashboard

---

## 💾 Test Results Storage

Results automatically saved to:
- `momo_test_results_<timestamp>.json` (after Python test)
- `backend/logs/payment_*.log` (backend logs)

View latest results:
```bash
# Show latest test results
ls -lt momo_test_results_*.json | head -1

# View the latest file
cat $(ls -t momo_test_results_*.json | head -1) | jq .
```

---

## 📝 Submission Checklist

Before submitting to client/production:

### Configuration
- [ ] MTN credentials verified
- [ ] All required env variables set
- [ ] Backend/Frontend running without errors

### Testing
- [ ] Run all 27 UAT test cases
- [ ] Document all results
- [ ] No critical failures
- [ ] Error handling verified

### Performance
- [ ] Response time < 3 seconds
- [ ] Polling works smoothly
- [ ] No timeout issues

### Documentation
- [ ] Opera & process documented
- [ ] Screenshots captured
- [ ] All endpoints tested
- [ ] Results filed

---

## 🎉 Quick Command Reference

```bash
# Start backend
cd backend && ./run.sh

# Test with defaults (0780000000, RWF, 50000)
python3 test_momo_payments.py

# Test with customs
python3 test_momo_payments.py --phone 0790000000 --amount 100000 --verbose

# Simple bash test
./test_momo_payments.sh

# Check logs
tail -f backend/logs/payment_*.log

# See database records
sqlite3 backend/instance/afritec_lms_db.db \
  "SELECT * FROM application_windows WHERE payment_method='mobile_money' LIMIT 5;"
```

---

## 📋 Next Steps

1. **Now**: Run test script and verify it works
2. **Today**: Read the full `MOMO_PAYMENT_TESTING_GUIDE.md`
3. **This Week**: Execute all 27 UAT test cases
4. **Before Launch**: Switch to production credentials

---

**Happy Testing! 🎯**

For questions or issues, refer to the detailed guides:
- 📖 [Full Testing Guide](MOMO_PAYMENT_TESTING_GUIDE.md)
- 📊 [UAT Test Cases](MOMO_UAT_TESTS.md)
