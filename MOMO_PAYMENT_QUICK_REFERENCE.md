# MOMO Payment Testing - Quick Reference Guide

## 🚀 Quick Start (5 minutes)

### Step 1: Ensure Backend is Running
```bash
cd backend
./run.sh
# Should show: Running on http://localhost:5001
```

### Step 2: Run the Test Suite
```bash
cd backend
./venv/bin/python3 test_momo_fast.py http://localhost:5001/api/v1
```

### Step 3: View Results
```bash
# Terminal output shows:
# - 14 test cases
# - Pass/Fail status
# - Response times
# - Improvements list

# Excel report:
open MOMO_PAYMENT_TEST_REPORT.xlsx

# JSON results:
cat backend/momo_test_results_comprehensive_*.json
```

---

## 📊 Test Coverage (14 Cases)

### Group 1: Connectivity (1 test)
- ✅ Backend responsive on port 5001

### Group 2: Account Validation (2 tests)  
- ✅ Valid phone number validation
- ✅ Invalid phone number handling

### Group 3: Payment Initiation (3 tests)
- 🔄 Course 1 (needs investigation)
- ✅ Course 2 (working)
- ✅ Course 3 (working)

### Group 4: Payment Verification (1 test)
- ❌ Status verification endpoint

### Group 5: Error Handling (4 tests)
- ❌ Negative amount validation
- ❌ Zero amount validation
- ✅ Missing phone handling
- ❌ Invalid course validation

### Group 6: Concurrency (3 tests)
- ✅ Rapid request handling (all 3 pass)

---

## 📈 Current Status

| Metric | Value |
|--------|-------|
| Pass Rate | 57.1% (8/14) |
| Avg Response | 1,551ms |
| Database Integration | ✅ Working |
| Real Courses Tested | Courses 2, 3 |
| Account Validation | ✅ 100% |

---

## 🔴 Critical Issues

1. **Verification Endpoint Broken** → Returns None
2. **Missing Validation** → Negative/zero amounts not rejected
3. **Response Times Slow** → 3-5 seconds for payment initiation
4. **Course 1 Issue** → Times out during payment init

---

## 🛠️ Improvements (14 Total)

### Implement in Order:

```
Week 1 (CRITICAL):
1. Fix verification endpoint
2. Add input validation  
3. Standardize error responses
→ Target: 80% pass rate

Week 2 (HIGH):
4. Add caching
5. Retry mechanism
6. Rate limiting
→ Target: 90% pass rate

Week 3 (MEDIUM):
7. Logging
8. Prometheus metrics
9. Webhooks
10. Optimize response times
→ Target: 95% pass rate

Week 4 (LOW):
11-14. Additional features
→ Target: 98% pass rate
```

---

## 📁 Files Reference

| File | Purpose |
|------|---------|
| `test_momo_fast.py` | Fast 14-test suite (RECOMMENDED) |
| `test_momo_payments_improved.py` | Full test with DB context |
| `PAYMENT_SYSTEM_IMPROVEMENTS.py` | Implementation guide + code |
| `MOMO_PAYMENT_TEST_REPORT.xlsx` | Excel report (2 sheets) |
| `MOMO_PAYMENT_TEST_SUMMARY.md` | Detailed analysis |
| `momo_test_results_*.json` | Raw test results |

---

## 💡 Tips

### Run Specific Tests Only
Modify `test_momo_fast.py` lines 80-110, remove unwanted tests

### Add Custom Test Case
```python
# In test_momo_fast.py, add to tests list:
("MOMO-XXX", "Your Test", "/endpoint", 
 "POST", {"your": "payload"}, [200])
```

### Check Response Details
```bash
cat backend/momo_test_results_comprehensive_1776867256.json | python3 -m json.tool
```

### Backend Logs
```bash
# View payment logs
tail -f backend/logs/payment_*.log

# View Flask logs
grep "payment\|error\|warning" backend/logs/*.log
```

---

## ✅ Verification Checklist

- [ ] Backend running on :5001
- [ ] Test file executable: `chmod +x backend/test_momo_fast.py`
- [ ] Dependencies installed: `pip list | grep -E "requests|openpyxl"`
- [ ] Real courses in DB (IDs 1-3)
- [ ] MTN credentials in .env
- [ ] No other tests interfering

---

## 📞 Common Issues

### "Connection refused on port 5001"
```bash
cd backend
./run.sh
# Wait 3-5 seconds for startup
```

### "No module requests"
```bash
cd backend
./venv/bin/pip install requests
```

### "Test timeouts after 5 seconds"
→ Backend might be slow. Check `/logs/` for errors

### "All tests fail with 500 error"
→ Check .env file, MTN credentials, database connection

---

## 🎯 Success Metrics

After Week 1 (Critical Fixes):
- [ ] Pass rate 80%+ (from 57%)
- [ ] All endpoints return valid JSON
- [ ] Clear error messages for invalid input
- [ ] Verification endpoint working

After Week 2 (High Priority):
- [ ] Pass rate 90%+
- [ ] Response time <1 second avg
- [ ] No transient failures
- [ ] Rate limiting active

After Week 4 (All):
- [ ] Pass rate 98%+
- [ ] Full audit trail
- [ ] Real-time monitoring
- [ ] Multi-currency support

---

## 📚 Documentation

- **Full Analysis:** `MOMO_PAYMENT_TEST_SUMMARY.md`
- **Implementation:** `PAYMENT_SYSTEM_IMPROVEMENTS.py` (code examples)
- **Test Code:** `test_momo_fast.py` (self-documented)
- **Excel Report:** 2 sheets (Results + Summary)

---

## 🔍 Next Steps

1. **Run tests** (this page, Step 2)
2. **Review results** in Excel or terminal
3. **Read summary** (`MOMO_PAYMENT_TEST_SUMMARY.md`)
4. **Implement fixes** following the roadmap
5. **Re-test** after each fix
6. **Push to repo** when improvements complete

---

**Last Updated:** 2026-04-22  
**Status:** ✅ Ready for testing  
**Support:** See `MOMO_PAYMENT_TEST_SUMMARY.md` for details
