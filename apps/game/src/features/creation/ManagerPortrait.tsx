import { memo, type ReactNode } from 'react';
import type { ManagerAppearance } from '@cf/engine';
import {
  Accessory as FaceAccessoryLayer, Brows, cn, darken, Ears, EYE_Y, Eyes, FACE_CHIN, FACE_CX,
  FaceGradients, FaceShading, FacialHairLayer, featureInk, Hair, HAIR_BACK_STYLES, headHalfWidth,
  headPath, lighten, Mouth, Neck, Nose, rgba, useSvgId,
  type HeadGeometry,
} from '@/design';
import { SKIN_TONES } from './appearance';

/**
 * The manager's portrait, drawn from their choices.
 *
 * WHY THIS EXISTS RATHER THAN `PlayerPortrait`
 *
 * The design system's procedural portrait is a pure function of a seed string,
 * which is exactly right for twenty thousand generated players and exactly
 * wrong for a customiser, where the player picks the features and the string
 * has to follow. Inverting it — searching for a seed that hashes to a chosen
 * face — is not something you can do at 60fps in a picker, and the seed would
 * change meaning the moment the feature pools grew.
 *
 * What this file no longer does is *redraw the face*. Every head, hair style,
 * beard, brow, eye and mouth here comes from `design/domain/face`, the same
 * library the seeded portrait uses, so the manager is lit the same way and
 * belongs to the same world as the newgens. This component owns only the two
 * things the seeded portrait has no concept of: the touchline outfit and the
 * manager's accessory, both real fields on `ManagerAppearance`.
 */

const CX = FACE_CX;
const CHIN = FACE_CHIN;
const HALF = 24;

/** The manager is drawn at one fixed head geometry; the choices carry identity. */
const GEOMETRY: HeadGeometry = { halfWidth: HALF, jaw: 0.86, shape: 'oval' };

/** Accepts the renderer's vocabulary and the engine generator's alike. */
const ENGINE_HAIR_STYLE: Readonly<Record<string, string>> = {
  short_crop: 'short', swept_back: 'waves', tied_back: 'bun', messy: 'curls',
  side_part: 'crop', braids: 'braids', short_neat: 'fade', bob: 'long',
  thinning: 'bald', shaved: 'bald',
};

const ENGINE_HAIR_COLOR: Readonly<Record<string, string>> = {
  black: '#1b1613', dark: '#2e2119', brown: '#4a3121', auburn: '#8d6034',
  blond: '#d8b36a', grey: '#7d7d7d', ash: '#c9c9c9', white: '#e3e3e3',
};

/** Outfits differ by collar, so the choice is visible rather than just stored. */
const OUTFIT_COLOR: Readonly<Record<string, string>> = {
  technical_coat: '#171b21', training_kit: '#23282f', quarter_zip: '#1d222a',
  club_jacket: '#12161c', bomber_jacket: '#2a2118', padded_coat: '#1a1f26',
  suit: '#101318', tailored_coat: '#141821',
};

/** A thinning hairline is a real choice, so it maps to one rather than to bald. */
const HAIRLINE_FOR: Readonly<Record<string, 'straight' | 'widow' | 'receding' | 'rounded'>> = {
  thinning: 'receding', swept_back: 'widow', side_part: 'straight', short_neat: 'straight',
};

const isHex = (value: string): boolean => /^#[0-9a-f]{3,6}$/i.test(value);

export interface ResolvedAppearance {
  readonly skin: string;
  readonly hair: string;
  readonly hairStyle: string;
  readonly hairline: 'straight' | 'widow' | 'receding' | 'rounded';
  readonly facialHair: string;
  readonly outfit: string;
  readonly accessory: string;
  readonly accent: string;
}

export function resolveAppearance(appearance: ManagerAppearance): ResolvedAppearance {
  return {
    skin: SKIN_TONES.find((s) => s.tone === appearance.skinTone)?.hex ?? '#d9a77c',
    hair: isHex(appearance.hairColor)
      ? appearance.hairColor
      : ENGINE_HAIR_COLOR[appearance.hairColor] ?? '#2e2119',
    hairStyle: ENGINE_HAIR_STYLE[appearance.hairStyle] ?? appearance.hairStyle,
    hairline: HAIRLINE_FOR[appearance.hairStyle] ?? 'rounded',
    facialHair: appearance.facialHair,
    outfit: appearance.outfit,
    accessory: appearance.accessory,
    accent: appearance.accentColor,
  };
}

/** Touchline props the seeded portrait has no vocabulary for. */
function TouchlineProp({ kind, accent }: { kind: string; accent: string }): ReactNode {
  switch (kind) {
    case 'earpiece':
      return (
        <g>
          <circle cx={CX + HALF - 1} cy={EYE_Y + 3} r={3.2} fill={rgba('#e8ecf0', 0.9)} />
          <path
            d={`M${CX + HALF - 1} ${EYE_Y + 6} C${CX + HALF + 2} ${EYE_Y + 15} ${CX + 12} ${EYE_Y + 19} ${CX + 8} ${EYE_Y + 19}`}
            stroke={rgba('#e8ecf0', 0.8)}
            strokeWidth="1.4"
            fill="none"
          />
        </g>
      );
    case 'lanyard':
      return (
        <g>
          <path d={`M${CX - 12} ${CHIN + 6} L${CX} ${CHIN + 22} L${CX + 12} ${CHIN + 6}`} stroke={accent} strokeWidth="2.4" fill="none" />
          <rect x={CX - 5} y={CHIN + 20} width={10} height={7} rx={1.5} fill={rgba('#e8ecf0', 0.9)} />
        </g>
      );
    case 'whistle':
      return (
        <g>
          <path d={`M${CX - 11} ${CHIN + 6} C${CX - 6} ${CHIN + 18} ${CX + 4} ${CHIN + 20} ${CX + 8} ${CHIN + 22}`} stroke={rgba('#c9d1da', 0.8)} strokeWidth="1.6" fill="none" />
          <rect x={CX + 6} y={CHIN + 21} width={9} height={6} rx={3} fill="#d8dde3" />
        </g>
      );
    default:
      return null;
  }
}

