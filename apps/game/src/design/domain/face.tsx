import type { ReactNode } from 'react';
import { contrastRatio, darken, lighten, luminance, rgba } from '../color';

/**
 * The shared feature library behind every drawn face in the game.
 *
 * `PlayerPortrait` (seeded, 20k+ newgens) and `ManagerPortrait` (chosen in the
 * customiser) used to each carry their own copy of a head, a hair switch and a
 * beard switch, which is why the manager slowly stopped looking like he came
 * from the same game. Everything geometric lives here now; the two components
 * differ only in *where the values come from* — a seed, or a menu.
 *
 * Everything is pure geometry: no state, no randomness, no assets. Callers pass
 * resolved colours and shape numbers in, so a face stays a pure function of its
 * inputs and a seeded portrait stays byte-identical for a given seed.
 *
 * Node budget: squad lists render 18-40 portraits at once, so each helper is
 * written to add at most a handful of elements. The two gradients are worth
 * their cost — flat fills are what made the old faces read as clip-art — but
 * blurs and filters are not, and none are used.
 */

export const FACE_CX = 60;
export const FACE_TOP = 20;
export const FACE_CHIN = 84;
export const EYE_Y = FACE_TOP + 40;

const CX = FACE_CX;
const TOP = FACE_TOP;
const CHIN = FACE_CHIN;

/* --- head ------------------------------------------------------------- */

export const FACE_SHAPES = ['oval', 'round', 'square', 'long', 'heart', 'diamond', 'angular'] as const;
export type FaceShape = (typeof FACE_SHAPES)[number];

interface ShapeProfile {
  /** Width at the forehead, as a fraction of `halfWidth`. */
  readonly temple: number;
  /** Width at the cheekbone — the widest point of most faces. */
  readonly cheek: number;
  /** Extra jaw width on top of the caller's `jaw` factor. */
  readonly jawScale: number;
  /** How far the chin drops below the nominal chin line. */
  readonly chinDrop: number;
  /** How flat the crown is: 0 domed, 4 flat. */
  readonly crown: number;
  /** Chin corner sharpness: 0.5 pointed, 0.95 square. */
  readonly chinCorner: number;
}

const SHAPE_PROFILE: Record<FaceShape, ShapeProfile> = {
  oval: { temple: 0.94, cheek: 1, jawScale: 0.94, chinDrop: 1, crown: 1, chinCorner: 0.7 },
  round: { temple: 0.98, cheek: 1.04, jawScale: 1, chinDrop: -1, crown: 0, chinCorner: 0.86 },
  square: { temple: 1, cheek: 1, jawScale: 1.06, chinDrop: 0, crown: 3, chinCorner: 0.95 },
  long: { temple: 0.9, cheek: 0.94, jawScale: 0.9, chinDrop: 4, crown: 1, chinCorner: 0.74 },
  heart: { temple: 1.02, cheek: 0.98, jawScale: 0.76, chinDrop: 2, crown: 1, chinCorner: 0.54 },
  diamond: { temple: 0.84, cheek: 1.04, jawScale: 0.82, chinDrop: 2, crown: 2, chinCorner: 0.62 },
  angular: { temple: 0.96, cheek: 0.98, jawScale: 1.02, chinDrop: 1, crown: 3, chinCorner: 0.88 },
};

export interface HeadGeometry {
  readonly halfWidth: number;
  readonly jaw: number;
  readonly shape: FaceShape;
}

/** The widest point of the silhouette — what hair has to clear. */
export const headHalfWidth = ({ halfWidth, shape }: HeadGeometry): number =>
  halfWidth * Math.max(SHAPE_PROFILE[shape].temple, SHAPE_PROFILE[shape].cheek);

/**
 * Where the outline actually is at ear height — the cubic evaluated at t≈0.75
 * of the cheek-to-jaw segment. Ears, earrings and glasses arms hang off this
 * rather than off the widest point, or they float a couple of units clear of
 * the head on every narrow-jawed face.
 */
export function earAnchorX(g: HeadGeometry): number {
  const p = SHAPE_PROFILE[g.shape];
  const tw = g.halfWidth * p.temple;
  const cw = g.halfWidth * p.cheek;
  const jw = g.halfWidth * g.jaw * p.jawScale;
  return 0.016 * tw + 0.562 * cw + 0.422 * jw;
}

/**
 * One path for the whole head: crown, temple, cheekbone, jaw, chin.
 *
 * Drawn as four bezier pairs rather than the old two so the cheekbone can sit
 * wider than the temple. That single extra control point is what separates
 * "seven face shapes" from "one face at seven widths".
 */
