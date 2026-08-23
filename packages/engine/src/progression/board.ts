import type { GameState, Objective, SponsorDeal, SponsorState, TransferListing } from '../game/state';
import type { Club } from '../clubs/club';
import type { PlayerId } from '../core/brand';
import { points as leaguePoints } from '../clubs/club';
import { clamp } from '../core/math';
import { recentForm } from '../game/selectors';
import { BOARD_BALANCE as B } from './balance';

/**
 * The board's mood, and what it does about failure.
 *
 * A one-tier league cannot relegate anyone, and sacking the player would end
 * the save, so the classic punishments are unavailable. What replaces them is
 * a crisis ladder with consequences that bite through systems that already
 * exist: an ultimatum objective when the season becomes indefensible, and a
 * wage cut plus a forced sale plus commercial damage when it is failed.
 *
 * Two laws shape this module:
 *  - Mood is *derived*, never accumulated. Every cycle it is recomputed from
 *    position-vs-expectation, fan sentiment (level and recent trend) and
 *    recent form. Nothing is stored between cycles except when the last
 *    ultimatum went out — so recovering on the pitch genuinely cools the
 *    board, and no hidden grudge state can rot.
 *  - The ultimatum rides the existing objectives system (WIN_MATCHES kind,
 *    DYNAMIC source). Progress counting, expiry, failure events and UI
 *    surfacing all come free from machinery that already works; this file
 *    only decides *whether* and *what* to issue, and what happens after.
 */

export type BoardMood = 'CONTENT' | 'RESTLESS' | 'ANGRY' | 'ULTIMATUM';

/** Ultimatum objectives carry this id prefix so their failure is recognisable in the event stream. */
export const ULTIMATUM_OBJECTIVE_PREFIX = 'obj_board_ultimatum';

export const initialBoardPressure = (): GameState['boardPressure'] => ({ lastUltimatumCycle: null });

/** Where the club's reputation says it should finish. Reputation is set before a ball is kicked, which makes it the honest proxy for pre-season expectation. */
export function expectedPositionOf(state: GameState): number {
  const table = Object.values(state.clubs)
    .sort((a, b) => b.reputation - a.reputation || (a.id < b.id ? -1 : 1));
  return Math.max(1, table.findIndex((c) => c.id === state.playerClubId) + 1);
}

/** Where the club actually sits today, by the same ordering the league table uses. */
export function currentPositionOf(state: GameState): number {
  const table = Object.values(state.clubs)
    .map((club) => ({
      id: club.id,
      pts: leaguePoints(club.seasonRecord),
      gd: club.seasonRecord.goalsFor - club.seasonRecord.goalsAgainst,
    }))
    .sort((a, b) => b.pts - a.pts || b.gd - a.gd || (a.id < b.id ? -1 : 1));
  const index = table.findIndex((row) => row.id === state.playerClubId);
  return index < 0 ? table.length : index + 1;
}

/** Net sentiment movement over recent cycles, read off announced changes only. */
function sentimentTrend(state: GameState): number {
  const since = state.clock.cycle - B.sentimentTrendWindowCycles;
  let delta = 0;
  for (const event of state.eventLog) {
    if (event.type !== 'FAN_SENTIMENT_CHANGED') continue;
    if (event.payload.clubId !== state.playerClubId) continue;
    if (event.cycle <= since) continue;
    delta += event.payload.to - event.payload.from;
  }
  return delta;
}

/**
 * Board pressure, 0-100, derived fresh from what already exists.
 *
 * Three inputs, each independently legible to the player: where you sit
 * against where you were always going to sit, how the crowd feels (both level
 * and direction), and the run of results. No single input can reach ULTIMATUM
 * alone — a bad month is survivable, a bad season is not.
 */
export function boardPressure(state: GameState): number {
  const club = state.clubs[state.playerClubId];
  if (!club) return 0;
  const gap = Math.max(0, currentPositionOf(state) - expectedPositionOf(state));
  const sentimentDeficit = clamp(
    (B.sentimentNeutral - club.fans.sentiment) / B.sentimentNeutral, 0, 1,
  );
  const form = recentForm(state, state.playerClubId, B.formWindow);
  const losses = form.filter((r) => r === 'L').length;
  const wins = form.filter((r) => r === 'W').length;
  const trendPenalty = clamp(-sentimentTrend(state), 0, B.sentimentTrendClamp) * B.sentimentTrendWeight;
  return clamp(
    gap * B.positionGapPerPlace
    + sentimentDeficit * B.sentimentDeficitWeight
    + trendPenalty
    + losses * B.formLossWeight
    - wins * B.formWinRelief,
    0,
    100,
  );
}

export function boardMood(pressure: number): BoardMood {
  if (pressure >= B.thresholds.ULTIMATUM) return 'ULTIMATUM';
  if (pressure >= B.thresholds.ANGRY) return 'ANGRY';
  if (pressure >= B.thresholds.RESTLESS) return 'RESTLESS';
  return 'CONTENT';
}

