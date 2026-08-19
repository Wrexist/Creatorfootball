import type { ClubId, CompetitionId, FixtureId, SeasonId } from '../core/brand';
import { asId } from '../core/brand';
import type { SeasonPhase } from '../core/clock';
import type { Rng } from '../core/rng';
import type { Fixture } from './types';
import type { SpecialRuleId } from '../matches/specialRules';

/**
 * Fixture generation.
 *
 * The season is a compressed campaign, not a real-world calendar: the schedule
 * advances when the player completes a match cycle. We use a circle-method
 * round robin so every club plays every other the configured number of times
 * with a balanced home/away split, then overlay the narrative phase calendar so
 * that rivalry weeks, the transfer window and the run-in land at dramatically
 * useful points rather than at random.
 */

export interface FixtureGenOptions {
  readonly competitionId: CompetitionId;
  readonly seasonId: SeasonId;
  readonly clubIds: readonly ClubId[];
  readonly rounds: number;
  /** Pairs that should be flagged as derbies, in either order. */
  readonly rivalPairs: readonly (readonly [ClubId, ClubId])[];
  readonly enabledSpecialRules: readonly SpecialRuleId[];
  /** Rules only fire in designated weeks so they stay special. */
  readonly specialRuleWeeks: readonly number[];
}

const isRival = (
  pairs: readonly (readonly [ClubId, ClubId])[],
  a: ClubId,
  b: ClubId,
): boolean => pairs.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

/**
 * Circle method: fix one club, rotate the rest. Produces n-1 rounds of n/2
 * matches for an even club count, adding a bye if odd.
 */
function roundRobin(clubIds: readonly ClubId[]): (readonly [ClubId, ClubId])[][] {
  const teams = clubIds.slice();
  const hasBye = teams.length % 2 === 1;
  if (hasBye) teams.push(asId<ClubId>('__BYE__'));

  const n = teams.length;
  const roundsCount = n - 1;
  const half = n / 2;
  const rotating = teams.slice(1);
  const out: (readonly [ClubId, ClubId])[][] = [];

  for (let r = 0; r < roundsCount; r++) {
    const round: (readonly [ClubId, ClubId])[] = [];
    const ordered = [teams[0] as ClubId, ...rotating];
    for (let i = 0; i < half; i++) {
      const home = ordered[i] as ClubId;
      const away = ordered[n - 1 - i] as ClubId;
      if (home === '__BYE__' || away === '__BYE__') continue;
      // Alternate home advantage by round so no club front-loads home games.
      round.push(r % 2 === 0 ? [home, away] : [away, home]);
    }
    out.push(round);
    rotating.unshift(rotating.pop() as ClubId);
  }
  return out;
}

/**
 * The narrative calendar. Rather than "week 7 of 22", the player experiences
 * named beats. Phases are distributed proportionally so a 22-week season and a
 * 10-week season both feel like a campaign.
 */
export function phaseForWeek(week: number, totalWeeks: number): SeasonPhase {
  const t = week / Math.max(1, totalWeeks);
  if (week === 0) return 'PRE_SEASON';
  if (t <= 0.14) return 'OPENING_FIXTURES';
  if (t <= 0.22) return 'RIVALRY_WEEK';
  if (t <= 0.34) return 'TRANSFER_WINDOW';
  if (t <= 0.42) return 'CREATOR_EVENT';
  if (t <= 0.6) return 'MID_SEASON_PUSH';
  if (t <= 0.68) return 'DERBY_WEEK';
  if (t <= 0.85) return 'PLAYOFF_PUSH';
  if (t < 1) return 'FINAL_WEEK';
  return 'PLAYOFFS';
}

