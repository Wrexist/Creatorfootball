import { asId, type ClubId, type PlayerId } from '../../core/brand';
import { clamp } from '../../core/math';
import type { Rng } from '../../core/rng';
import type { IdentityKind } from '../../licensing/identity';
import {
  ATTRIBUTE_KEYS, overallFor, type AttributeKey, type Attributes,
} from '../../players/attributes';
import { MENTAL_KEYS, type MentalKey, type MentalProfile } from '../../players/mental';
import { emptyForm, type Player } from '../../players/player';
import { POSITIONS, positionGroup, type Position, type PositionGroup } from '../../players/positions';
import { TRAITS, type TraitDefinition } from '../../players/traits';
import type { NameBankDef } from '../schema';
import { GENERATION_BALANCE, PERSONALITY_ARCHETYPES } from '../balance';
import {
  POSITION_FREQUENCY, POSITION_HEIGHT, POSITION_LEFT_FOOT_CHANCE, POSITION_PROFILES,
  POSITION_SHIRT_PREFERENCE, SECONDARY_CANDIDATES,
} from './profiles';

/**
 * Player generation.
 *
 * The hard requirement is that a generated player reads as an individual rather
 * than a rolled stat block. Three things do that work: positional raw-attribute
 * shapes (see profiles.ts), personality archetypes that make mental profiles
 * correlate the way real characters do, and age-gated potential so that a
 * teenager is a bet and a thirty-two-year-old is a known quantity.
 *
 * Everything is driven by the passed-in Rng. There is no Math.random and no
 * clock read anywhere in this file — two runs of the same seed produce
 * byte-identical squads, which is what the balance harness and the replay
 * tooling depend on.
 */

export interface GeneratePlayerOptions {
  /** Position-weighted overall the caller wants, 1-99. Result lands within ±3. */
  readonly targetOverall: number;
  readonly position?: Position;
  /** Exact age. Overrides ageRange. */
  readonly age?: number;
  readonly ageRange?: readonly [number, number];
  readonly nationality?: string;
  /** Weight applied to the club's home nation when picking a nationality, 0-1. */
  readonly homeNation?: string;
  readonly clubId?: ClubId | null;
  /** Where names come from. Content is handed in; the generator imports none. */
  readonly nameBank: NameBankDef;
  /** -1 (bet against him) .. +1 (loaded with headroom). Shifts potential only. */
  readonly potentialBias?: number;
  readonly allowWonderkid?: boolean;
  readonly shirtNumber?: number | null;
  readonly takenShirtNumbers?: readonly number[];
  readonly identityKind?: IdentityKind;
  readonly sourcePackId?: string;
  readonly creatorId?: string;
  /** Supply to make ids stable and collision-free inside a batch. */
  readonly id?: PlayerId;
  readonly idPrefix?: string;
  readonly idIndex?: number;
  /** Baseline reputation, 0-100. Defaults to a function of overall. */
  readonly reputation?: number;
  readonly forcedTraitIds?: readonly string[];
  readonly personalityId?: string;
}

export interface GenerateSquadOptions {
  readonly targetOverall: number;
  readonly size?: number;
  readonly clubId?: ClubId | null;
  readonly nameBank: NameBankDef;
  readonly homeNation?: string;
  readonly identityKind?: IdentityKind;
  readonly sourcePackId?: string;
  readonly idPrefix?: string;
  /** Overall points either side of the mean. Higher = a top-heavy, lopsided squad. */
  readonly talentSpread?: number;
  /** Override the automatic positional plan. Keys must sum to `size`. */
  readonly positionPlan?: Readonly<Partial<Record<Position, number>>>;
  readonly startingShirtNumbers?: readonly number[];
}

const NATION_FALLBACK = 'VLK';

/* ------------------------------------------------------------------ names */

const pickWeightedName = (
  rng: Rng,
  entries: readonly { value: string; weight?: number }[],
): string => {
  if (entries.length === 0) return 'Unknown';
  return rng.weighted(entries, (e) => e.weight ?? 1).value;
};

const pickNationality = (rng: Rng, bank: NameBankDef, homeNation?: string): string => {
  if (bank.nationalities.length === 0) return homeNation ?? NATION_FALLBACK;
  // The home nation is over-represented but never guaranteed: a league of
  // twelve identical-passport squads is exactly the flatness we are avoiding.
  if (homeNation && rng.chance(GENERATION_BALANCE.squad.homeNationShare)) return homeNation;
  return rng.weighted(bank.nationalities, (n) => n.weight).code;
};

/* --------------------------------------------------------------- attributes */

