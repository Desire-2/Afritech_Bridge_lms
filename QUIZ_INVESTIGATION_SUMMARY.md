# Quiz Settings & Questions Not Saving - INVESTIGATION 🔍

## Date: November 2, 2025

## 📋 Issue Summary

**User Report**: "quiz is created but settings and questions are not created on this quiz"

**Translation**: 
- ✅ Quiz entity is being created (has ID, title)
- ❌ Quiz settings (time_limit, max_attempts, passing_score, etc.) are NOT saved
- ❌ Questions are NOT being created/attached to the quiz

## 🎯 What We Know

### ✅ What's Working
1. **Frontend form** - Collects all data correctly
2. **TypeScript types** - Fixed to include questions and settings
3. **API service** - Sends data to correct endpoint
4. **Backend endpoint exists** - `/api/v1/instructor/assessments/quizzes` (POST)
5. **Backend processes data** - Creates Quiz object
6. **Database models** - Have all required fields and relationships
7. **`to_dict()` method** - Returns all settings and questions

### ❓ What's Unknown
1. Is data being sent from frontend? (Need to check Network tab)
2. Is backend receiving the data? (Need backend logs)
3. Is backend saving the data? (Need database verification)
4. Is data being returned in response? (Need response inspection)
5. Is UI not displaying the data? (Need UI state check)

## 🔧 Changes Made for Debugging

### 1. Added Debug Logging to Backend

**File**: `backend/src/routes/instructor_assessment_routes.py`

**Added at start of `create_quiz()` endpoint:**
```python
# Debug logging
print("=== CREATE QUIZ ENDPOINT ===")
print(f"Received data: {data}")
print(f"Questions in data: {data.get('questions', [])}")
print(f"Quiz settings:")
print(f"  - time_limit: {data.get('time_limit')}")
print(f"  - max_attempts: {data.get('max_attempts')}")
print(f"  - passing_score: {data.get('passing_score')}")
print(f"  - shuffle_questions: {data.get('shuffle_questions')}")
print(f"  - shuffle_answers: {data.get('shuffle_answers')}")
```

**Added after quiz creation:**
```python
# Debug: Check what was actually saved
print("=== QUIZ CREATED ===")
print(f"Quiz ID: {quiz.id}")
print(f"Quiz title: {quiz.title}")
print(f"Time limit: {quiz.time_limit}")
print(f"Max attempts: {quiz.max_attempts}")
print(f"Passing score: {quiz.passing_score}")
print(f"Shuffle questions: {quiz.shuffle_questions}")
print(f"Shuffle answers: {quiz.shuffle_answers}")
print(f"Questions count: {len(quiz.questions) if quiz.questions else 0}")
if quiz.questions:
    for q in quiz.questions:
        print(f"  - Question {q.order}: {q.text[:50]}... ({len(q.answers) if q.answers else 0} answers)")
```

**Purpose**: Track data flow through the backend to see exactly what's received and saved

### 2. Frontend Already Has Logging

**File**: `frontend/src/components/instructor/course-creation/AssessmentManagement.tsx`

**Existing logs in `handleCreateQuiz()`:**
```typescript
console.log('=== CREATING QUIZ ===');
console.log('Current questions in state:', currentQuestions);
console.log('Quiz data being sent:', JSON.stringify(quizData, null, 2));
console.log('Quiz created successfully:', createdQuiz);
console.log('Questions in created quiz:', createdQuiz.questions);
```

**Purpose**: Track data from form state through API call to response

## 📊 Diagnostic Steps

### Step 1: Check Frontend Sends Data

**Action**: Create a test quiz and check browser console

**Look for**:
```
=== CREATING QUIZ ===
Current questions in state: [
  {
    question_text: "What is...",
    question_type: "multiple_choice",
    points: 10,
    answers: [...]
  }
]
Quiz data being sent: {
  "title": "Test Quiz",
  "course_id": 1,
  "time_limit": 30,
  "max_attempts": 3,
  "passing_score": 70,
  "questions": [...]
}
```

**Expected**: Should see settings and questions in "Quiz data being sent"

**If missing**: Problem is in frontend form state or `quizData` object construction

### Step 2: Check Network Request

**Action**: Open DevTools → Network tab → Create quiz → Inspect POST request

