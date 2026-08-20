import {
  useCallback, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode,
} from 'react';
import { cn } from '../cn';
import { snapToScale, TYPE_FLOOR, TYPE_SIZE, type TypeRole } from './type';

/**
 * Text that fits its container instead of being cut off.
 *
 * The rule this primitive exists to enforce: **a club, player or creator name
 * never ends in an ellipsis.** "Saltp..." is not a shorter name, it is a broken
 * one - the player cannot read it, cannot search for it, and cannot tell two
 * clubs apart by it. Long *body copy* clamping to three lines is a different
 * thing and remains fine; this is about identity.
 *
 * The strategy, in the order it is attempted:
 *
 *   1. Render the full string at the requested size. If it fits, stop.
 *   2. Step the type size down toward `min`. Anything from 100% down to the
 *      floor is a legitimate result - a 15px name at 13px is still a name.
 *   3. If the floor is still too wide, swap in the next `alternates` entry
 *      (short name, then three-letter abbreviation) and start again at full
 *      size. A short name at full size beats a full name at 9px.
 *   4. If wrapping is allowed (`lines` > 1), wrap and step down until the
 *      block fits the line budget.
 *   5. Floor of last resort: the shortest candidate, at `min`, wrapped and
 *      allowed to break. It may look tight. It will never be an ellipsis.
 *
 * Measurement is one forced reflow per resize, not a search loop: the natural
 * single-line width is read once at a reference size and the required scale is
 * arithmetic from there. The observer watches the *outer* element (whose width
 * is set by the parent layout) rather than the text, so resizing the text can
 * never feed back into another measurement.
 */

export interface FitTextProps {
  /** The string to fit. Must be a string - this primitive measures text. */
  children: string;
  /** Starting (and maximum) font size in px. */
  size?: number;
  /**
   * Smallest size this text may shrink to before other strategies apply.
   * Clamped to the scale's 11px floor - nothing in the product renders text
   * smaller than that, including text that got there by being fitted.
   */
  min?: number;
  /**
   * Land the fitted size on a rung of the type scale rather than anywhere
   * between two. On by default: the scale is closed, and a size the machine
   * chose is no more allowed off it than a size a developer chose. Turn it off
   * only for a genuinely continuous case, such as a wordmark.
   */
  snap?: boolean;
  /**
   * Progressively shorter stand-ins, longest first, e.g.
   * `['Saltpine Harriers United', 'Saltpine', 'SPH']`. `children` is always
   * tried first; these are only reached once the floor size fails.
   */
  alternates?: readonly string[];
  /** Line budget. 1 keeps it on one line; 2 lets a long name wrap. */
  lines?: number;
  /** Line height multiplier used for the wrapped budget. */
  lineHeight?: number;
  /** Rendered element. `span` by default so it can sit inline in a row. */
  as?: 'span' | 'p' | 'h1' | 'h2' | 'h3' | 'div';
  /**
   * The full, unabbreviated string for assistive tech, if `children` is
   * already an abbreviation. Defaults to `children`.
   */
  title?: string;
  className?: string;
  style?: CSSProperties;
}

interface Fitted {
  readonly text: string;
  readonly size: number;
  readonly wrap: boolean;
}

const SEP = '\u001F';