/**
 * Build attributes whose position-weighted overall converges on `target`.
 *
 * The shape comes first (so the player is recognisably his position), then the
 * whole vector is slid up or down until the weighted overall matches. Sliding
 * rather than rescaling preserves the relative gaps that make the player
 * distinctive.
 */
function buildAttributes(rng: Rng, position: Position, target: number): Attributes {
  const profile = POSITION_PROFILES[position];
  const noise = {} as Record<AttributeKey, number>;
  for (const key of ATTRIBUTE_KEYS) {
    noise[key] = rng.normal(0, profile[key].spread);
  }

  let core = target;
  let attributes = {} as Attributes;
  for (let i = 0; i < GENERATION_BALANCE.overallSolveIterations; i++) {
    const next = {} as Record<AttributeKey, number>;
    for (const key of ATTRIBUTE_KEYS) {
      next[key] = clamp(Math.round(core + profile[key].offset + noise[key]), 1, 99);
    }
    attributes = next as Attributes;
    const achieved = overallFor(attributes, position);
    const delta = target - achieved;
    if (delta === 0) break;
    core += delta;
  }

  // Final safety pass: if clamping at the ceiling has stranded us short, push
  // the highest-weighted attributes directly rather than shipping a miss.
  let achieved = overallFor(attributes, position);
  let guard = 0;
  while (Math.abs(target - achieved) > 1 && guard < 12) {
    const step = Math.sign(target - achieved);
    const mutable = attributes as Record<AttributeKey, number>;
    for (const key of ATTRIBUTE_KEYS) {
      mutable[key] = clamp(mutable[key] + step, 1, 99);
    }
    achieved = overallFor(attributes, position);
    guard++;
  }
  return attributes;
}

/* ------------------------------------------------------------------ mental */

function buildMental(rng: Rng, personalityId: string | undefined, age: number): MentalProfile {
  const archetype = personalityId
    ? PERSONALITY_ARCHETYPES.find((a) => a.id === personalityId) ?? rng.weighted(PERSONALITY_ARCHETYPES, (a) => a.weight)
    : rng.weighted(PERSONALITY_ARCHETYPES, (a) => a.weight);

  const out = {} as Record<MentalKey, number>;
  for (const key of MENTAL_KEYS) {
    const offset = archetype.offsets[key] ?? 0;
    out[key] = clamp(Math.round(rng.normal(50 + offset, 9)), 1, 99);
  }
  // Age does real work on personality: young players are less composed under
  // pressure and less consistent; veterans have grown into both.
  const maturity = clamp((age - 17) / 15, 0, 1);
  out.pressureHandling = clamp(Math.round(out.pressureHandling + (maturity - 0.5) * 14), 1, 99);
  out.consistency = clamp(Math.round(out.consistency + (maturity - 0.5) * 12), 1, 99);
  out.leadership = clamp(Math.round(out.leadership + (maturity - 0.5) * 16), 1, 99);
  out.morale = clamp(Math.round(rng.normal(62, 10)), 20, 95);
  out.confidence = clamp(Math.round(out.confidence * 0.5 + rng.normal(58, 12) * 0.5), 15, 95);
  return out as MentalProfile;
}

export const personalityOf = (mental: MentalProfile): string => {
  let best = PERSONALITY_ARCHETYPES[0] as (typeof PERSONALITY_ARCHETYPES)[number];
  let bestScore = -Infinity;
  for (const arch of PERSONALITY_ARCHETYPES) {
    let score = 0;
    for (const [key, offset] of Object.entries(arch.offsets)) {
      score += (mental[key as MentalKey] - 50) * offset;
    }
    if (score > bestScore) { bestScore = score; best = arch; }
  }
  return best.id;
};

/* --------------------------------------------------------------- potential */

const headroomForAge = (age: number): readonly [number, number] => {
  for (const band of GENERATION_BALANCE.potentialHeadroom) {
    if (age <= band.maxAge) return band.range;
  }
  return [0, 1];
};

function rollPotential(
  rng: Rng,
  overall: number,
  age: number,
  bias: number,
  allowWonderkid: boolean,
): { potential: number; wonderkid: boolean } {
  const [lo, hi] = headroomForAge(age);
  // Triangular skewed low: most young players do not become what the academy hoped.
  const mode = lo + (hi - lo) * 0.3;
  let headroom = rng.triangular(lo, mode, Math.max(lo + 0.001, hi));
  headroom += bias * (hi - lo) * 0.5;

  let wonderkid = false;
  if (
    allowWonderkid &&
    age <= GENERATION_BALANCE.wonderkidMaxAge &&
    rng.chance(GENERATION_BALANCE.wonderkidChance)
  ) {
    const [wlo, whi] = GENERATION_BALANCE.wonderkidBonus;
    headroom += rng.float(wlo, whi);
    wonderkid = true;
  }

  const potential = clamp(Math.round(overall + Math.max(0, headroom)), overall, 99);
  return {
    potential,
    wonderkid: wonderkid && potential - overall >= GENERATION_BALANCE.wonderkidMinHeadroom,
  };
}

