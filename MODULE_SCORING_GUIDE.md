# Module Scoring System Documentation

## Overview
The Afritec Bridge LMS uses a comprehensive weighted scoring system to evaluate student progress through course modules. This document explains how module scores are calculated, requirements for passing, and how to use the related APIs.

## Module Score Calculation

### Scoring Components (Weighted)

Each module's cumulative score is calculated using the following formula:

```
Cumulative Score = (Course Contribution × 10%) + (Quizzes × 30%) + (Assignments × 40%) + (Final Assessment × 20%)
```

#### 1. Course Contribution (10%)
- **Description**: Measures lesson quality and engagement scores
- **Calculation**: Based on the **average engagement score** from all completed lessons in the module
- **Formula**: `Sum(Lesson Engagement Scores) / Number of Completed Lessons`
- **Updates**: Automatically recalculated when lessons are completed
- **Note**: Each lesson has an engagement score (0-100) based on reading progress, time spent, and interaction
- **Future Enhancement**: Will include forum participation and peer help activities

#### 2. Quizzes (30%)
- **Description**: Knowledge checks throughout the module
- **Calculation**: Uses the **best quiz score** achieved
- **Updates**: When quiz is submitted and graded
- **Retakes**: Multiple attempts allowed, highest score counts

#### 3. Assignments (40%) - Highest Weight
- **Description**: Hands-on practical work and projects
- **Calculation**: Uses the **best assignment score** achieved
- **Updates**: When assignment is graded by instructor
- **Retakes**: Can be resubmitted, highest score counts
- **Note**: This is the most important component - focus here for maximum impact

#### 4. Final Assessment (20%)
- **Description**: Comprehensive module assessment
- **Calculation**: Score from the final module assessment
- **Updates**: When final assessment is graded
- **Prerequisites**: Must complete all lessons and assessments before taking
- **Auto-completion trigger**: Automatically checks if module can be completed after final assessment

### Passing Requirements

#### Module Passing Threshold: **80%**
- Student must achieve a cumulative score of at least 80% to pass the module
- All component scores contribute to reaching this threshold
- Passing is required to unlock the next module in the course

#### Attempt System
- **Maximum Attempts per Module**: 3 (configurable per course)
- **Attempt Counter**: Increments when attempting module completion
- **Final Attempt**: If failed on the 3rd attempt, student is suspended from the course
- **Retake Process**: After failure (not final attempt), student can retake assessments

#### Suspension Policy
- Triggered when student fails module after using all attempts
- Student is suspended from the course
- Manual intervention required to reinstate

## Backend API Endpoints

### 1. Get Module Progress
```http
GET /api/v1/student/progress/module/{module_id}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "module": { ... },
    "progress": {
      "id": 1,
      "student_id": 123,
      "module_id": 45,
      "course_contribution_score": 95.0,
      "quiz_score": 85.0,
      "assignment_score": 88.0,
      "final_assessment_score": 90.0,
      "cumulative_score": 87.7,
      "attempts_count": 1,
      "max_attempts": 3,
      "status": "in_progress",
      "started_at": "2025-01-01T10:00:00Z"
    },
    "time_analytics": { ... }
  }
}
```

### 2. Get Module Score Breakdown (NEW)
```http
GET /api/v1/student/progress/module/{module_id}/score-breakdown
```

**Response:**
```json
{
  "success": true,
  "data": {
    "cumulative_score": 87.7,
    "passing_threshold": 80.0,
    "is_passing": true,
    "points_needed": 0.0,
    "breakdown": {
      "course_contribution": {
        "score": 95.0,
        "weight": 10.0,
        "weighted_score": 9.5,
        "description": "Lesson completion and course engagement"
      },
      "quizzes": {
        "score": 85.0,
        "weight": 30.0,
        "weighted_score": 25.5,
        "description": "Best quiz performance"
      },
      "assignments": {
        "score": 88.0,
        "weight": 40.0,
        "weighted_score": 35.2,
        "description": "Best assignment quality"
      },
      "final_assessment": {
        "score": 90.0,
        "weight": 20.0,
        "weighted_score": 18.0,
        "description": "Final module assessment"
      }
    },
    "recommendations": [
      {
        "priority": "low",
        "area": "course_contribution",
        "message": "Complete all lessons to maximize contribution score (10% of total grade)"
      }
    ],
    "attempts": {
      "used": 1,
      "max": 3,
      "remaining": 2,
      "is_last_attempt": false
    },
    "status": "in_progress",
    "can_proceed": false
  }
}
```

