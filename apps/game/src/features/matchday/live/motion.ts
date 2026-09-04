import type { PitchFrame, PitchPlayerFrame, PlayPhase, Side } from '@cf/engine';

/**
 * Motion between simulation snapshots.
 *
 * The simulator hands over a frame every tick: where every shirt is, who has
 * the ball, and a coarse ball point derived from the phase of play. It says
 * nothing about how anybody got there, and a tick is six seconds of football
 * shown in a quarter of a second, so drawing each frame as it arrives is a
 * slideshow. This class is the layer in between. It owns the presentation of
 * movement and nothing else: it reads frames, it produces positions for the
 * painter, and no value it holds is ever read by the simulation.
 *
 * Shirts travel between snapshots. Each new frame starts a segment from
 * wherever the shirt is drawn now to where the frame says he is, timed to
 * arrive when the next frame is expected — an interval measured from the
 * frames themselves, so the same code is smooth at every match speed. A
 * dropped frame cannot lurch (the segment is bounded by the snapshot's own
 * step), a paused match completes its last segment and stops, and resuming
 * starts the next segment from the drawn position, never from a stale one.
 *
 * The ball is glued to whoever has it, at his drawn position rather than at
 * the simulator's coarse point, so it never darts sideways while a man is
 * carrying it. When it changes hands it flies to the receiver at a bounded
 * pace — a pass, an interception, a keeper's collection all read the same
 * way — and when a shot is struck it flies at the goal the shooter attacks.
 * When play stops it stays where play stopped: the simulator's "no
 * possession" point is the centre circle, and a ball that jumps there for
 * every foul was the single most visible lie on the old pitch.
 */

export interface MotionPoint { x: number; y: number }

export interface MotionNode extends MotionPoint {
  side: Side;
  state: PitchPlayerFrame['state'];
  stamina: number;
  hasBall: boolean;
  /** Where this segment started and where it is going, in pitch units. */
  fromX: number; fromY: number; toX: number; toY: number;
  /** Segment timing, ms. */
  startAt: number; duration: number;
  /** Smoothed heading and speed, for the painter's arrows. */
  hx: number; hy: number; speed: number;
  /** Set on this frame's arrival, cleared by the painter's own lifecycle. */
  present: boolean;
  /** Painter-owned: seconds of emphasis left after a shot or a tackle. Motion never reads it. */
  flash: number;
  /** Painter-owned: opponents inside the pressing radius. Motion never reads it. */
  pressure: number;
}

export type BallMode = 'CARRY' | 'FLIGHT' | 'LOOSE';

/** Pitch lengths per second. A firm pass; the ball is never slower than a man. */
export const BALL_PASS_SPEED = 1.6;
/** A shot: fast enough to be a shot, slow enough to be seen. */
export const BALL_SHOT_SPEED = 2.2;
/**
 * The most ball time one frame may carry, seconds. A slow frame slows the
 * ball fractionally rather than jumping it: at a shot's pace a 40 ms hitch
 * would otherwise move it a tenth of the pitch in one paint.
 */
const BALL_FRAME_CAP = 0.024;
/** How far ahead of the carrier the ball sits, along his heading. */
const CARRY_LEAD = 0.012;
/** Time constant for the ball settling onto its carrier, seconds. */
const CARRY_TAU = 0.07;
/** Time constant for a loose ball drifting to the simulator's point, seconds. */
const LOOSE_TAU = 0.35;
/**
 * How close the ball has to be to its target before it is put there exactly and
 * stops moving. An exponential ease never actually arrives, and a paused match
 * would repaint a ball creeping by nothing forever.
 *
 * `settled()` reports on the same number. It used to answer a looser 0.02,
 * which let it call the pitch quiescent while `settle` was still easing the
 * last two per cent — true for up to three seconds after a pause, because a
 * loose ball eases at `LOOSE_TAU`. That tolerance was really standing in for
 * `CARRY_LEAD`: the ball rests *ahead* of its carrier, and `settled` was
 * measuring to the carrier himself. Both now ask `carryTarget` where the ball
 * belongs, so the question "has everything stopped" cannot get a different
 * answer from the code that decides when to stop.
 */
const BALL_LANDING = 5e-4;
/**
 * The furthest the ball may travel in one paint, whatever put it there.
 *
 * Capping the time step is not the same as capping the distance. `travel` is
 * speed-limited either way, but `settle` eases a fixed *fraction* of the gap —
 * at `CARRY_TAU` and a full frame, 29% of it. When the first man of a phase
 * picks up a ball left some way off at a stoppage, that one fraction was a
 * visible skip of over a tenth of the pitch. This bounds every path by the
 * fastest the ball is ever meant to move on purpose, so nothing outruns a shot.
 */
