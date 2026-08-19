import type { Club } from '../clubs/club';
import type { FacilityDef } from '../content/schema';
import type { ClubId, FacilityId } from '../core/brand';
import { clamp } from '../core/math';
import type { Rng } from '../core/rng';
import type { Ledger, PostContext } from '../economy/ledger';
import { FACILITY_BALANCE as B } from './balance';

/**
 * Facilities.
 *
 * Every number a facility produces comes out of the content pack's
 * level-indexed `effects` map. Nothing in this file knows that the training
 * centre affects training — it only knows how to read `effects[key][level]`.
 * That is what lets a content pack add a facility, or retune one, without a
 * code change anywhere in the systems that consume it.
 *
 * In-progress builds are stored as reserved keys inside `club.facilityLevels`
 * (a frozen `Record<string, number>` with no slot of its own for projects).
 * `facilityEffect` iterates the registry rather than the record, so the
 * reserved keys are invisible to every consumer.
 */

/** The slice of the content registry facilities need. Structurally satisfied by ContentRegistry. */
export interface FacilityRegistry {
  facilities(): readonly FacilityDef[];
}

export const projectCyclesKey = (facilityId: string): string => `${B.PROJECT_CYCLES_PREFIX}${facilityId}`;
export const projectTargetKey = (facilityId: string): string => `${B.PROJECT_TARGET_PREFIX}${facilityId}`;
export const isProjectKey = (key: string): boolean =>
  key.startsWith(B.PROJECT_CYCLES_PREFIX) || key.startsWith(B.PROJECT_TARGET_PREFIX);

export const facilityLevel = (club: Club, facilityId: string): number =>
  Math.max(0, Math.floor(club.facilityLevels[facilityId] ?? 0));

function levelValue(def: FacilityDef, key: string, level: number): number {
  const table = def.effects[key];
  if (!table || table.length === 0) return 0;
  const idx = clamp(Math.floor(level), 0, table.length - 1);
  return table[idx] ?? 0;
}

/**
 * Read a named effect for a club. Contributions from every facility that
 * declares the key are summed, so a content pack can split one system's bonus
 * across two buildings if that makes for a better upgrade path.
 */
export function facilityEffect(club: Club, key: string, registry: FacilityRegistry): number {
  let total = 0;
  for (const def of registry.facilities()) {
    if (!(key in def.effects)) continue;
    total += levelValue(def, key, facilityLevel(club, def.id));
  }
  return total;
}

/** Same, but with a caller-supplied default when no facility declares the key at all. */
export function facilityEffectOr(
  club: Club,
  key: string,
  registry: FacilityRegistry,
  fallback: number,
): number {
  const declared = registry.facilities().some((d) => key in d.effects);
  return declared ? facilityEffect(club, key, registry) : fallback;
}

export interface FacilityProject {
  readonly facilityId: string;
  readonly targetLevel: number;
  readonly cyclesRemaining: number;
}

export function pendingProjects(club: Club): FacilityProject[] {
  const out: FacilityProject[] = [];
  for (const [key, value] of Object.entries(club.facilityLevels)) {
    if (!key.startsWith(B.PROJECT_CYCLES_PREFIX)) continue;
    const facilityId = key.slice(B.PROJECT_CYCLES_PREFIX.length);
    out.push({
      facilityId,
      targetLevel: club.facilityLevels[projectTargetKey(facilityId)] ?? facilityLevel(club, facilityId) + 1,
      cyclesRemaining: Math.max(0, value),
    });
  }
  return out;
}

export interface UpgradeOutcome {
  readonly ok: boolean;
  readonly reason: string;
  readonly club: Club | null;
  readonly facilityId: string;
  readonly fromLevel: number;
  readonly toLevel: number;
  readonly cost: number;
  readonly cycles: number;
  /** What the player is actually buying, in their own words. */
  readonly effectSummary: string;
}

const failure = (facilityId: string, reason: string): UpgradeOutcome => ({
  ok: false, reason, club: null, facilityId, fromLevel: 0, toLevel: 0,
  cost: 0, cycles: 0, effectSummary: '',
});

/**
 * Commission an upgrade. The money leaves immediately and the benefit arrives
 * cycles later — that gap is the decision, and it is why a club in trouble
 * cannot simply build its way out.
 */
