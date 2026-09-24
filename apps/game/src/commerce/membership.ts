import type { CustomerInfo, PurchasesPackage, SubscriptionOption } from '@revenuecat/purchases-capacitor';

export const MEMBER_ENTITLEMENT = 'cf_creator_club';
export const MEMBER_OFFERING = 'creator_club';
export const MEMBER_PLANS = [
  { id: 'cf_creator_club_yearly', period: 'P1Y', label: 'Yearly', unit: 'year', usd: 29.99 },
  { id: 'cf_creator_club_monthly', period: 'P1M', label: 'Monthly', unit: 'month', usd: 4.99 },
  { id: 'cf_creator_club_weekly', period: 'P1W', label: 'Weekly', unit: 'week', usd: 1.99 },
] as const;
export type MemberPlanId = typeof MEMBER_PLANS[number]['id'];
export interface Membership {
  productId: MemberPlanId; expiresAt: number; checkedAt: number; willRenew: boolean;
  trial: boolean; billingIssue: boolean;
}
export interface MemberQuote {
  id: MemberPlanId; price: string; amount: number; currency: string;
  trialDays: 0 | 7; package: PurchasesPackage; option?: SubscriptionOption;
}
const trusted = (value: string): boolean => value === 'VERIFIED' || value === 'VERIFIED_ON_DEVICE';
export function membershipFromInfo(info: CustomerInfo): Membership | null {
  if (!trusted(info.entitlements.verification)) throw new Error('Membership could not be verified. Refresh or restore purchases.');
  const e = info.entitlements.active[MEMBER_ENTITLEMENT];
  if (!e || !e.isActive) return null;
  const product = MEMBER_PLANS.find(p => p.id === e.productIdentifier || `${p.id}:standard` === e.productIdentifier);
  const checkedAt = Date.parse(info.requestDate), expiresAt = Date.parse(e.expirationDate ?? '');
  if (!product || !trusted(e.verification) || !Number.isFinite(checkedAt) || !Number.isFinite(expiresAt) || expiresAt <= checkedAt) return null;
  return { productId: product.id, expiresAt, checkedAt, willRenew: e.willRenew, trial: e.periodType === 'TRIAL', billingIssue: !!e.billingIssueDetectedAt };
}
export function membershipActive(member: Membership | null, now = Date.now()): boolean {
  return !!member && member.expiresAt > now && member.checkedAt <= now + 300000;
}
const sevenDays = (period: string): boolean => period === 'P7D' || period === 'P1W';
/** Reject unfamiliar introductory pricing rather than advertise the wrong billing schedule. */
export function memberQuote(item: PurchasesPackage, platform: string, introEligible = false): MemberQuote | null {
  const p = item.product;
  const plan = MEMBER_PLANS.find(x => x.id === p.identifier || `${x.id}:standard` === p.identifier);
  if (!plan || p.subscriptionPeriod !== plan.period) return null;
  if (platform === 'android') {
    const options = p.subscriptionOptions ?? [];
    const valid = (o: SubscriptionOption): boolean => !o.isPrepaid && !o.installmentsInfo && o.fullPricePhase?.billingPeriod.iso8601 === plan.period && o.fullPricePhase.recurrenceMode === 1;
    const trial = plan.period === 'P1Y' ? options.find(o => valid(o) && o.pricingPhases.length === 2 && o.pricingPhases[0]?.price.amountMicros === 0 && sevenDays(o.pricingPhases[0].billingPeriod.iso8601) && o.pricingPhases[0].billingCycleCount === 1) : undefined;
    const option = trial ?? options.find(o => valid(o) && o.isBasePlan && o.pricingPhases.length === 1);
    const price = option?.fullPricePhase?.price;
    if (!option || !price || !Number.isFinite(price.amountMicros) || price.amountMicros <= 0) return null;
    return { id: plan.id, price: price.formatted, amount: price.amountMicros / 1000000, currency: price.currencyCode, trialDays: trial ? 7 : 0, package: item, option };
  }
  if (platform !== 'ios' || !Number.isFinite(p.price) || p.price <= 0 || !p.priceString) return null;
  const intro = p.introPrice;
  if (intro && (plan.period !== 'P1Y' || intro.price !== 0 || !sevenDays(intro.period) || intro.cycles !== 1)) return null;
  return { id: plan.id, price: p.priceString, amount: p.price, currency: p.currencyCode, trialDays: intro && introEligible ? 7 : 0, package: item };
}
export function yearlySaving(quotes: readonly MemberQuote[]): number | null {
  const annual = quotes.find(q => q.id === 'cf_creator_club_yearly');
  const monthly = quotes.find(q => q.id === 'cf_creator_club_monthly');
  if (!annual || !monthly || annual.currency !== monthly.currency || monthly.amount <= 0) return null;
  const percent = Math.floor((1 - annual.amount / (monthly.amount * 12)) * 100);
  return percent > 0 && percent < 100 ? percent : null;
}
