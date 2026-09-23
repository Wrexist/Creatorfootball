import { describe, expect, it, vi } from 'vitest';
import { BASE_PACK, ContentRegistry } from '@cf/engine';
import type { CustomerInfo } from '@revenuecat/purchases-capacitor';
import { PurchaseController, acceptSnapshot, type PurchaseAdapter } from './controller';
import { verifiedSnapshot } from './revenuecat';
import { availablePackIds, CREATOR_PACK, FREE_PACK } from './packs';

function adapter(): PurchaseAdapter {
  return { snapshot: vi.fn(), products: vi.fn(), subscribe: vi.fn(), purchase: vi.fn(), restore: vi.fn() };
}
describe('RevenueCat purchase boundary', () => {
  it('never delivers a cancelled or pending purchase', async () => {
    for (const outcome of ['CANCELLED','PENDING'] as const) {
      const api=adapter(); const deliver=vi.fn(); vi.mocked(api.purchase).mockResolvedValue({outcome});
      expect(await new PurchaseController(api,deliver).purchase('cf_club_nights')).toBe(outcome);
      expect(deliver).not.toHaveBeenCalled();
    }
  });
  it('serializes purchase and restore, then releases after a failure', async () => {
    const api=adapter(); let fail!: (error: Error)=>void;
    vi.mocked(api.purchase).mockReturnValue(new Promise((_,reject)=>{fail=reject;}));
    const controller=new PurchaseController(api,vi.fn());
    const purchase=controller.purchase('cf_club_nights');
    await expect(controller.purchase('cf_club_nights')).rejects.toThrow('in progress');
    await expect(controller.restore()).rejects.toThrow('in progress');
    fail(new Error('offline')); await expect(purchase).rejects.toThrow('offline');
    vi.mocked(api.restore).mockResolvedValue({owned:['cf_club_nights'],checkedAt:20});
    await expect(controller.restore()).resolves.toBeUndefined();
  });
  it('deduplicates delivery, revokes on a newer verified empty response, ignores stale responses', () => {
    const initial=acceptSnapshot(null,{owned:['cf_club_nights','cf_club_nights'],checkedAt:10});
    expect(initial.owned).toEqual(['cf_club_nights']);
    const refunded=acceptSnapshot(initial,{owned:[],checkedAt:20});
    expect(refunded.owned).toEqual([]);
    expect(acceptSnapshot(refunded,initial)).toBe(refunded);
    expect(()=>acceptSnapshot(null,{owned:[],checkedAt:NaN})).toThrow();
  });
  const info = (verification='VERIFIED', active=true, productIdentifier='cf_club_nights'): CustomerInfo => ({
    requestDate:'2026-09-22T08:00:00Z', entitlements:{verification, active:{cf_club_nights:{isActive:active,productIdentifier,verification}}},
  } as unknown as CustomerInfo);
  it('requires verified responses and matching active entitlement/product identities', () => {
    expect(verifiedSnapshot(info()).owned).toEqual(['cf_club_nights']);
    expect(verifiedSnapshot(info('VERIFIED_ON_DEVICE')).owned).toEqual(['cf_club_nights']);
    for(const verification of ['FAILED','NOT_REQUESTED']) expect(()=>verifiedSnapshot(info(verification))).toThrow('verification');
    expect(verifiedSnapshot(info('VERIFIED',false)).owned).toEqual([]);
    expect(verifiedSnapshot(info('VERIFIED',true,'another_product')).owned).toEqual([]);
  });
});

describe('cosmetic content isolation', () => {
  it('imports cannot enable unowned paid packs', () => {
    expect(availablePackIds(['touchline-voices','creator-stories','club-nights','unknown'],[])).toEqual(['touchline-voices']);
    expect(availablePackIds(['creator-stories','club-nights'],['cf_creator_stories'])).toEqual(['creator-stories']);
  });
  it('loads advertised content without changing IDs, RNG weights or gameplay metadata', () => {
    expect(FREE_PACK.data.commentary).toHaveLength(8);
    expect(CREATOR_PACK.data.commentary).toHaveLength(16);
    expect(CREATOR_PACK.data.mediaTemplates).toHaveLength(12);
    const registry=new ContentRegistry(); registry.load(BASE_PACK);
    for(const pack of [FREE_PACK,CREATOR_PACK]) registry.load(pack);
    const base=new ContentRegistry(); base.load(BASE_PACK);
    expect(registry.commentary().map(({text: _text,...rest})=>rest)).toEqual(base.commentary().map(({text: _text,...rest})=>rest));
    expect(registry.mediaTemplates().map(({headline:_headline,body:_body,...rest})=>rest)).toEqual(base.mediaTemplates().map(({headline:_headline,body:_body,...rest})=>rest));
    expect(registry.commentary()).not.toEqual(base.commentary());
  });
});
