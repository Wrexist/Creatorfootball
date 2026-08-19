import type { Club } from '../clubs/club';
import type { ClubId, PlayerId } from '../core/brand';
import { clamp, clamp01 } from '../core/math';
import { hashString, type Rng } from '../core/rng';
import type { Ledger, PostContext } from '../economy/ledger';
import { facilityEffect, type FacilityRegistry } from '../facilities/facilities';
import type { GameState, ScoutAssignment, ScoutingState } from '../game/state';
import { ATTRIBUTE_KEYS, type AttributeKey } from '../players/attributes';
import type { Player, ScoutingKnowledge } from '../players/player';
import { SCOUTING_BALANCE as S } from './balance';

/**
 * Progressive-disclosure scouting.
 *
 * An unscouted player is shown as a wide band, not a number. Money and cycles
 * narrow the band; a fully scouted player shows exact values. This is the
 * cleanest competitive edge in the game: two managers looking at the same
 * transfer list are genuinely not seeing the same information, and the one who
 * paid for the deep report knows which of two similar-looking 19-year-olds is
 * the one worth buying.
 *
 * `knowledgeRange` is deliberately deterministic — no Rng. A band that jittered
 * every time the screen re-rendered would read as a bug, and would let a player
 * re-roll their way to the true value by opening and closing a panel.
 */

export type ScoutDepth = ScoutAssignment['depth'];

/**
 * The band shown for one attribute. At confidence 0 this is up to ±MAX_BAND
 * wide and deliberately off-centre — a scout's guess is biased, not merely
 * imprecise — and it collapses to the exact value at full confidence.
 */
export function knowledgeRange(p: Player, key: AttributeKey): [number, number] {
  const value = p.attributes[key];
  const knowledge = p.scouting;
  const confidence = clamp01(knowledge.confidence);

  if (confidence >= S.EXACT_CONFIDENCE || knowledge.revealed.includes(key)) {
    return [value, value];
  }

  const halfWidth = S.MAX_BAND * (1 - confidence) ** S.BAND_NARROWING_EXPONENT;
  if (halfWidth < 0.5) return [value, value];

  // Deterministic per player+attribute bias, so the same band is shown every time.
  const bias = (hashString(`scout:${p.id}:${key}`) / 0xffffffff - 0.5) * 0.8;
  const centre = value + bias * halfWidth;

  const low = Math.max(1, Math.min(value, Math.round(centre - halfWidth)));
  const high = Math.min(99, Math.max(value, Math.round(centre + halfWidth)));
  return [low, high];
}

/** Band for the hidden potential rating, which is what scouting is really for. */
export function potentialRange(p: Player): [number, number] {
  const confidence = clamp01(p.scouting.confidence);
  if (confidence >= S.EXACT_CONFIDENCE) return [p.potential, p.potential];
  // Potential stays fuzzier than current ability for longer — nobody is ever
  // certain, which is what keeps a wonderkid a gamble rather than a purchase.
  const halfWidth = S.MAX_BAND * 1.25 * (1 - confidence) ** (S.BAND_NARROWING_EXPONENT * 0.8);
  const bias = (hashString(`scoutpot:${p.id}`) / 0xffffffff - 0.5) * 0.8;
  const centre = p.potential + bias * halfWidth;
  return [
    Math.max(1, Math.min(p.potential, Math.round(centre - halfWidth))),
    Math.min(99, Math.max(p.potential, Math.round(centre + halfWidth))),
  ];
}

/** Midpoint of the band — what the UI sorts and filters by before a full report. */
export function estimatedOverall(p: Player): number {
  if (p.scouting.confidence >= S.EXACT_CONFIDENCE) return p.overall;
  const spread = ATTRIBUTE_KEYS.map((k) => knowledgeRange(p, k));
  const mid = spread.reduce((sum, [lo, hi]) => sum + (lo + hi) / 2, 0) / spread.length;
  const trueMid = ATTRIBUTE_KEYS.reduce((s, k) => s + p.attributes[k], 0) / ATTRIBUTE_KEYS.length;
  // Shift the true overall by the same bias the attribute bands carry.
  return clamp(Math.round(p.overall + (mid - trueMid)), 1, 99);
}

