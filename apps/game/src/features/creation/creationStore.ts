import { create } from 'zustand';
import {
  MANAGER_ARCHETYPES, PREMADE_MANAGERS,
  type ClubChoice, type ClubPhilosophy, type ClubVisualIdentity, type FanCulture,
  type ManagerAppearance, type ManagerChoice, type MediaStyle, type SocialPersonality,
} from '@cf/engine';
import { SeedStream } from '@/design';
import {
  ACCENT_COLORS, ARCHETYPE_PERSONA, DEFAULT_APPEARANCE, FACIAL_HAIR,
  HAIR_COLORS, HAIR_STYLES, SKIN_TONES,
} from './appearance';
import {
  DEFAULT_VISUAL, MOTTO_SUGGESTIONS, deriveAbbreviation, deriveShortName,
} from './clubIdentity';

/**
 * The creation draft.
 *
 * It lives outside React and outside the game store on purpose. Nothing here is
 * game state — no engine function has seen any of it yet — and keeping it
 * separate is what makes every step of the flow reversible: the routes are real
 * routes, back is the browser's back, and returning to a step finds it exactly
 * as it was left. There is no wizard state machine to get out of sync with the
 * URL, because the URL is the state machine.
 *
 * The draft is cleared once, when a game is successfully created. Abandoning
 * halfway and coming back later keeps everything.
 */

export type ManagerMode = 'CUSTOM' | 'PREMADE';
export type ClubMode = 'CUSTOM' | 'TAKEOVER';

export interface CreationState {
  managerMode: ManagerMode;
  premadeManagerId: string | null;
  managerName: string;
  archetypeId: string | null;
  appearance: ManagerAppearance;
  mediaStyle: MediaStyle;
  socialPersonality: SocialPersonality;
  /** Set once the player edits the persona so archetype changes stop overwriting it. */
  personaTouched: boolean;

  clubMode: ClubMode;
  takeoverClubId: string | null;
  clubName: string;
  shortName: string;
  abbreviation: string;
  city: string;
  philosophy: ClubPhilosophy;
  fanCulture: FanCulture;
  motto: string;
  visual: ClubVisualIdentity;
  shortNameTouched: boolean;
  abbreviationTouched: boolean;

  setManagerMode: (mode: ManagerMode) => void;
  choosePremade: (templateId: string) => void;
  setManagerName: (name: string) => void;
  setArchetype: (id: string) => void;
  setAppearance: (patch: Partial<ManagerAppearance>) => void;
  randomiseAppearance: (entropy: number) => void;
  setMediaStyle: (style: MediaStyle) => void;
  setSocialPersonality: (value: SocialPersonality) => void;

  setClubMode: (mode: ClubMode) => void;
  chooseTakeover: (templateId: string) => void;
  setClubName: (name: string) => void;
  setShortName: (name: string) => void;
  setAbbreviation: (value: string) => void;
  setCity: (value: string) => void;
  setPhilosophy: (value: ClubPhilosophy) => void;
  setFanCulture: (value: FanCulture) => void;
  setMotto: (value: string) => void;
  suggestMotto: (entropy: number) => void;
  setVisual: (patch: Partial<ClubVisualIdentity>) => void;
  randomiseVisual: (entropy: number) => void;

  reset: () => void;
}

const INITIAL = {
  managerMode: 'CUSTOM' as ManagerMode,
  premadeManagerId: null,
  managerName: '',
  archetypeId: null,
  appearance: DEFAULT_APPEARANCE,
  mediaStyle: 'HONEST' as MediaStyle,
  socialPersonality: 'ACTIVE' as SocialPersonality,
  personaTouched: false,

  clubMode: 'CUSTOM' as ClubMode,
  takeoverClubId: null,
  clubName: '',
  shortName: '',
  abbreviation: '',
  city: '',
  philosophy: 'LOCAL_ROOTS' as ClubPhilosophy,
  fanCulture: 'DIEHARD' as FanCulture,
  motto: '',
  visual: DEFAULT_VISUAL,
  shortNameTouched: false,
  abbreviationTouched: false,
};

