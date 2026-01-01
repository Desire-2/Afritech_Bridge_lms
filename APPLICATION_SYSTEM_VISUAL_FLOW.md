# Application System - Visual Workflow

## 🎯 Complete System Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                     APPLICATION SUBMISSION FLOW                      │
└─────────────────────────────────────────────────────────────────────┘

User visits /courses/:id
        │
        ├─ Not Enrolled ──→ Shows "Apply Now" button
        │                          │
        │                          ↓
        │                  Opens Application Form
        │                          │
        │                          ├─ User fills form
        │                          ├─ Enters email ──→ onBlur: Check duplicate
        │                          │                          │
        │                          │                          ├─ Exists ──→ Show warning
        │                          │                          └─ OK ──→ Continue
        │                          │
        │                          ├─ Completes all sections
        │                          └─ Submits form
        │                                     │
        │                                     ↓
        │                          Backend validates & scores
        │                                     │
        │                                     ├─ Duplicate? ──→ Return 409
        │                                     └─ OK ──→ Create application
        │                                                  │
        │                                                  ↓
        │                                        Status: "pending"
        │
        └─ Already Enrolled ──→ Shows course content


┌─────────────────────────────────────────────────────────────────────┐
│                     ADMIN APPROVAL FLOW (NEW USER)                   │
└─────────────────────────────────────────────────────────────────────┘

Admin views application list
        │
        ├─ Click "Approve" on John Doe's application
        │
        ↓
POST /api/v1/applications/123/approve
        │
        ├─ Check if user exists with email
        │      │
        │      └─ Query: SELECT * FROM users WHERE email = 'john@example.com'
        │             │
        │             └─ Result: NOT FOUND
        │
        ├─ CREATE NEW USER:
        │      │
        │      ├─ Generate username: "john_doe_123"
        │      ├─ Generate password: "xK9$mP2@vN4b"
        │      ├─ Set must_change_password = TRUE
        │      │
        │      └─ INSERT INTO users (
        │            username, email, password_hash, 
        │            must_change_password, role_id, ...
        │          )
        │
        ├─ CREATE ENROLLMENT:
        │      │
        │      └─ INSERT INTO enrollments (
        │            student_id, course_id, enrollment_date
        │          )
        │
        ├─ INITIALIZE PROGRESS:
        │      │
        │      └─ FOR EACH module IN course.modules:
        │             INSERT INTO module_progress (
        │               student_id, module_id, enrollment_id
        │             )
        │
        ├─ UPDATE APPLICATION:
        │      │
        │      └─ UPDATE course_applications SET
        │            status = 'approved',
        │            reviewed_at = NOW()
        │
        └─ SEND EMAIL:
               │
               ├─ To: john@example.com
               ├─ Subject: "✅ Application Approved"
               └─ Body:
                     🔐 YOUR CREDENTIALS:
                     Username: john_doe_123
                     Password: xK9$mP2@vN4b
                     
                     ⚠️ MUST CHANGE PASSWORD ON FIRST LOGIN
                     
                     Login: http://localhost:3000/auth/login


┌─────────────────────────────────────────────────────────────────────┐
│                  ADMIN APPROVAL FLOW (EXISTING USER)                 │
└─────────────────────────────────────────────────────────────────────┘

Admin views application list
        │
        ├─ Click "Approve" on Jane Smith's application
        │
        ↓
POST /api/v1/applications/456/approve
        │
        ├─ Check if user exists with email
        │      │
        │      └─ Query: SELECT * FROM users WHERE email = 'jane@example.com'
        │             │
        │             └─ Result: FOUND (User ID: 42)
        │
        ├─ SKIP USER CREATION (already exists)
        │
        ├─ CHECK EXISTING ENROLLMENT:
        │      │
        │      └─ Query: SELECT * FROM enrollments 
        │                WHERE student_id = 42 AND course_id = 5
        │             │
        │             ├─ EXISTS ──→ Return 409 error
        │             └─ NOT FOUND ──→ Continue
        │
        ├─ CREATE ENROLLMENT:
        │      │
        │      └─ INSERT INTO enrollments (
        │            student_id = 42, course_id = 5
        │          )
        │
        ├─ INITIALIZE PROGRESS:
        │      │
        │      └─ FOR EACH module IN course.modules:
        │             INSERT INTO module_progress (...)
        │
        ├─ UPDATE APPLICATION:
        │      │
        │      └─ UPDATE course_applications SET status = 'approved'
        │
        └─ SEND EMAIL:
               │
               ├─ To: jane@example.com
               ├─ Subject: "✅ Application Approved"
               └─ Body:
                     📚 COURSE ENROLLED: Excel Mastery
                     
                     🔐 ACCESS:
                     Login with your existing credentials
                     Course: http://localhost:3000/courses/5


┌─────────────────────────────────────────────────────────────────────┐
│                      FIRST LOGIN FLOW (NEW USER)                     │
└─────────────────────────────────────────────────────────────────────┘

