import { memo, useId, type ReactNode } from 'react';
import type { BadgeMotif, BadgeShape, ClubVisualIdentity } from '@cf/engine';
import { cn } from '../cn';
import { darken, lighten, pickReadable, rgba } from '../color';

/**
 * Procedurally generated club badges.
 *
 * A badge is composed from four independent axes carried on `ClubVisualIdentity`
 * — shape × pattern × palette × motif — which gives 5 × 6 × n × 12 distinct
 * crests from one renderer and no art pipeline.
 *
 * The design decision that makes this work: the motif language is **bold
 * geometric emblem**, not pseudo-heraldry. Fake heraldry drawn in vector paths
 * always lands somewhere between "clip art" and "legally uncomfortable"; flat
 * geometric emblems read at 20px in a league table, scale to a 200px club-reveal
 * hero, sit correctly next to the SF-adjacent type, and are unmistakably
 * original. Every motif is built from the same primitives (polygons, radial
 * stars, chevrons, thick strokes) so twelve clubs feel like one league.
 */

/* --- primitive helpers ---------------------------------------------- */

const poly = (points: readonly (readonly [number, number])[]): string =>
  `${points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x} ${y}`).join(' ')} Z`;

function starPath(cx: number, cy: number, count: number, outer: number, inner: number, rotation = -90): string {
  const parts: string[] = [];
  for (let i = 0; i < count * 2; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = ((rotation + (i * 180) / count) * Math.PI) / 180;
    parts.push(`${i === 0 ? 'M' : 'L'}${(cx + Math.cos(angle) * radius).toFixed(2)} ${(cy + Math.sin(angle) * radius).toFixed(2)}`);
  }
  return `${parts.join(' ')} Z`;
}

/* --- badge outlines (100 × 100) -------------------------------------- */

const SHAPE_PATH: Record<BadgeShape, string> = {
  SHIELD:
    'M50 3 L93 15 V48 C93 72 75 89 50 97 C25 89 7 72 7 48 V15 Z',
  CIRCLE:
    'M50 4 A46 46 0 1 1 49.99 4 Z',
  // Kite crest: flat shoulders, long taper. Reads as "club" faster than a
  // circle does at small sizes because the silhouette is asymmetric.
  CREST:
    'M11 6 H89 L92 22 C92 55 76 81 50 97 C24 81 8 55 8 22 Z',
  HEX: poly([
    [50, 3], [90.7, 26.5], [90.7, 73.5], [50, 97], [9.3, 73.5], [9.3, 26.5],
  ]),
  DIAMOND:
    'M50 3 C53 3 55 4 57 6 L94 43 C97 46 97 54 94 57 L57 94 C54 97 46 97 43 94 L6 57 C3 54 3 46 6 43 L43 6 C45 4 47 3 50 3 Z',
};

/* --- motifs (drawn in a 64 × 64 box, scaled into place) --------------- */

function Motif({
  motif, fg, bg,
}: { motif: BadgeMotif; fg: string; bg: string }): ReactNode {
  switch (motif) {
    case 'BOLT':
      return <path d={poly([[40, 2], [16, 36], [28, 36], [24, 62], [50, 26], [36, 26]])} fill={fg} />;

    case 'STAR':
      return <path d={starPath(32, 32, 5, 30, 12.6)} fill={fg} />;

    case 'CROWN':
      return (
        <g fill={fg}>
          <path d={poly([[6, 46], [11, 15], [21.5, 30], [32, 8], [42.5, 30], [53, 15], [58, 46]])} />
          <rect x="8" y="49" width="48" height="9" rx="2" />
        </g>
      );

    case 'FLAME':
      return (
        <>
          <path
            d="M32 2 C45 16 51 26 51 37 A19 19 0 0 1 13 37 C13 26 21 18 27 7 C29 18 31 22 35 24 C37 19 35 11 32 2 Z"
            fill={fg}
          />
          <path d="M32 27 C38 33 41 36 41 41 A9 9 0 0 1 23 41 C23 36 26 33 32 27 Z" fill={bg} opacity="0.5" />
        </>
      );

    case 'COMPASS':
      return (
        <g fill={fg}>
          <path d={starPath(32, 32, 4, 31, 8)} />
          <path d={starPath(32, 32, 4, 20, 5, -45)} opacity="0.55" />
          <circle cx="32" cy="32" r="4.5" fill={bg} />
        </g>
      );

    case 'PHOENIX':
      // Two swept wings plus a lance-shaped body. Mirrored exactly, which is
      // what makes an abstract bird read as a bird.
      return (
        <g fill={fg}>
          <path d={poly([[30, 17], [3, 8], [12, 29], [1, 35], [18, 42], [30, 45]])} />
          <path d={poly([[34, 17], [61, 8], [52, 29], [63, 35], [46, 42], [34, 45]])} />
          <path d={poly([[32, 3], [39, 26], [32, 61], [25, 26]])} />
        </g>
      );

    case 'WOLF':
      return (
        <g>
          <path
            d={poly([[9, 7], [24, 20], [40, 20], [55, 7], [51, 30], [44, 47], [32, 60], [20, 47], [13, 30]])}
            fill={fg}
          />
          <path d={poly([[21, 28], [30, 32], [21, 37]])} fill={bg} />
          <path d={poly([[43, 28], [34, 32], [43, 37]])} fill={bg} />
          <path d={poly([[32, 40], [26, 49], [38, 49]])} fill={bg} />
        </g>
      );

    case 'LION':
      return (
        <g>
          <path d={starPath(32, 32, 12, 31, 23)} fill={fg} />
          <circle cx="21" cy="21" r="5" fill={fg} />
          <circle cx="43" cy="21" r="5" fill={fg} />
          <circle cx="32" cy="32" r="16" fill={bg} opacity="0.92" />
          <circle cx="26" cy="29" r="2.4" fill={fg} />
          <circle cx="38" cy="29" r="2.4" fill={fg} />
          <path d={poly([[32, 34], [28, 39], [36, 39]])} fill={fg} />
          <path d="M32 39 v4" stroke={fg} strokeWidth="2" strokeLinecap="round" />
        </g>
      );

    case 'TOWER':
      return (
        <g fill={fg}>
          <path
            d={poly([
              [14, 10], [21, 10], [21, 17], [28.5, 17], [28.5, 10], [35.5, 10],
              [35.5, 17], [43, 17], [43, 10], [50, 10], [50, 60], [14, 60],
            ])}
          />
          <path d="M27 60 V45 A5 5 0 0 1 37 45 V60 Z" fill={bg} />
          <rect x="29" y="25" width="6" height="9" rx="3" fill={bg} />
        </g>
      );

    case 'ANCHOR':
      return (
        <g stroke={fg} fill="none" strokeWidth="6" strokeLinecap="round">
          <circle cx="32" cy="11" r="6" strokeWidth="5" />
          <path d="M32 17 V56" />
          <path d="M17 26 H47" strokeWidth="5" />
          <path d="M12 34 a20 20 0 0 0 40 0" />
          <path d="M12 34 l-5 6 M12 34 l6 4 M52 34 l5 6 M52 34 l-6 4" strokeWidth="4" />
        </g>
      );

    case 'SERPENT':
      return (
        <g>
          <path
            d="M14 12 C28 4 42 12 38 22 C34 32 16 32 16 42 C16 52 28 56 40 52"
            fill="none"
            stroke={fg}
            strokeWidth="7"
            strokeLinecap="round"
          />
          <path d={poly([[38, 46], [55, 52], [38, 58]])} fill={fg} />
          <circle cx="44" cy="52" r="1.8" fill={bg} />
        </g>
      );

    case 'HAMMER':
    default:
      return (
        <g fill={fg}>
          <path d={poly([[10, 11], [54, 11], [49, 29], [15, 29]])} />
          <rect x="28" y="28" width="8" height="33" rx="3" />
          <rect x="22" y="4" width="20" height="8" rx="3" opacity="0.55" />
        </g>
      );
  }
}

/* --- pattern fills ---------------------------------------------------- */

function Pattern({
  kind, primary, secondary, gradientId,
}: {
  kind: ClubVisualIdentity['kitPattern'];
  primary: string;
  secondary: string;
  gradientId: string;
}): ReactNode {
  switch (kind) {
    case 'STRIPES':
      return (
        <>
          <rect width="100" height="100" fill={primary} />
          {[0, 2, 4].map((i) => (
            <rect key={i} x={i * 20 + 10} y="0" width="10" height="100" fill={secondary} />
          ))}
        </>
      );
    case 'HOOPS':
      return (
        <>
          <rect width="100" height="100" fill={primary} />
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x="0" y={i * 24 + 12} width="100" height="12" fill={secondary} />
          ))}
        </>
      );
    case 'SASH':
      return (
        <>
          <rect width="100" height="100" fill={primary} />
          <path d={poly([[-20, 74], [66, -12], [92, 14], [6, 100]])} fill={secondary} />
        </>
      );
    case 'HALVES':
      return (
        <>
          <rect width="50" height="100" fill={primary} />
          <rect x="50" width="50" height="100" fill={secondary} />
        </>
      );
    case 'GRADIENT':
      return <rect width="100" height="100" fill={`url(#${gradientId})`} />;
    case 'SOLID':
    default:
      return <rect width="100" height="100" fill={primary} />;
  }
}

