/**
 * Mental attributes, 1-99. Each one is consumed by a named system; see the
 * comment on every key. If a system ever stops reading one of these, the
 * attribute is deleted rather than left as UI decoration.
 */
export const MENTAL_KEYS = [
  'confidence',     // read by: match sim (shot conversion, duel win rate)
  'morale',         // read by: training gains, transfer willingness, form drift
  'discipline',     // read by: foul/card probability
  'leadership',     // read by: team morale spread, comeback modifier
  'ambition',       // read by: contract demands, transfer requests
  'consistency',    // read by: per-match form variance
  'pressureHandling', // read by: big-match and late-game modifiers
  'professionalism',// read by: development rate, injury recovery, morale decay
  'loyalty',        // read by: contract renewal, resisting rival bids
  'temperament',    // read by: reaction to being benched/substituted
] as const;
export type MentalKey = (typeof MENTAL_KEYS)[number];
export type MentalProfile = Record<MentalKey, number>;

export const MENTAL_LABELS: Record<MentalKey, string> = {
  confidence: 'Confidence', morale: 'Morale', discipline: 'Discipline',
  leadership: 'Leadership', ambition: 'Ambition', consistency: 'Consistency',
  pressureHandling: 'Pressure Handling', professionalism: 'Professionalism',
  loyalty: 'Loyalty', temperament: 'Temperament',
};

/** Which of these the player can actually move week to week (vs. personality constants). */
export const VOLATILE_MENTAL: readonly MentalKey[] = ['confidence', 'morale'];

export const emptyMental = (fill = 50): MentalProfile =>
  Object.fromEntries(MENTAL_KEYS.map((k) => [k, fill])) as MentalProfile;