**Check Request Payload**:
```json
{
  "title": "Test Quiz",
  "description": "Test description",
  "course_id": 1,
  "time_limit": 30,
  "max_attempts": 3,
  "passing_score": 70,
  "shuffle_questions": true,
  "shuffle_answers": false,
  "show_correct_answers": true,
  "questions": [
    {
      "question_text": "What is...",
      "question_type": "multiple_choice",
      "points": 10,
      "answers": [...]
    }
  ]
}
```

**Expected**: Complete data with settings and questions

**If missing**: Problem is in API service or axios interceptor

### Step 3: Check Backend Receives Data

**Action**: Watch backend terminal/logs after creating quiz

**Look for**:
```
=== CREATE QUIZ ENDPOINT ===
Received data: {'title': 'Test Quiz', 'course_id': 1, 'time_limit': 30, ...}
Questions in data: [{'question_text': 'What is...', ...}]
Quiz settings:
  - time_limit: 30
  - max_attempts: 3
  - passing_score: 70
  - shuffle_questions: True
  - shuffle_answers: False
```

**Expected**: Backend logs show all data received

**If missing**: Problem is network/CORS or backend not receiving request

### Step 4: Check Backend Saves Data

**Action**: Continue watching backend logs

**Look for**:
```
=== QUIZ CREATED ===
Quiz ID: 15
Quiz title: Test Quiz
Time limit: 30
Max attempts: 3
Passing score: 70
Shuffle questions: True
Questions count: 2
  - Question 1: What is a closure?... (3 answers)
  - Question 2: Is JavaScript... (2 answers)
```

**Expected**: All settings have values (not None), questions count > 0

**If settings are None**: Problem is in Quiz object creation or database save

**If questions count is 0**: Problem is in question creation loop or commit

### Step 5: Check API Response

**Action**: Check Network tab → Response for POST request

**Look for**:
```json
{
  "message": "Quiz created successfully",
  "quiz": {
    "id": 15,
    "title": "Test Quiz",
    "time_limit": 30,
    "max_attempts": 3,
    "passing_score": 70,
    "shuffle_questions": true,
    "questions": [
      {
        "id": 42,
        "text": "What is...",
        "answers": [...]
      }
    ]
  }
}
```

**Expected**: Response includes all settings and questions

**If missing**: Problem is in `to_dict()` method or response serialization

### Step 6: Check Frontend Receives Response

**Action**: Check browser console for response logs

**Look for**:
```
Quiz created successfully: {
  id: 15,
  title: "Test Quiz",
  time_limit: 30,
  questions: [...]
}
Questions in created quiz: [...]
```

**Expected**: Frontend receives complete quiz data

**If missing**: Problem is in API service response handling

## 🐛 Common Failure Scenarios

### Scenario A: Data Not Sent from Frontend

**Symptoms:**
- Console shows empty questions: `questions: undefined` or `[]`
- Network tab shows incomplete payload
- Backend logs show empty/missing fields

**Causes:**
- Form state not updated (`quizForm`, `currentQuestions`)
- Fields not included in `quizData` object
- Type conversion issues (e.g., string not converted to int)

**Solution:**
Check form state before submit:
```typescript
console.log('Form state:', quizForm);
console.log('Questions:', currentQuestions);
```

### Scenario B: Data Sent But Not Received by Backend

**Symptoms:**
- Network tab shows complete payload
- Backend logs show empty data or different values
- CORS errors in console

**Causes:**
- Request interceptor modifying data
- Content-Type mismatch
- Backend not parsing JSON correctly

**Solution:**
Check request headers in Network tab:
- Content-Type should be `application/json`
- Authorization header present
- No CORS errors in console

### Scenario C: Data Received But Not Saved

**Symptoms:**
- Backend logs show data received correctly
- Backend logs after save show None/NULL values
- Questions count is 0

**Causes:**
- Data type conversion fails silently
- Validation skips data without error
- Transaction rolled back due to constraint violation

**Solution:**
Add try-catch in backend:
```python
try:
    quiz.time_limit = int(data['time_limit']) if data.get('time_limit') else None
    print(f"Set time_limit to: {quiz.time_limit}")
except Exception as e:
    print(f"ERROR setting time_limit: {e}")
```

### Scenario D: Data Saved But Not Returned

**Symptoms:**
- Backend logs show data saved correctly
- Response in Network tab missing data
- Frontend doesn't receive data

**Causes:**
- `to_dict()` method not including fields
- Response not including `include_questions=True`
- Serialization issue

**Solution:**
Check response construction:
```python
return jsonify({
    "quiz": quiz.to_dict(include_questions=True)  # ← Must include this!
}), 201
```

### Scenario E: Data Returned But Not Displayed

