import { createContext, useContext, useMemo } from 'react';
import { useReducedMotion } from 'motion/react';
import type { Transition, Variants } from 'motion/react';

/**
 * Shared motion language.
 *
 * Everything here is bound to the five duration tokens so that retuning the
 * product's pace is a token change, not a search-and-replace across components.
 * The rule the whole app follows: chrome moves at `micro`/`fast`, content moves
 * at `medium`, screens and reveals move at `slow`, and only hero moments are
 * allowed `cinematic`.
 */

export const DURATION = {
  micro: 0.14,
  fast: 0.22,
  medium: 0.38,
  slow: 0.72,
  cinematic: 1.4,
} as const;
export type DurationToken = keyof typeof DURATION;

/** Mirrors the cubic-beziers in tokens.css so JS and CSS animation match. */
export const EASE = {
  outQuint: [0.22, 1, 0.36, 1],
  spring: [0.34, 1.56, 0.64, 1],
  inOutSoft: [0.4, 0, 0.2, 1],
} as const;

/**
 * Spring presets. We prefer springs for anything the finger drives (press,
 * drag, sheet) because a duration-based curve always feels detached from the
 * gesture, and easings for anything time-driven (reveals, transitions).
 */
export const SPRING = {
  /** Button press / icon tap. Very short, no visible overshoot. */
  press: { type: 'spring', stiffness: 620, damping: 34, mass: 0.7 },
  /** Default UI spring: selection pills, toggles, tab indicators. */
  snappy: { type: 'spring', stiffness: 420, damping: 32, mass: 0.9 },
  /** Content settling into place. Slight, controlled overshoot. */
  gentle: { type: 'spring', stiffness: 260, damping: 28, mass: 1 },
  /** Bottom sheets. Tuned against iOS: fast attack, no bounce at rest. */
  sheet: { type: 'spring', stiffness: 340, damping: 38, mass: 1.1 },
  /** Celebration only. Real overshoot — never use this on ordinary chrome. */
  bouncy: { type: 'spring', stiffness: 380, damping: 16, mass: 0.9 },
} as const satisfies Record<string, Transition>;

export const TRANSITION = {
  micro: { duration: DURATION.micro, ease: EASE.outQuint },
  fast: { duration: DURATION.fast, ease: EASE.outQuint },
  medium: { duration: DURATION.medium, ease: EASE.outQuint },
  slow: { duration: DURATION.slow, ease: EASE.outQuint },
  cinematic: { duration: DURATION.cinematic, ease: EASE.outQuint },
  soft: { duration: DURATION.fast, ease: EASE.inOutSoft },
} as const satisfies Record<string, Transition>;

/** Instant, but still a real transition object so `AnimatePresence` resolves. */
export const NO_TRANSITION: Transition = { duration: 0 };

/* ------------------------------------------------------------------ */
/* Variants                                                            */
/* ------------------------------------------------------------------ */

const FULL = {
  fade: {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: TRANSITION.medium },
    exit: { opacity: 0, transition: TRANSITION.fast },
  },
  rise: {
    hidden: { opacity: 0, y: 14 },
    visible: { opacity: 1, y: 0, transition: TRANSITION.medium },
    exit: { opacity: 0, y: 8, transition: TRANSITION.fast },
  },
  /** Content entering from below the fold — the workhorse for screen sections. */
  riseFar: {
    hidden: { opacity: 0, y: 32 },
    visible: { opacity: 1, y: 0, transition: { ...SPRING.gentle } },
    exit: { opacity: 0, y: 16, transition: TRANSITION.fast },
  },
  pop: {
    hidden: { opacity: 0, scale: 0.92 },
    visible: { opacity: 1, scale: 1, transition: { ...SPRING.snappy } },
    exit: { opacity: 0, scale: 0.96, transition: TRANSITION.micro },
  },
  /** Sheets: translate only. Never animate backdrop-filter — it forces a
      full-surface recomposite every frame on mobile GPUs. */
  sheet: {
    hidden: { y: '100%' },
    visible: { y: 0, transition: { ...SPRING.sheet } },
    exit: { y: '100%', transition: TRANSITION.fast },
  },
  backdrop: {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: TRANSITION.fast },
    exit: { opacity: 0, transition: TRANSITION.fast },
  },
  modal: {
    hidden: { opacity: 0, scale: 0.94, y: 12 },
    visible: { opacity: 1, scale: 1, y: 0, transition: { ...SPRING.sheet } },
    exit: { opacity: 0, scale: 0.97, y: 6, transition: TRANSITION.fast },
  },
  /** Parent of a staggered list. Children use `listItem`. */
  listContainer: {
    hidden: {},
    visible: { transition: { staggerChildren: 0.045, delayChildren: 0.02 } },
    exit: {},
  },
  listItem: {
    hidden: { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0, transition: TRANSITION.medium },
    exit: { opacity: 0, transition: TRANSITION.micro },
  },
  /** Toasts arrive from the top edge, under the status bar. */
  toast: {
    hidden: { opacity: 0, y: -18, scale: 0.96 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { ...SPRING.snappy } },
    exit: { opacity: 0, y: -12, scale: 0.98, transition: TRANSITION.fast },
  },
  /** Hero reveals. Deliberately slower and larger than anything else. */
  hero: {
    hidden: { opacity: 0, scale: 0.86, filter: 'blur(14px)' },
    visible: { opacity: 1, scale: 1, filter: 'blur(0px)', transition: TRANSITION.slow },
    exit: { opacity: 0, scale: 1.04, filter: 'blur(8px)', transition: TRANSITION.medium },
  },
} as const satisfies Record<string, Variants>;

