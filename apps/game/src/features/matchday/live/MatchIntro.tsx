import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Club, Player } from '@cf/engine';
import {
  ClubBadge, EASE, GlassButton, IconFans, PlayerPortrait, ShinyText, cn, haptics, sfx, useDesignMotion,
} from '@/design';
import { arenaShareLine, type MatchdayContext } from '../shared/context';
import { kitColors, type KitPalette } from '../shared/kit';

/**
 * The walk-out.
 *
 * Four and a half seconds, once, before the first whistle. It exists because a
 * match that begins the instant a route resolves is a spreadsheet updating; a
 * match that begins after the badges have met, the stakes have been said out
 * loud and the shape has been shown is an *event*. The beats are ordered the
 * way a broadcast orders them — who, what for, who to watch, how you are set
 * up, go — because that order is how a stranger to the fixture is brought up to
 * speed fastest.
 *
 * Two rules it never breaks:
 *
 *   - **It is skippable everywhere.** A tap anywhere, the Skip button, Escape,
 *     Enter or Space all end it immediately. By the fiftieth match this is
 *     something the player has seen enough of, and an unskippable flourish
 *     turns into an obstacle.
 *   - **It never invents anything.** Every line is read off the matchday
 *     context, which is built from engine selectors.
 *
 * Under reduced motion the sequence collapses into one static card holding all
 * the same information at once, with an explicit button — nothing is carried by
 * the animation alone.
 */

export interface MatchIntroProps {
  context: MatchdayContext;
  homePalette: KitPalette;
  awayPalette: KitPalette;
  onDone: () => void;
}

/**
 * Beat boundaries in ms from the start. The last entry ends the sequence.
 *
 * Each beat has to outlast its own cross-fade by enough to be read; with a
 * quarter-second in and a quarter out, a one-second beat spent half its life in
 * transition and the screenshot at its midpoint came back completely empty. The
 * fades are now 0.2s in and 0.12s out against beats of 1.1s.
 */
const BEATS = [1150, 2300, 3400, 4250, 4750] as const;
const INTRO_MS = 4750;

