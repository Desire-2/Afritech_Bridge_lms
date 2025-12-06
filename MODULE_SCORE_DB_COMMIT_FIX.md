# Module Score Fix - Database Commit Issue

## Problem Identified

The module score was showing **0.0%** in the UI despite lessons having engagement scores (38-82%). The root cause was that the `_update_course_contribution_score()` method in `ProgressionService` was calculating the score correctly but **not committing the changes to the database**.

## Root Cause Analysis

### What Was Happening

1. **Lesson scores were being calculated correctly**:
   - `calculate_lessons_average_score()` was returning proper values (54%, 75%, 67%, etc.)
   - Engagement scores existed in the database for all completed lessons

2. **The score was being set but not saved**:
   ```python
   # This line set the score in memory
   module_progress.course_contribution_score = min(100.0, lessons_avg)
   
   # But there was NO db.session.commit() after!
   # The score never persisted to the database
   ```

3. **The UI always showed 0.0%** because:
   - Every fetch from the database returned `course_contribution_score = 0.0`
   - The calculated values were lost after the request ended

### Database State Before Fix

```
Module 4 (Student 5): course_contribution_score = 0.0%
  - Lessons Average (calculated): 54.26%
  - Cumulative Score: 5.43%

Module 5 (Student 5): course_contribution_score = 0.0%
  - Lessons Average (calculated): 75.00%
  - Cumulative Score: 7.50%

... (all modules had 0.0% stored in database)
```

## Changes Made

### 1. Fixed Database Commit Issue

**File**: `/backend/src/services/progression_service.py`

**Change**: Added `db.session.commit()` to persist score updates

```python
@staticmethod
def _update_course_contribution_score(student_id: int, module_id: int, enrollment_id: int):
    """Update the course contribution score (10% of total grade) based on lesson scores"""
    module_progress = ModuleProgress.query.filter_by(
        student_id=student_id,
        module_id=module_id,
        enrollment_id=enrollment_id
    ).first()
    
    if module_progress:
        # Calculate contribution based on average lesson scores
        lessons_avg = module_progress.calculate_lessons_average_score()
        
        # Store as course contribution score (0-100)
        module_progress.course_contribution_score = min(100.0, lessons_avg)
        
        # Recalculate cumulative score
        module_progress.calculate_cumulative_score()
        
        # ✅ NEW: Commit changes to database
        try:
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Failed to update course contribution score: {str(e)}")
```

### 2. Enhanced Lesson Completion Endpoint

**File**: `/backend/src/routes/student_routes.py`

**Change**: Added logic to:
- Ensure `completed` flag is set when updating existing completions
- Backfill `engagement_score` if it's 0 (use `reading_progress` or default to 100)
- Trigger module score recalculation after lesson update

```python
# Ensure completed flag is set
if not existing_completion.completed:
    existing_completion.completed = True
    updated = True

# If engagement_score is 0 but lesson is completed, use reading_progress or default to 100
if existing_completion.completed and (existing_completion.engagement_score or 0) == 0:
    existing_completion.engagement_score = existing_completion.reading_progress or 100.0
    updated = True

if updated:
    existing_completion.updated_at = datetime.utcnow()
existing_completion.last_accessed = datetime.utcnow()

try:
    db.session.commit()
    
    # ✅ NEW: Update module score after lesson update
    if updated:
        from ..services.progression_service import ProgressionService
        module_progress = ModuleProgress.query.filter_by(
            student_id=current_user_id,
            module_id=lesson.module_id
        ).first()
        if module_progress:
            ProgressionService._update_course_contribution_score(
                current_user_id, lesson.module_id, enrollment.id
            )
            db.session.commit()
```

### 3. Created Recalculation Script

**File**: `/backend/recalculate_module_scores.py`

Created a one-time script to update all existing module scores in the database.

**Results of running the script**:
```
Found 6 module progresses to recalculate

Module 4 (Student 5):
  Course Contribution: 0.00% → 54.26%
  Cumulative Score: 5.43% → 5.43%

Module 5 (Student 5):
  Course Contribution: 0.00% → 75.00%
  Cumulative Score: 7.50% → 7.50%

Module 6 (Student 5):
  Course Contribution: 0.00% → 66.69%
  Cumulative Score: 6.67% → 6.67%

Module 7 (Student 5):
  Course Contribution: 0.00% → 74.01%
  Cumulative Score: 7.40% → 7.40%

Module 8 (Student 5):
  Course Contribution: 0.00% → 61.74%
  Cumulative Score: 6.17% → 6.17%

Module 9 (Student 5):
  Course Contribution: 0.00% → 0.00%
  Cumulative Score: 0.00% → 0.00%

✅ Updated 5 module scores
```

### 4. Created Helper Scripts

**File**: `/backend/inspect_lesson_data.py`
- Diagnoses database state
- Shows lesson completion and module progress statistics
- Helps identify data issues

**File**: `/backend/backfill_lesson_scores.py`
- Backfills missing engagement scores (if any exist)
- Ensures all completed lessons have proper scores

## Testing the Fix

### Expected Behavior After Fix

1. **Module scores now persist in database**
   - When a lesson is completed, the module score is calculated AND saved
   - Subsequent fetches show the correct score

2. **Existing data has been updated**
   - All existing module progresses now have correct `course_contribution_score` values
   - No more 0.0% scores for modules with completed lessons

3. **Future lesson completions work correctly**
   - The `complete_lesson()` endpoint calls `_update_course_contribution_score()`
   - The service method now commits to the database
   - Module scores update in real-time

### How to Verify

1. **Check database directly**:
   ```bash
   cd backend
   source venv-new/bin/activate
   python3 inspect_lesson_data.py
   ```

2. **Complete a lesson in the UI**:
   - The module score should update immediately
   - The sidebar and main content should show the same score
   - The score breakdown dialog should show correct values

3. **Refresh the page**:
   - The module score should persist
   - No longer resets to 0.0%

## Summary

**The Issue**: Calculated scores were never saved to the database

**The Fix**: Added `db.session.commit()` to persist score updates

**The Impact**: 
- ✅ Module scores now display correctly in the UI
- ✅ Scores persist across page refreshes
- ✅ Existing data has been backfilled with correct values
- ✅ Future lesson completions will work correctly

**Files Modified**:
1. `/backend/src/services/progression_service.py` - Added database commit
2. `/backend/src/routes/student_routes.py` - Enhanced lesson completion endpoint

**Scripts Created**:
1. `/backend/recalculate_module_scores.py` - One-time fix for existing data
2. `/backend/inspect_lesson_data.py` - Diagnostic tool
3. `/backend/backfill_lesson_scores.py` - Backfill helper

## Lesson Learned

**Always check for database commits** when modifying SQLAlchemy models in service methods. Just setting a value on a model instance doesn't persist it - you must explicitly commit the session.

**Pattern to follow**:
```python
# Modify model
model.field = new_value

# ALWAYS commit or let the caller know they need to commit
try:
    db.session.commit()
except Exception as e:
    db.session.rollback()
    # Handle error
```
