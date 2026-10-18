import { describe, expect, it } from 'vitest';
import type { CustomerInfo, PurchasesPackage } from '@revenuecat/purchases-capacitor';
import { BASE_PACK, ContentRegistry } from '@cf/engine';
import { manageSubscriptionsUrl, membershipActive, membershipFromInfo, memberQuote, yearlySaving } from './membership';
import { MEMBER_ISSUES, MEMBER_LIBRARY, MEMBER_LIBRARY_ID, MEMBER_RELEASES, issueMonthLabel } from './memberLibrary';
import { EXPANSION_PACKS, FREE_PACK_ID } from './packs';
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
    expect(MEMBER_LIBRARY.data.commentary).toHaveLength(16);
    expect(MEMBER_LIBRARY.data.mediaTemplates).toHaveLength(12);
    expect(registry.commentary().map(({ text: _text, ...metadata }) => metadata)).toEqual(base.commentary().map(({ text: _text, ...metadata }) => metadata));
    configureExpansionPacks([MEMBER_LIBRARY_ID], [], true);
    expect(contentRegistry().commentary()).not.toEqual(base.commentary());
    configureExpansionPacks([MEMBER_LIBRARY_ID], [], false);
    expect(contentRegistry().commentary()).toEqual(base.commentary());
  });
});
describe('monthly member library issues', () => {
  const tokens = (...texts: string[]): string[] => [...new Set(texts.flatMap(t => t.match(/\{\w+\}/g) ?? []))].sort();
  const ids = (issue: typeof MEMBER_ISSUES[number]): string[] => [...issue.commentary.map(c => c.id), ...issue.mediaTemplates.map(m => m.id)];
  it('lists First Lights then Autumn Pages, one per consecutive month, none dated in the future', () => {
    expect(MEMBER_RELEASES.map(r => [r.title, r.month, r.commentary, r.stories])).toEqual([['First Lights', '2026-09', 8, 6], ['Autumn Pages', '2026-10', 8, 6]]);
    expect(MEMBER_RELEASES[0]!.id).toBe(MEMBER_LIBRARY_ID);
    expect(MEMBER_RELEASES.map(r => issueMonthLabel(r.month))).toEqual(['September 2026', 'October 2026']);
    for (const r of MEMBER_RELEASES) {
      const [year, month] = r.month.split('-').map(Number);
      expect(Date.UTC(year!, month! - 1, 1)).toBeLessThanOrEqual(Date.now());
    }
    expect(MEMBER_LIBRARY.manifest.description).toContain('16 commentary variations and 12 club-journal stories');
  });
  it('replaces only base text using the replaced entry tokens, and no entry is claimed twice', () => {
    const base = new Map<string, string[]>([
      ...(BASE_PACK.data.commentary ?? []).map(c => [c.id, tokens(c.text)] as const),
      ...(BASE_PACK.data.mediaTemplates ?? []).map(m => [m.id, tokens(m.headline, m.body)] as const),
    ]);
    for (const issue of MEMBER_ISSUES) {
      for (const line of issue.commentary) expect(base.get(line.id), `${issue.title} ${line.id}`).toEqual(expect.arrayContaining(tokens(line.text)));
      for (const story of issue.mediaTemplates) expect(base.get(story.id), `${issue.title} ${story.id}`).toEqual(expect.arrayContaining(tokens(story.headline, story.body)));
    }
    const claimed = MEMBER_ISSUES.flatMap(ids);
    expect(new Set(claimed).size).toBe(claimed.length);
    const october = new Set(ids(MEMBER_ISSUES[1]!));
    const packs = EXPANSION_PACKS.flatMap(p => [...(p.data.commentary ?? []), ...(p.data.mediaTemplates ?? [])].map(x => x.id));
    expect(packs.filter(id => october.has(id))).toEqual([]);
  });
  it('shows October to active members alongside every other pack and removes it on expiry', () => {
    const october = MEMBER_ISSUES[1]!;
    const all = [FREE_PACK_ID, ...EXPANSION_PACKS.map(p => p.manifest.id), MEMBER_LIBRARY_ID];
    configureExpansionPacks(all, ['cf_creator_stories'], true);
    const lines = contentRegistry().commentary(), stories = contentRegistry().mediaTemplates();
    for (const line of october.commentary) expect(lines.find(l => l.id === line.id)?.text).toBe(line.text);
    for (const story of october.mediaTemplates) expect(stories.find(m => m.id === story.id)?.headline).toBe(story.headline);
    configureExpansionPacks(all, ['cf_creator_stories'], false);
    expect(contentRegistry().commentary().some(l => october.commentary.some(c => c.text === l.text))).toBe(false);
  });
});
describe('manage subscription control', () => {
  it('links to the store account page on native and hides it on the web', () => {
    expect(manageSubscriptionsUrl(true, 'ios')).toBe('https://apps.apple.com/account/subscriptions');
    expect(manageSubscriptionsUrl(true, 'android')).toBe('https://play.google.com/store/account/subscriptions');
    expect(manageSubscriptionsUrl(false, 'web')).toBeNull();
    expect(manageSubscriptionsUrl(false, 'ios')).toBeNull();
  });
});
