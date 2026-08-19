import { memo, type ReactNode } from 'react';
import type { Club } from '@cf/engine';
import {
  ClubBadge, GlassButton, GlassIcon, GlassPill, GlassSegmented, IconCard, IconFastForward,
  IconPause, IconPlay, IconSwap, IconTactics, IconX, MomentumBar, ScoreDisplay, cn,
} from '@/design';
import { useMatchStore, type MatchSpeed } from '@/state/matchStore';
import { minuteLabel, momentumPhrase } from '../shared/format';

/**
 * The chrome that both presentation modes share.
 *
 * The header is the screen's one blurring surface — the glass budget for this
 * route is header plus whichever overlay is open (a decision, a sheet), and
 * nothing else in the live match blurs. The control bar is therefore a solid
 * tint, which is also the right call for a strip that sits under a thumb for
 * thirty minutes.
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
  const homeScore = useMatchStore((s) => s.homeScore);
  const awayScore = useMatchStore((s) => s.awayScore);
  const minute = useMatchStore((s) => s.minute);
  const momentum = useMatchStore((s) => s.momentum);
  const playback = useMatchStore((s) => s.playback);
  const presentation = useMatchStore((s) => s.presentation);
  const setPresentation = useMatchStore((s) => s.setPresentation);

  const live = playback === 'PLAYING' || playback === 'AWAITING_DECISION';
  const status =
    playback === 'COMPLETE' ? 'FT'
      : playback === 'PAUSED' ? 'PAUSED'
        : minuteLabel(minute);

  return (
    <header className="glass-3 relative z-30 shrink-0 pt-[var(--safe-top)]">
      <div className="mx-auto w-full max-w-[1180px] px-3 pb-2 pt-1.5 sm:px-5">
        <div className="flex items-center gap-2">
          <GlassIcon label="Leave match" icon={<IconX />} variant="ghost" size="md" onClick={onExit} />

          <div className="flex min-w-0 flex-1 items-center justify-center gap-3">
            <ClubBadge visual={home.visual} size={26} flat label={home.name} />
            <span className="hidden truncate text-[13px] font-semibold text-ink-muted sm:inline">
              {home.abbreviation}
            </span>
            <ScoreDisplay
              home={homeScore}
              away={awayScore}
              size="md"
              status={status}
              live={live}
              homeLabel={home.shortName}
              awayLabel={away.shortName}
            />
            <span className="hidden truncate text-[13px] font-semibold text-ink-muted sm:inline">
              {away.abbreviation}
            </span>
            <ClubBadge visual={away.visual} size={26} flat label={away.name} />
          </div>

          <div className="min-w-11 text-right">
            <span className="tnum text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-dim">
              {Math.min(minute, totalMinutes)}/{totalMinutes}
            </span>
          </div>
        </div>

        <div className="mt-2">
          <MomentumBar
            value={momentum}
            homeColor={home.visual.primary}
            awayColor={away.visual.primary}
            homeLabel={home.abbreviation}
            awayLabel={away.abbreviation}
            size="sm"
          />
          <p className="sr-only">{momentumPhrase(momentum, home.shortName, away.shortName)}</p>
        </div>

        <div className="mt-2">
          <GlassSegmented
            size="sm"
            level={1}
            nested
            aria-label="Presentation mode"
            value={presentation}
            onChange={setPresentation}
            options={PRESENTATION_OPTIONS}
          />
        </div>
      </div>
    </header>
  );
});

const PRESENTATION_OPTIONS = [
  { value: 'PITCH' as const, label: 'Pitch' },
  { value: 'BROADCAST' as const, label: 'Broadcast' },
];

const SPEED_OPTIONS: readonly { value: MatchSpeed; label: string }[] = [
  { value: 'SLOW', label: 'Slow' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'FAST', label: 'Fast' },
  { value: 'INSTANT', label: 'Instant' },
];

export interface MatchControlBarProps {
  subsRemaining: number;
  ruleCardCount: number;
  onOpenSubs: () => void;
  onOpenTactics: () => void;
  onOpenCards: () => void;
  onOpenFeed?: () => void;
  feedBadge?: number;
}

export const MatchControlBar = memo(function MatchControlBar({
  subsRemaining, ruleCardCount, onOpenSubs, onOpenTactics, onOpenCards, onOpenFeed, feedBadge,
}: MatchControlBarProps): ReactNode {
  const playback = useMatchStore((s) => s.playback);
  const speed = useMatchStore((s) => s.speed);
  const play = useMatchStore((s) => s.play);
  const pause = useMatchStore((s) => s.pause);
  const setSpeed = useMatchStore((s) => s.setSpeed);
  const skipToEnd = useMatchStore((s) => s.skipToEnd);

  const playing = playback === 'PLAYING';
  const locked = playback === 'COMPLETE' || playback === 'AWAITING_DECISION';

  return (
    <div
      className="relative z-30 shrink-0 border-t border-white/[0.07] bg-surface-2/95"
      style={{ paddingBottom: 'var(--safe-bottom)' }}
    >
      <div className="mx-auto w-full max-w-[1180px] px-3 py-2.5 sm:px-5">
        <div className="flex items-center gap-2">
          <GlassButton
            variant={playing ? 'secondary' : 'primary'}
            size="md"
            disabled={locked}
            onClick={playing ? pause : play}
            icon={playing ? <IconPause /> : <IconPlay />}
            className="min-w-[112px]"
          >
            {playing ? 'Pause' : playback === 'COMPLETE' ? 'Done' : 'Play'}
          </GlassButton>

          <div className="min-w-0 flex-1">
            <GlassSegmented
              size="sm"
              level={1}
              nested
              aria-label="Match speed"
              value={speed}
              onChange={setSpeed}
              options={SPEED_OPTIONS}
            />
          </div>

          <GlassIcon
            label="Simulate the rest"
            icon={<IconFastForward />}
            variant="ghost"
            size="md"
            onClick={skipToEnd}
          />
        </div>

        <div className="mt-2 flex items-center gap-2">
          <ActionChip
            label={`Subs · ${subsRemaining}`}
            icon={<IconSwap />}
            onPress={onOpenSubs}
            disabled={subsRemaining <= 0 || playback === 'COMPLETE'}
          />
          <ActionChip label="Tactics" icon={<IconTactics />} onPress={onOpenTactics} disabled={playback === 'COMPLETE'} />
          <ActionChip
            label={`Cards · ${ruleCardCount}`}
            icon={<IconCard />}
            onPress={onOpenCards}
            disabled={ruleCardCount <= 0 || playback === 'COMPLETE'}
          />
          {onOpenFeed && (
            <ActionChip
              label="Feed"
              icon={<span className="tnum text-[11px]">{feedBadge ?? 0}</span>}
              onPress={onOpenFeed}
            />
          )}
        </div>
      </div>
    </div>
  );
});

function ActionChip({
  label, icon, onPress, disabled,
}: {
  label: string; icon: ReactNode; onPress: () => void; disabled?: boolean;
}): ReactNode {
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      className={cn(
        'inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-md',
        'bg-white/[0.06] px-2 text-[12px] font-semibold text-ink',
        'transition-colors duration-[var(--duration-fast)] hover:bg-white/12',
        'outline-none focus-visible:ring-2 focus-visible:ring-volt focus-visible:ring-offset-2 focus-visible:ring-offset-base',
        disabled && 'pointer-events-none opacity-40',
        '[&_svg]:size-4',
      )}
    >
      {icon}
      <span className="truncate">{label}</span>
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
