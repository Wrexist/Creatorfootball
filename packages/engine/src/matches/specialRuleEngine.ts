import type { Rng } from '../core/rng';
import type { Side } from './events';
import type { ActiveSpecialRule, SpecialRuleDefinition, SpecialRuleId } from './specialRules';
import { SPECIAL_RULE_IDS } from './specialRules';
import { BALANCE } from './balance';

/**
 * Special rules.
 *
 * The most important structural idea in this format is that the rules are
 * **clock-anchored, not random**. Every half ends with a guaranteed swing
 * window in its closing minutes, announced before it arrives. Two per match.
 *
 * That does three things a random trigger cannot. It makes the rule part of the
 * competition's identity rather than a slot machine. It gives the manager
 * something to plan for — save a substitution, hold a card, decide whether to
 * chase now or wait. And it plants two designed spikes of tension inside a
 * thirty-minute session, which is exactly the shape a mobile match needs.
 *
 * Every rule here has to satisfy two tests before it ships:
 *   - it has to be plausible as a rule of a real short-format competition, not
 *     an arcade power-up; and
 *   - it has to have genuine counterplay, stated in words on the card and
 *     encoded in numbers in `opponentModifiers` or in a downside on the holder.
 * A rule you cannot play against is a bug, not a feature.
 */

const def = (d: SpecialRuleDefinition): SpecialRuleDefinition => d;

