import { memo, type ReactNode } from 'react';
import { trendingTopics, type GameState, type TrendTopic } from '@cf/engine';
import { CardRail, GlassPill, SectionHeader, Text, cn } from '@/design';

/**
 * What the internet is talking about this week.
 *
 * Every row is a *count* over the week's real posts and the real events behind
 * them — there is no topic here that the world did not produce. Tapping one
 * opens the event underneath it, which is only possible because none of it was
 * invented.
 */

const TONE = (sentiment: number): 'positive' | 'danger' | 'neutral' =>
  (sentiment > 0.15 ? 'positive' : sentiment < -0.15 ? 'danger' : 'neutral');

export const TrendingRail = memo(function TrendingRail({
  state, onOpenEvent,
}: { state: GameState; onOpenEvent?: (eventId: string) => void }): ReactNode {
  const topics: TrendTopic[] = trendingTopics(state);
  if (topics.length === 0) return null;

  return (
    <section>
      <SectionHeader
        title="Trending"
        subtitle="Counted from the week's feed, not invented. Tap one to see what caused it."
        size="sm"
      />
      <CardRail>
        {topics.map((topic, index) => (
          <button
            key={topic.id}
            type="button"
            disabled={!topic.eventId || !onOpenEvent}
            onClick={() => topic.eventId && onOpenEvent?.(topic.eventId)}
            className={cn(
              'glass-1 raised w-44 shrink-0 rounded-lg p-3 text-left',
              !topic.eventId && 'cursor-default',
            )}
          >
            <div className="flex items-center gap-1.5">
              <Text role="micro" as="span">{`#${index + 1}`}</Text>
              <GlassPill size="xs" tone={TONE(topic.sentiment)}>
                {topic.sentiment > 0.15 ? 'Warm' : topic.sentiment < -0.15 ? 'Hostile' : 'Split'}
              </GlassPill>
            </div>
            <Text role="section" as="p" className="mt-1.5 text-pretty">{topic.label}</Text>
            <Text role="caption" as="p" className="mt-1 text-pretty" clamp={2}>{topic.blurb}</Text>
            <Text role="micro" as="p" className="mt-1.5">{`${topic.posts} posts`}</Text>
          </button>
        ))}
      </CardRail>
    </section>
  );
});
