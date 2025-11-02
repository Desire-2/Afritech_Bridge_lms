# Quiz Questions Debug Guide - Complete Logging Added

## Changes Made

### 1. Backend Logging (`instructor_assessment_routes.py`)
Enhanced the `get_assessments_overview` endpoint with detailed logging:

```python
logger.info(f"[OVERVIEW] Fetching assessments for course {course_id} by user {current_user_id}")
logger.info(f"[OVERVIEW] Found {len(quizzes)} quizzes, {len(assignments)} assignments, {len(projects)} projects")
logger.info(f"[OVERVIEW] Quiz {quiz.id} '{quiz.title}': {question_count} questions")
logger.debug(f"[OVERVIEW] Quiz {quiz.id} first question: {first_q.get('question_text', 'N/A')} ({len(first_q.get('answers', []))} answers)")
logger.info(f"[OVERVIEW] Sending response with {len(quizzes_data)} quizzes")
```

**What to look for in backend logs**:
- `[OVERVIEW] Found X quizzes` - Should show all quizzes in course
- `[OVERVIEW] Quiz X 'Title': Y questions` - Should show question count
- `[OVERVIEW] first question:` - Confirms questions are being serialized
- `[OVERVIEW] Sending response` - Confirms response was built

### 2. Frontend Parent Component Logging (`[courseId]/page.tsx`)
Enhanced `handleAssessmentUpdate` with detailed logging:

```typescript
console.log('[CourseDetailsPage] Starting assessment update refresh...');
console.log('[CourseDetailsPage] Assessments fetched:', updatedAssessments);
console.log(`[CourseDetailsPage] Quiz count: ${updatedAssessments.quizzes?.length || 0}`);
assessments.quizzes.forEach((quiz, idx) => {
  console.log(`[CourseDetailsPage] Quiz ${idx + 1}: "${quiz.title}" has ${quiz.questions?.length || 0} questions`);
  if (quiz.questions && quiz.questions.length > 0) {
    const firstQ = quiz.questions[0];
    console.log(`  └─ First question: "${firstQ.question_text || firstQ.text}"`);
  }
});
```

**What to look for in browser console**:
- `[CourseDetailsPage] Starting assessment update refresh...` - Callback started
- `[CourseDetailsPage] Assessments fetched:` - Data received from API
- `[CourseDetailsPage] Quiz count: X` - Number of quizzes received
- `[CourseDetailsPage] Quiz 1: "Title" has Y questions` - Questions visible in data
- `└─ First question: "..."` - Question details present

### 3. Frontend Assessment Component Logging (`AssessmentManagement.tsx`)
Added useEffect hook to monitor prop changes:

```typescript
useEffect(() => {
  if (assessments?.quizzes) {
    console.log(`[AssessmentManagement] Assessments updated: ${assessments.quizzes.length} quizzes`);
    assessments.quizzes.forEach((quiz, idx) => {
      const qCount = quiz.questions?.length || 0;
      console.log(`  └─ Quiz ${idx + 1}: "${quiz.title}" - ${qCount} questions`);
    });
  }
}, [assessments]);
```

**What to look for in browser console**:
- `[AssessmentManagement] Assessments updated: X quizzes` - Props received
- `└─ Quiz 1: "Title" - Y questions` - Component sees questions in props

## How to Debug

### Step 1: Update a Quiz
1. Open instructor course page
2. Go to "Assessments" tab
3. Edit a quiz
4. Add questions if needed
5. Click "Update Quiz"

### Step 2: Monitor Backend Logs
Watch backend output for:
```
[OVERVIEW] Fetching assessments for course 7 by user 3
[OVERVIEW] Found 1 quizzes, 0 assignments, 0 projects
[OVERVIEW] Quiz 3 'Web Development Fundamentals Quiz': 2 questions
[OVERVIEW] Quiz 3 first question: "What is HTML?" (2 answers)
[OVERVIEW] Sending response with 1 quizzes
```

### Step 3: Check Browser Network Tab
1. Open DevTools → Network tab
2. Find request: `GET /instructor/assessments/courses/7/overview`
3. Click on it → "Response" tab
4. Look for:
```json
{
  "quizzes": [
    {
      "id": 3,
      "title": "Web Development Fundamentals Quiz",
      "questions": [
        {
          "id": 1,
          "question_text": "What is HTML?",
          "answers": [...]
        }
      ]
    }
  ]
}
```

