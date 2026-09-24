import { describe, expect, it } from 'vitest';
import { buildTestWorld } from '../simulation/fixtures';
import { claimMemberBenefit, MEMBER_CREATORS, MEMBER_MONTHLY_CASH } from './membership';

const proof = { checkedAt: Date.parse('2026-09-24T12:00:00Z'), expiresAt: Date.parse('2026-12-24T12:00:00Z'), trial: false };
describe('Creator Club career benefits', () => {
  it('credits actual club funds once across reloads and game weeks', () => {
    const { state } = buildTestWorld();
    const credited = claimMemberBenefit(state, proof, 'cash');
    expect(credited.ledger.balances[`club:${state.playerClubId}`]!.CASH).toBe(state.ledger.balances[`club:${state.playerClubId}`]!.CASH + MEMBER_MONTHLY_CASH);
    const reloaded = JSON.parse(JSON.stringify(credited)) as typeof state;
    expect(claimMemberBenefit(reloaded, proof, 'cash')).toBe(reloaded);
    const later = { ...reloaded, clock: { ...reloaded.clock, cycle: reloaded.clock.cycle + 300 } };
    expect(claimMemberBenefit(later, proof, 'cash')).toBe(later);
    expect(claimMemberBenefit(later, { ...proof, checkedAt: Date.parse('2026-10-01T00:00:00Z') }, 'cash').ledger.balances[`club:${state.playerClubId}`]!.CASH).toBe(state.ledger.balances[`club:${state.playerClubId}`]!.CASH + MEMBER_MONTHLY_CASH * 2);
  });
  it('rejects trials, expired periods and invalid timestamps', () => {
    const { state } = buildTestWorld();
    for (const p of [{ ...proof, trial: true }, { ...proof, expiresAt: proof.checkedAt }, { ...proof, checkedAt: NaN }]) {
      expect(claimMemberBenefit(state, p, 'cash')).toBe(state);
      expect(claimMemberBenefit(state, p, 'creator', MEMBER_CREATORS[0].id)).toBe(state);
    }
  });
  it('signs one real creator without a retainer and prevents claiming the other this month', () => {
    const { state } = buildTestWorld();
    const id = MEMBER_CREATORS[0].id;
    const signed = claimMemberBenefit(state, proof, 'creator', id);
    expect(signed.creators[id]).toMatchObject({ clubId: state.playerClubId, dealWeeksRemaining: 4, retainerPerCycle: 0 });
    expect(signed.clubs[state.playerClubId]!.creatorIds).toContain(id);
    expect(claimMemberBenefit(signed, proof, 'creator', MEMBER_CREATORS[1].id)).toBe(signed);
    expect(claimMemberBenefit(signed, proof, 'cash')).not.toBe(signed);
    expect(claimMemberBenefit(state, proof, 'creator', 'invented')).toBe(state);
  });
});
