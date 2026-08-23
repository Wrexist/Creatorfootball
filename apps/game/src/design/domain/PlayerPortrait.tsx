import { memo, useMemo, type ReactNode } from 'react';
import { cn } from '../cn';
import { SeedStream } from '../seed';
import { darken, lighten, rgba } from '../color';
import { useSvgId } from '../useSvgId';
import {
  Accessory, Brows, Ears, EYE_STYLES, Eyes, FACE_SHAPES, FaceGradients,
  FaceShading, FacialHairLayer, Hair, HAIR_BACK_STYLES, HAIR_STYLES, HAIRLINES, headHalfWidth,
  featureInk, headPath, Mouth, Neck, Nose,
  type BrowStyle, type Expression, type FaceAccessory, type FaceShape, type EyeStyle,
  type FacialHairStyle, type HairStyle, type Hairline, type HeadGeometry,
} from './face';

/**
 * Procedurally generated portraits.
 *
 * No image assets ship with this game. Every player, creator and fan face is
 * drawn from a seed string at render time — which means a 20,000-player world
 * costs zero bytes of download, portraits are stable across saves and devices,
 * and nothing ever 404s.
 *
 * The style is stylised rather than photoreal: a vector face reads instantly at
 * 28px in a squad list, which a rendered head never does, and it sidesteps the
 * uncanny mismatch between a photoreal face and a procedurally invented name.
 * It is *not*, however, flat — a face is lit from the upper left with a
 * cheekbone highlight, a jaw-side falloff, a neck shadow and one hair sheen,
 * because flat fills at these sizes read as clip-art rather than as a
 * broadcast graphics package.
 *
 * Determinism: every feature reads a *named* channel from the seed stream, so
 * adding a new feature later does not reshuffle every existing face, and the
 * same seed produces byte-identical SVG on every device forever.
 *
 * The geometry itself lives in `./face`, shared with the manager customiser so
 * the player's own portrait belongs to the same world as the newgens.
 */

const SKIN_TONES = [
  '#f7e0cd', '#f2d3bb', '#e9c19f', '#dcb18f', '#d9a77c', '#c68a5e',
  '#b9835b', '#a9683f', '#8a4f2d', '#6b3a20', '#5a2f1a', '#43220f',
] as const;

const HAIR_COLORS = [
  '#1b1613', '#241c17', '#2e2119', '#4a3121', '#6b4526', '#8d6034',
  '#b4884a', '#d8b36a', '#7d7d7d', '#c9c9c9', '#e3e3e3', '#3a2d5a',
] as const;

const BROW_STYLE_POOL = ['flat', 'arched', 'angled', 'thick', 'soft'] as const;

/**
 * Weighted by repetition rather than by a weights table: a third of a squad
 * being clean-shaven is what a real team looks like, and a literal list keeps
 * `SeedStream.pick` doing the only job it has.
 */
const FACIAL_HAIR_POOL = [
  'none', 'none', 'none', 'none', 'none',
  'stubble', 'stubble', 'stubble',
  'moustache', 'goatee', 'soulpatch', 'sideburns',
  'beard', 'beard', 'fullbeard', 'chinstrap',
] as const;

/**
 * Expression is deliberately narrow. A grin on a squad-list face reads as a
 * different *game*; what we want is the difference between a player who looks
 * present and one who looks switched on.
 */
const EXPRESSION_POOL = ['neutral', 'neutral', 'neutral', 'focused', 'focused', 'smile'] as const;

export type PortraitVariant = 'player' | 'creator';

/**
 * Accessories are rare on purpose: roughly one player in five wears anything,
 * and only one in sixteen wears something you would describe out loud. Creators
 * are the visible half of the game's world and pull from a flashier pool, so a
 * feed of avatars is distinguishable from a team sheet at a glance.
 */
function rollAccessory(roll: number, variant: PortraitVariant): FaceAccessory {
  if (variant === 'creator') {
    if (roll < 0.09) return 'tinted';
    if (roll < 0.19) return 'cap';
    if (roll < 0.28) return 'chain';
    if (roll < 0.36) return 'earring';
    if (roll < 0.43) return 'glasses';
    if (roll < 0.49) return 'headband';
    if (roll < 0.54) return 'studs';
    return 'none';
  }
  if (roll < 0.06) return 'earring';
  if (roll < 0.11) return 'headband';
  if (roll < 0.15) return 'glasses';
  if (roll < 0.18) return 'studs';
  return 'none';
}

