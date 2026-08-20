import { useId, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '../cn';
import { useDesignMotion } from '../motion';
import { haptics } from '../haptics';
import { FOCUS_RING } from '../glass/glassLevel';
import { IconChevronDown, IconChevronRight } from '../icons';
import { TYPE_CLASS } from '../typography/type';

/* --- SectionHeader ---------------------------------------------------- */

export interface SectionHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Right-hand affordance: a "See all" link, a filter, a count. */
  action?: ReactNode;
  /** Turns the whole header into a navigation target. */
  onPress?: () => void;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Section headings are small and set in the display face, in **sentence case**.
 *
 * They used to be uppercase micro-type. The reasoning was sound - a screen made
 * of six 20px headings has no hierarchy left for the one thing that matters -
 * but uppercase was the wrong lever: it bought separation by making the label
 * quieter *and* about 30% wider, which is why long section titles were the
 * first thing on a screen to clip. Small, bold, display-face and sentence case
 * separates just as well, reads faster, and fits.
 */
export function SectionHeader({
  title,
  subtitle,
  action,
  onPress,
  size = 'md',
  className,
}: SectionHeaderProps): ReactNode {
  const content = (
    <>
      <span className="min-w-0">
        <span
          className={cn(
            TYPE_CLASS.section,
            'block text-pretty',
            size === 'sm' ? 'text-[13px]' : 'text-[15px]',
          )}
        >
          {title}
        </span>
        {subtitle !== undefined && (
          <span className={cn(TYPE_CLASS.caption, 'mt-0.5 block text-ink-dim text-pretty')}>
            {subtitle}
          </span>
        )}
      </span>
      {onPress ? (
        <span className="flex shrink-0 items-center gap-1 text-[13px] font-semibold text-volt">
          {action}
          <IconChevronRight size={16} />
        </span>
      ) : (
        action
      )}
    </>
  );

  if (!onPress) {
    return (
      <div className={cn('flex items-end justify-between gap-3', className)}>{content}</div>
    );
  }
  return (
    <button
      type="button"
      onClick={onPress}
      className={cn('flex min-h-11 w-full items-end justify-between gap-3 text-left', FOCUS_RING, className)}
    >
      {content}
    </button>
  );
}

/* --- Divider ---------------------------------------------------------- */

export interface DividerProps {
  /** Centre label, e.g. "Older". */
  label?: ReactNode;
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

export function Divider({ label, orientation = 'horizontal', className }: DividerProps): ReactNode {
  if (orientation === 'vertical') {
    return <span role="separator" aria-orientation="vertical" className={cn('w-px self-stretch bg-white/[0.08]', className)} />;
  }
  if (label === undefined) {
    return <hr className={cn('border-0 border-t border-white/[0.08]', className)} />;
  }
  return (
    <div className={cn('flex items-center gap-3', className)} role="separator">
      <span className="h-px flex-1 bg-white/[0.08]" />
      <span className={cn(TYPE_CLASS.micro, 'shrink-0')}>{label}</span>
      <span className="h-px flex-1 bg-white/[0.08]" />
    </div>
  );
}

/* --- KeyValueRow ------------------------------------------------------ */

export interface KeyValueRowProps {
  label: ReactNode;
  value: ReactNode;
  /** Explanatory line under the label. */
  hint?: ReactNode;
  icon?: ReactNode;
  onPress?: () => void;
  /** Adds a bottom hairline. Off for the last row in a group. */
  divided?: boolean;
  emphasis?: boolean;
  className?: string;
}

/**
 * The settings/detail row. Labels are left, values right-aligned and tabular,
 * which is what makes a stack of these scannable as a column of figures.
 */
export function KeyValueRow({
  label,
  value,
  hint,
  icon,
  onPress,
  divided = true,
  emphasis = false,
  className,
}: KeyValueRowProps): ReactNode {
  const inner = (
    <>
      {icon !== undefined && <span className="shrink-0 text-ink-dim">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className={cn('block text-[14px] text-pretty', emphasis ? 'font-semibold text-ink' : 'text-ink-muted')}>
          {label}
        </span>
        {hint !== undefined && (
          <span className="mt-0.5 block text-[12px] text-ink-dim text-pretty">{hint}</span>
        )}
      </span>
      <span className={cn(TYPE_CLASS.stat, 'shrink-0 text-right text-[14px]')}>{value}</span>
      {onPress && <IconChevronRight size={16} className="shrink-0 text-ink-dim" />}
    </>
  );

  const classes = cn(
    'flex w-full min-h-11 items-center gap-3 py-2.5 text-left',
    divided && 'border-b border-white/[0.06] last:border-b-0',
    className,
  );

  if (!onPress) return <div className={classes}>{inner}</div>;
  return (
    <button type="button" onClick={onPress} className={cn(classes, 'hover:text-ink', FOCUS_RING)}>
      {inner}
    </button>
  );
}

/* --- StatGrid --------------------------------------------------------- */

export interface StatGridProps {
  /** 2 on a phone is the honest maximum for a stat with a label. */
  columns?: 2 | 3 | 4;
  gap?: 'sm' | 'md';
  children: ReactNode;
  className?: string;
}

const COLS = {
  2: 'grid-cols-2',
  3: 'grid-cols-2 sm:grid-cols-3',
  4: 'grid-cols-2 sm:grid-cols-4',
} as const;

export function StatGrid({ columns = 2, gap = 'md', children, className }: StatGridProps): ReactNode {
  return (
    <div className={cn('grid', COLS[columns], gap === 'sm' ? 'gap-2' : 'gap-3', className)}>
      {children}
    </div>
  );
}

/* --- Accordion -------------------------------------------------------- */

export interface AccordionItemProps {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  defaultOpen?: boolean;
  /** Controlled mode. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
  className?: string;
}

/**
 * Height animation uses `height: auto` via motion's layout-free `animate`,
 * which measures once per toggle rather than every frame. We do not animate
 * `max-height`: the classic trick either clips real content or eases wrong.
 */
export function Accordion({
  title,
  subtitle,
  icon,
  defaultOpen = false,
  open,
  onOpenChange,
  children,
  className,
}: AccordionItemProps): ReactNode {
  const m = useDesignMotion();
  const panelId = useId();
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = open ?? internalOpen;

  const toggle = (): void => {
    haptics.selection();
    const next = !isOpen;
    if (open === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };

  return (
    <div className={cn('border-b border-white/[0.06] last:border-b-0', className)}>
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={toggle}
        className={cn('flex min-h-11 w-full items-center gap-3 py-3 text-left', FOCUS_RING)}
      >
        {icon !== undefined && <span className="shrink-0 text-ink-dim">{icon}</span>}
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-ink">{title}</span>
          {subtitle !== undefined && (
            <span className="mt-0.5 block text-[12px] text-ink-muted">{subtitle}</span>
          )}
        </span>
        <motion.span
          animate={{ rotate: isOpen ? 0 : -90 }}
          transition={m.transition.fast}
          className="shrink-0 text-ink-dim"
          aria-hidden="true"
        >
          <IconChevronDown size={18} />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            id={panelId}
            initial={m.reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={m.reduced ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
            exit={m.reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={m.transition.fast}
            className="overflow-hidden"
          >
            <div className="pb-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
