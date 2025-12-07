# Course Creation Analysis & AI Prompt Guide

## 📊 Instructor Course Creation Flow Analysis

### Architecture Overview

The Afritec Bridge LMS supports a comprehensive course creation workflow that allows instructors to build complete courses with:
- **Hierarchical Structure**: Course → Modules → Lessons
- **Assessments**: Quizzes, Assignments, and Projects
- **Mixed Content Types**: Text, Video, PDF, and Mixed content in lessons
- **Flexible Assignment**: Assessments can be linked to courses, modules, or specific lessons

---

## 🔄 Complete Course Creation Workflow

### 1. **Course Creation** (Base Level)
**Endpoint**: `POST /api/v1/instructor/courses`

**Required Fields**:
- `title` (string, unique)
- `description` (text)

**Optional Fields**:
- `learning_objectives` (text)
- `target_audience` (string)
- `estimated_duration` (string)
- `is_published` (boolean, default: false)

**Frontend Component**: `/frontend/src/app/instructor/courses/create/page.tsx`

**API Route**: `/backend/src/routes/course_creation_routes.py`

---

### 2. **Module Creation** (Level 1)
**Endpoint**: `POST /api/v1/instructor/courses/{course_id}/modules`

**Required Fields**:
- `title` (string)
- `course_id` (integer, from URL)

**Optional Fields**:
- `description` (text)
- `learning_objectives` (text)
- `order` (integer, auto-incremented)
- `is_published` (boolean, default: false)

**Features**:
- Auto-ordering based on existing modules
- Drag-and-drop reordering support
- Can contain multiple lessons

**Frontend Component**: `/frontend/src/components/instructor/course-creation/ModuleManagement.tsx`

---

### 3. **Lesson Creation** (Level 2)
**Endpoint**: `POST /api/v1/instructor/courses/{course_id}/modules/{module_id}/lessons`

**Content Type System** (Critical Feature):

#### a) **Text Content** (`content_type: "text"`)
- Rich Markdown editor support
- `content_data`: Full Markdown text
- Supports formatting, lists, code blocks, links, images
- Real-time preview available

#### b) **Video Content** (`content_type: "video"`)
- `content_data`: Video URL or embed code
- Supports: YouTube, Vimeo, direct video URLs
- Can paste embed codes directly
- Automatic platform detection

#### c) **PDF Content** (`content_type: "pdf"`)
- `content_data`: PDF file URL/path or Google Drive link
- Supports: Direct PDF links, Google Drive embeds, cloud storage URLs

#### d) **Mixed Content** (`content_type: "mixed"`)
- `content_data`: JSON array of content blocks
- **JSON Structure**:
```json
{
  "blocks": [
    {
      "type": "text",
      "content": "Markdown text content"
    },
    {
      "type": "video",
      "content": "https://youtube.com/watch?v=..."
    },
    {
      "type": "pdf",
      "content": "https://drive.google.com/file/d/.../view"
    },
    {
      "type": "text",
      "content": "More markdown content"
    }
  ]
}
```

**Required Fields**:
- `title` (string)
- `content_type` (enum: "text", "video", "pdf", "mixed")
- `content_data` (text/JSON based on content_type)
- `module_id` (integer, from URL)

**Optional Fields**:
- `description` (text)
- `learning_objectives` (text)
- `duration_minutes` (integer)
- `order` (integer, auto-incremented)
- `is_published` (boolean, default: false)

**Frontend Component**: `/frontend/src/components/instructor/course-creation/ModuleManagement.tsx`

**Database Model**: `Lesson` in `/backend/src/models/course_models.py`

---

### 4. **Quiz Creation**
**Endpoint**: `POST /api/v1/instructor/assessments/quizzes`

**Quiz Structure**:
```json
{
  "title": "Module 1 Quiz",
  "description": "Test your understanding of the basics",
  "course_id": 1,
  "module_id": 1,         // Optional: Link to specific module
  "lesson_id": 5,         // Optional: Link to specific lesson
  "is_published": false,
  
  // Quiz Settings
  "time_limit": 30,       // Minutes, null for unlimited
  "max_attempts": 3,      // null for unlimited
  "passing_score": 70,    // Percentage (0-100)
  "due_date": "2025-12-31T23:59:59",  // ISO format
  "points_possible": 100.0,
  "shuffle_questions": false,
  "shuffle_answers": false,
  "show_correct_answers": true,
  
  // Questions array
  "questions": [
    {
      "text": "What is Python?",
      "question_type": "multiple_choice",  // or "true_false", "short_answer"
      "points": 10.0,
      "explanation": "Python is a high-level programming language",
      "answers": [
        {
          "text": "A programming language",
          "is_correct": true
        },
        {
          "text": "A snake",
          "is_correct": false
        },
        {
          "text": "A framework",
          "is_correct": false
        },
        {
          "text": "A database",
          "is_correct": false
        }
      ]
    }
  ]
}
```

