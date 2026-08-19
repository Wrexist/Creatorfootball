import type {
  Club, ClubId, ClubVisualIdentity, ContractId, Creator, CreatorId, ManagerId, MatchEvent,
  NewsStory, Player, PlayerId, SocialPost, StandingRow,
} from '@cf/engine';
import { asId, emptyAttributes, emptyForm, emptyMental, emptyRecord, overallFor } from '@cf/engine';
import { SeedStream } from './seed';

/**
 * Fixtures for the component gallery ONLY.
 *
 * These are throwaway shapes invented to exercise every visual state — they are
 * not content, they are not balanced, and nothing outside `Gallery.tsx` may
 * import them. Real content lives in the engine's content packs.
 */

/* --- twelve visually distinct club identities ------------------------- */

export const GALLERY_IDENTITIES: readonly { name: string; short: string; abbr: string; visual: ClubVisualIdentity }[] = [
  {
    name: 'Ashvale Phoenix', short: 'Ashvale', abbr: 'ASH',
    visual: { primary: '#d5442f', secondary: '#2a0f0a', accent: '#ffb347', badgeShape: 'SHIELD', badgeMotif: 'PHOENIX', style: 'CLASSIC', kitPattern: 'SOLID' },
  },
  {
    name: 'Northgate Wolves', short: 'Northgate', abbr: 'NGW',
    visual: { primary: '#1f2a44', secondary: '#8794b5', accent: '#e8edf7', badgeShape: 'CREST', badgeMotif: 'WOLF', style: 'MODERN', kitPattern: 'STRIPES' },
  },
  {
    name: 'Port Meridian', short: 'Meridian', abbr: 'PTM',
    visual: { primary: '#0f6b6b', secondary: '#f0efe6', accent: '#ffd76a', badgeShape: 'CIRCLE', badgeMotif: 'ANCHOR', style: 'RETRO', kitPattern: 'HOOPS' },
  },
  {
    name: 'Kingsway Royals', short: 'Kingsway', abbr: 'KWR',
    visual: { primary: '#4b2a86', secondary: '#241246', accent: '#f5d76e', badgeShape: 'SHIELD', badgeMotif: 'CROWN', style: 'CLASSIC', kitPattern: 'HALVES' },
  },
  {
    name: 'Voltaic Athletic', short: 'Voltaic', abbr: 'VLT',
    visual: { primary: '#101418', secondary: '#1d2329', accent: '#c8ff2e', badgeShape: 'HEX', badgeMotif: 'BOLT', style: 'BOLD', kitPattern: 'SASH' },
  },
  {
    name: 'Solstice United', short: 'Solstice', abbr: 'SOL',
    visual: { primary: '#e4a11b', secondary: '#5c3a06', accent: '#2a1b02', badgeShape: 'CIRCLE', badgeMotif: 'STAR', style: 'MINIMAL', kitPattern: 'GRADIENT' },
  },
  {
    name: 'Ironvale Lions', short: 'Ironvale', abbr: 'IVL',
    visual: { primary: '#8a1c2b', secondary: '#e7d9c3', accent: '#f5c14b', badgeShape: 'CREST', badgeMotif: 'LION', style: 'CLASSIC', kitPattern: 'SOLID' },
  },
  {
    name: 'Beacon Hill FC', short: 'Beacon', abbr: 'BHF',
    visual: { primary: '#2f6f3e', secondary: '#0f2a17', accent: '#eaf7e4', badgeShape: 'SHIELD', badgeMotif: 'TOWER', style: 'RETRO', kitPattern: 'STRIPES' },
  },
  {
    name: 'Cobra Street', short: 'Cobra', abbr: 'CBR',
    visual: { primary: '#141414', secondary: '#3a3a3a', accent: '#38e07b', badgeShape: 'DIAMOND', badgeMotif: 'SERPENT', style: 'STREET', kitPattern: 'HALVES' },
  },
  {
    name: 'Emberfield', short: 'Emberfield', abbr: 'EMB',
    visual: { primary: '#c2410c', secondary: '#1c0a03', accent: '#ffd9a0', badgeShape: 'HEX', badgeMotif: 'FLAME', style: 'MODERN', kitPattern: 'GRADIENT' },
  },
  {
    name: 'Truenorth Rovers', short: 'Truenorth', abbr: 'TNR',
    visual: { primary: '#123a6b', secondary: '#f4f6f8', accent: '#7ab8ff', badgeShape: 'CIRCLE', badgeMotif: 'COMPASS', style: 'MINIMAL', kitPattern: 'SASH' },
  },
  {
    name: 'Forge Rangers', short: 'Forge', abbr: 'FGR',
    visual: { primary: '#3f3f46', secondary: '#a1a1aa', accent: '#fb923c', badgeShape: 'DIAMOND', badgeMotif: 'HAMMER', style: 'BOLD', kitPattern: 'HOOPS' },
  },
];

