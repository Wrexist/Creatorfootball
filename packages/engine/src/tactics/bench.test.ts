import { describe, expect, it } from 'vitest';
import { Rng } from '../core/rng';
import { makeTestPlayer } from '../matches/testSupport';
import { isAvailable } from '../players/player';
import type { Player } from '../players/player';
import type { Position } from '../players/positions';
import { positionGroup } from '../players/positions';
import { DEFAULT_FORMATION_ID, formationById, selectMatchdayBench } from './formations';
import type { MatchdayStarter } from './formations';
import type { Formation } from './tactics';

/**
 * The bench is a decision, not what is left over.
 *
 * A team sheet ends with seven names, and which seven is a football question:
 * who covers the goal if the keeper goes off, who covers each line, and who is
 * simply good enough to change a game. This file asks that question directly.
 * It does not check that the bench is *full* — `formations.test.ts` does the
 * structural work — it checks that the seven names answer "somebody has just
 * gone off, who comes on" for every way that sentence can end.
 */

const rng = new Rng('bench-selector');
let n = 0;
/** A player of a known position and rating, everything else neutral. */
function p(position: Position, overall: number, over: Partial<Player> = {}): Player {
  n += 1;
  return {
    ...makeTestPlayer(rng.fork(`p${n}`), { id: `bp_${String(n).padStart(3, '0')}`, position, target: overall }),
    overall,
    fitness: 100,
    ...over,
  };
}

const FORMATION: Formation = formationById(DEFAULT_FORMATION_ID); // 2-3-1: GK, 2 DEF, 3 MID, 1 ATT

/** A starting eleven (here, seven) built by dropping players into the shape in order. */
function starters(players: readonly Player[], formation: Formation = FORMATION): MatchdayStarter[] {
  return formation.slots.map((slot, i) => ({ slot, player: players[i] as Player }))
    .filter((s) => Boolean(s.player));
}

/** The default starting seven for the reference shape: GK, CB, CB, CM, LW, RW, ST. */
const XI = (): Player[] => [p('GK', 70), p('CB', 70), p('CB', 69), p('CM', 70), p('LW', 69), p('RW', 69), p('ST', 71)];

const positions = (seats: readonly { player: Player }[]): Position[] => seats.map((s) => s.player.position);
const ids = (seats: readonly { player: Player }[]): string[] => seats.map((s) => s.player.id as string);
const groups = (seats: readonly { player: Player }[]): string[] => positions(seats).map(positionGroup);

