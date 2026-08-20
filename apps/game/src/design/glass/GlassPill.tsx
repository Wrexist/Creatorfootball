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
  /**
   * Uppercase the label.
   *
   * Off by default, and that is the change: every pill used to be uppercased,
   * which made each one about 30% wider than the words needed. In a wrapping
   * row of tactical instructions that was the difference between "To the side"
   * and "TO THE SIDE A...". Turn it on for short fixed codes - "FT", "LIVE",
   * "NEW" - where the shouting is the point and the width is trivial.
   */
  caps?: boolean;
  /**
   * Let a long label wrap instead of forcing one line. Pills stay on one line
   * by default; a pill carrying real content (a tactic, a role, a trait) can
   * take a second line rather than push its row out of the layout.
   */
  wrap?: boolean;
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
  xs: 'min-h-5 px-1.5 text-micro gap-1 [&_svg]:size-3',
  sm: 'min-h-6 px-2 text-micro gap-1 [&_svg]:size-3.5',
  md: 'min-h-7 px-2.5 text-xs gap-1.5 [&_svg]:size-4',
};

export function GlassPill({
  tone = 'neutral',
  size = 'sm',
  icon,
  filled = false,
  caps = false,
  wrap = false,
  className,
  children,
  ...rest
}: GlassPillProps): ReactNode {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center rounded-pill border font-semibold',
        caps ? 'uppercase tracking-[0.08em]' : 'tracking-[0.005em]',
        wrap ? 'py-0.5 leading-tight text-pretty' : 'whitespace-nowrap',
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
