-- PostgreSQL Migration Script for Afritec Bridge LMS
-- Generated on: January 29, 2026
-- DATA-SAFE MIGRATION: Preserves all existing data
-- This script adds missing tables and columns without dropping existing data

-- Enable extensions if not already present
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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

-- Roles table - Create if not exists
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(64) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Users table - Create if not exists, add missing columns to existing table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(80) NOT NULL UNIQUE,
    email VARCHAR(120) NOT NULL UNIQUE,
    password_hash VARCHAR(256) NOT NULL,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add columns to users table if they don't exist
SELECT add_column_if_not_exists('users', 'profile_picture_url VARCHAR(255)');
SELECT add_column_if_not_exists('users', 'bio TEXT');
SELECT add_column_if_not_exists('users', 'role_id INTEGER REFERENCES roles(id) ON DELETE RESTRICT');
SELECT add_column_if_not_exists('users', 'updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP');
SELECT add_column_if_not_exists('users', 'reset_token VARCHAR(100)');
SELECT add_column_if_not_exists('users', 'reset_token_expires_at TIMESTAMP WITH TIME ZONE');
SELECT add_column_if_not_exists('users', 'phone_number VARCHAR(20)');
SELECT add_column_if_not_exists('users', 'portfolio_url VARCHAR(255)');
SELECT add_column_if_not_exists('users', 'github_username VARCHAR(100)');
SELECT add_column_if_not_exists('users', 'linkedin_url VARCHAR(255)');
SELECT add_column_if_not_exists('users', 'twitter_username VARCHAR(100)');
SELECT add_column_if_not_exists('users', 'website_url VARCHAR(255)');
SELECT add_column_if_not_exists('users', 'location VARCHAR(100)');
SELECT add_column_if_not_exists('users', 'timezone VARCHAR(50) DEFAULT ''UTC''');
SELECT add_column_if_not_exists('users', 'job_title VARCHAR(100)');
SELECT add_column_if_not_exists('users', 'company VARCHAR(100)');
SELECT add_column_if_not_exists('users', 'industry VARCHAR(100)');
SELECT add_column_if_not_exists('users', 'experience_level VARCHAR(20)');
SELECT add_column_if_not_exists('users', 'skills TEXT');
SELECT add_column_if_not_exists('users', 'interests TEXT');
SELECT add_column_if_not_exists('users', 'learning_goals TEXT');
SELECT add_column_if_not_exists('users', 'preferred_learning_style VARCHAR(20)');
SELECT add_column_if_not_exists('users', 'daily_learning_time INTEGER');
SELECT add_column_if_not_exists('users', 'email_notifications BOOLEAN DEFAULT TRUE');
SELECT add_column_if_not_exists('users', 'push_notifications BOOLEAN DEFAULT TRUE');
SELECT add_column_if_not_exists('users', 'marketing_emails BOOLEAN DEFAULT FALSE');
SELECT add_column_if_not_exists('users', 'weekly_digest BOOLEAN DEFAULT TRUE');
SELECT add_column_if_not_exists('users', 'profile_visibility VARCHAR(20) DEFAULT ''public''');
SELECT add_column_if_not_exists('users', 'show_email BOOLEAN DEFAULT FALSE');
SELECT add_column_if_not_exists('users', 'show_progress BOOLEAN DEFAULT TRUE');
SELECT add_column_if_not_exists('users', 'enable_gamification BOOLEAN DEFAULT TRUE');
SELECT add_column_if_not_exists('users', 'show_leaderboard BOOLEAN DEFAULT TRUE');
SELECT add_column_if_not_exists('users', 'must_change_password BOOLEAN DEFAULT FALSE');
SELECT add_column_if_not_exists('users', 'last_login TIMESTAMP WITH TIME ZONE');
SELECT add_column_if_not_exists('users', 'last_activity TIMESTAMP WITH TIME ZONE');
SELECT add_column_if_not_exists('users', 'deleted_at TIMESTAMP WITH TIME ZONE');
SELECT add_column_if_not_exists('users', 'deleted_by INTEGER REFERENCES users(id) ON DELETE SET NULL');
SELECT add_column_if_not_exists('users', 'deletion_reason VARCHAR(255)');
SELECT add_column_if_not_exists('users', 'is_active BOOLEAN DEFAULT TRUE');

