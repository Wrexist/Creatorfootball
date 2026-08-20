import { memo, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { cn } from '../cn';
import { useDesignMotion } from '../motion';
import { haptics } from '../haptics';
import { FOCUS_RING } from '../glass/glassLevel';
import { TYPE_CLASS } from '../typography/type';
import { IconChevronRight } from '../icons';

/**
 * Three surfaces that are deliberately *not* cards.
 *
 * The product had converged on one shape - a translucent rounded rectangle with
 * a hairline - and used it for a headline, a stat, a table row and a setting.
 * When everything is a card, nothing is. These three each give up something a
 * card has (its border, its corners, its background) in exchange for a job it
 * does better.
 */

/* --- StatBlock -------------------------------------------------------- */

export type StatBlockTone = 'neutral' | 'volt' | 'positive' | 'warning' | 'danger' | 'info';

const RULE: Record<StatBlockTone, string> = {
  neutral: 'bg-ink-faint/60',
  volt: 'bg-volt',
  positive: 'bg-positive',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
};

const WASH: Record<StatBlockTone, string> = {
  neutral: 'from-white/[0.045]',
  volt: 'from-volt/[0.09]',
  positive: 'from-positive/[0.09]',
  warning: 'from-warning/[0.09]',
  danger: 'from-danger/[0.09]',
  info: 'from-info/[0.09]',
};

export interface StatBlockProps {
  label: ReactNode;
  value: ReactNode;
  /** Unit or qualifier set next to the figure, e.g. "pts", "%", "/ 38". */
  unit?: ReactNode;
  /** A trend indicator, a sparkline, a pill. */
  trailing?: ReactNode;
  caption?: ReactNode;
  tone?: StatBlockTone;
  size?: 'md' | 'lg';
  className?: string;
}

/**
 * A number with a rule down its left edge.
 *
 * No border, no radius on the leading side, no card: the eye reads the rule as
 * the start of the block and the figure as the content, which is how a results
 * board works. Four of these in a row look like a scoreboard; four StatCards in
 * a row look like a settings screen.
 */
export const StatBlock = memo(function StatBlock({
  label, value, unit, trailing, caption, tone = 'neutral', size = 'md', className,
}: StatBlockProps): ReactNode {
  return (
    <div
      className={cn(
        'relative flex min-w-0 flex-col justify-center rounded-r-md bg-gradient-to-r to-transparent pl-3 pr-2',
        WASH[tone],
        size === 'lg' ? 'py-3' : 'py-2',
        className,
      )}
    >
      <span aria-hidden="true" className={cn('absolute inset-y-0 left-0 w-[3px] rounded-pill', RULE[tone])} />
      <span className={cn(TYPE_CLASS.label, 'text-ink-dim')}>{label}</span>
      <span className="mt-1 flex items-baseline gap-1.5">
        <span className={cn(size === 'lg' ? TYPE_CLASS.giant : TYPE_CLASS.title, 'num-broadcast')}>
          {value}
        </span>
        {unit !== undefined && (
          <span className={cn(TYPE_CLASS.label, 'text-ink-dim')}>{unit}</span>
        )}
        {trailing !== undefined && <span className="ml-auto shrink-0">{trailing}</span>}
      </span>
      {caption !== undefined && (
        <span className={cn(TYPE_CLASS.caption, 'mt-1 text-ink-dim')}>{caption}</span>
      )}
    </div>
  );
});

/* --- DataCell --------------------------------------------------------- */

export interface DataCellProps {
  label: ReactNode;
  value: ReactNode;
  /** Emphasise one cell in a grid - the column that decides the table. */
  emphasis?: boolean;
  align?: 'start' | 'center' | 'end';
  className?: string;
}

/**
 * The densest way to show a labelled figure.
 *
 * Hairlines instead of boxes. Tiled in a grid with `gap-px` on a faint
 * background these read as a single ruled table rather than as N cards, which
 * is the correct impression when the numbers are meant to be compared.
 */
export const DataCell = memo(function DataCell({
  label, value, emphasis = false, align = 'center', className,
}: DataCellProps): ReactNode {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-1 bg-base/40 px-2.5 py-2',
        align === 'center' && 'items-center text-center',
        align === 'end' && 'items-end text-right',
        className,
      )}
    >
      <span className={cn(TYPE_CLASS.micro, 'truncate')}>{label}</span>
      <span className={cn(TYPE_CLASS.stat, emphasis ? 'text-volt' : 'text-ink')}>{value}</span>
    </div>
  );
});

