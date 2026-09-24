import { describe, expect, it } from 'vitest';
import { buildTestWorld } from '../simulation/fixtures';
import { claimMemberBenefit } from './membership';
import { MEMBER_SUPERSTAR as star } from './memberSuperstar';
import { overallFor } from '../players/attributes';
import { MemoryStorage } from '../persistence/storage';
import { loadGame, saveGame, validateState } from '../persistence/save';

const proof = { checkedAt: Date.parse('2026-09-24'), expiresAt: Date.parse('2026-12-24'), trial: false };
describe('member superstar signing', () => {
  it('registers a real rated player and disclosed contract without replacing the lineup', async () => {
    const { state } = buildTestWorld();
    const signed = claimMemberBenefit(state, proof, 'superstar');
    const player = signed.players[star.id]!;
    expect(player.overall).toBe(90);
    expect(overallFor(player.attributes, player.position)).toBe(player.overall);
    expect(player.potential).toBe(95);
    expect(signed.contracts[star.contractId]).toMatchObject({ wage: 5000, weeksRemaining: 52, role: 'STAR', signingBonus: 0 });
    expect(signed.clubs[state.playerClubId]!.squad).toEqual([...state.clubs[state.playerClubId]!.squad, star.id]);
    expect(state.players[star.id]).toBeUndefined();
    expect(player.marketValue).toBeGreaterThan(0);
    expect(state.clubs[state.playerClubId]!.squad.some(id => state.players[id]?.shirtNumber === player.shirtNumber)).toBe(false);
    expect(validateState(signed)).toEqual([]);
    const storage = new MemoryStorage();
    expect((await saveGame(storage, signed, 1)).ok).toBe(true);
    const loaded = await loadGame(storage);
    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      expect(loaded.value.state.players[star.id]).toEqual(player);
      expect(claimMemberBenefit(loaded.value.state, proof, 'superstar')).toBe(loaded.value.state);
    }
  });
  it('rejects trial and expired access and never grants a second welcome signing', () => {
    const { state } = buildTestWorld();
    expect(claimMemberBenefit(state, { ...proof, trial: true }, 'superstar')).toBe(state);
    expect(claimMemberBenefit(state, { ...proof, expiresAt: proof.checkedAt }, 'superstar')).toBe(state);
    const signed = claimMemberBenefit(state, proof, 'superstar');
    const later = { ...signed, players: Object.fromEntries(Object.entries(signed.players).filter(([id]) => id !== star.id)), contracts: Object.fromEntries(Object.entries(signed.contracts).filter(([id]) => id !== star.contractId)) };
    expect(claimMemberBenefit(later, { ...proof, checkedAt: Date.parse('2026-11-01') }, 'superstar')).toBe(later);
  });
});
