# Afritech Bridge LMS - Quick Reference: Cohorts & Waitlist

## System Architecture at a Glance

```
COURSE
  ├─ Multiple Application Windows (Cohorts)
  │  └─ Jan 2024 Cohort (50 capacity)
  │  └─ Apr 2024 Cohort (40 capacity)
  │  └─ Jul 2024 Cohort (30 capacity)
  │
  └─ Each Cohort can have:
     ├─ Different application dates (opens_at, closes_at)
     ├─ Different learning dates (cohort_start, cohort_end)
     ├─ Different pricing (free, paid, scholarship)
     └─ Different capacity limits (max_students)
```

---

## Key Models & Relationships

### CourseApplication ↔ ApplicationWindow

```
Student applies → CourseApplication(status='pending', window_id=1)
                      ↓
                Admin reviews
                      ↓
            THREE OUTCOMES:
            ├─ Approve → status='approved'
            ├─ Reject → status='rejected'
            └─ Waitlist → status='waitlisted'
                      ↓
            When next window opens & has capacity:
                      ↓
            MIGRATION → window_id=2, status='pending' (reset)
            Migration fields:
            ├─ original_window_id = 1 (old cohort)
            ├─ migrated_to_window_id = 2 (new cohort)
            └─ migrated_at = timestamp
```

### Enrollment ↔ ApplicationWindow ↔ Payment Verification

```
Approved Application
        ↓
Student enrolls → Enrollment(window_id=1, payment_verified=?)
        ↓
    Cohort Type?
        ├─ FREE → payment_verified=True (auto)
        └─ PAID → payment_verified=False (needs admin action)
        ↓
Admin verifies payment → enrollment.payment_verified=True
        ↓
Access Granted → Student can see course
```

---

## Application Window Fields

### Identity
- `cohort_label`: "Jan 2024", "Batch #5", etc.
- `description`: Optional details about this cohort

### Application Window (When students apply)
- `opens_at`: Application starts
- `closes_at`: Application ends
- `status_override`: Manual status control

### Cohort Learning Period (When course runs)
- `cohort_start`: Course starts
- `cohort_end`: Course ends

### Capacity
- `max_students`: Enrollment limit (NULL = unlimited)
- `get_enrollment_count()`: Current enrolled count

### Payment (can override course defaults)
- `enrollment_type`: 'free', 'paid', 'scholarship' (NULL=inherit)
- `price`: Cohort price (NULL=inherit)
- `scholarship_type`: 'full', 'partial'
- `scholarship_percentage`: 0-100 discount
- `payment_deadline_days`: Days before cohort_start to pay

---

## Waitlist Migration Flow

```
┌──────────────────────────────────────────────────────────────┐
│ WAITLIST MIGRATION PROCESS                                   │
└──────────────────────────────────────────────────────────────┘

1. IDENTIFY WAITLISTED STUDENTS
   WHERE status='waitlisted' AND application_window_id=1

2. FIND NEXT AVAILABLE COHORT
   ApplicationWindow where:
   ├─ course_id matches
   ├─ status = 'open' OR 'upcoming'
   ├─ has capacity (enrollment_count < max_students)
   └─ opens_at > current_window.opens_at

3. CHECK CAPACITY
   available_spots = max_students - enrollment_count
   IF available_spots <= 0:
       → Cannot migrate, cohort full

4. MIGRATE (up to available_spots)
   FOR each waitlisted student (ordered by rank):
       UPDATE CourseApplication:
           original_window_id = 1 (old cohort)
           migrated_to_window_id = 2 (new cohort)
           application_window_id = 2 (current cohort)
           migrated_at = NOW
           status = 'pending' (reset for re-review)
           cohort_label/start_date/end_date = from new window

5. SEND NOTIFICATION EMAIL
   Subject: "Application Update - Course Title (New Cohort)"
   Include:
   ├─ New cohort dates
   ├─ New payment requirement (if any)
   └─ Next steps
```

---

## Critical Endpoints

### Admin: Migration Summary
```
GET /api/v1/admin/waitlist/summary/<course_id>

Shows per cohort:
├─ waitlisted_count
├─ migrated_in_count (from other cohorts)
├─ enrollment_count
├─ available_spots
├─ requires_payment
└─ next_available_cohort
```

