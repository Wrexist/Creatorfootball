import { useId, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { cn } from '../cn';
import { useDesignMotion } from '../motion';
import { haptics } from '../haptics';
import { controlSurface, FOCUS_RING, type GlassLevel } from './glassLevel';
import { FitText } from '../typography/FitText';

export interface SegmentedOption<T extends string = string> {
  readonly value: T;
  readonly label: ReactNode;
  readonly icon?: ReactNode;
  readonly disabled?: boolean;
}

export interface GlassSegmentedProps<T extends string = string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  level?: GlassLevel;
  /**
   * Retained for API compatibility and now a no-op: controls never blur, so
   * there is never a second blurring layer to drop. See `CONTROL_SURFACE`.
   */
  nested?: boolean;
  size?: 'sm' | 'md';
  block?: boolean;
  className?: string;
  'aria-label'?: string;
}

/**
 * The iOS segmented control: 2-4 mutually exclusive, equally weighted options.
 *
 * Radio semantics rather than tabs, because the choice changes a *value*
 * (match speed, table view) and does not swap a panel of content. Getting this
 * distinction right is what makes VoiceOver announce "1 of 3" instead of
 * "tab, selected".
 */
export function GlassSegmented<T extends string = string>({
  options,
  value,
  onChange,
  level = 1,
  nested: _nested = false,
  size = 'md',
  block = true,
  className,
  'aria-label': ariaLabel,
}: GlassSegmentedProps<T>): ReactNode {
  const m = useDesignMotion();
  const layoutId = useId();

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-stretch gap-0.5 rounded-pill p-1',
        // Labels are never broken mid-word. Five options ("Creators", "Rivals",
        // …) do not fit across a 430pt phone, and without this the longest one
        // wrapped to two lines — visible enough that it showed up in an App
        // Store screenshot. Segments still share the row equally whenever they
        // fit (flex-1); when they genuinely cannot, the row scrolls instead.
        // Scrollbars are globally zero-height, and the p-1 here leaves exactly
        // the room the focus ring's offset needs, so nothing is clipped.
        'overflow-x-auto',
        controlSurface(level),
        block && 'flex w-full',
        className,
      )}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={option.disabled}
            onClick={() => {
              if (option.disabled || selected) return;
              haptics.selection();
              onChange(option.value);
            }}
            className={cn(
              'relative inline-flex min-w-fit flex-1 items-center justify-center gap-1.5 rounded-pill whitespace-nowrap',
              'font-semibold transition-colors duration-[var(--duration-fast)] ease-out-quint',
              size === 'sm' ? 'min-h-9 px-3 text-label' : 'min-h-11 px-4 text-body',
              selected ? 'text-ink' : 'text-ink-dim hover:text-ink-muted',
              option.disabled && 'pointer-events-none opacity-40',
              FOCUS_RING,
            )}
          >
            {selected && (
              <motion.span
                layoutId={`seg-${layoutId}`}
                className="absolute inset-0 -z-1 rounded-pill bg-white/12 shadow-[0_1px_0_0_rgb(255_255_255/0.14)_inset]"
                transition={m.spring.snappy}
              />
            )}
            {option.icon}
            {/* A segment label that does not fit shrinks; it does not clip.
                Four options on a 393pt phone is a genuinely tight slot. */}
            {typeof option.label === 'string' ? (
              <FitText
                role={size === 'sm' ? 'label' : 'body'}
                lines={2}
                lineHeight={1.1}
                className="relative text-center"
              >
                {option.label}
              </FitText>
            ) : (
              <span className="relative whitespace-nowrap">{option.label}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
