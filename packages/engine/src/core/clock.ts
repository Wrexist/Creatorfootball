/**
 * The game clock is a *cycle* counter, not wall-clock time. The world advances
 * when the player completes a match cycle, never because real days elapsed —
 * this is the central anti-pattern we are avoiding from live-service managers.
 */
export interface GameClock {
  /** Monotonic across the whole save. Never resets. */
  readonly cycle: number;
  /** 1-based season number. */
  readonly season: number;
  /** 1-based matchweek within the season. */
  readonly week: number;
  /** Current phase of the season calendar. */
  readonly phase: SeasonPhase;
  /** Wall-clock timestamp of the last advance, for display only. Never simulate from this. */
  readonly updatedAt: number;
}

export const SEASON_PHASES = [
  'PRE_SEASON',
  'OPENING_FIXTURES',
  'RIVALRY_WEEK',
  'TRANSFER_WINDOW',
  'CREATOR_EVENT',
  'MID_SEASON_PUSH',
  'DERBY_WEEK',
  'PLAYOFF_PUSH',
  'FINAL_WEEK',
  'PLAYOFFS',
  'CHAMPIONSHIP',
  'LEGACY',
] as const;
export type SeasonPhase = (typeof SEASON_PHASES)[number];

export const PHASE_LABELS: Record<SeasonPhase, string> = {
  PRE_SEASON: 'Pre-Season',
  OPENING_FIXTURES: 'Opening Fixtures',
  RIVALRY_WEEK: 'Rivalry Week',
  TRANSFER_WINDOW: 'Transfer Window',
  CREATOR_EVENT: 'Creator Event',
  MID_SEASON_PUSH: 'Mid-Season Push',
  DERBY_WEEK: 'Derby Week',
  PLAYOFF_PUSH: 'Playoff Push',
  FINAL_WEEK: 'Final Week',
  PLAYOFFS: 'Playoffs',
  CHAMPIONSHIP: 'Championship',
  LEGACY: 'Legacy',
};

export const initialClock = (now: number): GameClock => ({
  cycle: 0,
  season: 1,
  week: 0,
  phase: 'PRE_SEASON',
  updatedAt: now,
});
