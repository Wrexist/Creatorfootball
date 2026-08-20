import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../cn';
import { controlSurface, type GlassLevel } from './glassLevel';

export interface GlassInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  /** Hides the label visually but keeps it for screen readers. */
  labelHidden?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  icon?: ReactNode;
  /** Trailing control: a clear button, a unit, a search filter chip. */
  trailing?: ReactNode;
  level?: GlassLevel;
  /**
   * Retained for API compatibility and now a no-op: controls never blur, so
   * there is never a second blurring layer to drop. See `CONTROL_SURFACE`.
   */
  nested?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE: Record<NonNullable<GlassInputProps['size']>, string> = {
  sm: 'min-h-11 px-3 text-body rounded-md',
  md: 'min-h-12 px-3.5 text-body rounded-lg',
  lg: 'min-h-14 px-4 text-section rounded-xl',
};

/**
 * Text input.
 *
 * The focus treatment is a volt hairline on the field itself rather than the
 * global offset ring: on a glass surface an offset ring floats detached from
 * the control it belongs to. The ring is still drawn for keyboard focus via
 * `focus-within`, so the affordance survives without the visual noise.
 */
export const GlassInput = forwardRef<HTMLInputElement, GlassInputProps>(function GlassInput(
  {
    label,
    labelHidden = false,
    hint,
    error,
    icon,
    trailing,
    level = 1,
    nested: _nested = false,
    size = 'md',
    className,
    disabled,
    id,
    ...rest
  },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;

  return (
    <div className={cn('w-full', className)}>
      {label !== undefined && (
        <label
          htmlFor={inputId}
          className={cn(
            'mb-1.5 block text-caption font-semibold tracking-[0.005em] text-ink-muted',
            labelHidden && 'sr-only',
          )}
        >
          {label}
        </label>
      )}
      <div
        className={cn(
          'flex items-center gap-2.5 transition-colors duration-[var(--duration-fast)] ease-out-quint',
          controlSurface(level),
          SIZE[size],
          'focus-within:border-volt/60 focus-within:shadow-[0_0_0_3px_rgb(200_255_46/0.12)]',
          error && 'border-danger/60',
          disabled && 'pointer-events-none opacity-45',
        )}
      >
        {icon !== undefined && <span className="text-ink-dim">{icon}</span>}
        <input
          ref={ref}
          id={inputId}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={cn(hint && hintId, error && errorId) || undefined}
          className="w-full min-w-0 bg-transparent py-2 text-ink outline-none placeholder:text-ink-dim"
          {...rest}
        />
        {trailing}
      </div>
      {error !== undefined ? (
        <p id={errorId} role="alert" className="mt-1.5 text-label text-danger">
          {error}
        </p>
      ) : (
        hint !== undefined && (
          <p id={hintId} className="mt-1.5 text-label text-ink-dim">
            {hint}
          </p>
        )
      )}
    </div>
  );
});
