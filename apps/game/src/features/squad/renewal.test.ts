import { describe, expect, it } from 'vitest';
import { canOfferRenewal, renewalOutcomeCopy } from './renewal';
import type { RenewalResponse } from '@cf/engine';

describe('canOfferRenewal', () => {
  it('opens well before the warning threshold, for our own players only', () => {
    expect(canOfferRenewal(30, true)).toBe(true);
    expect(canOfferRenewal(31, true)).toBe(false);
    expect(canOfferRenewal(2, false)).toBe(false);
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
