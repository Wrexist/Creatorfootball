import { memo, type ReactNode } from 'react';
import type { Position, TraitDefinition } from '@cf/engine';
import { positionGroup } from '@cf/engine';
import { cn } from '../cn';
import { FOCUS_RING } from '../glass/glassLevel';

/* --- RatingBadge ------------------------------------------------------ */

export type RatingScale = 'overall' | 'match' | 'percent';
export type RatingSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface RatingBadgeProps {
  value: number;
  scale?: RatingScale;
  size?: RatingSize;
  /** `plate` for the card treatment, `bare` for inline numbers in a table. */
  variant?: 'plate' | 'bare';
  label?: string;
  className?: string;
}

/**
 * Five bands, not a continuous gradient.
 *
 * A gradient makes 71 and 74 look identical, which defeats the point: the
 * player is scanning a list for the one number that changes their decision.
 * Discrete bands make squad quality legible at a glance, and the top band is
 * the only place a rating is allowed to use volt.
 */
function band(value: number, scale: RatingScale): { text: string; plate: string } {
  const normalised = scale === 'match' ? (value / 10) * 100 : value;
  if (normalised >= 88) return { text: 'text-volt', plate: 'bg-volt text-volt-ink' };
  if (normalised >= 78) return { text: 'text-positive', plate: 'bg-positive/18 text-positive border border-positive/35' };
  if (normalised >= 68) return { text: 'text-ink', plate: 'bg-white/10 text-ink border border-white/14' };
  if (normalised >= 56) return { text: 'text-ink-muted', plate: 'bg-white/[0.06] text-ink-muted border border-white/10' };
  return { text: 'text-ink-dim', plate: 'bg-white/[0.04] text-ink-dim border border-white/[0.07]' };
}

const RATING_SIZE: Record<RatingSize, string> = {
  xs: 'text-[11px] min-w-6 h-5 px-1 rounded-xs',
  sm: 'text-[13px] min-w-7 h-6 px-1.5 rounded-sm',
  md: 'text-[15px] min-w-9 h-8 px-2 rounded-md',
  lg: 'text-[22px] min-w-12 h-11 px-2.5 rounded-lg',
  xl: 'text-[34px] min-w-16 h-14 px-3 rounded-xl',
};

export const RatingBadge = memo(function RatingBadge({
  value,
  scale = 'overall',
  size = 'md',
  variant = 'plate',
  label,
  className,
}: RatingBadgeProps): ReactNode {
  const tone = band(value, scale);
  const display =
    scale === 'match' ? value.toFixed(1) : scale === 'percent' ? `${Math.round(value)}%` : Math.round(value);

  return (
    <span
      className={cn(
        'tnum inline-flex items-center justify-center font-bold tracking-[-0.02em] font-display',
        RATING_SIZE[size],
        variant === 'plate' ? tone.plate : cn(tone.text, 'p-0'),
        className,
      )}
      aria-label={label}
    >
      {display}
    </span>
  );
});

/* --- PositionChip ----------------------------------------------------- */

/**
 * One hue per line of the pitch. `danger` is deliberately not used for
 * attackers even though red is the football convention — in this product red
 * already means "something went wrong", and a squad list full of red strikers
 * would train the player to ignore the colour that matters.
 */
const GROUP_TONE = {
  GK: 'bg-warning/16 text-warning border-warning/30',
  DEF: 'bg-info/16 text-info border-info/30',
  MID: 'bg-positive/16 text-positive border-positive/30',
  ATT: 'bg-special/16 text-special border-special/30',
} as const;

export interface PositionChipProps {
  position: Position;
  size?: 'xs' | 'sm' | 'md';
  /** Dim the chip when the player is filling in out of position. */
  outOfPosition?: boolean;
  className?: string;
}

