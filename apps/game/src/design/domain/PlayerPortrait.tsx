import { memo, useId, useMemo, type ReactNode } from 'react';
import { cn } from '../cn';
import { SeedStream } from '../seed';
import { darken, lighten, rgba } from '../color';

/**
 * Procedurally generated portraits.
 *
 * No image assets ship with this game. Every player, creator and fan face is
 * drawn from a seed string at render time — which means a 20,000-player world
 * costs zero bytes of download, portraits are stable across saves and devices,
 * and nothing ever 404s.
 *
 * The style is deliberately flat and graphic rather than photoreal: a stylised
 * vector face reads instantly at 28px in a squad list, which a rendered head
 * never does, and it sidesteps the uncanny mismatch between a photoreal face
 * and a procedurally invented name.
 *
 * Determinism: every feature reads a *named* channel from the seed stream, so
 * adding a new feature later does not reshuffle every existing face.
 */

const SKIN_TONES = [
  '#f2d3bb', '#e9c19f', '#d9a77c', '#c68a5e', '#a9683f',
  '#8a4f2d', '#6b3a20', '#f7e0cd', '#b9835b', '#5a2f1a',
] as const;

const HAIR_COLORS = [
  '#1b1613', '#2e2119', '#4a3121', '#6b4526', '#8d6034',
  '#b4884a', '#d8b36a', '#7d7d7d', '#c9c9c9', '#3a2d5a',
] as const;

const HAIR_STYLES = [
  'bald', 'buzz', 'short', 'fade', 'curls', 'afro', 'long', 'bun', 'mohawk', 'waves',
] as const;
type HairStyle = (typeof HAIR_STYLES)[number];

const FACIAL_HAIR = ['none', 'none', 'none', 'stubble', 'moustache', 'goatee', 'beard', 'chinstrap'] as const;
type FacialHair = (typeof FACIAL_HAIR)[number];

export interface PortraitFeatures {
  readonly skin: string;
  readonly hair: string;
  readonly hairStyle: HairStyle;
  readonly facialHair: FacialHair;
  readonly halfWidth: number;
  readonly jaw: number;
  readonly browThickness: number;
  readonly eyeStyle: 0 | 1 | 2;
  readonly earSize: number;
  readonly mouthCurve: number;
}

export function portraitFeatures(seed: string): PortraitFeatures {
  const s = new SeedStream(seed || 'anonymous');
  const hairStyle = s.pick('hairStyle', HAIR_STYLES);
  return {
    skin: s.pick('skin', SKIN_TONES),
    hair: s.pick('hairColor', HAIR_COLORS),
    hairStyle,
    // A bald head with a full beard is a real look; a buzz cut with a chinstrap
    // is not worth the combinatorics, so facial hair is drawn independently.
    facialHair: s.pick('facialHair', FACIAL_HAIR),
    halfWidth: s.range('width', 22, 26),
    jaw: s.range('jaw', 0.62, 0.94),
    browThickness: s.range('brow', 2.2, 4),
    eyeStyle: s.int('eye', 3) as 0 | 1 | 2,
    earSize: s.range('ear', 3.4, 5),
    mouthCurve: s.range('mouth', -1.6, 2.4),
  };
}

const CX = 60;
const TOP = 20;
const CHIN = 84;

function headPath(halfWidth: number, jaw: number): string {
  const w = halfWidth;
  const j = w * jaw;
  return [
    `M${CX - w} ${TOP + 26}`,
    `C${CX - w} ${TOP + 8} ${CX - w * 0.62} ${TOP} ${CX} ${TOP}`,
    `C${CX + w * 0.62} ${TOP} ${CX + w} ${TOP + 8} ${CX + w} ${TOP + 26}`,
    `L${CX + w} ${CHIN - 24}`,
    `C${CX + w} ${CHIN - 8} ${CX + j * 0.78} ${CHIN} ${CX} ${CHIN}`,
    `C${CX - j * 0.78} ${CHIN} ${CX - w} ${CHIN - 8} ${CX - w} ${CHIN - 24}`,
    'Z',
  ].join(' ');
}

