# Quick Debugging Checklist ✅

## Issue: Quiz created but settings and questions not saved

### Prerequisites
- [ ] Backend server is running
- [ ] Frontend is running  
- [ ] Browser DevTools are open (F12)
- [ ] Console tab visible
- [ ] Network tab visible

---

## Test Process

### 1. Create Test Quiz
Fill in these SPECIFIC values:
- **Title**: DEBUG TEST
- **Time limit**: 30 minutes
- **Max attempts**: 3
- **Passing score**: 75%
- **Add 2 questions**:
  - Question 1: "What is a closure?" (multiple choice, 3 answers)
  - Question 2: "Is JavaScript single-threaded?" (true/false, 2 answers)

### 2. Browser Console - Check BEFORE Submit
```
Look for: "Current questions in state"
Expected: Array with 2 questions
Actual: ________________

Look for: "Quiz data being sent" 
Expected: Object with time_limit: 30, questions: [...]
Actual: ________________
```

### 3. Network Tab - Check Request
- [ ] Click on POST `/api/v1/instructor/assessments/quizzes`
- [ ] View "Payload" or "Request" tab

```
Does payload include time_limit? YES / NO / VALUE: ______
Does payload include max_attempts? YES / NO / VALUE: ______
Does payload include passing_score? YES / NO / VALUE: ______
Does payload include questions array? YES / NO / COUNT: ______
```

### 4. Network Tab - Check Response
- [ ] View "Response" or "Preview" tab

```
Does response include quiz.time_limit? YES / NO / VALUE: ______
Does response include quiz.questions? YES / NO / COUNT: ______
Status code: ______
```

### 5. Backend Terminal - Check Logs
```
Look for: "=== CREATE QUIZ ENDPOINT ==="
Present? YES / NO

Look for: "time_limit: 30"
Present? YES / NO / VALUE: ______

Look for: "Questions in data: [...]"
Present? YES / NO / COUNT: ______

Look for: "=== QUIZ CREATED ==="
Present? YES / NO

Look for: "Time limit: 30" (after creation)
Present? YES / NO / VALUE: ______

Look for: "Questions count: 2"
Present? YES / NO / VALUE: ______
```

### 6. Browser Console - Check AFTER Submit
```
Look for: "Quiz created successfully"
Expected: Object with time_limit: 30, questions: [...]
Actual: ________________

Look for: "Questions in created quiz"
Expected: Array with 2 questions
Actual: ________________
```

---

## Results

### Where does data disappear?

**Step where data is PRESENT**: Step # ______

**Step where data is MISSING**: Step # ______

### Specific Fields Missing

Settings:
- [ ] time_limit missing
- [ ] max_attempts missing
- [ ] passing_score missing
- [ ] shuffle_questions missing
- [ ] shuffle_answers missing

Questions:
- [ ] questions array is empty
- [ ] questions array is undefined
- [ ] questions count is 0 in response

---

## Quick Fixes Based on Results

### If data missing at Step 2 (Browser Console "Quiz data being sent")
**Problem**: Frontend form state not updated
**Check**: 
```typescript
console.log('quizForm:', quizForm);
console.log('currentQuestions:', currentQuestions);
```

### If data missing at Step 3 (Network Request)
**Problem**: API service not sending data
**Check**: API client configuration, interceptors

### If data present in Step 3 but missing at Step 4 (Network Response)
**Problem**: Backend processing issue
**Check**: Backend terminal logs for errors

### If data present in Step 4 but missing at Step 5 (Backend Logs After Save)
**Problem**: Database save issue
**Check**: Database constraints, validation errors

### If data present in Step 5 but missing at Step 6 (Frontend After Submit)
**Problem**: Response handling issue
**Check**: API service response parsing

---

## Share These Results

Copy and paste:

```
QUIZ DEBUGGING RESULTS

Test Quiz Values:
- Title: DEBUG TEST
- Time limit: 30
- Max attempts: 3
- Passing score: 75
- Questions: 2

Step 2 (Console before): [PASS/FAIL] - Details: __________
Step 3 (Network request): [PASS/FAIL] - Details: __________
Step 4 (Network response): [PASS/FAIL] - Details: __________
Step 5 (Backend logs): [PASS/FAIL] - Details: __________
Step 6 (Console after): [PASS/FAIL] - Details: __________

Data disappears between Step ___ and Step ___

Missing fields: __________

Error messages (if any): __________
```

---

**This checklist will identify exactly where the problem is!** 🎯
