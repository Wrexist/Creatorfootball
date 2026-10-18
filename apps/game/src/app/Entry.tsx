import { Component, Suspense, lazy, useEffect, type ErrorInfo, type ReactNode } from 'react';
import { SplashScreen } from '@/features/onboarding/SplashScreen';

/**
 * The first thing that renders, and deliberately the *only* thing in the
 * initial chunk.
 *
 * Everything below `App` reaches the engine — the save reader, the content
 * registry, the simulator — and the design system's cards read the engine's
 * label tables, so any import from `@/design` brings all of it too. That is
 * several hundred kilobytes which cannot be avoided, only sequenced: split
 * here, and the splash paints from a small bundle while the rest downloads
 * behind it, instead of the player watching a white screen until the last byte
 * of the simulator arrives.
 *
 * This file and the splash therefore import nothing but React. The moment
 * either one reaches for a design primitive, the split stops working.
 */
const App = lazy(async () => ({ default: (await import('./App')).App }));

/**
 * The native launch image is removed only by an explicit call
 * (`launchAutoHide: false`), so every path out of startup must make it. Reached
 * by dynamic import for the same reason as `App`: the splash module brings
 * Capacitor's core, which has no place in this chunk. On a device the import
 * is a local file, so it still arrives when the app chunk itself failed to run.
 */
function hideNativeSplash(): void {
  import('@/platform/splash')
    .then((splash) => splash.hideNativeSplash())
    .catch((error: unknown) => console.warn('[startup] the launch splash could not be hidden', error));
}

/**
 * Comfortably longer than a healthy cold start on the slowest supported device.
 * Should boot stall without throwing — a hung promise, a chunk that never
 * settles — the launch image still gives way to the React splash or error
 * screen beneath it, instead of a frozen logo the player can only force-quit.
 */
const NATIVE_SPLASH_FAILSAFE_MS = 8000;
let failsafeArmed = false;

function armNativeSplashFailsafe(): void {
  if (failsafeArmed) return;
  failsafeArmed = true;
  setTimeout(hideNativeSplash, NATIVE_SPLASH_FAILSAFE_MS);
}

/**
 * Catches the one failure the app-level boundary cannot: the core chunk never
 * arriving. Plain markup, because the design system lives in the chunk that
 * just failed to load.
 */
export class StartupBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[startup] failed to load the app', error, info.componentStack);
    hideNativeSplash();
  }

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <div
        role="alert"
        className="flex h-full w-full flex-col items-center justify-center gap-4 bg-base px-6 text-center"
      >
        <h1 className="font-display text-[22px] font-bold tracking-[-0.03em] text-ink">
          The game could not finish loading
        </h1>
        <p className="max-w-[34ch] text-[14px] leading-relaxed text-ink-muted">
          This is almost always the connection dropping partway through. Nothing on this device has
          been changed, including your save.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="min-h-11 rounded-pill bg-volt px-5 text-[14px] font-semibold text-volt-ink"
        >
          Try again
        </button>
      </div>
    );
  }
}

export function Entry(): ReactNode {
  useEffect(armNativeSplashFailsafe, []);
  return (
    <StartupBoundary>
      <Suspense fallback={<SplashScreen label="Starting Creator Football" />}>
        <App />
      </Suspense>
    </StartupBoundary>
  );
}