/* --- the badge -------------------------------------------------------- */

export interface ClubBadgeProps {
  visual: ClubVisualIdentity;
  size?: number;
  /** Announced name — pass the club name. Omit only inside a labelled row. */
  label?: string;
  /** Drops the outer ring and shading for use as a tiny list glyph. */
  flat?: boolean;
  className?: string;
}

/**
 * `style` drives the finishing pass rather than the geometry, so a club's
 * personality shows up as *treatment* — a CLASSIC crest gets a double border
 * and a shadowed motif; MINIMAL gets none of it — without multiplying the
 * number of shapes we have to maintain.
 */
const STYLE_TREATMENT: Record<
  ClubVisualIdentity['style'],
  { outerWidth: number; innerRing: boolean; motifScale: number; shade: number }
> = {
  CLASSIC: { outerWidth: 4, innerRing: true, motifScale: 0.62, shade: 0.34 },
  MODERN: { outerWidth: 2.5, innerRing: false, motifScale: 0.74, shade: 0.2 },
  STREET: { outerWidth: 6, innerRing: false, motifScale: 0.8, shade: 0.42 },
  RETRO: { outerWidth: 3.5, innerRing: true, motifScale: 0.58, shade: 0.28 },
  MINIMAL: { outerWidth: 0, innerRing: false, motifScale: 0.66, shade: 0.1 },
  BOLD: { outerWidth: 7, innerRing: false, motifScale: 0.86, shade: 0.5 },
};

