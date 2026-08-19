import { useCallback, useId, useRef, type ReactNode } from 'react';
import { cn } from '../cn';
import { haptics } from '../haptics';

export interface GlassSliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  labelHidden?: boolean;
  /** Rendered on the right of the label. Defaults to the raw value. */
  formatValue?: (value: number) => ReactNode;
  /** Labelled ticks under the track, e.g. tactical presets. */
  marks?: readonly { value: number; label: string }[];
  disabled?: boolean;
  tone?: 'volt' | 'neutral' | 'danger';
  className?: string;
}

const FILL: Record<NonNullable<GlassSliderProps['tone']>, string> = {
  volt: 'bg-volt',
  neutral: 'bg-ink-muted',
  danger: 'bg-danger',
};

/**
 * Slider built on a real `<input type="range">` held invisible over a drawn
 * track.
 *
 * A div-and-pointer-events slider always ends up missing something — keyboard
 * stepping, PageUp/PageDown, VoiceOver's rotor adjust gesture, form
 * association. Borrowing the native element's behaviour and drawing our own
 * track is strictly less code and strictly more accessible.
 */
export function GlassSlider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  label,
  labelHidden = false,
  formatValue,
  marks,
  disabled = false,
  tone = 'volt',
  className,
}: GlassSliderProps): ReactNode {
  const id = useId();
  const lastHapticValue = useRef(value);
  const pct = max === min ? 0 : ((value - min) / (max - min)) * 100;

  const handleChange = useCallback(
    (next: number) => {
      // One tick of feedback per discrete step, not per pointer event.
      if (next !== lastHapticValue.current) {
        lastHapticValue.current = next;
        haptics.selection();
      }
      onChange(next);
    },
    [onChange],
  );

  return (
    <div className={cn('w-full', className)}>
      {label !== undefined && (
        <div className={cn('mb-2 flex items-baseline justify-between', labelHidden && 'sr-only')}>
          <label htmlFor={id} className="text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-muted">
            {label}
          </label>
          <span className="tnum text-[14px] font-semibold text-ink">
            {formatValue ? formatValue(value) : value}
          </span>
        </div>
      )}

      <div className={cn('relative h-11 select-none', disabled && 'pointer-events-none opacity-45')}>
        {/* The native input comes first in the DOM so Tailwind's `peer-*`
            sibling selector can carry its focus state to the drawn thumb. The
            layers above it are all `pointer-events-none`, so it still receives
            every pointer and key event. */}
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          aria-label={label}
          aria-valuetext={formatValue ? String(formatValue(value)) : undefined}
          onChange={(event) => handleChange(Number(event.target.value))}
          className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
        {/* Track */}
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-pill bg-white/10" />
        <div
          className={cn(
            'pointer-events-none absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-pill',
            FILL[tone],
          )}
          style={{ width: `${pct}%` }}
        />
        {/* Thumb. `peer-focus-visible` carries the keyboard ring across from
            the invisible native input. */}
        <div
          className={cn(
            'pointer-events-none absolute top-1/2 z-1 size-6 -translate-x-1/2 -translate-y-1/2 rounded-pill',
            'border border-white/25 bg-surface-4 shadow-lift',
            'peer-focus-visible:ring-2 peer-focus-visible:ring-volt peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-base',
          )}
          style={{ left: `${pct}%` }}
        />
      </div>

      {marks !== undefined && marks.length > 0 && (
        <div className="mt-1 flex justify-between text-[11px] text-ink-faint">
          {marks.map((mark) => (
            <span key={mark.value} className={cn(value === mark.value && 'text-ink')}>
              {mark.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
