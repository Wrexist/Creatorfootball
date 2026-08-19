import { useEffect, useState, type ReactNode } from 'react';
import { BrandMark } from './BrandMark';

/**
 * The splash.
 *
 * It exists because something real is happening behind it — the app core and
 * the engine are downloading, then the save is read, validated and checksummed
 * — and a blank frame while that runs reads as a broken app. It never waits on
 * a timer alone: the shell holds it for a floor of `SPLASH_MINIMUM_MS` so it
 * cannot flash, and drops it the instant the work is done after that.
 *
 * This file imports nothing but React, on purpose. It is the only component in
 * the initial chunk, and a single import from the design system's barrel pulls
 * in the whole engine behind it (the kit's cards read engine label tables), which
 * would put the thing this screen is covering *in front of* the thing covering
 * it. It uses the token layer directly instead — the same variables, the same
 * `cf-sheen` keyframes, the same global reduced-motion rule — so it looks like
 * the rest of the product without depending on any of it.
 */

/** Below this the splash reads as a flicker; above it, as a wait. */
export const SPLASH_MINIMUM_MS = 820;

export function SplashScreen({ label = 'Loading' }: { label?: string }): ReactNode {
  const [progress, setProgress] = useState(0);

  // A progress hairline that eases toward — but never reaches — the end. It is
  // honest about being indeterminate while still moving, which is what stops a
  // one-second wait feeling like a stall.
  useEffect(() => {
    let frame = 0;
    const start = performance.now();
    const tick = (): void => {
      setProgress(1 - Math.exp(-(performance.now() - start) / 900));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div
      className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-base"
      role="status"
      aria-label={label}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(72% 46% at 50% 38%, rgba(200,255,46,0.09), transparent 72%)' }}
      />

      <div className="relative flex flex-col items-center gap-5 text-ink">
        <BrandMark size={84} />
        <p
          className="font-display text-[13px] font-bold uppercase tracking-[0.42em]"
          style={{
            // The design system's own sheen keyframes, applied without importing
            // the component that normally owns them.
            backgroundImage:
              'linear-gradient(100deg, var(--color-ink) 0%, var(--color-ink) 38%, var(--color-volt) 50%, var(--color-ink) 62%, var(--color-ink) 100%)',
            backgroundSize: '260% 100%',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
            animation: 'var(--animate-sheen)',
          }}
        >
          Creator Football
        </p>
      </div>

      <div
        className="absolute bottom-[calc(var(--safe-bottom)+56px)] h-px w-40 overflow-hidden rounded-pill bg-white/[0.08]"
        aria-hidden="true"
      >
        <div
          className="h-full rounded-pill bg-volt/70"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>
    </div>
  );
}
