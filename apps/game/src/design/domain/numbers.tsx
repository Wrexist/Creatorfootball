import { memo, useEffect, useRef, type ReactNode } from 'react';
import { useMotionValue, useMotionValueEvent, useSpring } from 'motion/react';
import { cn } from '../cn';
import { useDesignMotion } from '../motion';
import { IconTrendDown, IconTrendUp } from '../icons';

/* --- Counter ---------------------------------------------------------- */

export interface CounterProps {
  value: number;
  /** Digits after the decimal point. */
  decimals?: number;
  prefix?: string;
  suffix?: string;
  /** Group thousands. Off for ratings and scores. */
  grouped?: boolean;
  className?: string;
}

/**
 * Animated number.
 *
 * The rolling value is written straight to the DOM node from the motion value
 * rather than through React state. A spring at 60fps through `useState` would
 * re-render this component — and everything it is nested inside — sixty times a
 * second; for a finance screen with eight counters that is the difference
 * between smooth and unusable.
 */
export const Counter = memo(function Counter({
  value,
  decimals = 0,
  prefix = '',
  suffix = '',
  grouped = true,
  className,
}: CounterProps): ReactNode {
  const m = useDesignMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const raw = useMotionValue(value);
  const spring = useSpring(raw, { stiffness: 90, damping: 22, mass: 1 });

  const format = (n: number): string => {
    const fixed = n.toFixed(decimals);
    if (!grouped) return `${prefix}${fixed}`;
    const [intPart = '0', fraction] = fixed.split('.');
    const grouped_ = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `${prefix}${grouped_}${fraction ? `.${fraction}` : ''}`;
  };

  useEffect(() => {
    if (m.reduced) {
      // No tween at all: the number is information, and an information change
      // must be instant when the user has asked for less movement.
      raw.jump(value);
      if (ref.current) ref.current.textContent = format(value);
      return;
    }
    raw.set(value);
    // `format` closes over props that are stable in practice; re-running on
    // every render would restart the spring mid-flight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, m.reduced]);

  useMotionValueEvent(spring, 'change', (latest) => {
    if (ref.current) ref.current.textContent = format(latest);
  });

  return (
    <span className={cn('tnum', className)}>
      {/* The static child is the accessible value: screen readers announce a
          settled number, never the mid-animation garbage. */}
      <span ref={ref} aria-hidden="true">
        {format(value)}
      </span>
      <span className="sr-only">{format(value)}{suffix}</span>
      {suffix ? <span aria-hidden="true">{suffix}</span> : null}
    </span>
  );
});

/* --- MoneyLabel ------------------------------------------------------- */

let currencySymbol = '£';
/** Set once at boot if a content pack declares a different currency glyph. */
export const setCurrencySymbol = (symbol: string): void => {
  currencySymbol = symbol;
};

export function formatMoney(amount: number, compact = true): string {
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);
  if (!compact) return `${sign}${currencySymbol}${Math.round(abs).toLocaleString('en-GB')}`;
  if (abs >= 1_000_000_000) return `${sign}${currencySymbol}${(abs / 1_000_000_000).toFixed(abs >= 10_000_000_000 ? 0 : 1)}B`;
  if (abs >= 1_000_000) return `${sign}${currencySymbol}${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2)}M`;
  if (abs >= 1_000) return `${sign}${currencySymbol}${(abs / 1_000).toFixed(abs >= 100_000 ? 0 : 1)}K`;
  return `${sign}${currencySymbol}${Math.round(abs)}`;
}

/**
 * A delta, formatted for a human.
 *
 * This is the default `TrendIndicator` uses, and it exists because the old
 * default did not round: any caller that omitted `deltaFormat` inherited raw
 * float passthrough, and the post-match screen printed
 * `-8.157399521093865` - twice, on a tile whose *value* was rounded while its
 * delta was not. Anything that can reach a screen unrounded eventually will.
 *
 * The rule: integers keep their precision and get thousands separators; a
 * fraction is rounded to one decimal below 100 and to a whole number above it,
 * where a tenth of a point is noise. Callers who need something else pass
 * `format`, which is still honoured in full.
 */
export function formatDelta(value: number, decimals?: number): string {
  const abs = Math.abs(value);
  const places = decimals ?? (Number.isInteger(abs) ? 0 : abs < 100 ? 1 : 0);
  const rounded = Number(abs.toFixed(places));
  // Sign comes from the *rounded* magnitude, so a delta of -0.0001 reads as
  // "0" rather than the nonsense "-0".
  const sign = rounded === 0 ? '' : value > 0 ? '+' : '-';
  return `${sign}${rounded.toLocaleString('en-GB', {
    minimumFractionDigits: 0,
    maximumFractionDigits: places,
  })}`;
}

/**
 * A duration, in the product's one unit of time: the week.
 *
 * The engine calls its tick a "cycle" and that vocabulary had leaked into the
 * interface, so the same field read as "a week" on one screen, "a cycle" on the
 * next, and `63w` in an element whose tooltip said "63 cycles remaining".
 * Players understand matchweeks. Every duration the kit renders comes through
 * here, so the three cannot drift apart again.
 */
export function formatWeeks(weeks: number, style: 'short' | 'long' = 'short'): string {
  const n = Math.max(0, Math.round(weeks));
  if (style === 'short') return `${n}w`;
  return n === 1 ? '1 week' : `${n} weeks`;
}

/** Follower counts, impressions, attendance — anywhere a raw integer is noise. */
export function formatCount(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(abs >= 100_000 ? 0 : 1)}K`;
  return String(Math.round(value));
}

const SIDE_WORDS = new Map([
  [5, 'five'], [6, 'six'], [7, 'seven'], [8, 'eight'], [9, 'nine'],
  [10, 'ten'], [11, 'eleven'],
]);

/**
 * The size of a side, as words, because "your predicted eleven" is copy while
 * "your predicted 7" is a spreadsheet. This league fields seven; other packs
 * may field eleven — the word follows the config rather than assuming either.
 */
export function sidesWord(count: number): string {
  return SIDE_WORDS.get(count) ?? String(count);
}

/**
 * A league position, as it is said aloud: "3rd", never "3th". The teen
 * exceptions are why this is not a modulo one-liner.
 */
export function ordinal(position: number): string {
  const n = Math.round(position);
  const rem100 = ((n % 100) + 100) % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (((n % 10) + 10) % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

export interface MoneyLabelProps {
  amount: number;
  compact?: boolean;
  /** Colour by sign. Off for neutral figures like a market value. */
  signed?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const MONEY_SIZE = {
  sm: 'text-caption',
  md: 'text-body',
  lg: 'text-title',
  xl: 'text-hero num-broadcast font-extrabold tracking-[-0.04em]',
} as const;

export const MoneyLabel = memo(function MoneyLabel({
  amount,
  compact = true,
  signed = false,
  size = 'md',
  className,
}: MoneyLabelProps): ReactNode {
  return (
    <span
      className={cn(
        'tnum font-semibold',
        MONEY_SIZE[size],
        signed && amount > 0 && 'text-positive',
        signed && amount < 0 && 'text-danger',
        className,
      )}
    >
      {signed && amount > 0 ? '+' : ''}
      {formatMoney(amount, compact)}
    </span>
  );
});

/* --- TrendIndicator --------------------------------------------------- */

export interface TrendIndicatorProps {
  /** Positive means "went up". Whether up is *good* is `invert`'s job. */
  delta: number;
  /** For metrics where rising is bad: debt, wage bill, injury count. */
  invert?: boolean;
  format?: (value: number) => string;
  /** Decimal places for the default format. Omit to let `formatDelta` decide. */
  decimals?: number;
  size?: 'sm' | 'md';
  /** Hide the number and show direction only. */
  iconOnly?: boolean;
  className?: string;
}

export const TrendIndicator = memo(function TrendIndicator({
  delta,
  invert = false,
  format,
  decimals,
  size = 'sm',
  iconOnly = false,
  className,
}: TrendIndicatorProps): ReactNode {
  const flat = Math.abs(delta) < 0.0001;
  const up = delta > 0;
  const good = invert ? !up : up;
  const Icon = up ? IconTrendUp : IconTrendDown;
  // Never raw passthrough. A caller's `format` still wins outright.
  const text = format ? format(delta) : formatDelta(delta, decimals);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-semibold tnum',
        size === 'sm' ? 'text-label' : 'text-body',
        flat ? 'text-ink-dim' : good ? 'text-positive' : 'text-danger',
        className,
      )}
      aria-label={flat ? 'No change' : `${good ? 'Up' : 'Down'} ${text}`}
    >
      {!flat && <Icon size={size === 'sm' ? 14 : 16} />}
      {!iconOnly && <span aria-hidden="true">{flat ? '—' : text}</span>}
    </span>
  );
});

/* --- ScoreDisplay ----------------------------------------------------- */

export interface ScoreDisplayProps {
  home: number;
  away: number;
  size?: 'sm' | 'md' | 'lg' | 'hero';
  /** Shown between the numbers: minute, "FT", "HT". */
  status?: ReactNode;
  live?: boolean;
  homeLabel?: string;
  awayLabel?: string;
  className?: string;
}

/**
 * Broadcast sizing. The tracking tightens as the figures grow: at 68px the
 * default side bearings on tabular numerals leave the pair reading as two
 * separate numbers instead of one scoreline.
 */
const SCORE_SIZE = {
  sm: 'text-section tracking-[-0.03em]',
  md: 'text-hero tracking-[-0.045em]',
  lg: 'text-display tracking-[-0.055em]',
  hero: 'text-takeover tracking-[-0.065em]',
} as const;

export const ScoreDisplay = memo(function ScoreDisplay({
  home,
  away,
  size = 'md',
  status,
  live = false,
  homeLabel = 'Home',
  awayLabel = 'Away',
  className,
}: ScoreDisplayProps): ReactNode {
  return (
    <div
      className={cn('inline-flex flex-col items-center', className)}
      role="group"
      aria-label={`${homeLabel} ${home}, ${awayLabel} ${away}`}
    >
      <div
        className={cn(
          'num-broadcast flex items-baseline gap-2 font-extrabold leading-none text-ink',
          SCORE_SIZE[size],
        )}
        aria-hidden="true"
      >
        <span>{home}</span>
        <span className="text-ink-dim">–</span>
        <span>{away}</span>
      </div>
      {(status !== undefined || live) && (
        <div className="mt-1 flex items-center gap-1.5">
          {live && (
            <span className="relative flex size-1.5" aria-hidden="true">
              <span className="absolute inline-flex size-full animate-ping rounded-pill bg-danger opacity-70" />
              <span className="relative inline-flex size-1.5 rounded-pill bg-danger" />
            </span>
          )}
          <span className={cn('num-live text-label', live ? 'text-danger' : 'text-ink-muted')}>
            {status}
          </span>
        </div>
      )}
    </div>
  );
});
