import { useEffect, useState } from 'react';
import { useMembershipStore } from '@/commerce/membershipStore';
import { membershipActive } from '@/commerce/membership';
import { purchaseAvailability } from '@/commerce/revenuecat';
import { useGameStore } from '@/state/gameStore';
import { CreatorClub } from './CreatorClub';
import { launchOfferDue } from '@/commerce/launchOffer';

const KEY = 'cf.membership.lastLaunchOffer';
let consideredThisSession = false;
/** Only mounted on a loaded career's Home, never over onboarding or a match. */
export function MembershipLaunchPrompt() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (consideredThisSession || !purchaseAvailability().enabled) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        await useMembershipStore.getState().refresh();
        if (cancelled || consideredThisSession) return;
        consideredThisSession = true;
        const membership = useMembershipStore.getState();
        const game = useGameStore.getState();
        if (!game.state || game.busy || game.unsaved || game.saveError || game.saveConflict) return;
        try {
          const last = Number(localStorage.getItem(KEY) ?? 0);
          if (!launchOfferDue(last, Date.now(), membershipActive(membership.member), membership.ready && !membership.error && membership.quotes.length > 0)) return;
          localStorage.setItem(KEY, String(Date.now()));
          setShow(true);
        } catch { /* Storage unavailable: avoid repeated unsolicited offers. */ }
      })();
    }, 1200);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, []);
  return show ? <CreatorClub initiallyOpen hideBanner /> : null;
}
