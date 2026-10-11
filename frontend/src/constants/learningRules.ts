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