function ClubBadgeInner({ visual, size = 40, label, flat = false, className }: ClubBadgeProps): ReactNode {
  const uid = useId().replace(/:/g, '');
  const gradientId = `bg-${uid}`;
  const clipId = `clip-${uid}`;
  const shadeId = `shade-${uid}`;

  const treatment = STYLE_TREATMENT[visual.style];
  const shape = SHAPE_PATH[visual.badgeShape];

  // The motif must survive whatever colours the content pack chose. Prefer the
  // declared accent, then a lightened/darkened primary, then plain black/white.
  const motifBg = visual.kitPattern === 'HALVES' || visual.kitPattern === 'SASH'
    ? visual.secondary
    : visual.primary;
  const motifColor = pickReadable(
    motifBg,
    [visual.accent, lighten(visual.accent, 0.35), '#f4f6f8', '#08090b'],
    3.2,
  );

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={cn('block shrink-0', className)}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <defs>
        <clipPath id={clipId}>
          <path d={shape} />
        </clipPath>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={lighten(visual.primary, 0.14)} />
          <stop offset="100%" stopColor={visual.secondary} />
        </linearGradient>
        {!flat && (
          <linearGradient id={shadeId} x1="0" y1="0" x2="0.35" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.22" />
            <stop offset="46%" stopColor="#ffffff" stopOpacity="0.03" />
            <stop offset="100%" stopColor="#000000" stopOpacity={treatment.shade} />
          </linearGradient>
        )}
      </defs>

      <g clipPath={`url(#${clipId})`}>
        <Pattern
          kind={visual.kitPattern}
          primary={visual.primary}
          secondary={visual.secondary}
          gradientId={gradientId}
        />

        {treatment.innerRing && (
          <path
            d={shape}
            fill="none"
            stroke={rgba(motifColor, 0.55)}
            strokeWidth="2"
            transform="translate(50 50) scale(0.84) translate(-50 -50)"
          />
        )}

        <g
          transform={`translate(${50 - 32 * treatment.motifScale} ${(treatment.innerRing ? 47 : 50) - 32 * treatment.motifScale}) scale(${treatment.motifScale})`}
        >
          <Motif motif={visual.badgeMotif} fg={motifColor} bg={motifBg} />
        </g>

        {/* Single shading pass over the whole crest ties the motif and the
            pattern into one object instead of a sticker on a background. */}
        {!flat && <rect width="100" height="100" fill={`url(#${shadeId})`} />}
      </g>

      {treatment.outerWidth > 0 && !flat && (
        <path
          d={shape}
          fill="none"
          stroke={darken(visual.primary, 0.55)}
          strokeWidth={treatment.outerWidth}
          strokeLinejoin="round"
        />
      )}
      {/* Hairline that separates the badge from a dark glass surface. */}
      <path d={shape} fill="none" stroke="rgb(255 255 255 / 0.16)" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

/** Memoised — the league table draws 12 of these and the squad list draws one per row. */
export const ClubBadge = memo(ClubBadgeInner);
