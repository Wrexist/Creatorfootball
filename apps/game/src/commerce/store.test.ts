import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PurchaseSnapshot } from './controller';

const mocks = vi.hoisted(() => ({ factory: vi.fn(), subscribe: vi.fn(), snapshot: vi.fn(), products: vi.fn(), purchase: vi.fn(), restore: vi.fn() }));
vi.mock('./revenuecat', () => ({ purchaseAvailability: () => ({ enabled: true }), revenueCatAdapter: mocks.factory }));
beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  mocks.factory.mockResolvedValue({ subscribe: mocks.subscribe, snapshot: mocks.snapshot, products: mocks.products, purchase: mocks.purchase, restore: mocks.restore });
  mocks.subscribe.mockResolvedValue(() => {});
  mocks.snapshot.mockResolvedValue({ owned: [], checkedAt: 100 });
  mocks.products.mockResolvedValue([]);
});

describe('purchase connection recovery', () => {
  it('retries failed listener registration and receives pending purchase and refund updates', async () => {
    mocks.subscribe.mockRejectedValueOnce(new Error('Bridge temporarily unavailable'));
    const { useCommerceStore: store } = await import('./store');
    await store.getState().boot();
    expect(store.getState().error).toContain('Bridge temporarily unavailable');
    await store.getState().refresh();
    expect(mocks.subscribe).toHaveBeenCalledTimes(2);
    const deliver = mocks.subscribe.mock.calls[1]![0] as (snapshot: PurchaseSnapshot) => void;
    deliver({ owned: ['cf_club_nights'], checkedAt: 200 });
    expect(store.getState().owned).toEqual(['cf_club_nights']);
    deliver({ owned: [], checkedAt: 300 });
    expect(store.getState().owned).toEqual([]);
    expect(store.getState().error).toBeNull();
  });
  it('shares concurrent startup and keeps the listener when offerings fail then recover', async () => {
    mocks.products.mockRejectedValueOnce(new Error('Store offline'));
    const { useCommerceStore: store } = await import('./store');
    await Promise.all([store.getState().boot(), store.getState().boot()]);
    expect(mocks.factory).toHaveBeenCalledTimes(1);
    expect(mocks.subscribe).toHaveBeenCalledTimes(1);
    await store.getState().refresh();
    expect(store.getState().error).toBeNull();
    expect(mocks.subscribe).toHaveBeenCalledTimes(1);
  });
});
