import { memo, type ReactNode } from 'react';
import { cn } from '../cn';
import { glassClass, type GlassLevel } from '../glass/glassLevel';
import { Counter, TrendIndicator } from './numbers';
import { Sparkline, type BarTone } from './bars';

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
  sm: 'text-[20px]',
  md: 'text-[28px]',
  lg: 'text-[40px]',
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
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
        {icon}
        <span className="truncate">{label}</span>
      </div>

      <div className="flex items-end justify-between gap-2">
        <span
          className={cn(
            'font-display font-bold leading-none tracking-[-0.035em] text-ink',
            VALUE_SIZE[size],
          )}
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
        </span>
        {history && history.length > 1 && (
          <Sparkline values={history} tone={tone} width={64} height={22} fill />
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
            <span className="truncate text-[11px] text-ink-dim">{footnote}</span>
          )}
        </div>
      )}
    </div>
  );
});
