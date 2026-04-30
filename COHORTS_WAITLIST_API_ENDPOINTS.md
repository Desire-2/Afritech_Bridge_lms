# Afritech Bridge LMS - API Endpoints Reference

## Complete Endpoint Listing for Cohorts & Waitlist Features

### BASE URL
```
Backend: http://localhost:5000/api/v1
Frontend uses: process.env.NEXT_PUBLIC_API_URL
```

---

## SECTION 1: APPLICATION MANAGEMENT

### 1.1 Course Application CRUD

#### Submit New Application
```http
POST /applications
Authorization: None (Public endpoint)
Content-Type: application/json

Request Body:
{
  "course_id": 1,
  "application_window_id": 1,           ← Which cohort
  "full_name": "John Doe",
  "email": "john@example.com",
  "phone": "+237123456789",
  "whatsapp_number": "+237123456789",
  "gender": "male",
  "age_range": "25_34",
  "country": "Cameroon",
  "city": "Yaounde",
  "education_level": "bachelors",
  "current_status": "employed",
  "field_of_study": "Finance",
  "has_used_excel": true,
  "excel_skill_level": "intermediate",
  "excel_tasks_done": ["pivot_tables", "charts"],
  "motivation": "Want to improve Excel skills for work",
  "learning_outcomes": "Master advanced formulas and dashboards",
  "career_impact": "Better job opportunities",
  "has_computer": true,
  "internet_access_type": "stable_broadband",
  "preferred_learning_mode": "self_paced",
  "available_time": ["evening", "weekend"],
  "committed_to_complete": true,
  "agrees_to_assessments": true,
  "referral_source": "friend recommendation",
  "payment_method": "mobile_money",
  "payment_status": "pending"
}

Response (200 OK):
{
  "id": 42,
  "course_id": 1,
  "full_name": "John Doe",
  "email": "john@example.com",
  "status": "pending",
  "application_window_id": 1,
  "cohort_label": "Jan 2024",
  "cohort_start_date": "2024-02-01T00:00:00",
  "cohort_end_date": "2024-05-31T23:59:59",
  "created_at": "2024-01-15T10:30:00",
  "is_draft": false
}
```

---

#### Check Duplicate Application
```http
GET /applications/check-duplicate?email=john@example.com&course_id=1
Authorization: None (Public)

Response (200 OK):
{
  "email": "john@example.com",
  "course_id": 1,
  "exists": true,
  "application_id": 42,
  "status": "pending"
}
```

---

#### Save Application as Draft
```http
POST /applications/save-draft
Authorization: None
Content-Type: application/json

Request:
{
  "course_id": 1,
  "application_window_id": 1,
  "full_name": "John Doe",
  "email": "john@example.com",
  ... (partial data, not required to be complete)
}

Response (200 OK):
{
  "id": 43,
  "is_draft": true,
  "message": "Application saved as draft"
}
```

---

#### List All Applications (Admin/Instructor)
```http
GET /applications?course_id=1&page=1&per_page=20
Authorization: Bearer <JWT>
Role Required: admin or instructor

Query Parameters:
- course_id: (optional) Filter by course
- window_id: (optional) Filter by cohort
- status: (optional) pending|approved|rejected|waitlisted
- is_draft: (optional) true|false
- page: (optional) Page number (default 1)
- per_page: (optional) Items per page (default 20)
- sort_by: (optional) field name
- order: (optional) asc|desc

Response (200 OK):
{
  "applications": [
    {
      "id": 42,
      "full_name": "John Doe",
      "email": "john@example.com",
      "course_id": 1,
      "application_window_id": 1,
      "cohort_label": "Jan 2024",
      "status": "pending",
      "risk_score": 15,
      "application_score": 85,
      "final_rank_score": 87.5,
      "is_draft": false,
      "created_at": "2024-01-15T10:30:00"
    }
  ],
  "total": 127,
  "page": 1,
  "per_page": 20
}
```

---

