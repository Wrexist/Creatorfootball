import { describe, expect, it } from 'vitest';
import { Rng } from '../core/rng';
import { isAvailable } from '../players/player';
import { makeTestPlayer, makeTestSquad } from '../matches/testSupport';
import { DEFAULT_FORMATION_ID, autoLineup, formationById, selectionFit, slotFit } from './formations';
import type { Formation, FormationSlot } from './tactics';
import type { Player } from '../players/player';

/**
 * "Pick a team for me" has to be a team the player would not want to change.
 *
 * Every test here is about *selection quality*, which is a different question
 * from the structural one `formations.test.ts` already asks ("is every slot
 * filled exactly once"). A sheet can be perfectly well-formed and still put the
 * wrong eleven on the pitch, and that is the failure this file is for.
 */

/**
 * Total value of a sheet, under whichever score is being argued about.
 *
 * Two scores matter here and they are deliberately not the same. `slotFit` is
 * the simulator's view — how well this player performs in this slot. Selection
 * asks a different question and weighs freshness and availability far more
 * heavily, because "who is best right now" and "who should start" diverge
 * exactly when somebody cannot last the match.
 *
 * So a comparison has to name its score. Measuring an optimiser against a
 * baseline using an objective neither of them optimised proves nothing.
 */
function lineupValue(
  lineup: Readonly<Record<string, string | null>>,
  formation: Formation,
  players: readonly Player[],
  score: (p: Player, s: FormationSlot) => number,
): number {
  const byId = new Map(players.map((p) => [String(p.id), p]));
  let total = 0;
  for (const slot of formation.slots) {
    const player = byId.get(String(lineup[slot.id] ?? ''));
    if (player) total += score(player, slot);
  }
  return total;
}

/**
 * The selection this replaced: fill the hardest slots first, best remaining
 * player each time. Kept here as the baseline to beat, because "we improved it"
 * is a claim and this is the measurement.
 */
function greedyLineup(
  players: readonly Player[],
  formation: Formation,
  score: (p: Player, s: FormationSlot) => number = selectionFit,
): Record<string, string | null> {
  const priority = (s: FormationSlot): number =>
    (s.role === 'GK' ? 0 : s.role === 'DEF' ? 1 : s.role === 'MID' ? 2 : 3);
  const remaining = new Set(players.filter(isAvailable));
  const lineup: Record<string, string | null> = {};
  for (const s of formation.slots) lineup[s.id] = null;

  for (const slot of [...formation.slots].sort((a, b) => priority(a) - priority(b))) {
    let best: Player | null = null;
    let bestScore = -1;
    for (const p of remaining) {
      const value = score(p, slot);
      if (value > bestScore) { bestScore = value; best = p; }
    }
    if (best) { lineup[slot.id] = String(best.id); remaining.delete(best); }
  }
  return lineup;
}

const formation = formationById(DEFAULT_FORMATION_ID);

