import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  commerce: { busy: false, boot: vi.fn() },
  sdk: { isConfigured: vi.fn(), addCustomerInfoUpdateListener: vi.fn(), invalidateCustomerInfoCache: vi.fn(), getCustomerInfo: vi.fn(), getOfferings: vi.fn(), checkTrialOrIntroductoryPriceEligibility: vi.fn(), purchasePackage: vi.fn(), purchaseSubscriptionOption: vi.fn(), restorePurchases: vi.fn() },
}));
vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => 'ios' } }));
vi.mock('./revenuecat', () => ({ purchaseAvailability: () => ({ enabled: true }) }));
vi.mock('./store', () => ({ useCommerceStore: { getState: () => mocks.commerce, setState: (state: { busy: boolean }) => Object.assign(mocks.commerce, state) } }));
vi.mock('@revenuecat/purchases-capacitor', () => ({ Purchases: mocks.sdk }));
const now = Date.now();
const info = (active = false, at = now) => ({ requestDate: new Date(at).toISOString(), entitlements: { verification: 'VERIFIED', active: active ? { cf_creator_club: { verification: 'VERIFIED', isActive: true, productIdentifier: 'cf_creator_club_yearly', expirationDate: new Date(now + 86400000).toISOString(), periodType: 'NORMAL', willRenew: true } } : {} } });
beforeEach(() => {
  vi.resetModules(); vi.resetAllMocks(); mocks.commerce.busy = false;
  mocks.commerce.boot.mockResolvedValue(undefined);
  mocks.sdk.isConfigured.mockResolvedValue({ isConfigured: true });
  mocks.sdk.getCustomerInfo.mockResolvedValue({ customerInfo: info() });
  mocks.sdk.getOfferings.mockResolvedValue({ all: { creator_club: { availablePackages: [{ product: { identifier: 'cf_creator_club_yearly', subscriptionPeriod: 'P1Y', price: 29.99, priceString: '$29.99', currencyCode: 'USD', introPrice: null } }] } } });
  mocks.sdk.checkTrialOrIntroductoryPriceEligibility.mockResolvedValue({});
});
describe('membership native lifecycle', () => {
  it.each(['1', '20'])('does not grant benefits on cancelled/pending response %s', async code => {
    const { useMembershipStore: store } = await import('./membershipStore');
    await store.getState().refresh();
    mocks.sdk.purchasePackage.mockRejectedValue({ code });
    await store.getState().buy('cf_creator_club_yearly');
    expect(store.getState().member).toBeNull();
    expect(store.getState().busy).toBe(false);
    expect(mocks.commerce.busy).toBe(false);
  });
  it('restores verified access and applies a newer revocation while ignoring old callbacks', async () => {
    const { useMembershipStore: store } = await import('./membershipStore');
    await store.getState().refresh();
    mocks.sdk.restorePurchases.mockResolvedValue({ customerInfo: info(true, now + 1) });
    await store.getState().restore();
    expect(store.getState().member?.productId).toBe('cf_creator_club_yearly');
    const deliver = mocks.sdk.addCustomerInfoUpdateListener.mock.calls[0]![0];
    deliver(info(false, now + 2));
    expect(store.getState().member).toBeNull();
    deliver(info(true, now + 1));
    expect(store.getState().member).toBeNull();
  });
  it('never turns an unverified checkout response into access', async () => {
    const { useMembershipStore: store } = await import('./membershipStore');
    await store.getState().refresh();
    mocks.sdk.purchasePackage.mockResolvedValue({ customerInfo: { ...info(true), entitlements: { ...info(true).entitlements, verification: 'FAILED' } } });
    await store.getState().buy('cf_creator_club_yearly');
    expect(store.getState().member).toBeNull();
    expect(store.getState().error).toContain('did not confirm');
  });
  it('does not overlap an existing pack purchase', async () => {
    const { useMembershipStore: store } = await import('./membershipStore');
    await store.getState().refresh(); mocks.commerce.busy = true;
    await store.getState().buy('cf_creator_club_yearly');
    expect(mocks.sdk.purchasePackage).not.toHaveBeenCalled();
    expect(mocks.commerce.busy).toBe(true);
  });
});