#### Advanced Search Applications
```http
POST /applications/advanced-search
Authorization: Bearer <JWT>
Content-Type: application/json
Role Required: admin or instructor

Request:
{
  "course_id": 1,
  "window_id": 1,
  "status": "waitlisted",
  "is_high_risk": false,
  "score_min": 70,
  "score_max": 100,
  "email_keyword": "john",
  "country": "Cameroon",
  "education_level": "bachelors",
  "current_status": "employed",
  "excel_skill_min": "intermediate",
  "internet_access": "stable_broadband",
  "has_computer": true,
  "committed": true,
  "sort_by": "final_rank_score",
  "order": "desc",
  "page": 1,
  "per_page": 50
}

Response (200 OK):
{
  "applications": [...],
  "total": 25,
  "filters_applied": {
    "course_id": 1,
    "window_id": 1,
    "status": "waitlisted",
    ...
  }
}
```

---

#### Get Single Application
```http
GET /applications/<app_id>
Authorization: Bearer <JWT>

Response (200 OK):
{
  "id": 42,
  "course_id": 1,
  "full_name": "John Doe",
  "email": "john@example.com",
  "phone": "+237123456789",
  "application_window_id": 1,
  "cohort_label": "Jan 2024",
  "cohort_start_date": "2024-02-01T00:00:00",
  "cohort_end_date": "2024-05-31T23:59:59",
  "status": "waitlisted",
  "risk_score": 15,
  "application_score": 85,
  "final_rank_score": 87.5,
  "is_high_risk": false,
  // Migration tracking
  "original_window_id": null,
  "migrated_to_window_id": null,
  "migrated_at": null,
  "migration_notes": null,
  // Payment
  "payment_status": "pending",
  "payment_method": "mobile_money",
  "amount_paid": 0,
  "has_payment_slip": false,
  // Admin notes
  "admin_notes": "[2024-01-15] Application reviewed - strong candidate",
  "rejection_reason": null,
  "created_at": "2024-01-15T10:30:00",
  "updated_at": "2024-01-15T15:00:00"
}
```

---

#### Update Application Status
```http
PUT /applications/<app_id>/status
Authorization: Bearer <JWT>
Role Required: admin

Request:
{
  "status": "approved",  # or 'pending', 'rejected', 'waitlisted'
  "notes": "Application approved"
}

Response (200 OK):
{
  "id": 42,
  "status": "approved",
  "updated_at": "2024-01-15T16:00:00"
}
```

---

#### Approve Application
```http
POST /applications/<app_id>/approve
Authorization: Bearer <JWT>
Role Required: admin
Content-Type: application/json

Request:
{
  "notes": "Strong profile, approved for enrollment",
  "send_email": true
}

Response (200 OK):
{
  "id": 42,
  "status": "approved",
  "approved_by": 5,
  "message": "Application approved and email sent",
  "email_sent": true,
  "reviewed_at": "2024-01-15T16:00:00"
}
```

---

#### Reject Application
```http
POST /applications/<app_id>/reject
Authorization: Bearer <JWT>
Role Required: admin

Request:
{
  "reason": "Application does not meet minimum requirements",
  "notes": "Low score on technical assessment",
  "send_email": true
}

Response (200 OK):
{
  "id": 42,
  "status": "rejected",
  "rejection_reason": "Application does not meet minimum requirements",
  "email_sent": true,
  "message": "Application rejected and email sent"
}
```

---

#### Waitlist Application
```http
POST /applications/<app_id>/waitlist
Authorization: Bearer <JWT>
Role Required: admin

Request:
{
  "reason": "Cohort at capacity",
  "notes": "Strong candidate, will migrate to next cohort",
  "send_email": true
}

Response (200 OK):
{
  "id": 42,
  "status": "waitlisted",
  "application_window_id": 1,
  "cohort_label": "Jan 2024",
  "email_sent": true,
  "message": "Application moved to waitlist"
}
```

---

#### Update Application Notes
```http
PUT /applications/<app_id>/notes
Authorization: Bearer <JWT>
Role Required: admin

Request:
{
  "admin_notes": "Follow up on payment status"
}

Response (200 OK):
{
  "id": 42,
  "admin_notes": "[2024-01-15] Initial review\n[2024-01-20] Follow up on payment status"
}
```

---

#### Recalculate Application Score
```http
POST /applications/<app_id>/recalculate
Authorization: Bearer <JWT>
Role Required: admin

Response (200 OK):
{
  "id": 42,
  "risk_score": 15,
  "application_score": 88,
  "final_rank_score": 88.5,
  "is_high_risk": false,
  "message": "Scores recalculated"
}
```

---

