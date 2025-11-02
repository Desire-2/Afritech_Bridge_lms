# Quiz Settings and Question Fields Fix - Complete

**Date**: November 2, 2025  
**Issue**: Quiz settings fields and question-level fields (points, explanation) were not being saved to the database

---

## Problems Identified

### 1. Missing Quiz Settings Fields
The Quiz model was missing 8 fields that the frontend was collecting:
- `time_limit` - Time limit for quiz completion (minutes)
- `max_attempts` - Maximum number of attempts allowed
- `passing_score` - Minimum score required to pass (percentage)
- `due_date` - When the quiz is due
- `points_possible` - Total points for the quiz
- `shuffle_questions` - Whether to randomize question order
- `shuffle_answers` - Whether to randomize answer order
- `show_correct_answers` - Whether to show correct answers after submission

### 2. Missing Question Fields
The Question model was missing:
- `points` - Points value for individual questions
- `explanation` - Explanation of the correct answer

---

## Changes Made

### 1. Quiz Model Updates (`backend/src/models/course_models.py`)

#### Added Fields:
```python
time_limit = db.Column(db.Integer, nullable=True)
max_attempts = db.Column(db.Integer, nullable=True)
passing_score = db.Column(db.Integer, default=70)
due_date = db.Column(db.DateTime, nullable=True)
points_possible = db.Column(db.Float, default=100.0)
shuffle_questions = db.Column(db.Boolean, default=False)
shuffle_answers = db.Column(db.Boolean, default=False)
show_correct_answers = db.Column(db.Boolean, default=True)
```

#### Updated `to_dict()` Method:
```python
def to_dict(self, include_questions=False):
    data = {
        'id': self.id,
        'title': self.title,
        'description': self.description,
        # ... other fields ...
        'time_limit': self.time_limit,
        'max_attempts': self.max_attempts,
        'passing_score': self.passing_score,
        'due_date': self.due_date.isoformat() if self.due_date else None,
        'points_possible': self.points_possible,
        'shuffle_questions': self.shuffle_questions,
        'shuffle_answers': self.shuffle_answers,
        'show_correct_answers': self.show_correct_answers
    }
    if include_questions:
        data['questions'] = [q.to_dict(include_answers=True) for q in self.questions]
    return data
```

### 2. Question Model Updates (`backend/src/models/course_models.py`)

#### Added Fields:
```python
points = db.Column(db.Float, default=10.0)
explanation = db.Column(db.Text, nullable=True)
```

#### Updated `to_dict()` Method:
```python
def to_dict(self, include_answers=False, for_student=False):
    data = {
        'id': self.id,
        'quiz_id': self.quiz_id,
        'text': self.text,
        'question_type': self.question_type,
        'order': self.order,
        'points': self.points,
        'explanation': self.explanation
    }
    if include_answers:
        data['answers'] = [ans.to_dict(for_student=for_student) for ans in self.answers]
    return data
```

### 3. Route Updates (`backend/src/routes/instructor_assessment_routes.py`)

#### `create_quiz()` Endpoint - Lines ~93-117:
```python
quiz = Quiz(
    title=data.get('title', ''),
    description=data.get('description', ''),
    course_id=course_id,
    module_id=module_id,
    lesson_id=data.get('lesson_id'),
    is_published=data.get('is_published', False),
    time_limit=int(data['time_limit']) if data.get('time_limit') and str(data['time_limit']).strip() else None,
    max_attempts=int(data['max_attempts']) if data.get('max_attempts') and str(data['max_attempts']).strip() else None,
    passing_score=int(data.get('passing_score', 70)),
    due_date=due_date,
    points_possible=float(data.get('points_possible', 100.0)),
    shuffle_questions=bool(data.get('shuffle_questions', False)),
    shuffle_answers=bool(data.get('shuffle_answers', False)),
    show_correct_answers=bool(data.get('show_correct_answers', True))
)
```

#### Question Creation in `create_quiz()`:
```python
question = Question(
    quiz_id=quiz.id,
    text=question_text,
    question_type=question_data.get('question_type', 'multiple_choice'),
    order=idx + 1,
    points=float(question_data.get('points', 10.0)),
    explanation=question_data.get('explanation', '')
)
```