export const SPECIAL_RULE_DEFINITIONS: Readonly<Record<SpecialRuleId, SpecialRuleDefinition>> = {
  DOUBLE_GOAL: def({
    id: 'DOUBLE_GOAL',
    name: 'Double Reward',
    description: 'For the length of the window every goal scored counts twice on the scoreboard.',
    counterplay: 'It applies to both ends. One lapse and you are two behind, not one.',
    beneficiary: 'BOTH',
    durationMinutes: 3,
    earliestPhase: 0.3,
    latestPhase: 1,
    // Teams get *more* careful when a mistake costs two, so this window is
    // tighter and higher-quality rather than louder. The doubling is the effect.
    modifiers: { defensiveSolidity: 0.1, chanceQuality: 0.16, attackVolume: -0.04, volatility: 0.3 },
    goalMultiplier: 2,
    rarity: 'COMMON',
    accent: '#F5A524',
  }),
  POWER_PLAY: def({
    id: 'POWER_PLAY',
    name: 'Overload',
    description: 'Your side commits an extra body forward for the window and attacks with a spare man.',
    counterplay: 'That body comes from your own half. Lose the ball and the space behind you is enormous.',
    beneficiary: 'HOLDER',
    durationMinutes: 3,
    earliestPhase: 0.25,
    latestPhase: 1,
    modifiers: { attackVolume: 0.44, possessionBias: 0.16, chanceQuality: 0.08, spaceBehind: 0.16, defensiveSolidity: -0.1, fatigueRate: 0.15 },
    opponentModifiers: { counterWeight: 0.24, defensiveSolidity: 0.04 },
    rarity: 'COMMON',
    accent: '#38BDF8',
  }),
  LAST_STAND: def({
    id: 'LAST_STAND',
    name: 'Backs to the Wall',
    description: 'The side that is behind defends with everything and breaks at speed when it wins the ball.',
    counterplay: 'It only helps while you are losing, and it hands the opponent the ball for the whole window.',
    beneficiary: 'TRAILING',
    durationMinutes: 3,
    earliestPhase: 0.5,
    latestPhase: 1,
    modifiers: { defensiveSolidity: 0.4, counterWeight: 0.42, spaceBehind: -0.18, possessionBias: -0.2, attackVolume: -0.08, chanceQuality: 0.1, aggression: -0.12 },
    opponentModifiers: { possessionBias: 0.16, chanceQuality: -0.14 },
    rarity: 'COMMON',
    accent: '#94A3B8',
  }),
  LOCKDOWN: def({
    id: 'LOCKDOWN',
    name: 'Shutout',
    description: 'Your side drops into a compact block and refuses to be broken down for the window.',
    counterplay: 'Nothing gets through in either direction — you will not score during it either.',
    beneficiary: 'HOLDER',
    durationMinutes: 3,
    earliestPhase: 0.3,
    latestPhase: 1,
    modifiers: { defensiveSolidity: 0.48, spaceBehind: -0.32, attackVolume: -0.24, possessionBias: -0.14, aggression: -0.2 },
    opponentModifiers: { chanceQuality: -0.22, attackVolume: -0.12, possessionBias: 0.14 },
    rarity: 'COMMON',
    accent: '#64748B',
  }),
  ALL_IN: def({
    id: 'ALL_IN',
    name: 'Everything Forward',
    description: 'Every outfielder pushes into the opponent half and the shape is abandoned.',
    counterplay: 'There is no shape left. Every turnover is a clear run at your keeper.',
    beneficiary: 'HOLDER',
    durationMinutes: 3,
    earliestPhase: 0.55,
    latestPhase: 1,
    modifiers: { attackVolume: 0.62, defensiveSolidity: -0.3, spaceBehind: 0.24, fatigueRate: 0.3, volatility: 0.4, chanceQuality: -0.04 },
    opponentModifiers: { counterWeight: 0.3, chanceQuality: 0.08 },
    rarity: 'RARE',
    accent: '#EF4444',
  }),
  CREATOR_MOMENT: def({
    id: 'CREATOR_MOMENT',
    name: 'Crowd Surge',
    description: 'The arena gets behind your side and the noise lifts the press and the tempo.',
    counterplay: 'Noise cuts both ways. Score against it and the silence lands on your own players.',
    beneficiary: 'HOLDER',
    durationMinutes: 3,
    earliestPhase: 0.2,
    latestPhase: 1,
    modifiers: { pressRecovery: 0.26, aggression: 0.14, attackVolume: 0.3, chanceQuality: 0.06, fatigueRate: 0.1, volatility: 0.16 },
    opponentModifiers: { counterWeight: 0.14, chanceQuality: 0.06 },
    rarity: 'RARE',
    accent: '#A855F7',
  }),
  NUMBERS_GAME: def({
    id: 'NUMBERS_GAME',
    name: 'Thin Ranks',
    description: 'Both sides take a player off for the window. The pitch opens up for everybody.',
    counterplay: 'Fewer bodies rewards whoever still has legs — and punishes a squad you have already run into the ground.',
    beneficiary: 'BOTH',
    durationMinutes: 3,
    earliestPhase: 0.3,
    latestPhase: 1,
    modifiers: { attackVolume: 0.4, defensiveSolidity: -0.34, chanceQuality: 0.18, fatigueRate: 0.24, spaceBehind: 0.22 },
    rarity: 'COMMON',
    accent: '#22D3EE',
  }),
  LONG_RANGE: def({
    id: 'LONG_RANGE',
    name: 'Distance Bonus',
    description: 'Goals struck from outside the area count twice for the length of the window.',
    counterplay: 'Chasing the bonus means shooting from range, and most shots from range do not go in.',
    beneficiary: 'BOTH',
    durationMinutes: 3,
    earliestPhase: 0.3,
    latestPhase: 1,
    modifiers: { attackVolume: 0.36, chanceQuality: -0.3, possessionBias: -0.06, volatility: 0.2 },
    goalMultiplier: 2,
    rarity: 'COMMON',
    accent: '#FACC15',
  }),
  CAPTAINS_CALL: def({
    id: 'CAPTAINS_CALL',
    name: 'Armband',
    description: 'Everything runs through your captain, and his goals count twice while the window is live.',
    counterplay: 'One man is doing everything, and the opposition know exactly who to stop and who to kick.',
    beneficiary: 'HOLDER',
    durationMinutes: 3,
    earliestPhase: 0.25,
    latestPhase: 1,
    modifiers: { attackVolume: 0.24, chanceQuality: 0.16, foulRate: 0.1, volatility: 0.14 },
    opponentModifiers: { defensiveSolidity: 0.08, foulRate: 0.18 },
    goalMultiplier: 2,
    rarity: 'EPIC',
    accent: '#F97316',
  }),
  SUDDEN_SPARK: def({
    id: 'SUDDEN_SPARK',
    name: 'Open Season',
    description: 'Offside is suspended and both benches are told to attack. The game breaks open.',
    counterplay: 'The team defending a lead has the most to lose in an open game — and no way to close it down.',
    beneficiary: 'BOTH',
    durationMinutes: 3,
    earliestPhase: 0.3,
    latestPhase: 1,
    modifiers: { attackVolume: 0.44, defensiveSolidity: -0.38, spaceBehind: 0.34, volatility: 0.34, chanceQuality: 0.1 },
    rarity: 'RARE',
    accent: '#F43F5E',
  }),
};

export const SPECIAL_RULES: readonly SpecialRuleDefinition[] =
  SPECIAL_RULE_IDS.map((id) => SPECIAL_RULE_DEFINITIONS[id]);

export function specialRuleById(id: SpecialRuleId): SpecialRuleDefinition {
  return SPECIAL_RULE_DEFINITIONS[id];
}

/** A guaranteed, pre-announced window at the end of a half. */
export interface SwingWindow {
  readonly half: number;
  readonly ruleId: SpecialRuleId;
  readonly startMinute: number;
  readonly endMinute: number;
}

export interface RuleEngineOptions {
  readonly matchMinutes: number;
  readonly halves: number;
  /** Rules eligible to be drawn for this fixture's swing windows. */
  readonly enabled: readonly SpecialRuleId[];
}