function Hair({ style, color, w }: { style: HairStyle; color: string; w: number }): ReactNode {
  const edge = darken(color, 0.25);
  switch (style) {
    case 'bald':
      return null;
    case 'buzz':
      return (
        <path
          d={`M${CX - w - 0.5} ${TOP + 24} C${CX - w - 0.5} ${TOP + 4} ${CX - w * 0.6} ${TOP - 2} ${CX} ${TOP - 2} C${CX + w * 0.6} ${TOP - 2} ${CX + w + 0.5} ${TOP + 4} ${CX + w + 0.5} ${TOP + 24} C${CX + w * 0.5} ${TOP + 16} ${CX - w * 0.5} ${TOP + 16} ${CX - w - 0.5} ${TOP + 24} Z`}
          fill={color}
        />
      );
    case 'short':
      return (
        <path
          d={`M${CX - w - 1} ${TOP + 28} C${CX - w - 1} ${TOP + 2} ${CX - w * 0.55} ${TOP - 5} ${CX} ${TOP - 5} C${CX + w * 0.55} ${TOP - 5} ${CX + w + 1} ${TOP + 2} ${CX + w + 1} ${TOP + 28} L${CX + w - 1} ${TOP + 20} C${CX + w * 0.3} ${TOP + 12} ${CX - w * 0.55} ${TOP + 11} ${CX - w + 1} ${TOP + 21} Z`}
          fill={color}
        />
      );
    case 'fade':
      return (
        <>
          <path
            d={`M${CX - w - 1} ${TOP + 22} C${CX - w - 1} ${TOP - 1} ${CX - w * 0.55} ${TOP - 7} ${CX} ${TOP - 7} C${CX + w * 0.55} ${TOP - 7} ${CX + w + 1} ${TOP - 1} ${CX + w + 1} ${TOP + 22} L${CX + w - 1} ${TOP + 12} L${CX - w + 1} ${TOP + 12} Z`}
            fill={color}
          />
          <rect x={CX - w + 1} y={TOP + 11} width={2 * w - 2} height={3} fill={rgba(edge, 0.55)} />
        </>
      );
    case 'curls':
      return (
        <g fill={color}>
          {[-1, -0.55, 0, 0.55, 1].map((t, i) => (
            <circle key={i} cx={CX + t * w * 0.92} cy={TOP + 6 + Math.abs(t) * 9} r={9.5} />
          ))}
          <circle cx={CX - w * 0.32} cy={TOP + 1} r={9} />
          <circle cx={CX + w * 0.32} cy={TOP + 1} r={9} />
        </g>
      );
    case 'afro':
      return (
        <>
          <ellipse cx={CX} cy={TOP + 8} rx={w + 10} ry={w + 3} fill={color} />
          <ellipse cx={CX - 5} cy={TOP + 4} rx={w * 0.5} ry={w * 0.34} fill={rgba(lighten(color, 0.3), 0.5)} />
        </>
      );
    case 'long':
      return (
        <>
          {/* Back layer sits behind the head; drawn first by the caller's order. */}
          <path
            d={`M${CX - w - 5} ${TOP + 18} C${CX - w - 5} ${TOP - 6} ${CX - w * 0.5} ${TOP - 8} ${CX} ${TOP - 8} C${CX + w * 0.5} ${TOP - 8} ${CX + w + 5} ${TOP - 6} ${CX + w + 5} ${TOP + 18} L${CX + w + 5} ${CHIN + 6} L${CX + w - 2} ${CHIN + 4} L${CX + w - 2} ${TOP + 22} L${CX - w + 2} ${TOP + 22} L${CX - w + 2} ${CHIN + 4} L${CX - w - 5} ${CHIN + 6} Z`}
            fill={color}
          />
          <path
            d={`M${CX - w - 1} ${TOP + 22} C${CX - w - 1} ${TOP + 1} ${CX - w * 0.5} ${TOP - 6} ${CX} ${TOP - 6} C${CX + w * 0.5} ${TOP - 6} ${CX + w + 1} ${TOP + 1} ${CX + w + 1} ${TOP + 22} L${CX + w * 0.2} ${TOP + 13} L${CX - w + 1} ${TOP + 20} Z`}
            fill={color}
          />
        </>
      );
    case 'bun':
      return (
        <>
          <circle cx={CX} cy={TOP - 7} r={7.5} fill={darken(color, 0.12)} />
          <path
            d={`M${CX - w - 1} ${TOP + 20} C${CX - w - 1} ${TOP} ${CX - w * 0.55} ${TOP - 6} ${CX} ${TOP - 6} C${CX + w * 0.55} ${TOP - 6} ${CX + w + 1} ${TOP} ${CX + w + 1} ${TOP + 20} L${CX + w - 1} ${TOP + 13} L${CX - w + 1} ${TOP + 13} Z`}
            fill={color}
          />
        </>
      );
    case 'mohawk':
      return (
        <>
          <path
            d={`M${CX - w - 1} ${TOP + 22} C${CX - w - 1} ${TOP + 6} ${CX - w * 0.6} ${TOP + 1} ${CX} ${TOP + 1} C${CX + w * 0.6} ${TOP + 1} ${CX + w + 1} ${TOP + 6} ${CX + w + 1} ${TOP + 22} L${CX + w - 1} ${TOP + 16} L${CX - w + 1} ${TOP + 16} Z`}
            fill={rgba(darken(color, 0.4), 0.8)}
          />
          <path
            d={`M${CX - 7} ${TOP + 12} C${CX - 6} ${TOP - 10} ${CX + 6} ${TOP - 10} ${CX + 7} ${TOP + 12} Z`}
            fill={color}
          />
        </>
      );
    case 'waves':
    default:
      return (
        <path
          d={`M${CX - w - 1} ${TOP + 26} C${CX - w - 1} ${TOP + 1} ${CX - w * 0.55} ${TOP - 6} ${CX} ${TOP - 6} C${CX + w * 0.55} ${TOP - 6} ${CX + w + 1} ${TOP + 1} ${CX + w + 1} ${TOP + 26} C${CX + w * 0.7} ${TOP + 14} ${CX + w * 0.35} ${TOP + 22} ${CX} ${TOP + 14} C${CX - w * 0.35} ${TOP + 22} ${CX - w * 0.7} ${TOP + 14} ${CX - w - 1} ${TOP + 26} Z`}
          fill={color}
        />
      );
  }
}

