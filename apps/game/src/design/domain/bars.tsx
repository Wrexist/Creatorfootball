import { memo, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { cn } from '../cn';
import { useDesignMotion } from '../motion';
import { useSvgId } from '../useSvgId';

/* --- ProgressBar ------------------------------------------------------ */

export type BarTone = 'volt' | 'positive' | 'warning' | 'danger' | 'info' | 'special' | 'neutral';

const BAR_FILL: Record<BarTone, string> = {
  volt: 'bg-volt',
  positive: 'bg-positive',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
  special: 'bg-special',
  neutral: 'bg-ink-muted',
};

export interface ProgressBarProps {
  value: number;
  max?: number;
  tone?: BarTone;
  size?: 'xs' | 'sm' | 'md';
  label?: ReactNode;
  /** Right-aligned value text, e.g. "3 / 5". */
  valueLabel?: ReactNode;
  /** A dashed mark for a target or threshold. */
  marker?: number;
  animated?: boolean;
  className?: string;
}

const BAR_HEIGHT = { xs: 'h-1', sm: 'h-1.5', md: 'h-2.5' } as const;

export const ProgressBar = memo(function ProgressBar({
  value,
  max = 100,
  tone = 'volt',
  size = 'sm',
  label,
  valueLabel,
  marker,
  animated = true,
  className,
}: ProgressBarProps): ReactNode {
  const m = useDesignMotion();
  const pct = max <= 0 ? 0 : Math.max(0, Math.min(1, value / max)) * 100;

  return (
    <div className={cn('w-full', className)}>
      {(label !== undefined || valueLabel !== undefined) && (
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          {label !== undefined && <span className="text-[12px] text-ink-muted">{label}</span>}
          {valueLabel !== undefined && (
            <span className="tnum text-[12px] font-semibold text-ink">{valueLabel}</span>
          )}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={typeof label === 'string' ? label : undefined}
        className={cn('relative w-full overflow-hidden rounded-pill bg-white/[0.08]', BAR_HEIGHT[size])}
      >
        <motion.div
          className={cn('h-full rounded-pill', BAR_FILL[tone])}
          initial={animated && !m.reduced ? { width: 0 } : false}
          animate={{ width: `${pct}%` }}
          transition={m.transition.medium}
        />
        {marker !== undefined && (
          <span
            className="absolute inset-y-0 w-px bg-ink/45"
            style={{ left: `${Math.max(0, Math.min(100, (marker / max) * 100))}%` }}
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  );
});

/* --- AttributeBar ----------------------------------------------------- */

export interface AttributeBarProps {
  label: string;
  value: number;
  /** Scouting range. When present the bar shows a band, not a point value. */
  range?: readonly [number, number];
  /** Season-to-date change, drawn as a ghost segment. */
  delta?: number;
  /** Marks the attribute as one of the position's key three. */
  emphasis?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Attribute row with progressive-disclosure support.
 *
 * When `range` is supplied the bar renders the *uncertainty band* the scouting
 * system returns rather than a fake precise value. This is the visual contract
 * that makes investing in scouting feel worthwhile: the band visibly narrows.
 */
export const AttributeBar = memo(function AttributeBar({
  label,
  value,
  range,
  delta,
  emphasis = false,
  size = 'sm',
  className,
}: AttributeBarProps): ReactNode {
  const m = useDesignMotion();
  const known = range === undefined || range[1] - range[0] <= 1;
  const tone: BarTone = value >= 85 ? 'volt' : value >= 72 ? 'positive' : value >= 55 ? 'neutral' : 'neutral';

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <span
        className={cn(
          'w-[92px] shrink-0 truncate text-[12px]',
          emphasis ? 'font-semibold text-ink' : 'text-ink-muted',
        )}
      >
        {label}
      </span>
      <div
        className={cn(
          'relative min-w-0 flex-1 overflow-hidden rounded-pill bg-white/[0.08]',
          size === 'sm' ? 'h-1.5' : 'h-2',
        )}
        role="meter"
        aria-label={label}
        aria-valuenow={known ? Math.round(value) : undefined}
        aria-valuetext={known ? undefined : `between ${Math.round(range[0])} and ${Math.round(range[1])}`}
        aria-valuemin={0}
        aria-valuemax={99}
      >
        {known ? (
          <>
            {delta !== undefined && delta > 0 && (
              <span
                className="absolute inset-y-0 rounded-pill bg-volt/25"
                style={{ left: `${value - delta}%`, width: `${delta}%` }}
                aria-hidden="true"
              />
            )}
            <motion.div
              className={cn('h-full rounded-pill', BAR_FILL[tone])}
              initial={m.reduced ? false : { width: 0 }}
              animate={{ width: `${Math.max(0, Math.min(99, value))}%` }}
              transition={m.transition.medium}
            />
          </>
        ) : (
          <span
            className="absolute inset-y-0 rounded-pill bg-ink-faint/60 [background-image:repeating-linear-gradient(115deg,transparent_0_4px,rgb(255_255_255/0.18)_4px_8px)]"
            style={{ left: `${range[0]}%`, width: `${Math.max(2, range[1] - range[0])}%` }}
            aria-hidden="true"
          />
        )}
      </div>
      <span
        className={cn(
          'tnum w-9 shrink-0 text-right text-[12px] font-semibold',
          known ? 'text-ink' : 'text-ink-dim',
        )}
      >
        {known ? Math.round(value) : `${Math.round(range[0])}–${Math.round(range[1])}`}
      </span>
    </div>
  );
});

/* --- MomentumBar ------------------------------------------------------ */

export interface MomentumBarProps {
  /** -1 (away dominant) .. +1 (home dominant), matching `MatchEvent.momentum`. */
  value: number;
  homeColor?: string;
  awayColor?: string;
  homeLabel?: string;
  awayLabel?: string;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * The live match momentum readout. Centred at zero and pushing outward, so the
 * *direction* of the swing is pre-attentive — a filled-from-the-left bar reads
 * as "progress", which is exactly the wrong metaphor for momentum.
 */
export const MomentumBar = memo(function MomentumBar({
  value,
  homeColor = '#c8ff2e',
  awayColor = '#7c8cff',
  homeLabel = 'Home',
  awayLabel = 'Away',
  size = 'md',
  className,
}: MomentumBarProps): ReactNode {
  const m = useDesignMotion();
  const clamped = Math.max(-1, Math.min(1, value));
  const width = Math.abs(clamped) * 50;

  return (
    <div className={cn('w-full', className)}>
      <div
        className={cn(
          'relative w-full overflow-hidden rounded-pill bg-white/[0.07]',
          size === 'sm' ? 'h-1.5' : 'h-2.5',
        )}
        role="meter"
        aria-valuemin={-1}
        aria-valuemax={1}
        aria-valuenow={Number(clamped.toFixed(2))}
        aria-label="Momentum"
        aria-valuetext={
          Math.abs(clamped) < 0.12
            ? 'Momentum even'
            : `${clamped > 0 ? homeLabel : awayLabel} have the momentum`
        }
      >
        <motion.span
          className="absolute inset-y-0 rounded-pill"
          style={{ backgroundColor: clamped >= 0 ? homeColor : awayColor }}
          animate={{
            left: clamped >= 0 ? '50%' : `${50 - width}%`,
            width: `${width}%`,
          }}
          transition={m.transition.medium}
        />
        <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-ink/30" aria-hidden="true" />
      </div>
    </div>
  );
});

/* --- Sparkline -------------------------------------------------------- */

export interface SparklineProps {
  values: readonly number[];
  width?: number;
  height?: number;
  tone?: BarTone;
  /** Fills under the line. Off for dense tables. */
  fill?: boolean;
  className?: string;
  label?: string;
}

/**
 * Pure SVG, no chart library, no animation. Sparklines appear ten to a screen
 * on the finance and form views; anything that animates or measures would cost
 * more than the whole rest of the row.
 */
const SPARK_STROKE: Record<BarTone, string> = {
  volt: 'stroke-volt', positive: 'stroke-positive', warning: 'stroke-warning',
  danger: 'stroke-danger', info: 'stroke-info', special: 'stroke-special',
  neutral: 'stroke-ink-muted',
};

export const Sparkline = memo(function Sparkline({
  values,
  width = 72,
  height = 24,
  tone = 'neutral',
  fill = false,
  className,
  label,
}: SparklineProps): ReactNode {
  const gradientId = useSvgId('cf-spark');
  if (values.length < 2) {
    return <span className={cn('inline-block', className)} style={{ width, height }} aria-hidden="true" />;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = width / (values.length - 1);
  const points = values.map((v, i) => {
    const x = i * stepX;
    const y = height - 2 - ((v - min) / span) * (height - 4);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const line = `M${points.join(' L')}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={cn('block overflow-visible', className)}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {fill && (
        <>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d={`${line} L${width},${height} L0,${height} Z`}
            fill={`url(#${gradientId})`}
            className={SPARK_STROKE[tone].replace('stroke-', 'text-')}
            stroke="none"
          />
        </>
      )}
      <path
        d={line}
        fill="none"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={SPARK_STROKE[tone]}
      />
    </svg>
  );
});
