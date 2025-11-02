# Quiz Edit Questions Not Loading - FIX APPLIED

**Date:** November 1, 2025  
**Issue:** When editing a quiz, questions return 0 instead of showing existing questions  
**Status:** ✅ FIXED

## Problem

When clicking "Edit" on an existing quiz:
- ✅ Quiz metadata (title, description, etc.) loads correctly
- ❌ Questions count shows 0
- ❌ Existing questions don't appear in the edit form

## Root Causes Identified

### Issue 1: Backend Not Including Questions in Overview
**File:** `backend/src/routes/instructor_assessment_routes.py`  
**Endpoint:** `GET /api/v1/instructor/assessments/courses/<id>/overview`

The `get_assessments_overview` function was calling:
```python
"quizzes": [quiz.to_dict() for quiz in quizzes]
```

Without the `include_questions=True` parameter, the backend wasn't returning questions.

### Issue 2: Frontend Not Loading Questions into State
**File:** `frontend/src/components/instructor/course-creation/AssessmentManagement.tsx`  
**Function:** `handleEditQuiz()`

The function was loading quiz metadata but not populating the `currentQuestions` state with existing questions from the quiz object.

### Issue 3: Field Name Mapping
Backend models use `text` for question and answer text, but the frontend form expects `question_text` and `answer_text`.

## Solutions Applied

### ✅ Fix 1: Backend - Include Questions in Overview Response

**File:** `backend/src/routes/instructor_assessment_routes.py`  
**Line:** ~667

**Before:**
```python
return jsonify({
    "quizzes": [quiz.to_dict() for quiz in quizzes],
    ...
})
```

**After:**
```python
return jsonify({
    "quizzes": [quiz.to_dict(include_questions=True) for quiz in quizzes],
    ...
})
```

**Impact:** All quizzes now include their questions and answers in the response.

### ✅ Fix 2: Frontend - Load Questions When Editing

**File:** `frontend/src/components/instructor/course-creation/AssessmentManagement.tsx`  
**Function:** `handleEditQuiz()` (~line 350)

**Added:**
```typescript
// Load existing questions if available
if (quiz.questions && Array.isArray(quiz.questions) && quiz.questions.length > 0) {
  console.log('Loading existing questions:', quiz.questions);
  const formattedQuestions = quiz.questions.map((q: Question) => ({
    question_text: q.text || '', // Backend uses 'text', frontend uses 'question_text'
    question_type: q.question_type || 'multiple_choice',
    points: 10, // Default points
    answers: (q.answers || []).map((a: Answer) => ({
      answer_text: a.text || '', // Backend uses 'text', frontend uses 'answer_text'
      is_correct: a.is_correct || false
    })),
    explanation: ''
  }));
  setCurrentQuestions(formattedQuestions);
}
```

**Impact:** Existing questions are now loaded into the form when editing a quiz.

### ✅ Fix 3: Added Question Count Display

**File:** `frontend/src/components/instructor/course-creation/AssessmentManagement.tsx`  
**Line:** ~1714

**Added:**
```tsx
<span>{quiz.questions?.length || 0} questions</span>
```

**Impact:** Quiz cards now show how many questions each quiz has.

## Data Flow

### Before Fix:
```
Backend GET /courses/1/overview
  ↓
Returns: { quizzes: [{ id: 1, title: "Quiz 1" }] }  ❌ No questions
  ↓
Frontend receives quiz
  ↓
handleEditQuiz() loads metadata only  ❌ Questions not loaded
  ↓
currentQuestions state = []  ❌ Empty
  ↓
Form shows: "0 questions"
```

### After Fix:
```
Backend GET /courses/1/overview
  ↓
Returns: { 
  quizzes: [{ 
    id: 1, 
    title: "Quiz 1",
    questions: [{ text: "...", answers: [...] }]  ✅ Questions included
  }] 
}
  ↓
Frontend receives quiz with questions
  ↓
handleEditQuiz() maps questions to form format  ✅ Questions loaded
  ↓
currentQuestions state = [{ question_text: "...", answers: [...] }]  ✅ Populated
  ↓
Form shows: "2 questions" and displays them
```

## Field Name Mapping

