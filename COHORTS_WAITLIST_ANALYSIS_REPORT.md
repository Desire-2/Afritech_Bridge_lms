# Afritech Bridge LMS - Cohorts, Application Windows & Waitlist Migration
## Comprehensive Architecture Report

---

## Table of Contents
1. [System Overview](#system-overview)
2. [Data Models](#data-models)
3. [Application Window System](#application-window-system)
4. [Cohort Management](#cohort-management)
5. [Student Waitlist & Migration](#student-waitlist--migration)
6. [API Endpoints](#api-endpoints)
7. [Business Logic & Services](#business-logic--services)
8. [Data Flow & Examples](#data-flow--examples)

---

## System Overview

The Afritech Bridge LMS implements a **sophisticated multi-cohort learning system** with the following key capabilities:

### Core Concepts

1. **Application Windows (Cohorts)**: Separate application intake periods and learning cohorts for a single course
   - Example: Course "Advanced Excel" has 4 cohorts in 2024 (Jan, Apr, Jul, Oct)
   - Each cohort has its own application dates, student capacity, and pricing

2. **Application Status Workflow**:
   - `pending` → Under review by admin
   - `approved` → Student can enroll
   - `rejected` → Student rejected
   - `waitlisted` → Applied but cohort full; can migrate to next cohort

3. **Enrollment Status**: Student is actually enrolled and learning
   - Status: `active`, `completed`, `terminated`, `suspended`, `pending_payment`

4. **Payment Models**: Each cohort can have different pricing:
   - `free` - No payment required
   - `paid` - Full tuition
   - `scholarship` - Full or partial scholarship (student pays 0-100% of cost)

---

## Data Models

### 1. Course Model
**File**: `backend/src/models/course_models.py`

```python
class Course(db.Model):
    # Basic Info
    id: int
    title: str (unique)
    description: text
    
    # Course-level Payment Settings (can be overridden per cohort)
    enrollment_type: str  # 'free', 'paid', 'scholarship'
    price: float
    currency: str (default: 'USD')
    payment_mode: str  # 'full', 'partial'
    partial_payment_amount: float
    partial_payment_percentage: float
    payment_methods: JSON  # ['kpay', 'paypal', 'mobile_money', etc.]
    
    # Course-level Application Windows (flat, for backward compatibility)
    application_start_date: datetime
    application_end_date: datetime
    cohort_start_date: datetime
    cohort_end_date: datetime
    cohort_label: str
    
    # Module Release Settings (course-level defaults)
    start_date: datetime
    module_release_count: int (None = all modules)
    module_release_interval: str  # 'weekly', 'bi-weekly', 'monthly'
    module_release_interval_days: int
    
    # Relationships
    instructor: User (FK)
    modules: [Module]
    enrollments: [Enrollment]
    application_windows: [ApplicationWindow]  # NEW: Multi-cohort support
```

**Key Methods**:
- `get_payment_summary()` - Returns payment info for course
- `get_released_modules(cohort_id)` - Gets modules based on cohort release settings
- `get_all_application_windows_list()` - Lists all cohort windows
- `get_primary_application_window()` - Returns most relevant (open > upcoming > first) window

---

### 2. ApplicationWindow Model (Cohort)
**File**: `backend/src/models/course_models.py`

**Purpose**: Represents a specific cohort/intake period for a course

```python
class ApplicationWindow(db.Model):
    __tablename__ = 'application_windows'
    
    id: int
    course_id: int (FK)
    
    # ──── COHORT IDENTITY ────
    cohort_label: str  # "Jan 2024", "Batch #5", etc.
    description: str
    
    # ──── APPLICATION WINDOW DATES ────
    opens_at: datetime      # When applications start
    closes_at: datetime     # When applications end
    
    # ──── COHORT LEARNING DATES ────
    cohort_start: datetime  # When course starts
    cohort_end: datetime    # When course ends
    
    # ──── CAPACITY MANAGEMENT ────
    max_students: int       # Enrollment capacity limit
    status_override: str    # Manual override: 'open', 'closed', 'upcoming'
    
    # ──── COHORT-SPECIFIC PAYMENT OVERRIDES ────
    # NULL = inherit from course; otherwise override
    enrollment_type: str           # 'free', 'paid', 'scholarship'
    price: float
    currency: str
    scholarship_type: str          # 'full', 'partial'
    scholarship_percentage: float  # 0-100 (discount from base_price)
    payment_mode: str              # 'full', 'partial'
    partial_payment_amount: float
    partial_payment_percentage: float
    payment_methods: JSON
    payment_deadline_days: int
    require_payment_before_application: bool
    installment_enabled: bool
    installment_count: int
    installment_interval_days: int
    
    # ──── COHORT-SPECIFIC MODULE RELEASE OVERRIDES ────
    module_release_count: int
    module_release_interval: str
    module_release_interval_days: int
    
    # Timestamps
    created_at: datetime
    updated_at: datetime
    
    # Relationships
    course: Course (backref: application_windows)
    enrollments: [Enrollment]
    applications: [CourseApplication]
```

**Status Computation**:
```python
def compute_status(self, now=None) -> str:
    """
    Returns: 'upcoming' | 'open' | 'closed'
    
    Rules:
    1. If status_override set → return that
    2. If now < opens_at → 'upcoming'
    3. If now > closes_at → 'closed'
    4. If now > cohort_end → 'closed'
    5. Otherwise → 'open'
    """
```

**Effective Value Resolution** (Inheritance Pattern):
```python
get_effective_enrollment_type()     # Override or course.enrollment_type
get_effective_price()               # Applies scholarships
get_effective_currency()            # Override or course.currency
get_effective_payment_methods()     # Override or course methods
get_effective_module_release_count() # Override or course release count
```

---

### 3. CourseApplication Model
**File**: `backend/src/models/course_application.py`

**Purpose**: Track student applications for specific cohorts

```python
class CourseApplication(db.Model):
    __tablename__ = "course_applications"
    
    id: int
    course_id: int (FK)
    
    # ──── APPLICANT INFO ────
    full_name: str
    email: str
    phone: str
    gender: enum
    age_range: enum
    country: str
    city: str
    
    # ──── EDUCATION & BACKGROUND ────
    education_level: enum
    current_status: enum ('student', 'employed', 'unemployed', etc.)
    field_of_study: str
    
    # ──── SKILLS & ASSESSMENT ────
    has_used_excel: bool
    excel_skill_level: enum
    excel_tasks_done: JSON array
    
    # ──── LEARNING GOALS ────
    motivation: text
    learning_outcomes: text
    career_impact: text
    
    # ──── ACCESS & AVAILABILITY ────
    has_computer: bool
    internet_access_type: enum
    preferred_learning_mode: enum
    available_time: JSON array
    
    # ──── COMMITMENT ────
    committed_to_complete: bool
    agrees_to_assessments: bool
    referral_source: str
    
    # ──── SCORING & EVALUATION ────
    risk_score: int
    is_high_risk: bool
    application_score: int
    final_rank_score: float
    readiness_score: int
    commitment_score: int
    
    # ──── PAYMENT TRACKING ────
    payment_method: str         # 'paypal', 'mobile_money', 'bank_transfer'
    payment_status: str         # 'pending', 'completed', 'failed'
    payment_reference: str
    amount_paid: float
    payment_currency: str
    payment_slip_url: str
    last_payment_reminder_sent: datetime
    last_payment_reminder_type: str  # 'first', 'urgent', 'final'
    payment_reminder_count: int
    
    # ──── APPLICATION WORKFLOW ────
    status: enum                # 'pending', 'approved', 'rejected', 'waitlisted'
    approved_by: int (FK User)
    rejection_reason: text
    admin_notes: text
    is_draft: bool              # Draft applications (not yet submitted)
    
    # ──── COHORT SNAPSHOT (Denormalized) ────
    application_window_id: int (FK)
    cohort_label: str
    cohort_start_date: datetime
    cohort_end_date: datetime
    
    # ──── WAITLIST MIGRATION TRACKING ────
    original_window_id: int (FK)     # Original cohort before migration
    migrated_to_window_id: int (FK)  # Target cohort after migration
    migrated_at: datetime
    migration_notes: text
    
    # Timestamps
    created_at: datetime
    updated_at: datetime
    reviewed_at: datetime
    
    # Relationships
    course: Course (backref: course_applications)
    approver: User
    application_window: ApplicationWindow
    original_window: ApplicationWindow
    migrated_to_window: ApplicationWindow
```

**Important Methods**:
- `to_dict(include_sensitive)` - Converts to API response, sanitizes base64 payment slips
- `split_name()` - Splits full_name into first_name, last_name for backward compat

---

### 4. Enrollment Model
**File**: `backend/src/models/course_models.py`

**Purpose**: Represents actual course enrollment (student is learning)

```python
class Enrollment(db.Model):
    __tablename__ = 'enrollments'
    
    id: int
    student_id: int (FK User)
    course_id: int (FK Course)
    
    # ──── COHORT TRACKING ────
    application_window_id: int (FK ApplicationWindow)  # Which cohort
    application_id: int (FK CourseApplication)        # Linked application
    cohort_label: str       # Denormalized for performance
    cohort_start_date: datetime
    cohort_end_date: datetime
    
    # ──── ENROLLMENT TIMING ────
    enrollment_date: datetime
    completed_at: datetime
    progress: float  # 0.0 - 1.0 (percentage)
    
    # ──── STATUS MANAGEMENT ────
    status: str                # 'active', 'completed', 'terminated', 'suspended', 'pending_payment'
    terminated_at: datetime
    termination_reason: str
    terminated_by: int (FK User)
    
    # ──── PAYMENT VERIFICATION (for paid cohorts) ────
    payment_status: str        # 'pending', 'completed', 'waived', 'not_required'
    payment_verified: bool     # Admin confirmed payment or cohort is free
    payment_verified_at: datetime
    payment_verified_by: int (FK User)
    
    # ──── MIGRATION TRACKING ────
    migrated_from_window_id: int (FK ApplicationWindow)  # If migrated from waitlist
    
    # Relationships
    student: User
    course: Course
    application_window: ApplicationWindow
    migrated_from_window: ApplicationWindow
    application: CourseApplication
    
    # Unique constraint: Only one enrollment per student per cohort
    __table_args__ = (
        db.UniqueConstraint('student_id', 'course_id', 'application_window_id'),
    )
```

**Access Control Logic**:
```python
enrollment.status = 'active'
enrollment.payment_status = 'completed' or 'waived'
enrollment.payment_verified = True

# THEN: Student can access course materials
```

---

## Application Window System

### Window Status Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│  Timeline View of an Application Window                      │
└─────────────────────────────────────────────────────────────┘

Time:  ├─────────────────────────────────────────────────────────►

       │ opens_at      closes_at    cohort_start    cohort_end
       ▼                ▼           ▼               ▼
       ┌─────────────────────────────────────────┐
       │     Application Period (OPEN)           │
       │    Students can apply here              │
       └─────────────────────────────────────────┘
                                    ┌─────────────────────────────────┐
                                    │  Cohort Learning Period         │
                                    │  Enrolled students learn        │
                                    └─────────────────────────────────┘

STATUS PROGRESSION:
1. Before opens_at: "upcoming" (applications not open)
2. opens_at to closes_at: "open" (accepting applications)
3. After closes_at OR after cohort_end: "closed"
```

### Capacity Management

```python
# Get enrollment count for a cohort
enrollment_count = window.get_enrollment_count()
# Returns count of 'active' or 'completed' enrollments

# Check if space available
available_spots = window.max_students - enrollment_count

# When processing waitlist → next cohort:
if available_spots > 0:
    # Migrate up to available_spots students
else:
    # Cannot migrate; cohort at capacity
```

### Payment Overrides Pattern

Each ApplicationWindow can override course-level settings:

```python
# Inheritance Chain (highest to lowest priority):
1. window.enrollment_type (if set)
2. course.enrollment_type

# Example Scenarios:
# ─────────────────────────────────────────────────────────

# Scenario 1: Free course, one paid cohort
Course:
  enrollment_type = 'free'
  price = null

ApplicationWindow (Jan 2024 cohort):
  enrollment_type = 'paid'
  price = 500
  currency = 'USD'
  → Students in this cohort pay $500

# Scenario 2: Scholarship cohort
ApplicationWindow (Apr 2024 cohort):
  enrollment_type = 'scholarship'
  scholarship_type = 'partial'
  scholarship_percentage = 50  # 50% discount
  → If base price $500, students pay $250

# Scenario 3: Inherited settings
ApplicationWindow (Jul 2024 cohort):
  enrollment_type = null  # Inherit
  price = null            # Inherit
  → Uses course.enrollment_type and course.price
```

---

## Cohort Management

### Creating a New Cohort

**Endpoint**: Handled via course update (implicit ApplicationWindow creation)

```python
# When instructor updates course, they can specify multiple windows
POST /api/v1/instructor/courses/<course_id>

{
  "title": "Advanced Excel",
  "enrollment_type": "free",  # Course default
  "price": null,
  
  # Multiple application windows (cohorts)
  "application_windows": [
    {
      "cohort_label": "Jan 2024",
      "opens_at": "2024-01-01T00:00:00Z",
      "closes_at": "2024-01-15T23:59:59Z",
      "cohort_start": "2024-02-01T00:00:00Z",
      "cohort_end": "2024-05-31T23:59:59Z",
      "max_students": 50,
      "enrollment_type": null,  # Inherit 'free'
    },
    {
      "cohort_label": "Apr 2024",
      "opens_at": "2024-04-01T00:00:00Z",
      "closes_at": "2024-04-15T23:59:59Z",
      "cohort_start": "2024-05-01T00:00:00Z",
      "cohort_end": "2024-08-31T23:59:59Z",
      "max_students": 40,
      "enrollment_type": "paid",
      "price": 500,
      "currency": "USD",
      "scholarship_type": null,
    },
    {
      "cohort_label": "Jul 2024 - Scholarship",
      "opens_at": "2024-07-01T00:00:00Z",
      "closes_at": "2024-07-15T23:59:59Z",
      "cohort_start": "2024-08-15T00:00:00Z",
      "cohort_end": "2024-12-15T23:59:59Z",
      "max_students": 30,
      "enrollment_type": "scholarship",
      "scholarship_type": "full",
      "scholarship_percentage": 100,
    }
  ]
}
```

### Key Fields Explained

| Field | Type | Purpose |
|-------|------|---------|
| `cohort_label` | str | Human-readable identifier ("Jan 2024", "Batch #5") |
| `opens_at` | datetime | When application window opens |
| `closes_at` | datetime | When application window closes |
| `cohort_start` | datetime | When actual learning begins |
| `cohort_end` | datetime | When cohort completes |
| `max_students` | int | Capacity limit (None = unlimited) |
| `enrollment_type` | str | 'free', 'paid', 'scholarship' (None = inherit) |
| `scholarship_type` | str | 'full', 'partial' (only for scholarship enrollments) |
| `scholarship_percentage` | float | Discount % (0-100) |

---

## Student Waitlist & Migration

### Application Workflow

```
┌──────────────────────────────────────────────────────────────────┐
│  Student Application & Enrollment Journey                        │
└──────────────────────────────────────────────────────────────────┘

1. STUDENT APPLIES
   └─► POST /api/v1/applications
       - Selects a course & cohort
       - Fills application form
       - May make payment (if require_payment_before_application=true)
       └─► CourseApplication status = 'pending'

2. ADMIN REVIEWS
   └─► Application assessment (scoring, risk evaluation)
       └─► THREE POSSIBLE OUTCOMES:

       A) APPROVED
          └─► PATCH /api/v1/admin/applications/<id>/approve
              └─► CourseApplication status = 'approved'
                  └─► Student receives approval email
                      └─► THEN student can enroll

       B) REJECTED
          └─► PATCH /api/v1/admin/applications/<id>/reject
              └─► CourseApplication status = 'rejected'
                  └─► Student receives rejection email

       C) WAITLISTED (Cohort full)
          └─► PATCH /api/v1/admin/applications/<id>/waitlist
              └─► CourseApplication status = 'waitlisted'
                  └─► Stored in database with cohort info
                      └─► WAITING FOR NEXT COHORT TO OPEN

3. STUDENT ENROLLS (if approved)
   └─► POST /api/v1/enrollments/enroll
       - Student creates actual Enrollment record
       - Links to ApplicationWindow (cohort)
       └─► Enrollment status = 'active'
           └─► Student can NOW access course materials

4. WAITLIST MIGRATION (Admin action)
   └─► When next cohort opens:
       └─► POST /api/v1/admin/waitlist/migrate/<app_id>
           OR
           └─► POST /api/v1/admin/waitlist/migrate-bulk
               ├─► Finds all waitlisted students from old cohort
               ├─► Migrates up to available_spots
               └─► For each migrated student:
                   ├─► CourseApplication status = 'pending' (re-review)
                   ├─► application_window_id = new_cohort_id
                   ├─► original_window_id = old_cohort_id
                   ├─► migrated_to_window_id = new_cohort_id
                   ├─► migrated_at = now
                   └─► Send notification email
```

### Waiting List to Next Cohort Migration

#### How Migration Detection Works

```python
def get_next_cohort(course_id, current_window_id=None):
    """
    Find next available cohort that:
    1. Is open or upcoming (not closed)
    2. Has available capacity (not full)
    3. Opens after current cohort (if current_window_id provided)
    
    Returns first match, ordered by opens_at asc
    """
```

#### Migration Process - Step by Step

```python
# STEP 1: Admin initiates bulk migration
POST /api/v1/admin/waitlist/migrate-bulk

{
    "course_id": 1,
    "source_window_id": 5,      # Old cohort (Jan 2024)
    "target_window_id": null,   # Auto-detect next available
    "max_count": 20,            # Migrate up to 20 students
    "notes": "Moving Jan waitlist to Apr cohort",
    "send_emails": true
}

# STEP 2: Service retrieves data
WaitlistService.bulk_migrate_waitlist_to_next_cohort():
  ├─ Get target window (auto-detect if not specified)
  │  └─ get_next_cohort(course_id, source_window_id)
  │
  ├─ Get all waitlisted applications
  │  └─ SELECT * FROM course_applications
  │     WHERE course_id=1 AND status='waitlisted'
  │     AND application_window_id=5
  │     ORDER BY final_rank_score DESC, created_at ASC
  │
  ├─ Check capacity
  │  └─ target_window.max_students - target_window.get_enrollment_count()
  │     └─ If available_spots < applications.count
  │        └─ LIMIT applications to available_spots
  │
  └─ For each application to migrate:
     └─ migrate_application_to_cohort()

# STEP 3: Individual migration
migrate_application_to_cohort(app_id=42, target_window_id=6, admin_id=1):
  │
  ├─ Validate
  │  ├─ Application exists and status='waitlisted'
  │  └─ Target window exists and belongs to same course
  │
  ├─ Update application
  │  ├─ original_window_id = 5 (old cohort)
  │  ├─ migrated_to_window_id = 6 (new cohort)
  │  ├─ application_window_id = 6 (current cohort)
  │  ├─ migrated_at = datetime.utcnow()
  │  ├─ migration_notes = admin provided notes
  │  ├─ status = 'pending' (reset for new cohort review)
  │  ├─ cohort_label = new cohort label
  │  ├─ cohort_start_date = new cohort start
  │  └─ cohort_end_date = new cohort end
  │
  ├─ Update admin_notes
  │  └─ Append: "[2024-12-10T14:30:00Z] Migrated from cohort 5 to 6: Moving Jan waitlist to Apr cohort"
  │
  ├─ Commit to database
  │  └─ db.session.commit()
  │
  └─ Log & notify
     └─ Send migration email if send_emails=true

# STEP 4: Email Notification
Email to student:
  ├─ Subject: "📋 Application Update - Advanced Excel (New Cohort)"
  └─ Body includes:
     ├─ New cohort label & dates
     ├─ Application status reset to 'pending'
     ├─ Payment requirement (if any)
     └─ Next steps for the student
```

#### Capacity-Aware Migration

```python
# SCENARIO: Jan cohort has 30 waitlisted students
# Apr cohort max_students=50, current_enrollment=45
# Available spots = 5

# When migrating:
applications = [30 waitlisted students sorted by rank]
available_spots = 50 - 45 = 5

# Migrate logic:
if available_spots <= 0:
    return error("Target cohort at capacity")

applications = applications[:available_spots]  # Take top 5

migrated = []
for app in applications:
    success, msg, data = migrate_application_to_cohort(...)
    if success:
        migrated.append(data)
    else:
        failed.append({"application_id": app.id, "error": msg})

response = {
    "migrated_count": len(migrated),  # 5
    "failed_count": len(failed),      # 0
    "total_waitlisted": 30,           # Total that were waitlisted
    "target_window_id": 6,
    "target_cohort_label": "Apr 2024",
    "requires_payment": True,
    "migrated": [...]
}
```

### Migration Tracking Fields

In `CourseApplication`:

| Field | Purpose |
|-------|---------|
| `original_window_id` | Which cohort student was originally waitlisted for |
| `migrated_to_window_id` | Which cohort student was migrated to |
| `migrated_at` | Timestamp of migration |
| `migration_notes` | Admin notes about the migration |
| `application_window_id` | CURRENT cohort (updated to migrated_to_window_id) |

In `Enrollment`:

| Field | Purpose |
|-------|---------|
| `migrated_from_window_id` | If student was migrated from a waitlist, which old cohort |

**Important**: Migration RESETS application status to `'pending'` for re-review in the new cohort.

---

## API Endpoints

### 1. Application Window / Cohort Management

#### Get All Cohorts for a Course
```
GET /api/v1/courses/<course_id>

Response:
{
  "application_windows": [
    {
      "id": 1,
      "cohort_label": "Jan 2024",
      "status": "open",
      "opens_at": "2024-01-01T00:00:00Z",
      "closes_at": "2024-01-15T23:59:59Z",
      "cohort_start": "2024-02-01T00:00:00Z",
      "cohort_end": "2024-05-31T23:59:59Z",
      "max_students": 50,
      "enrollment_count": 45,
      "available_spots": 5,
      "effective_enrollment_type": "free",
      "effective_price": 0.0,
      "payment_summary": {
        "required": false,
        ...
      }
    },
    ...
  ]
}
```

#### Create/Update Course with Cohorts
```
POST /api/v1/instructor/courses
PUT /api/v1/instructor/courses/<course_id>

Request:
{
  "title": "Course Title",
  "application_windows": [
    {
      "cohort_label": "Jan 2024",
      "opens_at": "2024-01-01T00:00:00Z",
      "closes_at": "2024-01-15T23:59:59Z",
      "cohort_start": "2024-02-01T00:00:00Z",
      "cohort_end": "2024-05-31T23:59:59Z",
      "max_students": 50,
      "enrollment_type": null,  # Inherit from course
      "price": null,            # Inherit from course
      "scholarship_type": null
    }
  ]
}
```

---

### 2. Course Application Endpoints

#### Submit Application
```
POST /api/v1/applications

Request:
{
  "course_id": 1,
  "application_window_id": 1,  # Which cohort applying to
  "full_name": "John Doe",
  "email": "john@example.com",
  ... (other application fields)
}

Response:
{
  "id": 42,
  "status": "pending",
  "application_window_id": 1,
  "cohort_label": "Jan 2024",
  "cohort_start_date": "2024-02-01T00:00:00Z",
  "cohort_end_date": "2024-05-31T23:59:59Z"
}
```

#### Approve Application
```
POST /api/v1/admin/applications/<app_id>/approve

Request:
{
  "notes": "Strong profile",
  "send_email": true
}

Response:
{
  "status": "approved",
  "message": "Application approved"
}
```

#### Waitlist Application
```
POST /api/v1/admin/applications/<app_id>/waitlist

Request:
{
  "reason": "Cohort at capacity",
  "notes": "Will migrate to next cohort"
}

Response:
{
  "status": "waitlisted",
  "application_window_id": 1,
  "cohort_label": "Jan 2024"
}
```

#### Get Application Details
```
GET /api/v1/admin/applications/<app_id>

Response:
{
  "id": 42,
  "status": "approved",
  "application_window_id": 1,
  "cohort_label": "Jan 2024",
  "cohort_start_date": "2024-02-01T00:00:00Z",
  "cohort_end_date": "2024-05-31T23:59:59Z",
  "original_window_id": null,      # null if never migrated
  "migrated_to_window_id": null,   # null if never migrated
  "migrated_at": null,
  "migration_notes": null
}
```

#### Search & List Applications
```
POST /api/v1/admin/applications/advanced-search

Request:
{
  "course_id": 1,
  "window_id": 1,           # Filter by cohort
  "status": "waitlisted",
  "sort_by": "final_rank_score",
  "order": "desc"
}

Response:
{
  "applications": [
    {
      "id": 42,
      "status": "waitlisted",
      "final_rank_score": 85.5,
      "application_window_id": 1,
      "cohort_label": "Jan 2024"
    },
    ...
  ]
}
```

---

### 3. Waitlist Management Endpoints

#### Get Waitlist Migration Summary
```
GET /api/v1/admin/waitlist/summary/<course_id>

Response:
{
  "success": true,
  "data": {
    "cohorts": [
      {
        "window_id": 1,
        "cohort_label": "Jan 2024",
        "status": "closed",
        "waitlisted_count": 15,        # Still on waiting list
        "migrated_in_count": 0,        # Migrated INTO this cohort
        "enrollment_count": 50,        # Total enrolled
        "max_students": 50,
        "available_spots": 0,
        "requires_payment": false,
        "effective_enrollment_type": "free",
        "effective_price": 0.0
      },
      {
        "window_id": 2,
        "cohort_label": "Apr 2024",
        "status": "open",
        "waitlisted_count": 5,
        "migrated_in_count": 10,
        "enrollment_count": 35,
        "max_students": 50,
        "available_spots": 15,
        "requires_payment": true,
        "effective_enrollment_type": "paid",
        "effective_price": 500.0
      }
    ],
    "next_available_cohort": {
      "window_id": 2,
      "cohort_label": "Apr 2024",
      "status": "open"
    }
  }
}
```

#### Migrate Single Waitlisted Application
```
POST /api/v1/admin/waitlist/migrate/<application_id>

Request:
{
  "target_window_id": 2,    # Apr 2024 cohort
  "notes": "Migrated per waitlist policy",
  "send_email": true
}

Response:
{
  "success": true,
  "message": "Application migrated successfully",
  "data": {
    "application_id": 42,
    "original_window_id": 1,       # Was in Jan 2024
    "target_window_id": 2,         # Now in Apr 2024
    "new_status": "pending",       # Reset for review
    "cohort_label": "Apr 2024",
    "requires_payment": true,
    "email_sent": true
  }
}
```

#### Bulk Migrate Waitlisted Applications
```
POST /api/v1/admin/waitlist/migrate-bulk

Request:
{
  "course_id": 1,
  "source_window_id": 1,           # Optional: migrate from specific cohort
  "target_window_id": null,        # Auto-detect next available
  "max_count": 20,                 # Migrate up to 20
  "notes": "Q1 to Q2 transition",
  "send_emails": true
}

Response:
{
  "success": true,
  "message": "Migrated 15 of 30 applications",
  "data": {
    "migrated_count": 15,
    "failed_count": 0,
    "total_waitlisted": 30,
    "target_window_id": 2,
    "target_cohort_label": "Apr 2024",
    "requires_payment": true,
    "migrated": [
      {
        "application_id": 42,
        "original_window_id": 1,
        "target_window_id": 2,
        "requires_payment": true
      },
      ...
    ],
    "failed": []
  }
}
```

#### Auto-Detect Next Available Cohort
```
GET /api/v1/admin/waitlist/next-cohort/<course_id>?current_window_id=1

Response:
{
  "success": true,
  "data": {
    "window_id": 2,
    "cohort_label": "Apr 2024",
    "status": "open",
    "opens_at": "2024-04-01T00:00:00Z",
    "cohort_start": "2024-05-01T00:00:00Z",
    "max_students": 50,
    "enrollment_count": 35,
    "requires_payment": true,
    "effective_enrollment_type": "paid",
    "effective_price": 500.0,
    "effective_currency": "USD"
  }
}
```

---

### 4. Enrollment & Payment Verification

#### Create Enrollment (Student enrolls after approval)
```
POST /api/v1/enrollments/enroll

Request:
{
  "course_id": 1,
  "application_window_id": 1   # Which cohort
}

Response:
{
  "id": 100,
  "student_id": 123,
  "course_id": 1,
  "application_window_id": 1,
  "cohort_label": "Jan 2024",
  "cohort_start_date": "2024-02-01T00:00:00Z",
  "status": "active",
  "payment_verified": false,
  "payment_status": "pending",
  "enrollment_date": "2024-01-15T10:30:00Z"
}
```

#### Get Enrollment Payment Status
```
GET /api/v1/admin/waitlist/enrollment/<enrollment_id>/payment

Response:
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

#### Verify/Update Enrollment Payment (Admin)
```
POST /api/v1/admin/waitlist/enrollment/<enrollment_id>/verify-payment

Request:
{
  "payment_status": "completed",  # or 'waived', 'pending', 'failed'
  "notes": "Payment verified via bank transfer"
}

Response:
{
  "success": true,
  "message": "Payment status updated to completed",
  "data": {
    "enrollment_id": 100,
    "payment_status": "completed",
    "payment_verified": true,
    "enrollment_status": "active"
  }
}
```

#### List Unpaid Enrollments
```
GET /api/v1/admin/waitlist/enrollments/unpaid?course_id=1&window_id=2

Response:
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
      "status": "active",
      "payment_status": "pending",
      "cohort_effective_price": 500.0,
      "cohort_currency": "USD"
    },
    ...
  ],
  "count": 12
}
```

#### Student Check Own Payment Status
```
GET /api/v1/admin/waitlist/my-payment-status

Response:
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
    },
    ...
  ]
}
```

---

## Business Logic & Services

### WaitlistService
**File**: `backend/src/services/waitlist_service.py`

#### Key Methods

##### 1. `get_next_cohort(course_id, current_window_id=None)`
```python
"""Find next available (open or upcoming) cohort for migration."""

# Returns: ApplicationWindow or None
# Checks:
#   - Status is 'open' or 'upcoming'
#   - Has available capacity (if max_students set)
#   - Opens after current_window (if current_window_id provided)
#   - Ordered by opens_at ascending
```

##### 2. `get_waitlisted_applications(course_id, window_id=None)`
```python
"""Get all waitlisted applications for a course."""

# Returns: List[CourseApplication]
# Filters:
#   - status = 'waitlisted'
#   - not is_draft (only submitted applications)
#   - application_window_id = window_id (if provided)
# Orders by:
#   - final_rank_score (highest first)
#   - created_at (earliest first)
```

##### 3. `migrate_application_to_cohort(application_id, target_window_id, admin_id, notes)`
```python
"""Migrate single waitlisted application to target cohort."""

# Validates:
#   - Application exists and status='waitlisted'
#   - Target window exists
#   - Cohorts belong to same course
#   - Target cohort has capacity

# Updates:
#   - application.original_window_id = old cohort
#   - application.migrated_to_window_id = new cohort
#   - application.application_window_id = new cohort
#   - application.migrated_at = now
#   - application.migration_notes = provided notes
#   - application.status = 'pending' (reset)
#   - application.cohort_label/start_date/end_date = from new window
#   - Appends to admin_notes with timestamp

# Returns: (bool success, str message, Dict data)
```

##### 4. `bulk_migrate_waitlist_to_next_cohort(course_id, source_window_id, target_window_id, admin_id, max_count, notes)`
```python
"""Migrate all waitlisted applications from one cohort to next."""

# If target_window_id not specified:
#   - Auto-detects next available cohort
# Gets all waitlisted applications:
#   - Ordered by rank score
# Applies capacity limit:
#   - Only migrates up to available_spots
#   - Capped at max_count if provided
# For each application:
#   - Calls migrate_application_to_cohort()
#   - Tracks migrated vs failed

# Returns: (bool success, str message, Dict result)
# result contains:
#   - migrated_count, failed_count, total_waitlisted
#   - target_window_id, target_cohort_label
#   - requires_payment (for new cohort)
#   - migrated: [detailed migration results]
#   - failed: [error details]
```

##### 5. `check_enrollment_payment_status(enrollment_id)`
```python
"""Check if enrollment requires payment and if verified."""

# For free cohorts: returns access_allowed=True, no payment needed
# For paid cohorts: returns payment_status, payment_verified, access_allowed
# Resolves window for legacy enrollments with lazy-patching
```

##### 6. `verify_enrollment_payment(enrollment_id, admin_id, payment_status, notes)`
```python
"""Admin action to verify/update enrollment payment."""

# Updates:
#   - enrollment.payment_status = 'completed'|'waived'|'pending'|'failed'
#   - enrollment.payment_verified = True (if completed/waived)
#   - enrollment.payment_verified_at = now
#   - enrollment.payment_verified_by = admin_id
#   - If status was 'pending_payment', changes to 'active'
```

##### 7. `is_enrollment_access_allowed(enrollment)`
```python
"""Determine if student can access course based on cohort + payment."""

# Returns: (bool access_allowed, str reason)
# Access DENIED if:
#   - Cohort requires payment AND payment not verified
#   - Enrollment status = 'terminated', 'suspended'
# Access ALLOWED if:
#   - Free cohort OR
#   - Payment verified OR
#   - Payment waived
```

##### 8. `get_enrollment_cohort_payment_info(enrollment)`
```python
"""Build cohort-level payment details for enrollment."""

# Returns complete payment info dict including:
#   - cohort enrollment type & pricing
#   - scholarship info
#   - payment methods
#   - access status
# This is SOURCE OF TRUTH for payment display (not course-level)
```

##### 9. `get_waitlist_migration_summary(course_id)`
```python
"""Get migration summary per cohort for a course."""

# For each ApplicationWindow:
#   - waitlisted_count
#   - migrated_in_count
#   - enrollment_count
#   - available_spots
#   - requires_payment
#   - effective pricing info
# Also returns next_available_cohort
```

---

### Payment Verification & Access Control

```python
# Core Access Logic
def can_student_access_course(enrollment):
    """Student can access course if:"""
    
    window = enrollment.application_window
    
    # 1. Free cohort - always access
    if not _cohort_requires_payment(window):
        return True, "free_cohort"
    
    # 2. Paid cohort - requires verification
    if enrollment.payment_verified:
        return True, "payment_verified"
    
    if enrollment.payment_status == 'waived':
        return True, "payment_waived"
    
    # 3. Not paid yet
    return False, "payment_not_verified"

# Helper: Determine if cohort requires payment
def _cohort_requires_payment(window):
    """Check if a cohort (ApplicationWindow) requires payment."""
    if not window:
        return False
    
    etype = window.get_effective_enrollment_type()
    
    # Paid cohorts always require payment
    if etype == 'paid':
        return True
    
    # Scholarship cohorts require payment only if partial scholarship
    if etype == 'scholarship':
        if window.scholarship_type == 'partial':
            return window.scholarship_percentage is not None
        return False
    
    # Free cohorts need no payment
    return False
```

---

## Data Flow & Examples

### Example 1: Free Course, Simple Cohort

```
SETUP:
┌─────────────────────────────────────────────────────────┐
│ Course: "Basic Excel" (Free)                            │
├─────────────────────────────────────────────────────────┤
│ enrollment_type = 'free'                                │
│ price = null                                            │
│                                                         │
│ ApplicationWindow 1 (Jan 2024):                         │
│   cohort_label = "Jan 2024"                             │
│   opens_at = 2024-01-01                                 │
│   closes_at = 2024-01-31                                │
│   cohort_start = 2024-02-01                             │
│   cohort_end = 2024-04-30                               │
│   max_students = 100                                    │
│   enrollment_type = null (inherit 'free')               │
│   price = null (inherit course)                         │
└─────────────────────────────────────────────────────────┘

APPLICATION FLOW:
1. Student applies in January
   → CourseApplication(
       course_id=1, 
       application_window_id=1,
       status='pending'
     )

2. Admin approves
   → status = 'approved'

3. Student enrolls
   → Enrollment(
       course_id=1,
       application_window_id=1,
       status='active',
       payment_verified=True  ← Auto-verified (free cohort)
     )

4. Access: Student can access immediately (no payment needed)
```

### Example 2: Waitlist to Next Cohort Migration

```
SETUP:
┌─────────────────────────────────────────────────────────┐
│ Course: "Advanced Excel" (Mixed pricing)                │
├─────────────────────────────────────────────────────────┤
│ ApplicationWindow 1 (Jan 2024 - Free):                  │
│   max_students = 50                                     │
│   enrollment_type = 'free'                              │
│   enrollment_count = 50 (FULL)                          │
│   waitlisted_count = 15                                 │
│                                                         │
│ ApplicationWindow 2 (Apr 2024 - Paid):                  │
│   opens_at = 2024-04-01                                 │
│   cohort_start = 2024-05-01                             │
│   max_students = 40                                     │
│   enrollment_type = 'paid'                              │
│   price = 500                                           │
│   enrollment_count = 35                                 │
│   available_spots = 5                                   │
└─────────────────────────────────────────────────────────┘

WAITLIST MIGRATION:
1. 15 applications waitlisted for Jan 2024
   All have:
     status='waitlisted'
     application_window_id=1
     original_window_id=null
     migrated_to_window_id=null

2. April 1st arrives → Apr cohort window opens

3. Admin initiates bulk migration
   POST /api/v1/admin/waitlist/migrate-bulk
   {
     "course_id": 1,
     "source_window_id": 1,
     "target_window_id": null,  ← Auto-detect
     "max_count": 20
   }

4. Service processes:
   ├─ Finds next available: Window 2 (Apr 2024)
   ├─ Gets waitlisted: 15 students sorted by rank
   ├─ Checks capacity: 40 - 35 = 5 spots available
   ├─ Limits migration: 5 students (min of 15, 20, 5)
   └─ Migrates top 5 by rank score

5. Top 5 applications updated:
   BEFORE:
     status='waitlisted'
     application_window_id=1
     original_window_id=null
     migrated_to_window_id=null
     
   AFTER:
     status='pending'  ← Reset for review
     application_window_id=2  ← New cohort
     original_window_id=1     ← Track old cohort
     migrated_to_window_id=2  ← Track migration
     migrated_at='2024-04-01T10:00:00Z'
     cohort_label='Apr 2024'
     cohort_start_date='2024-05-01'
     cohort_end_date='2024-08-31'

6. Response:
   {
     "migrated_count": 5,
     "failed_count": 0,
     "target_cohort_label": "Apr 2024",
     "requires_payment": true,  ← Note: new cohort requires payment!
     "migrated": [
       {
         "application_id": 42,
         "original_window_id": 1,
         "target_window_id": 2,
         "requires_payment": true
       },
       ...
     ]
   }

7. Next steps:
   - Admin re-reviews migrated applications in Apr cohort
   - If approved → Student notified
   - If approved & payment required:
     → Student must pay before enrollment
   - Upon enrollment:
     → payment_verified must be set to True
     → Enrollment status = 'active'
     → Student can access course
```

### Example 3: Scholarship Cohort

```
SETUP:
┌─────────────────────────────────────────────────────────┐
│ Course: "Excel Certification" (Paid base)               │
├─────────────────────────────────────────────────────────┤
│ enrollment_type = 'paid'                                │
│ price = 1000                                            │
│ currency = 'USD'                                        │
│                                                         │
│ ApplicationWindow 1 (Jan 2024 - Full tuition):          │
│   enrollment_type = null (inherit 'paid')               │
│   price = null (inherit 1000)                           │
│   → Effective price: $1000                              │
│                                                         │
│ ApplicationWindow 2 (Apr 2024 - Full scholarship):      │
│   enrollment_type = 'scholarship'                       │
│   scholarship_type = 'full'                             │
│   scholarship_percentage = 100                          │
│   → Effective price: $0 (FREE!)                         │
│                                                         │
│ ApplicationWindow 3 (Jul 2024 - Partial scholarship):   │
│   enrollment_type = 'scholarship'                       │
│   scholarship_type = 'partial'                          │
│   scholarship_percentage = 50  ← 50% discount           │
│   → Effective price: $500                               │
└─────────────────────────────────────────────────────────┘

STUDENT APPLICATION FLOWS:

Student A applies to Window 1 (Jan - $1000):
  → Payment required
  → Must pay $1000 before enrollment
  → enrollment.payment_status = 'completed'
  → enrollment.payment_verified = True
  → Access granted

Student B applies to Window 2 (Apr - Full scholarship):
  → NO payment required (scholarship_percentage = 100)
  → enrollment.payment_status = 'not_required'
  → enrollment.payment_verified = True
  → Access granted immediately

Student C applies to Window 3 (Jul - 50% scholarship):
  → Payment required
  → Must pay $500 (50% of original $1000)
  → enrollment.payment_status = 'completed'
  → enrollment.payment_verified = True
  → Access granted
```

---

## Database Schema Summary

### Tables Involved

```sql
-- Courses with default cohort settings
courses (
  id,
  title,
  enrollment_type,
  price,
  application_start_date,
  application_end_date,
  cohort_start_date,
  cohort_end_date
)

-- Cohort/window definitions
application_windows (
  id,
  course_id,
  cohort_label,
  opens_at,
  closes_at,
  cohort_start,
  cohort_end,
  max_students,
  -- Override fields (NULL = inherit from course)
  enrollment_type,
  price,
  scholarship_type,
  scholarship_percentage,
  payment_mode,
  -- ...other payment overrides...
)

-- Student applications (one per student per cohort)
course_applications (
  id,
  course_id,
  application_window_id,  ← Which cohort
  email,
  status,  -- 'pending', 'approved', 'rejected', 'waitlisted'
  -- Cohort snapshot
  cohort_label,
  cohort_start_date,
  cohort_end_date,
  -- Waitlist migration tracking
  original_window_id,      ← Where migrated FROM
  migrated_to_window_id,   ← Where migrated TO
  migrated_at,
  migration_notes
)

-- Student enrollments (one per student per cohort they're actually learning in)
enrollments (
  id,
  student_id,
  course_id,
  application_window_id,  ← Which cohort enrolled in
  application_id,         ← Linked application
  status,  -- 'active', 'completed', 'terminated', 'pending_payment'
  -- Payment verification
  payment_verified,
  payment_verified_by,
  payment_verified_at,
  -- Migration tracking
  migrated_from_window_id  ← If migrated from waitlist, old cohort
)

-- Unique constraint on enrollment
UNIQUE(student_id, course_id, application_window_id)
-- Student can only enroll once per cohort per course
```

---

## Summary

### Key Takeaways

1. **Multi-Cohort Design**: A single course can have multiple `ApplicationWindow` records, each representing a separate intake/cohort.

2. **Inheritance Pattern**: Each cohort can override course-level settings (payment, module release, etc.). NULL values mean "inherit from course".

3. **Waitlist Management**:
   - Waitlisted applications have `status='waitlisted'`
   - Admin can migrate them to next available cohort
   - Migration resets status to `'pending'` for re-review
   - Tracks original cohort via `original_window_id`

4. **Payment Verification**:
   - Each enrollment tracks `payment_verified` and `payment_status`
   - Free/fully-scholarship cohorts auto-verify
   - Paid cohorts require explicit admin verification
   - Access blocked until payment verified

5. **Capacity Management**:
   - Each cohort has `max_students` limit
   - Waitlist migration respects available capacity
   - Auto-limits migration to `available_spots`

6. **Data Integrity**:
   - Unique constraint on `(student_id, course_id, application_window_id)`
   - Each student enrolls once per cohort
   - Migration fields track complete audit trail

---

## Related Endpoints Quick Reference

| Task | HTTP Method | Endpoint |
|------|-------------|----------|
| List applications | GET | `/api/v1/admin/applications` |
| Create application | POST | `/api/v1/applications` |
| Approve application | POST | `/api/v1/admin/applications/<id>/approve` |
| Reject application | POST | `/api/v1/admin/applications/<id>/reject` |
| Waitlist application | POST | `/api/v1/admin/applications/<id>/waitlist` |
| Get waitlist summary | GET | `/api/v1/admin/waitlist/summary/<course_id>` |
| Get next cohort | GET | `/api/v1/admin/waitlist/next-cohort/<course_id>` |
| Migrate single | POST | `/api/v1/admin/waitlist/migrate/<app_id>` |
| Migrate bulk | POST | `/api/v1/admin/waitlist/migrate-bulk` |
| Check payment status | GET | `/api/v1/admin/waitlist/enrollment/<enrollment_id>/payment` |
| Verify payment | POST | `/api/v1/admin/waitlist/enrollment/<enrollment_id>/verify-payment` |
| List unpaid | GET | `/api/v1/admin/waitlist/enrollments/unpaid` |
| Student payment status | GET | `/api/v1/admin/waitlist/my-payment-status` |
| Create enrollment | POST | `/api/v1/enrollments/enroll` |
| Browse courses | GET | `/api/v1/enrollments/browse-courses` |

---

**Document Generated**: April 30, 2026
**System**: Afritech Bridge LMS v1.0+
**Author**: AI Code Assistant