**Question Types**:
1. **Multiple Choice**: 2-10 answers, exactly one correct
2. **True/False**: 2 answers (True/False)
3. **Short Answer**: No predefined answers, manual grading required

**Features**:
- Questions auto-ordered by array position
- Support for both inline question creation and later addition
- Can add/edit/delete questions after quiz creation
- Question bank support via separate endpoints

**Frontend Component**: `/frontend/src/components/instructor/course-creation/AssessmentManagement.tsx`

**API Routes**: 
- Quiz CRUD: `/backend/src/routes/instructor_assessment_routes.py`
- Question endpoints:
  - `POST /api/v1/instructor/assessments/quizzes/{quiz_id}/questions`
  - `PUT /api/v1/instructor/assessments/quizzes/{quiz_id}/questions/{question_id}`
  - `DELETE /api/v1/instructor/assessments/quizzes/{quiz_id}/questions/{question_id}`

---

### 5. **Assignment Creation**
**Endpoint**: `POST /api/v1/instructor/assessments/assignments`

**Assignment Structure**:
```json
{
  "title": "Python Basics Assignment",
  "description": "Complete the following Python exercises",
  "instructions": "Detailed step-by-step instructions...",
  "course_id": 1,
  "module_id": 1,         // Optional
  "lesson_id": 3,         // Optional
  
  // Assignment Settings
  "assignment_type": "file_upload",  // or "text_response", "both"
  "max_file_size_mb": 10,
  "allowed_file_types": ".py,.ipynb,.txt,.pdf",  // Comma-separated
  "due_date": "2025-12-31T23:59:59",
  "points_possible": 100.0,
  "is_published": false
}
```

**Assignment Types**:
1. **file_upload**: Students upload files only
2. **text_response**: Students enter text responses only
3. **both**: Students can upload files AND enter text

**Features**:
- File type validation
- File size limits
- Rubric support (optional)
- Manual grading workflow
- Feedback mechanism

**Frontend Component**: `/frontend/src/components/instructor/course-creation/AssessmentManagement.tsx`

**API Route**: `/backend/src/routes/instructor_assessment_routes.py`

---

### 6. **Final Project Creation**
**Endpoint**: `POST /api/v1/instructor/assessments/projects`

**Project Structure**:
```json
{
  "title": "Final Course Project",
  "description": "Build a complete web application using course concepts",
  "objectives": "Demonstrate mastery of all course topics",
  "course_id": 1,
  "module_ids": [1, 2, 3, 4],  // Array of module IDs (required, stored as JSON)
  
  // Project Settings
  "due_date": "2025-12-31T23:59:59",  // Required
  "points_possible": 100.0,
  "is_published": false,
  "submission_format": "file_upload",  // or "text_response", "both", "presentation"
  "max_file_size_mb": 50,  // Larger than assignments
  "allowed_file_types": ".zip,.pdf,.mp4,.pptx",
  
  // Collaboration Settings
  "collaboration_allowed": false,
  "max_team_size": 1  // 1 for individual, 2+ for team projects
}
```

**Project Features**:
- **Cross-module assessment**: Links to multiple modules
- **Team collaboration**: Optional team submissions
- **Flexible submission types**: Files, text, presentations
- **Larger file limits**: Up to 50MB default
- **Comprehensive grading**: Manual grading with detailed feedback

**Frontend Component**: `/frontend/src/components/instructor/course-creation/AssessmentManagement.tsx`

**API Route**: `/backend/src/routes/instructor_assessment_routes.py`

---

## 🎯 Complete Course Development Workflow

### Recommended Creation Order:

1. **Create Course** → Get `course_id`
2. **Create Modules** → Get `module_id` for each
3. **Create Lessons** (with mixed content types) → Get `lesson_id` for each
4. **Create Quizzes** → Link to modules/lessons
5. **Create Assignments** → Link to modules/lessons
6. **Create Final Project** → Link to all relevant modules
7. **Publish Course** → Set `is_published: true`

---

## 📝 AI PROMPT FOR COMPLETE COURSE DEVELOPMENT

Use this prompt when asking AI to develop a complete course:

---

### **COMPREHENSIVE COURSE DEVELOPMENT PROMPT**