const BALL_MAX_FRAME_TRAVEL = BALL_SHOT_SPEED * BALL_FRAME_CAP;
/** Bounds on the measured interval between frames, ms. */
const MIN_INTERVAL = 60;
const MAX_INTERVAL = 700;
/** A gap longer than this is a pause, not a slow match; it is not measured. */
const PAUSE_GAP = 1500;
/** Phases in which nobody has the ball because play has stopped. */
const STOPPED: ReadonlySet<PlayPhase> = new Set(['STOPPAGE', 'SET_PIECE', 'RESTART', 'CELEBRATION']);

const smoothstep = (t: number): number => t * t * (3 - 2 * t);

export class PitchMotion {
  private readonly nodes = new Map<string, MotionNode>();
  private readonly pos: MotionPoint = { x: 0.5, y: 0.5 };
  private ballMode: BallMode = 'LOOSE';
  private ballTarget: MotionPoint = { x: 0.5, y: 0.5 };
  private ballSpeed = BALL_PASS_SPEED;
  private holder: string | null = null;
  private phase: PlayPhase = 'BUILD_UP';
  private now = 0;
  private lastFrameAt: number | null = null;
  /** Measured ms between frames; starts at a normal-speed tick. */
  private interval = 240;
  private reducedMotion: boolean;

  constructor(opts: { reducedMotion?: boolean } = {}) {
    this.reducedMotion = opts.reducedMotion ?? false;
  }

  setReducedMotion(reduced: boolean): void { this.reducedMotion = reduced; }
  node(id: string): MotionNode | undefined { return this.nodes.get(id); }
  ids(): IterableIterator<string> { return this.nodes.keys(); }
  values(): IterableIterator<MotionNode> { return this.nodes.values(); }
  entries(): IterableIterator<[string, MotionNode]> { return this.nodes.entries(); }
  holderId(): string | null { return this.holder; }
  /** The live ball position, for the painter. Not to be mutated. */
  ballPoint(): MotionPoint { return this.pos; }
  ball(): MotionPoint { return { x: this.pos.x, y: this.pos.y }; }
  mode(): BallMode { return this.ballMode; }
  currentPhase(): PlayPhase { return this.phase; }
  measuredInterval(): number { return this.interval; }

  /** A new simulation snapshot, at presentation time `at` (ms). */
  setFrame(frame: PitchFrame, at: number): void {
    this.now = Math.max(this.now, at);
    if (this.lastFrameAt !== null) {
      const gap = at - this.lastFrameAt;
      if (gap > 0 && gap < PAUSE_GAP) {
        // Exponential average: steady at a fixed speed, quick to follow a change.
        this.interval = Math.min(MAX_INTERVAL, Math.max(MIN_INTERVAL, this.interval * 0.6 + gap * 0.4));
      }
    }
    this.lastFrameAt = at;
    this.phase = frame.phase;

    for (const node of this.nodes.values()) node.present = false;
    for (const p of frame.players) {
      let node = this.nodes.get(p.playerId);
      if (!node) {
        // A substitute appears at his own position rather than sprinting in
        // from wherever the man he replaced was standing.
        node = {
          x: p.x, y: p.y, fromX: p.x, fromY: p.y, toX: p.x, toY: p.y,
          startAt: at, duration: 0, side: p.side, state: p.state, stamina: p.stamina,
          hasBall: p.hasBall, hx: 0, hy: 0, speed: 0, present: true, flash: 0, pressure: 0,
        };
        this.nodes.set(p.playerId, node);
      } else {
        // The next segment starts from where he is drawn, never from where the
        // last snapshot wanted him: a shirt that had not arrived does not jump.
        node.fromX = node.x;
        node.fromY = node.y;
        node.toX = p.x;
        node.toY = p.y;
        node.startAt = at;
        node.duration = this.reducedMotion ? 0 : this.interval;
        if (this.reducedMotion) { node.x = p.x; node.y = p.y; }
      }
      node.side = p.side;
      node.stamina = p.stamina;
      node.hasBall = p.hasBall;
      node.state = p.state;
      node.present = true;
    }
    for (const [id, node] of this.nodes) if (!node.present) this.nodes.delete(id);

    this.retargetBall(frame);
  }

