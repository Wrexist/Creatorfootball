import { describe, expect, it } from 'vitest';
import { Rng } from '../core/rng';
import { FORMATIONS, DEFAULT_FORMATION_ID, autoLineup, formationById, formationsFor, slotFit } from './formations';
import { makeTestSquad } from '../matches/testSupport';

describe('formations', () => {
  it('ships the shape the content pack assigns to every club', () => {
    const f = formationById(DEFAULT_FORMATION_ID);
    expect(DEFAULT_FORMATION_ID).toBe('2-3-1');
    expect(f.id).toBe('2-3-1');
    expect(f.slots).toHaveLength(7);
    expect(f.slots.filter((s) => s.role === 'GK')).toHaveLength(1);
    expect(f.slots.filter((s) => s.role === 'DEF')).toHaveLength(2);
    expect(f.slots.filter((s) => s.role === 'MID')).toHaveLength(3);
    expect(f.slots.filter((s) => s.role === 'ATT')).toHaveLength(1);
  });

  it('offers at least eight seven-a-side shapes and three eleven-a-side ones', () => {
    expect(formationsFor(7).length).toBeGreaterThanOrEqual(8);
    expect(formationsFor(11).length).toBeGreaterThanOrEqual(3);
  });

  it('names every shape by its outfield lines, back to front', () => {
    for (const f of FORMATIONS) {
      expect(f.id).toMatch(/^\d+(-\d+)+$/);
      const outfield = f.id.split('-').reduce((a, n) => a + Number(n), 0);
      expect(outfield).toBe(f.slots.length - 1);
    }
  });

  it('has unique ids, a keeper first, and coordinates on the pitch', () => {
    const ids = new Set<string>();
    for (const f of FORMATIONS) {
      expect(ids.has(f.id)).toBe(false);
      ids.add(f.id);
      expect(f.slots[0]?.role).toBe('GK');
      expect(f.blurb.length).toBeGreaterThan(10);
      const slotIds = new Set<string>();
      for (const s of f.slots) {
        expect(s.x).toBeGreaterThanOrEqual(0);
        expect(s.x).toBeLessThanOrEqual(1);
        expect(s.y).toBeGreaterThanOrEqual(0);
        expect(s.y).toBeLessThanOrEqual(1);
        expect(slotIds.has(s.id)).toBe(false);
        slotIds.add(s.id);
      }
    }
  });

  it('falls back to the default rather than throwing on an unknown id', () => {
    expect(formationById('not-a-shape').id).toBe(DEFAULT_FORMATION_ID);
  });
});

describe('autoLineup', () => {
  const rng = new Rng('auto');
  const players = makeTestSquad(rng, { prefix: 'auto', target: 65 });

  it('fills every slot exactly once and never doubles a player up', () => {
    const formation = formationById(DEFAULT_FORMATION_ID);
    const setup = autoLineup(players, formation);
    const chosen = Object.values(setup.lineup).filter(Boolean);
    expect(chosen).toHaveLength(formation.slots.length);
    expect(new Set(chosen).size).toBe(chosen.length);
    for (const id of setup.bench) expect(chosen).not.toContain(id);
  });

  it('puts a goalkeeper in goal', () => {
    const formation = formationById(DEFAULT_FORMATION_ID);
    const setup = autoLineup(players, formation);
    const keeper = players.find((p) => p.id === setup.lineup['gk']);
    expect(keeper?.position).toBe('GK');
  });

  it('names a captain, a set-piece taker and a penalty taker', () => {
    const setup = autoLineup(players, formationById(DEFAULT_FORMATION_ID));
    expect(setup.captainId).not.toBeNull();
    expect(setup.setPieceTakerId).not.toBeNull();
    expect(setup.penaltyTakerId).not.toBeNull();
  });

  it('works for an eleven-a-side shape too', () => {
    const big = makeTestSquad(new Rng('auto11'), { prefix: 'big', target: 65, playersOnPitch: 11, benchSize: 7 });
    const setup = autoLineup(big, formationById('4-4-2'));
    expect(Object.values(setup.lineup).filter(Boolean)).toHaveLength(11);
  });

  it('scores a striker lower at centre back than a defender', () => {
    const cb = formationById(DEFAULT_FORMATION_ID).slots.find((s) => s.position === 'CB');
    expect(cb).toBeDefined();
    const striker = players.find((p) => p.position === 'ST');
    const defender = players.find((p) => p.position === 'CB');
    if (!cb || !striker || !defender) throw new Error('fixture');
    expect(slotFit(striker, cb) / striker.overall).toBeLessThan(slotFit(defender, cb) / defender.overall);
  });
});
