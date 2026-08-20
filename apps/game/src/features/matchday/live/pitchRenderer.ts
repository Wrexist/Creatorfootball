import type { PitchFrame, PlayPhase, Side } from '@cf/engine';
import { SeedStream } from '@/design';
import type { PitchRole } from '../shared/kit';

/**
 * The animated pitch.
 *
 * ## Why canvas and not SVG
 *
 * Fifteen shirts, a ball, a trail, ground plates, facing arrows and a
 * possession wash, all moving every frame. In SVG that is ~40 elements whose
 * `transform` must be written on each of 60 frames — thousands of style
 * mutations per second, every one of which the browser must reconcile against
 * the DOM, re-evaluate for CSS, and re-raster into its own composited layer.
 * Canvas is a single element: one context, a fixed sequence of immediate-mode
 * calls, zero DOM mutation, zero layout, zero style recalculation, and no
 * per-node layer memory. On the mid-range Android hardware this game has to
 * hold 60fps on, that difference is the whole budget.
 *
 * SVG would have won if the pitch needed hit-testing per player, crisp text at
 * arbitrary zoom, or CSS theming per shirt. It needs none of those: the pitch
 * is a *display*, not a control surface.
 *
 * ## Landscape, always
 *
 * The pitch runs left-to-right and the managed side attacks right. A portrait
 * phone is 393px wide: standing the pitch on its end leaves the *width* of a
 * football pitch — the axis that carries every idea in the sport, the shape,
 * the overload, the switch of play — squeezed into 350 points, and eleven
 * players end up stacked in a column. Laid across, the same 350 points carry
 * the length of the pitch, the short axis is the one that gets compressed, and
 * a 4-3-3 reads as a 4-3-3. `'vertical'` is retained for a caller that has a
 * genuinely tall stage; nothing in the phone layout uses it.
 *
 * ## Camera modes are presentation, not simulation
 *
 * `WIDE` frames the whole pitch; `FOLLOW` scales in and tracks the ball. Both
 * consume the identical `PitchFrame` stream — the camera is a transform applied
 * at paint time and the simulation cannot observe it. That is the entire point
 * of the renderer being decoupled from the simulator.
 *
 * ## How it stays cheap
 *
 * 1. **React never re-renders for the animation.** The component subscribes to
 *    the match store outside React and hands frames straight to `setFrame`.
 * 2. **The pitch markings are rasterised once** into an offscreen canvas on
 *    resize and blitted with a single `drawImage`. Redrawing ~24 stroked paths
 *    per frame was measurably the most expensive thing in here. The raster is
 *    built at the maximum camera scale so `FOLLOW` blits a downscale, never an
 *    upscale.
 * 3. **Each shirt is a pre-rendered sprite** (plate, disc, ring, shirt number)
 *    built once per team-role-and-number and blitted. `fillText` per player per
 *    frame was the second most expensive thing; there are at most 30 distinct
 *    sprites and they are also built at maximum camera scale.
 * 4. **Interpolation is frame-rate independent** — an exponential approach with
 *    a time constant, not a fixed lerp factor — so a dropped frame produces
 *    slower motion, never a jump, and the renderer does not need to know the
 *    simulation's tick interval (which changes with the speed control).
 * 5. **Only the few players who need decoration get it.** Stamina arcs, the
 *    ball-holder ring, the pressure ring and the down marker are drawn per
 *    player only when the condition holds, so the common case is two fills.
 * 6. **Pressure is counted once per simulation tick**, not once per frame.
 *
 * The one deliberate trade-off: positions are smoothed toward the simulation's
 * frame rather than tracked exactly. The pitch can therefore lag the event feed
 * by up to ~150ms at instant speed. That is the correct direction to be wrong —
 * a legible shape that arrives a moment late reads as football; an exact shape
 * that teleports reads as a spreadsheet.
 */

export interface PitchTeamStyle {
  readonly primary: string;
  readonly secondary: string;
  readonly outline: string;
  readonly ink: string;
  readonly keeper: string;
  readonly keeperInk: string;
  readonly plate: Readonly<Record<PitchRole, string>>;
}

export type PitchOrientation = 'vertical' | 'horizontal';

/** Full-pitch tactical framing, or a camera that tracks the ball. */
export type PitchCamera = 'WIDE' | 'FOLLOW';

export interface PitchRendererOptions {
  readonly home: PitchTeamStyle;
  readonly away: PitchTeamStyle;
  /** The managed side. It always attacks right (landscape) or up (portrait). */
  readonly playerSide: Side;
  readonly orientation: PitchOrientation;
  readonly camera: PitchCamera;
  readonly reducedMotion: boolean;
  /** playerId -> shirt number, for the sprite cache. */
  readonly numbers: Readonly<Record<string, number>>;
  /** playerId -> true when that player is the side's goalkeeper. */
  readonly keepers: Readonly<Record<string, boolean>>;
  /** playerId -> which band of the team he belongs to. */
  readonly roles: Readonly<Record<string, PitchRole>>;
}

