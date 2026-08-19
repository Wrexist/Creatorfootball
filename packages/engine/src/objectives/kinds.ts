import type { ClubId } from '../core/brand';
import type { AnyDomainEvent } from '../core/events';
import type { GameState } from '../game/state';
import { points } from '../clubs/club';

/**
 * Objective kinds.
 *
 * Each kind knows two things the rest of the system needs: how to read progress
 * out of the domain event stream (or the state, for standing targets), and what
 * range of targets is actually *achievable right now*. The second is what stops
 * the board asking a bottom-of-the-table side for twelve wins in four matches.
 */

export interface ObjectiveContext {
  readonly state: GameState;
  readonly clubId: ClubId;
  readonly remainingMatches: number;
  readonly currentPosition: number;
  readonly clubCount: number;
  /** 0-1 estimate of this club's chance of winning any given match. */
  readonly winRate: number;
  readonly squadAverage: number;
  readonly fanSentiment: number;
  readonly followers: number;
  readonly balance: number;
}

export interface Feasible { readonly min: number; readonly max: number }

export interface ObjectiveKindDef {
  readonly id: string;
  readonly label: string;
  /** Increment contributed by one event. Return 0 for events that do not apply. */
  readonly progress?: (event: AnyDomainEvent, clubId: ClubId) => number;
  /** Absolute reading from state, for standing targets like league position. */
  readonly measure?: (state: GameState, clubId: ClubId) => number;
  /** Lower target values are better (league position, cards conceded). */
  readonly lowerIsBetter?: boolean;
  readonly feasible: (ctx: ObjectiveContext) => Feasible;
}

const clubOf = (event: AnyDomainEvent): string | undefined =>
  (event.payload as { clubId?: string }).clubId;

const isFor = (event: AnyDomainEvent, clubId: ClubId): boolean => clubOf(event) === clubId;

/** Rounded down; a target must always be reachable, never "reachable if perfect". */
const achievable = (remaining: number, rate: number, headroom: number): number =>
  Math.max(1, Math.floor(remaining * rate * headroom));