### 3. Complete Lesson
```http
POST /api/v1/student/learning/lesson/{lesson_id}/complete
```

**Body:**
```json
{
  "time_spent": 300,
  "module_id": 45
}
```

**Side Effects:**
- Creates/updates LessonCompletion record
- Recalculates course_contribution_score for the module
- Updates module cumulative_score
- May trigger module status change to 'in_progress'

### 4. Submit Quiz
```http
POST /api/v1/student/assessment/quiz/{quiz_id}/submit
```

**Side Effects:**
- Grades quiz automatically
- Updates quiz_score in ModuleProgress (uses best score)
- Recalculates module cumulative_score
- Quiz score is 30% of total module grade

### 5. Grade Assignment (Instructor)
```http
POST /api/v1/instructor/assessment/assignments/{submission_id}/grade
```

**Body:**
```json
{
  "score": 88.0,
  "feedback": "Excellent work!"
}
```

**Side Effects:**
- Updates assignment_score in ModuleProgress (uses best score)
- Recalculates module cumulative_score
- Assignment score is 40% of total module grade

### 6. Grade Final Assessment (Instructor)
```http
POST /api/v1/instructor/assessment/final-assessments/{submission_id}/grade
```

**Body:**
```json
{
  "score": 90.0,
  "feedback": "Great understanding!"
}
```

**Side Effects:**
- Updates final_assessment_score in ModuleProgress
- Recalculates module cumulative_score
- **Automatically triggers module completion check**
- If score >= 80%, marks module as 'completed'
- If score < 80%, marks as 'failed' and increments attempt counter
- Final assessment is 20% of total module grade

## Frontend Integration

### Using the Progress API Service

```typescript
import ProgressApiService from '@/services/api/progress.service';

// Get basic module progress
const moduleData = await ProgressApiService.getModuleProgress(moduleId);
console.log('Cumulative Score:', moduleData.data.progress.cumulative_score);

// Get detailed score breakdown with recommendations
const scoreBreakdown = await ProgressApiService.getModuleScoreBreakdown(moduleId);
console.log('Is Passing:', scoreBreakdown.is_passing);
console.log('Points Needed:', scoreBreakdown.points_needed);
console.log('Recommendations:', scoreBreakdown.recommendations);
```

### Display Components

#### ModuleScoreBreakdown Component
A comprehensive UI component that displays:
- Overall cumulative score with visual progress indicator
- Pass/fail status with clear messaging
- Detailed breakdown of all four scoring components
- Weight and contribution of each component
- Actionable recommendations based on weak areas
- Attempt tracking with warnings for final attempts

**Usage:**
```tsx
import ModuleScoreBreakdown from '@/components/student/ModuleScoreBreakdown';

<ModuleScoreBreakdown 
  moduleId={45}
  onScoreUpdate={(score) => console.log('Updated score:', score)}
/>
```

#### Integration in Learning Sidebar
The score breakdown is accessible via a clickable badge in the sidebar:
- Shows current cumulative score
- Opens detailed breakdown in a modal dialog
- Updates in real-time as assessments are completed

## Score Update Flow

### Automatic Updates

1. **Lesson Completion**
   - Updates: `course_contribution_score`
   - Recalculates: `cumulative_score`
   - Triggered by: POST `/student/learning/lesson/{id}/complete`

2. **Quiz Submission**
   - Updates: `quiz_score` (if new score is higher)
   - Recalculates: `cumulative_score`
   - Triggered by: POST `/student/assessment/quiz/{id}/submit`

