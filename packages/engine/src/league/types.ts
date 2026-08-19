import type { ClubId, CompetitionId, FixtureId, MatchId, SeasonId } from '../core/brand';
import type { SeasonPhase } from '../core/clock';
import type { SpecialRuleId } from '../matches/specialRules';

export type CompetitionFormat = 'LEAGUE' | 'PLAYOFF' | 'CUP' | 'FRIENDLY';

export interface Competition {
  readonly id: CompetitionId;
  readonly name: string;
  readonly shortName: string;
  readonly format: CompetitionFormat;
  readonly tier: number;
  readonly clubIds: readonly ClubId[];
  /** How many times each pair meets in the league stage. */
  readonly rounds: number;
  readonly playoffSpots: number;
  readonly relegationSpots: number;
  readonly prizeMoney: readonly number[];
  readonly accent: string;
  /** Rules that may fire in this competition. Empty = none. */
  readonly enabledSpecialRules: readonly SpecialRuleId[];
}

export type FixtureStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'POSTPONED';

export interface Fixture {
  readonly id: FixtureId;
  readonly competitionId: CompetitionId;
  readonly seasonId: SeasonId;
  readonly week: number;
  readonly phase: SeasonPhase;
  readonly homeClubId: ClubId;
  readonly awayClubId: ClubId;
  readonly status: FixtureStatus;
  readonly matchId: MatchId | null;
  readonly homeScore: number | null;
  readonly awayScore: number | null;
  /** 1-5. Derived from rivalry, table position and stakes; drives atmosphere and prompts. */
  readonly importance: number;
  readonly isDerby: boolean;
  /** Playoff/knockout label, e.g. "Semi-Final". */
  readonly stageLabel?: string;
  readonly enabledSpecialRules: readonly SpecialRuleId[];
}

export interface StandingRow {
  readonly clubId: ClubId;
  readonly position: number;
  readonly played: number;
  readonly won: number;
  readonly drawn: number;
  readonly lost: number;
  readonly goalsFor: number;
  readonly goalsAgainst: number;
  readonly goalDifference: number;
  readonly points: number;
  /** Newest last, max 5. */
  readonly form: readonly ('W' | 'D' | 'L')[];
  readonly zone: 'CHAMPION' | 'PLAYOFF' | 'MID' | 'RELEGATION';
}

export interface Season {
  readonly id: SeasonId;
  readonly number: number;
  readonly competitionId: CompetitionId;
  readonly totalWeeks: number;
  readonly currentWeek: number;
  readonly phase: SeasonPhase;
  readonly completed: boolean;
  readonly championClubId: ClubId | null;
  readonly playerFinalPosition: number | null;
}
