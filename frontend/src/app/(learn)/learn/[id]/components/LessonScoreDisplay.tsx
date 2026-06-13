import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Star,
  Zap,
  TrendingUp,
  BookOpen,
  Brain,
  ClipboardCheck,
  FileText,
  Target,
  Shield,
  Flame,
  Sparkles,
  Trophy,
  Medal,
  Gem,
} from 'lucide-react';

/* ──────────────────────────────────────────────
   Tailwind Safelist
   These strings exist solely so the Tailwind JIT
   compiler generates the classes used dynamically
   below. They are never invoked at runtime.
   ────────────────────────────────────────────── */
// @codebuff-safelist-start
// text-stone-400 stroke-stone-400 from-stone-600/20 to-stone-800/20
// text-blue-400  stroke-blue-400  from-blue-600/20 to-blue-800/20
// text-cyan-400  stroke-cyan-400  from-cyan-600/20 to-cyan-800/20
// text-emerald-400 stroke-emerald-400 from-emerald-600/20 to-emerald-800/20
// text-purple-400 stroke-purple-400 from-purple-600/20 to-purple-800/20
// text-amber-400  stroke-amber-400  from-amber-500/20 to-amber-700/20
// @codebuff-safelist-end

/* ─── Gamified Level System ─────────────────────────────────────────── */

interface LevelDef {
  label: string;
  icon: React.ElementType;
  /** CSS color value for inline styles */
  cssColor: string;
  /** Tailwind gradient classes (listed in safelist above) */
  twGradient: string;
  minScore: number;
}

const LEVELS: LevelDef[] = [
  { label: 'Novice',     icon: Shield,       cssColor: '#a8a29e', twGradient: 'from-stone-600/20 to-stone-800/20', minScore: 0   },
  { label: 'Apprentice', icon: Medal,        cssColor: '#60a5fa', twGradient: 'from-blue-600/20 to-blue-800/20',   minScore: 20  },
  { label: 'Journeyman', icon: Zap,          cssColor: '#22d3ee', twGradient: 'from-cyan-600/20 to-cyan-800/20',   minScore: 40  },
  { label: 'Adept',      icon: TrendingUp,   cssColor: '#34d399', twGradient: 'from-emerald-600/20 to-emerald-800/20', minScore: 60 },
  { label: 'Expert',     icon: Gem,          cssColor: '#a78bfa', twGradient: 'from-purple-600/20 to-purple-800/20', minScore: 80 },
  { label: 'Master',     icon: Trophy,       cssColor: '#fbbf24', twGradient: 'from-amber-500/20 to-amber-700/20',   minScore: 90 },
];