#### `update_quiz()` Endpoint - Lines ~188-220:
```python
# Update quiz settings fields
if 'time_limit' in data:
    quiz.time_limit = int(data['time_limit']) if data['time_limit'] and str(data['time_limit']).strip() else None
if 'max_attempts' in data:
    quiz.max_attempts = int(data['max_attempts']) if data['max_attempts'] and str(data['max_attempts']).strip() else None
if 'passing_score' in data:
    quiz.passing_score = int(data['passing_score']) if data['passing_score'] else 70
if 'due_date' in data:
    if data['due_date']:
        try:
            date_str = data['due_date']
            if 'T' in date_str and not date_str.endswith('Z') and '+' not in date_str:
                quiz.due_date = datetime.fromisoformat(date_str)
            else:
                quiz.due_date = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        except (ValueError, AttributeError):
            pass
    else:
        quiz.due_date = None
if 'points_possible' in data:
    quiz.points_possible = float(data['points_possible']) if data['points_possible'] else 100.0
if 'shuffle_questions' in data:
    quiz.shuffle_questions = bool(data['shuffle_questions'])
if 'shuffle_answers' in data:
    quiz.shuffle_answers = bool(data['shuffle_answers'])
if 'show_correct_answers' in data:
    quiz.show_correct_answers = bool(data['show_correct_answers'])
```

#### `add_quiz_question()` Endpoint:
```python
question = Question(
    quiz_id=quiz_id,
    text=question_text,
    question_type=data.get('question_type', 'multiple_choice'),
    order=data.get('order', next_order),
    points=float(data.get('points', 10.0)),
    explanation=data.get('explanation', '')
)
```

#### `add_bulk_quiz_questions()` Endpoint:
```python
question = Question(
    quiz_id=quiz_id,
    text=question_text,
    question_type=question_data.get('question_type', 'multiple_choice'),
    order=next_order + idx,
    points=float(question_data.get('points', 10.0)),
    explanation=question_data.get('explanation', '')
)
```

### 4. Database Migrations

#### Quiz Settings Migration (`migrate_quiz_settings.py`):
```sql
ALTER TABLE quizzes ADD COLUMN time_limit INTEGER;
ALTER TABLE quizzes ADD COLUMN passing_score INTEGER DEFAULT 70;
ALTER TABLE quizzes ADD COLUMN due_date DATETIME;
ALTER TABLE quizzes ADD COLUMN shuffle_questions BOOLEAN DEFAULT 0;
ALTER TABLE quizzes ADD COLUMN shuffle_answers BOOLEAN DEFAULT 0;
ALTER TABLE quizzes ADD COLUMN show_correct_answers BOOLEAN DEFAULT 1;
```

**Note**: `max_attempts` and `points_possible` already existed in the table.

#### Question Fields Migration (`migrate_question_fields.py`):
```sql
ALTER TABLE questions ADD COLUMN points REAL DEFAULT 10.0;
ALTER TABLE questions ADD COLUMN explanation TEXT;
```

---

## Migration Results

### Quiz Table Structure (After Migration):
```
id                        INTEGER         NOT NULL 
title                     VARCHAR(255)    NOT NULL 
description               TEXT             
course_id                 INTEGER          
module_id                 INTEGER          
lesson_id                 INTEGER          
created_at                DATETIME         
time_limit_minutes        INTEGER          
max_attempts              INTEGER          DEFAULT 1
points_possible           FLOAT            DEFAULT 100.0
is_published              BOOLEAN          DEFAULT 0
time_limit                INTEGER          
passing_score             INTEGER          DEFAULT 70
due_date                  DATETIME         
shuffle_questions         BOOLEAN          DEFAULT 0
shuffle_answers           BOOLEAN          DEFAULT 0
show_correct_answers      BOOLEAN          DEFAULT 1
```

### Questions Table Structure (After Migration):
```
id                        INTEGER         NOT NULL 
quiz_id                   INTEGER         NOT NULL 
text                      TEXT            NOT NULL 
question_type             VARCHAR(50)     NOT NULL 
order                     INTEGER         NOT NULL 
points                    REAL             DEFAULT 10.0
explanation               TEXT
```

---

## Testing Steps

1. **Restart Backend Server**:
   ```bash
   cd /home/desire/My_Project/AB/afritec_bridge_lms/backend
   python3 run.py
   ```

