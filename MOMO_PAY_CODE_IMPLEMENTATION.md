# MOMO Pay Code Payment Method - Implementation Guide

## Feature Overview

The MOMO Pay Code payment method is a **manual USSD-based payment flow** where users:
1. Dial a generated USSD code on their phone
2. Confirm the recipient is "Desire"
3. Complete the payment
4. Upload a screenshot as proof
5. Admin manually verifies the payment

This provides an alternative payment method for users who prefer USSD over direct APIs.

---

## Implementation Details

### Backend Changes

#### 1. **Course Model Updates** (`backend/src/models/course_models.py`)

**Column Added:**
```python
momo_pay_code_enabled = db.Column(db.Boolean, default=False, nullable=False)  
# MoMo Pay Code (USSD) payment toggle
```

**Method Updated:**
- `_get_payment_methods()` now includes `momo_pay_code` in the returned list when enabled

#### 2. **Payment Initiation** (`backend/src/routes/application_routes.py`)

**Route:** `POST /api/v1/applications/initiate-payment`

**Handler Logic:**
```python
elif payment_method == "momo_pay_code":
    # Amount must be whole integer (no decimals)
    amount_int = int(amount) if amount == int(amount) else int(amount) + 1
    
    # USSD code format: *182*8*1*594389*<AMOUNT>#
    ussd_code = f"*182*8*1*594389*{amount_int}#"
    
    # Response includes:
    # - ussd_code: The dial code
    # - amount: Integer amount in RWF
    # - currency: "RWF" (hardcoded)
    # - recipient_name: "Desire"
    # - requires_screenshot: true
    # - instructions: User-friendly steps
```

**Response Format:**
```json
{
  "success": true,
  "payment_method": "momo_pay_code",
  "ussd_code": "*182*8*1*594389*5000#",
  "amount": 5000,
  "currency": "RWF",
  "recipient_name": "Desire",
  "instructions": "...",
  "requires_screenshot": true,
  "message": "USSD code ready. Dial the code on your phone, then upload a screenshot."
}
```

#### 3. **Screenshot Upload** (`backend/src/routes/application_routes.py`)

**Route:** `POST /api/v1/applications/<int:application_id>/upload-payment-screenshot`

**Protected By:** JWT authentication (`@jwt_required()`)

**Request:**
```
multipart/form-data
- screenshot: File (jpg/png/webp, max 5MB)
```

**Validations:**
- File type: JPEG, PNG, WebP only
- File size: Maximum 5MB
- User ownership: Only applicant or admin can upload
- File will be saved to: `/uploads/payment_screenshots/<app_id>_<uuid>.<ext>`

**Updates Application:**
- `payment_slip_filename`: Unique filename
- `payment_slip_url`: Relative URL path
- `payment_status`: Set to `"pending_verification"`

**Response:**
```json
{
  "success": true,
  "message": "Screenshot uploaded. Your payment is pending admin verification.",
  "payment_status": "pending_verification"
}
```

**Error Responses:**
```json
// File too large
{ "success": false, "message": "File too large. Maximum size is 5MB, got 6.2MB" }

// Invalid file type
{ "success": false, "message": "Invalid file type. Only JPEG, PNG, and WebP images are allowed." }

// Unauthorized
{ "success": false, "message": "Unauthorized" }

// No file provided
{ "success": false, "message": "No screenshot file provided" }
```

#### 4. **Database Schema**

**No new tables needed.** Uses existing `CourseApplication` fields:
- `payment_slip_filename` - Stores filename
- `payment_slip_url` - Stores URL/path
- `payment_status` - Tracks status (now includes 'pending_screenshot', 'pending_verification')

**New Column in `courses` table:**
- `momo_pay_code_enabled` - Boolean toggle (default: false)

---

### Frontend Changes

#### 1. **Payment Method Selection**

**Label Entry in methodLabels:**
```typescript
momo_pay_code: { 
  label: 'MoMo Pay Code (USSD)', 
  sub: 'Manual USSD dial & screenshot', 
  color: 'yellow' 
}
```

Appears as a yellow-themed option in payment method selector grid.

#### 2. **MoMoPayCodeInstructions Component**

**File:** `frontend/src/components/payments/MoMoPayCodeInstructions.tsx`