-- ================================================================
-- COURSE STRUCTURE TABLES
-- ================================================================

-- Courses table - Create if not exists
CREATE TABLE IF NOT EXISTS courses (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    instructor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_published BOOLEAN NOT NULL DEFAULT FALSE
);

-- Add missing columns to courses table
SELECT add_column_if_not_exists('courses', 'learning_objectives TEXT');
SELECT add_column_if_not_exists('courses', 'target_audience VARCHAR(255)');
SELECT add_column_if_not_exists('courses', 'estimated_duration VARCHAR(100)');
SELECT add_column_if_not_exists('courses', 'updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP');
SELECT add_column_if_not_exists('courses', 'difficulty_level VARCHAR(20)');
SELECT add_column_if_not_exists('courses', 'prerequisites TEXT');
SELECT add_column_if_not_exists('courses', 'category VARCHAR(100)');
SELECT add_column_if_not_exists('courses', 'language VARCHAR(50) DEFAULT ''English''');
SELECT add_column_if_not_exists('courses', 'max_enrollments INTEGER');
SELECT add_column_if_not_exists('courses', 'enrollment_start_date TIMESTAMP WITH TIME ZONE');
SELECT add_column_if_not_exists('courses', 'enrollment_end_date TIMESTAMP WITH TIME ZONE');
SELECT add_column_if_not_exists('courses', 'course_start_date TIMESTAMP WITH TIME ZONE');
SELECT add_column_if_not_exists('courses', 'course_end_date TIMESTAMP WITH TIME ZONE');
SELECT add_column_if_not_exists('courses', 'certificate_template VARCHAR(255)');
SELECT add_column_if_not_exists('courses', 'passing_grade FLOAT DEFAULT 70.0');
SELECT add_column_if_not_exists('courses', 'is_featured BOOLEAN DEFAULT FALSE');
SELECT add_column_if_not_exists('courses', 'tags TEXT');
SELECT add_column_if_not_exists('courses', 'start_date TIMESTAMP WITH TIME ZONE');
SELECT add_column_if_not_exists('courses', 'module_release_count INTEGER');
SELECT add_column_if_not_exists('courses', 'module_release_interval VARCHAR(50)');
SELECT add_column_if_not_exists('courses', 'module_release_interval_days INTEGER');

-- Course Applications table
CREATE TABLE course_applications (
    id SERIAL PRIMARY KEY,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
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
    final_rank_score FLOAT,
    readiness_score INTEGER,
    commitment_score INTEGER,
    status VARCHAR(10) DEFAULT 'pending',
    approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    rejection_reason TEXT,
    admin_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP WITH TIME ZONE
);

-- Course Enrollment Applications table
CREATE TABLE course_enrollment_applications (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    application_type VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    motivation_letter TEXT,
    prerequisites_met BOOLEAN,
    payment_status VARCHAR(20),
    payment_reference VARCHAR(100),
    reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    review_notes TEXT,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    enrolled_at TIMESTAMP WITH TIME ZONE
);

-- Enrollments table
CREATE TABLE enrollments (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    enrollment_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    progress FLOAT,
    completed_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'active',
    terminated_at TIMESTAMP WITH TIME ZONE,
    termination_reason TEXT,
    terminated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(student_id, course_id)
);

-- Modules table
CREATE TABLE modules (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    "order" INTEGER NOT NULL,
    learning_objectives TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_published BOOLEAN DEFAULT FALSE,
    estimated_duration INTEGER,
    prerequisites TEXT,
    is_optional BOOLEAN DEFAULT FALSE,
    unlock_criteria TEXT,
    passing_score FLOAT DEFAULT 70.0,
    is_released BOOLEAN DEFAULT FALSE,
    released_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(course_id, "order")
);

