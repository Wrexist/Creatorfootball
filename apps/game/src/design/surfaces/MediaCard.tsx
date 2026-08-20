import { forwardRef, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { cn } from '../cn';
import { useDesignMotion } from '../motion';
import { haptics } from '../haptics';
import { FOCUS_RING } from '../glass/glassLevel';
import { TYPE_CLASS } from '../typography/type';
import { bleedStyle, TEXTURE_CLASS, type SurfaceTexture } from './material';

export interface MediaCardProps {
  /** The visual: a badge, a portrait, procedural art, a pitch diagram. */
  media: ReactNode;
  /** Height of the media band. */
  aspect?: 'wide' | 'square' | 'portrait' | 'band';
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Sits over the media, bottom-left: a pill, a live marker, a score. */
  overlay?: ReactNode;
  /** Top-right corner of the media band. */
  badge?: ReactNode;
  footer?: ReactNode;
  bleed?: string;
  texture?: SurfaceTexture;
  onPress?: () => void;
  className?: string;
  children?: ReactNode;
}

const ASPECT = {
  wide: 'aspect-[16/9]',
  square: 'aspect-square',
  portrait: 'aspect-[3/4]',
  band: 'h-24',
} as const;

/**
 * A card with a picture in it.
 *
 * The one shape in the kit where the content bleeds to the edge. The media band
 * runs full width with a scrim graduating into the text block underneath, so
 * the two halves read as one object rather than as an image pasted onto a card
 * - and because the scrim is a gradient rather than a rule, the card has a
 * light direction, which is the thing a flat rounded rectangle can never have.
 *
 * The asymmetric radius (large on the outer corners, small where the media
 * meets the text) is intentional. It stops the card looking like a photo frame.
 */
export const MediaCard = forwardRef<HTMLDivElement, MediaCardProps>(function MediaCard(
  {
    media, aspect = 'wide', eyebrow, title, subtitle, overlay, badge, footer,
    bleed, texture = 'none', onPress, className, children,
  },
  ref,
) {
  const m = useDesignMotion();
  const interactive = Boolean(onPress);
  const Element = interactive ? motion.button : motion.div;

  return (
    <Element
      ref={ref as never}
      type={interactive ? 'button' : undefined}
      onClick={interactive ? () => { haptics.selection(); onPress?.(); } : undefined}
      whileTap={interactive && !m.reduced ? { scale: 0.985 } : undefined}
      transition={m.spring.press}
      style={bleedStyle(bleed, 30)}
      className={cn(
        'glass-2 glass-sheen relative isolate flex w-full flex-col overflow-hidden text-left',
        'rounded-[26px_26px_26px_10px]',
        bleed && 'glass-bleed',
        interactive && FOCUS_RING,
        className,
      )}
    >
      <div className={cn('relative z-1 w-full shrink-0 overflow-hidden', ASPECT[aspect])}>
        <div className="absolute inset-0 flex items-center justify-center">{media}</div>
        {texture !== 'none' && (
          <span aria-hidden="true" className={cn('pointer-events-none absolute inset-0', TEXTURE_CLASS[texture])} />
        )}
        {/* Scrim: the media does not stop, it dissolves into the text block. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-base via-base/55 to-transparent"
        />
        {badge !== undefined && <div className="absolute right-3 top-3 z-1">{badge}</div>}
        {overlay !== undefined && <div className="absolute bottom-2.5 left-4 z-1">{overlay}</div>}
      </div>

      <div className="relative z-1 -mt-1 flex flex-col gap-1 px-4 pb-4">
        {eyebrow !== undefined && <span className={TYPE_CLASS.eyebrow}>{eyebrow}</span>}
        <span className={cn(TYPE_CLASS.title, 'text-title text-pretty')}>{title}</span>
        {subtitle !== undefined && (
          <span className={cn(TYPE_CLASS.caption, 'text-pretty')}>{subtitle}</span>
        )}
        {children}
        {footer !== undefined && (
          <div className="mt-2 flex flex-wrap items-center gap-2">{footer}</div>
        )}
      </div>
    </Element>
  );
});