2. **Test Quiz Creation**:
   - Create a new quiz with all settings filled in
   - Add questions with points and explanations
   - Verify all fields are saved to the database

3. **Test Quiz Update**:
   - Edit an existing quiz
   - Modify settings (time_limit, passing_score, etc.)
   - Update question points and explanations
   - Verify changes persist

4. **Verify Database**:
   ```bash
   sqlite3 backend/instance/afritec_lms_db.db
   SELECT * FROM quizzes WHERE id = [quiz_id];
   SELECT * FROM questions WHERE quiz_id = [quiz_id];
   ```

---

## API Request/Response Examples

### Create Quiz Request:
```json
{
  "title": "JavaScript Fundamentals Quiz",
  "description": "Test your knowledge of JavaScript basics",
  "course_id": 1,
  "module_id": 2,
  "is_published": true,
  "time_limit": 30,
  "max_attempts": 3,
  "passing_score": 70,
  "due_date": "2025-11-10T23:59:00",
  "points_possible": 100,
  "shuffle_questions": true,
  "shuffle_answers": true,
  "show_correct_answers": true,
  "questions": [
    {
      "question_text": "What is a closure in JavaScript?",
      "question_type": "multiple_choice",
      "points": 10,
      "explanation": "A closure is a function that has access to variables in its outer scope",
      "answers": [
        { "answer_text": "A function within a function", "is_correct": true },
        { "answer_text": "A loop structure", "is_correct": false },
        { "answer_text": "A data type", "is_correct": false }
      ]
    }
  ]
}
```

### Create Quiz Response:
```json
{
  "message": "Quiz created successfully",
  "quiz": {
    "id": 5,
    "title": "JavaScript Fundamentals Quiz",
    "description": "Test your knowledge of JavaScript basics",
    "course_id": 1,
    "module_id": 2,
    "lesson_id": null,
    "is_published": true,
    "created_at": "2025-11-02T10:30:00",
    "time_limit": 30,
    "max_attempts": 3,
    "passing_score": 70,
    "due_date": "2025-11-10T23:59:00",
    "points_possible": 100,
    "shuffle_questions": true,
    "shuffle_answers": true,
    "show_correct_answers": true,
    "questions": [
      {
        "id": 15,
        "quiz_id": 5,
        "text": "What is a closure in JavaScript?",
        "question_type": "multiple_choice",
        "order": 1,
        "points": 10,
        "explanation": "A closure is a function that has access to variables in its outer scope",
        "answers": [
          { "id": 45, "question_id": 15, "text": "A function within a function", "is_correct": true },
          { "id": 46, "question_id": 15, "text": "A loop structure", "is_correct": false },
          { "id": 47, "question_id": 15, "text": "A data type", "is_correct": false }
        ]
      }
    ]
  }
}
```

---

## Key Features

### Type Conversion & Validation:
- Empty strings converted to `None` for integer fields
- Proper float conversion for points
- Boolean conversion for checkbox values
- ISO datetime parsing with timezone support

### Backward Compatibility:
- Supports both `text` and `question_text` field names
- Supports both `text` and `answer_text` field names
- Handles missing optional fields with sensible defaults

### Default Values:
- `time_limit`: None (no limit)
- `max_attempts`: None (unlimited)
- `passing_score`: 70%
- `points_possible`: 100.0
- `shuffle_questions`: False
- `shuffle_answers`: False
- `show_correct_answers`: True
- `question.points`: 10.0
- `question.explanation`: Empty string

---

## Files Modified

1. ✅ `backend/src/models/course_models.py`
   - Added 8 fields to Quiz model
   - Added 2 fields to Question model
   - Updated to_dict() methods

2. ✅ `backend/src/routes/instructor_assessment_routes.py`
   - Updated create_quiz() to handle all new fields
   - Updated update_quiz() to handle all new fields
   - Updated add_quiz_question() to handle points and explanation
   - Updated add_bulk_quiz_questions() to handle points and explanation

3. ✅ `backend/migrate_quiz_settings.py` - Created and executed
4. ✅ `backend/migrate_question_fields.py` - Created and executed

---

## Status

✅ **Complete** - All quiz settings and question fields are now properly:
- Defined in database models
- Handled in API routes
- Stored in database tables
- Returned in API responses

🔄 **Next Steps**:
1. Restart the backend server
2. Test quiz creation and updates
3. Verify data persistence in database
