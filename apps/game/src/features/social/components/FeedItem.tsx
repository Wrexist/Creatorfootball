import { memo, type ReactNode } from 'react';
import type { SocialPost as PostData } from '@cf/engine';
import {
  CreatorAvatar, FOCUS_RING, GlassPill, IconHeart, IconInfo, IconRepost, IconVerified,
  NameText, SocialPost, Text, cn,
} from '@/design';
import { KIND_LABEL, KIND_RAIL, KIND_TONE, tierFor, type Tier } from '../data';

/**
 * One item in the feed.
 *
 * Three renderings, chosen by `post.weight` rather than by kind — the weight is
 * how much the world engine thought the underlying event mattered, so a record
 * broken, a hijacked transfer or a derby humiliation physically outweighs a
 * supporter's throwaway line:
 *
 *   LEAD      the week's real story — display type, accent rail, engagement
 *   STANDARD  the design system's post, as-is
 *   CHATTER   a single dense line, because most of a feed is noise and noise
 *             that takes up a full card stops being scannable
 *
 * Posts carrying a `quoted` parent render as a conversation instead: the thing
 * being replied to sits above with a thread line running into the reply, so a
 * creator argument reads as an argument rather than as two unrelated cards.
 *
 * Names go through `NameText`. A creator whose whole identity is their handle
 * cannot have that handle cut in half.
 */

export interface FeedItemProps {
  post: PostData;
  timeLabel: string;
  hasEvent: boolean;
  onOpenEvent: (postId: string) => void;
  className?: string;
}

const Kicker = memo(function Kicker({
  post, timeLabel,
}: { post: PostData; timeLabel: string }): ReactNode {
  return (
    <div className="flex items-center gap-2">
      <GlassPill tone={KIND_TONE[post.kind]} size="xs" filled>
        {KIND_LABEL[post.kind]}
      </GlassPill>
      <Text role="micro" as="span">{timeLabel}</Text>
    </div>
  );
});

const EventLink = memo(function EventLink({
  postId, onOpenEvent,
}: { postId: string; onOpenEvent: (id: string) => void }): ReactNode {
  return (
    <button
      type="button"
      onClick={() => onOpenEvent(postId)}
      className={cn(
        'mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-md px-1.5 text-[12px] font-semibold text-volt',
        'hover:text-volt-bright',
        FOCUS_RING,
      )}
    >
      <IconInfo size={14} />
      See what actually happened
    </button>
  );
});

/** Likes and reposts, as figures rather than as icons alone. */
const Engagement = memo(function Engagement({ post }: { post: PostData }): ReactNode {
  return (
    <div className="flex items-center gap-3 text-ink-dim">
      <span className="inline-flex items-center gap-1">
        <IconHeart size={13} />
        <span className="num-broadcast text-[12px]">{post.likes.toLocaleString('en-GB')}</span>
      </span>
      <span className="inline-flex items-center gap-1">
        <IconRepost size={13} />
        <span className="num-broadcast text-[12px]">{post.reposts.toLocaleString('en-GB')}</span>
      </span>
    </div>
  );
});

/* --- conversation ------------------------------------------------------- */

