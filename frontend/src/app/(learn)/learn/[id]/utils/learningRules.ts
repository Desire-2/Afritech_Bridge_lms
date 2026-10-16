/**
 * Thresholds mirrored from the backend learning rules.
 *
 * Lesson completion is deliberately stricter than module progression:
 * `LessonCompletionService` requires 80%, while module score/unlock APIs use
 * 70%. The UI should never silently substitute one for the other.
 */
import {
  VIDEO_WATCH_COMPLETE_THRESHOLD,
} from '@/constants/learningRules';
import {
  normalizeLessonContent,
  videoCoverageIndices,
} from '@/lib/lesson-content';

export {
  LESSON_PASSING_THRESHOLD,
  LESSON_READING_PROGRESS_THRESHOLD,
  LESSON_ENGAGEMENT_THRESHOLD,
  MODULE_PASSING_THRESHOLD,
  DEFAULT_QUIZ_PASSING_THRESHOLD,
  ASSIGNMENT_PASSING_THRESHOLD,
  CERTIFICATE_PASSING_THRESHOLD,
  VIDEO_WATCH_COMPLETE_THRESHOLD,
  describeCertificateRequirement,
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

const clampPercent = (value: number): number =>
  Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;

export interface VideoWatchGateInput {
  contentType?: string | null;
  contentData?: string | null;
  /** Shared main-video coverage (0-100). */
  videoProgress: number;
  /** Backend-derived "every video reached the threshold" flag. */
  videoCompleted: boolean;
  /** Per-coverage-index watch percentage for index-based lessons. */
  mixedVideoProgress?: Record<number, number>;
}

export interface VideoWatchGate {
  /** The lesson actually contains playable video content. */
  hasVideoContent: boolean;
  /** True while any video in the lesson is still below the watch threshold. */
  hasUnwatchedVideo: boolean;
  /**
   * Honest 0-1 watch ratio: the AVERAGE across every video the content
   * declares (unwatched videos weigh zero), or the single main-video
   * coverage for content_type "video".
   */
  videoWatchRatio: number;
  /** Coverage indices of every video block, or null when not index-based. */
  videoCoverage: number[] | null;
}

/**
 * Single source of truth for "has this learner watched the lesson videos?".
 *
 * Section-view gating, engagement scoring, auto-completion, and the manual
 * completion button all derive from this one rule so they can never drift:
 * every video block must reach VIDEO_WATCH_COMPLETE_THRESHOLD (90% unique
 * coverage) before the lesson counts as watched. The backend re-derives the
 * same requirement server-side; this helper only feeds the live UI.
 */
export function videoWatchGate(input: VideoWatchGateInput): VideoWatchGate {
  const contentType = input.contentType ?? '';
  const videoProgress = clampPercent(input.videoProgress);

  if (contentType === 'video') {
    return {
      hasVideoContent: true,
      hasUnwatchedVideo: !(
        input.videoCompleted || videoProgress >= VIDEO_WATCH_COMPLETE_THRESHOLD
      ),
      videoWatchRatio: videoProgress / 100,
      videoCoverage: null,
    };
  }

  let videoCoverage: number[] | null = null;
  if (contentType === 'mixed' || contentType === 'text') {
    try {
      videoCoverage = videoCoverageIndices(
        normalizeLessonContent(input.contentData ?? '', contentType).sections
      );
    } catch {
      videoCoverage = null;
    }
  }

  if (videoCoverage && videoCoverage.length > 0) {
    const progress = input.mixedVideoProgress ?? {};
    const watchedRatio =
      videoCoverage.reduce(
        (sum, index) => sum + clampPercent(progress[index] ?? 0),
        0
      ) / (videoCoverage.length * 100);
    const hasUnwatchedVideo = videoCoverage.some(
      (index) => clampPercent(progress[index] ?? 0) < VIDEO_WATCH_COMPLETE_THRESHOLD
    );
    return {
      hasVideoContent: true,
      hasUnwatchedVideo,
      videoWatchRatio: watchedRatio,
      videoCoverage,
    };
  }

  // Video telemetry without parseable indices: fall back to the shared
  // coverage value plus the backend-derived completion flag.
  const hasVideoContent = videoProgress > 0 || input.videoCompleted;
  return {
    hasVideoContent,
    hasUnwatchedVideo:
      hasVideoContent &&
      !input.videoCompleted &&
      videoProgress < VIDEO_WATCH_COMPLETE_THRESHOLD,
    videoWatchRatio: videoProgress / 100,
    videoCoverage,
  };
}