export function MatchIntro({ context, homePalette, awayPalette, onDone }: MatchIntroProps): ReactNode {
  const m = useDesignMotion();
  const [beat, setBeat] = useState(0);
  const done = useRef(false);

  const finish = useCallback(() => {
    if (done.current) return;
    done.current = true;
    // The whistle is the handover: it plays whether the sequence ran to the end
    // or the player skipped it, because it marks the match starting, not the
    // animation finishing.
    sfx.kickOff();
    onDone();
  }, [onDone]);

  useEffect(() => {
    haptics.impact();
  }, []);

  useEffect(() => {
    if (m.reduced) {
      // One card, one timer, no choreography — but still auto-advancing so a
      // player who does nothing is not left staring at a static screen.
      const timer = setTimeout(finish, 3400);
      return () => clearTimeout(timer);
    }
    const timers = BEATS.map((at, index) =>
      setTimeout(() => (index === BEATS.length - 1 ? finish() : setBeat(index + 1)), at),
    );
    return () => timers.forEach(clearTimeout);
  }, [m.reduced, finish]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') finish();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [finish]);

  const { home, away, us, them, competitionName, fixture } = context;
  const stake = context.stakes.find((line) => line.kind === 'WIN') ?? context.stakes[0] ?? null;
  const arena = arenaShareLine(context.arenaShare);

  return (
    <div
      className="fixed inset-0 z-[65] flex flex-col overflow-hidden bg-void"
      style={{ paddingTop: 'var(--safe-top)', paddingBottom: 'var(--safe-bottom)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Match introduction"
    >
      {/* A draining line, so the sequence visibly has an end and the player
          knows waiting costs them four seconds rather than an unknown number. */}
      {!m.reduced && (
        <motion.span
          aria-hidden="true"
          initial={{ scaleX: 1 }}
          animate={{ scaleX: 0 }}
          transition={{ duration: INTRO_MS / 1000, ease: 'linear' }}
          className="pointer-events-none absolute inset-x-0 top-0 z-20 h-0.5 origin-left bg-volt"
        />
      )}

      {/* The whole surface is the skip target. */}
      <button
        type="button"
        onClick={finish}
        aria-label="Skip the introduction and kick off"
        className="absolute inset-0 z-0 cursor-default outline-none"
      />

      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            `radial-gradient(75% 48% at 10% 20%, ${homePalette.primary}55, transparent 70%),` +
            `radial-gradient(75% 48% at 90% 80%, ${awayPalette.primary}55, transparent 70%)`,
        }}
      />

      <div className="pointer-events-none relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center px-6 text-center">
        {m.reduced ? (
          <StaticIntro
            context={context}
            homePalette={homePalette}
            awayPalette={awayPalette}
            stake={stake?.text ?? null}
            arena={arena}
          />
        ) : (
          <AnimatePresence mode="wait">
            {beat === 0 && (
              <Beat key="badges">
                <div className="flex items-start justify-center gap-4">
                  <motion.div
                    initial={{ x: -46, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ duration: 0.62, ease: EASE.outQuint }}
                    className="flex w-[38vw] max-w-[132px] flex-col items-center gap-2"
                  >
                    <ClubBadge visual={home.visual} size={84} label={home.name} />
                    <span className="text-balance text-[14px] font-bold leading-tight text-ink">
                      {home.shortName}
                    </span>
                  </motion.div>
                  <motion.span
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.22, duration: 0.4 }}
                    className="mt-[34px] font-display text-[19px] font-bold tracking-[0.2em] text-ink-dim"
                  >
                    V
                  </motion.span>
                  <motion.div
                    initial={{ x: 46, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ duration: 0.62, ease: EASE.outQuint }}
                    className="flex w-[38vw] max-w-[132px] flex-col items-center gap-2"
                  >
                    <ClubBadge visual={away.visual} size={84} label={away.name} />
                    <span className="text-balance text-[14px] font-bold leading-tight text-ink">
                      {away.shortName}
                    </span>
                  </motion.div>
                </div>
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.34, duration: 0.42 }}
                  className="mt-6 text-[12px] font-bold uppercase tracking-[0.3em] text-volt"
                >
                  {competitionName}
                </motion.p>
              </Beat>
            )}

            {beat === 1 && (
              <Beat key="fixture">
                <p className="text-[12px] font-bold uppercase tracking-[0.28em] text-ink-dim">
                  Week {fixture.week}
                  {fixture.isDerby ? ' · Derby' : ''}
                </p>
                <h2 className="mt-3 max-w-[15ch] text-balance font-display text-[38px] font-bold leading-[1.02] tracking-[-0.04em] text-ink">
                  {home.shortName}
                  <span className="px-2 text-ink-faint">v</span>
                  {away.shortName}
                </h2>
                {stake && (
                  <motion.p
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, duration: 0.42 }}
                    className="mt-4 max-w-[26ch] text-balance text-[17px] font-semibold leading-snug text-volt"
                  >
                    {stake.text}
                  </motion.p>
                )}
                {/* The crowd is part of the occasion the same way the stake
                    is: said once, plainly, only when it is worth saying. */}
                {arena && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.44, duration: 0.42 }}
                    className="mt-2 flex items-center justify-center gap-1.5 text-[13px] font-semibold text-ink-muted"
                  >
                    <span aria-hidden="true" className="shrink-0 text-volt [&_svg]:size-4"><IconFans /></span>
                    {arena}
                  </motion.p>
                )}
              </Beat>
            )}

            {beat === 2 && (
              <Beat key="players">
                <p className="text-[12px] font-bold uppercase tracking-[0.28em] text-ink-dim">
                  Watch these two
                </p>
                <div className="mt-5 flex items-start justify-center gap-6">
                  <IntroPlayer club={us} player={context.ourStar} tag="Yours" delay={0} />
                  <IntroPlayer club={them} player={context.theirStar} tag="Danger" delay={0.14} />
                </div>
              </Beat>
            )}

            {beat === 3 && (
              <Beat key="shape">
                <p className="text-[12px] font-bold uppercase tracking-[0.28em] text-ink-dim">
                  You start in
                </p>
                <h3 className="mt-2 font-display text-[34px] font-bold tracking-[-0.03em] text-ink">
                  {context.formation.name}
                </h3>
                <ShapeStrip context={context} accent={us.visual.primary} />
              </Beat>
            )}

            {beat === 4 && (
              <Beat key="kickoff">
                <motion.div
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 16, mass: 0.9 }}
                >
                  <ShinyText
                    as="span"
                    tone="volt"
                    className="font-display text-[52px] font-bold uppercase leading-none tracking-[-0.05em]"
                  >
                    Kick off
                  </ShinyText>
                </motion.div>
              </Beat>
            )}
          </AnimatePresence>
        )}
      </div>

      <div className="relative z-10 flex shrink-0 justify-center pb-5">
        <GlassButton variant="ghost" size="md" onClick={finish}>
          {m.reduced ? 'Kick off' : 'Skip'}
        </GlassButton>
      </div>
    </div>
  );
}

function Beat({ children }: { children: ReactNode }): ReactNode {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.12 } }}
      transition={{ duration: 0.2 }}
      className="flex flex-col items-center"
    >
      {children}
    </motion.div>
  );
}

