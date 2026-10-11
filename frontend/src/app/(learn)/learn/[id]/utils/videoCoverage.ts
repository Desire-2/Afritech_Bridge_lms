/**
 * Unique-coverage tracking for lesson videos.
 *
 * Playback position (`currentTime / duration`) is NOT a valid engagement
 * metric: a student who seeks straight to the end would receive full credit
 * for content they never watched, and rewatching the same segment would
 * inflate a naive "watched seconds" counter. This module tracks which
 * discrete time buckets of the video have actually been observed while the
 * player was advancing normally, and reports the union of those buckets as
 * the watched percentage.
 *
 * Design constraints:
 * - Pure TypeScript, no React/DOM dependencies (unit-testable in Node).
 * - Coverage is monotonically non-decreasing for the lifetime of one
 *   tracker instance (a lesson visit). Restored progress from the backend is
 *   seeded as a floor so a remount can never regress previously persisted
 *   engagement.
 * - Seeking (large forward/backward jumps) updates the resume position but
 *   credits no coverage for the skipped interval.
 * - Rewatching an already-covered interval does not increase coverage.
 */

export interface VideoCoverageSnapshot {
  /** Unique watched percentage (0-100), monotonic. */
  coveragePct: number;
  /** Last observed playback position in seconds (resume point). */
  positionSec: number;
  /** Total duration in seconds (0 while unknown). */
  durationSec: number;
}

const DEFAULT_BUCKET_SEC = 2;
/** Playback jumps larger than this are treated as seeks, not watching. */
export const DEFAULT_SEEK_THRESHOLD_SEC = 5;

export class VideoCoverageTracker {
  private buckets: Uint8Array;
  private bucketSec: number;
  private bucketCount: number;
  private duration = 0;
  private baseCoveragePct: number;
  private lastTime: number | null = null;
  private position = 0;
  private seekThresholdSec: number;

  constructor(options?: {
    /** Persisted coverage from a previous session (0-100). Floors the result. */
    baseCoveragePct?: number;
    /** Granularity of the watched-interval buckets in seconds. */
    bucketSec?: number;
    /** Maximum forward jump still considered continuous watching. */
    seekThresholdSec?: number;
  }) {
    this.baseCoveragePct = clampPct(options?.baseCoveragePct ?? 0);
    this.bucketSec = Math.max(1, options?.bucketSec ?? DEFAULT_BUCKET_SEC);
    this.seekThresholdSec = Math.max(
      1,
      options?.seekThresholdSec ?? DEFAULT_SEEK_THRESHOLD_SEC,
    );
    // 12 hours of 2-second buckets is ample for any lesson video while
    // bounding memory (~21k bytes).
    this.bucketCount = Math.ceil((12 * 3600) / this.bucketSec);
    this.buckets = new Uint8Array(this.bucketCount);
  }

  /** Provide the real duration once the player reports it. Idempotent. */
  setDuration(durationSec: number): void {
    if (!Number.isFinite(durationSec) || durationSec <= 0) return;
    this.duration = durationSec;
  }

  /**
   * Raise the persisted-coverage floor (e.g. when a backend snapshot loads
   * after mount). Never lowers the base and never clears observed buckets,
   * so live watching already ahead of the snapshot is preserved.
   */
  raiseBase(pct: number): void {
    this.baseCoveragePct = Math.max(this.baseCoveragePct, clampPct(pct));
  }

  getDuration(): number {
    return this.duration;
  }

  /**
   * Record a playback observation.
   *
   * - The first observation only establishes the anchor (plus, when the
   *   position is within the seek threshold of 0, credits the small lead-in).
   * - Small forward deltas (normal playback) mark the covered interval.
   * - Larger deltas or backwards jumps are seeks: the gap is NOT covered.
   */
  observe(timeSec: number): void {
    if (!Number.isFinite(timeSec) || timeSec < 0) return;
    // Clamp pathological positions (live streams, broken telemetry).
    const maxPos = this.duration > 0 ? this.duration : timeSec;
    const time = Math.min(timeSec, maxPos);
    this.position = time;

    if (this.lastTime === null) {
      this.lastTime = time;
      // A tiny lead-in from 0 counts (players often start at 0.1-1s).
      if (time > 0 && time <= this.seekThresholdSec) {
        this.markRange(0, time);
      }
      return;
    }

    const delta = time - this.lastTime;
    if (delta > 0 && delta <= this.seekThresholdSec) {
      this.markRange(this.lastTime, time);
    }
    // delta <= 0 (rewind/loop) or delta > threshold (seek): no credit.
    this.lastTime = time;
  }

  /**
   * Unique watched coverage (0-100). Never decreases; never below the
   * restored base; never above 100.
   */
  get coveragePct(): number {
    if (this.duration <= 0) return this.baseCoveragePct;
    let coveredSec = 0;
    const bucketSec = this.bucketSec;
    const usable = Math.min(
      this.bucketCount,
      Math.ceil(this.duration / bucketSec),
    );
    for (let i = 0; i < usable; i++) {
      if (this.buckets[i]) {
        // The final partial bucket only counts its real share of the duration.
        const start = i * bucketSec;
        const end = Math.min(start + bucketSec, this.duration);
        coveredSec += end - start;
      }
    }
    const unionPct = (coveredSec / this.duration) * 100;
    return clampPct(Math.max(this.baseCoveragePct, unionPct));
  }

  /** Last observed playback position (for resume), in seconds. */
  get positionSec(): number {
    return this.position;
  }

  /** True once unique coverage reaches the completion threshold. */
  isComplete(thresholdPct: number): boolean {
    return this.coveragePct >= thresholdPct;
  }

  snapshot(): VideoCoverageSnapshot {
    return {
      coveragePct: this.coveragePct,
      positionSec: this.position,
      durationSec: this.duration,
    };
  }

  private markRange(fromSec: number, toSec: number): void {
    if (this.duration <= 0) return;
    const start = Math.max(0, Math.floor(fromSec / this.bucketSec));
    const end = Math.min(
      this.bucketCount - 1,
      Math.floor((Math.min(toSec, this.duration) - 1e-6) / this.bucketSec),
    );
    for (let i = start; i <= end; i++) {
      this.buckets[i] = 1;
    }
  }
}

function clampPct(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}
