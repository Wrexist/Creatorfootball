import { Capacitor } from '@capacitor/core';
import type { CustomerInfo, PurchasesPackage } from '@revenuecat/purchases-capacitor';
import { isProductId, type ProductId } from './catalog';
import type { PurchaseAdapter, PurchaseSnapshot } from './controller';
import { publicKeyKind } from './config';

export function purchaseAvailability(): { enabled: boolean; reason: string; key: string } {
  const platform = Capacitor.getPlatform();
  if (!Capacitor.isNativePlatform() || (platform !== 'ios' && platform !== 'android')) return { enabled: false, key: '', reason: 'Buy and restore packs in the Android or iPhone app using your store account. Free content works here in the browser.' };
  const key: string = (platform === 'ios' ? import.meta.env.VITE_REVENUECAT_IOS_KEY : import.meta.env.VITE_REVENUECAT_ANDROID_KEY) ?? '';
  const kind = publicKeyKind(platform, key);
  if (kind === 'missing' || kind === 'invalid') return { enabled: false, key: '', reason: 'Purchases are not connected in this build. Your career and included content are fully available.' };
  return { enabled: true, reason: '', key };
}

/** Never infer ownership from a saved game, successful checkout alone, or a product price. */
export function verifiedSnapshot(info: CustomerInfo): PurchaseSnapshot {
  const trusted = new Set(['VERIFIED', 'VERIFIED_ON_DEVICE']);
  if (!trusted.has(info.entitlements.verification)) throw new Error('Purchase verification failed. No new content was unlocked; please restore when connected.');
  const owned: ProductId[] = [];
  for (const [id, entitlement] of Object.entries(info.entitlements.active)) {
    if (isProductId(id) && entitlement.isActive && entitlement.productIdentifier === id && trusted.has(entitlement.verification)) owned.push(id);
  }
  const checkedAt = Date.parse(info.requestDate);
  if (!Number.isFinite(checkedAt)) throw new Error('Purchase verification did not include a valid date.');
  return { owned, checkedAt };
}

export async function revenueCatAdapter(): Promise<PurchaseAdapter> {
  const availability = purchaseAvailability();
  if (!availability.enabled) throw new Error(availability.reason);
  const { Purchases, ENTITLEMENT_VERIFICATION_MODE } = await import('@revenuecat/purchases-capacitor');
  const configured = await Purchases.isConfigured();
  if (!configured.isConfigured) await Purchases.configure({ apiKey: availability.key,
    diagnosticsEnabled: false,
    entitlementVerificationMode: ENTITLEMENT_VERIFICATION_MODE.INFORMATIONAL });
  let packages = new Map<ProductId, PurchasesPackage>();
  return {
    snapshot: async () => verifiedSnapshot((await Purchases.getCustomerInfo()).customerInfo),
    products: async () => {
      const offerings = await Purchases.getOfferings();
      packages = new Map();
      for (const item of offerings.current?.availablePackages ?? []) {
        if (isProductId(item.product.identifier) && item.product.subscriptionPeriod === null) packages.set(item.product.identifier, item);
      }
      return [...packages].map(([id, item]) => ({ id, price: item.product.priceString, title: item.product.title }));
    },
    purchase: async id => {
      const item = packages.get(id);
      if (!item) throw new Error('This pack is not currently offered by your store. Refresh and try again.');
      let info: CustomerInfo;
      try {
        const result = await Purchases.purchasePackage({ aPackage: item });
        info = result.customerInfo;
      } catch (error) {
        const e = error as { userCancelled?: boolean; code?: string | number };
        if (e.userCancelled || String(e.code) === '1') return { outcome: 'CANCELLED' };
        if (String(e.code) === '20') return { outcome: 'PENDING' };
        throw new Error('The store did not confirm this purchase. If you were charged, use Restore purchases before trying again.');
      }
      const snapshot = verifiedSnapshot(info);
      return { outcome: snapshot.owned.includes(id) ? 'PURCHASED' : 'PENDING', snapshot };
    },
    restore: async () => verifiedSnapshot((await Purchases.restorePurchases()).customerInfo),
    subscribe: async callback => {
      const id = await Purchases.addCustomerInfoUpdateListener(info => {
        try { callback(verifiedSnapshot(info)); } catch { /* Untrusted updates cannot grant or revoke content. */ }
      });
      return () => { void Purchases.removeCustomerInfoUpdateListener({ listenerToRemove: id }); };
    },
  };
}
