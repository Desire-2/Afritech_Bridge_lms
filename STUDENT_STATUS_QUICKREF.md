# Student Submission Status - Quick Reference

## What Was Implemented

Students can now see the **current status** of all their assignment and project submissions in one place.

## Access

Navigate to: **`/student/assessments`**

## Status Types

| Status | Badge Color | Meaning |
|--------|------------|---------|
| **Not Submitted** | Yellow | Assignment/project not yet submitted |
| **Submitted - Pending Grade** | Blue | Submitted, waiting for instructor review |
| **Graded** | Green | Instructor has graded and provided feedback |
| **Not Submitted - Overdue** | Red | Past due date, not submitted |

## Features

### Dashboard Statistics
- **Average Grade** - Overall performance percentage
- **Completed** - Number of graded vs total assessments
- **Pending Review** - Submissions awaiting grading
- **Overdue** - Past due date without submission

### Assessment Cards
Each card shows:
- ✅ **Title & Course** - Assessment name and course
- 📅 **Due Date** - With countdown or "overdue" indicator
- 🎯 **Status Badge** - Current submission status
- 💯 **Points Possible** - Maximum points
- 🏆 **Grade** - Letter grade (A-F) and percentage (if graded)
- 💬 **Feedback** - Instructor comments (if available)
- ⏰ **Submission Date** - When submitted
- ⚠️ **Late Indicator** - Shows if submitted late

### Tabs
- **Assignments Tab** - All assignments with counts
- **Projects Tab** - All projects with counts

## How Grading Works

1. **Student submits** assignment/project
   - Status: "Submitted - Pending Grade" (Blue)

2. **Instructor grades** via grading center
   - Assigns numeric grade
   - Writes feedback
   - Saves changes

3. **Student sees update** on assessments page
   - Status: "Graded" (Green)
   - Grade displayed with letter (A-F)
   - Feedback visible in blue box

## API Endpoints

### Assignments
- `GET /api/v1/student/assignments` - List with status
- `GET /api/v1/student/assignments/<id>/details` - Details
- `POST /api/v1/student/assignments/<id>/submit` - Submit

### Projects
- `GET /api/v1/student/projects` - List with status
- `GET /api/v1/student/projects/<id>/details` - Details
- `POST /api/v1/student/projects/<id>/submit` - Submit

## Files Created

### Backend
- Added project endpoints to `/backend/src/routes/student_routes.py`

### Frontend
- `/frontend/src/services/student-submission.service.ts` - API service
- `/frontend/src/app/student/assessments/page.tsx` - UI page

## Technical Details

### Status Logic
```
IF graded → Status: "graded" (Green)
ELSE IF submitted → Status: "submitted" (Blue)
ELSE IF past due date → Status: "late" (Red)
ELSE → Status: "not_submitted" (Yellow)
```

### Grade Display
- **Numeric**: 95 / 100
- **Percentage**: 95.0%
- **Letter**: A (90-100), B (80-89), C (70-79), D (60-69), F (<60)

## Example Card

```
┌─────────────────────────────────────────┐
│ Introduction to Python                   │ [Graded ✓] [Submitted]
│ 📄 Python Programming                    │
│ 📅 Due: Feb 15, 2024, 11:59 PM         │
├─────────────────────────────────────────┤
│ Points Possible: 100                     │
│                                          │
│ ┌─────────────────────────────────────┐ │
│ │ Your Grade:              🏆 A        │ │
│ │ Score: 95 / 100 (95.0%)              │ │
│ │ Graded on Feb 15, 2024 by Dr. Smith  │ │
│ └─────────────────────────────────────┘ │
│                                          │
│ Instructor Feedback:                     │
│ ┌─────────────────────────────────────┐ │
│ │ Excellent work! Clear code with      │ │
│ │ good documentation.                   │ │
│ └─────────────────────────────────────┘ │
│                                          │
│ Submitted on Feb 14, 2024, 6:30 PM      │
│                                          │
│ [View Details →]                         │
└─────────────────────────────────────────┘
```

## Testing Steps

1. **View Assessments**
   ```
   Navigate to /student/assessments
   → Should see assignments and projects tabs
   → Cards display for each assessment
   ```

2. **Check Status Badges**
   ```
   Not submitted → Yellow badge
   Submitted → Blue badge
   Graded → Green badge with letter grade
   Overdue → Red badge
   ```

3. **View Grades**
   ```
   Graded items show:
   - Letter grade (A-F)
   - Numeric score
   - Percentage
   - Grading date
   - Instructor name
   ```

4. **Read Feedback**
   ```
   Graded items display feedback in blue box
   Full feedback text visible
   ```

5. **Check Statistics**
   ```
   Dashboard shows:
   - Average grade percentage
   - Completed count
   - Pending count
   - Overdue count
   ```

## Related Documentation

- **Instructor Grading**: See `GRADING_SYSTEM_IMPROVEMENTS.md`
- **Full Details**: See `STUDENT_SUBMISSION_STATUS.md`
- **Backend Routes**: See `/backend/src/routes/student_routes.py`
- **API Service**: See `/frontend/src/services/student-submission.service.ts`
