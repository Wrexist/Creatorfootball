import type { ClubTemplate } from '../../schema';

/**
 * The twelve clubs of the base league.
 *
 * The league is deliberately built on one tension: six institutions that were
 * playing football long before anybody filmed it, and six clubs that exist
 * because somebody with an audience decided they should. That fault line
 * supplies the rivalries, the media stories and the fan-culture friction for
 * free — the old clubs think the new ones bought their way in, and the new ones
 * think the old ones would have died without them.
 *
 * Strength is spread on purpose: Marrowgate is a clear favourite, four clubs
 * can realistically challenge, five sit in a genuine mid-table scrap, and two
 * are in trouble from matchday one.
 *
 * Everything here is original fiction. No club, city, ground, motto or crest
 * motif refers to, puns on or is decodable as any real club or place.
 */

/** Prose identity for each club, surfaced on the club screen and in media copy. */
export const CLUB_LORE: Readonly<Record<string, string>> = {
  club_ironhollow_forge:
    'The Forge was founded by furnace crews who finished a shift and walked straight to the pitch, and it has never entirely stopped behaving like that. Ironhollow defends like the result is a debt being collected: deep, mean, unglamorous, and absolutely furious about being called boring. The Foundry Yard is three sides of terrace and one side of corrugated wall, and the North Terrace sings a single dirge for ninety of the thirty available minutes. The board has turned down two takeovers on principle and one on price. They are not the best team in this league. They are the one nobody wants to draw.',
  club_saltpine_harbour:
    'Saltpine are the club your grandmother supported and your neighbours run. Tidewall Arena sits close enough to the water that the away end smells of it, and the club still hands out free tickets to anyone under twelve who can name the back four. They have no money, an excellent youth coach who keeps turning down bigger jobs, and a squad assembled almost entirely from released prospects and people who wanted to move home. Every season starts with a survival speech and ends, somehow, with survival.',
  club_marrowgate_athletic:
    'Marrowgate have been the biggest club in this region since before anybody thought to write it down, and they would like that acknowledged, please, at every opportunity. They spend more than anyone, win more than anyone, and are loathed with a warmth the smaller clubs reserve for family. The Pavilion has a members\' balcony, a dress code nobody enforces and a trophy room with a queue. Their problem is not talent; it is that a squad this expensive has never once been allowed a bad month.',
  club_duskford_rovers:
    'Duskford sell their best player every single year and produce another one every single year, and the fans have made a strange, defiant peace with it. The academy at Duskford is a genuine production line — sixteen-year-olds are given the ball and told to make mistakes with it — and the first team is consequently thrilling, brittle and about four years too young. The Old Signal Box holds under seven thousand and every one of them can tell you the birthday of a lad who has not debuted yet.',
  club_cinderwick_town:
    'Cinderwick are in trouble and everyone knows it. The ground needs work the club cannot pay for, the squad is a decade older than it should be, and the only reason the doors are still open is a volunteer committee who treat the accounts like a hostage negotiation. What Cinderwick have is Cinder Field on a cold night, a supporter base that has never once left early, and a habit of taking points off clubs who came expecting three. They are the sentimental favourite of every neutral and the nightmare of every table.',
  club_verrow_wanderers:
    'The oldest club in the league and the one most convinced this whole thing is a phase. Verrow field the most experienced squad in the competition, play at a tempo that infuriates younger sides, and win an alarming number of matches by refusing to let anything happen. The Assembly Rooms are half stadium and half debating society: the club is member-run, the AGM runs to four hours, and every proposal to modernise anything is defeated by roughly the same margin every year.',
  club_neon_row_fc:
    'Neon Row were built in eleven weeks by a creator collective who could not get a slot in an existing club and decided to buy one instead. They train in public, film everything, and treat a Tuesday session as a broadcast. The Row is a converted market hall with a standing floor and a lighting rig that costs more than their goalkeeper. The football is genuinely good — they recruit ruthlessly and pay well — but the club\'s actual product is the noise around it, and everybody in the building knows which one pays the bills.',
  club_vantage_point_fc:
    'Vantage Point were founded on the argument that everyone else is guessing. They recruit by model, set tactics by model, and have publicly ranked their own supporters by expected lifetime value, which went about as well as you would expect. The Grid is clean, cold and full of screens. Their analysts are the best in the league and their squad is a set of specific, unglamorous edges stitched together — a keeper who is elite at exactly one thing, a midfielder nobody else rated. When it works it looks inevitable. When it fails it looks smug.',
  club_redmere_republic:
    'Redmere is owned by eleven thousand people who each paid what they could and get one vote regardless. Common Ground was crowdfunded, built partly by volunteers and named by a members\' ballot that took three rounds. The squad is cheap because the wage structure is published and nobody is allowed to break it. What Redmere have instead of money is the loudest away following in the league and a genuine, unfakeable sense that the club belongs to the people in it — which is exactly the thing every other club in this competition is trying to buy.',
  club_aurelia_sc:
    'Aurelia were founded by a fashion house that wanted a football club the way it wanted a fragrance line, and they have been startlingly good at it. The kits sell out globally, the Atrium has a restaurant with a waiting list, and the squad is assembled with the same instinct as a runway: expensive, beautiful, occasionally structurally unsound. Rival supporters call them a brand activation. Aurelia\'s response is that everything is, and theirs is better lit.',
  club_larkspur_wolves:
    'Larkspur have finished mid-table for most of their existence and have never once been accused of being dull. The instruction from the dugout has been the same for sixty years — go and entertain them — and the club has cheerfully accepted every consequence, including conceding more goals than anyone except the two clubs being relegated. The Den is a wall of noise and amber, the ultras march from the same pub they have used since 1957, and the club shop sells a shirt commemorating a 5-4 defeat.',
  club_ember_nine:
    'Ember Nine exists because a club died and somebody with an audience refused to let it stay dead. When the old Emberfield side folded, a streamer bought the name, the badge and the debt, and rebuilt it in public — every board meeting, every rejected transfer, every argument with the council about the pitch. The Nine Yard holds under six thousand and sells out on sentiment. The squad is young, cheap and improbably well-drilled, and the supporters are split down the middle between people who were there before and people who found it on a screen.',
};

