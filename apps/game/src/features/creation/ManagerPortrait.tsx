import { memo, type ReactNode } from 'react';
import type { ManagerAppearance } from '@cf/engine';
import { cn, darken, lighten, rgba, useSvgId } from '@/design';
import { SKIN_TONES } from './appearance';

/**
 * The manager's portrait, drawn from their choices.
 *
 * WHY THIS EXISTS RATHER THAN `PlayerPortrait`
 *
 * The design system's procedural portrait is a pure function of a seed string,
 * which is exactly right for twenty thousand generated players and exactly
 * wrong for a customiser, where the player picks the features and the string
 * has to follow. Inverting it by searching for a seed that hashes to a chosen
 * face turns out to be impossible: `SeedStream.channel` derives every channel
 * from the same 32-bit root through one xorshift, so the four face channels are
 * strongly correlated and the renderer can only ever produce **32 distinct
 * faces in total** — verified by sampling 200,000 random seeds. Worse, those 32
 * are correlated in a way nobody would choose deliberately: every dark skin tone
 * in the reachable set comes with a moustache or a chinstrap, and every light
 * one comes clean-shaven or with a goatee.
 *
 * So this component draws the appearance directly, in the same flat graphic
 * language and the same 120×120 frame as the kit's portrait, using the design
 * system's own colour helpers. It also renders two things the seeded portrait
 * cannot: the touchline outfit and the accessory, both of which are real fields
 * on `ManagerAppearance`.
 *
 * When `SeedStream` is fixed (or `PlayerPortrait` grows a `features` prop) this
 * should be deleted and every call site pointed back at the kit. It is exported
 * from the feature barrel so that every screen showing the player's manager
 * shows the same face until then.
 */

const CX = 60;
const TOP = 20;
const CHIN = 84;
const HALF = 24;

/** Accepts the renderer's vocabulary and the engine generator's alike. */
const ENGINE_HAIR_STYLE: Readonly<Record<string, string>> = {
  short_crop: 'short', swept_back: 'waves', tied_back: 'bun', messy: 'curls',
  side_part: 'short', braids: 'curls', short_neat: 'fade', bob: 'long',
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

const isHex = (value: string): boolean => /^#[0-9a-f]{3,6}$/i.test(value);

export interface ResolvedAppearance {
  readonly skin: string;
  readonly hair: string;
  readonly hairStyle: string;
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
    facialHair: appearance.facialHair,
    outfit: appearance.outfit,
    accessory: appearance.accessory,
    accent: appearance.accentColor,
  };
}

const headPath = (): string =>
  [
    `M${CX - HALF} ${TOP + 26}`,
    `C${CX - HALF} ${TOP + 8} ${CX - HALF * 0.62} ${TOP} ${CX} ${TOP}`,
    `C${CX + HALF * 0.62} ${TOP} ${CX + HALF} ${TOP + 8} ${CX + HALF} ${TOP + 26}`,
    `L${CX + HALF} ${CHIN - 24}`,
    `C${CX + HALF} ${CHIN - 8} ${CX + HALF * 0.62} ${CHIN} ${CX} ${CHIN}`,
    `C${CX - HALF * 0.62} ${CHIN} ${CX - HALF} ${CHIN - 8} ${CX - HALF} ${CHIN - 24}`,
    'Z',
  ].join(' ');

