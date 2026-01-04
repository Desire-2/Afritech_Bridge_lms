# Bulk Actions for Course Applications

## Overview
The bulk action endpoint allows administrators and instructors to process multiple course applications at once, improving efficiency when dealing with large volumes of applications.

## Endpoint
```
POST /api/v1/applications/bulk-action
```

## Authentication
- Requires JWT token in Authorization header
- User must have `admin` or `instructor` role

## Request Body
```json
{
  "action": "approve | reject | waitlist",
  "application_ids": [1, 2, 3, 4, 5],
  "rejection_reason": "Required for reject action",
  "custom_message": "Optional custom message for emails",
  "send_emails": true,
  "batch_size": 50
}
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `action` | string | Yes | Action to perform: `approve`, `reject`, or `waitlist` |
| `application_ids` | array | Yes | Array of application IDs to process (max 100) |
| `rejection_reason` | string | Conditional | Required when action is `reject` |
| `custom_message` | string | No | Custom message to include in emails |
| `send_emails` | boolean | No | Whether to send notification emails (default: true) |
| `batch_size` | integer | No | Number of apps to process per batch (default: 50) |

## Response
```json
{
  "message": "Bulk approve completed",
  "results": {
    "success": [
      {"id": 1, "status": "approved"},
      {"id": 2, "status": "approved"}
    ],
    "failed": [
      {"id": 3, "error": "Application already approved"}
    ]
  },
  "total_processed": 3,
  "successful": 2,
  "failed": 1
}
```

## Actions

### 1. Approve Applications
Creates user accounts and enrollments for approved applications.

**Features:**
- Creates new user accounts with temporary passwords
- Handles existing users (creates enrollment only)
- Prevents duplicate enrollments
- Sends welcome emails with login credentials
- Tracks reviewer and timestamp

**Example:**
```bash
curl -X POST https://afritech-bridge-lms-pc6f.onrender.com/api/v1/applications/bulk-action \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "approve",
    "application_ids": [1, 2, 3],
    "custom_message": "Welcome to our program! Looking forward to having you."
  }'
```

### 2. Reject Applications
Rejects multiple applications with a reason.

**Features:**
- Records rejection reason
- Sends empathetic rejection emails
- Tracks reviewer and timestamp
- Allows applicants to understand decision

**Example:**
```bash
curl -X POST https://afritech-bridge-lms-pc6f.onrender.com/api/v1/applications/bulk-action \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "reject",
    "application_ids": [4, 5, 6],
    "rejection_reason": "Course prerequisites not met. Please review course requirements and reapply after completing prerequisite courses."
  }'
```

### 3. Waitlist Applications
Moves applications to waitlist status.

**Features:**
- Sets waitlist status
- Sends waitlist notification emails
- Tracks reviewer and timestamp
- Keeps applicants engaged

**Example:**
```bash
curl -X POST https://afritech-bridge-lms-pc6f.onrender.com/api/v1/applications/bulk-action \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "waitlist",
    "application_ids": [7, 8, 9],
    "custom_message": "Your application shows great potential! We will contact you if a spot opens."
  }'
