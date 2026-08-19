import type { PitchFrame, PitchPlayerFrame, PlayPhase, Side } from '@cf/engine';

/**
 * The animated pitch.
 *
 * ## Why canvas and not SVG
 *
 * Fifteen shirts, a ball, a trail and a possession wash, all moving every
 * frame. In SVG that is ~18 elements whose `transform` must be written on each
 * of 60 frames — 1,080 style mutations per second, every one of which the
 * browser must reconcile against the DOM, re-evaluate for CSS, and re-raster
 * into its own composited layer. Canvas is a single element: one context, a
 * fixed sequence of immediate-mode calls, zero DOM mutation, zero layout, zero
 * style recalculation, and no per-node layer memory. On the mid-range Android
 * hardware this game has to hold 60fps on, that difference is the whole budget.
 *
 * SVG would have won if the pitch needed hit-testing per player, crisp text at
 * arbitrary zoom, or CSS theming per shirt. It needs none of those: the pitch
 * is a *display*, not a control surface.
 *
 * ## How it stays cheap
 *
 * 1. **React never re-renders for the animation.** The component subscribes to
 *    the match store outside React and hands frames straight to `setFrame`.
 * 2. **The pitch markings are rasterised once** into an offscreen canvas on
 *    resize and blitted with a single `drawImage`. Redrawing ~20 stroked paths
 *    per frame was measurably the most expensive thing in here.
 * 3. **Each shirt is a pre-rendered sprite** (disc, ring, shirt number) built
 *    once per team-and-number and blitted. `fillText` per player per frame was
 *    the second most expensive thing; there are at most 16 distinct sprites.
 * 4. **Interpolation is frame-rate independent** — an exponential approach with
 *    a time constant, not a fixed lerp factor — so a dropped frame produces
 *    slower motion, never a jump, and the renderer does not need to know the
 *    simulation's tick interval (which changes with the speed control).
 * 5. **Only the few players who need decoration get it.** Stamina arcs, the
 *    ball-holder ring and the down marker are drawn per-player only when the
 *    condition holds, so the common case is one `drawImage` per shirt.
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
}

export type PitchOrientation = 'vertical' | 'horizontal';

export interface PitchRendererOptions {
  readonly home: PitchTeamStyle;
  readonly away: PitchTeamStyle;
  /** The managed side. It always attacks up (vertical) or right (horizontal). */
  readonly playerSide: Side;
  readonly orientation: PitchOrientation;
  readonly reducedMotion: boolean;
  /** playerId -> shirt number, for the sprite cache. */
  readonly numbers: Readonly<Record<string, number>>;
  /** playerId -> true when that player is the side's goalkeeper. */
  readonly keepers: Readonly<Record<string, boolean>>;
}

interface Node {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  side: Side;
  state: PitchPlayerFrame['state'];
  stamina: number;
  hasBall: boolean;
  /** Seconds since this player last entered a punctual state, for the flash. */
  flash: number;
  present: boolean;
}

