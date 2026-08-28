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

/* --- editorial motifs -------------------------------------------------- */

/**
 * The five things the press actually write about.
 *
 * Bands alone are wallpaper: they tell a reader that a picture belongs here
 * without ever telling them what the story is. These five motifs are the whole
 * editorial vocabulary of the sport as this game models it — somebody moved
 * club, somebody got hurt, two clubs hate each other, the supporters had their
 * say, or a result happened — and every trigger the media engine can fire lands
 * in one of them or in none, in which case the bands stay.
 *
 * They are drawn in the icon set's language deliberately: same round caps, same
 * flat construction, no shading, just scaled up from the 24px grid to a 200×100
 * plate. That is what keeps a key image reading as part of this product rather
 * than as stock art dropped into it.
 */
export type StoryMotif = 'transfer' | 'injury' | 'rivalry' | 'fans' | 'result';

export const STORY_MOTIFS: readonly StoryMotif[] = [
  'transfer', 'injury', 'rivalry', 'fans', 'result',
] as const;

/** Human label, used by the gallery and by nothing in the product. */
export const STORY_MOTIF_LABELS: Record<StoryMotif, string> = {
  transfer: 'Transfer',
  injury: 'Injury',
  rivalry: 'Rivalry',
  fans: 'Fan culture',
  result: 'Result reaction',
};

/**
 * Motif matchers, in priority order.
 *
 * A story carries `trigger:TRANSFER_COMPLETED`-style tags plus whatever the
 * content hook attached, and packs are free to invent their own vocabulary — so
 * this matches loosely across the joined tag text rather than switching on an
 * enum that does not exist. Order matters: a derby win is a rivalry story
 * before it is a result, and an injury inside a transfer saga is an injury.
 */
const MOTIF_PATTERNS: readonly (readonly [StoryMotif, RegExp])[] = [
  ['injury', /injur|fitness|knock|surgery|recover|red_card|suspen|sidelined/],
  ['rivalry', /rival|derby|dunk|feud|grudge|bad_blood|hostil/],
  // The lookbehind keeps `SPONSOR_SIGNED` out: a shirt deal is a business
  // story, and illustrating it with a player contract would be a small lie.
  ['transfer', /transfer|marquee|(?<!sponsor_)sign(ing|ed)|\bbid\b|\bfee\b|contract|release|sold|loan|creator_joined|scout/],
  ['fans', /fan|supporter|crowd|attendance|terrace|ticket|social|content_drop|club_posted|creator_moment|buzz|unrest/],
  ['result', /win|won|defeat|draw|drawn|result|score|goal|reaction|record|trophy|title|match|streak|run\b/],
];

/**
 * A story entity's kind, written out.
 *
 * `kind` is an open string on the engine side and the screens were printing it
 * straight into the value column of a row — so "Named in this story" listed
 * "Liverpool FC … club" in lower case, next to a headline set in display type.
 * The fallback humanises rather than guessing, so a kind nobody has written
 * copy for yet arrives as a word instead of a constant.
 */
const ENTITY_KIND_LABELS: Readonly<Record<string, string>> = {
  club: 'Club',
  player: 'Player',
  creator: 'Creator',
  manager: 'Manager',
  competition: 'Competition',
};

export function entityKindLabel(kind: string): string {
  const known = ENTITY_KIND_LABELS[kind];
  if (known) return known;
  const words = kind.replace(/[_-]+/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : '';
}

/**
 * The tags a player should actually see, in the words they should see them in.
 *
 * A story's tag list is two vocabularies in one array. Some of it is topic —
 * `match`, `result`, `transfer` — which is exactly what a chip on a story is
 * for. The rest is bookkeeping the generator needs and nobody else does:
 * `tpl:md_k_match_lost` names the template that wrote the copy,
 * `trigger:SHOCK_DEFEAT` the event that fired it, `mood:NEGATIVE` the tone it
 * was written in. Those shipped to players as chips, which is how a reader of
 * a match report ended up looking at an internal template id.
 *
 * The namespace separator is the whole rule: anything `prefix:value` is
 * addressed to the engine, anything plain is addressed to the reader. It keeps
 * working when a content pack invents its own vocabulary, which packs are
 * explicitly allowed to do — a new `source:` prefix stays hidden without this
 * function having to learn about it first.
 */
export function displayTags(tags: readonly string[] | undefined): string[] {
  if (!tags || tags.length === 0) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tag of tags) {
    if (tag.includes(':')) continue;
    const clean = tag.replace(/[_-]+/g, ' ').trim();
    if (clean.length === 0) continue;
    const label = clean.charAt(0).toUpperCase() + clean.slice(1);
    if (seen.has(label.toLowerCase())) continue;
    seen.add(label.toLowerCase());
    out.push(label);
  }
  return out;
}

/**
 * Choose the motif for a story's tags, or `null` when nothing matches — and
 * `null` is a real answer, not a failure: the seeded bands are still the
 * correct picture for a story about a facility upgrade or a sponsor.
 */
export function storyMotifFor(tags: readonly string[] | undefined): StoryMotif | null {
  if (!tags || tags.length === 0) return null;
  const text = tags.join(' ').toLowerCase();
  for (const [motif, pattern] of MOTIF_PATTERNS) {
    if (pattern.test(text)) return motif;
  }
  return null;
}

const INK = '#f4f6f8';