function Hair({ style, color }: { style: string; color: string }): ReactNode {
  const w = HALF;
  const edge = darken(color, 0.28);
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
    case 'waves':
      return (
        <path
          d={`M${CX - w - 1} ${TOP + 26} C${CX - w - 1} ${TOP - 2} ${CX - w * 0.5} ${TOP - 8} ${CX + 2} ${TOP - 8} C${CX + w * 0.9} ${TOP - 8} ${CX + w + 2} ${TOP - 1} ${CX + w} ${TOP + 24} C${CX + w * 0.4} ${TOP + 8} ${CX - w * 0.2} ${TOP + 12} ${CX - w - 1} ${TOP + 26} Z`}
          fill={color}
        />
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
          <ellipse cx={CX} cy={TOP + 14} rx={w + 9} ry={w + 4} fill={color} />
          <ellipse cx={CX - 6} cy={TOP + 4} rx={w * 0.44} ry={w * 0.28} fill={rgba(lighten(color, 0.32), 0.45)} />
        </>
      );
    case 'bun':
      return (
        <>
          <circle cx={CX} cy={TOP - 7} r={8} fill={darken(color, 0.12)} />
          <path
            d={`M${CX - w - 1} ${TOP + 24} C${CX - w - 1} ${TOP} ${CX - w * 0.5} ${TOP - 6} ${CX} ${TOP - 6} C${CX + w * 0.5} ${TOP - 6} ${CX + w + 1} ${TOP} ${CX + w + 1} ${TOP + 24} L${CX + w - 2} ${TOP + 14} C${CX + w * 0.3} ${TOP + 8} ${CX - w * 0.3} ${TOP + 8} ${CX - w + 2} ${TOP + 14} Z`}
            fill={color}
          />
        </>
      );
    case 'mohawk':
      return (
        <>
          <path
            d={`M${CX - w - 1} ${TOP + 22} C${CX - w - 1} ${TOP + 2} ${CX - w * 0.5} ${TOP - 4} ${CX} ${TOP - 4} C${CX + w * 0.5} ${TOP - 4} ${CX + w + 1} ${TOP + 2} ${CX + w + 1} ${TOP + 22} L${CX + w - 2} ${TOP + 18} C${CX + w * 0.3} ${TOP + 14} ${CX - w * 0.3} ${TOP + 14} ${CX - w + 2} ${TOP + 18} Z`}
            fill={rgba(darken(color, 0.4), 0.45)}
          />
          <path
            d={`M${CX - 7} ${TOP + 6} C${CX - 5} ${TOP - 14} ${CX + 5} ${TOP - 14} ${CX + 7} ${TOP + 6} C${CX + 3} ${TOP - 2} ${CX - 3} ${TOP - 2} ${CX - 7} ${TOP + 6} Z`}
            fill={color}
          />
        </>
      );
    case 'long':
      return (
        <>
          <path
            d={`M${CX - w - 4} ${CHIN - 4} C${CX - w - 6} ${TOP + 16} ${CX - w - 4} ${TOP - 6} ${CX} ${TOP - 6} C${CX + w + 4} ${TOP - 6} ${CX + w + 6} ${TOP + 16} ${CX + w + 4} ${CHIN - 4} L${CX + w} ${CHIN - 10} L${CX + w} ${TOP + 18} L${CX - w} ${TOP + 18} L${CX - w} ${CHIN - 10} Z`}
            fill={color}
          />
          <path
            d={`M${CX - w - 1} ${TOP + 24} C${CX - w - 1} ${TOP} ${CX - w * 0.5} ${TOP - 6} ${CX} ${TOP - 6} C${CX + w * 0.5} ${TOP - 6} ${CX + w + 1} ${TOP} ${CX + w + 1} ${TOP + 24} L${CX + w - 2} ${TOP + 15} C${CX + w * 0.3} ${TOP + 9} ${CX - w * 0.3} ${TOP + 9} ${CX - w + 2} ${TOP + 15} Z`}
            fill={darken(color, 0.08)}
          />
        </>
      );
    case 'short':
    default:
      return (
        <path
          d={`M${CX - w - 1} ${TOP + 28} C${CX - w - 1} ${TOP + 2} ${CX - w * 0.55} ${TOP - 5} ${CX} ${TOP - 5} C${CX + w * 0.55} ${TOP - 5} ${CX + w + 1} ${TOP + 2} ${CX + w + 1} ${TOP + 28} L${CX + w - 1} ${TOP + 20} C${CX + w * 0.3} ${TOP + 12} ${CX - w * 0.55} ${TOP + 11} ${CX - w + 1} ${TOP + 21} Z`}
          fill={color}
        />
      );
  }
}