interface Node {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  side: Side;
  state: PitchFrame['players'][number]['state'];
  stamina: number;
  hasBall: boolean;
  /** Smoothed heading, in base (screen-space) units. */
  hx: number;
  hy: number;
  /** Smoothed speed, base units per second. Drives the facing arrow's opacity. */
  speed: number;
  /** Opponents inside the pressing radius, recounted once per simulation tick. */
  pressure: number;
  /** Seconds since this player last entered a punctual state, for the flash. */
  flash: number;
  present: boolean;
}

/** Pitch units per second the smoothing aims for. Tuned by eye against 7-a-side. */
const PLAYER_TAU = 0.26;
const BALL_TAU = 0.11;
const CAMERA_TAU = 0.42;
const TRAIL_LENGTH = 14;

/** How far the follow camera scales in, and therefore how big the raster is. */
const FOLLOW_SCALE = 1.72;
const DRAMA_SCALE = 2.05;
const MAX_SCALE = DRAMA_SCALE;

/** An opponent this close to the ball carrier counts as pressure. */
const PRESSURE_RADIUS = 0.085;
const PRESSURE_RADIUS_SQ = PRESSURE_RADIUS * PRESSURE_RADIUS;

const PHASE_WASH: Record<PlayPhase, number> = {
  BUILD_UP: 0.05,
  PROGRESSION: 0.07,
  FINAL_THIRD: 0.13,
  SHOT: 0.2,
  TRANSITION: 0.11,
  PRESS: 0.12,
  SET_PIECE: 0.14,
  RESTART: 0.04,
  CELEBRATION: 0.18,
  STOPPAGE: 0.03,
};

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

