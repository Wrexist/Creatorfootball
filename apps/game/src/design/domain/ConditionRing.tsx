import { memo, type ReactNode } from 'react';
import { cn } from '../cn';
import { useSvgId } from '../useSvgId';

/**
 * Match freshness, drawn as a ring around whatever it wraps.
 *
 * Fitness is the number a manager checks most and the one that used to be
 * hardest to see: on the team sheet it existed only as a sentence in the
 * warnings panel, and only once a player had already dropped below 60. By then
 * the decision it should have informed — who starts — has been made.
 *
 * A ring is the right shape for it because it costs no layout. A bar under a
 * portrait pushes every token taller and forces the pitch to shrink; a ring
 * lives in the two or three pixels around the portrait that were padding
 * anyway, and reads as a quantity at a glance without being read as a number.
 *
 * The arc runs clockwise from twelve o'clock, which is the convention every
 * progress ring on a phone already uses, so nobody has to learn it.
 *
 * ## Why the colour bands are wide
 *
 * Three bands, not a continuous hue ramp: a colour that shifts a little for
 * every point of fitness communicates precision the underlying number does not
 * have, and asks the player to compare two nearly identical greens. The bands
 * are the decision — fine, tiring, do not start him — and the arc length
 * carries the detail.
 */

/** Below this a player is visibly struggling and should not be starting. */
const SPENT = 60;
/** Below this they will not last the match at full intensity. */
const TIRING = 80;

export type ConditionTone = 'fresh' | 'tiring' | 'spent';

export function conditionToneFor(fitness: number): ConditionTone {
  if (fitness < SPENT) return 'spent';
  if (fitness < TIRING) return 'tiring';
  return 'fresh';
}

const TONE_STROKE: Record<ConditionTone, string> = {
  fresh: 'var(--color-positive)',
  tiring: 'var(--color-warning)',
  spent: 'var(--color-danger)',
};

/** Plain-language summary, so the ring is not the only way to know. */
export function conditionLabel(fitness: number): string {
  const tone = conditionToneFor(fitness);
  const rounded = Math.round(fitness);
  if (tone === 'spent') return `${rounded}% fitness — needs a rest`;
  if (tone === 'tiring') return `${rounded}% fitness — will tire`;
  return `${rounded}% fitness`;
}

export interface ConditionRingProps {
  /** 0–100. Clamped, so an engine value slightly out of range cannot break the arc. */
  fitness: number;
  /** Outer diameter in px, including the ring. */
  size: number;
  /** Ring thickness in px. */
  thickness?: number;
  /**
   * Unavailable players — injured or suspended — get a flat dim track and no
   * arc. Their fitness is real but irrelevant: they cannot play, and a healthy
   * green ring on a player who is out is worse than no ring at all.
   */
  unavailable?: boolean;
  /** The portrait, or anything else that should sit inside the ring. */
  children: ReactNode;
  className?: string;
}

export const ConditionRing = memo(function ConditionRing({
  fitness, size, thickness = 2.5, unavailable = false, children, className,
}: ConditionRingProps): ReactNode {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(fitness) ? fitness : 0));
  const id = useSvgId('condition');
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const tone = conditionToneFor(clamped);

  return (
    <span
      className={cn('relative inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="pointer-events-none absolute inset-0 size-full"
        // The ring is a second reading of a number the label already carries,
        // so it is decoration to a screen reader.
        aria-hidden="true"
        focusable="false"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgb(255 255 255 / 0.14)"
          strokeWidth={thickness}
        />
        {!unavailable && clamped > 0 && (
          <circle
            id={id}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={TONE_STROKE[tone]}
            strokeWidth={thickness}
            strokeLinecap="round"
            strokeDasharray={`${(circumference * clamped) / 100} ${circumference}`}
            // Start at twelve o'clock rather than three, which is where SVG
            // starts and where nobody expects a progress ring to.
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </svg>
      <span
        className="relative flex items-center justify-center"
        style={{ width: size - thickness * 2 - 2, height: size - thickness * 2 - 2 }}
      >
        {children}
      </span>
    </span>
  );
});
