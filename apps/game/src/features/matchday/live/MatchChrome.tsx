import { memo, type ReactNode } from 'react';
import { motion } from 'motion/react';
import type { Club } from '@cf/engine';
import {
  ClubBadge, GlassIcon, GlassPill, IconCard, IconClock, IconPause, IconPlay, IconSwap,
  IconTactics, IconX, MomentumBar, cn, haptics, useDesignMotion,
} from '@/design';
import { useMatchStore, type MatchSpeed } from '@/state/matchStore';
import { SPEED_LABEL, minuteLabel, momentumPhrase } from '../shared/format';

/**
 * The chrome around the pitch.
 *
 * The header is the screen's one blurring surface — the glass budget for this
 * route is header plus whichever overlay is open (a decision, a sheet), and
 * nothing else in the live match blurs. The control rail is therefore a solid
 * tint, which is also the right call for a strip that sits under a thumb for
 * thirty minutes.
 *
 * ## No name is ever cut in half
 *
 * A 393pt header has to carry two identities, a scoreline, a clock and a way
 * out. Three-letter abbreviations are the club's own, designed for exactly this
 * space, and they cannot truncate; the *full* short names are never dropped,
 * they move one line down into the momentum sentence, which has room to set
 * them and needs them anyway to say something a beginner can act on. An
 * ellipsis is never an acceptable answer to a club's name.
 */

export interface MatchHeaderProps {
  home: Club;
  away: Club;
  totalMinutes: number;
  onExit: () => void;
}

export const MatchHeader = memo(function MatchHeader({
  home, away, totalMinutes, onExit,
}: MatchHeaderProps): ReactNode {
  const m = useDesignMotion();
  const homeScore = useMatchStore((s) => s.homeScore);
  const awayScore = useMatchStore((s) => s.awayScore);
  const minute = useMatchStore((s) => s.minute);
  const momentum = useMatchStore((s) => s.momentum);
  const playback = useMatchStore((s) => s.playback);

  const live = playback === 'PLAYING' || playback === 'AWAITING_DECISION';
  const clock =
    playback === 'COMPLETE' ? 'Full time'
      : playback === 'PAUSED' ? 'Paused'
        : `${minuteLabel(Math.min(minute, totalMinutes))} of ${totalMinutes}`;

  return (
    <header className="glass-3 relative z-30 shrink-0 pt-[var(--safe-top)]">
      <div className="mx-auto w-full max-w-[1180px] px-2 pb-2 pt-1 sm:px-5">
        <div className="flex items-center gap-1">
          <GlassIcon label="Leave match" icon={<IconX />} variant="ghost" size="md" onClick={onExit} />

          <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
            <ClubBadge visual={home.visual} size={24} flat label={home.name} />
            <span className="text-[13px] font-bold tracking-[0.04em] text-ink-muted">
              {home.abbreviation}
            </span>
            <motion.span
              key={`${homeScore}-${awayScore}`}
              initial={m.reduced ? { opacity: 0.6 } : { scale: 1.24 }}
              animate={m.reduced ? { opacity: 1 } : { scale: 1 }}
              transition={m.spring.bouncy}
              className="tnum px-1 font-display text-[26px] font-bold leading-none tracking-[-0.04em] text-ink"
            >
              {homeScore}<span className="px-1 text-ink-faint">–</span>{awayScore}
            </motion.span>
            <span className="text-[13px] font-bold tracking-[0.04em] text-ink-muted">
              {away.abbreviation}
            </span>
            <ClubBadge visual={away.visual} size={24} flat label={away.name} />
          </div>

          <div className="flex min-w-[52px] items-center justify-end gap-1">
            {/* Volt is the product's colour for "this is live and moving", and
                the live match is the one screen that should be wearing it. */}
            {live && (
              <span
                aria-hidden="true"
                className={cn('block size-1.5 rounded-pill bg-volt', !m.reduced && 'animate-pulse')}
              />
            )}
            <span className={cn('tnum text-[12px] font-bold', live ? 'text-volt' : 'text-ink')}>
              {playback === 'COMPLETE' ? 'FT' : minuteLabel(Math.min(minute, totalMinutes))}
            </span>
          </div>
        </div>

        <div className="mt-1.5">
          <MomentumBar
            value={momentum}
            homeColor={home.visual.primary}
            awayColor={away.visual.primary}
            homeLabel={home.shortName}
            awayLabel={away.shortName}
            size="sm"
          />
          {/* The one line that tells a new player what is going on. It is not
              sr-only, because "who is on top right now" is the single question
              the pitch is hardest to answer at a glance. */}
          <p className="mt-1 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-ink-muted">
            <span className="text-pretty text-center">
              {momentumPhrase(momentum, home.shortName, away.shortName)}
            </span>
            <span aria-hidden="true" className="text-ink-faint">·</span>
            <span className="tnum shrink-0 text-ink-dim">{clock}</span>
          </p>
        </div>
      </div>
    </header>
  );
});

