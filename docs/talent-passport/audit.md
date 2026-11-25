# AfriTech Bridge LMS — Student Profile & Talent Passport Audit

Date: 2026-11-22
Scope: `backend/` (Flask 2.3.3 / SQLAlchemy 2.0 / Alembic), `frontend/` (Next.js 16 / React 19 / Tailwind).
Method: source inspection of models, routes, services, migrations, frontend pages/components, plus a
live route-map audit already present in `docs/api/audit-report.md`.

This document is written **before** any Talent Passport code change, as required by the implementation brief.

---

## EXISTING STUDENT PROFILE

### Frontend routes
- `/student/dashboard/profile` — the current profile page (`frontend/src/app/student/dashboard/profile/page.tsx`).
  Tabs for basic info, career info, preferences, password, achievements. Calls
  `GET/PUT /api/v1/student/profile/` and `GET /api/v1/student/profile/analytics`.
- `/student/dashboard` — dashboard with aggregate stats.
- `/student/mylearning`, `/student/courses/myprogress`, `/student/progress` — learning/progress views.
- `/student/certificates`, `/student/certifications` — certificates.
- `/student/achievements` — achievement/badge view.
- `/student/results/[submissionId]` and `/history` — graded submission results.
- `/student/projects/[id]`, `/student/assignments/[id]`, `/student/assessments` — practical work.
- Navigation lives in `frontend/src/components/student/StudentSidebar.tsx` (sections MAIN, LEARNING,
  ASSESSMENTS, ACHIEVEMENTS, SESSIONS, COMMUNITY, ACCOUNT). The layout is
  `frontend/src/app/student/layout.tsx` with `StudentGuard`, `ErrorBoundary`, `NotificationBell`.
  There is a working mobile hamburger/drawer pattern in `StudentSidebar.tsx`.

### Components
- Profile page is a monolithic client component using shadcn-style primitives from
  `frontend/src/components/ui/*` (Card, Tabs, Badge, Button, Input, Label, Textarea, Switch, Select,
  Avatar, Separator, Progress) and `AchievementProfilePanel`.
- No existing dedicated "skills", "portfolio", "evidence", "timeline", "visibility" or "share" UI.
- Brand colours in use are Navy `#0B1C3A`, Teal `#3ECFB2`, Orange `#F07C2E` (see `tailwind.config.ts`
  / site CSS). The app has no single centralized i18n provider; copy is inline in components.

### Backend models
- Identity: `src/models/user_models.py::User` (id, username, email, names, profile picture, bio,
  phone, location, portfolio/github/linkedin/twitter/website URLs, `job_title`, `skills` JSON,
  `interests` JSON, `learning_goals`, privacy flags `profile_visibility` (default **public**),
  `show_email`, `show_progress`, `is_active`, `deleted_at`). `Role` holds `student|instructor|admin|intern`.
- No separate student-profile table: the existing `User` row **is** the profile. This must be reused.
- Existing achievements: `src/models/achievement_models.py` (`Achievement`, `UserAchievement`,
  `LearningStreak`, `Milestone`, `UserMilestone`, `StudentPoints`, `QuestChallenge`, ...).
- Existing badges: `src/models/student_models.py` (`Badge`, `UserBadge`, `SkillBadge`, `StudentSkillBadge`).

### APIs
- `profile_bp` in `src/routes/student_profile_routes.py`, prefix `/api/v1/student/profile`,
  `@student_required` (local decorator wrapping `@jwt_required()`), `GET /`, `PUT /`,
  `GET/PUT /basic`, `/career`, `/preferences`, `POST /change-password`, `GET /analytics`.
- Response envelope: `{"success": true, "data": ...}`; errors `{"success": false, "message": ...}`.

### Existing functionality
- Edit basic identity, career fields, preferences and password.
- Learning statistics computed from `Enrollment.progress` (`>=1.0` completed, `0<p<1` in progress),
  `UserProgress.total_time_spent`, badge and achievement counts.
- Existing achievement panel and achievement system hook (`useAchievementSystem`).

### Limitations
- No evidence-based professional profile, no skill status/proficiency, no portfolio, no verified
  credentials view, no learning timeline, no completeness score, no publication/sharing control.
- Profile completeness implies nothing about capability; `User.skills` is a free-text JSON list of
  self-claims with no verification and no taxonomy.
- Profile visibility is currently a legacy `public|private|friends_only` flag on `User`, which is not
  wired to any shareable profile URL. Talent Passport must be **private by default** with explicit
  publication, and must not inherit the loose default.