export interface DataGridProps {
  columns?: 2 | 3 | 4 | 5 | 6;
  children: ReactNode;
  className?: string;
}

const GRID_COLS = {
  2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4', 5: 'grid-cols-5', 6: 'grid-cols-6',
} as const;

/** The ruled container `DataCell` is designed to sit in. */
export function DataGrid({ columns = 4, children, className }: DataGridProps): ReactNode {
  return (
    <div
      className={cn(
        'grid gap-px overflow-hidden rounded-md bg-white/[0.07]',
        GRID_COLS[columns],
        className,
      )}
    >
      {children}
    </div>
  );
}

/* --- ListRow ---------------------------------------------------------- */

export interface ListRowProps {
  /** Portrait, badge, icon, position number. */
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Right side: a value, a rating, a control. */
  trailing?: ReactNode;
  onPress?: () => void;
  /** Shows a navigation chevron. Off by default: a pressable row is not
   *  automatically a navigation target. */
  chevron?: boolean;
  selected?: boolean;
  dimmed?: boolean;
  /** Off for the last row in a group. */
  divided?: boolean;
  density?: 'compact' | 'regular' | 'relaxed';
  className?: string;
}

const DENSITY = {
  compact: 'min-h-11 py-1.5 gap-2.5',
  regular: 'min-h-14 py-2 gap-3',
  relaxed: 'min-h-16 py-3 gap-3.5',
} as const;

/**
 * A row in a list, with no card around it.
 *
 * A squad of twenty players rendered as twenty cards is twenty borders, twenty
 * shadows and twenty radii competing for the same attention; rendered as rows
 * on hairlines it is one list. The press state is a wash rather than a lift,
 * because a row is part of a surface, not an object on top of one.
 */
export const ListRow = memo(function ListRow({
  leading, title, subtitle, trailing, onPress, chevron, selected = false,
  dimmed = false, divided = true, density = 'regular', className,
}: ListRowProps): ReactNode {
  const m = useDesignMotion();
  const showChevron = chevron ?? false;

  const inner = (
    <>
      {selected && (
        <span aria-hidden="true" className="absolute inset-y-1 left-0 w-[3px] rounded-pill bg-volt" />
      )}
      {leading !== undefined && <span className="shrink-0">{leading}</span>}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cn(TYPE_CLASS.bodyStrong, 'min-w-0')}>{title}</span>
        {subtitle !== undefined && (
          <span className={cn(TYPE_CLASS.caption, 'mt-0.5 min-w-0 text-ink-dim')}>{subtitle}</span>
        )}
      </span>
      {trailing !== undefined && <span className="shrink-0">{trailing}</span>}
      {showChevron && <IconChevronRight size={16} className="shrink-0 text-ink-dim" />}
    </>
  );

  const classes = cn(
    'relative flex w-full items-center px-1 text-left',
    DENSITY[density],
    divided && 'border-b border-white/[0.06] last:border-b-0',
    selected && 'bg-volt/[0.07]',
    dimmed && 'opacity-55',
    className,
  );

  if (!onPress) return <div className={classes}>{inner}</div>;

  return (
    <motion.button
      type="button"
      onClick={() => { haptics.selection(); onPress(); }}
      whileTap={m.reduced ? undefined : { scale: 0.995 }}
      transition={m.spring.press}
      className={cn(classes, 'hover:bg-white/[0.04]', FOCUS_RING)}
    >
      {inner}
    </motion.button>
  );
});
