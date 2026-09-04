import { describe, expect, it } from 'vitest';
import {
  ContentRegistry, MatchSimulator, buildMatchSetup, createNewGame,
  type CreatorSeasonConfigDef, type Fixture, type GameState,
} from '@cf/engine';
import { BASE_PACK } from '@cf/engine/content/packs/base/index';
import { buildMatchdayContext } from './context';

/**
 * The bench on the preview is the bench in the match.
 *
 * A manager reads the team sheet before kick-off, decides who he is willing to
 * bring on, and then opens the substitution sheet at 2-1 down. If those two
 * screens are answering the question with different code they will disagree,
 * and the disagreement is invisible until the moment it costs a game. It used
 * to: the preview showed the seven highest-rated reserves and the simulator
 * played whoever squad order or the auto-sheet gave it, and across seventy-two
 * measured benches they never once matched.
 *
 * `buildMatchdayContext` is a hook-free derivation, so it can be run here
 * directly against a real career.
 */

const registry = (): ContentRegistry => {
  const r = new ContentRegistry();
  r.load(BASE_PACK);
  return r;
};

const career = (seed: string): GameState => createNewGame({
  registry: registry(), seed, now: 1_700_000_000_000,
  manager: { kind: 'PREMADE', templateId: 'manager_vera_lindqvist' },
  club: { kind: 'TEMPLATE', templateId: 'club_cinderwick_town' },
});

describe('preview and simulator agree on the bench', () => {
  it('names the same seven, in the same order, for every fixture of the opening weeks', () => {
    const reg = registry();
    const config = reg.seasonConfig() as CreatorSeasonConfigDef;
    let checked = 0;

    for (const seed of ['smoke', 'store-test', 'hash-b']) {
      const state = career(seed);
      const season = state.seasons[state.currentSeasonId];
      const ours = Object.values(state.fixtures).filter((f): f is Fixture =>
        f.seasonId === season?.id && f.week <= 3
        && (f.homeClubId === state.playerClubId || f.awayClubId === state.playerClubId));
      expect(ours.length).toBeGreaterThan(0);

      for (const fixture of ours) {
        const context = buildMatchdayContext(state, fixture.id);
        expect(context).not.toBeNull();
        const sim = new MatchSimulator(buildMatchSetup(state, fixture, config, { live: true }));
        const side = fixture.homeClubId === state.playerClubId ? 'home' : 'away';
        const bench = sim.substitutionStatus(side).bench.map((s) => s.playerId as string);
        expect(context!.bench.map((p) => p.id as string)).toEqual(bench);
        expect(bench.length).toBe(config.benchSize);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThanOrEqual(6);
  });
});