**Questions to ask**:
- Is `questions` array present? ✅
- Does it have items? ✅
- Do items have `question_text` and `answers`? ✅

### Step 4: Check Browser Console
Look for these logs in order:

```
[CourseDetailsPage] Starting assessment update refresh...
  ↓ (wait for network request)
[CourseDetailsPage] Assessments fetched: {...}
[CourseDetailsPage] Quiz count: 1
[CourseDetailsPage] Quiz 1: "Web Development Fundamentals Quiz" has 2 questions
  └─ First question: "What is HTML?"
[CourseDetailsPage] Assessments state updated
  ↓ (wait 500ms)
[AssessmentManagement] Assessments updated: 1 quizzes
  └─ Quiz 1: "Web Development Fundamentals Quiz" - 2 questions
  ✓ Form closes
  ✓ Quiz list shows with questions
```

## Possible Issues & Solutions

### Issue 1: Backend logs show 0 questions
**Symptom**: `[OVERVIEW] Quiz 3 'Title': 0 questions`

**Cause**: Questions not created or not linked to quiz

**Solution**:
1. Check database: `SELECT * FROM questions WHERE quiz_id = 3;`
2. Verify questions were actually created
3. Check quiz_id is correct in questions table

### Issue 2: Backend logs show questions but Network response shows empty array
**Symptom**: Backend logs `2 questions` but response has `questions: []`

**Cause**: Serialization issue - `to_dict(include_questions=True)` not working

**Solution**:
1. Check Question.to_dict() method includes answers
2. Verify answers relationship is properly loaded
3. Look for serialization errors in backend logs

### Issue 3: Network response has questions but console shows none
**Symptom**: Network tab shows questions in response, but `[CourseDetailsPage] Quiz count: 0`

**Cause**: Type mismatch or response parsing issue

**Solution**:
1. Check response data structure
2. Verify field names (quiz_id vs quizzes)
3. Check for JSON parsing errors

### Issue 4: Component receives data but quiz list shows no questions
**Symptom**: `[AssessmentManagement] 1 quizzes` but UI shows empty

**Cause**: Rendering logic issue - component not using assessments prop correctly

**Solution**:
1. Check quiz display code reads from `assessments.quizzes`
2. Verify mapping function includes questions
3. Check for conditionals that hide questions

## Key Data Flow Checks

```
API Call:
  GET /instructor/assessments/courses/7/overview
    ↓
  Backend: find quizzes for course 7
    ↓
  Backend: quiz.to_dict(include_questions=True)
    ↓
  Backend: question.to_dict(include_answers=True) for each
    ↓
  Response: { quizzes: [{ id, title, questions: [...] }] }
    ↓
Frontend: setAssessments(response)
    ↓
Component re-renders with new props
    ↓
Quiz list displays: map(assessments.quizzes).map(questions)
    ↓
✓ Questions visible
```

## Log Search Terms

Use these in browser console filter:
- `[CourseDetailsPage]` - Track parent component
- `[AssessmentManagement]` - Track child component
- `[OVERVIEW]` - Track backend endpoint
- `Quiz count:` - Quick status check
- `questions` - All question-related logs

Use these in backend logs:
- `[OVERVIEW]` - Filter to assessment overview endpoint
- `first question` - Check serialization
- `Sending response` - Endpoint completion

## Next Steps If Issues Found

1. **Questions not in response**: 
   - Debug Quiz.to_dict() method
   - Check Question.questions relationship (lazy='dynamic')
   - Verify answers are included

2. **Questions in response but not displayed**:
   - Check TypeScript types match response structure
   - Verify quiz list rendering code
   - Check for React rendering bugs

3. **Intermittent issues**:
   - Check for race conditions
   - Verify state updates are batched correctly
   - Check Promise handling in callbacks

## Commands to Run

**Check backend logs**:
```bash
# If using Docker
docker logs <container-name> | grep OVERVIEW

# If running locally
tail -f backend.log | grep OVERVIEW
```

**Browser console direct check**:
```javascript
// Copy into console after update completes
const logs = window.console.log;
// Check sessionStorage for logged data
sessionStorage.getItem('assessmentDebug')
```
