import { create } from 'zustand';
import { PurchaseController, acceptSnapshot, type ProductQuote, type PurchaseSnapshot, type PurchaseAdapter } from './controller';
import { purchaseAvailability, revenueCatAdapter } from './revenuecat';
import { type ProductId } from './catalog';

interface CommerceState {
  ready: boolean; busy: boolean; owned: readonly ProductId[]; quotes: readonly ProductQuote[];
  message: string | null; error: string | null; checkedAt: number | null;
  boot: () => Promise<void>; refresh: () => Promise<void>;
  buy: (id: ProductId) => Promise<void>; restore: () => Promise<void>;
}
let controller: PurchaseController | null = null;
let adapter: PurchaseAdapter | null = null;
let booting: Promise<void> | null = null;
let latest: PurchaseSnapshot | null = null;
export const useCommerceStore = create<CommerceState>((set, get) => {
  const deliver = (snapshot: PurchaseSnapshot): void => {
    latest = acceptSnapshot(latest, snapshot);
    set({ owned: latest.owned, checkedAt: latest.checkedAt });
    // Only the SDK's verified native cache is trusted. Never load ownership from localStorage or a career file.
  };
  return {
    ready: false, busy: false, owned: [], quotes: [], message: null, error: null, checkedAt: null,
    boot: async () => {
      if (!purchaseAvailability().enabled) { set({ ready: true }); return; }
      booting ??= (async () => {
        if (!adapter) {
          const connected = await revenueCatAdapter();
          // Commit the connection only after the listener exists. A failed
          // registration must be retried, including pending/refund delivery.
          await connected.subscribe(deliver);
          adapter = connected;
          controller = new PurchaseController(connected, deliver);
        }
        try { deliver(await adapter.snapshot()); } catch (error) { set({ error: String(error) }); }
        set({ quotes: await adapter.products(), ready: true });
      })().catch(error => { booting = null; set({ ready: true, error: String(error) }); });
      await booting;
    },
    refresh: async () => {
      if (get().busy) return;
      set({ busy: true, error: null, message: null });
      try {
        await get().boot();
        if (!adapter) throw new Error(purchaseAvailability().reason);
        deliver(await adapter.snapshot());
        set({ quotes: await adapter.products(), message: 'Purchases refreshed.' });
      } catch (error) { set({ error: String(error) }); }
      finally { set({ busy: false }); }
    },
    buy: async id => {
      if (get().busy || get().owned.includes(id)) return;
      set({ busy: true, error: null, message: null });
      try {
        await get().boot();
        if (!controller) throw new Error(purchaseAvailability().reason || 'The store is not connected.');
        const result = await controller.purchase(id);
        set({ message: result === 'PURCHASED' ? 'Pack unlocked. Enable it in Content packs.'
          : result === 'CANCELLED' ? 'Purchase cancelled. No content was added.'
            : 'Waiting for store approval. The pack will unlock when your store confirms it.' });
      } catch (error) { set({ error: String(error) }); }
      finally { set({ busy: false }); }
    },
    restore: async () => {
      if (get().busy) return;
      set({ busy: true, error: null, message: null });
      try {
        await get().boot();
        if (!controller) throw new Error(purchaseAvailability().reason || 'The store is not connected.');
        await controller.restore();
        set({ message: get().owned.length ? 'Your purchases are restored. Choose your packs in Content.' : 'No purchases were found for this store account.' });
      } catch (error) { set({ error: String(error) }); }
      finally { set({ busy: false }); }
    },
  };
});
