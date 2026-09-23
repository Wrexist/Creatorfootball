import type { GameState } from './state';
import type { MatchResult } from '../matches/result';
import type { Ledger, PostContext } from '../economy/ledger';
import { payBonuses, rolePromiseMoraleDelta } from '../contracts/wages';
import { computeStandings } from '../league/standings';
import { clamp } from '../core/math';

/** Contract liabilities are settled before expiry, once in the weekly transaction. */
export function settleContractConsequences(state: GameState, results: readonly MatchResult[], ledger: Ledger, ctx: PostContext): GameState {
  const players = { ...state.players };
  const season = state.seasons[state.currentSeasonId];
  const finished = state.clock.week + 1 >= (season?.totalWeeks ?? 22);
  const competition = state.competitions[state.currentCompetitionId];
  const champion = finished ? computeStandings(competition?.clubIds ?? [], Object.values(state.fixtures), {
    playoffSpots: competition?.playoffSpots ?? 4, relegationSpots: competition?.relegationSpots ?? 2,
  })[0]?.clubId : null;
  for (const contract of Object.values(state.contracts)) {
    const player = players[contract.playerId];
    if (!player || player.contractId !== contract.id || contract.clubId !== state.playerClubId) continue;
    const matches = results.filter(r => r.homeClubId === contract.clubId || r.awayClubId === contract.clubId);
    const played = matches.filter(r => (r.playerStats[player.id]?.minutes ?? 0) > 0);
    payBonuses(ledger, contract.clubId, contract, {
      appearances: played.length,
      goals: played.reduce((n,r) => n + (r.playerStats[player.id]?.goals ?? 0), 0),
      cleanSheets: played.filter(r => (r.homeClubId === contract.clubId ? r.awayScore : r.homeScore) === 0).length,
      trophy: champion === contract.clubId,
    }, player.displayName, ctx, true);
    if (matches.length) players[player.id] = { ...player, mental: { ...player.mental,
      morale: clamp(player.mental.morale + rolePromiseMoraleDelta(contract), 1, 99),
    } };
  }
  return { ...state, players };
}
