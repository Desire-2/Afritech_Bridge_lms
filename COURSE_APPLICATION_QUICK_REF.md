# Course Application Form - Quick Reference Card

## 📝 Form Sections & Fields

### 1️⃣ APPLICANT INFORMATION
```
✓ Full Name* (full_name)
✓ Email Address* (email)
✓ Phone / WhatsApp Number* (phone, whatsapp_number)
✓ Gender (gender: male|female|other|prefer_not_to_say)
✓ Age Range (age_range: under_18|18_24|25_34|35_44|45_54|55_plus)
✓ Country (country)
✓ City / District (city)
```

### 2️⃣ EDUCATION & BACKGROUND
```
✓ Highest Level of Education (education_level)
  - high_school | diploma | bachelors | masters | phd | other
✓ Current Status (current_status)
  - student | employed | self_employed | unemployed | freelancer | other
✓ Field of Study / Profession (field_of_study)
```

### 3️⃣ EXCEL & COMPUTER SKILLS
```
✓ Have you used Excel before? (has_used_excel: boolean)
✓ Excel Skill Level (excel_skill_level)
  - never_used | beginner | intermediate | advanced | expert
✓ Excel Tasks Done (excel_tasks_done: array)
  - basic_formulas, pivot_tables, vlookup_hlookup, charts_graphs,
    conditional_formatting, data_validation, macros_vba, etc.
```

### 4️⃣ LEARNING GOALS
```
✓ Why do you want to join?* (motivation: text)
✓ What do you want to achieve? (learning_outcomes: text)
✓ How will Excel help your career? (career_impact: text)
```

### 5️⃣ ACCESS & AVAILABILITY
```
✓ Do you have a computer?* (has_computer: boolean)
✓ Internet Access Type (internet_access_type)
  - stable_broadband | mobile_data | limited_access | public_wifi | other
✓ Preferred Learning Mode (preferred_learning_mode)
  - self_paced | live_sessions | hybrid
✓ Available Time (available_time: array)
  - morning | afternoon | evening | weekend | weekday_morning, etc.
```

### 6️⃣ COMMITMENT & AGREEMENT
```
✓ Committed to completing course?* (committed_to_complete: boolean)
✓ Agree to assessments?* (agrees_to_assessments: boolean)
✓ How did you hear about us? (referral_source: text)
```

*Required fields

---

## 🎯 Scoring Breakdown

### Risk Score (0-100, Lower = Better)
- No computer: +30
- No/limited internet: +25
- Never used Excel: +20
- No online experience: +15
- Not committed: +10
**High Risk = 50+**

### Readiness Score (0-100, Higher = Better)
- Computer + Internet: +25
- Excel skills: 0-30
- Education level: 0-20
- Professional status: 0-10
- Online experience: +10

### Commitment Score (0-100, Higher = Better)
- Agreements: +20
- Motivation (length): 0-30
- Learning outcomes: 0-20
- Career impact: 0-20
- Time availability: 0-10

### Application Score (0-100, Higher = Better)
- Technical readiness: 25
- Excel skills: 25
- Education: 15
- Motivation/goals: 20
- Commitment: 10
- Learning mode: 5

### Final Rank Score
```
Formula: (App×0.4) + (Readiness×0.3) + (Commitment×0.2) - (Risk×0.1) + Bonuses
Bonus: African country +5
```

---

## 🔗 API Quick Reference

### Submit Application (Public)
```http
POST /api/v1/applications
{
  "course_id": 1,
  "full_name": "John Doe",
  "email": "john@example.com",
  "phone": "+234-801-234-5678",
  "motivation": "...",
  "has_computer": true,
  "committed_to_complete": true,
  "agrees_to_assessments": true
  // ... all other fields
}
```

### List Applications (Admin)
```http
GET /api/v1/applications?course_id=1&status=pending&sort_by=final_rank_score
Authorization: Bearer <token>
```

### Approve Application
```http
POST /api/v1/applications/123/approve
{ "send_email": true }
```

### Reject Application
```http
POST /api/v1/applications/123/reject
{ "reason": "...", "send_email": true }
```