export const PositionChip = memo(function PositionChip({
  position,
  size = 'sm',
  outOfPosition = false,
  className,
}: PositionChipProps): ReactNode {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-xs border font-bold uppercase tracking-[0.06em]',
        size === 'xs' && 'h-4 min-w-7 px-1 text-[9px]',
        size === 'sm' && 'h-5 min-w-8 px-1.5 text-[10px]',
        size === 'md' && 'h-6 min-w-10 px-2 text-[11px]',
        GROUP_TONE[positionGroup(position)],
        outOfPosition && 'opacity-60 line-through decoration-1',
        className,
      )}
    >
      {position}
    </span>
  );
});

/* --- TraitChip -------------------------------------------------------- */

export interface TraitChipProps {
  trait: Pick<TraitDefinition, 'id' | 'name' | 'blurb' | 'kind'>;
  size?: 'sm' | 'md';
  /** Opens the trait detail sheet. Without it the chip is static text. */
  onPress?: (traitId: string) => void;
  className?: string;
}

const TRAIT_TONE = {
  positive: 'bg-volt/12 text-volt border-volt/25',
  mixed: 'bg-warning/12 text-warning border-warning/25',
  negative: 'bg-danger/12 text-danger border-danger/28',
} as const;

export const TraitChip = memo(function TraitChip({
  trait,
  size = 'sm',
  onPress,
  className,
}: TraitChipProps): ReactNode {
  const content = (
    <>
      <span
        className={cn(
          'size-1.5 rounded-pill',
          trait.kind === 'positive' && 'bg-volt',
          trait.kind === 'mixed' && 'bg-warning',
          trait.kind === 'negative' && 'bg-danger',
        )}
        aria-hidden="true"
      />
      {trait.name}
    </>
  );

  const classes = cn(
    'inline-flex items-center gap-1.5 rounded-pill border font-semibold whitespace-nowrap',
    size === 'sm' ? 'h-6 px-2.5 text-[11px]' : 'min-h-11 px-3.5 text-[13px]',
    TRAIT_TONE[trait.kind],
    className,
  );

  if (!onPress) {
    return (
      <span className={classes} title={trait.blurb}>
        {content}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onPress(trait.id)}
      // The blurb is the whole point of a trait; an icon-free chip with a
      // tooltip-only explanation is unusable on touch, so pressing opens it.
      aria-label={`${trait.name}. ${trait.blurb}`}
      className={cn(classes, 'min-h-11 hover:brightness-125', FOCUS_RING)}
    >
      {content}
    </button>
  );
});

/* --- FormGuide -------------------------------------------------------- */

export type FormResult = 'W' | 'D' | 'L';

export interface FormGuideProps {
  /** Newest last, matching `StandingRow.form`. */
  results: readonly FormResult[];
  size?: 'sm' | 'md';
  /** Pads to this many slots with empty pips so rows stay aligned. */
  slots?: number;
  className?: string;
}

const RESULT_TONE: Record<FormResult, string> = {
  W: 'bg-positive text-void',
  D: 'bg-white/16 text-ink-muted',
  L: 'bg-danger/85 text-ink',
};

export const FormGuide = memo(function FormGuide({
  results,
  size = 'sm',
  slots,
  className,
}: FormGuideProps): ReactNode {
  const padded = slots
    ? [...Array<FormResult | null>(Math.max(0, slots - results.length)).fill(null), ...results]
    : [...results];

  return (
    <span
      className={cn('inline-flex items-center gap-1', className)}
      // Announced as one string; five separate "W" nodes is noise in a table.
      role="img"
      aria-label={`Recent form: ${results.join(', ') || 'no matches played'}`}
    >
      {padded.map((result, index) => (
        <span
          key={index}
          aria-hidden="true"
          className={cn(
            'inline-flex items-center justify-center rounded-xs font-bold',
            size === 'sm' ? 'size-4 text-[9px]' : 'size-6 text-[11px]',
            result ? RESULT_TONE[result] : 'bg-white/[0.05] text-transparent',
          )}
        >
          {result ?? '·'}
        </span>
      ))}
    </span>
  );
});