/** Pitch units per second the smoothing aims for. Tuned by eye against 7-a-side. */
const PLAYER_TAU = 0.26;
const BALL_TAU = 0.11;
const TRAIL_LENGTH = 14;

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
    // A shirt has to stay tappable-legible on a 320px-wide phone and not turn
    // into a beach ball on a 1200px desktop stage.
    this.radius = Math.max(7, Math.min(17, Math.min(w, h) * 0.032));
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
          hasBall: p.hasBall, flash: 0, present: true,
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

    if (this.opts.reducedMotion) {
      // No easing: the shape snaps to what the simulation says. The pitch still
      // conveys the whole picture, it just does not glide between ticks.
      for (const node of this.nodes.values()) { node.x = node.targetX; node.y = node.targetY; }
      this.ball.x = this.ball.targetX;
      this.ball.y = this.ball.targetY;
    }
    this.dirty = true;
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
        node.x += dx * pk;
        node.y += dy * pk;
        if (node.flash > 0) { node.flash = Math.max(0, node.flash - dt * 2.4); moving = true; }
      }
      const bdx = this.ball.targetX - this.ball.x;
      const bdy = this.ball.targetY - this.ball.y;
      if (bdx * bdx + bdy * bdy > 1e-8) moving = true;
      this.ball.x += bdx * bk;
      this.ball.y += bdy * bk;
      if (moving) this.dirty = true;

      this.pushTrail();
    }

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

  /* --- projection ---------------------------------------------------- */

  private px(x: number, y: number): number {
    const attackingHome = this.opts.playerSide === 'home';
    if (this.opts.orientation === 'vertical') {
      return (attackingHome ? y : 1 - y) * this.width;
    }
    return (attackingHome ? x : 1 - x) * this.width;
  }

  private py(x: number, y: number): number {
    const attackingHome = this.opts.playerSide === 'home';
    if (this.opts.orientation === 'vertical') {
      return (attackingHome ? 1 - x : x) * this.height;
    }
    return (attackingHome ? y : 1 - y) * this.height;
  }

  /* --- painting ------------------------------------------------------ */

  private draw(): void {
    const started = performance.now();
    const ctx = this.ctx;
    const { width: w, height: h } = this;

    if (!this.turf) this.buildTurf();
    if (this.turf) ctx.drawImage(this.turf, 0, 0, w, h);

    this.drawWash();

    if (!this.opts.reducedMotion) this.drawTrail();

    // Painter's order by screen depth so overlapping shirts stack believably.
    const ordered = [...this.nodes.entries()].sort(
      (a, b) => this.py(a[1].x, a[1].y) - this.py(b[1].x, b[1].y),
    );
    for (const [id, node] of ordered) this.drawPlayer(id, node);

    this.drawBall();

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
      ctx.lineWidth = 1 + t * 2.2;
      ctx.beginPath();
      ctx.moveTo(this.px(ax, ay), this.py(ax, ay));
      ctx.lineTo(this.px(bx, by), this.py(bx, by));
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawPlayer(id: string, node: Node): void {
    const ctx = this.ctx;
    const x = this.px(node.x, node.y);
    const y = this.py(node.x, node.y);
    const r = this.radius;

    const sprite = this.spriteFor(id, node.side);
    const size = sprite.width / this.dpr;
    ctx.save();
    if (node.state === 'DOWN') ctx.globalAlpha = 0.5;
    ctx.drawImage(sprite, x - size / 2, y - size / 2, size, size);
    ctx.restore();

    // Legs gone: an amber then red arc under the shirt. This is the single most
    // useful thing the pitch can tell a manager that the feed cannot.
    if (node.stamina < 62) {
      ctx.save();
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = node.stamina < 34 ? '#f4525a' : '#fbbf24';
      ctx.beginPath();
      const sweep = Math.PI * clamp01(node.stamina / 62);
      ctx.arc(x, y, r + 3.5, Math.PI * 0.5 - sweep / 2, Math.PI * 0.5 + sweep / 2);
      ctx.stroke();
      ctx.restore();
    }

    if (node.state === 'DOWN') {
      ctx.save();
      ctx.strokeStyle = '#f4525a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - r * 0.5, y - r * 0.5);
      ctx.lineTo(x + r * 0.5, y + r * 0.5);
      ctx.moveTo(x + r * 0.5, y - r * 0.5);
      ctx.lineTo(x - r * 0.5, y + r * 0.5);
      ctx.stroke();
      ctx.restore();
      return;
    }

    if (node.hasBall) {
      ctx.save();
      ctx.strokeStyle = '#c8ff2e';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(x, y, r + 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (node.state === 'PRESSING' && !this.opts.reducedMotion) {
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.4;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.arc(x, y, r + 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (node.flash > 0) {
      ctx.save();
      ctx.globalAlpha = node.flash * 0.7;
      ctx.strokeStyle = '#c8ff2e';
      ctx.lineWidth = 2 + node.flash * 3;
      ctx.beginPath();
      ctx.arc(x, y, r + 4 + (1 - node.flash) * 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (node.state === 'CELEBRATING') {
      ctx.save();
      ctx.strokeStyle = '#c8ff2e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, r + 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawBall(): void {
    const ctx = this.ctx;
    const x = this.px(this.ball.x, this.ball.y);
    const y = this.py(this.ball.x, this.ball.y);
    const r = Math.max(3.2, this.radius * 0.34);

    ctx.save();
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

  private spriteFor(playerId: string, side: Side): HTMLCanvasElement {
    const isKeeper = this.opts.keepers[playerId] === true;
    const number = this.opts.numbers[playerId];
    const key = `${side}:${isKeeper ? 'gk' : 'of'}:${number ?? '-'}`;
    const cached = this.sprites.get(key);
    if (cached) return cached;

    const style = side === 'home' ? this.opts.home : this.opts.away;
    const r = this.radius;
    const pad = 3;
    const size = Math.ceil((r + pad) * 2);
    const sprite = document.createElement('canvas');
    sprite.width = Math.ceil(size * this.dpr);
    sprite.height = Math.ceil(size * this.dpr);
    const c = sprite.getContext('2d');
    if (!c) return sprite;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

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

    if (number !== undefined && r >= 9) {
      c.fillStyle = ink;
      c.font = `600 ${Math.round(r * 1.05)}px ui-sans-serif, system-ui, sans-serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(String(number), cx, cy + 0.5);
    }

    this.sprites.set(key, sprite);
    return sprite;
  }

  /** Markings, rasterised once per resize. */
  private buildTurf(): void {
    const { width: w, height: h } = this;
    if (w <= 0 || h <= 0) return;
    const turf = document.createElement('canvas');
    turf.width = Math.round(w * this.dpr);
    turf.height = Math.round(h * this.dpr);
    const c = turf.getContext('2d');
    if (!c) return;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    const grass = c.createLinearGradient(0, 0, 0, h);
    grass.addColorStop(0, '#0e1c16');
    grass.addColorStop(0.5, '#0a1410');
    grass.addColorStop(1, '#0e1c16');
    c.fillStyle = grass;
    c.fillRect(0, 0, w, h);

    // Mow stripes run across the short axis; they read as a pitch instantly and
    // cost one fill each.
    const vertical = this.opts.orientation === 'vertical';
    const stripes = 9;
    c.fillStyle = 'rgba(255,255,255,0.014)';
    for (let i = 0; i < stripes; i += 2) {
      if (vertical) c.fillRect(0, (h / stripes) * i, w, h / stripes);
      else c.fillRect((w / stripes) * i, 0, w / stripes, h);
    }

    const inset = Math.min(w, h) * 0.045;
    const left = inset;
    const top = inset;
    const right = w - inset;
    const bottom = h - inset;
    const fieldW = right - left;
    const fieldH = bottom - top;

    c.strokeStyle = 'rgba(255,255,255,0.16)';
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

    const circleR = Math.min(fieldW, fieldH) * 0.13;
    c.beginPath();
    c.arc(left + fieldW / 2, top + fieldH / 2, circleR, 0, Math.PI * 2);
    c.stroke();
    c.beginPath();
    c.arc(left + fieldW / 2, top + fieldH / 2, 2.5, 0, Math.PI * 2);
    c.fillStyle = 'rgba(255,255,255,0.22)';
    c.fill();

    // Penalty and goal areas at both ends.
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
        c.fillStyle = 'rgba(255,255,255,0.1)';
        c.fillRect(cx - fieldW * 0.11, end - (sign === 1 ? 4 : 0), fieldW * 0.22, 4);
      }
    } else {
      const boxH = fieldH * 0.54;
      const boxW = fieldW * 0.14;
      const sixH = fieldH * 0.26;
      const sixW = fieldW * 0.06;
      const cy = top + fieldH / 2;
      for (const end of [left, right]) {
        const sign = end === left ? 1 : -1;
        c.strokeRect(end - (sign === 1 ? 0 : boxW), cy - boxH / 2, boxW, boxH);
        c.strokeRect(end - (sign === 1 ? 0 : sixW), cy - sixH / 2, sixW, sixH);
        c.fillStyle = 'rgba(255,255,255,0.1)';
        c.fillRect(end - (sign === 1 ? 4 : 0), cy - fieldH * 0.11, 4, fieldH * 0.22);
      }
    }

    this.turf = turf;
  }
}
