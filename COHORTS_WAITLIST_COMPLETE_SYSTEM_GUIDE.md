# Afritech Bridge LMS - Complete Cohorts & Waitlist System Guide
**Full Stack Implementation: Backend + Frontend + API**

---

## TABLE OF CONTENTS

1. [System Architecture Overview](#system-architecture-overview)
2. [Core Concepts](#core-concepts)
3. [Database Models](#database-models)
4. [Backend Services & Business Logic](#backend-services--business-logic)
5. [Backend Routes & Endpoints](#backend-routes--endpoints)
6. [Frontend Architecture](#frontend-architecture)
7. [Frontend Components & Pages](#frontend-components--pages)
8. [Frontend Services](#frontend-services)
9. [User Workflows](#user-workflows)
10. [Complete API Reference](#complete-api-reference)
11. [Data Flow Examples](#data-flow-examples)
12. [Payment & Access Control](#payment--access-control)
13. [Waitlist Migration System](#waitlist-migration-system)
14. [Admin Workflows](#admin-workflows)
15. [Deployment & Configuration](#deployment--configuration)
16. [Troubleshooting Guide](#troubleshooting-guide)

---

## SYSTEM ARCHITECTURE OVERVIEW

### High-Level Architecture
```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js 15)                     │
│                  TypeScript + React 19 + Tailwind                │
├─────────────────────────────────────────────────────────────────┤
│ Pages: /courses/[id], /courses/[id]/apply                        │
│ Components: CourseApplicationForm, AdminApplicationsManager      │
│ Services: application.service, waitlist.service, course.service  │
│ Contexts: AuthContext, SidebarContext                            │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                    HTTP/REST API
                (NEXT_PUBLIC_API_URL)
                           │
┌──────────────────────────┴──────────────────────────────────────┐
│                    BACKEND (Flask + SQLAlchemy)                  │
│                   Python REST API on Port 5001                   │
├─────────────────────────────────────────────────────────────────┤
│ Routes: /api/v1/applications, /api/v1/admin/waitlist            │
│ Services: WaitlistService, AchievementService                    │
│ Models: Course, ApplicationWindow, CourseApplication, Enrollment │
│ Database: PostgreSQL (prod) | SQLite (dev)                       │
└─────────────────────────────────────────────────────────────────┘
```

### Component Relationships
```
Course
  ├── ApplicationWindow (Multiple cohorts)
  │   ├── opens_at → closes_at (Application Period)
  │   ├── cohort_start → cohort_end (Learning Period)
  │   └── max_students (Capacity)
  │
  ├── CourseApplication (Student Applications)
  │   ├── status: pending|approved|rejected|waitlisted
  │   ├── application_window_id (Which cohort)
  │   ├── original_window_id (Before migration)
  │   ├── migrated_to_window_id (After migration)
  │   └── Scores: application_score, risk_score, final_rank_score
  │
  └── Enrollment (After Approval)
      ├── application_window_id (Cohort)
      ├── payment_status: pending|completed|waived|failed
      ├── payment_verified: boolean
      └── access_allowed: boolean (based on payment)
```

---

## CORE CONCEPTS

### 1. Application Window (Cohort)
A discrete cohort of a course with its own:
- **Application period**: `opens_at` → `closes_at`
- **Learning period**: `cohort_start` → `cohort_end`
- **Capacity**: `max_students`
- **Status**: computed as `open|upcoming|closed`
- **Payment override**: Can override course default (free/paid/scholarship)

### 2. Application Status Flow
```
PENDING
  ├→ APPROVED ──→ Create Enrollment ──→ Check Payment
  │                                        ├→ Free cohort → Access Granted
  │                                        └→ Paid cohort → Pending payment
  │
  ├→ REJECTED ──→ Notify student
  │
  └→ WAITLISTED ──→ Wait for next cohort ──→ Auto-migrate when available
                                                ├→ Resets to PENDING
                                                ├→ New cohort_start/end
                                                └→ Payment checked again
```

### 3. Payment Inheritance Model
Each ApplicationWindow can override course defaults:
```yaml
Course:
  enrollment_type: "free"      # Fallback default
  price: null
  scholarship_type: null

ApplicationWindow:
  enrollment_type: null  # If null → inherit from Course
  price: null           # If null → inherit from Course
  scholarship_type: null
```

If ALL are null → use course defaults (free)

### 4. Access Control
```
Enrollment Access Allowed = payment_verified OR (cohort_requires_no_payment)

For Free Cohorts:
  access_allowed = TRUE (auto-granted on enrollment creation)

For Paid Cohorts:
  access_allowed = payment_verified AND payment_status='completed'

For Scholarship Cohorts:
  access_allowed = TRUE (scholarship covers payment)
```

---

## DATABASE MODELS

### Course Model
```python
class Course(db.Model):
    id: int (PK)
    title: str (255)
    description: text
    learning_objectives: text
    target_audience: str
    instructor_id: int (FK → User)
    
    # Default enrollment type (can be overridden per ApplicationWindow)
    enrollment_type: enum('free', 'paid', 'scholarship')
    price: float (nullable)
    currency: str (3-char, e.g., 'USD')
    scholarship_type: str (nullable) # 'full', 'partial'
    scholarship_percentage: float (nullable) # 0-100
    
    # Legacy flat cohort fields (for backward compatibility)
    cohort_label: str (nullable)
    cohort_start_date: datetime (nullable)
    cohort_end_date: datetime (nullable)
    application_start_date: datetime (nullable)
    application_end_date: datetime (nullable)
    
    is_published: bool
    created_at: datetime
    updated_at: datetime
    
    # Relationships
    application_windows: List[ApplicationWindow]  # One-to-many
    applications: List[CourseApplication]        # One-to-many
    enrollments: List[Enrollment]               # One-to-many
```

**Key Methods:**
```python
def get_primary_application_window()
  # Returns the currently open window or the first window
  
def get_application_window_status()
  # Returns structured window status: upcoming|open|closed
  
def compute_status(now=None)
  # For legacy flat model
```

### ApplicationWindow Model
```python
class ApplicationWindow(db.Model):
    """Represents a single cohort of a course"""
    id: int (PK)
    course_id: int (FK → Course)
    
    # Cohort identity
    cohort_label: str (e.g., "Jan 2024", "Batch 3")
    description: text (nullable)
    
    # Application period
    opens_at: datetime
    closes_at: datetime
    
    # Learning period
    cohort_start: datetime
    cohort_end: datetime
    
    # Capacity
    max_students: int (nullable)
    
    # Status override (manual management)
    status_override: str (nullable) # 'open', 'closed', 'upcoming'
    
    # Payment override (NULL means inherit from Course)
    enrollment_type: str (nullable)      # 'free', 'paid', 'scholarship'
    price: float (nullable)              # Cohort-specific price
    scholarship_type: str (nullable)     # 'full', 'partial'
    scholarship_percentage: float (nullable)
    payment_mode: str (nullable)         # 'full', 'partial' (for paid cohorts)
    
    created_at: datetime
    updated_at: datetime
    
    # Relationships
    course: Course (Many-to-one)
    applications: List[CourseApplication]  # One-to-many
    enrollments: List[Enrollment]         # One-to-many
```

**Key Methods:**
```python
def compute_status(now=None)
  # Returns: 'upcoming' | 'open' | 'closed'
  # Logic:
  #   1. If status_override set → return that
  #   2. If now < opens_at → 'upcoming'
  #   3. If now > closes_at OR now > cohort_end → 'closed'
  #   4. Else → 'open'

def get_effective_enrollment_type()
  # Returns cohort type or falls back to course type

def get_effective_price()
  # Returns cohort price or falls back to course price

def get_enrollment_count()
  # Counts approved enrollments for this window

def has_available_spots()
  # Returns: max_students > enrollment_count
```

### CourseApplication Model
```python
class CourseApplication(db.Model):
    """Student application to a course cohort"""
    id: int (PK)
    course_id: int (FK → Course)
    user_id: int (FK → User, nullable for pre-enrollment)
    
    # Applicant Information
    full_name: str
    email: str
    phone: str
    whatsapp_number: str (nullable)
    gender: str ('male', 'female', 'other', 'prefer_not')
    age_range: str ('18_24', '25_34', '35_44', '45_54', '55+')
    country: str
    city: str
    
    # Section 2: Education & Background
    education_level: str ('high_school', 'diploma', 'bachelors', 'masters', 'phd')
    current_status: str ('student', 'employed', 'self_employed', 'unemployed')
    field_of_study: str (nullable)
    
    # Section 3: Computer Skills & Excel
    has_used_excel: bool
    excel_skill_level: str ('never_used', 'beginner', 'intermediate', 'advanced', 'expert')
    excel_tasks_done: list (JSON) # ['pivot_tables', 'charts', ...]
    
    # Section 4: Internet & Computer Access
    has_computer: bool
    internet_access_type: str ('broadband', 'mobile', 'limited', 'none')
    
    # Section 5: Learning Preferences
    preferred_learning_mode: str ('self_paced', 'instructor_led', 'hybrid')
    available_time: list (JSON) # ['morning', 'evening', 'weekend']
    
    # Section 6: Commitment & Career Goals
    committed_to_complete: bool
    agrees_to_assessments: bool
    motivation: text
    learning_outcomes: text
    career_impact: text
    
    # Referral & Payment
    referral_source: str (nullable)
    payment_method: str (nullable) # 'mobile_money', 'card', 'bank_transfer'
    payment_status: str ('pending', 'completed', 'failed')
    amount_paid: float
    payment_slip_url: str (nullable)
    
    # Cohort Linkage & Snapshot
    application_window_id: int (FK, nullable)
    cohort_label: str (snapshot, nullable)
    cohort_start_date: datetime (snapshot, nullable)
    cohort_end_date: datetime (snapshot, nullable)
    
    # Application Scoring
    application_score: float (0-100)
    risk_score: float (0-100) # Higher = higher risk
    final_rank_score: float (0-100) # application_score - (risk_score * 0.2)
    is_high_risk: bool
    
    # Status Tracking
    status: str ('pending', 'approved', 'rejected', 'waitlisted')
    reviewed_at: datetime (nullable)
    approved_by: int (FK → User, nullable) # Admin who approved
    admin_notes: text (nullable)
    rejection_reason: str (nullable)
    
    # Waitlist Migration Tracking
    original_window_id: int (FK, nullable) # Before migration
    migrated_to_window_id: int (FK, nullable) # After migration
    migrated_at: datetime (nullable)
    migration_notes: text (nullable)
    
    # Draft Support
    is_draft: bool (default=False)
    
    created_at: datetime
    updated_at: datetime
```

**Key Fields for Waitlist:**
- `application_window_id`: Original cohort applied to
- `status`: Current status (pending|approved|rejected|waitlisted)
- `original_window_id`: Before migration (for tracking history)
- `migrated_to_window_id`: After migration
- `migrated_at`: When migration happened
- `migration_notes`: Admin notes about migration

### Enrollment Model
```python
class Enrollment(db.Model):
    """Student enrollment in a course (after application approval)"""
    id: int (PK)
    student_id: int (FK → User)
    course_id: int (FK → Course)
    application_id: int (FK → CourseApplication, nullable)
    
    # Cohort Linkage
    application_window_id: int (FK, nullable)
    cohort_label: str (snapshot, nullable)
    cohort_start_date: datetime
    cohort_end_date: datetime
    
    # Payment Status
    payment_status: str ('pending', 'completed', 'waived', 'failed')
    payment_verified: bool (default=False)
    payment_verified_at: datetime (nullable)
    verified_by: int (FK → User, nullable) # Admin who verified
    verification_notes: text (nullable)
    
    # Access Control
    # Formula: access_allowed = payment_verified OR cohort_is_free
    access_allowed: bool (computed)
    access_denied_reason: str (nullable)
    
    # Enrollment Status
    status: str ('active', 'completed', 'withdrawn', 'suspended')
    progress: float (0-100, %) # Lesson completion percentage
    enrolled_at: datetime
    last_accessed_at: datetime (nullable)
    
    # Cohort Migration
    migrated_from_window_id: int (FK, nullable) # If migrated from waitlist
    
    created_at: datetime
    updated_at: datetime
```

---

## BACKEND SERVICES & BUSINESS LOGIC

### WaitlistService
```python
class WaitlistService:
    """Manages waitlist migrations and payment verification"""

    # ──────── COHORT DISCOVERY ────────
    @staticmethod
    def get_next_cohort(course_id, current_window_id=None) → ApplicationWindow
        """
        Find next available cohort after current one.
        Logic:
          1. Get all windows ordered by opens_at
          2. Filter to open/upcoming status
          3. Skip current_window_id
          4. Return first that has capacity
        """

    @staticmethod
    def get_waitlisted_applications(course_id, window_id=None) → List[CourseApplication]
        """
        Get waitlisted apps ordered by rank_score.
        Filter by course, optionally by window.
        """

    # ──────── MIGRATION ────────
    @staticmethod
    def migrate_application_to_cohort(
        application_id, target_window_id, admin_id, notes
    ) → (success, message, data)
        """
        Migrate single waitlisted app to target cohort.
        
        Steps:
          1. Validate application exists and is waitlisted
          2. Validate target window exists and has capacity
          3. Update:
             - original_window_id ← old application_window_id
             - application_window_id ← target_window_id
             - migrated_to_window_id ← target_window_id
             - migrated_at ← now()
             - status ← 'pending' (re-review required)
             - cohort snapshot fields updated
          4. Send email notification
          5. Return success
        """

    @staticmethod
    def bulk_migrate_waitlist_to_next_cohort(
        course_id, source_window_id=None, target_window_id=None, max_count=None
    ) → (migrated_count, failed_count, results)
        """
        Auto-migrate multiple waitlisted apps.
        
        Logic:
          1. If no target → auto-detect next cohort
          2. Get waitlisted apps ordered by rank_score
          3. For each app, check target capacity
          4. Migrate up to max_count, respecting capacity
          5. Return migration results
        """

    # ──────── PAYMENT VERIFICATION ────────
    @staticmethod
    def check_enrollment_payment_status(enrollment_id) → payment_status
        """
        Check if enrollment requires payment.
        Returns: 'pending' | 'completed' | 'not_required' | 'waived'
        """

    @staticmethod
    def verify_enrollment_payment(
        enrollment_id, admin_id, status, notes
    ) → (success, message)
        """
        Admin verifies/updates payment status.
        Updates:
          - payment_status ← status
          - payment_verified ← True
          - access_allowed ← True
        """

    @staticmethod
    def is_enrollment_access_allowed(enrollment) → (bool, reason)
        """
        Check if student can access course.
        Formula: access_allowed = payment_verified OR cohort_is_free
        Returns: (True/False, reason_string)
        """

    @staticmethod
    def _cohort_requires_payment(window) → bool
        """
        Determine if cohort requires payment.
        Logic:
          1. Check window.enrollment_type
          2. If 'paid' → check price > 0 → require payment
          3. If 'scholarship' → no payment required
          4. If null → inherit from course
        """

    # ──────── SUMMARY & ANALYTICS ────────
    @staticmethod
    def get_waitlist_migration_summary(course_id) → Dict
        """
        Return per-cohort summary:
        - Waitlisted count
        - Next available cohort
        - Payment requirement
        - Available spots
        """

    @staticmethod
    def get_enrollment_cohort_payment_info(enrollment) → Dict
        """
        Get cohort-level payment details:
        - effective_enrollment_type
        - effective_price
        - requires_payment
        - payment_verified status
        """
```

### Application Approval Logic

When an application is approved:
1. **Check payment requirement** based on target cohort
2. **Create user** if doesn't exist
3. **Create enrollment** with cohort linkage
4. **Set payment_status**:
   - Free cohort → `'waived'`, `payment_verified=True`
   - Paid cohort → `'pending'`, `payment_verified=False`
5. **Send email** notification
6. **Send access link** (if free cohort)

---

## BACKEND ROUTES & ENDPOINTS

### Application Routes: `/api/v1/applications`

#### POST /applications
```http
Submit new application (public)

Request:
{
  "course_id": 1,
  "application_window_id": 1,  ← Which cohort
  "full_name": "John Doe",
  "email": "john@example.com",
  ... (all application form fields)
}

Response (201):
{
  "id": 42,
  "status": "pending",
  "cohort_label": "Jan 2024",
  "application_score": 85,
  "final_rank_score": 87.5,
  "message": "Application submitted successfully"
}
```

#### GET /applications
```http
List applications with filters (admin/instructor)

Query Params:
- course_id: Filter by course
- window_id: Filter by cohort
- status: pending|approved|rejected|waitlisted
- page, per_page: Pagination
- sort_by, order: Sorting

Response (200):
{
  "applications": [...],
  "total": 150,
  "page": 1,
  "per_page": 20
}
```

#### GET /applications/<app_id>
```http
Get single application details (admin)

Response (200):
{
  "id": 42,
  "full_name": "John Doe",
  "status": "waitlisted",
  "application_window_id": 1,
  "original_window_id": null,
  "migrated_to_window_id": null,
  "migrated_at": null,
  "migration_notes": null,
  ... (all fields)
}
```

#### POST /applications/<app_id>/approve
```http
Approve application (admin)

Request:
{
  "notes": "Strong candidate",
  "send_email": true
}

Response (200):
{
  "id": 42,
  "status": "approved",
  "enrollment_id": 100,  ← Created enrollment
  "payment_status": "not_required"  ← If free cohort
}
```

#### POST /applications/<app_id>/waitlist
```http
Waitlist application (admin)

Request:
{
  "reason": "Cohort at capacity",
  "notes": "Will migrate to next",
  "send_email": true
}

Response (200):
{
  "id": 42,
  "status": "waitlisted",
  "position_in_waitlist": 3,
  "next_available_cohort": {
    "id": 2,
    "cohort_label": "Apr 2024",
    "status": "upcoming"
  }
}
```

#### POST /applications/bulk-action
```http
Approve/reject/waitlist multiple (admin)

Request:
{
  "application_ids": [42, 43, 44],
  "action": "approve|reject|waitlist",
  "notes": "Bulk review",
  "send_emails": true
}

Response (202 Accepted):
{
  "task_id": "bulk_12345",
  "status": "processing"
}
```

### Waitlist Routes: `/api/v1/admin/waitlist`

#### GET /summary/<course_id>
```http
Get waitlist migration summary (admin/instructor)

Response (200):
{
  "data": {
    "course_id": 1,
    "cohorts": [
      {
        "window_id": 1,
        "cohort_label": "Jan 2024",
        "status": "closed",
        "max_students": 50,
        "enrollment_count": 50,
        "available_spots": 0,
        "waitlisted_count": 15,
        "migrated_in_count": 5,
        "requires_payment": false,
        "effective_enrollment_type": "free"
      },
      {
        "window_id": 2,
        "cohort_label": "Apr 2024",
        "status": "open",
        "available_spots": 5,
        "requires_payment": true,
        "effective_price": 500.0
      }
    ],
    "next_available_cohort": {
      "window_id": 2,
      "available_spots": 5
    }
  }
}
```

#### GET /next-cohort/<course_id>?current_window_id=1
```http
Get next available cohort (admin/instructor)

Response (200):
{
  "data": {
    "window_id": 2,
    "cohort_label": "Apr 2024",
    "status": "open",
    "available_spots": 5,
    "requires_payment": true,
    "effective_price": 500.0
  }
}
```

#### POST /migrate/<application_id>
```http
Migrate single waitlisted application (admin/instructor)

Request:
{
  "target_window_id": 2,
  "notes": "Moving to next cohort",
  "send_email": true
}

Response (200):
{
  "data": {
    "application_id": 42,
    "original_window_id": 1,
    "target_window_id": 2,
    "new_status": "pending",
    "cohort_label": "Apr 2024",
    "requires_payment": true
  }
}
```

#### POST /migrate-bulk
```http
Bulk migrate waitlist (admin/instructor)

Request:
{
  "course_id": 1,
  "source_window_id": 1,  ← Optional
  "target_window_id": null,  ← Auto-detect if null
  "max_count": 20,
  "send_emails": true
}

Response (200):
{
  "migrated_count": 5,
  "failed_count": 0,
  "target_cohort_label": "Apr 2024",
  "migrated": [
    {
      "application_id": 42,
      "new_status": "pending",
      "cohort_label": "Apr 2024"
    },
    ... (more)
  ]
}
```

#### GET /enrollment/<enrollment_id>/payment
```http
Check enrollment payment status (admin)

Response (200):
{
  "data": {
    "enrollment_id": 100,
    "requires_payment": true,
    "payment_status": "pending",
    "payment_verified": false,
    "access_allowed": false
  }
}
```

#### POST /enrollment/<enrollment_id>/verify-payment
```http
Admin verifies payment (admin)

Request:
{
  "payment_status": "completed",  ← or 'waived'
  "notes": "Verified via bank receipt"
}

Response (200):
{
  "data": {
    "enrollment_id": 100,
    "payment_verified": true,
    "access_allowed": true
  }
}
```

#### GET /enrollments/unpaid?course_id=1&window_id=2
```http
List unpaid enrollments (admin)

Response (200):
{
  "data": [
    {
      "enrollment_id": 100,
      "student_name": "John Doe",
      "course_title": "Advanced Excel",
      "cohort_label": "Apr 2024",
      "payment_status": "pending",
      "payment_verified": false,
      "cohort_effective_price": 500.0
    }
  ],
  "count": 5
}
```

#### GET /my-payment-status
```http
Student check own payment (student)

Authorization: Bearer <JWT>

Response (200):
{
  "data": [
    {
      "enrollment_id": 100,
      "course_title": "Advanced Excel",
      "access_allowed": false,
      "access_reason": "payment_not_verified",
      "payment_status": "pending",
      "requires_payment": true
    }
  ]
}
```

---

## FRONTEND ARCHITECTURE

### Project Structure
```
/frontend
  ├── src/
  │   ├── app/                          # Next.js 15 App Router
  │   │   ├── (auth)/                   # Auth routes
  │   │   ├── courses/
  │   │   │   ├── [id]/
  │   │   │   │   ├── page.tsx          # Course details view
  │   │   │   │   └── apply/
  │   │   │   │       └── page.tsx      # Application form page
  │   │   │   └── page.tsx              # Browse all courses
  │   │   ├── admin/                    # Admin dashboard
  │   │   │   ├── applications/         # Application management
  │   │   │   ├── courses/              # Course management
  │   │   │   └── layout.tsx
  │   │   ├── instructor/               # Instructor dashboard
  │   │   ├── student/                  # Student dashboard
  │   │   └── layout.tsx                # Root layout
  │   │
  │   ├── components/
  │   │   ├── applications/             # Application management
  │   │   │   ├── CourseApplicationForm.tsx      ← Main form
  │   │   │   ├── AdminApplicationsManager.tsx   ← Admin panel
  │   │   │   ├── InstructorApplicationsManager.tsx
  │   │   │   └── AdvancedFilters.tsx
  │   │   ├── enrollment/               # Enrollment components
  │   │   │   └── PaymentStatusBanner.tsx
  │   │   ├── ui/                       # Shadcn/ui components
  │   │   ├── admin/                    # Admin-specific components
  │   │   │   ├── ApplicantsTable.tsx
  │   │   │   ├── BulkActionsBar.tsx
  │   │   │   ├── CourseManagement/
  │   │   │   └── ...
  │   │   └── ...
  │   │
  │   ├── services/
  │   │   ├── api/                      # API integration layer
  │   │   │   ├── base.service.ts       # Axios instance + auth
  │   │   │   ├── application.service.ts    ← Applications API
  │   │   │   ├── waitlist.service.ts   ← Waitlist API
  │   │   │   ├── course.service.ts     ← Courses API
  │   │   │   ├── types.ts              # TypeScript interfaces
  │   │   │   └── index.ts              # Export all services
  │   │   └── ...
  │   │
  │   ├── contexts/
  │   │   ├── AuthContext.tsx           # JWT auth + user state
  │   │   └── SidebarContext.tsx
  │   │
  │   ├── types/
  │   │   └── api.ts                    # Frontend types
  │   │
  │   ├── utils/
  │   │   ├── cohort-utils.ts           # Cohort/window utilities
  │   │   └── ...
  │   │
  │   └── hooks/
  │       ├── useAuth.ts
  │       └── ...
  │
  └── public/
```

### Authentication Flow
```
1. User logs in on /auth/login
   ↓
2. AuthContext stores JWT in localStorage
   ↓
3. BaseApiService adds header: Authorization: Bearer <JWT>
   ↓
4. API calls include auth token automatically
   ↓
5. On 401 response → refresh token or redirect to login
```

---

## FRONTEND COMPONENTS & PAGES

### CourseApplicationForm.tsx
**Location:** `src/components/applications/CourseApplicationForm.tsx`

**Purpose:** Multi-step application form with 6 sections

**Props:**
```typescript
interface CourseApplicationFormProps {
  courseId: number;
  courseTitle?: string;
  courseData?: Course;
  selectedWindow?: ApplicationWindowData;  // ← Selected cohort
  onSuccess?: (applicationId: number) => void;
  onCancel?: () => void;
}
```

**Key Features:**
1. **Multi-step form** (6 sections):
   - Section 1: Applicant Info (name, email, phone, location)
   - Section 2: Education & Background
   - Section 3: Skills Assessment (Excel/Python specific)
   - Section 4: Computer & Internet Access
   - Section 5: Learning Preferences & Commitment
   - Section 6: Career Goals

2. **Draft saving**: `saveDraft()` → saves incomplete applications
3. **Payment integration**: Flutterwave modal for payment
4. **Auto-save**: Periodically saves progress
5. **Course-specific config**: Adapts questions based on course

**Key Methods:**
```typescript
export default function CourseApplicationForm({...}) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({...});
  const [submitting, setSubmitting] = useState(false);

  const handleSaveDraft = async () => {
    // POST /applications/save-draft
    const response = await applicationService.saveDraft(formData);
    // → Saves incomplete application
  }

  const handleSubmit = async () => {
    // POST /applications
    const response = await applicationService.submitApplication(formData);
    // → Show success screen with Application ID
  }

  const handlePayment = async () => {
    // Open FlutterwaveCheckoutModal
    // After payment → submit application
  }
}
```

### CourseApplicationPage (/courses/[id]/apply)
**Location:** `src/app/courses/[id]/apply/page.tsx`

**Purpose:** Application page with cohort selector

**Key Features:**
1. **Load course details** with all cohorts
2. **Normalize application windows** (convert flat/multi-format)
3. **Show cohort picker** if multiple windows exist
4. **Display cohort info**:
   - Cohort label & status (open/upcoming/closed)
   - Dates: opens_at, closes_at, cohort_start, cohort_end
   - Capacity & spots available
   - Payment tier badge
5. **Validate window status** before showing form
6. **Pass selectedWindow** to CourseApplicationForm

**Flow:**
```
User visits /courses/1/apply
  ↓
Fetch course details with windows
  ↓
Normalize windows (convert various formats)
  ↓
If multiple windows → show picker
  ↓
Select primary/open window
  ↓
Pass to CourseApplicationForm
```

### AdminApplicationsManager.tsx
**Location:** `src/components/applications/AdminApplicationsManager.tsx`

**Purpose:** Complete admin panel for managing applications

**Key Features:**

1. **List applications** with advanced filters:
   - Status: pending|approved|rejected|waitlisted
   - Course, Cohort, Date range
   - Score range (min/max)
   - Demographic filters

2. **Search applications** by name, email, etc.

3. **Bulk actions**:
   - Select multiple applications
   - Approve/Reject/Waitlist all at once
   - Send custom emails

4. **Individual actions**:
   - View full details
   - Change status (approve/reject/waitlist)
   - Add admin notes
   - View scores and ranking

5. **Pagination & sorting**:
   - 20 apps per page
   - Sort by submission date, score, etc.

**Key Methods:**
```typescript
export default function AdminApplicationsManager() {
  const [applications, setApplications] = useState<CourseApplication[]>([]);
  const [filters, setFilters] = useState({...});

  // Load applications with filters
  const loadApplications = async () => {
    const response = await applicationService.listApplications(filters);
    setApplications(response.applications);
  }

  // Approve single application
  const handleApprove = async (appId: number) => {
    await applicationService.approveApplication(appId, {
      notes: "Approved",
      send_email: true
    });
    loadApplications();  // Refresh list
  }

  // Bulk approve
  const handleBulkApprove = async () => {
    await applicationService.bulkAction({
      application_ids: selectedApplicationIds,
      action: 'approve',
      notes: '...',
      send_emails: true
    });
    loadApplications();
  }

  // Migrate from waitlist
  const handleMigrate = async (appId: number) => {
    await waitlistService.migrateApplication(appId, {
      target_window_id: nextCohortId,
      notes: '...',
      send_email: true
    });
    loadApplications();
  }
}
```

### CourseDetailsPage (/courses/[id])
**Location:** `src/app/courses/[id]/page.tsx`

**Purpose:** Course details view with cohort info and apply button

**Key Features:**
1. **Load course** with application windows
2. **Display multiple cohorts**:
   - Cohort label
   - Status badge (open/upcoming/closed)
   - Dates: opens/closes/starts/ends
   - Max students, enrollment count
   - Payment tier badge
3. **Apply buttons** per cohort:
   - Only visible for open windows
   - Only if not already enrolled
   - Routes to `/courses/[id]/apply?window=[id]`
4. **Enrollment check**: Show "Enrolled" if user already in this cohort

---

## FRONTEND SERVICES

### application.service.ts
```typescript
class CourseApplicationService {
  // Check for existing application
  async checkDuplicate(courseId: number, email: string): Promise<{
    exists: boolean;
    application?: CourseApplication;
  }>

  // Submit new application
  async submitApplication(data: ApplicationSubmitData): Promise<{
    message: string;
    application_id: number;
    scores: {application_score, final_rank, ...};
  }>

  // Save draft (incomplete application)
  async saveDraft(data: ApplicationSubmitData): Promise<{
    application_id: number;
    is_draft: boolean;
  }>

  // Get single application
  async getApplicationDetails(appId: number): Promise<CourseApplication>

  // List applications with filters
  async listApplications(params: {...}): Promise<{
    applications: CourseApplication[];
    total: number;
    page: number;
  }>

  // Advanced search
  async advancedSearch(filters: {...}): Promise<{
    applications: CourseApplication[];
  }>

  // Admin actions
  async approveApplication(appId: number, data: {
    notes: string;
    send_email: boolean;
  }): Promise<CourseApplication>

  async rejectApplication(appId: number, data: {
    reason: string;
    notes: string;
    send_email: boolean;
  }): Promise<CourseApplication>

  async waitlistApplication(appId: number, data: {...}): Promise<CourseApplication>

  // Bulk actions
  async bulkAction(data: {
    application_ids: number[];
    action: 'approve' | 'reject' | 'waitlist';
    notes: string;
    send_emails: boolean;
  }): Promise<{task_id: string}>

  // Check bulk action status
  async getBulkActionStatus(taskId: string): Promise<{
    status: 'processing' | 'completed' | 'failed';
    progress: number;
  }>
}
```

### waitlist.service.ts
```typescript
class WaitlistService {
  // Get waitlist summary
  async getWaitlistSummary(courseId: number): Promise<{
    data: {
      cohorts: CohortSummary[];
      next_available_cohort: CohortInfo;
    };
  }>

  // Get next cohort
  async getNextCohort(courseId: number, currentWindowId?: number): Promise<{
    data: {
      window_id: number;
      cohort_label: string;
      available_spots: number;
      requires_payment: boolean;
    };
  }>

  // Migrate single application
  async migrateApplication(appId: number, data: {
    target_window_id: number;
    notes: string;
    send_email: boolean;
  }): Promise<{
    data: {
      application_id: number;
      target_window_id: number;
      new_status: string;
    };
  }>

  // Bulk migrate
  async bulkMigrateWaitlist(data: {
    course_id: number;
    target_window_id?: number;
    max_count?: number;
    send_emails: boolean;
  }): Promise<{
    migrated_count: number;
    failed_count: number;
  }>

  // Check payment status
  async checkPaymentStatus(enrollmentId: number): Promise<{
    requires_payment: boolean;
    payment_status: string;
    access_allowed: boolean;
  }>

  // Verify payment
  async verifyPayment(enrollmentId: number, data: {
    payment_status: string;
    notes: string;
  }): Promise<{
    payment_verified: boolean;
    access_allowed: boolean;
  }>

  // Get unpaid enrollments
  async getUnpaidEnrollments(courseId?: number): Promise<{
    data: EnrollmentPaymentInfo[];
    count: number;
  }>

  // Student check own payment
  async getMyPaymentStatus(): Promise<{
    data: StudentPaymentStatus[];
  }>
}
```

### course.service.ts
```typescript
class CourseApiService {
  // Get course details with windows
  async getCourseDetails(courseId: number): Promise<Course>
    // Returns: {
    //   id, title, description,
    //   enrollment_type, price,
    //   application_windows: [
    //     {
    //       id, cohort_label, status,
    //       opens_at, closes_at, cohort_start, cohort_end,
    //       effective_price, requires_payment,
    //     }
    //   ]
    // }

  // Browse courses
  async browseCourses(params: {
    page?: number;
    search?: string;
    category?: string;
  }): Promise<{
    courses: Course[];
    total: number;
  }>

  // Get enrollment status
  async getEnrollmentStatus(courseId: number): Promise<{
    enrolled: boolean;
    cohort_label?: string;
    access_allowed?: boolean;
  }>

  // Create enrollment
  async createEnrollment(courseId: number, windowId: number): Promise<{
    id: number;
    status: string;
    payment_status: string;
  }>
}
```

---

## USER WORKFLOWS

### Student Workflow: Apply for Course

```
1. Browse Courses
   GET /courses?search=Excel
   → Display all courses with open/upcoming windows

2. View Course Details
   GET /courses/1
   → Display course info + all cohorts

3. Select "Apply Now" (for open cohort)
   → Navigate to /courses/1/apply

4. Normalize Windows (Frontend)
   ├─ Get course data with windows
   ├─ Convert flat fields + window objects
   └─ Get primary/open window

5. Select Cohort (if multiple)
   ├─ Show cohort picker
   ├─ Display dates & pricing
   └─ Select desired cohort

6. Fill Application Form (6 sections)
   ├─ Auto-save drafts
   ├─ Calculate scores on submit
   └─ Show confirmation

7. Submit Application
   POST /applications
   ├─ Create CourseApplication
   ├─ Resolve ApplicationWindow
   ├─ Store cohort snapshot
   └─ Return Application ID

8. Check Duplicate
   GET /applications/check-duplicate
   ├─ Warn if already applied for this course
   └─ Show previous status

9. Success Page
   ├─ Display Application ID
   ├─ Show what happens next
   └─ Next steps: admin review

Status after submission: PENDING
Next: Wait for admin review (2-3 business days)
```

### Admin Workflow: Review & Manage Applications

```
1. Access Admin Dashboard
   → /admin/applications

2. Load Applications
   GET /applications?page=1&per_page=20
   ├─ Filter by course, cohort, status
   ├─ Search by name/email
   └─ Sort by score, date, etc.

3. View Applicant Details
   GET /applications/42
   ├─ Full application data
   ├─ Scores & ranking
   ├─ Payment status
   └─ Cohort info

4. Score-Based Decision
   ├─ High score → Approve
   ├─ Low score → Reject
   └─ Medium score + full cohort → Waitlist

5. Approve Application
   POST /applications/42/approve
   ├─ Create user if not exists
   ├─ Create enrollment
   ├─ Set payment_status = 'waived' (free) or 'pending' (paid)
   ├─ Send approval email
   └─ Application status = APPROVED

6. Reject Application
   POST /applications/42/reject
   ├─ Set rejection reason
   ├─ Send rejection email
   └─ Application status = REJECTED

7. Waitlist Application (Cohort full)
   POST /applications/42/waitlist
   ├─ Application status = WAITLISTED
   ├─ Track original_window_id
   ├─ Get next available cohort
   └─ Notify student they're on waitlist

8. Check Waitlist Status
   GET /admin/waitlist/summary/1
   ├─ Show all cohorts
   ├─ Waitlisted count per cohort
   ├─ Next available cohort
   └─ Auto-migration possible?

9. Migrate Waitlist (When next cohort opens)
   POST /admin/waitlist/migrate-bulk
   ├─ Auto-detect next cohort
   ├─ Check available capacity
   ├─ Migrate up to max_count
   ├─ Reset status to PENDING
   ├─ Update cohort snapshot
   └─ Send migration email

   OR (Single migration)
   POST /admin/waitlist/migrate/42
   ├─ Manually move to specific cohort
   └─ Update migration tracking
```

### Admin Workflow: Payment Verification

```
1. Check Unpaid Enrollments
   GET /admin/waitlist/enrollments/unpaid?course_id=1&window_id=2
   ├─ Filter by course/cohort
   └─ Show students with pending payment

2. Review Payment Evidence
   ├─ Student uploaded payment slip
   ├─ Mobile money receipt
   └─ Bank transfer proof

3. Verify Payment (Admin)
   POST /admin/waitlist/enrollment/100/verify-payment
   {
     "payment_status": "completed",
     "notes": "Verified MTN payment receipt"
   }
   ├─ payment_verified = True
   ├─ access_allowed = True
   └─ Send access notification

4. Waive Payment (Optional)
   POST /admin/waitlist/enrollment/100/verify-payment
   {
     "payment_status": "waived",
     "notes": "Scholarship awarded"
   }
   └─ Grant access without payment

5. Student Accesses Course
   ├─ Check access_allowed before loading content
   ├─ If allowed → show course lessons
   └─ If not → show "Pending Payment" banner
```

### Student Workflow: Access Course After Approval

```
1. Receive Approval Email
   ├─ Contains course start date
   ├─ Cohort dates
   └─ Access link

2. Log In to Platform
   → JWT token stored

3. Navigate to Course
   GET /student/enrollments/my-enrollments
   ├─ Show enrolled courses
   ├─ Display cohort info
   └─ Check payment_verified status

4. Try to Access Course Lessons
   ├─ If free cohort → access granted
   │  ├─ access_allowed = True (auto)
   │  └─ Show lessons
   │
   └─ If paid cohort
      ├─ Check payment_verified = True
      ├─ If False → show "Pending Payment" banner
      │  ├─ Display payment link
      │  ├─ Instructions to verify
      │  └─ Upload payment receipt
      │
      └─ If True → Show lessons

5. Payment (Paid Cohort)
   ├─ Student submits payment via Flutterwave/MTN
   ├─ Receives payment receipt
   ├─ Admin verifies receipt
   └─ access_allowed = True

6. Access Granted
   ├─ Can view lessons
   ├─ Can submit assignments
   ├─ Can take quizzes
   └─ Progress tracked
```

---

## COMPLETE API REFERENCE

[See COHORTS_WAITLIST_API_ENDPOINTS.md for detailed endpoint documentation]

Key endpoint families:
- `/applications` - CRUD + bulk actions
- `/admin/waitlist` - Migration + payment verification
- `/enrollments` - Enrollment & enrollment browsing
- `/courses` - Course details with windows

---

## DATA FLOW EXAMPLES

### Scenario 1: Free Cohort (Auto-access)
```
User applies for Free Excel (Jan 2024 - Free)
  ↓
Admin approves application
  ├─ Create CourseApplication: status = 'approved'
  ├─ Create User (if not exists)
  ├─ Create Enrollment
  │  ├─ application_window_id = 1 (Jan 2024 window)
  │  ├─ payment_status = 'waived' (FREE COHORT)
  │  ├─ payment_verified = True ✓
  │  └─ access_allowed = True ✓
  │
  └─ Send approval email with course link

Student receives email
  ↓
Logs in to platform
  ↓
Views enrollments
  └─ Sees "Advanced Excel" with status "Active"

Clicks course
  ↓
System checks:
  ├─ enrollment.payment_verified = True ✓
  └─ access_allowed = True ✓

ACCESS GRANTED
  └─ Can view all lessons, submit assignments, etc.
```

### Scenario 2: Paid Cohort (Pending Payment)
```
User applies for Paid Excel (Apr 2024 - $500)
  ↓
Admin approves application
  ├─ Create CourseApplication: status = 'approved'
  ├─ Create Enrollment
  │  ├─ application_window_id = 2 (Apr 2024 window)
  │  ├─ payment_status = 'pending' (PAID COHORT)
  │  ├─ payment_verified = False ✗
  │  └─ access_allowed = False ✗
  │
  └─ Send approval + payment instructions email

Student receives email
  ↓
Logs in to platform
  ↓
Views enrollments
  └─ Sees "Advanced Excel - PAYMENT PENDING" ⚠️

Clicks course
  ↓
System checks:
  ├─ payment_verified = False ✗
  └─ Shows PaymentStatusBanner

Banner displays:
  ├─ "Payment Required: $500"
  ├─ Payment method options
  └─ "Upload receipt" button

Student pays via Flutterwave/Mobile Money
  ↓
Receives receipt
  ↓
Uploads receipt to platform
  ↓
Admin reviews & verifies
  POST /admin/waitlist/enrollment/100/verify-payment
  {
    "payment_status": "completed",
    "notes": "Receipt verified - MTN #12345"
  }

Admin action updates:
  ├─ payment_verified = True ✓
  ├─ access_allowed = True ✓
  └─ Send "Access Granted" email

Student accesses course
  ├─ payment_verified = True ✓
  └─ ACCESS GRANTED ✓
```

### Scenario 3: Waitlist & Migration
```
Jan 2024 cohort is FULL (50/50 students)
  ↓
User applies for Jan 2024 cohort
  ↓
Admin reviews application (Score: 75/100)
  └─ Decision: Good candidate but cohort full → WAITLIST

POST /applications/42/waitlist
  ├─ status = 'waitlisted'
  ├─ application_window_id = 1 (Jan cohort)
  ├─ original_window_id = null (never approved yet)
  └─ Send waitlist email + position info

Student is on waitlist
  ├─ Position: 3 of 15
  ├─ Next cohort: Apr 2024 (opens Apr 1)
  └─ Will auto-migrate if available

2 weeks later: Apr 2024 cohort opens
  ├─ Has capacity: 40 spots available
  └─ Paid cohort: $500

Admin checks waitlist
GET /admin/waitlist/summary/1
  ├─ Shows: 15 waitlisted from Jan
  ├─ Next cohort: Apr (40 spots, paid)
  └─ Can migrate up to 40 students

Admin triggers bulk migration
POST /admin/waitlist/migrate-bulk
{
  "course_id": 1,
  "source_window_id": 1,
  "target_window_id": 2,
  "max_count": 40,
  "send_emails": true
}

For each waitlisted application (ordered by rank_score):
  ├─ Check next cohort capacity
  ├─ If available:
  │  ├─ original_window_id = 1 (Jan cohort)
  │  ├─ application_window_id = 2 (Apr cohort)
  │  ├─ migrated_to_window_id = 2
  │  ├─ migrated_at = now()
  │  ├─ status = 'pending' ← RE-REVIEW REQUIRED
  │  ├─ cohort_label = "Apr 2024"
  │  ├─ cohort_start_date, cohort_end_date updated
  │  │
  │  └─ Send email:
  │     "Good news! Space opened up in Apr cohort"
  │
  └─ If no capacity: leave on waitlist

Result:
  ├─ 15 migrations attempted
  ├─ 12 successful (capacity: 40)
  ├─ 3 remain waitlisted (for future cohorts)
  └─ Message: "Migrated 12 of 15 applications"

Top 12 migrate to Apr cohort
  ├─ status = 'pending' (need re-approval for Apr)
  ├─ This is a PAID cohort
  └─ Will require payment verification

Admin re-approves migrated applications
  POST /applications/42/approve
  ├─ Create new Enrollment (for Apr cohort)
  ├─ payment_status = 'pending' (PAID COHORT)
  ├─ payment_verified = False
  └─ access_allowed = False

Student notified:
  ├─ "You've been moved to Apr 2024 cohort!"
  ├─ "This cohort requires $500 payment"
  ├─ "Start date: May 1, 2024"
  └─ Payment link

Student pays for Apr cohort
  ↓
Admin verifies payment
  ↓
Payment verified = True
  ↓
ACCESS GRANTED

Timeline:
  Jan 1  → Apply for Jan cohort → WAITLISTED (position 3)
  Jan 15 → Jan cohort starts (Jan 2024 - Free)
  Apr 1  → Apr cohort opens (Apr 2024 - Paid)
  Apr 5  → Auto-migrate to Apr cohort → status = PENDING
  Apr 10 → Admin approves → Create Apr enrollment
  Apr 12 → Student pays $500
  Apr 15 → Payment verified
  May 1  → Apr cohort starts → Student has access
```

---

## PAYMENT & ACCESS CONTROL

### Payment Decision Tree
```
When application is APPROVED:

1. Check target cohort type:
   ├─ window.enrollment_type = 'free' → NO PAYMENT REQUIRED
   │  └─ Enrollment: payment_status='waived', payment_verified=True
   │
   ├─ window.enrollment_type = 'paid'
   │  ├─ Check window.price > 0 → PAYMENT REQUIRED
   │  ├─ Check if user has scholarship → WAIVED
   │  └─ Else → Enrollment: payment_status='pending', payment_verified=False
   │
   └─ window.enrollment_type = 'scholarship'
      ├─ Scholarship type = 'full' → NO PAYMENT
      │  └─ payment_status='waived', payment_verified=True
      │
      └─ Scholarship type = 'partial' → PARTIAL PAYMENT
         └─ payment_status='pending', verified after partial payment

2. Create Enrollment
   ├─ application_window_id ← window.id
   ├─ cohort_label ← window.cohort_label
   ├─ cohort_start_date ← window.cohort_start
   ├─ cohort_end_date ← window.cohort_end
   ├─ payment_status ← determined above
   ├─ payment_verified ← True if waived, else False
   └─ access_allowed ← payment_verified OR cohort_is_free

3. Send Email
   ├─ If payment required → payment instructions
   ├─ If free → course access link
   └─ Include cohort dates
```

### Access Control Formula
```
access_allowed = (payment_verified == True) OR (cohort_requires_no_payment == True)

Checks:
1. enrollment.payment_verified = True?
   ├─ Yes → Verify cohort still requires payment
   │  ├─ Free → access = True ✓
   │  ├─ Paid but verified → access = True ✓
   │  └─ Scholarship → access = True ✓
   │
   └─ No → Verify cohort requires payment
      ├─ Paid cohort → access = False ✗ (pending payment)
      ├─ Free cohort → access = True ✓ (shouldn't happen but just in case)
      └─ Scholarship → access = True ✓

Frontend (CourseDetailsPage, StudentDashboard):
  ├─ GET /enrollments/my-enrollments
  ├─ For each enrollment:
  │  ├─ Check access_allowed
  │  ├─ If False → Show PaymentStatusBanner
  │  │  └─ "Payment pending - Click to verify"
  │  │
  │  └─ If True → Show course lessons
  │
  └─ Allow progress tracking only if access_allowed=True

Backend (Routes):
  ├─ GET /student/course/1/lessons
  ├─ Check: is_enrollment_access_allowed(enrollment)
  ├─ If False → 403 Forbidden
  └─ If True → Return lessons

Admin Panel:
  ├─ GET /admin/waitlist/enrollments/unpaid
  ├─ Shows all enrollments with payment_verified=False
  ├─ For paid cohorts only
  └─ Allows bulk payment verification
```

---

## WAITLIST MIGRATION SYSTEM

### Auto-Detection of Next Cohort
```python
def get_next_cohort(course_id, current_window_id=None):
    """Find next available cohort after current"""
    
    # Get all windows for course
    windows = ApplicationWindow.query.filter_by(course_id=course_id)\
        .order_by(ApplicationWindow.opens_at.asc())\
        .all()
    
    # Filter to those that:
    # 1. Are in the future (cohort_start > now)
    # 2. Have status 'open' or 'upcoming'
    # 3. Have available capacity
    
    for window in windows:
        if window.id == current_window_id:
            continue  # Skip current window
        
        status = window.compute_status()
        if status not in ['open', 'upcoming']:
            continue  # Skip closed windows
        
        # Check capacity
        enrollment_count = Enrollment.query.filter_by(
            application_window_id=window.id
        ).count()
        
        if enrollment_count < window.max_students:
            return window  # Found!
    
    return None  # No suitable window
```

### Migration Eligibility
```
A waitlisted application can migrate to next cohort if:

1. Source application:
   ├─ status = 'waitlisted' ✓
   ├─ application_window_id = source_cohort_id
   └─ is_draft = False

2. Target cohort:
   ├─ status = 'open' or 'upcoming' ✓
   ├─ enrollment_count < max_students ✓
   ├─ Sufficient spots available
   └─ course_id matches source

3. During migration:
   ├─ original_window_id ← application_window_id
   ├─ application_window_id ← target_window_id ← NEW COHORT
   ├─ migrated_to_window_id ← target_window_id
   ├─ migrated_at ← NOW()
   ├─ status ← 'pending' ← RE-REVIEW
   └─ Cohort fields snapshot: cohort_label, cohort_start, cohort_end
```

### Bulk Migration Algorithm
```
def bulk_migrate_waitlist_to_next_cohort(
    course_id, 
    source_window_id=None, 
    target_window_id=None, 
    max_count=None
):
    # 1. Get waitlisted applications
    if source_window_id:
        apps = CourseApplication.query.filter_by(
            course_id=course_id,
            application_window_id=source_window_id,
            status='waitlisted'
        ).order_by(
            CourseApplication.final_rank_score.desc()
        ).all()
    else:
        apps = CourseApplication.query.filter_by(
            course_id=course_id,
            status='waitlisted'
        ).order_by(
            CourseApplication.final_rank_score.desc()
        ).all()
    
    # 2. Determine target cohort if not specified
    if not target_window_id:
        target = get_next_cohort(course_id, source_window_id)
        if not target:
            return (0, len(apps), "No suitable target cohort found")
        target_window_id = target.id
    
    target_window = ApplicationWindow.query.get(target_window_id)
    
    # 3. Migrate apps up to capacity
    migrated_count = 0
    failed_count = 0
    
    for app in apps:
        if max_count and migrated_count >= max_count:
            break
        
        # Check target capacity
        current_enrollment = Enrollment.query.filter_by(
            application_window_id=target_window_id
        ).count()
        
        pending_migrations = CourseApplication.query.filter_by(
            migrated_to_window_id=target_window_id,
            status='pending'
        ).count()
        
        total_allocated = current_enrollment + pending_migrations
        
        if total_allocated >= target_window.max_students:
            failed_count += 1
            continue
        
        # Perform migration
        try:
            app.original_window_id = app.application_window_id
            app.application_window_id = target_window_id
            app.migrated_to_window_id = target_window_id
            app.migrated_at = datetime.utcnow()
            app.status = 'pending'  # ← Re-review required
            
            # Update cohort snapshot
            app.cohort_label = target_window.cohort_label
            app.cohort_start_date = target_window.cohort_start
            app.cohort_end_date = target_window.cohort_end
            
            db.session.add(app)
            migrated_count += 1
            
            # Send email notification
            send_migration_email(app, target_window)
        except Exception as e:
            failed_count += 1
            logger.error(f"Migration failed for app {app.id}: {e}")
    
    db.session.commit()
    
    return (migrated_count, failed_count, {
        'migrated': [...],
        'failed': [...]
    })
```

---

## ADMIN WORKFLOWS

### Admin Dashboard Workflows

#### 1. Application Review Workflow
```
Admin logs in
  ↓
Navigate to /admin/applications
  ↓
1. Load Applications
   GET /applications?page=1&status=pending
   ├─ Filter: course_id, window_id, status
   ├─ Search: name, email
   └─ Sort: submission_date, score
  ↓
2. Apply Filters
   ├─ Country: Cameroon
   ├─ Education: Bachelors+
   ├─ Score: 70-100
   └─ Get filtered list
  ↓
3. Review Individual App
   GET /applications/42
   ├─ View full application
   ├─ See all scores
   ├─ View admin notes from previous reviews
   └─ Check for duplicate applications
  ↓
4. Make Decision
   ├─ HIGH SCORE → Approve
   │  POST /applications/42/approve
   │  ├─ Create user
   │  ├─ Create enrollment
   │  └─ Send approval email
   │
   ├─ LOW SCORE → Reject
   │  POST /applications/42/reject
   │  ├─ Set rejection reason
   │  └─ Send rejection email
   │
   └─ MEDIUM SCORE, COHORT FULL → Waitlist
      POST /applications/42/waitlist
      ├─ status = waitlisted
      └─ Send waitlist email
  ↓
5. Bulk Review
   ├─ Select multiple applications
   ├─ Apply same action to all
   ├─ Customize notes
   └─ Send bulk emails
```

#### 2. Waitlist Management Workflow
```
Admin Dashboard
  ↓
Navigate to Waitlist Section
  ↓
1. Check Waitlist Status
   GET /admin/waitlist/summary/1
   ├─ View all cohorts
   ├─ Waitlisted count per cohort
   ├─ Next available cohort
   └─ Migration feasibility
  ↓
2. Auto-Migrate Waitlist
   POST /admin/waitlist/migrate-bulk
   {
     "course_id": 1,
     "target_window_id": null,  ← Auto-detect
     "max_count": 50,
     "send_emails": true
   }
   ├─ Auto-detect next cohort
   ├─ Check capacity
   ├─ Migrate top-ranked apps
   └─ Respect capacity limit
  ↓
3. Review Migration Results
   ├─ Migrated: 12 of 15
   ├─ Remaining: 3 (next cohort in June)
   └─ View migrated applications
  ↓
4. Approve Migrated Apps
   ├─ Review in new context
   ├─ Migrated apps have status 'pending'
   ├─ Approve to create new enrollments
   └─ Set payment requirements
  ↓
5. Track Migration History
   ├─ View original_window_id
   ├─ View migrated_to_window_id
   ├─ Check migration_notes
   └─ Monitor migration timeline
```

#### 3. Payment Verification Workflow
```
Admin Dashboard
  ↓
Navigate to Payment Verification
  ↓
1. List Unpaid Enrollments
   GET /admin/waitlist/enrollments/unpaid?window_id=2
   ├─ Filter by course/cohort
   ├─ Show students: payment_verified=False
   ├─ Only for PAID cohorts
   └─ Display amount due
  ↓
2. Review Payment Evidence
   ├─ Student uploaded receipt
   ├─ Mobile money confirmation
   ├─ Bank transfer proof
   └─ Verify legitimacy
  ↓
3. Verify Payment
   POST /admin/waitlist/enrollment/100/verify-payment
   {
     "payment_status": "completed",
     "notes": "MTN Receipt #12345 verified"
   }
   ├─ payment_verified = True
   ├─ access_allowed = True
   └─ Send "Access Granted" email
  ↓
4. Handle Failed Payments
   POST /admin/waitlist/enrollment/101/verify-payment
   {
     "payment_status": "failed",
     "notes": "Receipt invalid - request new proof"
   }
   └─ Send rejection + re-submit instructions
  ↓
5. Grant Scholarship/Waive
   POST /admin/waitlist/enrollment/102/verify-payment
   {
     "payment_status": "waived",
     "notes": "Scholarship granted"
   }
   ├─ payment_verified = True
   └─ access_allowed = True (no payment)
```

---

## DEPLOYMENT & CONFIGURATION

### Backend Configuration

**Environment Variables:**
```bash
# Flask
FLASK_ENV=production
FLASK_APP=main.py
SECRET_KEY=<32-byte hex>
JWT_SECRET_KEY=<32-byte hex>

# Database
DATABASE_URL=postgresql+psycopg2://user:pass@host:5432/afritec_lms
# OR (SQLite in dev)
DATABASE_URL=sqlite:///instance/afritec_lms_db.db

# CORS
ALLOWED_ORIGINS=https://app.afritech.com,https://admin.afritech.com
FLASK_ENV=production  # Enables strict CORS

# Email
MAIL_USERNAME=noreply@afritech.com
MAIL_PASSWORD=<password>
MAIL_DEFAULT_SENDER=no-reply@afritech.com

# Payment (Flutterwave)
FLUTTERWAVE_SECRET_KEY=<api-key>
FLUTTERWAVE_PUBLIC_KEY=<api-key>

# Payment (MTN Momo)
MOMO_API_KEY=<api-key>
MOMO_SUBSCRIBER_KEY=<api-key>
```

**Database Migrations:**
```bash
# Initialize database
python -c "from main import db; db.create_all()"

# Or with Alembic (if using)
flask db upgrade

# Seed initial data
python create_admin.py
python create_instructor.py
```

### Frontend Configuration

**Environment Variables:**
```bash
# API
NEXT_PUBLIC_API_URL=https://api.afritech.com/api/v1

# Auth
NEXT_PUBLIC_APP_NAME="Afritech Bridge LMS"
NEXT_PUBLIC_LOGO_URL=/logo.png

# Flutterwave
NEXT_PUBLIC_FLUTTERWAVE_KEY=<public-key>

# Features
NEXT_PUBLIC_ENABLE_ACHIEVEMENTS=true
NEXT_PUBLIC_ENABLE_GAMIFICATION=true
```

**Build & Deploy:**
```bash
# Install dependencies
npm install

# Build for production
npm run build

# Deploy to Vercel
vercel deploy --prod

# Or Cloudflare Pages
npm run build:worker
wrangler deploy
```

---

## TROUBLESHOOTING GUIDE

### Common Issues

#### Issue: Application not appearing in cohort list
**Solution:**
1. Check `application_window_id` in database:
   ```sql
   SELECT application_window_id, cohort_label FROM course_applications WHERE id=42;
   ```
2. Verify ApplicationWindow exists:
   ```sql
   SELECT * FROM application_windows WHERE id=<window_id>;
   ```
3. If null, manually fix cohort link:
   ```python
   app = CourseApplication.query.get(42)
   app.application_window_id = 1
   db.session.commit()
   ```

#### Issue: Waitlist migration not working
**Solution:**
1. Check waitlisted applications:
   ```sql
   SELECT * FROM course_applications WHERE status='waitlisted' AND course_id=1;
   ```
2. Verify next cohort exists and has capacity:
   ```sql
   SELECT * FROM application_windows WHERE course_id=1 AND status != 'closed';
   ```
3. Check for blocking migration issues:
   - Application already migrated?
   - Target cohort full?
   - Status not 'waitlisted'?
4. Test manually:
   ```python
   from services.waitlist_service import WaitlistService
   success, msg, data = WaitlistService.migrate_application_to_cohort(
       application_id=42,
       target_window_id=2,
       admin_id=1,
       notes="Test migration"
   )
   print(success, msg)
   ```

#### Issue: Student can't access course after approval
**Solution:**
1. Check enrollment:
   ```sql
   SELECT * FROM enrollments WHERE student_id=<student_id> AND course_id=1;
   ```
2. Check payment status:
   ```sql
   SELECT payment_verified, access_allowed FROM enrollments WHERE id=100;
   ```
3. For paid cohorts, verify payment:
   ```python
   from services.waitlist_service import WaitlistService
   WaitlistService.verify_enrollment_payment(
       enrollment_id=100,
       admin_id=1,
       status='completed',
       notes='Manual verification'
   )
   ```
4. Check cohort dates:
   ```sql
   SELECT cohort_start_date, cohort_end_date FROM enrollments WHERE id=100;
   ```

#### Issue: Duplicate enrollments created
**Solution:**
1. Prevent during approval:
   ```python
   existing = Enrollment.query.filter_by(
       student_id=user_id,
       course_id=course_id
   ).first()
   
   if existing:
       # Handle re-approval, don't create new
       return existing
   ```
2. Fix existing duplicates:
   ```sql
   -- Find duplicates
   SELECT student_id, course_id, COUNT(*) 
   FROM enrollments 
   GROUP BY student_id, course_id 
   HAVING COUNT(*) > 1;
   
   -- Keep newest, delete others
   DELETE FROM enrollments 
   WHERE id IN (
       SELECT id FROM (
           SELECT id, 
               ROW_NUMBER() OVER (PARTITION BY student_id, course_id ORDER BY id DESC) as rn
           FROM enrollments
       ) WHERE rn > 1
   );
   ```

#### Issue: Payment verification not granting access
**Solution:**
1. Check enrollment access logic:
   ```python
   success, reason = WaitlistService.is_enrollment_access_allowed(enrollment)
   print(f"Access: {success}, Reason: {reason}")
   ```
2. Verify cohort payment type:
   ```sql
   SELECT effective_enrollment_type FROM application_windows WHERE id=<window_id>;
   ```
3. Check both payment_verified AND payment_status:
   ```python
   # Both must be set correctly
   enrollment.payment_verified = True
   enrollment.payment_status = 'completed'
   db.session.commit()
   ```

#### Issue: Frontend not showing cohort selector
**Solution:**
1. Check if multiple windows loaded:
   ```typescript
   console.log('All windows:', allWindows);
   console.log('Windows count:', allWindows.length);
   ```
2. Verify window normalization:
   ```typescript
   import { normalizeApplicationWindows } from '@/utils/cohort-utils';
   const windows = normalizeApplicationWindows(course);
   console.log('Normalized:', windows);
   ```
3. Check API response:
   ```typescript
   const course = await CourseApiService.getCourseDetails(1);
   console.log('Application windows:', course.application_windows);
   ```

---

## SUMMARY

This comprehensive system enables:

✅ **Multiple cohorts per course** with independent dates, capacity, and payment models
✅ **Flexible application windows** - specify when students can apply
✅ **Waitlist management** - auto-migrate to next cohort when available
✅ **Payment flexibility** - free, paid, and scholarship cohorts
✅ **Access control** - payments verified before course access
✅ **Full migration tracking** - audit trail of all waitlist movements
✅ **Admin tools** - bulk operations, advanced filters, payment verification
✅ **Student-friendly** - clear status updates, auto-migrations, easy payment
✅ **API-driven** - all operations available via REST endpoints
✅ **Production-ready** - PostgreSQL support, error handling, email notifications

**Key Architecture Decisions:**
- ApplicationWindow is immutable per creation (tracks cohorts)
- CourseApplication snapshot fields prevent lost data on window deletion
- Migration resets status to 'pending' for re-review in new context
- Payment inheritance: NULL = inherit from course (flexible override)
- Access control: Two-factor check (payment_verified AND cohort_requires_payment)

