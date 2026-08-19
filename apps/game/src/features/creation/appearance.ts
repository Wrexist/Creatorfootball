import type { ManagerAppearance, MediaStyle, SocialPersonality } from '@cf/engine';

/**
 * The vocabulary of the appearance builder.
 *
 * Two of these axes are *rendered* — skin tone, hair style, hair colour and
 * facial hair are the four channels the design system's procedural portrait
 * actually draws, so the colours and names below are the renderer's own values
 * rather than approximations of them (see `portraitSeed.ts` for how a choice
 * becomes a seed the portrait will honour).
 *
 * Outfit and accessory are not drawn at portrait scale — a lanyard at 96px is
 * three grey pixels — so they are presented as what they are: character
 * details that appear in text and in future full-body art, never as a promise
 * that the picture will change. Pretending otherwise is how a customiser loses
 * the player's trust in the first thirty seconds.
 *
 * The accent colour *is* live: it tints the portrait backdrop and the ring, and
 * carries through the manager's presence across the app.
 */

export interface Option<T> {
  readonly value: T;
  readonly label: string;
}

/** Skin tones, light to dark. The index is the engine's 1-6 `skinTone`. */
export const SKIN_TONES: readonly { readonly tone: number; readonly hex: string; readonly label: string }[] = [
  { tone: 1, hex: '#f7e0cd', label: 'Skin tone 1' },
  { tone: 2, hex: '#e9c19f', label: 'Skin tone 2' },
  { tone: 3, hex: '#d9a77c', label: 'Skin tone 3' },
  { tone: 4, hex: '#c68a5e', label: 'Skin tone 4' },
  { tone: 5, hex: '#8a4f2d', label: 'Skin tone 5' },
  { tone: 6, hex: '#5a2f1a', label: 'Skin tone 6' },
];

export const HAIR_STYLES: readonly Option<string>[] = [
  { value: 'buzz', label: 'Buzz' },
  { value: 'short', label: 'Short' },
  { value: 'fade', label: 'Fade' },
  { value: 'waves', label: 'Waves' },
  { value: 'curls', label: 'Curls' },
  { value: 'afro', label: 'Afro' },
  { value: 'long', label: 'Long' },
  { value: 'bun', label: 'Bun' },
  { value: 'mohawk', label: 'Mohawk' },
  { value: 'bald', label: 'Shaved' },
];

export const HAIR_COLORS: readonly { readonly hex: string; readonly label: string }[] = [
  { hex: '#1b1613', label: 'Black' },
  { hex: '#2e2119', label: 'Dark brown' },
  { hex: '#4a3121', label: 'Brown' },
  { hex: '#6b4526', label: 'Chestnut' },
  { hex: '#8d6034', label: 'Auburn' },
  { hex: '#b4884a', label: 'Sandy' },
  { hex: '#d8b36a', label: 'Blond' },
  { hex: '#7d7d7d', label: 'Grey' },
  { hex: '#c9c9c9', label: 'Silver' },
  { hex: '#3a2d5a', label: 'Dyed' },
];

export const FACIAL_HAIR: readonly Option<string>[] = [
  { value: 'none', label: 'Clean shaven' },
  { value: 'stubble', label: 'Stubble' },
  { value: 'moustache', label: 'Moustache' },
  { value: 'goatee', label: 'Goatee' },
  { value: 'chinstrap', label: 'Chinstrap' },
  { value: 'beard', label: 'Full beard' },
];

export const OUTFITS: readonly Option<string>[] = [
  { value: 'technical_coat', label: 'Technical coat' },
  { value: 'training_kit', label: 'Training kit' },
  { value: 'quarter_zip', label: 'Quarter zip' },
  { value: 'club_jacket', label: 'Club jacket' },
  { value: 'bomber_jacket', label: 'Bomber jacket' },
  { value: 'padded_coat', label: 'Padded coat' },
  { value: 'suit', label: 'Suit' },
  { value: 'tailored_coat', label: 'Tailored coat' },
];