function FacialHairLayer({
  kind, color, w, jaw,
}: { kind: FacialHair; color: string; w: number; jaw: number }): ReactNode {
  const j = w * jaw;
  switch (kind) {
    case 'none':
      return null;
    case 'stubble':
      return (
        <path
          d={`M${CX - w} ${CHIN - 26} L${CX + w} ${CHIN - 26} L${CX + w} ${CHIN - 24} C${CX + w} ${CHIN - 8} ${CX + j * 0.78} ${CHIN} ${CX} ${CHIN} C${CX - j * 0.78} ${CHIN} ${CX - w} ${CHIN - 8} ${CX - w} ${CHIN - 24} Z`}
          fill={rgba(color, 0.3)}
        />
      );
    case 'moustache':
      return (
        <path
          d={`M${CX - 8} ${CHIN - 17} C${CX - 4} ${CHIN - 20} ${CX + 4} ${CHIN - 20} ${CX + 8} ${CHIN - 17} C${CX + 4} ${CHIN - 14} ${CX - 4} ${CHIN - 14} ${CX - 8} ${CHIN - 17} Z`}
          fill={color}
        />
      );
    case 'goatee':
      return (
        <>
          <path
            d={`M${CX - 8} ${CHIN - 17} C${CX - 4} ${CHIN - 20} ${CX + 4} ${CHIN - 20} ${CX + 8} ${CHIN - 17} C${CX + 4} ${CHIN - 14} ${CX - 4} ${CHIN - 14} ${CX - 8} ${CHIN - 17} Z`}
            fill={color}
          />
          <path
            d={`M${CX - 6} ${CHIN - 9} C${CX - 3} ${CHIN - 11} ${CX + 3} ${CHIN - 11} ${CX + 6} ${CHIN - 9} C${CX + 5} ${CHIN - 1} ${CX - 5} ${CHIN - 1} ${CX - 6} ${CHIN - 9} Z`}
            fill={color}
          />
        </>
      );
    case 'chinstrap':
      return (
        <path
          d={`M${CX - w} ${CHIN - 26} L${CX - w} ${CHIN - 24} C${CX - w} ${CHIN - 8} ${CX - j * 0.78} ${CHIN} ${CX} ${CHIN} C${CX + j * 0.78} ${CHIN} ${CX + w} ${CHIN - 8} ${CX + w} ${CHIN - 24} L${CX + w} ${CHIN - 26} L${CX + w - 4} ${CHIN - 26} L${CX + w - 4} ${CHIN - 24} C${CX + w - 4} ${CHIN - 10} ${CX + j * 0.6} ${CHIN - 4} ${CX} ${CHIN - 4} C${CX - j * 0.6} ${CHIN - 4} ${CX - w + 4} ${CHIN - 10} ${CX - w + 4} ${CHIN - 24} L${CX - w + 4} ${CHIN - 26} Z`}
          fill={color}
        />
      );
    case 'beard':
    default:
      return (
        <>
          <path
            d={`M${CX - w} ${CHIN - 30} L${CX - w} ${CHIN - 24} C${CX - w} ${CHIN - 6} ${CX - j * 0.78} ${CHIN + 3} ${CX} ${CHIN + 3} C${CX + j * 0.78} ${CHIN + 3} ${CX + w} ${CHIN - 6} ${CX + w} ${CHIN - 24} L${CX + w} ${CHIN - 30} L${CX + w - 3} ${CHIN - 22} C${CX + 8} ${CHIN - 18} ${CX - 8} ${CHIN - 18} ${CX - w + 3} ${CHIN - 22} Z`}
            fill={color}
          />
          <path
            d={`M${CX - 8} ${CHIN - 17} C${CX - 4} ${CHIN - 20} ${CX + 4} ${CHIN - 20} ${CX + 8} ${CHIN - 17} C${CX + 4} ${CHIN - 14} ${CX - 4} ${CHIN - 14} ${CX - 8} ${CHIN - 17} Z`}
            fill={color}
          />
        </>
      );
  }
}

