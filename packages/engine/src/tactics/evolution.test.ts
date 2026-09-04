import { describe, expect, it } from 'vitest';
import { Rng } from '../core/rng';
import { makeTestPlayer } from '../matches/testSupport';
import { ContentRegistry } from '../content/loader';
import { BASE_PACK } from '../content/packs/base';
import { createNewGame } from '../game/newGame';
import { advanceCycle } from '../game/cycle';
import { Ledger } from '../economy/ledger';
import { squadOf } from '../game/selectors';
import { DEFAULT_TACTICS } from './tactics';
import {
  DEFAULT_FORMATION_ID, autoLineup, formationById, formationsFor,
  formationSuitability, reviewFormation, selectMatchdayBench,
} from './formations';
import type { Formation, TacticSetup } from './tactics';
import type { Player } from '../players/player';
import type { Position } from '../players/positions';
import type { ClubId } from '../core/brand';
import type { GameState } from '../game/state';

/**
 * A club's shape should outlive a transfer window, and not a decade.
 *
 * Formation is chosen once, when the world is made, from the squad the club
 * has that day. Then the squad moves: players retire, the academy sends two up
 * every summer, the AI buys the positions its profile favours, everyone ages.
 * Measured over six seasons, a club's squad turns over 11-23% a year and the
 * shape it was given falls behind the shape it should now be playing by 1.7%
 * in season one and 3.2% by season six, with the worst clubs 10% adrift.
 *
 * The danger in fixing that is the opposite failure. Recomputing the best shape
 * every summer would move 60-83% of clubs *every season*, which is not
 * evolution, it is a club with no memory. These tests pin both ends: a club
 * that still suits its shape keeps it, a club that has genuinely outgrown it
 * moves, and nothing about how the season *went* can push either way.
 */

const rng = new Rng('evolution');
let n = 0;
const p = (position: Position, overall: number, over: Partial<Player> = {}): Player => {
  n += 1;
  return {
    ...makeTestPlayer(rng.fork(`p${n}`), { id: `ev_${String(n).padStart(3, '0')}`, position, target: overall }),
    overall, fitness: 100, ...over,
  };
};

const tactics = (over: Partial<TacticSetup> = {}): TacticSetup => ({
  ...DEFAULT_TACTICS, formationId: DEFAULT_FORMATION_ID,
  lineup: {}, bench: [], captainId: null, setPieceTakerId: null, penaltyTakerId: null,
  ...over,
});
const CAUTIOUS = tactics({ press: 'LOW_BLOCK', line: 'DEEP', risk: 'CAUTIOUS', tempo: 'PATIENT' });
const BOLD = tactics({ press: 'HIGH_PRESS', line: 'HIGH', risk: 'BOLD', tempo: 'QUICK', width: 'WIDE' });

const SEVENS = formationsFor(7);

/** A squad with something of everything. */
const balancedSquad = (): Player[] => [
  p('GK', 66), p('GK', 58),
  p('CB', 68), p('CB', 66), p('CB', 63), p('LB', 65), p('RB', 65),
  p('CDM', 66), p('CM', 67), p('CM', 65), p('CM', 62), p('CAM', 65),
  p('LW', 66), p('RW', 65), p('ST', 68), p('ST', 63), p('LW', 61), p('RB', 60),
];

/** A squad that has specialised: deep in defence and midfield, thin up front. */
const lopsidedSquad = (): Player[] => [
  p('GK', 66), p('GK', 58),
  p('CB', 72), p('CB', 71), p('CB', 69), p('CB', 67), p('LB', 70), p('RB', 69), p('LB', 63), p('RB', 62),
  p('CDM', 71), p('CDM', 68), p('CM', 70), p('CM', 68), p('CM', 65), p('CM', 62),
  p('ST', 61), p('ST', 52),
];

/** Shapes ranked for a squad, best first. */
const ranked = (squad: readonly Player[]): { formation: Formation; value: number }[] =>
  SEVENS.map((formation) => ({ formation, value: formationSuitability(squad, formation) }))
    .sort((a, b) => b.value - a.value);

const registry = (): ContentRegistry => { const r = new ContentRegistry(); r.load(BASE_PACK); return r; };
const career = (seed: string): GameState => createNewGame({
  registry: registry(), seed, now: 1_700_000_000_000,
  manager: { kind: 'PREMADE', templateId: 'manager_vera_lindqvist' },
  club: { kind: 'TEMPLATE', templateId: 'club_cinderwick_town' },
});
const EPOCH = 1_700_000_000_000;
const CYCLE = 604_800_000;

