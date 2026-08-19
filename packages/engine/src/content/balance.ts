/**
 * Tunables for content generation.
 *
 * Everything a designer would reach for while balancing the feel of a generated
 * save lives here rather than inline in the generators: how much headroom a
 * teenager gets, how rare a wonderkid is, how wide a squad's talent spread runs.
 * The generators read these constants; they never hardcode a number that a
 * balance pass would want to move.
 */

export const GENERATION_BALANCE = {
  /** Iterations of the overall-correction loop. Convergence is fast; this is a safety net. */
  overallSolveIterations: 10,
  /** Contract requirement: generated overall must land inside this band of the target. */
  overallTolerance: 3,

  /**
   * Potential headroom by age band, expressed as [floor, ceiling] extra points
   * above current overall. A 17-year-old can be a completely different player in
   * five years; a 32-year-old is exactly who he is.
   */
  potentialHeadroom: [
    { maxAge: 17, range: [8, 24] },
    { maxAge: 19, range: [6, 20] },
    { maxAge: 21, range: [4, 16] },
    { maxAge: 23, range: [2, 11] },
    { maxAge: 25, range: [1, 7] },
    { maxAge: 27, range: [0, 4] },
    { maxAge: 29, range: [0, 2] },
    { maxAge: 99, range: [0, 1] },
  ] as readonly { maxAge: number; range: readonly [number, number] }[],

  /** Chance a player aged <= wonderkidMaxAge is rolled as a generational talent. */
  wonderkidChance: 0.025,
  wonderkidMaxAge: 20,
  /** Extra ceiling granted to a wonderkid on top of the normal age headroom. */
  wonderkidBonus: [6, 14] as readonly [number, number],
  /** A wonderkid must clear this much headroom before the trait may be attached. */
  wonderkidMinHeadroom: 10,

  /** Traits scale with quality: a squad filler rarely has three of them. */
  traitCount: {
    baseChance: 0.55,
    perOverallAbove: 60,
    perOverallStep: 0.014,
    max: 3,
  },

  /** Age band used when the caller does not pin an age. */
  defaultAgeRange: [17, 34] as readonly [number, number],
  /** Triangular mode for that band — the population peaks in the mid-twenties. */
  defaultAgeMode: 25,

  /** Squad shape. The default is tuned for the 7-a-side, 18-man base format. */
  squad: {
    defaultSize: 18,
    /** Overall spread inside a squad, as points either side of the target mean. */
    talentSpread: 7,
    /** How far above the mean the squad's best player sits. */
    standoutBonus: [5, 10] as readonly [number, number],
    standoutCount: [1, 2] as readonly [number, number],
    /** Under-20 prospects carried in the 18. */
    prospectCount: [2, 4] as readonly [number, number],
    prospectPenalty: [8, 16] as readonly [number, number],
    /** Over-31 veterans carried in the 18. */
    veteranCount: [1, 3] as readonly [number, number],
    /** Share of the squad that shares the club's home nationality. */
    homeNationShare: 0.55,
  },

  /** Creator generation. */
  creator: {
    /** Attribute mean by tier index (LOCAL..GLOBAL). */
    tierAttributeMean: [42, 50, 58, 67, 76] as readonly number[],
    attributeSpread: 11,
    /** Controversy is deliberately decorrelated from tier — a nobody can be toxic. */
    controversyMean: 45,
    controversySpread: 22,
    /** Follower draw within the tier band: triangular, skewed to the bottom. */
    followerMode: 0.35,
  },

  /** Manager generation. */
  manager: {
    attributeBase: 50,
    attributeSpread: 7,
    /** Pre-made managers get a tighter spread so their archetype reads clearly. */
    premadeSpread: 4,
  },

  /** Club instantiation from a template. */
  club: {
    /** Facility level a club starts on, derived from reputation. */
    facilityFromReputation: (reputation: number): number =>
      Math.max(1, Math.min(5, Math.round(1 + (reputation / 100) * 3.4))),
    /** Share of the transfer budget that becomes the per-cycle wage budget. */
    wageBudgetShare: 0.085,
    ticketPriceBase: 18,
    merchPriceBase: 42,
  },
} as const;

/** Mental-profile archetypes. Real people, not a flat 50 with noise on top. */
export interface PersonalityArchetype {
  readonly id: string;
  readonly label: string;
  readonly weight: number;
  readonly offsets: Readonly<Record<string, number>>;
}

export const PERSONALITY_ARCHETYPES: readonly PersonalityArchetype[] = [
  {
    id: 'model_pro', label: 'Model Professional', weight: 14,
    offsets: { professionalism: 22, discipline: 16, consistency: 14, temperament: 12, ambition: -2, loyalty: 6 },
  },
  {
    id: 'mercenary', label: 'Mercenary', weight: 10,
    offsets: { ambition: 24, loyalty: -26, professionalism: 4, confidence: 8, temperament: -6 },
  },
  {
    id: 'firebrand', label: 'Firebrand', weight: 11,
    offsets: { discipline: -24, temperament: -20, confidence: 14, leadership: 6, pressureHandling: 4, consistency: -8 },
  },
  {
    id: 'quiet_grinder', label: 'Quiet Grinder', weight: 13,
    offsets: { consistency: 18, professionalism: 12, loyalty: 14, leadership: -12, confidence: -6, ambition: -12 },
  },
  {
    id: 'golden_boy', label: 'Golden Boy', weight: 8,
    offsets: { confidence: 22, ambition: 18, morale: 10, professionalism: -10, consistency: -12, loyalty: -8 },
  },
  {
    id: 'captain_material', label: 'Captain Material', weight: 9,
    offsets: { leadership: 26, pressureHandling: 16, discipline: 10, loyalty: 12, professionalism: 10 },
  },
  {
    id: 'journeyman', label: 'Journeyman', weight: 12,
    offsets: { loyalty: -12, professionalism: 6, ambition: -6, consistency: 4, temperament: 8, confidence: -4 },
  },
  {
    id: 'fragile_talent', label: 'Fragile Talent', weight: 9,
    offsets: { pressureHandling: -24, consistency: -18, confidence: -10, morale: -8, temperament: -10, ambition: 8 },
  },
  {
    id: 'showpony', label: 'Showpony', weight: 7,
    offsets: { confidence: 20, ambition: 14, discipline: -12, leadership: 4, professionalism: -8, temperament: -6 },
  },
  {
    id: 'club_man', label: 'Club Man', weight: 7,
    offsets: { loyalty: 28, morale: 10, leadership: 12, ambition: -18, professionalism: 8 },
  },
] as const;