/* --- the control rail -------------------------------------------------- */

export interface MatchControlRailProps {
  speed: MatchSpeed;
  subsRemaining: number;
  ruleCardCount: number;
  onOpenSpeed: () => void;
  onOpenSubs: () => void;
  onOpenTactics: () => void;
  onOpenCards: () => void;
}

/**
 * Five controls, one row, nothing hidden.
 *
 * The previous bar laid out a play button, a four-option speed segment, a
 * fast-forward icon and three chips across two rows, and still cut "Instant" in
 * half. This is the same set of powers in half the height: the transport
 * control keeps its own weight because it is pressed most, speed collapses to
 * its current value (the four choices and what each one means live one tap
 * away, where there is room to explain them), and the three managerial actions
 * each keep a full 44pt target and a word that fits.
 */
export const MatchControlRail = memo(function MatchControlRail({
  speed, subsRemaining, ruleCardCount, onOpenSpeed, onOpenSubs, onOpenTactics, onOpenCards,
}: MatchControlRailProps): ReactNode {
  const playback = useMatchStore((s) => s.playback);
  const play = useMatchStore((s) => s.play);
  const pause = useMatchStore((s) => s.pause);

  const playing = playback === 'PLAYING';
  const finished = playback === 'COMPLETE';
  const locked = finished || playback === 'AWAITING_DECISION';

  return (
    <nav
      aria-label="Match controls"
      className="relative z-30 shrink-0 border-t border-white/[0.07] bg-surface-2/95"
      style={{ paddingBottom: 'var(--safe-bottom)' }}
    >
      <div className="mx-auto flex w-full max-w-[1180px] items-stretch gap-1.5 px-2 py-2 sm:px-5">
        <RailButton
          label={playing ? 'Pause' : finished ? 'Done' : 'Play'}
          icon={playing ? <IconPause /> : <IconPlay />}
          onPress={playing ? pause : play}
          disabled={locked}
          primary
          grow={1.5}
        />
        <RailButton
          label={SPEED_LABEL[speed]}
          hint="Match speed"
          icon={<IconClock />}
          onPress={onOpenSpeed}
          disabled={finished}
        />
        <RailButton
          label="Subs"
          badge={subsRemaining}
          hint={`${subsRemaining} substitutions left`}
          icon={<IconSwap />}
          onPress={onOpenSubs}
          disabled={subsRemaining <= 0 || finished}
        />
        <RailButton
          label="Tactics"
          icon={<IconTactics />}
          onPress={onOpenTactics}
          disabled={finished}
        />
        <RailButton
          label="Cards"
          badge={ruleCardCount}
          hint={`${ruleCardCount} rule cards in hand`}
          icon={<IconCard />}
          onPress={onOpenCards}
          disabled={ruleCardCount <= 0 || finished}
        />
      </div>
    </nav>
  );
});

function RailButton({
  label, hint, badge, icon, onPress, disabled, primary, grow = 1,
}: {
  label: string;
  hint?: string;
  badge?: number;
  icon: ReactNode;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
  grow?: number;
}): ReactNode {
  return (
    <button
      type="button"
      onClick={() => { haptics.selection(); onPress(); }}
      disabled={disabled}
      aria-label={hint ? `${label}. ${hint}` : label}
      style={{ flexGrow: grow }}
      className={cn(
        'relative flex min-h-11 flex-1 basis-0 flex-col items-center justify-center gap-0.5 rounded-md px-1 py-1.5',
        'transition-colors duration-[var(--duration-fast)]',
        'outline-none focus-visible:ring-2 focus-visible:ring-volt focus-visible:ring-offset-2 focus-visible:ring-offset-base',
        primary
          ? 'bg-volt text-volt-ink hover:bg-volt-bright'
          : 'bg-white/[0.06] text-ink hover:bg-white/12',
        disabled && 'pointer-events-none opacity-35',
        '[&_svg]:size-[18px]',
      )}
    >
      {icon}
      <span className="text-micro font-bold uppercase tracking-[0.06em] leading-none">
        {label}
      </span>
      {badge !== undefined && badge > 0 && (
        <span
          className={cn(
            'tnum absolute right-1 top-1 min-w-4 rounded-pill px-1 text-micro font-bold leading-4',
            primary ? 'bg-volt-ink text-volt' : 'bg-white/16 text-ink',
          )}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

/** Small status strip used by the broadcast view. */
export function LiveBadge({ playback }: { playback: string }): ReactNode {
  if (playback === 'COMPLETE') return <GlassPill tone="neutral" size="sm">Full time</GlassPill>;
  if (playback === 'PAUSED') return <GlassPill tone="warning" size="sm">Paused</GlassPill>;
  if (playback === 'AWAITING_DECISION') return <GlassPill tone="volt" size="sm">Your call</GlassPill>;
  return <GlassPill tone="danger" size="sm" filled>Live</GlassPill>;
}