export function headPath(g: HeadGeometry): string {
  const p = SHAPE_PROFILE[g.shape];
  const tw = g.halfWidth * p.temple;
  const cw = g.halfWidth * p.cheek;
  const jw = g.halfWidth * g.jaw * p.jawScale;
  const chin = CHIN + p.chinDrop;
  const crownY = TOP + p.crown;
  return [
    `M${CX - tw} ${TOP + 22}`,
    `C${CX - tw} ${TOP + 7} ${CX - tw * 0.6} ${crownY} ${CX} ${crownY}`,
    `C${CX + tw * 0.6} ${crownY} ${CX + tw} ${TOP + 7} ${CX + tw} ${TOP + 22}`,
    `C${CX + cw} ${TOP + 30} ${CX + cw} ${TOP + 38} ${CX + jw} ${chin - 17}`,
    `C${CX + jw} ${chin - 6} ${CX + jw * p.chinCorner} ${chin} ${CX} ${chin}`,
    `C${CX - jw * p.chinCorner} ${chin} ${CX - jw} ${chin - 6} ${CX - jw} ${chin - 17}`,
    `C${CX - cw} ${TOP + 38} ${CX - cw} ${TOP + 30} ${CX - tw} ${TOP + 22}`,
    'Z',
  ].join(' ');
}

/** Where the jawline sits on each side — beards and stubble follow it. */
const jawEdge = (g: HeadGeometry): { jw: number; chin: number } => {
  const p = SHAPE_PROFILE[g.shape];
  return { jw: g.halfWidth * g.jaw * p.jawScale, chin: CHIN + p.chinDrop };
};

/* --- light ------------------------------------------------------------ */

/**
 * Nudge a feature colour until it separates from the skin it sits on.
 *
 * Black hair on the darkest two skin tones, or blond brows on the lightest,
 * produced faces whose eyebrows and beard were invisible at any size — the
 * feature was drawn, it just could not be seen. Moving the colour *away* from
 * the skin's luminance rather than always darkening keeps both ends working.
 */
export function featureInk(skin: string, color: string): string {
  const away = luminance(color) >= luminance(skin) ? lighten : darken;
  let out = color;
  for (let i = 0; i < 4 && contrastRatio(skin, out) < 1.45; i += 1) out = away(out, 0.16);
  return out;
}

/**
 * A drawn line on skin. Always darker, never lighter: a pale mouth line on a
 * dark face reads as a moustache, so the darkest tones get a deeper line at
 * full alpha instead of a lit one.
 */
const lineOn = (skin: string): string =>
  (luminance(skin) < 0.06 ? rgba(darken(skin, 0.58), 1) : rgba(darken(skin, 0.46), 0.88));

/**
 * The two gradients that carry the whole "premium" read: skin lit from the
 * upper left with a warm cheek bounce and a cool jaw falloff, and hair with a
 * single specular sheen. One sheen maximum is the house rule.
 */
export function FaceGradients({
  skinId, hairId, glossId, skin, hair,
}: { skinId: string; hairId: string; glossId: string; skin: string; hair: string }): ReactNode {
  const gloss = lighten(skin, 0.72);
  return (
    <>
      {/* Highlights are painted with this rather than with a flat ellipse: a
          solid 16%-alpha oval on a cheek reads as a smudge on the lens, not as
          light on a face. Falling off to zero is the whole difference. */}
      <radialGradient id={glossId} cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor={gloss} stopOpacity={0.3} />
        <stop offset="55%" stopColor={gloss} stopOpacity={0.13} />
        <stop offset="100%" stopColor={gloss} stopOpacity={0} />
      </radialGradient>
      {/* Off-centre so the light has a direction. This gradient *is* the form
          shadow down the right of the face — an overlay with a hard edge was
          how the old portrait did it, and the seam was visible at 96px. */}
      <radialGradient id={skinId} cx="36%" cy="26%" r="92%">
        {/* Dark tones need a stronger key light to show any form at all;
            light tones blow out if given one. */}
        <stop offset="0%" stopColor={lighten(skin, luminance(skin) < 0.12 ? 0.34 : 0.18)} />
        <stop offset="52%" stopColor={skin} />
        <stop offset="100%" stopColor={darken(skin, 0.2)} />
      </radialGradient>
      <linearGradient id={hairId} x1="16%" y1="0%" x2="84%" y2="100%">
        <stop offset="0%" stopColor={lighten(hair, 0.26)} />
        <stop offset="38%" stopColor={hair} />
        <stop offset="100%" stopColor={darken(hair, 0.34)} />
      </linearGradient>
    </>
  );
}

/**
 * Form shading, clipped to the head: a cheekbone/forehead highlight, a jaw-side
 * shadow and a temple falloff. Alphas stay under 0.2 — anything stronger stops
 * reading as light across a face and starts reading as a hard mask.
 */
