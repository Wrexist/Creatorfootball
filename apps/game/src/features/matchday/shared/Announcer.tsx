import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Screen-reader announcements for a match.
 *
 * A live match is almost entirely visual, so without this it is silent to a
 * VoiceOver user for thirty minutes. Two regions rather than one: goals, cards
 * and decisions are `assertive` because they demand a response or a reaction
 * right now; everything else is `polite` so it queues behind whatever the user
 * is currently reading.
 *
 * The text is re-emitted with a zero-width marker when the same message repeats
 * (a second goal for the same scorer, say) because assistive tech suppresses an
 * identical string.
 */

export interface AnnouncerProps {
  /** Interrupts: goals, red cards, decisions, full time. */
  urgent?: string | null;
  /** Queues: routine events, momentum, substitutions. */
  polite?: string | null;
}

/** Appended to force assistive tech to treat a repeated string as new. */
const ZERO_WIDTH = '\u200B';

function useRepeatable(message: string | null | undefined): string {
  const [text, setText] = useState('');
  const previous = useRef<string | null>(null);
  const toggle = useRef(false);

  useEffect(() => {
    if (!message) return;
    if (message === previous.current) {
      toggle.current = !toggle.current;
      setText(toggle.current ? `${message}${ZERO_WIDTH}` : message);
      return;
    }
    previous.current = message;
    setText(message);
  }, [message]);

  return text;
}

export function Announcer({ urgent, polite }: AnnouncerProps): ReactNode {
  const urgentText = useRepeatable(urgent);
  const politeText = useRepeatable(polite);

  return (
    <>
      <p className="sr-only" role="alert" aria-live="assertive" aria-atomic="true">
        {urgentText}
      </p>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {politeText}
      </p>
    </>
  );
}