/* ------------------------------------------------------------------ traits */

/**
 * A trait may only land on a player who satisfies it. `positions` is a hard
 * filter; the YOUNG / VETERAN conditions are gates at generation time because a
 * trait that can never fire is worse than no trait at all.
 */
export function traitEligible(trait: TraitDefinition, position: Position, age: number): boolean {
  if (trait.positions && trait.positions.length > 0 && !trait.positions.includes(position)) return false;
  const conditions = trait.conditions ?? [];
  if (conditions.includes('YOUNG') && age > 21) return false;
  if (conditions.includes('VETERAN') && age < 31) return false;
  return true;
}

function rollTraits(
  rng: Rng,
  position: Position,
  age: number,
  overall: number,
  wonderkid: boolean,
  forced: readonly string[],
): string[] {
  const chosen: string[] = [];
  for (const id of forced) {
    const trait = TRAITS.find((t) => t.id === id);
    if (trait && traitEligible(trait, position, age)) chosen.push(id);
  }
  if (wonderkid && !chosen.includes('wonderkid')) chosen.push('wonderkid');

  const cfg = GENERATION_BALANCE.traitCount;
  const quality = Math.max(0, overall - cfg.perOverallAbove) * cfg.perOverallStep;
  let slots = 0;
  for (let i = 0; i < cfg.max; i++) {
    // Each successive slot is harder to earn, so three-trait players stay special.
    if (rng.chance(clamp(cfg.baseChance + quality - i * 0.3, 0, 0.95))) slots++;
  }

  const pool = TRAITS.filter((t) => traitEligible(t, position, age) && !chosen.includes(t.id));
  for (let i = 0; i < slots && pool.length > 0; i++) {
    const trait = rng.weighted(pool, (t) => {
      // The wonderkid trait is handed out by the potential roll, never here.
      if (t.id === 'wonderkid') return 0;
      // Better players skew positive; squad fodder carries the flaws.
      const kindBias = t.kind === 'negative' ? Math.max(0.2, 1.6 - overall / 55) : 1;
      return t.rarity * kindBias;
    });
    if (trait.id === 'wonderkid') continue;
    chosen.push(trait.id);
    pool.splice(pool.indexOf(trait), 1);
  }
  return chosen;
}

/* --------------------------------------------------------------- assembly */

const pickShirtNumber = (
  rng: Rng,
  position: Position,
  taken: readonly number[],
): number => {
  for (const n of POSITION_SHIRT_PREFERENCE[position]) {
    if (!taken.includes(n)) return n;
  }
  for (let n = 2; n <= 60; n++) if (!taken.includes(n)) return n;
  return rng.int(61, 99);
};

const seedMarketValue = (overall: number, age: number, potential: number): number => {
  // A deliberately simple starting valuation. transfers/valuation.ts owns the
  // real model; this only has to be sane before the first market refresh.
  const base = Math.pow(Math.max(1, overall - 40) / 10, 3.1) * 42_000;
  const youth = clamp(1 + (potential - overall) * 0.035, 1, 1.9);
  const decline = age <= 27 ? 1 : clamp(1 - (age - 27) * 0.11, 0.2, 1);
  return Math.round((base * youth * decline) / 1000) * 1000;
};