**Symptoms:**
- Network response shows complete data
- Console shows data received
- UI doesn't show settings/questions

**Causes:**
- UI not re-fetching quiz list
- Component not updating state
- Data stored in different format than expected

**Solution:**
Check if `onAssessmentUpdate()` is called and working

## 🚀 Action Plan

### Immediate Actions Required:

1. **Restart Backend** (to enable debug logging)
   ```bash
   cd /home/desire/My_Project/AB/afritec_bridge_lms/backend
   pkill -f "flask run"
   FLASK_APP=src.app FLASK_ENV=development flask run --host=0.0.0.0 --port=5000
   ```

2. **Create Test Quiz** with these specific values:
   - Title: "DEBUG TEST"
   - Time limit: 30 minutes
   - Max attempts: 3
   - Passing score: 75%
   - Add 2 questions with 3 answers each

3. **Collect Diagnostic Data**:
   - [ ] Screenshot/copy browser console output
   - [ ] Screenshot/copy Network tab Request payload
   - [ ] Screenshot/copy Network tab Response
   - [ ] Screenshot/copy backend terminal logs
   - [ ] Note which step shows missing data

4. **Run Database Test** (optional):
   ```bash
   cd backend
   python QUIZ_DEBUG_TEST_SCRIPT.md  # Follow the script
   ```

5. **Report Findings**:
   - Identify FIRST point where data is lost/missing
   - Share relevant logs/screenshots
   - Note any error messages

## 📝 Expected vs Actual Behavior

### Expected: Complete Quiz Creation

1. ✅ User fills form with settings and questions
2. ✅ Frontend sends complete data to `/api/v1/instructor/assessments/quizzes`
3. ✅ Backend receives all fields
4. ✅ Backend creates Quiz with all settings
5. ✅ Backend creates Questions with Answers
6. ✅ Backend commits transaction successfully
7. ✅ Backend returns complete quiz in response
8. ✅ Frontend receives quiz with settings and questions
9. ✅ UI shows quiz with question count and settings
10. ✅ Editing quiz shows all settings and questions

### Actual: Incomplete Quiz Creation

**What works:**
- ✅ Quiz entity created (has ID, title, description)
- ✅ Success message shown

**What doesn't work:**
- ❌ Settings not saved (time_limit, max_attempts, etc.)
- ❌ Questions not created
- ❌ Quiz appears empty/incomplete

## 📚 Reference Documents

Created debugging aids:
1. `QUIZ_SETTINGS_QUESTIONS_DEBUG_GUIDE.md` - Comprehensive debugging steps
2. `QUIZ_DEBUG_TEST_SCRIPT.md` - Direct database test to isolate issue
3. `QUIZ_QUESTIONS_SENDING_FIX.md` - TypeScript interface fix (completed)
4. `QUIZ_QUESTION_BUILDER_UX_ENHANCEMENTS.md` - UI improvements (completed)

## 🎯 Next Steps

**PRIORITY 1**: Identify where data is lost
- Run through diagnostic steps 1-6
- Note first step where data is missing
- Share logs/screenshots from that step

**PRIORITY 2**: Fix the identified issue
- Based on which step fails, apply appropriate fix
- Could be frontend, network, backend, or database issue

**PRIORITY 3**: Verify fix works
- Create new test quiz
- Verify settings saved
- Verify questions created
- Verify quiz displays correctly

## 📊 Status

**Current**: 🔍 **AWAITING DIAGNOSTICS**

- ✅ Debug logging added to backend
- ✅ Frontend already has logging
- ✅ Test scripts prepared
- ⏳ Need to run tests and collect data
- ⏳ Need to identify failure point
- ⏳ Need to apply fix

**Code Review Status**:
- ✅ Frontend form logic: CORRECT
- ✅ Frontend API calls: CORRECT  
- ✅ TypeScript types: FIXED (includes questions and settings)
- ✅ Backend endpoint: CORRECT
- ✅ Backend models: CORRECT
- ✅ Database schema: CORRECT (based on model definition)

**Conclusion**: Code looks correct. Issue is likely:
1. Data not being sent (frontend state issue)
2. Data being filtered/modified in transit
3. Silent error during save
4. Data saved but not queried/displayed correctly

**The debug logs will reveal the exact issue!** 🎯

---

**Created By**: GitHub Copilot  
**Date**: November 2, 2025  
**Issue**: Quiz created but settings and questions not saved  
**Status**: Investigation in progress - awaiting diagnostic results
