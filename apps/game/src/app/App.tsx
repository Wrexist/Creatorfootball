import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { trackEvent } from '@cf/engine';
import {
  ConfirmProvider, ReducedMotionOverrideContext, ToastProvider,
  setHapticsEnabled, useToast,
} from '@/design';
import { detectCapabilities, shouldReduceEffects } from '@/platform/capabilities';
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

  useEffect(() => {
    // StrictMode runs effects twice in development; booting twice would race
    // two reads of the same save against each other for no benefit.
    if (booted.current) return;
    booted.current = true;

    installAnalytics();
    trackEvent('session_start', {});

    // Decide the presentation tier once, here, rather than per frame: heavy
    // glass and the animated pitch are what drop frames on a low-end device.
    const capabilities = detectCapabilities();
    setReducedEffects(shouldReduceEffects(capabilities));

    // The splash is covering this: warm the first screen the player will see.
    preloadHome();
    void boot();

    const timer = setTimeout(() => setSplashHeld(false), SPLASH_MINIMUM_MS);
    const onLeave = (): void => trackEvent('session_end', {});
    window.addEventListener('pagehide', onLeave);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('pagehide', onLeave);
    };
  }, [boot, setReducedEffects]);

  useEffect(() => {
    if (!recovered) return;
    toast.warning(
      'Recovered from a backup',
      'The most recent save could not be read, so we loaded the last good one. You may have lost a week.',
    );
  }, [recovered, toast]);

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
