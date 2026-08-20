import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/design';

/**
 * Text that is sized to fit rather than cut off.
 *
 * A club is called what it is called. "Saltpit Wanderers…" is not a shorter
 * name, it is a broken one, and a table full of them stops being a table of
 * clubs and becomes a table of prefixes. So instead of clipping, this measures
 * the space it has been given and steps the type down — one pixel at a time,
 * never below `min` — until the whole name is on screen.
 *
 * The floor matters as much as the ceiling: below about 11px a name is present
 * but not legible, so when even `min` will not do it, the text wraps onto the
 * allowed number of lines instead. Nothing is ever hidden.
 *
 * The design-system workstream is landing a shared text-fitting primitive; when
 * it does this file becomes a re-export and the screens do not change.
 */

export interface FitTextProps {
  children: string;
  /** Preferred size in px. Used whenever the text fits at it. */
  max: number;
  /** Never shrink past this. Below it, wrap instead. */
  min: number;
  /** Lines the text may occupy before shrinking starts. */
  lines?: number;
  /** Multiplier on font size. Tight for display type, looser for body. */
  leading?: number;
  className?: string;
  title?: string;
}

export function FitText({
  children,
  max,
  min,
  lines = 1,
  leading = 1.15,
  className,
  title,
}: FitTextProps): ReactNode {
  const inner = useRef<HTMLSpanElement>(null);
  const [size, setSize] = useState(max);

  const fit = useCallback(() => {
    const el = inner.current;
    const box = el?.parentElement;
    if (!el || !box) return;
    const available = box.clientWidth;
    if (available <= 0) return;

    let next = max;
    const apply = (px: number): void => {
      el.style.fontSize = `${px}px`;
      el.style.lineHeight = `${Math.round(px * leading)}px`;
    };
    apply(next);

    // Height is the honest test for both cases: at one line it catches an
    // overflowing word, at two it catches a name that needs a third.
    const limit = (px: number): number => Math.round(px * leading) * lines + 1;
    while (next > min && (el.scrollHeight > limit(next) || el.scrollWidth > available + 0.5)) {
      next -= 1;
      apply(next);
    }
    setSize((current) => (current === next ? current : next));
  }, [max, min, lines, leading]);

  useLayoutEffect(() => {
    fit();
    const box = inner.current?.parentElement;
    if (!box || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(fit);
    observer.observe(box);
    return () => observer.disconnect();
  }, [fit, children]);

  return (
    <span className={cn('block min-w-0', className)} title={title}>
      <span
        ref={inner}
        className="block break-words hyphens-auto"
        style={{ fontSize: `${size}px`, lineHeight: `${Math.round(size * leading)}px` }}
      >
        {children}
      </span>
    </span>
  );
}
