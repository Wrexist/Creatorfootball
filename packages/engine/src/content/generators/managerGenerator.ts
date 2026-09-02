import { asId, type ClubId, type ManagerId } from '../../core/brand';
import { clamp } from '../../core/math';
import type { Rng } from '../../core/rng';
import type { IdentityKind } from '../../licensing/identity';
import {
  MANAGER_ATTRIBUTE_KEYS, emptyManagerAttributes,
  type Manager, type ManagerAppearance, type ManagerArchetype, type ManagerAttributeKey,
  type ManagerAttributes, type MediaStyle, type SocialPersonality,
} from '../../creators/manager';
import type { ManagerTemplate, NameBankDef } from '../schema';
import { GENERATION_BALANCE } from '../balance';

/**
 * Managers: archetypes, the pre-made roster the player picks from, and the
 * generator for everyone else.
 *
 * Every archetype costs something. The modifier sets are deliberately
 * zero-sum — each one's positives and negatives cancel — so the choice is a
 * question of what kind of season you want, never which option is best. A
 * Showman really does lose the dressing room faster; a Tactician really is
 * hopeless in front of a camera.
 */

export const MANAGER_ARCHETYPES: readonly ManagerArchetype[] = [
  {
    id: 'tactician',
    name: 'The Tactician',
    tagline: 'Wins the whiteboard. Loses the room.',
    description:
      'Builds a shape that beats the shape in front of it and expects the players to understand why. Prepares obsessively, adjusts inside a match faster than anyone, and has never in his life given a speech that raised anybody\'s heart rate.',
    modifiers: {
      tacticalKnowledge: 22, adaptability: 12, scouting: 5,
      motivation: -14, brandBuilding: -16, mediaHandling: -9,
    },
    strength: 'Elite in-match adjustments and preparation.',
    weakness: 'Cannot motivate, and every press conference is a small disaster.',
    accent: '#7C8CFF',
  },
  {
    id: 'motivator',
    name: 'The Motivator',
    tagline: 'Ten points a season out of thin air.',
    description:
      'Gets a squad to run through a wall, then has to be told which wall. Half-time is where the season is won, and the recruitment meeting is where it quietly leaks away again.',
    modifiers: {
      motivation: 24, playerDevelopment: 8, adaptability: 6,
      tacticalKnowledge: -16, scouting: -12, negotiation: -6, brandBuilding: -4,
    },
    strength: 'Comebacks, morale, and squads that overperform their rating.',
    weakness: 'Tactically outclassed by good opposition and a poor judge of a signing.',
    accent: '#34d399',
  },
  {
    id: 'showman',
    name: 'The Showman',
    tagline: 'The club has never been bigger. Discipline has never been worse.',
    description:
      'Understands that in this league attention is a currency and spends it beautifully. Sponsors queue up, followers pour in, and by February three of the squad have decided the rules are optional.',
    modifiers: {
      brandBuilding: 26, mediaHandling: 16, motivation: 6,
      discipline: -24, tacticalKnowledge: -14, playerDevelopment: -10,
    },
    strength: 'Commercial growth and fan reach nobody else can match.',
    weakness: 'Cards, indiscipline and a dressing room that follows the vibe, not the plan.',
    accent: '#FF2FA0',
  },
  {
    id: 'data_nerd',
    name: 'The Data Obsessive',
    tagline: 'Finds the player nobody else has heard of.',
    description:
      'Recruits from the model and trusts it further than the room does. The signings look strange and turn out to be correct roughly two thirds of the time, which is a better rate than anyone shouting about it manages.',
    modifiers: {
      scouting: 24, tacticalKnowledge: 12, adaptability: 6, discipline: 4,
      motivation: -18, mediaHandling: -14, riskTolerance: -12, brandBuilding: -2,
    },
    strength: 'Scouting accuracy and squad-building value that compounds every season.',
    weakness: 'Flat dressing room, hostile press, and a refusal to gamble when a gamble is the answer.',
    accent: '#1E4FE0',
  },
  {
    id: 'gambler',
    name: 'The Gambler',
    tagline: 'You will not be bored. You may be relegated.',
    description:
      'Chases the game from the tenth minute. Has won matches nobody else would have won and lost matches nobody else would have lost, usually in the same fortnight, and refuses to accept these are related.',
    modifiers: {
      riskTolerance: 30, adaptability: 10,
      discipline: -16, tacticalKnowledge: -6, playerDevelopment: -10, negotiation: -8,
    },
    strength: 'Enormous variance in your favour when you need a result.',
    weakness: 'The same variance when you needed to see a game out.',
    accent: '#f4525a',
  },
  {
    id: 'disciplinarian',
    name: 'The Disciplinarian',
    tagline: 'Standards first. Everything else follows.',
    description:
      'Runs the tightest ship in the league. Nobody is late twice. The professionalism drift that ruins other squads simply does not happen here, and neither does anything spontaneous.',
    modifiers: {
      discipline: 26, playerDevelopment: 12, scouting: 6,
      motivation: -8, brandBuilding: -14, adaptability: -12, riskTolerance: -10,
    },
    strength: 'Fewest cards, best professionalism, steadiest development curve.',
    weakness: 'Rigid in-match, poor commercially, and flair players do not stay long.',
    accent: '#9aa3ad',
  },
  {
    id: 'peoples_manager',
    name: "The People's Manager",
    tagline: 'Players get better here. That is the whole pitch.',
    description:
      'Every young player who has worked with her has improved, and most of them still call. What she cannot do is sit across a table from an agent and win, which is why the good ones keep leaving for money she was never going to find.',
    modifiers: {
      playerDevelopment: 20, motivation: 14, mediaHandling: 8,
      negotiation: -16, riskTolerance: -10, tacticalKnowledge: -8, brandBuilding: -8,
    },
    strength: 'The best development environment in the game.',
    weakness: 'Gets beaten in every negotiation and hesitates when boldness is required.',
    accent: '#fbbf24',
  },
  {
    id: 'entrepreneur',
    name: 'The Entrepreneur',
    tagline: 'Runs the club like a business. Because it is one.',
    description:
      'Treats a transfer window as a trading book and a sponsor meeting as the real fixture. Balance sheets improve dramatically. Whether the football does is, in his own words, a separate question.',
    modifiers: {
      negotiation: 24, brandBuilding: 20,
      playerDevelopment: -16, tacticalKnowledge: -10, motivation: -8, scouting: -6, discipline: -4,
    },
    strength: 'Buys low, sells high, and lands sponsorship tiers above the club\'s station.',
    weakness: 'Players stagnate, the squad senses it is an asset class, and the football drifts.',
    accent: '#C9A227',
  },
];

