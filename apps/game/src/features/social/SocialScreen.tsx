import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PHASE_LABELS, clubCreators, nextFixture, socialReach, type GameState,
} from '@cf/engine';
import {
  Divider, EmptyState, GlassButton, GlassIcon, GlassPanel, GlassSegmented, GlassSheet,
  IconBall, IconBell, IconSocial, KeyValueRow, ListRow, Screen, SectionHeader, StatBlock,
  Text, formatCount,
} from '@/design';
import { ROUTES, buildPath } from '@/app/routes';
import { GateScreen, useGameStatus } from './gate';
import { assignTiers, describeEvent, useEventIndex, useFeed, type FeedFilter } from './data';
import { FeedItem } from './components/FeedItem';
import { QuietWorld } from './components/QuietWorld';

/**
 * The feed.
 *
 * This is the football ecosystem talking about your club: supporters, creators,
 * the press, rival fans, players, sponsors and the occasional leak.
 *
 * Two things carry the screen. On day one there is no feed, and rather than an
 * apology for that, `QuietWorld` builds the anticipation — who you play first,
 * who is already following, and the one button that turns the world on. Once
 * posts exist, the feed is *edited* rather than listed: `post.weight` decides
 * whether a story runs as a lead, a standard post or a line of chatter, so a
 * derby defeat physically outweighs a fan's throwaway joke.
 */

const PAGE = 30;

const FILTERS: readonly { value: FeedFilter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'CREATOR', label: 'Creators' },
  { value: 'RIVAL', label: 'Rivals' },
  { value: 'CLUB', label: 'Club' },
  { value: 'MEDIA', label: 'Press' },
];

const relative = (now: number, then: number): string => {
  const delta = Math.max(0, now - then);
  if (delta === 0) return 'this week';
  if (delta === 1) return 'last week';
  return `${delta}w ago`;
};

