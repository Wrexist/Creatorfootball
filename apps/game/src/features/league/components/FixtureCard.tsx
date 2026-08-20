import { memo, type ReactNode } from 'react';
import type { Fixture } from '@cf/engine';
import {
  ClubBadge, FOCUS_RING, FormGuide, GlassPill, IconFlame, NameText, Numeric, Text, cn, rgba,
  type MatchCardSide,
} from '@/design';

/**
 * A fixture, stacked.
 *
 * The kit's `ScorePanel` is the right object for a scoreboard: two halves, a
 * score between them, television proportions. It is the wrong one for a league
 * of clubs called things like "Marrowgate Athletic" — each half gets about a
 * third of a 393pt screen, so `NameText` correctly falls back to "MGA" and the
 * fixture reads as a pair of airport codes.
 *
 * Stacking the two clubs gives each name the *full width of the card*, which is
 * the only layout in which a real club name simply appears as itself. The
 * colour post, the score column and the broadcast numerals are kept; the
 * side-by-side proportions are not.
 *
 * The card also names the week the way the season does — "Derby Week", never
 * "MW 7" — because that is the part a player remembers afterwards.
 */

export interface FixtureCardProps {
  fixture: Fixture;
  home: MatchCardSide;
  away: MatchCardSide;
  /** Narrative name for the matchweek, from the engine's phase on the fixture. */
  phaseLabel: string;
  /** Volt kicker: "Next up", "Last time out". */
  kicker?: string;
  competitionLabel?: string;
  /** Off where the surrounding block already names the phase. */
  showPhase?: boolean;
  size?: 'md' | 'lg';
  onPress?: () => void;
  className?: string;
}

interface SideRowProps {
  side: MatchCardSide;
  score: number | null;
  played: boolean;
  winner: boolean;
  venue: 'Home' | 'Away';
  big: boolean;
}

const SideRow = memo(function SideRow({
  side, score, played, winner, venue, big,
}: SideRowProps): ReactNode {
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className={cn('w-1 shrink-0 self-stretch rounded-pill', big ? 'min-h-10' : 'min-h-8')}
        style={{ background: side.visual.primary }}
      />
      <ClubBadge visual={side.visual} size={big ? 30 : 24} flat label={side.name} />
      <div className="min-w-0 flex-1">
        <NameText
          name={side.name}
          short={side.shortName}
          abbr={side.abbreviation}
          role={big ? 'section' : 'bodyStrong'}
          lines={2}
          className={played && !winner ? 'text-ink-muted' : 'text-ink'}
        />
        <span className="mt-1 flex items-center gap-2">
          <Text role="micro" as="span">{venue}</Text>
          {side.form && side.form.length > 0 && (
            <FormGuide results={side.form.slice(-3)} size="sm" />
          )}
        </span>
      </div>
      {played ? (
        <Numeric
          role={big ? 'score' : 'giant'}
          className={cn('shrink-0', !winner && 'text-ink-muted')}
        >
          {score}
        </Numeric>
      ) : null}
    </div>
  );
});

export const FixtureCard = memo(function FixtureCard({
  fixture, home, away, phaseLabel, kicker, competitionLabel, showPhase = true,
  size = 'md', onPress, className,
}: FixtureCardProps): ReactNode {
  const played = fixture.homeScore !== null && fixture.awayScore !== null;
  const big = size === 'lg';
  const homeWins = played && (fixture.homeScore as number) > (fixture.awayScore as number);
  const awayWins = played && (fixture.awayScore as number) > (fixture.homeScore as number);

  const body = (
    <>
      {/* Both clubs' light meets in the middle. Flat gradients, no blur. */}
      <span
        aria-hidden="true"
        className="absolute inset-0 -z-1"
        style={{
          background: [
            `linear-gradient(150deg, ${rgba(home.visual.primary, 0.34)} 0%, transparent 46%)`,
            `linear-gradient(330deg, ${rgba(away.visual.primary, 0.34)} 0%, transparent 46%)`,
          ].join(', '),
        }}
      />

      <div className="relative flex flex-wrap items-center gap-x-2 gap-y-1">
        {kicker !== undefined && <Text role="eyebrow" as="span">{kicker}</Text>}
        {showPhase && (
          <GlassPill tone={fixture.isDerby ? 'danger' : 'neutral'} size="xs">
            {phaseLabel}
          </GlassPill>
        )}
        {fixture.isDerby && (
          <GlassPill tone="danger" size="xs" filled icon={<IconFlame size={11} />}>
            Derby
          </GlassPill>
        )}
        <Text role="micro" as="span" className="ml-auto shrink-0 whitespace-nowrap">
          {played ? 'Full time' : `Week ${fixture.week}`}
        </Text>
      </div>

      {competitionLabel !== undefined && (
        <Text role="micro" as="p" className="relative mt-1">{competitionLabel}</Text>
      )}

      <div className="relative mt-3 flex flex-col gap-2.5">
        <SideRow
          side={home}
          score={fixture.homeScore}
          played={played}
          winner={homeWins}
          venue="Home"
          big={big}
        />
        <SideRow
          side={away}
          score={fixture.awayScore}
          played={played}
          winner={awayWins}
          venue="Away"
          big={big}
        />
      </div>
    </>
  );

  const shell = cn(
    'glass-2 glass-sheen relative isolate block w-full overflow-hidden rounded-lg text-left',
    big ? 'p-4' : 'p-3.5',
    fixture.isDerby && 'ring-1 ring-inset ring-danger/25',
    className,
  );

  if (!onPress) return <article className={shell}>{body}</article>;
  return (
    <button
      type="button"
      onClick={onPress}
      aria-label={
        `${home.name} versus ${away.name}, ${phaseLabel}, matchweek ${fixture.week}` +
        (played ? `, ${fixture.homeScore} to ${fixture.awayScore}` : '')
      }
      className={cn(shell, FOCUS_RING, 'hover:bg-white/[0.03]')}
    >
      {body}
    </button>
  );
});
