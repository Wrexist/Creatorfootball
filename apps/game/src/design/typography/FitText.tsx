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
 * The strategy. Each candidate string is put through both steps before the
 * next, shorter candidate is considered at all - a complete name that has to
 * wrap beats a shortened one that does not:
 *
 *   1. One line, stepping the size down through the scale toward the floor.
 *      Anything from 100% to the floor is a legitimate result; a 15px name at
 *      12px is still a name.
 *   2. If a line budget was given (`lines` > 1), wrap and step down again.
 *   3. Move to the next `alternates` entry - the short name, then the
 *      three-letter abbreviation - and repeat from step 1 at full size.
 *   4. Last resort: the shortest candidate, at the floor, wrapped, allowed to
 *      break mid-word. It may look tight. It will never be an ellipsis.
 *
 * A size only counts as fitting if it clears the floor *before* it is snapped
 * onto the scale, which is the subtle part: snapping clamps to the floor, so an
 * unguarded check accepts a string that needs 4px as though 11px were enough.
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
  /** Starting (and maximum) font size in px. Must be a rung of the scale. */
  size?: number;
  /** Take the ceiling from a type role instead of naming a number. Preferred. */
  role?: TypeRole;
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
  /**
   * Allow a break inside a word. Only ever true in the last-resort case: a name
   * broken as "Kings / way" is worse than the abbreviation, so an unbreakable
   * single-word candidate is passed over rather than snapped in half.
   */
  readonly breakAnywhere: boolean;
}

const SEP = '\u001F';

export function FitText({
  children,
  size,
  role,
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
  // Ceiling from an explicit size, else from the role, else the body step.
  const ceiling = size ?? (role ? TYPE_SIZE[role] : TYPE_SIZE.body);
  // The floor can be raised by a caller but never lowered past the scale's own.
  const floor = Math.max(TYPE_FLOOR, min);
  const quantise = useCallback(
    (value: number): number => (snap ? snapToScale(value) : Math.floor(value * 2) / 2),
    [snap],
  );

  const hostRef = useRef<HTMLElement | null>(null);
  const textRef = useRef<HTMLSpanElement | null>(null);
  const lastWidth = useRef(-1);
  const [fitted, setFitted] = useState<Fitted>({
    text: children, size: ceiling, wrap: lines > 1, breakAnywhere: false,
  });

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

    // Candidates outer, strategies inner. A *complete* name that has to wrap is
    // better than a shortened one that does not, so every strategy is exhausted
    // on the full string before the short name is considered at all.
    //
    // The `required` size is compared against the floor BEFORE it is snapped:
    // snapping clamps to the floor, so a candidate needing 4px would come back
    // as 11px and be accepted while still overflowing by 140px.
    const RAG_LOSS = 0.86; // ragged right-hand edge; a wrapped line is never full
    for (const candidate of pool) {
      node.textContent = candidate;
      const naturalAtReference = node.scrollWidth;
      if (naturalAtReference <= 0) continue;

      const oneLine = ((available - 0.5) / naturalAtReference) * REFERENCE;
      if (oneLine >= floor) {
        result = {
          text: candidate, size: Math.min(ceiling, quantise(oneLine)),
          wrap: false, breakAnywhere: false,
        };
        break;
      }

      // Wrapping needs somewhere to break. A single word has none, so
      // "Kingsway" moves on to "KWR" instead of becoming "Kings / way".
      if (lines > 1 && /\s/.test(candidate)) {
        const wrapped = ((available * lines * RAG_LOSS) / naturalAtReference) * REFERENCE;
        if (wrapped >= floor) {
          result = {
            text: candidate, size: Math.min(ceiling, quantise(wrapped)),
            wrap: true, breakAnywhere: false,
          };
          break;
        }
      }
    }

    node.style.whiteSpace = previousWhiteSpace;
    node.style.fontSize = previousFontSize;
    node.textContent = previousText;

    // Last resort: the shortest candidate, at the floor, wrapped and allowed to
    // break mid-word. Wrapping is forced here even when the caller asked for one
    // line, because the alternative is horizontal overflow - and between a name
    // that takes two lines and a name that runs off the card, the name wins.
    const next = result ?? { text: floorText, size: floor, wrap: true, breakAnywhere: true };

    setFitted((current) =>
      current.text === next.text && current.size === next.size && current.wrap === next.wrap
        ? current
        : next,
    );
  }, [candidateKey, ceiling, floor, quantise, lines]);

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
          overflowWrap: fitted.breakAnywhere ? 'anywhere' : 'normal',
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

/* --- FitBox ------------------------------------------------------------ */

export interface FitBoxProps {
  /** Anything: a `Counter`, a formatted figure, an icon and a number. */
  children: ReactNode;
  /** Ceiling size in px. Must be a rung of the scale. */
  size?: number;
  /** Take the ceiling from a type role instead of naming a number. */
  role?: TypeRole;
  /** Floor, clamped to the scale's own. */
  min?: number;
  snap?: boolean;
  as?: 'span' | 'div';
  className?: string;
}

/**
 * `FitText` for content that is not a plain string.
 *
 * A stat card's value is the case this exists for: `£8,400,000` set at the hero
 * step is 250px wide in a 170px card, and the value is often an animated
 * `Counter` that writes to the DOM node itself rather than through React, so
 * there is no string to measure ahead of time. `FitBox` measures whatever ended
 * up inside it and scales the whole box down to fit.
 *
 * It re-measures on every render and on every resize. That is affordable
 * because the measurement always starts from the ceiling size, so the result
 * does not depend on the current state and cannot oscillate - and because a
 * stat card only re-renders when its value changes. An idle screen does no
 * work here at all.
 */
export function FitBox({
  children, size, role, min = TYPE_FLOOR, snap = true, as = 'div', className,
}: FitBoxProps): ReactNode {
  const ceiling = size ?? (role ? TYPE_SIZE[role] : TYPE_SIZE.body);
  const floor = Math.max(TYPE_FLOOR, min);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLSpanElement | null>(null);
  const [fontSize, setFontSize] = useState(ceiling);

  // Deliberately no dependency array: the box re-measures whenever its children
  // change, and those children are arbitrary nodes with no stable identity to
  // depend on. It cannot loop - the measurement resets to `ceiling` before
  // reading, so the result is a pure function of the container width and the
  // content, never of the current state, and the setter bails out when the
  // answer is unchanged.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const host = hostRef.current;
    const inner = innerRef.current;
    if (!host || !inner) return;
    const available = host.clientWidth;
    if (available <= 0) return;

    inner.style.fontSize = `${ceiling}px`;
    const natural = inner.scrollWidth;
    inner.style.fontSize = `${fontSize}px`;
    if (natural <= 0) return;

    const required = ((available - 0.5) / natural) * ceiling;
    const next = required >= ceiling
      ? ceiling
      : Math.max(floor, snap ? snapToScale(required) : Math.floor(required * 2) / 2);
    setFontSize((current) => (current === next ? current : next));
  });

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => setFontSize(ceiling));
    observer.observe(host);
    return () => observer.disconnect();
  }, [ceiling]);

  const Host = as;
  return (
    <Host ref={hostRef as React.Ref<never>} className={cn('block min-w-0 max-w-full', className)}>
      <span
        ref={innerRef}
        className="block whitespace-nowrap"
        style={{ fontSize: `${fontSize}px` }}
      >
        {children}
      </span>
    </Host>
  );
}
