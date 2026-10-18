/**
 * The Android back button, as a screen sees it.
 *
 * The native bridge (`native.ts`) answers the hardware back button by closing
 * the top dialog or navigating back. A screen that must not be left silently —
 * the live match, where leaving decides the result — registers here and runs
 * its own confirmed exit instead. This file imports nothing, so a feature
 * screen can use it without pulling the native bridge into its chunk.
 */

const NATIVE_BACK_EVENT = 'cf:native-back';

/** True when a mounted screen took the press; the bridge must then do nothing. */
export function claimedByScreen(): boolean {
  return !window.dispatchEvent(new Event(NATIVE_BACK_EVENT, { cancelable: true }));
}

/** Take over the back button while mounted. Returns the teardown. */
export function onNativeBack(handler: () => void): () => void {
  const listener = (event: Event): void => {
    event.preventDefault();
    handler();
  };
  window.addEventListener(NATIVE_BACK_EVENT, listener);
  return () => window.removeEventListener(NATIVE_BACK_EVENT, listener);
}
