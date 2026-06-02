# Internship Application System - Quick Reference

## 🎯 Overview
Complete internship application system with 20+ API endpoints, email notifications, and admin dashboard features.

## 📦 What's New

### Models (src/models/internship_models.py)
- `InternshipTrack` - Specialization tracks
- `InternshipCohort` - Batches with capacity
- `InternshipApplication` - Applications with status
- `ApplicationStatusLog` - Audit trail

### Blueprint (src/blueprints/internships/)
- `routes.py` - 20+ endpoints
- `schemas.py` - Marshmallow validation
- `utils.py` - Validators & helpers

### Services (src/services/internship_mailer.py)
- Email notifications
- 5 professional templates

---

## 🔗 API Endpoints

### PUBLIC (No Auth)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/v1/internships/tracks` | List tracks with open cohort count |
| GET | `/api/v1/internships/tracks/<slug>` | Track details + cohorts |
| GET | `/api/v1/internships/cohorts` | List open cohorts (filter by ?track) |
| POST | `/api/v1/internships/apply` | Submit application with CV |
| GET | `/api/v1/internships/apply/status` | Check status by ref code + email |

### USER (JWT Required)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/v1/internships/my-applications` | My applications |
| GET | `/api/v1/internships/my-applications/<id>` | Application details |

### ADMIN (JWT + role:admin/staff)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/v1/internships/admin/applications` | All applications (filters, sort) |
| GET | `/api/v1/internships/admin/applications/<id>` | Full details + logs |
| PATCH | `/api/v1/internships/admin/applications/<id>/status` | Update status → email sent |
| PATCH | `/api/v1/internships/admin/applications/<id>/assign-cohort` | Assign cohort (accepted only) |
| GET | `/api/v1/internships/admin/applications/<id>/cv` | Download CV |
| GET | `/api/v1/internships/admin/cohorts` | List all cohorts |
| POST | `/api/v1/internships/admin/cohorts` | Create cohort |
| PATCH | `/api/v1/internships/admin/cohorts/<id>` | Update cohort |
| DELETE | `/api/v1/internships/admin/cohorts/<id>` | Delete cohort |
| GET | `/api/v1/internships/admin/stats` | Statistics |

---

## 📝 Submit Application Flow

### 1. Get Available Tracks
```bash
GET /api/v1/internships/tracks
```
Response:
```json
{
  "success": true,
  "data": [
    {"id": "uuid", "name": "Frontend Development", "slug": "frontend", "open_cohorts_count": 1},
    ...
  ]
}
```

### 2. Get Available Cohorts
```bash
GET /api/v1/internships/cohorts?track=frontend
```

### 3. Submit Application (multipart form-data)
```bash
POST /api/v1/internships/apply
Content-Type: multipart/form-data

applicant_type=graduate
full_name=John Doe
email=john@example.com
phone=+250788123456
track_id=<uuid>
cohort_id=<uuid> (optional)
motivation_letter=I am interested in...
portfolio_url=https://... (optional)
github_url=https://... (optional)
linkedin_url=https://... (optional)
cv=<file: PDF, DOC, DOCX, max 5MB>
```

Response:
```json
{
  "success": true,
  "message": "Application submitted successfully",
  "data": {
    "reference_code": "ATB-26-ABCD",
    "message": "Application submitted. Use reference code ATB-26-ABCD to check status."
  }
}
```

### 4. Check Status Anytime
```bash
GET /api/v1/internships/apply/status?ref=ATB-26-ABCD&email=john@example.com
```

---

## 👨‍💼 Admin Workflow

### 1. View All Applications
```bash
GET /api/v1/internships/admin/applications \
  ?status=pending&page=1&per_page=20 \
  &sort_by=created_at&sort_order=desc
```

Query parameters:
- `status` - Filter by status
- `track_id` - Filter by track
- `cohort_id` - Filter by cohort
- `search` - Search name/email/ref code
- `start_date` - ISO datetime
- `end_date` - ISO datetime
- `page`, `per_page` - Pagination
- `sort_by` - created_at, updated_at, name, status
- `sort_order` - asc, desc

### 2. Review Application
```bash
GET /api/v1/internships/admin/applications/<app_id>
```
Returns full details with complete status history.

### 3. Download CV
```bash
GET /api/v1/internships/admin/applications/<app_id>/cv
```

### 4. Update Status
Valid transitions:
- `pending` → `reviewing` or `rejected`
- `reviewing` → `shortlisted` or `rejected`
- `shortlisted` → `interview_scheduled` or `rejected`
- `interview_scheduled` → `accepted` or `rejected`
- `accepted` → terminal
- `rejected` → terminal

