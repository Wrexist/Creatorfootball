import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PHASE_LABELS, campaignOffers, closedPolls, clubCreators, liveCampaigns, nextFixture,
  offeredPolls, pressConference, provocations, publishClubPost, reactToPost,
  replyOptions, replyToPlayer, socialReach, socialWorld, unhappyVoices,
  type GameState, type PostTone, type PostVoice, type ReactionKind, type ReplyStance,
  type SocialPost as PostData, type UnhappyVoice,
} from '@cf/engine';
import {
  Divider, EmptyState, GlassButton, GlassIcon, GlassPanel, GlassPill, GlassSegmented, GlassSheet,
  IconBall, IconBell, IconFans, IconSocial, IconWarning, IconWhistle, KeyValueRow, ListRow,
  NameText, Screen, SectionHeader, StatBlock, Text, cn, entityKindLabel, formatCount, useToast,
} from '@/design';
import { ROUTES, buildPath } from '@/app/routes';
import { GateScreen, useGameStatus } from './gate';
import { SOCIAL_ROUTES } from './routes';
import { assignTiers, describeEvent, useEventIndex, useFeed, type FeedFilter } from './data';
import { useSocialAction, useSocialWorld } from './engine';
import { contentRegistry } from '@/state/content';
import { FeedItem } from './components/FeedItem';
import { QuietWorld } from './components/QuietWorld';
import { Composer, ComposerPrompt } from './components/Composer';
import { ReactionBar } from './components/ReactionBar';
import { StandingCard } from './components/StandingCard';
import { TrendingRail } from './components/TrendingRail';
import { EffectLines } from './components/Effects';

