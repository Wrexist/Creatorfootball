import type { ClubId, ObjectiveId } from '../core/brand';
import type { AnyDomainEvent } from '../core/events';
import type { GameState, Objective, ObjectiveState, RewardGrant } from '../game/state';
import type { ObjectiveTemplate } from '../content/schema';
import type { Rng } from '../core/rng';
import type { Ledger, PostContext, Transaction } from '../economy/ledger';
import { clubAccount, worldAccount } from '../economy/ledger';
import { clamp } from '../core/math';
import { points as leaguePoints } from '../clubs/club';
import type { ContentRegistryPort } from '../simulation/ports';
import { matchesConditions, renderTemplate } from '../simulation/templating';
import { objectiveKind, type ObjectiveContext, type ObjectiveKindDef } from '../objectives/kinds';
import { FALLBACK_OBJECTIVE_TEMPLATES } from '../objectives/fallbackTemplates';
import { PROGRESSION_BALANCE as P } from './balance';

/**
 * Objectives and rewards.
 *
 * Two invariants hold the whole system up:
 *  - An objective is never offered unless the current state says it can be
 *    completed, and never unless it demands something the player has not
 *    already done. Both are checked against the kind's feasible band.
 *  - A reward moves value exactly once. Every grant posts through the Ledger
 *    with an idempotency key derived from the save and the objective, so a
 *    double-claim is rejected by the ledger itself rather than by a flag we
 *    might forget to check.
 */

function buildContext(state: GameState): ObjectiveContext {
  const clubId = state.playerClubId;
  const club = state.clubs[clubId];
  const season = state.seasons[state.currentSeasonId];
  const clubCount = Object.keys(state.clubs).length;
  const remainingMatches = Math.max(0, (season?.totalWeeks ?? 0) - (season?.currentWeek ?? 0));
  const table = Object.values(state.clubs)
    .map((c) => ({ id: c.id, pts: leaguePoints(c.seasonRecord) }))
    .sort((a, b) => b.pts - a.pts);
  const index = table.findIndex((row) => row.id === clubId);
  const squad = club ? club.squad.map((id) => state.players[id]).filter((p) => !!p) : [];
  const squadAverage = squad.length > 0
    ? squad.reduce((total, p) => total + (p?.overall ?? 0), 0) / squad.length
    : 50;
  const leagueAverage = Object.values(state.clubs).length > 0
    ? Object.values(state.clubs).reduce((total, c) => total + c.reputation, 0) / Object.values(state.clubs).length
    : 50;
  // A rough, honest estimate: better squads win more, and it is bounded so that
  // neither a superclub nor a doomed side gets an unreasonable target.
  const winRate = clamp(
    0.45 + (squadAverage - leagueAverage) * 0.012,
    P.winRateFloor,
    P.winRateCeiling,
  );
  return {
    state,
    clubId,
    remainingMatches,
    currentPosition: index < 0 ? clubCount : index + 1,
    clubCount,
    winRate,
    squadAverage,
    fanSentiment: club?.fans.sentiment ?? 50,
    followers: club?.fans.onlineFollowers ?? 0,
    balance: club ? (state.ledger.balances[`club:${club.id}`]?.CASH ?? club.finance.transferBudget) : 0,
  };
}

/** Facts the `requires` block on a template is matched against. */
function templateFacts(ctx: ObjectiveContext): Record<string, number | string | boolean> {
  const club = ctx.state.clubs[ctx.clubId];
  return {
    reputation: club?.reputation ?? 50,
    fanSentiment: ctx.fanSentiment,
    position: ctx.currentPosition,
    season: ctx.state.clock.season,
    balance: ctx.balance,
    followers: ctx.followers,
    squadSize: club?.squad.length ?? 0,
    windowOpen: ctx.state.transfers.windowOpen ? 1 : 0,
    remainingMatches: ctx.remainingMatches,
  };
}

const rawTarget = (template: ObjectiveTemplate, rng: Rng, difficulty: number): number => {
  if (typeof template.target === 'number') return template.target;
  const { min, max } = template.target;
  return Math.round(min + (max - min) * clamp(difficulty + rng.float(-0.12, 0.12), 0, 1));
};