User visits /auth/login
        │
        ├─ Enters: username = "john_doe_123"
        ├─ Enters: password = "xK9$mP2@vN4b"
        └─ Clicks "Login"
               │
               ↓
POST /api/v1/auth/login
        │
        ├─ Validate credentials
        │      │
        │      └─ Query: SELECT * FROM users 
        │                WHERE username = 'john_doe_123'
        │             │
        │             ├─ Check password ──→ ✓ Valid
        │             └─ Check must_change_password ──→ TRUE
        │
        ├─ Generate tokens:
        │      ├─ access_token (1 hour)
        │      └─ refresh_token (30 days)
        │
        └─ Return response:
               {
                 "message": "Login successful. Please change your password.",
                 "access_token": "eyJ...",
                 "refresh_token": "eyJ...",
                 "must_change_password": true,  ← FLAG
                 "user": { ... }
               }

Frontend receives response
        │
        ├─ Stores tokens in localStorage
        ├─ Sets user in AuthContext
        │
        └─ Checks must_change_password === true
               │
               └─ Opens ChangePasswordModal
                      │
                      ├─ Modal CANNOT be dismissed
                      ├─ User must enter:
                      │     ├─ Current: xK9$mP2@vN4b
                      │     └─ New: MySecurePass123!
                      │
                      └─ Submits form
                             │
                             ↓
               POST /api/v1/auth/change-password
                      {
                        "current_password": "xK9$mP2@vN4b",
                        "new_password": "MySecurePass123!"
                      }
                             │
                             ├─ Verify current password ✓
                             ├─ Hash new password
                             ├─ UPDATE users SET 
                             │     password_hash = new_hash,
                             │     must_change_password = FALSE
                             │
                             └─ Return: { "message": "Success" }
                                    │
                                    └─ Frontend refreshes page
                                           │
                                           └─ User now has full access


┌─────────────────────────────────────────────────────────────────────┐
│                      DUPLICATE PREVENTION FLOW                       │
└─────────────────────────────────────────────────────────────────────┘

User starts application form
        │
        ├─ Enters email: "john@example.com"
        └─ Focus leaves email field (onBlur)
               │
               ↓
GET /api/v1/applications/check-duplicate
    ?course_id=5&email=john@example.com
               │
               ├─ Query: SELECT COUNT(*) FROM course_applications
               │         WHERE course_id = 5 AND email = 'john@example.com'
               │
               ├─ Count = 0 ──→ Return: { "exists": false }
               │                    │
               │                    └─ No warning shown
               │
               └─ Count > 0 ──→ Return: { 
                                  "exists": true,
                                  "application": {
                                    "id": 123,
                                    "status": "pending"
                                  }
                                }
                                    │
                                    └─ Show warning banner:
                                        "⚠️ You already have a pending 
                                         application for this course"


User tries to submit anyway
        │
        ↓
POST /api/v1/applications
        │
        ├─ Backend duplicate check
        │      │
        │      └─ Query: SELECT COUNT(*) ...
        │             │
        │             └─ Count > 0
        │
        └─ Return 409 Conflict:
               {
                 "error": "You have already applied for this course",
                 "existing_application_id": 123
               }


┌─────────────────────────────────────────────────────────────────────┐
│                    MULTI-COURSE APPLICATION FLOW                     │
└─────────────────────────────────────────────────────────────────────┘

User: john@example.com
        │
        ├─ Applies to Course A (Excel) ──→ ✓ Created (ID: 1)
        │      │
        │      └─ Query: INSERT INTO course_applications
        │                (course_id = 5, email = 'john@example.com')
        │
        ├─ Applies to Course B (Python) ──→ ✓ Created (ID: 2)
        │      │
        │      └─ Query: INSERT INTO course_applications
        │                (course_id = 8, email = 'john@example.com')
        │
        ├─ Tries Course A again ──→ ✗ Rejected (409)
        │      │
        │      └─ Duplicate check finds existing application
        │
        └─ Applies to Course C (SQL) ──→ ✓ Created (ID: 3)


Admin approves all 3 applications
        │
        ├─ Approve App #1 (Course A):
        │      ├─ User doesn't exist → Create user
        │      ├─ Create enrollment (course_id = 5)
        │      └─ Send email with credentials
        │
        ├─ Approve App #2 (Course B):
        │      ├─ User EXISTS → Skip user creation
        │      ├─ Create enrollment (course_id = 8)
        │      └─ Send email (use existing credentials)
        │
        └─ Approve App #3 (Course C):
               ├─ User EXISTS → Skip user creation
               ├─ Create enrollment (course_id = 12)
               └─ Send email (use existing credentials)


