import { describe, expect, it } from 'vitest';
import { Rng } from '../core/rng';
import { SPECIAL_RULE_IDS } from './specialRules';
import { SPECIAL_RULES, SPECIAL_RULE_DEFINITIONS, SpecialRuleEngine, scheduleSwingWindows, specialRuleById } from './specialRuleEngine';
import { BALANCE } from './balance';

const OPTS = { matchMinutes: 30, halves: 2, enabled: [...SPECIAL_RULE_IDS] };

describe('rule definitions', () => {
  it('defines every frozen rule id', () => {
    expect(SPECIAL_RULES).toHaveLength(SPECIAL_RULE_IDS.length);
    for (const id of SPECIAL_RULE_IDS) expect(specialRuleById(id).id).toBe(id);
  });

  it('gives every rule a description, a counterplay and an accent colour', () => {
    for (const rule of SPECIAL_RULES) {
      expect(rule.name.length).toBeGreaterThan(2);
      expect(rule.description.length).toBeGreaterThan(20);
      // A rule you cannot play against is a bug, not a feature.
      expect(rule.counterplay.length).toBeGreaterThan(20);
      expect(rule.accent).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(['COMMON', 'RARE', 'EPIC']).toContain(rule.rarity);
      expect(rule.durationMinutes).toBeGreaterThan(0);
      expect(rule.earliestPhase).toBeGreaterThanOrEqual(0);
      expect(rule.latestPhase).toBeLessThanOrEqual(1);
      expect(rule.earliestPhase).toBeLessThan(rule.latestPhase);
    }
  });

  it('gives every rule a real downside — modifiers that are not all upside', () => {
    for (const rule of SPECIAL_RULES) {
      const own = Object.values(rule.modifiers);
      const opponent = Object.values(rule.opponentModifiers ?? {});
      const hasSelfCost = own.some((v) => v < 0);
      const hasOpponentGain = opponent.some((v) => v > 0);
      const isSymmetric = rule.beneficiary === 'BOTH';
      expect(hasSelfCost || hasOpponentGain || isSymmetric, `${rule.id} has no encoded counterplay`).toBe(true);
      expect(own.length).toBeGreaterThan(0);
    }
  });

  it('avoids vocabulary claimed by an existing competition', () => {
    const denied = /gamechanger|secret weapon|president penalty|rulebreaker|reverse penalty/i;
    for (const rule of SPECIAL_RULES) {
      expect(`${rule.name} ${rule.description} ${rule.counterplay}`).not.toMatch(denied);
    }
  });
});