#### Get Application Statistics
```http
GET /applications/statistics?course_id=1&window_id=1
Authorization: Bearer <JWT>
Role Required: admin

Response (200 OK):
{
  "total_applications": 150,
  "by_status": {
    "pending": 30,
    "approved": 60,
    "rejected": 20,
    "waitlisted": 40
  },
  "draft_count": 10,
  "average_score": 82.3,
  "high_risk_count": 5,
  "by_country": {
    "Cameroon": 80,
    "Ghana": 40,
    "Nigeria": 30
  },
  "average_age_range": "25_34",
  "by_education": {
    "bachelors": 90,
    "masters": 40,
    "diploma": 20
  },
  "payment_status_breakdown": {
    "pending": 60,
    "completed": 50,
    "failed": 20,
    "not_required": 20
  }
}
```

---

#### Export Applications
```http
GET /applications/export?course_id=1&window_id=1&format=csv
Authorization: Bearer <JWT>
Role Required: admin

Response (200 OK + CSV file):
id,full_name,email,phone,status,score,cohort_label,created_at
42,John Doe,john@example.com,+237123456789,waitlisted,87.5,Jan 2024,2024-01-15
...
```

---

### 1.2 Application Bulk Actions

#### Bulk Action (Approve/Reject/Waitlist Multiple)
```http
POST /applications/bulk-action
Authorization: Bearer <JWT>
Role Required: admin

Request:
{
  "application_ids": [42, 43, 44],
  "action": "approve",           # or 'reject', 'waitlist'
  "notes": "Bulk approval of strong candidates",
  "send_emails": true,
  "task_name": "Jan Cohort Final Review"
}

Response (202 Accepted):
{
  "task_id": "bulk_task_12345",
  "status": "processing",
  "action": "approve",
  "total_count": 3,
  "message": "Bulk action started"
}
```

---

#### Check Bulk Action Status
```http
GET /applications/bulk-action/<task_id>/status
Authorization: Bearer <JWT>

Response (200 OK):
{
  "task_id": "bulk_task_12345",
  "status": "completed",      # or 'processing', 'failed'
  "action": "approve",
  "total_count": 3,
  "successful": 3,
  "failed": 0,
  "progress": 100,
  "started_at": "2024-01-20T10:00:00",
  "completed_at": "2024-01-20T10:05:00",
  "results": [
    {
      "application_id": 42,
      "status": "success",
      "message": "Application approved"
    }
  ]
}
```

---

#### Send Custom Email to Applicant
```http
POST /applications/send-custom-email
Authorization: Bearer <JWT>
Role Required: admin

Request:
{
  "application_id": 42,
  "subject": "Next Steps for Your Application",
  "message": "Dear John,\n\nWe're excited about your application...",
  "html_message": "<p>Dear John,</p><p>We're excited about your application...</p>"
}

Response (200 OK):
{
  "application_id": 42,
  "email_sent": true,
  "recipient": "john@example.com",
  "subject": "Next Steps for Your Application"
}
```

---

## SECTION 2: WAITLIST MANAGEMENT

### 2.1 Waitlist Summary & Discovery

#### Get Waitlist Migration Summary
```http
GET /admin/waitlist/summary/<course_id>
Authorization: Bearer <JWT>
Role Required: admin or instructor

Response (200 OK):
{
  "success": true,
  "data": {
    "course_id": 1,
    "course_title": "Advanced Excel",
    "cohorts": [
      {
        "window_id": 1,
        "cohort_label": "Jan 2024",
        "status": "closed",
        "opens_at": "2024-01-01T00:00:00",
        "closes_at": "2024-01-31T23:59:59",
        "cohort_start": "2024-02-01T00:00:00",
        "cohort_end": "2024-05-31T23:59:59",
        "max_students": 50,
        "enrollment_count": 50,
        "available_spots": 0,
        "waitlisted_count": 15,
        "migrated_in_count": 0,
        "requires_payment": false,
        "effective_enrollment_type": "free",
        "effective_price": 0.0,
        "effective_currency": "USD"
      },
      {
        "window_id": 2,
        "cohort_label": "Apr 2024",
        "status": "open",
        "opens_at": "2024-04-01T00:00:00",
        "closes_at": "2024-04-30T23:59:59",
        "cohort_start": "2024-05-01T00:00:00",
        "cohort_end": "2024-08-31T23:59:59",
        "max_students": 40,
        "enrollment_count": 35,
        "available_spots": 5,
        "waitlisted_count": 0,
        "migrated_in_count": 10,
        "requires_payment": true,
        "effective_enrollment_type": "paid",
        "effective_price": 500.0,
        "effective_currency": "USD"
      }
    ],
    "total_waitlisted": 15,
    "next_available_cohort": {
      "window_id": 2,
      "cohort_label": "Apr 2024",
      "status": "open",
      "available_spots": 5,
      "requires_payment": true
    }
  }
}
```