export function FaceShading({
  clipId, glossId, skin, g,
}: { clipId: string; glossId: string; skin: string; g: HeadGeometry }): ReactNode {
  const { chin } = jawEdge(g);
  const w = headHalfWidth(g);
  const gloss = `url(#${glossId})`;
  return (
    <g clipPath={`url(#${clipId})`}>
      <ellipse cx={CX - w * 0.28} cy={TOP + 20} rx={w * 0.62} ry={10} fill={gloss} />
      <ellipse cx={CX - w * 0.52} cy={EYE_Y + 6} rx={8.5} ry={6} fill={gloss} />
      <ellipse cx={CX + w * 0.5} cy={EYE_Y + 6} rx={7} ry={5} fill={gloss} opacity={0.6} />
      {/* Under the cheekbones, where a jaw stops catching light. */}
      <path
        d={`M${CX - w} ${chin - 19} C${CX - w * 0.5} ${chin - 8} ${CX + w * 0.5} ${chin - 8} ${CX + w} ${chin - 19} L${CX + w} ${chin + 4} L${CX - w} ${chin + 4} Z`}
        fill={rgba(darken(skin, 0.6), 0.07)}
      />
    </g>
  );
}

/**
 * Neck plus the shadow the jaw casts on it. Drawn before the head, so the
 * shadow has to sit *below* the chin line to survive being overdrawn — half of
 * this ellipse is hidden by the head, which is exactly the half that should be.
 * The neck runs long enough to meet the shoulders at y=92 whatever the chin
 * does, or a strip of backdrop shows through under it.
 */
export function Neck({ skin, g, depth = 26 }: { skin: string; g: HeadGeometry; depth?: number }): ReactNode {
  const { chin } = jawEdge(g);
  return (
    <>
      <path
        d={`M${CX - 8.5} ${chin - 14} h17 L${CX + 11} ${chin - 14 + depth} L${CX - 11} ${chin - 14 + depth} Z`}
        fill={darken(skin, 0.16)}
      />
      <ellipse cx={CX} cy={chin + 2} rx={10.5} ry={5.5} fill={rgba(darken(skin, 0.7), 0.4)} />
    </>
  );
}

export function Ears({ skin, g, size }: { skin: string; g: HeadGeometry; size: number }): ReactNode {
  const x = earAnchorX(g);
  return (
    <>
      {/* Both ears sit a step back from the face plane, or they read as pale
          discs stuck to the side of the head. */}
      <ellipse cx={CX - x} cy={EYE_Y + 3} rx={size} ry={size * 1.3} fill={darken(skin, 0.08)} />
      <ellipse cx={CX + x} cy={EYE_Y + 3} rx={size} ry={size * 1.3} fill={darken(skin, 0.2)} />
    </>
  );
}

/* --- hair ------------------------------------------------------------- */

export const HAIR_STYLES = [
  'bald', 'buzz', 'fade', 'short', 'crop', 'waves', 'fringe', 'curls',
  'coils', 'afro', 'braids', 'dreads', 'long', 'bun', 'ponytail', 'mohawk',
] as const;
export type HairStyle = (typeof HAIR_STYLES)[number];

/** Styles with volume that belongs *behind* the head. */
export const HAIR_BACK_STYLES: ReadonlySet<string> = new Set(['afro', 'long', 'dreads', 'ponytail']);

export const HAIRLINES = ['straight', 'widow', 'receding', 'rounded'] as const;
export type Hairline = (typeof HAIRLINES)[number];

/** The bottom edge of a cap of hair — the single most identity-carrying line. */
function hairlineEdge(w: number, line: Hairline): string {
  switch (line) {
    case 'widow':
      return `L${CX + w - 1} ${TOP + 13} C${CX + w * 0.42} ${TOP + 10} ${CX + 3.5} ${TOP + 11} ${CX} ${TOP + 17} C${CX - 3.5} ${TOP + 11} ${CX - w * 0.42} ${TOP + 10} ${CX - w + 1} ${TOP + 13} Z`;
    case 'receding':
      return `L${CX + w - 1} ${TOP + 10} C${CX + w * 0.5} ${TOP + 1} ${CX - w * 0.5} ${TOP + 1} ${CX - w + 1} ${TOP + 10} Z`;
    case 'rounded':
      return `L${CX + w - 1} ${TOP + 16} C${CX + w * 0.5} ${TOP + 8} ${CX - w * 0.5} ${TOP + 8} ${CX - w + 1} ${TOP + 16} Z`;
    case 'straight':
    default:
      return `L${CX + w - 1} ${TOP + 13} L${CX - w + 1} ${TOP + 13} Z`;
  }
}

/** A cap of hair: crown over the skull, `drop` down the sides, chosen hairline. */
function capPath(w: number, drop: number, line: Hairline, lift = 6): string {
  return [
    `M${CX - w - 1} ${TOP + drop}`,
    `C${CX - w - 1} ${TOP + 2} ${CX - w * 0.55} ${TOP - lift} ${CX} ${TOP - lift}`,
    `C${CX + w * 0.55} ${TOP - lift} ${CX + w + 1} ${TOP + 2} ${CX + w + 1} ${TOP + drop}`,
    hairlineEdge(w, line),
  ].join(' ');
}

export interface HairProps {
  style: HairStyle | string;
  color: string;
  w: number;
  hairline?: Hairline;
  /** `url(#…)` of the hair gradient. Flat colour if omitted. */
  fill?: string;
  /** Draw only the part that sits behind the head. */
  layer?: 'front' | 'back';
}

