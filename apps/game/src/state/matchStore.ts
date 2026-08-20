import { create } from 'zustand';
import type {
  DecisionPrompt, MatchEvent, MatchResult, PitchFrame, PlayerId, SpecialRuleId, Side,
} from '@cf/engine';

/**
 * Live match playback.
 *
 * The simulation is authoritative and fully decoupled from presentation: this
 * store drives a clock that pulls ticks out of the simulator and hands the
 * resulting events and frames to whichever renderer is mounted. Swapping the
 * animated pitch for the broadcast view changes nothing here, which is exactly
 * why the two presentation modes can coexist.
 *
 * The simulator instance itself is held outside the store — it is a mutable
 * object, and putting it in reactive state would invite React to treat it as a
 * value to diff.
 */

export type MatchSpeed = 'SLOW' | 'NORMAL' | 'FAST' | 'INSTANT';
export type PlaybackState = 'IDLE' | 'PLAYING' | 'PAUSED' | 'AWAITING_DECISION' | 'COMPLETE';

/**
 * Real milliseconds per simulation tick at each speed.
 *
 * These are a *presentation* schedule and nothing else. The simulator's tick
 * sequence, its RNG stream and its `MatchResult` are identical whether a tick
 * is drained after 0ms or 620ms; changing these numbers cannot change a single
 * football outcome.
 *
 * The ladder was retuned against measurement. A match is 30 minutes at
 * `BALANCE.TICKS_PER_MINUTE` = 10, so 300-odd ticks, and the drain loop itself
 * costs ~31ms per tick on the reference device. At the old NORMAL of 340ms that
 * put a full match at roughly two and a half minutes of pure playback before
 * any celebration, decision or dramatic beat was added — measured at 154s to
 * reach the 25th minute — against a documented 10-15 minute *session* that also
 * has to hold the preview, the post-match sequence and the week's management.
 * The match was eating the session, and NORMAL is the setting most players will
 * never change, so it is the one that has to be right.
 *
 * NORMAL now runs a 30-minute match in about a minute of pure playback, which
 * lands near 90 seconds once goals, decisions and the automatic dramatic
 * slow-down have taken their share. SLOW is kept genuinely slow for a player
 * who wants to read every phase, and the gap between NORMAL and SLOW is now
 * wide enough that the automatic slow-down at a clear chance reads as a real
 * change of pace rather than a slightly slower version of something already
 * slow.
 */
const TICK_INTERVAL: Record<MatchSpeed, number> = {
  SLOW: 400,
  NORMAL: 170,
  FAST: 70,
  INSTANT: 0,
};

/** Structural view of the engine's simulator, so this store never imports its implementation. */
export interface SimulatorHandle {
  /** Present on the real simulator; optional so tests can supply a stub. */
  readonly setup?: {
    readonly home: { readonly isPlayerControlled: boolean };
    readonly away: { readonly isPlayerControlled: boolean };
  };
  step(): readonly MatchEvent[];
  frame(): PitchFrame;
  pendingDecision(): DecisionPrompt | null;
  resolveDecision(promptId: string, optionId: string): void;
  makeSubstitution(side: Side, out: PlayerId, in_: PlayerId): boolean;
  playRuleCard(side: Side, ruleId: SpecialRuleId): boolean;
  readonly isComplete: boolean;
  result(): MatchResult;
  finish(): MatchResult;
  score(): { home: number; away: number };
  minute(): number;
  momentum(): number;
}

interface MatchState {
  playback: PlaybackState;
  speed: MatchSpeed;
  minute: number;
  homeScore: number;
  awayScore: number;
  momentum: number;
  frame: PitchFrame | null;
  /** Newest first, capped for render cost. The full stream lives in the result. */
  feed: MatchEvent[];
  /** The event the UI is currently celebrating, if any. */
  highlight: MatchEvent | null;
  decision: DecisionPrompt | null;
  decisionDeadline: number | null;
  result: MatchResult | null;
  presentation: 'PITCH' | 'BROADCAST';
  /**
   * Which side the human manages. Substitutions and rule cards must be applied
   * to it, not to whichever team happens to be nominally at home — hardcoding
   * 'home' silently made every away fixture substitute the opposition.
   */
  playerSide: Side;

  /**
   * `playerSide` defaults to whichever team the simulator reports as
   * player-controlled, so no call site has to remember it.
   */
  attach: (sim: SimulatorHandle, playerSide?: Side) => void;
  play: () => void;
  pause: () => void;
  setSpeed: (speed: MatchSpeed) => void;
  setPresentation: (mode: 'PITCH' | 'BROADCAST') => void;
  chooseOption: (optionId: string) => void;
  substitute: (out: PlayerId, in_: PlayerId) => boolean;
  playRuleCard: (ruleId: SpecialRuleId) => boolean;
  skipToEnd: () => void;
  clearHighlight: () => void;
  reset: () => void;
}

