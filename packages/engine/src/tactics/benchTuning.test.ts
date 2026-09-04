import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { Rng } from '../core/rng';
import { makeTestPlayer, makeTestSetup, makeTestSquad, makeTestTeam } from '../matches/testSupport';
import { MatchSimulator, simulateMatch } from '../matches/simulator';
import { ContentRegistry } from '../content/loader';
import { BASE_PACK } from '../content/packs/base';
import { createNewGame } from '../game/newGame';
import { buildMatchSetup } from '../game/matchSetup';
import { advanceCycle } from '../game/cycle';
import { Ledger } from '../economy/ledger';
import {
  DEFAULT_BENCH_TUNING, DEFAULT_FORMATION_ID, autoLineup, formationById, selectMatchdayBench,
} from './formations';
import type { MatchdayStarter } from './formations';
import type { Player } from '../players/player';
import type { Position } from '../players/positions';
import type { PlayerId } from '../core/brand';
import type { CreatorSeasonConfigDef } from '../content';
import type { Fixture } from '../league/types';
import type { GameState } from '../game/state';
import type { MatchTeam } from '../matches/simulator';

/**
 * The bench selector, made measurable without being made different.
 *
 * `COVER_THRESHOLD` and `TACTICAL_LEAN` are implementation choices, not proven
 * gameplay constants. Answering "are they right" means running the same league
 * under different values and comparing — which is only worth anything if the
 * experiment drives the *real* selector rather than a copy of it, and if the
 * default path is provably untouched. These tests pin both halves of that: the
 * tuned path at its defaults is the production path, and a tuning value is the
 * only thing a configuration can change.
 */

const rng = new Rng('bench-tuning');
let n = 0;
function p(position: Position, overall: number, over: Partial<Player> = {}): Player {
  n += 1;
  return {
    ...makeTestPlayer(rng.fork(`p${n}`), { id: `bt_${String(n).padStart(3, '0')}`, position, target: overall }),
    overall, fitness: 100, ...over,
  };
}

const F = formationById(DEFAULT_FORMATION_ID); // 2-3-1: GK, CB CB, LW CM RW, ST
const starters = (players: readonly Player[], formation = F): MatchdayStarter[] =>
  formation.slots.map((slot, i) => ({ slot, player: players[i] as Player }))
    .filter((s) => Boolean(s.player));
const XI = (): Player[] => [p('GK', 70), p('CB', 70), p('CB', 69), p('CM', 70), p('LW', 69), p('RW', 69), p('ST', 71)];
const ids = (seats: readonly { player: Player }[]): string[] => seats.map((s) => s.player.id as string);

const registry = (): ContentRegistry => { const r = new ContentRegistry(); r.load(BASE_PACK); return r; };
const career = (seed: string): GameState => createNewGame({
  registry: registry(), seed, now: 1_700_000_000_000,
  manager: { kind: 'PREMADE', templateId: 'manager_vera_lindqvist' },
  club: { kind: 'TEMPLATE', templateId: 'club_cinderwick_town' },
});
const hash = (v: unknown): string =>
  createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 16);
const weekOne = (state: GameState): Fixture[] => Object.values(state.fixtures)
  .filter((f): f is Fixture => f.seasonId === state.seasons[state.currentSeasonId]?.id && f.week <= 2)
  .sort((a, b) => (a.id < b.id ? -1 : 1));

