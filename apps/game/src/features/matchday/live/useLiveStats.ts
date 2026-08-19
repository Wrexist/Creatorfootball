import { useEffect, useRef, useState } from 'react';
import type { MatchEvent, Side } from '@cf/engine';
import { useMatchStore } from '@/state/matchStore';

/**
 * Running match statistics, tallied from the event stream.
 *
 * The simulator only exposes score, minute, momentum and the current frame
 * while a match is in flight; the full `TeamMatchStats` arrive with the result.
 * Rather than have the broadcast view invent numbers, this accumulates the
 * simulation's own events as they land — a tally, not a model. Every figure
 * here is reconciled against the authoritative `MatchResult` the moment the
 * whistle goes, and the analytics screen reads that object, never this one.
 *
 * Possession is the one figure sampled from frames rather than events: it is
 * the share of ticks in which each side held the ball, which is exactly what
 * the engine itself counts (`possessionTicks`).
 */

export interface LiveSideStats {
  shots: number;
  onTarget: number;
  xg: number;
  corners: number;
  fouls: number;
  yellows: number;
  reds: number;
  tackles: number;
  bigChances: number;
  saves: number;
  possessionTicks: number;
}

export interface LiveStats {
  readonly home: LiveSideStats;
  readonly away: LiveSideStats;
  /** 0-1 share for the home side. 0.5 before a ball is kicked. */
  readonly homePossession: number;
  readonly momentumHistory: readonly number[];
}

const emptySide = (): LiveSideStats => ({
  shots: 0, onTarget: 0, xg: 0, corners: 0, fouls: 0, yellows: 0, reds: 0,
  tackles: 0, bigChances: 0, saves: 0, possessionTicks: 0,
});

/** Momentum samples kept for the live wave. One per tick, ~300 for a match. */
const MOMENTUM_CAP = 400;

function applyEvent(home: LiveSideStats, away: LiveSideStats, event: MatchEvent): void {
  const side: Side | undefined = event.side;
  if (!side) return;
  const own = side === 'home' ? home : away;
  const other = side === 'home' ? away : home;

  switch (event.type) {
    case 'SHOT':
      own.shots += 1;
      own.xg += event.xg ?? 0;
      break;
    case 'GOAL':
    case 'PENALTY_SCORED':
      own.onTarget += 1;
      break;
    case 'SAVE':
      // A save is emitted for the defending side, so it is the *other* team's
      // shot that found the target.
      own.saves += 1;
      other.onTarget += 1;
      break;
    case 'CORNER': own.corners += 1; break;
    case 'FOUL': own.fouls += 1; break;
    case 'YELLOW_CARD': own.yellows += 1; break;
    case 'RED_CARD': own.reds += 1; break;
    case 'TACKLE':
    case 'INTERCEPTION': own.tackles += 1; break;
    case 'CHANCE_CREATED': own.bigChances += 1; break;
    default: break;
  }
}

export function useLiveStats(): LiveStats {
  const [stats, setStats] = useState<LiveStats>(() => ({
    home: emptySide(), away: emptySide(), homePossession: 0.5, momentumHistory: [],
  }));

  const seen = useRef<Set<string>>(new Set());
  const home = useRef<LiveSideStats>(emptySide());
  const away = useRef<LiveSideStats>(emptySide());
  const momentum = useRef<number[]>([]);
  const lastTick = useRef<number>(-1);

  useEffect(() => {
    // At INSTANT speed the store fires several hundred times a second. The
    // tally must see every one of those, but React must not: publishing is
    // throttled to ~12Hz with a trailing flush so the final numbers are always
    // the ones on screen.
    let lastPublish = 0;
    let trailing: ReturnType<typeof setTimeout> | null = null;

    const publish = (): void => {
      lastPublish = Date.now();
      const total = home.current.possessionTicks + away.current.possessionTicks;
      setStats({
        home: { ...home.current },
        away: { ...away.current },
        homePossession: total === 0 ? 0.5 : home.current.possessionTicks / total,
        momentumHistory: momentum.current.slice(),
      });
    };

    const ingest = (state: ReturnType<typeof useMatchStore.getState>): void => {
      let changed = false;

      // The feed is newest-first and capped, so we walk it until we reach
      // something already counted. At the store's 60-event cap that is a
      // handful of comparisons per tick.
      for (const event of state.feed) {
        if (seen.current.has(event.id)) break;
        seen.current.add(event.id);
        applyEvent(home.current, away.current, event);
        changed = true;
      }

      const frame = state.frame;
      if (frame && frame.tick !== lastTick.current) {
        lastTick.current = frame.tick;
        const holder = frame.players.find((p) => p.hasBall);
        if (holder) {
          if (holder.side === 'home') home.current.possessionTicks += 1;
          else away.current.possessionTicks += 1;
        }
        momentum.current.push(state.momentum);
        if (momentum.current.length > MOMENTUM_CAP) momentum.current.shift();
        changed = true;
      }

      if (!changed) return;
      if (Date.now() - lastPublish >= 80) {
        if (trailing) { clearTimeout(trailing); trailing = null; }
        publish();
      } else if (!trailing) {
        trailing = setTimeout(() => { trailing = null; publish(); }, 90);
      }
    };

    ingest(useMatchStore.getState());
    const unsubscribe = useMatchStore.subscribe(ingest);
    return () => {
      unsubscribe();
      if (trailing) clearTimeout(trailing);
    };
  }, []);

  return stats;
}
