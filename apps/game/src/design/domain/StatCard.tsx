import { memo, type ReactNode } from 'react';
import { cn } from '../cn';
import { glassClass, type GlassLevel } from '../glass/glassLevel';
import { Counter, TrendIndicator } from './numbers';
import { Sparkline, type BarTone } from './bars';
import { TYPE_CLASS, TYPE_SIZE } from '../typography/type';
import { FitBox } from '../typography/FitText';

export interface StatCardProps {
  label: ReactNode;
  /** A number gets the animated counter; a node is rendered as-is. */
  value: ReactNode | number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  /** Period-over-period change. Rendered by `TrendIndicator`. */
  delta?: number;
  deltaInvert?: boolean;
  deltaFormat?: (value: number) => string;
  icon?: ReactNode;
  /** Trailing 6-12 points. Anything longer is a chart, not a stat card. */
  history?: readonly number[];
  tone?: BarTone;
  level?: GlassLevel;
  nested?: boolean;
  size?: 'sm' | 'md' | 'lg';
  footnote?: ReactNode;
  className?: string;
}

const VALUE_SIZE = {
  sm: TYPE_SIZE.title,
  md: TYPE_SIZE.hero,
  lg: TYPE_SIZE.display,
} as const;

/**
 * The unit of every dashboard in the product.
 *
 * Label above value, not below: on a phone the player scans a grid of these
 * top-to-bottom, and a label underneath forces a second pass to work out what
 * the big number was. Trend and sparkline are optional and never both required
 * — a card with four signals on it has none.
 */
export const StatCard = memo(function StatCard({
  label,
  value,
  prefix,
  suffix,
  decimals = 0,
  delta,
  deltaInvert = false,
  deltaFormat,
  icon,
  history,
  tone = 'volt',
  level = 2,
  nested = false,
  size = 'md',
  footnote,
  className,
}: StatCardProps): ReactNode {
  return (
    <div
      className={cn(
        'relative flex flex-col gap-1 overflow-hidden rounded-lg p-3.5',
        glassClass(level, !nested),
        'glass-sheen',
        className,
      )}
    >
      {/* Sentence case and allowed to wrap to two lines. "Transfer budget
          remaining" in caps at 11/0.14em needs 214px; the same words in
          sentence case need 148px, which is why this used to clip. */}
      <div className={cn(TYPE_CLASS.label, 'flex items-start gap-1.5 text-ink-muted')}>
        {icon !== undefined && <span className="mt-px shrink-0">{icon}</span>}
        <span className="min-w-0 text-pretty">{label}</span>
      </div>

      <div className="flex min-w-0 items-end justify-between gap-2">
        {/* The figure fits the card. An uncompacted currency value - the
            product shows plenty of them - is 250px wide at the hero step in a
            170px card, and a stat you cannot read is not a stat. It steps down
            through the scale rather than being cut off. */}
        <FitBox
          size={VALUE_SIZE[size]}
          min={TYPE_SIZE.section}
          className={cn('num-broadcast num-tight min-w-0 flex-1 font-extrabold leading-none text-ink')}
        >
          {typeof value === 'number' ? (
            <Counter
              value={value}
              decimals={decimals}
              {...(prefix ? { prefix } : {})}
              {...(suffix ? { suffix } : {})}
            />
          ) : (
            value
          )}
        </FitBox>
        {history && history.length > 1 && (
          <span className="shrink-0">
            <Sparkline values={history} tone={tone} width={64} height={22} fill />
          </span>
        )}
      </div>

      {(delta !== undefined || footnote !== undefined) && (
        <div className="mt-0.5 flex items-center gap-2">
          {delta !== undefined && (
            <TrendIndicator
              delta={delta}
              invert={deltaInvert}
              {...(deltaFormat ? { format: deltaFormat } : {})}
            />
          )}
          {footnote !== undefined && (
            <span className={cn(TYPE_CLASS.caption, 'min-w-0 text-micro text-ink-dim text-pretty')}>
              {footnote}
            </span>
          )}
        </div>
      )}
    </div>
  );
});
