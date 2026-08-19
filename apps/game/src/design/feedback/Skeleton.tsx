import type { ReactNode } from 'react';
import { cn } from '../cn';
import { useDesignMotion } from '../motion';

export interface SkeletonProps {
  className?: string;
  /** Convenience shapes so screens do not hand-roll dimensions. */
  variant?: 'text' | 'title' | 'block' | 'circle' | 'card' | 'row';
  /** Number of repeats for `text` and `row`. */
  lines?: number;
  width?: number | string;
  height?: number | string;
}

const VARIANT: Record<NonNullable<SkeletonProps['variant']>, string> = {
  text: 'h-3.5 rounded-sm',
  title: 'h-5 rounded-sm w-1/2',
  block: 'h-24 rounded-lg',
  circle: 'size-11 rounded-pill',
  card: 'aspect-[3/4] rounded-lg',
  row: 'h-14 rounded-md',
};

/**
 * Loading placeholder.
 *
 * The shimmer is a CSS background-position animation on a static gradient, not
 * an opacity pulse on a stack of nodes: a squad screen shows eighteen of these
 * at once and a per-element animation there is the difference between a smooth
 * skeleton and a stuttering one. Under reduced motion the shimmer stops and the
 * block stays a flat tint, which still reads as "not ready".
 */
export function Skeleton({
  className,
  variant = 'text',
  lines = 1,
  width,
  height,
}: SkeletonProps): ReactNode {
  const m = useDesignMotion();
  const base = cn(
    'bg-white/[0.06]',
    !m.reduced &&
      'bg-[linear-gradient(100deg,rgb(255_255_255/0.04)_30%,rgb(255_255_255/0.11)_50%,rgb(255_255_255/0.04)_70%)] bg-[length:220%_100%] animate-shimmer',
    VARIANT[variant],
    className,
  );

  const style = {
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
  };

  if (lines <= 1) {
    return <span className={cn('block', base)} style={style} aria-hidden="true" />;
  }

  return (
    <span className="flex flex-col gap-2" aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <span
          key={i}
          className={cn('block', base, i === lines - 1 && variant === 'text' && 'w-3/5')}
          style={style}
        />
      ))}
    </span>
  );
}

/**
 * Wrap a loading region so assistive tech is told once that content is coming,
 * instead of reading a wall of decorative placeholder nodes.
 */
export function SkeletonRegion({
  loading,
  children,
  label = 'Loading',
  className,
}: {
  loading: boolean;
  children: ReactNode;
  label?: string;
  className?: string;
}): ReactNode {
  return (
    <div
      className={className}
      aria-busy={loading || undefined}
      aria-live="polite"
      aria-label={loading ? label : undefined}
    >
      {children}
    </div>
  );
}
