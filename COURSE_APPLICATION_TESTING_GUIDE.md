# Course Application System - Testing Guide

## 🧪 Testing the Enhanced Application System

This guide helps you verify all features are working correctly.

---

## Prerequisites

✅ Backend running on http://localhost:5001  
✅ Database migration completed  
✅ Admin user created  
✅ At least one course exists

---

## Test Plan

### 1. Database Migration ✅ (Already Done)

```bash
cd backend
python migrate_course_applications.py
```

**Expected Output:**
- ✅ 26 columns added
- ✅ 4 indexes created
- ✅ "Migration completed successfully!"

---

### 2. Submit Test Application (Public Endpoint)

**Test Case 1: Complete Application**

```bash
curl -X POST http://localhost:5001/api/v1/applications \
  -H "Content-Type: application/json" \
  -d '{
    "course_id": 1,
    "full_name": "John Doe",
    "email": "john.doe@example.com",
    "phone": "+234-801-234-5678",
    "whatsapp_number": "+234-801-234-5678",
    "gender": "male",
    "age_range": "25_34",
    "country": "Nigeria",
    "city": "Lagos",
    "education_level": "bachelors",
    "current_status": "employed",
    "field_of_study": "Computer Science",
    "has_used_excel": true,
    "excel_skill_level": "intermediate",
    "excel_tasks_done": ["basic_formulas", "pivot_tables", "charts_graphs"],
    "motivation": "I want to improve my data analysis skills to advance in my career. Excel is essential for my role and mastering it will help me automate reports and make better data-driven decisions.",
    "learning_outcomes": "Get certified in Excel and learn advanced features like Power Query and macros.",
    "career_impact": "Excel skills will help me get promoted to a senior analyst position and increase my productivity.",
    "has_computer": true,
    "internet_access_type": "stable_broadband",
    "preferred_learning_mode": "hybrid",
    "available_time": ["evening", "weekend"],
    "committed_to_complete": true,
    "agrees_to_assessments": true,
    "referral_source": "Facebook Ad"
  }'
```

**Expected Response (201):**
```json
{
  "message": "Application submitted successfully",
  "application_id": 1,
  "status": "pending",
  "scores": {
    "application_score": 85,
    "readiness_score": 78,
    "commitment_score": 92,
    "risk_score": 15
  }
}
```

**Test Case 2: Duplicate Application**

Submit the same application again.

**Expected Response (409):**
```json
{
  "error": "You have already applied for this course",
  "application_id": 1,
  "status": "pending"
}
```

**Test Case 3: Missing Required Fields**

```bash
curl -X POST http://localhost:5001/api/v1/applications \
  -H "Content-Type: application/json" \
  -d '{
    "course_id": 1,
    "full_name": "Jane Doe"
  }'
```

**Expected Response (400):**
```json
{
  "error": "Missing required fields",
  "missing": ["email", "phone", "motivation"]
}
```

---

### 3. List Applications (Admin)

**Get JWT Token First:**

```bash
curl -X POST http://localhost:5001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "your_admin_password"
  }'
```

Copy the `access_token` from response.

**Test Case 4: List All Applications**

```bash
curl -X GET "http://localhost:5001/api/v1/applications?course_id=1" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Expected Response (200):**
```json
{
  "applications": [
    {
      "id": 1,
      "full_name": "John Doe",
      "email": "john.doe@example.com",
      "application_score": 85,
      "final_rank_score": 82.5,
      "status": "pending",
      ...
    }
  ],
  "total": 1,
  "pages": 1,
  "current_page": 1,
  "per_page": 50
}
```

**Test Case 5: Filter by Status**

```bash
curl -X GET "http://localhost:5001/api/v1/applications?course_id=1&status=pending" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Test Case 6: Sort Applications**

```bash
curl -X GET "http://localhost:5001/api/v1/applications?course_id=1&sort_by=final_rank_score&order=desc" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

### 4. Get Single Application

**Test Case 7: View Application Details**

```bash
curl -X GET http://localhost:5001/api/v1/applications/1 \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Expected Response (200):**
Full application data including sensitive fields (motivation, notes, etc.)

---

### 5. Approve Application

**Test Case 8: Approve with Email**

```bash
curl -X POST http://localhost:5001/api/v1/applications/1/approve \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "send_email": true
  }'
```

**Expected Response (200):**
```json
{
  "message": "Application approved successfully",
  "user_id": 5,
  "username": "john.doe",
  "enrollment_id": 3,
  "credentials_sent": true
}
```

**Verify:**
- ✅ User created in database
- ✅ Enrollment created
- ✅ Application status = "approved"
- ✅ Email sent (check logs if configured)

---

### 6. Reject Application

First, submit another test application, then:

**Test Case 9: Reject with Reason**

