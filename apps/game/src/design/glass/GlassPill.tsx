import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../cn';

export type PillTone =
  | 'neutral' | 'volt' | 'positive' | 'warning' | 'danger' | 'info' | 'special';
export type PillSize = 'xs' | 'sm' | 'md';

export interface GlassPillProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: PillTone;
  size?: PillSize;
  icon?: ReactNode;
  /** Filled pills read as status; outlined pills read as metadata. */
  filled?: boolean;
  children?: ReactNode;
}

/**
 * Tinted backgrounds sit at 14-18% over the graphite base, which keeps the
 * label above 4.5:1 while still reading as a colour wash rather than a block.
 * Solid fills are only used where the pill *is* the message (a red card, a
 * completed objective).
 */
const TONE: Record<PillTone, { soft: string; solid: string }> = {
  neutral: {
    soft: 'bg-white/[0.07] text-ink-muted border-white/10',
    solid: 'bg-surface-4 text-ink border-transparent',
  },
  volt: {
    soft: 'bg-volt/14 text-volt border-volt/28',
    solid: 'bg-volt text-volt-ink border-transparent',
  },
  positive: {
    soft: 'bg-positive/14 text-positive border-positive/28',
    solid: 'bg-positive text-void border-transparent',
  },
  warning: {
    soft: 'bg-warning/14 text-warning border-warning/28',
    solid: 'bg-warning text-void border-transparent',
  },
  danger: {
    soft: 'bg-danger/16 text-danger border-danger/30',
    solid: 'bg-danger text-ink border-transparent',
  },
  info: {
    soft: 'bg-info/14 text-info border-info/28',
    solid: 'bg-info text-void border-transparent',
  },
  special: {
    soft: 'bg-special/14 text-special border-special/28',
    solid: 'bg-special text-void border-transparent',
  },
};

const SIZE: Record<PillSize, string> = {
  xs: 'h-5 px-1.5 text-[10px] gap-1 [&_svg]:size-3',
  sm: 'h-6 px-2 text-[11px] gap-1 [&_svg]:size-3.5',
  md: 'h-7 px-2.5 text-xs gap-1.5 [&_svg]:size-4',
};

export function GlassPill({
  tone = 'neutral',
  size = 'sm',
  icon,
  filled = false,
  className,
  children,
  ...rest
}: GlassPillProps): ReactNode {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-pill border font-semibold uppercase tracking-[0.06em] whitespace-nowrap',
        SIZE[size],
        filled ? TONE[tone].solid : TONE[tone].soft,
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </span>
  );
}
