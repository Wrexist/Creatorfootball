import { Capacitor } from '@capacitor/core';

/**
 * The native launch image's one exit.
 *
 * `capacitor.config.ts` sets `launchAutoHide: false`, so nothing but this call
 * ever removes the launch image. That makes it a single point of failure: a
 * boot path that never reaches it leaves the player staring at a frozen logo
 * with no error, no retry and no way to tell the app is alive. So it is called
 * from more than one place — the normal boot handoff, both error boundaries and
 * a startup failsafe — and must therefore be safe to call any number of times,
 * from anywhere, in any order.
 *
 * Kept apart from `native.ts` so the startup boundary in `app/Entry.tsx` can
 * reach it with a dynamic import that pulls in only Capacitor's core, not the
 * design system's haptics or the rest of the native bridge.
 */

type SplashState = 'shown' | 'hiding' | 'hidden';

let state: SplashState = 'shown';
let pending: Promise<void> = Promise.resolve();

async function hide(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const { SplashScreen } = await import('@capacitor/splash-screen');
  await SplashScreen.hide({ fadeOutDuration: 220 });
}

/**
 * Fade out the native launch image. Idempotent, and never throws or rejects:
 * every caller is already on a failure path or a boot path, and neither may be
 * broken by a cosmetic plugin. A failed attempt is logged and leaves the next
 * call free to try again.
 */
export function hideNativeSplash(): Promise<void> {
  if (state !== 'shown') return pending;
  state = 'hiding';
  pending = hide().then(
    () => { state = 'hidden'; },
    (error: unknown) => {
      state = 'shown';
      console.warn('[native] the launch splash could not be hidden', error);
    },
  );
  return pending;
}
