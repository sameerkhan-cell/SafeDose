/**
 * Shared animation constants for SafeDose.
 * Import from here — do NOT redeclare in individual components.
 *
 * Usage:
 *   import { ease, DURATION, fadeUp, staggerContainer } from "@/lib/motion";
 */

// ── Core easing ───────────────────────────────────────────────────────────────
/** Premium cubic-bezier — matches Apple / Linear motion feel */
export const ease = [0.22, 1, 0.36, 1] as const;

// ── Duration tokens ───────────────────────────────────────────────────────────
export const DURATION = {
  fast:    0.25,
  normal:  0.45,
  slow:    0.65,
  cinematic: 0.9,
} as const;

// ── Framer Motion variant presets ─────────────────────────────────────────────

export const fadeUp = {
  hidden:  { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: DURATION.slow, ease } },
};

export const fadeIn = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: DURATION.normal, ease } },
};

export const scaleIn = {
  hidden:  { opacity: 0, scale: 0.92 },
  visible: { opacity: 1, scale: 1, transition: { duration: DURATION.slow, ease } },
};

export const slideLeft = {
  hidden:  { opacity: 0, x: -24 },
  visible: { opacity: 1, x: 0, transition: { duration: DURATION.slow, ease } },
};

export const slideRight = {
  hidden:  { opacity: 0, x: 24 },
  visible: { opacity: 1, x: 0, transition: { duration: DURATION.slow, ease } },
};

export const staggerContainer = (staggerChildren = 0.08) => ({
  hidden:  {},
  visible: { transition: { staggerChildren } },
});

// ── Blockchain-specific animations ────────────────────────────────────────────

/** Pulse for active blockchain nodes */
export const nodePulse = {
  animate: {
    boxShadow: [
      "0 0 0 0 rgba(26,86,219,0.4)",
      "0 0 20px 8px rgba(26,86,219,0.15)",
      "0 0 0 0 rgba(26,86,219,0.4)",
    ],
  },
  transition: { duration: 2, repeat: Infinity },
};

/** Alert pulse for suspicious/fake states */
export const alertPulse = {
  animate: { opacity: [1, 0.4, 1] },
  transition: { duration: 0.6, repeat: Infinity },
};

/** Shimmer sweep for holographic cards */
export const shimmerSweep = {
  animate: { backgroundPosition: ["-200% 0", "200% 0"] },
  transition: { duration: 1.2, repeat: Infinity, ease: "linear" as const },
};
