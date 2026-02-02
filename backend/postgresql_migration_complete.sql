-- PostgreSQL Complete Migration Script for Afritec Bridge LMS
-- Generated on: February 2, 2026
-- COMPREHENSIVE MIGRATION: Complete schema recreation for PostgreSQL
-- This script creates all tables based on the current SQLite schema

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop dependent objects if exist (for clean recreation)
-- Note: Use CASCADE with caution in production
-- DROP SCHEMA public CASCADE;
-- CREATE SCHEMA public;

-- ================================================================
-- UTILITY FUNCTIONS
-- ================================================================

-- Function to safely add columns to existing tables
CREATE OR REPLACE FUNCTION add_column_if_not_exists(table_name text, column_definition text) 
RETURNS void AS $$
BEGIN
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS %s', table_name, column_definition);
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$
LANGUAGE plpgsql;

-- Function to safely create indexes
CREATE OR REPLACE FUNCTION create_index_if_not_exists(index_name text, table_name text, column_spec text) 
RETURNS void AS $$
BEGIN
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I %s', index_name, table_name, column_spec);
EXCEPTION
    WHEN duplicate_table THEN NULL;
END $$
LANGUAGE plpgsql;

-- ================================================================
-- CORE USER AND AUTHENTICATION TABLES
-- ================================================================

-- Roles table
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(64) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Users table (comprehensive)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(80) NOT NULL UNIQUE,
    email VARCHAR(120) NOT NULL UNIQUE,
    password_hash VARCHAR(256) NOT NULL,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    role_id INTEGER REFERENCES roles(id),
    bio TEXT,
    avatar_url VARCHAR(255),
    is_verified BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(100),
    verification_token_expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reset_token VARCHAR(100),
    reset_token_expires_at TIMESTAMP WITH TIME ZONE,
    phone_number VARCHAR(20),
    portfolio_url VARCHAR(255),
    github_username VARCHAR(100),
    linkedin_url VARCHAR(255),
    twitter_username VARCHAR(100),
    website_url VARCHAR(255),
    location VARCHAR(100),
    timezone VARCHAR(50) DEFAULT 'UTC',
    job_title VARCHAR(100),
    company VARCHAR(100),
    industry VARCHAR(100),
    experience_level VARCHAR(20),
    skills TEXT,
    interests TEXT,
    learning_goals TEXT,
    preferred_learning_style VARCHAR(20),
    daily_learning_time INTEGER,
    email_notifications BOOLEAN DEFAULT TRUE,
    push_notifications BOOLEAN DEFAULT TRUE,
    marketing_emails BOOLEAN DEFAULT FALSE,
    weekly_digest BOOLEAN DEFAULT TRUE,
    profile_visibility VARCHAR(20) DEFAULT 'public',
    show_email BOOLEAN DEFAULT FALSE,
    show_progress BOOLEAN DEFAULT TRUE,
    enable_gamification BOOLEAN DEFAULT TRUE,
    show_leaderboard BOOLEAN DEFAULT TRUE,
    must_change_password BOOLEAN DEFAULT FALSE,
    last_login TIMESTAMP WITH TIME ZONE,
    last_activity TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by INTEGER,
    deletion_reason VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE
);

-- ================================================================
-- COURSE RELATED TABLES
-- ================================================================

-- Courses table
CREATE TABLE IF NOT EXISTS courses (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL UNIQUE,
    description TEXT NOT NULL,
    learning_objectives TEXT,
    target_audience VARCHAR(255),
    estimated_duration VARCHAR(100),
    instructor_id INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_published BOOLEAN NOT NULL DEFAULT FALSE,
    difficulty_level VARCHAR(20),
    prerequisites TEXT,
    category VARCHAR(100),
    language VARCHAR(50) DEFAULT 'English',
    max_enrollments INTEGER,
    enrollment_start_date TIMESTAMP WITH TIME ZONE,
    enrollment_end_date TIMESTAMP WITH TIME ZONE,
    course_start_date TIMESTAMP WITH TIME ZONE,
    course_end_date TIMESTAMP WITH TIME ZONE,
    certificate_template VARCHAR(255),
    passing_grade REAL DEFAULT 70.0,
    is_featured BOOLEAN DEFAULT FALSE,
    tags TEXT,
    start_date TIMESTAMP WITH TIME ZONE,
    module_release_count INTEGER,
    module_release_interval VARCHAR(50),
    module_release_interval_days INTEGER
);