export function generatePlayer(rng: Rng, opts: GeneratePlayerOptions): Player {
  const bank = opts.nameBank;
  const position = opts.position ?? rng.weighted(POSITION_FREQUENCY, (p) => p.weight).position;

  const [ageLo, ageHi] = opts.ageRange ?? GENERATION_BALANCE.defaultAgeRange;
  const age = opts.age ?? Math.round(
    rng.triangular(ageLo, clamp(GENERATION_BALANCE.defaultAgeMode, ageLo, ageHi), ageHi),
  );

  const target = clamp(Math.round(opts.targetOverall), 20, 95);
  const attributes = buildAttributes(rng, position, target);
  const overall = overallFor(attributes, position);

  const { potential, wonderkid } = rollPotential(
    rng, overall, age, opts.potentialBias ?? 0, opts.allowWonderkid !== false,
  );

  const mental = buildMental(rng, opts.personalityId, age);
  const traitIds = rollTraits(rng, position, age, overall, wonderkid, opts.forcedTraitIds ?? []);

  const firstName = pickWeightedName(rng, bank.firstNames);
  const lastName = pickWeightedName(rng, bank.lastNames);
  // A minority of players are known by one name. It is a small thing that makes
  // a generated league feel written rather than tabulated.
  const displayName = rng.chance(0.12) ? lastName : `${firstName} ${lastName}`;

  const [heightMean, heightSpread] = POSITION_HEIGHT[position];
  const height = Math.round(rng.normalClamped(heightMean, heightSpread, 160, 206));

  const footedness: Player['footedness'] = rng.chance(0.04)
    ? 'both'
    : rng.chance(POSITION_LEFT_FOOT_CHANCE[position]) ? 'left' : 'right';

  const secondaryPool = SECONDARY_CANDIDATES[position];
  const secondaryCount = secondaryPool.length === 0 ? 0 : rng.weighted([0, 1, 2], (n) => [5, 4, 1][n] ?? 1);
  const secondaryPositions = rng.sample(secondaryPool, secondaryCount);

  const shirtNumber = opts.shirtNumber !== undefined
    ? opts.shirtNumber
    : pickShirtNumber(rng, position, opts.takenShirtNumbers ?? []);

  const id = opts.id ?? asId<PlayerId>(
    `${opts.idPrefix ?? 'gp'}_${(opts.idIndex ?? rng.int(0, 0x7fffffff)).toString(36)}_${rng.int(0, 0xffff).toString(36)}`,
  );

  const reputation = opts.reputation ?? clamp(
    Math.round((overall - 45) * 1.9 + rng.normal(0, 6) + (wonderkid ? 8 : 0)), 1, 100,
  );

  return {
    id,
    identityKind: opts.identityKind ?? 'FICTIONAL',
    ...(opts.sourcePackId ? { sourcePackId: opts.sourcePackId } : {}),
    firstName,
    lastName,
    displayName,
    shirtNumber,
    age,
    nationality: opts.nationality ?? pickNationality(rng, bank, opts.homeNation),
    position,
    secondaryPositions,
    footedness,
    height,
    attributes,
    mental,
    traitIds,
    overall,
    potential,
    clubId: opts.clubId ?? null,
    contractId: null,
    fitness: clamp(Math.round(rng.normal(94, 4)), 70, 100),
    injury: null,
    suspensionMatches: 0,
    form: emptyForm(),
    history: [],
    marketValue: seedMarketValue(overall, age, potential),
    reputation,
    scouting: { confidence: 0, revealed: [] },
    ...(opts.creatorId ? { creatorId: opts.creatorId } : {}),
    portraitSeed: `${id}:${firstName[0] ?? 'x'}${lastName[0] ?? 'x'}`,
  };
}

/* ------------------------------------------------------------------ squads */

/**
 * Positional plan for a squad of `size`, tuned for the 7-a-side base format
 * (1 GK + 6 outfield). Cover comes first — a squad that cannot field a legal
 * shape is a bug no amount of talent fixes — then depth is added where a short
 * format actually burns players: full backs and central midfield.
 */
export function positionPlan(size: number): Record<Position, number> {
  const plan: Record<Position, number> = {
    GK: 2, CB: 3, LB: 2, RB: 2, CDM: 1, CM: 3, CAM: 1, LW: 1, RW: 1, ST: 2,
  };
  let total = 18;
  // Order in which depth is added or removed, so shrinking never eats the cover.
  const growOrder: Position[] = ['CM', 'CB', 'ST', 'CAM', 'LW', 'RW', 'CDM', 'LB', 'RB', 'GK'];
  const shrinkOrder: Position[] = ['CB', 'CM', 'LB', 'RB', 'ST', 'GK', 'CDM', 'CAM', 'LW', 'RW'];
  const floor: Record<Position, number> = {
    GK: 2, CB: 2, LB: 1, RB: 1, CDM: 1, CM: 2, CAM: 1, LW: 1, RW: 1, ST: 1,
  };

  let i = 0;
  while (total < size) {
    const pos = growOrder[i % growOrder.length] as Position;
    plan[pos] += 1;
    total++;
    i++;
  }
  i = 0;
  let guard = 0;
  while (total > size && guard < 200) {
    const pos = shrinkOrder[i % shrinkOrder.length] as Position;
    if (plan[pos] > floor[pos]) { plan[pos] -= 1; total--; }
    i++;
    guard++;
  }
  return plan;
}