export const ARCHETYPE_BY_ID: ReadonlyMap<string, ManagerArchetype> = new Map(
  MANAGER_ARCHETYPES.map((a) => [a.id, a]),
);

/**
 * The ten pre-made managers offered at save creation. Each one is a legible
 * person rather than a stat preset: the bio tells you what your season will
 * feel like before you read a single modifier.
 */
export const PREMADE_MANAGERS: readonly ManagerTemplate[] = [
  {
    id: 'manager_vera_lindqvist',
    name: 'Vera Lindqvist',
    archetypeId: 'tactician',
    bio: 'Spent nine years as an assistant because no board believed a coach that quiet could lead. Turned a mid-table side into the meanest defensive unit in the competition inside one season and gave a total of four interviews doing it.',
    mediaStyle: 'GUARDED',
    socialPersonality: 'QUIET',
    appearance: { skinTone: 2, hairStyle: 'short_crop', hairColor: 'ash', facialHair: 'none', outfit: 'technical_coat', accessory: 'notebook', accentColor: '#7C8CFF' },
    selectable: true,
  },
  {
    id: 'manager_dez_kavanagh',
    name: 'Dez Kavanagh',
    archetypeId: 'motivator',
    bio: 'Played four hundred games in the lower leagues and manages exactly like he played: loud, honest, and completely allergic to a settled scoreline. Has never once conceded that a match was over.',
    mediaStyle: 'HONEST',
    socialPersonality: 'ACTIVE',
    appearance: { skinTone: 1, hairStyle: 'buzz', hairColor: 'grey', facialHair: 'stubble', outfit: 'training_kit', accessory: 'whistle', accentColor: '#34d399' },
    selectable: true,
  },
  {
    id: 'manager_bobby_sarkis',
    name: 'Bobby Sarkis',
    archetypeId: 'showman',
    bio: 'Arrived from broadcasting with no coaching badges and a following bigger than the league\'s. Sold out three away ends in a month, doubled the merchandise line, and has already had two players suspended for things they posted.',
    mediaStyle: 'CHARMING',
    socialPersonality: 'VIRAL',
    appearance: { skinTone: 3, hairStyle: 'swept_back', hairColor: 'black', facialHair: 'goatee', outfit: 'designer_coat', accessory: 'tinted_glasses', accentColor: '#FF2FA0' },
    selectable: true,
  },
  {
    id: 'manager_ines_moreau',
    name: 'Ines Moreau',
    archetypeId: 'data_nerd',
    bio: 'Built the recruitment model that three clubs in this league are still quietly running. Signs players from divisions nobody scouts and is completely unmoved when the press call each one a mistake for the first eleven weeks.',
    mediaStyle: 'ANALYTICAL',
    socialPersonality: 'QUIET',
    appearance: { skinTone: 2, hairStyle: 'tied_back', hairColor: 'auburn', facialHair: 'none', outfit: 'quarter_zip', accessory: 'tablet', accentColor: '#1E4FE0' },
    selectable: true,
  },
  {
    id: 'manager_kit_marlow',
    name: 'Kit Marlow',
    archetypeId: 'gambler',
    bio: 'Once made all five substitutions before half-time and won. Has also lost 6-1 twice in a season. Believes, sincerely and without evidence, that the safe option has never won anybody anything.',
    mediaStyle: 'COMBATIVE',
    socialPersonality: 'PROVOCATEUR',
    appearance: { skinTone: 1, hairStyle: 'messy', hairColor: 'blond', facialHair: 'stubble', outfit: 'bomber_jacket', accessory: 'chewing_gum', accentColor: '#f4525a' },
    selectable: true,
  },
  {
    id: 'manager_aurel_stanek',
    name: 'Aurel Stanek',
    archetypeId: 'disciplinarian',
    bio: 'Publishes the standards on the dressing-room wall on day one and enforces every line of them. Two clubs have sacked him for being impossible. Both improved under him first and declined the moment he left.',
    mediaStyle: 'GUARDED',
    socialPersonality: 'QUIET',
    appearance: { skinTone: 2, hairStyle: 'side_part', hairColor: 'dark', facialHair: 'none', outfit: 'suit', accessory: 'clipboard', accentColor: '#9aa3ad' },
    selectable: true,
  },
  {
    id: 'manager_mabel_osei',
    name: 'Mabel Osei',
    archetypeId: 'peoples_manager',
    bio: 'Nineteen of the players she has coached are still in the game, and eleven of them phone her. Loses every negotiation she enters because she cannot bring herself to lie about what a player is worth.',
    mediaStyle: 'HONEST',
    socialPersonality: 'ACTIVE',
    appearance: { skinTone: 5, hairStyle: 'braids', hairColor: 'black', facialHair: 'none', outfit: 'club_jacket', accessory: 'lanyard', accentColor: '#fbbf24' },
    selectable: true,
  },
  {
    id: 'manager_rafe_dunmore',
    name: 'Rafe Dunmore',
    archetypeId: 'entrepreneur',
    bio: 'Came from the commercial side and has never pretended otherwise. Turned a squad with no money into a profitable trading operation and a fanbase into a customer list, and is genuinely puzzled that the terraces resent it.',
    mediaStyle: 'CHARMING',
    socialPersonality: 'ACTIVE',
    appearance: { skinTone: 2, hairStyle: 'short_neat', hairColor: 'brown', facialHair: 'none', outfit: 'tailored_coat', accessory: 'signet_ring', accentColor: '#C9A227' },
    selectable: true,
  },
  {
    id: 'manager_noor_latimer',
    name: 'Noor Latimer',
    archetypeId: 'tactician',
    bio: 'Younger than half her squad and out-thinks all of them. Runs three distinct systems in one match and expects everybody to keep up, which is thrilling when it works and chaos when it does not.',
    mediaStyle: 'ANALYTICAL',
    socialPersonality: 'ACTIVE',
    appearance: { skinTone: 3, hairStyle: 'bob', hairColor: 'black', facialHair: 'none', outfit: 'technical_coat', accessory: 'earpiece', accentColor: '#7FD4C1' },
    selectable: true,
  },
  {
    id: 'manager_sten_bjornsen',
    name: 'Sten Bjornsen',
    archetypeId: 'disciplinarian',
    bio: 'Thirty-one years in the game and a squad list pinned up at seven in the morning. Does not care what anybody posts, does not read anything, and has produced the three most professional players in this competition.',
    mediaStyle: 'GUARDED',
    socialPersonality: 'QUIET',
    appearance: { skinTone: 1, hairStyle: 'thinning', hairColor: 'white', facialHair: 'beard', outfit: 'padded_coat', accessory: 'thermos', accentColor: '#B9C2CE' },
    selectable: true,
  },
];

