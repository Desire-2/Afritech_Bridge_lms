# Dynamic Lesson Scoring System

## Overview

The lesson scoring system has been improved to dynamically adjust weights based on whether a lesson has assessments (quiz and/or assignment) attached to it. This ensures fair scoring for lessons that only contain reading content.

## Problem Solved

Previously, all lessons used a fixed 25% weight for each of the four components:
- Reading Progress: 25%
- Engagement Score: 25%
- Quiz Score: 25%
- Assignment Score: 25%

**Issue**: Lessons without quizzes or assignments could only achieve a maximum score of 50% (Reading 25% + Engagement 25%), which was unfair to students who completed such lessons with high engagement.

## New Dynamic Weight System

### Scenario 1: Lesson with Both Quiz AND Assignment
```
Reading Progress:   25%
Engagement Score:   25%
Quiz Score:         25%
Assignment Score:   25%
─────────────────────────
Total:              100%
```

### Scenario 2: Lesson with ONLY Quiz
```
Reading Progress:   35%
Engagement Score:   35%
Quiz Score:         30%
Assignment Score:   0%
─────────────────────────
Total:              100%
```

### Scenario 3: Lesson with ONLY Assignment
```
Reading Progress:   35%
Engagement Score:   35%
Quiz Score:         0%
Assignment Score:   30%
─────────────────────────
Total:              100%
```

### Scenario 4: Lesson with NO Assessments (Reading Only)
```
Reading Progress:   50%
Engagement Score:   50%
Quiz Score:         0%
Assignment Score:   0%
─────────────────────────
Total:              100%
```

## Implementation Details

### Backend Changes

**File: `/backend/src/models/student_models.py`**

1. Added `has_quiz()` method to check if lesson has a quiz
2. Added `has_assignment()` method to check if lesson has an assignment
3. Updated `calculate_lesson_score()` to use dynamic weights based on available assessments
4. Added `get_score_breakdown()` method to return detailed score breakdown with weights
5. Updated `to_dict()` to include score breakdown information

**File: `/backend/src/routes/student_routes.py`**

1. Updated `get_lesson_progress` endpoint to include:
   - `lesson_score` - The dynamically calculated score
   - `score_breakdown` - Detailed breakdown with scores, weights, and assessment flags
   - `has_quiz` - Boolean flag
   - `has_assignment` - Boolean flag

### Frontend Changes

**File: `/frontend/src/app/(learn)/learn/[id]/components/LessonScoreDisplay.tsx`**

1. Added `hasQuiz` and `hasAssignment` props
2. Dynamic weight calculation based on available assessments
3. Shows only relevant score components (hides Quiz/Assignment when not applicable)
4. Updated formula text to reflect actual weights being used
5. Responsive grid layout (2 columns for reading-only, up to 4 for full assessment)

**File: `/frontend/src/app/(learn)/learn/[id]/page.tsx`**

1. Updated lesson score calculation to use dynamic weights
2. Added console logging with weight information for debugging

**File: `/frontend/src/app/(learn)/learn/[id]/components/LessonContent.tsx`**

1. Passes `hasQuiz` and `hasAssignment` props to `LessonScoreDisplay`

## API Response Example

### Lesson with No Assessments
```json
{
  "lesson_id": 1,
  "progress": {
    "reading_progress": 100,
    "engagement_score": 85,
    "scroll_progress": 100,
    "time_spent": 300,
    "completed": true,
    "lesson_score": 92.5,
    "score_breakdown": {
      "scores": {
        "reading": 100,
        "engagement": 85,
        "quiz": 0,
        "assignment": 0
      },
      "weights": {
        "reading": 50,
        "engagement": 50,
        "quiz": 0,
        "assignment": 0
      },
      "has_quiz": false,
      "has_assignment": false,
      "total_score": 92.5
    },
    "has_quiz": false,
    "has_assignment": false
  }
}
```

### Lesson with Quiz and Assignment
```json
{
  "lesson_id": 2,
  "progress": {
    "reading_progress": 100,
    "engagement_score": 80,
    "scroll_progress": 100,
    "time_spent": 450,
    "completed": true,
    "lesson_score": 82.5,
    "score_breakdown": {
      "scores": {
        "reading": 100,
        "engagement": 80,
        "quiz": 75,
        "assignment": 85
      },
      "weights": {
        "reading": 25,
        "engagement": 25,
        "quiz": 25,
        "assignment": 25
      },
      "has_quiz": true,
      "has_assignment": true,
      "total_score": 85.0
    },
    "has_quiz": true,
    "has_assignment": true
  }
}
```

## Benefits

### For Students
✅ **Fair scoring**: Lessons without assessments can now reach 100%
✅ **Motivation**: High engagement on reading-only lessons is properly rewarded
✅ **Transparency**: UI clearly shows which components contribute to the score
✅ **Accurate feedback**: Score reflects actual effort based on available content

### For Instructors
✅ **Flexible content design**: Can create reading-only lessons without penalizing students
✅ **Better insights**: Can see how students perform based on available assessment types
✅ **Quality metrics**: Engagement-focused metrics for content-heavy lessons

### For System
✅ **Data-driven**: Uses rich engagement metrics already collected
✅ **Backward compatible**: Existing data structure unchanged
✅ **Scalable**: Automatically calculated from existing data
✅ **Maintainable**: Clear separation of concerns between scoring logic and display

## Testing

Run the test script to verify the scoring system:

```bash
cd backend
python test_scoring_tiers.py
```

This will show:
- Individual lesson scores with their weight breakdown
- Assessment status for each lesson
- Module-level aggregation