### Admin: Migrate Single Application
```
POST /api/v1/admin/waitlist/migrate/<application_id>

{
  "target_window_id": 2,
  "notes": "Migrated per policy",
  "send_email": true
}

Response:
├─ original_window_id (old cohort)
├─ target_window_id (new cohort)
└─ new_status = 'pending' (always reset)
```

### Admin: Bulk Migrate Waitlist
```
POST /api/v1/admin/waitlist/migrate-bulk

{
  "course_id": 1,
  "source_window_id": 1,      (optional: migrate from specific cohort)
  "target_window_id": null,   (auto-detect if omitted)
  "max_count": 20,            (limit migrations)
  "send_emails": true
}

Response:
├─ migrated_count
├─ failed_count
└─ migrated: [application details]
```

### Admin: Payment Verification
```
GET /api/v1/admin/waitlist/enrollment/<enrollment_id>/payment
POST /api/v1/admin/waitlist/enrollment/<enrollment_id>/verify-payment

{
  "payment_status": "completed|waived|pending|failed"
}
```

---

## Payment Rules Summary

### Who Needs to Pay?

| Cohort Type | Scholarship % | Price | Student Pays |
|---|---|---|---|
| FREE | - | - | NO |
| PAID | - | $500 | YES ($500) |
| SCHOLARSHIP (FULL) | 100% | $500 | NO |
| SCHOLARSHIP (50%) | 50% | $500 | YES ($250) |
| SCHOLARSHIP (0%) | 0% | $500 | YES ($500) |

### Access Rules

```python
IF enrollment.payment_verified == True:
    access = GRANTED
ELIF free_cohort:
    access = GRANTED (auto-verified)
ELIF paid_cohort AND payment_status in ('completed', 'waived'):
    access = GRANTED
ELSE:
    access = DENIED
```

---

## Scenario Examples

### Scenario A: Free → Free Migration

```
Jan 2024 Cohort:
├─ enrollment_type = 'free'
├─ 50 students enrolled
└─ 10 waitlisted

Apr 2024 Cohort:
├─ enrollment_type = 'free'
├─ 40 spots available
└─ Opens April 1st

Action:
POST /api/v1/admin/waitlist/migrate-bulk
{
  "course_id": 1,
  "source_window_id": 1,
  "target_window_id": null  (auto-detects Apr)
}

Result:
├─ 10 waitlisted students migrated
├─ All move to Apr cohort
├─ Status reset to 'pending' (re-review)
├─ NO payment required (still free)
└─ enrollment.payment_verified = True (auto)
```

### Scenario B: Free → Paid Migration

```
Jan 2024 Cohort:
├─ enrollment_type = 'free'
├─ 50 students, 10 waitlisted

Apr 2024 Cohort:
├─ enrollment_type = 'paid'
├─ price = $500
├─ 40 spots available

Action:
POST /api/v1/admin/waitlist/migrate-bulk
{
  "course_id": 1,
  "source_window_id": 1,
  "target_window_id": null
}

Result:
├─ 10 students migrated to Apr (paid cohort)
├─ Status = 'pending' (re-review)
├─ requires_payment = TRUE
├─ Notification email sent mentioning $500 payment
├─ Post-approval:
│  └─ enrollment.payment_verified = False (requires action)
│     └─ After payment verified:
│        └─ enrollment.payment_verified = True
│           └─ Access granted
```

### Scenario C: Limited Capacity Migration

```
Jan 2024 Cohort: 30 waitlisted
Apr 2024 Cohort:
├─ max_students = 50
├─ enrollment_count = 48
└─ available_spots = 2

Action:
POST /api/v1/admin/waitlist/migrate-bulk
{
  "course_id": 1,
  "max_count": 20  (requested)
}

Result:
├─ Only TOP 2 migrated (capped by available_spots)
├─ migrated_count = 2
├─ 28 students remain waitlisted in Jan cohort
└─ Wait for May cohort to have more capacity
```

---

## Database Query Patterns

### Find Waitlisted Students
```sql
SELECT * FROM course_applications
WHERE course_id = 1
  AND status = 'waitlisted'
  AND application_window_id = 1
  AND is_draft = False
ORDER BY final_rank_score DESC, created_at ASC;
```

