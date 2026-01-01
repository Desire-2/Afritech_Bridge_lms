# Automatic Database Schema Migration System

## Overview

The Afritec Bridge LMS now includes an **automatic schema synchronization system** that runs on every deployment to Render. This ensures your production database schema stays in sync with your SQLAlchemy models without manual intervention.

## How It Works

### 1. Migration Script: `sync_production_schema.py`

This intelligent script:
- 🔍 **Analyzes** all SQLAlchemy models to understand expected schema
- 📊 **Compares** model definitions with actual database tables
- ➕ **Adds** missing columns automatically with proper types and defaults
- ✅ **Verifies** critical columns exist after migration
- 🛡️ **Preserves** all existing data (zero data loss)

### 2. Automatic Execution

The migration runs automatically during Render deployment via `build.sh`:

```bash
# Triggered during: git push → Render detects changes → build.sh runs
├─ Install dependencies
├─ Run sync_production_schema.py  ← Migration happens here
└─ Start application
```

### 3. Safety Features

#### Non-Breaking Deployment
- If migration encounters errors, deployment **continues** (doesn't fail)
- Warnings are logged for manual review
- Application starts even if some columns can't be added

#### Data Preservation
- Only **adds** missing columns (never drops or modifies existing ones)
- All new columns are created as `NULL` to avoid breaking existing data
- Default values applied where appropriate

#### Detailed Logging
Every migration logs:
- Tables analyzed and modified
- Columns added with their types
- Verification results for critical columns
- Any errors or warnings encountered

## What Gets Migrated

### Detected Automatically
The script detects and adds:
- ✅ Missing columns from model definitions
- ✅ Proper PostgreSQL data types (VARCHAR, INTEGER, BOOLEAN, TIMESTAMP, etc.)
- ✅ Default values where specified in models
- ✅ Nullable/NOT NULL constraints

### Not Handled (Manual Required)
These require manual migration:
- ❌ Dropping columns (intentionally avoided for safety)
- ❌ Renaming columns (ambiguous - could lose data)
- ❌ Changing column types (risky - data conversion issues)
- ❌ Creating new tables (use `migrate_production_schema.py` for this)
- ❌ Complex constraints (foreign keys, unique constraints)

## Usage

### Automatic (Recommended)
Just push your code to GitHub:
```bash
git add .
git commit -m "feat: Add new user profile fields"
git push origin main
```

Render automatically:
1. Detects the push
2. Runs `build.sh`
3. Executes schema sync
4. Starts your application

### Manual (Testing)
Run locally to test migration before deploying:
```bash
cd backend
python sync_production_schema.py
```

**Important:** Set `DATABASE_URL` in your `.env` to point to production database for testing.

## Monitoring Migrations

### Render Dashboard
1. Go to Render dashboard → Your service → Logs
2. Look for migration output during deployment:
   ```
   ==================================================
   Running database schema synchronization...
   ==================================================
   🔄 STARTING COMPREHENSIVE SCHEMA SYNCHRONIZATION
   ```

### Verification Checklist
After deployment, check logs for:
- ✅ "Connected successfully" - Database connection works
- ✅ "Tables modified: N" - Shows number of changes
- ✅ "Columns added: N" - Shows columns added
- ✅ "ALL CRITICAL COLUMNS VERIFIED" - Critical fields exist
- ✅ "SCHEMA SYNCHRONIZATION COMPLETED" - Success message

### Common Migration Output

#### No Changes Needed
```
📊 Analyzing table: users
   📌 Existing columns: 15
   ✅ All columns exist - no changes needed
```

#### Columns Added
```
📊 Analyzing table: users
   📌 Existing columns: 14
   ⚠️  Missing columns: 1

   ➕ Adding column: is_active
      Type: BOOLEAN
      SQL: ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT TRUE NULL
      ✅ Successfully added is_active
```

#### Migration Summary
```
================================================================================
🎉 SCHEMA SYNCHRONIZATION COMPLETED!
================================================================================
📊 Tables modified: 1
📊 Columns added: 3
✅ Verification: PASSED
================================================================================
```

## Troubleshooting

### Migration Warnings in Logs
**Issue:** See "⚠️ Warning: Schema synchronization had issues"

**Solution:**
1. Check Render logs for specific error details
2. Verify `DATABASE_URL` is set correctly in Render environment
3. Ensure database is accessible (not in maintenance mode)
4. Application will still start - fix issues in next deployment

### Column Not Added
**Issue:** Column missing after migration

**Possible Causes:**
- Column name mismatch between model and database
- Database permissions issue
- Column already exists with different casing (PostgreSQL is case-sensitive)

**Solution:**
1. Check exact error in Render logs
2. Verify model definition in `src/models/*.py`
3. Manually add column if needed:
   ```sql
   ALTER TABLE table_name ADD COLUMN column_name TYPE DEFAULT VALUE NULL;
   ```

### Database Connection Failed
**Issue:** "❌ ERROR: DATABASE_URL not found"

**Solution:**
1. Go to Render dashboard → Service → Environment
2. Verify `DATABASE_URL` environment variable exists
3. Check database is not suspended/paused
4. Redeploy after fixing

### Too Many Changes at Once
**Issue:** Migration modifies many tables and takes too long

**Solution:**
- Migration runs during build, so deployment takes longer but succeeds
- Consider manual migration for massive schema changes
- Split large changes across multiple deployments

## Best Practices

### 1. Model Changes
When adding new fields to models:
```python
# ✅ Good: Add with nullable=True or default value
phone_number = db.Column(db.String(20), nullable=True)
is_active = db.Column(db.Boolean, default=True, nullable=False)

# ❌ Bad: NOT NULL without default on existing table
required_field = db.Column(db.String(50), nullable=False)  # Will fail!
```

### 2. Testing Locally
Before pushing model changes:
```bash
# 1. Update model in src/models/
# 2. Test migration locally
cd backend
python sync_production_schema.py

# 3. Verify in local database
# 4. Push to trigger production deployment
git push
```

### 3. Critical Changes
For breaking changes (column renames, type changes):
1. Create manual migration script
2. Deploy in stages:
   - Stage 1: Add new column, keep old one
   - Stage 2: Migrate data from old to new
   - Stage 3: Drop old column (after verifying)

### 4. Rollback Strategy
If migration causes issues:
```bash
# Option 1: Revert code changes
git revert HEAD
git push

# Option 2: Manual database fix
# Connect to production database and run SQL
ALTER TABLE table_name DROP COLUMN problem_column;

# Option 3: Redeploy previous version
# From Render dashboard: Manual Deploy → Choose previous commit
```

## Related Files

- **`sync_production_schema.py`** - Main migration script
- **`build.sh`** - Deployment script (calls migration)
- **`start.sh`** - Application startup script
- **`migrate_production.py`** - Legacy manual migration (deprecated)
- **`migrate_production_schema.py`** - Full schema creation (for new databases)

## Migration History

### Recent Migrations

**2026-01-01: Added `is_active` column**
- Table: `users`
- Type: `BOOLEAN DEFAULT TRUE NULL`
- Reason: Fix login error in production

**2025-12-31: Added multiple enhancement columns**
- Tables: `users`, `courses`, `modules`, `lessons`, `quizzes`, `enrollments`, `course_applications`
- Columns: `phone_number`, `thumbnail_url`, `difficulty_level`, `video_url`, etc.
- Reason: Feature enhancements from model updates

## Future Improvements

Planned enhancements:
- [ ] Track migration history in database table
- [ ] Support for column renames (via metadata hints)
- [ ] Index creation/modification
- [ ] Constraint management
- [ ] Data migration helpers (not just schema)
- [ ] Pre-deployment migration validation

## Support

If you encounter migration issues:
1. Check Render deployment logs
2. Review this documentation
3. Verify model definitions
4. Test locally with production DATABASE_URL
5. Contact support with specific error messages

---

**Last Updated:** January 1, 2026  
**Version:** 1.0.0  
**Author:** Afritec Bridge Development Team