/** How wide the player's knowledge is overall, 0 (nothing) to 1 (certain). */
export const knowledgeConfidence = (p: Player): number => clamp01(p.scouting.confidence);

export function scoutCapacity(club: Club | undefined, registry: FacilityRegistry): number {
  if (!club) return S.BASE_CAPACITY;
  const speed = facilityEffect(club, 'scoutSpeed', registry);
  return Math.max(1, Math.round(S.BASE_CAPACITY + speed * S.CAPACITY_PER_SCOUT_SPEED));
}

export interface AssignScoutInput {
  readonly clubId: ClubId;
  readonly playerId: PlayerId;
  readonly depth: ScoutDepth;
}

export interface AssignScoutResult {
  readonly ok: boolean;
  readonly reason: string;
  readonly scouting: ScoutingState | null;
  readonly cost: number;
  readonly cycles: number;
}

/**
 * Send a scout. Costs money now, delivers information later — the delay is the
 * point, because it forces the player to decide who to look at *before* the
 * window rather than reacting once a rival has bid.
 */
export function assignScout(
  state: GameState,
  input: AssignScoutInput,
  registry: FacilityRegistry,
  ledger: Ledger,
  ctx: PostContext,
): AssignScoutResult {
  const club = state.clubs[input.clubId];
  const player = state.players[input.playerId];
  if (!player) return { ok: false, reason: 'Unknown player.', scouting: null, cost: 0, cycles: 0 };

  const scouting = state.scouting;
  if (scouting.assignments.some((a) => a.playerId === input.playerId)) {
    return { ok: false, reason: `${player.displayName} is already being watched.`, scouting: null, cost: 0, cycles: 0 };
  }

  const capacity = scoutCapacity(club, registry);
  if (scouting.assignments.length >= capacity) {
    return {
      ok: false,
      reason: `Your scouting network is at capacity (${capacity}). Upgrade it or wait for a report.`,
      scouting: null, cost: 0, cycles: 0,
    };
  }

  const cost = Math.round(S.DEPTH_COST[input.depth] ?? 0);
  if (!ledger.canAfford(input.clubId, cost)) {
    return { ok: false, reason: 'You cannot afford that report.', scouting: null, cost, cycles: 0 };
  }
  const posted = ledger.debit(input.clubId, 'SCOUTING', cost,
    `${input.depth.toLowerCase()} scouting report on ${player.displayName}`, ctx,
    { metadata: { playerId: input.playerId, depth: input.depth } });
  if (!posted.ok) return { ok: false, reason: 'Payment failed.', scouting: null, cost, cycles: 0 };

  // A better network works faster as well as more accurately.
  const speed = club ? facilityEffect(club, 'scoutSpeed', registry) : 0;
  const cycles = Math.max(1, Math.round((S.DEPTH_CYCLES[input.depth] ?? 1) / (1 + Math.max(0, speed))));

  return {
    ok: true,
    reason: `Scout assigned to ${player.displayName}. Report in ${cycles} cycle${cycles === 1 ? '' : 's'}.`,
    scouting: {
      ...scouting,
      assignments: [
        ...scouting.assignments,
        { playerId: input.playerId, cyclesRemaining: cycles, depth: input.depth, startedCycle: ctx.cycle },
      ],
    },
    cost,
    cycles,
  };
}

export interface ScoutReport {
  readonly playerId: PlayerId;
  readonly depth: ScoutDepth;
  readonly confidenceBefore: number;
  readonly confidenceAfter: number;
  readonly revealed: readonly string[];
  readonly verdict: string;
}

export interface ScoutingAdvanceResult {
  /** Only the players whose knowledge changed. */
  readonly players: Readonly<Record<string, Player>>;
  readonly scouting: ScoutingState;
  readonly reports: readonly ScoutReport[];
}

/** Which attributes a report reveals first: the ones that define the position. */
function revealOrder(p: Player, rng: Rng): AttributeKey[] {
  const ordered = ATTRIBUTE_KEYS.slice().sort(
    (a, b) => p.attributes[b] - p.attributes[a],
  );
  // A little shuffle so two reports on similar players do not read identically.
  return rng.shuffle(ordered.slice(0, 10)).concat(ordered.slice(10));
}

