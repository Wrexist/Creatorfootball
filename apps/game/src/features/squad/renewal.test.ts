import { describe, expect, it } from 'vitest';
import type { NegotiationTerms, RenewalResponse } from '@cf/engine';
import { canOfferRenewal, lowballOffer, renewalOutcomeCopy } from './renewal';

describe('canOfferRenewal', () => {
  it('opens well before the warning threshold, for our own players only', () => {
    expect(canOfferRenewal(30, true)).toBe(true);
    expect(canOfferRenewal(31, true)).toBe(false);
    expect(canOfferRenewal(2, false)).toBe(false);
  });
});

describe('lowballOffer', () => {
  const terms: NegotiationTerms = {
    fee: 0,
    wage: 20_000,
    years: 3,
    role: 'FIRST_TEAM',
    signingBonus: 60_000,
    releaseClause: 4_000_000,
    goalBonus: 2_000,
    appearanceBonus: 1_000,
  };

  it('halves the money so the engine can actually refuse or take insult', () => {
    const low = lowballOffer(terms);
    expect(low.wage).toBe(10_000);
    expect(low.signingBonus).toBe(30_000);
    expect(low.goalBonus).toBe(1_000);
    expect(low.appearanceBonus).toBe(500);
  });

  it('keeps the shape — years, role and clause are not what is being haggled', () => {
    const low = lowballOffer(terms);
    expect(low.years).toBe(terms.years);
    expect(low.role).toBe(terms.role);
    expect(low.releaseClause).toBe(terms.releaseClause);
  });
});

describe('renewalOutcomeCopy', () => {
  const response = (verdict: RenewalResponse['verdict'], message: string): RenewalResponse => ({
    verdict,
    counter: null,
    moraleDelta: 0,
    loyaltyDelta: 0,
    message,
  });

  it('celebrates a signature', () => {
    const copy = renewalOutcomeCopy(response('SIGNED', 'Terms agreed.'));
    expect(copy.tone).toBe('success');
    expect(copy.title).toBe('Deal done');
    expect(copy.detail).toContain('Terms agreed');
  });

  it('treats a counter as something to come back to, not a failure', () => {
    expect(renewalOutcomeCopy(response('COUNTERED', 'He came back.')).tone).toBe('neutral');
  });

  it('owns the damage of an insulted player', () => {
    const copy = renewalOutcomeCopy(response('INSULTED', 'He took it badly.'));
    expect(copy.tone).toBe('error');
    expect(copy.detail).toContain('He took it badly');
  });

  it('marks a plain refusal as bad news', () => {
    expect(renewalOutcomeCopy(response('REFUSED', 'No.')).tone).toBe('error');
  });
});