function SocialView({ state }: { state: GameState }): ReactNode {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<FeedFilter>('ALL');
  const [limit, setLimit] = useState(PAGE);
  const [openEventFor, setOpenEventFor] = useState<string | null>(null);

  const posts = useFeed(state, filter, limit);
  const tiers = useMemo(() => assignTiers(posts), [posts]);
  const events = useEventIndex(state);
  const reach = useMemo(() => socialReach(state), [state]);
  const creators = useMemo(() => clubCreators(state, state.playerClubId), [state]);
  const upcoming = useMemo(() => nextFixture(state), [state]);

  const opponent = upcoming
    ? state.clubs[
        upcoming.homeClubId === state.playerClubId ? upcoming.awayClubId : upcoming.homeClubId
      ]
    : undefined;

  const unreadStories = useMemo(
    () => state.media.stories.filter((story) => !story.read).length,
    [state.media.stories],
  );

  const openedPost = openEventFor ? state.social.posts.find((p) => p.id === openEventFor) : undefined;
  const openedEvent = openedPost?.relatedEventId ? events.get(openedPost.relatedEventId) : undefined;
  const described = openedEvent ? describeEvent(openedEvent) : null;

  const totalPosts = state.social.posts.length;
  const worldIsQuiet = totalPosts === 0;

  /* Reach is a footnote on day one and a headline once it moves, so it is
     rendered as two numbers with a plain line each rather than a dashboard. */
  const reachPanel = (
    <GlassPanel title="Your reach" padding="md">
      <div className="grid grid-cols-2 gap-3">
        <StatBlock
          label="Followers"
          value={formatCount(state.social.clubFollowers)}
          tone="volt"
          caption={
            reach.followerDelta === 0
              ? 'Unchanged this week'
              : `${reach.followerDelta > 0 ? '+' : ''}${formatCount(reach.followerDelta)} this week`
          }
        />
        <StatBlock
          label="Impressions"
          value={formatCount(reach.impressions)}
          caption="Times your club was seen this week"
        />
      </div>
      <Text role="caption" as="p" className="mt-3 text-ink-dim text-pretty">
        Reach follows your creators and your results. It is not something you buy.
      </Text>
    </GlassPanel>
  );

  return (
    <Screen
      title="Social"
      subtitle={
        worldIsQuiet
          ? 'Nobody has posted about your club yet'
          : `${totalPosts} posts about your club`
      }
      actions={
        <GlassIcon
          label={unreadStories > 0 ? `Media, ${unreadStories} unread` : 'Media'}
          icon={<IconBell />}
          variant="ghost"
          {...(unreadStories > 0 ? { badge: unreadStories } : {})}
          onClick={() => navigate(ROUTES.media)}
        />
      }
      headerAccessory={
        worldIsQuiet ? undefined : (
          <GlassSegmented
            options={FILTERS}
            value={filter}
            onChange={(next) => { setFilter(next); setLimit(PAGE); }}
            aria-label="Filter the feed"
            block
            nested
          size="sm"
        />
        )
      }
      aside={worldIsQuiet ? undefined : reachPanel}
      /* The one route out of a quiet world lives in the screen's own footer.
         A button pinned by a screen at its own stacking level ends up beneath
         the fixed tab bar and stops being tappable; `Screen`'s footer lifts
         itself clear of the bar, so this is the only correct place for it. */
      footer={
        worldIsQuiet ? (
          <GlassButton variant="primary" size="lg" icon={<IconBall />} block
            onClick={() => navigate(ROUTES.matchday)}
          >
            Go to matchday
          </GlassButton>
        ) : undefined
      }
    >
      {worldIsQuiet ? (
        <QuietWorld
          opponent={opponent}
          fixture={upcoming ?? undefined}
          phaseLabel={upcoming ? PHASE_LABELS[upcoming.phase] : PHASE_LABELS[state.clock.phase]}
          creators={creators}
          followers={state.social.clubFollowers}
          onOpenCreator={(creatorId) =>
            navigate(buildPath(ROUTES.creator, { creatorId }))}
        />
      ) : (
        <>
          <div className="md:hidden">{reachPanel}</div>

          {posts.length === 0 ? (
            <GlassPanel padding="md">
              <EmptyState
                size="sm"
                icon={<IconSocial />}
                title="Nothing from them yet"
                description="Nobody in this corner of the ecosystem has said anything about you. Change that on the pitch, or look at everything."
                action={
                  <GlassButton variant="secondary" size="sm" onClick={() => setFilter('ALL')}>
                    Show everything
                  </GlassButton>
                }
              />
            </GlassPanel>
          ) : (
            <>
              <SectionHeader
                title="The feed"
                subtitle="One story leads each matchweek; the rest is arranged around it. Nothing here is invented — every post traces back to something that happened."
              />
              <div className="flex flex-col gap-3">
                {posts.map((post) => (
                  <FeedItem
                    key={post.id}
                    post={post}
                    timeLabel={relative(state.clock.cycle, post.cycle)}
                    hasEvent={Boolean(post.relatedEventId && events.has(post.relatedEventId))}
                    onOpenEvent={setOpenEventFor}
                    {...(tiers.get(post.id) ? { tier: tiers.get(post.id) } : {})}
                  />
                ))}
              </div>
              {posts.length >= limit && (
                <GlassButton variant="secondary" block onClick={() => setLimit((n) => n + PAGE)}>
                  Load older posts
                </GlassButton>
              )}
            </>
          )}
        </>
      )}

      <GlassSheet
        open={openEventFor !== null}
        onClose={() => setOpenEventFor(null)}
        title={described?.title ?? 'What happened'}
        subtitle={openedEvent ? `Matchweek ${openedEvent.week}, season ${openedEvent.season}` : undefined}
        size="auto"
      >
        {described && openedEvent ? (
          <div className="flex flex-col gap-3">
            <Text role="body" as="p" className="text-pretty">{described.detail}</Text>
            <Divider label="Who it involved" />
            <ul className="flex flex-col gap-1.5">
              {openedEvent.entities.map((entity) => {
                const isCreator = entity.kind === 'creator' && state.creators[entity.id] !== undefined;
                return (
                  <li key={`${entity.kind}-${entity.id}`}>
                    {isCreator ? (
                      <ListRow
                        density="compact"
                        divided={false}
                        title={entity.name}
                        subtitle={entity.kind}
                        chevron
                        onPress={() => {
                          setOpenEventFor(null);
                          navigate(buildPath(ROUTES.creator, { creatorId: entity.id }));
                        }}
                      />
                    ) : (
                      <KeyValueRow label={entity.name} value={entity.kind} divided={false} />
                    )}
                  </li>
                );
              })}
            </ul>
            <Text role="caption" as="p" className="text-ink-dim text-pretty">
              Every post in this feed is generated from an event like this one. If a post has no
              event behind it, that is a bug — not a flourish.
            </Text>
          </div>
        ) : (
          <Text role="body" as="p" tone="muted">
            The event behind this post has aged out of the journal.
          </Text>
        )}
      </GlassSheet>
    </Screen>
  );
}

export function SocialScreen(): ReactNode {
  const gate = useGameStatus();
  if (gate.status !== 'ready') return <GateScreen gate={gate} title="Social" />;
  return <SocialView state={gate.state} />;
}