export interface PortraitFeatures {
  readonly skin: string;
  readonly hair: string;
  readonly hairStyle: HairStyle;
  readonly hairline: Hairline;
  readonly facialHair: FacialHairStyle;
  readonly faceShape: FaceShape;
  readonly halfWidth: number;
  readonly jaw: number;
  readonly browThickness: number;
  readonly browStyle: BrowStyle;
  readonly eyeStyle: EyeStyle;
  readonly eyeSpacing: number;
  readonly expression: Expression;
  readonly earSize: number;
  readonly noseWidth: number;
  readonly mouthCurve: number;
  readonly accessory: FaceAccessory;
}

/**
 * The whole face as data. Exported so tests, the gallery and any future
 * override layer (hand-painted plates over the same features) can inspect a
 * face without rendering one.
 */
export function portraitFeatures(seed: string, variant: PortraitVariant = 'player'): PortraitFeatures {
  const s = new SeedStream(seed || 'anonymous');
  return {
    skin: s.pick('skin', SKIN_TONES),
    hair: s.pick('hairColor', HAIR_COLORS),
    hairStyle: s.pick('hairStyle', HAIR_STYLES),
    hairline: s.pick('hairline', HAIRLINES),
    // A bald head with a full beard is a real look; a buzz cut with a chinstrap
    // is not worth the combinatorics, so facial hair is drawn independently.
    facialHair: s.pick('facialHair', FACIAL_HAIR_POOL),
    faceShape: s.pick('faceShape', FACE_SHAPES),
    halfWidth: s.range('width', 21.5, 26),
    jaw: s.range('jaw', 0.64, 0.96),
    browThickness: s.range('brow', 1.9, 3),
    browStyle: s.pick('browStyle', BROW_STYLE_POOL),
    eyeStyle: s.pick('eye', EYE_STYLES),
    eyeSpacing: s.range('eyeSpacing', 10.2, 12),
    expression: s.pick('expression', EXPRESSION_POOL),
    earSize: s.range('ear', 3.3, 4.5),
    noseWidth: s.range('nose', 2.1, 3.2),
    mouthCurve: s.range('mouth', -1.4, 2),
    accessory: rollAccessory(s.channel('accessory'), variant),
  };
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
  /**
   * Which accessory pool the face draws from. `creator` is flashier — caps,
   * chains, tinted lenses. Set for you by `CreatorAvatar`.
   */
  variant?: PortraitVariant;
}

const SHAPE_CLASS: Record<PortraitShape, string> = {
  circle: 'rounded-pill',
  squircle: 'rounded-[28%]',
  square: 'rounded-sm',
  bare: '',
};