export interface RuleTickContext {
  readonly minute: number;
  readonly homeScore: number;
  readonly awayScore: number;
}

export interface RuleTransition {
  readonly started: readonly ActiveSpecialRule[];
  readonly ended: readonly ActiveSpecialRule[];
}

interface LiveRule {
  readonly active: ActiveSpecialRule;
  readonly definition: SpecialRuleDefinition;
  /** Resolved beneficiary side, or 'both'. */
  readonly target: Side | 'both';
}

/**
 * Owns the schedule and the live set. It never touches the simulation directly:
 * the simulator asks it for modifiers and multipliers each tick, which keeps the
 * rule layer swappable per competition.
 */
export class SpecialRuleEngine {
  private readonly plannedWindows: SwingWindow[];
  private live: LiveRule[] = [];
  private past: ActiveSpecialRule[] = [];
  private lastCardMinute = -Infinity;

  constructor(rng: Rng, private readonly opts: RuleEngineOptions) {
    this.plannedWindows = scheduleSwingWindows(rng, opts);
  }

  /** The two windows, known from kick-off so the UI can announce them. */
  windows(): readonly SwingWindow[] { return this.plannedWindows; }

  inSwingWindow(minute: number): SwingWindow | null {
    return this.plannedWindows.find((w) => minute >= w.startMinute && minute < w.endMinute) ?? null;
  }

  /** Advance the clock: start any window that is due, retire anything expired. */
  tick(ctx: RuleTickContext): RuleTransition {
    const started: ActiveSpecialRule[] = [];
    const ended: ActiveSpecialRule[] = [];

    for (const w of this.plannedWindows) {
      if (ctx.minute < w.startMinute || ctx.minute >= w.endMinute) continue;
      if (this.live.some((l) => l.active.startMinute === w.startMinute && l.active.ruleId === w.ruleId)) continue;
      const definition = SPECIAL_RULE_DEFINITIONS[w.ruleId];
      const target = resolveTarget(definition, ctx);
      const active: ActiveSpecialRule = {
        ruleId: w.ruleId,
        side: target,
        startMinute: w.startMinute,
        endMinute: w.endMinute,
        reason: `Swing window: the closing minutes of ${ordinalHalf(w.half)}`,
      };
      this.live.push({ active, definition, target });
      started.push(active);
    }

    const stillLive: LiveRule[] = [];
    for (const l of this.live) {
      if (ctx.minute >= l.active.endMinute) {
        ended.push(l.active);
        this.past.push(l.active);
      } else {
        stillLive.push(l);
      }
    }
    this.live = stillLive;

    return { started, ended };
  }

  /**
   * Play a held rule card. Refuses outside the definition's phase window, while
   * another card is still cooling down, or if the same rule is already live —
   * so a card is a real decision about *when*, not a free button.
   */
  playCard(side: Side, ruleId: SpecialRuleId, ctx: RuleTickContext): ActiveSpecialRule | null {
    const definition = SPECIAL_RULE_DEFINITIONS[ruleId];
    if (!definition) return null;
    const fraction = ctx.minute / Math.max(1, this.opts.matchMinutes);
    if (fraction < definition.earliestPhase || fraction > definition.latestPhase) return null;
    if (ctx.minute - this.lastCardMinute < BALANCE.SPECIAL_RULE_GAP_MINUTES) return null;
    if (this.live.some((l) => l.active.ruleId === ruleId)) return null;

    const target = definition.beneficiary === 'BOTH' ? 'both'
      : definition.beneficiary === 'TRAILING' ? resolveTarget(definition, ctx)
      : side;

    const active: ActiveSpecialRule = {
      ruleId,
      side: target,
      startMinute: ctx.minute,
      endMinute: ctx.minute + definition.durationMinutes,
      reason: `${side === 'home' ? 'Home' : 'Away'} bench played ${definition.name}`,
    };
    this.live.push({ active, definition, target });
    this.lastCardMinute = ctx.minute;
    return active;
  }

  /** Vector deltas this side is currently subject to, from every live rule. */
  modifiersFor(side: Side): Record<string, number> {
    const out: Record<string, number> = {};
    const add = (mods: Readonly<Record<string, number>> | undefined): void => {
      if (!mods) return;
      for (const [k, v] of Object.entries(mods)) out[k] = (out[k] ?? 0) + v;
    };
    for (const l of this.live) {
      if (l.target === 'both') add(l.definition.modifiers);
      else if (l.target === side) add(l.definition.modifiers);
      else add(l.definition.opponentModifiers);
    }
    return out;
  }

