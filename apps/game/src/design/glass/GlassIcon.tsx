import { forwardRef, type ReactNode } from 'react';
import { motion } from 'motion/react';
import type { HTMLMotionProps } from 'motion/react';
import { cn } from '../cn';
import { useDesignMotion } from '../motion';
import { haptics } from '../haptics';
import { FOCUS_RING, type GlassLevel, glassClass } from './glassLevel';

export type GlassIconSize = 'sm' | 'md' | 'lg';

export interface GlassIconProps extends Omit<HTMLMotionProps<'button'>, 'children' | 'ref'> {
  /** Required. An icon-only control with no accessible name is a defect. */
  label: string;
  icon: ReactNode;
  size?: GlassIconSize;
  level?: GlassLevel;
  nested?: boolean;
  variant?: 'glass' | 'ghost' | 'volt' | 'danger';
  /** Pressed/selected state, e.g. a toggled filter button. */
  active?: boolean;
  loading?: boolean;
  badge?: ReactNode;
}

const SIZE: Record<GlassIconSize, string> = {
  sm: 'size-11 rounded-md [&_svg]:size-[18px]',
  md: 'size-11 rounded-lg [&_svg]:size-[22px]',
  lg: 'size-13 rounded-xl [&_svg]:size-6',
};

/**
 * The circular/rounded icon button used across headers, rows and toolbars.
 * `label` is a required prop rather than an optional one: making the
 * accessible name impossible to forget is worth the small ceremony.
 */
export const GlassIcon = forwardRef<HTMLButtonElement, GlassIconProps>(function GlassIcon(
  {
    label,
    icon,
    size = 'md',
    level = 2,
    nested = false,
    variant = 'glass',
    active = false,
    loading = false,
    badge,
    disabled,
    className,
    onClick,
    type = 'button',
    ...rest
  },
  ref,
) {
  const m = useDesignMotion();
  const inert = disabled || loading;

  return (
    <motion.button
      ref={ref}
      type={type}
      aria-label={label}
      aria-pressed={rest['aria-pressed'] ?? (active ? true : undefined)}
      disabled={inert}
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center',
        'transition-colors duration-[var(--duration-fast)] ease-out-quint',
        SIZE[size],
        variant === 'glass' && cn(glassClass(level, !nested), 'text-ink hover:bg-white/10'),
        variant === 'ghost' && 'bg-transparent text-ink-muted hover:bg-white/[0.06] hover:text-ink',
        variant === 'volt' && 'bg-volt text-volt-ink hover:bg-volt-bright',
        variant === 'danger' && 'bg-danger/14 text-danger border border-danger/35 hover:bg-danger/22',
        active && variant === 'glass' && 'bg-volt/14 text-volt border-volt/30',
        inert && 'pointer-events-none opacity-45',
        FOCUS_RING,
        className,
      )}
      whileTap={m.reduced || inert ? undefined : { scale: 0.9 }}
      transition={m.spring.press}
      onClick={(event) => {
        if (inert) return;
        haptics.selection();
        onClick?.(event);
      }}
      {...rest}
    >
      {icon}
      {badge !== undefined && badge !== null && (
        <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-pill bg-volt px-1 text-[10px] font-bold leading-4 text-volt-ink">
          {badge}
        </span>
      )}
    </motion.button>
  );
});
