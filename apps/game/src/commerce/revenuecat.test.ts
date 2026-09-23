import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({
  native:true, platform:'android',
  sdk:{ isConfigured:vi.fn(), configure:vi.fn(), getCustomerInfo:vi.fn(), getOfferings:vi.fn(), purchasePackage:vi.fn(), restorePurchases:vi.fn(), addCustomerInfoUpdateListener:vi.fn(), removeCustomerInfoUpdateListener:vi.fn() },
}));
vi.mock('@capacitor/core',()=>({Capacitor:{isNativePlatform:()=>mocks.native,getPlatform:()=>mocks.platform}}));
vi.mock('@revenuecat/purchases-capacitor',()=>({Purchases:mocks.sdk,ENTITLEMENT_VERIFICATION_MODE:{INFORMATIONAL:'INFORMATIONAL'}}));
import { purchaseAvailability, revenueCatAdapter } from './revenuecat';
const verified={requestDate:'2026-09-22T08:00:00Z',entitlements:{verification:'VERIFIED',active:{cf_club_nights:{isActive:true,verification:'VERIFIED',productIdentifier:'cf_club_nights'}}}};
beforeEach(()=>{
  vi.clearAllMocks(); mocks.native=true; mocks.platform='android';
  vi.stubEnv('VITE_REVENUECAT_ANDROID_KEY','goog_public_test_key');
  mocks.sdk.isConfigured.mockResolvedValue({isConfigured:false});
  mocks.sdk.configure.mockResolvedValue(undefined);
  mocks.sdk.getOfferings.mockResolvedValue({current:{availablePackages:[{identifier:'nights',product:{identifier:'cf_club_nights',subscriptionPeriod:null,priceString:'29,00 kr',title:'Club Nights'}}]}});
  mocks.sdk.getCustomerInfo.mockResolvedValue({customerInfo:verified});
  mocks.sdk.restorePurchases.mockResolvedValue({customerInfo:verified});
  mocks.sdk.purchasePackage.mockResolvedValue({customerInfo:verified});
});
afterEach(()=>vi.unstubAllEnvs());
describe('native RevenueCat adapter contract',()=>{
  it('keeps web and unconfigured native builds disconnected',async()=>{
    mocks.native=false; expect(purchaseAvailability().enabled).toBe(false);
    await expect(revenueCatAdapter()).rejects.toThrow('Android');
    mocks.native=true; vi.stubEnv('VITE_REVENUECAT_ANDROID_KEY',''); expect(purchaseAvailability().enabled).toBe(false);
    vi.stubEnv('VITE_REVENUECAT_ANDROID_KEY','sk_secret'); expect(purchaseAvailability().enabled).toBe(false);
    expect(mocks.sdk.configure).not.toHaveBeenCalled();
  });
  it('configures anonymous verified purchases, exposes store-localized prices and delivers verified ownership',async()=>{
    const adapter=await revenueCatAdapter();
    expect(mocks.sdk.configure).toHaveBeenCalledWith({apiKey:'goog_public_test_key',diagnosticsEnabled:false,entitlementVerificationMode:'INFORMATIONAL'});
    expect(await adapter.products()).toEqual([{id:'cf_club_nights',price:'29,00 kr',title:'Club Nights'}]);
    expect((await adapter.purchase('cf_club_nights')).outcome).toBe('PURCHASED');
    expect((await adapter.restore()).owned).toEqual(['cf_club_nights']);
    expect(mocks.sdk.purchasePackage.mock.calls[0]![0].aPackage.identifier).toBe('nights');
  });
  it('rejects wrong-platform public keys before configuring the native SDK',async()=>{
    vi.stubEnv('VITE_REVENUECAT_ANDROID_KEY','appl_wrong_platform');
    expect(purchaseAvailability().enabled).toBe(false);
    await expect(revenueCatAdapter()).rejects.toThrow('not connected');
    mocks.platform='ios'; vi.stubEnv('VITE_REVENUECAT_IOS_KEY','goog_wrong_platform');
    expect(purchaseAvailability().enabled).toBe(false);
    expect(mocks.sdk.configure).not.toHaveBeenCalled();
  });
  it('refuses missing products and filters renewable subscriptions from the one-time catalog',async()=>{
    mocks.sdk.getOfferings.mockResolvedValue({current:{availablePackages:[{product:{identifier:'cf_club_nights',subscriptionPeriod:'P1M'}}]}});
    const adapter=await revenueCatAdapter(); expect(await adapter.products()).toEqual([]);
    await expect(adapter.purchase('cf_club_nights')).rejects.toThrow('not currently offered');
    expect(mocks.sdk.purchasePackage).not.toHaveBeenCalled();
  });
  it('does not report a successful store charge as cancelled if receipt verification fails',async()=>{
    const adapter=await revenueCatAdapter(); await adapter.products();
    mocks.sdk.purchasePackage.mockResolvedValue({customerInfo:{...verified,entitlements:{verification:'FAILED',active:{}}}});
    await expect(adapter.purchase('cf_club_nights')).rejects.toThrow('Purchase verification failed');
  });
  it.each([{code:'1',outcome:'CANCELLED'},{code:'20',outcome:'PENDING'}])('handles store response $code without granting content',async({code,outcome})=>{
    const adapter=await revenueCatAdapter(); await adapter.products(); mocks.sdk.purchasePackage.mockRejectedValue({code});
    expect(await adapter.purchase('cf_club_nights')).toEqual({outcome});
  });
  it('listens for refund updates and removes the native listener on teardown',async()=>{
    const adapter=await revenueCatAdapter(); const callback=vi.fn(); mocks.sdk.addCustomerInfoUpdateListener.mockResolvedValue('listener');
    const unsubscribe=await adapter.subscribe(callback);
    const listener=mocks.sdk.addCustomerInfoUpdateListener.mock.calls[0]![0];
    listener({...verified,entitlements:{verification:'VERIFIED',active:{}}});
    expect(callback.mock.calls[0]![0].owned).toEqual([]);
    listener({...verified,entitlements:{verification:'FAILED',active:{}}}); expect(callback).toHaveBeenCalledTimes(1);
    unsubscribe(); expect(mocks.sdk.removeCustomerInfoUpdateListener).toHaveBeenCalledWith({listenerToRemove:'listener'});
  });
});