---

#### Get Next Available Cohort for Migration
```http
GET /admin/waitlist/next-cohort/<course_id>?current_window_id=1
Authorization: Bearer <JWT>
Role Required: admin or instructor

Query Parameters:
- current_window_id: (optional) Don't return this or earlier cohorts

Response (200 OK):
{
  "success": true,
  "data": {
    "window_id": 2,
    "cohort_label": "Apr 2024",
    "status": "open",
    "opens_at": "2024-04-01T00:00:00",
    "cohort_start": "2024-05-01T00:00:00",
    "cohort_end": "2024-08-31T23:59:59",
    "max_students": 40,
    "enrollment_count": 35,
    "available_spots": 5,
    "requires_payment": true,
    "effective_enrollment_type": "paid",
    "effective_price": 500.0,
    "effective_currency": "USD"
  },
  "message": "Next cohort found"
}
```

Or if no next cohort:
```json
{
  "success": true,
  "data": null,
  "message": "No upcoming cohort found"
}
```

---

### 2.2 Individual Migration

#### Migrate Single Waitlisted Application
```http
POST /admin/waitlist/migrate/<application_id>
Authorization: Bearer <JWT>
Role Required: admin or instructor
Content-Type: application/json

Request:
{
  "target_window_id": 2,
  "notes": "Moving to Apr cohort as per waitlist policy",
  "send_email": true
}

Response (200 OK):
{
  "success": true,
  "message": "Application migrated successfully",
  "data": {
    "application_id": 42,
    "original_window_id": 1,
    "target_window_id": 2,
    "new_status": "pending",
    "cohort_label": "Apr 2024",
    "requires_payment": true,
    "email_sent": true
  }
}
```

---

#### Promote from Waitlist (back to pending for original cohort)
```http
POST /admin/applications/<app_id>/promote
Authorization: Bearer <JWT>
Role Required: admin

Request:
{
  "notes": "Space opened up, promoting from waitlist",
  "send_email": true
}

Response (200 OK):
{
  "application_id": 42,
  "new_status": "pending",
  "message": "Promoted from waitlist to pending",
  "email_sent": true
}
```

---

### 2.3 Bulk Migration

#### Bulk Migrate Waitlist to Next Cohort
```http
POST /admin/waitlist/migrate-bulk
Authorization: Bearer <JWT>
Role Required: admin or instructor
Content-Type: application/json

Request:
{
  "course_id": 1,
  "source_window_id": 1,              # Optional: from specific cohort
  "target_window_id": null,           # Auto-detect if null
  "max_count": 20,                    # Optional: limit migrations
  "notes": "Q1 to Q2 transition migration",
  "send_emails": true
}

Response (200 OK):
{
  "success": true,
  "message": "Migrated 5 of 15 applications",
  "data": {
    "migrated_count": 5,
    "failed_count": 0,
    "total_waitlisted": 15,
    "target_window_id": 2,
    "target_cohort_label": "Apr 2024",
    "requires_payment": true,
    "migrated": [
      {
        "application_id": 42,
        "original_window_id": 1,
        "target_window_id": 2,
        "new_status": "pending",
        "cohort_label": "Apr 2024",
        "requires_payment": true
      },
      // ... more migrated applications
    ],
    "failed": []
  }
}
```

---

## SECTION 3: ENROLLMENT & PAYMENT VERIFICATION

### 3.1 Enrollment Management

