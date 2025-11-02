# Quiz Questions Disappearing After Update - Fix Summary

## Problem
After successfully updating a quiz with questions, the quiz form closes but when viewing the quiz list, it shows "no questions" assigned to that quiz, even though the update success message showed the correct number of questions.

## Root Cause
The issue was a timing problem:

1. Quiz updated successfully via backend
2. `onAssessmentUpdate()` callback triggered in AssessmentManagement component
3. Parent component (`[courseId]/page.tsx`) starts fetching fresh data (async)
4. Form closes immediately after calling the callback (without waiting)
5. Parent's fetch completes, but component already re-rendered with stale/empty data
6. Newly fetched data with questions arrives, but form is already closed
7. User sees quiz list without questions

**Root cause**: The parent callback was async but we weren't awaiting it before closing the form.

## Solution

### Frontend Changes

**1. Parent Component** (`frontend/src/app/instructor/courses/[courseId]/page.tsx`)
- Changed `handleAssessmentUpdate` from fire-and-forget to properly async
- Now awaits the fetch before returning
- Ensures state is updated before component re-renders

```typescript
const handleAssessmentUpdate = async () => {
  try {
    const updatedAssessments = await CourseCreationService.getAssessmentsOverview(courseId);
    setAssessments(updatedAssessments);
    console.log('Assessments refreshed after update');
  } catch (error) {
    console.error('Failed to refresh assessments:', error);
  }
};
```

**2. AssessmentManagement Component** (`frontend/src/components/instructor/course-creation/AssessmentManagement.tsx`)
- Updated callback type signature to support async: `() => void | Promise<void>`
- Now awaits the parent callback before closing the form
- Added 500ms delay after callback completes to show success message

```typescript
// Wait for parent to refresh data from backend before closing
try {
  await Promise.resolve(onAssessmentUpdate());
} catch (updateError) {
  console.warn('Error during assessment update callback:', updateError);
}

// Close form with slight delay to show success message
setTimeout(() => {
  setShowForm(false);
  setEditingItem(null);
  resetQuizForm();
}, 500);
```

## Data Flow (After Fix)

1. User clicks "Update Quiz"
2. Backend updates quiz and questions
3. Success message shown
4. `onAssessmentUpdate()` called (async)
5. Parent fetches `/instructor/assessments/courses/{id}/overview`
   - Returns all quizzes with `include_questions=True`
   - Backend response includes: `{ quizzes: [{ id, title, ..., questions: [...] }], ... }`
6. Parent's state updated with fresh data (`setAssessments`)
7. Component re-renders with updated props (new quiz data with questions)
8. Form closes (after parent is done refreshing)
9. Quiz list displays with questions visible

## Files Modified
- `/frontend/src/app/instructor/courses/[courseId]/page.tsx` - Made handleAssessmentUpdate properly async
- `/frontend/src/components/instructor/course-creation/AssessmentManagement.tsx` 
  - Updated callback type signature
  - Added await on callback before closing form

## Verification Checklist
- ✅ Quiz updates successfully
- ✅ Success message shows correct number of questions
- ✅ After 1-2 seconds, form closes
- ✅ Quiz list shows quiz with questions visible
- ✅ Questions persist when viewing the quiz again