/**
 * Clamp a template's target into what the current state can actually support.
 * Returns null when there is no honest target to ask for.
 */
function calibrateTarget(
  template: ObjectiveTemplate,
  kind: ObjectiveKindDef,
  ctx: ObjectiveContext,
  rng: Rng,
  difficulty: number,
): number | null {
  const band = kind.feasible(ctx);
  if (band.max < band.min) return null;
  const desired = rawTarget(template, rng, difficulty);
  const target = Math.round(clamp(desired, band.min, band.max));

  const current = kind.measure ? kind.measure(ctx.state, ctx.clubId) : 0;
  if (kind.lowerIsBetter) {
    // Standing targets that are already met are not objectives, they are gifts.
    if (kind.measure && current <= target) return null;
    return target;
  }
  if (kind.measure) {
    if (target <= current * (1 + P.minChallengeMargin)) return null;
    return target;
  }
  return target < 1 ? null : target;
}

function scaleRewards(
  template: ObjectiveTemplate,
  target: number,
  kind: ObjectiveKindDef,
  ctx: ObjectiveContext,
): RewardGrant[] {
  const band = kind.feasible(ctx);
  const span = Math.max(1, band.max - band.min);
  const stretch = clamp((target - band.min) / span, 0, 1);
  const importanceScale = P.rewardImportanceScale[clamp(template.importance, 1, 5)] ?? 1;
  const multiplier = importanceScale * (1 + stretch * P.rewardStretchScale);
  return template.rewards.map((reward) => ({
    kind: reward.kind as RewardGrant['kind'],
    amount: reward.kind === 'CASH' || reward.kind === 'PREMIUM'
      ? Math.round(reward.amount * multiplier)
      : reward.amount,
    ...(reward.ref ? { ref: reward.ref } : {}),
    label: reward.label,
  }));
}

/**
 * Roll a fresh set of objectives against the current state.
 *
 * Mixes sources and importances deliberately: a season target the whole run
 * hangs on, a couple of near-term dynamic goals, and something commercial or
 * fan-facing so progression is not purely about results.
 */
export function rollObjectives(
  state: GameState,
  rng: Rng,
  registry: ContentRegistryPort | null,
): Objective[] {
  const ctx = buildContext(state);
  const facts = templateFacts(ctx);
  const difficulty = P.difficultyBand[state.settings.difficulty] ?? 0.55;
  const packTemplates = registry?.objectives() ?? [];
  const templates = packTemplates.length > 0 ? packTemplates : FALLBACK_OBJECTIVE_TEMPLATES;

  const activeIds = new Set(state.objectives.active.map((o) => o.id.split('#')[0]));
  const seasonActive = state.objectives.seasonTargets.filter((o) => o.status === 'ACTIVE');

  interface Candidate { template: ObjectiveTemplate; kind: ObjectiveKindDef; target: number }
  const candidates: Candidate[] = [];
  for (const template of templates) {
    const kind = objectiveKind(template.kind);
    if (!kind) continue;
    if (activeIds.has(`obj_${template.id}`)) continue;
    if (!matchesConditions(template.requires as Record<string, number | string> | undefined, facts)) continue;
    const target = calibrateTarget(template, kind, ctx, rng.fork(`obj:${template.id}`), difficulty);
    if (target === null) continue;
    candidates.push({ template, kind, target });
  }
  if (candidates.length === 0) return [];

  const chosen: Candidate[] = [];
  const takeFrom = (pool: Candidate[], n: number): void => {
    const remaining = pool.filter((c) => !chosen.includes(c));
    for (let i = 0; i < n && remaining.length > 0; i++) {
      const pick = rng.weighted(remaining, (c) => Math.max(1, c.template.weight));
      remaining.splice(remaining.indexOf(pick), 1);
      chosen.push(pick);
    }
  };

  const bySource = (source: string): Candidate[] => candidates.filter((c) => c.template.source === source);
  const seasonSlots = Math.max(0, P.maxSeasonTargets - seasonActive.length);
  takeFrom(bySource('SEASON'), seasonSlots);
  const dynamicSlots = Math.max(0, P.maxActive - state.objectives.active.length);
  takeFrom(bySource('DYNAMIC'), Math.max(1, Math.ceil(dynamicSlots * 0.6)));
  takeFrom([...bySource('BOARD'), ...bySource('FANS'), ...bySource('SPONSOR')], Math.floor(dynamicSlots * 0.4));
  // Guarantee at least one headline objective so the set never reads as chores.
  if (!chosen.some((c) => c.template.importance >= P.headlineImportance)) {
    takeFrom(candidates.filter((c) => c.template.importance >= P.headlineImportance), 1);
  }
  if (chosen.length === 0) takeFrom(candidates, 1);

  const cycle = state.clock.cycle;
  return chosen.map((candidate) => {
    const tokens = { target: candidate.target, club: state.clubs[ctx.clubId]?.name ?? 'the club' };
    const title = renderTemplate(candidate.template.title, tokens) ?? candidate.template.title;
    const description = renderTemplate(candidate.template.description, tokens) ?? candidate.template.description;
    const progress = candidate.kind.measure ? candidate.kind.measure(state, ctx.clubId) : 0;
    return {
      id: `obj_${candidate.template.id}#${cycle}`,
      title,
      description,
      kind: candidate.template.kind,
      target: candidate.target,
      progress,
      rewards: scaleRewards(candidate.template, candidate.target, candidate.kind, ctx),
      expiresCycle: candidate.template.durationCycles === null ? null : cycle + candidate.template.durationCycles,
      status: 'ACTIVE' as const,
      source: candidate.template.source as Objective['source'],
      importance: clamp(candidate.template.importance, 1, 5) as Objective['importance'],
    };
  });
}