```markdown
Create a complete course for the Afritec Bridge LMS with the following specifications:

**Course Details:**
- Course Title: [Your Course Title]
- Description: [Comprehensive course description]
- Learning Objectives: [What students will learn]
- Target Audience: [Who should take this course]
- Estimated Duration: [e.g., "8 weeks", "40 hours"]

**Course Structure Requirements:**

1. **Modules**: Create [X] modules covering:
   - Module 1: [Topic] - [Description]
   - Module 2: [Topic] - [Description]
   - Module 3: [Topic] - [Description]
   - [Add more as needed]

2. **Lessons per Module**: 
   For each module, create 3-5 lessons with **MIXED CONTENT TYPES**:
   
   **Content Type Distribution:**
   - 30% Text lessons (Markdown-formatted educational content)
   - 30% Video lessons (YouTube/Vimeo URLs or embed codes)
   - 20% PDF lessons (Document links for reading materials)
   - 20% Mixed lessons (Combination of text, video, and PDF)
   
   **For each lesson, provide:**
   - Title
   - Content type: "text", "video", "pdf", or "mixed"
   - Content data:
     * For text: Full Markdown content with headers, lists, code blocks
     * For video: Video URL or embed code
     * For PDF: PDF URL or Google Drive link
     * For mixed: JSON array with multiple content blocks
   - Description (brief overview)
   - Learning objectives (what students will learn)
   - Duration in minutes

3. **Quizzes**:
   - Create 1 quiz per module (total [X] quizzes)
   - Each quiz should have:
     * Title and description
     * 5-10 questions per quiz
     * Mix of question types: multiple_choice, true_false, short_answer
     * Each multiple choice question: 4 answer options, 1 correct
     * Point values for each question
     * Time limit (e.g., 30 minutes)
     * Passing score (70%)
     * Max attempts (3)
   - Link quizzes to appropriate modules

4. **Assignments**:
   - Create 2-3 assignments throughout the course
   - Each assignment should have:
     * Title and detailed description
     * Clear instructions
     * Assignment type: file_upload, text_response, or both
     * Due date
     * Points possible
     * Allowed file types (if applicable)
   - Link to specific modules/lessons

5. **Final Project**:
   - Create 1 comprehensive final project that:
     * Covers all modules (provide module_ids array)
     * Has detailed objectives
     * Requires submission of files or presentation
     * Points possible: 100-200 points
     * Due date at course end
     * Optionally allows team collaboration

**Output Format:**

Provide JSON structures for:
1. Course creation payload
2. Module creation payloads (one per module)
3. Lesson creation payloads (3-5 per module, mixing all content types)
4. Quiz creation payloads with full questions and answers
5. Assignment creation payloads
6. Final project creation payload

**Important Requirements:**
- All content must be educationally sound and complete
- Lessons should use MIXED content types (text, video, PDF, mixed)
- For mixed content lessons, use proper JSON structure with blocks array
- Quizzes must have valid questions with correct answers marked
- All dates should be in ISO format
- All payloads must match the API schema exactly
- Include learning objectives at course, module, and lesson levels
```

---

### **EXAMPLE PROMPT FOR SPECIFIC COURSE:**

```markdown
Create a complete "Introduction to Python Programming" course with:

**Course:** Python for Beginners
- Description: Learn Python from scratch with hands-on projects
- Learning Objectives: Master Python basics, OOP, data structures, and file handling
- Target Audience: Complete beginners with no programming experience
- Duration: 8 weeks

**Modules:**
1. Python Basics & Setup
2. Control Flow & Functions
3. Data Structures
4. Object-Oriented Programming
5. File Handling & Modules
6. Error Handling & Debugging
7. Final Project Development

**Content Mix Requirements:**
- Text lessons: Installation guides, concept explanations with code examples
- Video lessons: Coding tutorials, live coding sessions
- PDF lessons: Python cheat sheets, reference materials, practice exercises
- Mixed lessons: Theory (text) + Tutorial video + Reference PDF

**Assessments:**
- 1 quiz per module (7 quizzes total), 10 questions each
- 3 coding assignments: Variables & Loops, Functions & Lists, OOP Project
- 1 final project: Build a complete Python application using all concepts

Generate all JSON payloads ready for API submission.
```

---

## 🛠️ Technical Implementation Notes

### Frontend Components:
1. **CourseOverview.tsx**: Course info and quick actions
2. **ModuleManagement.tsx**: Module and lesson CRUD with drag-and-drop
3. **AssessmentManagement.tsx**: Quiz, assignment, and project management

### Backend Routes:
1. **course_creation_routes.py**: Course, module, lesson CRUD
2. **instructor_assessment_routes.py**: Quiz, assignment, project CRUD