export type PortraitShape = 'circle' | 'squircle' | 'square' | 'bare';

export interface PlayerPortraitProps {
  /** Any stable string. `Player.portraitSeed` / `Creator.avatarSeed`. */
  seed: string;
  size?: number;
  /** Club colours for the backdrop and kit. Falls back to graphite. */
  colors?: { primary: string; secondary?: string };
  shape?: PortraitShape;
  /** Draws the shoulders/kit. Off for a head-only avatar in dense lists. */
  kit?: boolean;
  /** Thin ring in the club's accent — used on the matchday card. */
  ring?: string;
  className?: string;
  /** Announced name. Omit inside a card that already names the player. */
  label?: string;
}

const SHAPE_CLASS: Record<PortraitShape, string> = {
  circle: 'rounded-pill',
  squircle: 'rounded-[28%]',
  square: 'rounded-sm',
  bare: '',
};

function PortraitInner({
  seed,
  size = 48,
  colors,
  shape = 'circle',
  kit = true,
  ring,
  className,
  label,
}: PlayerPortraitProps): ReactNode {
  const uid = useId().replace(/:/g, '');
  const f = useMemo(() => portraitFeatures(seed), [seed]);

  const primary = colors?.primary ?? '#1c2026';
  const secondary = colors?.secondary ?? '#262b33';
  const head = headPath(f.halfWidth, f.jaw);
  const w = f.halfWidth;
  const eyeY = TOP + 40;
  const shade = darken(f.skin, 0.16);

  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={cn('block shrink-0 overflow-hidden', SHAPE_CLASS[shape], className)}
      style={ring ? { boxShadow: `0 0 0 2px ${ring}` } : undefined}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <defs>
        <radialGradient id={`bg-${uid}`} cx="50%" cy="34%" r="78%">
          <stop offset="0%" stopColor={lighten(primary, 0.18)} />
          <stop offset="62%" stopColor={primary} />
          <stop offset="100%" stopColor={darken(primary, 0.55)} />
        </radialGradient>
        <clipPath id={`head-${uid}`}>
          <path d={head} />
        </clipPath>
      </defs>

      <rect width="120" height="120" fill={`url(#bg-${uid})`} />
      {/* A single wide arc gives the flat backdrop depth without a second
          gradient pass — cheaper than a blur and reads as stadium light. */}
      <path d="M-10 96 C24 74 96 74 130 96 L130 130 L-10 130 Z" fill={rgba(darken(primary, 0.7), 0.55)} />

      {/* Long hair renders behind the head. */}
      {f.hairStyle === 'long' && <Hair style="long" color={f.hair} w={w} />}
      {f.hairStyle === 'afro' && <Hair style="afro" color={f.hair} w={w} />}

      {kit && (
        <>
          <path
            d={`M14 120 C14 100 32 92 60 92 C88 92 106 100 106 120 Z`}
            fill={secondary}
          />
          <path d={`M49 92 L60 104 L71 92 L66 91 L60 97 L54 91 Z`} fill={darken(secondary, 0.35)} />
        </>
      )}

      {/* Neck */}
      <path d={`M${CX - 8} ${CHIN - 14} h16 v18 h-16 Z`} fill={shade} />

      {/* Ears */}
      <ellipse cx={CX - w} cy={eyeY + 2} rx={f.earSize} ry={f.earSize * 1.35} fill={f.skin} />
      <ellipse cx={CX + w} cy={eyeY + 2} rx={f.earSize} ry={f.earSize * 1.35} fill={f.skin} />

      <path d={head} fill={f.skin} />
      {/* Form shading, clipped to the head so it never leaks onto the kit. */}
      <g clipPath={`url(#head-${uid})`}>
        <path d={`M${CX + 4} 0 L120 0 L120 120 L${CX + 14} 120 Z`} fill={rgba(shade, 0.35)} />
      </g>

      {/* Brows */}
      <g fill={darken(f.hair, 0.1)}>
        <rect x={CX - 17} y={eyeY - 9} width={12} height={f.browThickness} rx={f.browThickness / 2} />
        <rect x={CX + 5} y={eyeY - 9} width={12} height={f.browThickness} rx={f.browThickness / 2} />
      </g>

      {/* Eyes */}
      <g fill="#241d1a">
        {f.eyeStyle === 0 && (
          <>
            <ellipse cx={CX - 11} cy={eyeY} rx={2.6} ry={3.1} />
            <ellipse cx={CX + 11} cy={eyeY} rx={2.6} ry={3.1} />
          </>
        )}
        {f.eyeStyle === 1 && (
          <>
            <rect x={CX - 15} y={eyeY - 1.4} width={8} height={2.8} rx={1.4} />
            <rect x={CX + 7} y={eyeY - 1.4} width={8} height={2.8} rx={1.4} />
          </>
        )}
        {f.eyeStyle === 2 && (
          <>
            <ellipse cx={CX - 11} cy={eyeY} rx={3.4} ry={2.4} />
            <ellipse cx={CX + 11} cy={eyeY} rx={3.4} ry={2.4} />
          </>
        )}
      </g>

      {/* Nose and mouth */}
      <path
        d={`M${CX - 2.5} ${eyeY + 9} C${CX - 2.5} ${eyeY + 13} ${CX + 2.5} ${eyeY + 13} ${CX + 2.5} ${eyeY + 9}`}
        fill="none"
        stroke={rgba(shade, 0.9)}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d={`M${CX - 7} ${CHIN - 16} Q${CX} ${CHIN - 16 + f.mouthCurve} ${CX + 7} ${CHIN - 16}`}
        fill="none"
        stroke={rgba(darken(f.skin, 0.45), 0.85)}
        strokeWidth="1.8"
        strokeLinecap="round"
      />

      <FacialHairLayer kind={f.facialHair} color={darken(f.hair, 0.08)} w={w} jaw={f.jaw} />

      {f.hairStyle !== 'long' && f.hairStyle !== 'afro' && (
        <Hair style={f.hairStyle} color={f.hair} w={w} />
      )}
    </svg>
  );
}

