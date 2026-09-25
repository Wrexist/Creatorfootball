import { create } from 'zustand';
import { Capacitor } from '@capacitor/core';
import { purchaseAvailability } from './revenuecat';
import { useCommerceStore } from './store';
import { MEMBER_OFFERING, memberQuote, membershipActive, membershipFromInfo, type MemberPlanId, type MemberQuote, type Membership } from './membership';
import type { CustomerInfo } from '@revenuecat/purchases-capacitor';

interface MemberState {
  member: Membership | null; checkedAt: number; quotes: readonly MemberQuote[];
  ready: boolean; busy: boolean; error: string | null; message: string | null; revision: number;
  refresh: () => Promise<void>; buy: (id: MemberPlanId) => Promise<Membership | undefined>; restore: () => Promise<void>; tick: () => void;
}
let connection: Promise<void> | null = null;
let refreshing: Promise<void> | null = null;
export const useMembershipStore = create<MemberState>((set, get) => {
  const deliver = (info: CustomerInfo): void => {
    const member = membershipFromInfo(info), checkedAt = Date.parse(info.requestDate);
    if (!Number.isFinite(checkedAt) || checkedAt < get().checkedAt) return;
    set({ member, checkedAt });
  };
  const connect = async (): Promise<void> => {
    connection ??= (async () => {
      if (!purchaseAvailability().enabled) throw new Error(purchaseAvailability().reason);
      await useCommerceStore.getState().boot();
      const { Purchases } = await import('@revenuecat/purchases-capacitor');
      if (!(await Purchases.isConfigured()).isConfigured) throw new Error('Store connection is not ready. Please retry.');
      await Purchases.addCustomerInfoUpdateListener(info => { try { deliver(info); } catch { /* Untrusted updates cannot grant membership. */ } });
    })().catch(error => { connection = null; throw error; });
    await connection;
  };
  return {
    member: null, checkedAt: 0, quotes: [], ready: false, busy: false, error: null, message: null, revision: 0,
    tick: () => set({ revision: get().revision + 1 }),
    refresh: async () => {
      if (!purchaseAvailability().enabled) { set({ ready: true }); return; }
      refreshing ??= (async () => {
        set({ error: null });
        try {
          await connect();
          const { Purchases } = await import('@revenuecat/purchases-capacitor');
          await Purchases.invalidateCustomerInfoCache();
          deliver((await Purchases.getCustomerInfo()).customerInfo);
          const packages = (await Purchases.getOfferings()).all[MEMBER_OFFERING]?.availablePackages ?? [];
          const platform = Capacitor.getPlatform();
          const eligibility = platform === 'ios' ? await Purchases.checkTrialOrIntroductoryPriceEligibility({ productIdentifiers: packages.map(p => p.product.identifier) }).catch(() => ({})) : {};
          const quotes = packages.map(item => memberQuote(item, platform, (eligibility as Record<string, { status: number }>)[item.product.identifier]?.status === 2)).filter((q): q is MemberQuote => !!q);
          set({ quotes, ready: true });
        } catch { set({ error: 'The membership store could not be refreshed. Check your connection and try again.', quotes: [], ready: true }); }
      })().finally(() => { refreshing = null; });
      await refreshing;
    },
    buy: async id => {
      if (get().busy || useCommerceStore.getState().busy || membershipActive(get().member)) return;
      const quote = get().quotes.find(q => q.id === id);
      if (!quote) { set({ error: 'This plan is not available. Refresh its store price.' }); return; }
      set({ busy: true, error: null, message: null }); useCommerceStore.setState({ busy: true });
      try {
        await connect();
        const { Purchases } = await import('@revenuecat/purchases-capacitor');
        const result = quote.option ? await Purchases.purchaseSubscriptionOption({ subscriptionOption: quote.option }) : await Purchases.purchasePackage({ aPackage: quote.package });
        deliver(result.customerInfo);
        set({ message: membershipActive(get().member) ? 'Your membership is ready. Explore your benefits below.' : 'Waiting for store approval. Benefits unlock after verification.' });
        // Only this completed checkout can trigger a welcome reveal. Refresh,
        // restore, cancellations and pending transactions never emit one.
        const purchased = membershipFromInfo(result.customerInfo);
        if (membershipActive(purchased) && purchased?.checkedAt === get().member?.checkedAt) return purchased ?? undefined;
      } catch (error) {
        const e = error as { userCancelled?: boolean; code?: string | number };
        if (e.userCancelled || String(e.code) === '1') set({ message: 'Purchase cancelled. Your free career is unchanged.' });
        else if (String(e.code) === '20') set({ message: 'Waiting for store approval. No benefits have been granted.' });
        else set({ error: 'The store did not confirm membership. If charged, restore before trying again.' });
      } finally { set({ busy: false }); useCommerceStore.setState({ busy: false }); }
    },
    restore: async () => {
      if (get().busy || useCommerceStore.getState().busy) return;
      set({ busy: true, error: null, message: null }); useCommerceStore.setState({ busy: true });
      try {
        await connect(); const { Purchases } = await import('@revenuecat/purchases-capacitor');
        deliver((await Purchases.restorePurchases()).customerInfo);
        set({ message: membershipActive(get().member) ? 'Membership restored.' : 'No active membership was found for this store account.' });
      } catch { set({ error: 'Membership could not be restored. Please retry when connected.' }); }
      finally { set({ busy: false }); useCommerceStore.setState({ busy: false }); }
    },
  };
});