```bash
curl -X POST http://localhost:5001/api/v1/applications/2/reject \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Does not meet minimum computer requirements",
    "admin_notes": "Applicant mentioned using mobile only",
    "send_email": false
  }'
```

**Expected Response (200):**
```json
{
  "message": "Application rejected",
  "application_id": 2
}
```

---

### 7. Waitlist Application

**Test Case 10: Move to Waitlist**

```bash
curl -X POST http://localhost:5001/api/v1/applications/3/waitlist \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "admin_notes": "Strong candidate, waiting for next cohort"
  }'
```

**Expected Response (200):**
```json
{
  "message": "Application moved to waitlist",
  "application_id": 3
}
```

---

### 8. Update Notes

**Test Case 11: Add Admin Notes**

```bash
curl -X PUT http://localhost:5001/api/v1/applications/1/notes \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "admin_notes": "Contacted via phone - very motivated and ready to start"
  }'
```

**Expected Response (200):**
```json
{
  "message": "Notes updated successfully"
}
```

---

### 9. Recalculate Scores

**Test Case 12: Recalculate**

```bash
curl -X POST http://localhost:5001/api/v1/applications/1/recalculate \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Expected Response (200):**
```json
{
  "message": "Scores recalculated",
  "scores": {
    "risk_score": 15,
    "is_high_risk": false,
    "readiness_score": 78,
    "commitment_score": 92,
    "application_score": 85,
    "final_rank_score": 82.5
  }
}
```

---

### 10. Get Statistics

**Test Case 13: Application Statistics**

```bash
curl -X GET "http://localhost:5001/api/v1/applications/statistics?course_id=1" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Expected Response (200):**
```json
{
  "total_applications": 5,
  "status_breakdown": {
    "pending": 2,
    "approved": 1,
    "rejected": 1,
    "waitlisted": 1
  },
  "high_risk_count": 1,
  "average_scores": {
    "application_score": 72.4,
    "readiness_score": 65.8,
    "commitment_score": 78.2,
    "risk_score": 32.6
  }
}
```

---

### 11. Export to Excel

**Test Case 14: Export Applications**

```bash
curl -X GET "http://localhost:5001/api/v1/applications/export?course_id=1" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -o applications_export.xlsx
```

**Verify:**
- ✅ File downloads successfully
- ✅ Has two sheets: Applications + Statistics
- ✅ Data matches database

**Open in Excel/LibreOffice to verify:**
- Column headers correct
- Data populated
- Statistics sheet has summary

---

## Edge Cases & Error Scenarios

### Test Case 15: Invalid Course ID
```bash
curl -X POST http://localhost:5001/api/v1/applications \
  -H "Content-Type: application/json" \
  -d '{"course_id": 9999, "full_name": "Test", "email": "test@test.com", "phone": "123", "motivation": "test", "has_computer": true, "committed_to_complete": true, "agrees_to_assessments": true}'
```

**Expected:** 404 or foreign key error

### Test Case 16: Invalid Email Format
```bash
curl -X POST http://localhost:5001/api/v1/applications \
  -H "Content-Type: application/json" \
  -d '{"course_id": 1, "full_name": "Test", "email": "invalid-email", "phone": "123", "motivation": "test", "has_computer": true, "committed_to_complete": true, "agrees_to_assessments": true}'
```

**Expected:** 400 validation error

### Test Case 17: Approve Already Approved
```bash
curl -X POST http://localhost:5001/api/v1/applications/1/approve \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Expected (400):**
```json
{
  "error": "Application is already approved"
}
```

### Test Case 18: Access Without Token
```bash
curl -X GET http://localhost:5001/api/v1/applications?course_id=1
```

**Expected (401):**
```json
{
  "msg": "Missing Authorization Header"
}
```

---

## Scoring Verification

### Test Case 19: High Risk Application

Submit application with:
- has_computer: false
- has_internet: false
- excel_skill_level: "never_used"
- committed_to_complete: false

**Expected Scores:**
- risk_score: ≥50
- is_high_risk: true
- readiness_score: <40
- final_rank_score: <30

### Test Case 20: Excellent Application

Submit application with:
- has_computer: true
- internet_access_type: "stable_broadband"
- excel_skill_level: "expert"
- education_level: "masters"
- current_status: "employed"
- Long motivation (500+ chars)
- committed_to_complete: true
- agrees_to_assessments: true
- country: "Nigeria" (African bonus)

**Expected Scores:**
- risk_score: <20
- is_high_risk: false
- readiness_score: >80
- commitment_score: >80
- application_score: >85
- final_rank_score: >75

---

## Performance Testing

### Test Case 21: Pagination

Submit 60 applications (use a script), then:

```bash
curl -X GET "http://localhost:5001/api/v1/applications?course_id=1&page=1&per_page=20" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Verify:**
- total: 60
- pages: 3
- Items returned: 20

