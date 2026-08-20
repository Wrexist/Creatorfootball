import { memo, type ReactNode } from 'react';
import type { Fixture } from '@cf/engine';
import {
  ClubBadge, FOCUS_RING, FormGuide, GlassPill, IconFlame, cn, type MatchCardSide,
} from '@/design';
import { FitText } from './FitText';

/**
 * A fixture, stacked.
 *
 * The design system's `MatchCard` puts both clubs side by side, which is the
 * right shape for a scoreboard and the wrong one for a league of clubs called
 * things like "Saltpit Wanderers": at 393px each side gets about 110px and the
 * name is cut in half. Stacking the two clubs gives each name the full width of
 * the card, so the name is simply the name.
 *
 * The card also says which week this is in the language of the season —
 * "Rivalry Week", not "MW 7" — because that is the thing a player remembers.
 */

export interface FixtureCardProps {
  fixture: Fixture;
  home: MatchCardSide;
  away: MatchCardSide;
  /** Narrative name for the matchweek, e.g. "Derby Week". */
  phaseLabel: string;
  /** Which club is the player's, so it can be marked. */
  ourClubId: string;
  /** Leading line above the clubs — "Next up", "Last time out". */
  kicker?: string;
  size?: 'md' | 'lg';
  onPress?: () => void;
  className?: string;
}

interface RowProps {
  side: MatchCardSide;
  score: number | null;
  played: boolean;
  ours: boolean;
  winner: boolean;
  big: boolean;
  venue: 'Home' | 'Away';
}

const Row = memo(function Row({
  side, score, played, ours, winner, big, venue,
}: RowProps): ReactNode {
  return (
    <div className="flex items-center gap-2.5">
      <ClubBadge visual={side.visual} size={big ? 32 : 26} flat={!big} label={side.name} />
      <div className="min-w-0 flex-1">
        <FitText
          max={big ? 19 : 16}
          min={12}
          lines={2}
          leading={1.15}
          className={cn(
            'font-display font-bold tracking-[-0.015em]',
            ours ? 'text-ink' : played && !winner ? 'text-ink-muted' : 'text-ink',
          )}
        >
          {side.name}
        </FitText>
        {side.form && side.form.length > 0 && (
          <span className="mt-1 flex items-center gap-1.5">
            <FormGuide results={side.form.slice(-3)} size="sm" />
            <span className="text-[10px] uppercase tracking-[0.14em] text-ink-dim">{venue}</span>
          </span>
        )}
      </div>
      {played ? (
        <span
          className={cn(
            'tnum shrink-0 font-display text-[22px] font-bold leading-none',
            winner ? 'text-ink' : 'text-ink-muted',
          )}
        >
          {score}
        </span>
      ) : (
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-dim">
          {venue}
        </span>
      )}
    </div>
  );
});

export const FixtureCard = memo(function FixtureCard({
  fixture, home, away, phaseLabel, ourClubId, kicker, size = 'md', onPress, className,
}: FixtureCardProps): ReactNode {
  const played = fixture.homeScore !== null && fixture.awayScore !== null;
  const big = size === 'lg';
  const homeWins = played && (fixture.homeScore as number) > (fixture.awayScore as number);
  const awayWins = played && (fixture.awayScore as number) > (fixture.homeScore as number);

  const body = (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {kicker !== undefined && (
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-volt">
            {kicker}
          </span>
        )}
        <GlassPill tone={fixture.isDerby ? 'danger' : 'neutral'} size="xs">
          {phaseLabel}
        </GlassPill>
        {fixture.isDerby && (
          <GlassPill tone="danger" size="xs" filled icon={<IconFlame size={11} />}>
            Derby
          </GlassPill>
        )}
        <span className="ml-auto shrink-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-dim">
          {played ? 'Full time' : `Week ${fixture.week}`}
        </span>
      </div>

      <div className="flex flex-col gap-2.5">
        <Row
          side={home}
          score={fixture.homeScore}
          played={played}
          ours={home.clubId === ourClubId}
          winner={homeWins}
          big={big}
          venue="Home"
        />
        <Row
          side={away}
          score={fixture.awayScore}
          played={played}
          ours={away.clubId === ourClubId}
          winner={awayWins}
          big={big}
          venue="Away"
        />
      </div>
    </>
  );

  const shell = cn(
    'glass-2 glass-sheen relative block w-full overflow-hidden rounded-lg text-left',
    big ? 'p-4' : 'p-3.5',
    fixture.isDerby && 'ring-1 ring-inset ring-danger/25',
    className,
  );

  if (!onPress) return <article className={shell}>{body}</article>;
  return (
    <button
      type="button"
      onClick={onPress}
      aria-label={`${home.name} versus ${away.name}, ${phaseLabel}, matchweek ${fixture.week}`}
      className={cn(shell, FOCUS_RING, 'hover:bg-white/[0.03]')}
    >
      {body}
    </button>
  );
});
