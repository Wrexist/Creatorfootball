import { memo, type ReactNode } from 'react';
import { cn } from '@/design';

/**
 * The head-to-head stat row used by the broadcast view and the analytics tab.
 *
 * One row answers "who is winning this particular argument" without the reader
 * doing any arithmetic: the bar is split proportionally, both numbers are
 * present, and the label sits between them. It is the densest honest way to
 * show a two-sided statistic on a phone.
 */

export interface CompareRowProps {
  label: string;
  homeValue: number;
  awayValue: number;
  homeColor: string;
  awayColor: string;
  /** Formats the printed number. Defaults to a rounded integer. */
  format?: (value: number) => string;
  /** Set when a higher number is worse (fouls, cards). Only affects wording. */
  invert?: boolean;
  className?: string;
}

const defaultFormat = (value: number): string => String(Math.round(value));

export const CompareRow = memo(function CompareRow({
  label, homeValue, awayValue, homeColor, awayColor, format = defaultFormat, invert, className,
}: CompareRowProps): ReactNode {
  const total = homeValue + awayValue;
  // A goalless, shotless opening should read as an even bar, not a divide-by-zero.
  const homeShare = total <= 0 ? 0.5 : homeValue / total;

  return (
    <div className={cn('py-2', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="tnum text-[15px] font-bold text-ink">{format(homeValue)}</span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-dim">{label}</span>
        <span className="tnum text-[15px] font-bold text-ink">{format(awayValue)}</span>
      </div>
      <div
        className="mt-1.5 flex h-1.5 w-full overflow-hidden rounded-pill bg-white/[0.07]"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(homeShare * 100)}
        aria-valuetext={`${label}: ${format(homeValue)} to ${format(awayValue)}${invert ? ' (lower is better)' : ''}`}
      >
        <span
          className="h-full rounded-pill transition-[width] duration-[var(--duration-medium)] ease-out-quint"
          style={{ width: `${homeShare * 100}%`, backgroundColor: homeColor }}
        />
        <span className="h-full w-px shrink-0 bg-void/60" aria-hidden="true" />
        <span
          className="h-full flex-1 rounded-pill transition-[width] duration-[var(--duration-medium)] ease-out-quint"
          style={{ backgroundColor: awayColor }}
        />
      </div>
    </div>
  );
});
