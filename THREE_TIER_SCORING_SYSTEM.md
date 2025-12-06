# Three-Tier Scoring System

## Overview

The LMS now implements a comprehensive three-tier scoring system that separates lesson, module, and course scores for clear progress tracking at each level.

## Scoring Tiers

### 1. Lesson Score (Individual Lesson Performance)

**Formula**: Average of 4 components, each weighted equally at 25%

```
Lesson Score = (Reading Progress × 25%) + 
               (Engagement Score × 25%) + 
               (Quiz Score × 25%) + 
               (Assignment Score × 25%)
```

**Components**:
- **Reading Progress**: Percentage of lesson content read/viewed
- **Engagement Score**: Interaction metrics (time spent, scrolling, clicks)
- **Quiz Score**: Best score from lesson-specific quizzes
- **Assignment Score**: Grade from lesson-specific assignments

**Score Range**: 0-100%

**Example**:
- Reading: 100% × 0.25 = 25%
- Engagement: 70% × 0.25 = 17.5%
- Quiz: 90% × 0.25 = 22.5%
- Assignment: 80% × 0.25 = 20%
- **Total Lesson Score**: 85%

---

### 2. Module Score (Overall Module Performance)

**Formula**: Simple average of all lesson scores in the module

```
Module Score = Sum of all Lesson Scores / Number of Lessons
```

**Purpose**: Represents the student's overall comprehension and performance across all lessons in a module, based purely on lesson quality.

**Score Range**: 0-100%

**Example** (3 lessons in module):
- Lesson 1: 85%
- Lesson 2: 90%
- Lesson 3: 78%
- **Module Score**: (85 + 90 + 78) / 3 = 84.33%

**Note**: This is different from the "Module Weighted Score" used for passing requirements.

---

### 3. Module Weighted Score (Passing Requirements)

**Formula**: Weighted average for determining if student can proceed

```
Weighted Score = (Module Score × 10%) + 
                 (Module Quizzes × 30%) + 
                 (Module Assignments × 40%) + 
                 (Final Assessment × 20%)
```

**Components**:
- **Module Score** (10%): Average of all lesson scores
- **Module Quizzes** (30%): Module-level quiz performance
- **Module Assignments** (40%): Module-level assignment grades
- **Final Assessment** (20%): Module final exam score

**Passing Threshold**: ≥80%

**Score Range**: 0-100%

**Purpose**: Determines if a student can unlock the next module.

**Example**:
- Module Score: 84.33% × 0.10 = 8.43%
- Quizzes: 88% × 0.30 = 26.4%
- Assignments: 92% × 0.40 = 36.8%
- Final: 85% × 0.20 = 17.0%
- **Weighted Score**: 88.63% (PASS ✓)

---

### 4. Course Score (Overall Course Performance)

**Formula**: Simple average of all module scores

```
Course Score = Sum of all Module Scores / Number of Modules
```

**Purpose**: Represents the student's overall performance across the entire course, based on lesson quality across all modules.

**Score Range**: 0-100%

**Example** (4 modules in course):
- Module 1: 84.33%
- Module 2: 88.50%
- Module 3: 91.20%
- Module 4: 86.75%
- **Course Score**: (84.33 + 88.50 + 91.20 + 86.75) / 4 = 87.70%

---

## API Response Structure

### Lesson Completion
```json
{
  "id": 1,
  "student_id": 5,
  "lesson_id": 10,
  "reading_progress": 100.0,
  "engagement_score": 70.0,
  "lesson_score": 67.5,
  "completed": true
}
```

### Module Progress
```json
{
  "id": 1,
  "student_id": 5,
  "module_id": 4,
  "module_score": 84.33,
  "weighted_score": 88.63,
  "course_contribution_score": 84.33,
  "quiz_score": 88.0,
  "assignment_score": 92.0,
  "final_assessment_score": 85.0,
  "status": "completed"
}
```

### Enrollment (Course)
```json
{
  "id": 3,
  "student_id": 5,
  "course_id": 2,
  "course_score": 87.70,
  "progress": 0.75,
  "completed_at": null
}
```