Result:
    ┌─────────────────────────────────────────┐
    │ User: john_doe_123                      │
    ├─────────────────────────────────────────┤
    │ Enrollments:                            │
    │   ├─ Course A (Excel Mastery)          │
    │   ├─ Course B (Python Basics)          │
    │   └─ Course C (SQL Fundamentals)       │
    ├─────────────────────────────────────────┤
    │ Applications:                           │
    │   ├─ App #1: approved                   │
    │   ├─ App #2: approved                   │
    │   └─ App #3: approved                   │
    └─────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────┐
│                     GET USER STATS ENDPOINT                          │
└─────────────────────────────────────────────────────────────────────┘

GET /api/v1/applications/user-stats/john@example.com
        │
        ├─ Query: SELECT * FROM course_applications
        │         WHERE email = 'john@example.com'
        │
        └─ Return:
               {
                 "email": "john@example.com",
                 "total_applications": 3,
                 "statistics": {
                   "total": 3,
                   "pending": 0,
                   "approved": 3,
                   "rejected": 0,
                   "waitlisted": 0
                 },
                 "applications": [
                   {
                     "id": 1,
                     "course_id": 5,
                     "course_title": "Excel Mastery",
                     "status": "approved",
                     "can_reapply": false
                   },
                   {
                     "id": 2,
                     "course_id": 8,
                     "course_title": "Python Basics",
                     "status": "approved",
                     "can_reapply": false
                   },
                   {
                     "id": 3,
                     "course_id": 12,
                     "course_title": "SQL Fundamentals",
                     "status": "approved",
                     "can_reapply": false
                   }
                 ],
                 "course_ids_applied": [5, 8, 12]
               }


┌─────────────────────────────────────────────────────────────────────┐
│                        PASSWORD CHANGE UI FLOW                       │
└─────────────────────────────────────────────────────────────────────┘

User logs in with temp password
        │
        └─ must_change_password = true
               │
               ↓
<ChangePasswordModal> opens
        │
        ├─ Props: required={true}
        ├─ Cannot be dismissed (no close button if required)
        │
        ├─ Form fields:
        │      ├─ Current Password [show/hide toggle]
        │      ├─ New Password [show/hide toggle]
        │      │     └─ Password strength indicator:
        │      │         ├─ Weak (< 6 chars): Red bar 33%
        │      │         ├─ Medium (< 8 chars): Yellow bar 66%
        │      │         └─ Strong (8+ w/ uppercase, lowercase, numbers): Green 100%
        │      │
        │      └─ Confirm Password [hidden]
        │             └─ Live validation: "Passwords do not match"
        │
        ├─ Validation:
        │      ├─ Current password required
        │      ├─ New password min 6 chars
        │      ├─ New != Current
        │      └─ New == Confirm
        │
        ├─ User clicks "Change Password"
        │      │
        │      └─ POST /api/v1/auth/change-password
        │             │
        │             ├─ Success ✓
        │             │     ├─ Show success alert
        │             │     ├─ Update AuthContext (must_change_password = false)
        │             │     └─ Refresh page in 2 seconds
        │             │
        │             └─ Error ✗
        │                   └─ Show error alert (e.g., "Current password incorrect")
        │
        └─ After refresh:
               └─ User has full access to dashboard


┌─────────────────────────────────────────────────────────────────────┐
│                         EMAIL TEMPLATES                              │
└─────────────────────────────────────────────────────────────────────┘

NEW USER EMAIL:
┌─────────────────────────────────────────┐
│ Subject: ✅ Application Approved        │
├─────────────────────────────────────────┤
│ Dear John Doe,                          │
│                                         │
│ 🎉 Your application has been APPROVED! │
│                                         │
│ 📚 COURSE: Excel Mastery                │
│                                         │
│ 🔐 YOUR CREDENTIALS:                    │
│   Username: john_doe_123                │
│   Password: xK9$mP2@vN4b                │
│   Login: http://localhost:3000/login    │
│                                         │
│ ⚠️ SECURITY NOTICE:                     │
│ You MUST change your password on        │
│ first login. This is required.          │
│                                         │
│ 🚀 GETTING STARTED:                     │
│ 1. Log in with credentials above        │
│ 2. Change your temporary password       │
│ 3. Start learning!                      │
└─────────────────────────────────────────┘

EXISTING USER EMAIL:
┌─────────────────────────────────────────┐
│ Subject: ✅ Application Approved        │
├─────────────────────────────────────────┤
│ Dear Jane Smith,                        │
│                                         │
│ 🎉 Your application has been APPROVED! │
│                                         │
│ 📚 COURSE: Python Basics                │
│                                         │
│ 🔐 ACCESS:                              │
│   Login with your existing credentials  │
│   Course: http://localhost:3000/...    │
│                                         │
│ 💡 You can access this course           │
│    immediately from your dashboard.     │
│                                         │
│ Happy learning!                         │
└─────────────────────────────────────────┘
```

---

*Last Updated: January 1, 2026*
*Visual Workflow Guide - Version 2.0*
