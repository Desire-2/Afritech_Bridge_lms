import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  MIN_SECTION_VIEW_MS,
  allSectionsViewed,
  dwellViewed,
  initialSectionViewState,
  sectionCounts,
  sectionProgressPercent,
  stateMatchesSections,
  withActiveSection,
  withActiveViewed,
  type SectionViewState,
} from '@/lib/section-progress';
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  RotateCcw,
  Trophy,
} from 'lucide-react';

// Cap the segmented step rail so a pathological lesson cannot blow up the
// header layout; beyond it a continuous progress bar stands in. Extra steps
// stay reachable via Previous/Next and the step counter either way.
const MAX_RAIL_SEGMENTS = 80;

// Sparkle offsets (px) around the completion medallion — a small staggered
// twinkle that only renders when motion is allowed.
const MEDAL_SPARKLES = [
  { left: -16, top: 6, color: '#fcd34d' },
  { left: 26, top: -14, color: '#ffffff' },
  { left: 66, top: 10, color: '#7dd3fc' },
  { left: -10, top: 54, color: '#ffffff' },
  { left: 60, top: 58, color: '#fcd34d' },
];

// Never intercept arrow-key navigation while the user is interacting with a
// form control, link, button, or slider.
const INTERACTIVE_GUARD_SELECTOR =
  'input, textarea, select, button, a, [contenteditable=""], [contenteditable="true"], [role="slider"]';

// ── Cross-remount section-view store ───────────────────────────────────────
// Fullscreen toggles remount the content tree, which used to reset the
// learner's position and viewed state. The store keeps that state keyed by
// lesson so a remount resumes exactly where the learner left off. It is
// deliberately in-memory only: nothing per-section is ever sent to the
// server, and state is discarded when the section ids no longer match.
const sectionViewStateStore = new Map<string, SectionViewState>();

function loadSectionViewState(key: string | undefined): SectionViewState | undefined {
  if (!key) return undefined;
  return sectionViewStateStore.get(key);
}

function saveSectionViewState(key: string | undefined, state: SectionViewState): void {
  if (!key) return;
  sectionViewStateStore.set(key, state);
}

/** Drop persisted view state for a lesson (e.g. after it is completed). */
export function clearSectionViewState(key: string | undefined): void {
  if (key) sectionViewStateStore.delete(key);
}

// ── Types ─────────────────────────────────────────────────────────────

export interface StepSection {
  id: string;
  type: 'text' | 'video' | 'pdf' | 'image' | 'heading' | 'composite';
  heading?: string;
  content?: string;
  url?: string;
  alt?: string;
  level?: number;
  blocks?: unknown[];
  metadata?: Record<string, any>;
}

interface InteractiveStepThroughViewerProps {
  /** Sections to render step-by-step */
  sections: StepSection[];
  /** Total section count (may differ from sections.length if some are collapsed) */
  totalSteps: number;
  /** Stable lesson identity used to resume view state across remounts. */
  lessonKey?: string;
  /** Called when the user advances to a new section */
  onStepChange?: (stepIndex: number, total: number) => void;
  /** Called once, the first time every section counts as viewed */
  onAllSectionsViewed?: () => void;
  /** Called whenever the set of viewed sections changes */
  onViewedSectionsUpdate?: (viewedCount: number, total: number) => void;
  /** Render function for a single section — lets the parent decide how to render each type */
  renderSection: (
    section: StepSection,
    index: number,
    isActive: boolean,
  ) => React.ReactNode;
  /** Optional class name */
  className?: string;
  /** Optional custom button to show instead of "Review Again" on the last step */
  lastStepButton?: React.ReactNode;
}

// ── Component ─────────────────────────────────────────────────────────