```bash
curl -X GET "http://localhost:5001/api/v1/applications?course_id=1&page=2&per_page=20" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Verify:** Different items returned

---

## Database Verification

### Test Case 22: Check Database Schema

```bash
cd backend
sqlite3 instance/afritec_lms_db.db

# Run these SQL commands:
.schema course_applications
.tables
.exit
```

**Verify:**
- ✅ All 38+ columns exist
- ✅ Indexes created
- ✅ Foreign keys intact

### Test Case 23: Verify Data Integrity

```sql
-- Check for NULL required fields
SELECT COUNT(*) FROM course_applications 
WHERE full_name IS NULL OR email IS NULL;
-- Should be 0

-- Check score ranges
SELECT MIN(risk_score), MAX(risk_score), 
       MIN(application_score), MAX(application_score)
FROM course_applications;
-- Should be 0-100 range

-- Check status values
SELECT DISTINCT status FROM course_applications;
-- Should be: pending, approved, rejected, waitlisted
```

---

## Email Testing (If Configured)

### Test Case 24: Application Confirmation Email

Submit application with your real email, check inbox for:
- ✅ Confirmation received
- ✅ Application ID included
- ✅ Proper formatting

### Test Case 25: Approval Email

Approve application with send_email=true, check inbox for:
- ✅ Welcome message
- ✅ Credentials included
- ✅ Login URL
- ✅ Password change instructions

### Test Case 26: Rejection Email (Optional)

Reject application with send_email=true, check inbox for:
- ✅ Polite message
- ✅ Reason included
- ✅ Encouragement

---

## Frontend Integration Testing

If you have a frontend:

1. **Form Submission**
   - ✅ All fields render
   - ✅ Validation works
   - ✅ Success message shows
   - ✅ Scores displayed (optional)

2. **Admin Panel**
   - ✅ Applications list loads
   - ✅ Filters work
   - ✅ Sorting works
   - ✅ Pagination works
   - ✅ Actions work (approve/reject/waitlist)
   - ✅ Notes update
   - ✅ Statistics display
   - ✅ Export downloads

---

## Checklist Summary

- [ ] Migration successful
- [ ] Submit application works
- [ ] Duplicate detection works
- [ ] Validation catches errors
- [ ] List applications works
- [ ] Filtering works
- [ ] Sorting works
- [ ] Pagination works
- [ ] Approve creates user + enrollment
- [ ] Reject updates status
- [ ] Waitlist works
- [ ] Notes update works
- [ ] Recalculate works
- [ ] Statistics accurate
- [ ] Export generates Excel
- [ ] Scoring algorithms correct
- [ ] High risk detection works
- [ ] Email notifications work (if configured)
- [ ] Database integrity maintained
- [ ] All indexes present
- [ ] Frontend integration works

---

## Troubleshooting

### Issue: Scores are 0

**Solution:** Check that all required fields are provided. Run recalculate endpoint.

### Issue: Email not sending

**Solution:** Check Flask-Mail configuration in .env file. Verify SMTP credentials.

### Issue: 404 on endpoints

**Solution:** Verify backend is running. Check blueprint registration in main.py.

### Issue: Duplicate not detected

**Solution:** Check email is lowercase in database. Verify course_id matches.

### Issue: Excel export empty

**Solution:** Ensure pandas and openpyxl are installed. Check course_id parameter.

---

## Test Data Generator

Use this Python script to generate test applications:

```python
import requests
import random

API_URL = "http://localhost:5001/api/v1/applications"

names = ["John Doe", "Jane Smith", "Alice Johnson", "Bob Williams", "Carol Davis"]
cities = ["Lagos", "Nairobi", "Accra", "Cairo", "Johannesburg"]
skills = ["never_used", "beginner", "intermediate", "advanced", "expert"]

for i in range(10):
    data = {
        "course_id": 1,
        "full_name": random.choice(names) + f" {i}",
        "email": f"test{i}@example.com",
        "phone": f"+234-80-{random.randint(1000000, 9999999)}",
        "city": random.choice(cities),
        "country": "Nigeria",
        "age_range": random.choice(["18_24", "25_34", "35_44"]),
        "excel_skill_level": random.choice(skills),
        "motivation": "I want to learn Excel" * random.randint(10, 50),
        "has_computer": random.choice([True, False]),
        "committed_to_complete": True,
        "agrees_to_assessments": True,
    }
    
    response = requests.post(API_URL, json=data)
    print(f"Application {i}: {response.status_code}")
```

---

## Success Criteria

✅ All 26 test cases pass  
✅ No database errors  
✅ All scores calculate correctly  
✅ Email sending works (if configured)  
✅ Export generates valid Excel  
✅ Frontend integration works  
✅ Performance acceptable (<500ms per request)  

---

**Testing Complete?** Deploy to production! 🚀

**Version:** 2.0  
**Last Updated:** January 1, 2026
