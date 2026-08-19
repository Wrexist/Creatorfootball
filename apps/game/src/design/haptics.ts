import { useMemo } from 'react';

/**
 * Haptics abstraction.
 *
 * Components call `haptics.selection()` and never learn what platform they are
 * on. On web this is a no-op by default (browser vibration is either absent, as
 * on iOS Safari, or a blunt buzz that feels wrong for UI feedback). The native
 * shell installs a driver at startup:
 *
 *   import { Haptics, ImpactStyle } from '@capacitor/haptics';
 *   setHapticDriver({
 *     selection: () => Haptics.selectionChanged(),
 *     impact:    () => Haptics.impact({ style: ImpactStyle.Medium }),
 *     ...
 *   });
 *
 * Keeping the Capacitor import out of this file is deliberate: the design
 * system must build and run in a plain browser (and in the Gallery) with no
 * native dependency resolved.
 */

export const HAPTIC_KINDS = [
  'selection',
  'impact',
  'success',
  'warning',
  'error',
  'celebrate',
] as const;
export type HapticKind = (typeof HAPTIC_KINDS)[number];

export type HapticDriver = Partial<Record<HapticKind, () => void>>;

let driver: HapticDriver | null = null;
let enabled = true;

/** Installed once by the native shell. Passing null restores the web no-op. */
export function setHapticDriver(next: HapticDriver | null): void {
  driver = next;
}

/** Bound to GameSettings.haptics. */
export function setHapticsEnabled(next: boolean): void {
  enabled = next;
}

export function hapticsEnabled(): boolean {
  return enabled;
}

function fire(kind: HapticKind): void {
  if (!enabled || !driver) return;
  const fn = driver[kind];
  // A driver that throws (permission revoked mid-session, web view teardown)
  // must never take a button press down with it.
  try {
    fn?.();
  } catch {
    /* haptics are strictly decorative — failure is silent by design */
  }
}

export const haptics: Record<HapticKind, () => void> & { fire: (kind: HapticKind) => void } = {
  /** Value changed under the finger: tab switch, segmented control, slider notch. */
  selection: () => fire('selection'),
  /** A thing happened: button press, card flip, sheet snap. */
  impact: () => fire('impact'),
  /** Confirmed: transfer completed, objective claimed. */
  success: () => fire('success'),
  /** Reversible problem: invalid input, blocked action. */
  warning: () => fire('warning'),
  /** Irreversible failure: negotiation collapsed, save failed. */
  error: () => fire('error'),
  /** Hero moments only. Goals, trophies, signings. */
  celebrate: () => fire('celebrate'),
  fire,
};

/** Stable identity so it can sit in a dependency array without re-running. */
export function useHaptics(): typeof haptics {
  return useMemo(() => haptics, []);
}
