import { useCallback, useSyncExternalStore } from 'react';

/**
 * Media-query subscription built on `useSyncExternalStore` rather than
 * `useEffect` + `useState`. That matters here: with the effect approach the
 * first paint always renders the mobile branch and then swaps, which on a
 * tablet shows a visible bottom tab bar for one frame before the side nav
 * replaces it. `useSyncExternalStore` reads the correct value during render.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {};
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    [query],
  );

  const getSnapshot = useCallback(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  }, [query]);

  // Server snapshot: mobile-first, since the product is a phone game.
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

/** True when the user has asked the OS to reduce transparency (iOS setting). */
export function useReducedTransparency(): boolean {
  return useMediaQuery('(prefers-reduced-transparency: reduce)');
}

/** Pointer capability, not screen size — a touch laptop still wants big targets. */
export function useCoarsePointer(): boolean {
  return useMediaQuery('(pointer: coarse)');
}

/** Hover is a progressive enhancement; never gate information behind it. */
export function useCanHover(): boolean {
  return useMediaQuery('(hover: hover)');
}
