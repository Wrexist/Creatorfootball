import type { Side } from './events';
import { clamp, clamp01, decayToward } from '../core/math';
import { BALANCE } from './balance';

/**
 * Momentum.
 *
 * Momentum here is a **read-out**, not a force. It summarises what has actually
 * happened in the last minute or so — xG created at each end, who has had the
 * ball, and the discrete moments that change the feel of a game — into a single
 * number in [-1, +1] that the UI can draw as a bar and the commentary can talk
 * about.
 *
 * It is allowed to touch outcomes, but only through `momentumBoost()`, and only
 * by at most `BALANCE.MOMENTUM_MAX_EFFECT` (currently 6%) on chance creation
 * and duel odds. That deliberately falls short of rubber-banding: a team that
 * is being battered gets *no* compensating bonus, because inventing one would
 * make every scoreline feel manufactured. What the player sees on the momentum
 * bar is the truth about the last sixty seconds, and it costs the loser nothing
 * to be losing.
 *
 * The one place momentum is genuinely load-bearing is the decision engine,
 * which uses swings in it to decide when to interrupt the player. That is a
 * presentation decision, not a probability one.
 */

interface WindowSample {
  readonly tick: number;
  readonly homeXg: number;
  readonly awayXg: number;
  readonly homePossession: number;
  readonly awayPossession: number;
  readonly homeEvent: number;
  readonly awayEvent: number;
}

/** Discrete moments and how hard they push the bar. Positive = good for the side. */
export const MOMENTUM_EVENT_IMPULSE = {
  GOAL: 1.0,
  BIG_CHANCE: 0.35,
  SHOT: 0.12,
  SAVE: 0.18,
  POST: 0.3,
  PENALTY_AWARDED: 0.5,
  PENALTY_MISSED: -0.4,
  RED_CARD: -0.9,
  YELLOW_CARD: -0.12,
  INJURY: -0.25,
  CREATOR_MOMENT: 0.45,
  SUBSTITUTION: 0.05,
  TACTICAL_CHANGE: 0.05,
  TURNOVER_HIGH: 0.1,
} as const;
export type MomentumImpulse = keyof typeof MOMENTUM_EVENT_IMPULSE;

export class MomentumTracker {
  private samples: WindowSample[] = [];
  private value = 0;
  private lastEmitted = 0;
  private pendingHome = 0;
  private pendingAway = 0;

  /** -1 (away in full control) .. +1 (home in full control). */
  get current(): number { return this.value; }

  /** Push a discrete moment. `side` is who it was good for. */
  impulse(kind: MomentumImpulse, side: Side): void {
    const magnitude = MOMENTUM_EVENT_IMPULSE[kind];
    if (side === 'home') this.pendingHome += magnitude;
    else this.pendingAway += magnitude;
  }

  /**
   * Advance one tick. `possession` is who had the ball; xG values are whatever
   * was generated this tick at each end.
   */
  tick(tickIndex: number, possession: Side | null, homeXg: number, awayXg: number): number {
    this.samples.push({
      tick: tickIndex,
      homeXg,
      awayXg,
      homePossession: possession === 'home' ? 1 : 0,
      awayPossession: possession === 'away' ? 1 : 0,
      homeEvent: this.pendingHome,
      awayEvent: this.pendingAway,
    });
    this.pendingHome = 0;
    this.pendingAway = 0;

    const cutoff = tickIndex - BALANCE.MOMENTUM_WINDOW_TICKS;
    while (this.samples.length > 0 && (this.samples[0] as WindowSample).tick < cutoff) {
      this.samples.shift();
    }

    let hx = 0, ax = 0, hp = 0, ap = 0, he = 0, ae = 0;
    for (const s of this.samples) {
      hx += s.homeXg; ax += s.awayXg;
      hp += s.homePossession; ap += s.awayPossession;
      he += s.homeEvent; ae += s.awayEvent;
    }

    // Each term is normalised to roughly [-1, 1] over the window before weighting.
    const xgTerm = normalise(hx - ax, 0.55);
    const possessionTerm = hp + ap > 0 ? (hp - ap) / (hp + ap) : 0;
    const eventTerm = normalise(he - ae, 1.4);

    const target = clamp(
      xgTerm * BALANCE.MOMENTUM_XG_WEIGHT
      + possessionTerm * BALANCE.MOMENTUM_POSSESSION_WEIGHT
      + eventTerm * BALANCE.MOMENTUM_EVENT_WEIGHT,
      -1, 1,
    );

    this.value = decayToward(this.value, target, BALANCE.MOMENTUM_RESPONSE);
    this.value = decayToward(this.value, 0, BALANCE.MOMENTUM_DECAY);
    this.value = clamp(this.value, -1, 1);
    return this.value;
  }

  /**
   * True when the bar has moved far enough since the last shout to be worth an
   * event. Used only for presentation and for deciding when to interrupt the
   * player, never for probability.
   */
  shouldAnnounce(): boolean {
    if (Math.abs(this.value - this.lastEmitted) < BALANCE.MOMENTUM_SHIFT_THRESHOLD) return false;
    this.lastEmitted = this.value;
    return true;
  }

  /** Reset the reference point without announcing — used at period boundaries. */
  rebase(): void { this.lastEmitted = this.value; }

  /** Half-time wipes the slate: the shape of the game restarts with the whistle. */
  halfTime(motivation: number): void {
    this.samples = [];
    // A motivating manager pulls the bar back toward neutral faster in the break.
    const pull = 0.45 + BALANCE.MANAGER_MOTIVATION_WEIGHT * clamp01(motivation / 100);
    this.value = decayToward(this.value, 0, clamp01(pull));
    this.lastEmitted = this.value;
  }
}

const normalise = (v: number, scale: number): number => clamp(v / scale, -1, 1);

/**
 * The only channel through which momentum touches probability. Returns a
 * multiplier delta for the given side, hard-capped both ways. A positive return
 * means "this side is playing with confidence"; there is no matching negative
 * bonus for the team being pinned back, by design.
 */
export function momentumBoost(momentum: number, side: Side): number {
  const signed = side === 'home' ? momentum : -momentum;
  return clamp(signed, -1, 1) * BALANCE.MOMENTUM_MAX_EFFECT;
}

/** Human-readable band, for commentary and the post-match chart legend. */
export function momentumBand(momentum: number): 'AWAY_STRONG' | 'AWAY' | 'EVEN' | 'HOME' | 'HOME_STRONG' {
  if (momentum <= -0.55) return 'AWAY_STRONG';
  if (momentum <= -0.2) return 'AWAY';
  if (momentum < 0.2) return 'EVEN';
  if (momentum < 0.55) return 'HOME';
  return 'HOME_STRONG';
}
