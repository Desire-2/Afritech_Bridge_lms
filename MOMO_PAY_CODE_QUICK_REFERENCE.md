# MOMO Pay Code - Quick Reference Guide

## 🎯 Quick Summary

MOMO Pay Code is a **manual USSD-based payment method** where users dial a code on their phone, confirm the recipient, pay, then upload a screenshot as proof.

## 📋 What Was Added

### Backend
- ✅ `momo_pay_code` payment method handler in Flask
- ✅ Screenshot upload endpoint with file validation
- ✅ Migration script to add database column

### Frontend  
- ✅ USSD code instruction display component
- ✅ Screenshot upload component
- ✅ Integration into payment form
- ✅ New payment status indicators

## 🚀 Deployment

1. **Run migration:**
   ```bash
   cd backend
   python add_momo_pay_code_support.py
   ```

2. **Restart backend & deploy frontend**

3. **Enable in course settings** → Check "MOMO Pay Code (USSD)"

## 📱 User Flow

1. Select "MoMo Pay Code (USSD)" payment method
2. Click "Pay Now" to get USSD code
3. Dial code on phone: `*182*8*1*594389*{amount}#`
4. Confirm recipient: "Desire"  
5. Approve payment
6. Take screenshot of confirmation
7. Upload screenshot in browser
8. Admin verifies and confirms payment

## 📂 Key Files

| File | Purpose |
|------|---------|
| `backend/src/models/course_models.py` | Added `momo_pay_code_enabled` column |
| `backend/src/routes/application_routes.py` | Payment handler + upload endpoint |
| `backend/add_momo_pay_code_support.py` | Migration script |
| `frontend/src/components/payments/MoMoPayCodeInstructions.tsx` | Instructions display |
| `frontend/src/components/payments/ScreenshotUpload.tsx` | File upload component |
| `frontend/src/components/applications/CourseApplicationForm.tsx` | Integration into form |

## 🔧 Hardcoded Values

- **USSD Merchant Code:** `594389`
- **Recipient Name:** `Desire`
- **Currency:** `RWF`
- **Max File Size:** 5MB
- **Allowed Types:** JPEG, PNG, WebP

To change these, edit `backend/src/routes/application_routes.py` in the `initiate_payment()` function.

## 🔐 Security

- JWT authentication on upload
- File type & size validation
- User ownership verification
- Secure filename generation (UUID)
- Manual admin verification

## 📊 Payment Statuses

| Status | Meaning |
|--------|---------|
| `pending_screenshot` | Waiting for user to upload screenshot |
| `pending_verification` | Screenshot uploaded, admin review pending |
| `confirmed` | Payment verified by admin ✅ |
| `failed` | Payment rejected by admin ❌ |

## 🧪 Test Locally

```bash
# 1. Check payment initiation
curl -X POST http://localhost:5000/api/v1/applications/initiate-payment \
  -H "Content-Type: application/json" \
  -d '{"course_id": 1, "payment_method": "momo_pay_code", "amount": 5000, "currency": "RWF"}'

# 2. Test upload endpoint
curl -X POST http://localhost:5000/api/v1/applications/1/upload-payment-screenshot \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "screenshot=@test.png"

# 3. Frontend - Select payment method and test flow
```

## 🐛 Common Issues

| Issue | Solution |
|-------|----------|
| USSD code not showing | Click "Pay Now" first |
| Upload fails | Check file type (JPEG/PNG/WebP) and size (<5MB) |
| Can't see screenshot in admin | Check `/uploads/payment_screenshots/` permissions |
| JWT errors on upload | Ensure valid token in Authorization header |

## 📞 Admin Tasks

1. **Enable for course:**
   - Course Settings → Payment Methods → Check "MOMO Pay Code (USSD)"

2. **Review payment:**
   - Applications → Filter by `pending_verification`
   - View uploaded screenshot
   - Mark as "Confirmed" or "Failed"

3. **Process application:**
   - Once confirmed, approve application
   - User notified via email

## 🎨 UI Colors

- **Payment Selection:** Yellow card with phone icon
- **Instructions:** Yellow/amber background with step numbers
- **Upload:** Yellow dashed border with upload icon
- **Status:** Amber background while pending, green when confirmed

## 💾 Environment Variables

**No new env vars needed!** All values are hardcoded. If you need to customize:

Edit in `backend/src/routes/application_routes.py`:
```python
merchant_code = "594389"      # Change merchant ID
recipient_name = "Desire"      # Change recipient name
```

## ✅ Pre-Deployment Checklist

- [ ] Run migration script
- [ ] Restart backend server
- [ ] Clear browser cache / deploy new frontend
- [ ] Create test course
- [ ] Enable MOMO Pay Code for test course
- [ ] Test payment flow end-to-end
- [ ] Verify file uploads save correctly
- [ ] Test admin verification workflow
- [ ] Check logs for errors
- [ ] Test on mobile device

## 📞 Support

For detailed information, see: `MOMO_PAY_CODE_IMPLEMENTATION.md`

For payment system overview, see: `payment_system_analysis.md`
