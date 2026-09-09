/**
 * Thresholds mirrored from the backend learning rules.
 *
 * Lesson completion is deliberately stricter than module progression:
 * `LessonCompletionService` requires 80%, while module score/unlock APIs use
 * 70%. The UI should never silently substitute one for the other.
 */
export {
  LESSON_PASSING_THRESHOLD,
  LESSON_READING_PROGRESS_THRESHOLD,
  LESSON_ENGAGEMENT_THRESHOLD,
  MODULE_PASSING_THRESHOLD,
  DEFAULT_QUIZ_PASSING_THRESHOLD,
  ASSIGNMENT_PASSING_THRESHOLD,
} from '@/constants/learningRules';
