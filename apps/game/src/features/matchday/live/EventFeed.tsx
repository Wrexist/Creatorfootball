import { memo, useMemo, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { MatchEvent } from '@cf/engine';
import { MatchEventRow, cn, useDesignMotion } from '@/design';
import { useMatchStore } from '@/state/matchStore';
import { isNoteworthy, minuteLabel } from '../shared/format';

/**
 * The live event feed.
 *
 * The store keeps a 60-event tail newest-first; we filter out the ball-by-ball
 * chatter (passes, carries, possession changes) unless the simulation marked it
 * important. A feed that logs every pass is a feed nobody reads, and the full
 * stream is preserved on the result object for the analytics screen anyway.
 */

export interface EventFeedProps {
  perspective: 'home' | 'away';
  limit?: number;
  className?: string;
}

export const EventFeed = memo(function EventFeed({
  perspective, limit = 40, className,
}: EventFeedProps): ReactNode {
  const feed = useMatchStore((s) => s.feed);
  const m = useDesignMotion();

  const events = useMemo(
    () => feed.filter(isNoteworthy).slice(0, limit),
    [feed, limit],
  );

  if (events.length === 0) {
    return (
      <p className={cn('px-1 py-6 text-center text-[13px] text-ink-dim', className)}>
        The match has not started yet.
      </p>
    );
  }

  return (
    <ol className={cn('flex flex-col', className)}>
      <AnimatePresence initial={false}>
        {events.map((event) => (
          <motion.li
            key={event.id}
            layout={m.reduced ? false : 'position'}
            initial={m.reduced ? { opacity: 0 } : { opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={m.transition.fast}
          >
            <MatchEventRow event={event} perspective={perspective} dense />
          </motion.li>
        ))}
      </AnimatePresence>
    </ol>
  );
});

/**
 * The one-line ticker used on a phone, where the pitch has to keep the height
 * and a full feed cannot. Tapping it opens the full feed.
 */
export const EventTicker = memo(function EventTicker({
  onPress, className,
}: { onPress: () => void; className?: string }): ReactNode {
  const feed = useMatchStore((s) => s.feed);
  const m = useDesignMotion();
  const latest: MatchEvent | undefined = useMemo(() => feed.find(isNoteworthy), [feed]);

  return (
    <button
      type="button"
      onClick={onPress}
      className={cn(
        'flex min-h-11 w-full items-center gap-2.5 rounded-md bg-white/[0.05] px-3 text-left',
        'outline-none focus-visible:ring-2 focus-visible:ring-volt focus-visible:ring-offset-2 focus-visible:ring-offset-base',
        className,
      )}
      aria-label="Open the full match feed"
    >
      <span className="tnum shrink-0 rounded-xs bg-white/10 px-1.5 py-0.5 text-[11px] font-bold text-ink-muted">
        {latest ? minuteLabel(latest.minute) : "0'"}
      </span>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={latest?.id ?? 'idle'}
          initial={m.reduced ? { opacity: 0 } : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={m.reduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
          transition={m.transition.fast}
          className="min-w-0 flex-1 truncate text-[13px] text-ink"
        >
          {latest?.text ?? 'Waiting for kick-off.'}
        </motion.span>
      </AnimatePresence>
      <span aria-hidden="true" className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-dim">
        Feed
      </span>
    </button>
  );
});
