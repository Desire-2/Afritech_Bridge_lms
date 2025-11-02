# Quiz Update - Visual Implementation Guide

## 1. Backend Request Flow

```
┌────────────────────────────────────────────────┐
│ FRONTEND: User clicks "Update Quiz"            │
└──────────────┬─────────────────────────────────┘
               │
               ▼
┌────────────────────────────────────────────────┐
│ Frontend: validateQuizQuestions()              │
│ - Check required fields                        │
│ - Auto-fix missing correct answers             │
│ - Clear error state                            │
└──────────────┬─────────────────────────────────┘
               │
               ▼
┌────────────────────────────────────────────────┐
│ Backend: PUT /quizzes/3                        │
│ - Update: title, description, settings         │
│ - Response: { quiz: {...} }                    │
└──────────────┬─────────────────────────────────┘
               │
               ▼
┌────────────────────────────────────────────────┐
│ Frontend: For each question:                   │
│                                                │
│ If new:                                        │
│   POST /quizzes/3/questions                    │
│   Response: { question: {..., id, answers} }  │
│   Assign ID to question                       │
│                                                │
│ If existing & dirty:                          │
│   PUT /quizzes/3/questions/1                   │
│   Response: { question: {...} }               │
│   Update local state                          │
└──────────────┬─────────────────────────────────┘
               │
               ▼
┌────────────────────────────────────────────────┐
│ Frontend: POST /quizzes/3/questions/reorder    │
│ - Send: { order: [1, 2, 3] }                  │
│ - Backend accepts partial lists               │
│ - Response: { questions: [...] }              │
└──────────────┬─────────────────────────────────┘
               │
               ▼
┌────────────────────────────────────────────────┐
│ Frontend: await onAssessmentUpdate()           │
│                                                │
│ Parent component:                             │
│   GET /courses/7/overview                      │
│   include_questions=True ✓                     │
│   Response: {                                  │
│     quizzes: [{                                │
│       id: 3,                                   │
│       questions: [...]  ← KEY!                │
│     }]                                         │
│   }                                            │
│   setAssessments(response)                     │
│                                                │
│   ✓ Parent state updated                       │
│   ✓ Child component re-renders with new props  │
└──────────────┬─────────────────────────────────┘
               │
               ▼
┌────────────────────────────────────────────────┐
│ Frontend: Show success message                 │
│ - "Quiz updated successfully!"                 │
│ - Display question count                       │
│ - Wait 500ms                                   │
└──────────────┬─────────────────────────────────┘
               │
               ▼
┌────────────────────────────────────────────────┐
│ Frontend: Close form                           │
│ - setShowForm(false)                           │
│ - setEditingItem(null)                         │
│ - resetQuizForm()                              │
└──────────────┬─────────────────────────────────┘
               │
               ▼
┌────────────────────────────────────────────────┐
│ ✅ RESULT: Quiz list displays with questions  │
│    - Questions visible                        │
│    - Form closed                               │
│    - Data persisted                            │
└────────────────────────────────────────────────┘
```

## 2. State Management

```
AssessmentManagement Component State:
├─ editingItem: Quiz | null
├─ currentQuestions: QuizQuestionForm[]
├─ showForm: boolean
├─ successMessage: string | null
├─ errorMessage: string | null
└─ isLoading: boolean

Parent Component State:
├─ assessments: {
│  ├─ quizzes: Quiz[]
│  ├─ assignments: Assignment[]
│  └─ projects: Project[]
│}
├─ loading: boolean
└─ error: string | null

Form Display Flow:
1. showForm=false, editingItem=null
   └─ Quiz list visible
   
2. User clicks Edit
   └─ editingItem=quiz, currentQuestions=quiz.questions
   └─ showForm=true
   └─ Form appears with current data
   
3. User modifies and clicks Update
   └─ isLoading=true
   └─ API calls execute
   
4. Success
   └─ successMessage="Quiz updated successfully!"
   └─ onAssessmentUpdate() called
   └─ Parent fetches fresh data
   └─ Parent sets new assessments state
   └─ Component re-renders (new props)
   
5. After 500ms
   └─ showForm=false
   └─ editingItem=null
   └─ Form closes
   
6. After 4s
   └─ successMessage=null
   └─ Success banner disappears
   
Result: Quiz list now shows updated questions
```