function IntroPlayer({
  club, player, tag, delay,
}: {
  club: Club; player: Player | null; tag: string; delay: number;
}): ReactNode {
  const colors = kitColors(club.id, club.visual);
  const name = player?.displayName ?? club.shortName;
  const line = player ? `${player.position} · ${player.overall}` : 'No stand-out named';
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.42, ease: EASE.outQuint }}
      className="flex w-[42vw] max-w-[150px] flex-col items-center"
    >
      <PlayerPortrait seed={player?.portraitSeed ?? club.id} size={64} colors={colors} shape="squircle" />
      <span className="mt-2 text-micro font-bold uppercase tracking-[0.18em] text-volt">{tag}</span>
      <span className="mt-1 text-balance text-[15px] font-bold leading-tight text-ink">{name}</span>
      <span className="tnum mt-0.5 text-[12px] text-ink-muted">{line}</span>
    </motion.div>
  );
}

/**
 * The starting shape as the pitch will show it: landscape, own goal on the
 * left. Drawn from the formation's own slot coordinates, so the strip and the
 * simulation cannot disagree.
 */
function ShapeStrip({ context, accent }: { context: MatchdayContext; accent: string }): ReactNode {
  return (
    <div
      className="relative mt-5 w-[76vw] max-w-[300px] overflow-hidden rounded-md border border-white/10 bg-[var(--color-pitch-deep)]"
      style={{ aspectRatio: '16 / 9' }}
      aria-hidden="true"
    >
      <span className="absolute inset-y-2 left-1/2 w-px bg-white/10" />
      {context.lineup.map(({ slot, player }, index) => (
        <motion.span
          key={slot.id}
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.12 + index * 0.028, duration: 0.3 }}
          className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-pill"
          style={{
            left: `${6 + slot.x * 88}%`,
            top: `${slot.y * 100}%`,
            background: slot.role === 'GK' ? '#f4f6f8' : accent,
            opacity: player ? 1 : 0.4,
          }}
        />
      ))}
      <span className="absolute bottom-1 right-2 text-micro font-bold uppercase tracking-[0.14em] text-ink-dim">
        You attack →
      </span>
    </div>
  );
}

/** Everything the sequence says, said at once, for reduced motion. */
function StaticIntro({
  context, homePalette, awayPalette, stake, arena,
}: {
  context: MatchdayContext;
  homePalette: KitPalette;
  awayPalette: KitPalette;
  stake: string | null;
  arena: string | null;
}): ReactNode {
  const { home, away, competitionName, fixture } = context;
  return (
    <div className={cn('flex w-full max-w-[340px] flex-col items-center gap-4')}>
      <div className="flex items-center justify-center gap-4">
        <ClubBadge visual={home.visual} size={56} label={home.name} />
        <span className="font-display text-[15px] font-bold tracking-[0.2em] text-ink-dim">V</span>
        <ClubBadge visual={away.visual} size={56} label={away.name} />
      </div>
      <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-volt">
        {competitionName} · week {fixture.week}
      </p>
      <h2 className="text-balance font-display text-[30px] font-bold leading-[1.05] tracking-[-0.03em] text-ink">
        {home.shortName} v {away.shortName}
      </h2>
      {stake && <p className="text-balance text-[15px] font-semibold text-volt">{stake}</p>}
      <dl className="flex w-full flex-col gap-1.5 text-[14px]">
        <Row
          label="Your danger man"
          value={context.ourStar?.displayName ?? 'Nobody named'}
          swatch={context.playerIsHome ? homePalette.primary : awayPalette.primary}
        />
        <Row
          label="Theirs"
          value={context.theirStar?.displayName ?? 'Nobody named'}
          swatch={context.playerIsHome ? awayPalette.primary : homePalette.primary}
        />
        <Row label="Your shape" value={context.formation.name} />
        {arena && <Row label="The arena" value={arena} />}
      </dl>
    </div>
  );
}

/**
 * The club's colour is a swatch beside the name, never the name's own colour:
 * a dark claret or navy kit set as 14px text on a near-black card is the exact
 * failure the goal wordmark had, at a smaller size where it is worse.
 */
function Row({
  label, value, swatch,
}: { label: string; value: string; swatch?: string }): ReactNode {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-white/[0.07] pb-1.5 last:border-0">
      <dt className="text-[12px] uppercase tracking-[0.14em] text-ink-dim">{label}</dt>
      <dd className="flex items-center gap-1.5 text-right text-[14px] font-semibold text-ink">
        {swatch !== undefined && (
          <span
            aria-hidden="true"
            className="block size-2 shrink-0 rounded-pill ring-1 ring-white/25"
            style={{ background: swatch }}
          />
        )}
        {value}
      </dd>
    </div>
  );
}