### Get Statistics
```http
GET /api/v1/applications/statistics?course_id=1
```

---

## 📊 Admin Actions

| Action | Endpoint | Method |
|--------|----------|--------|
| View details | `/applications/{id}` | GET |
| Approve | `/applications/{id}/approve` | POST |
| Reject | `/applications/{id}/reject` | POST |
| Waitlist | `/applications/{id}/waitlist` | POST |
| Add notes | `/applications/{id}/notes` | PUT |
| Recalculate | `/applications/{id}/recalculate` | POST |
| Export Excel | `/applications/export?course_id=1` | GET |
| Statistics | `/applications/statistics` | GET |

---

## ✅ Status Flow

```
PENDING → APPROVED → User Created + Enrolled
       ↘ REJECTED
       ↘ WAITLISTED → (can be approved later)
```

---

## 📧 Email Notifications

1. **Application Received** (Auto)
   - Sent on submission
   - Includes app ID

2. **Application Approved** (Optional)
   - Welcome + credentials
   - Password change required

3. **Application Rejected** (Optional)
   - Reason included
   - Encouragement to reapply

---

## 🔧 Database Schema

**Table:** `course_applications`

**Key Fields:**
- Personal: full_name, email, phone, country, city
- Education: education_level, current_status, field_of_study
- Skills: excel_skill_level, excel_tasks_done
- Goals: motivation, learning_outcomes, career_impact
- Access: has_computer, internet_access_type
- Commitment: committed_to_complete, agrees_to_assessments
- Scores: risk_score, readiness_score, commitment_score, application_score, final_rank_score
- Status: status, reviewed_at, rejection_reason, admin_notes

**Indexes:**
- email (for duplicate detection)
- status (for filtering)
- course_id + status (for queries)
- final_rank_score (for sorting)

---

## 💡 Best Practices

### For Applicants
- ✅ Be honest about skill level
- ✅ Write detailed motivation (300+ chars)
- ✅ Show commitment
- ✅ Provide accurate contact info

### For Admins
- ✅ Review regularly
- ✅ Add notes for decisions
- ✅ Use waitlist for borderline cases
- ✅ Send emails when deciding
- ✅ Export data for records

### For Developers
- ✅ Validate input on frontend
- ✅ Handle all error responses
- ✅ Display scores to admins
- ✅ Test email delivery
- ✅ Backup before migrations

---

## 🚨 Validation Rules

**Required Fields:**
- course_id
- full_name
- email
- phone
- motivation
- has_computer
- committed_to_complete
- agrees_to_assessments

**Format Checks:**
- email: Valid email format
- phone: Include country code
- Arrays: JSON format for excel_tasks_done, available_time

**Business Rules:**
- No duplicate (email + course_id)
- Cannot reject approved applications
- Must have student role to approve

---

## 📱 Frontend Integration Tips

```typescript
// Example form data structure
interface ApplicationFormData {
  course_id: number;
  full_name: string;
  email: string;
  phone: string;
  gender?: string;
  age_range?: string;
  country?: string;
  city?: string;
  education_level?: string;
  current_status?: string;
  field_of_study?: string;
  has_used_excel: boolean;
  excel_skill_level: string;
  excel_tasks_done?: string[];  // Array
  motivation: string;
  learning_outcomes?: string;
  career_impact?: string;
  has_computer: boolean;
  internet_access_type?: string;
  preferred_learning_mode?: string;
  available_time?: string[];  // Array
  committed_to_complete: boolean;
  agrees_to_assessments: boolean;
  referral_source?: string;
}
```

---

## 📈 Success Metrics

**Good Application:**
- Readiness: 60+
- Commitment: 70+
- Risk: <40
- Final Rank: 50+

**Excellent Application:**
- Readiness: 80+
- Commitment: 85+
- Risk: <25
- Final Rank: 70+

---

**Need Help?** See [COURSE_APPLICATION_GUIDE.md](backend/COURSE_APPLICATION_GUIDE.md) for complete documentation.

**Version:** 2.0  
**Updated:** January 1, 2026
