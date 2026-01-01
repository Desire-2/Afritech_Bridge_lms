# Course Application System - Complete Guide

## Overview

The Afritec Bridge LMS Course Application System is a comprehensive platform for managing student applications with intelligent scoring, ranking, and automated workflows.

## Key Features

### 🎯 6-Section Application Form

1. **Applicant Information** - Personal details, demographics
2. **Education & Background** - Academic and professional profile
3. **Excel & Computer Skills** - Skill assessment
4. **Learning Goals** - Motivation and objectives
5. **Access & Availability** - Technical resources and time commitment
6. **Commitment & Agreement** - Dedication indicators

### 📊 Multi-Dimensional Scoring

- **Application Score** (0-100): Overall application quality
- **Readiness Score** (0-100): Technical and academic preparedness
- **Commitment Score** (0-100): Dedication and motivation level
- **Risk Score** (0-100): Potential barriers to completion (lower is better)
- **Final Rank Score**: Weighted combination for ranking applicants

### ✨ Advanced Features

- Intelligent duplicate detection
- Automated email notifications
- Comprehensive Excel export with statistics
- Admin notes and rejection reasons
- Waitlist management
- Score recalculation
- Application statistics dashboard

---

## API Endpoints

### Public Endpoints

#### Submit Application
```http
POST /api/v1/applications
Content-Type: application/json
```

**Request Body:**
```json
{
  "course_id": 1,
  
  // Section 1: Applicant Information
  "full_name": "John Doe",
  "email": "john.doe@example.com",
  "phone": "+234-801-234-5678",
  "whatsapp_number": "+234-801-234-5678",
  "gender": "male",
  "age_range": "25_34",
  "country": "Nigeria",
  "city": "Lagos",
  
  // Section 2: Education & Background
  "education_level": "bachelors",
  "current_status": "employed",
  "field_of_study": "Computer Science",
  
  // Section 3: Excel Skills
  "has_used_excel": true,
  "excel_skill_level": "intermediate",
  "excel_tasks_done": ["basic_formulas", "pivot_tables", "charts"],
  
  // Section 4: Learning Goals
  "motivation": "I want to improve my data analysis skills...",
  "learning_outcomes": "Get certified and advance in my career...",
  "career_impact": "Excel skills will help me automate reporting...",
  
  // Section 5: Access & Availability
  "has_computer": true,
  "internet_access_type": "stable_broadband",
  "preferred_learning_mode": "hybrid",
  "available_time": ["evening", "weekend"],
  
  // Section 6: Commitment
  "committed_to_complete": true,
  "agrees_to_assessments": true,
  "referral_source": "Facebook Ad"
}
```

**Success Response (201):**
```json
{
  "message": "Application submitted successfully",
  "application_id": 123,
  "status": "pending",
  "scores": {
    "application_score": 85,
    "readiness_score": 78,
    "commitment_score": 92,
    "risk_score": 15
  }
}
```

### Admin/Instructor Endpoints (Requires JWT)

#### List Applications
```http
GET /api/v1/applications?course_id=1&status=pending&sort_by=final_rank_score&order=desc&page=1&per_page=50
Authorization: Bearer <token>
```

**Query Parameters:**
- `course_id` (optional): Filter by course
- `status` (optional): pending | approved | rejected | waitlisted
- `sort_by` (optional): final_rank_score | application_score | readiness_score | created_at
- `order` (optional): asc | desc
- `page` (optional): Page number (default: 1)
- `per_page` (optional): Items per page (default: 50)

**Response (200):**
```json
{
  "applications": [...],
  "total": 150,
  "pages": 3,
  "current_page": 1,
  "per_page": 50
}
```

#### Get Single Application
```http
GET /api/v1/applications/123
Authorization: Bearer <token>
```

#### Approve Application
```http
POST /api/v1/applications/123/approve
Authorization: Bearer <token>
Content-Type: application/json

{
  "send_email": true
}
```

**Response (200):**
```json
{
  "message": "Application approved successfully",
  "user_id": 456,
  "username": "john.doe",
  "enrollment_id": 789,
  "credentials_sent": true
}
```

