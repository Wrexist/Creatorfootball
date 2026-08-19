import {
  AI_PROFILES, CLUB_PHILOSOPHIES, PHILOSOPHY_LABELS,
  type BadgeMotif, type BadgeShape, type ClubIdentityStyle, type ClubPhilosophy,
  type ClubVisualIdentity, type FanCulture,
} from '@cf/engine';

/**
 * The club designer's vocabulary.
 *
 * Every axis here is a real field on `ClubVisualIdentity` that the design
 * system's badge renderer reads, so the preview is not a mock-up of the badge —
 * it is the badge, drawn by the same component the league table will use.
 *
 * The philosophy and fan-culture copy is deliberately consequence-first. Both
 * are simulation inputs: philosophy seeds the club's starting tactical setup
 * and its AI disposition, fan culture seeds loyalty, expectation and how much
 * of the support is online. A player choosing between them is choosing how the
 * season will feel, and the interface has to say so before they commit rather
 * than after.
 */

export interface Option<T> {
  readonly value: T;
  readonly label: string;
  readonly hint?: string;
}

export const BADGE_SHAPES: readonly Option<BadgeShape>[] = [
  { value: 'SHIELD', label: 'Shield' },
  { value: 'CREST', label: 'Crest' },
  { value: 'CIRCLE', label: 'Roundel' },
  { value: 'HEX', label: 'Hex' },
  { value: 'DIAMOND', label: 'Diamond' },
];

export const BADGE_MOTIFS: readonly Option<BadgeMotif>[] = [
  { value: 'BOLT', label: 'Bolt' },
  { value: 'STAR', label: 'Star' },
  { value: 'CROWN', label: 'Crown' },
  { value: 'FLAME', label: 'Flame' },
  { value: 'COMPASS', label: 'Compass' },
  { value: 'PHOENIX', label: 'Phoenix' },
  { value: 'WOLF', label: 'Wolf' },
  { value: 'LION', label: 'Lion' },
  { value: 'SERPENT', label: 'Serpent' },
  { value: 'ANCHOR', label: 'Anchor' },
  { value: 'TOWER', label: 'Tower' },
  { value: 'HAMMER', label: 'Hammer' },
];

export const KIT_PATTERNS: readonly Option<ClubVisualIdentity['kitPattern']>[] = [
  { value: 'SOLID', label: 'Solid' },
  { value: 'STRIPES', label: 'Stripes' },
  { value: 'HOOPS', label: 'Hoops' },
  { value: 'SASH', label: 'Sash' },
  { value: 'HALVES', label: 'Halves' },
  { value: 'GRADIENT', label: 'Gradient' },
];

export const IDENTITY_STYLES: readonly Option<ClubIdentityStyle>[] = [
  { value: 'CLASSIC', label: 'Classic' },
  { value: 'MODERN', label: 'Modern' },
  { value: 'STREET', label: 'Street' },
  { value: 'RETRO', label: 'Retro' },
  { value: 'MINIMAL', label: 'Minimal' },
  { value: 'BOLD', label: 'Bold' },
];

/**
 * Twelve primaries chosen to be separable at 20px in a league table, which is
 * the size that actually decides whether a palette works.
 */
export const PRIMARY_COLORS: readonly { readonly hex: string; readonly label: string }[] = [
  { hex: '#123B2E', label: 'Forest' },
  { hex: '#0B0B10', label: 'Ink' },
  { hex: '#1E4FE0', label: 'Cobalt' },
  { hex: '#7A1220', label: 'Claret' },
  { hex: '#0E3A52', label: 'Deep teal' },
  { hex: '#3B1E63', label: 'Aubergine' },
  { hex: '#B4451B', label: 'Rust' },
  { hex: '#1F2A33', label: 'Slate' },
  { hex: '#0A5A3C', label: 'Emerald' },
  { hex: '#5A0F3C', label: 'Plum' },
  { hex: '#2E2A1A', label: 'Olive' },
  { hex: '#8C1C1C', label: 'Crimson' },
];

export const SECONDARY_COLORS: readonly { readonly hex: string; readonly label: string }[] = [
  { hex: '#F4F1E6', label: 'Bone' },
  { hex: '#C9A227', label: 'Old gold' },
  { hex: '#FF2FA0', label: 'Magenta' },
  { hex: '#C8FF2E', label: 'Volt' },
  { hex: '#7FD4C1', label: 'Sea glass' },
  { hex: '#F4525A', label: 'Signal red' },
  { hex: '#7C8CFF', label: 'Periwinkle' },
  { hex: '#111417', label: 'Black' },
  { hex: '#FBBF24', label: 'Amber' },
  { hex: '#B9C2CE', label: 'Silver' },
];

