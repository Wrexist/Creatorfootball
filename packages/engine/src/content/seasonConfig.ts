import type { SeasonConfigDef } from './schema';

/**
 * Season configuration, extended with the roster-construction meta.
 *
 * `SeasonConfigDef` in schema.ts is frozen contract, so the three squad-meta
 * fields the format needs live on this widening interface instead. Any consumer
 * that only knows the frozen shape keeps working; consumers that want the
 * wildcard meta narrow to `CreatorSeasonConfigDef`.
 *
 * WHY THE WILDCARD SLOTS EXIST — do not fold these into `benchSize`.
 * `squadSize` / `benchSize` / `substitutions` are *match-day* concepts: who is
 * registered, who sits, who can come on. The wildcard fields are a *roster
 * construction* concept borrowed from short-format creator leagues: a club
 * drafts a core, then adds a wildcard fixed for the whole season and one that
 * it re-picks every single week. That rotating slot is the reason it is here.
 * It hands the player one genuinely consequential decision every matchweek —
 * who is the ringer this week? — without adding a management screen, and it
 * gives the world engine a recurring, high-salience story beat to write about.
 * Deleting it as "redundant with the bench" would remove the weekly decision,
 * not just a number.
 */
export interface CreatorSeasonConfigDef extends SeasonConfigDef {
  /** Players a club selects in the draft and keeps for the season. */
  readonly draftedSquadSize: number;
  /** Wildcard slots locked for the whole season once chosen. */
  readonly seasonWildcardSlots: number;
  /** Wildcard slots re-chosen every matchweek. The weekly decision. */
  readonly rotatingWildcardSlots: number;
  /** Matches played back-to-back at one venue on a matchday. The session shape. */
  readonly matchdayBlockSize: number;
}

export const BASE_SEASON_CONFIG: CreatorSeasonConfigDef = {
  clubCount: 12,
  rounds: 2,
  matchMinutes: 30,
  halves: 2,
  // 18 registered: the 14 drafted, both wildcards, and two reserves who cover
  // injuries and suspensions without forcing an emergency signing.
  squadSize: 18,
  playersOnPitch: 7,
  benchSize: 7,
  substitutions: 5,
  playoffSpots: 4,
  relegationSpots: 2,
  prizeMoney: [
    2_400_000, 1_500_000, 1_000_000, 750_000, 560_000, 440_000,
    360_000, 300_000, 250_000, 210_000, 180_000, 150_000,
  ],
  startingBudget: 2_800_000,
  startingWageBudget: 46_000,

  draftedSquadSize: 14,
  seasonWildcardSlots: 1,
  rotatingWildcardSlots: 1,
  matchdayBlockSize: 6,
};
