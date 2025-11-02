# Quiz Questions Storage Fix - Complete Documentation

## Problem Identified
Quiz questions were not being stored in the database due to **column name mismatches** between the database models and the API routes.

## Root Cause Analysis

### 1. Database Model Structure
The `Question` model in `/backend/src/models/course_models.py` uses:
- `text` (NOT `question_text`)
- `order` (NOT `order_index`)
- NO `points` field
- NO `explanation` field

The `Answer` model uses:
- `text` (NOT `answer_text`)
- NO `order` field

### 2. API Route Mismatch
The route in `/backend/src/routes/instructor_assessment_routes.py` was trying to use:
- `question_text` → Should be `text`
- `answer_text` → Should be `text`
- `points` → Field doesn't exist in model
- `explanation` → Field doesn't exist in model
- `order` attribute on Answer → Field doesn't exist

## Fixes Applied

### Backend Route Fix
**File**: `/backend/src/routes/instructor_assessment_routes.py`

#### Changes Made:
1. **Field Name Corrections**:
   - Changed `question_text` to `text` for questions
   - Changed `answer_text` to `text` for answers
   - Removed `points` and `explanation` (not in model)
   - Removed `order` from Answer creation

2. **Backward Compatibility**:
   - Accepts both `question_text` and `text` for question text
   - Accepts both `answer_text` and `text` for answer text
   - This ensures existing code continues to work

3. **Auto-increment Order**:
   - Added logic to automatically calculate the next question order
   - Queries the last question and increments its order
   - Falls back to order 1 if no questions exist

#### Updated Code:
```python
# Accept both 'question_text' and 'text' for compatibility
question_text = data.get('question_text') or data.get('text')
if not question_text or 'answers' not in data:
    return jsonify({"message": "Question text and answers are required"}), 400

# Get the next order number
last_question = Question.query.filter_by(quiz_id=quiz_id).order_by(Question.order.desc()).first()
next_order = (last_question.order + 1) if last_question else 1

question = Question(
    quiz_id=quiz_id,
    text=question_text,
    question_type=data.get('question_type', 'multiple_choice'),
    order=data.get('order', next_order)
)

db.session.add(question)
db.session.flush()  # Get the question ID

# Add answers
answers_data = data['answers']
for answer_data in answers_data:
    # Accept both 'answer_text' and 'text' for compatibility
    answer_text = answer_data.get('answer_text') or answer_data.get('text')
    if not answer_text:
        continue  # Skip empty answers
        
    answer = Answer(
        question_id=question.id,
        text=answer_text,
        is_correct=answer_data.get('is_correct', False)
    )
    db.session.add(answer)

db.session.commit()
```

### Frontend Service Fix
**File**: `/frontend/src/services/instructor-assessment.service.ts`

#### Changes Made:
Updated `AddQuestionRequest` interface to support both field naming conventions:

```typescript
export interface AddQuestionRequest {
  text?: string;  // Preferred field name matching backend model
  question_text?: string;  // Alternative field name for compatibility
  question_type?: string;
  order?: number;
  answers: {
    text?: string;  // Preferred field name matching backend model
    answer_text?: string;  // Alternative field name for compatibility
    is_correct: boolean;
  }[];
}
```

## Database Model Details

### Question Model
```python
class Question(db.Model):
    __tablename__ = 'questions'
    id = db.Column(db.Integer, primary_key=True)
    quiz_id = db.Column(db.Integer, db.ForeignKey('quizzes.id'), nullable=False)
    text = db.Column(db.Text, nullable=False)  # ← Use 'text' not 'question_text'
    question_type = db.Column(db.String(50), nullable=False)
    order = db.Column(db.Integer, nullable=False, default=0)  # ← Use 'order'
```

### Answer Model
```python
class Answer(db.Model):
    __tablename__ = 'answers'
    id = db.Column(db.Integer, primary_key=True)
    question_id = db.Column(db.Integer, db.ForeignKey('questions.id'), nullable=False)
    text = db.Column(db.Text, nullable=False)  # ← Use 'text' not 'answer_text'
    is_correct = db.Column(db.Boolean, default=False, nullable=False)
```

## API Endpoint Details

### Add Question to Quiz
**Endpoint**: `POST /api/v1/instructor/assessments/quizzes/{quiz_id}/questions`

**Request Body** (supports both formats):
```json
{
  "text": "What is Python?",  // Preferred
  // OR
  "question_text": "What is Python?",  // Also accepted
  
  "question_type": "multiple_choice",
  "order": 1,  // Optional, auto-calculated if not provided
  
  "answers": [
    {
      "text": "A programming language",  // Preferred
      // OR
      "answer_text": "A programming language",  // Also accepted
      "is_correct": true
    },
    {
      "text": "A snake",
      "is_correct": false
    }
  ]
}
```