const Conversation = memo(function Conversation({
  post, timeLabel, hasEvent, onOpenEvent,
}: FeedItemProps): ReactNode {
  const quoted = post.quoted;
  return (
    <article className="glass-2 glass-sheen relative overflow-hidden rounded-lg p-3.5">
      <span aria-hidden="true" className={cn('absolute inset-y-0 left-0 w-0.5', KIND_RAIL[post.kind])} />
      <Kicker post={post} timeLabel={timeLabel} />

      {quoted && (
        <div className="relative mt-3 pl-9">
          <span
            aria-hidden="true"
            className="absolute bottom-[-10px] left-3 top-8 w-px bg-white/12"
          />
          <span
            aria-hidden="true"
            className="absolute left-0 top-0 flex size-6 items-center justify-center rounded-pill bg-white/[0.08] text-[9px] font-bold text-ink-dim"
          >
            {quoted.authorName.charAt(0).toUpperCase()}
          </span>
          <NameText name={quoted.authorName} role="label" lines={2} />
          <Text role="caption" as="p" className="mt-0.5 text-pretty">{quoted.text}</Text>
        </div>
      )}

      <div className="mt-3 flex gap-3">
        <CreatorAvatar seed={post.avatarSeed} size={36} verified={false} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <NameText name={post.authorName} role="bodyStrong" className="min-w-0 shrink" />
            {post.verified && <IconVerified size={14} className="shrink-0 text-info" label="Verified" />}
            <NameText name={post.authorHandle} role="caption" className="min-w-0 shrink" />
          </div>
          <Text role="body" as="p" className="mt-1 whitespace-pre-line text-pretty">
            {post.text}
          </Text>
          {hasEvent && <EventLink postId={post.id} onOpenEvent={onOpenEvent} />}
        </div>
      </div>
    </article>
  );
});

/* --- chatter ------------------------------------------------------------ */

const Chatter = memo(function Chatter({
  post, timeLabel,
}: { post: PostData; timeLabel: string }): ReactNode {
  return (
    <article className="flex items-start gap-2.5 border-b border-white/[0.06] px-1 py-2">
      <CreatorAvatar seed={post.avatarSeed} size={24} verified={false} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <NameText name={post.authorName} role="label" className="min-w-0 shrink" />
          <Text role="micro" as="span" className="shrink-0">{timeLabel}</Text>
        </div>
        <Text role="caption" as="p" className="mt-0.5 text-pretty" clamp={2}>
          {post.text}
        </Text>
      </div>
    </article>
  );
});

/* --- lead --------------------------------------------------------------- */

const Lead = memo(function Lead({
  post, timeLabel, hasEvent, onOpenEvent,
}: FeedItemProps): ReactNode {
  return (
    <article className="glass-2 glass-sheen relative overflow-hidden rounded-lg p-4">
      <span aria-hidden="true" className={cn('absolute inset-y-0 left-0 w-1', KIND_RAIL[post.kind])} />
      <Kicker post={post} timeLabel={timeLabel} />
      <Text
        role="title"
        as="p"
        className="mt-2.5 whitespace-pre-line text-[21px] leading-[1.18] text-pretty"
      >
        {post.text}
      </Text>
      <div className="mt-3.5 flex items-center gap-2.5">
        <CreatorAvatar seed={post.avatarSeed} size={32} verified={post.verified} />
        <span className="min-w-0 flex-1">
          <NameText name={post.authorName} role="bodyStrong" lines={1} />
          <NameText name={post.authorHandle} role="caption" lines={1} className="mt-0.5" />
        </span>
        <Engagement post={post} />
      </div>
      {hasEvent && <EventLink postId={post.id} onOpenEvent={onOpenEvent} />}
    </article>
  );
});

/* --- switch ------------------------------------------------------------- */

export const FeedItem = memo(function FeedItem(props: FeedItemProps): ReactNode {
  const { post, timeLabel, hasEvent, onOpenEvent, className } = props;
  const tier: Tier = tierFor(post.weight);

  if (post.quoted) {
    return (
      <div className={className}>
        <Conversation {...props} />
      </div>
    );
  }
  if (tier === 'LEAD') {
    return (
      <div className={className}>
        <Lead {...props} />
      </div>
    );
  }
  if (tier === 'CHATTER') {
    return (
      <div className={className}>
        <Chatter post={post} timeLabel={timeLabel} />
      </div>
    );
  }
  return (
    <div className={className}>
      <SocialPost post={post} timeLabel={timeLabel} />
      {hasEvent && (
        <div className="px-3.5 pb-2">
          <EventLink postId={post.id} onOpenEvent={onOpenEvent} />
        </div>
      )}
    </div>
  );
});
