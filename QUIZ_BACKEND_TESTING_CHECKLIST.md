# Quiz Backend Testing Checklist

**Date:** November 1, 2025  
**Purpose:** Verify all quiz/assessment backend fixes are working correctly

## Pre-Testing Setup

```bash
# Ensure backend is running
cd /home/desire/My_Project/AB/afritec_bridge_lms/backend
./run.sh
```

## Test Cases

### 1. Quiz Creation with Questions (New Format)

**Endpoint:** `POST /api/v1/instructor/assessments/quizzes`

**Test Data:**
```json
{
  "title": "Python Basics Quiz",
  "description": "Test your Python knowledge",
  "course_id": 1,
  "module_id": 1,
  "is_published": false,
  "questions": [
    {
      "question_text": "What is Python?",
      "question_type": "multiple_choice",
      "answers": [
        {"answer_text": "A programming language", "is_correct": true},
        {"answer_text": "A type of snake", "is_correct": false},
        {"answer_text": "A web framework", "is_correct": false}
      ]
    },
    {
      "question_text": "Python is interpreted",
      "question_type": "true_false",
      "answers": [
        {"answer_text": "True", "is_correct": true},
        {"answer_text": "False", "is_correct": false}
      ]
    }
  ]
}
```

**Expected Result:**
- ✅ Quiz created successfully
- ✅ Both questions saved with correct text
- ✅ All answers saved with correct text
- ✅ Response includes quiz with questions

**Status:** ⏳ Pending

---

### 2. Quiz Creation with Questions (Old Format)

**Endpoint:** `POST /api/v1/instructor/assessments/quizzes`

**Test Data:**
```json
{
  "title": "JavaScript Quiz",
  "course_id": 1,
  "is_published": false,
  "questions": [
    {
      "text": "What is JavaScript?",
      "question_type": "multiple_choice",
      "answers": [
        {"text": "A programming language", "is_correct": true},
        {"text": "A coffee brand", "is_correct": false}
      ]
    }
  ]
}
```

**Expected Result:**
- ✅ Quiz created successfully (backward compatibility)
- ✅ Questions and answers saved correctly
- ✅ No errors with old field names

**Status:** ⏳ Pending

---

### 3. Add Single Question to Quiz

**Endpoint:** `POST /api/v1/instructor/assessments/quizzes/{quiz_id}/questions`

**Test Data:**
```json
{
  "question_text": "What is a variable?",
  "question_type": "multiple_choice",
  "answers": [
    {"answer_text": "A storage location", "is_correct": true},
    {"answer_text": "A function", "is_correct": false}
  ]
}
```

**Expected Result:**
- ✅ Question added successfully
- ✅ Answers linked correctly
- ✅ Order assigned automatically

**Status:** ⏳ Pending

---

### 4. Add Bulk Questions

**Endpoint:** `POST /api/v1/instructor/assessments/quizzes/{quiz_id}/questions/bulk`

**Test Data:**
```json
{
  "questions": [
    {
      "question_text": "What is a list?",
      "question_type": "multiple_choice",
      "answers": [
        {"answer_text": "A collection of items", "is_correct": true},
        {"answer_text": "A single value", "is_correct": false}
      ]
    },
    {
      "question_text": "What is a dictionary?",
      "question_type": "multiple_choice",
      "answers": [
        {"answer_text": "Key-value pairs", "is_correct": true},
        {"answer_text": "A book", "is_correct": false}
      ]
    }
  ]
}
```

**Expected Result:**
- ✅ Multiple questions added
- ✅ All answers linked correctly
- ✅ Orders assigned sequentially

**Status:** ⏳ Pending

---

### 5. Create Assignment

**Endpoint:** `POST /api/v1/instructor/assessments/assignments`

**Test Data:**
```json
{
  "title": "Python Assignment 1",
  "description": "Complete the coding exercises",
  "course_id": 1,
  "module_id": 1,
  "assignment_type": "file_upload",
  "points_possible": 100,
  "due_date": "2025-11-15T23:59:00",
  "is_published": false
}
```

**Expected Result:**
- ✅ Assignment created successfully
- ✅ points_possible saved correctly
- ✅ No errors from missing allow_late_submission field

**Status:** ⏳ Pending

---

### 6. Update Assignment (points_possible)

**Endpoint:** `PUT /api/v1/instructor/assessments/assignments/{id}`

**Test Data:**
```json
{
  "title": "Updated Assignment Title",
  "points_possible": 150,
  "is_published": true
}
```

**Expected Result:**
- ✅ Assignment updated successfully
- ✅ points_possible field accepted
- ✅ Changes persisted to database

**Status:** ⏳ Pending

---

### 7. Update Assignment (max_points - backward compatibility)

**Endpoint:** `PUT /api/v1/instructor/assessments/assignments/{id}`

**Test Data:**
```json
{
  "max_points": 120
}
```

