/**
 * Media engine tuning.
 *
 * The press exist to make results feel consequential. Two failure modes are
 * tuned against here: too many stories (the feed becomes wallpaper) and stories
 * whose size does not match their stakes (a 1-0 win reading like a coronation).
 */
export const MEDIA_BALANCE = {
  /** Stories published per cycle before importance filtering. */
  maxStoriesPerCycle: 6,
  /** Stories at or above this importance are never trimmed. */
  alwaysPublishImportance: 4,
  /** Cycles a template id stays "recently used" for anti-repetition. */
  antiRepeatCycles: 3,
  /** Attempts to re-pick when a rendered headline duplicates a recent one. */
  rerollAttempts: 3,

  /** Manager mediaHandling 0-100 scaled by this damps negative coverage. */
  mediaHandlingDamping: 0.6,
  /** Chance a minor negative story about your club is spiked, at full damping. */
  minorStorySpikeChance: 0.7,
  /** Media style multipliers applied to negative sentiment. */
  styleNegative: { GUARDED: 0.85, HONEST: 1, COMBATIVE: 1.2, CHARMING: 0.75, ANALYTICAL: 0.9 } as const,
  /** Media style multipliers applied to positive sentiment. */
  stylePositive: { GUARDED: 0.9, HONEST: 1, COMBATIVE: 1.05, CHARMING: 1.15, ANALYTICAL: 0.95 } as const,
  /** Archetype flavour, matched loosely on the archetype id. */
  archetypeAmplify: [
    { match: 'show', negative: 1.15, positive: 1.25 },
    { match: 'entrepreneur', negative: 0.95, positive: 1.2 },
    { match: 'disciplinarian', negative: 0.85, positive: 0.95 },
    { match: 'data', negative: 0.9, positive: 0.9 },
    { match: 'gambler', negative: 1.2, positive: 1.15 },
  ] as const,

  /** Stakes adjustments applied on top of the hook's importance. */
  derbyImportanceBonus: 1,
  playerClubImportanceBonus: 1,
  /** Goal margin at which a result is a rout rather than a win. */
  routMargin: 4,
  routImportanceBonus: 1,

  /** Stories retained on the state. */
  retention: 90,
} as const;

/** Fictional outlets. Reach drives how far a story travels into social. */
export interface Outlet {
  readonly name: string;
  readonly kind: 'BROADSHEET' | 'TABLOID' | 'ANALYTICAL' | 'FAN' | 'CREATOR' | 'WIRE';
  readonly reach: number;
  /** Multiplier applied to the story's sentiment — tabloids run hotter. */
  readonly bias: number;
  readonly handle: string;
}

export const OUTLETS: readonly Outlet[] = [
  { name: 'The Touchline', kind: 'BROADSHEET', reach: 900_000, bias: 0.9, handle: '@thetouchline' },
  { name: 'Matchday Wire', kind: 'WIRE', reach: 1_400_000, bias: 0.85, handle: '@matchdaywire' },
  { name: 'Kickback Daily', kind: 'TABLOID', reach: 2_100_000, bias: 1.35, handle: '@kickbackdaily' },
  { name: 'Counter Press', kind: 'ANALYTICAL', reach: 420_000, bias: 0.75, handle: '@counterpress' },
  { name: 'The Terrace', kind: 'FAN', reach: 260_000, bias: 1.2, handle: '@theterrace' },
  { name: 'Bootroom Digest', kind: 'BROADSHEET', reach: 640_000, bias: 0.95, handle: '@bootroom' },
  { name: 'ClipCity', kind: 'CREATOR', reach: 3_200_000, bias: 1.15, handle: '@clipcity' },
  { name: 'Pitchside Weekly', kind: 'ANALYTICAL', reach: 380_000, bias: 0.8, handle: '@pitchsidewk' },
] as const;

export const outletByName = (name: string): Outlet | null =>
  OUTLETS.find((o) => o.name === name) ?? null;
