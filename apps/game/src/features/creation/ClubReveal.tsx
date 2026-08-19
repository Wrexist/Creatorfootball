import { useEffect, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { PHILOSOPHY_LABELS, type Club } from '@cf/engine';
import { ClubBadge, GlassButton, HeroReveal, useDesignMotion } from '@/design';
import { useUiStore } from '@/state/uiStore';
import { KitPreview } from './KitPreview';

/**
 * The club reveal — one of the nine hero moments this product licenses itself
 * to use, and the emotional payoff of everything the player just typed.
 *
 * It spends the moment on the badge and nothing else. The crest scales up out
 * of a blur into a colour field pulled from the club's own primary, the name
 * lands under it, and the kit and the motto follow. No statistics, no league
 * table, no "what's next" panel: those all exist one tap away and every one of
 * them would turn a moment into a screen.
 *
 * Under reduced motion the design system collapses this to a cross-fade, so
 * the composition itself has to carry it — which is why the static frame is a
 * complete, centred, deliberately posed crest lockup rather than an animation
 * with the movement removed.
 */
export function ClubReveal({
  club, open, onContinue,
}: {
  club: Club;
  open: boolean;
  onContinue: () => void;
}): ReactNode {
  const m = useDesignMotion();
  const setCinematic = useUiStore((s) => s.setCinematic);

  // Tell the rest of the app a cinematic owns the screen, so nothing schedules
  // a toast over the top of it.
  useEffect(() => {
    setCinematic(open ? 'club_reveal' : null);
    return () => setCinematic(null);
  }, [open, setCinematic]);

  const visual = (
    <div className="relative flex flex-col items-center">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -inset-16 rounded-pill"
        style={{
          background: `radial-gradient(50% 50% at 50% 50%, ${club.visual.primary}, transparent 70%)`,
          opacity: 0.55,
        }}
      />
      <ClubBadge visual={club.visual} size={172} label={`${club.name} badge`} />
      <motion.div
        initial={m.reduced ? { opacity: 0 } : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...m.transition.medium, delay: m.reduced ? 0 : 0.55 }}
        className="relative mt-5 flex items-center gap-3"
      >
        <KitPreview visual={club.visual} size={52} label={`${club.name} home kit`} />
        <span className="flex flex-col items-start">
          <span
            className="font-display text-[26px] font-bold leading-none tracking-[0.06em]"
            style={{ color: club.visual.secondary }}
          >
            {club.abbreviation}
          </span>
          <span className="mt-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-dim">
            {club.city}
          </span>
        </span>
      </motion.div>
    </div>
  );

  return (
    <>
      {/* The reveal itself is a portal over a 92% void backdrop. Painting the
          club's own colour underneath means the moment lands in the club's
          palette rather than on black — and it is what remains when reduced
          motion strips the animation away. */}
      <div
        aria-hidden="true"
        className="fixed inset-0"
        style={{
          background: `radial-gradient(78% 52% at 50% 38%, ${club.visual.primary}, var(--color-base) 76%)`,
        }}
      />
      <HeroReveal
        open={open}
        onDismiss={onContinue}
        eyebrow="Your club"
        title={club.name}
        subtitle={
          <>
            <span className="block text-[16px] font-semibold italic text-ink">“{club.motto}”</span>
            <span className="mt-2 block">
              {PHILOSOPHY_LABELS[club.philosophy]} · {club.stadium.name} · founded {club.founded}
            </span>
          </>
        }
        visual={visual}
        action={
          <GlassButton variant="primary" size="lg" onClick={onContinue}>
            Meet your squad
          </GlassButton>
        }
      />
    </>
  );
}