export type VariantName = keyof typeof FULL;
export type DesignVariants = Record<VariantName, Variants>;

/**
 * Reduced-motion equivalents. We do not simply disable animation: an element
 * that pops into existence with no transition at all reads as a glitch. Instead
 * every variant collapses to a short cross-fade, which conveys the same
 * "something changed here" without vestibular movement.
 */
const REDUCED: DesignVariants = (() => {
  const crossFade: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: DURATION.micro } },
    exit: { opacity: 0, transition: { duration: DURATION.micro } },
  };
  const out = {} as DesignVariants;
  for (const key of Object.keys(FULL) as VariantName[]) {
    out[key] = key === 'listContainer'
      ? { hidden: {}, visible: { transition: { staggerChildren: 0 } }, exit: {} }
      : crossFade;
  }
  return out;
})();

/* ------------------------------------------------------------------ */
/* Reduced-motion plumbing                                             */
/* ------------------------------------------------------------------ */

/**
 * The in-app "Reduce motion" setting (GameSettings.reducedMotion) can force
 * reduced motion on even when the OS has not. Screens wrap their tree in this
 * provider; everything below picks it up without prop-drilling.
 */
export const ReducedMotionOverrideContext = createContext<boolean | null>(null);

export function useReducedMotionPreference(): boolean {
  const system = useReducedMotion();
  const override = useContext(ReducedMotionOverrideContext);
  return override ?? system ?? false;
}

export interface DesignMotion {
  readonly reduced: boolean;
  readonly variants: DesignVariants;
  /** Transitions, already flattened to instant when motion is reduced. */
  readonly transition: Record<keyof typeof TRANSITION, Transition>;
  readonly spring: Record<keyof typeof SPRING, Transition>;
  /** Pass-through for one-off values: `m.safe({ scale: 1.04 })` → `{}` when reduced. */
  safe<T extends object>(value: T): T | Record<string, never>;
}

const REDUCED_TRANSITIONS = Object.fromEntries(
  Object.keys(TRANSITION).map((k) => [k, NO_TRANSITION]),
) as Record<keyof typeof TRANSITION, Transition>;

const REDUCED_SPRINGS = Object.fromEntries(
  Object.keys(SPRING).map((k) => [k, NO_TRANSITION]),
) as Record<keyof typeof SPRING, Transition>;

/**
 * The single hook every animated component uses. One call gives you variants,
 * transitions and springs already resolved for the user's preference, so no
 * component ever writes its own `prefers-reduced-motion` branch.
 */
export function useDesignMotion(): DesignMotion {
  const reduced = useReducedMotionPreference();
  return useMemo<DesignMotion>(
    () => ({
      reduced,
      variants: reduced ? REDUCED : (FULL as unknown as DesignVariants),
      transition: reduced ? REDUCED_TRANSITIONS : TRANSITION,
      spring: reduced ? REDUCED_SPRINGS : (SPRING as unknown as Record<keyof typeof SPRING, Transition>),
      safe: <T extends object>(value: T) => (reduced ? {} : value),
    }),
    [reduced],
  );
}

/** Variants for callers that are certain they want the full-motion set. */
export const VARIANTS = FULL as unknown as DesignVariants;
