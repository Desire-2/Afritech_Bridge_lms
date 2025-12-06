# Student Submission Status Tracking - Implementation Documentation

## Overview

This document describes the implementation of the student submission status tracking feature, which allows students to see the current status of their assignment and project submissions, including grades and instructor feedback.

## Features Implemented

### 1. Backend API Endpoints

#### Assignment Endpoints (Existing - Enhanced)
- **GET `/api/v1/student/assignments`** - Get all assignments with submission status
- **GET `/api/v1/student/assignments/<id>/details`** - Get assignment details with submission
- **POST `/api/v1/student/assignments/<id>/submit`** - Submit an assignment

#### Project Endpoints (New)
- **GET `/api/v1/student/projects`** - Get all projects with submission status
- **GET `/api/v1/student/projects/<id>/details`** - Get project details with submission
- **POST `/api/v1/student/projects/<id>/submit`** - Submit a project

### 2. Submission Status System

Each submission has a status that indicates its current state:

#### Status Values
- **`not_submitted`** - Assignment/project not yet submitted
- **`submitted`** - Submitted but not graded yet (pending review)
- **`graded`** - Graded by instructor with feedback
- **`late`** - Not submitted and past due date (overdue)

#### Status Object Structure
```typescript
{
  id?: number;                    // Submission ID (if exists)
  submitted: boolean;             // Whether submitted
  submitted_at?: string;          // Submission timestamp
  status: 'not_submitted' | 'submitted' | 'graded' | 'late';
  grade?: number;                 // Numeric grade
  feedback?: string;              // Instructor feedback
  graded_at?: string;             // Grading timestamp
  grader_name?: string;           // Instructor name
  is_late: boolean;               // Whether submission is late
  days_late?: number;             // Days past due date
}
```

### 3. Frontend Service

**File**: `/frontend/src/services/student-submission.service.ts`

#### Key Methods

```typescript
// Fetch assessments
StudentSubmissionService.getAssignments(): Promise<AssignmentWithStatus[]>
StudentSubmissionService.getProjects(): Promise<ProjectWithStatus[]>

// Get details
StudentSubmissionService.getAssignmentDetails(id): Promise<SubmissionDetail>
StudentSubmissionService.getProjectDetails(id): Promise<SubmissionDetail>

// Submit
StudentSubmissionService.submitAssignment(id, data): Promise<any>
StudentSubmissionService.submitProject(id, data): Promise<any>

// Utilities
StudentSubmissionService.getStatusBadge(status): { text, color, icon }
StudentSubmissionService.calculatePercentage(grade, maxPoints): number
StudentSubmissionService.getLetterGrade(percentage): string
StudentSubmissionService.isOverdue(dueDate): boolean
StudentSubmissionService.getDaysUntilDue(dueDate): number
```

### 4. Student Assessments Page

**File**: `/frontend/src/app/student/assessments/page.tsx`

#### Features

1. **Dashboard Statistics**
   - Average grade across all assessments
   - Total completed vs total assessments
   - Number of submissions pending review
   - Number of overdue submissions

2. **Tabbed Interface**
   - Assignments tab
   - Projects tab
   - Count badges showing total items

3. **Assessment Cards**
   Each card displays:
   - Title and course name
   - Due date with countdown/overdue indicator
   - Status badge (not submitted, submitted, graded, late)
   - Points possible
   - Grade display (if graded) with letter grade
   - Instructor feedback (if available)
   - Submission timestamp
   - Late submission indicator

4. **Visual Indicators**
   - **Green** - Graded/completed
   - **Blue** - Submitted, pending review
   - **Yellow** - Not submitted, still time
   - **Red** - Overdue/late
   - **Orange** - Due soon (within 3 days)

5. **Action Buttons**
   - "View Details" - Navigate to individual assignment/project page

## Backend Implementation Details

### Assignment Submission Status Logic

```python
# From student_routes.py - GET /student/assignments
submission_status = {
    'submitted': submission is not None,
    'status': 'not_submitted'
}

if submission:
    submission_status['id'] = submission.id
    submission_status['submitted_at'] = submission.submitted_at.isoformat()
    submission_status['is_late'] = submission.submitted_at > assignment.due_date
    
    if submission.grade is not None:
        submission_status['status'] = 'graded'
        submission_status['grade'] = submission.grade
        submission_status['feedback'] = submission.feedback
        submission_status['graded_at'] = submission.graded_at.isoformat()
        submission_status['grader_name'] = submission.grader.full_name
    else:
        submission_status['status'] = 'submitted'
else:
    # Check if overdue
    if assignment.due_date < datetime.utcnow():
        submission_status['status'] = 'late'
        days_late = (datetime.utcnow() - assignment.due_date).days
        submission_status['days_late'] = days_late
        submission_status['is_late'] = True
    else:
        submission_status['is_late'] = False
```

### Project Submission Status Logic

Same logic as assignments, applied to projects:
- Checks for existing submission
- Determines status based on submission and grading state
- Calculates late status based on due date
- Includes grader information when graded

## Database Models

### AssignmentSubmission
```python
class AssignmentSubmission(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    assignment_id = db.Column(db.Integer, db.ForeignKey('assignments.id'))
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    content = db.Column(db.Text)
    file_url = db.Column(db.String(500))
    submitted_at = db.Column(db.DateTime, default=datetime.utcnow)
    grade = db.Column(db.Float, nullable=True)
    feedback = db.Column(db.Text, nullable=True)
    graded_at = db.Column(db.DateTime, nullable=True)
    graded_by = db.Column(db.Integer, db.ForeignKey('users.id'))
```

