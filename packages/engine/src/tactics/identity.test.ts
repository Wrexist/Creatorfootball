import { describe, expect, it } from 'vitest';
import { Rng } from '../core/rng';
import { makeTestPlayer } from '../matches/testSupport';
import { ContentRegistry } from '../content/loader';
import { BASE_PACK } from '../content/packs/base';
import { createNewGame } from '../game/newGame';
import { squadOf } from '../game/selectors';
import type { ClubId } from '../core/brand';
import type { GameState } from '../game/state';
import { DEFAULT_TACTICS } from './tactics';
import {
  DEFAULT_FORMATION_ID, autoLineup, formationById, formationsFor,
  formationSuitability, selectFormation, selectMatchdayBench, shapeAffinity,
} from './formations';
import type { Formation, TacticSetup } from './tactics';
import type { Player } from '../players/player';
import type { Position } from '../players/positions';

/**
 * A club's shape should be its own.
 *
 * Every club in a generated league walked out in 2-3-1, because the generator
 * assigned the default shape and nothing ever reconsidered it. That is not a
 * football decision, it is an unset field, and it made twelve clubs that press
 * differently, defend at different heights and take different risks line up
 * identically anyway.
 *
 * The fix is a selector, and the danger of a selector is that it becomes a
 * randomiser. These tests pin the hierarchy: a shape the squad cannot play is
 * never chosen, a squad that clearly suits one shape gets it, and a club's
 * football identity decides only between shapes the squad plays about equally
 * well.
 */

const rng = new Rng('identity');
let n = 0;
const p = (position: Position, overall: number, over: Partial<Player> = {}): Player => {
  n += 1;
  return {
    ...makeTestPlayer(rng.fork(`p${n}`), { id: `id_${String(n).padStart(3, '0')}`, position, target: overall }),
    overall, fitness: 100, ...over,
  };
};

const tactics = (over: Partial<TacticSetup> = {}): TacticSetup => ({
  ...DEFAULT_TACTICS, formationId: DEFAULT_FORMATION_ID,
  lineup: {}, bench: [], captainId: null, setPieceTakerId: null, penaltyTakerId: null,
  ...over,
});

/** A club that wants to defend, and one that wants to attack. */
const CAUTIOUS = tactics({ press: 'LOW_BLOCK', line: 'DEEP', risk: 'CAUTIOUS', tempo: 'PATIENT', counter: 'WHEN_ON' });
const BOLD = tactics({ press: 'HIGH_PRESS', line: 'HIGH', risk: 'BOLD', tempo: 'QUICK', width: 'WIDE', counter: 'ALWAYS' });

/** A balanced squad: enough of everything to play most shapes. */
const balancedSquad = (): Player[] => [
  p('GK', 66), p('GK', 58),
  p('CB', 68), p('CB', 66), p('CB', 63), p('LB', 65), p('RB', 65),
  p('CDM', 66), p('CM', 67), p('CM', 65), p('CM', 62), p('CAM', 65),
  p('LW', 66), p('RW', 65), p('ST', 68), p('ST', 63), p('LW', 61), p('RB', 60),
];

const SEVENS = formationsFor(7);

const registry = (): ContentRegistry => { const r = new ContentRegistry(); r.load(BASE_PACK); return r; };
const career = (seed: string): GameState => createNewGame({
  registry: registry(), seed, now: 1_700_000_000_000,
  manager: { kind: 'PREMADE', templateId: 'manager_vera_lindqvist' },
  club: { kind: 'TEMPLATE', templateId: 'club_cinderwick_town' },
});