export interface BoardAssessment {
  readonly pressure: number;
  readonly mood: BoardMood;
}

export function assessBoard(state: GameState): BoardAssessment {
  const pressure = boardPressure(state);
  return { pressure, mood: boardMood(pressure) };
}

/**
 * The live ultimatum objective, if one has been issued and not yet resolved.
 * Only genuinely ACTIVE ones count: a survived (COMPLETED) ultimatum lingers
 * in the active list until its rewards are claimed and must not block the
 * board from acting again later.
 */
export function activeBoardUltimatum(state: GameState): Objective | null {
  return state.objectives.active.find(
    (o) => o.id.startsWith(ULTIMATUM_OBJECTIVE_PREFIX) && o.status === 'ACTIVE',
  ) ?? null;
}

/**
 * Whether the board issues an ultimatum this cycle: mood must be at the top of
 * the ladder, none may be live, and the previous one must have cooled down.
 */
export function shouldIssueUltimatum(state: GameState): boolean {
  if (boardMood(boardPressure(state)) !== 'ULTIMATUM') return false;
  if (activeBoardUltimatum(state)) return false;
  const last = state.boardPressure.lastUltimatumCycle;
  if (last !== null && state.clock.cycle - last < B.reissueCooldownCycles) return false;
  return true;
}

/**
 * The public promise. Deliberately plain: two wins from the next four, or the
 * board acts. It uses the WIN_MATCHES kind, whose progress counts MATCH_WON
 * events for the player's club, so the whole existing objective pipeline —
 * progress, expiry, completion and failure announcements — applies unchanged.
 */
export function buildBoardUltimatum(state: GameState): Objective {
  const cycle = state.clock.cycle;
  return {
    id: `${ULTIMATUM_OBJECTIVE_PREFIX}#${cycle}`,
    title: `Survive the vote: win ${B.ultimatumTargetWins} of your next ${B.ultimatumWindowCycles}`,
    description:
      `The board has lost patience with the season. Deliver ${B.ultimatumTargetWins} wins `
      + `in the next ${B.ultimatumWindowCycles} matches or face the consequences.`,
    kind: 'WIN_MATCHES',
    target: B.ultimatumTargetWins,
    progress: 0,
    rewards: [],
    expiresCycle: cycle + B.ultimatumWindowCycles,
    status: 'ACTIVE',
    source: 'DYNAMIC',
    importance: 5,
  };
}

export interface UltimatumSanctions {
  /** The player's club with its wage budget cut. */
  readonly club: Club;
  /** Active sponsor deals wounded below renewal willingness. */
  readonly sponsors: SponsorState;
  /** Listing for the highest-value squad member; null from an empty squad. */
  readonly listing: TransferListing | null;
}

/** Satisfaction after the sanction, clamped at zero. */
const sanctionedSatisfaction = (deal: SponsorDeal): SponsorDeal =>
  ({ ...deal, satisfaction: Math.max(0, deal.satisfaction - B.sponsorSatisfactionPenalty) });

/**
 * Consequences of a failed ultimatum, built as pure data for the world tick to
 * apply. Everything routes through systems that already exist: the wage budget
 * field the finance cycle reads, the transfer listing record AI clubs already
 * bid on, and sponsor satisfaction — cut hard enough that the next time each
 * deal comes up for renewal, the existing renewal logic declines it. That is
 * the "tier drop": the partner walks rather than re-signs, and replacements
 * price off the reputation damage that follows a crisis.
 */
export function applyUltimatumSanctions(state: GameState): UltimatumSanctions {
  const club = state.clubs[state.playerClubId];
  if (!club) throw new Error('applyUltimatumSanctions: player club missing');

  const finance = {
    ...club.finance,
    wageBudgetPerCycle: Math.max(
      B.wageBudgetFloor,
      Math.round(club.finance.wageBudgetPerCycle * (1 - B.wageBudgetCutFraction)),
    ),
  };
  const sanctionedClub: Club = { ...club, finance };

  // The most valuable player goes on the market, priced to move. Ties break by
  // id so the choice is deterministic regardless of squad insertion order.
  let target: { id: PlayerId; value: number } | null = null;
  for (const id of club.squad) {
    const player = state.players[id];
    if (!player) continue;
    const better = !target
      || player.marketValue > target.value
      || (player.marketValue === target.value && id < target.id);
    if (better) target = { id: player.id, value: player.marketValue };
  }
  const listing: TransferListing | null = target
    ? {
        playerId: target.id,
        clubId: club.id,
        askingPrice: Math.max(1000, Math.round(target.value * B.forcedListingPriceFactor)),
        wageDemand: Math.round(target.value * 0.0012),
        availability: 'AVAILABLE',
        interestedClubIds: [],
        listedCycle: state.clock.cycle,
      }
    : null;

  return {
    club: sanctionedClub,
    sponsors: { ...state.sponsors, active: state.sponsors.active.map(sanctionedSatisfaction) },
    listing,
  };
}