**Props:**
```typescript
interface MoMoPayCodeInstructionsProps {
  ussdCode: string;          // e.g., "*182*8*1*594389*5000#"
  amount: number;            // Payment amount
  currency: string;          // Currency code
  recipientName: string;     // "Desire"
  onScreenshotReady?: (file: File) => void;
  loading?: boolean;
}
```

**Features:**
- Displays USSD code in large monospace format
- Copy button to clipboard
- Step-by-step instructions (6 steps)
- Important warning about verifying recipient name
- Pro tips section
- Color-coded steps with icons

#### 3. **ScreenshotUpload Component**

**File:** `frontend/src/components/payments/ScreenshotUpload.tsx`

**Props:**
```typescript
interface ScreenshotUploadProps {
  applicationId: number;
  onSuccess?: () => void;
  onError?: (error: string) => void;
  apiUrl?: string;
}
```

**Features:**
- Drag-and-drop or click to upload
- Preview thumbnail
- File type/size validation (JPEG/PNG/WebP, 5MB max)
- Upload progress indicator
- Success message on completion
- Error handling with user-friendly messages
- Shows success state after upload

#### 4. **Integration into CourseApplicationForm**

**Section added after bank_transfer section:**
```typescript
{formData.payment_method === 'momo_pay_code' && (() => {
  return (
    <div>
      {paymentReference ? (
        // Show instructions + upload
        <MoMoPayCodeInstructions ... />
        <ScreenshotUpload ... />
      ) : (
        // Show prompt to click "Pay Now"
      )}
    </div>
  );
})()}
```

#### 5. **Payment Status Display**

**New statuses handled:**
- `pending_screenshot`: "Awaiting Your Screenshot" (yellow/amber)
- `pending_verification`: "Screenshot Received — Under Review" (yellow/amber with spinner)

---

### Database Migration

**Run this script once after deploying:**
```bash
python backend/add_momo_pay_code_support.py
```

**This script:**
1. Adds `momo_pay_code_enabled` column to `courses` table
2. Creates `/uploads/payment_screenshots/` directory
3. Sets proper permissions

---

## User Flow

### Step 1: Select Payment Method
- User sees "MoMo Pay Code (USSD)" option in payment method selector
- User clicks on it (yellow card)

### Step 2: Generate USSD Code
- User clicks "Pay Now" button
- Backend generates unique USSD code: `*182*8*1*594389*{amount}#`
- Frontend displays instructions

### Step 3: Dial USSD Code
- User dials code on their phone
- User confirms recipient is "Desire"
- User approves payment

### Step 4: Upload Proof
- User takes screenshot of payment confirmation
- User uploads screenshot using the upload component
- File is validated (type, size)
- Screenshot is saved to `/uploads/payment_screenshots/`
- Application status changes to `pending_verification`

### Step 5: Admin Verification
- Admin sees application with `pending_verification` status
- Admin views uploaded screenshot
- Admin confirms payment received
- Admin updates `payment_status` to `confirmed` or `completed`
- Application is approved or moved to next stage

---

## Configuration

### Environment Variables (Backend)

**No new env vars needed!** USSD merchant code is hardcoded:
```python
merchant_code = "594389"  # Desire's MTN MoMo merchant code
```

If you need to change it later, edit in `initiate_payment()`:
```python
ussd_code = f"*182*8*1*{merchant_code}*{amount_int}#"
```

### Admin Configuration (Course Settings)

Instructors/admins can enable per course:
1. Go to course payment settings
2. Check the box: **"Enable MoMo Pay Code (USSD)"**
3. Save

---

## Testing

### Local Testing

1. **Enable for test course:**
   - Set `momo_pay_code_enabled = true` in database for test course

2. **Test payment initiation:**
   ```bash
   curl -X POST http://localhost:5000/api/v1/applications/initiate-payment \
     -H "Content-Type: application/json" \
     -d '{
       "course_id": 1,
       "payment_method": "momo_pay_code",
       "amount": 5000,
       "currency": "RWF"
     }'
   ```
   
   **Expected response:**
   ```json
   {
     "success": true,
     "payment_method": "momo_pay_code",
     "ussd_code": "*182*8*1*594389*5000#",
     "amount": 5000,
     "currency": "RWF",
     "recipient_name": "Desire",
     ...
   }
   ```

3. **Test screenshot upload:**
   ```bash
   curl -X POST http://localhost:5000/api/v1/applications/1/upload-payment-screenshot \
     -H "Authorization: Bearer <JWT_TOKEN>" \
     -F "screenshot=@test-screenshot.png"
   ```