/* --- players ---------------------------------------------------------- */

const FIRST = ['Kayo', 'Mattis', 'Ilyan', 'Bruno', 'Teodor', 'Ozzy', 'Ravi', 'Nils', 'Cass', 'Emeka', 'Dario', 'Sten'];
const LAST = ['Vantor', 'Okafor', 'Brekke', 'Mensah', 'Ilić', 'Ferreira', 'Halstead', 'Nordvik', 'Ayoub', 'Rask', 'Bellandi', 'Kovač'];

export interface MakePlayerOptions {
  seed: string;
  position?: Player['position'];
  overall?: number;
  injured?: boolean;
  suspended?: boolean;
  hot?: boolean;
  traitIds?: readonly string[];
}

export function makePlayer({
  seed, position = 'ST', overall = 78, injured = false, suspended = false, hot = false, traitIds,
}: MakePlayerOptions): Player {
  const s = new SeedStream(seed);
  const first = s.pick('first', FIRST);
  const last = s.pick('last', LAST);
  const attributes = emptyAttributes(overall - 8);
  // Nudge the position's weighted attributes up so `overallFor` lands near the
  // requested number and `keyAttributes` picks something sensible.
  const boosted = { ...attributes };
  for (const key of Object.keys(boosted) as (keyof typeof boosted)[]) {
    boosted[key] = Math.max(20, Math.min(99, Math.round(overall + s.range(`a-${key}`, -12, 12))));
  }

  return {
    id: asId<PlayerId>(`player-${seed}`),
    identityKind: 'FICTIONAL',
    firstName: first,
    lastName: last,
    displayName: `${first.charAt(0)}. ${last}`,
    shirtNumber: 1 + s.int('shirt', 30),
    age: 18 + s.int('age', 17),
    nationality: 'Valmara',
    position,
    secondaryPositions: [],
    footedness: s.chance('foot', 0.25) ? 'left' : 'right',
    height: 170 + s.int('height', 24),
    attributes: boosted,
    mental: emptyMental(60),
    traitIds: traitIds ?? (s.chance('trait', 0.7) ? ['clutch'] : []),
    overall: overallFor(boosted, position),
    potential: Math.min(99, overall + s.int('pot', 10)),
    clubId: asId<ClubId>('club-ash'),
    contractId: asId<ContractId>('contract-1'),
    fitness: injured ? 42 : 70 + s.int('fit', 30),
    injury: injured
      ? { severity: 'MODERATE', weeksRemaining: 3, description: 'Hamstring strain', sustainedCycle: 8 }
      : null,
    suspensionMatches: suspended ? 2 : 0,
    form: {
      ...emptyForm(),
      rating: hot ? 0.72 : s.range('form', -0.6, 0.6),
      appearances: 14,
      goals: 7,
      assists: 4,
      minutes: 980,
      recentRatings: [6.8, 7.4, 8.1, 6.2, 7.9],
    },
    history: [],
    marketValue: Math.round(overall ** 3 * 1.6),
    reputation: overall - 5,
    scouting: { confidence: 1, revealed: [] },
    portraitSeed: `portrait-${seed}`,
  };
}

export const GALLERY_PLAYERS: readonly Player[] = [
  makePlayer({ seed: 'a1', position: 'ST', overall: 91, hot: true, traitIds: ['natural_finisher', 'clutch'] }),
  makePlayer({ seed: 'b2', position: 'CAM', overall: 84, traitIds: ['playmaker'] }),
  makePlayer({ seed: 'c3', position: 'CB', overall: 76, injured: true }),
  makePlayer({ seed: 'd4', position: 'GK', overall: 71, traitIds: ['wall'] }),
  makePlayer({ seed: 'e5', position: 'LW', overall: 66, suspended: true }),
  makePlayer({ seed: 'f6', position: 'CDM', overall: 58 }),
];

/* --- club ------------------------------------------------------------- */

