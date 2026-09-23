import { useEffect } from 'react';
import { useGameStore } from '@/state/gameStore';
import { configureExpansionPacks } from '@/state/content';
import { useCommerceStore } from './store';
import { purchaseAvailability } from './revenuecat';

/** Gameplay remains local. Only store receipts/anonymous store identity reach RevenueCat. */
export function ExpansionBridge(): null {
  useEffect(() => {
    const sync = (): void => configureExpansionPacks(
      useGameStore.getState().state?.settings.enabledPackIds ?? [], useCommerceStore.getState().owned,
    );
    sync();
    const game = useGameStore.subscribe(sync);
    const commerce = useCommerceStore.subscribe(sync);
    void useCommerceStore.getState().boot();
    const refresh = (): void => {
      if (document.visibilityState === 'visible' && purchaseAvailability().enabled) void useCommerceStore.getState().refresh();
    };
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('online', refresh);
    return () => { game(); commerce(); document.removeEventListener('visibilitychange', refresh); window.removeEventListener('online', refresh); };
  }, []);
  return null;
}