function getLevel(score: number): LevelDef {
  return [...LEVELS].reverse().find((l) => score >= l.minScore) ?? LEVELS[0];
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

function starRating(score: number): number {
  return Math.min(5, Math.floor(score / 20) + (score % 20 >= 10 ? 1 : 0));
}

/* ─── Circular Progress Ring (SVG) ──────────────────────────────────── */

function CircularProgress({
  score,
  size = 72,
  strokeWidth = 5,
}: {
  score: number;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const level = getLevel(score);

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-gray-800"
        />
        {/* Animated progress arc — uses inline stroke for dynamic color */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
          stroke={level.cssColor}
        />
      </svg>
      {/* Score text in center */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="text-lg font-black tracking-tight text-white"
          key={Math.round(score)}
          initial={{ scale: 1.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 12 }}
        >
          {Math.round(score)}
        </motion.span>
        <span className="text-[9px] font-semibold text-gray-500 -mt-0.5">SCORE</span>
      </div>
    </div>
  );
}

/* ─── Props ──────────────────────────────────────────────────────────── */

interface LessonScoreDisplayProps {
  readingProgress: number;
  engagementScore: number;
  quizScore?: number;
  assignmentScore?: number;
  lessonScore: number;
  hasQuiz?: boolean;
  hasAssignment?: boolean;
  /** When 'inline', renders without the outer card wrapper for embedding inside another container */
  variant?: 'full' | 'inline';
}

/* ─── Gamified Main Component ───────────────────────────────────────── */

/* ─── Shared Level Utilities (exported for reuse) ──────────────────── */

export { getLevel, LEVELS };
export type { LevelDef };

/* ─── Gamified Main Component ───────────────────────────────────────── */

export const LessonScoreDisplay: React.FC<LessonScoreDisplayProps> = ({
  readingProgress,
  engagementScore,
  quizScore,
  assignmentScore,
  lessonScore,
  hasQuiz = false,
  hasAssignment = false,
  variant = 'full',
}) => {
  const displayScore = Math.round(lessonScore);
  const level = getLevel(displayScore);
  const stars = starRating(displayScore);
  const isCompleted = displayScore >= 80;
  const missing = Math.max(0, 80 - displayScore);

  // Build component list (same data as before, displayed compactly)
  const components = useMemo(() => {
    const items: { label: string; score: number; icon: React.ElementType; color: string }[] = [
      { label: 'Reading',     score: Math.round(readingProgress),  icon: BookOpen,       color: '#60a5fa' },
      { label: 'Engagement',  score: Math.round(engagementScore),  icon: Brain,          color: '#34d399' },
    ];
    if (hasQuiz)       items.push({ label: 'Quiz',       score: Math.round(quizScore ?? 0),       icon: ClipboardCheck, color: '#a78bfa' });
    if (hasAssignment) items.push({ label: 'Assignment', score: Math.round(assignmentScore ?? 0), icon: FileText,       color: '#fb923c' });
    return items;
  }, [readingProgress, engagementScore, quizScore, assignmentScore, hasQuiz, hasAssignment]);

  const LevelIcon = level.icon;

  // ── Shared inner content used by both full and inline variants ──
  const innerContent = (
    <>
      {/* ── Top row: ring + level badge + stars ── */}
      <div className="flex items-start justify-between gap-4">
        {/* Left: Circular ring */}
        <div className="flex items-center gap-4">
          <CircularProgress score={displayScore} size={80} strokeWidth={6} />

          {/* Level + Stats */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <LevelIcon className="h-4 w-4" style={{ color: level.cssColor }} />
              <span className="text-sm font-bold tracking-wide" style={{ color: level.cssColor }}>
                {level.label}
              </span>
            </div>

            {/* Star rating */}
            <div className="flex items-center gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ scale: 0, rotate: -90 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.4 + i * 0.08, type: 'spring', stiffness: 300 }}
                >
                  <Star
                    className={`h-3.5 w-3.5 ${
                      i < stars
                        ? 'fill-amber-400 text-amber-400'
                        : 'fill-gray-700 text-gray-700'
                    }`}
                  />
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Status badge */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          {isCompleted ? (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, delay: 0.3 }}
              className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-bold text-emerald-400 ring-1 ring-emerald-500/30"
            >
              <Sparkles className="h-3 w-3" />
              COMPLETE
            </motion.div>
          ) : (
            <span className="text-[11px] font-semibold text-yellow-400/80">
              {missing}% to go
            </span>
          )}
        </div>
      </div>

      {/* ── Component scores — compact row ── */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {components.map((comp) => (
          <div key={comp.label} className="flex items-center gap-1.5">
            <comp.icon className="h-3 w-3" style={{ color: comp.color }} />
            <span className="text-[11px] font-medium text-gray-400">{comp.label}</span>
            <span className="text-[11px] font-bold tabular-nums" style={{ color: comp.color }}>
              {comp.score}%
            </span>
            {/* Score color dot */}
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                comp.score >= 80
                  ? 'bg-green-500'
                  : comp.score >= 60
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
              }`}
            />
          </div>
        ))}
      </div>

      {/* ── XP progress bar ── */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1">
          <div className="flex items-center gap-1">
            <Flame className="h-3 w-3 text-orange-400" />
            <span>XP</span>
          </div>
          <span className="font-mono tabular-nums">
            {displayScore * 10} / 1,000
          </span>
        </div>
        <div className="relative h-2 overflow-hidden rounded-full bg-gray-800/70">
          <motion.div
            className={`h-full rounded-full bg-gradient-to-r ${level.twGradient} shadow-sm`}
            initial={{ width: '0%' }}
            animate={{ width: `${Math.min(displayScore, 100)}%` }}
            transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
          />
          {/* Shimmer pulse */}
          <div className="absolute inset-0 animate-pulse rounded-full bg-white/[0.03]" />
        </div>
      </div>

      {/* ── Completion call-to-action ── */}
      {!isCompleted && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-2 flex items-center gap-2 text-[11px] text-gray-500"
        >
          <Target className="h-3 w-3 text-yellow-500" />
          <span>
            Next level at <strong className="text-yellow-400">80%</strong>
            {components.some((c) => c.score < 70) && (
              <>
                {' · '}
                <span className="text-blue-400">
                  Focus on{' '}
                  {components
                    .filter((c) => c.score < 70)
                    .map((c) => c.label)
                    .join(', ')}
                </span>
              </>
            )}
          </span>
        </motion.div>
      )}

      {/* ── Completed celebration flourish ── */}
      {isCompleted && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-2 flex items-center gap-2 text-[11px] text-emerald-400"
        >
          <Sparkles className="h-3 w-3" />
          <span>Lesson mastered! All requirements met.</span>
        </motion.div>
      )}
    </>
  );

  if (variant === 'inline') {
    return innerContent;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={`relative overflow-hidden rounded-2xl border border-gray-800/80 bg-gradient-to-br ${level.twGradient} bg-gray-900/70 backdrop-blur-sm p-4 sm:p-5`}
    >
      {/* Subtle ambient glow — uses bg-{color}/10 for the glow */}
      <div className="pointer-events-none absolute -inset-1 opacity-20 blur-2xl">
        <div
          className="h-full w-full rounded-full"
          style={{ backgroundColor: `${level.cssColor}1a` }}
        />
      </div>
      {innerContent}
    </motion.div>
  );
};
