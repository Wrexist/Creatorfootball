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
   * This asserted the opposite until entity ids were scoped to the career that
   * created them: fixtures were named from a season id hardcoded to `season_1`,
   * so two careers produced the same first match id. That collision is what
   * made a process-lifetime set of match ids unsafe as a guard, and the test
   * was written to fail loudly the day it was fixed. This is that day.
   */
  it('gives two careers distinct fixture and match ids', () => {
    const a = newCareer('seed-alpha');
    const b = newCareer('seed-bravo');

    expect(a.saveId).not.toBe(b.saveId);
    expect(a.idToken).not.toBe(b.idToken);
    expect(firstFixture(a).id).not.toBe(firstFixture(b).id);
    expect(a.playerClubId).not.toBe(b.playerClubId);
  });

  /** Uniqueness must not have cost determinism: same inputs, same world. */
  it('is still byte-identical for identical inputs', () => {
    expect(JSON.stringify(newCareer('seed-alpha'))).toBe(JSON.stringify(newCareer('seed-alpha')));
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
   * gets it right because B's own fixture is still scheduled — and now the ids
   * differ too, so the same mistake would need both defences to fail.
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