3. **Assignment Grading**
   - Updates: `assignment_score` (if new score is higher)
   - Recalculates: `cumulative_score`
   - Triggered by: Instructor grading

4. **Final Assessment Grading**
   - Updates: `final_assessment_score`
   - Recalculates: `cumulative_score`
   - **Triggers: Module completion check**
   - Triggered by: Instructor grading

### Manual Recalculation
The `calculate_cumulative_score()` method can be called on any ModuleProgress object:

```python
module_progress = ModuleProgress.query.get(id)
cumulative_score = module_progress.calculate_cumulative_score()
db.session.commit()
```

## Best Practices

### For Students

1. **Focus on Assignments** (40% weight)
   - Highest impact on your score
   - Can be resubmitted for improvement
   - Quality over speed

2. **Take Quizzes Seriously** (30% weight)
   - Multiple attempts allowed
   - Best score counts
   - Good for knowledge validation

3. **Complete All Lessons** (10% weight)
   - Easy points to secure
   - Foundation for assessments
   - Unlocks course contribution score

4. **Prepare for Final Assessment** (20% weight)
   - Review all module content
   - Complete after other components
   - Often triggers auto-completion

5. **Monitor Your Progress**
   - Check score breakdown regularly
   - Follow recommendations
   - Track remaining attempts

### For Instructors

1. **Provide Timely Feedback**
   - Grade assignments and assessments promptly
   - Include constructive feedback
   - Help students improve on retakes

2. **Set Clear Expectations**
   - Communicate scoring weights
   - Explain passing requirements
   - Clarify attempt policies

3. **Monitor At-Risk Students**
   - Check students with low scores
   - Identify those on final attempts
   - Provide additional support

## Progression Rules

### Module Unlocking
- Modules unlock sequentially
- Previous module must be completed (status: 'completed')
- Previous module must have cumulative_score >= 80%
- First module is automatically unlocked on enrollment

### Course Completion
- All modules must be completed
- All modules must have cumulative_score >= 80%
- Overall course score = average of all module scores
- Certificate generated when eligible

### Suspension
- Triggered after 3rd failed attempt on any module
- Student cannot continue in course
- Requires administrative intervention
- Enrollment status changed to 'suspended'

## Troubleshooting

### Score Not Updating
1. Check if assessment has been graded
2. Verify module_id is correct in API calls
3. Check browser console for API errors
4. Refresh page to fetch latest data

### Module Won't Complete
1. Verify cumulative_score >= 80%
2. Check if all lessons are completed
3. Ensure final assessment is graded
4. Check attempt count hasn't exceeded maximum

### Score Breakdown Shows Zeros
1. Student may not have started assessments yet
2. Assessments may not be graded yet
3. Module progress may not be initialized
4. Check API endpoint returns data correctly

## Future Enhancements

### Planned Improvements

1. **Enhanced Course Contribution**
   - Forum participation tracking
   - Peer help metrics
   - Attendance/engagement bonuses
   - Timeliness rewards

2. **Adaptive Scoring**
   - Difficulty-adjusted weights
   - Performance-based unlocks
   - Bonus points for excellence

3. **Advanced Analytics**
   - Predictive scoring
   - Weak area identification
   - Personalized recommendations
   - Peer comparison (anonymous)

4. **Gamification Integration**
   - Achievement bonuses
   - Streak multipliers
   - Leaderboard points
   - Badge unlocks

## Related Documentation

- [Student Submission Status Guide](./STUDENT_SUBMISSION_STATUS.md)
- [Grading System Improvements](./GRADING_SYSTEM_IMPROVEMENTS.md)
- [Course Navigation Fix](./COURSE_NAVIGATION_FIX.md)
- [API Documentation](./backend/README.md)

## Support

For technical issues or questions:
- Check backend logs: `/backend/instance/logs/`
- Review frontend console errors
- Consult API response status codes
- Contact system administrator