## 3. Component Lifecycle

```
┌─────────────────────────────────────────────────────┐
│ Mount: AssessmentManagement Component               │
│                                                     │
│ Props:                                              │
│   course: Course ← From parent                      │
│   assessments: {...} ← From parent                  │
│   onAssessmentUpdate: () => Promise ← Callback      │
│                                                     │
│ useEffect([assessments]):                           │
│   console.log quiz count and questions              │
└─────────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────┐
│ Render: Quiz List                                   │
│                                                     │
│ filterAssessments(assessments?.quizzes)             │
│   .map(quiz => (                                    │
│     <QuizCard>                                      │
│       Title: {quiz.title}                           │
│       Questions: {quiz.questions?.length || 0}      │
│       Actions: Edit, Delete, etc.                   │
│     </QuizCard>                                     │
│   ))                                                │
└─────────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────┐
│ User Action: Click Edit Button                      │
│                                                     │
│ handleEditQuiz(quiz):                               │
│   setEditingItem(quiz)                              │
│   setCurrentQuestions(quiz.questions)               │
│   setShowForm(true)                                 │
│   → Form component mounts                           │
└─────────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────┐
│ Render: Quiz Edit Form                              │
│                                                     │
│ QuizForm:                                           │
│   Input: title, description, settings               │
│   QuestionBuilder:                                  │
│     - List current questions                        │
│     - Add new question                              │
│     - Edit existing question                        │
│     - Delete question                               │
│     - Reorder questions                             │
│                                                     │
│ Actions:                                            │
│   Save Button → handleUpdateQuiz()                  │
│   Cancel Button → closeForm()                       │
└─────────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────┐
│ User Action: Click Save/Update Button               │
│                                                     │
│ handleUpdateQuiz():                                 │
│   1. validateQuizQuestions()                        │
│   2. setIsLoading(true)                             │
│   3. await CourseCreationService.updateQuiz()       │
│   4. For each question:                             │
│      - Create or update via API                     │
│   5. await reorderQuestions()                       │
│   6. await onAssessmentUpdate()                     │
│      ↓ Parent starts fetching                       │
│   7. setShowForm(false) after 500ms                 │
│   8. setSuccessMessage(null) after 4s               │
└─────────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────┐
│ Parent Component: handleAssessmentUpdate()          │
│                                                     │
│ const handleAssessmentUpdate = async () => {        │
│   1. getAssessmentsOverview(courseId)               │
│      GET /courses/7/overview                        │
│   2. Receive:                                       │
│      { quizzes: [{...questions: [...]}] }           │
│   3. setAssessments(updatedAssessments)             │
│      ↓ State updated                                │
│      ↓ All children re-render with new props        │
│   4. Return (Promise resolved)                      │
│ }                                                   │
└─────────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────┐
│ Component Re-render: New Props                      │
│                                                     │
│ AssessmentManagement received new assessments:      │
│   assessments = { quizzes: [...with questions...] }  │
│                                                     │
│ useEffect([assessments]):                           │
│   Logs: "Quiz X has Y questions"                    │
│                                                     │
│ Form closes (setShowForm(false))                    │
│ Quiz list re-renders with new data                  │
│ Questions now visible ✅                             │
└─────────────────────────────────────────────────────┘
```

## 4. Question Creation/Update Cycle