/* --------------------------------------------------------------- generator */

export interface GenerateManagerOptions {
  readonly archetypeId?: string;
  readonly name?: string;
  readonly template?: ManagerTemplate;
  readonly isPlayer?: boolean;
  readonly clubId?: ClubId | null;
  readonly id?: ManagerId;
  readonly idPrefix?: string;
  readonly reputation?: number;
  /** 0-1: how far the attributes sit above the 50 baseline before archetype deltas. */
  readonly quality?: number;
  readonly identityKind?: IdentityKind;
  readonly creatorId?: string;
  readonly mediaStyle?: MediaStyle;
  readonly socialPersonality?: SocialPersonality;
  readonly bio?: string;
  /** Where an unnamed manager's name comes from. Content is handed in; the generator imports none. */
  readonly nameBank: NameBankDef;
}

const HAIR_STYLES = ['short_crop', 'buzz', 'swept_back', 'tied_back', 'messy', 'side_part', 'braids', 'short_neat', 'bob', 'thinning', 'curls', 'shaved'];
const HAIR_COLORS = ['black', 'dark', 'brown', 'auburn', 'blond', 'grey', 'ash', 'white'];
const FACIAL_HAIR = ['none', 'none', 'stubble', 'beard', 'goatee', 'moustache'];
const OUTFITS = ['technical_coat', 'training_kit', 'suit', 'quarter_zip', 'club_jacket', 'bomber_jacket', 'padded_coat', 'tailored_coat'];
const ACCESSORIES = ['none', 'notebook', 'whistle', 'clipboard', 'tablet', 'lanyard', 'earpiece', 'tinted_glasses', 'thermos', 'chewing_gum'];
const MEDIA_STYLES: readonly MediaStyle[] = ['GUARDED', 'HONEST', 'COMBATIVE', 'CHARMING', 'ANALYTICAL'];
const SOCIAL_PERSONALITIES: readonly SocialPersonality[] = ['QUIET', 'ACTIVE', 'VIRAL', 'PROVOCATEUR'];