export interface ObjectiveUpdate {
  readonly objectiveId: string;
  readonly from: number;
  readonly to: number;
  readonly target: number;
  readonly status: Objective['status'];
  readonly justCompleted: boolean;
  readonly justFailed: boolean;
}

/**
 * Fold this cycle's events into objective progress. Reads events only — an
 * objective can never advance from a state change nobody announced.
 */
export function updateObjectiveProgress(
  state: GameState,
  events: readonly AnyDomainEvent[],
): ObjectiveUpdate[] {
  const clubId = state.playerClubId;
  const cycle = state.clock.cycle;
  const updates: ObjectiveUpdate[] = [];
  const all = [...state.objectives.seasonTargets, ...state.objectives.active];

  for (const objective of all) {
    if (objective.status !== 'ACTIVE') continue;
    const kind = objectiveKind(objective.kind);
    if (!kind) continue;
    const from = objective.progress;
    let to = from;
    if (kind.measure) {
      to = kind.measure(state, clubId);
    } else if (kind.progress) {
      for (const event of events) to += kind.progress(event, clubId);
    }

    const met = kind.lowerIsBetter ? to <= objective.target : to >= objective.target;
    const expired = objective.expiresCycle !== null && cycle >= objective.expiresCycle;
    // A "lower is better" objective is only won at the deadline; until then it
    // can still be broken, so it stays active.
    const completed = kind.lowerIsBetter ? met && expired : met;
    const failed = !completed && expired;

    updates.push({
      objectiveId: objective.id,
      from,
      to,
      target: objective.target,
      status: completed ? 'COMPLETED' : failed ? 'FAILED' : 'ACTIVE',
      justCompleted: completed,
      justFailed: failed,
    });
  }
  return updates;
}

/** Apply updates to the objective state, returning a new ObjectiveState. */
export function applyObjectiveUpdates(
  state: GameState,
  updates: readonly ObjectiveUpdate[],
): ObjectiveState {
  const byId = new Map(updates.map((u) => [u.objectiveId, u]));
  const apply = (objective: Objective): Objective => {
    const update = byId.get(objective.id);
    if (!update) return objective;
    return { ...objective, progress: update.to, status: update.status };
  };
  const active = state.objectives.active.map(apply);
  const seasonTargets = state.objectives.seasonTargets.map(apply);
  const finished = active.filter((o) => o.status === 'FAILED');
  return {
    active: active.filter((o) => o.status !== 'FAILED'),
    seasonTargets,
    completed: [...state.objectives.completed, ...finished],
  };
}

