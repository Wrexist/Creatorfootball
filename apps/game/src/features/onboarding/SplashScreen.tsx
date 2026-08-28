import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BrandMark } from './BrandMark';

/**
 * The lockup plate, by literal path rather than through `ART_ASSETS`.
 *
 * Importing the registry would pull the design system's barrel — and the
 * engine behind it — into the entry chunk, which is the one thing this file
 * exists to avoid. The cost of the duplication is a path that can drift; the
 * cost of the import is the splash arriving after the thing it covers.
 * `SplashScreen.test.ts` holds the two in step.
 */
const WORDMARK_PLATE = '/art/brand/wordmark.webp';

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
  // The plate is an override, exactly like everything behind `ArtLayer`: until
  // it has decoded — and forever, if it 404s — the drawn mark below is what the
  // player sees. `ArtLayer` itself is off-limits here for the import reason
  // above, so this is the same contract written out by hand.
  const [plate, setPlate] = useState<'pending' | 'ready' | 'failed'>('pending');
  const plateRef = useRef<HTMLImageElement>(null);

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

  // A cached image can already be decoded by the time React attaches `onLoad`,
  // and then the event never fires and the plate stays at zero opacity. On the
  // second launch of an installed app that is every launch, so the fast path is
  // the one that has to be checked explicitly.
  useEffect(() => {
    const image = plateRef.current;
    if (image?.complete) setPlate(image.naturalWidth > 0 ? 'ready' : 'failed');
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

      {/* The native launch image is this lockup, so showing it here is what
          makes the hand-off from the iOS splash to the web view invisible:
          without it the app cuts from the full crest to a small drawn mark and
          reads as two different products loading in sequence. */}
      <img
        ref={plateRef}
        src={WORDMARK_PLATE}
        alt=""
        aria-hidden="true"
        draggable={false}
        decoding="async"
        onLoad={() => setPlate('ready')}
        onError={() => setPlate('failed')}
        className="pointer-events-none absolute left-1/2 top-1/2 w-[min(78vw,440px)] -translate-x-1/2 -translate-y-1/2 select-none"
        style={{
          // Black is `screen`'s identity: the plate's ground vanishes into the
          // page and only the crest, the type and their glow survive.
          mixBlendMode: 'screen',
          // The master's ground is a *near* black, not #000, so `screen` lifts
          // it by about 1/255 — invisible as a colour and perfectly visible as
          // a rectangle, because a straight edge is the one thing the eye finds
          // in near-black. Fading the rim removes the edge rather than the lift.
          maskImage: 'radial-gradient(115% 115% at 50% 50%, #000 58%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(115% 115% at 50% 50%, #000 58%, transparent 100%)',
          opacity: plate === 'ready' ? 1 : 0,
          transition: 'opacity 0.5s ease-out',
        }}
      />

      <div
        className="relative flex flex-col items-center gap-5 text-ink"
        style={{
          opacity: plate === 'ready' ? 0 : 1,
          transition: 'opacity 0.4s ease-out',
        }}
      >
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