#### Reject Application
```http
POST /api/v1/applications/123/reject
Authorization: Bearer <token>
Content-Type: application/json

{
  "reason": "Does not meet minimum requirements",
  "admin_notes": "Consider reapplying after gaining more experience",
  "send_email": true
}
```

#### Waitlist Application
```http
POST /api/v1/applications/123/waitlist
Authorization: Bearer <token>
Content-Type: application/json

{
  "admin_notes": "Strong candidate - waiting for next cohort"
}
```

#### Update Notes
```http
PUT /api/v1/applications/123/notes
Authorization: Bearer <token>
Content-Type: application/json

{
  "admin_notes": "Followed up via phone - very motivated"
}
```

#### Recalculate Scores
```http
POST /api/v1/applications/123/recalculate
Authorization: Bearer <token>
```

#### Get Statistics
```http
GET /api/v1/applications/statistics?course_id=1
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "total_applications": 150,
  "status_breakdown": {
    "pending": 45,
    "approved": 80,
    "rejected": 20,
    "waitlisted": 5
  },
  "high_risk_count": 12,
  "average_scores": {
    "application_score": 76.5,
    "readiness_score": 68.3,
    "commitment_score": 82.1,
    "risk_score": 28.4
  }
}
```

#### Export to Excel
```http
GET /api/v1/applications/export?course_id=1&status=pending
Authorization: Bearer <token>
```

Downloads Excel file with two sheets:
- **Applications**: Detailed application data
- **Statistics**: Summary statistics

---

## Scoring System Details

### Risk Score (0-100, lower is better)

| Factor | Points |
|--------|--------|
| No computer | 30 |
| No internet | 25 |
| Limited internet | 15 |
| Public WiFi | 10 |
| Mobile data | 5 |
| Never used Excel | 20 |
| Beginner Excel | 10 |
| No online learning experience | 15 |
| Not committed | 5 |
| Won't do assessments | 5 |

**Risk Categories:**
- Low Risk: 0-25
- Medium Risk: 26-49
- **High Risk: 50+**

### Readiness Score (0-100, higher is better)

| Factor | Points |
|--------|--------|
| Has computer | 15 |
| Has internet | 10 |
| Stable broadband | 5 |
| Excel Expert | 30 |
| Excel Advanced | 25 |
| Excel Intermediate | 18 |
| Excel Beginner | 10 |
| Excel tasks (2 pts each) | up to 10 |
| PhD | 20 |
| Masters | 18 |
| Bachelors | 15 |
| Diploma | 12 |
| High School | 8 |
| Online learning experience | 10 |
| Employed/Self-employed | 10 |
| Student | 7 |

### Commitment Score (0-100, higher is better)

| Factor | Points |
|--------|--------|
| Committed to complete | 10 |
| Agrees to assessments | 10 |
| Motivation 500+ chars | 30 |
| Motivation 300+ chars | 25 |
| Motivation 150+ chars | 18 |
| Motivation 50+ chars | 10 |
| Learning outcomes 200+ | 20 |
| Learning outcomes 100+ | 15 |
| Learning outcomes 50+ | 10 |
| Career impact 200+ | 20 |
| Career impact 100+ | 15 |
| Career impact 50+ | 10 |
| Multiple time slots | 10 |
| Single time slot | 5 |

### Application Score (0-100, higher is better)

Combines technical readiness, skills, education, and commitment into a single score.

### Final Rank Score

Weighted formula:
```
Final Score = (Application Score × 0.4) + 
              (Readiness Score × 0.3) + 
              (Commitment Score × 0.2) - 
              (Risk Score × 0.1) +
              (African Country Bonus: +5)
```

---

## Field Reference

### Enums

**gender:**
- male
- female
- other
- prefer_not_to_say

**age_range:**
- under_18
- 18_24
- 25_34
- 35_44
- 45_54
- 55_plus

**education_level:**
- high_school
- diploma
- bachelors
- masters
- phd
- other

**current_status:**
- student
- employed
- self_employed
- unemployed
- freelancer
- other

**excel_skill_level:**
- never_used
- beginner
- intermediate
- advanced
- expert

**internet_access_type:**
- stable_broadband
- mobile_data
- limited_access
- public_wifi
- other