export function generateFixtures(opts: FixtureGenOptions, rng: Rng): Fixture[] {
  const { competitionId, seasonId, clubIds, rounds } = opts;
  const base = roundRobin(rng.shuffle(clubIds));
  const allRounds: (readonly [ClubId, ClubId])[][] = [];

  for (let cycle = 0; cycle < rounds; cycle++) {
    for (const round of base) {
      // Reverse the fixture on alternate cycles so the return leg swaps venue.
      allRounds.push(cycle % 2 === 0 ? round : round.map(([h, a]) => [a, h] as const));
    }
  }

  const totalWeeks = allRounds.length;
  const fixtures: Fixture[] = [];
  let seq = 0;

  allRounds.forEach((round, index) => {
    const week = index + 1;
    const phase = phaseForWeek(week, totalWeeks);
    const ruleWeek = opts.specialRuleWeeks.includes(week);

    for (const [homeClubId, awayClubId] of round) {
      const derby = isRival(opts.rivalPairs, homeClubId, awayClubId);
      // Importance rises with rivalry and with how late in the season it falls;
      // the final weeks matter to everyone regardless of who is playing.
      const lateness = week / totalWeeks;
      let importance = 2;
      if (derby) importance += 2;
      if (lateness > 0.85) importance += 1;
      else if (lateness > 0.65) importance += 0.5;
      if (phase === 'RIVALRY_WEEK' || phase === 'DERBY_WEEK') importance += 0.5;

      fixtures.push({
        id: asId<FixtureId>(`fx_${seasonId}_${(seq++).toString(36)}`),
        competitionId,
        seasonId,
        week,
        phase,
        homeClubId,
        awayClubId,
        status: 'SCHEDULED',
        matchId: null,
        homeScore: null,
        awayScore: null,
        importance: Math.max(1, Math.min(5, Math.round(importance))),
        isDerby: derby,
        enabledSpecialRules: ruleWeek ? opts.enabledSpecialRules : [],
      });
    }
  });

  return fixtures;
}

/** Knockout bracket for the end-of-season playoff. Seeded by league position. */
export function generatePlayoffFixtures(
  seeds: readonly ClubId[],
  opts: { competitionId: CompetitionId; seasonId: SeasonId; startWeek: number; enabledSpecialRules: readonly SpecialRuleId[] },
): Fixture[] {
  const out: Fixture[] = [];
  const n = seeds.length;
  if (n < 2) return out;

  const labelFor = (remaining: number): string =>
    remaining === 2 ? 'Final' : remaining === 4 ? 'Semi-Final' : remaining === 8 ? 'Quarter-Final' : `Round of ${remaining}`;

  // Only the first round can be scheduled up front; later rounds are created as
  // results arrive, because the participants are not yet known.
  const label = labelFor(n);
  for (let i = 0; i < n / 2; i++) {
    const home = seeds[i] as ClubId;
    const away = seeds[n - 1 - i] as ClubId;
    out.push({
      id: asId<FixtureId>(`fx_${opts.seasonId}_po_${label.toLowerCase().replace(/\W+/g, '')}_${i}`),
      competitionId: opts.competitionId,
      seasonId: opts.seasonId,
      week: opts.startWeek,
      phase: 'PLAYOFFS',
      homeClubId: home,
      awayClubId: away,
      status: 'SCHEDULED',
      matchId: null,
      homeScore: null,
      awayScore: null,
      importance: 5,
      isDerby: false,
      stageLabel: label,
      enabledSpecialRules: opts.enabledSpecialRules,
    });
  }
  return out;
}

/** Every club must play every other club exactly `rounds` times, half at home. */
export function verifyFixtures(fixtures: readonly Fixture[], clubIds: readonly ClubId[], rounds: number): string[] {
  const problems: string[] = [];
  const counts = new Map<string, number>();
  const homeCounts = new Map<string, number>();

  for (const f of fixtures) {
    if (f.homeClubId === f.awayClubId) problems.push(`Fixture ${f.id} has a club playing itself`);
    const key = [f.homeClubId, f.awayClubId].sort().join('|');
    counts.set(key, (counts.get(key) ?? 0) + 1);
    homeCounts.set(f.homeClubId, (homeCounts.get(f.homeClubId) ?? 0) + 1);
  }

  for (let i = 0; i < clubIds.length; i++) {
    for (let j = i + 1; j < clubIds.length; j++) {
      const key = [clubIds[i] as string, clubIds[j] as string].sort().join('|');
      const played = counts.get(key) ?? 0;
      if (played !== rounds) {
        problems.push(`${clubIds[i]} vs ${clubIds[j]} scheduled ${played} times, expected ${rounds}`);
      }
    }
  }

  const expectedHome = ((clubIds.length - 1) * rounds) / 2;
  for (const clubId of clubIds) {
    const home = homeCounts.get(clubId) ?? 0;
    // Allow a one-game imbalance: with an odd round count a perfect split is impossible.
    if (Math.abs(home - expectedHome) > 1) {
      problems.push(`${clubId} has ${home} home fixtures, expected about ${expectedHome}`);
    }
  }

  return problems;
}
