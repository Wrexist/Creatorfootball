import type { PlayerId } from '../core/brand';
import { hashString } from '../core/rng';
import { clamp, clamp01, lerp } from '../core/math';
import type { FormationSlot } from '../tactics/tactics';
import type { PitchFrame, PitchPlayerFrame, PitchPoint, PlayPhase, Side } from './events';

/**
 * Positional layer.
 *
 * This produces the `PitchFrame`s the animated pitch renders, and it is the one
 * part of the engine whose success criterion is visual: at a glance it has to
 * look like football. It is deliberately NOT a physics simulation — no
 * velocities, no collisions, no ball flight. It is a *legibility* model:
 *
 *   - each player has an anchor from the formation,
 *   - the whole team slides up and down that anchor as a block with the ball,
 *   - the block squeezes laterally toward the ball,
 *   - everyone eases toward their target at a speed their legs justify.
 *
 * The result reads as two organised shapes moving in relation to each other,
 * which is what a viewer actually recognises as football. Nothing in here feeds
 * back into the simulation: the renderer is downstream of the model and never
 * upstream of it, so the same match can be presented as a pitch, as a broadcast
 * ticker, or as pure commentary without changing a single outcome.
 */

/** How far each line slides forward and back with the ball, in pitch units. */
const SHIFT_IN_POSSESSION: Record<FormationSlot['role'], number> = { GK: 0.16, DEF: 0.5, MID: 0.6, ATT: 0.44 };
const SHIFT_OUT_OF_POSSESSION: Record<FormationSlot['role'], number> = { GK: 0.2, DEF: 0.66, MID: 0.72, ATT: 0.52 };
/** How hard each line squeezes toward the ball's channel. */
const LATERAL_PULL: Record<FormationSlot['role'], number> = { GK: 0.22, DEF: 0.42, MID: 0.34, ATT: 0.2 };

/** Base distance a player can cover in one six-second tick, in pitch units. */
const BASE_STEP = 0.2;
/** Fraction of the remaining gap closed each tick; keeps motion smooth, not snappy. */
const EASING = 0.42;

export interface PositioningUnit {
  readonly playerId: PlayerId;
  readonly side: Side;
  readonly slot: FormationSlot;
  /** 0-100, drives both the render and how fast he can get there. */
  readonly stamina: number;
  /** 1-99; a quick player closes his gap sooner. */
  readonly pace: number;
  readonly hasBall: boolean;
  readonly teamInPossession: boolean;
  /** Set for a player receiving treatment. */
  readonly down: boolean;
}

export interface FrameInput {
  readonly tick: number;
  readonly minute: number;
  readonly phase: PlayPhase;
  /** Which side has the ball; null during a stoppage. */
  readonly possession: Side | null;
  /** 0-1 along the possessing team's attacking axis. */
  readonly zone: number;
  /** 0-1 across the pitch, in the possessing team's frame. */
  readonly channel: number;
  readonly ballHolder: PlayerId | null;
  readonly units: readonly PositioningUnit[];
  /** Set for a tick or two after a goal so the renderer can celebrate. */
  readonly celebratingSide: Side | null;
}

interface Pos { x: number; y: number }

/**
 * Holds each player's rendered position between ticks so movement is
 * continuous. Rebuilding a frame from scratch every tick would teleport
 * everybody, which reads as a spreadsheet rather than a match.
 */
export class PositionEngine {
  private positions = new Map<string, Pos>();

  /** Drop a player who has left the pitch so a returning shirt number cannot inherit his spot. */
  remove(playerId: PlayerId): void { this.positions.delete(playerId); }

  /** Place a substitute at his slot immediately rather than easing him on from the corner flag. */
  place(playerId: PlayerId, side: Side, slot: FormationSlot): void {
    this.positions.set(playerId, toAbsolute(side, slot.x, slot.y));
  }

  frame(input: FrameInput): PitchFrame {
    const ball = ballPoint(input.possession, input.zone, input.channel);
    const players: PitchPlayerFrame[] = [];

    for (const u of input.units) {
      const target = this.targetFor(u, input, ball);
      const current = this.positions.get(u.playerId) ?? toAbsolute(u.side, u.slot.x, u.slot.y);

      const next = u.down
        ? current
        : ease(current, target, stepLimit(u));
      this.positions.set(u.playerId, next);

      players.push({
        playerId: u.playerId,
        side: u.side,
        x: clamp01(next.x),
        y: clamp01(next.y),
        hasBall: u.hasBall,
        state: stateFor(u, input, current, next, ball),
        stamina: clamp(u.stamina, 0, 100),
      });
    }

    return {
      tick: input.tick,
      minute: input.minute,
      ball,
      ballHolder: input.ballHolder,
      players,
      phase: input.phase,
    };
  }

