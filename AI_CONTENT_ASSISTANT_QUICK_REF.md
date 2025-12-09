# AI Content Assistant - Quick Reference

## 🚀 Quick Start

### For Instructors
1. Navigate to Course Creation → Select Course → Add/Edit Module
2. Click "Add Lesson" or "Edit" on existing lesson
3. Enter lesson title (required)
4. Select "Text Content" or "Mixed Content"
5. Click **✨ AI Enhance** button next to Preview
6. Review context, click "Generate Full Content"
7. Wait 5-30 seconds for AI generation
8. Review and edit generated content
9. Save lesson

## 🔑 Key Features

| Feature | Description |
|---------|-------------|
| **Context-Aware** | Analyzes course, module, and existing lessons |
| **Smart Progression** | Ensures content builds on previous lessons |
| **No Repetition** | Avoids covering already-taught material |
| **Comprehensive** | Generates full markdown with sections, examples, code |
| **Customizable** | Edit generated content before saving |
| **Fast** | 5-30 seconds generation time |

## 📋 Requirements

- ✅ Lesson title must be entered
- ✅ Content type must be "Text" or "Mixed"
- ✅ Valid course and module context
- ✅ Instructor authentication

## 🎨 Generated Content Includes

1. **Introduction** - Overview with context from previous lessons
2. **Main Content Sections** - 3-5 detailed sections with headers
3. **Code Examples** - Syntax-highlighted code blocks (if relevant)
4. **Practical Examples** - Real-world applications
5. **Key Takeaways** - Summary points
6. **Discussion Questions** - Reflection prompts

## 🛠️ Technical Stack

| Layer | Technology |
|-------|-----------|
| **Frontend Component** | React 19 + TypeScript |
| **UI Framework** | Tailwind CSS + lucide-react |
| **API Client** | Axios (120s timeout) |
| **Backend Framework** | Flask + SQLAlchemy |
| **AI Model** | Google Gemini 1.5 Flash |
| **Rate Limiting** | 15 req/min |
| **Retry Logic** | 3 attempts, exponential backoff |

## 📂 File Locations

### Frontend
```
frontend/src/
├── components/instructor/course-creation/
│   ├── AIContentButton.tsx          ← NEW Component
│   └── ModuleManagement.tsx         ← Updated (2 places)
└── services/
    └── ai-agent.service.ts          ← Existing service
```

### Backend
```
backend/src/
├── routes/
│   └── ai_agent_routes.py           ← /generate-lesson-content
└── services/
    └── ai_agent_service.py          ← generate_lesson_content()
```

## 🔍 Troubleshooting

| Issue | Solution |
|-------|----------|
| Button not visible | Check content type is "Text" or "Mixed" |
| "Enter title first" | Fill in lesson title field above |
| Generation timeout | Wait up to 120 seconds, check backend logs |
| Empty content | Check backend AI service rate limits |
| Wrong content | Verify lesson title matches intended topic |

## 📊 API Reference

### Request
```http
POST /api/v1/ai-agent/generate-lesson-content
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "course_id": 1,
  "module_id": 2,
  "lesson_title": "Introduction to Variables",
  "lesson_description": "Learn about Python variables"
}
```

### Response
```json
{
  "success": true,
  "data": {
    "title": "Introduction to Variables",
    "description": "Brief 2-3 sentence description",
    "learning_objectives": "• Objective 1\n• Objective 2\n• Objective 3",
    "duration_minutes": 45,
    "content_type": "text",
    "content_data": "# Introduction\n\nFull markdown content..."
  }
}
```

## 🎯 Best Practices

### For Optimal Results
1. ✅ **Use descriptive titles** - "Introduction to Python Lists" vs "Lists"
2. ✅ **Add brief description** - Helps AI understand lesson focus
3. ✅ **Review generated content** - Always verify accuracy
4. ✅ **Edit as needed** - Customize to match teaching style
5. ✅ **Check progression** - Ensure builds on previous lessons

### What NOT to Do
1. ❌ **Don't skip title** - Required for generation
2. ❌ **Don't generate too fast** - Rate limit: 15 req/min
3. ❌ **Don't use vague titles** - "Lesson 1", "Part A"
4. ❌ **Don't skip review** - AI can make mistakes
5. ❌ **Don't regenerate unnecessarily** - Quota limits apply

## 📈 Performance

| Metric | Value |
|--------|-------|
| **Avg Response Time** | 10-20 seconds |
| **Max Timeout** | 120 seconds |
| **Rate Limit** | 15 requests/minute |
| **Daily Quota** | 1500 requests (free tier) |
| **Content Length** | 500-5000 characters |

## 🔐 Security

- ✅ JWT authentication required
- ✅ Instructor-only access
- ✅ Course ownership verification
- ✅ Input validation and sanitization
- ✅ Rate limiting prevents abuse

## 📚 Related Features

| Feature | Location |
|---------|----------|
| **Module AI Generation** | "AI Assistant" button in Modules header |
| **Batch Lesson Generation** | "AI Assistant" → Batch Mode |
| **Quiz Generation** | Quiz creation form |
| **Assignment Generation** | Assignment creation form |
| **Project Generation** | Project creation form |

## 🎓 Example Use Cases

### Use Case 1: New Course Creation
- Generate all lesson content for a new module
- AI analyzes course structure and creates progressive lessons

### Use Case 2: Content Enhancement
- Edit existing lesson, click AI Enhance
- AI regenerates improved content based on current title/description

### Use Case 3: Gap Filling
- Identify missing topics in module
- Generate lessons to fill knowledge gaps

## 📞 Support

### Debug Mode
Enable console logging:
```javascript
// In browser console
localStorage.setItem('DEBUG_AI', 'true');
```

### Error Logs
Check:
- **Frontend**: Browser Developer Console
- **Backend**: Flask server logs (`python main.py`)

### Common Error Messages
| Message | Meaning |
|---------|---------|
| "Enter lesson title first" | Title field is empty |
| "Module not found" | Invalid module ID or context |
| "Failed to generate content" | AI service error or timeout |
| "Rate limit exceeded" | Too many requests, wait 1 minute |

---

## ⚡ Quick Commands (Testing)

### Backend
```bash
cd backend
python main.py  # Start dev server
```

### Frontend
```bash
cd frontend
npm run dev     # Start Next.js dev server
```

### Test Generation
1. Open: http://localhost:3000/instructor/courses
2. Select course → Click module
3. Click "Add Lesson"
4. Title: "Test Lesson"
5. Content: "Text Content"
6. Click ✨ AI Enhance
7. Check console logs for debug info

---

**Quick Ref Version**: 1.0  
**Last Updated**: January 2025  
**Status**: ✅ Production Ready