/**
 * Every hair style, front and back layer. Textured styles (curls, coils,
 * braids, dreads, afro) are built from repeated primitives rather than one
 * silhouette path, which is what makes them read as hair rather than as a
 * helmet at 40px.
 */
export function Hair({ style, color, w, hairline = 'straight', fill, layer = 'front' }: HairProps): ReactNode {
  const paint = fill ?? color;
  const deep = darken(color, 0.34);
  const lit = lighten(color, 0.24);

  if (layer === 'back') {
    switch (style) {
      case 'afro':
        return (
          <>
            <ellipse cx={CX} cy={TOP + 9} rx={w + 10} ry={w + 4} fill={paint} />
            <ellipse cx={CX - 6} cy={TOP + 3} rx={w * 0.42} ry={w * 0.26} fill={rgba(lit, 0.45)} />
          </>
        );
      case 'long':
        return (
          <path
            d={`M${CX - w - 6} ${TOP + 18} C${CX - w - 6} ${TOP - 8} ${CX - w * 0.5} ${TOP - 9} ${CX} ${TOP - 9} C${CX + w * 0.5} ${TOP - 9} ${CX + w + 6} ${TOP - 8} ${CX + w + 6} ${TOP + 18} C${CX + w + 7} ${TOP + 42} ${CX + w + 3} ${CHIN - 2} ${CX + w} ${CHIN + 9} C${CX + w - 5} ${CHIN + 2} ${CX + w - 6} ${TOP + 34} ${CX + w - 4} ${TOP + 22} L${CX - w + 4} ${TOP + 22} C${CX - w + 6} ${TOP + 34} ${CX - w + 5} ${CHIN + 2} ${CX - w} ${CHIN + 9} C${CX - w - 3} ${CHIN - 2} ${CX - w - 7} ${TOP + 42} ${CX - w - 6} ${TOP + 18} Z`}
            fill={paint}
          />
        );
      case 'dreads':
        return (
          <g fill={paint}>
            {[-1, -0.62, 0.62, 1].map((t, i) => (
              <rect
                key={i}
                x={CX + t * (w + 2) - 2.4}
                y={TOP + 8}
                width={4.8}
                height={40 + (i % 2) * 8}
                rx={2.4}
              />
            ))}
          </g>
        );
      case 'ponytail':
        return (
          <path
            d={`M${CX + w - 2} ${TOP + 10} C${CX + w + 12} ${TOP + 16} ${CX + w + 12} ${TOP + 44} ${CX + w + 2} ${CHIN - 4} C${CX + w - 4} ${CHIN - 14} ${CX + w - 6} ${TOP + 22} ${CX + w - 2} ${TOP + 10} Z`}
            fill={paint}
          />
        );
      default:
        return null;
    }
  }

  switch (style) {
    case 'bald':
      return null;
    case 'buzz':
      return (
        <>
          <path d={capPath(w + 0.5, 23, 'rounded', 3)} fill={paint} opacity={0.92} />
          <path
            d={`M${CX - w * 0.5} ${TOP + 1} C${CX - w * 0.2} ${TOP - 2} ${CX + w * 0.2} ${TOP - 2} ${CX + w * 0.55} ${TOP + 2}`}
            stroke={rgba(lit, 0.5)}
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
          />
        </>
      );
    case 'fade':
      return (
        <>
          <path d={capPath(w + 1, 21, hairline, 7)} fill={paint} />
          <rect x={CX - w} y={TOP + 11} width={2 * w} height={3.4} fill={rgba(deep, 0.5)} />
        </>
      );
    case 'crop':
      return (
        <>
          <path d={capPath(w + 1, 25, 'straight', 5)} fill={paint} />
          <path
            d={`M${CX - w + 2} ${TOP + 12} C${CX - w * 0.3} ${TOP + 6} ${CX + w * 0.4} ${TOP + 6} ${CX + w - 2} ${TOP + 13}`}
            stroke={rgba(deep, 0.45)}
            strokeWidth="1.6"
            fill="none"
          />
        </>
      );
    case 'waves':
      return (
        <path
          d={`M${CX - w - 1} ${TOP + 26} C${CX - w - 1} ${TOP + 1} ${CX - w * 0.55} ${TOP - 7} ${CX} ${TOP - 7} C${CX + w * 0.55} ${TOP - 7} ${CX + w + 1} ${TOP + 1} ${CX + w + 1} ${TOP + 26} C${CX + w * 0.7} ${TOP + 13} ${CX + w * 0.34} ${TOP + 21} ${CX} ${TOP + 13} C${CX - w * 0.34} ${TOP + 21} ${CX - w * 0.7} ${TOP + 13} ${CX - w - 1} ${TOP + 26} Z`}
          fill={paint}
        />
      );
    case 'fringe':
      return (
        <>
          <path d={capPath(w + 1, 24, 'straight', 7)} fill={paint} />
          <path
            d={`M${CX - w - 1} ${TOP + 12} C${CX - w * 0.4} ${TOP + 22} ${CX + w * 0.55} ${TOP + 21} ${CX + w + 1} ${TOP + 8} L${CX + w + 1} ${TOP + 2} L${CX - w - 1} ${TOP + 2} Z`}
            fill={paint}
          />
        </>
      );
    case 'curls':
      return (
        <g fill={paint}>
          {[-1, -0.6, -0.2, 0.2, 0.6, 1].map((t, i) => (
            <circle key={i} cx={CX + t * w * 0.94} cy={TOP + 7 + Math.abs(t) * 7} r={7.4} />
          ))}
          <circle cx={CX - w * 0.36} cy={TOP + 1} r={7} />
          <circle cx={CX + w * 0.36} cy={TOP + 1} r={7} />
          <circle cx={CX - w * 0.32} cy={TOP - 1} r={2.8} fill={rgba(lit, 0.45)} />
        </g>
      );
    case 'coils':
      // Tight curls: a low cap with the crown broken up by overlapping domes,
      // so the silhouette is bumpy rather than a smooth helmet.
      return (
        <>
          <path d={capPath(w + 1, 22, hairline, 4)} fill={paint} />
          <g fill={paint}>
            {[-0.86, -0.5, -0.16, 0.16, 0.5, 0.86].map((t, i) => (
              <circle key={i} cx={CX + t * w * 0.92} cy={TOP + 3 + Math.abs(t) * 5} r={4.2} />
            ))}
          </g>
          <circle cx={CX - w * 0.42} cy={TOP - 1} r={2.6} fill={rgba(lit, 0.45)} />
        </>
      );
    case 'afro':
      return null;
    case 'braids':
      return (
        <>
          <path d={capPath(w + 1, 22, hairline, 6)} fill={paint} />
          <g stroke={rgba(deep, 0.65)} strokeWidth="1.7" fill="none" strokeLinecap="round">
            {[-0.78, -0.4, 0, 0.4, 0.78].map((t, i) => (
              <path
                key={i}
                d={`M${CX + t * w * 0.92} ${TOP + 14} C${CX + t * w * 0.8} ${TOP + 4} ${CX + t * w * 0.55} ${TOP - 2} ${CX + t * w * 0.16} ${TOP - 4}`}
              />
            ))}
          </g>
        </>
      );
    case 'dreads':
      return <path d={capPath(w + 1, 20, hairline, 6)} fill={paint} />;
    case 'long':
      return <path d={capPath(w + 1, 22, hairline, 7)} fill={paint} />;
    case 'bun':
      return (
        <>
          <circle cx={CX} cy={TOP - 8} r={7.5} fill={deep} />
          <path d={capPath(w + 1, 20, hairline, 7)} fill={paint} />
        </>
      );
    case 'ponytail':
      return (
        <>
          <path d={capPath(w + 1, 21, hairline, 6)} fill={paint} />
          <circle cx={CX + w - 1} cy={TOP + 11} r={4} fill={deep} />
        </>
      );
    case 'mohawk':
      return (
        <>
          <path d={capPath(w + 1, 22, 'straight', 3)} fill={rgba(deep, 0.8)} />
          <path
            d={`M${CX - 7} ${TOP + 11} C${CX - 6} ${TOP - 11} ${CX + 6} ${TOP - 11} ${CX + 7} ${TOP + 11} C${CX + 3} ${TOP + 3} ${CX - 3} ${TOP + 3} ${CX - 7} ${TOP + 11} Z`}
            fill={paint}
          />
        </>
      );
    case 'short':
    default:
      return <path d={capPath(w + 1, 27, hairline, 5)} fill={paint} />;
  }
}

