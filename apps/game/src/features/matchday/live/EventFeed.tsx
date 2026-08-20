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
 *
 * ## Why each row is animated by *label* and not by object
 *
 * `MatchEventRow` carries `variants={listItem}` and no `initial`/`animate` of
 * its own: it is built to be driven by whatever list it is dropped into. Motion
 * propagates variant *labels* down the tree, not animation objects — so a row
 * wrapped in a parent that animates with `initial={{ opacity: 0 }}` inherits no
 * label at all, resolves to its own `hidden` variant, and stays at opacity 0
 * forever. The whole feed rendered at full height with nothing legible in it,
 * for the entire match. Every wrapper here therefore animates by label.
 */

export interface EventFeedProps {
  perspective: 'home' | 'away';
  limit?: number;
  className?: string;
}

/** Labels, not objects — see the note above. */
const ROW = {
  hidden: { opacity: 0, y: -10 },
  visible: { opacity: 1, y: 0 },
} as const;

const REDUCED_ROW = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
} as const;

export const EventFeed = memo(function EventFeed({
  perspective, limit = 40, className,
}: EventFeedProps): ReactNode {
  const feed = useMatchStore((s) => s.feed);
  const m = useDesignMotion();

  const events = useMemo(
    () => feed.filter(isNoteworthy).slice(0, limit),
    [feed, limit],
  );

  return (
    <ol className={cn('flex flex-col', className)}>
      <AnimatePresence initial={false}>
        {events.map((event) => (
          <motion.li
            key={event.id}
            layout={m.reduced ? false : 'position'}
            variants={m.reduced ? REDUCED_ROW : ROW}
            initial="hidden"
            animate="visible"
            transition={m.transition.fast}
          >
            <MatchEventRow event={event} perspective={perspective} dense />
          </motion.li>
        ))}
      </AnimatePresence>

      {/*
        The first half-minute of a match is quiet, and a first-time player is
        looking at a canvas full of unexplained marks with nothing to read. So
        the empty feed is not empty: it says what the pitch is telling them.
        It disappears on its own the moment the football starts talking.
      */}
      {events.length < 3 && (
        <li className="mt-1 rounded-md border border-white/[0.07] bg-white/[0.03] p-3">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-dim">
            {events.length === 0 ? 'Nothing has happened yet' : 'Reading the pitch'}
          </h3>
          <ul className="mt-1.5 flex flex-col gap-1 text-[13px] leading-snug text-ink-muted">
            <li>
              <span className="font-semibold text-volt">The lime ring</span> is whoever has the
              ball. Amber and red arcs around it mean he is being closed down.
            </li>
            <li>
              <span className="font-semibold text-ink">The colour under each shirt</span> is that
              player&apos;s job: defence, midfield or attack.
            </li>
            <li>
              <span className="font-semibold text-ink">Big moments slow down</span> on their own,
              whatever speed you pick, and you will be asked for a decision when one arrives.
            </li>
          </ul>
        </li>
      )}
    </ol>
  );
});
