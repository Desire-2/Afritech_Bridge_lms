// ── LMS UI Design Tokens & Variants ─────────────────────────────────
// Single source of truth for status colors, gradients, badge treatments,
// and card variants used across the learning interface.
// Uses class-variance-authority (CVA) for consistent variant definitions.

import { cva, type VariantProps } from "class-variance-authority";

// ── Status Colors ───────────────────────────────────────────────────

export const STATUS_COLORS = {
  completed: {
    text: "text-green-400",
    bg: "bg-green-900/30",
    border: "border-green-700/50",
    badge: "bg-green-600 text-white",
    badgeOutline: "bg-green-900/50 text-green-300 border-green-700/50",
    icon: "text-green-400",
    ring: "ring-green-500/50",
    gradient: "from-green-500 to-emerald-500",
    progress: "bg-gradient-to-r from-green-500 to-emerald-500",
    light: {
      bg: "bg-green-50",
      border: "border-green-200",
      text: "text-green-700",
      icon: "text-green-600",
    },
  },
  inProgress: {
    text: "text-blue-400",
    bg: "bg-blue-900/30",
    border: "border-blue-700/50",
    badge: "bg-blue-600 text-white",
    badgeOutline: "bg-blue-900/30 text-blue-300 border-blue-700/50",
    icon: "text-blue-400",
    ring: "ring-blue-500/50",
    gradient: "from-blue-500 to-indigo-500",
    progress: "bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500",
    light: {
      bg: "bg-blue-50",
      border: "border-blue-200",
      text: "text-blue-700",
      icon: "text-blue-600",
    },
  },
  locked: {
    text: "text-gray-500",
    bg: "bg-gray-800/30",
    border: "border-gray-700/50",
    badge: "bg-gray-600 text-gray-200",
    badgeOutline: "bg-gray-800/30 text-gray-400 border-gray-700/50",
    icon: "text-gray-500",
    ring: "ring-gray-500/30",
    gradient: "from-gray-500 to-gray-600",
    progress: "bg-gray-600",
    light: {
      bg: "bg-gray-100",
      border: "border-gray-200",
      text: "text-gray-600",
      icon: "text-gray-500",
    },
  },
  warning: {
    text: "text-amber-400",
    bg: "bg-amber-900/30",
    border: "border-amber-700/50",
    badge: "bg-amber-600 text-white",
    badgeOutline: "bg-amber-900/30 text-amber-300 border-amber-700/50",
    icon: "text-amber-400",
    ring: "ring-amber-500/50",
    gradient: "from-amber-500 to-orange-500",
    progress: "bg-gradient-to-r from-amber-500 to-orange-500",
    light: {
      bg: "bg-amber-50",
      border: "border-amber-200",
      text: "text-amber-700",
      icon: "text-amber-600",
    },
  },
  danger: {
    text: "text-red-400",
    bg: "bg-red-900/30",
    border: "border-red-700/50",
    badge: "bg-red-600 text-white",
    badgeOutline: "bg-red-900/30 text-red-300 border-red-700/50",
    icon: "text-red-400",
    ring: "ring-red-500/50",
    gradient: "from-red-500 to-rose-500",
    progress: "bg-gradient-to-r from-red-500 to-rose-500",
    light: {
      bg: "bg-red-50",
      border: "border-red-200",
      text: "text-red-700",
      icon: "text-red-600",
    },
  },
  info: {
    text: "text-purple-400",
    bg: "bg-purple-900/30",
    border: "border-purple-700/50",
    badge: "bg-purple-600 text-white",
    badgeOutline: "bg-purple-900/30 text-purple-300 border-purple-700/50",
    icon: "text-purple-400",
    ring: "ring-purple-500/50",
    gradient: "from-purple-500 to-indigo-500",
    progress: "bg-gradient-to-r from-purple-500 to-indigo-500",
    light: {
      bg: "bg-purple-50",
      border: "border-purple-200",
      text: "text-purple-700",
      icon: "text-purple-600",
    },
  },
} as const;

export type StatusColor = keyof typeof STATUS_COLORS;

// ── Lesson/Module Status Variants ───────────────────────────────────