/* --- facial hair ------------------------------------------------------ */

export const FACIAL_HAIR_STYLES = [
  'none', 'stubble', 'moustache', 'goatee', 'soulpatch', 'beard', 'fullbeard', 'chinstrap', 'sideburns',
] as const;
export type FacialHairStyle = (typeof FACIAL_HAIR_STYLES)[number];

const moustache = (y: number, spread: number, color: string): ReactNode => (
  <path
    d={`M${CX - spread} ${y} C${CX - spread * 0.5} ${y - 3.4} ${CX + spread * 0.5} ${y - 3.4} ${CX + spread} ${y} C${CX + spread * 0.5} ${y + 3} ${CX - spread * 0.5} ${y + 3} ${CX - spread} ${y} Z`}
    fill={color}
  />
);

export function FacialHairLayer({
  kind, color, g,
}: { kind: FacialHairStyle | string; color: string; g: HeadGeometry }): ReactNode {
  const { jw, chin } = jawEdge(g);
  const w = headHalfWidth(g);
  const mouthY = chin - 16;
  /**
   * The jawline as a pair of curves, left corner to right corner. Returned
   * without a leading move so callers can chain it into a closed outline.
   */
  const jawSweep = (inset: number, drop: number): string =>
    `C${CX - jw + inset} ${chin - 8 + drop} ${CX - jw * 0.6} ${chin + drop} ${CX} ${chin + drop} C${CX + jw * 0.6} ${chin + drop} ${CX + jw - inset} ${chin - 8 + drop} ${CX + jw - inset} ${chin - 26}`;
  const jawCorner = (inset: number): string => `${CX - jw + inset} ${chin - 26}`;

  switch (kind) {
    case 'none':
      return null;
    case 'stubble':
      return (
        <path
          d={`M${jawCorner(0)} ${jawSweep(0, 0)} L${CX + jw} ${chin - 28} L${CX - jw} ${chin - 28} Z`}
          fill={rgba(color, 0.26)}
        />
      );
    case 'moustache':
      return moustache(mouthY - 4, 8, color);
    case 'soulpatch':
      return (
        <ellipse cx={CX} cy={chin - 8} rx={2.6} ry={3.4} fill={color} />
      );
    case 'goatee':
      return (
        <>
          {moustache(mouthY - 4, 8, color)}
          <path
            d={`M${CX - 6.5} ${chin - 10} C${CX - 3} ${chin - 12} ${CX + 3} ${chin - 12} ${CX + 6.5} ${chin - 10} C${CX + 5.5} ${chin} ${CX - 5.5} ${chin} ${CX - 6.5} ${chin - 10} Z`}
            fill={color}
          />
        </>
      );
    case 'sideburns':
      return (
        <g fill={color}>
          <path d={`M${CX - w + 1} ${EYE_Y - 6} l5 0 l-1 13 l-4 -2 Z`} />
          <path d={`M${CX + w - 1} ${EYE_Y - 6} l-5 0 l1 13 l4 -2 Z`} />
        </g>
      );
    case 'chinstrap':
      // A stroked jawline rather than two nested outlines: same silhouette,
      // one node instead of six, and the width stays even round the chin.
      return (
        <path
          d={`M${jawCorner(1)} ${jawSweep(1, -1)}`}
          fill="none"
          stroke={color}
          strokeWidth="4.2"
          strokeLinecap="round"
        />
      );
    case 'fullbeard':
      return (
        <>
          <path
            d={`M${CX - jw * 0.92} ${EYE_Y + 9} C${CX - jw - 1} ${chin + 2} ${CX - 10} ${chin + 8} ${CX} ${chin + 8} C${CX + 10} ${chin + 8} ${CX + jw + 1} ${chin + 2} ${CX + jw * 0.92} ${EYE_Y + 9} C${CX + 11} ${mouthY - 7} ${CX - 11} ${mouthY - 7} ${CX - jw * 0.92} ${EYE_Y + 9} Z`}
            fill={color}
          />
          <path
            d={`M${CX - 6} ${mouthY} C${CX - 2} ${mouthY + 2.6} ${CX + 2} ${mouthY + 2.6} ${CX + 6} ${mouthY}`}
            stroke={luminance(color) < 0.05 ? rgba(lighten(color, 0.28), 0.9) : rgba(darken(color, 0.55), 0.95)}
            strokeWidth="1.6"
            strokeLinecap="round"
            fill="none"
          />
        </>
      );
    case 'beard':
    default:
      return (
        <>
          <path
            d={`M${CX - jw} ${chin - 26} ${jawSweep(0, 3)} L${CX + jw} ${chin - 27} L${CX + jw - 3} ${chin - 20} C${CX + 8} ${chin - 16} ${CX - 8} ${chin - 16} ${CX - jw + 3} ${chin - 20} L${CX - jw} ${chin - 27} Z`}
            fill={color}
          />
          {moustache(mouthY - 3, 8, color)}
        </>
      );
  }
}