  /**
   * Decide what the ball is doing from this frame on. Nothing here moves it;
   * `advance` does, at a bounded pace, so every transition is a journey.
   */
  /**
   * Who has the ball, as far as the picture is concerned.
   *
   * The simulator names a carrier only on some ticks; on the rest it knows
   * which side has the ball and roughly where, and its own shape model sends
   * the nearest men to it. So when no carrier is named and play is live, the
   * man drawn nearest the simulator's point is the carrier — with a little
   * loyalty, so two men close to the ball do not trade it every tick.
   */
  private impliedCarrier(frame: PitchFrame): string | null {
    if (frame.ballHolder && this.nodes.has(frame.ballHolder)) return frame.ballHolder;
    if (STOPPED.has(frame.phase)) return null;
    if (frame.ball.x === 0.5 && frame.ball.y === 0.5) return null;
    let nearest: string | null = null;
    let best = Infinity;
    for (const p of frame.players) {
      const d = Math.hypot(p.x - frame.ball.x, p.y - frame.ball.y);
      if (d < best) { best = d; nearest = p.playerId; }
    }
    if (this.holder && this.holder !== nearest) {
      const current = frame.players.find((p) => p.playerId === this.holder);
      if (current) {
        const d = Math.hypot(current.x - frame.ball.x, current.y - frame.ball.y);
        if (d < 0.12 && d < best + 0.04) return this.holder;
      }
    }
    return nearest;
  }

  private retargetBall(frame: PitchFrame): void {
    const holder = this.impliedCarrier(frame);
    const shooter = frame.players.find((p) => p.state === 'SHOOTING');

    if (holder !== null) {
      if (this.holder !== holder && this.holder !== null) {
        // A change of hands: a pass, a tackle, a keeper's catch. The ball flies
        // to the receiver; `advance` re-aims it at him every frame.
        this.ballMode = 'FLIGHT';
        this.ballSpeed = BALL_PASS_SPEED;
      } else if (this.ballMode !== 'FLIGHT' || this.holder !== holder) {
        // Same man, or the first man of a phase: it is with him.
        this.ballMode = this.ballMode === 'FLIGHT' && this.holder === holder ? 'FLIGHT' : 'CARRY';
      }
      this.holder = holder;
      if (this.reducedMotion) {
        const n = this.nodes.get(holder)!;
        this.pos.x = n.x; this.pos.y = n.y; this.ballMode = 'CARRY';
      }
      return;
    }

    // Nobody has it.
    if (frame.phase === 'SHOT' || shooter) {
      // The shot has been struck: it flies at the goal the shooter attacks.
      const side: Side = shooter?.side ?? this.nodes.get(this.holder ?? '')?.side ?? 'home';
      const goalX = side === 'home' ? 1 : 0;
      this.ballTarget = { x: goalX, y: 0.5 + (this.pos.y - 0.5) * 0.35 };
      this.ballMode = 'FLIGHT';
      this.ballSpeed = BALL_SHOT_SPEED;
      this.holder = null;
      if (this.reducedMotion) { this.pos.x = this.ballTarget.x; this.pos.y = this.ballTarget.y; }
      return;
    }
    if (STOPPED.has(frame.phase) || (frame.ball.x === 0.5 && frame.ball.y === 0.5)) {
      // Play has stopped, or the simulator only knows "no possession": the ball
      // stays where play stopped. The restart will fly it to whoever takes it.
      this.ballMode = 'LOOSE';
      this.ballTarget = { x: this.pos.x, y: this.pos.y };
      this.holder = null;
      return;
    }
    // A loose ball somewhere the simulator can name: drift there.
    this.ballMode = 'LOOSE';
    this.ballTarget = { x: frame.ball.x, y: frame.ball.y };
    this.holder = null;
    if (this.reducedMotion) { this.pos.x = frame.ball.x; this.pos.y = frame.ball.y; }
  }