export interface ManagerPortraitProps {
  appearance: ManagerAppearance;
  size?: number;
  shape?: 'circle' | 'squircle' | 'square' | 'bare';
  /** Announced name. Omit inside a card that already names the manager. */
  label?: string;
  className?: string;
}

const SHAPE_CLASS: Record<NonNullable<ManagerPortraitProps['shape']>, string> = {
  circle: 'rounded-pill',
  squircle: 'rounded-[28%]',
  square: 'rounded-sm',
  bare: '',
};

function ManagerPortraitInner({
  appearance, size = 96, shape = 'squircle', label, className,
}: ManagerPortraitProps): ReactNode {
  const bgId = useSvgId('cf-mgr-bg');
  const skinId = useSvgId('cf-mgr-skin');
  const hairId = useSvgId('cf-mgr-hair');
  const glossId = useSvgId('cf-mgr-gloss');
  const clipId = useSvgId('cf-mgr-clip');
  const a = resolveAppearance(appearance);
  const outfit = OUTFIT_COLOR[a.outfit] ?? '#1b2027';
  const head = headPath(GEOMETRY);
  const w = headHalfWidth(GEOMETRY);
  const hairFill = `url(#${hairId})`;
  const backHair = HAIR_BACK_STYLES.has(a.hairStyle);
  const glasses = a.accessory === 'tinted_glasses';

  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={cn('block shrink-0 overflow-hidden', SHAPE_CLASS[shape], className)}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <defs>
        <radialGradient id={bgId} cx="50%" cy="34%" r="78%">
          <stop offset="0%" stopColor={lighten(a.accent, 0.1)} />
          <stop offset="58%" stopColor={darken(a.accent, 0.42)} />
          <stop offset="100%" stopColor={darken(a.accent, 0.78)} />
        </radialGradient>
        <FaceGradients skinId={skinId} hairId={hairId} glossId={glossId} skin={a.skin} hair={a.hair} />
        <clipPath id={clipId}>
          <path d={head} />
        </clipPath>
      </defs>

      <rect width="120" height="120" fill={`url(#${bgId})`} />
      <path d="M-10 96 C24 74 96 74 130 96 L130 130 L-10 130 Z" fill={rgba(darken(a.accent, 0.86), 0.6)} />

      {/* Volume that belongs behind the head and the shoulders. */}
      {backHair && <Hair layer="back" style={a.hairStyle} color={a.hair} w={w} fill={hairFill} />}

      {/* Shoulders. The collar is the outfit. */}
      <path d="M14 120 C14 100 32 92 60 92 C88 92 106 100 106 120 Z" fill={outfit} />
      {a.outfit === 'suit' || a.outfit === 'tailored_coat' ? (
        <>
          <path d="M52 92 L60 106 L68 92 L64 91 L60 98 L56 91 Z" fill={rgba('#f4f6f8', 0.85)} />
          <path d="M48 93 L60 108 L46 116 Z" fill={darken(outfit, 0.4)} />
          <path d="M72 93 L60 108 L74 116 Z" fill={darken(outfit, 0.4)} />
        </>
      ) : a.outfit === 'quarter_zip' ? (
        <>
          <path d="M50 94 C54 104 66 104 70 94 L70 100 C66 110 54 110 50 100 Z" fill={darken(outfit, 0.35)} />
          <rect x={59} y={94} width={2} height={16} fill={rgba('#c9d1da', 0.8)} />
        </>
      ) : (
        <path
          d="M50 93 C54 102 66 102 70 93 L72 96 C68 108 52 108 48 96 Z"
          fill={darken(outfit, 0.32)}
        />
      )}
      {/* A stripe of the manager's colour on the shoulder — the one place the
          accent appears on the body, so it reads at list size. */}
      <path d="M14 120 C14 108 20 100 28 96 L34 120 Z" fill={rgba(a.accent, 0.85)} />

      <Neck skin={a.skin} g={GEOMETRY} />
      <Ears skin={a.skin} g={GEOMETRY} size={3.8} />

      <path d={head} fill={`url(#${skinId})`} />
      <FaceShading clipId={clipId} glossId={glossId} skin={a.skin} g={GEOMETRY} />

      <Brows style="soft" color={featureInk(a.skin, darken(a.hair, 0.2))} thickness={2.8} expression="neutral" />
      <Eyes style="almond" expression="neutral" skin={a.skin} />
      <Nose skin={a.skin} width={2.4} g={GEOMETRY} />
      {/* A manager on the touchline is composed, not cheerful. */}
      <Mouth skin={a.skin} expression="neutral" curve={0.8} g={GEOMETRY} />

      <FacialHairLayer kind={a.facialHair} color={featureInk(a.skin, darken(a.hair, 0.08))} g={GEOMETRY} />

      <Hair style={a.hairStyle} color={a.hair} w={w} hairline={a.hairline} fill={hairFill} />

      {glasses
        ? <FaceAccessoryLayer kind="tinted" accent={a.accent} g={GEOMETRY} hair={a.hair} />
        : <TouchlineProp kind={a.accessory} accent={a.accent} />}
    </svg>
  );
}

export const ManagerPortrait = memo(ManagerPortraitInner);