export const moduleStatus = cva("", {
  variants: {
    status: {
      completed: "text-green-400",
      in_progress: "text-blue-400",
      unlocked: "text-blue-400",
      locked: "text-gray-500",
      failed: "text-red-400",
    },
  },
  defaultVariants: {
    status: "locked",
  },
});

export const moduleBadge = cva(
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
  {
    variants: {
      status: {
        completed: "bg-green-900/50 text-green-300 border border-green-700/50",
        in_progress:
          "bg-blue-900/50 text-blue-300 border border-blue-700/50",
        unlocked: "bg-blue-900/30 text-blue-300 border border-blue-700/50",
        locked: "bg-gray-800/50 text-gray-400 border border-gray-700/50",
        failed: "bg-red-900/50 text-red-300 border border-red-700/50",
      },
    },
    defaultVariants: {
      status: "locked",
    },
  }
);

// ── Score Display Variants ──────────────────────────────────────────

export const scoreVariant = cva(
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold",
  {
    variants: {
      level: {
        excellent: "bg-green-900/50 text-green-300 border border-green-700/50",
        good: "bg-blue-900/50 text-blue-300 border border-blue-700/50",
        fair: "bg-amber-900/50 text-amber-300 border border-amber-700/50",
        poor: "bg-red-900/50 text-red-300 border border-red-700/50",
      },
    },
    defaultVariants: {
      level: "fair",
    },
  }
);

// ── Assessment Type Variants ────────────────────────────────────────

export const assessmentTypeVariant = cva(
  "inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[10px] sm:text-xs font-medium transition-all duration-200",
  {
    variants: {
      type: {
        quiz: "bg-blue-900/30 text-blue-300 border-blue-700/50",
        assignment: "bg-purple-900/30 text-purple-300 border-purple-700/50",
        project: "bg-orange-900/30 text-orange-300 border-orange-700/50",
      },
    },
    defaultVariants: {
      type: "quiz",
    },
  }
);

// ── Gradient Card Wrapper ───────────────────────────────────────────

export const gradientCard = cva(
  "rounded-xl border shadow-lg transition-all duration-300 hover:shadow-xl",
  {
    variants: {
      accent: {
        blue: "border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950",
        green:
          "border-green-200 dark:border-green-800 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950",
        amber:
          "border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950 dark:to-amber-950",
        purple:
          "border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950 dark:to-indigo-950",
        slate:
          "border-slate-200 dark:border-slate-700 bg-gradient-to-br from-slate-50 to-gray-50 dark:from-slate-900 dark:to-gray-900",
      },
    },
    defaultVariants: {
      accent: "blue",
    },
  }
);

// ── Lesson Completion Ring Colors ───────────────────────────────────

export function getScoreLevel(score: number): {
  level: "excellent" | "good" | "fair" | "poor";
  color: string;
  ringColor: string;
} {
  if (score >= 90)
    return {
      level: "excellent",
      color: "#22c55e",
      ringColor: "stroke-green-500",
    };
  if (score >= 70)
    return {
      level: "good",
      color: "#3b82f6",
      ringColor: "stroke-blue-500",
    };
  if (score >= 50)
    return {
      level: "fair",
      color: "#f59e0b",
      ringColor: "stroke-amber-500",
    };
  return { level: "poor", color: "#ef4444", ringColor: "stroke-red-500" };
}

// ── Accent Gradient Constants ───────────────────────────────────────

export const ACCENT_GRADIENTS = {
  primary: "from-blue-500 to-purple-600",
  success: "from-green-500 to-emerald-600",
  warning: "from-amber-500 to-orange-500",
  danger: "from-red-500 to-rose-500",
  info: "from-blue-500 to-indigo-500",
  neutral: "from-gray-500 to-gray-600",
} as const;

export const BUTTON_GRADIENTS = {
  primary:
    "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-600/20 hover:shadow-blue-500/30",
  success:
    "bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg shadow-green-600/20 hover:shadow-green-500/30",
  warning:
    "bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white shadow-lg shadow-amber-600/20",
  danger:
    "bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white shadow-lg shadow-red-600/20",
  secondary:
    "border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white transition-all",
} as const;