export function upgradeFacility(
  club: Club,
  facilityId: string,
  registry: FacilityRegistry,
  ledger: Ledger,
  ctx: PostContext,
  opts: { rush?: boolean } = {},
): UpgradeOutcome {
  const def = registry.facilities().find((d) => d.id === facilityId);
  if (!def) return failure(facilityId, 'No such facility.');

  const level = facilityLevel(club, facilityId);
  if (level >= def.maxLevel) return failure(facilityId, `${def.name} is already at its maximum level.`);

  const existing = pendingProjects(club);
  if (existing.some((p) => p.facilityId === facilityId)) {
    return failure(facilityId, `${def.name} is already being worked on.`);
  }
  if (existing.length >= B.MAX_CONCURRENT_PROJECTS) {
    return failure(facilityId, 'Too many building projects are already running.');
  }

  const baseCost = def.upgradeCosts[level] ?? 0;
  const cost = Math.round(baseCost * (opts.rush ? B.RUSH_COST_MULTIPLIER : 1));
  if (!ledger.canAfford(club.id, cost)) {
    return failure(facilityId, `You cannot afford the ${cost.toLocaleString('en-GB')} this would cost.`);
  }

  const posted = ledger.debit(club.id, 'FACILITY_UPGRADE', cost,
    `${def.name} upgrade to level ${level + 1}`, ctx,
    { metadata: { facilityId, level: level + 1 } });
  if (!posted.ok) return failure(facilityId, 'The payment could not be made.');

  const cycles = opts.rush
    ? 0
    : Math.max(0, Math.round((def.upgradeCycles[level] ?? B.DEFAULT_UPGRADE_CYCLES) * B.BUILD_SPEED));

  const nextLevels: Record<string, number> = { ...club.facilityLevels };
  if (cycles === 0) {
    nextLevels[facilityId] = level + 1;
  } else {
    nextLevels[projectCyclesKey(facilityId)] = cycles;
    nextLevels[projectTargetKey(facilityId)] = level + 1;
  }

  return {
    ok: true,
    reason: cycles === 0
      ? `${def.name} upgraded immediately.`
      : `${def.name} work begins — ready in ${cycles} cycle${cycles === 1 ? '' : 's'}.`,
    club: { ...club, facilityLevels: nextLevels },
    facilityId,
    fromLevel: level,
    toLevel: level + 1,
    cost,
    cycles,
    effectSummary: def.levelEffects[level] ?? def.description,
  };
}

export interface FacilityCycleResult {
  readonly club: Club;
  readonly completed: readonly { facilityId: string; name: string; level: number }[];
  readonly upkeepPaid: number;
  readonly upkeepUnpaid: number;
  readonly degraded: readonly { facilityId: string; name: string; level: number }[];
}

/**
 * Advance building work and pay upkeep. Unpaid upkeep is not free: a facility
 * left unmaintained can lose a level, which is the long-term consequence that
 * stops "build everything, worry later" being a viable strategy.
 */
export function advanceFacilities(
  club: Club,
  registry: FacilityRegistry,
  ledger: Ledger,
  ctx: PostContext,
  rng: Rng,
): FacilityCycleResult {
  const stream = rng.fork(`facilities:${club.id}:${ctx.cycle}`);
  const defs = registry.facilities();
  const levels: Record<string, number> = { ...club.facilityLevels };
  const completed: { facilityId: string; name: string; level: number }[] = [];
  const degraded: { facilityId: string; name: string; level: number }[] = [];

  for (const project of pendingProjects(club)) {
    const def = defs.find((d) => d.id === project.facilityId);
    const remaining = project.cyclesRemaining - 1;
    if (remaining <= 0) {
      levels[project.facilityId] = project.targetLevel;
      delete levels[projectCyclesKey(project.facilityId)];
      delete levels[projectTargetKey(project.facilityId)];
      completed.push({
        facilityId: project.facilityId,
        name: def?.name ?? project.facilityId,
        level: project.targetLevel,
      });
    } else {
      levels[projectCyclesKey(project.facilityId)] = remaining;
    }
  }

  let upkeepPaid = 0;
  let upkeepUnpaid = 0;
  for (const def of defs) {
    const level = Math.max(0, Math.floor(levels[def.id] ?? 0));
    if (level <= 0) continue;
    const stated = def.upkeepPerCycle[level];
    const upkeep = Math.round(
      stated ?? (def.upgradeCosts[level - 1] ?? 0) * B.DEFAULT_UPKEEP_RATIO,
    );
    if (upkeep <= 0) continue;
    const posted = ledger.debit(club.id, 'FACILITY_UPKEEP', upkeep,
      `${def.name} upkeep (level ${level})`, ctx, { metadata: { facilityId: def.id } });
    if (posted.ok) {
      upkeepPaid += upkeep;
    } else {
      upkeepUnpaid += upkeep;
      if (stream.chance(B.DECAY_CHANCE_WHEN_UNPAID)) {
        levels[def.id] = level - 1;
        degraded.push({ facilityId: def.id, name: def.name, level: level - 1 });
      }
    }
  }

  return {
    club: { ...club, facilityLevels: levels },
    completed,
    upkeepPaid,
    upkeepUnpaid,
    degraded,
  };
}

/** Total upkeep the club is committed to per cycle, for the finance screen. */
export function totalUpkeep(club: Club, registry: FacilityRegistry): number {
  let total = 0;
  for (const def of registry.facilities()) {
    const level = facilityLevel(club, def.id);
    if (level <= 0) continue;
    total += Math.round(
      def.upkeepPerCycle[level] ?? (def.upgradeCosts[level - 1] ?? 0) * B.DEFAULT_UPKEEP_RATIO,
    );
  }
  return total;
}

/** Cost and duration of the next level, for the upgrade screen. */
export function nextUpgrade(
  club: Club,
  facilityId: string,
  registry: FacilityRegistry,
): { level: number; cost: number; cycles: number; effect: string } | null {
  const def = registry.facilities().find((d) => d.id === facilityId);
  if (!def) return null;
  const level = facilityLevel(club, facilityId);
  if (level >= def.maxLevel) return null;
  return {
    level: level + 1,
    cost: def.upgradeCosts[level] ?? 0,
    cycles: Math.round((def.upgradeCycles[level] ?? B.DEFAULT_UPGRADE_CYCLES) * B.BUILD_SPEED),
    effect: def.levelEffects[level] ?? def.description,
  };
}

/** Narrow helper so callers can key facility ids without importing brand. */
export const asFacilityId = (id: string): FacilityId => id as FacilityId;
export const clubIdOf = (club: Club): ClubId => club.id;
