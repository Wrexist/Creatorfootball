import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { FOCUS_RING, cn, contrastRatio, haptics, useDesignMotion } from '@/design';

/**
 * The small, repeated controls of the creation flow.
 *
 * They are plain buttons rather than glass primitives on purpose: a step in
 * this flow already spends its two blurring layers on the screen header and one
 * content panel, and a grid of forty translucent swatches inside that panel
 * would be forty more composited surfaces for no legibility gained.
 */

/* --- progress --------------------------------------------------------- */

export interface CreationStepDef {
  readonly key: string;
  readonly label: string;
}

export const CREATION_STEPS: readonly CreationStepDef[] = [
  { key: 'manager', label: 'You' },
  { key: 'club', label: 'Club' },
  { key: 'squad', label: 'Squad' },
];

/**
 * Progress is shown as three named segments rather than a percentage: the
 * player is not filling a bar, they are moving through three decisions, and
 * naming them up front is what makes a three-minute flow feel finite.
 */
export function CreationProgress({ current }: { current: string }): ReactNode {
  const index = CREATION_STEPS.findIndex((s) => s.key === current);
  return (
    <ol className="flex items-center gap-2" aria-label="Creation progress">
      {CREATION_STEPS.map((step, i) => {
        const done = i < index;
        const active = i === index;
        return (
          <li key={step.key} className="flex flex-1 flex-col gap-1.5">
            <span
              className={cn(
                'h-[3px] w-full rounded-pill transition-colors duration-[var(--duration-fast)]',
                active ? 'bg-volt' : done ? 'bg-volt/45' : 'bg-white/[0.12]',
              )}
              aria-hidden="true"
            />
            <span
              className={cn(
                'text-[10px] font-semibold uppercase tracking-[0.14em]',
                active ? 'text-ink' : 'text-ink-dim',
              )}
              aria-current={active ? 'step' : undefined}
            >
              {i + 1}. {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/* --- choice chips ----------------------------------------------------- */

export interface ChoiceOption<T extends string | number> {
  readonly value: T;
  readonly label: string;
}

export interface ChoiceChipsProps<T extends string | number> {
  legend: string;
  options: readonly ChoiceOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** One line, shown under the row, describing the current choice. */
  hint?: ReactNode;
  columns?: boolean;
  className?: string;
}

export function ChoiceChips<T extends string | number>({
  legend, options, value, onChange, hint, columns = false, className,
}: ChoiceChipsProps<T>): ReactNode {
  return (
    <fieldset className={cn('min-w-0', className)}>
      <legend className="mb-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-dim">
        {legend}
      </legend>
      <div className={cn('flex flex-wrap gap-2', columns && 'flex-col')}>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={String(option.value)}
              type="button"
              aria-pressed={active}
              onClick={() => {
                if (active) return;
                haptics.selection();
                onChange(option.value);
              }}
              className={cn(
                'min-h-11 rounded-pill px-3.5 text-[13px] font-semibold',
                'transition-colors duration-[var(--duration-micro)] ease-out-quint',
                active
                  ? 'bg-volt text-volt-ink'
                  : 'bg-white/[0.06] text-ink-muted hover:bg-white/[0.1] hover:text-ink',
                FOCUS_RING,
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {hint !== undefined && (
        <p className="mt-2.5 text-[13px] leading-relaxed text-ink-muted text-pretty">{hint}</p>
      )}
    </fieldset>
  );
}

/* --- colour swatches -------------------------------------------------- */

export interface SwatchRowProps {
  legend: string;
  colors: readonly { readonly hex: string; readonly label: string }[];
  value: string;
  onChange: (hex: string) => void;
  /** Warns when the selection is unreadable against this colour. */
  contrastAgainst?: string;
  className?: string;
}

/**
 * Colour choice with a live contrast check.
 *
 * The badge renderer picks a readable foreground for whatever it is given, so
 * nothing here can produce an *illegible* crest — but a 1.4:1 pairing still
 * makes a flat, muddy badge, and telling the player that at the moment they
 * pick is far better than letting them find out at the reveal.
 */
export function SwatchRow({
  legend, colors, value, onChange, contrastAgainst, className,
}: SwatchRowProps): ReactNode {
  const poor =
    contrastAgainst !== undefined && contrastRatio(value, contrastAgainst) < 1.6;

  return (
    <fieldset className={cn('min-w-0', className)}>
      <legend className="mb-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-dim">
        {legend}
      </legend>
      <div className="flex flex-wrap gap-2">
        {colors.map((color) => {
          const active = color.hex.toLowerCase() === value.toLowerCase();
          return (
            <button
              key={color.hex}
              type="button"
              aria-label={color.label}
              aria-pressed={active}
              onClick={() => {
                if (active) return;
                haptics.selection();
                onChange(color.hex);
              }}
              className={cn(
                'relative flex size-11 items-center justify-center rounded-pill',
                'transition-transform duration-[var(--duration-micro)] ease-out-quint',
                FOCUS_RING,
              )}
            >
              <span
                className={cn(
                  'block rounded-pill border border-white/15',
                  active ? 'size-8' : 'size-7',
                )}
                style={{
                  background: color.hex,
                  boxShadow: active ? '0 0 0 2px var(--color-volt)' : undefined,
                }}
              />
            </button>
          );
        })}
      </div>
      {poor && (
        <p className="mt-2 text-[12.5px] text-warning">
          These two are very close in tone. The badge will read as one flat shape at list size.
        </p>
      )}
    </fieldset>
  );
}

/* --- selectable card -------------------------------------------------- */

export interface SelectCardProps {
  selected: boolean;
  onSelect: () => void;
  label: string;
  accent?: string;
  children: ReactNode;
  className?: string;
}

/**
 * A large, tappable choice — an archetype, a pre-made manager, a club to take
 * over. Selection is carried by an accent edge and a check, never by colour
 * alone.
 */
export function SelectCard({
  selected, onSelect, label, accent, children, className,
}: SelectCardProps): ReactNode {
  const m = useDesignMotion();
  return (
    <motion.button
      type="button"
      aria-pressed={selected}
      aria-label={label}
      onClick={() => {
        haptics.impact();
        onSelect();
      }}
      whileTap={m.safe({ scale: 0.99 })}
      transition={m.spring.press}
      className={cn(
        'relative w-full overflow-hidden rounded-[var(--radius-lg)] border p-4 text-left',
        'transition-colors duration-[var(--duration-fast)] ease-out-quint',
        selected
          ? 'border-volt/60 bg-white/[0.07]'
          : 'border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.055]',
        FOCUS_RING,
        className,
      )}
    >
      {accent !== undefined && (
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 w-[3px]"
          style={{ background: accent, opacity: selected ? 1 : 0.5 }}
        />
      )}
      {children}
    </motion.button>
  );
}