#### Browse Available Courses
```http
GET /enrollments/browse-courses?page=1&search=Excel
Authorization: Optional (JWT for student-specific filters)

Query Parameters:
- page: (optional) Page number
- search: (optional) Course title search
- category: (optional) Course category
- sort_by: (optional) relevance|newest|price
- status: (optional) open|upcoming|closed

Response (200 OK):
{
  "courses": [
    {
      "id": 1,
      "title": "Advanced Excel",
      "description": "Master advanced Excel features",
      "enrollment_type": "free",
      "price": 0,
      "currency": "USD",
      "instructor_name": "Jane Smith",
      "application_windows": [
        {
          "id": 1,
          "cohort_label": "Jan 2024",
          "status": "closed",
          "effective_price": 0.0,
          "enrollment_count": 50,
          "max_students": 50
        },
        {
          "id": 2,
          "cohort_label": "Apr 2024",
          "status": "open",
          "effective_price": 500.0,
          "enrollment_count": 35,
          "max_students": 40
        }
      ]
    }
  ],
  "total": 25,
  "page": 1
}
```

---

#### Create Enrollment (After application approved)
```http
POST /enrollments/enroll
Authorization: Bearer <JWT> (Student must be logged in)
Content-Type: application/json

Request:
{
  "course_id": 1,
  "application_window_id": 1  # Which cohort to enroll in
}

Response (201 Created):
{
  "id": 100,
  "student_id": 123,
  "course_id": 1,
  "course_title": "Advanced Excel",
  "application_window_id": 1,
  "cohort_label": "Jan 2024",
  "cohort_start_date": "2024-02-01T00:00:00",
  "cohort_end_date": "2024-05-31T23:59:59",
  "enrollment_date": "2024-01-15T14:30:00",
  "status": "active",
  "progress": 0.0,
  "payment_status": "not_required",
  "payment_verified": true,
  "access_allowed": true
}
```

---

#### Get Enrollment Status for Course
```http
GET /enrollments/course/<course_id>/status
Authorization: Bearer <JWT> (Student)

Response (200 OK):
{
  "course_id": 1,
  "course_title": "Advanced Excel",
  "enrolled": true,
  "enrollment_id": 100,
  "application_window_id": 1,
  "cohort_label": "Jan 2024",
  "status": "active",
  "progress": 0.0,
  "enrolled_at": "2024-01-15T14:30:00",
  "access_allowed": true,
  "access_reason": "free_cohort"
}
```

---

#### List Student's Applications
```http
GET /enrollments/my-applications
Authorization: Bearer <JWT> (Student)

Response (200 OK):
{
  "applications": [
    {
      "id": 42,
      "course_id": 1,
      "course_title": "Advanced Excel",
      "application_window_id": 1,
      "cohort_label": "Jan 2024",
      "status": "approved",
      "created_at": "2024-01-15T10:30:00"
    }
  ]
}
```

---

#### List Student's Enrollments
```http
GET /enrollments/my-enrollments
Authorization: Bearer <JWT> (Student)

Response (200 OK):
{
  "enrollments": [
    {
      "id": 100,
      "course_id": 1,
      "course_title": "Advanced Excel",
      "application_window_id": 1,
      "cohort_label": "Jan 2024",
      "status": "active",
      "progress": 25.5,
      "enrolled_at": "2024-01-15T14:30:00",
      "payment_status": "not_required",
      "payment_verified": true,
      "access_allowed": true
    }
  ]
}
```

---

#### Cancel Application
```http
POST /enrollments/application/<application_id>/cancel
Authorization: Bearer <JWT> (Student or Admin)

Request:
{
  "reason": "Personal reason"
}

Response (200 OK):
{
  "application_id": 42,
  "status": "cancelled",
  "cancelled_at": "2024-01-20T10:00:00"
}
```

---

### 3.2 Payment Verification

#### Get Enrollment Payment Status
```http
GET /admin/waitlist/enrollment/<enrollment_id>/payment
Authorization: Bearer <JWT>
Role Required: admin or instructor

Response (200 OK):
{
  "success": true,
  "data": {
    "enrollment_id": 100,
    "requires_payment": true,
    "payment_status": "pending",
    "payment_verified": false,
    "access_allowed": false,
    "migrated_from_window_id": null
  }
}
```

---

#### Verify/Update Enrollment Payment (Admin)
```http
POST /admin/waitlist/enrollment/<enrollment_id>/verify-payment
Authorization: Bearer <JWT>
Role Required: admin or instructor
Content-Type: application/json

Request:
{
  "payment_status": "completed",  # or 'waived', 'pending', 'failed'
  "notes": "Payment verified via bank transfer receipt"
}

Response (200 OK):
{
  "success": true,
  "message": "Payment status updated to completed",
  "data": {
    "enrollment_id": 100,
    "payment_status": "completed",
    "payment_verified": true,
    "payment_verified_at": "2024-01-20T11:00:00",
    "enrollment_status": "active",
    "access_allowed": true
  }
}
```

