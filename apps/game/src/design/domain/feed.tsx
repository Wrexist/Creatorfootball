import { memo, useMemo, type ReactNode } from 'react';
import { motion } from 'motion/react';
import type { NewsStory, SocialPost as SocialPostData } from '@cf/engine';
import { cn } from '../cn';
import { useDesignMotion } from '../motion';
import { haptics } from '../haptics';
import { SeedStream } from '../seed';
import { useSvgId } from '../useSvgId';
import { FOCUS_RING } from '../glass/glassLevel';
import { GlassPill } from '../glass/GlassPill';
import { CreatorAvatar } from './PlayerPortrait';
import { formatCount } from './numbers';
import { IconHeart, IconReply, IconRepost, IconShare, IconVerified } from '../icons';
import { NameText } from '../typography/Text';
import { TYPE_CLASS } from '../typography/type';

/* --- generated story art ---------------------------------------------- */

/**
 * Editorial imagery, generated.
 *
 * A news feed with no pictures reads as a log file, and we ship no image
 * assets — so a lead story gets an abstract, deterministic key image built from
 * its seed: angled colour fields in the palette, in the same graphic language
 * as the badges. It is decorative by design and marked `aria-hidden`.
 */
const STORY_PALETTES: readonly (readonly [string, string])[] = [
  ['#c8ff2e', '#0e1013'], ['#7c8cff', '#0e1013'], ['#a78bfa', '#14171b'],
  ['#34d399', '#0e1013'], ['#f4525a', '#14171b'], ['#fbbf24', '#0e1013'],
];

