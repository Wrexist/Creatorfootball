import type { ReactNode } from 'react';

/**
 * The wordmark, drawn rather than typeset.
 *
 * No image assets ship with this product, so the one piece of branding the
 * player sees before any content has loaded has to be vector. It is two circles
 * and a bolt, which renders identically at 28px in a header and 96px on the
 * splash.
 *
 * Deliberately dependency-free — not even `cn` — because it renders inside the
 * first chunk, and everything imported from the design system's barrel drags
 * the engine along with it. See `app/Entry.tsx`.
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
      className={className ? `block shrink-0 ${className}` : 'block shrink-0'}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <circle cx="32" cy="32" r="29" fill="none" stroke="currentColor" strokeWidth="2.5" opacity="0.22" />
      <circle cx="32" cy="32" r="20.5" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.14" />
      <path d="M38 8 L20 34 H31 L26 56 L46 27 H34 Z" fill="var(--color-volt)" />
    </svg>
  );
}