  private targetFor(u: PositioningUnit, input: FrameInput, ball: PitchPoint): Pos {
    // The man on the ball goes to the ball. Everything else is shape.
    if (u.hasBall) return { x: ball.x, y: ball.y };

    // Work in the player's own attacking frame, then mirror once at the end.
    const relBall = toRelative(u.side, ball.x, ball.y);
    const shift = u.teamInPossession ? SHIFT_IN_POSSESSION : SHIFT_OUT_OF_POSSESSION;
    const role = u.slot.role;

    let x = u.slot.x + (relBall.x - 0.5) * shift[role];
    let y = u.slot.y + (relBall.y - 0.5) * LATERAL_PULL[role];

    if (role === 'GK') {
      // The keeper's whole job here is to be between the ball and his goal.
      x = clamp(x, 0.02, 0.3);
      y = lerp(0.5, relBall.y, 0.3);
    } else {
      // A defending block compresses; an attacking one stretches.
      const compact = u.teamInPossession ? 1.04 : 0.9;
      y = 0.5 + (y - 0.5) * compact;
      x = clamp(x, 0.08, 0.97);
    }

    if (input.phase === 'SET_PIECE' && u.teamInPossession && role !== 'GK') {
      // Everyone piles into the box for a set piece; that is what makes it read as one.
      x = Math.max(x, 0.7);
      y = lerp(y, 0.5, 0.35);
    }
    if (input.phase === 'CELEBRATION') {
      x = lerp(x, relBall.x, 0.4);
      y = lerp(y, relBall.y, 0.4);
    }

    // A fixed per-player offset so the two shapes never look like a lattice.
    const jitter = personalOffset(u.playerId);
    x = clamp(x + jitter.x, 0.02, 0.98);
    y = clamp(y + jitter.y, 0.03, 0.97);

    return toAbsolute(u.side, x, y);
  }
}

/** Ball position in absolute pitch coordinates. */
export function ballPoint(possession: Side | null, zone: number, channel: number): PitchPoint {
  if (possession === null) return { x: 0.5, y: 0.5 };
  const rel = { x: clamp01(zone), y: clamp01(channel) };
  const abs = toAbsolute(possession, rel.x, rel.y);
  return { x: abs.x, y: abs.y };
}

/** Home attacks toward x = 1; away is the same shape rotated 180 degrees. */
export const toAbsolute = (side: Side, x: number, y: number): Pos =>
  side === 'home' ? { x, y } : { x: 1 - x, y: 1 - y };

export const toRelative = (side: Side, x: number, y: number): Pos =>
  side === 'home' ? { x, y } : { x: 1 - x, y: 1 - y };

function stepLimit(u: PositioningUnit): number {
  const legs = 0.62 + 0.38 * clamp01(u.pace / 99);
  const gas = 0.62 + 0.38 * clamp01(u.stamina / 100);
  return BASE_STEP * legs * gas;
}

function ease(from: Pos, to: Pos, maxStep: number): Pos {
  const dx = (to.x - from.x) * EASING;
  const dy = (to.y - from.y) * EASING;
  const dist = Math.hypot(dx, dy);
  if (dist <= maxStep || dist === 0) return { x: from.x + dx, y: from.y + dy };
  const scale = maxStep / dist;
  return { x: from.x + dx * scale, y: from.y + dy * scale };
}

function stateFor(
  u: PositioningUnit,
  input: FrameInput,
  from: Pos,
  to: Pos,
  ball: PitchPoint,
): PitchPlayerFrame['state'] {
  if (u.down) return 'DOWN';
  if (input.phase === 'CELEBRATION' && input.celebratingSide === u.side) return 'CELEBRATING';
  if (u.hasBall) return input.phase === 'SHOT' ? 'SHOOTING' : 'RUNNING';

  const distToBall = Math.hypot(to.x - ball.x, to.y - ball.y);
  if (!u.teamInPossession && distToBall < 0.13) return u.slot.role === 'GK' ? 'IDLE' : 'TACKLING';
  if (!u.teamInPossession && distToBall < 0.26) return 'PRESSING';
  if (u.teamInPossession && distToBall < 0.2) return 'RECEIVING';

  return Math.hypot(to.x - from.x, to.y - from.y) > 0.012 ? 'RUNNING' : 'IDLE';
}

/**
 * Deterministic, stable per-player nudge derived from the id. Not randomness —
 * the same player always stands in the same slightly-off-anchor spot, which is
 * what stops eleven identical dots looking like a formation diagram.
 */
function personalOffset(playerId: PlayerId): Pos {
  const h = hashString(playerId);
  const a = ((h & 0xff) / 255 - 0.5) * 0.05;
  const b = (((h >>> 8) & 0xff) / 255 - 0.5) * 0.06;
  return { x: a, y: b };
}