```

## Error Handling

### Validation Errors (400)
```json
{
  "error": "Invalid action. Must be 'approve', 'reject', or 'waitlist'"
}
```

```json
{
  "error": "application_ids must be a non-empty array"
}
```

```json
{
  "error": "rejection_reason is required for reject action"
}
```

```json
{
  "error": "Too many applications. Maximum 100 per batch, received 150"
}
```

### Authorization Errors (403)
```json
{
  "error": "Unauthorized. Admin or instructor access required."
}
```

### Per-Application Errors
Individual application failures are tracked in the response:
```json
{
  "results": {
    "failed": [
      {"id": 5, "error": "Application not found"},
      {"id": 6, "error": "Application already approved"},
      {"id": 7, "error": "User already enrolled in this course"},
      {"id": 8, "error": "Course not found"}
    ]
  }
}
```

## Features & Improvements

### 1. Performance Optimization
- **Batch fetching**: All applications fetched in single query
- **Maximum batch size**: Limited to 100 applications per request
- **Email batching**: Option to disable emails for large batches
- **Transaction management**: Single commit for all successful operations

### 2. Error Recovery
- **Partial success**: Failed applications don't block others
- **Detailed error tracking**: Each failure recorded with specific reason
- **Rollback safety**: Database rollback on critical errors

### 3. Audit Trail
- **Logging**: All bulk actions logged with user ID and timestamp
- **Reviewer tracking**: `reviewed_by` and `reviewed_at` fields updated
- **Action history**: Complete audit trail for compliance

### 4. Email Notifications
- **Conditional sending**: Can disable emails for testing or large batches
- **Non-blocking**: Email failures don't block application processing
- **Custom messages**: Support for personalized messages
- **Template-based**: Uses consistent, professional email templates

### 5. Validation & Safety
- **Status checking**: Only pending applications can be processed
- **Duplicate prevention**: Checks for existing enrollments
- **Role validation**: Admin/instructor access only
- **Input sanitization**: All inputs validated before processing

## Best Practices

### 1. Test First
Always test with a small batch before processing large volumes:
```json
{
  "action": "approve",
  "application_ids": [1],
  "send_emails": false
}
```

### 2. Review Results
Always check the response for failed applications:
```javascript
if (response.failed > 0) {
  console.log("Failed applications:", response.results.failed);
}
```

### 3. Large Batches
For very large batches (50+), consider:
- Splitting into multiple requests
- Disabling emails and sending separately
- Processing during off-peak hours

### 4. Email Management
When processing many applications:
```json
{
  "send_emails": false  // Process first, send emails separately if needed
}
```

## Frontend Integration

### React/TypeScript Example
```typescript
import { applicationService } from '@/services/api/application.service';

async function handleBulkApprove(applicationIds: number[]) {
  try {
    const result = await applicationService.bulkAction({
      action: 'approve',
      application_ids: applicationIds,
      custom_message: 'Welcome to our program!'
    });
    
    console.log(`✅ Approved: ${result.successful}`);
    console.log(`❌ Failed: ${result.failed}`);
    
    if (result.failed > 0) {
      result.results.failed.forEach(fail => {
        console.error(`Application ${fail.id}: ${fail.error}`);
      });
    }
    
    return result;
  } catch (error) {
    console.error('Bulk action failed:', error);
    throw error;
  }
}
```

## Monitoring & Maintenance

### Log Files
Check backend logs for:
```
[INFO] Bulk approve initiated by user 123 for 10 applications
[INFO] Bulk approve completed: 8 successful, 2 failed
[WARNING] Failed to send approval email for app 5: SMTP timeout
```

### Database Queries
Monitor query performance:
```sql
-- Find all bulk actions today
SELECT 
  reviewed_by, 
  status, 
  COUNT(*) as count,
  reviewed_at
FROM course_application
WHERE DATE(reviewed_at) = CURRENT_DATE
GROUP BY reviewed_by, status, reviewed_at;
```

### Performance Metrics
- Average processing time per application: < 500ms
- Email send success rate: > 95%
- Database transaction success rate: > 99%

## Troubleshooting

### Issue: "Method Not Allowed (405)"
**Solution**: Ensure the endpoint is registered in `main.py` and the Flask app is restarted.

### Issue: Bulk action times out
**Solutions:**
1. Reduce batch size
2. Disable email sending
3. Check database connection pool size
4. Monitor server resources

### Issue: Some emails not sent
**Diagnosis:**
- Check email logs for specific failures
- Verify SMTP configuration
- Test with a single email first

### Issue: Transaction rollback
**Common causes:**
- Database constraint violations
- Duplicate enrollments
- Invalid foreign keys

Check error logs for specific database errors.

## Security Considerations

1. **Rate Limiting**: Consider adding rate limits for bulk operations
2. **Audit Logging**: All bulk actions are logged with user ID
3. **Authorization**: Double-check admin/instructor roles
4. **Input Validation**: All inputs sanitized and validated
5. **Email Safety**: Email addresses validated before sending

## Future Enhancements

- [ ] Add progress tracking for long-running batches
- [ ] Implement webhook notifications
- [ ] Add scheduling for delayed processing
- [ ] Export bulk action reports
- [ ] Add undo/rollback capability
- [ ] Implement async processing with Celery/Redis

---

**Last Updated**: January 3, 2026
**Version**: 1.0
**Maintainer**: Afritec Bridge LMS Team
