import { type ElementType, type ReactNode } from 'react';
import { cn } from '../cn';
import { TYPE_CLASS, TYPE_SIZE, type TypeRole } from './type';
import { EntityName, type EntityNameProps } from './FitText';

/**
 * The one way to set type.
 *
 * A component that writes `text-[13px] font-semibold uppercase tracking-[0.14em]`
 * has invented a role, and the next component will invent a slightly different
 * one. `<Text role="label">` cannot drift.
 *
 * Overrides still work - `cn()` merges, so `className="text-ink"` on a caption
 * recolours it - but the size, weight and tracking of a role are the role's.
 */

export interface TextProps {
  role?: TypeRole;
  as?: ElementType;
  /** Tone override. The role's own colour is used when this is omitted. */
  tone?: 'default' | 'muted' | 'dim' | 'volt' | 'positive' | 'warning' | 'danger' | 'inverse';
  /** Body copy only. Names must never be clamped - use `NameText`. */
  clamp?: 1 | 2 | 3 | 4;
  align?: 'start' | 'center' | 'end';
  children?: ReactNode;
  className?: string;
  id?: string;
  title?: string;
}

const TONE: Record<NonNullable<TextProps['tone']>, string> = {
  default: '',
  muted: 'text-ink-muted',
  dim: 'text-ink-dim',
  volt: 'text-volt',
  positive: 'text-positive',
  warning: 'text-warning',
  danger: 'text-danger',
  inverse: 'text-ink-inverse',
};

const CLAMP: Record<NonNullable<TextProps['clamp']>, string> = {
  1: 'line-clamp-1',
  2: 'line-clamp-2',
  3: 'line-clamp-3',
  4: 'line-clamp-4',
};

const ALIGN = { start: 'text-left', center: 'text-center', end: 'text-right' } as const;

/** Which element a role renders as when the caller does not say. */
const DEFAULT_ELEMENT: Partial<Record<TypeRole, ElementType>> = {
  display: 'h1',
  hero: 'h1',
  title: 'h2',
  section: 'h3',
  body: 'p',
  caption: 'p',
  commentary: 'p',
};

export function Text({
  role = 'body',
  as,
  tone,
  clamp,
  align,
  children,
  className,
  ...rest
}: TextProps): ReactNode {
  const Element = as ?? DEFAULT_ELEMENT[role] ?? 'span';
  return (
    <Element
      className={cn(
        TYPE_CLASS[role],
        tone && TONE[tone],
        clamp && CLAMP[clamp],
        align && ALIGN[align],
        className,
      )}
      {...rest}
    >
      {children}
    </Element>
  );
}

/* --- names ------------------------------------------------------------- */

export interface NameTextProps extends Omit<EntityNameProps, 'size' | 'min'> {
  /** Role the name is set in. Its size becomes the ceiling. */
  role?: TypeRole;
  /** Floor, as a fraction of the role's size. 0.78 by default. */
  floor?: number;
  /** Absolute floor in px. Wins over `floor` when both are given. */
  min?: number;
}

/**
 * An entity name, set in a type role, fitted to its slot.
 *
 * This is what screens should reach for whenever a club, player, creator or
 * competition name lands in a layout that did not choose its width. It never
 * clips: it shrinks within the role, then falls back to the short name, then
 * the abbreviation, then wraps.
 */
export function NameText({
  role = 'bodyStrong',
  floor = 0.78,
  min,
  className,
  ...rest
}: NameTextProps): ReactNode {
  const size = TYPE_SIZE[role];
  return (
    <EntityName
      {...rest}
      size={size}
      min={min ?? Math.max(9, Math.round(size * floor))}
      className={cn(TYPE_CLASS[role], className)}
    />
  );
}

/* --- numerals ---------------------------------------------------------- */

export interface NumericProps {
  children: ReactNode;
  role?: Extract<TypeRole, 'stat' | 'giant' | 'score' | 'live'>;
  tone?: TextProps['tone'];
  /** Renders a leading + on positive values. Callers pass the sign themselves. */
  className?: string;
  'aria-label'?: string;
}

/**
 * Broadcast numerals. Tabular so a column of them aligns, tightly tracked so a
 * pair reads as one object, and heavy enough to survive a club-colour wash.
 */
export function Numeric({
  children, role = 'stat', tone, className, ...rest
}: NumericProps): ReactNode {
  return (
    <span className={cn(TYPE_CLASS[role], tone && TONE[tone], className)} {...rest}>
      {children}
    </span>
  );
}
