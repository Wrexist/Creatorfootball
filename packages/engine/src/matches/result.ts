import type { ClubId, MatchId, PlayerId } from '../core/brand';
import type { DecisionOutcome } from './decisions';
import type { MatchEvent, Side } from './events';
import type { ActiveSpecialRule, SpecialRuleId } from './specialRules';

export interface PlayerMatchStats {
  readonly playerId: PlayerId;
  readonly minutes: number;
  readonly goals: number;
  readonly assists: number;
  readonly shots: number;
  readonly shotsOnTarget: number;
  readonly xg: number;
  readonly passes: number;
  readonly passesCompleted: number;
  readonly keyPasses: number;
  readonly tackles: number;
  readonly interceptions: number;
  readonly duelsWon: number;
  readonly duelsLost: number;
  readonly saves: number;
  readonly fouls: number;
  readonly yellowCards: number;
  readonly redCards: number;
  readonly distanceCovered: number;
  readonly endStamina: number;
  /** 1.0-10.0, the number the player looks at first. */
  readonly rating: number;
}

export interface TeamMatchStats {
  readonly clubId: ClubId;
  readonly goals: number;
  readonly possession: number;
  readonly shots: number;
  readonly shotsOnTarget: number;
  readonly xg: number;
  readonly passes: number;
  readonly passAccuracy: number;
  readonly tackles: number;
  readonly interceptions: number;
  readonly corners: number;
  readonly fouls: number;
  readonly offsides: number;
  readonly yellowCards: number;
  readonly redCards: number;
  readonly bigChances: number;
  readonly bigChancesMissed: number;
}

export interface MatchResult {
  readonly matchId: MatchId;
  readonly seed: string;
  readonly homeClubId: ClubId;
  readonly awayClubId: ClubId;
  readonly homeScore: number;
  readonly awayScore: number;
  readonly winner: Side | 'draw';
  readonly events: readonly MatchEvent[];
  readonly homeStats: TeamMatchStats;
  readonly awayStats: TeamMatchStats;
  readonly playerStats: Readonly<Record<string, PlayerMatchStats>>;
  readonly motmPlayerId: PlayerId | null;
  /** Momentum sampled per minute; drives the post-match momentum chart. */
  readonly momentumTimeline: readonly number[];
  readonly specialRules: readonly ActiveSpecialRule[];
  readonly decisions: readonly DecisionOutcome[];
  readonly attendance: number;
  readonly importance: number;
  /** The single moment the post-match screen leads with. */
  readonly keyMomentEventId: string | null;
  readonly injuries: readonly { playerId: PlayerId; weeksOut: number; severity: string }[];
  /**
   * Rule cards each side actually spent, in the order they were played. A card
   * is a consumable: the club's inventory must be decremented by this list when
   * the result is applied, or a card earned once is playable forever.
   */
  readonly ruleCardsPlayed: readonly { side: Side; ruleId: SpecialRuleId; minute: number }[];
  readonly durationMinutes: number;
}

export const resultFor = (result: MatchResult, clubId: ClubId): 'W' | 'D' | 'L' => {
  if (result.homeScore === result.awayScore) return 'D';
  const homeWon = result.homeScore > result.awayScore;
  const isHome = result.homeClubId === clubId;
  return homeWon === isHome ? 'W' : 'L';
};