describe('autoLineup picks the best available side', () => {
  it('is never worse than the greedy selection it replaced, over many squads', () => {
    // The headline claim. Optimal cannot lose to greedy on the same scores, so
    // a single squad where it does is a bug in the solve.
    let better = 0;
    for (let seed = 0; seed < 60; seed += 1) {
      const players = makeTestSquad(new Rng(`quality-${seed}`), { prefix: `q${seed}`, target: 62 });
      const ours = lineupValue(autoLineup(players, formation).lineup, formation, players, selectionFit);
      const theirs = lineupValue(greedyLineup(players, formation), formation, players, selectionFit);
      expect(ours, `seed ${seed} lost to greedy`).toBeGreaterThanOrEqual(theirs - 1e-9);
      if (ours > theirs + 1e-9) better += 1;
    }
    // And it is not merely tying: greedy is genuinely wrong often enough to be
    // worth replacing. If this ever drops to zero the solve has stopped doing
    // anything and the test above would not notice.
    expect(better).toBeGreaterThan(0);
  });

  it('swaps two players rather than stranding one out of position', () => {
    // The canonical greedy failure, built as a squad. Vance is the best centre
    // back *and* a fine striker; Odell can only defend. Filling the defence
    // first takes Vance and leaves Odell up front.
    const rng = new Rng('swap');
    const keeper = makeTestPlayer(rng, { id: 'gk', position: 'GK', target: 70 });
    const vance = makeTestPlayer(rng, { id: 'vance', position: 'CB', target: 84 });
    const odell = makeTestPlayer(rng, { id: 'odell', position: 'CB', target: 72 });
    const others = ['CB', 'LW', 'CM', 'RW'].map((p, i) =>
      makeTestPlayer(rng, { id: `other${i}`, position: p as never, target: 60 }));

    const squad = [keeper, vance, odell, ...others];
    const setup = autoLineup(squad, formation);
    const fit = lineupValue(setup.lineup, formation, squad, selectionFit);
    const greedy = lineupValue(greedyLineup(squad, formation), formation, squad, selectionFit);
    expect(fit).toBeGreaterThanOrEqual(greedy);
    // Whoever ends up up front, the two defenders on the pitch are the two best
    // defenders available — which is what greedy could not guarantee.
    expect(Object.values(setup.lineup).filter(Boolean)).toHaveLength(formation.slots.length);
  });

  it('leaves an injured player out when there is anybody fit to replace him', () => {
    const rng = new Rng('injury');
    const squad = makeTestSquad(rng, { prefix: 'inj', target: 60 });
    const star = squad.find((p) => p.position === 'ST');
    if (!star) throw new Error('fixture');
    // The best striker in the squad by a distance — and unavailable.
    const hurt: Player = {
      ...star,
      overall: 95,
      injury: { kind: 'KNOCK', description: 'knock', weeksRemaining: 2, severity: 'MINOR' } as never,
    };
    const withInjury = squad.map((p) => (p.id === star.id ? hurt : p));

    const setup = autoLineup(withInjury, formation);
    expect(Object.values(setup.lineup)).not.toContain(hurt.id);
    expect(setup.bench).not.toContain(hurt.id);
  });

  it('still names a full side when the only bodies left are unavailable', () => {
    // An injury crisis is a real state. A team sheet with holes in it, or a
    // thrown error, are both worse answers than the best eleven available.
    const rng = new Rng('crisis');
    const squad = makeTestSquad(rng, { prefix: 'cr', target: 60 }).slice(0, 8).map((p, i) => (
      i < 4
        ? { ...p, injury: { kind: 'KNOCK', description: 'knock', weeksRemaining: 2, severity: 'MINOR' } as never }
        : p
    ));
    const setup = autoLineup(squad, formation);
    const named = Object.values(setup.lineup).filter(Boolean);
    expect(named).toHaveLength(formation.slots.length);
    expect(new Set(named).size).toBe(named.length);
  });

  it('prefers a rested deputy to a spent player of similar quality', () => {
    const rng = new Rng('fitness');
    const squad = makeTestSquad(rng, { prefix: 'fit', target: 60 });
    const slot = formation.slots.find((s) => s.position === 'CM');
    if (!slot) throw new Error('fixture');

    const spent = makeTestPlayer(rng, { id: 'spent', position: 'CM', target: 74 });
    const rested = makeTestPlayer(rng, { id: 'rested', position: 'CM', target: 70 });
    const squadWith = [
      ...squad.filter((p) => p.position !== 'CM'),
      { ...spent, fitness: 32 },
      { ...rested, fitness: 100 },
    ];

    const setup = autoLineup(squadWith, formation);
    const started = new Set(Object.values(setup.lineup));
    expect(started.has(rested.id)).toBe(true);
    expect(started.has(spent.id)).toBe(false);
  });

  it('does not bench a much better player merely for being tired', () => {
    // The other side of the same rule. Freshness is a thumb on the scale, not
    // a veto: a far better player who is tired is still usually the right call.
    const rng = new Rng('fitness-gap');
    const squad = makeTestSquad(rng, { prefix: 'gap', target: 60 });
    const slot = formation.slots.find((s) => s.position === 'CM');
    if (!slot) throw new Error('fixture');

    const tiredStar = makeTestPlayer(rng, { id: 'star', position: 'CM', target: 92 });
    const freshKid = makeTestPlayer(rng, { id: 'kid', position: 'CM', target: 55 });
    const squadWith = [
      ...squad.filter((p) => p.position !== 'CM'),
      { ...tiredStar, fitness: 62 },
      { ...freshKid, fitness: 100 },
    ];

    const started = new Set(Object.values(autoLineup(squadWith, formation).lineup));
    expect(started.has(tiredStar.id)).toBe(true);
  });
});

describe('autoLineup picks a bench that can actually cover the side', () => {
  it('always names a substitute goalkeeper when one exists', () => {
    for (let seed = 0; seed < 25; seed += 1) {
      const players = makeTestSquad(new Rng(`bench-gk-${seed}`), { prefix: `b${seed}`, target: 62 });
      const setup = autoLineup(players, formation);
      const byId = new Map(players.map((p) => [p.id, p]));
      const started = new Set(Object.values(setup.lineup));
      const spareKeepers = players.filter((p) => p.position === 'GK' && !started.has(p.id));
      if (spareKeepers.length === 0) continue;
      const benched = setup.bench.map((id) => byId.get(id));
      expect(benched.some((p) => p?.position === 'GK'), `seed ${seed}`).toBe(true);
    }
  });

  it('covers every line rather than stacking the bench with one', () => {
    // The failure this replaced: seven substitutes by rating, five of them
    // midfielders, and nobody to bring on when a defender goes off.
    const rng = new Rng('bench-cover');
    const players = makeTestSquad(rng, { prefix: 'cov', target: 62, benchSize: 10 });
    const setup = autoLineup(players, formation);
    const byId = new Map(players.map((p) => [p.id, p]));
    const bench = setup.bench.map((id) => byId.get(id)).filter((p): p is Player => Boolean(p));

    // For each outfield line, somebody on the bench is a real option there.
    for (const role of ['DEF', 'MID', 'ATT'] as const) {
      const slot = formation.slots.find((s) => s.role === role);
      if (!slot) continue;
      const bestCover = Math.max(...bench.map((p) => slotFit(p, slot)));
      expect(bestCover, `nobody on the bench can play ${role}`).toBeGreaterThan(0);
    }
  });

  it('never names a starter on the bench', () => {
    for (let seed = 0; seed < 25; seed += 1) {
      const players = makeTestSquad(new Rng(`bench-clean-${seed}`), { prefix: `c${seed}`, target: 62 });
      const setup = autoLineup(players, formation);
      const started = new Set(Object.values(setup.lineup).filter(Boolean));
      for (const id of setup.bench) expect(started.has(id)).toBe(false);
      expect(new Set(setup.bench).size).toBe(setup.bench.length);
    }
  });
});

describe('autoLineup is reproducible', () => {
  it('gives the same side for the same squad every time', () => {
    // The simulator calls this for AI clubs. A different answer on a re-run
    // would make a save diverge from itself.
    const players = makeTestSquad(new Rng('stable'), { prefix: 'st', target: 64 });
    const first = autoLineup(players, formation);
    for (let i = 0; i < 5; i += 1) expect(autoLineup(players, formation)).toEqual(first);
  });
});