export const useCreationStore = create<CreationState>((set, get) => ({
  ...INITIAL,

  setManagerMode: (managerMode) => set({ managerMode }),

  choosePremade: (templateId) => set({ managerMode: 'PREMADE', premadeManagerId: templateId }),

  setManagerName: (managerName) => set({ managerName }),

  setArchetype: (archetypeId) => {
    const persona = ARCHETYPE_PERSONA[archetypeId];
    const { personaTouched } = get();
    set({
      archetypeId,
      // The persona follows the archetype until the player says otherwise;
      // after that it is theirs and we stop moving it under them.
      ...(persona && !personaTouched
        ? { mediaStyle: persona.media, socialPersonality: persona.social }
        : {}),
    });
  },

  setAppearance: (patch) => set((s) => ({ appearance: { ...s.appearance, ...patch } })),

  randomiseAppearance: (entropy) => {
    // Seeded, not random: the UI layer never calls Math.random, because a
    // second source of randomness in the app is a second thing that can
    // disagree with the simulation.
    const s = new SeedStream(`appearance-${entropy}`);
    set({
      appearance: {
        skinTone: s.pick('skin', SKIN_TONES).tone,
        hairStyle: s.pick('hairStyle', HAIR_STYLES).value,
        hairColor: s.pick('hairColor', HAIR_COLORS).hex,
        facialHair: s.pick('facialHair', FACIAL_HAIR).value,
        outfit: get().appearance.outfit,
        accessory: get().appearance.accessory,
        accentColor: s.pick('accent', ACCENT_COLORS).hex,
      },
    });
  },

  setMediaStyle: (mediaStyle) => set({ mediaStyle, personaTouched: true }),
  setSocialPersonality: (socialPersonality) => set({ socialPersonality, personaTouched: true }),

  setClubMode: (clubMode) => set({ clubMode }),
  chooseTakeover: (templateId) => set({ clubMode: 'TAKEOVER', takeoverClubId: templateId }),

  setClubName: (clubName) =>
    set((s) => ({
      clubName,
      // Short name and abbreviation track the club name until the player edits
      // them. Typing a full name and getting a sensible abbreviation for free
      // is the difference between two fields and four.
      ...(s.shortNameTouched ? {} : { shortName: deriveShortName(clubName) }),
      ...(s.abbreviationTouched ? {} : { abbreviation: deriveAbbreviation(clubName) }),
    })),

  setShortName: (shortName) => set({ shortName, shortNameTouched: true }),
  setAbbreviation: (abbreviation) =>
    set({ abbreviation: abbreviation.toUpperCase().slice(0, 4), abbreviationTouched: true }),
  setCity: (city) => set({ city }),
  setPhilosophy: (philosophy) => set({ philosophy }),
  setFanCulture: (fanCulture) => set({ fanCulture }),
  setMotto: (motto) => set({ motto }),

  suggestMotto: (entropy) =>
    set({ motto: new SeedStream(`motto-${entropy}`).pick('motto', MOTTO_SUGGESTIONS) }),

  setVisual: (patch) => set((s) => ({ visual: { ...s.visual, ...patch } })),

  randomiseVisual: (entropy) =>
    set((s) => {
      const stream = new SeedStream(`visual-${entropy}`);
      return {
        visual: {
          ...s.visual,
          badgeShape: stream.pick('shape', ['SHIELD', 'CREST', 'CIRCLE', 'HEX', 'DIAMOND'] as const),
          badgeMotif: stream.pick('motif', [
            'BOLT', 'STAR', 'CROWN', 'FLAME', 'COMPASS', 'PHOENIX',
            'WOLF', 'LION', 'SERPENT', 'ANCHOR', 'TOWER', 'HAMMER',
          ] as const),
          kitPattern: stream.pick('kit', ['SOLID', 'STRIPES', 'HOOPS', 'SASH', 'HALVES', 'GRADIENT'] as const),
        },
      };
    }),

  reset: () => set({ ...INITIAL }),
}));

/* --- derived --------------------------------------------------------- */

const trimmed = (value: string): string => value.trim();

export function managerComplete(s: CreationState): boolean {
  if (s.managerMode === 'PREMADE') return s.premadeManagerId !== null;
  return trimmed(s.managerName).length >= 2 && s.archetypeId !== null;
}

export function clubComplete(s: CreationState): boolean {
  if (s.clubMode === 'TAKEOVER') return s.takeoverClubId !== null;
  return (
    trimmed(s.clubName).length >= 3 &&
    trimmed(s.shortName).length >= 2 &&
    trimmed(s.abbreviation).length >= 2 &&
    trimmed(s.city).length >= 2
  );
}

/** The first thing still missing, phrased as the action that fixes it. */
export function managerBlocker(s: CreationState): string | null {
  if (s.managerMode === 'PREMADE') return s.premadeManagerId ? null : 'Pick a manager';
  if (trimmed(s.managerName).length < 2) return 'Add your name';
  if (!s.archetypeId) return 'Choose an archetype';
  return null;
}

export function clubBlocker(s: CreationState): string | null {
  if (s.clubMode === 'TAKEOVER') return s.takeoverClubId ? null : 'Pick a club';
  if (trimmed(s.clubName).length < 3) return 'Name your club';
  if (trimmed(s.city).length < 2) return 'Add a city';
  if (trimmed(s.shortName).length < 2) return 'Add a short name';
  if (trimmed(s.abbreviation).length < 2) return 'Add a three-letter code';
  return null;
}

export function toManagerChoice(s: CreationState): ManagerChoice {
  if (s.managerMode === 'PREMADE' && s.premadeManagerId) {
    return { kind: 'PREMADE', templateId: s.premadeManagerId };
  }
  return {
    kind: 'CUSTOM',
    name: trimmed(s.managerName),
    archetypeId: s.archetypeId ?? MANAGER_ARCHETYPES[0]?.id ?? 'tactician',
    appearance: s.appearance,
    mediaStyle: s.mediaStyle,
    socialPersonality: s.socialPersonality,
  };
}

export function toClubChoice(s: CreationState): ClubChoice {
  if (s.clubMode === 'TAKEOVER' && s.takeoverClubId) {
    return { kind: 'TEMPLATE', templateId: s.takeoverClubId };
  }
  return {
    kind: 'CUSTOM',
    name: trimmed(s.clubName),
    shortName: trimmed(s.shortName),
    abbreviation: trimmed(s.abbreviation).toUpperCase(),
    city: trimmed(s.city),
    philosophy: s.philosophy,
    fanCulture: s.fanCulture,
    visual: s.visual,
    motto: trimmed(s.motto) || 'Ours to build.',
  };
}

/** The chosen pre-made template, for previewing the fast path. */
export const premadeManager = (id: string | null) =>
  (id ? PREMADE_MANAGERS.find((m) => m.id === id) : undefined) ?? undefined;
