# Afritec Bridge LMS - AI Coding Agent Instructions

## Architecture Overview

**Full-stack Learning Management System** with separate backend (Flask) and frontend (Next.js) in a monorepo structure:

- **Backend**: `/backend` - Python Flask REST API with SQLAlchemy ORM
- **Frontend**: `/frontend` - Next.js 15 with TypeScript, React 19, Tailwind CSS, shadcn/ui

### Backend Architecture

**Entry Points**: `main.py` (dev/import), `app.py` (production/deployment), `wsgi.py` (WSGI wrapper)

**Models** (`src/models/`): SQLAlchemy models with role-based system (student/instructor/admin)
- `user_models.py` - User, Role, password reset tokens
- `course_models.py` - Course, Module, Lesson, Quiz, Question, Answer, Assignment, Project, Enrollment, Submission, Announcement
- `achievement_models.py` - Achievement, UserAchievement, LearningStreak, StudentPoints, Milestone, Leaderboard, QuestChallenge
- `opportunity_models.py` - Job/career opportunities
- `quiz_progress_models.py` - Quiz tracking and analytics
- `student_models.py` - LessonCompletion, UserProgress, Badge, UserBadge

**Routes** (`src/routes/`): Flask Blueprints registered in `main.py` with `/api/v1` prefix
- `user_routes.py` - auth_bp (`/auth`), user_bp (`/users`) - JWT auth with blocklist
- `course_routes.py` - course_bp, module_bp, lesson_bp, enrollment_bp, quiz_bp, submission_bp, announcement_bp
- `instructor_routes.py` - instructor_bp (`/instructor`) - course/module CRUD
- `instructor_assessment_routes.py` - instructor_assessment_bp - quiz/assignment/project creation/management (consolidated)
- `student_routes.py` - student_bp (`/student`) - dashboard, enrollments, profile
- `learning_routes.py` - learning_bp (`/student/learning`) - lesson progress, bookmarks, notes
- `achievement_routes.py` - achievement_bp (`/achievements`) - gamification endpoints
- `opportunity_routes.py` - opportunity_bp (`/opportunities`) - career opportunities

**Services** (`src/services/`): Business logic layer
- `achievement_service.py` - Gamification logic: streak tracking, achievement unlocking, points calculation
- `analytics_service.py` - Course analytics and reporting
- `assessment_service.py` - Quiz grading and submission handling
- `certificate_service.py` - Certificate generation
- `dashboard_service.py` - Dashboard data aggregation
- `enrollment_service.py` - Enrollment workflows
- `progression_service.py` - Learning path progression logic

**Utils** (`src/utils/`): Shared utilities
- `email_utils.py` - Flask-Mail wrapper with timeout handling

### Frontend Architecture

**App Router** (`src/app/`): Next.js 15 App Router with role-based route organization
- Grouped routes: `(admin)`, `(instructor)`, `(student)`, `(auth)`

**Contexts** (`src/contexts/`): React Context for state management
- `AuthContext.tsx` - JWT authentication, token refresh, user profile (primary)
- `EnhancedAuthContext.tsx` - Extended auth features
- `SidebarContext.tsx` - Sidebar state management

**Services** (`src/services/`): API integration with axios
- `api/` directory - Unified API services (base.service, course.service, progress.service, etc.)
- `auth.service.ts` - Authentication API calls
- `course.service.ts`, `instructor.service.ts`, `student.service.ts` - Domain-specific APIs
- `achievementApi.ts`, `quiz-progress.service.ts` - Gamification and assessment
- Pattern: TypeScript services with typed request/response models

**Components** (`src/components/`): shadcn/ui + custom components
- Uses Radix UI primitives with Tailwind styling
- Consistent design system via `components.json` configuration

## Development Workflows

### Backend Development

**Setup**: Run `./setup.sh` (creates venv, installs deps, creates `.env`) then `./run.sh` (starts Flask dev server)