### Find Enrollments Needing Payment Verification
```sql
SELECT * FROM enrollments
WHERE payment_verified = False
  AND status IN ('active', 'pending_payment')
  AND application_window_id IN (
      SELECT id FROM application_windows
      WHERE enrollment_type IN ('paid', 'scholarship')
  );
```

### Check Cohort Capacity
```sql
SELECT 
  aw.id,
  aw.cohort_label,
  aw.max_students,
  COUNT(e.id) as enrollment_count,
  (aw.max_students - COUNT(e.id)) as available_spots
FROM application_windows aw
LEFT JOIN enrollments e ON aw.id = e.application_window_id
  AND e.status IN ('active', 'completed')
GROUP BY aw.id;
```

### Track Migration History
```sql
SELECT 
  id,
  status,
  application_window_id as current_cohort,
  original_window_id as old_cohort,
  migrated_to_window_id as migrated_to,
  migrated_at
FROM course_applications
WHERE original_window_id IS NOT NULL;  -- Has been migrated
```

---

## Common Admin Tasks

### Task 1: Review Waitlisted Applications for a Cohort
```
GET /api/v1/admin/applications
?course_id=1&window_id=1&status=waitlisted

Returns: List of all waitlisted students for Jan 2024 cohort
```

### Task 2: Migrate Waitlist to Next Cohort
```
POST /api/v1/admin/waitlist/migrate-bulk
{
  "course_id": 1,
  "source_window_id": 1,
  "send_emails": true
}

Returns: Migration summary with details
```

### Task 3: Verify Payment for Enrolled Students
```
GET /api/v1/admin/waitlist/enrollments/unpaid?course_id=1&window_id=2

Returns: List of students who haven't paid yet

For each unpaid student:
POST /api/v1/admin/waitlist/enrollment/<enrollment_id>/verify-payment
{
  "payment_status": "completed"
}
```

### Task 4: Check Who Can Access Course
```
Use: WaitlistService.is_enrollment_access_allowed(enrollment)

Returns: (bool allowed, str reason)
- allowed=True if: free cohort OR payment verified
- allowed=False if: paid cohort AND payment not verified
```

---

## Troubleshooting Guide

### Problem: "Target cohort is at capacity"

**Cause**: `target_window.max_students <= target_window.get_enrollment_count()`

**Solution**:
1. Choose different target cohort with capacity
2. Or increase `max_students` on target cohort
3. Or set `max_students = NULL` (unlimited)

### Problem: Student migrated but didn't receive email

**Check**:
1. Was `send_email=true` in migration request?
2. Is student's email in `course_applications.email`?
3. Check Brevo email service logs

### Problem: Migrated student can't access course (paid cohort)

**Check**:
1. Is `enrollment.payment_verified = True`?
   - If False: Admin needs to verify payment
   - Run: `POST .../verify-payment` with `payment_status=completed`
2. Is `enrollment.status = 'active'`?
   - If not: Check why enrollment is suspended/terminated

### Problem: Waitlist not migrating even though next cohort exists

**Check**:
1. Next cohort `status_override = 'open'` or 'upcoming'?
   - If 'closed': Cannot migrate to closed cohort
2. Next cohort has capacity?
   - Run: Check `available_spots` in migration summary
3. Are applications in draft mode?
   - Draft applications don't count for migration (`is_draft=True`)

---

## Important Notes

1. **Migration Resets Status**: When a student is migrated, their `status` goes back to `'pending'` (re-review), not directly to `'approved'`.

2. **Cohort Snapshot**: Each application stores `cohort_label`, `cohort_start_date`, `cohort_end_date` at the time of application/migration for audit trail.

3. **Capacity Check**: Includes both actual enrollments AND pending applications that are migrating (`status='pending'`).

4. **Free Cohorts Auto-Verify**: For free cohorts, `payment_verified` is automatically set to `True` on enrollment.

5. **Paid Cohorts Block Access**: Students in paid cohorts cannot access course until `payment_verified=True`.

6. **Inheritance Pattern**: Most cohort settings inherit from course unless explicitly overridden (NULL = inherit).

---

**Quick Links**:
- Full Report: `COHORTS_WAITLIST_ANALYSIS_REPORT.md`
- Backend Code: `backend/src/services/waitlist_service.py`
- Routes: `backend/src/routes/waitlist_routes.py`
- Models: `backend/src/models/course_models.py` & `course_application.py`

