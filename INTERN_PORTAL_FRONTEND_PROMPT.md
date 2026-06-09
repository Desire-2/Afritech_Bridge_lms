# AfriTech Bridge Intern Portal — Frontend Development Prompt

## Overview

Build a **standalone, professional intern-facing Next.js frontend** served at `/intern` that covers the entire intern lifecycle — from onboarding to completing tasks, tracking grades, and managing their profile. This portal is separate from the admin/instructor UIs and serves as the primary workspace for accepted interns.

The backend base URL is: **`https://study.afritechbridge.online/api/v1/internships`** (or configured via environment variable `NEXT_PUBLIC_API_URL`)

---

## Authentication

The portal uses **JWT-based authentication** via the existing `AuthContext` system. The login endpoint is:

```
POST /api/v1/auth/login
Body: { email, password }
Response: { access_token, refresh_token, user }
```

Interns log in with the **username and password** they received in their offer letter email. All intern-facing API endpoints require a valid JWT token in the `Authorization: Bearer <token>` header.

**Important**: After first login, the API response includes `must_change_password: true`. The portal should redirect to a "Change Password" page if this flag is set.

---

## Pages & Routes

### 1. Welcome / Landing Page (`/intern`)
- Hero section with AfriTech Bridge branding
- **Track Application Status** — A prominent form with two fields:
  - Reference Code (text input)
  - Email (email input)
- Calls `GET /api/v1/internships/apply/status?ref=XXX&email=YYY` (public, no auth needed)
- Shows application status in a beautiful card with timeline/progress indicator
- "Already Accepted? Log In" button linking to `/auth/login?redirect=/intern/dashboard`

### 2. Login Page (`/auth/login`)
- Share the existing login page if it exists, OR create a dedicated intern login
- Username/email + password form
- "Forgot Password" link → `/auth/forgot-password`
- On success: redirect to `/intern/dashboard`

### 3. Forgot Password (`/auth/forgot-password`)
- Email input → sends reset link to email

### 4. Change Password (`/intern/change-password` on first login)
- Current password + new password + confirm password
- Calls `PUT /api/v1/internships/intern/change-password`
- On success: redirect to `/intern/dashboard`

### 5. Dashboard (`/intern/dashboard`)
**Endpoint**: `GET /api/v1/internships/intern/dashboard`
- **Welcome card** with intern name, track, cohort
- **Program stats card**: cohort name, start/end dates, status
- **Task Progress card**: 
  - Ring/circular progress chart showing % completed
  - Stats: Total, Completed, In Progress, Pending, Submitted
  - Average score if any tasks graded
- **Upcoming Deadlines card**: 
  - List of next 5 tasks sorted by due date (closest first)
  - Each shows: title, priority badge (color-coded), due date, status
  - Click to navigate to task detail
- **Offer Letter card**: offer number, status, sent date

### 6. My Tasks (`/intern/tasks`)
**Endpoint**: `GET /api/v1/internships/intern/tasks?status=&task_type=&sort_by=&sort_order=`
- **Filters bar**:
  - Status filter: All, Pending, In Progress, Submitted, Approved, Rejected
  - Task type filter: dropdown of types
  - Sort: by due date, priority, created_at
- **Task cards/list**:
  - Title, type icon, priority badge (Low=green, Medium=amber, High=red, Urgent=dark red)
  - Due date with overdue indicator
  - Status badge with color coding
  - Score if graded
  - Click to view detail
- **Empty state** when no tasks

### 7. Task Detail (`/intern/tasks/[assignment_id]`)
**Endpoint**: `GET /api/v1/internships/intern/tasks/<assignment_id>`
- **Task header**: title, type, priority, cohort, track
- **Description**: full markdown-rendered description
- **Due date**: with countdown or overdue indicator
- **Status timeline**: Pending → In Progress → Submitted → Approved/Rejected
- **Submission section** (if not yet approved/rejected):
  - Rich text editor for submission text
  - File upload (PDF, DOC, images)
  - Submit button
  - Calls `POST /api/v1/internships/intern/tasks/<assignment_id>/submit`
- **Feedback section** (if graded):
  - Score display with max score and percentage
  - Instructor feedback text
  - Status: ✅ Approved or ❌ Rejected

### 8. My Grades (`/intern/grades`)
**Endpoint**: `GET /api/v1/internships/intern/grades`
- **Summary card** at top:
  - Total graded, approved count, rejected count
  - Overall score percentage (with a progress bar)
  - Pending review count
- **Graded tasks table/list**:
  - Task title, type, score/max, percentage, feedback snippet
  - Status badge (Approved/Rejected)
  - Click to view full task detail
- **Pending review section**:
  - Tasks awaiting grading with submitted date
  - Subtle styling to differentiate from graded

### 9. My Cohort (`/intern/cohort`)
**Endpoint**: `GET /api/v1/internships/intern/cohort`
- **Cohort info card**: name, code, description, dates, capacity
- **Track info card**: name, description, icon
- **Fellow Interns grid**: avatars, names, reference codes

### 10. My Offer Letter (`/intern/offer`)
**Endpoint**: `GET /api/v1/internships/intern/offer`
- **Offer details card**: offer number, status, issued date
- **Verification badge**: authentic/verified with green checkmark
- **Share buttons**: LinkedIn, Twitter, Facebook, WhatsApp (use the `share_url` from API)
- **Actions**: Download PDF (PDF endpoint available at admin level — for interns, show verification URL)

### 11. Profile & Settings (`/intern/profile`)
**Endpoint**: `GET /api/v1/internships/intern/profile`
**Update endpoint**: `PUT /api/v1/internships/intern/profile`
- **Profile form**:
  - Read fields: Full name, email, reference code, username
  - Editable fields: Phone, Portfolio URL, GitHub URL, LinkedIn URL
  - User account: First name, Last name (editable)