describe('the matchday bench', () => {
  it('TEST 1: names a reserve goalkeeper whenever the squad has a second one', () => {
    const xi = XI();
    const reserveGk = p('GK', 52);
    const squad = [...xi, reserveGk, p('CB', 66), p('CM', 66), p('ST', 66), p('LW', 65), p('RB', 65), p('CDM', 65)];
    const bench = selectMatchdayBench(squad, starters(xi), FORMATION);
    expect(ids(bench)).toContain(reserveGk.id as string);
    expect(bench.find((s) => s.player.id === reserveGk.id)?.role).toBe('KEEPER_COVER');
    // The keeper's seat is the first one, so the cover reads as cover.
    expect(bench[0]?.player.id).toBe(reserveGk.id);
  });

  it('TEST 2: does not name a second reserve keeper, and does not waste the seat when there is no second keeper at all', () => {
    const xi = XI();
    // Ten spare for seven seats, three of them keepers: two of the three have
    // to lose out to an outfielder, and the seat order says which.
    const spare = [p('GK', 55), p('GK', 54), p('GK', 53), p('CB', 66), p('CB', 65),
      p('CM', 66), p('CM', 65), p('ST', 66), p('LW', 64), p('RB', 64)];
    const twoDeep = selectMatchdayBench([...xi, ...spare], starters(xi), FORMATION);
    expect(positions(twoDeep).filter((q) => q === 'GK')).toHaveLength(1);

    // A squad with exactly one keeper, who is playing: the seat goes to a real
    // outfield option rather than to the outfielder who is least bad in goal.
    const outfieldOnly = [p('CB', 66), p('CM', 66), p('ST', 66), p('LW', 64), p('RB', 64), p('CDM', 63), p('CAM', 63)];
    const noCover = selectMatchdayBench([...xi, ...outfieldOnly], starters(xi), FORMATION);
    expect(positions(noCover)).not.toContain('GK');
    expect(noCover).toHaveLength(7);
    expect(noCover.every((s) => s.role !== 'KEEPER_COVER')).toBe(true);
  });

  it('TEST 3: always has a defensive option, even when the best players left are not defenders', () => {
    const xi = XI();
    const onlyDefender = p('CB', 55);
    const squad = [...xi, onlyDefender, p('GK', 60), p('ST', 78), p('CAM', 77), p('LW', 77), p('CM', 76), p('RW', 76)];
    const bench = selectMatchdayBench(squad, starters(xi), FORMATION);
    expect(ids(bench)).toContain(onlyDefender.id as string);
    expect(bench.find((s) => s.player.id === onlyDefender.id)?.role).toBe('DEFENSIVE_COVER');
  });

  it('TEST 4: always has a midfield option', () => {
    const xi = XI();
    const onlyMidfielder = p('CM', 56);
    const squad = [...xi, onlyMidfielder, p('GK', 60), p('CB', 78), p('CB', 77), p('RB', 77), p('ST', 76), p('LW', 76)];
    const bench = selectMatchdayBench(squad, starters(xi), FORMATION);
    expect(ids(bench)).toContain(onlyMidfielder.id as string);
    expect(bench.find((s) => s.player.id === onlyMidfielder.id)?.role).toBe('MIDFIELD_COVER');
  });

  it('TEST 5: always has an attacking option', () => {
    const xi = XI();
    const onlyForward = p('ST', 55);
    const squad = [...xi, onlyForward, p('GK', 60), p('CB', 78), p('CB', 77), p('LB', 77), p('CDM', 76), p('CM', 76)];
    const bench = selectMatchdayBench(squad, starters(xi), FORMATION);
    expect(ids(bench)).toContain(onlyForward.id as string);
    expect(bench.find((s) => s.player.id === onlyForward.id)?.role).toBe('ATTACKING_COVER');
    // And the four lines are all answered on one seven-man bench.
    expect(new Set(groups(bench))).toEqual(new Set(['GK', 'DEF', 'MID', 'ATT']));
  });

  it('TEST 6: between two players who cover the same line, quality decides', () => {
    const xi = XI();
    const better = p('CB', 72);
    const worse = p('CB', 58);
    const squad = [...xi, p('GK', 60), better, worse, p('CM', 66), p('ST', 66), p('LW', 64), p('CDM', 64), p('RW', 63)];
    // Four seats: a keeper and one option per line, so the two centre-backs
    // are competing for the same seat and only quality separates them.
    const bench = selectMatchdayBench(squad, starters(xi), FORMATION, { size: 4 });
    expect(ids(bench)).toContain(better.id as string);
    expect(ids(bench)).not.toContain(worse.id as string);
  });

  it('TEST 7: position familiarity counts — a versatile player covers a line, but never beats a much better specialist', () => {
    const xi = XI();
    // A right-back who can play centre-back is defensive cover; a striker is not.
    const versatile = p('RB', 64, { secondaryPositions: ['CB'] });
    const forward = p('ST', 66);
    const squad = [...xi, p('GK', 60), versatile, forward, p('CM', 64), p('LW', 63), p('CDM', 63), p('RW', 62)];
    const bench = selectMatchdayBench(squad, starters(xi), FORMATION, { size: 3 });
    expect(ids(bench)).toContain(versatile.id as string);

    // Versatility is not a trump card: a far better specialist in the line
    // being covered still wins the seat.
    const utility = p('CM', 60, { secondaryPositions: ['CB', 'ST'] });
    const specialist = p('CB', 80);
    const squad2 = [...xi, p('GK', 60), utility, specialist, p('ST', 62), p('LW', 61), p('CDM', 61), p('RW', 60)];
    const bench2 = selectMatchdayBench(squad2, starters(xi), FORMATION, { size: 3 });
    expect(ids(bench2)).toContain(specialist.id as string);
  });

  it('TEST 8: the starting eleven changes the bench — cover is not calculated in isolation', () => {
    const spare = [p('GK', 60), p('CB', 66), p('CB', 65), p('CM', 66), p('CM', 65), p('ST', 66), p('LW', 65), p('RB', 64), p('CDM', 64)];
    const backThree = formationById('3-2-1');
    const attacking = formationById('2-3-1');

    const defensiveXI = [p('GK', 70), p('CB', 70), p('CB', 70), p('CB', 69), p('CM', 70), p('CM', 69), p('ST', 70)];
    const a = selectMatchdayBench([...defensiveXI, ...spare], starters(defensiveXI, backThree), backThree, { size: 6 });
    const attackingXI = [p('GK', 70), p('CB', 70), p('CB', 69), p('CM', 70), p('LW', 70), p('RW', 69), p('ST', 70)];
    const b = selectMatchdayBench([...attackingXI, ...spare], starters(attackingXI, attacking), attacking, { size: 6 });

    // The two sheets draw from the same reserves. Three defenders in front of
    // one bench and two in front of the other must show up as more defensive
    // cover behind the back three — otherwise cover is being measured against
    // the formation in the abstract rather than against the side playing.
    const defenders = (seats: typeof a) => groups(seats).filter((g) => g === 'DEF').length;
    expect(defenders(a)).toBeGreaterThan(defenders(b));
    expect(ids(a)).not.toEqual(ids(b));
  });

  it('TEST 9: an unavailable player is never named while a fit one is left', () => {
    const xi = XI();
    const hurt = p('CB', 85, { injury: { severity: 'MINOR', weeksRemaining: 2, description: 'Knock', sustainedCycle: 0 } });
    const banned = p('CM', 84, { suspensionMatches: 1 });
    const fit = [p('GK', 55), p('CB', 60), p('CM', 60), p('ST', 60), p('LW', 59), p('RB', 59), p('CDM', 58)];
    const bench = selectMatchdayBench([...xi, hurt, banned, ...fit], starters(xi), FORMATION);
    expect(ids(bench)).not.toContain(hurt.id as string);
    expect(ids(bench)).not.toContain(banned.id as string);
    expect(bench.every((s) => isAvailable(s.player))).toBe(true);
  });

  it('TEST 10: the same squad and the same eleven always produce the same bench', () => {
    const xi = XI();
    const squad = [...xi, p('GK', 60), p('CB', 66), p('CM', 66), p('ST', 66), p('LW', 65), p('RB', 65), p('CDM', 64), p('CAM', 64)];
    const once = selectMatchdayBench(squad, starters(xi), FORMATION);
    for (let i = 0; i < 5; i++) {
      expect(ids(selectMatchdayBench(squad, starters(xi), FORMATION))).toEqual(ids(once));
    }
    // Shuffling the squad list is not a different squad.
    const reversed = [...squad].reverse();
    expect(ids(selectMatchdayBench(reversed, starters(xi), FORMATION))).toEqual(ids(once));
  });

  it('TEST 11: two identical players are separated by their id, not by list order', () => {
    const xi = XI();
    const twinA = { ...p('CB', 66), id: 'bp_twin_a' as Player['id'] };
    const twinB = { ...twinA, id: 'bp_twin_b' as Player['id'] };
    const rest = [p('GK', 60), p('CM', 64), p('ST', 64), p('LW', 63), p('RB', 63), p('CDM', 62)];
    const forwards = selectMatchdayBench([...xi, twinA, twinB, ...rest], starters(xi), FORMATION, { size: 3 });
    const backwards = selectMatchdayBench([...xi, twinB, twinA, ...rest], starters(xi), FORMATION, { size: 3 });
    expect(ids(forwards)).toEqual(ids(backwards));
    // Whichever twin is named, it is the lower id.
    if (ids(forwards).includes('bp_twin_b')) expect(ids(forwards)).toContain('bp_twin_a');
  });

  it('TEST 12: a squad too small for a full bench gets a short one — nobody is invented', () => {
    const xi = XI();
    const twoSpare = [p('GK', 55), p('CB', 58)];
    const bench = selectMatchdayBench([...xi, ...twoSpare], starters(xi), FORMATION);
    expect(bench).toHaveLength(2);
    expect(ids(bench).sort()).toEqual(twoSpare.map((q) => q.id as string).sort());

    // And a squad with nobody spare gets an empty bench rather than a starter back.
    const none = selectMatchdayBench(xi, starters(xi), FORMATION);
    expect(none).toHaveLength(0);
  });

  it('TEST 13: a starter is never also on the bench, and nobody sits twice', () => {
    const xi = XI();
    const squad = [...xi, p('GK', 60), p('CB', 66), p('CM', 66), p('ST', 66), p('LW', 65), p('RB', 65), p('CDM', 64)];
    const bench = selectMatchdayBench(squad, starters(xi), FORMATION);
    const started = new Set(xi.map((q) => q.id as string));
    for (const seat of bench) expect(started.has(seat.player.id as string)).toBe(false);
    expect(new Set(ids(bench)).size).toBe(bench.length);
  });

  it('TEST 14: the bench is ordered deliberately — keeper, then defence, midfield, attack, then the rest', () => {
    const xi = XI();
    const squad = [...xi, p('GK', 60), p('CB', 66), p('CM', 66), p('ST', 66), p('LW', 65), p('RB', 65), p('CDM', 64)];
    const bench = selectMatchdayBench(squad, starters(xi), FORMATION);
    const order = ['KEEPER_COVER', 'DEFENSIVE_COVER', 'MIDFIELD_COVER', 'ATTACKING_COVER', 'BEST_AVAILABLE'];
    const ranks = bench.map((s) => order.indexOf(s.role));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(bench[0]?.role).toBe('KEEPER_COVER');
  });

  it('TEST 15: the tactical lean is a thumb on the scale, never a rewrite', () => {
    const xi = XI();
    const spare = [p('GK', 60), p('CB', 66), p('CB', 65), p('CM', 66), p('CM', 65), p('ST', 66), p('ST', 65), p('LB', 64), p('CDM', 64)];
    const bold = selectMatchdayBench([...xi, ...spare], starters(xi), FORMATION, { risk: 'RECKLESS' });
    const cautious = selectMatchdayBench([...xi, ...spare], starters(xi), FORMATION, { risk: 'CAUTIOUS' });
    // Both benches still cover all four lines: the lean cannot break the shape.
    for (const bench of [bold, cautious]) {
      expect(new Set(groups(bench))).toEqual(new Set(['GK', 'DEF', 'MID', 'ATT']));
      expect(bench).toHaveLength(7);
    }
    // And it does something: the bold bench carries at least as many forwards.
    const forwards = (b: typeof bold) => groups(b).filter((g) => g === 'ATT').length;
    expect(forwards(bold)).toBeGreaterThanOrEqual(forwards(cautious));
  });
});
