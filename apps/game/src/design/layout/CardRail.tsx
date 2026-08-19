import { Children, useRef, type ReactNode } from 'react';
import { cn } from '../cn';
import { useCanHover } from '../useMediaQuery';
import { GlassIcon } from '../glass/GlassIcon';
import { IconChevronLeft, IconChevronRight } from '../icons';

export interface CardRailProps {
  children: ReactNode;
  /** Item width. Fixed rather than fluid so cards align across every rail. */
  itemWidth?: number | string;
  gap?: 'sm' | 'md';
  /** Bleeds to the screen edges so the rail visibly continues off-screen. */
  bleed?: boolean;
  /** Desktop arrow controls. Auto-hidden on touch-only devices. */
  arrows?: boolean;
  ariaLabel?: string;
  className?: string;
}

/**
 * Horizontal snap rail.
 *
 * Two decisions worth stating. The rail bleeds past the screen gutter by
 * default and pads the first item back in, so the next card is visibly cut off
 * at the edge — that peek is the entire affordance telling the player there is
 * more. And `scroll-snap-align: start` (not `center`) keeps the leading edges
 * of cards on the same vertical line as the section header above them.
 *
 * Arrow controls appear only where a hover pointer exists; on touch they would
 * be dead weight over the content.
 */
export function CardRail({
  children,
  itemWidth = 148,
  gap = 'md',
  bleed = true,
  arrows = true,
  ariaLabel,
  className,
}: CardRailProps): ReactNode {
  const ref = useRef<HTMLDivElement>(null);
  const canHover = useCanHover();
  const count = Children.count(children);

  const scrollBy = (direction: 1 | -1): void => {
    const node = ref.current;
    if (!node) return;
    node.scrollBy({ left: direction * node.clientWidth * 0.8, behavior: 'smooth' });
  };

  return (
    <div className={cn('relative', className)}>
      <div
        ref={ref}
        role="group"
        aria-label={ariaLabel}
        className={cn(
          'scroll-x snap-rail flex',
          gap === 'sm' ? 'gap-2' : 'gap-3',
          bleed ? '-mx-4 px-4 sm:-mx-6 sm:px-6' : '',
        )}
      >
        {Children.map(children, (child, index) => (
          <div
            key={index}
            className="snap-item shrink-0"
            style={{ width: typeof itemWidth === 'number' ? `${itemWidth}px` : itemWidth }}
          >
            {child}
          </div>
        ))}
      </div>

      {arrows && canHover && count > 2 && (
        <>
          <div className="absolute -left-3 top-1/2 hidden -translate-y-1/2 md:block">
            <GlassIcon
              label="Scroll left"
              icon={<IconChevronLeft />}
              size="sm"
              level={3}
              onClick={() => scrollBy(-1)}
            />
          </div>
          <div className="absolute -right-3 top-1/2 hidden -translate-y-1/2 md:block">
            <GlassIcon
              label="Scroll right"
              icon={<IconChevronRight />}
              size="sm"
              level={3}
              onClick={() => scrollBy(1)}
            />
          </div>
        </>
      )}
    </div>
  );
}