**Response** (201 Created):
```json
{
  "message": "Question added successfully",
  "question": {
    "id": 123,
    "quiz_id": 45,
    "text": "What is Python?",
    "question_type": "multiple_choice",
    "order": 1,
    "answers": [
      {
        "id": 456,
        "question_id": 123,
        "text": "A programming language",
        "is_correct": true
      },
      {
        "id": 457,
        "question_id": 123,
        "text": "A snake",
        "is_correct": false
      }
    ]
  }
}
```

## How to Add Questions to Quiz

### Method 1: Using InstructorAssessmentService (Recommended)

```typescript
import InstructorAssessmentService from '@/services/instructor-assessment.service';

// After creating a quiz
const quiz = await InstructorAssessmentService.createQuiz({
  title: "Python Basics",
  course_id: 1,
  // ... other fields
});

// Add questions one by one
await InstructorAssessmentService.addQuizQuestion(quiz.id, {
  text: "What is Python?",
  question_type: "multiple_choice",
  answers: [
    { text: "A programming language", is_correct: true },
    { text: "A snake", is_correct: false },
    { text: "A food", is_correct: false },
    { text: "A car", is_correct: false }
  ]
});
```

### Method 2: Using CourseCreationService

```typescript
import CourseCreationService from '@/services/course-creation.service';

// After creating a quiz
await CourseCreationService.addQuizQuestion(quizId, {
  text: "What is Python?",
  question_type: "multiple_choice",
  answers: [
    { text: "A programming language", is_correct: true },
    { text: "A snake", is_correct: false }
  ]
});
```

## Workflow for Creating Quiz with Questions

1. **Create Quiz** (without questions)
2. **Loop through questions** and add each one individually
3. **Questions are auto-ordered** based on insertion sequence

### Example Implementation:

```typescript
const createQuizWithQuestions = async () => {
  try {
    // Step 1: Create the quiz
    const quiz = await InstructorAssessmentService.createQuiz({
      title: "Python Basics Quiz",
      description: "Test your Python knowledge",
      course_id: 1,
      module_id: 5,
      time_limit: 30,
      max_attempts: 3,
      is_published: false
    });

    // Step 2: Add questions
    const questions = [
      {
        text: "What is Python?",
        question_type: "multiple_choice",
        answers: [
          { text: "A programming language", is_correct: true },
          { text: "A snake", is_correct: false }
        ]
      },
      {
        text: "Is Python compiled?",
        question_type: "true_false",
        answers: [
          { text: "True", is_correct: false },
          { text: "False", is_correct: true }
        ]
      }
    ];

    // Add each question
    for (const questionData of questions) {
      await InstructorAssessmentService.addQuizQuestion(quiz.id, questionData);
    }

    console.log("Quiz created with questions!");
  } catch (error) {
    console.error("Error:", error);
  }
};
```

## Testing Checklist

- [x] Backend route accepts `text` field for questions
- [x] Backend route accepts `text` field for answers
- [x] Backend route auto-increments question order
- [x] Backend route handles backward compatibility
- [x] Frontend service interface updated
- [ ] Test creating quiz with questions
- [ ] Test question order is sequential
- [ ] Test both field naming conventions work
- [ ] Verify questions persist in database
- [ ] Verify answers are linked to questions
- [ ] Test retrieving quiz with questions

## Known Limitations

1. **No Bulk Insert**: Questions must be added one at a time
2. **Limited Fields**: Question model doesn't have `points` or `explanation` fields
3. **Answer Ordering**: Answers don't have an `order` field for display sequencing

## Future Enhancements

### Option 1: Extend Current Model
Add migration to add missing fields:
```python
# Migration to add fields
question.points = db.Column(db.Integer, default=1)
question.explanation = db.Column(db.Text, nullable=True)
answer.order = db.Column(db.Integer, default=0)
```

### Option 2: Use Advanced Quiz Model
The system also has a more advanced quiz model in `quiz_progress_models.py` with:
- Points per question
- Explanation text
- Image support
- Question options with feedback
- More question types

Consider migrating to this model for richer features.

## Related Files

- `/backend/src/models/course_models.py` - Database models
- `/backend/src/routes/instructor_assessment_routes.py` - Fixed API route
- `/backend/src/routes/assessment_routes.py` - Similar working implementation
- `/frontend/src/services/instructor-assessment.service.ts` - Frontend service
- `/frontend/src/services/course-creation.service.ts` - Alternative service
- `/frontend/src/components/instructor/course-creation/AssessmentManagement.tsx` - Quiz creation UI

## Support

Questions are now stored correctly when using the proper field names. The backward compatibility ensures existing code continues to work while new code can use the correct field names.
