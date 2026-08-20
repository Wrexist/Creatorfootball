import { describe, expect, it } from 'vitest';
import { Rng } from '../core/rng';
import { diversifyByTrigger, ordinal, pickTemplate, type TemplateRecency } from './templating';

const pool = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `t${i}`, weight: 1 }));

describe('pickTemplate anti-repetition', () => {
  /**
   * The old selector multiplied a recent template's weight by 0.04 and left it
   * in the pool, which is why a five-line pool still read like one line. A
   * blocked template is not a candidate at all while an alternative exists.
   */
  it('never returns a blocked template while an alternative exists', () => {
    const candidates = pool(6);
    const recency: TemplateRecency = {
      blocked: new Set(['t0', 't1', 't2']),
      seen: new Set(['t0', 't1', 't2']),
    };
    for (let i = 0; i < 400; i++) {
      const picked = pickTemplate(new Rng(`pick:${i}`), candidates, recency);
      expect(picked).not.toBeNull();
      expect(recency.blocked.has(picked!.id)).toBe(false);
    }
  });

  it('falls back to a blocked template rather than going silent', () => {
    const candidates = pool(2);
    const recency: TemplateRecency = { blocked: new Set(['t0', 't1']), seen: new Set(['t0', 't1']) };
    expect(pickTemplate(new Rng('exhausted'), candidates, recency)).not.toBeNull();
  });

  it('prefers a line nobody has read over one that has already run', () => {
    const candidates = pool(4);
    const recency: TemplateRecency = { blocked: new Set(), seen: new Set(['t0', 't1', 't2']) };
    let unusedPicks = 0;
    const runs = 600;
    for (let i = 0; i < runs; i++) {
      if (pickTemplate(new Rng(`fresh:${i}`), candidates, recency)?.id === 't3') unusedPicks++;
    }
    // One unused line against three seen ones, weighted 6:1 — it should take
    // most of the traffic, and comfortably more than an even split would give.
    expect(unusedPicks / runs).toBeGreaterThan(0.5);
  });

  it('returns null only for an empty pool', () => {
    expect(pickTemplate(new Rng('empty'), [], { blocked: new Set(), seen: new Set() })).toBeNull();
  });
});

describe('diversifyByTrigger', () => {
  const hook = (trigger: string, importance: number) => ({ trigger, importance });

  it('gives every trigger a slot before any trigger gets a second', () => {
    const hooks = [
      hook('SHOCK_DEFEAT', 4), hook('SHOCK_DEFEAT', 4), hook('SHOCK_DEFEAT', 4),
      hook('CONTRACT_SIGNED', 2), hook('ATTENDANCE_RECORDED', 2),
    ];
    const chosen = diversifyByTrigger(hooks, { limit: 3, perTrigger: 3 });
    expect(new Set(chosen.map((h) => h.trigger)).size).toBe(3);
  });

  it('visits the biggest story first', () => {
    const hooks = [hook('MINOR', 1), hook('HUGE', 5), hook('MIDDLING', 3)];
    const chosen = diversifyByTrigger(hooks, { limit: 3, perTrigger: 1 });
    expect(chosen[0]?.trigger).toBe('HUGE');
  });

  it('honours the per-trigger cap even with budget to spare', () => {
    const hooks = Array.from({ length: 10 }, () => hook('SAME', 3));
    expect(diversifyByTrigger(hooks, { limit: 10, perTrigger: 2 })).toHaveLength(2);
  });
});

describe('ordinal', () => {
  it('never produces the 22th minute', () => {
    // Templates used to glue "th" onto the raw number, which read as
    // "sent off in the 22th minute" in shipped copy.
    expect(ordinal(1)).toBe('1st');
    expect(ordinal(2)).toBe('2nd');
    expect(ordinal(3)).toBe('3rd');
    expect(ordinal(4)).toBe('4th');
    expect(ordinal(22)).toBe('22nd');
    expect(ordinal(23)).toBe('23rd');
    expect(ordinal(31)).toBe('31st');
  });

  it('keeps the teens as th, which is the case a naive rule gets wrong', () => {
    expect(ordinal(11)).toBe('11th');
    expect(ordinal(12)).toBe('12th');
    expect(ordinal(13)).toBe('13th');
    expect(ordinal(111)).toBe('111th');
  });
});
