import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { socialReach, type GameState } from '@cf/engine';
import {
  Divider, EmptyState, GlassButton, GlassIcon, GlassPanel, GlassSegmented, GlassSheet,
  IconBell, IconSocial, IconTrendUp, KeyValueRow, Screen, SectionHeader, StatCard, StatGrid,
  formatCount,
} from '@/design';
import { ROUTES, buildPath } from '@/app/routes';
import { GateScreen, useGameStatus } from './gate';
import {
  describeEvent, useEventIndex, useFeed, type FeedFilter,
} from './data';
import { FeedItem } from './components/FeedItem';

/**
 * The feed.
 *
 * This is the football ecosystem talking about your club: supporters, creators,
 * the press, rival fans, players, sponsors and the occasional leak. It is empty
 * on day one, and that is correct — nothing has happened yet. The moment
 * something does, it appears here, and the size of the post is set by how much
 * the world thinks it matters.
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
  const events = useEventIndex(state);
  const reach = useMemo(() => socialReach(state), [state]);
  const unreadStories = useMemo(
    () => state.media.stories.filter((story) => !story.read).length,
    [state.media.stories],
  );

  const openedPost = openEventFor ? state.social.posts.find((p) => p.id === openEventFor) : undefined;
  const openedEvent = openedPost?.relatedEventId ? events.get(openedPost.relatedEventId) : undefined;
  const described = openedEvent ? describeEvent(openedEvent) : null;

  const totalForFilter = useMemo(
    () => state.social.posts.length,
    [state.social.posts.length],
  );

  const stats = (
    <GlassPanel title="Your reach" padding="md">
      <StatGrid columns={2}>
        <StatCard
          label="Followers"
          value={formatCount(state.social.clubFollowers)}
          nested
          level={1}
          size="sm"
          icon={<IconSocial />}
        />
        <StatCard
          label="Weekly impressions"
          value={formatCount(state.social.weeklyImpressions)}
          nested
          level={1}
          size="sm"
          icon={<IconTrendUp />}
        />
      </StatGrid>
      <Divider className="my-3" />
      <KeyValueRow label="Impressions this week" value={formatCount(reach.impressions)} />
      <KeyValueRow
        label="Follower change"
        value={`${reach.followerDelta >= 0 ? '+' : ''}${formatCount(reach.followerDelta)}`}
        divided={false}
      />
      <p className="mt-2 text-[12px] leading-relaxed text-ink-dim text-pretty">
        Reach follows your creators and your results. It is not something you buy.
      </p>
    </GlassPanel>
  );

  return (
    <Screen
      title="Social"
      subtitle={totalForFilter > 0 ? `${totalForFilter} posts about your club` : undefined}
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
        <GlassSegmented
          options={FILTERS}
          value={filter}
          onChange={(next) => { setFilter(next); setLimit(PAGE); }}
          aria-label="Filter the feed"
          size="sm"
          block
        />
      }
      aside={stats}
    >
      <div className="md:hidden">{stats}</div>

      {posts.length === 0 ? (
        <EmptyState
          icon={<IconSocial />}
          title={filter === 'ALL' ? 'Nothing has happened yet' : 'Nothing from them yet'}
          description={
            filter === 'ALL'
              ? 'Every post here traces back to something real — a result, a signing, an injury, a row. Play a matchweek and the world will start talking.'
              : 'Nobody in this corner of the ecosystem has said anything about you. Change that on the pitch.'
          }
          action={
            filter !== 'ALL' ? (
              <GlassButton variant="secondary" size="sm" onClick={() => setFilter('ALL')}>
                Show everything
              </GlassButton>
            ) : (
              <GlassButton variant="secondary" size="sm" onClick={() => navigate(ROUTES.matchday)}>
                Go to matchday
              </GlassButton>
            )
          }
        />
      ) : (
        <>
          <SectionHeader
            title="The feed"
            subtitle="Sized by how much the world cares"
          />
          <div className="flex flex-col gap-3">
            {posts.map((post) => (
              <FeedItem
                key={post.id}
                post={post}
                timeLabel={relative(state.clock.cycle, post.cycle)}
                hasEvent={Boolean(post.relatedEventId && events.has(post.relatedEventId))}
                onOpenEvent={setOpenEventFor}
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

      <GlassSheet
        open={openEventFor !== null}
        onClose={() => setOpenEventFor(null)}
        title={described?.title ?? 'What happened'}
        subtitle={openedEvent ? `Matchweek ${openedEvent.week}, season ${openedEvent.season}` : undefined}
        size="auto"
      >
        {described && openedEvent ? (
          <div className="flex flex-col gap-3">
            <p className="text-[15px] leading-relaxed text-ink text-pretty">{described.detail}</p>
            <Divider label="Who it involved" />
            <ul className="flex flex-col gap-1.5">
              {openedEvent.entities.map((entity) => {
                const isCreator = entity.kind === 'creator' && state.creators[entity.id] !== undefined;
                return (
                  <li key={`${entity.kind}-${entity.id}`}>
                    <KeyValueRow
                      label={entity.name}
                      value={entity.kind}
                      divided={false}
                      {...(isCreator
                        ? {
                            onPress: () => {
                              setOpenEventFor(null);
                              navigate(buildPath(ROUTES.creator, { creatorId: entity.id }));
                            },
                          }
                        : {})}
                    />
                  </li>
                );
              })}
            </ul>
            <p className="text-[12px] leading-relaxed text-ink-dim text-pretty">
              Every post in this feed is generated from an event like this one. If a post has no
              event behind it, that is a bug — not a flourish.
            </p>
          </div>
        ) : (
          <p className="text-[14px] text-ink-muted">
            The event behind this post has aged out of the journal.
          </p>
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
