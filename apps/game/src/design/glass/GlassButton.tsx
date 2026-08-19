import { forwardRef, type ReactNode } from 'react';
import { motion } from 'motion/react';
import type { HTMLMotionProps } from 'motion/react';
import { cn } from '../cn';
import { useDesignMotion } from '../motion';
import { haptics } from '../haptics';
import { FOCUS_RING } from './glassLevel';

export type GlassButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type GlassButtonSize = 'sm' | 'md' | 'lg';

export interface GlassButtonProps
  extends Omit<HTMLMotionProps<'button'>, 'children' | 'ref'> {
  variant?: GlassButtonVariant;
  size?: GlassButtonSize;
  loading?: boolean;
  /** Stretches to the container. The default for a sticky footer action. */
  block?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
  children?: ReactNode;
}

/**
 * Volt is the product's only accent, so `primary` is rationed: one per screen,
 * on the single action the screen exists to perform. `secondary` is glass,
 * `ghost` is bare, `danger` is reserved for destructive confirmation — never
 * for "cancel".
 */
const VARIANT: Record<GlassButtonVariant, string> = {
  primary: cn(
    'bg-volt text-volt-ink font-semibold',
    // The inset hairline stops the flat lime block from looking like a sticker.
    'shadow-[0_1px_0_0_rgb(255_255_255/0.35)_inset,0_10px_28px_-12px_rgb(200_255_46/0.55)]',
    'hover:bg-volt-bright active:bg-volt-deep',
  ),
  secondary: cn(
    'glass-2 glass-sheen text-ink font-semibold',
    'hover:bg-white/10',
  ),
  ghost: cn(
    'bg-transparent text-ink-muted font-medium',
    'hover:bg-white/[0.06] hover:text-ink',
  ),
  danger: cn(
    'bg-danger/14 text-danger font-semibold border border-danger/35',
    'hover:bg-danger/22',
  ),
};

const SIZE: Record<GlassButtonSize, string> = {
  // Even `sm` clears 44px of touch target: the visual box is 36px and the rest
  // is invisible padding via `min-h-11`, so density never costs tappability.
  sm: 'min-h-11 px-3.5 text-[13px] rounded-md gap-1.5',
  md: 'min-h-11 px-4.5 py-2.5 text-[15px] rounded-lg gap-2',
  lg: 'min-h-13 px-6 py-3.5 text-[16px] rounded-xl gap-2.5',
};

function Spinner({ className }: { className?: string }): ReactNode {
  return (
    <svg viewBox="0 0 24 24" className={cn('size-4 animate-spin', className)} aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(function GlassButton(
  {
    variant = 'secondary',
    size = 'md',
    loading = false,
    block = false,
    icon,
    iconRight,
    disabled,
    className,
    children,
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
      disabled={inert}
      // `aria-busy` rather than swapping the label: a screen reader user who has
      // just pressed the button should not have the accessible name change
      // under them.
      aria-busy={loading || undefined}
      className={cn(
        'relative inline-flex items-center justify-center whitespace-nowrap select-none',
        'transition-colors duration-[var(--duration-fast)] ease-out-quint',
        SIZE[size],
        VARIANT[variant],
        block && 'w-full',
        inert && 'pointer-events-none opacity-45',
        FOCUS_RING,
        className,
      )}
      whileTap={m.reduced || inert ? undefined : { scale: 0.965 }}
      transition={m.spring.press}
      onClick={(event) => {
        if (inert) return;
        haptics.impact();
        onClick?.(event);
      }}
      {...rest}
    >
      {loading ? (
        <>
          <Spinner />
          {/* Keep the label mounted but hidden so the button does not resize. */}
          <span className="invisible absolute">{children}</span>
        </>
      ) : (
        <>
          {icon}
          {children}
          {iconRight}
        </>
      )}
    </motion.button>
  );
});
