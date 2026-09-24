import { useEffect } from 'react';
import { useGameStore } from '@/state/gameStore';
import { configureExpansionPacks } from '@/state/content';
import { useCommerceStore } from './store';
import { purchaseAvailability } from './revenuecat';
import { useMembershipStore } from './membershipStore';
import { membershipActive } from './membership';

/** Gameplay remains local. Only store receipts/anonymous store identity reach RevenueCat. */
export function ExpansionBridge(): null {
  useEffect(() => {
    const sync = (): void => configureExpansionPacks(
      useGameStore.getState().state?.settings.enabledPackIds ?? [], useCommerceStore.getState().owned,
      membershipActive(useMembershipStore.getState().member),
    );
    sync();
    const game = useGameStore.subscribe(sync);
    const commerce = useCommerceStore.subscribe(sync);
    const membership = useMembershipStore.subscribe(sync);
    const timer = window.setInterval(() => useMembershipStore.getState().tick(), 30000);
    void useCommerceStore.getState().boot();
    void useMembershipStore.getState().refresh();
    const refresh = (): void => {
      if (document.visibilityState === 'visible' && purchaseAvailability().enabled) void useCommerceStore.getState().refresh();
      useMembershipStore.getState().tick();
      if (document.visibilityState === 'visible') void useMembershipStore.getState().refresh();
    };
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('online', refresh);
    return () => { game(); commerce(); membership(); window.clearInterval(timer); document.removeEventListener('visibilitychange', refresh); window.removeEventListener('online', refresh); };
  }, []);
  return null;
}
