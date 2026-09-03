import { describe, expect, it } from 'vitest';
import { Rng } from '../core/rng';
import { MatchSimulator } from './simulator';
import { makeTestPlayer, makeTestSetup, makeTestSquad, makeTestTeam } from './testSupport';
import { DEFAULT_FORMATION_ID, autoLineup, formationById, selectMatchdayBench } from '../tactics/formations';
import { positionGroup } from '../players/positions';
import type { Position } from '../players/positions';
import type { MatchTeam } from './simulator';
import type { Player } from '../players/player';
import type { PlayerId } from '../core/brand';

/**
 * The bench the simulator plays with is the bench that was chosen.
 *
 * The selector in `formations.ts` decides who sits down; this file is about the
 * three ways that decision can be lost on the way to the pitch. It can be
 * ignored by the simulator, which used to fill any empty seats from squad
 * order. It can be overruled, which would take the manager's own team sheet
 * away from them. And it can be applied to the player's club but not to the
 * eleven other clubs, which would quietly make every opponent's bench worse
 * than the player's.
 */

const squadOf = (team: MatchTeam): readonly Player[] => team.players;

function team(seed: string, name: string, over: Partial<MatchTeam> = {}): MatchTeam {
  return { ...makeTestTeam(new Rng(seed), { prefix: seed, name, target: 64 }), ...over };
}

/** The bench the simulator will actually accept substitutions from. */
const simBench = (sim: MatchSimulator, side: 'home' | 'away'): string[] =>
  sim.substitutionStatus(side).bench.map((s) => s.playerId as string);

