import type { ReactNode } from 'react';
import { cn } from '@/design';

/**
 * The wordmark, drawn rather than typeset.
 *
 * No image assets ship with this product, so the one piece of branding the
 * player sees before any content has loaded has to be vector. It is a single
 * path pair — a ball silhouette cut by a volt slash — which renders identically
 * at 28px in a header and 96px on the splash.
 */
export function BrandMark({
  size = 72,
  className,
  title,
}: {
  size?: number;
  className?: string;
  title?: string;
}): ReactNode {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={cn('block shrink-0', className)}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <circle cx="32" cy="32" r="29" fill="none" stroke="currentColor" strokeWidth="2.5" opacity="0.22" />
      <circle cx="32" cy="32" r="20.5" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.14" />
      <path
        d="M38 8 L20 34 H31 L26 56 L46 27 H34 Z"
        fill="var(--color-volt)"
      />
    </svg>
  );
}
