/**
 * Platform capability detection.
 *
 * Components ask "can I do this?" rather than "am I on iOS?". Feature detection
 * keeps platform assumptions out of the UI and means a new platform needs no
 * component changes.
 */
export interface PlatformCapabilities {
  readonly isNative: boolean;
  readonly isIOS: boolean;
  readonly isAndroid: boolean;
  readonly isTouch: boolean;
  readonly supportsBackdropFilter: boolean;
  readonly supportsHaptics: boolean;
  readonly prefersReducedMotion: boolean;
  readonly prefersReducedTransparency: boolean;
  readonly deviceMemoryGB: number | null;
  readonly hardwareConcurrency: number;
}

const query = (q: string): boolean =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(q).matches
    : false;

export function detectCapabilities(): PlatformCapabilities {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { deviceMemory?: number }) : undefined;
  const isNative = typeof window !== 'undefined' && '__CAPACITOR__' in window;

  return {
    isNative,
    isIOS: /iPad|iPhone|iPod/.test(ua) || (/Mac/.test(ua) && (nav?.maxTouchPoints ?? 0) > 1),
    isAndroid: /Android/.test(ua),
    isTouch: typeof window !== 'undefined' && 'ontouchstart' in window,
    supportsBackdropFilter:
      typeof CSS !== 'undefined' &&
      (CSS.supports('backdrop-filter', 'blur(1px)') || CSS.supports('-webkit-backdrop-filter', 'blur(1px)')),
    supportsHaptics: isNative || (typeof navigator !== 'undefined' && 'vibrate' in navigator),
    prefersReducedMotion: query('(prefers-reduced-motion: reduce)'),
    prefersReducedTransparency: query('(prefers-reduced-transparency: reduce)'),
    deviceMemoryGB: nav?.deviceMemory ?? null,
    hardwareConcurrency: typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4,
  };
}

/**
 * Heavy glass and the animated pitch are the two things that will drop frames
 * on a low-end Android device. We decide once, at boot, whether to run the
 * full-fidelity presentation, rather than checking per-frame.
 */
export function shouldReduceEffects(caps: PlatformCapabilities): boolean {
  if (caps.prefersReducedTransparency) return true;
  if (!caps.supportsBackdropFilter) return true;
  if (caps.deviceMemoryGB !== null && caps.deviceMemoryGB <= 2) return true;
  if (caps.hardwareConcurrency <= 2) return true;
  return false;
}