---

#### List Unpaid Enrollments
```http
GET /admin/waitlist/enrollments/unpaid?course_id=1&window_id=2
Authorization: Bearer <JWT>
Role Required: admin or instructor

Query Parameters:
- course_id: (optional) Filter by course
- window_id: (optional) Filter by cohort

Response (200 OK):
{
  "success": true,
  "data": [
    {
      "enrollment_id": 100,
      "student_id": 123,
      "student_name": "John Doe",
      "student_email": "john@example.com",
      "course_id": 1,
      "course_title": "Advanced Excel",
      "cohort_label": "Apr 2024",
      "application_window_id": 2,
      "enrollment_date": "2024-04-10T10:00:00",
      "status": "active",
      "payment_status": "pending",
      "payment_verified": false,
      "cohort_effective_price": 500.0,
      "cohort_currency": "USD",
      "cohort_enrollment_type": "paid",
      "cohort_scholarship_type": null,
      "cohort_scholarship_percentage": null,
      "migrated_from_window_id": null
    }
  ],
  "count": 5
}
```

---

#### Student Check Own Payment Status
```http
GET /admin/waitlist/my-payment-status
Authorization: Bearer <JWT> (Student)

Response (200 OK):
{
  "success": true,
  "data": [
    {
      "enrollment_id": 100,
      "course_id": 1,
      "course_title": "Advanced Excel",
      "cohort_label": "Apr 2024",
      "enrollment_status": "active",
      "access_allowed": false,
      "access_reason": "payment_not_verified",
      "payment_status": "pending",
      "payment_verified": false,
      "requires_payment": true
    }
  ]
}
```

---

## SECTION 4: COURSE MANAGEMENT (Application Windows)

### 4.1 Course CRUD with Windows

#### Create Course with Application Windows
```http
POST /instructor/courses
Authorization: Bearer <JWT>
Role Required: instructor or admin

Request:
{
  "title": "Advanced Excel",
  "description": "Master advanced Excel features",
  "learning_objectives": "Learn pivot tables, dashboards, advanced formulas",
  "target_audience": "Business professionals",
  "instructor_id": 5,
  "estimated_duration": "8 weeks",
  
  // Payment settings (course defaults)
  "enrollment_type": "free",
  "price": null,
  "currency": "USD",
  
  // Multiple application windows/cohorts
  "application_windows": [
    {
      "cohort_label": "Jan 2024",
      "description": "First cohort of the year",
      "opens_at": "2024-01-01T00:00:00Z",
      "closes_at": "2024-01-31T23:59:59Z",
      "cohort_start": "2024-02-01T00:00:00Z",
      "cohort_end": "2024-05-31T23:59:59Z",
      "max_students": 50,
      "enrollment_type": null,   # Inherit 'free'
      "price": null,             # Inherit course price
      "status_override": null    # Computed status
    },
    {
      "cohort_label": "Apr 2024 - Paid",
      "opens_at": "2024-04-01T00:00:00Z",
      "closes_at": "2024-04-30T23:59:59Z",
      "cohort_start": "2024-05-01T00:00:00Z",
      "cohort_end": "2024-08-31T23:59:59Z",
      "max_students": 40,
      "enrollment_type": "paid",
      "price": 500,
      "currency": "USD",
      "scholarship_type": null
    },
    {
      "cohort_label": "Jul 2024 - Scholarship",
      "opens_at": "2024-07-01T00:00:00Z",
      "closes_at": "2024-07-31T23:59:59Z",
      "cohort_start": "2024-08-15T00:00:00Z",
      "cohort_end": "2024-12-15T23:59:59Z",
      "max_students": 30,
      "enrollment_type": "scholarship",
      "scholarship_type": "full",
      "scholarship_percentage": 100,
      "price": 500
    }
  ]
}

Response (201 Created):
{
  "id": 1,
  "title": "Advanced Excel",
  "application_windows": [
    {
      "id": 1,
      "cohort_label": "Jan 2024",
      "status": "closed",
      ...
    },
    {
      "id": 2,
      "cohort_label": "Apr 2024 - Paid",
      "status": "open",
      ...
    },
    {
      "id": 3,
      "cohort_label": "Jul 2024 - Scholarship",
      "status": "upcoming",
      ...
    }
  ]
}
```