---

## EXISTING LEARNING DATA

### Courses / modules / lessons
- `src/models/course_models.py`: `Course`, `Module`, `Lesson`, `Quiz`, `Question`, `Answer`,
  `Assignment`, `Project`, `Submission`, `AssignmentSubmission`, `ProjectSubmission`, `Enrollment`.
- `Enrollment` has `student_id`, `course_id`, `enrollment_date`, `progress` (0..1), `completed_at`,
  `status` (`active|completed|terminated|suspended|pending_payment`), cohort fields, payment fields,
  and `Enrollment.get_canonical()` — the canonical row used by progress/certificate queries.
- `Enrollment.calculate_course_score()` averages published modules' weighted cumulative scores.

### Progress tracking
- `src/models/student_models.py`: `ModuleProgress` (per enrollment/module, scores and completion),
  `LessonCompletion`, `UserProgress`, `LearningAnalytics`, `AssessmentAttempt`.
- `src/models/quiz_progress_models.py`: `QuizAttempt`, `UserAnswer`, `ModuleCompletion`.
- Canonical services:
  - `EnrollmentProgressService` (`get_progress_counts`, `live_completion`, `sync_enrollment`,
    `get_module_progress_map`) — authoritative counts against published content.
  - `CourseProgressService.evaluate` — single source of truth for course score/certificate
    eligibility (Rules A/B/C, `CERTIFICATE_PASSING_SCORE = 70`).
  - `LessonCompletionService` — lesson requirements (video >= 90%, quiz >= 70, assignment >= 60,
    lesson score >= 80) and score propagation after grading.
  - `ProgressionService` — lesson/module completion and unlocking.
- The Passport must call these services and must **not** implement a second progress calculator.

### Assessments / assignments / projects
- Quizzes: `Quiz`, `Question`, `Answer`, `QuizAttempt`, `UserAnswer`; quiz results are persisted in
  `user_answers` / `quiz_attempts` and propagated into `ModuleProgress`.
- Assignments: `Assignment`, `AssignmentSubmission` (content, file metadata JSON in `file_url`,
  `external_url`, `grade`, `feedback`, `graded_at`, `graded_by`, resubmission fields).
- Projects: `Project`, `ProjectSubmission` (`team_members` JSON, `text_content`, `file_path`,
  `file_name`, grade/feedback/graded_at/graded_by, resubmission fields, `created_at`).
- Group projects store a `team_members` list on the submission plus `TeamAssignmentEvent` audit rows;
  reliable **individual** contribution records exist only as those team/assignment events, so the
  Passport must not claim every member independently completed all work.

---

## EXISTING EVIDENCE

### AI grading / instructor approval
- AI grading lives in three places: classic `AssignmentSubmission.grade`/`feedback` (+ `GradingHistory`,
  `GradingSession`, `Rubric`, `RubricCriterion`), the Excel-specific `ExcelGradingResult`, and the
  AAGE engine (`a7a8e1c3f5b2` migration; `GradingJob`, `EvaluationRun`, `EvaluationResult`,
  `CriterionScore`, `EvaluationEvidence`, `GradingReview`, `GradingAuditLog`).
- Grading routes: `src/routes/grading_routes.py`, `enhanced_grading_routes.py`, `excel_grading_routes.py`,
  `src/api/routes/assessments.py`, `src/routes/instructor_assessment_routes.py`. AI/provisional results
  and instructor-approved results must be distinguished by the Passport; only approved/final results
  may become verified evidence.
- Hook point already exists: `src/services/assessment_change_hooks.py` (called when grades change).

### Project grading
- Instructor grading endpoints in `grading_routes.py` (assignment/project) set `grade`, `feedback`,
  `graded_at`, `graded_by` on the submission. AAGE may add a separate AI result.

### Certificates
- Two certificate tables exist: `quiz_progress_models.Certificate` (`certificate`) and
  `student_models.Certificate` (`certificates`, with a unique `(student_id, course_id)` constraint
  added by migration `a9c3e1f7b2d4`). Certificate Service uses the canonical one.
- `src/services/certificate_service.py` + `src/routes/certificate_routes.py` +
  `src/api/routes/certificates.py`: `evaluate_eligibility`, `generate_certificate` (dedupe, number
  collision retry, transcript + badges), `verify_certificate` (revoked/expired/hash checks, public
  payload). Public verification route has an in-process per-IP rate limiter.
