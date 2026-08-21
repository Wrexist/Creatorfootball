import { memo, useMemo, useState, type ReactNode } from 'react';
import {
  REACTION_INFO, reactionOptions,
  type GameState, type ReactionKind, type SocialPost,
} from '@cf/engine';
import {
  Divider, GlassButton, GlassSheet, IconHeart, IconRepost, IconReply, IconX, Text, cn, formatCount,
} from '@/design';
import { EffectLines } from './Effects';

/**
 * Four answers to somebody else's post, and one of them is silence.
 *
 * The bar is deliberately not a row of social-media affordances. Liking a
 * rival's dig is not a thing this game lets you do idly — every one of these
 * moves the world, so tapping one opens the price first. Silence is given the
 * same visual weight as the rest, because deciding not to respond is the
 * interesting choice and burying it would make it the default.
 */

export interface ReactionBarProps {
  state: GameState;
  post: SocialPost;
  /** Already dealt with — the bar collapses to a note. */
  handled: boolean;
  onReact: (kind: ReactionKind) => void;
  className?: string;
}

const ICONS: Record<ReactionKind, ReactNode> = {
  LIKE: <IconHeart />,
  REPOST: <IconRepost />,
  QUOTE: <IconReply />,
  SILENCE: <IconX />,
};

const ORDER: readonly ReactionKind[] = ['LIKE', 'REPOST', 'QUOTE', 'SILENCE'];

export const ReactionBar = memo(function ReactionBar({
  state, post, handled, onReact, className,
}: ReactionBarProps): ReactNode {
  const [open, setOpen] = useState<ReactionKind | null>(null);
  const options = useMemo(() => reactionOptions(state, post), [state, post]);
  const chosen = options.find((o) => o.kind === open) ?? null;

  if (handled) {
    return (
      <Text role="micro" as="p" className={cn('text-ink-dim', className)}>
        You have already dealt with this one.
      </Text>
    );
  }

  return (
    <>
      <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
        {ORDER.map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => setOpen(kind)}
            className={cn(
              'inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-[12px] font-semibold',
              kind === 'SILENCE' ? 'text-ink-dim hover:text-ink' : 'text-ink-muted hover:text-volt',
            )}
          >
            <span aria-hidden="true" className="[&_svg]:size-3.5">{ICONS[kind]}</span>
            {REACTION_INFO[kind].label}
          </button>
        ))}
      </div>

      <GlassSheet
        open={open !== null}
        onClose={() => setOpen(null)}
        title={chosen ? chosen.info.label : 'Respond'}
        subtitle={chosen?.info.blurb}
        size="auto"
        footer={
          chosen ? (
            <GlassButton
              variant={chosen.kind === 'QUOTE' ? 'primary' : 'secondary'}
              size="lg"
              block
              onClick={() => { onReact(chosen.kind); setOpen(null); }}
            >
              {chosen.kind === 'SILENCE' ? 'Say nothing, deliberately' : `${chosen.info.label}`}
            </GlassButton>
          ) : undefined
        }
      >
        {chosen && (
          <div className="flex flex-col gap-3">
            <article className="glass-1 rounded-lg p-3">
              <Text role="label" as="p">{post.authorName}</Text>
              <Text role="body" as="p" className="mt-1 text-pretty">{post.text}</Text>
            </article>
            <Divider label="What it does" />
            <EffectLines lines={chosen.lines} />
            {chosen.reach > 0 && (
              <Text role="caption" as="p" className="text-ink-dim">
                {`Reaches roughly ${formatCount(chosen.reach)} people.`}
              </Text>
            )}
            {chosen.kind === 'SILENCE' && (
              <Text role="caption" as="p" className="text-ink-dim text-pretty">
                Not responding is a response. The press will read it as composure. If this was
                about one of your own players, the dressing room will read it differently.
              </Text>
            )}
          </div>
        )}
      </GlassSheet>
    </>
  );
});