export function FitText({
  children,
  size = 15,
  min = TYPE_FLOOR,
  snap = true,
  alternates,
  lines = 1,
  lineHeight = 1.15,
  as = 'span',
  title,
  className,
  style,
}: FitTextProps): ReactNode {
  // The floor can be raised by a caller but never lowered past the scale's own.
  const floor = Math.max(TYPE_FLOOR, min);
  const quantise = useCallback(
    (value: number): number => (snap ? snapToScale(value) : Math.floor(value * 2) / 2),
    [snap],
  );

  const hostRef = useRef<HTMLElement | null>(null);
  const textRef = useRef<HTMLSpanElement | null>(null);
  const lastWidth = useRef(-1);
  const [fitted, setFitted] = useState<Fitted>({ text: children, size, wrap: lines > 1 });

  // Candidates, longest first, de-duplicated. The full string always leads.
  // Packed onto the ASCII unit separator so the measuring callback has one
  // plain string dependency; names contain spaces, so a space would not do.
  // Joined with a separator no name contains, so the memo key is a plain string.
  const candidateKey = [
    children,
    ...(alternates ?? []).filter((a) => a.length > 0 && a !== children),
  ].join(SEP);

  const measure = useCallback((): void => {
    const host = hostRef.current;
    const node = textRef.current;
    if (!host || !node) return;

    const available = host.clientWidth;
    if (available <= 0) return;

    const pool = candidateKey.split(SEP);
    const floorText = pool[pool.length - 1] ?? '';

    // Measure at a known reference size and scale arithmetically. One write and
    // one read per candidate, no binary search.
    const REFERENCE = 100;
    const previousWhiteSpace = node.style.whiteSpace;
    const previousFontSize = node.style.fontSize;
    const previousText = node.textContent;
    node.style.whiteSpace = 'nowrap';
    node.style.fontSize = `${REFERENCE}px`;

    let result: Fitted | null = null;

    for (const candidate of pool) {
      node.textContent = candidate;
      const naturalAtReference = node.scrollWidth;
      if (naturalAtReference <= 0) continue;
      // Largest size at which this candidate fits on one line. The half pixel
      // of slack absorbs sub-pixel rounding in the layout above us.
      const exact = ((available - 0.5) / naturalAtReference) * REFERENCE;
      const fittedSize = quantise(exact);
      if (fittedSize >= size) {
        result = { text: candidate, size, wrap: false };
        break;
      }
      if (fittedSize >= floor) {
        result = { text: candidate, size: fittedSize, wrap: false };
        break;
      }
    }

    // Nothing fits on one line. Spend the line budget instead: with N lines
    // available a string can be roughly N times as wide, minus the ragging
    // loss at each break.
    if (!result && lines > 1) {
      const RAG_LOSS = 0.86;
      for (const candidate of pool) {
        node.textContent = candidate;
        const naturalAtReference = node.scrollWidth;
        if (naturalAtReference <= 0) continue;
        const exact = ((available * lines * RAG_LOSS) / naturalAtReference) * REFERENCE;
        const fittedSize = Math.min(size, quantise(exact));
        if (fittedSize >= floor) {
          result = { text: candidate, size: fittedSize, wrap: true };
          break;
        }
      }
    }

    node.style.whiteSpace = previousWhiteSpace;
    node.style.fontSize = previousFontSize;
    node.textContent = previousText;

    const next = result ?? { text: floorText, size: floor, wrap: lines > 1 };

    setFitted((current) =>
      current.text === next.text && current.size === next.size && current.wrap === next.wrap
        ? current
        : next,
    );
  }, [candidateKey, size, floor, quantise, lines]);

  useLayoutEffect(() => {
    lastWidth.current = -1;
    measure();
  }, [measure]);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      // Re-measuring only on a real width change is what stops the observer
      // from chasing its own font-size writes around a loop.
      if (Math.abs(width - lastWidth.current) < 0.5) return;
      lastWidth.current = width;
      measure();
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, [measure]);

  const Host = as;
  const accessible = title ?? children;
  const abbreviated = fitted.text !== accessible;

  return (
    <Host
      ref={hostRef as React.Ref<never>}
      className={cn('name-safe block min-w-0 max-w-full', className)}
      style={style}
      {...(abbreviated ? { title: accessible } : {})}
    >
      <span
        ref={textRef}
        aria-hidden={abbreviated ? true : undefined}
        style={{
          fontSize: `${fitted.size}px`,
          lineHeight: fitted.wrap ? lineHeight : undefined,
          whiteSpace: fitted.wrap ? 'normal' : 'nowrap',
          display: 'block',
        }}
      >
        {fitted.text}
      </span>
      {/* When the visible text is an abbreviation, the full name still reaches
          assistive tech. Nothing is ever silently lost. */}
      {abbreviated && <span className="sr-only">{accessible}</span>}
    </Host>
  );
}

/**
 * Convenience wrapper for the commonest case in this product: an entity name
 * in a fixed-width slot, with its own short forms as the fallbacks.
 *
 * Passing `short` and `abbr` is what turns a clip into a deliberate
 * abbreviation. A component that has them and does not pass them is the bug.
 */
export interface EntityNameProps extends Omit<FitTextProps, 'children' | 'alternates'> {
  name: string;
  short?: string;
  abbr?: string;
}

export function EntityName({ name, short, abbr, ...rest }: EntityNameProps): ReactNode {
  const alternates = [short, abbr].filter((v): v is string => typeof v === 'string' && v.length > 0);
  return (
    <FitText {...rest} alternates={alternates} title={name}>
      {name}
    </FitText>
  );
}