- Canonical policy: published-module completion, required lessons, final assessment, and the 70%
  `CERTIFICATE_PASSING_SCORE` where configured — via `CourseProgressService`. The Passport must
  consume issued certificates only and must not re-implement eligibility.

### Badges / achievements
- `src/services/achievement_service.py` drives `Achievement`/`UserAchievement` with explicit rules;
  badge models exist in `student_models.py`. The Passport should surface these records as-is, and
  add only pass-specific rules (first verified skill, first featured project) with explicit criteria.

---

## EXISTING INTEGRATION

### Authentication
- Stateless JWT (`Authorization: Bearer`, access 1h / refresh 30d, blocklist on logout) via
  Flask-JWT-Extended. Roles are strings in `roles`. No second account system may be created.
- ~30 local copies of `student_required`/`instructor_required`/`admin_required` exist; the Passport
  will use a single local, consistent decorator set in its own route module.

### User identity
- The authenticated `User.id` is the student identity. There is no AfriTech Identity Layer
  integration yet. The new passport rows will carry a nullable `afritech_user_id`-compatible
  external identifier column so a future mapping can be added without a rewrite (documented in
  `identity-integration.md`).

### File storage
- `src/routes/file_upload_routes.py`, `enhanced_file_routes.py` and `services/aage/artifacts.py`
  manage uploads. Submissions reference stored URLs/paths; the Passport stores references only.

### Notifications / jobs / events
- `NotificationService`, `BackgroundTask` model, APScheduler services, and a `/api/v2` integration
  layer with `ApiEvent` + signed webhooks + `Idempotency-Key` support
  (`src/api/events.py`, `src/api/idempotency.py`). These are the preferred integration primitives
  for automatic, retry-safe Passport updates; no new microservice is needed.

### Migrations
- Flask-Migrate/Alembic, versions under `backend/migrations/versions/`. Single current head:
  **`a7a8e1c3f5b2`** (AAGE engine tables). Plus boot-time `db.create_all(checkfirst=True)` and a
  schema self-heal in `main.py`. A new revision must use `down_revision = 'a7a8e1c3f5b2'`.

### Baseline verification
- Backend tests: `594 passed` (WSL venv, 2026-11-22) — clean baseline to preserve.
- Frontend `tsc --noEmit`: **pre-existing failures** in unrelated files
  (`src/components/instructor/EnhancedModificationDashboard.tsx`,
  `src/components/instructor/ai-agent/index-new.ts`); not introduced by this work.

---

## RECOMMENDED TALENT PASSPORT ARCHITECTURE

A single feature module inside the existing Flask app — `src/talent_passport/` — with:

```
EXISTING LMS (source of truth)
  Course/Module/Lesson/Enrollment/Progress
  AssignmentSubmission/ProjectSubmission/QuizAttempt
  Grading (classic + Excel + AAGE) / certificates / achievements
        │  read-only via services + explicit hooks
        ▼
EVIDENCE ENGINE (idempotent, event-driven + backfill)
  resolve mappings → upsert evidence → derive skill status → recompute summaries
        ▼
TALENT PASSPORT DOMAIN
  passport / professional profile / taxonomy / mappings / student skills
  evidence / portfolio curation / visibility / publication / audit
        ▼
READ API + FRONTEND
  private student views · shareable public view (slug) · PDF · instructor/admin controls
        ▼
FUTURE AFRITECH WORK (authorized API / explicit student sharing only)
```

**Data ownership rule:** the LMS owns all learning facts. The Passport owns only curation,
professional self-described information, skill taxonomy/mappings, derived statuses, publication and
audit metadata. Every evidence row references an original LMS record by `(source_type, source_id)`;
no submission, grade, certificate or course row is copied.

**Evidence status rule:** `LEARNING` (enrolment + mapping only) → `EVIDENCE_SUBMITTED` (submission
exists) → `DEMONSTRATED` (approved assessment/project result meeting the mapped criterion) →
`VERIFIED` (explicit instructor/admin verification or issued certificate). Proficiency is populated
only when a mapped rubric/assessment defines a criterion; never from enrolment.

**Automatic updates:** thin, failure-isolated hooks at the existing grade-approval/grade-update,
submission, course-completion and certificate issue/revoke paths call a single idempotent
`notify_talent_passport(...)` entry point. A full `sync_student` backfill handles existing records
and acts as the retry/fallback path.

---

## FILE-LEVEL IMPLEMENTATION PLAN

See `implementation-plan.md` in this directory.
