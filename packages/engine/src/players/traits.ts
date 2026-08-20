/**
 * Traits.
 *
 * Every trait resolves to one or more entries in TRAIT_MODIFIER_KEYS, each of
 * which is read at a specific point in the simulation. There are no flavour-only
 * traits: if a trait has no modifier, it does not ship.
 *
 * That rule was being enforced at the wrong level. Every trait had a modifier,
 * but four of the keys — `aerialThreat`, `moraleResilience`, `teammateMorale`
 * and `chemistry` — had no consumer anywhere in the engine while the player
 * profile screen labelled all four. `Aerial Threat` was therefore a completely
 * inert trait, and `Leader`, `Team Player`, `Cult Hero`, `Fragile`, `Selfish`
 * and `Mercenary` were each running on a fraction of their advertised effect.
 * All four now have match-side read sites (see `matches/model.ts` and
 * `matches/simulator.ts`); `chemistry` and `teammateMorale` additionally drive
 * dressing-room morale in `simulation/worldTick.ts`, which is a different
 * timescale rather than the same effect counted twice.
 *
 * The magnitudes below are sized so that a trait a player can read on a card is
 * a trait he can see in results. The measuring stick is a paired sweep: grant
 * one trait to every eligible player in a squad, play a thousand matches
 * against an untraited control under common random numbers, and require a
 * directional effect at |z| > 2 on some metric. A trait that cannot clear that
 * bar is either too weak to ship or is a world-side trait being asked to prove
 * itself in the wrong place.
 */

export const TRAIT_MODIFIER_KEYS = [
  'shotConversion',    // match sim: chance -> goal probability
  'bigMatchBonus',     // match sim: applied when fixture importance >= 4
  'lateGameBonus',     // match sim: applied after minute 75
  'duelWin',           // match sim: 1v1 attacking and defensive duels
  'passAccuracy',      // match sim: pass completion
  'pressResistance',   // match sim: resisting opponent high press
  'dribbleSuccess',    // match sim: carry progression
  'tackleSuccess',     // match sim: defensive actions
  'saveChance',        // match sim: goalkeeper only
  'creativity',        // match sim: chance-creation weight
  'aerialThreat',      // match sim: set pieces and crosses
  'counterThreat',     // match sim: transition attacks
  'staminaDrain',      // match sim: fatigue accumulation (lower is better)
  'injuryRisk',        // match sim + training (lower is better)
  'cardRisk',          // match sim: foul -> card escalation (lower is better)
  'developmentRate',   // training: attribute growth per cycle
  'moraleResilience',  // world: morale decay resistance
  'teammateMorale',    // world: squad-wide morale spread
  'fanAppeal',         // fans: sentiment and attendance contribution
  'commercialValue',   // economy: sponsor and merch multiplier
  'marketValue',       // transfers: valuation multiplier
  'wageDemand',        // contracts: wage expectation multiplier (higher is costlier)
  'chemistry',         // squad: cohesion contribution
] as const;
export type TraitModifierKey = (typeof TRAIT_MODIFIER_KEYS)[number];

/** Modifiers are additive deltas around 0. A value of 0.12 = +12% at the read site. */
export type TraitModifiers = Partial<Record<TraitModifierKey, number>>;

export interface TraitDefinition {
  readonly id: string;
  readonly name: string;
  /** One line the player reads on a card. Must describe the actual effect. */
  readonly blurb: string;
  readonly kind: 'positive' | 'mixed' | 'negative';
  readonly modifiers: TraitModifiers;
  /** Restrict to positions where the trait makes sense; empty = any. */
  readonly positions?: readonly string[];
  /** Relative frequency when generating players. */
  readonly rarity: number;
  /** Conditional traits only apply when the predicate label is satisfied by the sim. */
  readonly conditions?: readonly ('BIG_MATCH' | 'LOSING' | 'LATE_GAME' | 'DERBY' | 'HOME' | 'YOUNG' | 'VETERAN')[];
}