export function makeClub(index: number, isPlayerClub = false): Club {
  const identity = GALLERY_IDENTITIES[index % GALLERY_IDENTITIES.length];
  if (!identity) throw new Error('gallery identity missing');
  return {
    id: asId<ClubId>(`club-${index}`),
    name: identity.name,
    shortName: identity.short,
    abbreviation: identity.abbr,
    city: 'Ashvale',
    founded: 1902 + index,
    isPlayerClub,
    visual: identity.visual,
    philosophy: 'CREATOR_FIRST',
    fanCulture: 'ONLINE_NATIVE',
    reputation: 62,
    stadium: { name: 'The Vale', capacity: 24_500, quality: 68, atmosphere: 74, pitchQuality: 70 },
    fans: {
      sentiment: 71, trust: 64, excitement: 78, loyalty: 66, base: 184_000,
      expectation: 58, lastAttendance: 21_400, seasonTicketHolders: 12_800, onlineFollowers: 940_000,
    },
    finance: {
      wageBudgetPerCycle: 420_000, transferBudget: 8_400_000, ticketPrice: 28, merchPrice: 45,
      lastCycleIncome: 1_240_000, lastCycleExpenditure: 980_000, debt: 0,
    },
    managerId: asId<ManagerId>('manager-1'),
    squad: [],
    youthSquad: [],
    creatorIds: [],
    tactics: {} as Club['tactics'],
    facilityLevels: {},
    sponsorDealIds: [],
    rivalryIds: [],
    aiProfileId: null,
    seasonRecord: { played: 14, won: 8, drawn: 3, lost: 3, goalsFor: 31, goalsAgainst: 19 },
    allTimeRecord: emptyRecord(),
    motto: 'Rise from the ashes, every single week.',
  };
}

export const GALLERY_CLUBS: readonly Club[] = GALLERY_IDENTITIES.map((_, i) => makeClub(i, i === 0));

export const GALLERY_STANDINGS: readonly StandingRow[] = GALLERY_CLUBS.map((club, i) => ({
  clubId: club.id,
  position: i + 1,
  played: 14,
  won: 11 - i,
  drawn: 2,
  lost: i + 1,
  goalsFor: 38 - i * 2,
  goalsAgainst: 12 + i * 2,
  goalDifference: 26 - i * 4,
  points: Math.max(4, 35 - i * 3),
  form: (['W', 'W', 'D', 'L', 'W'] as const).slice(0, 5),
  zone: i === 0 ? 'CHAMPION' : i < 4 ? 'PLAYOFF' : i > 9 ? 'RELEGATION' : 'MID',
}));

/* --- creators --------------------------------------------------------- */

export const GALLERY_CREATORS: readonly Creator[] = [
  {
    id: asId<CreatorId>('creator-1'), identityKind: 'FICTIONAL', handle: '@voltkid', displayName: 'Volt Kid',
    roles: ['INFLUENCER', 'PUNDIT'], tier: 'GLOBAL', followers: 14_200_000,
    attributes: {
      audience: 94, engagement: 81, charisma: 88, controversy: 62, brandValue: 90, loyalty: 44,
      leadership: 58, entertainment: 92, mediaAbility: 76, fanConversion: 71, commercialAppeal: 89,
    },
    style: { tone: 'HYPE', platforms: ['SHORTFORM', 'STREAM'], postingFrequency: 6 },
    clubId: null, playerId: null, clubSentiment: 48, marketValue: 4_200_000,
    dealWeeksRemaining: null, avatarSeed: 'creator-volt',
    bio: 'Built a stadium-sized audience out of a bedroom mic and a refusal to ever be quiet.',
  },
  {
    id: asId<CreatorId>('creator-2'), identityKind: 'FICTIONAL', handle: '@thechalkboard', displayName: 'The Chalkboard',
    roles: ['PUNDIT'], tier: 'ESTABLISHED', followers: 820_000,
    attributes: {
      audience: 68, engagement: 74, charisma: 55, controversy: 22, brandValue: 61, loyalty: 78,
      leadership: 49, entertainment: 51, mediaAbility: 88, fanConversion: 64, commercialAppeal: 47,
    },
    style: { tone: 'ANALYTICAL', platforms: ['LONGFORM', 'PODCAST'], postingFrequency: 2 },
    clubId: null, playerId: null, clubSentiment: -12, marketValue: 640_000,
    dealWeeksRemaining: 9, avatarSeed: 'creator-chalk',
    bio: 'Will explain exactly why your press broke, whether or not you asked.',
  },
  {
    id: asId<CreatorId>('creator-3'), identityKind: 'FICTIONAL', handle: '@pitchside_mo', displayName: 'Pitchside Mo',
    roles: ['CLUB_PERSONALITY', 'PLAYER'], tier: 'RISING', followers: 96_000,
    attributes: {
      audience: 41, engagement: 88, charisma: 79, controversy: 35, brandValue: 38, loyalty: 91,
      leadership: 62, entertainment: 74, mediaAbility: 52, fanConversion: 82, commercialAppeal: 40,
    },
    style: { tone: 'WHOLESOME', platforms: ['SHORTFORM'], postingFrequency: 4 },
    clubId: asId<ClubId>('club-0'), playerId: asId<PlayerId>('player-a1'), clubSentiment: 86, marketValue: 120_000,
    dealWeeksRemaining: 22, avatarSeed: 'creator-mo',
    bio: 'Grew up on the terraces, now films the tunnel walk. Would run through a wall.',
  },
];