describe('club tactical identity and formation choice', () => {
  it('TEST A: the same club and squad always produce the same identity reading', () => {
    for (const setup of [CAUTIOUS, BOLD, tactics()]) {
      const once = shapeAffinity(setup);
      for (let i = 0; i < 5; i++) expect(shapeAffinity(setup)).toEqual(once);
    }
    // Two clubs that play differently read differently.
    expect(shapeAffinity(CAUTIOUS)).not.toEqual(shapeAffinity(BOLD));
    // And the reading is a preference over the shapes the game already names.
    expect(Object.keys(shapeAffinity(CAUTIOUS)).sort())
      .toEqual(['ATTACKING', 'BALANCED', 'DEFENSIVE', 'NARROW', 'WIDE']);
  });

  it('TEST B: the same squad and the same identity always produce the same formation', () => {
    const squad = balancedSquad();
    const once = selectFormation(squad, CAUTIOUS, SEVENS).id;
    for (let i = 0; i < 5; i++) expect(selectFormation(squad, CAUTIOUS, SEVENS).id).toBe(once);
    // Squad order is not squad identity.
    expect(selectFormation([...squad].reverse(), CAUTIOUS, SEVENS).id).toBe(once);
  });

  it('TEST C: a shape the squad cannot fill is never chosen for the sake of variety', () => {
    // No wingers and no attacking midfielder: the front-loaded shapes have
    // nobody to play them, whatever the manager would prefer.
    const spine = [
      p('GK', 66), p('GK', 58),
      p('CB', 70), p('CB', 69), p('CB', 68), p('CB', 66), p('LB', 66), p('RB', 66), p('LB', 62), p('RB', 62),
      p('CDM', 69), p('CDM', 67), p('CM', 68), p('CM', 66), p('CM', 64), p('CM', 62),
      p('ST', 66), p('ST', 60),
    ];
    const chosen = selectFormation(spine, BOLD, SEVENS);
    // 2-4 and 3-3 field four and three across the front; this squad has two
    // forwards. Whatever is picked, it must not be one of those.
    expect(['2-4', '3-3']).not.toContain(chosen.id);
    const filled = autoLineup(spine, chosen);
    expect(Object.values(filled.lineup).filter(Boolean)).toHaveLength(chosen.slots.length);
  });

  it('TEST D: between shapes the squad plays equally well, identity decides', () => {
    const squad = balancedSquad();
    const cautious = selectFormation(squad, CAUTIOUS, SEVENS);
    const bold = selectFormation(squad, BOLD, SEVENS);
    expect(cautious.id).not.toBe(bold.id);
    // And each leans the way the manager does.
    expect(['DEFENSIVE', 'BALANCED', 'NARROW']).toContain(cautious.shape);
    expect(['ATTACKING', 'WIDE', 'BALANCED']).toContain(bold.shape);
  });

  it('TEST E: identity cannot force a shape the squad is clearly worse at', () => {
    // A squad built for a back three and nothing else: five centre-backs, one
    // forward. A bold manager still cannot field 2-4.
    const defenders = [
      p('GK', 66), p('GK', 56),
      p('CB', 74), p('CB', 73), p('CB', 72), p('CB', 70), p('CB', 68), p('LB', 70), p('RB', 70),
      p('CDM', 70), p('CDM', 66), p('CM', 64), p('CM', 60),
      p('ST', 62), p('ST', 52), p('LW', 48), p('RW', 47), p('CAM', 50),
    ];
    const bold = selectFormation(defenders, BOLD, SEVENS);
    const suitability = (f: Formation): number => {
      const auto = autoLineup(defenders, f);
      const ids = new Set(Object.values(auto.lineup).filter(Boolean) as string[]);
      const xi = defenders.filter((q) => ids.has(q.id as string));
      return xi.reduce((a, q) => a + q.overall, 0) / Math.max(1, xi.length);
    };
    const best = Math.max(...SEVENS.map(suitability));
    // Whatever identity asks for, the chosen shape stays close to the best the
    // squad can actually field.
    expect(suitability(bold)).toBeGreaterThan(best * 0.9);
  });

  it('TEST H: every shape the selector can choose still produces a legal bench', () => {
    const squad = balancedSquad();
    for (const setup of [CAUTIOUS, BOLD, tactics()]) {
      const formation = selectFormation(squad, setup, SEVENS);
      const auto = autoLineup(squad, formation);
      const starters = formation.slots
        .map((slot) => {
          const id = auto.lineup[slot.id];
          const player = id ? squad.find((q) => q.id === id) : undefined;
          return player ? { slot, player } : null;
        })
        .filter((s): s is { slot: typeof formation.slots[number]; player: Player } => s !== null);
      const bench = selectMatchdayBench(squad, starters, formation, { size: 7, risk: setup.risk });
      expect(bench).toHaveLength(7);
      // A keeper is still covered, and nobody sits twice.
      expect(bench.some((seat) => seat.player.position === 'GK')).toBe(true);
      expect(new Set(bench.map((s) => s.player.id)).size).toBe(bench.length);
      const started = new Set(starters.map((s) => s.player.id as string));
      for (const seat of bench) expect(started.has(seat.player.id as string)).toBe(false);
    }
  });

  it('TEST F: a generated league fields several shapes, not one', () => {
    // Measured across 24 worlds and 288 clubs (docs/experiments/formation-identity):
    // ten shapes appear, the commonest holds 28.5% of clubs, and entropy is
    // 2.99 bits of a possible 3.32. A single twelve-club league is a smaller
    // sample than that, so the assertion is the conservative floor the
    // experiment supports rather than its headline.
    for (const seed of ['diversity-a', 'diversity-b', 'diversity-c']) {
      const state = career(seed);
      const shapes = Object.values(state.clubs).map((c) => c.tactics.formationId);
      const counts = new Map<string, number>();
      for (const id of shapes) counts.set(id, (counts.get(id) ?? 0) + 1);
      expect(counts.size, `${seed} fielded ${counts.size} shapes`).toBeGreaterThanOrEqual(4);
      const dominant = Math.max(...counts.values()) / shapes.length;
      expect(dominant, `${seed} dominant share ${dominant}`).toBeLessThanOrEqual(0.5);
      // And the shapes are structurally different, not ten names for one shape.
      const classes = new Set(shapes.map((id) => formationById(id).shape));
      expect(classes.size).toBeGreaterThanOrEqual(3);
    }
  });

  it('TEST G: the shape a club is given is one its squad can play, weak clubs included', () => {
    // The failure mode to guard is diversity bought by handing weak squads
    // shapes they cannot field. Measured mean suitability loss under the
    // shipped weights is 0.71% and the worst single club 4.7%; the old world,
    // which forced 2-3-1 on everyone, lost 3.74% on average. The bound below is
    // the band the selector enforces, checked per club rather than on average.
    for (const seed of ['weak-safety-a', 'weak-safety-b']) {
      const state = career(seed);
      const clubs = Object.keys(state.clubs);
      const losses: { strength: number; loss: number }[] = [];
      for (const id of clubs) {
        const club = state.clubs[id as ClubId];
        if (!club) continue;
        const squad = squadOf(state, id as ClubId);
        const best = Math.max(...SEVENS.map((f) => formationSuitability(squad, f)));
        const here = formationSuitability(squad, formationById(club.tactics.formationId));
        expect(here).toBeGreaterThan(0);
        const loss = (best - here) / best;
        expect(loss, `${club.shortName} gave up ${(loss * 100).toFixed(1)}%`).toBeLessThanOrEqual(0.06);
        losses.push({ strength: squad.reduce((a, p) => a + p.overall, 0) / squad.length, loss });
      }
      // The weaker half must not be paying more for variety than the stronger.
      const byStrength = [...losses].sort((a, b) => a.strength - b.strength);
      const half = Math.floor(byStrength.length / 2);
      const weakLoss = byStrength.slice(0, half).reduce((a, x) => a + x.loss, 0) / Math.max(1, half);
      const strongLoss = byStrength.slice(-half).reduce((a, x) => a + x.loss, 0) / Math.max(1, half);
      expect(weakLoss).toBeLessThanOrEqual(strongLoss + 0.02);
    }
  });

  it('TEST I: generating the same world twice produces the same clubs, shapes and benches', () => {
    const a = career('reference');
    const b = career('reference');
    expect(Object.keys(a.clubs)).toEqual(Object.keys(b.clubs));
    for (const id of Object.keys(a.clubs)) {
      expect(a.clubs[id as ClubId]?.tactics).toEqual(b.clubs[id as ClubId]?.tactics);
      const squadA = squadOf(a, id as ClubId);
      const squadB = squadOf(b, id as ClubId);
      expect(squadA.map((p) => p.id)).toEqual(squadB.map((p) => p.id));
      const formation = formationById(a.clubs[id as ClubId]?.tactics.formationId ?? '2-3-1');
      const startersOf = (state: GameState, clubId: string) => {
        const squad = squadOf(state, clubId as ClubId);
        const auto = autoLineup(squad, formation);
        return formation.slots
          .map((slot) => {
            const pid = auto.lineup[slot.id];
            const player = pid ? squad.find((q) => q.id === pid) : undefined;
            return player ? { slot, player } : null;
          })
          .filter((x): x is { slot: typeof formation.slots[number]; player: Player } => x !== null);
      };
      const benchA = selectMatchdayBench(squadA, startersOf(a, id), formation, { size: 7 });
      const benchB = selectMatchdayBench(squadB, startersOf(b, id), formation, { size: 7 });
      expect(benchA.map((s) => s.player.id)).toEqual(benchB.map((s) => s.player.id));
    }
  });

  it('TEST J: a formation handed in explicitly is returned untouched', () => {
    const squad = balancedSquad();
    // Given one candidate, the selector has nothing to decide — which is how a
    // manager's own choice stays a manager's own choice.
    for (const id of ['2-4', '3-3', '2-1-2-1']) {
      expect(selectFormation(squad, BOLD, [formationById(id)]).id).toBe(id);
    }
  });
});
