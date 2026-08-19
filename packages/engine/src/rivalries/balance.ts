/**
 * Rivalry tuning.
 *
 * Intensity is a 0-100 pressure gauge that four systems read: stadium
 * atmosphere, match pressure on players, card rates, and how hard fans react to
 * a result. It must rise sharply from real incidents and decay slowly from
 * neglect, otherwise every fixture drifts to the same temperature.
 */
export const RIVALRY_BALANCE = {
  /** Starting intensity band for a rivalry a club template explicitly declares. */
  declaredIntensity: [62, 78] as const,
  /** Two clubs sharing a city are a derby whatever the templates say. */
  cityIntensity: [72, 88] as const,
  /** Clubs adjacent in the reputation table compete for the same space. */
  proximityIntensity: [26, 40] as const,
  /** Rivalries never fall below this once created; history does not evaporate. */
  floor: 12,
  ceiling: 100,

  /** Every meeting keeps the fire lit. */
  meetingBump: 2.5,
  /** A thrashing humiliates one side; per goal of margin above 1. */
  marginBump: 2.2,
  maxMarginBump: 9,
  /** Late winners are what people remember. */
  lateWinnerBump: 4,
  /** Per red card in the fixture. */
  redCardBump: 5,
  /** Per yellow above the two-card baseline. */
  yellowBump: 0.6,
  /** A disputed decision, a brawl, a celebration in front of away fans. */
  controversyBump: 6,
  /** Media saturation feeds the myth; per story about the fixture, capped. */
  mediaVolumeBump: 0.8,
  maxMediaBump: 4,
  /** Importance of the fixture (1-5) scales the whole bump. */
  importanceScale: 0.18,

  /** Per cycle of not meeting, intensity decays toward its origin baseline. */
  decayPerCycle: 0.35,
  /** Cycles of silence before decay starts at all. */
  decayGraceCycles: 6,

  /** Intensity at which the "boiling point" emergent story can fire. */
  boilingPoint: 84,
  /** Rise within one season that counts as escalation. */
  escalationDelta: 10,

  /** Derived effects. All are multipliers or additive bonuses on 0-1 scales. */
  atmospherePerIntensity: 0.0035,   // +0.35 atmosphere at intensity 100
  pressurePerIntensity: 0.004,      // +0.4 pressure multiplier at 100
  cardRatePerIntensity: 0.005,      // +50% cards at intensity 100
  fanReactionPerIntensity: 0.006,   // fan swings 60% harder in a max-heat derby

  /** Incidents retained per rivalry; the history screen shows the most recent. */
  maxIncidents: 24,
} as const;