describe('bench tuning', () => {
  it('TEST 1: the tuned selector at its defaults is the production selector, bench for bench and result for result', () => {
    // At the selector.
    for (const seed of ['a', 'b', 'c', 'd', 'e']) {
      const squad = makeTestSquad(new Rng(`parity-${seed}`), { prefix: `pp${seed}`, target: 64, benchSize: 10 });
      const auto = autoLineup(squad, F);
      const started = new Set(Object.values(auto.lineup).filter(Boolean) as string[]);
      const xi = F.slots.map((slot) => {
        const id = auto.lineup[slot.id];
        return id ? { slot, player: squad.find((q) => q.id === id) as Player } : null;
      }).filter((s): s is MatchdayStarter => s !== null);
      expect(started.size).toBeGreaterThan(0);
      const plain = selectMatchdayBench(squad, xi, F);
      const tuned = selectMatchdayBench(squad, xi, F, { tuning: DEFAULT_BENCH_TUNING });
      expect(ids(tuned)).toEqual(ids(plain));
      expect(tuned.map((s) => s.role)).toEqual(plain.map((s) => s.role));
    }

    // And through a whole match: an explicit default tuning changes nothing.
    const fixture = (tuning?: typeof DEFAULT_BENCH_TUNING) => {
      const r = new Rng('parity-match');
      const setup = makeTestSetup({
        seed: 'parity-match',
        home: makeTestTeam(r, { prefix: 'ph', name: 'Home', target: 66 }),
        away: makeTestTeam(r, { prefix: 'pa', name: 'Away', target: 63 }),
        config: { maxDecisions: 0, ...(tuning ? { benchTuning: tuning } : {}) },
      });
      return setup;
    };
    const plainSim = new MatchSimulator(fixture());
    const tunedSim = new MatchSimulator(fixture(DEFAULT_BENCH_TUNING));
    for (const side of ['home', 'away'] as const) {
      expect(tunedSim.substitutionStatus(side).bench).toEqual(plainSim.substitutionStatus(side).bench);
    }
    expect(hash(simulateMatch(fixture(DEFAULT_BENCH_TUNING)))).toBe(hash(simulateMatch(fixture())));
  });

  it('TEST 2: a tuning changes the bench and nothing else — not the world, the squads, the seed or the fixture', () => {
    const state = career('isolation');
    const config = registry().seasonConfig() as CreatorSeasonConfigDef;
    const fixture = weekOne(state)[0] as Fixture;

    const strict = buildMatchSetup(state, fixture, config, { benchTuning: { coverThreshold: 0.9, tacticalLean: 0.5 } });
    const normal = buildMatchSetup(state, fixture, config);

    // Everything the match is built from is byte-identical.
    for (const side of ['home', 'away'] as const) {
      expect(hash(strict[side].players)).toBe(hash(normal[side].players));
      expect(strict[side].tactics).toEqual(normal[side].tactics);
      expect(strict[side].ruleCards).toEqual(normal[side].ruleCards);
      expect(strict[side].creatorPresence).toBe(normal[side].creatorPresence);
    }
    expect(strict.seed).toBe(normal.seed);
    expect(strict.attendance).toBe(normal.attendance);
    expect(strict.homeAdvantage).toBe(normal.homeAdvantage);
    expect({ ...strict.config, benchTuning: undefined }).toEqual({ ...normal.config, benchTuning: undefined });

    // Advancing a week with a tuning does not move world generation either:
    // the same clubs, the same players, the same fixtures.
    const run = (tuning?: { coverThreshold: number; tacticalLean: number }) => advanceCycle(state, {
      now: 1_700_000_000_000, registry: registry(), ledger: Ledger.restore(state.ledger),
      ...(tuning ? { benchTuning: tuning } : {}),
    }).state;
    const a = run();
    const b = run({ coverThreshold: 0.9, tacticalLean: 0.5 });
    expect(Object.keys(a.clubs)).toEqual(Object.keys(b.clubs));
    expect(Object.keys(a.players)).toEqual(Object.keys(b.players));
    expect(Object.keys(a.fixtures)).toEqual(Object.keys(b.fixtures));
    expect(a.seed).toBe(b.seed);
  });

  it('TEST 3: the same tuned experiment run twice is identical', () => {
    const config = registry().seasonConfig() as CreatorSeasonConfigDef;
    const run = (): string => {
      const out: string[] = [];
      for (const seed of ['rep-a', 'rep-b']) {
        const state = career(seed);
        for (const fixture of weekOne(state)) {
          const r = simulateMatch(buildMatchSetup(state, fixture, config, {
            benchTuning: { coverThreshold: 0.6, tacticalLean: 0.2 },
          }));
          out.push(`${fixture.id} ${r.homeScore}-${r.awayScore}`);
        }
      }
      return hash(out);
    };
    expect(run()).toBe(run());
    expect(run()).toBe(run());
  });

  it('TEST 4: the cover threshold genuinely gates who counts as cover', () => {
    // A defensive midfielder is 0.70 familiar with centre-back: cover at 0.6
    // and 0.7, not at 0.8. He is the only man who could answer the back line.
    const xi = XI();
    const screener = p('CDM', 62);
    const squadA = [...xi, screener, p('CM', 66), p('LW', 65), p('RW', 64), p('ST', 64), p('CAM', 63), p('GK', 55)];
    const roleOf = (squad: Player[], threshold: number, who: Player) =>
      selectMatchdayBench(squad, starters(xi), F, { tuning: { coverThreshold: threshold, tacticalLean: 0.12 } })
        .find((s) => s.player.id === who.id)?.role;
    expect(roleOf(squadA, 0.6, screener)).toBe('DEFENSIVE_COVER');
    expect(roleOf(squadA, 0.7, screener)).toBe('DEFENSIVE_COVER');
    expect(roleOf(squadA, 0.8, screener)).not.toBe('DEFENSIVE_COVER');

    // A left winger's only route into a 3-5-2 midfield is the left wing-back
    // slot, at 0.60: cover at 0.6, not at 0.7. The rest of the reserves are
    // strikers, who reach no midfield slot at all (0.45).
    const wingBacks = formationById('3-5-2');
    const xi11 = [p('GK', 70), p('CB', 70), p('CB', 70), p('CB', 69),
      p('LB', 70), p('CM', 70), p('CDM', 70), p('CM', 69), p('RB', 69), p('ST', 71), p('ST', 70)];
    const winger = p('LW', 62);
    const squadB = [...xi11, winger, p('ST', 66), p('ST', 65), p('ST', 64), p('ST', 63), p('ST', 62), p('GK', 55)];
    const roleIn = (threshold: number) =>
      selectMatchdayBench(squadB, starters(xi11, wingBacks), wingBacks, {
        tuning: { coverThreshold: threshold, tacticalLean: 0.12 },
      }).find((seat) => seat.player.id === winger.id)?.role;
    expect(roleIn(0.6)).toBe('MIDFIELD_COVER');
    expect(roleIn(0.7)).not.toBe('MIDFIELD_COVER');
  });

  it('TEST 5: the tactical lean is what separates a bold bench from a cautious one', () => {
    const eleven = formationById('4-3-3'); // DEF 4, MID 3, ATT 3 — lines that can tie
    const xi = [p('GK', 70), p('LB', 70), p('CB', 70), p('CB', 69), p('RB', 69),
      p('CDM', 70), p('CM', 70), p('CM', 69), p('LW', 70), p('ST', 71), p('RW', 69)];
    const spare = [p('GK', 60), p('CB', 66), p('CB', 65), p('LB', 64), p('CM', 66), p('CM', 65),
      p('CDM', 64), p('ST', 66), p('ST', 65), p('LW', 64), p('RW', 64)];
    const squad = [...xi, ...spare];
    const bench = (lean: number, risk: 'RECKLESS' | 'CAUTIOUS') =>
      ids(selectMatchdayBench(squad, starters(xi, eleven), eleven, {
        risk, tuning: { coverThreshold: 0.7, tacticalLean: lean },
      }));

    // Switched off, the manager's appetite for risk cannot reach the bench.
    expect(bench(0, 'RECKLESS')).toEqual(bench(0, 'CAUTIOUS'));
    // Switched on, it can.
    expect(bench(0.12, 'RECKLESS')).not.toEqual(bench(0.12, 'CAUTIOUS'));
    expect(bench(0.2, 'RECKLESS')).not.toEqual(bench(0.2, 'CAUTIOUS'));
    // And it never breaks the shape: seven seats either way.
    for (const lean of [0, 0.12, 0.2]) {
      for (const risk of ['RECKLESS', 'CAUTIOUS'] as const) expect(bench(lean, risk)).toHaveLength(7);
    }
  });

  it('TEST 6: a bench the manager named is untouched by every tuning', () => {
    const players = makeTestSquad(new Rng('agency-tuning'), { prefix: 'at', target: 64, benchSize: 10 });
    const auto = autoLineup(players, F);
    const started = new Set(Object.values(auto.lineup).filter(Boolean) as string[]);
    const named = players.filter((q) => !started.has(q.id as string)).slice(-5).map((q) => q.id) as PlayerId[];
    const team = (over: Partial<MatchTeam> = {}): MatchTeam => ({
      ...makeTestTeam(new Rng('agency-tuning'), { prefix: 'at', name: 'Agency', target: 64 }),
      players, isPlayerControlled: true, tactics: { ...auto, bench: named }, ...over,
    });
    for (const tuning of [
      undefined,
      DEFAULT_BENCH_TUNING,
      { coverThreshold: 0.6, tacticalLean: 0 },
      { coverThreshold: 0.8, tacticalLean: 0.2 },
      { coverThreshold: 0.95, tacticalLean: 0.5 },
    ]) {
      const sim = new MatchSimulator(makeTestSetup({
        seed: 'agency-tuning', home: team(),
        away: makeTestTeam(new Rng('agency-opp'), { prefix: 'ao', name: 'Opposition', target: 62 }),
        config: { maxDecisions: 0, ...(tuning ? { benchTuning: tuning } : {}) },
      }));
      expect(sim.substitutionStatus('home').bench.map((s) => s.playerId)).toEqual(named);
    }
  });

  it('TEST 7: the default path is unchanged — the reference world and result hashes still hold', () => {
    const config = registry().seasonConfig() as CreatorSeasonConfigDef;
    const worlds: string[] = [];
    const results: string[] = [];
    for (const seed of ['smoke', 'store-test', 'hash-b']) {
      const state = career(seed);
      worlds.push(`${seed} new=${hash(state)}`);
      for (const fixture of weekOne(state)) {
        const r = simulateMatch(buildMatchSetup(state, fixture, config));
        results.push(`${fixture.id} ${r.homeScore}-${r.awayScore}`);
      }
    }
    // Only a deliberate balance change may move these, and never a measurement
    // harness. They last moved when AI clubs stopped all playing 2-3-1 and
    // started choosing a shape from their squad and their own tactics, which
    // rewrites `club.tactics.formationId` in every generated world and with it
    // every match played there. See docs/experiments/formation-identity/.
    expect(worlds).toEqual([
      'smoke new=b378fb9ce5e26797',
      'store-test new=79ecbaa490b5117c',
      'hash-b new=bb9281d22753dcd0',
    ]);
    expect(hash(results)).toBe('732f0e5c967232b5');
  });
});