export const InteractiveStepThroughViewer: React.FC<InteractiveStepThroughViewerProps> = ({
  sections,
  totalSteps,
  lessonKey,
  onStepChange,
  onAllSectionsViewed,
  onViewedSectionsUpdate,
  renderSection,
  className = '',
  lastStepButton,
}) => {
  // Stable ids are the section identity; array indices are never used as keys.
  const sectionIds = useMemo(() => sections.map((section) => section.id), [sections]);
  const sectionKey = sectionIds.join('|');
  const [state, setState] = useState<SectionViewState>(() => {
    const restored = loadSectionViewState(lessonKey);
    if (restored && stateMatchesSections(restored, sectionIds)) return restored;
    return initialSectionViewState(sectionIds);
  });
  // Direction for animation
  const [direction, setDirection] = useState(0); // 0 = initial, 1 = forward, -1 = backward
  // Has the completion celebration been dismissed?
  const [celebrationDismissed, setCelebrationDismissed] = useState(false);
  const celebratedRef = useRef(false);
  const prefersReducedMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset step state when a different lesson/content shape is rendered into
  // this component instance (restoring persisted state when it still applies).
  useEffect(() => {
    const restored = loadSectionViewState(lessonKey);
    setState(restored && stateMatchesSections(restored, sectionIds)
      ? restored
      : initialSectionViewState(sectionIds));
    setDirection(0);
    setCelebrationDismissed(false);
    celebratedRef.current = false;
  }, [sectionKey, totalSteps, lessonKey]);

  // Persist across remounts (fullscreen toggle unmounts the content tree).
  useEffect(() => {
    saveSectionViewState(lessonKey, state);
  }, [lessonKey, state]);

  const stepIndex = Math.min(state.activeIndex, Math.max(0, sectionIds.length - 1));

  // Heading-only steps (a header with no body) render as a section opener
  // instead of an empty panel: they preview the headings that follow, so the
  // "divider" still tells the learner what is coming.
  const currentStep = sections[stepIndex];
  const isDividerStep =
    !!currentStep &&
    (currentStep.blocks?.length ?? 0) === 0 &&
    !currentStep.url &&
    !currentStep.content?.trim();
  const upcomingHeadings = useMemo(() => {
    const list: string[] = [];
    for (let i = stepIndex + 1; i < sections.length; i += 1) {
      const heading = sections[i].heading;
      if (heading) list.push(heading);
    }
    return list;
  }, [sections, stepIndex]);

  // Dwell: a section only counts as viewed after it has been continuously on
  // screen for MIN_SECTION_VIEW_MS, so opening a lesson or arrow-keying
  // through steps never marks sections as viewed.
  useEffect(() => {
    const sectionId = sectionIds[stepIndex];
    if (!sectionId) return undefined;
    const timer = window.setTimeout(() => {
      if (!dwellViewed(MIN_SECTION_VIEW_MS)) return;
      setState((previous) => withActiveViewed(previous));
    }, MIN_SECTION_VIEW_MS);
    return () => window.clearTimeout(timer);
  }, [sectionKey, sectionIds, stepIndex]);

  const goToStep = useCallback((step: number) => {
    setDirection(step > stepIndex ? 1 : -1);
    setState((previous) => withActiveSection(previous, step));
  }, [stepIndex]);

  const goNext = useCallback(() => {
    if (stepIndex < totalSteps - 1) {
      goToStep(stepIndex + 1);
    }
  }, [stepIndex, totalSteps, goToStep]);

  const goPrev = useCallback(() => {
    // Stepping back from the completion celebration returns to the content
    // (the celebration stands in for the final section once it is showing).
    if (allSectionsViewed(state) && !celebrationDismissed) {
      setCelebrationDismissed(true);
    }
    if (stepIndex > 0) {
      goToStep(stepIndex - 1);
    }
  }, [stepIndex, goToStep, state, celebrationDismissed]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture if the user is typing or interacting with a control
      if (e.target instanceof Element) {
        if (e.target.closest(INTERACTIVE_GUARD_SELECTOR)) return;
        if (e.target instanceof HTMLElement && e.target.isContentEditable) return;
      }

      // Forward progress is Next-button only; the left/up arrows still step
      // back so a learner can re-read without skipping ahead.
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        goPrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goPrev]);

  // Report viewed progress upward (never a synthetic all-viewed burst).
  const counts = sectionCounts(state);
  const viewedPercent = sectionProgressPercent(state);
  const finished = allSectionsViewed(state);
  const reportedRef = useRef({ viewed: -1, total: -1 });
  useEffect(() => {
    if (reportedRef.current.viewed === counts.viewed && reportedRef.current.total === counts.total) return;
    reportedRef.current = { viewed: counts.viewed, total: counts.total };
    onViewedSectionsUpdate?.(counts.viewed, totalSteps);
  }, [counts.viewed, counts.total, totalSteps, onViewedSectionsUpdate]);

  useEffect(() => {
    onStepChange?.(stepIndex, totalSteps);
  }, [stepIndex, totalSteps, onStepChange]);

  useEffect(() => {
    if (!finished || celebratedRef.current) return;
    celebratedRef.current = true;
    onAllSectionsViewed?.();
  }, [finished, onAllSectionsViewed]);

  const showCompletionCelebration = finished && !celebrationDismissed;

  // ── Confetti particles for celebration ──
  // Random offsets are memoized once per celebration so re-renders never
  // re-bake new Math.random() values into the motion keyframes.
  const confettiParticles = useMemo(() => {
    if (!showCompletionCelebration || celebrationDismissed || prefersReducedMotion) return [];
    const colors = ['#10b981', '#3b82f6', '#38bdf8', '#f59e0b', '#f43f5e', '#a78bfa', '#fbbf24'];
    return Array.from({ length: 42 }, (_, i) => ({
      id: i,
      // 0 = circle, 1 = square, 2 = streamer — three flat shapes keep the
      // burst festive without any glow or gradient tricks.
      shape: i % 3,
      color: colors[i % colors.length],
      x: Math.random() * 100,
      delay: Math.random() * 0.6,
      size: 4 + Math.random() * 7,
      rotation: Math.random() * 360,
      duration: 1.6 + Math.random() * 2,
      drift: (i % 2 === 0 ? 1 : -1) * (20 + Math.random() * 40),
    }));
  }, [showCompletionCelebration, celebrationDismissed, prefersReducedMotion]);

  return (
    <div className={`space-y-4 ${className}`} ref={containerRef}>
      {/* ── Step toolbar + segmented rail ── */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-gray-400">
            <span className="font-semibold tabular-nums text-white">Step {stepIndex + 1}</span>
            <span className="text-gray-600"> / </span>
            <span className="tabular-nums">{totalSteps}</span>
          </p>

          <div className="flex items-center gap-3">
            {counts.viewed > 0 && (
              <span className="hidden items-center gap-1.5 text-xs font-medium text-emerald-300/90 sm:inline-flex">
                <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" />
                {counts.viewed} of {totalSteps} viewed
              </span>
            )}

            {/* Step count badge (mobile) */}
            <Badge
              variant="outline"
              className="border-white/10 bg-white/[0.03] px-2 py-0.5 text-xs text-gray-400 tabular-nums sm:hidden"
            >
              {stepIndex + 1}/{totalSteps}
            </Badge>
          </div>
        </div>

        {/* Segmented rail — one segment per step, non-interactive. Forward
            progress is driven by the Next button only; the rail simply shows
            where you are and what you have already viewed. */}
        {totalSteps <= MAX_RAIL_SEGMENTS ? (
          <div className="flex gap-[3px]" aria-hidden="true">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <span
                key={i}
                className={`h-1.5 min-w-0 flex-1 rounded-full transition-colors duration-300 ${
                  i === stepIndex
                    ? 'bg-blue-500'
                    : state.viewedIds.includes(sectionIds[i])
                    ? 'bg-emerald-500/50'
                    : 'bg-white/10'
                }`}
              />
            ))}
          </div>
        ) : (
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
            <div
              className="h-full rounded-full bg-blue-500 transition-[width] duration-500 ease-out"
              style={{ width: `${viewedPercent}%` }}
            />
          </div>
        )}
      </div>

      {/* ── Current Section Workspace (hidden while the celebration stands in) ── */}
      {!showCompletionCelebration && (
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={stepIndex}
          custom={direction}
          initial={{ opacity: 0, x: prefersReducedMotion ? 0 : direction > 0 ? 24 : -24 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          exit={{ opacity: 0, x: prefersReducedMotion ? 0 : direction > 0 ? -24 : 24 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.3, ease: [0.25, 0.1, 0.25, 1] }}
          className="min-h-[200px]"
        >
          {sections[stepIndex] ? (
            // One section = one study page. The header, body and navigation
            // live inside a single panel so a "section" always reads as one
            // cohesive unit; the Next button in the footer is what advances to
            // the next header+body pair. Video sections use the same shell with
            // the player as the body.
            <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-gray-900 shadow-[0_24px_48px_-32px_rgba(0,0,0,0.9)]">
              {/* Accent hairline — the one brand signature on the page */}
              <div
                className="h-px bg-gradient-to-r from-blue-500 via-blue-400/30 to-transparent"
                aria-hidden="true"
              />

              {sections[stepIndex].heading && (
                <div className="flex items-center gap-3.5 border-b border-white/[0.05] px-5 pb-4 pt-5 sm:px-7">
                  <span
                    className="h-8 w-1 shrink-0 rounded-full bg-blue-500"
                    aria-hidden="true"
                  />
                  <h3 className="min-w-0 flex-1 text-lg font-semibold tracking-tight text-white sm:text-xl">
                    {sections[stepIndex].heading}
                  </h3>
                </div>
              )}

              {/* Workspace body — the section's content */}
              <div className="px-5 py-6 sm:px-7 sm:py-7">
                {isDividerStep ? (
                  <div className="flex min-h-[240px] flex-col items-center justify-center gap-4 text-center">
                    <span
                      className="h-9 w-px bg-gradient-to-b from-blue-500/70 to-transparent"
                      aria-hidden="true"
                    />
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-300/85">
                      {upcomingHeadings.length > 0 ? 'Coming up next' : 'Section overview'}
                    </span>
                    {upcomingHeadings.length > 0 ? (
                      <ul className="flex max-w-md flex-col gap-2.5">
                        {upcomingHeadings.slice(0, 4).map((heading, i) => (
                          <li
                            key={`${i}:${heading}`}
                            className="flex items-center gap-2.5 text-sm text-gray-300"
                          >
                            <span
                              className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400/75"
                              aria-hidden="true"
                            />
                            {heading}
                          </li>
                        ))}
                        {upcomingHeadings.length > 4 && (
                          <li className="text-xs text-gray-500">
                            +{upcomingHeadings.length - 4} more steps
                          </li>
                        )}
                      </ul>
                    ) : (
                      <p className="max-w-sm text-sm leading-relaxed text-gray-500">
                        No content was added under this heading.
                      </p>
                    )}
                  </div>
                ) : (
                  renderSection(sections[stepIndex], stepIndex, true)
                )}
              </div>

              {/* Footer navigation lives inside the panel so controls and
                  content always read as one unit. */}
              {!showCompletionCelebration && (
                <div className="flex items-center justify-between gap-3 border-t border-white/[0.05] bg-white/[0.02] px-4 py-3 sm:px-5">
                  <Button
                    variant="ghost"
                    onClick={goPrev}
                    disabled={stepIndex === 0}
                    className="h-9 shrink-0 border border-white/10 bg-transparent px-3 text-gray-300 hover:bg-white/[0.06] hover:text-white disabled:opacity-30"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span className="hidden sm:inline">Previous</span>
                  </Button>

                  {/* Section completion indicator */}
                  <div className="hidden items-center gap-2 sm:flex">
                    {state.viewedIds.includes(sectionIds[stepIndex]) && (
                      <motion.span
                        initial={{ scale: prefersReducedMotion ? 1 : 0 }}
                        animate={{ scale: 1 }}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-300/90"
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                        Viewed
                      </motion.span>
                    )}
                  </div>

                  {stepIndex < totalSteps - 1 ? (
                    <Button
                      onClick={goNext}
                      className="h-9 shrink-0 bg-blue-600 px-4 text-white shadow-sm shadow-blue-950/40 hover:bg-blue-500 sm:px-5"
                    >
                      <span>Next Step</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  ) : lastStepButton ? (
                    lastStepButton
                  ) : (
                    <Button
                      onClick={goPrev}
                      className="h-9 shrink-0 bg-emerald-600 px-4 text-white shadow-sm shadow-emerald-950/40 hover:bg-emerald-500 sm:px-5"
                    >
                      <RotateCcw className="h-4 w-4" />
                      <span className="hidden sm:inline">Review Again</span>
                      <span className="sm:hidden">Review</span>
                    </Button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No lesson content is available.</p>
          )}
        </motion.div>
      </AnimatePresence>
      )}

      {/* ── Completion Celebration — stands in as the final section once
          every section has been viewed ── */}
      {showCompletionCelebration ? (
        <motion.div
          initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-gray-900 px-6 py-9 text-center sm:py-11"
        >
          {/* Completion hairline — the workspace signature, earned */}
          <div
            className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-emerald-500 via-emerald-400/40 to-transparent"
            aria-hidden="true"
          />

          {/* Confetti particles */}
          {confettiParticles.map((particle) => (
            <motion.div
              key={particle.id}
              className="absolute pointer-events-none"
              style={{
                left: `${particle.x}%`,
                top: '-10%',
                width: particle.shape === 2 ? 3 : particle.size,
                height:
                  particle.shape === 2
                    ? Math.round(particle.size * 1.8)
                    : particle.size,
                backgroundColor: particle.color,
                borderRadius: particle.shape === 1 ? '1px' : '999px',
                rotate: particle.rotation,
              }}
              initial={{ y: -20, opacity: 0, rotate: 0 }}
              animate={{
                y: ['0vh', '110vh'],
                opacity: [1, 0.85, 0.5, 0],
                rotate: [0, particle.rotation * 2],
                x: [0, particle.drift],
              }}
              transition={{
                duration: particle.duration,
                delay: particle.delay,
                ease: 'easeIn',
                repeat: Infinity,
                repeatDelay: particle.duration * 0.45,
              }}
            />
          ))}

          <div className="relative z-10 flex flex-col items-center">
            {/* Trophy medallion with staggered sparkle burst */}
            <div className="relative mb-5">
              <motion.div
                initial={{ scale: prefersReducedMotion ? 1 : 0, rotate: prefersReducedMotion ? 0 : -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 200, damping: 14, delay: 0.1 }}
                className="relative flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 shadow-lg shadow-emerald-950/50 ring-4 ring-emerald-500/20"
              >
                <Trophy className="h-8 w-8 text-white" aria-hidden="true" />
                <span
                  className="pointer-events-none absolute -inset-2.5 rounded-full border border-emerald-500/25"
                  aria-hidden="true"
                />
              </motion.div>
              {!prefersReducedMotion &&
                MEDAL_SPARKLES.map((sparkle, i) => (
                  <motion.span
                    key={i}
                    aria-hidden="true"
                    className="absolute h-1.5 w-1.5 rounded-full"
                    style={{
                      left: sparkle.left,
                      top: sparkle.top,
                      backgroundColor: sparkle.color,
                    }}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: [0, 1, 0.7, 1], opacity: [0, 1, 0.7, 0] }}
                    transition={{
                      duration: 1.8,
                      delay: 0.35 + i * 0.12,
                      repeat: Infinity,
                      repeatDelay: 1.6,
                      ease: 'easeOut',
                    }}
                  />
                ))}
            </div>

            <motion.h3
              initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="mb-3 text-xl font-bold tracking-tight text-white sm:text-2xl"
            >
              All sections complete
            </motion.h3>

            {/* Achievement chips */}
            <motion.div
              initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="mb-4 flex flex-wrap items-center justify-center gap-2"
            >
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
                <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" />
                {counts.viewed} of {totalSteps} sections
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-medium tabular-nums text-emerald-300">
                {viewedPercent}% viewed
              </span>
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="mb-6 max-w-md text-sm leading-relaxed text-gray-400"
            >
              Lesson completion may still require engagement or assessment checks.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              className="flex flex-wrap items-center justify-center gap-3"
            >
              <Button
                onClick={() => {
                  goToStep(0);
                  setCelebrationDismissed(true);
                }}
                className="h-10 border border-white/10 bg-transparent text-gray-300 shadow-none hover:bg-white/[0.06] hover:text-white"
              >
                <RotateCcw className="h-4 w-4" />
                Review from start
              </Button>
              <Button
                onClick={() => setCelebrationDismissed(true)}
                className="h-10 bg-emerald-600 px-5 text-white shadow-sm shadow-emerald-950/40 hover:bg-emerald-500"
              >
                <CheckCircle className="h-4 w-4" />
                Continue
              </Button>
              {lastStepButton && (
                <motion.div
                  onClick={() => {
                    // Dismiss the celebration first so the parent can render normally
                    setCelebrationDismissed(true);
                  }}
                  animate={{ scale: [1, 1.04, 1] }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                  whileHover={{ scale: 1.06 }}
                >
                  {lastStepButton}
                </motion.div>
              )}
            </motion.div>
          </div>
        </motion.div>
      ) : (
        /* ── Keyboard hint (navigation lives in the panel footer above) ── */
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-gray-500">
          <span>
            Click <span className="font-medium text-gray-400">Next</span> to continue
          </span>
          <span className="text-gray-700">·</span>
          <kbd className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[11px] text-gray-400">
            ←
          </kbd>
          <kbd className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[11px] text-gray-400">
            ↑
          </kbd>
          <span>to go back</span>
        </div>
      )}
    </div>
  );
};

export default InteractiveStepThroughViewer;
