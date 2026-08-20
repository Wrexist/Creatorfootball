import { memo, useCallback, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { storyReach, type GameState, type NewsStory } from '@cf/engine';
import {
  Divider, EmptyState, GlassButton, GlassPanel, GlassPill, GlassSegmented, GlassSheet,
  IconBell, KeyValueRow, NewsCard, Screen, SectionHeader, formatCount,
} from '@/design';
import { ROUTES } from '@/app/routes';
import { useGameStore } from '@/state/gameStore';
import { GateScreen, useGameStatus } from './gate';
import { useStories } from './data';

/**
 * The press.
 *
 * Importance drives size, exactly as weight does in the social feed: a story
 * the world rates 5 gets the lead treatment with its key art, a 1 is a single
 * line in a list. Unread stories carry a dot until they are opened, and opening
 * one marks it read through the store rather than by mutating the object.
 */

const PAGE = 24;

const SENTIMENT = (value: number): { label: string; tone: 'positive' | 'danger' | 'neutral' } => {
  if (value > 0.25) return { label: 'Positive', tone: 'positive' };
  if (value < -0.25) return { label: 'Critical', tone: 'danger' };
  return { label: 'Neutral', tone: 'neutral' };
};

const SCOPES = [
  { value: 'ALL' as const, label: 'Everything' },
  { value: 'UNREAD' as const, label: 'Unread' },
];

const relative = (now: number, then: number): string => {
  const delta = Math.max(0, now - then);
  if (delta === 0) return 'this week';
  if (delta === 1) return 'last week';
  return `${delta}w ago`;
};

const StoryRow = memo(function StoryRow({
  story, timeLabel, onPress,
}: {
  story: NewsStory;
  timeLabel: string;
  onPress: (id: string) => void;
}): ReactNode {
  const variant = story.importance >= 4 ? 'lead' : story.importance >= 2 ? 'standard' : 'compact';
  return <NewsCard story={story} variant={variant} timeLabel={timeLabel} onPress={onPress} />;
});

function MediaView({ state }: { state: GameState }): ReactNode {
  const navigate = useNavigate();
  const apply = useGameStore((s) => s.apply);
  const [scope, setScope] = useState<'ALL' | 'UNREAD'>('ALL');
  const [limit, setLimit] = useState(PAGE);
  const [open, setOpen] = useState<string | null>(null);

  const stories = useStories(state, scope === 'UNREAD', limit);
  const unread = useMemo(() => state.media.stories.filter((s) => !s.read).length, [state.media.stories]);
  const opened = open ? state.media.stories.find((s) => s.id === open) : undefined;

  /** Marking a story read is a state write, so it goes through the store. */
  const markRead = useCallback(
    (id: string) => {
      apply((current) => ({
        ...current,
        media: {
          ...current.media,
          stories: current.media.stories.map((story) =>
            story.id === id && !story.read ? { ...story, read: true } : story,
          ),
        },
      }));
    },
    [apply],
  );

  const markAllRead = useCallback(() => {
    apply((current) => ({
      ...current,
      media: {
        ...current.media,
        stories: current.media.stories.map((story) => (story.read ? story : { ...story, read: true })),
      },
    }));
  }, [apply]);

  const openStory = useCallback(
    (id: string) => {
      setOpen(id);
      markRead(id);
    },
    [markRead],
  );

  const sentiment = opened ? SENTIMENT(opened.sentiment) : null;

  return (
    <Screen
      title="Media"
      subtitle={unread > 0 ? `${unread} unread` : 'All caught up'}
      onBack={() => navigate(ROUTES.social)}
      headerAccessory={
        <GlassSegmented
          options={SCOPES}
          value={scope}
          onChange={(next) => { setScope(next); setLimit(PAGE); }}
          aria-label="Which stories to show"
          block
          nested
        />
      }
      aside={
        <GlassPanel title="How the press works" padding="md">
          <p className="text-[13px] leading-relaxed text-ink-muted text-pretty">
            Stories are written from events, by outlets with their own leanings. A high-controversy
            creator generates more coverage — and more of it hostile.
          </p>
          <Divider className="my-3" />
          <KeyValueRow label="Stories held" value={state.media.stories.length} />
          <KeyValueRow label="Unread" value={unread} divided={false} />
          {unread > 0 && (
            <GlassButton className="mt-3" variant="secondary" size="sm" block onClick={markAllRead}>
              Mark everything read
            </GlassButton>
          )}
        </GlassPanel>
      }
    >
      {stories.length === 0 ? (
        <EmptyState
          icon={<IconBell />}
          title={scope === 'UNREAD' ? 'Nothing unread' : 'No coverage yet'}
          description={
            scope === 'UNREAD'
              ? 'You have read everything the press has written about you.'
              : 'Nobody has written about your club yet. Win something, lose something, or sign someone — the press reacts to events, not to time passing.'
          }
          {...(scope === 'UNREAD'
            ? {
                action: (
                  <GlassButton variant="secondary" size="sm" onClick={() => setScope('ALL')}>
                    Show everything
                  </GlassButton>
                ),
              }
            : {})}
        />
      ) : (
        <>
          <SectionHeader title="Coverage" subtitle="Biggest stories first within each week" />
          <div className="flex flex-col gap-3">
            {stories.map((story) => (
              <StoryRow
                key={story.id}
                story={story}
                timeLabel={relative(state.clock.cycle, story.cycle)}
                onPress={openStory}
              />
            ))}
          </div>
          {stories.length >= limit && (
            <GlassButton variant="secondary" block onClick={() => setLimit((n) => n + PAGE)}>
              Load older stories
            </GlassButton>
          )}
        </>
      )}

      <GlassSheet
        open={open !== null}
        onClose={() => setOpen(null)}
        title={opened?.headline ?? 'Story'}
        subtitle={opened ? `${opened.outlet} · ${relative(state.clock.cycle, opened.cycle)}` : undefined}
        size="tall"
      >
        {opened ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {sentiment && (
                <GlassPill tone={sentiment.tone} size="xs" filled={sentiment.tone !== 'neutral'}>
                  {sentiment.label}
                </GlassPill>
              )}
              <GlassPill size="xs">Importance {opened.importance}/5</GlassPill>
              {opened.tags.map((tag) => (
                <GlassPill key={tag} size="xs">{tag}</GlassPill>
              ))}
            </div>
            <p className="whitespace-pre-line text-[15px] leading-relaxed text-ink text-pretty">
              {opened.body}
            </p>
            <Divider label="Named in this story" />
            <ul className="flex flex-col">
              {opened.entities.map((entity) => (
                <li key={`${entity.kind}-${entity.id}`}>
                  <KeyValueRow label={entity.name} value={entity.kind} divided={false} />
                </li>
              ))}
            </ul>
            <KeyValueRow
              label="Estimated reach"
              value={formatCount(storyReach(opened))}
              hint="How many people this story is likely to have put in front of"
              divided={false}
            />
          </div>
        ) : null}
      </GlassSheet>
    </Screen>
  );
}

export function MediaScreen(): ReactNode {
  const gate = useGameStatus();
  if (gate.status !== 'ready') return <GateScreen gate={gate} title="Media" />;
  return <MediaView state={gate.state} />;
}