describe('clock-anchored swing windows', () => {
  it('schedules exactly one window per half, in its closing minutes', () => {
    const windows = scheduleSwingWindows(new Rng('w'), OPTS);
    expect(windows).toHaveLength(2);
    expect(windows[0]?.startMinute).toBe(15 - BALANCE.SWING_WINDOW_MINUTES);
    expect(windows[0]?.endMinute).toBe(15);
    expect(windows[1]?.startMinute).toBe(30 - BALANCE.SWING_WINDOW_MINUTES);
    expect(windows[1]?.endMinute).toBe(30);
  });

  it('only draws symmetric rules — a league rule must not simply gift one side an edge', () => {
    for (let i = 0; i < 200; i++) {
      for (const w of scheduleSwingWindows(new Rng(`w${i}`), OPTS)) {
        expect(SPECIAL_RULE_DEFINITIONS[w.ruleId].beneficiary).toBe('BOTH');
      }
    }
  });

  it('draws different rules for the two halves and varies across matches', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const windows = scheduleSwingWindows(new Rng(`v${i}`), OPTS);
      expect(windows[0]?.ruleId).not.toBe(windows[1]?.ruleId);
      for (const w of windows) seen.add(w.ruleId);
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('still produces a window when the fixture enables nothing usable', () => {
    const windows = scheduleSwingWindows(new Rng('empty'), { ...OPTS, enabled: [] });
    expect(windows).toHaveLength(2);
  });

  it('opens and closes each window exactly once', () => {
    const engine = new SpecialRuleEngine(new Rng('e'), OPTS);
    let started = 0;
    let ended = 0;
    for (let m = 0; m <= 30; m += 0.5) {
      const t = engine.tick({ minute: m, homeScore: 0, awayScore: 0 });
      started += t.started.length;
      ended += t.ended.length;
    }
    expect(started).toBe(2);
    expect(ended).toBe(2);
    expect(engine.activeRules()).toHaveLength(0);
    expect(engine.history()).toHaveLength(2);
    for (const r of engine.history()) expect(r.reason).toMatch(/closing minutes/);
  });

  it('applies its modifiers to both sides while live and to neither afterwards', () => {
    const engine = new SpecialRuleEngine(new Rng('mods'), OPTS);
    engine.tick({ minute: 13, homeScore: 0, awayScore: 0 });
    expect(Object.keys(engine.modifiersFor('home')).length).toBeGreaterThan(0);
    expect(engine.modifiersFor('home')).toEqual(engine.modifiersFor('away'));
    engine.tick({ minute: 15, homeScore: 0, awayScore: 0 });
    expect(Object.keys(engine.modifiersFor('home'))).toHaveLength(0);
  });
});

describe('rule cards', () => {
  const ctx = { minute: 20, homeScore: 1, awayScore: 0 };

  it('are refused outside the definition phase window', () => {
    const engine = new SpecialRuleEngine(new Rng('c1'), OPTS);
    expect(engine.playCard('home', 'ALL_IN', { ...ctx, minute: 2 })).toBeNull();
    expect(engine.playCard('home', 'ALL_IN', ctx)).not.toBeNull();
  });

  it('are refused twice in a row inside the cooldown', () => {
    const engine = new SpecialRuleEngine(new Rng('c2'), OPTS);
    expect(engine.playCard('home', 'POWER_PLAY', ctx)).not.toBeNull();
    expect(engine.playCard('home', 'LOCKDOWN', { ...ctx, minute: 21 })).toBeNull();
    expect(engine.playCard('home', 'LOCKDOWN', { ...ctx, minute: 26 })).not.toBeNull();
  });

  it('hand the opponent the counterplay modifiers, not the holder ones', () => {
    const engine = new SpecialRuleEngine(new Rng('c3'), OPTS);
    engine.playCard('home', 'ALL_IN', ctx);
    expect(engine.modifiersFor('home')['attackVolume']).toBeGreaterThan(0);
    expect(engine.modifiersFor('home')['defensiveSolidity']).toBeLessThan(0);
    expect(engine.modifiersFor('away')['counterWeight']).toBeGreaterThan(0);
  });

  it('give a trailing-side rule to the side that is actually behind', () => {
    const engine = new SpecialRuleEngine(new Rng('c4'), OPTS);
    const active = engine.playCard('away', 'LAST_STAND', { minute: 20, homeScore: 3, awayScore: 1 });
    expect(active?.side).toBe('away');
    expect(engine.modifiersFor('away')['defensiveSolidity']).toBeGreaterThan(0);
  });
});

describe('goal multipliers', () => {
  it('doubles everything under the double-reward rule', () => {
    const engine = new SpecialRuleEngine(new Rng('g1'), { ...OPTS, enabled: ['DOUBLE_GOAL'] });
    engine.tick({ minute: 13, homeScore: 0, awayScore: 0 });
    expect(engine.goalMultiplier('home', { distance: 0.1, byCaptain: false })).toBe(2);
    expect(engine.goalMultiplier('away', { distance: 0.1, byCaptain: false })).toBe(2);
  });

  it('doubles only long-range goals under the distance bonus', () => {
    const engine = new SpecialRuleEngine(new Rng('g2'), { ...OPTS, enabled: ['LONG_RANGE'] });
    engine.tick({ minute: 13, homeScore: 0, awayScore: 0 });
    expect(engine.goalMultiplier('home', { distance: 0.05, byCaptain: false })).toBe(1);
    expect(engine.goalMultiplier('home', { distance: 0.4, byCaptain: false })).toBe(2);
  });

  it('doubles only the captain under the armband', () => {
    const engine = new SpecialRuleEngine(new Rng('g3'), OPTS);
    engine.playCard('home', 'CAPTAINS_CALL', { minute: 20, homeScore: 0, awayScore: 0 });
    expect(engine.captainFocus('home')).toBe(true);
    expect(engine.goalMultiplier('home', { distance: 0.1, byCaptain: true })).toBe(2);
    expect(engine.goalMultiplier('home', { distance: 0.1, byCaptain: false })).toBe(1);
    expect(engine.goalMultiplier('away', { distance: 0.1, byCaptain: true })).toBe(1);
  });

  it('takes a body off both sides under thin ranks', () => {
    const engine = new SpecialRuleEngine(new Rng('g4'), { ...OPTS, enabled: ['NUMBERS_GAME'] });
    engine.tick({ minute: 13, homeScore: 0, awayScore: 0 });
    expect(engine.playerReduction('home')).toBe(1);
    expect(engine.playerReduction('away')).toBe(1);
  });
});