export const OBJECTIVE_KINDS: readonly ObjectiveKindDef[] = [
  {
    id: 'WIN_MATCHES', label: 'Win matches',
    progress: (e, c) => (e.type === 'MATCH_WON' && isFor(e, c) ? 1 : 0),
    feasible: (ctx) => ({
      min: 1,
      // 85% of the expected wins in the remaining fixtures: demanding, never absurd.
      max: Math.max(1, achievable(ctx.remainingMatches, ctx.winRate, 0.85)),
    }),
  },
  {
    id: 'SCORE_GOALS', label: 'Score goals',
    progress: (e, c) => (e.type === 'GOAL_SCORED' && isFor(e, c) ? 1 : 0),
    feasible: (ctx) => ({ min: 2, max: Math.max(3, Math.floor(ctx.remainingMatches * 2.2)) }),
  },
  {
    id: 'CLEAN_SHEETS', label: 'Keep clean sheets',
    progress: (e, c) => (e.type === 'MATCH_WON' && isFor(e, c)
      && (e.payload.homeScore === 0 || e.payload.awayScore === 0) ? 1 : 0),
    feasible: (ctx) => ({ min: 1, max: Math.max(1, achievable(ctx.remainingMatches, 0.35, 1)) }),
  },
  {
    id: 'WIN_DERBY', label: 'Win a derby',
    progress: (e, c) => (e.type === 'MATCH_WON' && isFor(e, c) && e.importance >= 4 ? 1 : 0),
    feasible: () => ({ min: 1, max: 2 }),
  },
  {
    id: 'AVOID_RED_CARDS', label: 'Discipline',
    progress: (e, c) => (e.type === 'RED_CARD' && isFor(e, c) ? 1 : 0),
    lowerIsBetter: true,
    feasible: (ctx) => ({ min: 0, max: Math.max(0, Math.floor(ctx.remainingMatches / 6)) }),
  },
  {
    id: 'LEAGUE_POSITION', label: 'Finish in position',
    measure: (state, clubId) => {
      const table = Object.values(state.clubs)
        .map((club) => ({ id: club.id, pts: points(club.seasonRecord) }))
        .sort((a, b) => b.pts - a.pts);
      const index = table.findIndex((row) => row.id === clubId);
      return index < 0 ? table.length : index + 1;
    },
    lowerIsBetter: true,
    feasible: (ctx) => ({
      // You can be asked to climb, but only by a plausible number of places.
      min: Math.max(1, ctx.currentPosition - 4),
      max: Math.min(ctx.clubCount, ctx.currentPosition + 2),
    }),
  },
  {
    id: 'SIGN_PLAYERS', label: 'Strengthen the squad',
    progress: (e, c) => (e.type === 'PLAYER_SIGNED' && isFor(e, c) ? 1 : 0),
    feasible: () => ({ min: 1, max: 3 }),
  },
  {
    id: 'DEVELOP_PLAYER', label: 'Develop players',
    progress: (e, c) => (e.type === 'PLAYER_DEVELOPED' && isFor(e, c) ? Math.max(0, e.payload.to - e.payload.from) : 0),
    feasible: (ctx) => ({ min: 2, max: Math.max(3, Math.floor(ctx.remainingMatches * 0.8)) }),
  },
  {
    id: 'YOUTH_MINUTES', label: 'Trust the academy',
    progress: (e, c) => (e.type === 'YOUTH_PROSPECT_PROMOTED' && isFor(e, c) ? 1 : 0),
    feasible: () => ({ min: 1, max: 2 }),
  },
  {
    id: 'GAIN_FOLLOWERS', label: 'Grow the audience',
    measure: (state, clubId) => state.clubs[clubId]?.fans.onlineFollowers ?? 0,
    feasible: (ctx) => ({
      min: Math.round(ctx.followers * 1.02),
      max: Math.round(ctx.followers * 1.25),
    }),
  },
  {
    id: 'FAN_SENTIMENT', label: 'Win the fans over',
    measure: (state, clubId) => Math.round(state.clubs[clubId]?.fans.sentiment ?? 0),
    feasible: (ctx) => ({
      min: Math.min(95, Math.round(ctx.fanSentiment) + 2),
      max: Math.min(95, Math.round(ctx.fanSentiment) + 18),
    }),
  },
  {
    id: 'MOTM_AWARDS', label: 'Match-winners',
    progress: (e, c) => (e.type === 'MOTM_AWARDED' && isFor(e, c) ? 1 : 0),
    feasible: (ctx) => ({ min: 1, max: Math.max(1, Math.floor(ctx.remainingMatches * 0.6)) }),
  },
  {
    id: 'FACILITY_UPGRADE', label: 'Invest in the club',
    progress: (e, c) => (e.type === 'FACILITY_UPGRADED' && isFor(e, c) ? 1 : 0),
    feasible: (ctx) => ({ min: 1, max: ctx.balance > 2_000_000 ? 2 : 1 }),
  },
  {
    id: 'SPONSOR_DEALS', label: 'Commercial growth',
    progress: (e, c) => (e.type === 'SPONSOR_SIGNED' && isFor(e, c) ? 1 : 0),
    feasible: () => ({ min: 1, max: 2 }),
  },
  {
    id: 'TROPHY', label: 'Win silverware',
    progress: (e, c) => (e.type === 'TROPHY_WON' && isFor(e, c) ? 1 : 0),
    feasible: (ctx) => ({ min: 1, max: ctx.currentPosition <= 3 ? 1 : 0 }),
  },
];

export const KIND_BY_ID = new Map(OBJECTIVE_KINDS.map((k) => [k.id, k]));

export const objectiveKind = (id: string): ObjectiveKindDef | null => KIND_BY_ID.get(id) ?? null;