**Expected Result:**
- ✅ Assignment updated successfully
- ✅ max_points mapped to points_possible
- ✅ Backward compatibility maintained

**Status:** ⏳ Pending

---

### 8. Create Project

**Endpoint:** `POST /api/v1/instructor/assessments/projects`

**Test Data:**
```json
{
  "title": "Final Project",
  "description": "Build a complete web application",
  "objectives": "Apply all learned concepts",
  "course_id": 1,
  "module_ids": [1, 2, 3],
  "due_date": "2025-12-01T23:59:00",
  "points_possible": 300,
  "collaboration_allowed": true,
  "max_team_size": 4,
  "is_published": false
}
```

**Expected Result:**
- ✅ Project created successfully
- ✅ module_ids stored as JSON
- ✅ All fields saved correctly

**Status:** ⏳ Pending

---

### 9. Update Project

**Endpoint:** `PUT /api/v1/instructor/assessments/projects/{id}`

**Test Data:**
```json
{
  "title": "Updated Final Project",
  "points_possible": 350,
  "max_team_size": 5,
  "is_published": true
}
```

**Expected Result:**
- ✅ Project updated successfully
- ✅ All fields updated correctly
- ✅ No errors from field name mismatches

**Status:** ⏳ Pending

---

### 10. Get All Quizzes

**Endpoint:** `GET /api/v1/instructor/assessments/quizzes`

**Expected Result:**
- ✅ Returns list of all instructor quizzes
- ✅ Questions included if requested
- ✅ Answers included in questions

**Status:** ⏳ Pending

---

### 11. Get Assessments Overview

**Endpoint:** `GET /api/v1/instructor/assessments/courses/{course_id}/overview`

**Expected Result:**
- ✅ Returns quizzes, assignments, and projects
- ✅ All data properly formatted
- ✅ Correct field names in response

**Status:** ⏳ Pending

---

## Frontend Integration Tests

### 1. Create Quiz via Frontend

**Steps:**
1. Navigate to Instructor Dashboard
2. Go to course management
3. Create a new quiz with questions
4. Save the quiz

**Expected Result:**
- ✅ Quiz created successfully
- ✅ Questions appear in the UI
- ✅ No console errors

**Status:** ⏳ Pending

---

### 2. Create Assignment via Frontend

**Steps:**
1. Navigate to Instructor Dashboard
2. Go to Assessments tab
3. Create a new assignment
4. Set points and due date
5. Save

**Expected Result:**
- ✅ Assignment created successfully
- ✅ All fields saved correctly
- ✅ No console errors

**Status:** ⏳ Pending

---

### 3. Update Assignment via Frontend

**Steps:**
1. Navigate to existing assignment
2. Click Edit
3. Update points and title
4. Save changes

**Expected Result:**
- ✅ Assignment updated successfully
- ✅ Changes reflected in UI
- ✅ Database updated correctly

**Status:** ⏳ Pending

---

## Database Verification

After running tests, verify data in database:

```sql
-- Check quiz questions
SELECT q.id, q.title, qn.text as question_text, qn.question_type
FROM quizzes q
LEFT JOIN questions qn ON qn.quiz_id = q.id
ORDER BY q.id DESC LIMIT 5;

-- Check answers
SELECT qn.text as question_text, a.text as answer_text, a.is_correct
FROM questions qn
JOIN answers a ON a.question_id = qn.id
ORDER BY qn.id DESC LIMIT 10;

-- Check assignments
SELECT id, title, points_possible, assignment_type, is_published
FROM assignments
ORDER BY id DESC LIMIT 5;

-- Check projects  
SELECT id, title, points_possible, module_ids, collaboration_allowed, max_team_size
FROM projects
ORDER BY id DESC LIMIT 5;
```

---

## Error Handling Tests

### 1. Invalid Question Data

**Test Data:**
```json
{
  "course_id": 1,
  "title": "Test",
  "questions": [
    {
      "question_text": "",
      "answers": []
    }
  ]
}
```

**Expected Result:**
- ✅ Quiz created but empty question skipped
- ✅ No server error
- ✅ Appropriate response message

---

### 2. Missing Required Fields

**Test Data:**
```json
{
  "title": "Test Quiz"
  // Missing course_id
}
```

**Expected Result:**
- ✅ 400 Bad Request
- ✅ Error message: "Course ID is required"

---

## Performance Tests

### 1. Bulk Question Creation

**Test:** Create quiz with 50 questions, each with 4 answers

**Expected Result:**
- ✅ Completes in < 5 seconds
- ✅ All questions saved
- ✅ No database errors

---

## Summary Checklist

- [ ] All endpoint tests pass
- [ ] Frontend integration works
- [ ] Database records correct
- [ ] Error handling works
- [ ] Backward compatibility maintained
- [ ] Performance acceptable
- [ ] No console errors
- [ ] No server errors

## Sign-off

**Tested By:** _________________  
**Date:** _________________  
**Status:** [ ] PASS [ ] FAIL  
**Notes:** _________________
