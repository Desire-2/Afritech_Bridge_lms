# PostgreSQL Migration for Afritec Bridge LMS

This directory contains the complete PostgreSQL migration scripts and tools for migrating the Afritec Bridge LMS from SQLite to PostgreSQL.

## 📋 Migration Overview

The migration includes:
- **60+ tables** with complete schema recreation
- **All relationships and constraints** properly mapped
- **Indexes for optimal performance**
- **Data type conversions** (SQLite → PostgreSQL)
- **Initial role seeding** (student, instructor, admin)

## 🗃️ Files Included

| File | Purpose |
|------|---------|
| `postgresql_migration_complete.sql` | Complete PostgreSQL schema recreation |
| `deploy_postgresql_migration.sh` | Automated deployment script |
| `verify_postgresql_migration.py` | Schema verification tool |
| `postgresql_migration.sql` | Legacy migration (use complete version instead) |
| `postgresql_migration_safe.sql` | Safe migration (partial) |

## 🚀 Quick Start

### 1. Prerequisites

```bash
# Ensure PostgreSQL is installed and running
sudo systemctl start postgresql  # Linux
brew services start postgresql   # macOS

# Install required Python packages
pip install psycopg2-binary
```

### 2. Environment Setup

```bash
# For production (required)
export DATABASE_URL="postgresql://username:password@hostname:port/database_name"

# For local development (optional)
export POSTGRES_DB="afritec_lms"
export POSTGRES_USER="postgres"
export POSTGRES_PASSWORD="your_password"
```

### 3. Run Migration

```bash
# Option 1: Full migration with backup
./deploy_postgresql_migration.sh

# Option 2: Migration without backup
./deploy_postgresql_migration.sh --no-backup

# Option 3: Verify existing migration
./deploy_postgresql_migration.sh --verify-only
```

### 4. Verify Migration

```bash
# Verify schema completeness
python verify_postgresql_migration.py
```

## 📊 Schema Details

### Core Tables

| Category | Tables | Description |
|----------|--------|-------------|
| **Authentication** | `roles`, `users` | User management and role-based access |
| **Course Management** | `courses`, `modules`, `lessons` | Course structure and content |
| **Assessments** | `quizzes`, `questions`, `answers`, `quiz_attempts` | Quiz system |
| **Assignments** | `assignments`, `assignment_submissions` | Assignment workflow |
| **Projects** | `projects`, `project_submissions` | Project-based learning |
| **Progress Tracking** | `lesson_completions`, `module_progress`, `user_progress` | Learning analytics |
| **Gamification** | `achievements`, `user_achievements`, `learning_streaks`, `student_points` | Engagement system |
| **Communication** | `announcements`, `student_forums`, `forum_posts` | Course communication |
| **File Management** | `file_comments`, `file_analyses` | File handling system |

### Key Features

#### 🔐 Authentication & Authorization
- Role-based access control (Student, Instructor, Admin)
- JWT token support
- Password reset functionality
- User profile management

#### 📚 Course Management
- Multi-module course structure
- Lesson content with various types (video, text, mixed)
- Course enrollment and application system
- Instructor course management

#### 📝 Assessment System
- Quiz creation with multiple question types
- Assignment submissions with file support
- Project-based assessments
- Automated grading capabilities
- Resubmission workflows

#### 🏆 Gamification
- Achievement system with criteria matching
- Learning streaks and milestones
- Point system and leaderboards
- Badge collection
- Quest challenges

#### 📈 Analytics & Progress
- Detailed learning progress tracking
- Module completion tracking
- Learning analytics and insights
- Certificate generation
- Student transcripts

#### 💬 Communication
- Course announcements
- Discussion forums
- Student notes and bookmarks
- Notification system

## 🔧 Data Type Mappings

| SQLite Type | PostgreSQL Type | Notes |
|-------------|-----------------|-------|
| `INTEGER` | `INTEGER` or `SERIAL` | Auto-increment uses SERIAL |
| `TEXT` | `TEXT` | No change |
| `VARCHAR(n)` | `VARCHAR(n)` | No change |
| `REAL` | `REAL` | No change |
| `BOOLEAN` | `BOOLEAN` | No change |
| `DATETIME` | `TIMESTAMP WITH TIME ZONE` | Timezone-aware |
| `DATE` | `DATE` | No change |
| `JSON` | `JSONB` | Better performance with JSONB |

## 🗂️ Migration Process

### Phase 1: Schema Creation
1. Create all tables with proper data types
2. Set up primary keys and constraints
3. Create foreign key relationships
4. Add indexes for performance

### Phase 2: Data Migration (Manual)
For existing data migration:

```sql
-- Example data migration from SQLite to PostgreSQL
-- Run these after schema creation

-- Export from SQLite
.headers on
.mode csv
.output users_export.csv
SELECT * FROM users;

-- Import to PostgreSQL
\copy users FROM 'users_export.csv' DELIMITER ',' CSV HEADER;
```

### Phase 3: Verification
1. Run verification script
2. Check table counts
3. Verify relationships
4. Test application functionality

## 🔍 Troubleshooting

### Common Issues

#### 1. Connection Errors
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check connection
pg_isready -h localhost -p 5432
```

#### 2. Permission Errors
```bash
# Create database user
sudo -u postgres createuser --interactive

# Grant permissions
sudo -u postgres psql
GRANT ALL PRIVILEGES ON DATABASE afritec_lms TO your_user;
```

#### 3. Schema Differences
```bash
# Run verification to identify issues
python verify_postgresql_migration.py

# Check specific table
\d+ table_name  # In psql
```

### Performance Optimization

#### 1. Index Management
```sql
-- Check missing indexes
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats
WHERE schemaname = 'public'
ORDER BY n_distinct DESC;

-- Create additional indexes if needed
CREATE INDEX idx_custom ON table_name (column_name);
```

#### 2. Query Optimization
```sql
-- Analyze tables after data import
ANALYZE;

-- Update table statistics
VACUUM ANALYZE;
```

## 🚀 Production Deployment

### 1. Environment Variables
```bash
# Required for production
DATABASE_URL=postgresql://user:pass@host:port/dbname
FLASK_ENV=production

# Optional
POSTGRES_DB=afritec_lms
POSTGRES_USER=afritec_user
POSTGRES_PASSWORD=secure_password
```

### 2. SSL Configuration
For production PostgreSQL connections:
```bash
# Add SSL parameters to DATABASE_URL
DATABASE_URL="postgresql://user:pass@host:port/db?sslmode=require"
```

### 3. Backup Strategy
```bash
# Create regular backups
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Restore if needed
psql $DATABASE_URL < backup_file.sql
```

## 📚 Additional Resources

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [SQLAlchemy PostgreSQL Dialect](https://docs.sqlalchemy.org/en/14/dialects/postgresql.html)
- [Flask-SQLAlchemy Configuration](https://flask-sqlalchemy.palletsprojects.com/en/2.x/config/)

## 🤝 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Run the verification script for detailed analysis
3. Review PostgreSQL logs for error details
4. Ensure all environment variables are properly set

## ✅ Verification Checklist

- [ ] PostgreSQL is installed and running
- [ ] Environment variables are set correctly
- [ ] Migration script completed without errors
- [ ] Verification script shows no missing tables
- [ ] Application can connect to PostgreSQL
- [ ] All existing functionality works
- [ ] Performance is acceptable

---

**Last Updated:** February 2, 2026
**Migration Version:** 1.0.0 Complete