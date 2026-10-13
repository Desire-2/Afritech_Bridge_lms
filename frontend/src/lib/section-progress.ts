/**
 * Pure viewed-section state for the lesson player.
 *
 * Kept free of React so the rules that decide "has the student actually seen
 * this section?" are unit-testable with the repository's existing node:test
 * runner (see tests/section-progress.test.ts).
 *
 * Policy (documented, deliberate):
 *  - A section counts as viewed only after it has been continuously on
 *    screen for `MIN_SECTION_VIEW_MS`. Opening a lesson therefore never
 *    reports 100% instantly, and skipping through steps with the arrow keys
 *    does not mark sections as viewed.
 *  - Viewed state is keyed by the ordered list of stable section ids. If the
 *    content changes such that ids change, the viewed state resets — changed
 *    content must be re-viewed. State is never persisted per-section; only
 *    lesson-level aggregates reach the backend.
 */

export interface SectionViewState {
  /** Ordered stable section ids — the lesson's section signature. */
  sectionIds: string[];
  activeIndex: number;
  viewedIds: string[];
}

/** Minimum continuous on-screen time before a section counts as viewed. */
export const MIN_SECTION_VIEW_MS = 2000;

/** True once a section has dwelled on screen long enough to count as viewed. */
export function dwellViewed(elapsedMs: number): boolean {
  return Number.isFinite(elapsedMs) && elapsedMs >= MIN_SECTION_VIEW_MS;
}

/** Milliseconds of dwell still required before a section counts as viewed. */
export function dwellRemainingMs(elapsedMs: number): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return MIN_SECTION_VIEW_MS;
  return Math.max(0, MIN_SECTION_VIEW_MS - elapsedMs);
}

export function sectionSignatureOf(sectionIds: readonly string[]): string {
  return sectionIds.join('|');
}

export function initialSectionViewState(sectionIds: readonly string[]): SectionViewState {
  return { sectionIds: [...sectionIds], activeIndex: 0, viewedIds: [] };
}

/**
 * True when saved state still describes the same lesson sections. Anything
 * else (lesson change, content edit, reorder that changed ids) means the
 * state must be discarded rather than reused.
 */
export function stateMatchesSections(
  state: SectionViewState | null | undefined,
  sectionIds: readonly string[]
): state is SectionViewState {
  if (!state) return false;
  return sectionSignatureOf(state.sectionIds) === sectionSignatureOf(sectionIds);
}

/** Clamp the active step to a real section index. */
export function withActiveSection(state: SectionViewState, index: number): SectionViewState {
  const max = Math.max(0, state.sectionIds.length - 1);
  const activeIndex = Math.min(Math.max(0, index), max);
  if (activeIndex === state.activeIndex) return state;
  return { ...state, activeIndex };
}

/**
 * Mark a section as viewed. Idempotent: re-marking never changes state, so
 * duplicate React effects or repeated emissions cannot double-count.
 */
export function withViewedSection(state: SectionViewState, sectionId: string): SectionViewState {
  if (!state.sectionIds.includes(sectionId)) return state;
  if (state.viewedIds.includes(sectionId)) return state;
  return { ...state, viewedIds: [...state.viewedIds, sectionId] };
}

/** Mark the currently active section as viewed. */
export function withActiveViewed(state: SectionViewState): SectionViewState {
  const id = state.sectionIds[state.activeIndex];
  return id ? withViewedSection(state, id) : state;
}

export interface SectionCounts {
  viewed: number;
  total: number;
}

export function sectionCounts(state: SectionViewState): SectionCounts {
  const total = state.sectionIds.length;
  const viewed = state.viewedIds.filter((id) => state.sectionIds.includes(id)).length;
  return { viewed, total };
}

/** 0–100 share of sections actually viewed. 0 when there are no sections. */
export function sectionProgressPercent(state: SectionViewState): number {
  const { viewed, total } = sectionCounts(state);
  if (total <= 0) return 0;
  return (viewed / total) * 100;
}

/**
 * True only when every logical section has been viewed. Empty content can
 * never report completion.
 */
export function allSectionsViewed(state: SectionViewState): boolean {
  const { viewed, total } = sectionCounts(state);
  return total > 0 && viewed >= total;
}

/**
 * Clamp a monotonic "viewed" counter so an out-of-order or stale report can
 * never move progress backwards within the same section signature.
 */
export function mergeViewedCount(previous: number, next: number, total: number): number {
  if (!Number.isFinite(next) || next < 0) return previous;
  const bounded = Math.min(Math.floor(next), Math.max(0, total));
  return Math.max(Math.floor(previous) || 0, bounded);
}