-- Course Applications table
CREATE TABLE IF NOT EXISTS course_applications (
    id SERIAL PRIMARY KEY,
    course_id INTEGER NOT NULL REFERENCES courses(id),
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(120) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    whatsapp_number VARCHAR(30),
    gender VARCHAR(17),
    age_range VARCHAR(8),
    country VARCHAR(100),
    city VARCHAR(100),
    education_level VARCHAR(11),
    current_status VARCHAR(13),
    field_of_study VARCHAR(150),
    has_used_excel BOOLEAN,
    excel_skill_level VARCHAR(12),
    excel_tasks_done TEXT,
    motivation TEXT NOT NULL,
    learning_outcomes TEXT,
    career_impact TEXT,
    has_computer BOOLEAN NOT NULL,
    internet_access_type VARCHAR(16),
    preferred_learning_mode VARCHAR(13),
    available_time TEXT,
    committed_to_complete BOOLEAN,
    agrees_to_assessments BOOLEAN,
    referral_source VARCHAR(200),
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    primary_device VARCHAR(7),
    digital_skill_level VARCHAR(12),
    online_learning_experience BOOLEAN,
    available_for_live_sessions BOOLEAN,
    has_internet BOOLEAN NOT NULL,
    risk_score INTEGER,
    is_high_risk BOOLEAN,
    application_score INTEGER,
    final_rank_score REAL,
    readiness_score INTEGER,
    commitment_score INTEGER,
    status VARCHAR(10),
    approved_by INTEGER REFERENCES users(id),
    rejection_reason TEXT,
    admin_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP WITH TIME ZONE
);

-- Course Enrollment Applications table
CREATE TABLE IF NOT EXISTS course_enrollment_applications (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES users(id),
    course_id INTEGER NOT NULL REFERENCES courses(id),
    application_type VARCHAR(20) NOT NULL,
    status VARCHAR(20),
    motivation_letter TEXT,
    prerequisites_met BOOLEAN,
    payment_status VARCHAR(20),
    payment_reference VARCHAR(100),
    reviewed_by INTEGER REFERENCES users(id),
    review_notes TEXT,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    enrolled_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT _student_course_application_uc UNIQUE (student_id, course_id)
);

-- Enrollments table
CREATE TABLE IF NOT EXISTS enrollments (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES users(id),
    course_id INTEGER NOT NULL REFERENCES courses(id),
    enrollment_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    progress REAL DEFAULT 0.0,
    completed_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'active',
    terminated_at TIMESTAMP WITH TIME ZONE,
    termination_reason TEXT,
    terminated_by INTEGER,
    CONSTRAINT _student_course_uc UNIQUE (student_id, course_id)
);

-- Modules table
CREATE TABLE IF NOT EXISTS modules (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    course_id INTEGER NOT NULL REFERENCES courses(id),
    "order" INTEGER NOT NULL,
    learning_objectives TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_published BOOLEAN DEFAULT FALSE,
    estimated_duration INTEGER,
    prerequisites TEXT,
    is_optional BOOLEAN DEFAULT FALSE,
    unlock_criteria TEXT,
    passing_score REAL DEFAULT 70.0,
    is_released BOOLEAN DEFAULT FALSE,
    released_at TIMESTAMP WITH TIME ZONE
);

-- Lessons table
CREATE TABLE IF NOT EXISTS lessons (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content_type VARCHAR(50) NOT NULL,
    content_data TEXT NOT NULL,
    module_id INTEGER NOT NULL REFERENCES modules(id),
    "order" INTEGER NOT NULL,
    learning_objectives TEXT,
    duration_minutes INTEGER,
    is_published BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    description TEXT,
    lesson_type VARCHAR(20) DEFAULT 'content',
    video_url TEXT,
    video_duration INTEGER,
    reading_time INTEGER,
    difficulty_level VARCHAR(20),
    prerequisites TEXT,
    is_preview BOOLEAN DEFAULT FALSE
);

-- ================================================================
-- ASSESSMENT TABLES
-- ================================================================