/**
 * The feed, as something the player plays.
 *
 * The screen used to be a beautifully edited read-only surface: the world
 * happened, the world talked about it, and the player scrolled. Everything
 * added here is in service of one change — the player is now *in* the
 * conversation.
 *
 * Four things are live on this screen. The composer, which can only speak about
 * something that actually happened. The reaction bar under every post about
 * your club, where silence is one of the four answers. The inbox of things
 * waiting on you — a rival's dig, one of your own players going public. And the
 * standing panel, which is not a score but a description of the character the
 * player has built out of those choices, and which changes how the rest of the
 * world writes about them.
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
  const toast = useToast();
  const run = useSocialAction();
  useSocialWorld(state);

  const [filter, setFilter] = useState<FeedFilter>('ALL');
  const [limit, setLimit] = useState(PAGE);
  const [openEventFor, setOpenEventFor] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);

  const posts = useFeed(state, filter, limit);
  const tiers = useMemo(() => assignTiers(posts), [posts]);
  const events = useEventIndex(state);
  const reach = useMemo(() => socialReach(state), [state]);
  const creators = useMemo(() => clubCreators(state, state.playerClubId), [state]);
  const upcoming = useMemo(() => nextFixture(state), [state]);

  const world = socialWorld(state);
  const handled = useMemo(() => new Set(world.handled), [world.handled]);
  const conferenceWaiting = useMemo(() => pressConference(state) !== null, [state]);
  const briefsWaiting = useMemo(() => campaignOffers(state).length, [state]);
  const communityWaiting = useMemo(
    () => offeredPolls(state).length + closedPolls(state).filter((p) => p.status === 'CLOSED').length
      + liveCampaigns(state).length,
    [state],
  );
  const waiting = useMemo(() => provocations(state), [state]);
  const voices = useMemo(() => unhappyVoices(state), [state]);
  const voice: UnhappyVoice | undefined = voices.find((v) => v.post.id === replyTo);

  const opponent = upcoming
    ? state.clubs[
        upcoming.homeClubId === state.playerClubId ? upcoming.awayClubId : upcoming.homeClubId
      ]
    : undefined;

  const unreadStories = useMemo(
    () => state.media.stories.filter((story) => !story.read).length,
    [state.media.stories],
  );

  const openedPost = openEventFor
    ? state.social.posts.find((p) => p.id === openEventFor)
    : undefined;
  const openedEvent = openedPost?.relatedEventId
    ? events.get(openedPost.relatedEventId)
    : openEventFor && events.has(openEventFor) ? events.get(openEventFor) : undefined;
  const described = openedEvent ? describeEvent(openedEvent) : null;

  const totalPosts = state.social.posts.length;
  const worldIsQuiet = totalPosts === 0;

  const publish = (input: { momentId: string; tone: PostTone; voice: PostVoice }): void => {
    const outcome = run((current) => publishClubPost(current, {
      ...input, at: Date.now(), registry: contentRegistry(),
    }));
    if (outcome.ok) toast.success('Posted', 'The world is reading it now.');
    else toast.error('Not posted', outcome.reason ?? 'That did not land.');
  };

  const react = (post: PostData, kind: ReactionKind): void => {
    const outcome = run((current) => reactToPost(current, {
      postId: post.id, kind, at: Date.now(), registry: contentRegistry(),
    }));
    if (!outcome.ok) { toast.error('Not possible', outcome.reason ?? 'That has already been handled.'); return; }
    if (kind === 'SILENCE') {
      toast.show({
        tone: 'neutral',
        title: 'You said nothing',
        description: 'Deliberate silence. It counts as an answer.',
      });
    } else {
      toast.success('Done', 'It is on the record.');
    }
  };

  const reply = (stance: ReplyStance): void => {
    if (!voice) return;
    const outcome = run((current) => replyToPlayer(current, {
      postId: voice.post.id, stance, at: Date.now(), registry: contentRegistry(),
    }));
    setReplyTo(null);
    if (outcome.ok) toast.success('Handled', `${voice.name} has heard it.`);
    else toast.error('Not possible', outcome.reason ?? 'That has already been handled.');
  };

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
        Reach follows your creators, your results and what you choose to say. It is not something
        you buy.
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
      aside={
        worldIsQuiet ? undefined : (
          <>
            <StandingCard state={state} />
            {reachPanel}
          </>
        )
      }
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
          onOpenCreator={(creatorId) => navigate(buildPath(ROUTES.creator, { creatorId }))}
        />
      ) : (
        <>
          <ComposerPrompt state={state} onOpen={() => setComposerOpen(true)} />

          {/* The three surfaces where the decisions that shape this feed are
              actually taken. Kept on the feed rather than buried in navigation,
              because a press conference that nobody notices is a press
              conference that never happens. */}
          <nav className="grid grid-cols-3 gap-2" aria-label="Where you act">
            {([
              {
                path: SOCIAL_ROUTES.press,
                label: 'Press room',
                icon: <IconWhistle />,
                badge: conferenceWaiting ? 'Waiting' : null,
              },
              {
                path: SOCIAL_ROUTES.creators,
                label: 'Creators',
                icon: <IconSocial />,
                badge: briefsWaiting > 0 ? `${briefsWaiting} brief${briefsWaiting === 1 ? '' : 's'}` : null,
              },
              {
                path: SOCIAL_ROUTES.community,
                label: 'Community',
                icon: <IconFans />,
                badge: communityWaiting > 0 ? `${communityWaiting} open` : null,
              },
            ] as const).map((entry) => (
              <button
                key={entry.path}
                type="button"
                onClick={() => navigate(entry.path)}
                className={cn(
                  'glass-1 raised flex min-h-20 flex-col items-start gap-1 rounded-lg p-2.5 text-left',
                  entry.badge && 'raised-edge',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex size-7 items-center justify-center rounded-pill [&_svg]:size-3.5',
                    entry.badge ? 'bg-volt/16 text-volt' : 'bg-white/[0.07] text-ink-muted',
                  )}
                >
                  {entry.icon}
                </span>
                <NameText name={entry.label} role="label" lines={1} />
                {entry.badge && (
                  <GlassPill size="xs" tone="volt" filled>{entry.badge}</GlassPill>
                )}
              </button>
            ))}
          </nav>

          {(waiting.length > 0 || voices.length > 0) && (
            <GlassPanel title="Waiting on you" padding="md" accent="danger">
              <Text role="caption" as="p" className="text-pretty">
                Answering and not answering are both answers. Both of them move something.
              </Text>
              <div className="mt-2 flex flex-col">
                {voices.slice(0, 2).map((row) => (
                  <ListRow
                    key={row.post.id}
                    density="compact"
                    divided
                    leading={<span aria-hidden="true" className="text-warning [&_svg]:size-4"><IconWarning /></span>}
                    title={<NameText name={row.summary} role="bodyStrong" lines={2} />}
                    subtitle={`Morale ${row.morale}. He has gone public.`}
                    chevron
                    onPress={() => setReplyTo(row.post.id)}
                  />
                ))}
                {waiting.slice(0, 3).map((row, index) => (
                  <ListRow
                    key={row.post.id}
                    density="compact"
                    divided={index < Math.min(3, waiting.length) - 1}
                    leading={
                      <GlassPill size="xs" tone={row.from === 'RIVAL' ? 'danger' : 'warning'} filled>
                        {row.from === 'RIVAL' ? 'Rival' : row.from === 'MEDIA' ? 'Press' : 'Creator'}
                      </GlassPill>
                    }
                    title={<NameText name={row.prompt} role="bodyStrong" lines={2} />}
                    subtitle={row.post.text}
                    chevron
                    onPress={() => setOpenEventFor(row.post.id)}
                  />
                ))}
              </div>
            </GlassPanel>
          )}

          <TrendingRail state={state} onOpenEvent={setOpenEventFor} />

          <div className="md:hidden"><StandingCard state={state} /></div>
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
                {posts.map((post) => {
                  const answerable = post.kind !== 'CLUB'
                    && !post.tags.includes('authored')
                    && post.cycle >= state.clock.cycle - 2;
                  return (
                    <div key={post.id} className="flex flex-col">
                      <FeedItem
                        post={post}
                        timeLabel={relative(state.clock.cycle, post.cycle)}
                        hasEvent={Boolean(post.relatedEventId && events.has(post.relatedEventId))}
                        onOpenEvent={setOpenEventFor}
                        {...(tiers.get(post.id) ? { tier: tiers.get(post.id) } : {})}
                      />
                      {answerable && (
                        <ReactionBar
                          state={state}
                          post={post}
                          handled={handled.has(post.id)}
                          onReact={(kind) => react(post, kind)}
                          className="px-1.5"
                        />
                      )}
                    </div>
                  );
                })}
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

      <Composer
        state={state}
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        onPublish={publish}
      />

      <GlassSheet
        open={replyTo !== null}
        onClose={() => setReplyTo(null)}
        title={voice ? `${voice.name} has gone public` : 'One of your own'}
        subtitle="Three ways to handle it. Two of them happen in front of everybody."
        size="auto"
      >
        {voice && (
          <div className="flex flex-col gap-3">
            <article className="glass-1 rounded-lg p-3">
              <Text role="label" as="p">{voice.post.authorName}</Text>
              <Text role="body" as="p" className="mt-1 text-pretty">{voice.post.text}</Text>
            </article>
            {replyOptions(state, voice).map((option) => (
              <button
                key={option.stance}
                type="button"
                onClick={() => reply(option.stance)}
                className="glass-1 raised w-full rounded-lg p-3.5 text-left"
              >
                <Text role="section" as="span">{option.info.label}</Text>
                <Text role="caption" as="p" className="mt-1 text-pretty">{option.info.blurb}</Text>
                <EffectLines lines={option.lines} className="mt-2" />
              </button>
            ))}
          </div>
        )}
      </GlassSheet>

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
            {openedPost && openedPost.kind !== 'CLUB' && !handled.has(openedPost.id) && (
              <>
                <Divider label="Your move" />
                <ReactionBar
                  state={state}
                  post={openedPost}
                  handled={false}
                  onReact={(kind) => { react(openedPost, kind); setOpenEventFor(null); }}
                />
              </>
            )}
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
                        subtitle={entityKindLabel(entity.kind)}
                        chevron
                        onPress={() => {
                          setOpenEventFor(null);
                          navigate(buildPath(ROUTES.creator, { creatorId: entity.id }));
                        }}
                      />
                    ) : (
                      <KeyValueRow label={entity.name} value={entityKindLabel(entity.kind)} divided={false} />
                    )}
                  </li>
                );
              })}
            </ul>
            <Text role="caption" as="p" className="text-ink-dim text-pretty">
              Every post in this feed is generated from an event like this one — including the ones
              you write. If a post has no event behind it, that is a bug, not a flourish.
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