  /** Move everything to presentation time `at` (ms). Returns true if anything moved. */
  advance(at: number): boolean {
    const dtMs = Math.max(0, at - this.now);
    this.now = at;
    const dt = Math.min(0.1, dtMs / 1000);
    if (this.reducedMotion || dtMs === 0) return false;
    let moved = false;

    const hk = 1 - Math.exp(-dt / 0.34);
    for (const node of this.nodes.values()) {
      const t = node.duration <= 0 ? 1 : Math.min(1, (at - node.startAt) / node.duration);
      const e = smoothstep(t);
      const nx = node.fromX + (node.toX - node.fromX) * e;
      const ny = node.fromY + (node.toY - node.fromY) * e;
      const stepX = nx - node.x;
      const stepY = ny - node.y;
      node.x = nx;
      node.y = ny;
      // Speed always decays, so a stopped man's motion streak fades out. His
      // heading does not: it is only meaningful while he is moving, and letting
      // it decay toward zero meant `carryTarget` eventually saw a heading below
      // its epsilon and moved the ball's resting place by CARRY_LEAD — a pitch
      // that had been still for three seconds starting to twitch on its own.
      node.speed += (Math.hypot(stepX, stepY) / Math.max(dt, 1e-4) - node.speed) * hk;
      if (stepX === 0 && stepY === 0) continue;
      moved = true;
      node.hx += (stepX - node.hx) * hk;
      node.hy += (stepY - node.hy) * hk;
    }

    if (this.stepBall(Math.min(dt, BALL_FRAME_CAP))) moved = true;
    return moved;
  }

  /** Where the ball belongs when a man has it: just ahead of him, on his heading. */
  private carryTarget(carrier: MotionNode): MotionPoint {
    const lead = Math.hypot(carrier.hx, carrier.hy);
    return lead > 1e-6
      ? { x: carrier.x + (carrier.hx / lead) * CARRY_LEAD, y: carrier.y + (carrier.hy / lead) * CARRY_LEAD }
      : { x: carrier.x, y: carrier.y };
  }

  private stepBall(dt: number): boolean {
    const before = { x: this.pos.x, y: this.pos.y };
    if (this.ballMode === 'CARRY' || (this.ballMode === 'FLIGHT' && this.holder !== null)) {
      const carrier = this.holder ? this.nodes.get(this.holder) : undefined;
      if (carrier) {
        const target = this.carryTarget(carrier);
        if (this.ballMode === 'FLIGHT') {
          // In flight toward the receiver: straight at him, at pass pace, and
          // it is his once it has arrived.
          if (this.travel(target, BALL_PASS_SPEED, dt)) this.ballMode = 'CARRY';
        } else {
          this.settle(target, CARRY_TAU, dt);
        }
      }
    } else if (this.ballMode === 'FLIGHT') {
      this.travel(this.ballTarget, this.ballSpeed, dt);
    } else {
      this.settle(this.ballTarget, LOOSE_TAU, dt);
    }

    const dx = this.pos.x - before.x;
    const dy = this.pos.y - before.y;
    const step = Math.hypot(dx, dy);
    if (step > BALL_MAX_FRAME_TRAVEL) {
      const scale = BALL_MAX_FRAME_TRAVEL / step;
      this.pos.x = before.x + dx * scale;
      this.pos.y = before.y + dy * scale;
    }
    return Math.abs(this.pos.x - before.x) > 1e-7 || Math.abs(this.pos.y - before.y) > 1e-7;
  }

  /**
   * Ease the ball onto `to` with time constant `tau`, and land exactly on it
   * once close enough. Without the landing an exponential never arrives, and a
   * paused match would keep repainting a ball creeping by nothing.
   */
  private settle(to: MotionPoint, tau: number, dt: number): void {
    const dx = to.x - this.pos.x;
    const dy = to.y - this.pos.y;
    if (Math.hypot(dx, dy) < BALL_LANDING) { this.pos.x = to.x; this.pos.y = to.y; return; }
    const k = 1 - Math.exp(-dt / tau);
    this.pos.x += dx * k;
    this.pos.y += dy * k;
  }

  /** Move the ball straight at `to` at `speed`, returning true on arrival. */
  private travel(to: MotionPoint, speed: number, dt: number): boolean {
    const dx = to.x - this.pos.x;
    const dy = to.y - this.pos.y;
    const dist = Math.hypot(dx, dy);
    const step = speed * dt;
    if (dist <= step || dist < 1e-6) {
      this.pos.x = to.x;
      this.pos.y = to.y;
      return true;
    }
    this.pos.x += (dx / dist) * step;
    this.pos.y += (dy / dist) * step;
    return false;
  }

  /** Nothing left to move: every segment complete, the ball where it is going. */
  settled(): boolean {
    for (const node of this.nodes.values()) {
      if (node.duration > 0 && this.now - node.startAt < node.duration) return false;
      if (Math.abs(node.x - node.toX) > 1e-6 || Math.abs(node.y - node.toY) > 1e-6) return false;
    }
    let target = this.ballTarget;
    if (this.holder) {
      const c = this.nodes.get(this.holder);
      if (c) target = this.carryTarget(c);
    }
    return Math.hypot(this.pos.x - target.x, this.pos.y - target.y) < BALL_LANDING;
  }
}