```
For each question in currentQuestions:

Question has ID?  (Existing question)
│
├─ YES:
│  ├─ isDirty or order changed?
│  │  ├─ YES: PUT /quizzes/3/questions/1
│  │  │       Response: { question: {...} }
│  │  └─ NO: Skip API call (no changes)
│  │
│  └─ Add to resolvedQuestions with isDirty=false
│
└─ NO: (New question, no ID yet)
   ├─ POST /quizzes/3/questions
   │  ├─ Payload: {
   │  │   question_text: "...",
   │  │   question_type: "multiple_choice",
   │  │   answers: [{text, is_correct}, ...]
   │  │ }
   │  └─ Response: {
   │      question: {
   │        id: 1,  ← GET ID from response
   │        answers: [{id, ...}, ...]
   │      }
   │    }
   │
   └─ Add to resolvedQuestions with new ID and answers

After all questions processed:

resolvedQuestions now contains:
├─ Existing questions with ID
├─ Newly created questions with ID from response
└─ All questions ready for reordering

Reorder Step:
POST /quizzes/3/questions/reorder
{
  "order": [1, 2, 3, ...]  ← IDs in desired order
}
```

## 5. Error Recovery

```
Update Quiz Flow with Error Handling:

try {
  ├─ Quiz update
  ├─ Question creates/updates
  ├─ Reorder (wrapped in try-catch)
  │  ├─ If reorder fails:
  │  │  └─ Log warning, don't fail entire update
  │  └─ If reorder succeeds:
  │     └─ Continue
  │
  └─ onAssessmentUpdate() (wrapped in try-catch)
     ├─ If parent refresh fails:
     │  └─ Log warning, close form anyway
     └─ If parent refresh succeeds:
        └─ Continue
     
} catch (error) {
  └─ Set error message
  └─ Log full error details
  └─ Don't close form (let user see error)
}

finally {
  └─ setIsLoading(false)
```

## 6. Async/Await Sequence

```
Before (Race Condition):
┌──────────────────────────────┐
│ onAssessmentUpdate() called  │ (async)
│ Form closes immediately       │ ← Problem!
│ Parent fetch still pending    │
└──────────────────────────────┘

After (Proper Sequencing):
┌──────────────────────────────────────┐
│ await Promise.resolve(               │
│   onAssessmentUpdate()                │ (async function)
│ );                                     │
│                                        │
│ ← Waits for parent.fetch()             │
│ ← Waits for state update               │
│ ← Returns only after all done          │
│                                        │
│ setShowForm(false)                     │ (Now safe to close)
└──────────────────────────────────────┘

Execution Timeline:
T=0ms    onAssessmentUpdate() called
T=0ms    └─ getAssessmentsOverview() network request sent
T=100ms  └─ Response received from API
T=100ms  └─ setAssessments(response)
T=100ms  └─ Parent state updated
T=100ms  └─ Child component re-renders
T=100ms  └─ Callback returns
T=100ms  ← await completes
T=100ms  setShowForm(false)
T=500ms  ← setTimeout delay completes
T=500ms  Form actually closes
         Quiz list now shows with questions ✅
```

## 7. Props Flow

```
Parent Component State:
assessments = {
  quizzes: [
    {
      id: 3,
      title: "Web Dev Quiz",
      questions: [
        {
          id: 1,
          question_text: "What is HTML?",
          answers: [...]
        },
        {
          id: 2,
          question_text: "What is CSS?",
          answers: [...]
        }
      ]
    }
  ]
}

     ↓ Passed as prop

Child Component (AssessmentManagement):
props.assessments.quizzes.map(quiz => (
  <Quiz>
    {quiz.title}
    Questions: {quiz.questions?.length}
    {quiz.questions?.map(question => (
      <Question
        text={question.question_text}
        answers={question.answers}
      />
    ))}
  </Quiz>
))

When parent updates assessments state:
1. Parent re-renders with new props
2. AssessmentManagement receives new props
3. useEffect([assessments]) runs
4. Component logs updated data
5. JSX re-evaluates with new questions
6. UI updates to show questions ✅
```

## Testing Verification Points

```
✓ Open quiz editor
  └─ Verify form loads with current questions

✓ Modify quiz (title + questions)
  └─ Verify validation works

✓ Click Update
  └─ Backend logs show question count
  └─ Form shows success message
  └─ Browser console shows refresh logs

✓ Wait for form to close
  └─ Parent console shows "Assessments updated"
  └─ Quiz list visible with questions

✓ Verify questions persisted
  └─ Open quiz again
  └─ All questions still present
  └─ Answers intact

✓ Check browser Network tab
  └─ Final /overview response contains questions array
```
