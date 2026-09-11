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

export interface LessonScoreInputs {
  readingProgress: number;
  engagementScore: number;
  quizScore?: number;
  assignmentScore?: number;
  hasQuiz?: boolean;
  hasAssignment?: boolean;
}

/**
 * Keep the score shown by the learning UI consistent across the page,
 * progress hook, and score card. The backend remains the authority for
 * completion; this helper is only for the live/optimistic display.
 */
export const calculateLessonScore = ({
  readingProgress,
  engagementScore,
  quizScore = 0,
  assignmentScore = 0,
  hasQuiz = false,
  hasAssignment = false,
}: LessonScoreInputs): number => {
  let score = 0;

  if (hasQuiz && hasAssignment) {
    score = readingProgress * 0.25 + engagementScore * 0.25 + quizScore * 0.25 + assignmentScore * 0.25;
  } else if (hasQuiz) {
    score = readingProgress * 0.35 + engagementScore * 0.35 + quizScore * 0.3;
  } else if (hasAssignment) {
    score = readingProgress * 0.35 + engagementScore * 0.35 + assignmentScore * 0.3;
  } else {
    score = readingProgress * 0.5 + engagementScore * 0.5;
  }

  return Math.max(0, Math.min(100, score));
};
