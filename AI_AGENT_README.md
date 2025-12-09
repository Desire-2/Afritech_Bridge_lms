# 🤖 AI Course Creation Agent

> **Automate course creation with Google Gemini AI**  
> Generate comprehensive course content step-by-step with context-aware AI assistance

![Status](https://img.shields.io/badge/status-production--ready-brightgreen)
![Version](https://img.shields.io/badge/version-1.0.0-blue)
![AI](https://img.shields.io/badge/AI-Google%20Gemini-orange)

## 🌟 Overview

The AI Course Creation Agent is a powerful feature that helps instructors create high-quality course content automatically. By analyzing course context and using Google's Gemini AI, it generates:

- ✅ Complete course outlines with module suggestions
- ✅ Detailed module content with lesson plans
- ✅ Rich markdown-formatted lesson content
- ✅ Quiz questions with multiple choice and answers
- ✅ Practical assignments with grading rubrics
- ✅ Capstone projects integrating all course concepts

## 🚀 Quick Start

### 1. Get Your API Key

Visit [Google AI Studio](https://makersuite.google.com/app/apikey) and create a free API key.

### 2. Configure Backend

```bash
cd backend
echo "GEMINI_API_KEY=your_api_key_here" >> .env
pip install google-generativeai
python main.py
```

### 3. Install Frontend Dependencies

```bash
cd frontend
npm install
npm run dev
```

### 4. Start Creating!

```tsx
import { AICourseGenerator } from '@/components/instructor/ai-agent';

<AICourseGenerator 
  onGenerate={(data) => console.log(data)}
/>
```

## 📖 Documentation

| Document | Description |
|----------|-------------|
| [Implementation Guide](./AI_AGENT_IMPLEMENTATION_GUIDE.md) | Complete technical documentation |
| [Quick Setup](./AI_AGENT_QUICK_SETUP.md) | Fast setup instructions |
| [Workflow Diagrams](./AI_AGENT_WORKFLOW_DIAGRAMS.md) | Visual architecture and flow |
| [Summary](./AI_AGENT_IMPLEMENTATION_SUMMARY.md) | Feature overview and status |

## 🎯 Features

### Course Outline Generation
```typescript
POST /api/v1/ai-agent/generate-course-outline
{
  "topic": "Machine Learning Basics",
  "target_audience": "Beginners",
  "learning_objectives": "Understand ML algorithms..."
}
```

**Returns**: Complete course structure with 5-8 modules

### Module Content Generation
```typescript
POST /api/v1/ai-agent/generate-module-content
{
  "course_id": 1,
  "module_title": "Introduction to Python"
}
```

**Returns**: Module details with 4-8 lesson suggestions

### Lesson Content Generation
```typescript
POST /api/v1/ai-agent/generate-lesson-content
{
  "course_id": 1,
  "module_id": 2,
  "lesson_title": "Variables and Data Types"
}
```

**Returns**: Full markdown-formatted lesson with:
- Introduction
- 3-5 content sections
- Code examples
- Practical examples
- Summary
- Discussion questions

### Quiz Question Generation
```typescript
POST /api/v1/ai-agent/generate-quiz-questions
{
  "course_id": 1,
  "module_id": 2,
  "lesson_id": 5,
  "num_questions": 10
}
```

**Returns**: Quiz with questions, answers, and explanations

### Assignment Generation
```typescript
POST /api/v1/ai-agent/generate-assignment
{
  "course_id": 1,
  "module_id": 2
}
```

**Returns**: Assignment with instructions and rubric

### Final Project Generation
```typescript
POST /api/v1/ai-agent/generate-final-project
{
  "course_id": 1
}
```

**Returns**: Comprehensive capstone project

## 💡 Usage Examples

### React Component

```tsx
import { AICourseGenerator, AIContentGenerator } from '@/components/instructor/ai-agent';

function CreateCoursePage() {
  return (
    <div>
      {/* Generate course outline */}
      <AICourseGenerator 
        onGenerate={(data) => {
          setCourseForm({
            title: data.title,
            description: data.description,
            learning_objectives: data.learning_objectives
          });
        }}
      />
      
      {/* Generate module content */}
      <AIContentGenerator
        type="module"
        courseId={courseId}
        onGenerate={(data) => createModule(data)}
        context={{ courseTitle: "My Course" }}
      />
      
      {/* Generate lesson content */}
      <AIContentGenerator
        type="lesson"
        courseId={courseId}
        moduleId={moduleId}
        onGenerate={(data) => createLesson(data)}
      />
    </div>
  );
}
```

### API Service

```typescript
import aiAgentService from '@/services/ai-agent.service';

// Generate course outline
const result = await aiAgentService.generateCourseOutline({
  topic: "Web Development",
  target_audience: "Beginners",
  learning_objectives: "Build websites"
});

if (result.success) {
  console.log(result.data);
}
```

### Python Backend

```python
from src.services.ai_agent_service import ai_agent_service

# Generate lesson content
lesson_data = ai_agent_service.generate_lesson_content(
    course_title="Python Programming",
    module_title="Basic Syntax",
    module_description="Introduction to Python basics",
    module_objectives="Learn variables, loops, functions",
    lesson_title="Variables and Data Types"
)
```

## 🏗️ Architecture

```
Frontend (Next.js/React)
    ↓
AI Agent Service (TypeScript)
    ↓
Backend API (Flask)
    ↓
AI Agent Service (Python)
    ↓
Google Gemini API
    ↓
Database (SQLAlchemy)
```

## 🔧 Configuration

### Environment Variables

**Backend** (`.env`):
```env
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.0-flash-exp
```

**Frontend** (`.env.local`):
```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1
```

## 🧪 Testing

### Automated Test Suite

```bash
cd backend
python test_ai_agent.py
```

### Manual Testing

```bash
# Health check
curl http://localhost:5000/api/v1/ai-agent/health

# Generate course (requires auth)
curl -X POST http://localhost:5000/api/v1/ai-agent/generate-course-outline \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"topic": "Web Development"}'
```

## 📊 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/ai-agent/health` | GET | Check service status |
| `/ai-agent/generate-course-outline` | POST | Generate course structure |
| `/ai-agent/generate-module-content` | POST | Generate module details |
| `/ai-agent/generate-lesson-content` | POST | Generate lesson content |
| `/ai-agent/generate-quiz-questions` | POST | Generate quiz questions |
| `/ai-agent/generate-assignment` | POST | Generate assignment |
| `/ai-agent/generate-final-project` | POST | Generate final project |
| `/ai-agent/enhance-content` | POST | Improve existing content |

## 🔐 Security

- ✅ JWT authentication required
- ✅ Instructor role verification
- ✅ Course ownership validation
- ✅ API key stored in environment variables
- ✅ Input validation and sanitization

## 🎨 UI Components

### AICourseGenerator
Full-featured course outline generator with form inputs for topic, audience, and objectives.

### AIContentGenerator
Reusable component for generating modules, lessons, quizzes, assignments, and projects.

**Props:**
```typescript
{
  type: 'module' | 'lesson' | 'quiz' | 'assignment' | 'project';
  courseId: number;
  moduleId?: number;
  lessonId?: number;
  onGenerate: (data: any) => void;
  context?: {
    courseTitle?: string;
    moduleTitle?: string;
  };
}
```

## 📁 File Structure

```
backend/
├── src/
│   ├── services/
│   │   └── ai_agent_service.py      # AI service logic
│   └── routes/
│       └── ai_agent_routes.py        # API endpoints
├── test_ai_agent.py                  # Test suite
└── requirements.txt                  # Dependencies

frontend/
├── src/
│   ├── services/
│   │   └── ai-agent.service.ts      # API client
│   └── components/
│       └── instructor/
│           └── ai-agent/
│               ├── AICourseGenerator.tsx
│               ├── AIContentGenerator.tsx
│               └── index.ts
└── package.json                      # Dependencies
```

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| "API key not configured" | Set `GEMINI_API_KEY` in backend `.env` |
| 401 Unauthorized | Login as instructor first |
| Slow response | Normal for first request |
| Empty response | Check backend logs for API errors |
| Network error | Verify backend is running |

## 📈 Performance

- **First request**: ~5-10 seconds (model initialization)
- **Subsequent requests**: ~2-5 seconds
- **Cost**: Free tier available, pay-as-you-go for production
- **Rate limits**: 60 requests/minute on free tier

## 🔄 Workflow

1. **Instructor** enters course topic
2. **AI** generates course outline with modules
3. **Instructor** reviews and creates course
4. **For each module:**
   - AI generates module content
   - Instructor reviews and creates module
5. **For each lesson:**
   - AI generates lesson with markdown content
   - Instructor reviews and creates lesson
6. **Assessments:**
   - AI generates quizzes, assignments, projects
   - Instructor reviews and publishes

## 🎓 Best Practices

1. **Always review AI content** before publishing
2. **Provide context** for better results
3. **Edit and customize** generated content
4. **Use iteratively** - generate, review, refine
5. **Start with outline** before details
6. **Test in development** before production use

## 🚦 Status

- ✅ Backend implementation complete
- ✅ Frontend components ready
- ✅ API integration working
- ✅ Documentation complete
- ✅ Test suite available
- ✅ Production ready

## 📝 License

Part of Afritec Bridge LMS - All rights reserved

## 🤝 Contributing

See main repository for contribution guidelines

## 💬 Support

- 📖 Check documentation files
- 🐛 Report issues to development team
- 💡 Suggest improvements
- 📧 Contact support@afritecbridge.online

---

**Built with ❤️ using Google Gemini AI**
