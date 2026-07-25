// ── Shared Framer Motion Animation Presets ──────────────────────────
// Single source of truth for transition timing, easing, and variant
// definitions used throughout the learning interface.

import type { Transition, Variants } from "framer-motion";

// ── Easing Curves ───────────────────────────────────────────────────

export const EASING = {
  /** Smooth, natural motion */
  smooth: [0.25, 0.1, 0.25, 1] as [number, number, number, number],
  /** Spring-like bounce */
  spring: [0.34, 1.56, 0.64, 1] as [number, number, number, number],
  /** Fast entrance, slow exit */
  enter: [0.16, 1, 0.3, 1] as [number, number, number, number],
  /** Deceleration */
  decelerate: [0, 0, 0.2, 1] as [number, number, number, number],
  /** Acceleration */
  accelerate: [0.4, 0, 1, 1] as [number, number, number, number],
} as const;

// ── Default Transition (300ms, smooth) ──────────────────────────────

export const defaultTransition: Transition = {
  duration: 0.3,
  ease: EASING.smooth,
};

// ── Transition Presets ──────────────────────────────────────────────

export const TRANSITIONS = {
  /** Fast: 150ms — for micro-interactions like hovers */
  fast: { duration: 0.15, ease: EASING.accelerate } as Transition,
  /** Normal: 300ms — default for most transitions */
  normal: { duration: 0.3, ease: EASING.smooth } as Transition,
  /** Slow: 500ms — for emphasis animations */
  slow: { duration: 0.5, ease: EASING.decelerate } as Transition,
  /** Spring: for natural bouncy animations (e.g. celebration) */
  spring: {
    type: "spring" as const,
    stiffness: 200,
    damping: 12,
  } as Transition,
  /** Spring gentle: soft bounce */
  springGentle: {
    type: "spring" as const,
    stiffness: 100,
    damping: 15,
  } as Transition,
  /** Stagger children */
  stagger: { staggerChildren: 0.05 } as Transition,
  /** Stagger with slower delay */
  staggerSlow: { staggerChildren: 0.1 } as Transition,
} as const;

// ── Variant Presets ─────────────────────────────────────────────────

/** Fade in from bottom */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: TRANSITIONS.normal,
  },
};

/** Fade in */
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: TRANSITIONS.normal,
  },
};

/** Scale in (for modals, popups) */
export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: TRANSITIONS.slow,
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    transition: TRANSITIONS.fast,
  },
};

/** Slide in from left (sidebar items) */
export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: (i: number = 0) => ({
    opacity: 1,
    x: 0,
    transition: { ...TRANSITIONS.normal, delay: i * 0.05 },
  }),
};

/** Slide in from right (quiz questions) */
export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 40 },
  visible: { opacity: 1, x: 0, transition: TRANSITIONS.normal },
  exit: { opacity: 0, x: -40, transition: TRANSITIONS.fast },
};

/** Quiz answer option */
export const answerOption: Variants = {
  hidden: { opacity: 0, x: -10 },
  visible: (i: number = 0) => ({
    opacity: 1,
    x: 0,
    transition: { ...TRANSITIONS.normal, delay: i * 0.03 },
  }),
  tap: { scale: 0.98 },
};

/** Page/section transition (step viewer) */
export const stepTransition: Variants = {
  enter: (direction: number) => ({
    opacity: 0,
    x: direction > 0 ? 40 : -40,
    y: 8,
  }),
  center: {
    opacity: 1,
    x: 0,
    y: 0,
    transition: { duration: 0.3, ease: EASING.smooth },
  },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction > 0 ? -40 : 40,
    y: -8,
    transition: { duration: 0.2, ease: EASING.accelerate },
  }),
};

/** Staggered list items */
export const staggerList: Variants = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.1 },
  },
};

/** Container that scales on hover (cards) */
export const hoverScale = {
  whileHover: { scale: 1.02, transition: TRANSITIONS.fast },
  whileTap: { scale: 0.98 },
};

/** Confetti particle animation */
export const confettiParticle = (
  color: string,
  duration: number = 2,
  delay: number = 0
): Variants => ({
  initial: { y: -20, opacity: 0, rotate: 0 },
  animate: {
    y: ["0vh", "110vh"],
    opacity: [1, 0.8, 0.4, 0],
    rotate: [0, 360 * (Math.random() > 0.5 ? 1 : -1)],
    x: [0, (Math.random() > 0.5 ? 1 : -1) * (20 + Math.random() * 40)],
    backgroundColor: color,
  },
  transition: {
    duration,
    delay,
    ease: "easeIn",
    repeat: Infinity,
    repeatDelay: duration * 0.5,
  },
});

// ── Progress Bar Glow ──────────────────────────────────────────────

export const progressGlowStyle = (progressPercent: number) =>
  ({
    position: "absolute",
    top: 0,
    bottom: 0,
    width: "3rem",
    marginLeft: "-1.5rem",
    filter: "blur(8px)",
    opacity: 0.4,
    left: `${progressPercent}%`,
    background: "linear-gradient(90deg, transparent, #6366f1, transparent)",
  } as React.CSSProperties);