/** Kit collars, so two players in the same shirt are not the same drawing. */
const collarFor = (seedChar: number, secondary: string): ReactNode => {
  const dark = darken(secondary, 0.35);
  if (seedChar === 0) return <path d="M49 92 L60 104 L71 92 L66 91 L60 97 L54 91 Z" fill={dark} />;
  if (seedChar === 1) {
    return (
      <>
        <path d="M50 92 C54 102 66 102 70 92 L73 94 C68 106 52 106 47 94 Z" fill={dark} />
        <rect x={59} y={93} width={2} height={14} fill={rgba(lighten(secondary, 0.4), 0.6)} />
      </>
    );
  }
  return <path d="M48 92 C53 103 67 103 72 92 L75 95 C69 108 51 108 45 95 Z" fill={dark} />;
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
  variant = 'player',
}: PlayerPortraitProps): ReactNode {
  const bgId = useSvgId('cf-face-bg');
  const headClipId = useSvgId('cf-face-clip');
  const skinId = useSvgId('cf-face-skin');
  const hairId = useSvgId('cf-face-hair');
  const glossId = useSvgId('cf-face-gloss');
  const f = useMemo(() => portraitFeatures(seed, variant), [seed, variant]);
  const collar = useMemo(() => new SeedStream(seed || 'anonymous').int('collar', 3), [seed]);
  // Volt is a state colour, not decoration, so it reaches an accessory only on
  // a quarter of the faces that wear one at all — a couple per hundred.
  const flair = useMemo(() => new SeedStream(seed || 'anonymous').chance('flair', 0.25), [seed]);

  const primary = colors?.primary ?? '#1c2026';
  const secondary = colors?.secondary ?? '#262b33';
  const geometry: HeadGeometry = { halfWidth: f.halfWidth, jaw: f.jaw, shape: f.faceShape };
  const head = headPath(geometry);
  const w = headHalfWidth(geometry);
  const hairFill = `url(#${hairId})`;
  const accent = flair ? '#c8ff2e' : lighten(primary, 0.42);
  const backHair = HAIR_BACK_STYLES.has(f.hairStyle);
  // A cap covers the crown, so the hair under it is drawn as sides only.
  const capped = f.accessory === 'cap';

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
        <radialGradient id={bgId} cx="50%" cy="34%" r="78%">
          <stop offset="0%" stopColor={lighten(primary, 0.18)} />
          <stop offset="62%" stopColor={primary} />
          <stop offset="100%" stopColor={darken(primary, 0.55)} />
        </radialGradient>
        <FaceGradients skinId={skinId} hairId={hairId} glossId={glossId} skin={f.skin} hair={f.hair} />
        <clipPath id={headClipId}>
          <path d={head} />
        </clipPath>
      </defs>

      <rect width="120" height="120" fill={`url(#${bgId})`} />
      {/* A single wide arc gives the flat backdrop depth without a second
          gradient pass — cheaper than a blur and reads as stadium light. */}
      <path d="M-10 96 C24 74 96 74 130 96 L130 130 L-10 130 Z" fill={rgba(darken(primary, 0.7), 0.55)} />

      {/* Volume that belongs behind the head: afro, long hair, dreads, tail. */}
      {backHair && <Hair layer="back" style={f.hairStyle} color={f.hair} w={w} fill={hairFill} />}

      {kit && (
        <>
          <path d="M14 120 C14 100 32 92 60 92 C88 92 106 100 106 120 Z" fill={secondary} />
          {collarFor(collar, secondary)}
        </>
      )}

      <Neck skin={f.skin} g={geometry} />
      <Ears skin={f.skin} g={geometry} size={f.earSize} />

      <path d={head} fill={`url(#${skinId})`} />
      <FaceShading clipId={headClipId} glossId={glossId} skin={f.skin} g={geometry} />

      <Brows
        style={f.browStyle}
        color={featureInk(f.skin, darken(f.hair, 0.12))}
        thickness={f.browThickness}
        expression={f.expression}
        spacing={f.eyeSpacing}
      />
      <Eyes style={f.eyeStyle} expression={f.expression} skin={f.skin} spacing={f.eyeSpacing} />
      <Nose skin={f.skin} width={f.noseWidth} g={geometry} />
      <Mouth skin={f.skin} expression={f.expression} curve={f.mouthCurve} g={geometry} />

      <FacialHairLayer kind={f.facialHair} color={featureInk(f.skin, darken(f.hair, 0.08))} g={geometry} />

      {/* The front layer of every style except the afro, whose whole volume is
          the back layer, and except under a cap. */}
      {!capped && <Hair style={f.hairStyle} color={f.hair} w={w} hairline={f.hairline} fill={hairFill} />}

      <Accessory kind={f.accessory} accent={accent} g={geometry} hair={f.hair} />
    </svg>
  );
}

/**
 * Memoised: squad lists render 18-40 of these at once and the feature
 * derivation plus ~35 SVG nodes per face is the most expensive thing on those
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
 * playing role many of them do not have. They do get the flashier accessory
 * pool, which is the cheapest way to make a feed look like a different set of
 * people from the squad screen.
 */
export function CreatorAvatar({
  verified = false,
  tier,
  size = 44,
  ring,
  variant = 'creator',
  ...rest
}: CreatorAvatarProps): ReactNode {
  const ringColor = ring ?? (tier ? TIER_RING[tier] : undefined);
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <PlayerPortrait
        {...rest}
        size={size}
        kit={false}
        variant={variant}
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
