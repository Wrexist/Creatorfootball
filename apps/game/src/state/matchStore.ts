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

/** Real milliseconds per simulation tick at each speed. */
const TICK_INTERVAL: Record<MatchSpeed, number> = {
  SLOW: 620,
  NORMAL: 340,
  FAST: 150,
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
