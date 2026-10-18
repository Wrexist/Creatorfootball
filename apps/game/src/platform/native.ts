import { Capacitor } from '@capacitor/core';
import { setHapticDriver } from '@/design/haptics';
import { claimedByScreen } from './nativeBack';

/**
 * The native shell's only integration point.
 *
 * Everything the design system and the game know is "a capability exists";
 * this file is where Capacitor makes those capabilities real. It is imported
 * exclusively from `app/App.tsx` boot, and every plugin arrives by dynamic
 * import so a plain web build never pulls native code into its chunks.
 *
 * The splash screen is configured with `launchAutoHide: false`, which means
 * the *app* owns the handoff: the native splash stays up until React has
 * painted its own splash and booted, then `hideNativeSplash()` fades it. This
 * kills the white-flash gap between launch image and first frame. Both error
 * boundaries and a startup failsafe call it too, so a crash can never leave the
 * launch image up for good.
 */

export function isNativeShell(): boolean {
  return Capacitor.isNativePlatform();
}

/** Install platform drivers. A no-op in a plain browser. */
export async function installNativeBridge(): Promise<void> {
  if (!isNativeShell()) return;

  if (Capacitor.getPlatform() === 'android') {
    const { App } = await import('@capacitor/app');
    await App.addListener('backButton', ({ canGoBack }) => {
      if (document.querySelector('[role="dialog"]')) {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        return;
      }
      // A screen that runs its own confirmed exit (the live match) claims the press.
      if (claimedByScreen()) return;
      if (canGoBack) window.history.back();
      else void App.minimizeApp();
    });
  }

  const [{ Haptics, ImpactStyle, NotificationType }, { StatusBar, Style }] = await Promise.all([
    import('@capacitor/haptics'),
    import('@capacitor/status-bar'),
  ]);

  // Maps the design system's six haptic kinds onto iOS's UIFeedbackGenerator
  // vocabulary. `celebrate` layers two calls because a single heavy tap does
  // not read as a moment — the pause is what makes it land as one.
  setHapticDriver({
    selection: () => void Haptics.selectionChanged(),
    impact: () => void Haptics.impact({ style: ImpactStyle.Medium }),
    success: () => void Haptics.notification({ type: NotificationType.Success }),
    warning: () => void Haptics.notification({ type: NotificationType.Warning }),
    error: () => void Haptics.notification({ type: NotificationType.Error }),
    celebrate: () => {
      void Haptics.impact({ style: ImpactStyle.Heavy });
      setTimeout(() => void Haptics.notification({ type: NotificationType.Success }), 130);
    },
  });

  try {
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#08090B' });
  } catch {
    // Cosmetic only; an Android WebView without the plugin must not break boot.
  }
}

/**
 * Fade out the native launch image once React is painting its own splash.
 * Idempotent and never rejects; see `./splash` for why it lives on its own.
 */
export { hideNativeSplash } from './splash';
