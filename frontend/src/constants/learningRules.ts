/** Thresholds mirrored from the backend learning rules. */
export const LESSON_PASSING_THRESHOLD = 80;
export const LESSON_READING_PROGRESS_THRESHOLD = 90;
export const LESSON_ENGAGEMENT_THRESHOLD = 60;
export const MODULE_PASSING_THRESHOLD = 70;
export const DEFAULT_QUIZ_PASSING_THRESHOLD = 70;
export const ASSIGNMENT_PASSING_THRESHOLD = 60;
/**
 * Canonical certificate threshold: the overall course score required for
 * certificate issuance. Mirrors backend
 * `CertificateService.CERTIFICATE_PASSING_THRESHOLD`. Distinct from lesson
 * (80), quiz (70) and assignment (60) thresholds.
 */
export const CERTIFICATE_PASSING_THRESHOLD = 70;
/**
 * Fraction of a video that must actually be watched (unique coverage, not
 * playback position) before the video counts as complete. Mirrors the
 * backend `LessonCompletion.video_completed` rule (90%+ threshold).
 */
export const VIDEO_WATCH_COMPLETE_THRESHOLD = 90;

/**
 * Human-readable label for a certificate eligibility `missing_requirements`
 * code returned by the backend (Rules A/B/C). Kept here so every surface
 * (learning player, transcript, gallery) explains blocked certificates the
 * same way. The backend remains authoritative for eligibility itself.
 */
export function describeCertificateRequirement(
  code: string,
  requiredScore: number = CERTIFICATE_PASSING_THRESHOLD
): string {
  switch (code) {
    case 'all_modules_completed':
      return 'Not all modules are complete';
    case 'all_lessons_completed':
      return 'Not all lessons are completed';
    case 'overall_score':
      return `Overall score below ${requiredScore}%`;
    case 'final_assessment':
      return `Final assessment not passed (at least ${requiredScore}% required)`;
    case 'enrollment':
      return 'Not enrolled in this course';
    case 'course':
      return 'Course not found';
    default:
      return code;
  }
}
