import { useCallback, useId, useRef, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { cn } from '../cn';
import { useDesignMotion } from '../motion';
import { haptics } from '../haptics';
import { FOCUS_RING } from './glassLevel';

export interface TabItem<T extends string = string> {
  readonly id: T;
  readonly label: ReactNode;
  readonly icon?: ReactNode;
  readonly badge?: ReactNode;
  readonly disabled?: boolean;
}

export interface GlassTabsProps<T extends string = string> {
  items: readonly TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  /** `underline` for in-page section tabs; `enclosed` for filter groups. */
  appearance?: 'underline' | 'enclosed';
  /** Scrolls horizontally instead of dividing the width equally. */
  scrollable?: boolean;
  className?: string;
  'aria-label'?: string;
}

/**
 * In-page tabs with a shared-layout indicator.
 *
 * Keyboard behaviour follows the WAI-ARIA tabs pattern: arrows move selection,
 * Home/End jump to the ends, and only the active tab is in the tab order — so
 * a keyboard user tabs *past* a ten-tab strip rather than through it.
 */
export function GlassTabs<T extends string = string>({
  items,
  value,
  onChange,
  appearance = 'underline',
  scrollable = false,
  className,
  'aria-label': ariaLabel,
}: GlassTabsProps<T>): ReactNode {
  const m = useDesignMotion();
  const layoutId = useId();
  const listRef = useRef<HTMLDivElement>(null);

  const move = useCallback(
    (delta: number) => {
      const enabled = items.filter((i) => !i.disabled);
      if (enabled.length === 0) return;
      const currentIndex = enabled.findIndex((i) => i.id === value);
      const nextIndex = (currentIndex + delta + enabled.length) % enabled.length;
      const next = enabled[nextIndex];
      if (!next) return;
      haptics.selection();
      onChange(next.id);
      listRef.current
        ?.querySelector<HTMLElement>(`[data-tab-id="${next.id}"]`)
        ?.focus({ preventScroll: false });
    },
    [items, value, onChange],
  );

  const onKeyDown = (event: React.KeyboardEvent): void => {
    if (event.key === 'ArrowRight') { event.preventDefault(); move(1); }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1); }
    else if (event.key === 'Home') { event.preventDefault(); move(-items.length); }
    else if (event.key === 'End') { event.preventDefault(); move(items.length); }
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={cn(
        'relative flex items-stretch',
        appearance === 'underline' && 'gap-1 border-b border-white/[0.07]',
        appearance === 'enclosed' && 'gap-1 rounded-pill glass-1 p-1',
        scrollable ? 'scroll-x flex-nowrap' : 'w-full',
        className,
      )}
    >
      {items.map((item) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            data-tab-id={item.id}
            role="tab"
            type="button"
            aria-selected={selected}
            aria-disabled={item.disabled || undefined}
            tabIndex={selected ? 0 : -1}
            disabled={item.disabled}
            onClick={() => {
              if (item.disabled) return;
              haptics.selection();
              onChange(item.id);
            }}
            className={cn(
              'relative inline-flex min-h-11 min-w-0 items-center justify-center gap-1.5 whitespace-nowrap px-3.5',
              'text-[14px] font-semibold transition-colors duration-[var(--duration-fast)] ease-out-quint',
              appearance === 'enclosed' && 'rounded-pill',
              scrollable ? 'shrink-0' : 'flex-1',
              selected ? 'text-ink' : 'text-ink-dim hover:text-ink-muted',
              item.disabled && 'pointer-events-none opacity-40',
              FOCUS_RING,
            )}
          >
            {appearance === 'enclosed' && selected && (
              <motion.span
                layoutId={`tabs-bg-${layoutId}`}
                className="absolute inset-0 -z-1 rounded-pill bg-white/10"
                transition={m.spring.snappy}
              />
            )}
            {item.icon}
            <span className="relative">{item.label}</span>
            {item.badge !== undefined && item.badge !== null && (
              <span className="rounded-pill bg-volt/18 px-1.5 text-[10px] font-bold leading-4 text-volt">
                {item.badge}
              </span>
            )}
            {appearance === 'underline' && selected && (
              <motion.span
                layoutId={`tabs-underline-${layoutId}`}
                className="absolute inset-x-2 -bottom-px h-0.5 rounded-pill bg-volt"
                transition={m.spring.snappy}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
