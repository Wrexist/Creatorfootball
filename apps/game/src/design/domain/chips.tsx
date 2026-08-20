import { memo, type ReactNode } from 'react';
import type { Position, TraitDefinition } from '@cf/engine';
import { positionGroup } from '@cf/engine';
import { cn } from '../cn';
import { FOCUS_RING } from '../glass/glassLevel';
import { TYPE_CLASS } from '../typography/type';

/* --- RatingBadge ------------------------------------------------------ */

export type RatingScale = 'overall' | 'match' | 'percent';
export type RatingSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface RatingBadgeProps {
  value: number;
  scale?: RatingScale;
  size?: RatingSize;
  /** `plate` for the card treatment, `bare` for inline numbers in a table. */
  variant?: 'plate' | 'bare';
  /**
   * This rating just moved. The only condition under which a rating is allowed
   * to use the accent - a number that changed is a state, a number that is
   * merely high is data.
   */
  changed?: boolean;
  label?: string;
  className?: string;
}

/**
 * Five bands, not a continuous gradient.
 *
 * A gradient makes 71 and 74 look identical, which defeats the point: the
 * player is scanning a list for the one number that changes their decision.
 * Discrete bands make squad quality legible at a glance.
 *
 * The bands are a **neutral ramp**, not a semantic one. They used to run
 * volt / positive / ink / ink-muted / ink-dim, which meant every squad list in
 * the product carried volt elements that were data rather than state - an 89
 * overall is not "live", it is just a number, and it was competing with the
 * one genuinely actionable thing on the screen. Brightness alone separates the
 * five bands perfectly well at a glance.
 *
 * Volt returns for exactly one case, and it is a state: `changed`, a rating
 * that has just moved. That is the accent doing its job.
 */
function band(
  value: number,
  scale: RatingScale,
  changed: boolean,
): { text: string; plate: string } {
  const normalised = scale === 'match' ? (value / 10) * 100 : value;
  if (changed) return { text: 'text-volt', plate: 'bg-volt text-volt-ink' };
  if (normalised >= 88) return { text: 'text-ink', plate: 'bg-white/[0.22] text-ink border border-white/25' };
  if (normalised >= 78) return { text: 'text-ink', plate: 'bg-white/[0.14] text-ink border border-white/[0.18]' };
  if (normalised >= 68) return { text: 'text-ink', plate: 'bg-white/[0.09] text-ink border border-white/[0.13]' };
  if (normalised >= 56) return { text: 'text-ink-muted', plate: 'bg-white/[0.055] text-ink-muted border border-white/10' };
  return { text: 'text-ink-dim', plate: 'bg-white/[0.035] text-ink-dim border border-white/[0.07]' };
}

/** Sizes are rungs of the closed scale; there is no 22 or 34 any more. */
const RATING_SIZE: Record<RatingSize, string> = {
  xs: 'text-micro min-w-6 h-5 px-1 rounded-xs',
  sm: 'text-caption min-w-7 h-6 px-1.5 rounded-sm',
  md: 'text-body min-w-9 h-8 px-2 rounded-md',
  lg: 'text-title min-w-12 h-11 px-2.5 rounded-lg',
  xl: 'text-display min-w-16 h-14 px-3 rounded-xl',
};

export const RatingBadge = memo(function RatingBadge({
  value,
  scale = 'overall',
  size = 'md',
  variant = 'plate',
  changed = false,
  label,
  className,
}: RatingBadgeProps): ReactNode {
  const tone = band(value, scale, changed);
  const display =
    scale === 'match' ? value.toFixed(1) : scale === 'percent' ? `${Math.round(value)}%` : Math.round(value);

  return (
    <span
      className={cn(
        'num-broadcast inline-flex items-center justify-center font-bold tracking-[-0.03em]',
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
 * A position is a **category, not a state**, so it gets a neutral ramp.
 *
 * This used to spend four of the five semantic tokens - warning on keepers,
 * info on defenders, positive on midfielders, special on attackers - on a label
 * that appears on every player row in the product. Once a goalkeeper is
 * permanently amber and a striker permanently purple, an actual warning and an
 * actual rule card have nothing left to say. The source comment showed the team
 * had already reasoned its way to not using `danger` here; the same reasoning
 * applies to the other four.
 *
 * It also failed contrast, and for the reason every contrast failure in this
 * product failed: **a token painted onto a tint of its own hue.** `info` on
 * `glass-2` is a comfortable 6.05:1; `info` on `info/16` measured 3.88:1, and
 * `outOfPosition`'s `opacity-60` took it to roughly 2.5:1.
 *
 * The replacement carries the line of the pitch in *brightness* rather than
 * hue - four steps of white, back to front - and puts the text on the surface
 * rather than on its own colour. Measured on glass-1 over base: 6.45:1 at the
 * front, 6.80:1 at the back.
 */
const GROUP_TONE = {
  GK: 'bg-white/[0.04] text-ink-muted border-white/[0.14]',
  DEF: 'bg-white/[0.05] text-ink-muted border-white/[0.16]',
  MID: 'bg-white/[0.06] text-ink-muted border-white/[0.18]',
  ATT: 'bg-white/[0.08] text-ink border-white/[0.22]',
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
        'inline-flex items-center justify-center rounded-xs border font-bold uppercase tracking-[0.08em]',
        // Every size sits at or above the scale's 11px floor. The old xs and sm
        // steps were 9px and 10px, which is where the 3.88:1 measurement came
        // from as much as the tint did.
        TYPE_CLASS.micro,
        'text-micro text-ink-muted',
        size === 'xs' && 'h-[18px] min-w-7 px-1',
        size === 'sm' && 'h-5 min-w-8 px-1.5',
        size === 'md' && 'h-6 min-w-10 px-2',
        GROUP_TONE[positionGroup(position)],
        // Never `opacity`: dimming a chip that already sits at 6.4:1 is what
        // took it to 2.5:1. A line-through says "out of position" on its own.
        outOfPosition && 'line-through decoration-1 decoration-ink-faint',
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
    size === 'sm' ? 'h-6 px-2.5 text-micro normal-case' : 'min-h-11 px-3.5 text-caption',
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
            // 18px, not 16px: the glyph inside was 9px, two rungs below the
            // scale's floor, and a form guide is scanned at arm's length.
            size === 'sm' ? 'size-[18px] text-micro' : 'size-6 text-caption',
            result ? RESULT_TONE[result] : 'bg-white/[0.05] text-transparent',
          )}
        >
          {result ?? '·'}
        </span>
      ))}
    </span>
  );
});