export const ACCESSORIES: readonly Option<string>[] = [
  { value: 'none', label: 'Nothing' },
  { value: 'notebook', label: 'Notebook' },
  { value: 'clipboard', label: 'Clipboard' },
  { value: 'tablet', label: 'Tablet' },
  { value: 'whistle', label: 'Whistle' },
  { value: 'lanyard', label: 'Lanyard' },
  { value: 'earpiece', label: 'Earpiece' },
  { value: 'tinted_glasses', label: 'Tinted glasses' },
  { value: 'thermos', label: 'Thermos' },
  { value: 'chewing_gum', label: 'Chewing gum' },
];

/** Eight separable accents. These tint the portrait and follow you around. */
export const ACCENT_COLORS: readonly { readonly hex: string; readonly label: string }[] = [
  { hex: '#C8FF2E', label: 'Volt' },
  { hex: '#7C8CFF', label: 'Periwinkle' },
  { hex: '#34d399', label: 'Mint' },
  { hex: '#FF2FA0', label: 'Magenta' },
  { hex: '#f4525a', label: 'Red' },
  { hex: '#fbbf24', label: 'Amber' },
  { hex: '#a78bfa', label: 'Violet' },
  { hex: '#9aa3ad', label: 'Steel' },
];

export const MEDIA_STYLES: readonly Option<MediaStyle>[] = [
  { value: 'GUARDED', label: 'Guarded' },
  { value: 'HONEST', label: 'Honest' },
  { value: 'COMBATIVE', label: 'Combative' },
  { value: 'CHARMING', label: 'Charming' },
  { value: 'ANALYTICAL', label: 'Analytical' },
];

export const SOCIAL_PERSONALITIES: readonly Option<SocialPersonality>[] = [
  { value: 'QUIET', label: 'Quiet' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'VIRAL', label: 'Loud' },
  { value: 'PROVOCATEUR', label: 'Provocative' },
];

/** One line each, shown at the moment of choosing rather than in a manual. */
export const MEDIA_STYLE_HINT: Record<MediaStyle, string> = {
  GUARDED: 'Gives the press nothing. They will write it anyway.',
  HONEST: 'Says what happened. Costs you sometimes, earns trust always.',
  COMBATIVE: 'Picks fights on camera. Your squad loves it; the board does not.',
  CHARMING: 'Turns a bad week into a good clip.',
  ANALYTICAL: 'Answers with numbers. Nobody quotes you out of context twice.',
};

export const SOCIAL_PERSONALITY_HINT: Record<SocialPersonality, string> = {
  QUIET: 'Barely posts. Nothing you say online can be used against you.',
  ACTIVE: 'Around, steadily. Reach grows slowly and never spikes.',
  VIRAL: 'Big reach, big exposure. Fans arrive fast and leave fast.',
  PROVOCATEUR: 'Every post is a rivalry deposit. Collect with care.',
};

/**
 * Sensible personas per archetype so the fields arrive pre-filled and correct
 * rather than empty. The player can override both; most will not want to.
 */
export const ARCHETYPE_PERSONA: Record<string, { media: MediaStyle; social: SocialPersonality }> = {
  tactician: { media: 'GUARDED', social: 'QUIET' },
  motivator: { media: 'HONEST', social: 'ACTIVE' },
  showman: { media: 'CHARMING', social: 'VIRAL' },
  data_nerd: { media: 'ANALYTICAL', social: 'QUIET' },
  gambler: { media: 'COMBATIVE', social: 'PROVOCATEUR' },
  disciplinarian: { media: 'GUARDED', social: 'QUIET' },
  peoples_manager: { media: 'HONEST', social: 'ACTIVE' },
  entrepreneur: { media: 'CHARMING', social: 'ACTIVE' },
};

export const DEFAULT_APPEARANCE: ManagerAppearance = {
  skinTone: 3,
  hairStyle: 'short',
  hairColor: '#2e2119',
  facialHair: 'stubble',
  outfit: 'technical_coat',
  accessory: 'notebook',
  accentColor: '#C8FF2E',
};