- **Account info section**: username (readonly), must_change_password flag
- **Change Password section** at bottom:
  - Link/button to go to `/intern/change-password`

---

## Layout & Navigation

The portal should use a **modern, professional sidebar layout** similar to **Notion**, **Linear**, or **Vercel Dashboard**:

```
┌─────────────────────────────────────────────┐
│  Sidebar (collapsible)    │  Main Content   │
│                           │                  │
│  ┌─────────────────────┐  │                  │
│  │  Avatar + Name      │  │  [Page Content]  │
│  ├─────────────────────┤  │                  │
│  │  📊 Dashboard       │  │                  │
│  │  📋 My Tasks  (n)   │  │                  │
│  │  📈 My Grades       │  │                  │
│  │  👥 My Cohort       │  │                  │
│  │  📄 My Offer        │  │                  │
│  │  ⚙️ Profile         │  │                  │
│  ├─────────────────────┤  │                  │
│  │  🚪 Logout          │  │                  │
│  └─────────────────────┘  │                  │
└─────────────────────────────┴──────────────────┘
```

- **Sidebar**:
  - Collapsible (hamburger icon on mobile)
  - Shows intern avatar (initials) + full name + cohort badge
  - Nav items with active state highlighting
  - Badge count for "My Tasks" showing number of pending/in-progress tasks
  - Logout button at bottom
- **Top bar** (optional): breadcrumbs, notification bell
- **Responsive**: mobile-friendly with bottom nav or hamburger menu

---

## Design & Branding

- **Colors**: Match the AfriTech Bridge brand (deep navy `#0f172a`, teal `#14b8a6`, orange `#f97316`)
- **Gradients**: Use the same gradient patterns as the email templates (dark navy backgrounds, teal accents)
- **Components**: Reuse existing `ui/*` components (Button, Card, Badge, Input, Dialog, Progress, etc.)
- **Typography**: Clean, modern with proper hierarchy
- **Animations**: Subtle transitions, loading skeletons, micro-interactions
- **Dark/Light mode**: The existing app uses dark mode — maintain consistency

---

## API Endpoints Summary

All endpoints are under `https://study.afritechbridge.online/api/v1/internships`:

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/apply/status?ref=&email=` | No | Check application status (public) |
| GET | `/intern/dashboard` | JWT | Dashboard overview |
| GET | `/intern/profile` | JWT | Get profile |
| PUT | `/intern/profile` | JWT | Update profile |
| GET | `/intern/cohort` | JWT | Cohort & fellow interns |
| GET | `/intern/offer` | JWT | Offer letter details |
| GET | `/intern/tasks` | JWT | List tasks (filterable) |
| GET | `/intern/tasks/<assignment_id>` | JWT | Task detail |
| POST | `/intern/tasks/<assignment_id>/submit` | JWT | Submit task work |
| GET | `/intern/grades` | JWT | Grades & feedback |
| PUT | `/intern/change-password` | JWT | Change password |

---

## Component Architecture

Create these page components inside `frontend/src/app/intern/`:

```
app/intern/
├── page.tsx                    # Welcome/landing page
├── layout.tsx                  # Dashboard layout with sidebar
├── dashboard/
│   └── page.tsx                # Dashboard overview
├── tasks/
│   ├── page.tsx                # Task list
│   └── [assignment_id]/
│       └── page.tsx            # Task detail + submission
├── grades/
│   └── page.tsx                # Grades overview
├── cohort/
│   └── page.tsx                # Cohort info
├── offer/
│   └── page.tsx                # Offer letter
├── profile/
│   └── page.tsx                # Profile & settings
└── change-password/
    └── page.tsx                # Change password
```

---

## Guards & Middleware

- Create an `InternGuard` component that checks the user has `role = 'intern'` (or has an accepted application)
- Redirect unauthenticated users to `/auth/login?redirect=/intern/dashboard`
- Redirect non-intern users to their appropriate dashboard
- Use the existing `AuthContext` or `EnhancedAuthContext` for auth state

---

## Implementation Priority

1. Welcome page with application tracking
2. Login flow (reuse existing)
3. Dashboard page (most important — shows all key data)
4. Task list + detail + submission (core functionality)
5. Grades page
6. Cohort page
7. Offer letter page
8. Profile & settings
9. Change password flow

---

## Example API Response

### Dashboard (`GET /intern/dashboard`)
```json
{
  "success": true,
  "data": {
    "intern": {
      "full_name": "John Doe",
      "email": "john@example.com",
      "phone": "+250788123456",
      "reference_code": "ATB-26-A3F2",
      "username": "john.doe.a1b2c3"
    },
    "program": {
      "track": "Software Engineering",
      "cohort": "Cohort 3 - 2026",
      "cohort_start": "2026-07-01T00:00:00",
      "cohort_end": "2026-12-31T00:00:00",
      "status": "accepted"
    },
    "tasks": {
      "total_assigned": 8,
      "completed": 3,
      "submitted": 1,
      "in_progress": 2,
      "pending": 2,
      "progress_pct": 38,
      "avg_score": 85.5
    },
    "upcoming_deadlines": [
      {
        "assignment_id": "...",
        "task_id": "...",
        "title": "Build a REST API",
        "task_type": "code",
        "priority": "high",
        "due_date": "2026-07-15T23:59:59",
        "status": "pending"
      }
    ],
    "offer": {
      "id": "...",
      "offer_number": "OFR-2026-0001",
      "status": "sent",
      "sent_at": "2026-06-10T10:30:00"
    }
  }
}
```