function StoryArt({ seed, className }: { seed: string; className?: string }): ReactNode {
  const fadeId = useSvgId('cf-story');
  const bands = useMemo(() => {
    const s = new SeedStream(seed);
    const palette = s.pick('palette', STORY_PALETTES);
    const skew = s.range('skew', -22, 22);
    return {
      accent: palette[0],
      base: palette[1],
      skew,
      offsets: [0, 1, 2, 3].map((i) => s.range(`band${i}`, 0.05, 0.95)),
    };
  }, [seed]);

  return (
    <svg viewBox="0 0 200 100" className={cn('block h-full w-full', className)} aria-hidden="true" preserveAspectRatio="none">
      <rect width="200" height="100" fill={bands.base} />
      <g transform={`skewX(${bands.skew})`}>
        {bands.offsets.map((offset, i) => (
          <rect
            key={i}
            x={offset * 200 - 30}
            y={-20}
            width={8 + i * 5}
            height={140}
            fill={bands.accent}
            opacity={0.08 + i * 0.07}
          />
        ))}
      </g>
      <rect width="200" height="100" fill={`url(#${fadeId})`} />
      <defs>
        <linearGradient id={fadeId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="40%" stopColor="#05060700" />
          <stop offset="100%" stopColor="#050607dd" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* --- NewsCard --------------------------------------------------------- */

export interface NewsCardProps {
  story: NewsStory;
  /** `lead` is reserved for importance 4-5; the feed decides, not the card. */
  variant?: 'lead' | 'standard' | 'compact';
  onPress?: (storyId: string) => void;
  timeLabel?: ReactNode;
  className?: string;
}

export const NewsCard = memo(function NewsCard({
  story,
  variant = 'standard',
  onPress,
  timeLabel,
  className,
}: NewsCardProps): ReactNode {
  const m = useDesignMotion();
  const interactive = Boolean(onPress);
  const Element = interactive ? motion.button : motion.article;
  const sentimentTone = story.sentiment > 0.25 ? 'positive' : story.sentiment < -0.25 ? 'danger' : 'neutral';

  const meta = (
    <div className={cn(TYPE_CLASS.label, 'flex items-center gap-2 text-micro text-ink-dim')}>
      {/* An outlet is a name. Sentence case, fitted, never clipped. */}
      <NameText name={story.outlet} role="label" floor={0.82} className="min-w-0 shrink text-micro" />
      {timeLabel !== undefined && (
        <>
          <span aria-hidden="true">·</span>
          <span className="tnum shrink-0 tracking-normal">{timeLabel}</span>
        </>
      )}
      {!story.read && <span className="ml-auto size-1.5 shrink-0 rounded-pill bg-volt" aria-label="Unread" />}
    </div>
  );

  if (variant === 'compact') {
    return (
      <Element
        type={interactive ? 'button' : undefined}
        onClick={interactive ? () => onPress?.(story.id) : undefined}
        className={cn(
          'flex w-full flex-col gap-1 rounded-md px-2 py-2.5 text-left',
          interactive && cn('hover:bg-white/[0.05]', FOCUS_RING),
          className,
        )}
      >
        {meta}
        <h3 className="text-body font-semibold leading-snug text-ink text-pretty">{story.headline}</h3>
      </Element>
    );
  }

  const lead = variant === 'lead';

  return (
    <Element
      type={interactive ? 'button' : undefined}
      onClick={interactive ? () => { haptics.selection(); onPress?.(story.id); } : undefined}
      whileTap={interactive && !m.reduced ? { scale: 0.99 } : undefined}
      transition={m.spring.press}
      className={cn(
        'glass-2 glass-sheen relative w-full overflow-hidden rounded-lg text-left',
        interactive && FOCUS_RING,
        className,
      )}
    >
      {lead && (
        <div className="relative h-28 w-full">
          <StoryArt seed={story.imageSeed ?? story.id} />
          {story.tags[0] && (
            <div className="absolute left-3 top-3">
              <GlassPill tone={sentimentTone} size="xs" filled={sentimentTone !== 'neutral'}>
                {story.tags[0]}
              </GlassPill>
            </div>
          )}
        </div>
      )}
      <div className={cn('flex flex-col gap-1.5', lead ? 'p-4 pt-3' : 'p-3.5')}>
        {meta}
        <h3
          className={cn(
            'font-display font-bold leading-tight tracking-[-0.02em] text-ink text-pretty',
            lead ? 'text-title' : 'text-body',
          )}
        >
          {story.headline}
        </h3>
        <p className={cn('text-caption leading-relaxed text-ink-muted text-pretty', lead ? 'line-clamp-3' : 'line-clamp-2')}>
          {story.body}
        </p>
      </div>
    </Element>
  );
});

/* --- SocialPost ------------------------------------------------------- */

const KIND_TONE = {
  FAN: 'neutral', CREATOR: 'volt', MEDIA: 'info', CLUB: 'neutral',
  PLAYER: 'positive', RIVAL: 'danger', SPONSOR: 'warning', LEAK: 'special',
} as const;

export interface SocialPostProps {
  post: SocialPostData;
  timeLabel?: ReactNode;
  liked?: boolean;
  reposted?: boolean;
  onLike?: (postId: string) => void;
  onRepost?: (postId: string) => void;
  onReply?: (postId: string) => void;
  onShare?: (postId: string) => void;
  onPress?: (postId: string) => void;
  className?: string;
}

function ActionButton({
  icon, count, label, active, activeClass, onClick,
}: {
  icon: ReactNode; count?: number; label: string; active?: boolean; activeClass?: string; onClick?: () => void;
}): ReactNode {
  const disabled = !onClick;
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={label}
      aria-pressed={onClick ? Boolean(active) : undefined}
      onClick={(event) => {
        event.stopPropagation();
        haptics.selection();
        onClick?.();
      }}
      className={cn(
        'inline-flex min-h-11 items-center gap-1.5 rounded-md px-1.5 text-label font-medium',
        'transition-colors duration-[var(--duration-fast)] ease-out-quint',
        active ? activeClass : 'text-ink-dim',
        !disabled && 'hover:text-ink',
        disabled && 'cursor-default',
        FOCUS_RING,
      )}
    >
      {icon}
      {count !== undefined && count > 0 && <span className="tnum">{formatCount(count)}</span>}
    </button>
  );
}

/**
 * A feed post.
 *
 * `post.weight` is the engine's importance signal; the feed uses it to pick the
 * emphasis, so a rival creator dunking after a derby defeat physically occupies
 * more of the screen than a fan's throwaway line. That is the whole reason the
 * weight exists — it must not be ignored at render time.
 */
export const SocialPost = memo(function SocialPost({
  post,
  timeLabel,
  liked = false,
  reposted = false,
  onLike,
  onRepost,
  onReply,
  onShare,
  onPress,
  className,
}: SocialPostProps): ReactNode {
  const emphasised = post.weight >= 0.7;

  return (
    <article
      className={cn(
        'relative rounded-lg px-3.5 py-3',
        emphasised ? 'glass-2 glass-sheen' : 'border-b border-white/[0.06] rounded-none',
        className,
      )}
    >
      {/* Stretched link: the post body is navigable, but the like/repost/reply
          controls inside it stay independently focusable. A click handler on
          the <article> itself would be unreachable by keyboard, and wrapping
          the whole post in a <button> would nest interactive elements. */}
      {onPress && (
        <button
          type="button"
          onClick={() => onPress(post.id)}
          aria-label={`Open post by ${post.authorName}`}
          className={cn('absolute inset-0 rounded-[inherit]', FOCUS_RING)}
        />
      )}
      <div className="flex gap-3">
        <CreatorAvatar seed={post.avatarSeed} size={40} verified={false} />
        <div className="min-w-0 flex-1">
          <div className={cn(TYPE_CLASS.caption, 'flex items-center gap-1.5')}>
            <NameText
              name={post.authorName}
              short={post.authorHandle}
              role="bodyStrong"
              floor={0.82}
              className="min-w-0 shrink text-body"
            />
            {post.verified && <IconVerified size={14} className="shrink-0 text-info" label="Verified" />}
            <NameText name={post.authorHandle} role="caption" floor={0.85} className="min-w-0 shrink text-caption text-ink-dim" />
            {timeLabel !== undefined && (
              <>
                <span className="text-ink-dim" aria-hidden="true">·</span>
                <span className="tnum shrink-0 text-caption text-ink-dim">{timeLabel}</span>
              </>
            )}
            {(post.kind === 'RIVAL' || post.kind === 'LEAK' || post.kind === 'SPONSOR') && (
              <GlassPill tone={KIND_TONE[post.kind]} size="xs" className="ml-auto shrink-0">
                {post.kind.toLowerCase()}
              </GlassPill>
            )}
          </div>

          <p
            className={cn(
              'mt-1 whitespace-pre-line leading-relaxed text-ink text-pretty',
              emphasised ? 'text-body' : 'text-body',
            )}
          >
            {post.text}
          </p>

          {post.quoted && (
            <blockquote className="mt-2.5 rounded-md border border-white/[0.09] px-3 py-2">
              <p className="text-label font-semibold text-ink-muted">{post.quoted.authorName}</p>
              <p className="mt-0.5 text-caption leading-snug text-ink-muted line-clamp-3">{post.quoted.text}</p>
            </blockquote>
          )}

          <div className="relative z-10 mt-1 flex items-center justify-between pr-2">
            <ActionButton
              icon={<IconReply size={16} />}
              count={post.replies}
              label={`Reply, ${post.replies} replies`}
              {...(onReply ? { onClick: () => onReply(post.id) } : {})}
            />
            <ActionButton
              icon={<IconRepost size={16} />}
              count={post.reposts}
              label={`Repost, ${post.reposts} reposts`}
              active={reposted}
              activeClass="text-positive"
              {...(onRepost ? { onClick: () => onRepost(post.id) } : {})}
            />
            <ActionButton
              icon={<IconHeart size={16} />}
              count={post.likes}
              label={`Like, ${post.likes} likes`}
              active={liked}
              activeClass="text-danger"
              {...(onLike ? { onClick: () => onLike(post.id) } : {})}
            />
            <ActionButton
              icon={<IconShare size={16} />}
              label="Share"
              {...(onShare ? { onClick: () => onShare(post.id) } : {})}
            />
          </div>
        </div>
      </div>
    </article>
  );
});
