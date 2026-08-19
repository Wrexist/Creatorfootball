import { useEffect, useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import type { ClubVisualIdentity } from '@cf/engine';
import { ClubBadge, useDesignMotion } from '@/design';

/**
 * The beat between "found the club" and the reveal.
 *
 * It is covering real work — twelve squads, two hundred contracts, a full
 * fixture list — and the lines below name what is actually being built rather
 * than cycling through invented flavour. The crest is already on screen and
 * already the player's, which is what turns a wait into an arrival.
 */
const STEPS: readonly string[] = [
  'Founding the club',
  'Filling twelve squads',
  'Signing contracts',
  'Drawing up the fixture list',
  'Finding you a rival',
];

const STEP_MS = 320;

export function BuildingLeague({
  clubName, visual,
}: { clubName: string; visual: ClubVisualIdentity }): ReactNode {
  const m = useDesignMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((current) => Math.min(current + 1, STEPS.length - 1));
    }, STEP_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <div
      className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-base px-6"
      role="status"
      aria-live="polite"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: `radial-gradient(64% 42% at 50% 42%, ${visual.primary}, transparent 72%)`, opacity: 0.5 }}
      />

      <motion.div
        initial={m.reduced ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={m.transition.slow}
        className="relative"
      >
        <ClubBadge visual={visual} size={104} label={`${clubName} badge`} />
      </motion.div>

      <p className="relative mt-7 font-display text-[20px] font-bold tracking-[-0.03em] text-ink">
        {clubName}
      </p>
      <p className="relative mt-1.5 text-[13px] text-ink-muted">{STEPS[index]}…</p>

      <div className="relative mt-6 flex gap-1.5" aria-hidden="true">
        {STEPS.map((step, i) => (
          <span
            key={step}
            className="h-1 w-6 rounded-pill transition-colors duration-[var(--duration-fast)]"
            style={{ background: i <= index ? 'var(--color-volt)' : 'rgba(255,255,255,0.12)' }}
          />
        ))}
      </div>
    </div>
  );
}
