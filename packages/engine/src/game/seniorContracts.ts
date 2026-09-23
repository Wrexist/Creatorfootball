import type { GameState } from './state';
import type { ContractId } from '../core/brand';
import { emptyBonuses } from '../contracts/contract';
import { defaultValuationContext, wageDemand } from '../transfers/valuation';

/** Academy promotion must create the same wage obligation as other recruitment.
 * Also repairs legacy saves whose already-promoted seniors have no contract. */
export function ensureSeniorContracts(state: GameState): GameState {
  const players = { ...state.players }, contracts = { ...state.contracts };
  let changed = false;
  const weeks = (state.seasons[state.currentSeasonId]?.totalWeeks ?? 22) * 2;
  for (const club of Object.values(state.clubs)) for (const id of club.squad) {
    const player = players[id];
    if (!player || player.clubId !== club.id) continue;
    if (player.contractId && contracts[player.contractId]?.clubId === club.id) continue;
    const contractId = `ct_academy_${club.id}_${id}_${state.clock.cycle}` as ContractId;
    contracts[contractId] = { id: contractId, playerId: id, clubId: club.id,
      wage: Math.round(wageDemand(player, defaultValuationContext())), weeksRemaining: weeks, totalWeeks: weeks,
      signingBonus: 0, bonuses: emptyBonuses(), role: 'PROSPECT', releaseClause: null, loyaltyBonus: 0,
      signedCycle: state.clock.cycle, minutesPlayed: 0, minutesAvailable: 0 };
    players[id] = { ...player, contractId };
    changed = true;
  }
  return changed ? { ...state, players, contracts } : state;
}
