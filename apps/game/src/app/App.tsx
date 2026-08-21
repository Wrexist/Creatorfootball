import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { trackEvent } from '@cf/engine';
import {
  ConfirmProvider, ReducedMotionOverrideContext, ToastProvider,
  setHapticsEnabled, useToast,
} from '@/design';
import { detectCapabilities, shouldReduceEffects } from '@/platform/capabilities';
import { hideNativeSplash, installNativeBridge } from '@/platform/native';
import { useGameStore } from '@/state/gameStore';
import { useUiStore } from '@/state/uiStore';
import { SPLASH_MINIMUM_MS, SaveRecoveryScreen, SplashScreen } from '@/features/onboarding';
import { AppErrorBoundary } from './ErrorBoundary';
import { Shell } from './Shell';
import { installAnalytics } from './analytics';
import { preloadHome } from './featureModules';

/**
 * The application root: providers, boot, and nothing else.
 *
 * Provider order is load-bearing. Toast and confirm are mounted above the
 * router because a screen must be able to raise either one during a navigation
 * — including the boot-failure screen, which needs a confirmation before it
 * will delete anything. Motion preference sits above both so a reduced-motion
 * save is honoured by the very first thing that animates.
 */

function BootGate({ children }: { children: ReactNode }): ReactNode {
  const phase = useGameStore((s) => s.phase);
  const boot = useGameStore((s) => s.boot);
  const recovered = useGameStore((s) => s.recoveredFromBackup);
  const setReducedEffects = useUiStore((s) => s.setReducedEffects);
  const toast = useToast();

  const [splashHeld, setSplashHeld] = useState(true);
  const booted = useRef(false);

  /**
   * Work that must happen exactly once per session. Kept apart from the
   * subscriptions below because StrictMode mounts, unmounts and remounts every
   * effect in development: anything guarded by a ref must therefore own no
   * teardown, or the second run skips setting up what the first run tore down.
   */
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;

    installAnalytics();
    trackEvent('session_start', {});

    // Native drivers (haptics, status bar) exist only inside the Capacitor
    // shell; in a browser this resolves immediately as a no-op.
    void installNativeBridge();

    // Decide the presentation tier once, here, rather than per frame: heavy
    // glass and the animated pitch are what drop frames on a low-end device.
    const capabilities = detectCapabilities();
    setReducedEffects(shouldReduceEffects(capabilities));

    // The splash is covering this: warm the first screen the player will see.
    preloadHome();
    void boot();
  }, [boot, setReducedEffects]);

  /** Idempotent: safe to tear down and set up again. */
  useEffect(() => {
    const timer = setTimeout(() => setSplashHeld(false), SPLASH_MINIMUM_MS);
    const onLeave = (): void => trackEvent('session_end', {});
    window.addEventListener('pagehide', onLeave);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('pagehide', onLeave);
    };
  }, []);

  // The native launch image hands over exactly when the React splash does —
  // not before (white flash) and not after (a frozen double-splash).
  useEffect(() => {
    if (!splashHeld) void hideNativeSplash();
  }, [splashHeld]);

  useEffect(() => {
    if (!recovered) return;
    toast.warning(
      'Recovered from a backup',
      'The most recent save could not be read, so we loaded the last good one. You may have lost a week.',
    );
  }, [recovered, toast]);

  // Persistence failures are the store's to detect and the player's to know
  // about: one global toast here, cleared once shown, so every write path is
  // covered without each screen learning what a save file is.
  const persistFailed = useGameStore((s) => s.persistFailed);
  const clearPersistFailed = useGameStore((s) => s.clearPersistFailed);
  useEffect(() => {
    if (!persistFailed) return;
    toast.error(
      'Changes could not be saved',
      'Everything on screen is live, but this device refused the write. Your last safe save still stands.',
    );
    clearPersistFailed();
  }, [persistFailed, clearPersistFailed, toast]);

  if (phase === 'ERROR') return <SaveRecoveryScreen />;
  if (phase === 'BOOTING' || splashHeld) return <SplashScreen />;
  return children;
}

/** Applies the in-game accessibility settings to the design system. */
function Preferences({ children }: { children: ReactNode }): ReactNode {
  const reducedMotion = useGameStore((s) => s.state?.settings.reducedMotion ?? false);
  const hapticsEnabled = useGameStore((s) => s.state?.settings.haptics ?? true);

  useEffect(() => {
    setHapticsEnabled(hapticsEnabled);
  }, [hapticsEnabled]);

  return (
    // `null` defers to the operating system; `true` is the in-game override
    // forcing it on. There is deliberately no way to force it *off*.
    <ReducedMotionOverrideContext.Provider value={reducedMotion ? true : null}>
      {children}
    </ReducedMotionOverrideContext.Provider>
  );
}

export function App(): ReactNode {
  return (
    <AppErrorBoundary>
      <Preferences>
        <ToastProvider>
          <ConfirmProvider>
            <BrowserRouter>
              <BootGate>
                <Shell />
              </BootGate>
            </BrowserRouter>
          </ConfirmProvider>
        </ToastProvider>
      </Preferences>
    </AppErrorBoundary>
  );
}
