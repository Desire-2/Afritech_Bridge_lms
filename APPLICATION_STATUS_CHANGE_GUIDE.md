# Application Status Change Feature - Implementation Guide

## Overview
Added the ability for admins to directly change the status of course applications through a dedicated button and modal in the admin dashboard.

## Implementation Details

### Backend
**Endpoint:** `PUT /api/v1/applications/<id>/status`

**Location:** `backend/src/routes/application_routes.py` (lines 365-425)

**Authorization:** Admin or Instructor roles only

**Request Body:**
```json
{
  "status": "pending|approved|rejected|waitlisted|withdrawn",
  "reason": "Optional reason for status change"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Application status changed to {new_status}",
  "data": {
    "id": 123,
    "old_status": "pending",
    "new_status": "approved"
  }
}
```

**Features:**
- Validates status against allowed values
- Records the change with timestamp and admin ID
- Logs reason in admin_notes (or rejection_reason for rejections)
- Returns old and new status for verification

### Frontend

**Service Method:** `application.service.ts` - `changeStatus(id, data)`

**Location:** `frontend/src/services/api/application.service.ts` (lines 244-254)

**UI Components:**

1. **Change Status Button**
   - Added to each application card in the list view
   - Located after "View Details" button
   - Icon: RefreshCw (circular arrows)
   - Opens status change modal

2. **Status Change Modal** 
   - Dropdown selector with 5 status options:
     - Pending
     - Approved
     - Rejected  
     - Waitlisted
     - Withdrawn
   - Optional reason textarea for audit trail
   - Warning alert showing status transition
   - Contextual alerts for each status type
   - Disabled if no status selected or status unchanged

**Handler Function:** `handleChangeStatus()`

**Location:** `frontend/src/components/applications/AdminApplicationsManager.tsx` (lines 344-372)

**State Variables:**
- `statusChangeModalOpen` - Modal visibility
- `newStatus` - Selected status from dropdown
- `statusChangeReason` - Optional reason text

## Usage

### For Admins:

1. **Navigate to Admin Dashboard** → Applications Management

2. **Locate Application** in the list view

3. **Click "Change Status" button** next to "View Details"

4. **Select New Status** from dropdown:
   - Move back to pending for re-review
   - Approve to enroll student
   - Reject to send rejection notification
   - Waitlist to hold application
   - Withdraw for student-initiated withdrawals

5. **Add Reason (Optional)** - Recommended for audit purposes

6. **Click "Update Status"**

7. **Confirmation** - Modal closes, list refreshes automatically

### Status Transition Effects:

- **→ Approved:** Enrolls student in course, sends approval email
- **→ Rejected:** Sends rejection notification with reason
- **→ Waitlisted:** Moves to waitlist, can send custom updates later
- **→ Pending:** Resets for re-review
- **→ Withdrawn:** Marks as student-withdrawn

## Differences from Approval/Rejection Buttons

| Feature | Status Change | Approve/Reject Buttons |
|---------|--------------|------------------------|
| **Workflow** | Direct status update | Full enrollment/notification workflow |
| **Flexibility** | Any status → Any status | Only pending → approved/rejected |
| **Email** | No automatic emails | Sends templated emails |
| **Module Progress** | No initialization | Creates module progress records |
| **Use Case** | Quick corrections, bulk fixes | Standard application processing |

## Testing Checklist

- [ ] Status change button appears on all application cards
- [ ] Modal opens with current status pre-selected
- [ ] Dropdown contains all 5 status options
- [ ] Reason field is optional
- [ ] Cannot submit without selecting status
- [ ] Cannot submit if status unchanged
- [ ] Alert shows correct transition message
- [ ] Loading state shows during submission
- [ ] Error handling displays properly
- [ ] Success closes modal and refreshes list
- [ ] Statistics update after status change
- [ ] Backend validates status values
- [ ] Backend requires admin/instructor role
- [ ] Reason is logged in admin_notes
- [ ] Timestamp recorded in reviewed_at

## API Testing

### Using curl:
```bash
# Login first to get JWT token
JWT_TOKEN="your_jwt_token_here"

# Change status to approved
curl -X PUT http://localhost:5001/api/v1/applications/123/status \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "approved",
    "reason": "Meets all requirements after document verification"
  }'

# Change status to waitlisted
curl -X PUT http://localhost:5001/api/v1/applications/456/status \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "waitlisted",
    "reason": "Course at capacity, moved to waitlist"
  }'
```

## Troubleshooting

### Button not showing:
- Check frontend is running on latest code
- Clear browser cache and refresh
- Verify no console errors

### 403 Unauthorized:
- Ensure logged-in user has admin or instructor role
- Check JWT token is valid
- Verify Authorization header format

### 400 Bad Request:
- Check status value is one of: pending, approved, rejected, waitlisted, withdrawn
- Ensure request body is valid JSON
- Verify Content-Type header is application/json

### Status not updating:
- Check network tab for API response
- Verify database connection
- Check backend logs for errors
- Ensure no database constraints violated

## Future Enhancements

1. **Bulk Status Change** - Select multiple applications and change all at once
2. **Status History** - Track all status transitions with timestamps
3. **Email Notifications** - Optional emails for status changes
4. **Status Workflow Rules** - Prevent invalid transitions (e.g., approved → pending)
5. **Approval Chain** - Multi-level approval process
6. **Status Reasons Template** - Predefined reasons dropdown

## Related Files

### Backend:
- `backend/src/routes/application_routes.py` - Endpoint implementation
- `backend/src/models/course_models.py` - CourseApplication model

### Frontend:
- `frontend/src/services/api/application.service.ts` - API service
- `frontend/src/components/applications/AdminApplicationsManager.tsx` - UI component
- `frontend/src/contexts/AuthContext.tsx` - Authentication

## Deployment Notes

1. **Backend:** No database migration needed (uses existing status column)
2. **Frontend:** Clear Next.js cache after deployment: `rm -rf .next`
3. **Environment:** No new environment variables required
4. **Compatibility:** Works with existing approval/rejection workflows

---

**Last Updated:** 2025-01-27
**Version:** 1.0
**Status:** ✅ Implemented and Ready for Testing
