# Frontend Not Sending Questions - Debug Plan 🔍

## Current Situation

**User Report**: 
- ✅ Frontend shows success message with question count
- ❌ Backend receives NO questions
- ❌ Response shows `Questions in created quiz: undefined`

## Hypothesis

Questions are in the `quizData` object but either:
1. Being stripped by axios serialization
2. Not being sent in HTTP request
3. Being filtered by request interceptor
4. Type mismatch causing serialization failure

## Enhanced Logging Added

### In course-creation.service.ts:

Now logs:
```typescript
[CourseCreationService] Quiz data BEFORE sending: {object}
[CourseCreationService] Questions in data: [array]
[CourseCreationService] Questions count: 2
[CourseCreationService] Stringified data: {json}
```

### In backend (when working):
```
================================================================================
CREATE QUIZ ENDPOINT HIT - VERSION 2025-11-02 10:05
Questions in request: 2
================================================================================
```

## Test Process

### Step 1: Create a New Quiz

Fill in:
- Title: "Frontend Debug Test"
- Time limit: 30
- Max attempts: 3
- Add 2 questions with answers

### Step 2: Check Browser Console

Look for these logs in order:

**1. AssessmentManagement (before sending):**
```
=== CREATING QUIZ ===
Current questions in state: [{...}, {...}]
Quiz data being sent: {
  "title": "...",
  "questions": [...]  // ← Should have 2 items
}
```

**2. CourseCreationService (preparing request):**
```
[CourseCreationService] Creating quiz at: /instructor/assessments/quizzes
[CourseCreationService] Quiz data BEFORE sending: {object}
[CourseCreationService] Questions in data: [Array(2)]
[CourseCreationService] Questions count: 2
[CourseCreationService] Stringified data: {
  "questions": [...]  // ← Should be full JSON
}
```

**3. CourseCreationService (after response):**
```
[CourseCreationService] Quiz created response: {object}
[CourseCreationService] Response has questions?: false  // ← Currently false
[CourseCreationService] Response questions: undefined  // ← Currently undefined
```

### Step 3: Check Network Tab

1. Open DevTools → Network tab
2. Find the POST request to `/instructor/assessments/quizzes`
3. Click on it
4. Go to "Payload" or "Request" tab
5. Check if `questions` array is present

**Expected:**
```json
{
  "title": "Frontend Debug Test",
  "course_id": 7,
  "questions": [
    {
      "question_text": "...",
      "answers": [...]
    },
    ...
  ]
}
```

**If questions are MISSING in payload:**
- Problem is in axios serialization or request interceptor

**If questions are PRESENT in payload:**
- Problem is in backend not processing them

### Step 4: Check Backend Logs

Look for:
```
================================================================================
CREATE QUIZ ENDPOINT HIT - VERSION 2025-11-02 10:05
Questions in request: 2
================================================================================
```

**If you see this:**
- Backend IS receiving questions ✅
- Problem is in database save or response serialization

**If you DON'T see this:**
- Backend code not loaded OR
- Questions not in request

## Possible Issues & Solutions

### Issue 1: Questions Field is `undefined` Instead of Empty Array

**Check in console:**
```javascript
Quiz data being sent: {
  "questions": undefined  // ← BAD!
}
```

**Solution:** Change in AssessmentManagement.tsx:
```typescript
// Current:
questions: currentQuestions.length > 0 ? currentQuestions : undefined

// Should be:
questions: currentQuestions  // Always send the array
```

### Issue 2: Questions Have Wrong Field Names

**Check:** Questions should have `question_text` and `answer_text`, not `text`

**Current format (should be):**
```javascript
{
  question_text: "...",  // ✅
  answers: [
    { answer_text: "...", is_correct: true }  // ✅
  ]
}
```

**If using wrong names:**
```javascript
{
  text: "...",  // ❌ Backend won't recognize
  answers: [
    { text: "...", is_correct: true }  // ❌
  ]
}
```

### Issue 3: Circular Reference in Questions

If questions have circular references, JSON.stringify will fail.

**Check console for:**
```
TypeError: Converting circular structure to JSON
```

### Issue 4: Questions Array Too Large

If questions array is very large, axios might truncate it.

**Check:**
```javascript
[CourseCreationService] Questions count: 2  // Should match actual count
```

### Issue 5: Axios Timeout During Serialization

Large payloads might timeout.

**Check for:**
```
Error: timeout of 8000ms exceeded
```

## Debug Checklist

Run through and note results:

- [ ] Console shows "Current questions in state: [Array(2)]"?
- [ ] Console shows "Quiz data being sent" with questions field?
- [ ] Console shows "Questions in data: [Array(2)]"?
- [ ] Console shows "Questions count: 2"?
- [ ] Console shows full stringified data with questions?
- [ ] Network tab shows questions in request payload?
- [ ] Backend logs show "Questions in request: 2"?
- [ ] Backend logs show "Questions saved to DB: 2"?
- [ ] Response in Network tab has questions array?
- [ ] Console shows "Response has questions?: true"?

## Expected Flow (All Should Be True)

1. ✅ Questions in state → console shows array
2. ✅ Questions in quizData → console shows questions field
3. ✅ Questions sent to service → console shows count
4. ✅ Questions in HTTP request → Network tab shows questions
5. ✅ Backend receives questions → backend logs show count
6. ✅ Backend saves questions → backend logs show saved count
7. ✅ Backend returns questions → response has questions array
8. ✅ Frontend receives questions → console shows questions

## Action Required

1. **Save** all file changes (frontend service updated)
2. **Refresh** browser (hard refresh: Ctrl+Shift+R)
3. **Create** a new quiz with 2 questions
4. **Check** all the logs in order
5. **Note** which step shows questions missing
6. **Share** the results

---

**The enhanced logging will show EXACTLY where questions disappear!** 🎯
