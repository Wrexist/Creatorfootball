import { describe, expect, it } from 'vitest';
import type { CustomerInfo, PurchasesPackage } from '@revenuecat/purchases-capacitor';
import { BASE_PACK, ContentRegistry } from '@cf/engine';
import { membershipActive, membershipFromInfo, memberQuote, yearlySaving } from './membership';
import { MEMBER_LIBRARY, MEMBER_LIBRARY_ID } from './memberLibrary';
import { configureExpansionPacks, contentRegistry } from '@/state/content';

const item = (over = {}): PurchasesPackage => ({ product: { identifier: 'cf_creator_club_yearly', subscriptionPeriod: 'P1Y', price: 29.99, priceString: '$29.99', currencyCode: 'USD', introPrice: { price: 0, period: 'P1W', cycles: 1 }, ...over } } as unknown as PurchasesPackage);
describe('membership purchase boundary', () => {
  it('uses the exact eligible Android trial option and falls back to its base plan', () => {
    const fullPricePhase = { billingPeriod: { iso8601: 'P1Y' }, recurrenceMode: 1, price: { amountMicros: 29990000, formatted: '$29.99', currencyCode: 'USD' } };
    const base = { id: 'standard', isBasePlan: true, isPrepaid: false, fullPricePhase, pricingPhases: [fullPricePhase] };
    const trial = { ...base, id: 'standard:trial', isBasePlan: false, pricingPhases: [{ price: { amountMicros: 0 }, billingPeriod: { iso8601: 'P1W' }, billingCycleCount: 1 }, fullPricePhase] };
    const q = memberQuote(item({ subscriptionOptions: [base, trial] }), 'android');
    expect(q?.trialDays).toBe(7);
    expect(q?.option).toBe(trial);
    expect(memberQuote(item({ subscriptionOptions: [base] }), 'android')?.trialDays).toBe(0);
    expect(memberQuote(item({ subscriptionOptions: [{ ...base, isPrepaid: true }] }), 'android')).toBeNull();
  });
  it('advertises a trial only after store eligibility, rejects mismatched and invalid prices', () => {
    expect(memberQuote(item(), 'ios', true)?.trialDays).toBe(7);
    expect(memberQuote(item(), 'ios')?.trialDays).toBe(0);
    expect(memberQuote(item({ subscriptionPeriod: 'P1M' }), 'ios')).toBeNull();
    expect(memberQuote(item({ price: NaN }), 'ios')).toBeNull();
    expect(memberQuote(item({ introPrice: { price: 1, period: 'P1W', cycles: 1 } }), 'ios')).toBeNull();
    expect(memberQuote(item(), 'web')).toBeNull();
  });
  it('compares actual localized prices only in the same currency', () => {
    const yearly = memberQuote(item(), 'ios')!;
    const monthly = memberQuote(item({ identifier: 'cf_creator_club_monthly', subscriptionPeriod: 'P1M', price: 4.99, introPrice: null }), 'ios')!;
    expect(yearlySaving([yearly, monthly])).toBe(49);
    expect(yearlySaving([yearly, { ...monthly, currency: 'SEK' }])).toBeNull();
  });
  it('requires a trusted active matching entitlement and removes expired access', () => {
    const info = { requestDate: '2026-09-24T12:00:00Z', entitlements: { verification: 'VERIFIED', active: { cf_creator_club: { verification: 'VERIFIED', isActive: true, productIdentifier: 'cf_creator_club_yearly', expirationDate: '2026-10-24T12:00:00Z', willRenew: false, periodType: 'TRIAL' } } } } as unknown as CustomerInfo;
    const member = membershipFromInfo(info)!;
    expect(member.trial).toBe(true);
    expect(membershipActive(member, Date.parse(info.requestDate))).toBe(true);
    expect(membershipActive(member, member.expiresAt)).toBe(false);
    expect(() => membershipFromInfo({ ...info, entitlements: { ...info.entitlements, verification: 'FAILED' } } as CustomerInfo)).toThrow();
    expect(membershipFromInfo({ ...info, entitlements: { ...info.entitlements, active: {} } })).toBeNull();
  });
  it('loads real library variations and revokes them without changing simulation metadata', () => {
    const registry = new ContentRegistry(); registry.load(BASE_PACK); registry.load(MEMBER_LIBRARY);
    const base = new ContentRegistry(); base.load(BASE_PACK);
    expect(MEMBER_LIBRARY.data.commentary).toHaveLength(8);
    expect(MEMBER_LIBRARY.data.mediaTemplates).toHaveLength(6);
    expect(registry.commentary().map(({ text: _text, ...metadata }) => metadata)).toEqual(base.commentary().map(({ text: _text, ...metadata }) => metadata));
    configureExpansionPacks([MEMBER_LIBRARY_ID], [], true);
    expect(contentRegistry().commentary()).not.toEqual(base.commentary());
    configureExpansionPacks([MEMBER_LIBRARY_ID], [], false);
    expect(contentRegistry().commentary()).toEqual(base.commentary());
  });
});