/* --- features --------------------------------------------------------- */

export const BROW_STYLES = ['flat', 'arched', 'angled', 'thick', 'soft'] as const;
export type BrowStyle = (typeof BROW_STYLES)[number];

export const EXPRESSIONS = ['neutral', 'focused', 'smile'] as const;
export type Expression = (typeof EXPRESSIONS)[number];

/** How far each expression tilts the inner brow end, in units. */
const BROW_TILT: Record<Expression, number> = { neutral: 0, focused: 2.2, smile: -1 };

export function Brows({
  style, color, thickness, expression, spacing = 11,
}: {
  style: BrowStyle | string;
  color: string;
  thickness: number;
  expression: Expression;
  spacing?: number;
}): ReactNode {
  const t = Math.max(1.8, thickness);
  const tilt = BROW_TILT[expression] ?? 0;
  const y = EYE_Y - 9;
  const half = 6.4;

  const brow = (side: -1 | 1): string => {
    const inner = CX + side * (spacing - half);
    const outer = CX + side * (spacing + half);
    const mid = CX + side * spacing;
    switch (style) {
      case 'arched':
        return `M${inner} ${y + tilt} Q${mid} ${y - 3.4} ${outer} ${y + 0.8}`;
      case 'angled':
        return `M${inner} ${y + 1.6 + tilt} L${mid} ${y - 1.8} L${outer} ${y + 0.4}`;
      case 'soft':
        return `M${inner} ${y + 0.6 + tilt} Q${mid} ${y - 1.4} ${outer} ${y + 1.6}`;
      case 'thick':
      case 'flat':
      default:
        return `M${inner} ${y + tilt} L${outer} ${y + 0.4}`;
    }
  };

  return (
    <g
      stroke={color}
      strokeWidth={style === 'thick' ? t + 0.8 : t}
      strokeLinecap="round"
      fill="none"
    >
      <path d={brow(-1)} />
      <path d={brow(1)} />
    </g>
  );
}

