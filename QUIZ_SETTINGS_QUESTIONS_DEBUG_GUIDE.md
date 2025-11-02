# Quiz Settings & Questions Not Saving - Debugging Guide 🔍

## Date: November 2, 2025

## 🚨 Issue Report
**User states**: "quiz is created but settings and questions are not created on this quiz"

## 🔍 Investigation Steps

### 1. Check Browser Console Logs

When creating a quiz, look for these console messages:

```
=== CREATING QUIZ ===
Current questions in state: [...]
Quiz data being sent: {
  "title": "...",
  "time_limit": 30,
  "passing_score": 70,
  "questions": [...]
}
```

**What to verify:**
- ✅ Are questions present in "Current questions in state"?
- ✅ Are questions present in "Quiz data being sent"?
- ✅ Are settings (time_limit, passing_score, etc.) present?

### 2. Check Network Tab

Open browser DevTools → Network tab:

1. Filter by "quizzes"
2. Create a quiz
3. Click on the POST request to `/api/v1/instructor/assessments/quizzes`
4. Check **Request Payload**:

```json
{
  "title": "My Quiz",
  "course_id": 1,
  "time_limit": 30,
  "max_attempts": 3,
  "passing_score": 70,
  "shuffle_questions": true,
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

**What to verify:**
- ✅ Is the request payload complete?
- ✅ Are settings included?
- ✅ Are questions included?

5. Check **Response**:

```json
{
  "message": "Quiz created successfully",
  "quiz": {
    "id": 15,
    "title": "My Quiz",
    "time_limit": 30,
    "questions": [...]
  }
}
```

**What to verify:**
- ✅ Does the response include settings?
- ✅ Does the response include questions?

### 3. Check Backend Logs

With the new debug logging added, you should see in backend terminal:

```
=== CREATE QUIZ ENDPOINT ===
Received data: {...}
Questions in data: [...]
Quiz settings:
  - time_limit: 30
  - max_attempts: 3
  - passing_score: 70
  - shuffle_questions: True
  - shuffle_answers: False

=== QUIZ CREATED ===
Quiz ID: 15
Quiz title: My Quiz
Time limit: 30
Max attempts: 3
Passing score: 70
Questions count: 2
  - Question 1: What is a closure?... (3 answers)
  - Question 2: Is JavaScript single-threaded?... (2 answers)
```

**What to verify:**
- ✅ Is the backend receiving the data?
- ✅ Are settings being saved to the database?
- ✅ Are questions being created?

## 🐛 Common Issues & Solutions

### Issue 1: Questions Array is Empty

**Symptoms:**
- Questions shown in UI but not sent
- Console shows: `questions: undefined` or `questions: []`

**Causes:**
- Questions not in state (`currentQuestions`)
- Question builder collapsed (questions not visible)

**Solution:**
✅ Already fixed with:
- Auto-expand question builder
- Visual indicators
- Updated TypeScript types

### Issue 2: Settings Not Sent

**Symptoms:**
- Settings filled in form but not in API request
- Default values used instead of form values

**Possible Causes:**
- Form state not updated
- Settings fields not included in `quizData`

**Debug:**
```typescript
console.log('Quiz form state:', quizForm);
console.log('Quiz data to send:', quizData);
```

**Fix if needed:**
Check that all form fields are in `quizForm` state and included in `quizData` object

### Issue 3: Data Type Mismatches

**Symptoms:**
- Backend receives data but doesn't save it
- Type conversion errors in backend logs

**Possible Causes:**
- Frontend sends string, backend expects integer
- Date format issues
- Boolean conversion issues

**Current safeguards:**
```typescript
time_limit: quizForm.time_limit ? parseInt(quizForm.time_limit) : undefined
max_attempts: quizForm.max_attempts ? parseInt(quizForm.max_attempts) : undefined
passing_score: quizForm.passing_score  // Already a number
```

**Backend safeguards:**
```python
time_limit=int(data['time_limit']) if data.get('time_limit') and str(data['time_limit']).strip() else None
```

### Issue 4: Backend Database Constraints

**Symptoms:**
- Quiz created but questions not saved
- Error in backend logs about constraint violations

**Check:**
- Foreign key constraints (quiz_id, question_id)
- Required fields (text, is_correct)
- Data validation

**Backend has safeguards:**
```python
# Skip questions without text
if not question_text:
    continue

