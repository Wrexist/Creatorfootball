import { describe, expect, it } from 'vitest';
import { launchOfferDue } from './launchOffer';
describe('launch membership offer', () => {
  const now = 1_800_000_000_000;
  it('allows first visit and a return after 72 hours', () => {
    expect(launchOfferDue(0, now, false, true)).toBe(true);
    expect(launchOfferDue(now - 72 * 3600000, now, false, true)).toBe(true);
  });
  it('suppresses members, unavailable purchases and recent dismissals', () => {
    expect(launchOfferDue(0, now, true, true)).toBe(false);
    expect(launchOfferDue(0, now, false, false)).toBe(false);
    expect(launchOfferDue(now - 3600000, now, false, true)).toBe(false);
  });
  it('fails closed for corrupt timestamps or clock rollback', () => {
    for (const last of [NaN, -1, Infinity, now + 1000]) expect(launchOfferDue(last, now, false, true)).toBe(false);
  });
});