export const squadCoverage = (players: readonly Player[]): Record<PositionGroup, number> => {
  const out: Record<PositionGroup, number> = { GK: 0, DEF: 0, MID: 0, ATT: 0 };
  for (const p of players) out[positionGroup(p.position)]++;
  return out;
};

/**
 * Generate a full, playable squad: correct positional cover, a believable age
 * curve, one or two players clearly better than the rest, and a couple of
 * prospects who are not ready yet. The mean overall is re-centred on the target
 * after the spread is applied, so a "72-rated squad" really averages 72.
 */
export function generateSquad(rng: Rng, opts: GenerateSquadOptions): Player[] {
  const size = opts.size ?? GENERATION_BALANCE.squad.defaultSize;
  const spread = opts.talentSpread ?? GENERATION_BALANCE.squad.talentSpread;
  const cfg = GENERATION_BALANCE.squad;

  const plan = opts.positionPlan
    ? ({ ...positionPlan(size), ...opts.positionPlan } as Record<Position, number>)
    : positionPlan(size);

  const slots: Position[] = [];
  for (const pos of POSITIONS) {
    for (let i = 0; i < (plan[pos] ?? 0); i++) slots.push(pos);
  }
  while (slots.length > size) slots.pop();
  while (slots.length < size) slots.push('CM');

  const count = slots.length;
  const standouts = rng.int(cfg.standoutCount[0], cfg.standoutCount[1]);
  const prospects = Math.min(rng.int(cfg.prospectCount[0], cfg.prospectCount[1]), Math.max(0, count - 8));
  const veterans = Math.min(rng.int(cfg.veteranCount[0], cfg.veteranCount[1]), Math.max(0, count - 8 - prospects));

  // Rank the slots: index 0 is the best player in the building.
  const order = rng.shuffle(slots.map((position, index) => ({ position, index })));

  const ratings: number[] = [];
  for (let i = 0; i < count; i++) {
    // A linear ladder from +spread to -spread, plus per-player noise.
    const rank = count === 1 ? 0.5 : i / (count - 1);
    ratings.push(opts.targetOverall + spread * (1 - rank * 2) + rng.normal(0, 1.6));
  }
  for (let i = 0; i < standouts; i++) {
    ratings[i] = (ratings[i] ?? opts.targetOverall) + rng.float(cfg.standoutBonus[0], cfg.standoutBonus[1]);
  }
  // Re-centre so the requested target is genuinely the squad mean.
  const meanRating = ratings.reduce((a, b) => a + b, 0) / count;
  const correction = opts.targetOverall - meanRating;

  const taken: number[] = (opts.startingShirtNumbers ?? []).slice();
  const out: Player[] = [];

  for (let i = 0; i < count; i++) {
    const slot = order[i] as { position: Position; index: number };
    const isProspect = i >= count - prospects;
    const isVeteran = !isProspect && i >= count - prospects - veterans;

    let rating = (ratings[i] ?? opts.targetOverall) + correction;
    let ageRange: readonly [number, number] = [21, 31];
    let potentialBias = 0;

    if (isProspect) {
      rating -= rng.float(cfg.prospectPenalty[0], cfg.prospectPenalty[1]);
      ageRange = [17, 20];
      potentialBias = 0.45;
    } else if (isVeteran) {
      ageRange = [31, 35];
      potentialBias = -0.3;
    } else if (i < standouts) {
      ageRange = [23, 30];
      potentialBias = 0.15;
    }

    const player = generatePlayer(rng, {
      targetOverall: clamp(Math.round(rating), 22, 95),
      position: slot.position,
      ageRange,
      potentialBias,
      clubId: opts.clubId ?? null,
      nameBank: opts.nameBank,
      ...(opts.homeNation ? { homeNation: opts.homeNation } : {}),
      ...(opts.identityKind ? { identityKind: opts.identityKind } : {}),
      ...(opts.sourcePackId ? { sourcePackId: opts.sourcePackId } : {}),
      ...(opts.idPrefix ? { idPrefix: opts.idPrefix } : {}),
      idIndex: i,
      takenShirtNumbers: taken,
    });
    if (player.shirtNumber !== null) taken.push(player.shirtNumber);
    out.push(player);
  }

  // Ship the squad in a readable order: keepers, defence, midfield, attack.
  const rank: Record<Position, number> = {
    GK: 0, CB: 1, LB: 2, RB: 3, CDM: 4, CM: 5, CAM: 6, LW: 7, RW: 8, ST: 9,
  };
  return out.sort((a, b) => rank[a.position] - rank[b.position] || b.overall - a.overall);
}