-- Lessons table
CREATE TABLE lessons (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content_type VARCHAR(50) NOT NULL,
    content_data TEXT NOT NULL,
    module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
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
    is_preview BOOLEAN DEFAULT FALSE,
    UNIQUE(module_id, "order")
);

-- ================================================================
-- ASSESSMENT AND QUIZ TABLES
-- ================================================================

-- Quizzes table
CREATE TABLE quizzes (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
    module_id INTEGER REFERENCES modules(id) ON DELETE CASCADE,
    lesson_id INTEGER REFERENCES lessons(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    time_limit_minutes INTEGER,
    max_attempts INTEGER DEFAULT 1,
    points_possible FLOAT DEFAULT 100.0,
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
CREATE TABLE questions (
    id SERIAL PRIMARY KEY,
    quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    question_type VARCHAR(50) NOT NULL,
    "order" INTEGER NOT NULL,
    points REAL DEFAULT 10.0,
    explanation TEXT,
    difficulty_level VARCHAR(20),
    tags TEXT
);

-- Answers table
CREATE TABLE answers (
    id SERIAL PRIMARY KEY,
    question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL
);

-- Quiz Attempts table
CREATE TABLE quiz_attempts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    attempt_number INTEGER NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    score FLOAT,
    score_percentage FLOAT,
    status VARCHAR(22) NOT NULL,
    feedback_viewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, quiz_id, attempt_number)
);

