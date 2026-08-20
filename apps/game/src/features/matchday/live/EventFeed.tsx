import { memo, useMemo, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { MatchEventRow, cn, useDesignMotion } from '@/design';
import { useMatchStore } from '@/state/matchStore';
import { isNoteworthy } from '../shared/format';

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
      <p className={cn('px-1 py-8 text-center text-[13px] text-ink-dim text-pretty', className)}>
        Nothing has happened yet. Every shot, card and change will appear here as it does.
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