/**
 * The motif drawings.
 *
 * Each is a `<g>` placed by the caller, drawn inside a ±26 box around its own
 * origin at the icon set's proportions (1.5px stroke on a 24px grid becomes 2px
 * on this one, which is the same optical weight once the plate is scaled to the
 * 28px-tall card header). `accent` is the story's own seeded palette colour, so
 * the motif belongs to the image it sits on instead of introducing a sixth
 * hue. Node counts are held to single figures each: a feed renders these by the
 * dozen.
 */
const MOTIF_ART: Record<StoryMotif, (accent: string) => ReactNode> = {
  // A contract and the pen over it. The signature line is the accent — the one
  // stroke in the drawing that means "this actually happened".
  transfer: (accent) => (
    <g strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <path d="M-22 -24h26l10 10v38h-36z" stroke={INK} opacity="0.9" />
      <path d="M4 -24v10h10" stroke={INK} opacity="0.9" />
      <path d="M-15 -6h16M-15 2h20M-15 10h11" stroke={INK} opacity="0.45" />
      <path d="M-11 17c5-6 9 4 14-2s8 1 13-5" stroke={accent} strokeWidth="2.6" />
      <path d="M22 -20 8 -6l-4 9 9-4 14-14z" stroke={INK} opacity="0.9" />
      <path d="m17 -15 4 4" stroke={INK} opacity="0.9" />
    </g>
  ),
  // A cross with the trace running straight through it. The flatline dip is
  // what makes it read as an injury rather than as a pharmacy.
  injury: (accent) => (
    <g strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <path d="M-8 -22h16v14h14v16H8v14H-8v-14h-14v-16h14z" stroke={INK} opacity="0.9" />
      <path d="M-30 2h9l4-9 6 18 5-11 4 6h30" stroke={accent} strokeWidth="2.6" />
    </g>
  ),
  // Two crests turned away from each other, split by the bolt. The gap is the
  // point: the drawing is about the space between them.
  rivalry: (accent) => (
    <g strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <g transform="rotate(-9)">
        <path d="M-14 -22h-16v18c0 11 7 18 16 23" stroke={INK} opacity="0.9" />
      </g>
      <g transform="rotate(9)">
        <path d="M14 -22h16v18c0 11-7 18-16 23" stroke={INK} opacity="0.9" />
      </g>
      <path d="M4 -27-7 2h6l-3 25 11-29h-6z" stroke={accent} strokeWidth="2.4" strokeLinejoin="round" />
    </g>
  ),
  // Scarf held overhead, flag behind it. Supporters, drawn as the objects they
  // hold rather than as a crowd of dots.
  fans: (accent) => (
    <g strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <path d="M18 24v-46" stroke={INK} opacity="0.9" />
      <path d="M18 -22c8 2 12 6 20 4-2 6-2 10 0 15-8 2-12-2-20-4z" stroke={accent} strokeWidth="2.2" />
      <path d="M-32 -6c8-8 17-8 25 0s17 8 25 0" stroke={INK} opacity="0.9" />
      <path d="M-32 -6v14c8-8 17-8 25 0" stroke={INK} opacity="0.9" />
      <path d="M18 8c-8 8-17 8-25 0" stroke={INK} opacity="0.9" />
      <path d="M-24 -2v13M-14 -5v13M2 -2v13M11 -5v13" stroke={INK} opacity="0.4" />
    </g>
  ),
  // A scoreline on a board, and the burst it set off. Six rays, not twelve —
  // a starburst with too many arms stops being a graphic and becomes a sun.
  result: (accent) => (
    <g strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <rect x="-31" y="-15" width="62" height="30" rx="7" stroke={INK} opacity="0.9" />
      {/* Two plates and a dash, not digits: a drawn numeral would be a
          scoreline this story does not have. */}
      <rect x="-22" y="-8" width="15" height="16" rx="3" stroke={INK} opacity="0.75" />
      <path d="M-3 0h6" stroke={INK} opacity="0.55" />
      <rect x="7" y="-8" width="15" height="16" rx="3" stroke={accent} strokeWidth="2.4" />
      <path d="M-34 -24 -29 -19M0 -30v-7M34 -24 29 -19M-34 26l5-5M34 26l-5-5" stroke={accent} strokeWidth="2.4" opacity="0.85" />
    </g>
  ),
};

/**
 * The key image on a lead story.
 *
 * Seeded bands are the base layer and remain the whole picture for anything the
 * matcher does not recognise; a recognised story gets its motif stamped on top,
 * inside a vignette that keeps the bands legible behind the drawing. Decorative
 * either way, so the whole thing is `aria-hidden` — the headline underneath is
 * the content.
 */
export function StoryArt({
  seed,
  motif = null,
  className,
}: {
  seed: string;
  motif?: StoryMotif | null;
  className?: string;
}): ReactNode {
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
      {motif && (
        // Right of centre, clear of the tag pill the card places top-left. The
        // scrim is a flat ellipse rather than a blur: one paint, and it does
        // the whole job of separating a line drawing from a striped ground.
        <>
          <ellipse cx="140" cy="46" rx="52" ry="42" fill={bands.base} opacity="0.62" />
          <g transform="translate(140 46) scale(0.92)">{MOTIF_ART[motif](bands.accent)}</g>
        </>
      )}
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
          <StoryArt seed={story.imageSeed ?? story.id} motif={storyMotifFor(story.tags)} />
          {displayTags(story.tags)[0] && (
            <div className="absolute left-3 top-3">
              <GlassPill tone={sentimentTone} size="xs" filled={sentimentTone !== 'neutral'}>
                {displayTags(story.tags)[0]}
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