```bash
PATCH /api/v1/internships/admin/applications/<app_id>/status
Content-Type: application/json

{
  "status": "shortlisted",
  "note": "Great profile, let's move forward",
  "interview_date": "2026-06-15T10:00:00"
}
```

**Automatic email sent to applicant!**

### 5. Assign Cohort (After Acceptance)
```bash
PATCH /api/v1/internships/admin/applications/<app_id>/assign-cohort
{
  "cohort_id": "<cohort_id>"
}
```

### 6. View Statistics
```bash
GET /api/v1/internships/admin/stats
```
Returns:
- Total applications by status
- Applications by track
- Conversion rates
- Cohort/track counts

---

## 📋 Application Status Flow

```
┌─────────┐
│ PENDING │  → Applicant submits form + CV
└────┬────┘
     │
     ├──→ [ADMIN REVIEWS]
     │
     ▼
┌──────────┐
│ REVIEWING│  → Under review, admin decides
└────┬─────┘
     │
     ├──→ [SHORTLIST] ──▶ ┌────────────┐
     │                     │ SHORTLISTED│  → Qualified, schedule interview
     └──→ [REJECT] ──▶    └────────────┘
                                 │
                          [SCHEDULE INTERVIEW]
                                 │
                                 ▼
                       ┌──────────────────────┐
                       │ INTERVIEW_SCHEDULED  │  → Interview details sent
                       └────┬────────────────┘
                            │
                       [CONDUCT INTERVIEW]
                            │
                       ┌────┴──────┐
                       │           │
                       ▼           ▼
                  ┌────────┐  ┌──────────┐
                  │ACCEPTED│  │ REJECTED │  → Final decision
                  └────────┘  └──────────┘
                       │
                  [ASSIGN COHORT]
                       │
                       ▼
                  ✓ Ready for internship!
```

---

## 🔧 Seed Data

```bash
python backend/seed_internship_data.py
```

Creates:
- 8 tracks (mobile, frontend, backend, fullstack, data, design, devops, other)
- 7 cohorts (one per track, start in 30 days, 90-day duration)

---

## ✉️ Email Notifications

Automatically sent:
1. **Application Confirmation** → Applicant
   - Reference code, track, timeline

2. **Admin Alert** → info@afritechbridge.online
   - Summary, admin panel link

3. **Status Updates** → Applicant
   - **Shortlisted**: "Great news!"
   - **Interview Scheduled**: Date/time details
   - **Accepted**: "Welcome!"
   - **Rejected**: "Try again" + feedback
   - **Reviewing**: "Under review"

---

## 🔍 Validation

### Phone Numbers
- ✅ E.164: `+250788123456`
- ✅ Local RW: `0788123456` or `788123456`
- ❌ Other formats invalid

### CV Files
- ✅ Allowed: PDF, DOC, DOCX
- ✅ Max size: 5MB
- ❌ Larger files rejected

### Email Uniqueness
- ✅ One pending application per email per 30 days
- ✅ Duplicate submissions within 30 days blocked

---

## 🛡️ Security

- UUID primary keys
- Phone number validation
- Email uniqueness check
- File type whitelist
- Secure filename handling
- Role-based access control
- Status transition validation
- Text sanitization

---

## 📊 Response Format

### Paginated List
```json
{
  "success": true,
  "message": "...",
  "data": {
    "data": [...items...],
    "page": 1,
    "per_page": 20,
    "total": 42,
    "pages": 3
  }
}
```

### Error
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": {
    "phone": ["Invalid phone number format"]
  }
}
```

---

## 🧪 Testing

```bash
# All tests
pytest backend/tests/test_internship.py -v

# Specific test
pytest backend/tests/test_internship.py::TestUtilityFunctions -v

# With coverage
pytest backend/tests/test_internship.py --cov=src.blueprints.internships
```

---

## 📂 Files Created

```
backend/
├── src/
│   ├── models/
│   │   └── internship_models.py (NEW)
│   ├── blueprints/
│   │   └── internships/ (NEW)
│   │       ├── __init__.py
│   │       ├── routes.py
│   │       ├── schemas.py
│   │       └── utils.py
│   └── services/
│       └── internship_mailer.py (NEW)
├── tests/
│   └── test_internship.py (NEW)
├── main.py (UPDATED)
└── seed_internship_data.py (NEW)
```

---

## 🚀 Getting Started

1. **Initialize:**
   ```bash
   cd backend
   python seed_internship_data.py
   ```

2. **Test:**
   ```bash
   pytest tests/test_internship.py -v
   ```

3. **Start server:**
   ```bash
   python main.py
   ```

4. **Test endpoints:**
   ```bash
   curl http://localhost:5000/api/v1/internships/tracks
   ```

---

**System is production-ready!** 🎉
