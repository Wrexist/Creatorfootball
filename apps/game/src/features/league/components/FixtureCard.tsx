import { memo, type ReactNode } from 'react';
import type { Fixture } from '@cf/engine';
import {
  ClubBadge, FOCUS_RING, FormGuide, GlassPill, IconFlame, ScorePanel, Text, cn,
  type MatchCardSide,
} from '@/design';

/**
 * A fixture, told as a broadcast graphic.
 *
 * The body is the kit's `ScorePanel`, which puts club names through `NameText`
 * — so a long name shortens to its short name and then to its abbreviation
 * rather than to an ellipsis. Around it this card adds the two things a fixture
 * list actually needs and a scoreboard does not: what the week is *called*
 * ("Derby Week", never "MW 7"), and the form each side brings into it.
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
  size?: 'md' | 'lg';
  onPress?: () => void;
  className?: string;
}

function FormLine({ side, align }: { side: MatchCardSide; align: 'left' | 'right' }): ReactNode {
  if (!side.form || side.form.length === 0) return null;
  return (
    <span className={cn('flex items-center gap-1.5', align === 'right' && 'flex-row-reverse')}>
      <ClubBadge visual={side.visual} size={16} flat />
      <FormGuide results={side.form.slice(-3)} size="sm" />
    </span>
  );
}

export const FixtureCard = memo(function FixtureCard({
  fixture, home, away, phaseLabel, kicker, competitionLabel, size = 'md', onPress, className,
}: FixtureCardProps): ReactNode {
  const played = fixture.homeScore !== null && fixture.awayScore !== null;
  const hasForm = Boolean(home.form?.length || away.form?.length);

  const body = (
    <>
      <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
        {kicker !== undefined && <Text role="eyebrow" as="span">{kicker}</Text>}
        <GlassPill tone={fixture.isDerby ? 'danger' : 'neutral'} size="xs">
          {phaseLabel}
        </GlassPill>
        {fixture.isDerby && (
          <GlassPill tone="danger" size="xs" filled icon={<IconFlame size={11} />}>
            Derby
          </GlassPill>
        )}
        <Text role="micro" as="span" className="ml-auto shrink-0">
          {played ? 'Full time' : `Matchweek ${fixture.week}`}
        </Text>
      </div>

      <ScorePanel
        home={{
          name: home.name,
          shortName: home.shortName,
          abbreviation: home.abbreviation,
          color: home.visual.primary,
          score: fixture.homeScore,
          emblem: <ClubBadge visual={home.visual} size={size === 'lg' ? 30 : 24} flat />,
        }}
        away={{
          name: away.name,
          shortName: away.shortName,
          abbreviation: away.abbreviation,
          color: away.visual.primary,
          score: fixture.awayScore,
          emblem: <ClubBadge visual={away.visual} size={size === 'lg' ? 30 : 24} flat />,
        }}
        size={size}
        status={played ? 'FT' : fixture.stageLabel ?? 'Kick-off'}
        {...(competitionLabel ? { context: competitionLabel } : {})}
      />

      {hasForm && (
        <div className="mt-2.5 flex items-center justify-between gap-3">
          <FormLine side={home} align="left" />
          <Text role="micro" as="span" className="shrink-0">
            Last three
          </Text>
          <FormLine side={away} align="right" />
        </div>
      )}
    </>
  );

  if (!onPress) return <article className={cn('min-w-0', className)}>{body}</article>;
  return (
    <button
      type="button"
      onClick={onPress}
      aria-label={`${home.name} versus ${away.name}, ${phaseLabel}, matchweek ${fixture.week}`}
      className={cn('block w-full min-w-0 rounded-lg text-left', FOCUS_RING, className)}
    >
      {body}
    </button>
  );
});