**Database**: 
- SQLite in dev (`instance/afritec_lms_db.db`), PostgreSQL in prod
- Auto-migration on startup via `db.create_all()` in `main.py`
- Role seed data created on first run

**Authentication**: 
- JWT via flask-jwt-extended with access (1h) and refresh (30d) tokens
- In-memory blocklist (set `BLOCKLIST` in `user_routes.py`) - should use Redis in production
- Token validation: `@jwt_required()` decorator, get user with `get_jwt_identity()`

**CORS**: Configured in `main.py` with development origins hardcoded (localhost:3000/3001/3005, specific IPs)

### Frontend Development

**Setup**: `npm run dev` from `/frontend` directory (Next.js dev server on :3000)

**Build**: `npm run build` (prebuild script sets up .npmrc for legacy peer deps)

**Environment**: Requires `NEXT_PUBLIC_API_URL` pointing to backend (e.g., `http://localhost:5000/api/v1`)

**Auth Flow**: 
- Login → store JWT in localStorage → set axios default header
- Token refresh on 401 responses
- Protected routes check `isAuthenticated` from AuthContext

## Critical Patterns

### Backend Decorators
```python
@jwt_required()  # All protected routes
@student_required  # Role-based access (defined per blueprint)
@instructor_required
```

### Blueprint Registration
All blueprints must be registered in `main.py` with explicit imports. URL prefix pattern: `/api/v1/<resource>`

### Frontend API Pattern
```typescript
// Always import from services
import { CourseApiService } from '@/services/api';
const courses = await CourseApiService.getEnrolledCourses();

// Use AuthContext for auth state
const { user, isAuthenticated, login } = useAuth();
```

### Achievement System
Trigger achievements via `AchievementService.check_and_award_achievements(user_id, event_type, event_data)` after lesson completion, quiz submission, or streak updates. Uses complex criteria matching (speed, consistency, mastery categories).

## Configuration & Deployment

### Backend Environment Variables (Required)
- `SECRET_KEY`, `JWT_SECRET_KEY` - Generate with `secrets.token_hex(32)`
- `DATABASE_URL` - Auto-transformed from `postgres://` to `postgresql+psycopg2://` for SQLAlchemy 2.0
- `FLASK_ENV` - `development` or `production` (affects CORS, debug mode)
- `ALLOWED_ORIGINS` - Comma-separated frontend URLs (production only)
- Email: `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_DEFAULT_SENDER`

### Frontend Environment Variables
- `NEXT_PUBLIC_API_URL` - Backend API base URL (must include `/api/v1`)
- `NODE_ENV=production` for builds

### Deployment Targets
- **Backend**: Render.com (PostgreSQL + Gunicorn via `build.sh`/`start.sh`)
- **Frontend**: Vercel (default), Cloudflare Pages (via `wrangler.toml`), or Docker
- See `backend/README.md` and `frontend/DEPLOYMENT.md` for detailed steps

## Helper Scripts

**Backend**: 
- `./setup.sh` - Initial setup
- `./run.sh` - Start dev server
- `create_admin.py`, `create_instructor.py`, `create_test_user.py` - Create users programmatically
- `migrate_*.py` - Database migration utilities

**Frontend**:
- `npm run build:worker` - Build for Cloudflare
- `deploy.sh` - Deployment automation

## Common Tasks

**Add new route**: Create blueprint in `src/routes/<name>_routes.py`, register in `main.py`, add to frontend service in `src/services/`

**Add model**: Define in appropriate `src/models/<category>_models.py`, import in `main.py`, restart to auto-migrate

**Add achievement**: Insert into `achievements` table with criteria_type, criteria_value, and tier; trigger via `AchievementService` in relevant route handlers

**Debug CORS**: Check `ALLOWED_ORIGINS` (prod) or hardcoded dev origins in `main.py` CORS config

**Fix DB issues**: Delete `instance/afritec_lms_db.db` in dev, restart server to recreate schema