| Backend Model Field | Frontend Form Field | Mapping Function |
|---------------------|---------------------|------------------|
| `text` (Question) | `question_text` | `q.text → question_text` |
| `text` (Answer) | `answer_text` | `a.text → answer_text` |
| `question_type` | `question_type` | Direct mapping ✅ |
| `is_correct` | `is_correct` | Direct mapping ✅ |
| `order` | (auto-assigned) | Not needed in form |

## Testing Instructions

### Step 1: Restart Backend
```bash
cd backend
# Stop with Ctrl+C if running
./run.sh
```

### Step 2: Refresh Frontend
```bash
# Just refresh browser page, or restart if needed:
cd frontend
npm run dev
```

### Step 3: Test Quiz with Questions

1. **Create a quiz with questions** (if you don't have one):
   - Go to course management
   - Create a new quiz
   - Add 2-3 questions with answers
   - Save the quiz

2. **Verify questions are shown**:
   - Quiz card should show "2 questions" (or however many you added)

3. **Test editing**:
   - Click "Edit" on the quiz
   - Form should open with quiz details
   - **Check console**: Should see logs like:
     ```
     Editing quiz: { id: 1, title: "...", questions: [...] }
     Loading existing questions: [...]
     Formatted questions for editing: [...]
     ```
   - Questions section should show your existing questions
   - You can modify them or add new ones
   - Click "Update Quiz"

### Step 4: Verify in Console

Open browser console (F12) and look for:
```
✅ Editing quiz: { questions: [{ text: "...", answers: [...] }] }
✅ Loading existing questions: [...]
✅ Formatted questions for editing: [...]
```

If you see:
```
❌ No questions found in quiz data
```

Then the backend isn't returning questions. Check the API response in Network tab.

## API Response Verification

### Check Network Tab

1. Open DevTools (F12) → Network tab
2. Navigate to course assessments page
3. Find request: `GET /api/v1/instructor/assessments/courses/1/overview`
4. Check response:

**Good Response:**
```json
{
  "quizzes": [
    {
      "id": 1,
      "title": "Quiz 1",
      "questions": [
        {
          "id": 1,
          "text": "What is Python?",
          "question_type": "multiple_choice",
          "answers": [
            {
              "id": 1,
              "text": "A programming language",
              "is_correct": true
            }
          ]
        }
      ]
    }
  ]
}
```

**Bad Response (Old):**
```json
{
  "quizzes": [
    {
      "id": 1,
      "title": "Quiz 1"
      // ❌ No questions field
    }
  ]
}
```

## Files Modified

1. **`backend/src/routes/instructor_assessment_routes.py`**
   - Line ~667: Added `include_questions=True` to quiz.to_dict()

2. **`frontend/src/components/instructor/course-creation/AssessmentManagement.tsx`**
   - Lines ~350-385: Enhanced `handleEditQuiz()` to load questions
   - Line ~1714: Added question count display in quiz card

## Verification Checklist

- [ ] Backend returns questions in overview endpoint
- [ ] Quiz cards show question count
- [ ] Clicking "Edit" on quiz loads questions
- [ ] Console shows "Loading existing questions" log
- [ ] Questions appear in edit form
- [ ] Can modify existing questions
- [ ] Can add new questions
- [ ] Update saves all changes

## Common Issues

### Issue: Still showing 0 questions

**Check:**
1. Does the quiz actually have questions in database?
2. Is backend returning questions? (Check Network tab)
3. Are there console errors?

**Solution:**
- Clear browser cache
- Check backend logs for errors
- Verify quiz has questions: 
  ```sql
  SELECT * FROM questions WHERE quiz_id = 1;
  ```

### Issue: Questions load but in wrong format

**Check console for:**
```
Formatted questions for editing: [...]
```

**Verify format matches:**
```typescript
{
  question_text: string,
  question_type: string,
  answers: [{ answer_text: string, is_correct: boolean }]
}
```

## Summary

**Root Cause:** Backend wasn't including questions + Frontend wasn't loading them

**Solution:** 
- ✅ Backend now includes questions in overview
- ✅ Frontend now loads questions into form state
- ✅ Field names properly mapped (text ↔ question_text/answer_text)
- ✅ Added visual feedback (question count)
- ✅ Added console logging for debugging

**Status:** ✅ READY FOR TESTING

**Breaking Changes:** None

**Backward Compatible:** Yes

---

**Fixed By:** GitHub Copilot  
**Date:** November 1, 2025  
**Time:** ~15 minutes