/** Play `seasons` full seasons, recording each club's shape at every rollover. */
function playSeasons(seed: string, seasons: number): { shapes: string[][]; state: GameState } {
  const reg = registry();
  let state = career(seed);
  const history: string[][] = [Object.keys(state.clubs).map((id) => state.clubs[id as ClubId]!.tactics.formationId)];
  let cycle = 0;
  for (let s = 0; s < seasons; s++) {
    const weeks = state.seasons[state.currentSeasonId]?.totalWeeks ?? 22;
    for (let w = 0; w < weeks; w++) {
      state = advanceCycle(state, {
        now: EPOCH + cycle * CYCLE, registry: reg, ledger: Ledger.restore(state.ledger),
      }).state;
      cycle += 1;
    }
    history.push(Object.keys(state.clubs).map((id) => state.clubs[id as ClubId]!.tactics.formationId));
  }
  return { shapes: history, state };
}

describe('seasonal formation reassessment', () => {
  it('TEST A: a club that still suits its shape keeps it, even when another is a shade better', () => {
    const squad = balancedSquad();
    const order = ranked(squad);
    const best = order[0] as { formation: Formation; value: number };
    // The closest runner-up: better shapes exist, but only just.
    const nearly = order.find((o) => o.value < best.value && (best.value - o.value) / best.value < 0.03);
    expect(nearly, 'the fixture needs a near-tied alternative').toBeDefined();

    const review = reviewFormation(squad, tactics({ formationId: nearly!.formation.id }), SEVENS);
    expect(review.changed).toBe(false);
    expect(review.chosen.id).toBe(nearly!.formation.id);
    expect(review.verdict).toBe('KEPT_STILL_SUITS');
    expect(review.shortfall).toBeLessThan(0.03);
  });

  it('TEST B: a club whose squad has outgrown its shape changes', () => {
    // A balanced squad plays every shape within about a per cent, which is the
    // point of TEST A. Evolution needs a squad that has genuinely specialised:
    // this one is built for a back three and has almost nothing up front.
    const squad = lopsidedSquad();
    const order = ranked(squad);
    const worst = order[order.length - 1] as { formation: Formation; value: number };
    const best = order[0] as { formation: Formation; value: number };
    const shortfall = (best.value - worst.value) / best.value;
    expect(shortfall, 'the fixture needs a clearly unsuitable current shape').toBeGreaterThan(0.06);

    const review = reviewFormation(squad, tactics({ formationId: worst.formation.id }), SEVENS);
    expect(review.changed).toBe(true);
    expect(review.chosen.id).not.toBe(worst.formation.id);
    expect(review.verdict).toBe('CHANGED_SQUAD_OUTGREW_SHAPE');
    expect(review.currentSuitability).toBeLessThan(review.bestSuitability);
  });

  it('TEST C: when a change is justified, identity picks the replacement', () => {
    const squad = lopsidedSquad();
    const order = ranked(squad);
    const worst = (order[order.length - 1] as { formation: Formation }).formation;
    const cautious = reviewFormation(squad, { ...CAUTIOUS, formationId: worst.id }, SEVENS);
    const bold = reviewFormation(squad, { ...BOLD, formationId: worst.id }, SEVENS);
    expect(cautious.changed).toBe(true);
    expect(bold.changed).toBe(true);
    // The two managers walk away from the same shape in different directions.
    expect(cautious.chosen.id).not.toBe(bold.chosen.id);
  });

  it('TEST D: the same squad and shape always produce the same verdict', () => {
    const squad = balancedSquad();
    for (const id of SEVENS.map((f) => f.id)) {
      const once = reviewFormation(squad, tactics({ formationId: id }), SEVENS);
      for (let i = 0; i < 4; i++) {
        const again = reviewFormation([...squad].reverse(), tactics({ formationId: id }), SEVENS);
        expect(again.chosen.id).toBe(once.chosen.id);
        expect(again.verdict).toBe(once.verdict);
        expect(again.shortfall).toBeCloseTo(once.shortfall, 10);
      }
    }
  });

  it('TEST E: how the season went cannot reach the decision', () => {
    // Form is the only channel by which results touch selection, and at
    // rollover fitness, injuries and suspensions have already been reset. A
    // squad that had a brilliant season and one that had a dreadful one must
    // therefore review identically.
    const base = balancedSquad();
    const flying = base.map((q) => ({ ...q, form: { ...q.form, rating: 2.5, recentRatings: [9, 9, 8] } }));
    const dreadful = base.map((q) => ({ ...q, form: { ...q.form, rating: -2.5, recentRatings: [3, 2, 4] } }));
    for (const id of SEVENS.map((f) => f.id)) {
      const a = reviewFormation(flying, tactics({ formationId: id }), SEVENS);
      const b = reviewFormation(dreadful, tactics({ formationId: id }), SEVENS);
      expect(a.chosen.id, `shape ${id}`).toBe(b.chosen.id);
      expect(a.verdict).toBe(b.verdict);
      expect(a.shortfall).toBeCloseTo(b.shortfall, 10);
    }
  });

  it('TEST G: the current shape is the default, not a candidate among equals', () => {
    // Every shape, reviewed against its own squad: whenever the current shape
    // is retained the verdict says so, and it is never dropped for a gain
    // smaller than the threshold the rule advertises.
    const squad = balancedSquad();
    for (const formation of SEVENS) {
      const review = reviewFormation(squad, tactics({ formationId: formation.id }), SEVENS);
      if (!review.changed) {
        expect(review.chosen.id).toBe(formation.id);
        // At the production threshold, which sits at or above the selector's
        // own suitability band, keeping also means the shape is still close
        // enough to the best — the two statements coincide.
        expect(review.shortfall).toBeLessThanOrEqual(review.threshold);
      } else {
        // A change ALWAYS requires crossing the line. This half holds at any
        // threshold, including the diagnostic ones the experiment uses.
        expect(review.shortfall).toBeGreaterThan(review.threshold);
      }
    }
  });

  it('TEST H: stability does not trap a club whose shape has become absurd', () => {
    // A squad rebuilt entirely around the front: six strikers, four wingers,
    // two attacking midfielders and not one defender. It is still nominally
    // lining up in a back-three pyramid, which its players are 14% adrift of.
    // No amount of continuity is worth that.
    const allAttack = [
      p('GK', 66), p('GK', 56),
      p('ST', 72), p('ST', 70), p('ST', 68), p('ST', 66), p('ST', 63), p('ST', 60),
      p('LW', 70), p('LW', 67), p('RW', 70), p('RW', 66), p('CAM', 69), p('CAM', 65),
      p('CM', 62), p('CM', 60), p('CM', 58), p('CM', 56),
    ];
    const review = reviewFormation(allAttack, { ...CAUTIOUS, formationId: '3-2-1' }, SEVENS);
    expect(review.shortfall).toBeGreaterThan(0.1);
    expect(review.changed).toBe(true);
    expect(review.chosen.id).not.toBe('3-2-1');
    expect(review.verdict).toBe('CHANGED_SQUAD_OUTGREW_SHAPE');

    // A squad with no forwards at all, by contrast, genuinely suits a shape
    // with nobody up front — so it keeps it. Stability is not the same as
    // inertia, and this is the line between them.
    const noForwards = [
      p('GK', 66), p('GK', 58),
      p('CB', 72), p('CB', 71), p('CB', 70), p('CB', 68), p('LB', 70), p('RB', 70), p('LB', 64), p('RB', 63),
      p('CDM', 71), p('CDM', 68), p('CM', 70), p('CM', 68), p('CM', 66), p('CM', 64), p('CDM', 62), p('CM', 60),
    ];
    expect(reviewFormation(noForwards, { ...CAUTIOUS, formationId: '2-4' }, SEVENS).changed).toBe(false);
  });

  it('TEST I: whatever is chosen still fields a legal side and a legal bench', () => {
    const squad = balancedSquad();
    for (const formation of SEVENS) {
      const review = reviewFormation(squad, tactics({ formationId: formation.id }), SEVENS);
      const auto = autoLineup(squad, review.chosen);
      const named = Object.values(auto.lineup).filter(Boolean) as string[];
      expect(named).toHaveLength(review.chosen.slots.length);
      expect(new Set(named).size).toBe(named.length);

      const starters = review.chosen.slots
        .map((slot) => {
          const id = auto.lineup[slot.id];
          const player = id ? squad.find((q) => q.id === id) : undefined;
          return player ? { slot, player } : null;
        })
        .filter((s): s is { slot: typeof review.chosen.slots[number]; player: Player } => s !== null);
      const bench = selectMatchdayBench(squad, starters, review.chosen, { size: 7 });
      expect(bench).toHaveLength(7);
      expect(bench.some((seat) => seat.player.position === 'GK')).toBe(true);
      const started = new Set(starters.map((s) => s.player.id as string));
      for (const seat of bench) expect(started.has(seat.player.id as string)).toBe(false);
    }
  });

  it('TEST F: a squad that drifts to and fro does not drag the shape with it', () => {
    // The mechanism that prevents oscillation is hysteresis: once a shape is
    // held, it is the baseline, and small movements either side of it never
    // cross the threshold. This drives that directly rather than paying for a
    // simulated decade — the multi-season run below checks the wiring.
    const core = balancedSquad();
    // Two squads a transfer window apart: one a little stronger at the back,
    // one a little stronger in front. Neither is a rebuild.
    const defensiveTilt = [...core.slice(0, 16), p('CB', 67), p('CB', 64)];
    const attackingTilt = [...core.slice(0, 16), p('ST', 67), p('LW', 64)];

    let shape = reviewFormation(core, tactics(), SEVENS).chosen.id;
    const seen: string[] = [shape];
    for (let season = 0; season < 8; season++) {
      const squad = season % 2 === 0 ? defensiveTilt : attackingTilt;
      shape = reviewFormation(squad, tactics({ formationId: shape }), SEVENS).chosen.id;
      seen.push(shape);
    }
    // It may settle somewhere once. It must never come back.
    for (let i = 2; i < seen.length; i++) {
      expect(seen[i] === seen[i - 2] && seen[i] !== seen[i - 1],
        `oscillated: ${seen.join(' -> ')}`).toBe(false);
    }
    expect(new Set(seen).size, `wandered through ${new Set(seen).size} shapes`).toBeLessThanOrEqual(2);
  });

  it('TEST F2: across simulated seasons no club reverts to a shape it left', () => {
    const { shapes } = playSeasons('oscillation', 4);
    const clubs = (shapes[0] as string[]).length;
    let reversals = 0;
    for (let club = 0; club < clubs; club++) {
      const line = shapes.map((row) => (row as string[])[club] as string);
      for (let s = 2; s < line.length; s++) {
        if (line[s] === line[s - 2] && line[s] !== line[s - 1]) reversals += 1;
      }
    }
    expect(reversals, `${reversals} A-B-A reversals across ${clubs} clubs`).toBe(0);
  }, 120_000);

  it('TEST J: the same world played twice has the same formation history', () => {
    const a = playSeasons('multi-determinism', 2);
    const b = playSeasons('multi-determinism', 2);
    expect(a.shapes).toEqual(b.shapes);
    expect(Object.keys(a.state.clubs)).toEqual(Object.keys(b.state.clubs));
    for (const id of Object.keys(a.state.clubs)) {
      expect(a.state.clubs[id as ClubId]?.tactics).toEqual(b.state.clubs[id as ClubId]?.tactics);
      expect(squadOf(a.state, id as ClubId).map((q) => q.id))
        .toEqual(squadOf(b.state, id as ClubId).map((q) => q.id));
    }
  }, 120_000);

  it('TEST K: the league stays varied across seasons, and every club still suits its shape', () => {
    const { shapes, state } = playSeasons('multi-diversity', 3);
    const last = shapes[shapes.length - 1] as string[];
    expect(shapes).toHaveLength(4);
    const counts = new Map<string, number>();
    for (const id of last) counts.set(id, (counts.get(id) ?? 0) + 1);
    expect(counts.size, `season 4 fielded ${counts.size} shapes`).toBeGreaterThanOrEqual(4);
    expect(Math.max(...counts.values()) / last.length).toBeLessThanOrEqual(0.5);

    // And nobody has been left in a shape their current squad cannot play.
    for (const id of Object.keys(state.clubs)) {
      const club = state.clubs[id as ClubId];
      if (!club) continue;
      const squad = squadOf(state, id as ClubId);
      const best = Math.max(...SEVENS.map((f) => formationSuitability(squad, f)));
      const here = formationSuitability(squad, formationById(club.tactics.formationId));
      expect(here, `${club.shortName} cannot field ${club.tactics.formationId}`).toBeGreaterThan(0);
      expect((best - here) / best, `${club.shortName} is adrift`).toBeLessThanOrEqual(0.12);
    }
  }, 120_000);
});
