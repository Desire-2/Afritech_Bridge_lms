# AI-Powered Assessment Generation from Content

## Overview

The LMS now supports **AI-powered assessment generation** based on actual lesson and module content. Instructors can automatically generate quizzes, assignments, and projects that are directly aligned with what students have learned.

## Features Added

### 1. **Quiz Generation from Content** 
Generate quizzes based on actual lesson or module content with customizable difficulty levels.

**Endpoint**: `POST /api/v1/ai-agent/generate-quiz-from-content`

**Request Body**:
```json
{
  "course_id": 1,
  "content_type": "lesson",  // or "module"
  "lesson_id": 3,             // if content_type is "lesson"
  "module_id": 2,             // if content_type is "module"
  "num_questions": 10,
  "difficulty": "mixed"       // easy, medium, hard, or mixed
}
```

**Features**:
- Analyzes actual lesson/module content (markdown)
- Generates questions ONLY on topics covered in the content
- Multiple difficulty levels: easy, medium, hard, or mixed
- Customizable number of questions (default: 10)
- Includes 4 answer options per question
- Provides explanations for correct answers
- Covers different topics/sections from the content

**Response**:
```json
{
  "success": true,
  "data": {
    "title": "Quiz Title based on content",
    "description": "Assessment covering key concepts",
    "time_limit": 20,
    "passing_score": 70,
    "questions": [
      {
        "question_text": "Question based on actual content?",
        "question_type": "multiple_choice",
        "points": 10,
        "correct_answer": "B",
        "explanation": "Brief explanation",
        "options": [
          {"key": "A", "text": "Option A"},
          {"key": "B", "text": "Correct option"},
          {"key": "C", "text": "Option C"},
          {"key": "D", "text": "Option D"}
        ]
      }
    ]
  }
}
```

### 2. **Assignment Generation from Content**
Generate assignments based on actual lesson or module content with different assignment types.

**Endpoint**: `POST /api/v1/ai-agent/generate-assignment-from-content`

**Request Body**:
```json
{
  "course_id": 1,
  "content_type": "lesson",     // or "module"
  "lesson_id": 3,                // if content_type is "lesson"
  "module_id": 2,                // if content_type is "module"
  "assignment_type": "practical" // practical, theoretical, project, or mixed
}
```

**Assignment Types**:
- **practical**: Hands-on exercises and real-world application
- **theoretical**: Analysis, explanation, and conceptual understanding
- **project**: Comprehensive project-based work
- **mixed**: Combination of practical and theoretical

**Features**:
- Analyzes lesson/module content to create relevant assignments
- Provides detailed step-by-step instructions
- Lists specific deliverables
- Includes grading rubric with criteria and weights
- Sets realistic timeline (days)
- Specifies submission format

**Response**:
```json
{
  "success": true,
  "data": {
    "title": "Assignment title",
    "description": "Overview of what students will accomplish",
    "instructions": "Step-by-step instructions:\n1. Step one\n2. Step two",
    "deliverables": "• Deliverable 1\n• Deliverable 2",
    "max_points": 100,
    "due_date_days": 7,
    "grading_rubric": "• Criterion 1 (40%)\n• Criterion 2 (60%)",
    "submission_format": "Submit as PDF"
  }
}
```

### 3. **Project Generation from Module Content**
Generate comprehensive projects based on multiple lessons within a module.

**Endpoint**: `POST /api/v1/ai-agent/generate-project-from-content`

**Request Body**:
```json
{
  "course_id": 1,
  "module_id": 2
}
```

**Features**:
- Integrates concepts from all lessons in the module
- Creates capstone-style projects
- Provides comprehensive description and context
- Lists specific project requirements
- Defines clear deliverables
- Includes detailed grading rubric with weights
- Suggests realistic timeline
- Lists required resources/tools

**Response**:
```json
{
  "success": true,
  "data": {
    "title": "Professional project title",
    "description": "Comprehensive project overview",
    "requirements": "1. Requirement 1\n2. Requirement 2",
    "deliverables": "• Deliverable 1\n• Deliverable 2",
    "max_points": 150,
    "due_date_days": 14,
    "grading_rubric": "• Technical quality (40%)\n• Documentation (30%)",
    "resources": "• Resource 1\n• Resource 2",
    "submission_format": "Submit as zip file"
  }
}
```

## Usage Workflow

### Instructor Workflow

1. **Create Course Content First**:
   - Use AI to generate course outline, modules, and lessons
   - OR manually create course structure
   - Ensure lessons have substantive content (markdown)

2. **Select Content for Assessment**:
   - Choose a specific lesson (for lesson-specific quiz/assignment)
   - OR choose an entire module (for module-level assessment)

3. **Generate Assessment**:
   - Call appropriate AI endpoint with content selection
   - Customize parameters (difficulty, assignment type, etc.)
   - Review generated assessment

4. **Create Assessment in LMS**:
   - Use the generated content to create quiz/assignment/project
   - Adjust as needed
   - Assign to module/lesson
   - Publish to students

## Key Benefits

✅ **Content-Aligned**: Assessments are generated from actual course content, ensuring relevance

✅ **Time-Saving**: Automatically creates comprehensive assessments in seconds

✅ **Quality**: AI analyzes content to create well-structured questions and tasks

✅ **Customizable**: Multiple difficulty levels and assignment types

✅ **Comprehensive**: Includes rubrics, instructions, and deliverables

✅ **Integrated**: Works seamlessly with existing course structure

## Implementation Details

### Backend Changes