export type ClaimError = 'NOT_FOUND' | 'NOT_COMPLETE' | 'ALREADY_CLAIMED' | 'LEDGER_REJECTED';

export interface ClaimResult {
  readonly ok: boolean;
  readonly error?: ClaimError;
  readonly objectiveId: string;
  readonly transactions: readonly Transaction[];
  /** Non-cash rewards for the caller to apply to inventory/reputation. */
  readonly grants: readonly RewardGrant[];
  readonly state?: GameState;
}

/**
 * Claim an objective's rewards.
 *
 * Every reward — cash, premium or otherwise — is posted through the Ledger with
 * an idempotency key. Non-cash grants post a zero-amount record so the ledger
 * still holds the single source of truth for "has this been claimed?".
 */
export function claimObjective(
  state: GameState,
  ledger: Ledger,
  id: string,
  ctx: PostContext,
): ClaimResult {
  const all = [...state.objectives.active, ...state.objectives.seasonTargets, ...state.objectives.completed];
  const objective = all.find((o) => o.id === id);
  if (!objective) return { ok: false, error: 'NOT_FOUND', objectiveId: id, transactions: [], grants: [] };
  if (objective.status === 'CLAIMED') {
    return { ok: false, error: 'ALREADY_CLAIMED', objectiveId: id, transactions: [], grants: [] };
  }
  if (objective.status !== 'COMPLETED') {
    return { ok: false, error: 'NOT_COMPLETE', objectiveId: id, transactions: [], grants: [] };
  }

  const clubId: ClubId = state.playerClubId;
  const transactions: Transaction[] = [];
  const grants: RewardGrant[] = [];
  for (let i = 0; i < objective.rewards.length; i++) {
    const reward = objective.rewards[i];
    if (!reward) continue;
    const key = `objective_reward:${state.saveId}:${objective.id}:${i}`;
    const isCurrency = reward.kind === 'CASH' || reward.kind === 'PREMIUM';
    const result = ledger.post({
      kind: 'OBJECTIVE_REWARD',
      currency: reward.kind === 'PREMIUM' ? 'PREMIUM' : 'CASH',
      amount: isCurrency ? reward.amount : 0,
      from: worldAccount('objective_reward'),
      to: clubAccount(clubId),
      memo: `${objective.title}: ${reward.label}`,
      metadata: { objectiveId: objective.id, rewardKind: reward.kind, rewardRef: reward.ref ?? '' },
      idempotencyKey: key,
    }, ctx);
    if (!result.ok) {
      // A duplicate key means this objective was already paid out. Refuse the
      // whole claim rather than paying a partial second time.
      return {
        ok: false,
        error: result.error.code === 'DUPLICATE' ? 'ALREADY_CLAIMED' : 'LEDGER_REJECTED',
        objectiveId: id,
        transactions,
        grants: [],
      };
    }
    transactions.push(result.value);
    if (!isCurrency) grants.push(reward);
  }

  const mark = (o: Objective): Objective => (o.id === id ? { ...o, status: 'CLAIMED' as const } : o);
  const claimed: Objective = { ...objective, status: 'CLAIMED' };
  const nextState: GameState = {
    ...state,
    ledger: ledger.snapshot(),
    objectives: {
      active: state.objectives.active.filter((o) => o.id !== id),
      seasonTargets: state.objectives.seasonTargets.map(mark),
      completed: [
        ...state.objectives.completed.filter((o) => o.id !== id),
        claimed,
      ],
    },
  };

  return { ok: true, objectiveId: id, transactions, grants, state: nextState };
}

/** Total cash value of an objective's rewards, for the UI summary line. */
export const rewardSummary = (objective: Objective): string =>
  objective.rewards.map((r) => r.label).join(', ');
