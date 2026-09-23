import { describe, expect, it } from 'vitest';
import { createNewGame } from './newGame';
import { buildMatchSetup, aiRuleCards } from './matchSetup';
import { applyMatchResult } from './applyResult';
import { GameEventFactory } from './eventFactory';
import { simulateMatch } from '../matches/simulator';
import { BASE_PACK, type CreatorSeasonConfigDef } from '../content';
import { ensureSeniorContracts } from './seniorContracts';

const career = () => createNewGame({ seed: 'ai-card-owner', now: 1000,
  manager: { kind: 'PREMADE', templateId: BASE_PACK.data.managers![0]!.id },
  club: { kind: 'TEMPLATE', templateId: BASE_PACK.data.clubs![0]!.id },
});
describe('AI resource ownership', () => {
  it('plays seeded legal cards and consumes the AI allocation without touching the player inventory', () => {
    const state = career();
    const fixture = Object.values(state.fixtures).find(f => f.homeClubId !== state.playerClubId && f.awayClubId !== state.playerClubId)!;
    const setup = buildMatchSetup(state, fixture, BASE_PACK.data.seasonConfig as CreatorSeasonConfigDef);
    const result = simulateMatch(setup);
    expect(result).toEqual(simulateMatch(setup));
    expect(result.ruleCardsPlayed.length).toBeGreaterThan(0);
    const next = applyMatchResult(state, fixture, result, new GameEventFactory(state, 2000)).state;
    expect(next.inventory).toEqual(state.inventory);
    for (const played of result.ruleCardsPlayed) {
      const club = played.side === 'home' ? fixture.homeClubId : fixture.awayClubId;
      expect(aiRuleCards(state, club)).toContain(played.ruleId);
      expect(aiRuleCards(next, club)).not.toContain(played.ruleId);
    }
  });
  it('keeps the player inventory for simulated fixtures without inventing AI cards for that club', () => {
    const original = career(), state = { ...original, inventory: { ...original.inventory, ruleCards: [] } };
    const fixture = Object.values(state.fixtures).find(f => f.homeClubId === state.playerClubId || f.awayClubId === state.playerClubId)!;
    const setup = buildMatchSetup(state, fixture, BASE_PACK.data.seasonConfig as CreatorSeasonConfigDef);
    expect((fixture.homeClubId === state.playerClubId ? setup.home : setup.away).ruleCards).toEqual([]);
  });
  it('repairs promoted senior contracts once and preserves their agreed wage on later ticks', () => {
    const state = career(), player = state.players[state.clubs[state.playerClubId]!.squad[0]!]!;
    const missing = { ...state, players: { ...state.players, [player.id]: { ...player, contractId: null } } };
    const repaired = ensureSeniorContracts(missing), contractId = repaired.players[player.id]!.contractId!;
    expect(repaired.contracts[contractId]!.wage).toBeGreaterThan(0);
    expect(ensureSeniorContracts(repaired)).toBe(repaired);
  });
});
