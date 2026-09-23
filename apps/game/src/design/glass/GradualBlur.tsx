import type { CSSProperties, ReactNode } from 'react';
import { cn } from '../cn';
import './GradualBlur.css';

export interface GradualBlurProps {
  side?: 'top' | 'bottom';
  height?: number | string;
  strength?: number;
  className?: string;
}

/** Three small, static strips soften the scroll edge without blurring controls.
 * Keep masks on the individual layers: a masked parent would prevent its
 * children from sampling the content behind it. No scroll listeners or RAFs.
 */
export function GradualBlur({ side = 'bottom', height = 72, strength = 12, className }: GradualBlurProps): ReactNode {
  const direction = side === 'top' ? 'to bottom' : 'to top';
  const radius = Math.max(0, Math.min(20, strength));
  return <span aria-hidden="true" className={cn('cf-edge-blur', `cf-edge-blur-${side}`, className)}
    style={{ height, '--edge-direction': direction } as CSSProperties}>
    {[{ scale: .25, start: 52, end: 100 }, { scale: .5, start: 24, end: 76 }, { scale: 1, start: 0, end: 46 }].map(({ scale, start, end }) => {
      const mask = `linear-gradient(${direction}, #000 ${start}%, transparent ${end}%)`;
      return <span key={scale} className="cf-edge-blur-layer" style={{
        backdropFilter: `blur(${radius * scale}px)`, WebkitBackdropFilter: `blur(${radius * scale}px)`,
        maskImage: mask, WebkitMaskImage: mask,
      }} />;
    })}
  </span>;
}
