import { useId, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { cn } from '../cn';
import { useDesignMotion } from '../motion';
import { haptics } from '../haptics';
import { FOCUS_RING } from './glassLevel';

export interface GlassToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  /** Renders label and switch as a full-width, tappable settings row. */
  asRow?: boolean;
  size?: 'sm' | 'md';
  className?: string;
  'aria-label'?: string;
}

/**
 * Switch.
 *
 * The whole row is the target when `asRow` is set — a 44pt switch alone is
 * technically compliant and practically annoying on a dense settings screen.
 */
export function GlassToggle({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  asRow = false,
  size = 'md',
  className,
  'aria-label': ariaLabel,
}: GlassToggleProps): ReactNode {
  const m = useDesignMotion();
  const labelId = useId();
  const descId = useId();

  const trackW = size === 'sm' ? 'w-[44px]' : 'w-[52px]';
  const trackH = size === 'sm' ? 'h-[26px]' : 'h-[31px]';
  const knob = size === 'sm' ? 'size-[22px]' : 'size-[27px]';
  const travel = size === 'sm' ? 18 : 21;

  const control = (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center rounded-pill p-0.5 transition-colors duration-fast ease-out-quint',
        trackW,
        trackH,
        checked ? 'bg-volt' : 'bg-white/14',
      )}
    >
      <motion.span
        className={cn('rounded-pill bg-white shadow-[0_2px_6px_rgb(0_0_0/0.45)]', knob)}
        animate={{ x: checked ? travel : 0 }}
        transition={m.spring.snappy}
      />
    </span>
  );

  const toggle = (): void => {
    if (disabled) return;
    haptics.selection();
    onChange(!checked);
  };

  if (!asRow) {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={toggle}
        className={cn(
          'inline-flex min-h-11 min-w-11 items-center justify-center rounded-pill',
          disabled && 'pointer-events-none opacity-45',
          FOCUS_RING,
          className,
        )}
      >
        {control}
      </button>
    );
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={label ? labelId : undefined}
      aria-describedby={description ? descId : undefined}
      aria-label={label ? undefined : ariaLabel}
      disabled={disabled}
      onClick={toggle}
      className={cn(
        'flex min-h-11 w-full items-center justify-between gap-4 rounded-lg py-2.5 text-left',
        disabled && 'pointer-events-none opacity-45',
        FOCUS_RING,
        className,
      )}
    >
      <span className="min-w-0">
        {label !== undefined && (
          <span id={labelId} className="block text-[15px] font-medium text-ink">
            {label}
          </span>
        )}
        {description !== undefined && (
          <span id={descId} className="mt-0.5 block text-[13px] text-ink-muted text-pretty">
            {description}
          </span>
        )}
      </span>
      {control}
    </button>
  );
}
