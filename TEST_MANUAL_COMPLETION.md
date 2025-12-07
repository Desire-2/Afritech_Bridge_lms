# Manual Lesson Completion Feature - Test Plan

## Overview
Added a "Mark as Complete" button that allows students to manually complete lessons when all requirements are satisfied.

## What Was Changed

### Frontend Changes

1. **Page Component** (`frontend/src/app/(learn)/learn/[id]/page.tsx`)
   - Added `handleManualCompletion` function that:
     - Force saves current progress
     - Calls the completion API with time_spent, reading_progress, engagement_score, and scroll_progress
     - Updates local state (lessonCompletionStatus, quizCompletionStatus)
     - Recalculates module score
     - Shows celebration modal
     - Triggers module unlock check
   
   - Added `canManuallyComplete` function that validates:
     - Lesson is not already completed
     - Lesson score is >= 80%
     - Quiz is passed (if quiz exists)
     - All assignments are graded (if assignments exist)

2. **LessonContent Component** (`frontend/src/app/(learn)/learn/[id]/components/LessonContent.tsx`)
   - Added two new props: `onManualComplete` and `canManuallyComplete`
   - Added "Mark as Complete" button in the progress section (shown when `canManuallyComplete` is true)
   - Button displays current scores (lesson, reading, engagement)
   - Added requirements message when score is between 60-79%

### Backend (Already Exists)

The backend already has complete support:
- `/student/lessons/<lesson_id>/complete` endpoint accepts progress data
- `LessonCompletion` model has `calculate_lesson_score()` method
- Dynamic scoring based on available assessments (reading, engagement, quiz, assignment)
- Automatic module score recalculation after lesson completion

## Requirements Validation

The button appears ONLY when ALL of the following are met:

1. **Lesson Score >= 80%**: Calculated from reading, engagement, quiz, and assignment scores
2. **Reading Progress**: Tracked automatically as user scrolls/reads
3. **Engagement Score**: Based on time spent, interactions, and consistency
4. **Quiz Passed** (if quiz exists): Must achieve the quiz passing score
5. **Assignments Graded** (if assignments exist): All assignments must have a grade

## Testing Instructions

### Test Case 1: Lesson Without Quiz/Assignment
1. Open any lesson that has no quiz or assignment
2. Read through the lesson content (scroll to track progress)
3. Wait for reading progress to reach ~80%
4. Verify lesson score shows >= 80%
5. "Mark as Complete" button should appear
6. Click the button
7. Verify:
   - Success message appears
   - Celebration modal shows
   - Sidebar shows lesson as completed (green checkmark)
   - Module score updates

### Test Case 2: Lesson With Quiz
1. Open a lesson that has a quiz
2. Read the lesson content
3. Take and pass the quiz (score >= passing score)
4. Return to content tab
5. Verify lesson score is >= 80%
6. "Mark as Complete" button should appear
7. Complete the lesson
8. Verify completion and score update

### Test Case 3: Lesson With Assignment
1. Open a lesson with an assignment
2. Read the lesson content
3. Submit the assignment
4. Wait for instructor to grade it
5. Once graded, return to content tab
6. Verify "Mark as Complete" button appears
7. Complete the lesson

### Test Case 4: Requirements Not Met
1. Open any lesson
2. Verify button does NOT appear when:
   - Reading progress < 80%
   - Quiz not passed (if quiz exists)
   - Assignments not graded (if assignments exist)
3. Verify a helpful message shows what's needed

### Test Case 5: Already Completed
1. Open a lesson that's already completed
2. Verify:
   - "Lesson Completed!" banner shows
   - "Mark as Complete" button does NOT appear
   - Can still review content

## Error Handling

The system handles these error cases:

1. **Quiz Required but Not Passed**: Shows alert with quiz requirement message
2. **API Failure**: Shows user-friendly error alert
3. **Already Completed**: Recognizes and handles gracefully
4. **Network Error**: Shows error message to retry

## Score Calculation

Lesson scores are calculated dynamically:

- **No assessments**: Reading 50% + Engagement 50%
- **Quiz only**: Reading 35% + Engagement 35% + Quiz 30%
- **Assignment only**: Reading 35% + Engagement 35% + Assignment 30%
- **Both Quiz & Assignment**: Reading 25% + Engagement 25% + Quiz 25% + Assignment 25%

All calculations happen on both frontend (for display) and backend (for storage).

## API Endpoints Used

1. `POST /api/v1/student/lessons/{lesson_id}/complete`
   - Request body: `{ time_spent, reading_progress, engagement_score, scroll_progress, completion_method: 'manual' }`
   - Response: `{ message, completion, updated }`

2. `POST /api/v1/student/lessons/{lesson_id}/progress`
   - Used by `forceSaveProgress()` before marking complete
   - Ensures latest progress is saved to database

## Database Updates

When lesson is marked complete:
1. `lesson_completions` table updated with:
   - `completed = true`
   - `reading_progress`, `engagement_score`, `scroll_progress`
   - `time_spent`
2. Module's course contribution score recalculated
3. Module progress status updated if needed

## UI/UX Features

- ✅ Clear visual feedback (green button with checkmark icon)
- ✅ Shows current scores before completion
- ✅ Animated celebration modal on success
- ✅ Sidebar immediately updates to show completion
- ✅ Module unlock check triggered automatically
- ✅ Helpful messages when requirements not met
- ✅ Disabled state while already completed

## Future Enhancements

Potential improvements:
1. Add progress bar showing how close to 80% threshold
2. Show detailed breakdown of what's missing
3. Add confirmation dialog before marking complete
4. Track completion method in analytics (auto vs manual)