export class PitchRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private opts: PitchRendererOptions;

  private width = 0;
  private height = 0;
  private dpr = 1;

  private turf: HTMLCanvasElement | null = null;
  private readonly sprites = new Map<string, HTMLCanvasElement>();
  private radius = 10;

  private readonly nodes = new Map<string, Node>();
  private ball = { x: 0.5, y: 0.5, targetX: 0.5, targetY: 0.5 };
  private trail: number[] = [];
  private trailHead = 0;

  private phase: PlayPhase = 'BUILD_UP';
  private possession: Side | null = null;
  private dirty = true;

  /* --- camera ------------------------------------------------------- */
  private camScale = 1;
  private camX = 0.5;
  private camY = 0.5;
  private drama = 0;
  private dramaTarget = 0;

  /* --- one-shot impact (a goal, a post) ------------------------------ */
  private impactEnergy = 0;
  private impactSeed = 0;

  /** Rolling draw cost, exposed for the in-app profiler overlay. */
  private drawMsTotal = 0;
  private drawFrames = 0;

  constructor(canvas: HTMLCanvasElement, opts: PitchRendererOptions) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('2D canvas context unavailable');
    this.canvas = canvas;
    this.ctx = ctx;
    this.opts = opts;
    this.trail = new Array<number>(TRAIL_LENGTH * 2).fill(0.5);
  }

  setOptions(next: Partial<PitchRendererOptions>): void {
    const orientationChanged =
      next.orientation !== undefined && next.orientation !== this.opts.orientation;
    this.opts = { ...this.opts, ...next };
    if (orientationChanged) this.turf = null;
    this.sprites.clear();
    this.dirty = true;
  }

  /**
   * Presentation-only emphasis: raises the camera and washes the edges when the
   * match reaches a moment worth leaning into. It changes nothing the simulator
   * can read.
   */
  setDrama(active: boolean): void {
    this.dramaTarget = active ? 1 : 0;
    this.dirty = true;
  }

  /**
   * A goal landing. Never called for anything smaller.
   *
   * The shake's phase is derived from the event's own id through the design
   * system's `SeedStream`, not from `Math.random()`: two people watching the
   * same match, and the same player watching it back, must see the same
   * picture. `SeedStream` is a pure hash for procedural visuals and is
   * deliberately not the engine's RNG, so drawing from it cannot perturb a
   * single thing the simulation does.
   */
  impact(key: string, strength = 1): void {
    if (this.opts.reducedMotion) return;
    this.impactEnergy = Math.max(this.impactEnergy, strength);
    this.impactSeed = new SeedStream(key).channel('impact-phase') * Math.PI * 2;
    this.dirty = true;
  }

  resize(cssWidth: number, cssHeight: number, dpr: number): void {
    const w = Math.max(1, Math.round(cssWidth));
    const h = Math.max(1, Math.round(cssHeight));
    if (w === this.width && h === this.height && dpr === this.dpr) return;
    this.width = w;
    this.height = h;
    this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // A shirt has to stay legible on a 320px-wide phone in a landscape band and
    // not turn into a beach ball on a 1200px desktop stage. The short axis of a
    // landscape pitch is small, so the radius is driven mostly by it.
    this.radius = Math.max(6.5, Math.min(15, Math.min(w * 0.5, h) * 0.055));
    this.turf = null;
    this.sprites.clear();
    this.dirty = true;
  }

  setFrame(frame: PitchFrame): void {
    this.phase = frame.phase;
    this.ball.targetX = frame.ball.x;
    this.ball.targetY = frame.ball.y;

    for (const node of this.nodes.values()) node.present = false;

    let possession: Side | null = null;
    for (const p of frame.players) {
      let node = this.nodes.get(p.playerId);
      if (!node) {
        // A substitute appears at his position rather than sprinting in from
        // wherever the shirt he replaced happened to be standing.
        node = {
          x: p.x, y: p.y, targetX: p.x, targetY: p.y,
          side: p.side, state: p.state, stamina: p.stamina,
          hasBall: p.hasBall, hx: 0, hy: 0, speed: 0, pressure: 0,
          flash: 0, present: true,
        };
        this.nodes.set(p.playerId, node);
      }
      node.targetX = p.x;
      node.targetY = p.y;
      node.side = p.side;
      node.stamina = p.stamina;
      node.hasBall = p.hasBall;
      node.present = true;
      if (p.state !== node.state) {
        node.state = p.state;
        if (p.state === 'SHOOTING' || p.state === 'TACKLING') node.flash = 1;
      }
      if (p.hasBall) possession = p.side;
    }
    this.possession = possession;

    for (const [id, node] of this.nodes) if (!node.present) this.nodes.delete(id);

    this.countPressure();

    if (this.opts.reducedMotion) {
      // No easing: the shape snaps to what the simulation says. The pitch still
      // conveys the whole picture, it just does not glide between ticks.
      for (const node of this.nodes.values()) { node.x = node.targetX; node.y = node.targetY; }
      this.ball.x = this.ball.targetX;
      this.ball.y = this.ball.targetY;
    }
    this.dirty = true;
  }

  /**
   * How many opponents are inside the pressing radius of each player whose team
   * has the ball. Recounted once per simulation tick rather than per frame: at
   * fourteen shirts that is ~100 squared distances a tick and nothing per frame.
   */
  private countPressure(): void {
    const list = [...this.nodes.values()];
    for (const node of list) node.pressure = 0;
    if (this.possession === null) return;
    for (const node of list) {
      if (node.side !== this.possession) continue;
      let count = 0;
      for (const other of list) {
        if (other.side === node.side) continue;
        const dx = other.targetX - node.targetX;
        const dy = other.targetY - node.targetY;
        if (dx * dx + dy * dy < PRESSURE_RADIUS_SQ) count += 1;
      }
      node.pressure = count;
    }
  }

  /** Advance the interpolation and paint. `dtMs` is real elapsed time. */
  tick(dtMs: number): void {
    const dt = Math.min(0.1, Math.max(0, dtMs) / 1000);

    if (!this.opts.reducedMotion && dt > 0) {
      const pk = 1 - Math.exp(-dt / PLAYER_TAU);
      const bk = 1 - Math.exp(-dt / BALL_TAU);
      let moving = false;
      for (const node of this.nodes.values()) {
        const dx = node.targetX - node.x;
        const dy = node.targetY - node.y;
        if (dx * dx + dy * dy > 1e-8) moving = true;
        const stepX = dx * pk;
        const stepY = dy * pk;
        node.x += stepX;
        node.y += stepY;
        // Heading is smoothed hard: a shirt that flickers its arrow every time
        // the simulation nudges it sideways reads as jitter, not as intent.
        const hk = 1 - Math.exp(-dt / 0.34);
        node.hx += (stepX - node.hx) * hk;
        node.hy += (stepY - node.hy) * hk;
        node.speed += (Math.hypot(stepX, stepY) / Math.max(dt, 1e-4) - node.speed) * hk;
        if (node.flash > 0) { node.flash = Math.max(0, node.flash - dt * 2.4); moving = true; }
      }
      const bdx = this.ball.targetX - this.ball.x;
      const bdy = this.ball.targetY - this.ball.y;
      if (bdx * bdx + bdy * bdy > 1e-8) moving = true;
      this.ball.x += bdx * bk;
      this.ball.y += bdy * bk;
      if (moving) this.dirty = true;

      this.pushTrail();

      if (this.impactEnergy > 0) {
        this.impactEnergy = Math.max(0, this.impactEnergy - dt * 2.6);
        this.dirty = true;
      }
    }

    if (this.stepCamera(dt)) this.dirty = true;

    // Nothing moved and nothing changed: skip the paint entirely. On a paused
    // match, or under reduced motion between ticks, this drops the renderer to
    // zero GPU work rather than repainting an identical image 60 times a second.
    if (!this.dirty) return;
    this.dirty = false;
    this.draw();
  }

  stats(): { readonly frames: number; readonly avgDrawMs: number } {
    return {
      frames: this.drawFrames,
      avgDrawMs: this.drawFrames === 0 ? 0 : this.drawMsTotal / this.drawFrames,
    };
  }

  private pushTrail(): void {
    this.trailHead = (this.trailHead + 1) % TRAIL_LENGTH;
    this.trail[this.trailHead * 2] = this.ball.x;
    this.trail[this.trailHead * 2 + 1] = this.ball.y;
  }

  /* --- camera --------------------------------------------------------- */

  /** Returns true when the camera moved enough to need a repaint. */
  private stepCamera(dt: number): boolean {
    const reduced = this.opts.reducedMotion;
    const dramaK = reduced ? 1 : 1 - Math.exp(-dt / 0.3);
    const beforeDrama = this.drama;
    this.drama += (this.dramaTarget - this.drama) * dramaK;

    const follow = this.opts.camera === 'FOLLOW';
    // Drama only pushes the camera when the camera is already the storyteller.
    // In WIDE the emphasis is carried by the wash and the vignette instead,
    // because zooming a tactical view defeats the reason it was chosen.
    const targetScale = reduced
      ? (follow ? FOLLOW_SCALE : 1)
      : follow
        ? FOLLOW_SCALE + (DRAMA_SCALE - FOLLOW_SCALE) * this.drama
        : 1;

    let targetX = 0.5;
    let targetY = 0.5;
    if (follow) {
      const base = this.base(this.ball.x, this.ball.y);
      targetX = base.x;
      targetY = base.y;
      if (reduced) {
        // Stepped rather than continuous: a panning camera is the single most
        // uncomfortable thing on this screen for a vestibular-sensitive player,
        // so with motion reduced the frame jumps between six fixed cells.
        targetX = (Math.floor(clamp01(targetX) * 3) + 0.5) / 3;
        targetY = (Math.floor(clamp01(targetY) * 2) + 0.5) / 2;
      }
    }

    const half = 0.5 / targetScale;
    targetX = clamp(targetX, half, 1 - half);
    targetY = clamp(targetY, half, 1 - half);

    const k = reduced ? 1 : 1 - Math.exp(-dt / CAMERA_TAU);
    const dx = (targetX - this.camX) * k;
    const dy = (targetY - this.camY) * k;
    const ds = (targetScale - this.camScale) * k;
    this.camX += dx;
    this.camY += dy;
    this.camScale += ds;

    return (
      Math.abs(dx) > 1e-5 || Math.abs(dy) > 1e-5 || Math.abs(ds) > 1e-5 ||
      Math.abs(this.drama - beforeDrama) > 1e-4
    );
  }

  /* --- projection ---------------------------------------------------- */

  /**
   * Pitch coordinates into camera-independent screen fractions.
   *
   * The simulation's `x` runs from a side's own goal to the opponent's and `y`
   * runs across; landscape maps `x` to the screen's long axis, which is the
   * whole point of the rotation.
   */
  private base(x: number, y: number): { x: number; y: number } {
    const attackingHome = this.opts.playerSide === 'home';
    if (this.opts.orientation === 'vertical') {
      return { x: attackingHome ? y : 1 - y, y: attackingHome ? 1 - x : x };
    }
    return { x: attackingHome ? x : 1 - x, y: attackingHome ? y : 1 - y };
  }

  private px(x: number, y: number): number {
    return (this.base(x, y).x - this.camX) * this.width * this.camScale + this.width / 2;
  }

  private py(x: number, y: number): number {
    return (this.base(x, y).y - this.camY) * this.height * this.camScale + this.height / 2;
  }

  /* --- painting ------------------------------------------------------ */

  private draw(): void {
    const started = performance.now();
    const ctx = this.ctx;
    const { width: w, height: h } = this;

    ctx.save();

    if (this.impactEnergy > 0) {
      const amp = this.impactEnergy * this.impactEnergy * 7;
      ctx.translate(
        Math.sin(this.impactSeed + this.impactEnergy * 26) * amp,
        Math.cos(this.impactSeed * 1.7 + this.impactEnergy * 31) * amp * 0.6,
      );
    }

    if (!this.turf) this.buildTurf();
    if (this.turf) {
      const dw = w * this.camScale;
      const dh = h * this.camScale;
      ctx.drawImage(this.turf, w / 2 - this.camX * dw, h / 2 - this.camY * dh, dw, dh);
    } else {
      ctx.fillStyle = '#0a1410';
      ctx.fillRect(0, 0, w, h);
    }

    this.drawWash();

    if (!this.opts.reducedMotion) this.drawTrail();

    // Painter's order by screen depth so overlapping shirts stack believably.
    const ordered = [...this.nodes.entries()].sort(
      (a, b) => this.py(a[1].x, a[1].y) - this.py(b[1].x, b[1].y),
    );
    for (const [id, node] of ordered) this.drawPlate(id, node);
    for (const [id, node] of ordered) this.drawPlayer(id, node);

    this.drawBall();

    ctx.restore();

    this.drawVignette();

    this.drawMsTotal += performance.now() - started;
    this.drawFrames += 1;
  }

  /** The possession wash: which third the ball is in, tinted by who has it. */
  private drawWash(): void {
    const alpha = PHASE_WASH[this.phase];
    if (alpha <= 0) return;
    const ctx = this.ctx;
    const style = this.possession === 'home' ? this.opts.home : this.opts.away;
    const cx = this.px(this.ball.x, this.ball.y);
    const cy = this.py(this.ball.x, this.ball.y);
    const r = Math.max(this.width, this.height) * 0.42;
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    gradient.addColorStop(0, style.primary);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save();
    ctx.globalAlpha = this.possession === null ? alpha * 0.5 : alpha;
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.restore();
  }

  /**
   * Edge treatment. Always a slight darkening so the shirts near the touchline
   * keep their contrast; during a dramatic beat it deepens and takes a volt
   * rim, which is how `WIDE` says "watch this" without moving the camera.
   */
  private drawVignette(): void {
    const ctx = this.ctx;
    const { width: w, height: h } = this;
    const strength = 0.34 + this.drama * 0.3;
    const gradient = ctx.createRadialGradient(
      w / 2, h / 2, Math.min(w, h) * 0.28,
      w / 2, h / 2, Math.max(w, h) * (0.72 - this.drama * 0.12),
    );
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, `rgba(0,0,0,${strength.toFixed(3)})`);
    ctx.save();
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
    if (this.drama > 0.02) {
      ctx.globalAlpha = this.drama * 0.5;
      ctx.strokeStyle = '#c8ff2e';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, w - 2, h - 2);
    }
    if (this.impactEnergy > 0.02) {
      ctx.globalAlpha = this.impactEnergy * 0.28;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();
  }

  private drawTrail(): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#ffffff';
    for (let i = 1; i < TRAIL_LENGTH; i += 1) {
      const a = (this.trailHead + i) % TRAIL_LENGTH;
      const b = (this.trailHead + i + 1) % TRAIL_LENGTH;
      const t = i / TRAIL_LENGTH;
      const ax = this.trail[a * 2] ?? 0.5;
      const ay = this.trail[a * 2 + 1] ?? 0.5;
      const bx = this.trail[b * 2] ?? 0.5;
      const by = this.trail[b * 2 + 1] ?? 0.5;
      ctx.globalAlpha = t * 0.28;
      ctx.lineWidth = (1 + t * 2.2) * this.camScale;
      ctx.beginPath();
      ctx.moveTo(this.px(ax, ay), this.py(ax, ay));
      ctx.lineTo(this.px(bx, by), this.py(bx, by));
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * The ground marker: a flattened ellipse on the grass under each shirt,
   * coloured by the unit that player belongs to. It does three jobs at once —
   * it seats the token on the pitch instead of floating it over the top, it
   * carries role without touching the club's colour, and it is one fill.
   */
  private drawPlate(id: string, node: Node): void {
    const ctx = this.ctx;
    const x = this.px(node.x, node.y);
    const y = this.py(node.x, node.y);
    const r = this.radius * this.camScale;
    const style = node.side === 'home' ? this.opts.home : this.opts.away;
    const role = this.roleFor(id);

    ctx.save();
    ctx.globalAlpha = node.state === 'DOWN' ? 0.22 : 0.44;
    ctx.fillStyle = style.plate[role];
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.62, r * 1.18, r * 0.46, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** Which band of the team a shirt belongs to. Keepers are their own band. */
  private roleFor(playerId: string): PitchRole {
    if (this.opts.keepers[playerId] === true) return 'GK';
    return this.opts.roles[playerId] ?? 'MID';
  }

  private drawPlayer(id: string, node: Node): void {
    const ctx = this.ctx;
    const x = this.px(node.x, node.y);
    const y = this.py(node.x, node.y);
    const scale = this.camScale;
    const r = this.radius * scale;

    // Facing: where this player is actually travelling. Drawn behind the token
    // so it reads as a wake rather than a hat.
    if (node.speed > 0.02 && node.state !== 'DOWN') {
      const len = Math.hypot(node.hx, node.hy);
      if (len > 1e-5) {
        const base = this.base(node.x, node.y);
        const ahead = this.base(node.x + node.hx * 12, node.y + node.hy * 12);
        const dx = ahead.x - base.x;
        const dy = ahead.y - base.y;
        const dl = Math.hypot(dx, dy);
        if (dl > 1e-5) {
          const ux = dx / dl;
          const uy = dy / dl;
          const strength = clamp01(node.speed / 0.28);
          ctx.save();
          ctx.globalAlpha = 0.16 + strength * 0.54;
          ctx.fillStyle = node.side === 'home' ? this.opts.home.primary : this.opts.away.primary;
          ctx.beginPath();
          const tip = r * (1.5 + strength * 0.9);
          ctx.moveTo(x + ux * tip, y + uy * tip);
          ctx.lineTo(x - uy * r * 0.42 + ux * r * 0.8, y + ux * r * 0.42 + uy * r * 0.8);
          ctx.lineTo(x + uy * r * 0.42 + ux * r * 0.8, y - ux * r * 0.42 + uy * r * 0.8);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }
    }

    const sprite = this.spriteFor(id, node);
    const size = (sprite.width / (this.dpr * MAX_SCALE)) * scale;
    ctx.save();
    if (node.state === 'DOWN') ctx.globalAlpha = 0.5;
    else if (node.stamina < 34) ctx.globalAlpha = 0.82;
    ctx.drawImage(sprite, x - size / 2, y - size / 2, size, size);
    ctx.restore();

    // Legs gone: an amber then red arc under the shirt. This is the single most
    // useful thing the pitch can tell a manager that the feed cannot.
    if (node.stamina < 62 && node.state !== 'DOWN') {
      ctx.save();
      ctx.lineWidth = 2.4 * scale;
      ctx.lineCap = 'round';
      ctx.strokeStyle = node.stamina < 34 ? '#f4525a' : '#fbbf24';
      ctx.beginPath();
      const sweep = Math.PI * clamp01(node.stamina / 62);
      ctx.arc(x, y, r + 3.4 * scale, Math.PI * 0.5 - sweep / 2, Math.PI * 0.5 + sweep / 2);
      ctx.stroke();
      ctx.restore();
    }

    if (node.state === 'DOWN') {
      ctx.save();
      ctx.strokeStyle = '#f4525a';
      ctx.lineWidth = 2 * scale;
      ctx.beginPath();
      ctx.moveTo(x - r * 0.5, y - r * 0.5);
      ctx.lineTo(x + r * 0.5, y + r * 0.5);
      ctx.moveTo(x + r * 0.5, y - r * 0.5);
      ctx.lineTo(x - r * 0.5, y + r * 0.5);
      ctx.stroke();
      ctx.restore();
      return;
    }

    // Under pressure: closing ticks around the man on the ball, one per
    // opponent inside the pressing radius. Amber at one, red once he is
    // surrounded — the manager can see trouble before the feed reports it.
    if (node.pressure > 0 && node.hasBall) {
      ctx.save();
      ctx.strokeStyle = node.pressure >= 2 ? '#f4525a' : '#fbbf24';
      ctx.lineWidth = 2 * scale;
      ctx.lineCap = 'round';
      const ticks = Math.min(4, node.pressure + 1);
      for (let i = 0; i < ticks; i += 1) {
        const angle = (Math.PI * 2 * i) / ticks - Math.PI / 2;
        ctx.beginPath();
        ctx.arc(x, y, r + 7 * scale, angle - 0.34, angle + 0.34);
        ctx.stroke();
      }
      ctx.restore();
    }

    if (node.hasBall) {
      ctx.save();
      ctx.strokeStyle = '#c8ff2e';
      ctx.lineWidth = 2.4 * scale;
      ctx.beginPath();
      ctx.arc(x, y, r + 3 * scale, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.28;
      ctx.lineWidth = 6 * scale;
      ctx.stroke();
      ctx.restore();
    }

    if (node.state === 'PRESSING' && !this.opts.reducedMotion) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.4 * scale;
      ctx.setLineDash([3 * scale, 4 * scale]);
      ctx.beginPath();
      ctx.arc(x, y, r + 6 * scale, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (node.flash > 0) {
      ctx.save();
      ctx.globalAlpha = node.flash * 0.7;
      ctx.strokeStyle = '#c8ff2e';
      ctx.lineWidth = (2 + node.flash * 3) * scale;
      ctx.beginPath();
      ctx.arc(x, y, r + (4 + (1 - node.flash) * 10) * scale, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (node.state === 'CELEBRATING') {
      ctx.save();
      ctx.strokeStyle = '#c8ff2e';
      ctx.lineWidth = 2 * scale;
      ctx.beginPath();
      ctx.arc(x, y, r + 5 * scale, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawBall(): void {
    const ctx = this.ctx;
    const x = this.px(this.ball.x, this.ball.y);
    const y = this.py(this.ball.x, this.ball.y);
    const r = Math.max(3.2, this.radius * 0.36) * this.camScale;

    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.ellipse(x, y + r * 1.5, r * 1.1, r * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  /* --- cached raster ------------------------------------------------- */

  private spriteFor(playerId: string, node: Node): HTMLCanvasElement {
    const isKeeper = this.opts.keepers[playerId] === true;
    const role = this.roleFor(playerId);
    const number = this.opts.numbers[playerId];
    const key = `${node.side}:${role}:${number ?? '-'}`;
    const cached = this.sprites.get(key);
    if (cached) return cached;

    const style = node.side === 'home' ? this.opts.home : this.opts.away;
    // Built at the maximum camera scale so the follow camera never upscales.
    const ratio = this.dpr * MAX_SCALE;
    const r = this.radius;
    const pad = 3;
    const size = Math.ceil((r + pad) * 2);
    const sprite = document.createElement('canvas');
    sprite.width = Math.ceil(size * ratio);
    sprite.height = Math.ceil(size * ratio);
    const c = sprite.getContext('2d');
    if (!c) return sprite;
    c.setTransform(ratio, 0, 0, ratio, 0, 0);

    const cx = size / 2;
    const cy = size / 2;
    const fill = isKeeper ? style.keeper : style.primary;
    const ink = isKeeper ? style.keeperInk : style.ink;

    c.beginPath();
    if (isKeeper) {
      // Keepers are rounded squares. Shape, not just colour, so the two of them
      // stay identifiable for a colour-blind player and at thumbnail size.
      const s = r * 0.92;
      c.roundRect(cx - s, cy - s, s * 2, s * 2, s * 0.42);
    } else {
      c.arc(cx, cy, r, 0, Math.PI * 2);
    }
    c.fillStyle = fill;
    c.fill();
    c.strokeStyle = style.outline;
    c.lineWidth = 2;
    c.stroke();
    c.strokeStyle = style.secondary;
    c.lineWidth = 1.2;
    c.stroke();

    if (number !== undefined && r >= 8) {
      c.fillStyle = ink;
      c.font = `700 ${Math.round(r * 1.05)}px ui-sans-serif, system-ui, sans-serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(String(number), cx, cy + 0.5);
    }

    this.sprites.set(key, sprite);
    return sprite;
  }

  /** Markings, rasterised once per resize at the maximum camera scale. */
  private buildTurf(): void {
    const { width: w, height: h } = this;
    if (w <= 0 || h <= 0) return;
    // Cap the raster so a large stage on a 2x screen cannot allocate a
    // multi-megapixel bitmap for what is a background.
    const ratio = Math.min(this.dpr * MAX_SCALE, Math.sqrt(2.2e6 / Math.max(1, w * h)));
    const turf = document.createElement('canvas');
    turf.width = Math.round(w * ratio);
    turf.height = Math.round(h * ratio);
    const c = turf.getContext('2d');
    if (!c) return;
    c.setTransform(ratio, 0, 0, ratio, 0, 0);

    const vertical = this.opts.orientation === 'vertical';

    const grass = c.createLinearGradient(0, 0, 0, h);
    grass.addColorStop(0, '#12241b');
    grass.addColorStop(0.45, '#0b1712');
    grass.addColorStop(1, '#0a1410');
    c.fillStyle = grass;
    c.fillRect(0, 0, w, h);

    // Mow stripes run across the short axis; they read as a pitch instantly and
    // cost one fill each.
    const stripes = vertical ? 9 : 13;
    c.fillStyle = 'rgba(255,255,255,0.018)';
    for (let i = 0; i < stripes; i += 2) {
      if (vertical) c.fillRect(0, (h / stripes) * i, w, h / stripes);
      else c.fillRect((w / stripes) * i, 0, w / stripes, h);
    }

    const insetX = w * (vertical ? 0.05 : 0.035);
    const insetY = h * (vertical ? 0.035 : 0.07);
    const left = insetX;
    const top = insetY;
    const right = w - insetX;
    const bottom = h - insetY;
    const fieldW = right - left;
    const fieldH = bottom - top;

    c.lineJoin = 'round';
    c.strokeStyle = 'rgba(255,255,255,0.2)';
    c.lineWidth = 1.5;
    c.strokeRect(left, top, fieldW, fieldH);

    c.beginPath();
    if (vertical) {
      c.moveTo(left, top + fieldH / 2);
      c.lineTo(right, top + fieldH / 2);
    } else {
      c.moveTo(left + fieldW / 2, top);
      c.lineTo(left + fieldW / 2, bottom);
    }
    c.stroke();

    const circleR = Math.min(fieldW, fieldH) * (vertical ? 0.13 : 0.17);
    c.beginPath();
    c.arc(left + fieldW / 2, top + fieldH / 2, circleR, 0, Math.PI * 2);
    c.stroke();
    c.beginPath();
    c.arc(left + fieldW / 2, top + fieldH / 2, 2.5, 0, Math.PI * 2);
    c.fillStyle = 'rgba(255,255,255,0.26)';
    c.fill();

    if (vertical) {
      const boxW = fieldW * 0.54;
      const boxH = fieldH * 0.14;
      const sixW = fieldW * 0.26;
      const sixH = fieldH * 0.06;
      const cx = left + fieldW / 2;
      for (const end of [top, bottom]) {
        const sign = end === top ? 1 : -1;
        c.strokeRect(cx - boxW / 2, end - (sign === 1 ? 0 : boxH), boxW, boxH);
        c.strokeRect(cx - sixW / 2, end - (sign === 1 ? 0 : sixH), sixW, sixH);
        this.drawGoal(c, cx - fieldW * 0.1, end, fieldW * 0.2, sign * 5);
      }
    } else {
      const boxH = fieldH * 0.56;
      const boxW = fieldW * 0.15;
      const sixH = fieldH * 0.26;
      const sixW = fieldW * 0.055;
      const cy = top + fieldH / 2;
      for (const end of [left, right]) {
        const sign = end === left ? 1 : -1;
        c.strokeRect(end - (sign === 1 ? 0 : boxW), cy - boxH / 2, boxW, boxH);
        c.strokeRect(end - (sign === 1 ? 0 : sixW), cy - sixH / 2, sixW, sixH);
        // Penalty spot, and the arc that makes a penalty box read as one.
        c.beginPath();
        c.arc(end + sign * boxW * 0.72, cy, 1.8, 0, Math.PI * 2);
        c.fillStyle = 'rgba(255,255,255,0.24)';
        c.fill();
        c.beginPath();
        c.arc(
          end + sign * boxW * 0.72, cy, circleR * 0.62,
          sign === 1 ? -Math.PI / 2.6 : Math.PI - Math.PI / 2.6,
          sign === 1 ? Math.PI / 2.6 : Math.PI + Math.PI / 2.6,
        );
        c.strokeStyle = 'rgba(255,255,255,0.2)';
        c.stroke();
        this.drawGoalV(c, end, cy - fieldH * 0.11, fieldH * 0.22, sign * 6);
      }
    }

    this.turf = turf;
  }

  /** A goal mouth on a horizontal end line. */
  private drawGoal(
    c: CanvasRenderingContext2D, x: number, y: number, width: number, depth: number,
  ): void {
    c.save();
    c.fillStyle = 'rgba(255,255,255,0.14)';
    c.fillRect(x, depth > 0 ? y - depth : y, width, Math.abs(depth));
    c.strokeStyle = 'rgba(255,255,255,0.42)';
    c.lineWidth = 1.6;
    c.strokeRect(x, depth > 0 ? y - depth : y, width, Math.abs(depth));
    c.restore();
  }

  /** A goal mouth on a vertical end line — the landscape pitch's own goals. */
  private drawGoalV(
    c: CanvasRenderingContext2D, x: number, y: number, height: number, depth: number,
  ): void {
    c.save();
    const left = depth > 0 ? x - depth : x;
    c.fillStyle = 'rgba(255,255,255,0.14)';
    c.fillRect(left, y, Math.abs(depth), height);
    c.strokeStyle = 'rgba(255,255,255,0.46)';
    c.lineWidth = 1.6;
    c.strokeRect(left, y, Math.abs(depth), height);
    // Netting, three lines each way. Enough to say "goal", cheap enough to
    // belong in a raster that is built once.
    c.globalAlpha = 0.32;
    c.lineWidth = 0.6;
    for (let i = 1; i < 4; i += 1) {
      const t = y + (height / 4) * i;
      c.beginPath();
      c.moveTo(left, t);
      c.lineTo(left + Math.abs(depth), t);
      c.stroke();
    }
    c.restore();
  }
}
