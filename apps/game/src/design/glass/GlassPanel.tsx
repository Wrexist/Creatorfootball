import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '../cn';
import { glassClass, RADIUS_CLASS, type GlassLevel, type RadiusToken } from './glassLevel';

export interface GlassPanelProps extends HTMLAttributes<HTMLDivElement> {
  level?: GlassLevel;
  radius?: RadiusToken;
  sheen?: boolean;
  nested?: boolean;
  /** Optional accent hairline along the top edge — used to mark a live/hero panel. */
  accent?: 'none' | 'volt' | 'positive' | 'danger' | 'special';
  title?: ReactNode;
  action?: ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const PADDING: Record<NonNullable<GlassPanelProps['padding']>, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-5',
};

const ACCENT_LINE: Record<NonNullable<GlassPanelProps['accent']>, string> = {
  none: '',
  volt: 'before:bg-volt',
  positive: 'before:bg-positive',
  danger: 'before:bg-danger',
  special: 'before:bg-special',
};

/**
 * A static grouping surface: no press state, no motion. GlassCard is for things
 * you can touch; GlassPanel is for things you read. Keeping them separate stops
 * screens from accidentally shipping a card that looks tappable and is not.
 */
export const GlassPanel = forwardRef<HTMLDivElement, GlassPanelProps>(function GlassPanel(
  {
    level = 2,
    radius = 'lg',
    sheen = true,
    nested = false,
    accent = 'none',
    title,
    action,
    padding = 'md',
    className,
    children,
    ...rest
  },
  ref,
) {
  const hasHeader = title !== undefined || action !== undefined;
  return (
    <section
      ref={ref}
      className={cn(
        'relative overflow-hidden',
        glassClass(level, !nested),
        RADIUS_CLASS[radius],
        PADDING[padding],
        sheen && 'glass-sheen',
        accent !== 'none' &&
          cn(
            'before:absolute before:inset-x-0 before:top-0 before:z-1 before:h-px before:content-[""]',
            ACCENT_LINE[accent],
          ),
        className,
      )}
      {...rest}
    >
      {hasHeader && (
        <header className="mb-3 flex items-center justify-between gap-3">
          {title !== undefined && (
            <h3 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
              {title}
            </h3>
          )}
          {action}
        </header>
      )}
      {children}
    </section>
  );
});
