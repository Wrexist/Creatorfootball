import { useEffect, useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { ShinyText, useDesignMotion } from '@/design';
import { BrandMark } from './BrandMark';

/**
 * The splash.
 *
 * It exists because something real is happening behind it — the save is being
 * read, validated and checksummed, and the home chunk is being fetched — and a
 * blank frame while that runs reads as a broken app. It is deliberately short
 * and it never waits on a timer alone: the shell holds it for a floor of
 * `MINIMUM_MS` so it cannot flash, and drops it the instant the work is done
 * after that.
 *
 * Nothing here is interactive and nothing here is a glass surface: this frame
 * paints before the app has established anything, so it stays as cheap as a
 * gradient and a path.
 */

/** Below this the splash reads as a flicker; above it, as a wait. */
export const SPLASH_MINIMUM_MS = 820;

export function SplashScreen({ label = 'Loading' }: { label?: string }): ReactNode {
  const m = useDesignMotion();
  const [progress, setProgress] = useState(0);

  // A progress hairline that eases toward — but never reaches — the end. It is
  // honest about being indeterminate while still moving, which is what stops a
  // 900ms wait feeling like a stall.
  useEffect(() => {
    let frame = 0;
    const start = performance.now();
    const tick = (): void => {
      const elapsed = performance.now() - start;
      setProgress(1 - Math.exp(-elapsed / 900));
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

      <motion.div
        initial={m.reduced ? { opacity: 0 } : { opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={m.transition.slow}
        className="relative flex flex-col items-center gap-5 text-ink"
      >
        <BrandMark size={84} />
        <ShinyText
          as="p"
          tone="ink"
          loop={!m.reduced}
          className="font-display text-[13px] font-bold uppercase tracking-[0.42em]"
        >
          Creator Football
        </ShinyText>
      </motion.div>

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