/**
 * Advance every live assignment by a cycle and deliver any finished reports.
 * Confidence also decays everywhere: a report from two seasons ago describes a
 * player who no longer exists.
 */
export function advanceScouting(
  state: GameState,
  rng: Rng,
  ctx: {
    readonly clubId: ClubId;
    readonly cycle: number;
    readonly registry: FacilityRegistry;
    /** Manager `scouting` attribute, 0-100. */
    readonly managerScouting: number;
  },
): ScoutingAdvanceResult {
  const stream = rng.fork(`scouting:${ctx.clubId}:${ctx.cycle}`);
  const club = state.clubs[ctx.clubId];
  const accuracy = club ? facilityEffect(club, 'scoutAccuracy', ctx.registry) : 0;
  const managerBonus = 1 + ((ctx.managerScouting - 50) / 50) * S.MANAGER_SCOUTING_SWING;

  const players: Record<string, Player> = {};
  const reports: ScoutReport[] = [];
  const remaining: ScoutAssignment[] = [];

  for (const assignment of state.scouting.assignments) {
    const next = assignment.cyclesRemaining - 1;
    if (next > 0) {
      remaining.push({ ...assignment, cyclesRemaining: next });
      continue;
    }

    const player = state.players[assignment.playerId];
    if (!player) continue;

    const target = clamp01(
      (S.DEPTH_CONFIDENCE[assignment.depth] ?? 0.3) * managerBonus * (1 + Math.max(0, accuracy)),
    );
    const before = player.scouting.confidence;
    const after = clamp01(Math.max(before, target));

    const revealCount = Math.round(
      (S.DEPTH_REVEALS[assignment.depth] ?? 0) * (1 + Math.max(0, accuracy)),
    );
    const revealed = Array.from(
      new Set([...player.scouting.revealed, ...revealOrder(player, stream).slice(0, revealCount)]),
    );

    const knowledge: ScoutingKnowledge = { confidence: after, reportCycle: ctx.cycle, revealed };
    players[player.id] = { ...player, scouting: knowledge };
    reports.push({
      playerId: player.id,
      depth: assignment.depth,
      confidenceBefore: before,
      confidenceAfter: after,
      revealed,
      verdict: verdictFor(player, after),
    });
  }

  // Slow decay on everyone we already know about.
  for (const player of Object.values(state.players)) {
    if (players[player.id]) continue;
    const conf = player.scouting.confidence;
    if (conf <= 0) continue;
    const decayed = Math.max(0, conf - S.CONFIDENCE_DECAY_PER_CYCLE);
    if (decayed === conf) continue;
    players[player.id] = { ...player, scouting: { ...player.scouting, confidence: decayed } };
  }

  return {
    players,
    scouting: { ...state.scouting, assignments: remaining },
    reports,
  };
}

/** A scout's one-line verdict. Hedged when the report is thin, blunt when it is not. */
function verdictFor(p: Player, confidence: number): string {
  const headroom = p.potential - p.overall;
  if (confidence < 0.45) {
    return headroom > 8
      ? `Raw, but there is something there. Worth another look.`
      : `Looks like what he is. We would want a longer look to be sure.`;
  }
  if (headroom >= 12) return `Genuine ceiling. Buy him before somebody else works it out.`;
  if (headroom >= 5) return `Still improving. He would be a good addition now and a better one later.`;
  if (p.age >= 31) return `Finished article, and the legs are going. Short deal only.`;
  return `He is what he is — a solid, known quantity.`;
}

export const shortlist = (scouting: ScoutingState, playerId: PlayerId): ScoutingState =>
  scouting.shortlist.includes(playerId)
    ? scouting
    : { ...scouting, shortlist: [...scouting.shortlist, playerId] };

export const unshortlist = (scouting: ScoutingState, playerId: PlayerId): ScoutingState => ({
  ...scouting,
  shortlist: scouting.shortlist.filter((id) => id !== playerId),
});