let simulator: SimulatorHandle | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

const MAX_FEED = 60;
/** Events at or above this importance interrupt playback for a beat. */
const HIGHLIGHT_IMPORTANCE = 4;

const clearTimer = () => {
  if (timer !== null) { clearTimeout(timer); timer = null; }
};

export const useMatchStore = create<MatchState>((set, get) => {
  const drainTick = (): void => {
    const sim = simulator;
    if (!sim) return;

    const events = sim.step();
    const state = get();
    const nextFeed = events.length ? [...events].reverse().concat(state.feed).slice(0, MAX_FEED) : state.feed;
    const bigMoment = events.find((e) => e.importance >= HIGHLIGHT_IMPORTANCE) ?? null;
    const score = sim.score();
    const pending = sim.pendingDecision();

    set({
      minute: sim.minute(),
      homeScore: score.home,
      awayScore: score.away,
      momentum: sim.momentum(),
      frame: sim.frame(),
      feed: nextFeed,
      ...(bigMoment ? { highlight: bigMoment } : {}),
    });

    if (sim.isComplete) {
      clearTimer();
      set({ playback: 'COMPLETE', result: sim.result(), decision: null, decisionDeadline: null });
      return;
    }

    if (pending) {
      clearTimer();
      set({
        playback: 'AWAITING_DECISION',
        decision: pending,
        // A prompt with a timeout gets a wall-clock deadline so the UI can show
        // a countdown; timeoutSeconds of 0 means the match waits indefinitely.
        decisionDeadline: pending.timeoutSeconds > 0 ? Date.now() + pending.timeoutSeconds * 1000 : null,
      });
      return;
    }

    if (get().playback === 'PLAYING') schedule();
  };

  const schedule = (): void => {
    clearTimer();
    const interval = TICK_INTERVAL[get().speed];
    if (interval === 0) {
      // Instant mode still yields between ticks so the UI can paint the final
      // state rather than locking the main thread on a long match.
      timer = setTimeout(drainTick, 0);
    } else {
      timer = setTimeout(drainTick, interval);
    }
  };

  return {
    playback: 'IDLE',
    speed: 'NORMAL',
    minute: 0,
    homeScore: 0,
    awayScore: 0,
    momentum: 0,
    frame: null,
    feed: [],
    highlight: null,
    decision: null,
    decisionDeadline: null,
    result: null,
    presentation: 'PITCH',
    playerSide: 'home',

    attach: (sim, playerSide) => {
      clearTimer();
      simulator = sim;
      const resolvedSide: Side =
        playerSide ?? (sim.setup?.away.isPlayerControlled ? 'away' : 'home');
      set({
        playerSide: resolvedSide,
        playback: 'IDLE', minute: 0, homeScore: 0, awayScore: 0, momentum: 0,
        frame: sim.frame(), feed: [], highlight: null, decision: null,
        decisionDeadline: null, result: null,
      });
    },

    play: () => {
      if (!simulator || get().playback === 'COMPLETE') return;
      set({ playback: 'PLAYING' });
      schedule();
    },

    pause: () => {
      clearTimer();
      if (get().playback === 'PLAYING') set({ playback: 'PAUSED' });
    },

    setSpeed: (speed) => {
      set({ speed });
      if (get().playback === 'PLAYING') schedule();
    },

    setPresentation: (presentation) => set({ presentation }),

    chooseOption: (optionId) => {
      const sim = simulator;
      const prompt = get().decision;
      if (!sim || !prompt) return;
      sim.resolveDecision(prompt.id, optionId);
      set({ decision: null, decisionDeadline: null, playback: 'PLAYING' });
      schedule();
    },

    substitute: (out, in_) => {
      const sim = simulator;
      if (!sim) return false;
      return sim.makeSubstitution(get().playerSide, out, in_);
    },

    playRuleCard: (ruleId) => {
      const sim = simulator;
      if (!sim) return false;
      return sim.playRuleCard(get().playerSide, ruleId);
    },

    skipToEnd: () => {
      const sim = simulator;
      if (!sim) return;
      clearTimer();
      const result = sim.finish();
      set({
        playback: 'COMPLETE',
        result,
        minute: result.durationMinutes,
        homeScore: result.homeScore,
        awayScore: result.awayScore,
        decision: null,
        decisionDeadline: null,
        frame: sim.frame(),
      });
    },

    clearHighlight: () => set({ highlight: null }),

    reset: () => {
      clearTimer();
      simulator = null;
      set({
        playback: 'IDLE', minute: 0, homeScore: 0, awayScore: 0, momentum: 0,
        frame: null, feed: [], highlight: null, decision: null,
        decisionDeadline: null, result: null,
      });
    },
  };
});