---

## Frontend Display

### Sidebar Module Badge
Shows: **Module Score** (0-100%)
- Represents pure lesson performance in that module
- Click to see detailed breakdown

### Module Score Breakdown Dialog
Shows:
- **Module Score**: Average of all lesson scores
- **Weighted Score**: Score used for passing (≥80%)
- Component breakdown with weights

### Course Dashboard
Shows: **Course Score** (0-100%)
- Overall performance across all modules
- Based on average of module scores

---

## Database Fields

### `lesson_completion` table
- `reading_progress` (Float)
- `engagement_score` (Float)
- Calculated: `lesson_score` (via method)

### `module_progress` table
- `course_contribution_score` (Float) - Stores module_score
- `quiz_score` (Float)
- `assignment_score` (Float)
- `final_assessment_score` (Float)
- `cumulative_score` (Float) - Stores weighted_score
- Calculated: `module_score`, `weighted_score` (via methods)

### `enrollments` table
- `progress` (Float) - Completion percentage
- Calculated: `course_score` (via method)

---

## Implementation Details

### Backend Models

**LessonCompletion.calculate_lesson_score()**
```python
def calculate_lesson_score(self):
    reading = self.reading_progress or 0.0
    engagement = self.engagement_score or 0.0
    quiz_score = # Get best quiz attempt score
    assignment_score = # Get best assignment grade
    
    return (reading * 0.25) + (engagement * 0.25) + 
           (quiz_score * 0.25) + (assignment_score * 0.25)
```

**ModuleProgress.calculate_module_score()**
```python
def calculate_module_score(self):
    total = 0.0
    count = 0
    for lesson in module.lessons:
        completion = get_completion(lesson)
        if completion:
            total += completion.calculate_lesson_score()
            count += 1
    return total / count if count > 0 else 0.0
```

**ModuleProgress.calculate_module_weighted_score()**
```python
def calculate_module_weighted_score(self):
    module_score = self.calculate_module_score()
    return (module_score * 0.10) + 
           (self.quiz_score * 0.30) + 
           (self.assignment_score * 0.40) + 
           (self.final_assessment_score * 0.20)
```

**Enrollment.calculate_course_score()**
```python
def calculate_course_score(self):
    total = 0.0
    count = 0
    for module in course.modules:
        progress = get_module_progress(module)
        if progress:
            total += progress.calculate_module_score()
            count += 1
    return total / count if count > 0 else 0.0
```

---

## Migration Notes

### Backwards Compatibility

The system maintains backwards compatibility through aliases:

- `lessons_average_score` → `module_score`
- `cumulative_score` → `weighted_score`

### Database Updates

No schema changes required. The scoring calculations happen on-the-fly and use existing fields for storage:

- `course_contribution_score` stores the module_score
- `cumulative_score` stores the weighted_score

---

## Benefits of Three-Tier System

1. **Granular Tracking**: Clear visibility at lesson, module, and course levels
2. **Fair Assessment**: Each lesson component contributes equally
3. **Comprehensive Evaluation**: Reading, engagement, quizzes, and assignments all matter
4. **Clear Progression**: Module weighted score determines advancement
5. **Overall Performance**: Course score shows big picture

---

## Usage Examples

### Student View
- **Lesson Page**: "Lesson Score: 85%" (read 100%, engaged 70%, quiz 90%, assignment 80%)
- **Module Sidebar**: "Module 1: 84%" (average of 3 lesson scores)
- **Course Dashboard**: "Course Score: 88%" (average of 4 module scores)

### Instructor View
- See which lessons students struggle with (low lesson scores)
- Identify modules needing improvement (low module scores)
- Track overall course effectiveness (course score trends)

---

## Future Enhancements

1. **Weighted Lesson Components**: Allow instructors to adjust the 25% weights
2. **Module Weight Customization**: Different weights for different module types
3. **Course Completion Certificate**: Require minimum course score
4. **Learning Analytics**: Identify patterns in lesson component performance