  /**
   * How much a goal by this side is worth right now. `distance` and `byCaptain`
   * let the distance-bonus and armband rules resolve without the rule engine
   * needing to know anything about players.
   */
  goalMultiplier(side: Side, opts: { distance: number; byCaptain: boolean }): number {
    let multiplier = 1;
    for (const l of this.live) {
      if (l.target !== 'both' && l.target !== side) continue;
      const rule = l.definition;
      if (!rule.goalMultiplier) continue;
      if (rule.id === 'LONG_RANGE' && opts.distance < LONG_RANGE_DISTANCE) continue;
      if (rule.id === 'CAPTAINS_CALL' && !opts.byCaptain) continue;
      multiplier *= rule.goalMultiplier;
    }
    return multiplier;
  }

  /** Outfielders each side must take off right now. Only Thin Ranks uses this. */
  playerReduction(side: Side): number {
    let n = 0;
    for (const l of this.live) {
      if (l.definition.id !== 'NUMBERS_GAME') continue;
      if (l.target === 'both' || l.target === side) n += 1;
    }
    return n;
  }

  /** True when the captain of this side is currently the focal point. */
  captainFocus(side: Side): boolean {
    return this.live.some((l) => l.definition.id === 'CAPTAINS_CALL' && (l.target === 'both' || l.target === side));
  }

  activeRules(): readonly ActiveSpecialRule[] { return this.live.map((l) => l.active); }
  history(): readonly ActiveSpecialRule[] { return [...this.past, ...this.live.map((l) => l.active)]; }
}

/** The rule a swing window runs under when the fixture enables none of its own. */
export const DEFAULT_WINDOW_RULE: SpecialRuleId = 'SUDDEN_SPARK';

/** Goals struck from beyond this normalised distance qualify for the distance bonus. */
export const LONG_RANGE_DISTANCE = 0.22;

/**
 * One window per half, occupying its closing minutes. The rule for each is
 * drawn at kick-off from the fixture's enabled set, weighted by rarity, so the
 * player can be told what is coming before it arrives.
 */
export function scheduleSwingWindows(rng: Rng, opts: RuleEngineOptions): SwingWindow[] {
  // Only symmetric, state-based rules are drawn for a window. The asymmetric
  // ones are cards a team holds and chooses to play: a league-level rule that
  // arbitrarily favoured one side would not be a rule, it would be a gift.
  const pool = opts.enabled.filter(
    (id) => id in SPECIAL_RULE_DEFINITIONS && SPECIAL_RULE_DEFINITIONS[id].beneficiary === 'BOTH',
  );
  if (opts.halves < 1) return [];
  // The swing window is a property of the COMPETITION FORMAT, not of the rule
  // set: every half of this format ends with one, announced in advance. The
  // fixture's enabled list only chooses which rule colours it, so an empty list
  // means "use the format default", not "no windows". That was previously an
  // undocumented one-line fallback, which meant every measurement anyone made
  // of "rules off" was in fact a measurement of SUDDEN_SPARK. A competition
  // that genuinely wants no windows sets `halves` to 0 for its rule engine.
  if (pool.length === 0) pool.push(DEFAULT_WINDOW_RULE);

  const stream = rng.fork('swing-windows');
  const halfLength = opts.matchMinutes / opts.halves;
  const windows: SwingWindow[] = [];
  const drawn = new Set<SpecialRuleId>();

  for (let half = 1; half <= opts.halves; half++) {
    const endMinute = halfLength * half;
    const startMinute = Math.max(halfLength * (half - 1), endMinute - BALANCE.SWING_WINDOW_MINUTES);
    const fraction = startMinute / opts.matchMinutes;

    let eligible = pool.filter((id) => {
      const d = SPECIAL_RULE_DEFINITIONS[id];
      return fraction >= d.earliestPhase - 1e-9 && fraction <= d.latestPhase && !drawn.has(id);
    });
    if (eligible.length === 0) eligible = pool.filter((id) => !drawn.has(id));
    if (eligible.length === 0) eligible = pool.slice();

    const ruleId = stream.weighted(eligible, (id) => RARITY_WEIGHT[SPECIAL_RULE_DEFINITIONS[id].rarity]);
    drawn.add(ruleId);
    windows.push({ half, ruleId, startMinute, endMinute });
  }

  return windows;
}

const RARITY_WEIGHT: Record<SpecialRuleDefinition['rarity'], number> = {
  COMMON: 6,
  RARE: 2.5,
  EPIC: 1,
};

function resolveTarget(d: SpecialRuleDefinition, ctx: RuleTickContext): Side | 'both' {
  if (d.beneficiary === 'BOTH') return 'both';
  if (d.beneficiary === 'TRAILING') {
    if (ctx.homeScore < ctx.awayScore) return 'home';
    if (ctx.awayScore < ctx.homeScore) return 'away';
    return 'both';
  }
  return 'both';
}

const ordinalHalf = (half: number): string =>
  half === 1 ? 'the first half' : half === 2 ? 'the second half' : `period ${half}`;
