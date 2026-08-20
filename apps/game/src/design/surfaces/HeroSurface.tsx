import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '../cn';
import { glassClass, RADIUS_CLASS, type GlassLevel, type RadiusToken } from '../glass/glassLevel';
import { TYPE_CLASS } from '../typography/type';
import { bleedStyle, TEXTURE_CLASS, type SurfaceTexture } from './material';

export interface HeroSurfaceProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  /** Volt kicker above the title. Short, ours, uppercase. */
  eyebrow?: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Right-hand slot on the title line: a badge, a score, an action. */
  trailing?: ReactNode;
  /** Bottom slot: pills, a stat row, a button. */
  footer?: ReactNode;
  /** Club primary. Bleeds into the material as ambient light. */
  bleed?: string;
  bleedStrength?: number;
  texture?: SurfaceTexture;
  level?: GlassLevel;
  radius?: RadiusToken;
  /** Level 1 nested inside another glass surface: drops the blur. */
  nested?: boolean;
  padding?: 'md' | 'lg' | 'xl';
  children?: ReactNode;
}

const PADDING = { md: 'p-5', lg: 'p-6', xl: 'px-6 py-8' } as const;

/**
 * The biggest object on a screen, and the only one allowed to look like it.
 *
 * Everything else in the kit is a container; this is a *place*. It runs at
 * glass level 4 by default so the separation from the level-1 and level-2 cards
 * around it is unmistakable, and it is the surface the football textures and
 * the club-colour bleed were built for.
 *
 * One per screen. Two hero surfaces on the same screen is two heroes, which is
 * none.
 */
export const HeroSurface = forwardRef<HTMLElement, HeroSurfaceProps>(function HeroSurface(
  {
    eyebrow,
    title,
    subtitle,
    trailing,
    footer,
    bleed,
    bleedStrength,
    texture = 'none',
    level = 4,
    radius = '2xl',
    nested = false,
    padding = 'lg',
    className,
    style,
    children,
    ...rest
  },
  ref,
) {
  const hasHead = eyebrow !== undefined || title !== undefined || subtitle !== undefined
    || trailing !== undefined;

  return (
    <section
      ref={ref}
      className={cn(
        'relative isolate overflow-hidden',
        glassClass(level, !nested),
        RADIUS_CLASS[radius],
        PADDING[padding],
        'glass-sheen',
        bleed && 'glass-bleed',
        className,
      )}
      style={{ ...bleedStyle(bleed, bleedStrength), ...style }}
      {...rest}
    >
      {/* Texture rides on its own layer: the root already spends ::before on the
          specular sheen and ::after on the club bleed. */}
      {texture !== 'none' && (
        <span aria-hidden="true" className={cn('pointer-events-none absolute inset-0', TEXTURE_CLASS[texture])} />
      )}

      <div className="relative z-1">
        {hasHead && (
          <header className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              {eyebrow !== undefined && <p className={cn(TYPE_CLASS.eyebrow, 'mb-2')}>{eyebrow}</p>}
              {title !== undefined && <h2 className={TYPE_CLASS.hero}>{title}</h2>}
              {subtitle !== undefined && (
                <p className={cn(TYPE_CLASS.body, 'mt-1.5 text-ink-muted text-pretty')}>{subtitle}</p>
              )}
            </div>
            {trailing !== undefined && <div className="shrink-0">{trailing}</div>}
          </header>
        )}
        {children !== undefined && <div className={cn(hasHead && 'mt-5')}>{children}</div>}
        {footer !== undefined && (
          <footer className="mt-5 flex flex-wrap items-center gap-2">{footer}</footer>
        )}
      </div>
    </section>
  );
});
