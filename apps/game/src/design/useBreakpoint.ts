import { useMediaQuery } from './useMediaQuery';

/**
 * Three breakpoints, no more.
 *
 * The product is a phone game first. `tablet` exists because an iPad running
 * the phone layout at 2x looks broken, and `desktop` exists because that is
 * where this gets reviewed and streamed. There is no `xl`: past 1280px the
 * layout stops growing and centres, because a management screen three metres
 * wide is worse, not better.
 */
export const BREAKPOINTS = {
  /** Below this we are a single column with a bottom tab bar. */
  tablet: 768,
  /** At and above this the shell shows a persistent side nav. */
  desktop: 1080,
} as const;

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

export function useBreakpoint(): Breakpoint {
  const isTablet = useMediaQuery(`(min-width: ${BREAKPOINTS.tablet}px)`);
  const isDesktop = useMediaQuery(`(min-width: ${BREAKPOINTS.desktop}px)`);
  if (isDesktop) return 'desktop';
  if (isTablet) return 'tablet';
  return 'mobile';
}

export function useIsMobile(): boolean {
  return useBreakpoint() === 'mobile';
}

/** True for tablet and desktop: the widths that get the side nav and columns. */
export function useIsWide(): boolean {
  return useBreakpoint() !== 'mobile';
}