1. **AI Agent Service** (`src/services/ai_agent_service.py`):
   - Added `generate_quiz_from_content()` method
   - Added `generate_assignment_from_content()` method
   - Added `generate_project_from_content()` method
   - All methods analyze actual lesson/module content (up to 15,000 characters)
   - Optimized prompts to stay within token limits

2. **API Routes** (`src/routes/ai_agent_routes.py`):
   - Added `/generate-quiz-from-content` endpoint
   - Added `/generate-assignment-from-content` endpoint
   - Added `/generate-project-from-content` endpoint
   - All endpoints verify instructor ownership
   - Fetch actual lesson/module content from database

3. **Database Connection Pool** (`main.py`):
   - Fixed SQLite compatibility issue with `connect_timeout`
   - Optimized for free-tier PostgreSQL (pool_size=2, max_overflow=3)
   - Added aggressive connection recycling (120 seconds)
   - Added proper session cleanup in `after_request` hook
   - Created health monitoring utilities

### Database Health Monitoring

New health endpoints added:
- `GET /api/v1/health/db` - Database health check
- `GET /api/v1/health/db/pool-status` - Connection pool status
- `POST /api/v1/health/db/force-cleanup` - Emergency pool cleanup (requires admin key)

## Frontend Integration (To Do)

To integrate these features in the instructor assessment UI:

1. **Add Content Selection**:
   ```typescript
   // In assessment creation form
   <Select>
     <option value="manual">Create Manually</option>
     <option value="ai-lesson">Generate from Lesson</option>
     <option value="ai-module">Generate from Module</option>
   </Select>
   ```

2. **Show Lesson/Module Picker**:
   ```typescript
   {generationType === 'ai-lesson' && (
     <LessonPicker 
       courseId={courseId}
       onSelect={(lessonId) => setSelectedLesson(lessonId)}
     />
   )}
   ```

3. **Call AI Endpoint**:
   ```typescript
   const generateAssessment = async () => {
     const response = await fetch('/api/v1/ai-agent/generate-quiz-from-content', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({
         course_id: courseId,
         content_type: 'lesson',
         lesson_id: selectedLesson,
         num_questions: 10,
         difficulty: 'mixed'
       })
     });
     
     const data = await response.json();
     // Populate form with generated assessment
     setQuizData(data.data);
   };
   ```

4. **Display Generated Content**:
   - Show generated quiz questions in editable form
   - Allow instructor to review and modify
   - Save to database via existing assessment endpoints

## Error Handling

All endpoints handle:
- Missing course/module/lesson IDs
- Access control (instructor ownership verification)
- Missing content (lessons without content data)
- AI API failures (graceful fallback)
- JSON parsing errors

## Rate Limiting

AI requests are rate-limited:
- Max 15 requests per minute (configurable via `GEMINI_MAX_RPM` env var)
- Automatic backoff on quota errors
- Retry logic with exponential backoff

## Environment Variables

Required:
- `GEMINI_API_KEY` - Google Gemini API key for AI features

Optional:
- `GEMINI_MAX_RPM` - Max requests per minute (default: 15)
- `GEMINI_MODEL` - Model name (default: gemini-2.5-flash-preview-09-2025)
- `ADMIN_KEY` - Admin key for emergency pool cleanup endpoint

## Testing

Test the endpoints using curl:

```bash
# Generate quiz from lesson
curl -X POST http://localhost:5001/api/v1/ai-agent/generate-quiz-from-content \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "course_id": 1,
    "content_type": "lesson",
    "lesson_id": 3,
    "num_questions": 5,
    "difficulty": "mixed"
  }'

# Generate assignment from module
curl -X POST http://localhost:5001/api/v1/ai-agent/generate-assignment-from-content \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "course_id": 1,
    "content_type": "module",
    "module_id": 2,
    "assignment_type": "practical"
  }'

# Generate project from module
curl -X POST http://localhost:5001/api/v1/ai-agent/generate-project-from-content \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "course_id": 1,
    "module_id": 2
  }'
```

## Future Enhancements

1. **Multi-Module Projects**: Generate projects spanning multiple modules
2. **Question Banks**: Save generated questions for reuse
3. **Difficulty Analysis**: AI analyzes content complexity to suggest appropriate difficulty
4. **Learning Objectives Mapping**: Automatically map questions to learning objectives
5. **Rubric Templates**: Save and reuse grading rubrics
6. **Content Gaps Detection**: AI identifies topics not covered by assessments
7. **Student Performance Analysis**: Use AI to suggest remedial content based on quiz results

## Troubleshooting

### "Module has no lessons to generate quiz from"
**Solution**: Ensure the module has lessons with content before generating assessments.

### "Lesson has no content to generate assignment from"
**Solution**: Add content to the lesson first (use AI lesson generation or manual entry).

### AI API quota exceeded
**Solution**: 
- Check `GEMINI_API_KEY` is valid
- Wait for rate limit to reset (tracked per minute)
- Reduce number of questions to minimize token usage

### Connection pool exhausted
**Solution**:
- Check `/api/v1/health/db/pool-status` endpoint
- Use emergency cleanup: `POST /api/v1/health/db/force-cleanup` with admin key
- Restart backend server

## Summary

This feature adds powerful AI-driven assessment generation to the LMS, enabling instructors to:
- **Save time**: Generate comprehensive assessments in seconds
- **Ensure alignment**: Assessments are based on actual course content
- **Customize easily**: Multiple difficulty levels and assignment types
- **Maintain quality**: AI creates well-structured, pedagogically sound assessments

The implementation is **fully functional** on the backend and ready for frontend integration.
