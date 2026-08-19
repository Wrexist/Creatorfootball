import type { FacilityDef } from '../../schema';

/**
 * The eleven club facilities.
 *
 * Levels run 0-5. Level 0 means the facility genuinely does not exist — a club
 * with no creator studio and no analytics department is a real starting state,
 * and the first upgrade in those lines is the largest single jump in the game.
 *
 * Array conventions, relied on by facilities/facilities.ts:
 *   upgradeCosts[i]     cost of moving from level i to level i+1  (length 5)
 *   upgradeCycles[i]    cycles that upgrade takes                  (length 5)
 *   upkeepPerCycle[l]   upkeep while AT level l                    (length 6)
 *   levelEffects[l]     one-line description of level l            (length 6)
 *   effects[key][l]     machine-readable value at level l          (length 6)
 *
 * Effect values are multipliers around 1.0 unless noted, so a system reading an
 * unknown facility can safely default to 1 and behave sanely.
 */
export const BASE_FACILITIES: readonly FacilityDef[] = [
  {
    id: 'facility_stadium',
    name: 'Stadium',
    description: 'Seats, roof, and the acoustics that decide whether an away side can hear itself think.',
    icon: 'stadium',
    maxLevel: 5,
    category: 'FAN',
    upgradeCosts: [180_000, 620_000, 1_500_000, 3_400_000, 7_200_000],
    upgradeCycles: [2, 3, 4, 5, 6],
    upkeepPerCycle: [1_800, 4_200, 8_400, 15_000, 26_000, 42_000],
    levelEffects: [
      'A pitch, a fence and a portable stand.',
      'Terracing on three sides and a roof over one of them.',
      'Permanent seating, working floodlights, a covered away end.',
      'Expanded stands and a tunnel the broadcast can actually use.',
      'Two tiers, hospitality, and a wall of noise on the near side.',
      'A purpose-built short-format arena that other clubs ask to borrow.',
    ],
    effects: {
      stadiumCapacity: [0.55, 0.75, 1.0, 1.3, 1.65, 2.1],
      matchdayRevenue: [0.6, 0.8, 1.0, 1.22, 1.5, 1.85],
      atmosphere: [0.7, 0.85, 1.0, 1.12, 1.26, 1.42],
    },
  },
  {
    id: 'facility_training_centre',
    name: 'Training Centre',
    description: 'Where the week actually happens. Pitches, gym, and enough space to work in units.',
    icon: 'cones',
    maxLevel: 5,
    category: 'DEVELOPMENT',
    upgradeCosts: [120_000, 380_000, 900_000, 1_900_000, 3_800_000],
    upgradeCycles: [2, 2, 3, 4, 5],
    upkeepPerCycle: [1_200, 3_000, 6_200, 11_000, 19_000, 31_000],
    levelEffects: [
      'A council pitch booked by the hour.',
      'One full-size surface and a portacabin.',
      'Two surfaces, a gym, and a coach who is not also the kitman.',
      'All-weather pitches, video room, dedicated position coaches.',
      'A campus. Sports science on site, individual programmes for everyone.',
      'Best in the league, and rival players notice on their first visit.',
    ],
    effects: {
      trainingGain: [0.55, 0.78, 1.0, 1.22, 1.45, 1.7],
      injuryResistance: [0.85, 0.93, 1.0, 1.07, 1.14, 1.22],
    },
  },
  {
    id: 'facility_medical',
    name: 'Medical Department',
    description: 'The difference between three weeks out and six.',
    icon: 'medkit',
    maxLevel: 5,
    category: 'PERFORMANCE',
    upgradeCosts: [90_000, 260_000, 640_000, 1_400_000, 2_900_000],
    upgradeCycles: [1, 2, 3, 4, 5],
    upkeepPerCycle: [900, 2_400, 5_000, 9_200, 16_000, 26_000],
    levelEffects: [
      'A physio who also does two other clubs.',
      'One full-time physio and a treatment room.',
      'Physio team, imaging access, structured return-to-play.',
      'In-house doctor, rehab suite, load monitoring on every player.',
      'Specialist consultants on retainer and a genuine prevention programme.',
      'Players sign here specifically because of this department.',
    ],
    effects: {
      injuryRecovery: [0.62, 0.8, 1.0, 1.24, 1.5, 1.8],
      injuryResistance: [0.8, 0.9, 1.0, 1.11, 1.22, 1.34],
    },
  },
  {
    id: 'facility_academy',
    name: 'Academy',
    description: 'Where the next squad comes from, if you are patient enough to wait for it.',
    icon: 'sapling',
    maxLevel: 5,
    category: 'DEVELOPMENT',
    upgradeCosts: [140_000, 420_000, 980_000, 2_100_000, 4_400_000],
    upgradeCycles: [3, 3, 4, 5, 6],
    upkeepPerCycle: [1_400, 3_400, 7_000, 12_500, 21_000, 34_000],
    levelEffects: [
      'An under-18 side run by volunteers.',
      'Two age groups and one paid coach.',
      'A full pathway with a recognisable playing identity.',
      'Regional recruitment, education partnership, residential places.',
      'A production line other clubs shop from.',
      'The best youth setup in the competition, and everyone in it knows.',
    ],
    effects: {
      youthQuality: [0.5, 0.74, 1.0, 1.28, 1.58, 1.9],
      trainingGain: [0.94, 0.97, 1.0, 1.05, 1.1, 1.16],
    },
  },
  {
    id: 'facility_scouting',
    name: 'Scouting Network',
    description: 'Eyes in places your rivals have not bothered to look.',
    icon: 'binoculars',
    maxLevel: 5,
    category: 'DEVELOPMENT',
    upgradeCosts: [70_000, 210_000, 520_000, 1_150_000, 2_400_000],
    upgradeCycles: [1, 2, 3, 4, 5],
    upkeepPerCycle: [800, 2_000, 4_400, 8_000, 14_000, 23_000],
    levelEffects: [
      'One scout, and he is also the assistant manager.',
      'Two part-time scouts covering the region.',
      'A network with structured reports and a shortlist that means something.',
      'National coverage, video scouts, cross-checked reporting.',
      'Scouts in every nation that matters plus a data feed nobody else buys.',
      'You find them a year before anyone else does.',
    ],
    effects: {
      scoutSpeed: [0.5, 0.75, 1.0, 1.3, 1.62, 2.0],
      scoutAccuracy: [0.6, 0.8, 1.0, 1.18, 1.34, 1.5],
    },
  },
  {
    id: 'facility_analytics',
    name: 'Analytics Department',
    description: 'Turns the last six matches into the next one.',
    icon: 'chart',
    maxLevel: 5,
    category: 'PERFORMANCE',
    upgradeCosts: [60_000, 190_000, 480_000, 1_050_000, 2_200_000],
    upgradeCycles: [1, 2, 3, 4, 4],
    upkeepPerCycle: [600, 1_800, 4_000, 7_400, 13_000, 21_000],
    levelEffects: [
      'Nothing. Somebody keeps a spreadsheet.',
      'One analyst cutting video for the staff.',
      'Opposition reports before every fixture and set-piece analysis.',
      'Modelling, in-match tracking, individual performance dashboards.',
      'A department that argues with the manager and is sometimes right.',
      'A proprietary model that recruitment and tactics both run on.',
    ],
    effects: {
      tacticalInsight: [0.45, 0.72, 1.0, 1.3, 1.62, 1.95],
      scoutAccuracy: [0.92, 0.96, 1.0, 1.08, 1.17, 1.27],
    },
  },
  {
    id: 'facility_media_dept',
    name: 'Media Department',
    description: 'Controls the story before somebody else writes it for you.',
    icon: 'microphone',
    maxLevel: 5,
    category: 'COMMERCIAL',
    upgradeCosts: [50_000, 160_000, 420_000, 920_000, 1_950_000],
    upgradeCycles: [1, 2, 2, 3, 4],
    upkeepPerCycle: [500, 1_600, 3_600, 6_800, 12_000, 19_500],
    levelEffects: [
      'The manager answers his own phone. It goes badly.',
      'A part-time press officer and a template statement.',
      'Media training, prepared lines, a club channel worth watching.',
      'In-house production, embedded access, proactive story placement.',
      'A newsroom. Bad stories are landed on your terms or not at all.',
      'The club sets the agenda for the whole competition.',
    ],
    effects: {
      mediaDamping: [0.4, 0.7, 1.0, 1.32, 1.66, 2.0],
      fanSentimentGain: [0.9, 0.95, 1.0, 1.08, 1.16, 1.25],
    },
  },
  {
    id: 'facility_creator_studio',
    name: 'Creator Studio',
    description: 'A room where the club and its creators make the thing that actually sells.',
    icon: 'camera',
    maxLevel: 5,
    category: 'COMMERCIAL',
    upgradeCosts: [80_000, 240_000, 600_000, 1_300_000, 2_700_000],
    upgradeCycles: [1, 2, 3, 3, 4],
    upkeepPerCycle: [800, 2_200, 4_800, 8_800, 15_500, 25_000],
    levelEffects: [
      'A phone on a tripod in the car park.',
      'A corner of the gym with a light and a backdrop.',
      'A proper studio, an editor, and a posting schedule people keep to.',
      'Multi-camera, live capable, a team that can turn a match around by midnight.',
      'A production house creators leave other clubs to work in.',
      'The most-watched club channel in the league, by a distance.',
    ],
    effects: {
      creatorReach: [0.4, 0.7, 1.0, 1.38, 1.78, 2.25],
      merchMultiplier: [0.88, 0.94, 1.0, 1.09, 1.19, 1.3],
    },
  },
  {
    id: 'facility_merchandising',
    name: 'Merchandising',
    description: 'Shirts, and everything that follows a shirt.',
    icon: 'shirt',
    maxLevel: 5,
    category: 'COMMERCIAL',
    upgradeCosts: [45_000, 150_000, 400_000, 880_000, 1_850_000],
    upgradeCycles: [1, 1, 2, 3, 4],
    upkeepPerCycle: [500, 1_500, 3_400, 6_400, 11_000, 18_000],
    levelEffects: [
      'A trestle table on matchdays.',
      'A club shop open two hours before kick-off.',
      'A permanent store and a working online shop.',
      'Seasonal ranges, collaborations, international shipping.',
      'A retail operation that outsells three clubs above you.',
      'A label in its own right, worn by people who have never been.',
    ],
    effects: {
      merchMultiplier: [0.55, 0.78, 1.0, 1.28, 1.6, 2.0],
      matchdayRevenue: [0.94, 0.97, 1.0, 1.06, 1.13, 1.21],
    },
  },
  {
    id: 'facility_fan_zone',
    name: 'Fan Zone',
    description: 'The two hours before kick-off, which is where a matchday is won or lost.',
    icon: 'flag',
    maxLevel: 5,
    category: 'FAN',
    upgradeCosts: [40_000, 130_000, 340_000, 760_000, 1_600_000],
    upgradeCycles: [1, 1, 2, 3, 3],
    upkeepPerCycle: [400, 1_300, 3_000, 5_600, 9_800, 16_000],
    levelEffects: [
      'A car park and one burger van.',
      'Food, a screen, and somewhere to stand out of the rain.',
      'A proper pre-match build with music and a supporters\' bar.',
      'Family area, club museum, creator meet-ups before every fixture.',
      'An event in its own right that people attend without a ticket.',
      'The best matchday experience in the competition, and neutrals travel for it.',
    ],
    effects: {
      fanSentimentGain: [0.7, 0.86, 1.0, 1.16, 1.34, 1.55],
      atmosphere: [0.82, 0.92, 1.0, 1.1, 1.22, 1.36],
      matchdayRevenue: [0.9, 0.96, 1.0, 1.09, 1.2, 1.34],
    },
  },
  {
    id: 'facility_recovery',
    name: 'Recovery Suite',
    description: 'Six matches in eleven days is a recovery problem, not a fitness one.',
    icon: 'droplet',
    maxLevel: 5,
    category: 'PERFORMANCE',
    upgradeCosts: [55_000, 175_000, 450_000, 990_000, 2_050_000],
    upgradeCycles: [1, 2, 2, 3, 4],
    upkeepPerCycle: [600, 1_700, 3_800, 7_000, 12_200, 20_000],
    levelEffects: [
      'Ice, and a rota for the one bath.',
      'Cold plunge and compression kit that mostly works.',
      'Proper hydrotherapy and a sleep protocol nobody follows yet.',
      'Cryo, nutrition team, individualised recovery blocks.',
      'A recovery programme that adds a fixture a fortnight to every player.',
      'Squad fitness that visibly outlasts everyone else in the final ten minutes.',
    ],
    effects: {
      injuryRecovery: [0.82, 0.91, 1.0, 1.12, 1.26, 1.42],
      injuryResistance: [0.86, 0.94, 1.0, 1.08, 1.17, 1.28],
      trainingGain: [0.93, 0.97, 1.0, 1.06, 1.12, 1.2],
    },
  },
];

export const BASE_FACILITY_IDS: readonly string[] = BASE_FACILITIES.map((f) => f.id);

/** Every effect key the base facilities emit. Consumers may assert against this. */
export const FACILITY_EFFECT_KEYS = [
  'trainingGain', 'injuryRecovery', 'injuryResistance', 'youthQuality', 'scoutSpeed',
  'scoutAccuracy', 'tacticalInsight', 'mediaDamping', 'creatorReach', 'merchMultiplier',
  'matchdayRevenue', 'fanSentimentGain', 'stadiumCapacity', 'atmosphere',
] as const;
export type FacilityEffectKey = (typeof FACILITY_EFFECT_KEYS)[number];
