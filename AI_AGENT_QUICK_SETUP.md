# AI Agent - Quick Setup Guide

## Prerequisites
- Google Gemini API key ([Get one here](https://makersuite.google.com/app/apikey))

## Backend Setup (5 minutes)

### 1. Install Dependencies
```bash
cd backend
pip install google-generativeai
```

### 2. Configure Environment
Add to `backend/.env`:
```env
GEMINI_API_KEY=your_api_key_here
GEMINI_MODEL=gemini-2.0-flash-exp
```

### 3. Verify Setup
```bash
python main.py
# Visit: http://localhost:5000/api/v1/ai-agent/health
```

Expected response:
```json
{
  "status": "operational",
  "api_configured": true,
  "message": "AI Agent service is running"
}
```

## Frontend Setup (2 minutes)

### 1. Install Dependencies
```bash
cd frontend
npm install @google/generative-ai
```

### 2. No additional config needed!
The frontend uses the backend API, so just ensure `NEXT_PUBLIC_API_URL` points to your backend.

## Quick Test

### Test Course Generation (using curl)
```bash
# Get JWT token first by logging in as instructor
TOKEN="your_jwt_token_here"

curl -X POST http://localhost:5000/api/v1/ai-agent/generate-course-outline \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "Web Development Basics",
    "target_audience": "Complete beginners",
    "learning_objectives": "Build websites using HTML, CSS, and JavaScript"
  }'
```

## UI Components Usage

### In Course Creation Page
```tsx
import { AICourseGenerator } from '@/components/instructor/ai-agent';

<AICourseGenerator 
  onGenerate={(data) => {
    // Auto-fill form with AI data
    setFormData(data);
  }} 
/>
```

### In Module Management
```tsx
import { AIContentGenerator } from '@/components/instructor/ai-agent';

<AIContentGenerator
  type="module"
  courseId={courseId}
  onGenerate={(data) => createModule(data)}
  context={{ courseTitle: "My Course" }}
/>
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "API key not configured" | Set `GEMINI_API_KEY` in backend `.env` |
| 401 Unauthorized | Ensure you're logged in as instructor |
| Slow response | Normal for first request; subsequent requests are faster |
| Empty response | Check backend logs for API errors |

## Available AI Features

✅ Course outline generation  
✅ Module content generation  
✅ Lesson content generation (with markdown)  
✅ Quiz question generation  
✅ Assignment generation  
✅ Final project generation  
✅ Content enhancement  

## Next Steps

1. **Create a test course**: Use AI to generate full course structure
2. **Review content**: Always review and edit AI-generated content
3. **Customize prompts**: Modify `ai_agent_service.py` for your needs
4. **Add to existing pages**: Integrate AI components into your forms

## Support

- Full documentation: `AI_AGENT_IMPLEMENTATION_GUIDE.md`
- Backend service: `backend/src/services/ai_agent_service.py`
- API routes: `backend/src/routes/ai_agent_routes.py`
- Frontend service: `frontend/src/services/ai-agent.service.ts`
- UI components: `frontend/src/components/instructor/ai-agent/`
