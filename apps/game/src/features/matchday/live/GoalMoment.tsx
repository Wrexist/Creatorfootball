import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { MatchEvent, Side } from '@cf/engine';
import { GoalBurst, cn, haptics, useDesignMotion } from '@/design';
import type { KitPalette } from '../shared/kit';

/**
 * The goal.
 *
 * A goal is the only thing in a football match that changes the answer, and the
 * product treats it that way. It is also the one moment where treating both
 * sides the same is a design failure rather than a simplification, so this
 * component is really two:
 *
 * ### You score — `DESIGN_SYSTEM.md` §6 H1
 *
 * Full-bleed volt flash, the design system's `GoalBurst` at hero scale, the
 * `bouncy` spring, `haptics.celebrate`, then the commentary and the crowd. This
 * is the one and only user of `GoalBurst` in the product; a big chance gets a
 * slowed camera and a banner, a red card gets a banner, and neither ever gets
 * the burst. The moment a near-miss looks like a goal, a goal stops feeling
 * like one.
 *
 * **The wordmark is volt, never the club's colour.** Painting a 120px `GOAL`
 * in the scoring club's primary against a near-black scrim measured 1.74:1 when
 * you scored and 1.25:1 when you conceded — the hero moment was, literally,
 * invisible, and it broke the rule that club colour never becomes UI chrome.
 * The club is still present: it floods the edges of the pitch on impact and it
 * marks the aftermath band. It just does not have to carry the reading.
 *
 * ### You concede — `DESIGN_SYSTEM.md` §6 H2
 *
 * Deliberately smaller: a danger pulse at the edges of the pitch, the score
 * ticking over in the header, `haptics.impact`, and no takeover at all. The
 * game never celebrates against the player and never rubs it in. The
 * information — who scored, what it is now, what the ground did — still
 * arrives, in the same quiet band, because withholding it would be worse than
 * delivering it plainly.
 *
 * Everything here is read off the `MatchEvent` the simulator emitted. No score,
 * scorer, assist or flavour is computed in this file.
 *
 * Under reduced motion the shake and the flood are dropped, the burst
 * cross-fades, and the band appears without sliding — the same words in the
 * same order, none of them carried by movement.
 */

export type GoalPhase = 'IDLE' | 'IMPACT' | 'BURST' | 'AFTERMATH';

/** H1: the flash before the burst. H2: the whole of the conceded treatment. */
const SCORED_IMPACT_MS = 620;
const CONCEDED_IMPACT_MS = 420;
const SCORED_AFTERMATH_MS = 2400;
const CONCEDED_AFTERMATH_MS = 1800;

/**
 * Two goals inside this window are one celebration.
 *
 * A 2× rule card can put two goals a couple of ticks apart, and a phone that
 * buzzes twice in a second reads as a malfunction rather than as delight.
 */
const CELEBRATE_COOLDOWN_MS = 10_000;
let lastCelebrationAt = 0;

/**
 * The volt the celebration is painted in.
 *
 * Measured against the `GoalBurst` scrim (`--color-void` at 92%, effectively
 * `rgb(5,6,7)`): **17.2:1**, against a 3.0:1 large-text floor. The club colours it
 * replaces measured 1.25:1 and 1.74:1.
 */
const CELEBRATION_ACCENT = '#c8ff2e';

export interface GoalMomentProps {
  /** The scoring event, or null when there is nothing to mark. */
  goal: MatchEvent | null;
  /** playerId -> display name, so this component never guesses a name. */
  names: ReadonlyMap<string, string>;
  homePalette: KitPalette;
  awayPalette: KitPalette;
  homeName: string;
  awayName: string;
  playerSide: Side;
  /** Attendance, for how loud the ground is described as being. */
  attendance: number;
  isDerby: boolean;
  /** The match restarts under the band, not after it. */
  onComplete: () => void;
  /** The sequence is over and the screen may forget this goal. */
  onFinished: () => void;
}