export const PHILOSOPHIES = CLUB_PHILOSOPHIES;

/** How the club will actually set up, from the engine's philosophy table. */
export const PHILOSOPHY_PLAY: Record<ClubPhilosophy, string> = {
  YOUTH_ACADEMY: 'Presses high, plays quick, builds from the back and makes changes early.',
  BIG_SPENDERS: 'High line, balanced press, patient short passing out from the goalkeeper.',
  DATA_DRIVEN: 'Mid block, zonal marking, short passing, substitutions by the clock.',
  CREATOR_FIRST: 'Frantic, wide and bold. Counters every time the ball turns over.',
  DEFENSIVE_ROCK: 'Low block, deep line, man marking, and absolutely no hurry.',
  LOCAL_ROOTS: 'Mid block, direct passing, bypasses the press rather than beating it.',
  ENTERTAINERS: 'High press, high line, quick and wide. Concedes as freely as it scores.',
  VETERAN_CORE: 'Deep, patient, short passing, and changes as little as possible.',
};

/** The declared identity also picks the club's AI disposition. */
export const philosophyDescription = (philosophy: ClubPhilosophy): string =>
  AI_PROFILES.find((p) => p.philosophy === philosophy)?.description ?? '';

export const philosophyLabel = (philosophy: ClubPhilosophy): string => PHILOSOPHY_LABELS[philosophy];

export const FAN_CULTURES: readonly FanCulture[] = [
  'ULTRAS', 'FAMILY', 'ONLINE_NATIVE', 'TRADITIONAL', 'BANDWAGON', 'DIEHARD',
];

export const FAN_CULTURE_LABELS: Record<FanCulture, string> = {
  ULTRAS: 'Ultras',
  FAMILY: 'Family club',
  ONLINE_NATIVE: 'Online native',
  TRADITIONAL: 'Traditional',
  BANDWAGON: 'Bandwagon',
  DIEHARD: 'Diehard',
};

/** Stated as the trade-off it is: what you get, and what it costs you. */
export const FAN_CULTURE_HINT: Record<FanCulture, string> = {
  ULTRAS: 'Ferociously loyal and very loud. They expect effort, and they notice when it is missing.',
  FAMILY: 'Patient, trusting, forgiving of a bad month. Growth is slow and the atmosphere is gentle.',
  ONLINE_NATIVE: 'Enormous online reach from day one. Loyalty is the lowest in the league — they leave as fast as they arrived.',
  TRADITIONAL: 'Deep loyalty and full season tickets, paired with the highest expectations you can carry.',
  BANDWAGON: 'Numbers swell the moment you win. They will not be there in February if you do not.',
  DIEHARD: 'They will never leave. They also do not much care what happens online.',
};

export const DEFAULT_VISUAL: ClubVisualIdentity = {
  primary: '#123B2E',
  secondary: '#C8FF2E',
  accent: '#F4F1E6',
  badgeShape: 'SHIELD',
  badgeMotif: 'BOLT',
  style: 'MODERN',
  kitPattern: 'SOLID',
};

/** Suggestions, never impositions — the field stays editable. */
export const MOTTO_SUGGESTIONS: readonly string[] = [
  'Built by us.',
  'Nothing given.',
  'Loud until the end.',
  'We were always here.',
  'Earn the badge.',
  'Forward, always.',
  'Ours to lose.',
  'No quiet weeks.',
];

/** `Marrowgate Athletic` → `Marrowgate`. */
export function deriveShortName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  const first = words[0] ?? '';
  if (first.length >= 5 || words.length === 1) return first;
  return words.slice(0, 2).join(' ');
}

/** `Marrowgate Athletic` → `MGA`. Initials where they exist, letters where they do not. */
export function deriveAbbreviation(name: string): string {
  const words = name.trim().toUpperCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  if (words.length >= 3) return words.slice(0, 3).map((w) => w[0] ?? '').join('');
  const letters = words.join('');
  if (words.length === 2) {
    const [a = '', b = ''] = words;
    return `${a.slice(0, 2)}${b.slice(0, 1)}`;
  }
  return letters.slice(0, 3);
}
