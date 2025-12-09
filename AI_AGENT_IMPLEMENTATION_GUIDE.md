# AI Agent for Course Creation - Implementation Guide

## Overview

The Afritec Bridge LMS now includes an **AI-powered course creation assistant** that uses Google's Gemini API to help instructors automatically generate high-quality course content. The AI agent provides context-aware content generation for all stages of course development.

## Features

### 1. **Course Outline Generation**
- Generate comprehensive course outlines from a simple topic
- Automatically suggests:
  - Course title and description
  - Learning objectives
  - Target audience refinement
  - Estimated duration
  - Module structure (5-8 modules)

### 2. **Module Content Generation**
- Context-aware module creation based on course details
- Generates:
  - Module title and description
  - Module-specific learning objectives
  - Suggested lessons (4-8 lessons per module)
  - Duration estimates

### 3. **Lesson Content Generation**
- Creates detailed, markdown-formatted lesson content
- Includes:
  - Comprehensive lesson descriptions
  - Learning objectives
  - Structured content with headers
  - Code examples (when relevant)
  - Practical examples and case studies
  - Key takeaways and summaries
  - Discussion questions

### 4. **Quiz Question Generation**
- Automatically generates quiz questions based on lesson content
- Features:
  - Multiple question types (multiple choice, true/false)
  - Varying difficulty levels
  - 4 answer options per question
  - Explanations for correct answers
  - Configurable number of questions

### 5. **Assignment Generation**
- Creates practical assignments tied to module content
- Includes:
  - Clear assignment instructions
  - Specific deliverables
  - Grading rubric
  - Suggested due dates
  - Time estimates

### 6. **Final Project Generation**
- Generates comprehensive capstone projects
- Features:
  - Integrates all course concepts
  - Professional project requirements
  - Detailed grading criteria
  - Resource lists
  - Real-world applicability

## Architecture

### Backend Components

#### 1. **AI Agent Service** (`backend/src/services/ai_agent_service.py`)
- Core service integrating with Google Gemini API
- Provides methods for all content generation types
- Handles prompt engineering for optimal results
- Includes error handling and fallbacks

#### 2. **AI Agent Routes** (`backend/src/routes/ai_agent_routes.py`)
- RESTful API endpoints for AI operations
- JWT authentication and instructor role verification
- Context gathering from database (courses, modules, lessons)
- Registered at `/api/v1/ai-agent`

**Available Endpoints:**
```
POST /api/v1/ai-agent/generate-course-outline
POST /api/v1/ai-agent/generate-module-content
POST /api/v1/ai-agent/generate-lesson-content
POST /api/v1/ai-agent/generate-quiz-questions
POST /api/v1/ai-agent/generate-assignment
POST /api/v1/ai-agent/generate-final-project
POST /api/v1/ai-agent/enhance-content
GET  /api/v1/ai-agent/health
```

### Frontend Components

#### 1. **AI Agent Service** (`frontend/src/services/ai-agent.service.ts`)
- TypeScript service for API communication
- Type-safe request/response interfaces
- Error handling and user feedback

#### 2. **UI Components** (`frontend/src/components/instructor/ai-agent/`)
- `AICourseGenerator.tsx` - Course outline generation UI
- `AIContentGenerator.tsx` - Reusable component for all content types
- Beautiful, consistent UI with loading states and error handling

## Setup Instructions

### 1. Backend Setup

#### Install Dependencies
```bash
cd backend
pip install -r requirements.txt
```

The `requirements.txt` now includes:
```
google-generativeai==0.8.3
```

#### Configure Environment Variables
Add to `backend/.env`:
```env
# Google Gemini API Configuration
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.0-flash-exp  # Optional, defaults to this model
```

**Getting a Gemini API Key:**
1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Get API Key" or "Create API Key"
4. Copy the key to your `.env` file

#### Verify Backend
```bash
cd backend
python main.py
```

Check health endpoint:
```bash
curl http://localhost:5000/api/v1/ai-agent/health
```

### 2. Frontend Setup

#### Install Dependencies
```bash
cd frontend
npm install
```

The `package.json` now includes:
```json
"@google/generative-ai": "^0.21.0"
```

#### Configure Environment Variables
Create/update `frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1
```

#### Run Development Server
```bash
npm run dev
```

## Usage Guide

### For Instructors

#### 1. **Creating a Course with AI**

**Step 1: Generate Course Outline**
```tsx
import { AICourseGenerator } from '@/components/instructor/ai-agent';

<AICourseGenerator
  onGenerate={(data) => {
    // Auto-fill course form with AI-generated data
    setCourseForm({
      title: data.title,
      description: data.description,
      learning_objectives: data.learning_objectives,
      estimated_duration: data.estimated_duration,
      target_audience: data.target_audience
    });
  }}
/>
```

**Step 2: Add Modules with AI**
```tsx
import { AIContentGenerator } from '@/components/instructor/ai-agent';

<AIContentGenerator
  type="module"
  courseId={course.id}
  onGenerate={(data) => {
    // Auto-fill module form
    setModuleForm({
      title: data.title,
      description: data.description,
      learning_objectives: data.learning_objectives
    });
  }}
  context={{ courseTitle: course.title }}
/>
```

**Step 3: Generate Lessons**
```tsx
<AIContentGenerator
  type="lesson"
  courseId={course.id}
  moduleId={module.id}
  onGenerate={(data) => {
    // Auto-fill lesson form with markdown content
    setLessonForm({
      title: data.title,
      description: data.description,
      content_data: data.content_data,
      duration_minutes: data.duration_minutes
    });
  }}
  context={{
    courseTitle: course.title,
    moduleTitle: module.title
  }}
/>
```