**preferred_learning_mode:**
- self_paced
- live_sessions
- hybrid

**application_status:**
- pending
- approved
- rejected
- waitlisted

### Excel Tasks (Array)

Common values for `excel_tasks_done`:
- basic_formulas
- sum_average_count
- vlookup_hlookup
- pivot_tables
- charts_graphs
- conditional_formatting
- data_validation
- macros_vba
- power_query
- dashboard_creation

### Available Time Slots (Array)

Common values for `available_time`:
- morning
- afternoon
- evening
- weekend
- weekday_morning
- weekday_afternoon
- weekday_evening
- any_time

---

## Database Migration

Run the migration script to update your database:

```bash
cd backend
python migrate_course_applications.py
```

This will:
1. Add all new columns to `course_applications` table
2. Migrate existing data
3. Add performance indexes
4. Preserve backward compatibility

---

## Email Notifications

The system automatically sends emails for:

1. **Application Received** (to applicant)
   - Confirmation with application ID
   - Expected review timeline

2. **Application Approved** (to applicant)
   - Welcome message
   - Login credentials
   - Password change instructions

3. **Application Rejected** (optional, to applicant)
   - Polite rejection message
   - Reason (if provided)
   - Encouragement to reapply

Emails require proper configuration of Flask-Mail settings.

---

## Best Practices

### For Applicants

1. **Be Honest**: Accurate skill assessment helps with proper placement
2. **Be Detailed**: Longer, thoughtful responses score better
3. **Show Commitment**: Demonstrate your dedication
4. **Check Requirements**: Ensure you have necessary resources

### For Admins

1. **Review Regularly**: Check pending applications frequently
2. **Use Scores Wisely**: Scores are guides, not absolute rules
3. **Add Notes**: Document your decision-making
4. **Communicate**: Send emails when approving/rejecting
5. **Monitor Statistics**: Use dashboard to track trends
6. **Export Data**: Regular exports for record-keeping

### For Developers

1. **Test Scoring**: Recalculate scores after algorithm changes
2. **Backup Before Migration**: Always backup before running migrations
3. **Monitor Email Sending**: Check email delivery success
4. **Validate Input**: Frontend should validate before submission
5. **Handle Errors Gracefully**: Display user-friendly messages

---

## Frontend Integration Example

```typescript
// Submit application
const submitApplication = async (formData: ApplicationFormData) => {
  try {
    const response = await fetch('/api/v1/applications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formData),
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('Application submitted:', result);
      // Show success message with scores
    } else {
      const error = await response.json();
      console.error('Submission failed:', error);
      // Show error message
    }
  } catch (error) {
    console.error('Network error:', error);
  }
};

// Admin: List applications
const fetchApplications = async (courseId: number, status?: string) => {
  const params = new URLSearchParams({
    course_id: courseId.toString(),
    ...(status && { status }),
    sort_by: 'final_rank_score',
    order: 'desc',
  });
  
  const response = await fetch(`/api/v1/applications?${params}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  return await response.json();
};

// Admin: Approve application
const approveApplication = async (appId: number) => {
  const response = await fetch(`/api/v1/applications/${appId}/approve`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ send_email: true }),
  });
  
  return await response.json();
};
```

---

## Troubleshooting

### Common Issues

**Q: Scores seem incorrect**
- Run recalculate endpoint: `POST /api/v1/applications/{id}/recalculate`
- Check scoring algorithm in `application_scoring.py`

**Q: Duplicate applications**
- System checks email + course_id combination
- Returns 409 Conflict with existing application details

**Q: Emails not sending**
- Check Flask-Mail configuration
- Verify SMTP credentials
- Check email_utils.py logs

**Q: Migration fails**
- Backup database first
- Check for existing custom columns
- Run migration again (it's idempotent)

**Q: Excel export empty**
- Verify course_id parameter
- Check application count for that course
- Ensure pandas and openpyxl are installed

---

## Support

For issues or questions:
- Check logs: `backend/logs/`
- Review API errors in browser console
- Check database with SQLite browser
- Contact: support@afritecbridge.com

---

**Version:** 2.0 (Enhanced)
**Last Updated:** January 1, 2026