-- Quizzes table
CREATE TABLE IF NOT EXISTS quizzes (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    course_id INTEGER REFERENCES courses(id),
    module_id INTEGER REFERENCES modules(id),
    lesson_id INTEGER REFERENCES lessons(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    time_limit_minutes INTEGER,
    max_attempts INTEGER DEFAULT 1,
    points_possible REAL DEFAULT 100.0,
    is_published BOOLEAN DEFAULT FALSE,
    time_limit INTEGER,
    passing_score INTEGER DEFAULT 70,
    due_date TIMESTAMP WITH TIME ZONE,
    shuffle_questions BOOLEAN DEFAULT FALSE,
    shuffle_answers BOOLEAN DEFAULT FALSE,
    show_correct_answers BOOLEAN DEFAULT TRUE,
    quiz_type VARCHAR(20) DEFAULT 'practice'
);

-- Questions table
CREATE TABLE IF NOT EXISTS questions (
    id SERIAL PRIMARY KEY,
    quiz_id INTEGER NOT NULL REFERENCES quizzes(id),
    text TEXT NOT NULL,
    question_type VARCHAR(50) NOT NULL,
    "order" INTEGER NOT NULL,
    points REAL DEFAULT 10.0,
    explanation TEXT,
    difficulty_level VARCHAR(20),
    tags TEXT
);

-- Answers table
CREATE TABLE IF NOT EXISTS answers (
    id SERIAL PRIMARY KEY,
    question_id INTEGER NOT NULL REFERENCES questions(id),
    text TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL
);

-- Quiz Attempts table
CREATE TABLE IF NOT EXISTS quiz_attempts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    quiz_id INTEGER NOT NULL REFERENCES quizzes(id),
    attempt_number INTEGER NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    score REAL,
    score_percentage REAL,
    status VARCHAR(22) NOT NULL,
    feedback_viewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Legacy quiz_attempt table (for compatibility)
CREATE TABLE IF NOT EXISTS quiz_attempt (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    quiz_id INTEGER NOT NULL REFERENCES quizzes(id),
    attempt_number INTEGER NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    score REAL,
    status VARCHAR(22) NOT NULL,
    feedback_viewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User Answers table
CREATE TABLE IF NOT EXISTS user_answers (
    id SERIAL PRIMARY KEY,
    quiz_attempt_id INTEGER NOT NULL REFERENCES quiz_attempts(id),
    question_id INTEGER NOT NULL REFERENCES questions(id),
    answer_data JSONB,
    is_correct BOOLEAN,
    points_awarded REAL,
    instructor_feedback TEXT,
    graded_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Legacy user_answer table (for compatibility)
CREATE TABLE IF NOT EXISTS user_answer (
    id SERIAL PRIMARY KEY,
    quiz_attempt_id INTEGER NOT NULL REFERENCES quiz_attempt(id),
    question_id INTEGER NOT NULL REFERENCES questions(id),
    answer_data JSONB,
    is_correct BOOLEAN,
    points_awarded REAL,
    instructor_feedback TEXT,
    graded_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ================================================================
-- ASSIGNMENTS AND PROJECTS
-- ================================================================

-- Assignments table
CREATE TABLE IF NOT EXISTS assignments (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    course_id INTEGER NOT NULL REFERENCES courses(id),
    lesson_id INTEGER REFERENCES lessons(id),
    instructor_id INTEGER NOT NULL REFERENCES users(id),
    due_date TIMESTAMP WITH TIME ZONE,
    max_points REAL,
    submission_type VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    instructions TEXT,
    assignment_type VARCHAR(50) DEFAULT 'essay',
    max_file_size_mb INTEGER DEFAULT 10,
    allowed_file_types TEXT DEFAULT 'pdf,doc,docx',
    points_possible REAL DEFAULT 100.0,
    is_published BOOLEAN DEFAULT FALSE,
    module_id INTEGER,
    max_score INTEGER DEFAULT 100,
    rubric TEXT,
    submission_format VARCHAR(50),
    allow_late_submission BOOLEAN DEFAULT FALSE,
    late_penalty REAL DEFAULT 0.0,
    auto_grade BOOLEAN DEFAULT FALSE,
    modification_requested BOOLEAN DEFAULT FALSE NOT NULL,
    modification_request_reason TEXT,
    modification_requested_at TIMESTAMP WITH TIME ZONE,
    modification_requested_by INTEGER,
    can_resubmit BOOLEAN DEFAULT FALSE NOT NULL,
    max_resubmissions INTEGER NOT NULL DEFAULT 3,
    resubmission_count INTEGER NOT NULL DEFAULT 0
);

-- Assignment Submissions table
CREATE TABLE IF NOT EXISTS assignment_submissions (
    id SERIAL PRIMARY KEY,
    assignment_id INTEGER NOT NULL REFERENCES assignments(id),
    student_id INTEGER NOT NULL REFERENCES users(id),
    content TEXT,
    file_url VARCHAR(255),
    external_url VARCHAR(255),
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    grade REAL,
    feedback TEXT,
    graded_at TIMESTAMP WITH TIME ZONE,
    graded_by INTEGER REFERENCES users(id),
    is_resubmission BOOLEAN DEFAULT FALSE NOT NULL,
    original_submission_id INTEGER,
    resubmission_count INTEGER DEFAULT 0 NOT NULL,
    submission_notes TEXT,
    CONSTRAINT _assignment_student_submission_uc UNIQUE (assignment_id, student_id)
);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    objectives TEXT,
    course_id INTEGER NOT NULL REFERENCES courses(id),
    module_ids TEXT NOT NULL,
    due_date TIMESTAMP WITH TIME ZONE NOT NULL,
    points_possible REAL,
    is_published BOOLEAN DEFAULT FALSE,
    submission_format VARCHAR(50),
    max_file_size_mb INTEGER,
    allowed_file_types VARCHAR(255),
    collaboration_allowed BOOLEAN DEFAULT FALSE,
    max_team_size INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    requirements TEXT,
    deliverables TEXT,
    assessment_criteria TEXT,
    project_type VARCHAR(50),
    max_score INTEGER DEFAULT 100,
    rubric TEXT,
    team_project BOOLEAN DEFAULT FALSE,
    modification_requested BOOLEAN DEFAULT FALSE NOT NULL,
    modification_request_reason TEXT,
    modification_requested_at TIMESTAMP WITH TIME ZONE,
    modification_requested_by INTEGER,
    can_resubmit BOOLEAN DEFAULT FALSE NOT NULL,
    max_resubmissions INTEGER NOT NULL DEFAULT 3,
    resubmission_count INTEGER NOT NULL DEFAULT 0
);

-- Project Submissions table
CREATE TABLE IF NOT EXISTS project_submissions (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id),
    student_id INTEGER NOT NULL REFERENCES users(id),
    team_members TEXT,
    text_content TEXT,
    file_path VARCHAR(500),
    file_name VARCHAR(255),
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    grade REAL,
    feedback TEXT,
    graded_at TIMESTAMP WITH TIME ZONE,
    graded_by INTEGER REFERENCES users(id),
    is_resubmission BOOLEAN NOT NULL DEFAULT FALSE,
    original_submission_id INTEGER REFERENCES project_submissions(id),
    resubmission_count INTEGER NOT NULL DEFAULT 0,
    submission_notes TEXT
);

-- ================================================================
-- PROGRESS TRACKING TABLES
-- ================================================================

-- Lesson Completions table
CREATE TABLE IF NOT EXISTS lesson_completions (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES users(id),
    lesson_id INTEGER NOT NULL REFERENCES lessons(id),
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    time_spent INTEGER DEFAULT 0,
    completed BOOLEAN DEFAULT FALSE,
    reading_progress REAL DEFAULT 0.0,
    engagement_score REAL DEFAULT 0.0,
    scroll_progress REAL DEFAULT 0.0,
    video_progress REAL DEFAULT 0.0,
    reading_component_score REAL DEFAULT 0.0,
    engagement_component_score REAL DEFAULT 0.0,
    quiz_component_score REAL DEFAULT 0.0,
    assignment_component_score REAL DEFAULT 0.0,
    lesson_score REAL DEFAULT 0.0,
    score_last_updated TIMESTAMP WITH TIME ZONE,
    video_current_time REAL DEFAULT 0.0,
    video_duration REAL DEFAULT 0.0,
    video_completed BOOLEAN DEFAULT FALSE,
    video_watch_count INTEGER DEFAULT 0,
    video_last_watched TIMESTAMP WITH TIME ZONE,
    playback_speed REAL DEFAULT 1.0,
    mixed_video_progress TEXT,
    assignment_submitted BOOLEAN DEFAULT FALSE,
    assignment_submission TEXT,
    assignment_file_url VARCHAR(500),
    assignment_submitted_at TIMESTAMP WITH TIME ZONE,
    assignment_graded BOOLEAN DEFAULT FALSE,
    assignment_grade REAL,
    assignment_feedback TEXT,
    assignment_graded_at TIMESTAMP WITH TIME ZONE,
    assignment_needs_resubmission BOOLEAN DEFAULT FALSE,
    modification_request_reason TEXT,
    is_resubmission BOOLEAN DEFAULT FALSE,
    resubmission_reason TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_accessed TIMESTAMP WITH TIME ZONE,
    CONSTRAINT _student_lesson_completion_uc UNIQUE (student_id, lesson_id)
);

-- Module Completion table
CREATE TABLE IF NOT EXISTS module_completion (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    module_id INTEGER NOT NULL REFERENCES modules(id),
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_user_module_completion UNIQUE (user_id, module_id)
);

-- Module Progress table
CREATE TABLE IF NOT EXISTS module_progress (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES users(id),
    module_id INTEGER NOT NULL REFERENCES modules(id),
    enrollment_id INTEGER NOT NULL REFERENCES enrollments(id),
    course_contribution_score REAL,
    quiz_score REAL,
    assignment_score REAL,
    final_assessment_score REAL,
    cumulative_score REAL,
    attempts_count INTEGER DEFAULT 0,
    max_attempts INTEGER,
    status VARCHAR(20),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    failed_at TIMESTAMP WITH TIME ZONE,
    unlocked_at TIMESTAMP WITH TIME ZONE,
    prerequisites_met BOOLEAN DEFAULT FALSE,
    CONSTRAINT _student_module_progress_uc UNIQUE (student_id, module_id, enrollment_id)
);

-- User Progress table
CREATE TABLE IF NOT EXISTS user_progress (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    course_id INTEGER NOT NULL REFERENCES courses(id),
    completion_percentage REAL DEFAULT 0.0,
    total_time_spent INTEGER DEFAULT 0,
    last_accessed TIMESTAMP WITH TIME ZONE,
    current_lesson_id INTEGER REFERENCES lessons(id),
    CONSTRAINT _user_course_progress_uc UNIQUE (user_id, course_id)
);

-- ================================================================
-- SUBMISSIONS AND ASSESSMENTS
-- ================================================================

-- Submissions table (general)
CREATE TABLE IF NOT EXISTS submissions (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES users(id),
    quiz_id INTEGER REFERENCES quizzes(id),
    lesson_id INTEGER REFERENCES lessons(id),
    submission_content TEXT,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    grade REAL,
    feedback TEXT,
    submission_type VARCHAR(20),
    graded_by INTEGER,
    graded_at TIMESTAMP WITH TIME ZONE,
    is_late BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Assessment Attempts table
CREATE TABLE IF NOT EXISTS assessment_attempts (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES users(id),
    assessment_type VARCHAR(20) NOT NULL,
    assessment_id INTEGER NOT NULL,
    module_id INTEGER NOT NULL REFERENCES modules(id),
    attempt_number INTEGER NOT NULL,
    score REAL,
    max_score REAL NOT NULL,
    percentage REAL,
    submission_data TEXT,
    feedback TEXT,
    graded_by INTEGER REFERENCES users(id),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    submitted_at TIMESTAMP WITH TIME ZONE,
    graded_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20)
);

-- ================================================================
-- ANNOUNCEMENTS AND COMMUNICATION
-- ================================================================

-- Announcements table
CREATE TABLE IF NOT EXISTS announcements (
    id SERIAL PRIMARY KEY,
    course_id INTEGER NOT NULL REFERENCES courses(id),
    instructor_id INTEGER NOT NULL REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    announcement_type VARCHAR(20) DEFAULT 'general',
    priority VARCHAR(10) DEFAULT 'normal',
    target_audience VARCHAR(20) DEFAULT 'all',
    expires_at TIMESTAMP WITH TIME ZONE,
    is_pinned BOOLEAN DEFAULT FALSE
);

-- Student Notes table
CREATE TABLE IF NOT EXISTS student_notes (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES users(id),
    lesson_id INTEGER NOT NULL REFERENCES lessons(id),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Student Bookmarks table
CREATE TABLE IF NOT EXISTS student_bookmarks (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES users(id),
    course_id INTEGER NOT NULL REFERENCES courses(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT _student_course_bookmark_uc UNIQUE (student_id, course_id)
);

-- ================================================================
-- FORUM SYSTEM TABLES
-- ================================================================

-- Student Forums table
CREATE TABLE IF NOT EXISTS student_forums (
    id SERIAL PRIMARY KEY,
    course_id INTEGER REFERENCES courses(id),  -- Allow NULL values
    title VARCHAR(255) NOT NULL,
    description TEXT,
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    category VARCHAR(100),
    is_pinned BOOLEAN DEFAULT FALSE,
    is_locked BOOLEAN DEFAULT FALSE,
    view_count INTEGER DEFAULT 0,
    allow_anonymous BOOLEAN DEFAULT TRUE,
    moderated BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    post_count INTEGER DEFAULT 0,
    thread_count INTEGER DEFAULT 0,
    subscriber_count INTEGER DEFAULT 0,
    last_post_id INTEGER,
    last_post_at TIMESTAMP WITH TIME ZONE
);

-- Forum Posts table
CREATE TABLE IF NOT EXISTS forum_posts (
    id SERIAL PRIMARY KEY,
    forum_id INTEGER NOT NULL REFERENCES student_forums(id),
    author_id INTEGER NOT NULL REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    parent_post_id INTEGER REFERENCES forum_posts(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    is_pinned BOOLEAN DEFAULT FALSE,
    is_locked BOOLEAN DEFAULT FALSE,
    is_approved BOOLEAN DEFAULT TRUE,
    is_edited BOOLEAN DEFAULT FALSE,
    like_count INTEGER DEFAULT 0,
    dislike_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    is_flagged BOOLEAN DEFAULT FALSE,
    flag_reason VARCHAR(255),
    moderated_by INTEGER,
    moderated_at TIMESTAMP WITH TIME ZONE,
    is_anonymous BOOLEAN DEFAULT FALSE,
    edited_at TIMESTAMP WITH TIME ZONE,
    edited_by INTEGER,
    moderator_notes TEXT,
    reply_count INTEGER DEFAULT 0,
    edit_count INTEGER DEFAULT 0,
    last_edited_at TIMESTAMP WITH TIME ZONE,
    last_edited_by INTEGER
);

-- Forum Post Likes table
CREATE TABLE IF NOT EXISTS forum_post_likes (
    id SERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL REFERENCES forum_posts(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    is_like BOOLEAN NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT _post_user_like_uc UNIQUE (post_id, user_id)
);

-- Forum Subscriptions table
CREATE TABLE IF NOT EXISTS forum_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    forum_id INTEGER REFERENCES student_forums(id),
    thread_id INTEGER REFERENCES forum_posts(id),
    subscription_type VARCHAR(20) NOT NULL,
    notify_replies BOOLEAN DEFAULT TRUE,
    notify_new_threads BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    CONSTRAINT _user_forum_thread_sub_uc UNIQUE (user_id, forum_id, thread_id)
);

-- Forum Notifications table
CREATE TABLE IF NOT EXISTS forum_notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    forum_id INTEGER REFERENCES student_forums(id),
    post_id INTEGER REFERENCES forum_posts(id),
    notification_type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ================================================================
-- GAMIFICATION AND ACHIEVEMENTS
-- ================================================================

-- Achievements table
CREATE TABLE IF NOT EXISTS achievements (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    title VARCHAR(150) NOT NULL,
    description TEXT NOT NULL,
    icon VARCHAR(100),
    color VARCHAR(20),
    category VARCHAR(50) NOT NULL,
    tier VARCHAR(20),
    points INTEGER DEFAULT 0,
    xp_bonus INTEGER DEFAULT 0,
    criteria_type VARCHAR(50) NOT NULL,
    criteria_value INTEGER NOT NULL,
    criteria_data TEXT,
    is_hidden BOOLEAN DEFAULT FALSE,
    is_repeatable BOOLEAN DEFAULT FALSE,
    is_seasonal BOOLEAN DEFAULT FALSE,
    season_start TIMESTAMP WITH TIME ZONE,
    season_end TIMESTAMP WITH TIME ZONE,
    rarity VARCHAR(20),
    max_earners INTEGER,
    current_earners INTEGER DEFAULT 0,
    unlock_message TEXT,
    share_text VARCHAR(280),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User Achievements table
CREATE TABLE IF NOT EXISTS user_achievements (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    achievement_id INTEGER NOT NULL REFERENCES achievements(id),
    earned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    progress REAL DEFAULT 0.0,
    times_earned INTEGER DEFAULT 1,
    context_data TEXT,
    earned_during_course_id INTEGER REFERENCES courses(id),
    is_showcased BOOLEAN DEFAULT FALSE,
    showcase_order INTEGER,
    shared_count INTEGER DEFAULT 0
);

-- Learning Streaks table
CREATE TABLE IF NOT EXISTS learning_streaks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
    current_streak INTEGER DEFAULT 0,
    last_activity_date DATE,
    longest_streak INTEGER DEFAULT 0,
    longest_streak_start DATE,
    longest_streak_end DATE,
    total_active_days INTEGER DEFAULT 0,
    total_lessons_completed INTEGER DEFAULT 0,
    total_time_minutes INTEGER DEFAULT 0,
    milestones_reached TEXT,
    streak_freezes_available INTEGER DEFAULT 0,
    last_freeze_used DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Student Points table
CREATE TABLE IF NOT EXISTS student_points (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
    total_points INTEGER DEFAULT 0,
    lesson_points INTEGER DEFAULT 0,
    quiz_points INTEGER DEFAULT 0,
    assignment_points INTEGER DEFAULT 0,
    streak_points INTEGER DEFAULT 0,
    achievement_points INTEGER DEFAULT 0,
    social_points INTEGER DEFAULT 0,
    bonus_points INTEGER DEFAULT 0,
    total_xp INTEGER DEFAULT 0,
    current_level INTEGER DEFAULT 1,
    xp_to_next_level INTEGER DEFAULT 100,
    global_rank INTEGER,
    course_ranks TEXT,
    points_this_week INTEGER DEFAULT 0,
    points_this_month INTEGER DEFAULT 0,
    week_reset_date DATE,
    month_reset_date DATE,
    point_multiplier REAL DEFAULT 1.0,
    multiplier_expires_at TIMESTAMP WITH TIME ZONE,
    last_points_earned_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Milestones table
CREATE TABLE IF NOT EXISTS milestones (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    title VARCHAR(150) NOT NULL,
    description TEXT NOT NULL,
    icon VARCHAR(100),
    color VARCHAR(20),
    milestone_type VARCHAR(50) NOT NULL,
    scope VARCHAR(20),
    criteria_type VARCHAR(50) NOT NULL,
    criteria_value INTEGER NOT NULL,
    course_id INTEGER REFERENCES courses(id),
    points_reward INTEGER DEFAULT 0,
    badge_id INTEGER,
    unlock_content TEXT,
    celebration_message TEXT,
    is_major BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User Milestones table
CREATE TABLE IF NOT EXISTS user_milestones (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    milestone_id INTEGER NOT NULL REFERENCES milestones(id),
    reached_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    context_data TEXT,
    CONSTRAINT _user_milestone_uc UNIQUE (user_id, milestone_id)
);

-- Leaderboards table
CREATE TABLE IF NOT EXISTS leaderboards (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    title VARCHAR(150) NOT NULL,
    description TEXT,
    metric VARCHAR(50) NOT NULL,
    time_period VARCHAR(20),
    scope VARCHAR(20),
    course_id INTEGER REFERENCES courses(id),
    icon VARCHAR(100),
    color VARCHAR(20),
    max_displayed INTEGER DEFAULT 10,
    top_rewards TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Quest Challenges table
CREATE TABLE IF NOT EXISTS quest_challenges (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    title VARCHAR(150) NOT NULL,
    description TEXT NOT NULL,
    challenge_type VARCHAR(50) NOT NULL,
    difficulty VARCHAR(20),
    objectives TEXT NOT NULL,
    progress_tracking TEXT NOT NULL,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    completion_points INTEGER DEFAULT 0,
    completion_xp INTEGER DEFAULT 0,
    reward_badges TEXT,
    special_reward TEXT,
    icon VARCHAR(100),
    banner_image VARCHAR(255),
    color_theme VARCHAR(20),
    max_participants INTEGER,
    current_participants INTEGER DEFAULT 0,
    completion_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User Quest Progress table
CREATE TABLE IF NOT EXISTS user_quest_progress (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    quest_id INTEGER NOT NULL REFERENCES quest_challenges(id),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    progress_data TEXT,
    completion_percentage REAL DEFAULT 0.0,
    status VARCHAR(20) DEFAULT 'active',
    CONSTRAINT _user_quest_uc UNIQUE (user_id, quest_id)
);

-- ================================================================
-- BADGE SYSTEM TABLES
-- ================================================================

-- Badge table (simple badges)
CREATE TABLE IF NOT EXISTS badge (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT NOT NULL,
    criteria_description TEXT NOT NULL,
    icon_url VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Badges table (enhanced)
CREATE TABLE IF NOT EXISTS badges (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    icon_url VARCHAR(255),
    criteria TEXT,
    points INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Skill Badges table
CREATE TABLE IF NOT EXISTS skill_badges (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT NOT NULL,
    icon_url VARCHAR(255),
    criteria TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    difficulty_level VARCHAR(20) NOT NULL,
    points_value INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- User Badge table (simple)
CREATE TABLE IF NOT EXISTS user_badge (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    badge_id INTEGER NOT NULL REFERENCES badge(id),
    awarded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    context_course_id INTEGER REFERENCES courses(id),
    CONSTRAINT uq_user_badge_context UNIQUE (user_id, badge_id, context_course_id)
);

-- User Badges table (enhanced)
CREATE TABLE IF NOT EXISTS user_badges (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    badge_id INTEGER NOT NULL REFERENCES badges(id),
    earned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT _user_badge_uc UNIQUE (user_id, badge_id)
);

-- Student Skill Badges table
CREATE TABLE IF NOT EXISTS student_skill_badges (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES users(id),
    badge_id INTEGER NOT NULL REFERENCES skill_badges(id),
    course_id INTEGER REFERENCES courses(id),
    module_id INTEGER REFERENCES modules(id),
    earned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    evidence_data TEXT,
    verified BOOLEAN DEFAULT FALSE,
    verified_by INTEGER REFERENCES users(id),
    verified_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT _student_badge_context_uc UNIQUE (student_id, badge_id, course_id, module_id)
);

-- ================================================================
-- CERTIFICATE AND ANALYTICS TABLES
-- ================================================================

-- Certificate table (simple)
CREATE TABLE IF NOT EXISTS certificate (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    course_id INTEGER NOT NULL REFERENCES courses(id),
    issue_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    certificate_uid VARCHAR(255) NOT NULL UNIQUE,
    certificate_url VARCHAR(255),
    template_used VARCHAR(255),
    CONSTRAINT uq_user_course_certificate UNIQUE (user_id, course_id)
);

-- Certificates table (enhanced)
CREATE TABLE IF NOT EXISTS certificates (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES users(id),
    course_id INTEGER NOT NULL REFERENCES courses(id),
    enrollment_id INTEGER NOT NULL REFERENCES enrollments(id),
    certificate_number VARCHAR(100) NOT NULL UNIQUE,
    overall_score REAL NOT NULL,
    grade VARCHAR(10) NOT NULL,
    skills_acquired TEXT,
    portfolio_items TEXT,
    issued_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    verification_hash VARCHAR(256) NOT NULL
);

-- Student Transcripts table
CREATE TABLE IF NOT EXISTS student_transcripts (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES users(id),
    total_courses_enrolled INTEGER DEFAULT 0,
    total_courses_completed INTEGER DEFAULT 0,
    total_certificates INTEGER DEFAULT 0,
    total_badges INTEGER DEFAULT 0,
    overall_gpa REAL DEFAULT 0.0,
    total_learning_hours INTEGER DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    skills_acquired TEXT,
    competency_levels TEXT
);

-- Opportunities table
CREATE TABLE IF NOT EXISTS opportunities (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    type VARCHAR(100) NOT NULL,
    location VARCHAR(255),
    company_name VARCHAR(255),
    application_link VARCHAR(500) NOT NULL,
    application_deadline TIMESTAMP WITH TIME ZONE,
    posted_by_id INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Student Suspensions table
CREATE TABLE IF NOT EXISTS student_suspensions (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES users(id),
    course_id INTEGER NOT NULL REFERENCES courses(id),
    enrollment_id INTEGER NOT NULL REFERENCES enrollments(id),
    suspended_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reason VARCHAR(255),
    failed_module_id INTEGER NOT NULL REFERENCES modules(id),
    total_attempts_made INTEGER NOT NULL,
    can_appeal BOOLEAN DEFAULT FALSE,
    appeal_deadline TIMESTAMP WITH TIME ZONE,
    appeal_submitted BOOLEAN DEFAULT FALSE,
    appeal_text TEXT,
    appeal_submitted_at TIMESTAMP WITH TIME ZONE,
    review_status VARCHAR(20),
    reviewed_by INTEGER REFERENCES users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_notes TEXT,
    reinstated BOOLEAN DEFAULT FALSE,
    reinstated_at TIMESTAMP WITH TIME ZONE,
    additional_attempts_granted INTEGER DEFAULT 0,
    CONSTRAINT _student_course_suspension_uc UNIQUE (student_id, course_id, enrollment_id)
);

-- Learning Analytics table
CREATE TABLE IF NOT EXISTS learning_analytics (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES users(id),
    course_id INTEGER NOT NULL REFERENCES courses(id),
    daily_learning_minutes TEXT,
    weekly_learning_minutes TEXT,
    peak_learning_hours TEXT,
    quiz_performance_trend TEXT,
    assignment_performance_trend TEXT,
    engagement_score REAL DEFAULT 0.0,
    weak_topics TEXT,
    recommended_reviews TEXT,
    preferred_content_types TEXT,
    learning_velocity REAL DEFAULT 0.0,
    last_calculated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT _student_course_analytics_uc UNIQUE (student_id, course_id)
);

-- ================================================================
-- FILE MANAGEMENT TABLES (NEW)
-- ================================================================

-- File Comments table
CREATE TABLE IF NOT EXISTS file_comments (
    id SERIAL PRIMARY KEY,
    file_id VARCHAR(255) NOT NULL,
    submission_id INTEGER REFERENCES assignment_submissions(id),
    project_submission_id INTEGER REFERENCES project_submissions(id),
    instructor_id INTEGER NOT NULL REFERENCES users(id),
    comment_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_private BOOLEAN DEFAULT FALSE
);

-- File Analyses table
CREATE TABLE IF NOT EXISTS file_analyses (
    id SERIAL PRIMARY KEY,
    file_id VARCHAR(255) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR(100),
    file_category VARCHAR(50),
    is_viewable BOOLEAN DEFAULT FALSE,
    word_count INTEGER,
    page_count INTEGER,
    has_images BOOLEAN DEFAULT FALSE,
    has_tables BOOLEAN DEFAULT FALSE,
    is_password_protected BOOLEAN DEFAULT FALSE,
    is_corrupted BOOLEAN DEFAULT FALSE,
    virus_scan_clean BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    analyzed_at TIMESTAMP WITH TIME ZONE
);

-- ================================================================
-- INDEXES FOR PERFORMANCE
-- ================================================================

-- Create all necessary indexes
SELECT create_index_if_not_exists('idx_users_email', 'users', '(email)');
SELECT create_index_if_not_exists('idx_users_username', 'users', '(username)');
SELECT create_index_if_not_exists('idx_enrollments_student', 'enrollments', '(student_id)');
SELECT create_index_if_not_exists('idx_enrollments_course', 'enrollments', '(course_id)');
SELECT create_index_if_not_exists('idx_modules_course', 'modules', '(course_id)');
SELECT create_index_if_not_exists('idx_lessons_module', 'lessons', '(module_id)');
SELECT create_index_if_not_exists('idx_quiz_attempts_user', 'quiz_attempts', '(user_id)');
SELECT create_index_if_not_exists('idx_quiz_attempts_quiz', 'quiz_attempts', '(quiz_id)');
SELECT create_index_if_not_exists('idx_user_achievements_user', 'user_achievements', '(user_id)');
SELECT create_index_if_not_exists('idx_user_achievements_achievement', 'user_achievements', '(achievement_id)');
SELECT create_index_if_not_exists('idx_user_achievement', 'user_achievements', '(user_id, achievement_id)');
SELECT create_index_if_not_exists('idx_user_milestone', 'user_milestones', '(user_id, milestone_id)');
SELECT create_index_if_not_exists('idx_user_quest', 'user_quest_progress', '(user_id, quest_id)');
SELECT create_index_if_not_exists('idx_submissions_student', 'submissions', '(student_id)');
SELECT create_index_if_not_exists('ix_course_applications_email', 'course_applications', '(email)');

-- Forum-specific indexes
SELECT create_index_if_not_exists('idx_forum_posts_forum_id', 'forum_posts', '(forum_id)');
SELECT create_index_if_not_exists('idx_forum_posts_author_id', 'forum_posts', '(author_id)');
SELECT create_index_if_not_exists('idx_forum_posts_parent_id', 'forum_posts', '(parent_post_id)');
SELECT create_index_if_not_exists('idx_forum_posts_created_at', 'forum_posts', '(created_at)');
SELECT create_index_if_not_exists('idx_forum_posts_is_active', 'forum_posts', '(is_active)');
SELECT create_index_if_not_exists('idx_forum_posts_is_approved', 'forum_posts', '(is_approved)');
SELECT create_index_if_not_exists('idx_forum_posts_is_flagged', 'forum_posts', '(is_flagged)');
SELECT create_index_if_not_exists('idx_student_forums_category', 'student_forums', '(category)');
SELECT create_index_if_not_exists('idx_student_forums_is_active', 'student_forums', '(is_active)');
SELECT create_index_if_not_exists('idx_student_forums_course_id', 'student_forums', '(course_id)');
SELECT create_index_if_not_exists('idx_forum_subscriptions_user_forum', 'forum_subscriptions', '(user_id, forum_id)');
SELECT create_index_if_not_exists('idx_forum_post_likes_user_post', 'forum_post_likes', '(user_id, post_id)');

-- ================================================================
-- INITIAL DATA SEEDING
-- ================================================================

-- Insert default roles if they don't exist
INSERT INTO roles (name, description) VALUES 
    ('student', 'Student role with access to courses and learning materials')
ON CONFLICT (name) DO NOTHING;

INSERT INTO roles (name, description) VALUES 
    ('instructor', 'Instructor role with course creation and management capabilities')
ON CONFLICT (name) DO NOTHING;

INSERT INTO roles (name, description) VALUES 
    ('admin', 'Administrator role with full system access')
ON CONFLICT (name) DO NOTHING;

-- Clean up utility functions
DROP FUNCTION IF EXISTS add_column_if_not_exists(text, text);
DROP FUNCTION IF EXISTS create_index_if_not_exists(text, text, text);

-- Set timezone
SET timezone = 'UTC';

-- Completion message
DO $$
BEGIN
    RAISE NOTICE 'PostgreSQL migration completed successfully!';
    RAISE NOTICE 'All tables and indexes have been created.';
    RAISE NOTICE 'Default roles have been seeded.';
END $$;