# Skip empty answers
if not answer_text:
    continue
```

### Issue 5: Transaction Rollback

**Symptoms:**
- Quiz appears created but disappears
- Questions not persisted

**Cause:**
- Exception after quiz creation but before commit
- Database transaction rolled back

**Backend protection:**
```python
try:
    # ... create quiz and questions ...
    db.session.commit()
except Exception as e:
    db.session.rollback()
    return jsonify({"error": str(e)}), 500
```

## 🔧 Quick Fixes to Try

### Fix 1: Restart Backend Server

The debug logging was just added. Restart backend to see logs:

```bash
cd /home/desire/My_Project/AB/afritec_bridge_lms/backend
pkill -f "flask run"
FLASK_APP=src.app FLASK_ENV=development flask run --host=0.0.0.0 --port=5000
```

### Fix 2: Clear Browser Cache

Sometimes old JavaScript is cached:

1. Open DevTools → Network tab
2. Check "Disable cache"
3. Hard reload: Ctrl+Shift+R (Linux) or Cmd+Shift+R (Mac)

### Fix 3: Check Database Directly

Connect to database and verify:

```python
# In backend directory
python
>>> from src.app import app, db
>>> from src.models.course_models import Quiz, Question, Answer
>>> with app.app_context():
...     quiz = Quiz.query.order_by(Quiz.id.desc()).first()
...     print(f"Latest quiz: {quiz.title}")
...     print(f"Time limit: {quiz.time_limit}")
...     print(f"Questions: {len(quiz.questions)}")
...     for q in quiz.questions:
...         print(f"  - {q.text} ({len(q.answers)} answers)")
```

### Fix 4: Verify API Response is Used

Check that frontend uses the response correctly:

```typescript
const createdQuiz = await CourseCreationService.createQuiz(quizData);
console.log('Created quiz from response:', createdQuiz);

// This should trigger a refresh
onAssessmentUpdate();
```

## 📋 Step-by-Step Debugging Process

### Step 1: Test Quiz Creation
1. Open browser DevTools (F12)
2. Go to Console tab
3. Go to Network tab
4. Create a new quiz with:
   - Title: "Debug Test Quiz"
   - Time limit: 30 minutes
   - Max attempts: 3
   - Passing score: 70%
   - 2 questions with answers

### Step 2: Verify Frontend Sends Data
Check Console logs:
- [ ] "Current questions in state" shows 2 questions?
- [ ] "Quiz data being sent" includes settings?
- [ ] "Quiz data being sent" includes questions?

Check Network tab:
- [ ] POST request to `/api/v1/instructor/assessments/quizzes`?
- [ ] Request payload includes all data?
- [ ] Response status is 201?
- [ ] Response includes quiz with questions?

### Step 3: Verify Backend Receives Data
Check backend terminal:
- [ ] "=== CREATE QUIZ ENDPOINT ===" appears?
- [ ] "Received data" shows complete data?
- [ ] "Questions in data" shows questions?
- [ ] Quiz settings values are correct?

### Step 4: Verify Backend Saves Data
Check backend terminal:
- [ ] "=== QUIZ CREATED ===" appears?
- [ ] Quiz ID is assigned?
- [ ] Settings values match what was sent?
- [ ] Questions count matches?
- [ ] Each question has answers?

### Step 5: Verify UI Updates
- [ ] Success message appears?
- [ ] Quiz appears in list?
- [ ] Quiz shows question count badge?
- [ ] Can edit quiz and see questions?

## 🎯 Expected vs Actual

### Expected Behavior
1. User fills quiz form with settings and questions
2. Frontend sends complete data to backend
3. Backend creates quiz with all settings
4. Backend creates questions with answers
5. Backend commits transaction
6. Backend returns complete quiz object
7. Frontend shows success message
8. Quiz list refreshes with new quiz
9. Quiz shows correct settings and question count

### If Settings Not Saved
**Symptom**: Quiz created but time_limit, passing_score, etc. are NULL or default

**Check:**
1. Are settings in the request payload? (Network tab)
2. Does backend receive them? (Backend logs: "Quiz settings:")
3. Are they being set on the Quiz object? (Check Quiz creation code)
4. Are they in the database? (Direct DB query)

**Likely cause**: Field name mismatch or type conversion issue

### If Questions Not Saved
**Symptom**: Quiz created but questions array is empty

**Check:**
1. Are questions in the request payload? (Network tab)
2. Does backend receive them? (Backend logs: "Questions in data:")
3. Is the loop processing them? (Add prints inside the loop)
4. Are Questions being added to db.session?
5. Is commit successful?

**Likely cause**: 
- Questions field empty in frontend
- Backend skipping questions due to validation
- Transaction rollback due to error

## 🔬 Advanced Debugging

### Add More Detailed Backend Logging

In the questions loop:
```python
for idx, question_data in enumerate(questions_data):
    print(f"Processing question {idx + 1}: {question_data}")
    question_text = question_data.get('text') or question_data.get('question_text')
    print(f"  Extracted text: {question_text}")
    
    if not question_text:
        print(f"  SKIPPING - no text found")
        continue
    
    # ... create question ...
    print(f"  Created question with ID: {question.id}")
    
    answers_data = question_data.get('answers', [])
    print(f"  Processing {len(answers_data)} answers")
    
    for answer_idx, answer_data in enumerate(answers_data):
        print(f"    Answer {answer_idx + 1}: {answer_data}")
        # ... create answer ...