4. **Test frontend:**
   - Select MOMO Pay Code payment method
   - Click "Pay Now"
   - Copy USSD code (or show it)
   - Upload a test screenshot
   - Verify `pending_verification` status

### Production Testing

1. **Sandbox MTN MoMo numbers (if applicable)**
2. **Test course with small amount (e.g., 100 RWF)**
3. **Verify file uploads reach correct directory**
4. **Verify admin can see and verify payments**

---

## Security Considerations

1. **JWT Protection:** Screenshot upload endpoint requires valid JWT
2. **File Validation:** Type and size validated on backend
3. **Ownership Check:** Users can only upload for their own applications (or admins)
4. **Safe Filename:** Filenames are secure (UUID-based)
5. **Directory Structure:** Screenshots stored outside web root if possible
6. **Manual Verification:** No automatic approval - admin must review

---

## Error Handling

### Frontend Validation
- File too large → Show error
- Invalid file type → Show error
- Network error → Show error with retry option

### Backend Validation
- Missing screenshot → 400 error
- Wrong MIME type → 400 error
- File too large → 400 error
- Unauthorized user → 403 error
- Application not found → 404 error
- Upload failure → 500 error with rollback

---

## Admin Interface Changes

### Applications List
- Show `payment_status` column (highlight `pending_verification`)
- Add filter by payment_status

### Application Detail
- Show uploaded screenshot (clickable to view)
- Button to mark as verified: `payment_status = "confirmed"`
- Button to reject: `payment_status = "failed"`
- Add note field for admin comments

### Payments Dashboard
- Add new metric: "Pending Screenshot Verification"
- Show count of applications with `pending_verification`

---

## Future Enhancements

1. **Auto-Verification:**
   - OCR to extract transaction ID from screenshot
   - Validate against MTN API (if available)
   - Auto-confirm if matching

2. **Email Notifications:**
   - Send email when screenshot uploaded
   - Send email to admin for review
   - Send email to user when verified

3. **Retry Logic:**
   - Allow users to re-upload if rejected
   - Auto-retry with exponential backoff

4. **Payment Reconciliation:**
   - Generate daily reports of verified payments
   - Reconcile against bank statements

5. **Webhook Support:**
   - Implement MTN MoMo webhooks for direct confirmation
   - Reduce reliance on manual screenshots

---

## Troubleshooting

### Issue: USSD Code not copying
- **Solution:** Check browser clipboard permissions

### Issue: Screenshot upload fails
- **Solution:** 
  - Check file size (max 5MB)
  - Check file type (JPEG/PNG/WebP)
  - Verify JWT token is valid
  - Check `/uploads/` directory permissions

### Issue: Admin can't see screenshot
- **Solution:**
  - Verify file was saved to `/uploads/payment_screenshots/`
  - Check web server can serve static files
  - Verify URL path is correct in database

### Issue: Payment status not updating
- **Solution:**
  - Verify application_id in upload request
  - Check database transaction committed
  - Refresh page to see latest status

---

## Files Modified/Created

### Backend
- ✅ `backend/src/models/course_models.py` - Added `momo_pay_code_enabled` column & support in `_get_payment_methods()`
- ✅ `backend/src/routes/application_routes.py` - Added handler & upload endpoint
- ✅ `backend/add_momo_pay_code_support.py` - Migration script

### Frontend  
- ✅ `frontend/src/components/payments/MoMoPayCodeInstructions.tsx` - New component (instructions)
- ✅ `frontend/src/components/payments/ScreenshotUpload.tsx` - New component (upload)
- ✅ `frontend/src/components/applications/CourseApplicationForm.tsx` - Integrated new payment method & updated status display

---

## Deployment Checklist

- [ ] Run migration script: `python backend/add_momo_pay_code_support.py`
- [ ] Restart backend server
- [ ] Clear frontend cache (or deploy new build)
- [ ] Create test course and enable MOMO Pay Code
- [ ] Test payment flow end-to-end
- [ ] Verify file uploads save correctly
- [ ] Test admin verification workflow
- [ ] Document USSD code in admin guide
- [ ] Train admins on verification process
- [ ] Update Terms of Service / Payment Info page
- [ ] Monitor for any errors in logs

---

## Support

For issues or questions:
1. Check logs: `backend/` and browser console
2. Review troubleshooting section above
3. Test each component independently
4. Verify all files are in place
5. Check database schema