**Step 4: Create Quizzes**
```tsx
<AIContentGenerator
  type="quiz"
  courseId={course.id}
  moduleId={module.id}
  lessonId={lesson.id}
  onGenerate={(data) => {
    // Auto-create quiz with questions
    createQuiz({
      title: data.title,
      description: data.description,
      questions: data.questions
    });
  }}
/>
```

### API Request Examples

#### Generate Course Outline
```javascript
POST /api/v1/ai-agent/generate-course-outline
Content-Type: application/json
Authorization: Bearer <jwt_token>

{
  "topic": "Introduction to Machine Learning",
  "target_audience": "Beginners with Python knowledge",
  "learning_objectives": "Understand ML algorithms, Build models, Deploy applications"
}
```

#### Generate Lesson Content
```javascript
POST /api/v1/ai-agent/generate-lesson-content
Content-Type: application/json
Authorization: Bearer <jwt_token>

{
  "course_id": 1,
  "module_id": 2,
  "lesson_title": "Linear Regression Fundamentals",
  "lesson_description": "Introduction to linear regression"
}
```

#### Generate Quiz Questions
```javascript
POST /api/v1/ai-agent/generate-quiz-questions
Content-Type: application/json
Authorization: Bearer <jwt_token>

{
  "course_id": 1,
  "module_id": 2,
  "lesson_id": 5,
  "num_questions": 10,
  "question_types": ["multiple_choice", "true_false"]
}
```

## Integration Examples

### Example 1: Course Creation Form with AI
```tsx
"use client";

import React, { useState } from 'react';
import { AICourseGenerator } from '@/components/instructor/ai-agent';
import CourseCreationService from '@/services/course-creation.service';

export default function CreateCoursePage() {
  const [courseForm, setCourseForm] = useState({
    title: '',
    description: '',
    learning_objectives: '',
    // ... other fields
  });

  const handleAIGenerate = (aiData: any) => {
    // Populate form with AI-generated data
    setCourseForm({
      ...courseForm,
      title: aiData.title,
      description: aiData.description,
      learning_objectives: aiData.learning_objectives,
      estimated_duration: aiData.estimated_duration,
      target_audience: aiData.target_audience
    });
  };

  return (
    <div className="space-y-6">
      {/* AI Generator Card */}
      <AICourseGenerator onGenerate={handleAIGenerate} />
      
      {/* Traditional Course Form */}
      <CourseForm data={courseForm} onChange={setCourseForm} />
    </div>
  );
}
```

### Example 2: Module Management with AI
```tsx
import { AIContentGenerator } from '@/components/instructor/ai-agent';

const ModuleManagement = ({ course }) => {
  const [showAI, setShowAI] = useState(false);
  
  return (
    <div>
      <Button onClick={() => setShowAI(!showAI)}>
        <Sparkles className="w-4 h-4 mr-2" />
        AI Assistant
      </Button>
      
      {showAI && (
        <AIContentGenerator
          type="module"
          courseId={course.id}
          onGenerate={(data) => {
            // Create module with AI data
            createModule(data);
          }}
          context={{ courseTitle: course.title }}
        />
      )}
    </div>
  );
};
```

## Best Practices

### 1. **Always Provide Context**
- The AI works best with full context (course → module → lesson hierarchy)
- Pass course title, description, and objectives when generating modules
- Pass module information when generating lessons

### 2. **Review and Edit AI Content**
- AI-generated content should be reviewed by instructors
- Edit for accuracy, tone, and institutional requirements
- Add institution-specific examples and context

### 3. **Iterative Generation**
- Start with course outline
- Generate modules sequentially
- Create lessons based on generated module structure
- Generate assessments last (after content is finalized)

### 4. **Error Handling**
- Always handle API failures gracefully
- Provide fallback content or manual entry options
- Show clear error messages to users

### 5. **API Rate Limits**
- Be aware of Gemini API rate limits
- Consider implementing request queuing for bulk operations
- Cache results where appropriate

## Troubleshooting

### Issue: "API key not configured"
**Solution:** Ensure `GEMINI_API_KEY` is set in backend `.env` file

### Issue: "Failed to generate content"
**Solutions:**
1. Check API key validity
2. Verify network connectivity
3. Check Gemini API status
4. Review backend logs for detailed error messages

### Issue: AI generates irrelevant content
**Solutions:**
1. Provide more detailed context
2. Be specific in topic/title fields
3. Include learning objectives to guide generation
4. Review and refine prompt engineering in service

### Issue: Slow response times
**Solutions:**
1. Consider using faster model (gemini-flash)
2. Reduce content length requested
3. Implement loading indicators
4. Consider background job processing for bulk operations

## Security Considerations

1. **API Key Protection**
   - Never commit API keys to version control
   - Use environment variables only
   - Rotate keys regularly

2. **Access Control**
   - Only instructors/admins can access AI endpoints
   - JWT authentication required for all endpoints
   - Course ownership verified before generation

3. **Content Validation**
   - Validate all AI-generated content before storage
   - Sanitize markdown content
   - Review for inappropriate content

## Future Enhancements

- [ ] Bulk content generation (entire course at once)
- [ ] Content translation to multiple languages
- [ ] Style/tone customization per institution
- [ ] Learning from instructor feedback
- [ ] Content versioning and comparison
- [ ] Integration with content quality metrics
- [ ] Real-time collaborative editing with AI suggestions
- [ ] Voice-to-text for content input

## Support

For issues or questions:
1. Check backend logs: `backend/logs/`
2. Review API documentation in code
3. Test with health endpoint
4. Contact development team

## License

This AI integration is part of Afritec Bridge LMS and follows the same license terms.