### Key Features:
- **Drag-and-drop reordering**: Modules and lessons
- **Real-time preview**: Markdown editor for text content
- **Inline editing**: Edit modules/lessons without full page reload
- **Validation**: File types, sizes, required fields
- **Auto-ordering**: Automatic order assignment for modules/lessons
- **Ownership verification**: Only course instructor can edit

### Database Models:
- **Course**: Base course information
- **Module**: Grouped lessons within a course
- **Lesson**: Individual learning units with flexible content
- **Quiz**: Assessment with questions and answers
- **Question**: Quiz question with type and points
- **Answer**: Question answer options
- **Assignment**: File/text submission tasks
- **Project**: Multi-module comprehensive projects

---

## 📊 Content Type Guidelines

### Text Lessons (Markdown):
```markdown
# Lesson Title

## Introduction
Brief overview of the topic...

## Key Concepts
- Concept 1: Explanation
- Concept 2: Explanation

## Code Example
\`\`\`python
def hello_world():
    print("Hello, World!")
\`\`\`

## Summary
Recap of what was covered...

## Next Steps
What students should do next...
```

### Video Lessons:
- YouTube: `https://www.youtube.com/watch?v=VIDEO_ID`
- Vimeo: `https://vimeo.com/VIDEO_ID`
- Embed code: Full `<iframe>` or `<video>` HTML

### PDF Lessons:
- Direct link: `https://example.com/document.pdf`
- Google Drive: `https://drive.google.com/file/d/FILE_ID/view`
- Dropbox: Public share link

### Mixed Content Lessons:
```json
{
  "blocks": [
    {
      "type": "text",
      "content": "# Introduction\n\nWelcome to this lesson..."
    },
    {
      "type": "video",
      "content": "https://youtube.com/watch?v=..."
    },
    {
      "type": "text",
      "content": "## Practice Exercise\n\nTry the following..."
    },
    {
      "type": "pdf",
      "content": "https://example.com/exercises.pdf"
    }
  ]
}
```

---

## ✅ Course Completion Checklist

Before publishing a course, ensure:

- [ ] Course has clear title and description
- [ ] Learning objectives defined at all levels
- [ ] At least 3 modules created
- [ ] Each module has 3-5 lessons
- [ ] Content types are mixed (not all text)
- [ ] At least 1 quiz per module
- [ ] Assignments are distributed throughout
- [ ] Final project covers all modules
- [ ] All content is published
- [ ] Due dates are set for assessments
- [ ] Course `is_published` set to `true`

---

## 🎓 Best Practices

1. **Content Variety**: Mix text, video, and PDF to accommodate different learning styles
2. **Progressive Difficulty**: Start simple, increase complexity gradually
3. **Frequent Assessment**: Quiz after each major concept
4. **Practical Application**: Include hands-on assignments and projects
5. **Clear Objectives**: Define what students will learn at every level
6. **Reasonable Deadlines**: Allow sufficient time for completion
7. **Meaningful Feedback**: Provide explanations for quiz answers
8. **File Size Limits**: Keep videos under 5 minutes, PDFs under 10MB
9. **Accessibility**: Provide transcripts for videos, alt text for images
10. **Testing**: Test all content links and video embeds before publishing

---

## 📞 API Endpoints Summary

### Course Management:
- `POST /api/v1/instructor/courses` - Create course
- `PUT /api/v1/instructor/courses/{id}` - Update course
- `GET /api/v1/instructor/courses/{id}` - Get course details

### Module Management:
- `POST /api/v1/instructor/courses/{course_id}/modules` - Create module
- `PUT /api/v1/instructor/courses/{course_id}/modules/{id}` - Update module
- `PUT /api/v1/instructor/courses/{course_id}/modules/reorder` - Reorder modules

### Lesson Management:
- `POST /api/v1/instructor/courses/{course_id}/modules/{module_id}/lessons` - Create lesson
- `PUT /api/v1/instructor/courses/{course_id}/modules/{module_id}/lessons/{id}` - Update lesson
- `PUT /api/v1/instructor/courses/{course_id}/modules/{module_id}/lessons/reorder` - Reorder lessons

### Assessment Management:
- `POST /api/v1/instructor/assessments/quizzes` - Create quiz
- `POST /api/v1/instructor/assessments/quizzes/{id}/questions` - Add questions
- `POST /api/v1/instructor/assessments/assignments` - Create assignment
- `POST /api/v1/instructor/assessments/projects` - Create project

---

**End of Course Creation Analysis & Prompt Guide**