const appearanceFrom = (
  rng: Rng,
  source: Readonly<Record<string, string | number>> | undefined,
  accent: string,
): ManagerAppearance => ({
  skinTone: typeof source?.skinTone === 'number' ? source.skinTone : rng.int(1, 6),
  hairStyle: typeof source?.hairStyle === 'string' ? source.hairStyle : rng.pick(HAIR_STYLES),
  hairColor: typeof source?.hairColor === 'string' ? source.hairColor : rng.pick(HAIR_COLORS),
  facialHair: typeof source?.facialHair === 'string' ? source.facialHair : rng.pick(FACIAL_HAIR),
  outfit: typeof source?.outfit === 'string' ? source.outfit : rng.pick(OUTFITS),
  accessory: typeof source?.accessory === 'string' ? source.accessory : rng.pick(ACCESSORIES),
  accentColor: typeof source?.accentColor === 'string' ? source.accentColor : accent,
});

function attributesFor(
  rng: Rng,
  archetype: ManagerArchetype | undefined,
  quality: number,
  spread: number,
  overrides: Readonly<Record<string, number>> | undefined,
): ManagerAttributes {
  const cfg = GENERATION_BALANCE.manager;
  const base = cfg.attributeBase + (quality - 0.5) * 34;
  const out = emptyManagerAttributes();
  for (const key of MANAGER_ATTRIBUTE_KEYS) {
    const override = overrides?.[key];
    if (typeof override === 'number') { out[key] = clamp(Math.round(override), 1, 99); continue; }
    const delta = archetype?.modifiers[key as ManagerAttributeKey] ?? 0;
    out[key] = clamp(Math.round(rng.normal(base + delta, spread)), 1, 99);
  }
  return out;
}

