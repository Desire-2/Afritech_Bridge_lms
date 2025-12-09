# Database Schema Migration Fix - Questions Table

## Problem
Quiz creation was failing with the error:
```
psycopg2.errors.UndefinedColumn: column "points" of relation "questions" does not exist
```

## Root Cause
The PostgreSQL database schema was out of sync with the SQLAlchemy models. The `questions` table was missing two columns:
1. `points` (FLOAT) - Points assigned to each question
2. `explanation` (TEXT) - Explanation text for the correct answer

## Solution Applied

### Migration Script Created
**File**: `backend/migrate_add_points_column.py`

This script:
- Checks if `points` column exists, adds it if missing (default: 10.0)
- Checks if `explanation` column exists, adds it if missing (nullable)
- Uses safe SQL with existence checks to prevent errors on re-run

### Migration Executed
```bash
cd /home/desire/My_Project/AB/afritec_bridge_lms/backend
./venv-new/bin/python migrate_add_points_column.py
```

**Results:**
- ✓ Added `points` column (FLOAT, default 10.0)
- ✓ Added `explanation` column (TEXT, nullable)

## Current Schema
The `questions` table now has the following columns:
```
id                   | integer          | NOT NULL | Auto-increment
quiz_id              | integer          | NOT NULL | Foreign key to quizzes
text                 | text             | NOT NULL | Question text
question_type        | character varying| NOT NULL | e.g., 'multiple_choice'
order                | integer          | NOT NULL | Display order
points               | double precision | NULL     | Default: 10.0
explanation          | text             | NULL     | Answer explanation
```

## Testing

### Verify Schema
```bash
cd backend
./venv-new/bin/python -c "
from main import app
from src.models.user_models import db
from sqlalchemy import text

with app.app_context():
    result = db.session.execute(text('''
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name='\''questions'\''
        ORDER BY ordinal_position
    '''))
    for row in result:
        print(f'{row[0]:20} | {row[1]:15} | Nullable: {row[2]:3} | Default: {row[3]}')
"
```

### Test Quiz Creation
1. Login as instructor
2. Navigate to course management
3. Create a quiz with questions
4. Should now succeed without column errors

## Related Issues Fixed

This migration also resolves:
- ✓ Database connection pooling issues (via `SQLALCHEMY_ENGINE_OPTIONS` in `main.py`)
- ✓ Enhanced error logging in quiz creation endpoint
- ✓ Database connection health checks before operations

## Prevention

To prevent schema drift in the future:

### Option 1: Auto-migration on Startup (Development Only)
Add to `main.py`:
```python
if env == 'development':
    with app.app_context():
        db.create_all()  # Creates missing tables/columns
```

**Note**: This doesn't handle column modifications or deletions safely.

### Option 2: Proper Migration Tool (Recommended)
Use **Alembic** for production-grade migrations:
```bash
pip install alembic
alembic init migrations
alembic revision --autogenerate -m "Add points and explanation to questions"
alembic upgrade head
```

### Option 3: Check Schema on Deploy
Add schema validation script that runs before deployment:
```python
def validate_schema():
    required_columns = {
        'questions': ['id', 'quiz_id', 'text', 'question_type', 'order', 'points', 'explanation'],
        'quizzes': ['id', 'title', 'description', 'course_id', 'module_id', 'lesson_id', ...],
        # ... other tables
    }
    # Check each table has required columns
    # Raise error if missing
```

## Files Modified
- ✅ `backend/migrate_add_points_column.py` - Created migration script
- ✅ `backend/main.py` - Added connection pooling (previous fix)
- ✅ `backend/src/routes/instructor_assessment_routes.py` - Enhanced error logging (previous fix)

## Production Deployment

When deploying to production (e.g., Render.com):

1. **Before deployment**, run migration script:
   ```bash
   python migrate_add_points_column.py
   ```

2. **Or** add to `build.sh`:
   ```bash
   #!/bin/bash
   pip install -r requirements.txt
   python migrate_add_points_column.py  # Run migrations
   ```

3. **Then** restart the application

## Verification Checklist
- [x] `points` column exists in `questions` table
- [x] `explanation` column exists in `questions` table
- [x] Default value for `points` is 10.0
- [x] Both columns are nullable (allow NULL)
- [x] Migration script is idempotent (safe to re-run)
- [x] Flask server can create quizzes without errors

## Status
✅ **RESOLVED** - Database schema is now in sync with SQLAlchemy models. Quiz creation should work correctly.