function FacialHair({ style, color, skin }: { style: string; color: string; skin: string }): ReactNode {
  const mouthY = TOP + 56;
  switch (style) {
    case 'stubble':
      return (
        <path
          d={`M${CX - 15} ${mouthY - 8} C${CX - 15} ${CHIN - 2} ${CX + 15} ${CHIN - 2} ${CX + 15} ${mouthY - 8} C${CX + 10} ${mouthY + 2} ${CX - 10} ${mouthY + 2} ${CX - 15} ${mouthY - 8} Z`}
          fill={rgba(color, 0.28)}
        />
      );
    case 'moustache':
      return (
        <path
          d={`M${CX - 9} ${mouthY - 4} C${CX - 5} ${mouthY - 7} ${CX + 5} ${mouthY - 7} ${CX + 9} ${mouthY - 4} C${CX + 5} ${mouthY - 1} ${CX - 5} ${mouthY - 1} ${CX - 9} ${mouthY - 4} Z`}
          fill={color}
        />
      );
    case 'goatee':
      return (
        <>
          <path
            d={`M${CX - 8} ${mouthY - 4} C${CX - 4} ${mouthY - 7} ${CX + 4} ${mouthY - 7} ${CX + 8} ${mouthY - 4} C${CX + 4} ${mouthY - 1} ${CX - 4} ${mouthY - 1} ${CX - 8} ${mouthY - 4} Z`}
            fill={color}
          />
          <path
            d={`M${CX - 6} ${mouthY + 4} C${CX - 6} ${mouthY + 12} ${CX + 6} ${mouthY + 12} ${CX + 6} ${mouthY + 4} C${CX + 3} ${mouthY + 2} ${CX - 3} ${mouthY + 2} ${CX - 6} ${mouthY + 4} Z`}
            fill={color}
          />
        </>
      );
    case 'chinstrap':
      return (
        <path
          d={`M${CX - 17} ${TOP + 40} C${CX - 18} ${CHIN - 4} ${CX + 18} ${CHIN - 4} ${CX + 17} ${TOP + 40} L${CX + 13} ${TOP + 42} C${CX + 13} ${CHIN - 9} ${CX - 13} ${CHIN - 9} ${CX - 13} ${TOP + 42} Z`}
          fill={color}
        />
      );
    case 'beard':
      return (
        <>
          <path
            d={`M${CX - 18} ${TOP + 38} C${CX - 20} ${CHIN + 2} ${CX + 20} ${CHIN + 2} ${CX + 18} ${TOP + 38} C${CX + 12} ${TOP + 50} ${CX - 12} ${TOP + 50} ${CX - 18} ${TOP + 38} Z`}
            fill={color}
          />
          <path
            d={`M${CX - 7} ${mouthY} C${CX - 3} ${mouthY + 3} ${CX + 3} ${mouthY + 3} ${CX + 7} ${mouthY}`}
            stroke={darken(skin, 0.3)}
            strokeWidth="1.6"
            strokeLinecap="round"
            fill="none"
          />
        </>
      );
    default:
      return null;
  }
}

