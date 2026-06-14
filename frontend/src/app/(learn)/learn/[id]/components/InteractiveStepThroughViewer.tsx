import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Target,
  CheckCircle,
  Play,
  FileText,
  Video,
  Image,
  Sparkles,
  ArrowRight,
  RotateCcw,
  Trophy,
  Star,
  Award
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────

export interface StepSection {
  id: string;
  type: 'text' | 'video' | 'pdf' | 'image' | 'heading';
  heading?: string;
  content?: string;
  url?: string;
  alt?: string;
  level?: number;
  metadata?: Record<string, any>;
}

interface InteractiveStepThroughViewerProps {
  /** Sections to render step-by-step */
  sections: StepSection[];
  /** Total section count (may differ from sections.length if some are collapsed) */
  totalSteps: number;
  /** Called when the user advances to a new section */
  onStepChange?: (stepIndex: number, total: number) => void;
  /** Called when all sections have been viewed */
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
  onStepChange,
  onAllSectionsViewed,
  onViewedSectionsUpdate,
  renderSection,
  className = '',
  lastStepButton,
}) => {
  // Current active step
  const [activeStep, setActiveStep] = useState(0);
  // Set of viewed/completed section indices
  const [viewedSections, setViewedSections] = useState<Set<number>>(new Set([0]));
  // Direction for animation
  const [direction, setDirection] = useState(0); // 0 = initial, 1 = forward, -1 = backward
  // Show completion celebration when all sections viewed
  const [showCompletionCelebration, setShowCompletionCelebration] = useState(false);
  // Has the celebration been dismissed?
  const [celebrationDismissed, setCelebrationDismissed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Mark section as viewed when active step changes
  useEffect(() => {
    setViewedSections(prev => {
      const updated = new Set(prev);
      updated.add(activeStep);
      return updated;
    });
    onStepChange?.(activeStep, totalSteps);

    // Notify parent of viewed sections count
    // We use the old viewedSections + 1 (current activeStep being added)
    onViewedSectionsUpdate?.(viewedSections.size + 1, totalSteps);

    // Check if all sections viewed
    // viewedSections still has the old value here (state update not yet applied),
    // so we check if it already has all-but-one (the current activeStep is about to be added)
    const allViewed = viewedSections.size >= totalSteps - 1;
    if (allViewed) {
      setShowCompletionCelebration(true);
      onAllSectionsViewed?.();
    }
  }, [activeStep]); // eslint-disable-line react-hooks/exhaustive-deps

  const goToStep = useCallback((step: number) => {
    setDirection(step > activeStep ? 1 : -1);
    setActiveStep(step);
  }, [activeStep]);

  const goNext = useCallback(() => {
    if (activeStep < totalSteps - 1) {
      goToStep(activeStep + 1);
    }
  }, [activeStep, totalSteps, goToStep]);

  const goPrev = useCallback(() => {
    if (activeStep > 0) {
      goToStep(activeStep - 1);
    }
  }, [activeStep, goToStep]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        goPrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goNext, goPrev]);

  const progressPercent = totalSteps > 0 ? ((activeStep + 1) / totalSteps) * 100 : 0;

  // ── Confetti particles for celebration ──
  const confettiParticles = useMemo(() => {
    if (!showCompletionCelebration || celebrationDismissed) return [];
    const colors = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#3b82f6'];
    return Array.from({ length: 30 }, (_, i) => ({
      id: i,
      color: colors[i % colors.length],
      x: Math.random() * 100,
      delay: Math.random() * 0.5,
      size: 4 + Math.random() * 8,
      rotation: Math.random() * 360,
      duration: 1.5 + Math.random() * 2,
    }));
  }, [showCompletionCelebration, celebrationDismissed]);

  return (
    <div className={`space-y-4 ${className}`} ref={containerRef}>
      {/* ── Progress Header ── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-blue-500/30 flex items-center justify-center shrink-0">
            <BookOpen className="h-4 w-4 text-blue-400" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-300 leading-tight">
              Step {activeStep + 1} of {totalSteps}
            </p>
            <p className="text-[10px] text-gray-500 leading-tight mt-0.5">
              {Math.round(progressPercent)}% complete
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Step dots */}
          <div className="hidden sm:flex items-center gap-1">
            {Array.from({ length: Math.min(totalSteps, 20) }).map((_, i) => (
              <button
                key={i}
                onClick={() => goToStep(i)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === activeStep
                    ? 'w-5 bg-blue-400 shadow-sm shadow-blue-500/30'
                    : viewedSections.has(i)
                    ? 'w-2 bg-emerald-500/60 hover:bg-emerald-400'
                    : 'w-2 bg-gray-700 hover:bg-gray-600'
                }`}
                aria-label={`Go to section ${i + 1}`}
              />
            ))}
          </div>

          {/* Step count badge (mobile) */}
          <Badge variant="outline" className="sm:hidden text-[10px] border-gray-700 text-gray-400 px-2">
            {activeStep + 1}/{totalSteps}
          </Badge>
        </div>
      </div>

      {/* ── Progress Bar ── */}
      <div className="relative h-1.5 rounded-full bg-gray-800/70 overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"
          initial={{ width: '0%' }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
        {/* Glow */}
        <div
          className="absolute top-0 bottom-0 w-12 blur-md opacity-40"
          style={{
            left: `${progressPercent}%`,
            transform: 'translateX(-50%)',
            background: 'linear-gradient(90deg, transparent, #6366f1, transparent)',
          }}
        />
      </div>

      {/* ── Current Section Content ── */}
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={activeStep}
          custom={direction}
          initial={{ opacity: 0, x: direction > 0 ? 40 : -40, y: 8 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          exit={{ opacity: 0, x: direction > 0 ? -40 : 40, y: -8 }}
          transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
          className="min-h-[200px]"
        >
          {/* Section index badge */}
          {sections[activeStep]?.heading && (
            <div className="flex items-center gap-2 mb-4">
              <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-blue-500/15 text-blue-400 text-[10px] font-bold ring-1 ring-blue-500/30">
                {activeStep + 1}
              </span>
              <h3 className="text-base font-semibold text-white">
                {sections[activeStep].heading}
              </h3>
            </div>
          )}

          {/* Render the actual section content via the renderSection prop */}
          {renderSection(sections[activeStep], activeStep, true)}
        </motion.div>
      </AnimatePresence>

      {/* ── Completion Celebration Overlay ── */}
      {showCompletionCelebration && !celebrationDismissed ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="relative overflow-hidden rounded-2xl border border-emerald-700/60 bg-gradient-to-br from-emerald-900/50 via-emerald-800/30 to-teal-900/40 bg-gray-900/80 backdrop-blur-sm p-6 sm:p-8 text-center"
        >
          {/* Confetti particles */}
          {confettiParticles.map((particle) => (
            <motion.div
              key={particle.id}
              className="absolute pointer-events-none"
              style={{
                left: `${particle.x}%`,
                top: '-10%',
                width: particle.size,
                height: particle.size,
                backgroundColor: particle.color,
                borderRadius: particle.id % 3 === 0 ? '50%' : '2px',
                rotate: particle.rotation,
              }}
              initial={{ y: -20, opacity: 0, rotate: 0 }}
              animate={{
                y: ['0vh', '110vh'],
                opacity: [1, 0.8, 0.4, 0],
                rotate: [0, particle.rotation * 2],
                x: [0, (particle.id % 2 === 0 ? 1 : -1) * (20 + Math.random() * 40)],
              }}
              transition={{
                duration: particle.duration,
                delay: particle.delay,
                ease: 'easeIn',
                repeat: Infinity,
                repeatDelay: particle.duration * 0.5,
              }}
            />
          ))}

          {/* Glow effect */}
          <div className="pointer-events-none absolute -inset-4 opacity-30 blur-3xl">
            <div className="h-full w-full rounded-full bg-emerald-500/30" />
          </div>

          <div className="relative z-10">
            {/* Animated trophy */}
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.1 }}
              className="mx-auto mb-4 h-16 w-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-xl shadow-emerald-600/30"
            >
              <Trophy className="h-8 w-8 text-white" />
            </motion.div>

            {/* Title */}
            <motion.h3
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-xl sm:text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-green-200 to-teal-300 mb-2"
            >
              All Sections Completed! 🎉
            </motion.h3>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-sm text-gray-300 mb-4"
            >
              You've reviewed all {totalSteps} {totalSteps === 1 ? 'section' : 'sections'} of this lesson.
              Your reading progress has been updated to 100%.
            </motion.p>

            {/* Stats row */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="flex items-center justify-center gap-4 sm:gap-6 mb-5"
            >
              <div className="flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4 text-emerald-400" />
                <span className="text-sm font-medium text-emerald-300">{totalSteps} Viewed</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Star className="h-4 w-4 text-yellow-400" />
                <span className="text-sm font-medium text-yellow-300">100% Progress</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Award className="h-4 w-4 text-purple-400" />
                <span className="text-sm font-medium text-purple-300">Complete</span>
              </div>
            </motion.div>

            {/* Dismiss button */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-3"
            >
              <Button
                onClick={() => setCelebrationDismissed(true)}
                className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white shadow-lg shadow-emerald-600/20 hover:shadow-emerald-500/30 transition-all"
              >
                <CheckCircle className="h-4 w-4 mr-1.5" />
                Continue
              </Button>
              {lastStepButton && (
                <motion.div
                  onClick={() => {
                    // Dismiss the celebration first so the parent can render normally
                    setCelebrationDismissed(true);
                  }}
                  animate={{ scale: [1, 1.04, 1] }}
                  transition={{
                    duration: 2,
                    ease: 'easeInOut',
                    repeat: Infinity,
                    repeatDelay: 0.5,
                  }}
                  whileHover={{ scale: 1.08 }}
                >
                  {lastStepButton}
                </motion.div>
              )}
            </motion.div>
          </div>
        </motion.div>
      ) : (
        <>
          {/* ── Navigation Controls ── */}
          <div className="flex items-center justify-between gap-3 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={goPrev}
              disabled={activeStep === 0}
              className="flex items-center gap-1.5 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Previous</span>
            </Button>

            {/* Section completion indicator */}
            <div className="flex items-center gap-2">
              {viewedSections.has(activeStep) && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-medium"
                >
                  <CheckCircle className="h-3 w-3" />
                  <span className="hidden sm:inline">Viewed</span>
                </motion.span>
              )}
            </div>

            {activeStep < totalSteps - 1 ? (
              <Button
                size="sm"
                onClick={goNext}
                className="flex items-center gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-600/20 hover:shadow-blue-500/30 transition-all"
              >
                <span>Next Step</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : lastStepButton ? (
              lastStepButton
            ) : (
              <Button
                size="sm"
                onClick={goPrev}
                className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white shadow-lg shadow-emerald-600/20"
              >
                <RotateCcw className="h-4 w-4" />
                <span className="hidden sm:inline">Review Again</span>
                <span className="sm:hidden">Review</span>
              </Button>
            )}
          </div>

          {/* ── Keyboard Hint ── */}
          <div className="text-center">
            <span className="text-[10px] text-gray-600">
              Use <kbd className="px-1 py-0.5 bg-gray-800 rounded text-[9px] text-gray-400 font-mono border border-gray-700">←</kbd>{' '}
              <kbd className="px-1 py-0.5 bg-gray-800 rounded text-[9px] text-gray-400 font-mono border border-gray-700">→</kbd>{' '}
              or{' '}
              <kbd className="px-1 py-0.5 bg-gray-800 rounded text-[9px] text-gray-400 font-mono border border-gray-700">↑</kbd>{' '}
              <kbd className="px-1 py-0.5 bg-gray-800 rounded text-[9px] text-gray-400 font-mono border border-gray-700">↓</kbd>{' '}
              to navigate
            </span>
          </div>
        </>
      )}
    </div>
  );
};

export default InteractiveStepThroughViewer;
