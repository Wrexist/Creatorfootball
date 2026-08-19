import { useRef, type ReactNode } from 'react';
import { motion, useMotionTemplate, useMotionValue } from 'motion/react';
import { cn } from '../cn';
import { useDesignMotion } from '../motion';
import { useCanHover } from '../useMediaQuery';

/**
 * Reserved effects.
 *
 * These are the only components in the kit allowed to look expensive, and they
 * are licensed to exactly nine moments: club reveal, player signing, match
 * start, goal, big save, trophy, promotion, record, legendary achievement.
 * Everything else in the product stays calm — that restraint is what gives
 * these any impact at all. If you are reaching for one of these on a settings
 * screen, the answer is no.
 *
 * On the React Bits reference list: we built our own equivalents of Shiny Text,
 * Spotlight Card, Glare Hover and Gradual Blur because each of them earns its
 * place here (identity, focus, feedback, hierarchy respectively). Deliberately
 * NOT built: Magic Bento (a bento grid is a marketing-page layout; our screens
 * are lists and tables), Tilted Card (3D tilt on a football card reads as a
 * gimmick and fights the drag gestures on the same surface), Dock (we have a
 * tab bar with seven fixed destinations, which a magnifying dock would make
 * *harder* to hit), Card Nav (same reason — navigation must be boring and
 * instant), Fluid Glass / Glass Surface (our four glass levels already ship in
 * tokens.css; a second, incompatible glass system would fracture the material
 * language), Animated List (our `listContainer`/`listItem` variants cover it
 * with no extra component).
 */

/* --- ShinyText -------------------------------------------------------- */

export interface ShinyTextProps {
  children: ReactNode;
  /** Base colour of the text. The sweep is always volt. */
  tone?: 'ink' | 'volt' | 'gold';
  /** Repeats forever. Off by default: a permanently shimmering label is noise. */
  loop?: boolean;
  as?: 'span' | 'h1' | 'h2' | 'p';
  className?: string;
}

const SHINE_BASE: Record<NonNullable<ShinyTextProps['tone']>, string> = {
  ink: 'linear-gradient(100deg,#9aa3ad 0%,#9aa3ad 38%,#f4f6f8 50%,#9aa3ad 62%,#9aa3ad 100%)',
  volt: 'linear-gradient(100deg,#9ecc12 0%,#9ecc12 38%,#dcff6b 50%,#9ecc12 62%,#9ecc12 100%)',
  gold: 'linear-gradient(100deg,#b8862b 0%,#b8862b 38%,#ffd76a 50%,#b8862b 62%,#b8862b 100%)',
};

/**
 * A single specular sweep across a headline. Implemented with
 * `background-clip: text` on a moving gradient — one paint, no extra nodes, and
 * it degrades to a flat colour when motion is reduced.
 */
export function ShinyText({
  children,
  tone = 'ink',
  loop = false,
  as = 'span',
  className,
}: ShinyTextProps): ReactNode {
  const m = useDesignMotion();
  const Element = as;

  if (m.reduced) {
    return (
      <Element className={cn(tone === 'volt' ? 'text-volt' : tone === 'gold' ? 'text-hero-gold' : 'text-ink', className)}>
        {children}
      </Element>
    );
  }

  return (
    <Element
      className={cn('bg-clip-text text-transparent animate-sheen', !loop && '[animation-iteration-count:2]', className)}
      style={{ backgroundImage: SHINE_BASE[tone], backgroundSize: '220% 100%' }}
    >
      {children}
    </Element>
  );
}

/* --- SpotlightCard ---------------------------------------------------- */

export interface SpotlightCardProps {
  children: ReactNode;
  /** Radius of the light in px. */
  radius?: number;
  color?: string;
  className?: string;
}

/**
 * A card that lights up under the pointer.
 *
 * Pointer position is held in motion values and piped straight into a CSS
 * variable, so moving the mouse never triggers a React render. The effect is
 * gated on `hover: hover` — on touch there is no pointer to follow and the
 * listener would be pure cost.
 */
export function SpotlightCard({
  children,
  radius = 220,
  color = 'rgb(200 255 46 / 0.16)',
  className,
}: SpotlightCardProps): ReactNode {
  const canHover = useCanHover();
  const m = useDesignMotion();
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(-9999);
  const y = useMotionValue(-9999);
  const background = useMotionTemplate`radial-gradient(${radius}px circle at ${x}px ${y}px, ${color}, transparent 72%)`;

  const enabled = canHover && !m.reduced;

  return (
    <div
      ref={ref}
      onPointerMove={
        enabled
          ? (event) => {
              const rect = ref.current?.getBoundingClientRect();
              if (!rect) return;
              x.set(event.clientX - rect.left);
              y.set(event.clientY - rect.top);
            }
          : undefined
      }
      onPointerLeave={enabled ? () => { x.set(-9999); y.set(-9999); } : undefined}
      className={cn('group relative overflow-hidden rounded-xl glass-2 glass-sheen', className)}
    >
      {enabled && (
        <motion.span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-[var(--duration-medium)] ease-out-quint group-hover:opacity-100"
          style={{ background }}
        />
      )}
      <div className="relative">{children}</div>
    </div>
  );
}

/* --- GlareHover ------------------------------------------------------- */

export interface GlareHoverProps {
  children: ReactNode;
  className?: string;
}

/**
 * A single diagonal glare that crosses the surface on hover. Used on
 * collectible surfaces (a legendary card, a trophy tile) to suggest a physical
 * finish. Transform-only, so it composites on the GPU.
 */
export function GlareHover({ children, className }: GlareHoverProps): ReactNode {
  const canHover = useCanHover();
  const m = useDesignMotion();

  return (
    <div className={cn('group relative overflow-hidden', className)}>
      {children}
      {canHover && !m.reduced && (
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute -inset-y-8 -left-1/3 w-1/3 -translate-x-full rotate-[18deg]',
            'bg-[linear-gradient(90deg,transparent,rgb(255_255_255/0.18),transparent)]',
            'transition-transform duration-[var(--duration-slow)] ease-out-quint group-hover:translate-x-[420%]',
          )}
        />
      )}
    </div>
  );
}

/* --- GradualBlur ------------------------------------------------------ */

export interface GradualBlurProps {
  /** Which edge fades. */
  side?: 'top' | 'bottom';
  height?: number;
  strength?: number;
  className?: string;
}

/**
 * A progressive blur along one edge, used to let content dissolve under a
 * header or a sticky footer instead of hitting a hard line.
 *
 * The usual implementation stacks six to eight `backdrop-filter` layers with
 * stepped masks. We use exactly **one** masked layer: stacked backdrop filters
 * are the single most expensive pattern available on a mobile GPU, and this kit
 * has a hard two-blur budget per screen that the header and the sheet already
 * spend. The one-layer version is slightly less smooth and enormously cheaper —
 * a trade-off made on purpose.
 */
export function GradualBlur({
  side = 'bottom',
  height = 72,
  strength = 10,
  className,
}: GradualBlurProps): ReactNode {
  const mask =
    side === 'bottom'
      ? 'linear-gradient(to top, #000 0%, #000 32%, transparent 100%)'
      : 'linear-gradient(to bottom, #000 0%, #000 32%, transparent 100%)';

  return (
    <span
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-x-0 z-10', side === 'bottom' ? 'bottom-0' : 'top-0', className)}
      style={{
        height,
        backdropFilter: `blur(${strength}px)`,
        WebkitBackdropFilter: `blur(${strength}px)`,
        maskImage: mask,
        WebkitMaskImage: mask,
      }}
    />
  );
}