function Accessory({ kind, accent }: { kind: string; accent: string }): ReactNode {
  const eyeY = TOP + 40;
  switch (kind) {
    case 'tinted_glasses':
      return (
        <g>
          <rect x={CX - 20} y={eyeY - 6} width={16} height={12} rx={3} fill={rgba('#0a0c0f', 0.72)} stroke={accent} strokeWidth="1.4" />
          <rect x={CX + 4} y={eyeY - 6} width={16} height={12} rx={3} fill={rgba('#0a0c0f', 0.72)} stroke={accent} strokeWidth="1.4" />
          <path d={`M${CX - 4} ${eyeY} H${CX + 4}`} stroke={accent} strokeWidth="1.4" />
        </g>
      );
    case 'earpiece':
      return (
        <g fill={rgba('#e8ecf0', 0.9)}>
          <circle cx={CX + HALF - 1} cy={eyeY + 2} r={3.2} />
          <path d={`M${CX + HALF - 1} ${eyeY + 5} C${CX + HALF + 2} ${eyeY + 14} ${CX + 12} ${eyeY + 18} ${CX + 8} ${eyeY + 18}`} stroke={rgba('#e8ecf0', 0.8)} strokeWidth="1.4" fill="none" />
        </g>
      );
    case 'lanyard':
      return (
        <g>
          <path d={`M${CX - 12} ${CHIN + 6} L${CX} ${CHIN + 22} L${CX + 12} ${CHIN + 6}`} stroke={accent} strokeWidth="2.4" fill="none" />
          <rect x={CX - 5} y={CHIN + 20} width={10} height={7} rx={1.5} fill={rgba('#e8ecf0', 0.9)} />
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
  const a = resolveAppearance(appearance);
  const shade = darken(a.skin, 0.16);
  const outfit = OUTFIT_COLOR[a.outfit] ?? '#1b2027';
  const eyeY = TOP + 40;

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
      </defs>

      <rect width="120" height="120" fill={`url(#${bgId})`} />
      <path d="M-10 96 C24 74 96 74 130 96 L130 130 L-10 130 Z" fill={rgba(darken(a.accent, 0.86), 0.6)} />

      {/* Volume that belongs behind the head and the shoulders. Drawn here and
          *not* again in front, or it would cover the face it frames. */}
      {(a.hairStyle === 'long' || a.hairStyle === 'afro') && (
        <Hair style={a.hairStyle} color={a.hair} />
      )}

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

      {/* Neck, then head. */}
      <path d={`M${CX - 8} ${CHIN - 8} h16 v14 h-16 Z`} fill={shade} />
      <path d={headPath()} fill={a.skin} />
      <path
        d={`M${CX + HALF - 6} ${TOP + 24} C${CX + HALF} ${TOP + 40} ${CX + HALF - 4} ${CHIN - 14} ${CX + 6} ${CHIN - 2} L${CX + HALF} ${CHIN - 16} L${CX + HALF} ${TOP + 26} Z`}
        fill={rgba(shade, 0.5)}
      />

      {/* Ears. */}
      <ellipse cx={CX - HALF} cy={eyeY + 4} rx={3.6} ry={5} fill={shade} />
      <ellipse cx={CX + HALF} cy={eyeY + 4} rx={3.6} ry={5} fill={shade} />

      {a.hairStyle !== 'afro' && a.hairStyle !== 'long' && <Hair style={a.hairStyle} color={a.hair} />}
      {a.hairStyle === 'long' && (
        // The long style still needs its crown in front of the head.
        <path
          d={`M${CX - HALF - 1} ${TOP + 24} C${CX - HALF - 1} ${TOP} ${CX - HALF * 0.5} ${TOP - 6} ${CX} ${TOP - 6} C${CX + HALF * 0.5} ${TOP - 6} ${CX + HALF + 1} ${TOP} ${CX + HALF + 1} ${TOP + 24} L${CX + HALF - 2} ${TOP + 15} C${CX + HALF * 0.3} ${TOP + 9} ${CX - HALF * 0.3} ${TOP + 9} ${CX - HALF + 2} ${TOP + 15} Z`}
          fill={darken(a.hair, 0.08)}
        />
      )}

      {/* Brows, eyes, mouth. Deliberately minimal: at 40px anything more turns
          into noise, and the identity is carried by silhouette and colour. */}
      <g fill={darken(a.hair, 0.2)}>
        <rect x={CX - 16} y={eyeY - 8} width={11} height={2.8} rx={1.4} />
        <rect x={CX + 5} y={eyeY - 8} width={11} height={2.8} rx={1.4} />
      </g>
      <g fill="#20262d">
        <circle cx={CX - 10.5} cy={eyeY} r={2.4} />
        <circle cx={CX + 10.5} cy={eyeY} r={2.4} />
      </g>
      <path
        d={`M${CX - 6} ${TOP + 56} C${CX - 2} ${TOP + 59} ${CX + 2} ${TOP + 59} ${CX + 6} ${TOP + 56}`}
        stroke={darken(a.skin, 0.34)}
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />

      <FacialHair style={a.facialHair} color={darken(a.hair, 0.08)} skin={a.skin} />
      <Accessory kind={a.accessory} accent={a.accent} />
    </svg>
  );
}

export const ManagerPortrait = memo(ManagerPortraitInner);