### ProjectSubmission
```python
class ProjectSubmission(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'))
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    team_members = db.Column(db.Text)  # JSON array of user IDs
    text_content = db.Column(db.Text)
    file_path = db.Column(db.String(500))
    submitted_at = db.Column(db.DateTime, default=datetime.utcnow)
    grade = db.Column(db.Float, nullable=True)
    feedback = db.Column(db.Text, nullable=True)
    graded_at = db.Column(db.DateTime, nullable=True)
    graded_by = db.Column(db.Integer, db.ForeignKey('users.id'))
```

## Usage Examples

### For Students

1. **Navigate to Assessments**
   - Go to `/student/assessments`
   - View all assignments and projects

2. **Check Submission Status**
   - See colored badges indicating status
   - View countdown to due date
   - Check for overdue items

3. **View Grades**
   - Graded items show letter grade (A-F)
   - Percentage and numeric score displayed
   - Grading date and instructor name shown

4. **Read Feedback**
   - Instructor feedback displayed in blue box
   - Full feedback text visible on cards

### For Developers

#### Adding New Assessment Type

1. Create model in `course_models.py`
2. Add submission routes in `student_routes.py`
3. Create service methods in `student-submission.service.ts`
4. Update UI in `assessments/page.tsx`

#### Customizing Status Colors

Edit `getStatusBadge()` in `student-submission.service.ts`:

```typescript
static getStatusBadge(status: SubmissionStatus): {
  text: string;
  color: string;
  icon: string;
} {
  // Customize colors, text, and icons here
}
```

## Integration with Grading System

This feature integrates with the instructor grading system:

1. **Instructor grades submission** via grading center
2. **Grade and feedback saved** to database with timestamp
3. **Student sees update** immediately on assessments page
4. **Status automatically updates** from "submitted" to "graded"

### Data Flow

```
Instructor Grading → Database Update → Student View
     ↓                      ↓                ↓
Grade submission    Update submission   Fetch updated data
Write feedback      Set graded_at       Display grade/feedback
Save changes        Set graded_by       Show status: graded
```

## Testing Checklist

- [ ] Student can view all assignments
- [ ] Student can view all projects
- [ ] Status badges display correctly
- [ ] Due date countdowns work
- [ ] Overdue items marked red
- [ ] Graded items show letter grade
- [ ] Feedback displays when available
- [ ] Statistics calculate correctly
- [ ] Late submissions marked
- [ ] Tabs switch properly
- [ ] Cards link to detail pages
- [ ] Empty states display
- [ ] Loading states work
- [ ] Error handling functions

## Future Enhancements

1. **Filtering & Sorting**
   - Filter by status (graded, pending, overdue)
   - Sort by due date, grade, course
   - Search by title

2. **Grade Analytics**
   - Grade trends over time
   - Comparison with class average
   - Performance by course/subject

3. **Notifications**
   - Email when graded
   - Push notifications for new feedback
   - Reminders for upcoming deadlines

4. **Bulk Actions**
   - Download all feedback
   - Export grades to PDF
   - Print grade report

5. **Submission History**
   - View previous submissions
   - Track resubmissions
   - Version history

6. **Mobile Optimization**
   - Responsive card layout
   - Touch-friendly interactions
   - Offline viewing

## API Response Examples

### GET /api/v1/student/assignments

```json
[
  {
    "id": 1,
    "title": "Introduction to Python",
    "course_id": 5,
    "course_title": "Python Programming",
    "due_date": "2024-02-15T23:59:59",
    "points_possible": 100,
    "submission_status": {
      "id": 42,
      "submitted": true,
      "submitted_at": "2024-02-14T18:30:00",
      "status": "graded",
      "grade": 95,
      "feedback": "Excellent work! Clear code with good documentation.",
      "graded_at": "2024-02-15T10:00:00",
      "grader_name": "Dr. Smith",
      "is_late": false
    }
  }
]
```

### GET /api/v1/student/projects

```json
[
  {
    "id": 3,
    "title": "E-commerce Website",
    "course_id": 5,
    "course_title": "Web Development",
    "due_date": "2024-03-01T23:59:59",
    "points_possible": 200,
    "collaboration_allowed": true,
    "max_team_size": 3,
    "submission_status": {
      "submitted": true,
      "submitted_at": "2024-02-28T20:00:00",
      "status": "submitted",
      "is_late": false
    }
  }
]
```

## Files Modified/Created

### Backend
- ✅ `/backend/src/routes/student_routes.py` - Added project endpoints
- ✅ `/backend/src/models/course_models.py` - Project/ProjectSubmission models (existing)

### Frontend
- ✅ `/frontend/src/services/student-submission.service.ts` - New service
- ✅ `/frontend/src/app/student/assessments/page.tsx` - New page

### Documentation
- ✅ `STUDENT_SUBMISSION_STATUS.md` - This file

## Conclusion

The student submission status tracking feature provides comprehensive visibility into assignment and project submissions, grades, and feedback. It enhances the student experience by:

- **Transparency** - Clear status indicators for all submissions
- **Timeliness** - Due date tracking and overdue alerts
- **Feedback Loop** - Immediate access to grades and instructor comments
- **Progress Tracking** - Overall performance statistics

This feature complements the instructor grading system documented in `GRADING_SYSTEM_IMPROVEMENTS.md` to create a complete assessment workflow.