```

### Check for Silent Failures

Add try-catch around question creation:
```python
try:
    question = Question(...)
    db.session.add(question)
    db.session.flush()
except Exception as e:
    print(f"ERROR creating question: {e}")
    continue  # or raise
```

## 📝 Diagnostic Checklist

Run through this checklist and note where it fails:

Frontend:
- [ ] Form fields populate `quizForm` state correctly
- [ ] Questions populate `currentQuestions` array correctly
- [ ] `quizData` object includes all fields
- [ ] `quizData.questions` is not undefined
- [ ] API call sends complete data
- [ ] No errors in browser console
- [ ] Response contains quiz with questions

Backend:
- [ ] Endpoint receives request
- [ ] `data` parameter contains all fields
- [ ] `data['questions']` exists and has items
- [ ] Quiz object created with all settings
- [ ] Questions loop executes
- [ ] Question objects created
- [ ] Answer objects created
- [ ] `db.session.commit()` succeeds
- [ ] No errors in backend logs
- [ ] Response includes quiz with questions

Database:
- [ ] Quiz record exists
- [ ] Quiz settings fields have values (not NULL)
- [ ] Question records exist with correct quiz_id
- [ ] Answer records exist with correct question_id

## 🚀 Next Steps

1. **Restart backend server** to enable debug logging
2. **Create a test quiz** with settings and questions
3. **Check all three logs**:
   - Browser console
   - Network tab
   - Backend terminal
4. **Identify where data is lost**:
   - Not sent from frontend?
   - Not received by backend?
   - Not saved to database?
5. **Report findings** with specific error messages or missing data points

## 📦 Files Modified for Debugging

- ✅ `backend/src/routes/instructor_assessment_routes.py`
  - Added detailed logging before and after quiz creation
  - Logs show exactly what's received and what's saved

---

**Status**: 🔍 **DEBUGGING IN PROGRESS**

The code looks correct on both frontend and backend. The issue might be:
1. Data not being sent (check Network tab)
2. Data being sent but not processed (check backend logs)
3. Data processed but not committed (check for errors)
4. Data committed but not displayed (check UI refresh)

**Use the debug logs to pinpoint exactly where the data flow breaks!**

---

**Created By**: GitHub Copilot  
**Date**: November 2, 2025  
**Issue**: Quiz created but settings and questions not saved  
**Status**: Awaiting diagnostic results
