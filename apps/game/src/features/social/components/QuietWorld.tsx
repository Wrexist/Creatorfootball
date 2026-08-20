import { type ReactNode } from 'react';
import type { Club, Creator, Fixture } from '@cf/engine';
import {
  ClubBadge, CreatorAvatar, GlassButton, GlassPanel, GlassPill, HeroSurface,
  IconBall, IconSocial, IconVerified, ListRow, NameText, Text, formatCount,
} from '@/design';

/**
 * Day one, composed.
 *
 * The old empty state was a grey circle, a sentence and a button occupying two
 * thirds of the screen — the single worst surface in the product, and the one a
 * new player sees first. Nothing has happened yet, which is *true*, but "there
 * is nothing here" is not the interesting version of that truth. The
 * interesting version is that the world already exists and is about to start
 * talking about you: your opponent is real and already has a following, your
 * creators are already signed, and the first match is the switch that turns all
 * of it on.
 *
 * So this builds anticipation from facts the engine already holds — the real
 * next opponent, the real creator roster, the real follower count — and offers
 * exactly one route out: Matchday.
 */

export interface QuietWorldProps {
  /** The opponent in the next scheduled fixture, when there is one. */
  opponent: Club | undefined;
  fixture: Fixture | undefined;
  phaseLabel: string;
  /** Creators already signed to the player's club. */
  creators: readonly Creator[];
  followers: number;
  onGoToMatchday: () => void;
  onOpenCreator: (creatorId: string) => void;
}

export function QuietWorld({
  opponent, fixture, phaseLabel, creators, followers, onGoToMatchday, onOpenCreator,
}: QuietWorldProps): ReactNode {
  const previews: { title: string; detail: string; icon: ReactNode }[] = [
    {
      title: 'Your first match is where it starts',
      detail: fixture
        ? `${phaseLabel}, matchweek ${fixture.week}. Every result writes posts — a win, a red card, a bad afternoon. They all end up here.`
        : 'Every result writes posts — a win, a red card, a bad afternoon. They all end up here.',
      icon: <IconBall />,
    },
    {
      title: opponent
        ? `${opponent.name} will have something to say`
        : 'Your opening opponent will have something to say',
      detail: opponent
        ? `${opponent.shortName} carry ${formatCount(opponent.fans.onlineFollowers)} followers of their own, and they post before the whistle as well as after it.`
        : 'Rival fans post before the whistle as well as after it.',
      icon: <IconSocial />,
    },
    {
      title:
        creators.length > 0
          ? `${creators.length} ${creators.length === 1 ? 'creator is' : 'creators are'} already on your books`
          : 'Creators amplify everything you do',
      detail:
        creators.length > 0
          ? 'They react to your results in their own voice. Sign more and your reach grows with them.'
          : 'Sign one and your reach grows with theirs. Everything they post traces back to a real event.',
      icon: <IconVerified />,
    },
  ];

  return (
    <>
      <HeroSurface
        eyebrow="The feed"
        title="The world is quiet"
        subtitle="Nothing has happened yet, so nobody has said anything yet. Every post in this feed is written by a real event — play a match and the noise starts."
        texture="haze"
        padding="md"
        footer={
          <GlassButton variant="primary" icon={<IconBall />} onClick={onGoToMatchday} block>
            Go to matchday
          </GlassButton>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <GlassPill size="sm" tone="volt" filled>
            {formatCount(followers)} followers
          </GlassPill>
          <Text role="label" as="span">
            already following your club
          </Text>
        </div>
      </HeroSurface>

      <GlassPanel title="What is coming" padding="md">
        <ul className="flex flex-col gap-3.5">
          {previews.map((preview) => (
            <li key={preview.title} className="flex gap-3">
              <span
                aria-hidden="true"
                className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-pill bg-volt/12 text-volt [&_svg]:size-4"
              >
                {preview.icon}
              </span>
              <span className="min-w-0">
                <Text role="section" as="span" className="block text-pretty">
                  {preview.title}
                </Text>
                <Text role="caption" as="span" className="mt-0.5 block text-pretty">
                  {preview.detail}
                </Text>
              </span>
            </li>
          ))}
        </ul>
      </GlassPanel>

      {opponent && (
        <GlassPanel title="Who you play first" padding="md">
          <ListRow
            leading={<ClubBadge visual={opponent.visual} size={34} label={opponent.name} />}
            title={
              <NameText
                name={opponent.name}
                short={opponent.shortName}
                abbr={opponent.abbreviation}
                role="section"
                lines={2}
              />
            }
            subtitle={opponent.motto}
            divided={false}
            trailing={
              <GlassPill size="xs">
                {formatCount(opponent.fans.onlineFollowers)} followers
              </GlassPill>
            }
          />
        </GlassPanel>
      )}

      {creators.length > 0 && (
        <GlassPanel title="Your creators" padding="md">
          <div className="flex flex-col">
            {creators.slice(0, 3).map((creator, index) => (
              <ListRow
                key={creator.id}
                density="compact"
                divided={index < Math.min(3, creators.length) - 1}
                leading={<CreatorAvatar seed={creator.avatarSeed} size={32} />}
                title={<NameText name={creator.displayName} role="bodyStrong" lines={2} />}
                subtitle={`${formatCount(creator.followers)} followers · ${creator.handle}`}
                onPress={() => onOpenCreator(creator.id)}
                chevron
              />
            ))}
          </div>
          <Text role="caption" as="p" className="mt-3 text-ink-dim text-pretty">
            Reach follows your creators and your results. It is not something you buy.
          </Text>
        </GlassPanel>
      )}
    </>
  );
}