export const BASE_CLUBS: readonly ClubTemplate[] = [
  {
    id: 'club_marrowgate_athletic',
    name: 'Marrowgate Athletic',
    shortName: 'Marrowgate',
    abbreviation: 'MGA',
    city: 'Marrowgate',
    founded: 1881,
    philosophy: 'BIG_SPENDERS',
    fanCulture: 'TRADITIONAL',
    reputation: 88,
    strength: 86,
    budget: 9_600_000,
    stadiumName: 'Marrowgate Pavilion',
    stadiumCapacity: 14_500,
    visual: {
      primary: '#123B2E', secondary: '#C9A227', accent: '#F4F1E6',
      badgeShape: 'CREST', badgeMotif: 'LION', style: 'CLASSIC', kitPattern: 'SOLID',
    },
    aiProfileId: 'BIG_SPENDERS',
    motto: 'Ours by right.',
    rivalOf: ['club_verrow_wanderers', 'club_aurelia_sc'],
  },
  {
    id: 'club_neon_row_fc',
    name: 'Neon Row FC',
    shortName: 'Neon Row',
    abbreviation: 'NRW',
    city: 'Lowmarket',
    founded: 2021,
    philosophy: 'CREATOR_FIRST',
    fanCulture: 'ONLINE_NATIVE',
    reputation: 81,
    strength: 79,
    budget: 6_400_000,
    stadiumName: 'The Row',
    stadiumCapacity: 11_200,
    visual: {
      primary: '#0B0B10', secondary: '#FF2FA0', accent: '#C8FF2E',
      badgeShape: 'HEX', badgeMotif: 'BOLT', style: 'STREET', kitPattern: 'GRADIENT',
    },
    aiProfileId: 'CREATOR_CLUB',
    motto: 'Post it or it did not happen.',
    rivalOf: ['club_ironhollow_forge', 'club_vantage_point_fc'],
  },
  {
    id: 'club_vantage_point_fc',
    name: 'Vantage Point FC',
    shortName: 'Vantage',
    abbreviation: 'VPT',
    city: 'Halcyon Reach',
    founded: 2022,
    philosophy: 'DATA_DRIVEN',
    fanCulture: 'BANDWAGON',
    reputation: 72,
    strength: 77,
    budget: 5_100_000,
    stadiumName: 'The Grid',
    stadiumCapacity: 9_800,
    visual: {
      primary: '#F7F9FC', secondary: '#1E4FE0', accent: '#10131A',
      badgeShape: 'DIAMOND', badgeMotif: 'STAR', style: 'MINIMAL', kitPattern: 'SOLID',
    },
    aiProfileId: 'ANALYTICS',
    motto: 'The numbers were always going to win.',
    rivalOf: ['club_neon_row_fc'],
  },
  {
    id: 'club_aurelia_sc',
    name: 'Aurelia Sporting Club',
    shortName: 'Aurelia',
    abbreviation: 'AUR',
    city: 'Aurelia',
    founded: 2023,
    philosophy: 'BIG_SPENDERS',
    fanCulture: 'BANDWAGON',
    reputation: 76,
    strength: 74,
    budget: 8_200_000,
    stadiumName: 'The Atrium',
    stadiumCapacity: 12_600,
    visual: {
      primary: '#F3ECE0', secondary: '#6E2F6B', accent: '#D8B24A',
      badgeShape: 'CREST', badgeMotif: 'CROWN', style: 'MINIMAL', kitPattern: 'SOLID',
    },
    aiProfileId: 'BIG_SPENDERS',
    motto: 'Taste is a strategy.',
    rivalOf: ['club_redmere_republic', 'club_marrowgate_athletic'],
  },
  {
    id: 'club_ironhollow_forge',
    name: 'Ironhollow Forge',
    shortName: 'Ironhollow',
    abbreviation: 'IHF',
    city: 'Ironhollow',
    founded: 1898,
    philosophy: 'DEFENSIVE_ROCK',
    fanCulture: 'ULTRAS',
    reputation: 64,
    strength: 72,
    budget: 3_600_000,
    stadiumName: 'The Foundry Yard',
    stadiumCapacity: 9_400,
    visual: {
      primary: '#2E3238', secondary: '#E2570F', accent: '#F0B429',
      badgeShape: 'SHIELD', badgeMotif: 'HAMMER', style: 'RETRO', kitPattern: 'STRIPES',
    },
    aiProfileId: 'DEFENSIVE_SPECIALISTS',
    motto: 'Struck, not broken.',
    rivalOf: ['club_cinderwick_town', 'club_neon_row_fc'],
  },
  {
    id: 'club_verrow_wanderers',
    name: 'Verrow Wanderers',
    shortName: 'Verrow',
    abbreviation: 'VRW',
    city: 'Verrow',
    founded: 1876,
    philosophy: 'VETERAN_CORE',
    fanCulture: 'TRADITIONAL',
    reputation: 68,
    strength: 70,
    budget: 3_200_000,
    stadiumName: 'The Assembly Rooms',
    stadiumCapacity: 8_100,
    visual: {
      primary: '#1B2445', secondary: '#B9C2CE', accent: '#7C8CFF',
      badgeShape: 'CREST', badgeMotif: 'COMPASS', style: 'CLASSIC', kitPattern: 'STRIPES',
    },
    aiProfileId: 'VETERAN_CORE',
    motto: 'Older than the argument.',
    rivalOf: ['club_marrowgate_athletic'],
  },
  {
    id: 'club_larkspur_wolves',
    name: 'Larkspur Wolves',
    shortName: 'Larkspur',
    abbreviation: 'LKW',
    city: 'Larkspur',
    founded: 1957,
    philosophy: 'ENTERTAINERS',
    fanCulture: 'ULTRAS',
    reputation: 58,
    strength: 68,
    budget: 2_800_000,
    stadiumName: 'The Den',
    stadiumCapacity: 8_600,
    visual: {
      primary: '#4A5568', secondary: '#F2A413', accent: '#1A1D22',
      badgeShape: 'HEX', badgeMotif: 'WOLF', style: 'BOLD', kitPattern: 'HOOPS',
    },
    aiProfileId: 'SHOWTIME',
    motto: 'Give them something to talk about.',
    rivalOf: ['club_duskford_rovers', 'club_ember_nine'],
  },
  {
    id: 'club_duskford_rovers',
    name: 'Duskford Rovers',
    shortName: 'Duskford',
    abbreviation: 'DFR',
    city: 'Duskford',
    founded: 1911,
    philosophy: 'YOUTH_ACADEMY',
    fanCulture: 'DIEHARD',
    reputation: 55,
    strength: 66,
    budget: 2_400_000,
    stadiumName: 'The Old Signal Box',
    stadiumCapacity: 6_800,
    visual: {
      primary: '#6B1A34', secondary: '#8FCBEF', accent: '#F2E9DC',
      badgeShape: 'SHIELD', badgeMotif: 'TOWER', style: 'RETRO', kitPattern: 'HALVES',
    },
    aiProfileId: 'YOUTH_FACTORY',
    motto: 'Built here. Kept as long as we can.',
    rivalOf: ['club_saltpine_harbour', 'club_larkspur_wolves'],
  },
  {
    id: 'club_saltpine_harbour',
    name: 'Saltpine Harbour',
    shortName: 'Saltpine',
    abbreviation: 'SPH',
    city: 'Saltpine',
    founded: 1904,
    philosophy: 'LOCAL_ROOTS',
    fanCulture: 'FAMILY',
    reputation: 49,
    strength: 64,
    budget: 2_000_000,
    stadiumName: 'Tidewall Arena',
    stadiumCapacity: 7_200,
    visual: {
      primary: '#1D6FA8', secondary: '#F2F5F7', accent: '#7FD4C1',
      badgeShape: 'CIRCLE', badgeMotif: 'ANCHOR', style: 'CLASSIC', kitPattern: 'HOOPS',
    },
    aiProfileId: 'LOCAL_UNDERDOG',
    motto: 'The tide comes back.',
    rivalOf: ['club_duskford_rovers'],
  },
  {
    id: 'club_redmere_republic',
    name: 'Redmere Republic',
    shortName: 'Redmere',
    abbreviation: 'RDR',
    city: 'Redmere',
    founded: 2019,
    philosophy: 'YOUTH_ACADEMY',
    fanCulture: 'DIEHARD',
    reputation: 46,
    strength: 62,
    budget: 1_500_000,
    stadiumName: 'Common Ground',
    stadiumCapacity: 6_200,
    visual: {
      primary: '#8C1C13', secondary: '#EFE7D8', accent: '#3F7D63',
      badgeShape: 'SHIELD', badgeMotif: 'SERPENT', style: 'BOLD', kitPattern: 'SASH',
    },
    aiProfileId: 'YOUTH_FACTORY',
    motto: 'Owned by the people who turn up.',
    rivalOf: ['club_aurelia_sc'],
  },
  {
    id: 'club_ember_nine',
    name: 'Ember Nine',
    shortName: 'Ember',
    abbreviation: 'EM9',
    city: 'Emberfield',
    founded: 2020,
    philosophy: 'CREATOR_FIRST',
    fanCulture: 'ONLINE_NATIVE',
    reputation: 44,
    strength: 60,
    budget: 1_600_000,
    stadiumName: 'The Nine Yard',
    stadiumCapacity: 5_900,
    visual: {
      primary: '#221F2E', secondary: '#9B5DE5', accent: '#FF9F1C',
      badgeShape: 'DIAMOND', badgeMotif: 'PHOENIX', style: 'STREET', kitPattern: 'GRADIENT',
    },
    aiProfileId: 'CREATOR_CLUB',
    motto: 'Second life.',
    rivalOf: ['club_larkspur_wolves'],
  },
  {
    id: 'club_cinderwick_town',
    name: 'Cinderwick Town',
    shortName: 'Cinderwick',
    abbreviation: 'CWT',
    city: 'Cinderwick',
    founded: 1889,
    philosophy: 'LOCAL_ROOTS',
    fanCulture: 'FAMILY',
    reputation: 38,
    strength: 57,
    budget: 1_100_000,
    stadiumName: 'Cinder Field',
    stadiumCapacity: 5_600,
    visual: {
      primary: '#B32226', secondary: '#F6EEDC', accent: '#2B2B2B',
      badgeShape: 'CIRCLE', badgeMotif: 'FLAME', style: 'RETRO', kitPattern: 'SASH',
    },
    aiProfileId: 'LOCAL_UNDERDOG',
    motto: 'Still lit.',
    rivalOf: ['club_ironhollow_forge'],
  },
];

export const BASE_CLUB_IDS: readonly string[] = BASE_CLUBS.map((c) => c.id);

/**
 * AI strategy profile ids referenced by the base clubs. Workstream D owns the
 * profile *definitions*; this is the vocabulary the content pack commits to, so
 * a mismatch is caught by a test rather than by an AI club doing nothing.
 */
export const AI_PROFILE_IDS = [
  'YOUTH_FACTORY', 'BIG_SPENDERS', 'ANALYTICS', 'CREATOR_CLUB',
  'DEFENSIVE_SPECIALISTS', 'LOCAL_UNDERDOG', 'SHOWTIME', 'VETERAN_CORE',
] as const;
export type AiProfileId = (typeof AI_PROFILE_IDS)[number];