describe('the bench reaches the pitch', () => {
  it('TEST 16: a club with no team sheet at all still gets a chosen bench, not squad order', () => {
    const players = makeTestSquad(new Rng('sheetless'), { prefix: 'sl', target: 64, benchSize: 10 });
    const formation = formationById(DEFAULT_FORMATION_ID);
    const blank = team('blank', 'Blankham', {
      players,
      tactics: { ...autoLineup(players, formation), lineup: {}, bench: [] },
    });
    const sim = new MatchSimulator(makeTestSetup({ seed: 'blank-sheet', home: blank, away: team('opp1', 'Opposition') }));
    const bench = simBench(sim, 'home');
    const byId = new Map(players.map((p) => [p.id as string, p]));
    const lines = new Set(bench.map((id) => positionGroup(byId.get(id)!.position)));
    expect(bench.length).toBe(7);
    expect(lines).toEqual(new Set(['GK', 'DEF', 'MID', 'ATT']));
    // Squad order would have taken the first seven names not already playing.
    const started = new Set(sim.frame().players.filter((p) => p.side === 'home').map((p) => p.playerId as string));
    const squadOrder = players.filter((p) => !started.has(p.id as string)).slice(0, 7).map((p) => p.id as string);
    expect(bench).not.toEqual(squadOrder);
  });

  it('TEST 17: a full eleven with an empty bench is given cover, not the next names on the list', () => {
    // A squad whose reserves are listed worst-first and stacked with one line:
    // squad order names seven midfielders and leaves the goal uncovered.
    const rng = new Rng('full-xi');
    let i = 0;
    const make = (position: Position, target: number): Player =>
      makeTestPlayer(rng.fork(`fx${i}`), { id: `fx_${String(i++).padStart(2, '0')}`, position, target });
    const xi = (['GK', 'CB', 'CB', 'CM', 'LW', 'RW', 'ST'] as Position[]).map((q) => make(q, 68));
    const reserves = ([['CM', 60], ['CM', 60], ['CM', 59], ['CAM', 59], ['CDM', 58], ['CM', 58], ['CM', 57],
      ['GK', 56], ['CB', 56], ['ST', 55]] as [Position, number][]).map(([q, t]) => make(q, t));
    const players = [...xi, ...reserves];
    const formation = formationById(DEFAULT_FORMATION_ID);
    const auto = autoLineup(players, formation);
    const filed = team('filed', 'Filedon', { players, tactics: { ...auto, bench: [] } });
    const sim = new MatchSimulator(makeTestSetup({ seed: 'full-xi', home: filed, away: team('opp2', 'Opposition') }));
    const bench = simBench(sim, 'home');
    const byId = new Map(players.map((p) => [p.id as string, p]));
    expect(bench.length).toBe(7);
    expect(new Set(bench.map((id) => positionGroup(byId.get(id)!.position)))).toEqual(new Set(['GK', 'DEF', 'MID', 'ATT']));
  });

  it('TEST 18: player agency — a bench the manager named is played exactly as named', () => {
    const players = makeTestSquad(new Rng('agency'), { prefix: 'ag', target: 64, benchSize: 10 });
    const formation = formationById(DEFAULT_FORMATION_ID);
    const auto = autoLineup(players, formation);
    const started = new Set(Object.values(auto.lineup).filter(Boolean) as string[]);
    // A deliberately odd bench: five names, the manager's own order, and one of
    // them a choice the selector would not have made.
    const chosen = players.filter((p) => !started.has(p.id as string)).slice(-5).map((p) => p.id);
    const managed = team('managed', 'Managedale', {
      players, isPlayerControlled: true, tactics: { ...auto, bench: chosen as readonly PlayerId[] },
    });
    const sim = new MatchSimulator(makeTestSetup({ seed: 'agency', home: managed, away: team('opp3', 'Opposition') }));
    expect(simBench(sim, 'home')).toEqual(chosen.map((id) => id as string));
  });

  it('TEST 19: simulator consistency — the bench the status reports is the selector\'s own answer', () => {
    const players = makeTestSquad(new Rng('consistent'), { prefix: 'cs', target: 64, benchSize: 10 });
    const formation = formationById(DEFAULT_FORMATION_ID);
    const blank = team('cons', 'Consistent', { players, tactics: { ...autoLineup(players, formation), lineup: {}, bench: [] } });
    const sim = new MatchSimulator(makeTestSetup({ seed: 'consistent', home: blank, away: team('opp4', 'Opposition') }));

    const onPitch = sim.frame().players.filter((p) => p.side === 'home');
    const byId = new Map(players.map((p) => [p.id as string, p]));
    const starters = onPitch.map((u, i) => ({
      slot: formation.slots[i] as (typeof formation.slots)[number],
      player: byId.get(u.playerId as string) as Player,
    }));
    // Rebuild the starters from the slots the simulator actually used.
    const rebuilt = selectMatchdayBench(players, starters, formation, { size: 7 });
    expect(simBench(sim, 'home').sort()).toEqual(rebuilt.map((s) => s.player.id as string).sort());
  });

  it('TEST 20: AI club consistency — an opponent nobody is watching gets the same bench treatment', () => {
    const players = makeTestSquad(new Rng('ai-club'), { prefix: 'ai', target: 64, benchSize: 10 });
    const formation = formationById(DEFAULT_FORMATION_ID);
    const tactics = { ...autoLineup(players, formation), lineup: {}, bench: [] };
    const asAi = team('ai', 'Autonoma', { players, tactics, isPlayerControlled: false });
    const asPlayer = team('ai', 'Autonoma', { players, tactics, isPlayerControlled: true });

    const aiSim = new MatchSimulator(makeTestSetup({ seed: 'ai-club', home: asAi, away: team('opp5', 'Opposition') }));
    const playerSim = new MatchSimulator(makeTestSetup({ seed: 'ai-club', home: asPlayer, away: team('opp5', 'Opposition') }));
    expect(simBench(aiSim, 'home')).toEqual(simBench(playerSim, 'home'));

    // And both sides of a fixture, not just the nominal home team.
    const away = simBench(aiSim, 'away');
    const byId = new Map(squadOf(aiSim.setup.away).map((p) => [p.id as string, p]));
    expect(new Set(away.map((id) => positionGroup(byId.get(id)!.position)))).toEqual(new Set(['GK', 'DEF', 'MID', 'ATT']));
  });
});
