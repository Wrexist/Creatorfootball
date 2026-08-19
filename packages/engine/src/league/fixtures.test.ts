import { describe, expect, it } from 'vitest';
import { asId, type ClubId, type CompetitionId, type SeasonId } from '../core/brand';
import { Rng } from '../core/rng';
import { generateFixtures, phaseForWeek, verifyFixtures } from './fixtures';
import { computeStandings, positionContext } from './standings';
import type { Fixture } from './types';

const clubs = (n: number): ClubId[] =>
  Array.from({ length: n }, (_, i) => asId<ClubId>(`club_${i}`));

const opts = (clubIds: readonly ClubId[], rounds: number) => ({
  competitionId: asId<CompetitionId>('comp_1'),
  seasonId: asId<SeasonId>('season_1'),
  clubIds,
  rounds,
  rivalPairs: [[clubIds[0] as ClubId, clubIds[1] as ClubId]] as const,
  enabledSpecialRules: [] as const,
  specialRuleWeeks: [4, 12] as const,
});

describe('fixture generation', () => {
  it('schedules a complete double round robin for 12 clubs', () => {
    const ids = clubs(12);
    const fixtures = generateFixtures(opts(ids, 2), new Rng('seed'));
    expect(fixtures).toHaveLength((12 * 11) / 2 * 2);
    expect(verifyFixtures(fixtures, ids, 2)).toEqual([]);
  });

  it('handles an odd club count without scheduling a club against itself', () => {
    const ids = clubs(11);
    const fixtures = generateFixtures(opts(ids, 2), new Rng('seed'));
    expect(fixtures.every((f) => f.homeClubId !== f.awayClubId)).toBe(true);
    expect(verifyFixtures(fixtures, ids, 2)).toEqual([]);
  });

  it('is deterministic for a given seed', () => {
    const ids = clubs(12);
    const a = generateFixtures(opts(ids, 2), new Rng('same'));
    const b = generateFixtures(opts(ids, 2), new Rng('same'));
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });

  it('produces a different schedule for a different seed', () => {
    const ids = clubs(12);
    const a = generateFixtures(opts(ids, 2), new Rng('one'));
    const b = generateFixtures(opts(ids, 2), new Rng('two'));
    expect(JSON.stringify(a)).not.toEqual(JSON.stringify(b));
  });

  it('marks declared rivals as derbies and raises their importance', () => {
    const ids = clubs(12);
    const fixtures = generateFixtures(opts(ids, 2), new Rng('seed'));
    const derbies = fixtures.filter((f) => f.isDerby);
    expect(derbies).toHaveLength(2);
    for (const d of derbies) expect(d.importance).toBeGreaterThanOrEqual(4);
  });

  it('walks the narrative calendar from opening fixtures to the run-in', () => {
    expect(phaseForWeek(0, 22)).toBe('PRE_SEASON');
    expect(phaseForWeek(1, 22)).toBe('OPENING_FIXTURES');
    expect(phaseForWeek(22, 22)).toBe('PLAYOFFS');
    const phases = Array.from({ length: 22 }, (_, i) => phaseForWeek(i + 1, 22));
    expect(new Set(phases).size).toBeGreaterThanOrEqual(6);
  });

  it('only enables special rules on designated weeks', () => {
    const ids = clubs(12);
    const fixtures = generateFixtures(
      { ...opts(ids, 2), enabledSpecialRules: ['DOUBLE_GOAL'] as const },
      new Rng('seed'),
    );
    const withRules = fixtures.filter((f) => f.enabledSpecialRules.length > 0);
    expect(withRules.every((f) => [4, 12].includes(f.week))).toBe(true);
    expect(withRules.length).toBeGreaterThan(0);
  });
});

const completed = (f: Fixture, home: number, away: number): Fixture => ({
  ...f, status: 'COMPLETED', homeScore: home, awayScore: away,
});

describe('standings', () => {
  it('orders by points, then goal difference, then goals scored', () => {
    const ids = clubs(4);
    const base = generateFixtures(opts(ids, 1), new Rng('table'));
    const played = base.map((f, i) => completed(f, i % 3, (i + 1) % 2));
    const table = computeStandings(ids, played, { playoffSpots: 2, relegationSpots: 1 });

    expect(table).toHaveLength(4);
    for (let i = 1; i < table.length; i++) {
      const above = table[i - 1]!;
      const below = table[i]!;
      expect(above.points).toBeGreaterThanOrEqual(below.points);
      if (above.points === below.points) {
        expect(above.goalDifference).toBeGreaterThanOrEqual(below.goalDifference);
      }
    }
    expect(table[0]!.position).toBe(1);
    expect(table[0]!.zone).toBe('CHAMPION');
    expect(table[3]!.zone).toBe('RELEGATION');
  });

  it('ignores fixtures that have not been played', () => {
    const ids = clubs(4);
    const fixtures = generateFixtures(opts(ids, 1), new Rng('table'));
    const table = computeStandings(ids, fixtures, { playoffSpots: 2, relegationSpots: 1 });
    expect(table.every((r) => r.played === 0 && r.points === 0)).toBe(true);
  });

  it('keeps only the last five results in the form guide', () => {
    const ids = clubs(12);
    const fixtures = generateFixtures(opts(ids, 2), new Rng('form'))
      .map((f) => completed(f, 2, 0));
    const table = computeStandings(ids, fixtures, { playoffSpots: 4, relegationSpots: 2 });
    expect(table.every((r) => r.form.length <= 5)).toBe(true);
  });

  it('reports how far a club is from the place above', () => {
    const ids = clubs(4);
    const fixtures = generateFixtures(opts(ids, 1), new Rng('ctx')).map((f, i) => completed(f, i, 0));
    const table = computeStandings(ids, fixtures, { playoffSpots: 2, relegationSpots: 1 });
    const second = table[1]!;
    const ctx = positionContext(table, second.clubId);
    expect(ctx?.position).toBe(2);
    expect(ctx?.pointsToAbove).toBe(table[0]!.points - second.points);
  });

  it('every club appears exactly once regardless of results', () => {
    const ids = clubs(12);
    const fixtures = generateFixtures(opts(ids, 2), new Rng('dupes')).map((f) => completed(f, 1, 1));
    const table = computeStandings(ids, fixtures, { playoffSpots: 4, relegationSpots: 2 });
    expect(new Set(table.map((r) => r.clubId)).size).toBe(12);
  });
});