export function GoalMoment({
  goal, names, homePalette, awayPalette, homeName, awayName, playerSide, attendance, isDerby,
  onComplete, onFinished,
}: GoalMomentProps): ReactNode {
  const m = useDesignMotion();
  const [phase, setPhase] = useState<GoalPhase>('IDLE');

  const ours = goal ? (goal.side ?? 'home') === playerSide : false;

  /* Kick the sequence off when a goal arrives, and only then. */
  useEffect(() => {
    if (!goal) { setPhase('IDLE'); return; }
    setPhase('IMPACT');

    if (ours) {
      const now = Date.now();
      if (now - lastCelebrationAt > CELEBRATE_COOLDOWN_MS) {
        lastCelebrationAt = now;
        haptics.celebrate();
      }
    } else {
      // A knock, not a fanfare.
      haptics.impact();
    }

    const wait = ours
      ? (m.reduced ? 220 : SCORED_IMPACT_MS)
      : (m.reduced ? 120 : CONCEDED_IMPACT_MS);
    // Conceding skips the takeover entirely and goes straight to the quiet band.
    const timer = setTimeout(() => setPhase(ours ? 'BURST' : 'AFTERMATH'), wait);
    return () => clearTimeout(timer);
  }, [goal, ours, m.reduced]);

  const dismissBurst = useCallback(() => {
    setPhase((current) => (current === 'BURST' ? 'AFTERMATH' : current));
  }, []);

  useEffect(() => {
    if (phase !== 'AFTERMATH') return;
    onComplete();
    const hold = ours ? SCORED_AFTERMATH_MS : CONCEDED_AFTERMATH_MS;
    const timer = setTimeout(() => { setPhase('IDLE'); onFinished(); }, hold);
    return () => clearTimeout(timer);
  }, [phase, ours, onComplete, onFinished]);

  if (!goal) return null;

  const scoringSide: Side = goal.side ?? 'home';
  const palette = scoringSide === 'home' ? homePalette : awayPalette;
  const scorer = goal.playerId ? names.get(goal.playerId) ?? 'Unknown' : 'Unknown';
  const assist = goal.secondaryPlayerId ? names.get(goal.secondaryPlayerId) : undefined;

  return (
    <>
      {/* --- 1. impact -------------------------------------------------- */}
      <AnimatePresence>
        {phase === 'IMPACT' && !m.reduced && (
          <motion.span
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={ours ? { opacity: [0, 1, 0.55] } : { opacity: [0, 0.9, 0] }}
            exit={{ opacity: 0 }}
            transition={{
              duration: (ours ? SCORED_IMPACT_MS : CONCEDED_IMPACT_MS) / 1000,
              times: [0, 0.18, 1],
            }}
            className="pointer-events-none fixed inset-0 z-[58]"
            style={{
              // Yours: the club's colour floods the edges. Theirs: a danger
              // pulse, which is the product's word for "this went against you".
              background: ours
                ? `radial-gradient(120% 80% at 50% 50%, transparent 42%, ${palette.primary}66 100%)`
                : 'radial-gradient(120% 80% at 50% 50%, transparent 46%, rgb(244 82 90 / 0.42) 100%)',
            }}
          />
        )}
      </AnimatePresence>

      {/* --- 2. the burst. Yours only. ---------------------------------- */}
      <GoalBurst
        open={phase === 'BURST'}
        onDismiss={dismissBurst}
        scorer={scorer}
        assist={assist}
        minute={goal.minute}
        homeScore={goal.homeScore}
        awayScore={goal.awayScore}
        accent={CELEBRATION_ACCENT}
        flavour={goalFlavour(goal)}
      />

      {/* --- 3. commentary and the crowd -------------------------------- */}
      <AnimatePresence>
        {phase === 'AFTERMATH' && (
          <motion.aside
            initial={m.reduced ? { opacity: 0 } : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={m.reduced ? { opacity: 0 } : { opacity: 0, y: 10 }}
            transition={m.transition.medium}
            className={cn(
              'pointer-events-none fixed inset-x-3 z-[56] rounded-lg border p-3',
              'shadow-[0_18px_50px_rgb(0_0_0/0.65)]',
              ours ? 'border-volt/35' : 'border-danger/35',
            )}
            // Fully opaque, by value. A translucent band sat on top of the feed
            // and made both unreadable — the one thing a band that exists to be
            // read must not do.
            style={{ bottom: 'calc(var(--safe-bottom) + 86px)', background: 'var(--color-surface-1)' }}
          >
            <div className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="block size-2.5 shrink-0 rounded-pill"
                style={{ background: palette.primary }}
              />
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-ink-dim">
                {goal.minute}&apos; · {scoringSide === 'home' ? homeName : awayName}
                {ours ? '' : ' score'}
              </span>
              <span className="tnum ml-auto font-display text-[17px] font-bold tracking-[-0.02em] text-ink">
                {goal.homeScore}–{goal.awayScore}
              </span>
            </div>
            <p
              className={cn(
                'mt-1.5 leading-snug text-pretty',
                ours ? 'text-[15px] font-semibold text-ink' : 'text-[14px] text-ink-muted',
              )}
            >
              {goal.text}
            </p>
            {ours && (
              <p className="mt-1 text-[13px] text-ink-muted text-pretty">
                {scorer}
                {assist ? ` · assist ${assist}` : ''}
              </p>
            )}
            <div className="mt-2 flex items-center gap-2">
              <CrowdMeter loud={ours} reduced={m.reduced} />
              <p className="min-w-0 flex-1 text-[13px] leading-snug text-ink-muted text-pretty">
                {crowdLine(ours, attendance, isDerby)}
              </p>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}

/**
 * The crowd, as five bars.
 *
 * Not a decoration: a goal for the side the player manages and a goal against
 * them produce identical scorelines and completely different rooms, and that
 * difference is most of what a stadium is for. Loud is volt and moving; an
 * away-end goal leaves five flat grey bars and no animation at all.
 */
function CrowdMeter({ loud, reduced }: { loud: boolean; reduced: boolean }): ReactNode {
  const heights = loud ? [8, 15, 20, 15, 10] : [4, 6, 5, 6, 4];
  return (
    <span aria-hidden="true" className="flex h-5 shrink-0 items-end gap-0.5">
      {heights.map((h, i) => (
        <motion.span
          key={i}
          className="block w-1 rounded-pill"
          style={{ background: loud ? 'var(--color-volt)' : 'var(--color-ink-faint)' }}
          initial={{ height: 3 }}
          animate={
            reduced || !loud
              ? { height: h }
              : { height: [h * 0.55, h, h * 0.7, h * 0.95, h * 0.6] }
          }
          transition={
            reduced || !loud
              ? { duration: 0.2 }
              : { duration: 1.5, repeat: Infinity, ease: 'easeInOut', delay: i * 0.06 }
          }
        />
      ))}
    </span>
  );
}

/** What the ground does. Written from the manager's side, never from the away end's. */
function crowdLine(ours: boolean, attendance: number, isDerby: boolean): string {
  const big = attendance >= 12000;
  if (ours) {
    if (isDerby) return 'The place loses its mind. They will talk about this one for years.';
    return big
      ? 'The whole ground is on its feet.'
      : 'Every voice in the ground goes up at once.';
  }
  if (isDerby) return 'The away end erupts. Your end has gone very quiet.';
  return big
    ? 'Quiet, apart from one corner of the ground.'
    : 'A thin cheer from the away end, and nothing else.';
}

/** The one-word badge over a goal. Read off the event, never guessed. */
function goalFlavour(goal: MatchEvent): string | undefined {
  if (goal.type === 'PENALTY_SCORED') return 'PENALTY';
  const multiplier = goal.detail?.multiplier;
  if (typeof multiplier === 'number' && multiplier > 1) return `${multiplier}× GOAL`;
  const distance = goal.detail?.distance;
  if (typeof distance === 'number' && distance > 0.24) return 'SCREAMER';
  if (typeof goal.xg === 'number' && goal.xg < 0.08) return 'OUT OF NOTHING';
  return undefined;
}
