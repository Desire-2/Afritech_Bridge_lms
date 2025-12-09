# AI Assessment Generation - Quick Reference

## What's New?

✨ **Generate Assessments from Actual Content** - AI can now create quizzes, assignments, and projects based on your lesson/module content!

## Three New Endpoints

### 1. 📝 Quiz from Content
```
POST /api/v1/ai-agent/generate-quiz-from-content
```
**Use when**: You want to create a quiz based on what students actually learned

**Parameters**:
- `content_type`: "lesson" or "module"
- `lesson_id` or `module_id`: Which content to use
- `num_questions`: How many questions (default: 10)
- `difficulty`: "easy", "medium", "hard", or "mixed"

**Example**:
```json
{
  "course_id": 1,
  "content_type": "lesson",
  "lesson_id": 5,
  "num_questions": 10,
  "difficulty": "mixed"
}
```

### 2. 📋 Assignment from Content
```
POST /api/v1/ai-agent/generate-assignment-from-content
```
**Use when**: You want to create homework based on lesson/module content

**Parameters**:
- `content_type`: "lesson" or "module"
- `lesson_id` or `module_id`: Which content to use
- `assignment_type`: "practical", "theoretical", "project", or "mixed"

**Example**:
```json
{
  "course_id": 1,
  "content_type": "module",
  "module_id": 3,
  "assignment_type": "practical"
}
```

### 3. 🎯 Project from Module
```
POST /api/v1/ai-agent/generate-project-from-content
```
**Use when**: You want a comprehensive project covering an entire module

**Parameters**:
- `module_id`: Which module to base project on

**Example**:
```json
{
  "course_id": 1,
  "module_id": 3
}
```

## Instructor Workflow

```
1. Create Course Content
   ↓
2. Select Lesson/Module
   ↓
3. Choose Assessment Type (Quiz/Assignment/Project)
   ↓
4. Click "Generate with AI"
   ↓
5. Review & Edit Generated Assessment
   ↓
6. Assign to Students
```

## Key Features

✅ **Content-Aligned**: Only questions/tasks on material actually taught
✅ **Customizable**: Multiple difficulty levels and assignment types  
✅ **Complete**: Includes rubrics, instructions, explanations
✅ **Fast**: Generate in seconds, not hours
✅ **Quality**: Well-structured, pedagogically sound

## Assignment Types

| Type | Focus | Best For |
|------|-------|----------|
| **practical** | Hands-on exercises | Skills-based courses |
| **theoretical** | Analysis & explanation | Conceptual courses |
| **project** | Comprehensive work | Capstone assessments |
| **mixed** | Both practical & theoretical | Balanced courses |

## Difficulty Levels

| Level | Question Focus | % Distribution (Mixed Mode) |
|-------|---------------|---------------------------|
| **easy** | Recall & recognition | 40% |
| **medium** | Application & analysis | 40% |
| **hard** | Synthesis & evaluation | 20% |
| **mixed** | All levels combined | Balanced mix |

## What Gets Generated?

### Quiz
- ✅ Title and description
- ✅ 4-option multiple choice questions
- ✅ Correct answers marked
- ✅ Explanations for answers
- ✅ Time limit & passing score
- ✅ Points per question

### Assignment
- ✅ Engaging title
- ✅ Detailed instructions (step-by-step)
- ✅ List of deliverables
- ✅ Grading rubric with weights
- ✅ Due date suggestion
- ✅ Submission format

### Project
- ✅ Professional project title
- ✅ Comprehensive description
- ✅ Project requirements
- ✅ Deliverables list
- ✅ Detailed grading rubric
- ✅ Timeline (days)
- ✅ Required resources/tools

## Prerequisites

⚠️ **Content must exist first!**
- Lessons must have `content_data` (markdown content)
- Modules must have lessons with content
- Use AI content generation or manual entry

## API Authentication

All endpoints require:
- JWT token in Authorization header
- Instructor or Admin role
- Course ownership verification

## Error Messages

| Error | Meaning | Solution |
|-------|---------|----------|
| "Lesson has no content" | Lesson is empty | Add content first |
| "Module has no lessons" | Module is empty | Create lessons |
| "Course not found" | Invalid ID or no access | Check course_id |
| "Quota exceeded" | Too many AI requests | Wait 1 minute |

## Rate Limits

- 15 requests/minute (default)
- Configurable via `GEMINI_MAX_RPM` environment variable
- Automatic retry with backoff on quota errors

## Database Connection Fix

🔧 Fixed connection pool exhaustion issue:
- Reduced pool size for free-tier PostgreSQL (5 total connections)
- Added aggressive connection recycling (2 minutes)
- Fixed SQLite compatibility (removed unsupported `connect_timeout`)
- Added health monitoring endpoints

## Health Monitoring

New endpoints to check database status:
- `GET /api/v1/health/db` - Overall health check
- `GET /api/v1/health/db/pool-status` - Connection pool stats
- `POST /api/v1/health/db/force-cleanup` - Emergency cleanup (requires admin key)

## Frontend Integration TODO

1. Add "Generate with AI" button in assessment creation
2. Show lesson/module picker dropdown
3. Add difficulty/assignment type selector
4. Call appropriate API endpoint
5. Display generated content in editable form
6. Allow instructor to review/modify
7. Save via existing assessment endpoints

## Testing Examples

```bash
# Test quiz generation
curl -X POST http://localhost:5001/api/v1/ai-agent/generate-quiz-from-content \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"course_id":1,"content_type":"lesson","lesson_id":5,"num_questions":5}'

# Test assignment generation  
curl -X POST http://localhost:5001/api/v1/ai-agent/generate-assignment-from-content \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"course_id":1,"content_type":"module","module_id":3,"assignment_type":"practical"}'
```

## Environment Setup

Required:
```bash
GEMINI_API_KEY=your_gemini_api_key_here
```

Optional:
```bash
GEMINI_MAX_RPM=15
GEMINI_MODEL=gemini-2.5-flash-preview-09-2025
ADMIN_KEY=your_admin_key_for_emergency_cleanup
```

## Files Modified

### Backend
1. `src/services/ai_agent_service.py` - Added 3 new generation methods
2. `src/routes/ai_agent_routes.py` - Added 3 new API endpoints
3. `main.py` - Fixed database connection pool, added health endpoints
4. `src/utils/db_health.py` - NEW: Database health monitoring utilities

### Documentation
1. `AI_ASSESSMENT_GENERATION.md` - Comprehensive guide
2. `AI_ASSESSMENT_GENERATION_QUICK_REF.md` - This quick reference

## Status

✅ **Backend**: Fully implemented and functional
⏳ **Frontend**: Ready for integration
🧪 **Testing**: Manual testing successful
📚 **Documentation**: Complete

## Next Steps

1. Start backend: `cd backend && ./run.sh`
2. Test endpoints with Postman/curl
3. Implement frontend UI for content selection
4. Add "Generate with AI" buttons to assessment forms
5. Connect frontend to new endpoints
6. Deploy to production

## Support

For issues or questions:
- Check documentation: `AI_ASSESSMENT_GENERATION.md`
- Review endpoint logs for errors
- Check database health: `GET /api/v1/health/db`
- Verify GEMINI_API_KEY is set correctly

---

**Quick Win**: Generate a full quiz in 10 seconds instead of spending 2 hours writing questions! 🚀
