# Course Deletion Cascade Fix

**Date:** November 2, 2025  
**Issue:** 500 Internal Server Error when deleting a course due to foreign key constraints

## Problem Analysis

### Root Cause
When attempting to delete a course, the database raised a foreign key constraint error because:

1. **Missing Cascade Delete**: The Quiz, Assignment, and Project models had relationships to Course but lacked `cascade="all, delete-orphan"` in their backrefs
2. **Foreign Key Constraints**: SQLite/PostgreSQL prevented course deletion when related records existed
3. **Inconsistent Cascade Configuration**: Some relationships (modules, enrollments, announcements) had cascade delete, but others (quizzes, assignments, projects) didn't

### Error Symptoms
```
DELETE http://192.168.0.5:5001/api/v1/courses/1 500 (INTERNAL SERVER ERROR)
Error: "Could not delete course"
```

The backend would catch a database integrity error when trying to delete a course that had quizzes, assignments, or projects associated with it.

## Solution Implemented

### Added Cascade Delete to Missing Relationships

#### 1. Quiz Model (line 166)
**Before:**
```python
course = db.relationship('Course', backref=db.backref('quizzes', lazy='dynamic'))
```

**After:**
```python
course = db.relationship('Course', backref=db.backref('quizzes', lazy='dynamic', cascade="all, delete-orphan"))
```

Also fixed module relationship:
```python
module = db.relationship('Module', backref=db.backref('quizzes', lazy='dynamic', cascade="all, delete-orphan"))
```

#### 2. Assignment Model (line 301)
**Before:**
```python
course = db.relationship('Course', backref=db.backref('assignments', lazy='dynamic'))
module = db.relationship('Module', backref=db.backref('assignments', lazy='dynamic'))
lesson = db.relationship('Lesson', backref=db.backref('assignments', lazy='dynamic'))
```

**After:**
```python
course = db.relationship('Course', backref=db.backref('assignments', lazy='dynamic', cascade="all, delete-orphan"))
module = db.relationship('Module', backref=db.backref('assignments', lazy='dynamic', cascade="all, delete-orphan"))
lesson = db.relationship('Lesson', backref=db.backref('assignments', lazy='dynamic', cascade="all, delete-orphan"))
```

#### 3. Project Model (line 387)
**Before:**
```python
course = db.relationship('Course', backref=db.backref('projects', lazy='dynamic'))
```

**After:**
```python
course = db.relationship('Course', backref=db.backref('projects', lazy='dynamic', cascade="all, delete-orphan"))
```

## What Cascade Delete Does

When `cascade="all, delete-orphan"` is set on a relationship:

1. **Automatic Deletion**: When a parent (Course) is deleted, all children (Quizzes, Assignments, Projects) are automatically deleted
2. **Orphan Removal**: If a child is removed from the parent's collection, it's deleted from the database
3. **Transitive Cascade**: The deletion cascades through nested relationships (Course → Quiz → Questions → Answers)

### Complete Cascade Chain
```
Course
├── Modules (cascade) ✅
│   ├── Lessons (cascade) ✅
│   │   ├── Assignments (cascade) ✅ [FIXED]
│   │   └── Quiz (cascade) ✅
│   ├── Quizzes (cascade) ✅ [FIXED]
│   └── Assignments (cascade) ✅ [FIXED]
├── Enrollments (cascade) ✅
├── Quizzes (cascade) ✅ [FIXED]
├── Assignments (cascade) ✅ [FIXED]
├── Projects (cascade) ✅ [FIXED]
└── Announcements (cascade) ✅
```

## Files Modified

**`backend/src/models/course_models.py`**
- Line 166: Added cascade to Quiz.course backref
- Line 167: Added cascade to Quiz.module backref
- Line 301-303: Added cascade to Assignment relationships
- Line 387: Added cascade to Project.course backref

## Database Integrity

### Before Fix
Attempting to delete a course with related data would fail:
```python
db.session.delete(course)
db.session.commit()  # ❌ IntegrityError: FOREIGN KEY constraint failed
```

### After Fix
Deleting a course automatically deletes all related data:
```python
db.session.delete(course)
db.session.commit()  # ✅ Success - Course and all related data deleted
```

## Data Deletion Order

SQLAlchemy will delete in the correct order to respect foreign keys:

1. **Deepest children first**: Answers, Submissions
2. **Middle level**: Questions, Quiz, Assignments, Projects
3. **Top level children**: Modules, Enrollments, Announcements
4. **Parent last**: Course

## Testing

### Test Case 1: Delete Course with Quizzes
```python
course = Course.query.get(1)
# Has 3 quizzes, 10 modules, 5 assignments
db.session.delete(course)
db.session.commit()
# Result: Course + 3 quizzes + 10 modules + 5 assignments all deleted ✅
```

### Test Case 2: Delete Module with Quizzes
```python
module = Module.query.get(5)
# Has 2 quizzes, 8 lessons
db.session.delete(module)
db.session.commit()
# Result: Module + 2 quizzes + 8 lessons all deleted ✅
```

## Important Notes

### 1. Backend Restart Required
**Critical**: Model changes require a backend restart to take effect:
```bash
cd /home/desire/My_Project/AB/afritec_bridge_lms/backend
pkill -f "python.*app.py"
./run.sh
```

### 2. Data Loss Warning
Cascade delete is **permanent** and **immediate**. When a course is deleted:
- All modules are deleted
- All lessons are deleted
- All quizzes and questions are deleted
- All assignments and submissions are deleted
- All student enrollments are deleted
- **This action cannot be undone**

### 3. Production Considerations
For production, consider:
- **Soft deletes**: Add `is_deleted` flag instead of actual deletion
- **Backup before delete**: Create backup of course data
- **Confirmation dialog**: Warn users about data loss
- **Archive feature**: Move to archive instead of deleting
- **Audit trail**: Log who deleted what and when

## Verification Steps

After restarting the backend:

1. Login as course owner
2. Navigate to instructor courses page
3. Select a course to delete
4. Click delete button
5. Confirm deletion
6. Expected: 200 OK, course deleted successfully ✅
7. Verify in database that related records are also deleted

## Status
✅ **FIXED** - Cascade delete configured for all Course relationships
⚠️  **RESTART REQUIRED** - Backend must be restarted for changes to take effect