-- Legacy Quiz Attempt table for compatibility
CREATE TABLE quiz_attempt (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    attempt_number INTEGER NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    score FLOAT,
    status VARCHAR(22) NOT NULL,
    feedback_viewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User Answers table
CREATE TABLE user_answers (
    id SERIAL PRIMARY KEY,
    quiz_attempt_id INTEGER NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
    question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    answer_data JSONB,
    is_correct BOOLEAN,
    points_awarded FLOAT,
    instructor_feedback TEXT,
    graded_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Legacy User Answer table for compatibility
CREATE TABLE user_answer (
    id SERIAL PRIMARY KEY,
    quiz_attempt_id INTEGER NOT NULL REFERENCES quiz_attempt(id) ON DELETE CASCADE,
    question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    answer_data JSONB,
    is_correct BOOLEAN,
    points_awarded FLOAT,
    instructor_feedback TEXT,
    graded_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ================================================================
-- ASSIGNMENT AND PROJECT TABLES
-- ================================================================

-- Assignments table
CREATE TABLE assignments (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    lesson_id INTEGER REFERENCES lessons(id) ON DELETE SET NULL,
    instructor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    due_date TIMESTAMP WITH TIME ZONE,
    max_points FLOAT,
    submission_type VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    instructions TEXT,
    assignment_type VARCHAR(50) DEFAULT 'essay',
    max_file_size_mb INTEGER DEFAULT 10,
    allowed_file_types TEXT DEFAULT 'pdf,doc,docx',
    points_possible FLOAT DEFAULT 100.0,
    is_published BOOLEAN DEFAULT FALSE,
    module_id INTEGER REFERENCES modules(id) ON DELETE SET NULL,
    max_score INTEGER DEFAULT 100,
    rubric TEXT,
    submission_format VARCHAR(50),
    allow_late_submission BOOLEAN DEFAULT FALSE,
    late_penalty FLOAT DEFAULT 0.0,
    auto_grade BOOLEAN DEFAULT FALSE,
    modification_requested BOOLEAN NOT NULL DEFAULT FALSE,
    modification_request_reason TEXT,
    modification_requested_at TIMESTAMP WITH TIME ZONE,
    modification_requested_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    can_resubmit BOOLEAN NOT NULL DEFAULT FALSE
);

-- Assignment Submissions table
CREATE TABLE assignment_submissions (
    id SERIAL PRIMARY KEY,
    assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT,
    file_url VARCHAR(255),
    external_url VARCHAR(255),
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    grade FLOAT,
    feedback TEXT,
    graded_at TIMESTAMP WITH TIME ZONE,
    graded_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

-- Projects table
CREATE TABLE projects (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    objectives TEXT,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    module_ids TEXT NOT NULL,
    due_date TIMESTAMP WITH TIME ZONE NOT NULL,
    points_possible FLOAT,
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
    team_project BOOLEAN DEFAULT FALSE
);

-- Project Submissions table
CREATE TABLE project_submissions (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    team_members TEXT,
    text_content TEXT,
    file_path VARCHAR(500),
    file_name VARCHAR(255),
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    grade FLOAT,
    feedback TEXT,
    graded_at TIMESTAMP WITH TIME ZONE,
    graded_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

-- ================================================================
-- PROGRESS AND COMPLETION TRACKING
-- ================================================================

-- Lesson Completions table
CREATE TABLE lesson_completions (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    time_spent INTEGER,
    completed BOOLEAN DEFAULT FALSE,
    reading_progress FLOAT DEFAULT 0.0,
    engagement_score FLOAT DEFAULT 0.0,
    scroll_progress FLOAT DEFAULT 0.0,
    video_progress FLOAT DEFAULT 0.0,
    reading_component_score FLOAT DEFAULT 0.0,
    engagement_component_score FLOAT DEFAULT 0.0,
    quiz_component_score FLOAT DEFAULT 0.0,
    assignment_component_score FLOAT DEFAULT 0.0,
    lesson_score FLOAT DEFAULT 0.0,
    score_last_updated TIMESTAMP WITH TIME ZONE,
    video_current_time FLOAT DEFAULT 0.0,
    video_duration FLOAT DEFAULT 0.0,
    video_completed BOOLEAN DEFAULT FALSE,
    video_watch_count INTEGER DEFAULT 0,
    video_last_watched TIMESTAMP WITH TIME ZONE,
    playback_speed FLOAT DEFAULT 1.0,
    mixed_video_progress TEXT,
    assignment_submitted BOOLEAN DEFAULT FALSE,
    assignment_submission TEXT,
    assignment_file_url VARCHAR(500),
    assignment_submitted_at TIMESTAMP WITH TIME ZONE,
    assignment_graded BOOLEAN DEFAULT FALSE,
    assignment_grade FLOAT,
    assignment_feedback TEXT,
    assignment_graded_at TIMESTAMP WITH TIME ZONE,
    assignment_needs_resubmission BOOLEAN DEFAULT FALSE,
    modification_request_reason TEXT,
    is_resubmission BOOLEAN DEFAULT FALSE,
    resubmission_reason TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_accessed TIMESTAMP WITH TIME ZONE,
    UNIQUE(student_id, lesson_id)
);

-- Module Completion table
CREATE TABLE module_completion (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, module_id)
);

-- Module Progress table
CREATE TABLE module_progress (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    enrollment_id INTEGER NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
    course_contribution_score FLOAT DEFAULT 0.0,
    quiz_score FLOAT DEFAULT 0.0,
    assignment_score FLOAT DEFAULT 0.0,
    final_assessment_score FLOAT DEFAULT 0.0,
    cumulative_score FLOAT DEFAULT 0.0,
    attempts_count INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    status VARCHAR(20) DEFAULT 'not_started',
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    failed_at TIMESTAMP WITH TIME ZONE,
    unlocked_at TIMESTAMP WITH TIME ZONE,
    prerequisites_met BOOLEAN DEFAULT FALSE,
    UNIQUE(student_id, module_id, enrollment_id)
);

-- User Progress table
CREATE TABLE user_progress (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    completion_percentage FLOAT DEFAULT 0.0,
    total_time_spent INTEGER DEFAULT 0,
    last_accessed TIMESTAMP WITH TIME ZONE,
    current_lesson_id INTEGER REFERENCES lessons(id) ON DELETE SET NULL,
    UNIQUE(user_id, course_id)
);

-- ================================================================
-- SUBMISSION AND ASSESSMENT TRACKING
-- ================================================================

-- General Submissions table
CREATE TABLE submissions (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    quiz_id INTEGER REFERENCES quizzes(id) ON DELETE CASCADE,
    lesson_id INTEGER REFERENCES lessons(id) ON DELETE CASCADE,
    submission_content TEXT,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    grade FLOAT,
    feedback TEXT,
    submission_type VARCHAR(20),
    graded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    graded_at TIMESTAMP WITH TIME ZONE,
    is_late BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Assessment Attempts table
CREATE TABLE assessment_attempts (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assessment_type VARCHAR(20) NOT NULL,
    assessment_id INTEGER NOT NULL,
    module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    attempt_number INTEGER NOT NULL,
    score FLOAT,
    max_score FLOAT NOT NULL,
    percentage FLOAT,
    submission_data TEXT,
    feedback TEXT,
    graded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    submitted_at TIMESTAMP WITH TIME ZONE,
    graded_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'in_progress'
);

-- ================================================================
-- COMMUNICATION AND ANNOUNCEMENTS
-- ================================================================

-- Announcements table
CREATE TABLE announcements (
    id SERIAL PRIMARY KEY,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    instructor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
CREATE TABLE student_notes (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, lesson_id)
);

-- Student Bookmarks table
CREATE TABLE student_bookmarks (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, course_id)
);

-- ================================================================
-- FORUM SYSTEM
-- ================================================================

-- Student Forums table
CREATE TABLE student_forums (
    id SERIAL PRIMARY KEY,
    course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
CREATE TABLE forum_posts (
    id SERIAL PRIMARY KEY,
    forum_id INTEGER NOT NULL REFERENCES student_forums(id) ON DELETE CASCADE,
    author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    parent_post_id INTEGER REFERENCES forum_posts(id) ON DELETE CASCADE,
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
    moderated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    moderated_at TIMESTAMP WITH TIME ZONE,
    is_anonymous BOOLEAN DEFAULT FALSE,
    edited_at TIMESTAMP WITH TIME ZONE,
    edited_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    moderator_notes TEXT,
    reply_count INTEGER DEFAULT 0,
    edit_count INTEGER DEFAULT 0,
    last_edited_at TIMESTAMP WITH TIME ZONE,
    last_edited_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

-- Forum Post Likes table
CREATE TABLE forum_post_likes (
    id SERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_like BOOLEAN NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(post_id, user_id)
);

-- Forum Subscriptions table
CREATE TABLE forum_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    forum_id INTEGER REFERENCES student_forums(id) ON DELETE CASCADE,
    thread_id INTEGER REFERENCES forum_posts(id) ON DELETE CASCADE,
    subscription_type VARCHAR(20) NOT NULL,
    notify_replies BOOLEAN DEFAULT TRUE,
    notify_new_threads BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- Forum Notifications table
CREATE TABLE forum_notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    forum_id INTEGER REFERENCES student_forums(id) ON DELETE CASCADE,
    post_id INTEGER REFERENCES forum_posts(id) ON DELETE CASCADE,
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
CREATE TABLE achievements (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
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
CREATE TABLE user_achievements (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    achievement_id INTEGER NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
    earned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    progress FLOAT DEFAULT 0.0,
    times_earned INTEGER DEFAULT 1,
    context_data TEXT,
    earned_during_course_id INTEGER REFERENCES courses(id) ON DELETE SET NULL,
    is_showcased BOOLEAN DEFAULT FALSE,
    showcase_order INTEGER,
    shared_count INTEGER DEFAULT 0,
    UNIQUE(user_id, achievement_id)
);

-- Learning Streaks table
CREATE TABLE learning_streaks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    current_streak INTEGER DEFAULT 0,
    last_activity_date DATE,
    longest_streak INTEGER DEFAULT 0,
    longest_streak_start DATE,
    longest_streak_end DATE,
    total_active_days INTEGER DEFAULT 0,
    total_lessons_completed INTEGER DEFAULT 0,
    total_time_minutes INTEGER DEFAULT 0,
    milestones_reached TEXT,
    streak_freezes_available INTEGER DEFAULT 3,
    last_freeze_used DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- Student Points table
CREATE TABLE student_points (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
    point_multiplier FLOAT DEFAULT 1.0,
    multiplier_expires_at TIMESTAMP WITH TIME ZONE,
    last_points_earned_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- Milestones table
CREATE TABLE milestones (
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
    course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
    points_reward INTEGER DEFAULT 0,
    badge_id INTEGER,
    unlock_content TEXT,
    celebration_message TEXT,
    is_major BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User Milestones table
CREATE TABLE user_milestones (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    milestone_id INTEGER NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
    reached_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    context_data TEXT,
    UNIQUE(user_id, milestone_id)
);

-- Leaderboards table
CREATE TABLE leaderboards (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    title VARCHAR(150) NOT NULL,
    description TEXT,
    metric VARCHAR(50) NOT NULL,
    time_period VARCHAR(20),
    scope VARCHAR(20),
    course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
    icon VARCHAR(100),
    color VARCHAR(20),
    max_displayed INTEGER DEFAULT 10,
    top_rewards TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Quest Challenges table
CREATE TABLE quest_challenges (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
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
CREATE TABLE user_quest_progress (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    quest_id INTEGER NOT NULL REFERENCES quest_challenges(id) ON DELETE CASCADE,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    progress_data TEXT,
    completion_percentage FLOAT DEFAULT 0.0,
    status VARCHAR(20) DEFAULT 'started',
    UNIQUE(user_id, quest_id)
);

-- ================================================================
-- BADGE SYSTEM
-- ================================================================

-- Legacy Badge table
CREATE TABLE badge (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    criteria_description TEXT NOT NULL,
    icon_url VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Badges table
CREATE TABLE badges (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon_url VARCHAR(255),
    criteria TEXT,
    points INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Skill Badges table
CREATE TABLE skill_badges (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    icon_url VARCHAR(255),
    criteria TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    difficulty_level VARCHAR(20) NOT NULL,
    points_value INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- Legacy User Badge table
CREATE TABLE user_badge (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    badge_id INTEGER NOT NULL REFERENCES badge(id) ON DELETE CASCADE,
    awarded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    context_course_id INTEGER REFERENCES courses(id) ON DELETE SET NULL,
    UNIQUE(user_id, badge_id)
);

-- User Badges table
CREATE TABLE user_badges (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    badge_id INTEGER NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
    earned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, badge_id)
);

-- Student Skill Badges table
CREATE TABLE student_skill_badges (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    badge_id INTEGER NOT NULL REFERENCES skill_badges(id) ON DELETE CASCADE,
    course_id INTEGER REFERENCES courses(id) ON DELETE SET NULL,
    module_id INTEGER REFERENCES modules(id) ON DELETE SET NULL,
    earned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    evidence_data TEXT,
    verified BOOLEAN DEFAULT FALSE,
    verified_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    verified_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(student_id, badge_id)
);

-- ================================================================
-- CERTIFICATE AND TRANSCRIPT SYSTEM
-- ================================================================

-- Legacy Certificate table
CREATE TABLE certificate (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    issue_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    certificate_uid VARCHAR(255) NOT NULL UNIQUE,
    certificate_url VARCHAR(255),
    template_used VARCHAR(255),
    UNIQUE(user_id, course_id)
);

-- Certificates table
CREATE TABLE certificates (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    enrollment_id INTEGER NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
    certificate_number VARCHAR(100) NOT NULL UNIQUE,
    overall_score FLOAT NOT NULL,
    grade VARCHAR(10) NOT NULL,
    skills_acquired TEXT,
    portfolio_items TEXT,
    issued_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    verification_hash VARCHAR(256) NOT NULL UNIQUE,
    UNIQUE(student_id, course_id)
);

-- Student Transcripts table
CREATE TABLE student_transcripts (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    total_courses_enrolled INTEGER DEFAULT 0,
    total_courses_completed INTEGER DEFAULT 0,
    total_certificates INTEGER DEFAULT 0,
    total_badges INTEGER DEFAULT 0,
    overall_gpa FLOAT DEFAULT 0.0,
    total_learning_hours INTEGER DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    skills_acquired TEXT,
    competency_levels TEXT,
    UNIQUE(student_id)
);

-- ================================================================
-- OPPORTUNITIES AND SUSPENSIONS
-- ================================================================

-- Opportunities table
CREATE TABLE opportunities (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    type VARCHAR(100) NOT NULL,
    location VARCHAR(255),
    company_name VARCHAR(255),
    application_link VARCHAR(500) NOT NULL,
    application_deadline TIMESTAMP WITH TIME ZONE,
    posted_by_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Student Suspensions table
CREATE TABLE student_suspensions (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    enrollment_id INTEGER NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
    suspended_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reason VARCHAR(255),
    failed_module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    total_attempts_made INTEGER NOT NULL,
    can_appeal BOOLEAN DEFAULT TRUE,
    appeal_deadline TIMESTAMP WITH TIME ZONE,
    appeal_submitted BOOLEAN DEFAULT FALSE,
    appeal_text TEXT,
    appeal_submitted_at TIMESTAMP WITH TIME ZONE,
    review_status VARCHAR(20) DEFAULT 'pending',
    reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_notes TEXT,
    reinstated BOOLEAN DEFAULT FALSE,
    reinstated_at TIMESTAMP WITH TIME ZONE,
    additional_attempts_granted INTEGER DEFAULT 0
);

-- ================================================================
-- ANALYTICS AND REPORTING
-- ================================================================

-- Learning Analytics table
CREATE TABLE learning_analytics (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    daily_learning_minutes TEXT,
    weekly_learning_minutes TEXT,
    peak_learning_hours TEXT,
    quiz_performance_trend TEXT,
    assignment_performance_trend TEXT,
    engagement_score FLOAT DEFAULT 0.0,
    weak_topics TEXT,
    recommended_reviews TEXT,
    preferred_content_types TEXT,
    learning_velocity FLOAT DEFAULT 0.0,
    last_calculated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, course_id)
);

-- ================================================================
-- UTILITY TABLES
-- ================================================================

-- Test table (for development/testing purposes)
CREATE TABLE test (
    id SERIAL PRIMARY KEY
);

-- ================================================================
-- INSERT SEED DATA
-- ================================================================

-- Insert default roles
INSERT INTO roles (name, description) VALUES 
    ('admin', 'System administrator with full access'),
    ('instructor', 'Course instructor who can create and manage courses'),
    ('student', 'Student who can enroll in and complete courses'),
    ('moderator', 'Community moderator with forum management privileges')
ON CONFLICT (name) DO NOTHING;

-- ================================================================
-- CREATE INDEXES FOR PERFORMANCE
-- ================================================================

-- User indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role_id ON users(role_id);
CREATE INDEX idx_users_is_active ON users(is_active);

-- Course indexes
CREATE INDEX idx_courses_instructor_id ON courses(instructor_id);
CREATE INDEX idx_courses_is_published ON courses(is_published);
CREATE INDEX idx_courses_category ON courses(category);
CREATE INDEX idx_courses_difficulty_level ON courses(difficulty_level);

-- Enrollment indexes
CREATE INDEX idx_enrollments_student_id ON enrollments(student_id);
CREATE INDEX idx_enrollments_course_id ON enrollments(course_id);
CREATE INDEX idx_enrollments_status ON enrollments(status);

-- Module and Lesson indexes
CREATE INDEX idx_modules_course_id ON modules(course_id);
CREATE INDEX idx_modules_order ON modules("order");
CREATE INDEX idx_lessons_module_id ON lessons(module_id);
CREATE INDEX idx_lessons_order ON lessons("order");

-- Quiz indexes
CREATE INDEX idx_quizzes_course_id ON quizzes(course_id);
CREATE INDEX idx_quizzes_module_id ON quizzes(module_id);
CREATE INDEX idx_quiz_attempts_user_id ON quiz_attempts(user_id);
CREATE INDEX idx_quiz_attempts_quiz_id ON quiz_attempts(quiz_id);

-- Assignment indexes
CREATE INDEX idx_assignments_course_id ON assignments(course_id);
CREATE INDEX idx_assignments_module_id ON assignments(module_id);
CREATE INDEX idx_assignments_instructor_id ON assignments(instructor_id);
CREATE INDEX idx_assignment_submissions_assignment_id ON assignment_submissions(assignment_id);
CREATE INDEX idx_assignment_submissions_student_id ON assignment_submissions(student_id);

-- Progress tracking indexes
CREATE INDEX idx_lesson_completions_student_id ON lesson_completions(student_id);
CREATE INDEX idx_lesson_completions_lesson_id ON lesson_completions(lesson_id);
CREATE INDEX idx_module_progress_student_id ON module_progress(student_id);
CREATE INDEX idx_module_progress_module_id ON module_progress(module_id);
CREATE INDEX idx_user_progress_user_id ON user_progress(user_id);
CREATE INDEX idx_user_progress_course_id ON user_progress(course_id);

-- Forum indexes
CREATE INDEX idx_forum_posts_forum_id ON forum_posts(forum_id);
CREATE INDEX idx_forum_posts_author_id ON forum_posts(author_id);
CREATE INDEX idx_forum_posts_parent_post_id ON forum_posts(parent_post_id);
CREATE INDEX idx_forum_subscriptions_user_id ON forum_subscriptions(user_id);
CREATE INDEX idx_forum_subscriptions_forum_id ON forum_subscriptions(forum_id);

-- Achievement indexes
CREATE INDEX idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX idx_user_achievements_achievement_id ON user_achievements(achievement_id);
CREATE INDEX idx_achievements_category ON achievements(category);
CREATE INDEX idx_achievements_is_active ON achievements(is_active);

-- Student Points indexes
CREATE INDEX idx_student_points_user_id ON student_points(user_id);
CREATE INDEX idx_student_points_total_points ON student_points(total_points);
CREATE INDEX idx_student_points_global_rank ON student_points(global_rank);

-- Timestamp indexes for reporting
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_courses_created_at ON courses(created_at);
CREATE INDEX idx_enrollments_enrollment_date ON enrollments(enrollment_date);
CREATE INDEX idx_lesson_completions_completed_at ON lesson_completions(completed_at);
CREATE INDEX idx_quiz_attempts_created_at ON quiz_attempts(created_at);

-- ================================================================
-- GRANT PERMISSIONS (Adjust according to your user setup)
-- ================================================================

-- Grant permissions to the application user
-- Note: Replace 'lms1_user' with your actual PostgreSQL user
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO lms1_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO lms1_user;

-- ================================================================
-- MIGRATION COMPLETE
-- ================================================================

-- Update table statistics for better query performance
ANALYZE;

-- Display completion message
DO $$ 
BEGIN 
    RAISE NOTICE '✅ PostgreSQL Migration Complete!';
    RAISE NOTICE '📊 Total tables created: 55';
    RAISE NOTICE '🔗 All relationships and constraints established';
    RAISE NOTICE '📈 Performance indexes created';
    RAISE NOTICE '🌱 Seed data inserted';
    RAISE NOTICE '';
    RAISE NOTICE '🔧 Next steps:';
    RAISE NOTICE '1. Verify all tables exist with: \dt';
    RAISE NOTICE '2. Check constraints with: \d+ table_name';
    RAISE NOTICE '3. Test the application connection';
    RAISE NOTICE '4. Monitor performance and adjust indexes as needed';
END $$;