---

#### Update Course with New Windows
```http
PUT /instructor/courses/<course_id>
Authorization: Bearer <JWT>
Role Required: instructor (must be owner)

Request:
{
  "title": "Advanced Excel",
  // ... update any fields ...
  "application_windows": [
    // Existing windows (with id) are updated
    // New windows (without id) are created
  ]
}
```

---

#### Get Course with All Windows
```http
GET /instructor/courses/<course_id>
Authorization: Bearer <JWT>

Response (200 OK):
{
  "id": 1,
  "title": "Advanced Excel",
  "description": "Master advanced Excel features",
  "enrollment_type": "free",
  "price": null,
  "currency": "USD",
  "application_windows": [
    {
      "id": 1,
      "cohort_label": "Jan 2024",
      "status": "closed",
      "opens_at": "2024-01-01T00:00:00Z",
      "closes_at": "2024-01-31T23:59:59Z",
      "cohort_start": "2024-02-01T00:00:00Z",
      "cohort_end": "2024-05-31T23:59:59Z",
      "max_students": 50,
      "enrollment_count": 50,
      "available_spots": 0,
      "effective_enrollment_type": "free",
      "effective_price": 0.0,
      "enrollment_type": null,
      "price": null
    },
    // ... more windows ...
  ]
}
```

---

## SECTION 5: UTILITY ENDPOINTS

### Get Application Windows for a Course
```http
GET /courses/<course_id>?include_windows=true
Authorization: Optional (JWT for enhanced data)

Response (200 OK):
{
  "id": 1,
  "title": "Advanced Excel",
  "application_windows": [
    {
      "id": 1,
      "cohort_label": "Jan 2024",
      "status": "closed",
      ...
    }
  ],
  "primary_application_window": {
    "status": "open",
    "cohort_label": "Apr 2024",
    ...
  }
}
```

---

### Get Course Categories
```http
GET /enrollments/course-categories
Authorization: Optional

Response (200 OK):
{
  "categories": [
    {
      "id": 1,
      "name": "Business Skills",
      "description": "Professional development courses",
      "course_count": 15
    },
    // ... more categories ...
  ]
}
```

---

### Get Course Recommendations
```http
GET /enrollments/recommendations
Authorization: Bearer <JWT> (Student)

Response (200 OK):
{
  "recommendations": [
    {
      "id": 2,
      "title": "Data Analysis with Excel",
      "description": "Take your Excel skills to the next level",
      "reason": "Recommended based on your enrollment in Advanced Excel"
    }
  ]
}
```

---

## Authentication & Authorization

### JWT Token Required
Most admin endpoints require JWT authentication:
```
Authorization: Bearer <JWT_TOKEN>
```

### Role Requirements
- **Public**: `/applications` (create), `/applications/check-duplicate`, `/enrollments/browse-courses`
- **Student** (any authenticated user): `/enrollments/my-applications`, `/enrollments/my-enrollments`, `/enrollments/enroll`
- **Instructor/Admin**: Application management, waitlist management, payment verification
- **Admin Only**: Bulk actions, some sensitive operations

---

## Error Responses

### 400 Bad Request
```json
{
  "error": "Invalid request",
  "message": "course_id is required"
}
```

### 401 Unauthorized
```json
{
  "error": "Unauthorized",
  "message": "JWT token missing or invalid"
}
```

### 403 Forbidden
```json
{
  "error": "Forbidden",
  "message": "Admin or instructor access required"
}
```

### 404 Not Found
```json
{
  "error": "Not found",
  "message": "Application with id 999 not found"
}
```

### 500 Server Error
```json
{
  "error": "Internal server error",
  "message": "An unexpected error occurred"
}
```

---

## Rate Limiting

Currently no rate limiting implemented. In production, consider:
- 100 requests/minute for authenticated users
- 10 requests/minute for public endpoints
- 1000 requests/minute for bulk operations

---

## Pagination

List endpoints support pagination:
```
?page=1&per_page=20
```

Response includes:
```json
{
  "data": [...],
  "page": 1,
  "per_page": 20,
  "total": 150,
  "total_pages": 8
}
```

---

**Last Updated**: April 30, 2026
**Version**: 1.0+
**API Format**: REST/JSON

