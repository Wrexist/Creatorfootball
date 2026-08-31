import { describe, expect, it } from 'vitest';
import {
  createNewGame, isMatchResultApplied, asId,
  type GameState, type MatchId, type Fixture,
} from '../src/index';

const newCareer = (seed: string): GameState =>
  createNewGame({
    seed,
    now: 1_700_000_000_000,
    manager: { kind: 'PREMADE', templateId: 'manager_vera_lindqvist' },
    club: { kind: 'TEMPLATE', templateId: 'club_cinderwick_town' },
  });

const firstFixture = (s: GameState): Fixture =>
  Object.values(s.fixtures).sort((a, b) => a.id.localeCompare(b.id))[0] as Fixture;

describe('match result commit guard', () => {
  /**
   * The reason the guard cannot be a process-lifetime set of match ids: those
   * ids are not unique to a career. Fixtures are named from a season id that
   * is hardcoded to `season_1` for every new game, so two different careers
   * produce the same first match id.
   */
  it('produces colliding match ids across two different careers', () => {
    const a = newCareer('seed-alpha');
    const b = newCareer('seed-bravo');

    expect(a.saveId).not.toBe(b.saveId);
    expect(firstFixture(a).id).toBe(firstFixture(b).id);
  });

  it('reports an unplayed fixture as not yet applied', () => {
    const s = newCareer('seed-alpha');
    const fixture = firstFixture(s);
    expect(fixture.status).toBe('SCHEDULED');
    expect(isMatchResultApplied(s, asId<MatchId>(`match_${fixture.id}`))).toBe(false);
  });

  it('reports a completed fixture as applied, so a remount cannot advance twice', () => {
    const s = newCareer('seed-alpha');
    const fixture = firstFixture(s);
    const matchId = asId<MatchId>(`match_${fixture.id}`);

    const played: GameState = {
      ...s,
      fixtures: {
        ...s.fixtures,
        [fixture.id]: { ...fixture, status: 'COMPLETED', matchId, homeScore: 2, awayScore: 1 },
      },
    };

    expect(isMatchResultApplied(played, matchId)).toBe(true);
  });

  /**
   * The bug this replaces: career A plays its first match, career B is started
   * in the same session, and B's identically-named first result is treated as
   * already committed and silently dropped. Deriving the answer from the world
   * gets it right because B's own fixture is still scheduled.
   */
  it('does not carry one career’s played matches into another', () => {
    const a = newCareer('seed-alpha');
    const fixture = firstFixture(a);
    const matchId = asId<MatchId>(`match_${fixture.id}`);
    const playedA: GameState = {
      ...a,
      fixtures: {
        ...a.fixtures,
        [fixture.id]: { ...fixture, status: 'COMPLETED', matchId, homeScore: 2, awayScore: 1 },
      },
    };
    expect(isMatchResultApplied(playedA, matchId)).toBe(true);

    const b = newCareer('seed-bravo');
    expect(isMatchResultApplied(b, matchId)).toBe(false);
  });

  it('ignores a fixture that carries the id but was never completed', () => {
    const s = newCareer('seed-alpha');
    const fixture = firstFixture(s);
    const matchId = asId<MatchId>(`match_${fixture.id}`);
    const inProgress: GameState = {
      ...s,
      fixtures: { ...s.fixtures, [fixture.id]: { ...fixture, status: 'IN_PROGRESS', matchId } },
    };
    expect(isMatchResultApplied(inProgress, matchId)).toBe(false);
  });
});
