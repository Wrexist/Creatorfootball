import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { cn } from '../cn';

/**
 * Optional generated art, composited over a procedural layer that already draws.
 *
 * The whole point of this module is what it does when the file is *not* there:
 * nothing. No broken-image glyph, no reserved gap, no thrown error, no console
 * noise — the caller's procedural fallback stays mounted underneath and the
 * player sees the shipped art direction rather than a hole.
 *
 * That is why loading goes through `Image` rather than a bare `<img>` in the
 * tree: a decoded-and-verified asset can fade in, and a missing one never
 * mounts an element at all.
 */

export type ArtStatus = 'pending' | 'ready' | 'failed';

/**
 * Module-level memo of what each URL turned out to be. A hero moment can mount
 * several times per session and a 404 should be paid for once, not once per
 * reveal.
 */
const settled = new Map<string, ArtStatus>();

/** Resolve one art URL, reporting `failed` rather than throwing. */
export function useArtAsset(src: string | undefined): ArtStatus {
  const [status, setStatus] = useState<ArtStatus>(
    () => (src === undefined ? 'failed' : settled.get(src) ?? 'pending'),
  );

  useEffect(() => {
    if (src === undefined) {
      setStatus('failed');
      return;
    }

    const known = settled.get(src);
    if (known !== undefined && known !== 'pending') {
      setStatus(known);
      return;
    }

    // SSR, jsdom without an image decoder, or any environment that has no
    // loader: treat as absent and let the procedural path own the frame.
    if (typeof window === 'undefined' || typeof window.Image !== 'function') {
      setStatus('failed');
      return;
    }

    let alive = true;
    const image = new window.Image();

    const settle = (next: ArtStatus): void => {
      settled.set(src, next);
      if (alive) setStatus(next);
    };

    image.onload = () => settle('ready');
    image.onerror = () => settle('failed');
    image.decoding = 'async';
    image.src = src;

    return () => {
      alive = false;
      image.onload = null;
      image.onerror = null;
    };
  }, [src]);

  return status;
}

export interface ArtLayerProps {
  /** One of `ART_ASSETS`. An unknown or missing file renders nothing. */
  src: string;
  /** Full opacity once loaded. Plates are mixed low by design. */
  opacity?: number;
  /** Composite mode. `screen` for light plates, `overlay` for texture. */
  blend?: CSSProperties['mixBlendMode'];
  /** Fade-in duration once decoded, in seconds. `0` disables the fade. */
  fade?: number;
  className?: string;
  style?: CSSProperties;
}

/**
 * A decorative image plate. Renders `null` until the asset is known-good, and
 * forever if it never is.
 */
export function ArtLayer({
  src, opacity = 1, blend = 'screen', fade = 0.4, className, style,
}: ArtLayerProps): ReactNode {
  const status = useArtAsset(src);

  if (status !== 'ready') return null;

  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      draggable={false}
      decoding="async"
      className={cn('pointer-events-none absolute inset-0 h-full w-full select-none object-cover', className)}
      style={{
        opacity,
        mixBlendMode: blend,
        animation: fade > 0 ? `cf-art-in ${fade}s ease-out backwards` : undefined,
        ...style,
      }}
    />
  );
}