/**
 * Memoised: squad lists render 18-40 of these at once and the feature
 * derivation plus ~25 SVG nodes per face is the most expensive thing on those
 * screens. Props are all primitives except `colors`, so callers should hoist
 * that object rather than building it inline in a map.
 */
export const PlayerPortrait = memo(PortraitInner);

export interface CreatorAvatarProps extends Omit<PlayerPortraitProps, 'kit'> {
  /** Draws the verified check overlay used across the social feed. */
  verified?: boolean;
  /** Tier ring colour. */
  tier?: 'LOCAL' | 'RISING' | 'ESTABLISHED' | 'MAJOR' | 'GLOBAL';
}

const TIER_RING: Record<NonNullable<CreatorAvatarProps['tier']>, string | undefined> = {
  LOCAL: undefined,
  RISING: 'rgb(255 255 255 / 0.18)',
  ESTABLISHED: '#7c8cff',
  MAJOR: '#a78bfa',
  GLOBAL: '#c8ff2e',
};

/**
 * Creators use the same face generator with the kit suppressed — a creator is
 * a person, not a squad member, and drawing them in a shirt would imply a
 * playing role many of them do not have.
 */
export function CreatorAvatar({
  verified = false,
  tier,
  size = 44,
  ring,
  ...rest
}: CreatorAvatarProps): ReactNode {
  const ringColor = ring ?? (tier ? TIER_RING[tier] : undefined);
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <PlayerPortrait
        {...rest}
        size={size}
        kit={false}
        {...(ringColor ? { ring: ringColor } : {})}
      />
      {verified && (
        <span
          className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-pill bg-base"
          style={{ width: size * 0.4, height: size * 0.4 }}
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" className="size-full p-px text-info" fill="currentColor">
            <path d="m12 1.6 2.5 2 3.2-.2 1 3 2.7 1.8-1.1 3 1.1 3.1-2.7 1.7-1 3-3.2-.2-2.5 2.1-2.5-2.1-3.2.2-1-3L2.6 15.3l1.1-3.1-1.1-3 2.7-1.8 1-3 3.2.2Z" />
            <path d="m8.8 12.1 2.1 2.1 4.3-4.7" fill="none" stroke="#08090b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      )}
    </span>
  );
}