export const TRAITS: readonly TraitDefinition[] = [
  { id: 'clutch', name: 'Clutch', blurb: 'Raises his level when the game is on the line.', kind: 'positive', rarity: 0.05,
    modifiers: { lateGameBonus: 0.2, shotConversion: 0.12 }, conditions: ['LATE_GAME'] },
  { id: 'big_game', name: 'Big Game Player', blurb: 'Turns up in the fixtures that matter most.', kind: 'positive', rarity: 0.05,
    modifiers: { bigMatchBonus: 0.2, duelWin: 0.06 }, conditions: ['BIG_MATCH', 'DERBY'] },
  { id: 'natural_finisher', name: 'Natural Finisher', blurb: 'Converts half-chances other strikers waste.', kind: 'positive', rarity: 0.07,
    modifiers: { shotConversion: 0.2 }, positions: ['ST', 'LW', 'RW', 'CAM'] },
  { id: 'playmaker', name: 'Playmaker', blurb: 'The team creates through him.', kind: 'positive', rarity: 0.07,
    modifiers: { creativity: 0.26, passAccuracy: 0.08 }, positions: ['CAM', 'CM', 'CDM'] },
  { id: 'press_resistant', name: 'Press Resistant', blurb: 'Barely notices pressure in tight areas.', kind: 'positive', rarity: 0.08,
    modifiers: { pressResistance: 0.24, dribbleSuccess: 0.08 } },
  { id: 'speedster', name: 'Speedster', blurb: 'Runs in behind and punishes a high line.', kind: 'positive', rarity: 0.08,
    modifiers: { counterThreat: 0.24, duelWin: 0.05 }, positions: ['LW', 'RW', 'ST', 'LB', 'RB'] },
  { id: 'hot_head', name: 'Hot Head', blurb: 'Plays on the edge — and sometimes over it.', kind: 'mixed', rarity: 0.09,
    modifiers: { duelWin: 0.12, cardRisk: 0.45, tackleSuccess: 0.1 } },
  { id: 'leader', name: 'Leader', blurb: 'Drags the squad with him.', kind: 'positive', rarity: 0.06,
    modifiers: { teammateMorale: 0.3, moraleResilience: 0.25, duelWin: 0.05 } },
  { id: 'showman', name: 'Showman', blurb: 'Fans buy tickets to watch him specifically.', kind: 'mixed', rarity: 0.06,
    modifiers: { fanAppeal: 0.3, commercialValue: 0.25, dribbleSuccess: 0.14, passAccuracy: -0.08 } },
  { id: 'workhorse', name: 'Workhorse', blurb: 'Covers ground long after everyone else has stopped.', kind: 'positive', rarity: 0.09,
    modifiers: { staminaDrain: -0.3, tackleSuccess: 0.08 } },
  { id: 'injury_prone', name: 'Injury Prone', blurb: 'His body keeps letting him down.', kind: 'negative', rarity: 0.08,
    modifiers: { injuryRisk: 0.6, marketValue: -0.15 } },
  { id: 'team_player', name: 'Team Player', blurb: 'Makes the players around him better.', kind: 'positive', rarity: 0.1,
    modifiers: { chemistry: 0.3, teammateMorale: 0.15, passAccuracy: 0.06 } },
  { id: 'selfish', name: 'Selfish', blurb: 'Backs himself. Always.', kind: 'mixed', rarity: 0.07,
    modifiers: { shotConversion: 0.12, creativity: -0.22, chemistry: -0.22 } },
  { id: 'late_bloomer', name: 'Late Bloomer', blurb: 'Still improving when others have peaked.', kind: 'positive', rarity: 0.05,
    modifiers: { developmentRate: 0.35, marketValue: -0.08 } },
  { id: 'veteran', name: 'Veteran', blurb: 'Reads the game before it happens.', kind: 'mixed', rarity: 0.06,
    modifiers: { pressResistance: 0.18, teammateMorale: 0.18, staminaDrain: 0.24, developmentRate: -0.4 }, conditions: ['VETERAN'] },
  { id: 'wonderkid', name: 'Wonderkid', blurb: 'Generational ceiling. Everyone knows it.', kind: 'positive', rarity: 0.02,
    modifiers: { developmentRate: 0.5, marketValue: 0.4, commercialValue: 0.2, wageDemand: 0.15 }, conditions: ['YOUNG'] },
  { id: 'cult_hero', name: 'Cult Hero', blurb: 'The terraces would riot if you sold him.', kind: 'positive', rarity: 0.04,
    modifiers: { fanAppeal: 0.35, moraleResilience: 0.3, teammateMorale: 0.16 } },
  { id: 'wall', name: 'The Wall', blurb: 'Makes saves he has no right to make.', kind: 'positive', rarity: 0.05,
    modifiers: { saveChance: 0.2 }, positions: ['GK'] },
  { id: 'sweeper_keeper', name: 'Sweeper Keeper', blurb: 'Plays as an eleventh outfielder.', kind: 'mixed', rarity: 0.05,
    modifiers: { passAccuracy: 0.2, saveChance: -0.05, pressResistance: 0.18 }, positions: ['GK'] },
  { id: 'aerial_threat', name: 'Aerial Threat', blurb: 'Unplayable in the box from a delivery.', kind: 'positive', rarity: 0.08,
    modifiers: { aerialThreat: 0.34, duelWin: 0.04 }, positions: ['CB', 'ST', 'CDM'] },
  { id: 'glass_confidence', name: 'Fragile', blurb: 'One bad week and he disappears.', kind: 'negative', rarity: 0.07,
    modifiers: { moraleResilience: -0.45, shotConversion: -0.08 } },
  { id: 'mercenary', name: 'Mercenary', blurb: 'Goes wherever the money is.', kind: 'negative', rarity: 0.06,
    modifiers: { wageDemand: 0.3, moraleResilience: 0.12, chemistry: -0.2 } },
] as const;

export const TRAIT_BY_ID: ReadonlyMap<string, TraitDefinition> = new Map(TRAITS.map((t) => [t.id, t]));

export type TraitCondition = NonNullable<TraitDefinition['conditions']>[number];

/**
 * Resolve the total modifier for a key across a set of trait ids, given the
 * conditions currently satisfied. Conditional traits contribute nothing when
 * their condition is absent — which is what makes "Clutch" feel like a moment
 * rather than a permanent stat bump.
 */
export function traitModifier(
  traitIds: readonly string[],
  key: TraitModifierKey,
  activeConditions: readonly TraitCondition[] = [],
): number {
  let total = 0;
  for (const id of traitIds) {
    const trait = TRAIT_BY_ID.get(id);
    if (!trait) continue;
    if (trait.conditions?.length) {
      const satisfied = trait.conditions.some((c) => activeConditions.includes(c));
      if (!satisfied) continue;
    }
    total += trait.modifiers[key] ?? 0;
  }
  return total;
}

/** Multiplier form: 1 + total, floored so a stack of negatives cannot invert an effect. */
export const traitMultiplier = (
  traitIds: readonly string[],
  key: TraitModifierKey,
  activeConditions: readonly TraitCondition[] = [],
): number => Math.max(0.2, 1 + traitModifier(traitIds, key, activeConditions));
