import type { GameState } from '../game/state';
import { computeStandings } from '../league/standings';
import { aiCounter } from './negotiation';
import { buildValuationContext } from './market';
import { Rng } from '../core/rng';

/** Calendar-driven talks, independent of whether the Market screen is open. */
export function advanceNegotiations(state: GameState): GameState {
  const competition = state.competitions[state.currentCompetitionId];
  if (!competition) return state;
  const rows = computeStandings(competition.clubIds, Object.values(state.fixtures), competition);
  const cycle = state.clock.cycle + 1;
  const valuation = buildValuationContext(state, { cycle, season: state.clock.season,
    windowOpen: state.transfers.windowOpen, leagueSize: rows.length });
  const negotiations = { ...state.transfers.negotiations };
  for (const neg of Object.values(negotiations)) {
    if (neg.stage === 'FAILED' || neg.stage === 'HIJACKED') continue;
    const player = state.players[neg.playerId], buyingClub = state.clubs[neg.toClubId];
    if (!player || !buyingClub || cycle > neg.deadlineCycle || player.clubId === buyingClub.id) {
      negotiations[neg.id] = { ...neg, stage: 'FAILED', history: [...neg.history, {
        cycle, actor: 'Agent', text: 'Talks expired or the player registration changed.',
      }].slice(-24) };
      continue;
    }
    negotiations[neg.id] = aiCounter(neg, { id: neg.id, cycle, season: state.clock.season, player, buyingClub,
      sellingClub: player.clubId ? state.clubs[player.clubId] ?? null : null,
      contract: player.contractId ? state.contracts[player.contractId] ?? null : null,
      valuation, leaguePosition: Math.max(1, rows.findIndex(r => r.clubId === buyingClub.id) + 1), leagueSize: rows.length,
      managerCharisma: state.managers[state.playerManagerId]?.attributes.mediaHandling ?? 50,
      managerNegotiation: state.managers[state.playerManagerId]?.attributes.negotiation ?? 50,
      rivals: Object.values(state.clubs).filter(c => c.id !== buyingClub.id && c.id !== player.clubId)
        .map(c => ({ clubId: c.id, name: c.shortName, reputation: c.reputation, spendingPower: c.finance.transferBudget })),
    }, new Rng(`${state.seed}:negotiation-age:${cycle}:${neg.id}`));
  }
  return { ...state, transfers: { ...state.transfers, negotiations } };
}