export const EYE_STYLES = ['round', 'narrow', 'wide', 'hooded', 'almond'] as const;
export type EyeStyle = (typeof EYE_STYLES)[number];

/**
 * Tuned so the iris fills most of the opening. An eye drawn as a wide white
 * oval with a small pupil floating in it is the single fastest way to make a
 * face look like a cartoon; real eyes show very little sclera at this scale.
 */
const EYE_SIZE: Record<EyeStyle, { rx: number; ry: number; iris: number }> = {
  round: { rx: 3.6, ry: 2.9, iris: 2.4 },
  narrow: { rx: 3.9, ry: 2.2, iris: 2 },
  wide: { rx: 4.1, ry: 3.1, iris: 2.5 },
  hooded: { rx: 3.8, ry: 2.6, iris: 2.2 },
  almond: { rx: 3.9, ry: 2.5, iris: 2.2 },
};

/**
 * Eyes are a light sclera plus a dark iris plus one catchlight. The obvious
 * simplification — a bare dark slit — reads as a *closed* eye at the 28px used
 * in squad lists, which makes an entire team look asleep.
 */
export function Eyes({
  style, expression, skin, spacing = 11,
}: { style: EyeStyle | string; expression: Expression; skin: string; spacing?: number }): ReactNode {
  const size = EYE_SIZE[(style as EyeStyle)] ?? EYE_SIZE.round;
  const squint = expression === 'focused' ? 0.7 : expression === 'smile' ? 0.4 : 0;
  const ry = Math.max(1.5, size.ry - squint);
  return (
    <>
      {([-1, 1] as const).map((side) => {
        const ex = CX + side * spacing;
        return (
          <g key={side}>
            <ellipse cx={ex} cy={EYE_Y} rx={size.rx} ry={ry} fill="#e4ddd2" />
            <circle cx={ex + side * 0.4} cy={EYE_Y} r={Math.min(size.iris, ry + 0.5)} fill="#2b211c" />
            <circle cx={ex + side * 0.4 - 0.8} cy={EYE_Y - 0.8} r={0.6} fill={rgba('#ffffff', 0.8)} />
            {(style === 'hooded' || squint > 0.5) && (
              <path
                d={`M${ex - size.rx} ${EYE_Y - ry * 0.6} Q${ex} ${EYE_Y - ry * 1.9} ${ex + size.rx} ${EYE_Y - ry * 0.6} L${ex + size.rx} ${EYE_Y - ry - 2} L${ex - size.rx} ${EYE_Y - ry - 2} Z`}
                fill={darken(skin, 0.1)}
              />
            )}
          </g>
        );
      })}
    </>
  );
}

export function Nose({ skin, width = 2.5, g }: { skin: string; width?: number; g: HeadGeometry }): ReactNode {
  const { chin } = jawEdge(g);
  const base = EYE_Y + (chin - CHIN) * 0.4;
  return (
    <path
      d={`M${CX - width} ${base + 8} C${CX - width} ${base + 12.5} ${CX + width} ${base + 12.5} ${CX + width} ${base + 8}`}
      fill="none"
      stroke={lineOn(skin)}
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  );
}

/** The mouth reads the expression; `curve` carries the seeded variation on top. */
export function Mouth({
  skin, expression, curve, g,
}: { skin: string; expression: Expression; curve: number; g: HeadGeometry }): ReactNode {
  const { chin } = jawEdge(g);
  const y = chin - 16;
  const bias = expression === 'smile' ? 2.4 : expression === 'focused' ? -0.9 : 0;
  const c = curve + bias;
  const half = expression === 'smile' ? 7.6 : 6.8;
  return (
    <>
      <path
        d={`M${CX - half} ${y} Q${CX} ${y + c} ${CX + half} ${y}`}
        fill="none"
        stroke={lineOn(skin)}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      {expression === 'smile' && (
        <path
          d={`M${CX - half + 1} ${y + 1.6} Q${CX} ${y + c + 2.4} ${CX + half - 1} ${y + 1.6}`}
          fill="none"
          stroke={rgba(lighten(skin, 0.35), 0.55)}
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      )}
    </>
  );
}

/* --- accessories ------------------------------------------------------ */

export const FACE_ACCESSORIES = [
  'none', 'earring', 'headband', 'glasses', 'cap', 'chain', 'tinted', 'studs',
] as const;
export type FaceAccessory = (typeof FACE_ACCESSORIES)[number];