/* --- match, media, social --------------------------------------------- */

export const GALLERY_EVENTS: readonly MatchEvent[] = [
  {
    id: 'e1', type: 'GOAL', minute: 12, tick: 120, side: 'home', homeScore: 1, awayScore: 0,
    momentum: 0.42, importance: 5, xg: 0.31,
    text: 'Vantor gets across his marker and buries it at the near post.',
  },
  {
    id: 'e2', type: 'YELLOW_CARD', minute: 19, tick: 190, side: 'away', homeScore: 1, awayScore: 0,
    momentum: 0.28, importance: 3, text: 'Late on the follow-through — the referee has seen enough.',
  },
  {
    id: 'e3', type: 'SAVE', minute: 24, tick: 240, side: 'home', homeScore: 1, awayScore: 0,
    momentum: -0.16, importance: 4, xg: 0.44, text: 'Somehow kept out. Fingertips, crossbar, away.',
  },
  {
    id: 'e4', type: 'CREATOR_MOMENT', minute: 31, tick: 310, side: 'home', homeScore: 1, awayScore: 0,
    momentum: 0.34, importance: 3, text: 'The away end is being drowned out by a drum and a phone camera.',
  },
  {
    id: 'e5', type: 'GOAL', minute: 44, tick: 440, side: 'away', homeScore: 1, awayScore: 1,
    momentum: -0.51, importance: 5, xg: 0.19, text: 'Against the run of play, and it is a beauty.',
  },
  {
    id: 'e6', type: 'SUBSTITUTION', minute: 58, tick: 580, side: 'home', homeScore: 1, awayScore: 1,
    momentum: 0.02, importance: 2, text: 'Fresh legs for the last half hour.',
  },
];

export const GALLERY_STORIES: readonly NewsStory[] = [
  {
    id: 'n1', headline: 'Ashvale hold their nerve as the title race narrows to three',
    body: 'A point apiece leaves the top of the table unchanged, but the mood around the Vale has shifted. Three fixtures in eleven days will settle it.',
    outlet: 'The Vale Dispatch', cycle: 14, importance: 5, sentiment: 0.2,
    entities: [], tags: ['title race'], imageSeed: 'story-1', read: false,
  },
  {
    id: 'n2', headline: 'Board approves training-ground expansion',
    body: 'Work begins in the summer, with the medical wing first in line.',
    outlet: 'Club Statement', cycle: 13, importance: 2, sentiment: 0.5,
    entities: [], tags: ['facilities'], read: true,
  },
  {
    id: 'n3', headline: '“We were second to everything” — a bruising night at Northgate',
    body: 'No excuses offered afterwards, and none were available.',
    outlet: 'Matchday Wire', cycle: 12, importance: 4, sentiment: -0.6,
    entities: [], tags: ['reaction'], imageSeed: 'story-3', read: true,
  },
];

export const GALLERY_POSTS: readonly SocialPost[] = [
  {
    id: 'p1', kind: 'CREATOR', authorName: 'Volt Kid', authorHandle: '@voltkid',
    avatarSeed: 'creator-volt', verified: true,
    text: 'that near-post finish is the most confident thing anyone has done at this club in two years. no notes.',
    cycle: 14, likes: 48_200, reposts: 6_100, replies: 1_240, sentiment: 0.8, weight: 0.85,
    entities: [], tags: ['goal'],
  },
  {
    id: 'p2', kind: 'RIVAL', authorName: 'Northgate Til I Die', authorHandle: '@ngw_forever',
    avatarSeed: 'fan-ngw', verified: false,
    text: 'one good half and they think they are back. see you in April.',
    cycle: 14, likes: 890, reposts: 44, replies: 310, sentiment: -0.7, weight: 0.4,
    entities: [], tags: ['derby'],
    quoted: { authorName: 'Volt Kid', text: 'that near-post finish is the most confident thing…' },
  },
  {
    id: 'p3', kind: 'FAN', authorName: 'Row Z Regular', authorHandle: '@rowz',
    avatarSeed: 'fan-rowz', verified: false,
    text: 'ticket prices up again but I will still be there. obviously.',
    cycle: 14, likes: 122, reposts: 3, replies: 18, sentiment: -0.1, weight: 0.2,
    entities: [], tags: [],
  },
];