export function generateManager(rng: Rng, opts: GenerateManagerOptions): Manager {
  const template = opts.template;
  const archetypeId = opts.archetypeId ?? template?.archetypeId
    ?? rng.pick(MANAGER_ARCHETYPES).id;
  const archetype = ARCHETYPE_BY_ID.get(archetypeId);

  const bank = opts.nameBank;
  const name = opts.name ?? template?.name ?? [
    rng.weighted(bank.firstNames, (n) => n.weight ?? 1).value,
    rng.weighted(bank.lastNames, (n) => n.weight ?? 1).value,
  ].join(' ');

  const spread = template ? GENERATION_BALANCE.manager.premadeSpread : GENERATION_BALANCE.manager.attributeSpread;
  const attributes = attributesFor(rng, archetype, opts.quality ?? 0.5, spread, template?.attributes);

  const id = opts.id ?? asId<ManagerId>(
    `${opts.idPrefix ?? 'gm'}_${rng.int(0, 0x7fffffff).toString(36)}`,
  );

  return {
    id,
    identityKind: opts.identityKind ?? 'FICTIONAL',
    name,
    isPlayer: opts.isPlayer ?? false,
    archetypeId,
    attributes,
    appearance: appearanceFrom(rng, template?.appearance, archetype?.accent ?? '#C8FF2E'),
    mediaStyle: opts.mediaStyle
      ?? (template?.mediaStyle as MediaStyle | undefined)
      ?? rng.pick(MEDIA_STYLES),
    socialPersonality: opts.socialPersonality
      ?? (template?.socialPersonality as SocialPersonality | undefined)
      ?? rng.pick(SOCIAL_PERSONALITIES),
    clubId: opts.clubId ?? null,
    reputation: opts.reputation ?? clamp(Math.round(rng.normal(45, 14)), 1, 100),
    careerWins: 0,
    careerDraws: 0,
    careerLosses: 0,
    trophies: [],
    ...(opts.creatorId ?? template?.creatorTemplateId
      ? { creatorId: (opts.creatorId ?? template?.creatorTemplateId) as string }
      : {}),
    bio: opts.bio ?? template?.bio ?? 'A coach still writing the first line of a career.',
  };
}