/**
 * Worn props. Deliberately sparse and mostly monochrome: an accessory is meant
 * to make one face in twenty memorable, not to turn the squad list into a
 * costume shop. `accent` is only ever used on a headband stripe, a cap panel or
 * a lens rim, never as a fill.
 */
export function Accessory({
  kind, accent, g, hair,
}: { kind: FaceAccessory | string; accent: string; g: HeadGeometry; hair: string }): ReactNode {
  const w = headHalfWidth(g);
  const ear = earAnchorX(g);
  const metal = '#d8dde3';
  switch (kind) {
    case 'earring':
      return <circle cx={CX + ear + 0.5} cy={EYE_Y + 9} r={1.9} fill={metal} stroke={rgba('#000000', 0.35)} strokeWidth="0.5" />;
    case 'studs':
      return (
        <g fill={metal}>
          <circle cx={CX + ear + 0.5} cy={EYE_Y + 8} r={1.5} />
          <circle cx={CX - ear - 0.5} cy={EYE_Y + 8} r={1.5} />
        </g>
      );
    case 'headband':
      return (
        <>
          <path
            d={`M${CX - w - 2} ${TOP + 15} C${CX - w - 2} ${TOP + 5} ${CX + w + 2} ${TOP + 5} ${CX + w + 2} ${TOP + 15} L${CX + w + 2} ${TOP + 19} C${CX + w + 2} ${TOP + 9} ${CX - w - 2} ${TOP + 9} ${CX - w - 2} ${TOP + 19} Z`}
            fill="#e8ecf0"
          />
          <path
            d={`M${CX - w - 2} ${TOP + 17.5} C${CX - w - 2} ${TOP + 8} ${CX + w + 2} ${TOP + 8} ${CX + w + 2} ${TOP + 17.5}`}
            stroke={accent}
            strokeWidth="1.5"
            fill="none"
          />
        </>
      );
    case 'glasses':
      return (
        <g fill="none" stroke={rgba('#e8ecf0', 0.85)} strokeWidth="1.3">
          <rect x={CX - 18} y={EYE_Y - 5} width={14} height={10} rx={4} />
          <rect x={CX + 4} y={EYE_Y - 5} width={14} height={10} rx={4} />
          <path d={`M${CX - 4} ${EYE_Y - 1} h8`} />
          <path d={`M${CX - 18} ${EYE_Y - 2} L${CX - ear} ${EYE_Y - 1}`} />
          <path d={`M${CX + 18} ${EYE_Y - 2} L${CX + ear} ${EYE_Y - 1}`} />
        </g>
      );
    case 'tinted':
      return (
        <g>
          <rect x={CX - 18} y={EYE_Y - 5.5} width={14} height={11} rx={3} fill={rgba('#0a0c0f', 0.74)} stroke={accent} strokeWidth="1.2" />
          <rect x={CX + 4} y={EYE_Y - 5.5} width={14} height={11} rx={3} fill={rgba('#0a0c0f', 0.74)} stroke={accent} strokeWidth="1.2" />
          <path d={`M${CX - 4} ${EYE_Y - 1} h8`} stroke={accent} strokeWidth="1.2" />
        </g>
      );
    case 'cap':
      return (
        <>
          <path
            d={`M${CX - w - 2} ${TOP + 15} C${CX - w - 2} ${TOP - 3} ${CX - w * 0.5} ${TOP - 9} ${CX} ${TOP - 9} C${CX + w * 0.5} ${TOP - 9} ${CX + w + 2} ${TOP - 3} ${CX + w + 2} ${TOP + 15} Z`}
            fill={darken(hair, 0.5)}
          />
          {/* One panel catches the light; a flat cap reads as a bowl. */}
          <path
            d={`M${CX - 1} ${TOP - 9} C${CX + w * 0.5} ${TOP - 9} ${CX + w + 2} ${TOP - 3} ${CX + w + 2} ${TOP + 15} L${CX - 1} ${TOP + 15} Z`}
            fill={rgba('#ffffff', 0.06)}
          />
          <path
            d={`M${CX - w - 11} ${TOP + 17} C${CX - w * 0.6} ${TOP + 8} ${CX + w * 0.6} ${TOP + 8} ${CX + w + 11} ${TOP + 17} C${CX + w * 0.5} ${TOP + 20} ${CX - w * 0.5} ${TOP + 20} ${CX - w - 11} ${TOP + 17} Z`}
            fill={darken(hair, 0.66)}
          />
          <circle cx={CX} cy={TOP + 3} r={2.2} fill={rgba(accent, 0.9)} />
        </>
      );
    case 'chain':
      return (
        <path
          d={`M${CX - 13} ${CHIN + 6} C${CX - 8} ${CHIN + 20} ${CX + 8} ${CHIN + 20} ${CX + 13} ${CHIN + 6}`}
          fill="none"
          stroke={metal}
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="1.6 1.8"
        />
      );
    default:
      return null;
  }
}
