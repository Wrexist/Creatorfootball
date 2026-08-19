import { memo, type ReactNode } from 'react';
import type { SocialPost as PostData } from '@cf/engine';
import {
  CreatorAvatar, FOCUS_RING, GlassPill, IconInfo, IconVerified, SocialPost, cn,
} from '@/design';
import { KIND_LABEL, KIND_RAIL, KIND_TONE, tierFor, type Tier } from '../data';

/**
 * One item in the feed.
 *
 * Three renderings, chosen by weight rather than by kind:
 *
 *   LEAD      the week's real story — full width, kicker, accent rail
 *   STANDARD  the design system's post, as-is
 *   CHATTER   a single dense line, because most of a feed is noise and noise
 *             that takes up a full card stops being scannable
 *
 * Posts carrying a `quoted` parent render as a conversation instead: the thing
 * being replied to sits above with a thread line running into the reply, so a
 * creator argument reads as an argument rather than as two unrelated cards.
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
      <span className="text-[11px] uppercase tracking-[0.14em] text-ink-dim">{timeLabel}</span>
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
            className="absolute left-3 top-8 bottom-[-10px] w-px bg-white/12"
          />
          <span
            aria-hidden="true"
            className="absolute left-0 top-0 flex size-6 items-center justify-center rounded-pill bg-white/[0.08] text-[9px] font-bold text-ink-dim"
          >
            {quoted.authorName.charAt(0).toUpperCase()}
          </span>
          <p className="text-[12px] font-semibold text-ink-muted">{quoted.authorName}</p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-ink-muted text-pretty">
            {quoted.text}
          </p>
        </div>
      )}

      <div className="mt-3 flex gap-3">
        <CreatorAvatar seed={post.avatarSeed} size={36} verified={false} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5">
            <span className="truncate text-[14px] font-semibold text-ink">{post.authorName}</span>
            {post.verified && <IconVerified size={14} className="shrink-0 text-info" label="Verified" />}
            <span className="truncate text-[13px] text-ink-dim">{post.authorHandle}</span>
          </p>
          <p className="mt-1 whitespace-pre-line text-[15px] leading-relaxed text-ink text-pretty">
            {post.text}
          </p>
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
        <p className="flex items-baseline gap-1.5">
          <span className="truncate text-[13px] font-semibold text-ink-muted">{post.authorName}</span>
          <span className="shrink-0 text-[11px] text-ink-dim">{timeLabel}</span>
        </p>
        <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-ink-muted text-pretty">
          {post.text}
        </p>
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
      <p className="mt-2.5 whitespace-pre-line font-display text-[19px] font-bold leading-snug tracking-[-0.015em] text-ink text-pretty">
        {post.text}
      </p>
      <div className="mt-3 flex items-center gap-2.5">
        <CreatorAvatar seed={post.avatarSeed} size={32} verified={post.verified} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-ink">{post.authorName}</span>
          <span className="block truncate text-[12px] text-ink-dim">{post.authorHandle}</span>
        </span>
        <span className="tnum shrink-0 text-[12px] text-ink-dim">
          {post.likes.toLocaleString('en-GB')} likes
        </span>
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
