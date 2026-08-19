import { useId } from 'react';

/**
 * A React `useId()` value safe to use inside an SVG `url(#...)` reference.
 *
 * React's generated ids contain characters that are not valid in an SVG
 * fragment identifier (React 19 wraps them in guillemets, React 18 in colons).
 * Referencing one from `fill="url(#…)"` silently fails: gradients disappear and
 * clip paths stop clipping, which in a procedural-art component looks like a
 * design mistake rather than a bug. Strip everything that is not id-safe once,
 * here, so no component has to remember.
 */
export function useSvgId(prefix: string): string {
  const raw = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  return `${prefix}-${raw || 'x'}`;
}
