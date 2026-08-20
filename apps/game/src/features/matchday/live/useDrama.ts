import { useEffect, useRef, useState } from 'react';
import type { MatchEvent } from '@cf/engine';
import { useMatchStore, type MatchSpeed } from '@/state/matchStore';

/**
 * The automatic dramatic slow-down.
 *
 * Football is not evenly interesting. A match watched at one constant rate
 * gives a clear chance exactly as much of the player's attention as a throw-in,
 * and the player learns to stop looking. So the presentation layer takes the
 * pace back for a beat whenever the simulation produces a moment that deserves
 * it — a clear chance, a penalty, a red card, or a decision it is about to ask
 * the manager to make — and then hands the pace straight back to whatever the
 * manager chose.
 *
 * ## This changes nothing about the match
 *
 * The only thing touched is `setSpeed`, which is the *wall-clock interval
 * between ticks*. The simulator's tick sequence, its RNG stream and its results
 * are identical whether a tick is drained after 150ms or 620ms; the store
 * cannot even tell the difference. Nothing here computes a football outcome —
 * every trigger is read off an event the simulation has already emitted.
 *
 * ## Why the selected speed is overridden even at Instant
 *
 * Someone who has set Instant has asked for the match to be over quickly, and a
 * 1.6-second beat on a penalty does not meaningfully cost them that. What they
 * would lose without it is the only moment in the match worth watching. The
 * beat ends by itself and the chosen speed comes back untouched.
 */

export type DramaReason = 'CHANCE' | 'PENALTY' | 'RED_CARD' | 'DECISION' | 'POST';

/** How long the game stays slowed after the moment that triggered it. */
const DRAMA_MS = 1700;

/** A shot has to be this likely to score before it counts as a clear chance. */
const CLEAR_CHANCE_XG = 0.17;

const REASON_LABEL: Record<DramaReason, string> = {
  CHANCE: 'Big chance',
  PENALTY: 'Penalty',
  RED_CARD: 'Red card',
  DECISION: 'Your call',
  POST: 'Off the woodwork',
};

/** Goals are excluded on purpose: the goal moment owns that treatment alone. */
function reasonFor(event: MatchEvent): DramaReason | null {
  switch (event.type) {
    case 'PENALTY_AWARDED': return 'PENALTY';
    case 'RED_CARD': return 'RED_CARD';
    case 'POST': return 'POST';
    case 'CHANCE_CREATED': return 'CHANCE';
    case 'SHOT': return (event.xg ?? 0) >= CLEAR_CHANCE_XG ? 'CHANCE' : null;
    default: return null;
  }
}

export interface DramaState {
  /** The banner to show over the pitch, or null when the match is at its pace. */
  readonly label: string | null;
  readonly active: boolean;
}

/**
 * @param preferredSpeed the speed the manager selected, which the beat restores.
 * @param enabled false while an overlay (intro, goal) already owns the screen.
 */
export function useDrama(preferredSpeed: MatchSpeed, enabled: boolean): DramaState {
  const feed = useMatchStore((s) => s.feed);
  const decision = useMatchStore((s) => s.decision);
  const playback = useMatchStore((s) => s.playback);

  const [label, setLabel] = useState<string | null>(null);

  const seen = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slowed = useRef(false);
  // The restore target is read at restore time, so changing speed mid-beat is
  // respected rather than overwritten a second and a half later.
  const preferred = useRef(preferredSpeed);
  preferred.current = preferredSpeed;

  const release = useRef(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (slowed.current) {
      slowed.current = false;
      useMatchStore.getState().setSpeed(preferred.current);
    }
    setLabel(null);
  });

  /* A decision holds the beat for as long as the prompt is on screen. */
  useEffect(() => {
    if (!enabled) return;
    if (!decision) return;
    setLabel(REASON_LABEL.DECISION);
    return () => setLabel(null);
  }, [decision, enabled]);

  useEffect(() => {
    if (!enabled || playback === 'COMPLETE') return;
    const latest = feed[0];
    if (!latest) return;
    if (seen.current === latest.id) return;
    // Everything already in the feed on the first pass is history, not news.
    const first = seen.current === null;
    seen.current = latest.id;
    if (first) return;

    const reason = reasonFor(latest);
    if (!reason) return;

    setLabel(REASON_LABEL[reason]);
    if (!slowed.current) {
      slowed.current = true;
      useMatchStore.getState().setSpeed('SLOW');
    }
    if (timer.current) clearTimeout(timer.current);
    const end = release.current;
    timer.current = setTimeout(end, DRAMA_MS);
  }, [feed, enabled, playback]);

  /* Hand the pace back the moment the beat stops being ours to hold. */
  useEffect(() => {
    if (enabled) return;
    release.current();
  }, [enabled]);

  useEffect(() => {
    const end = release.current;
    return () => { end(); };
  }, []);

  return { label, active: label !== null };
}
