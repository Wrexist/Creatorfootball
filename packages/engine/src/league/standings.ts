import type { ClubId } from '../core/brand';
import type { Fixture, StandingRow } from './types';

/**
 * Standings are derived, never stored. Any screen can recompute them from the
 * fixture list, which means the table can never drift out of sync with results —
 * a class of bug that plagues manager games.
 */

export interface StandingsOptions {
  readonly playoffSpots: number;
  readonly relegationSpots: number;
  /** Ordering after points. Head-to-head is applied before goal difference. */
  readonly tiebreak?: 'GD_FIRST' | 'H2H_FIRST';
}

interface Accumulator {
  clubId: ClubId;
  played: number; won: number; drawn: number; lost: number;
  goalsFor: number; goalsAgainst: number;
  form: ('W' | 'D' | 'L')[];
}

export function computeStandings(
  clubIds: readonly ClubId[],
  fixtures: readonly Fixture[],
  opts: StandingsOptions,
): StandingRow[] {
  const acc = new Map<string, Accumulator>();
  for (const clubId of clubIds) {
    acc.set(clubId, {
      clubId, played: 0, won: 0, drawn: 0, lost: 0,
      goalsFor: 0, goalsAgainst: 0, form: [],
    });
  }

  const played = fixtures
    .filter((f) => f.status === 'COMPLETED' && f.homeScore !== null && f.awayScore !== null)
    .slice()
    .sort((a, b) => a.week - b.week);

  const headToHead = new Map<string, number>();

  for (const f of played) {
    const home = acc.get(f.homeClubId);
    const away = acc.get(f.awayClubId);
    if (!home || !away) continue;
    const hs = f.homeScore as number;
    const as = f.awayScore as number;

    home.played++; away.played++;
    home.goalsFor += hs; home.goalsAgainst += as;
    away.goalsFor += as; away.goalsAgainst += hs;

    if (hs > as) {
      home.won++; away.lost++;
      home.form.push('W'); away.form.push('L');
      headToHead.set(`${f.homeClubId}>${f.awayClubId}`, (headToHead.get(`${f.homeClubId}>${f.awayClubId}`) ?? 0) + 3);
    } else if (hs < as) {
      away.won++; home.lost++;
      away.form.push('W'); home.form.push('L');
      headToHead.set(`${f.awayClubId}>${f.homeClubId}`, (headToHead.get(`${f.awayClubId}>${f.homeClubId}`) ?? 0) + 3);
    } else {
      home.drawn++; away.drawn++;
      home.form.push('D'); away.form.push('D');
      headToHead.set(`${f.homeClubId}>${f.awayClubId}`, (headToHead.get(`${f.homeClubId}>${f.awayClubId}`) ?? 0) + 1);
      headToHead.set(`${f.awayClubId}>${f.homeClubId}`, (headToHead.get(`${f.awayClubId}>${f.homeClubId}`) ?? 0) + 1);
    }
  }

  const rows = [...acc.values()].map((a) => ({
    ...a,
    points: a.won * 3 + a.drawn,
    goalDifference: a.goalsFor - a.goalsAgainst,
  }));

  rows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (opts.tiebreak === 'H2H_FIRST') {
      const ab = headToHead.get(`${a.clubId}>${b.clubId}`) ?? 0;
      const ba = headToHead.get(`${b.clubId}>${a.clubId}`) ?? 0;
      if (ab !== ba) return ba - ab;
    }
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    // Final tiebreak is alphabetical by id: arbitrary, but stable across renders.
    return a.clubId < b.clubId ? -1 : 1;
  });

  const total = rows.length;
  return rows.map((r, index) => {
    const position = index + 1;
    let zone: StandingRow['zone'] = 'MID';
    if (position === 1) zone = 'CHAMPION';
    else if (position <= opts.playoffSpots) zone = 'PLAYOFF';
    else if (position > total - opts.relegationSpots) zone = 'RELEGATION';

    return {
      clubId: r.clubId,
      position,
      played: r.played,
      won: r.won,
      drawn: r.drawn,
      lost: r.lost,
      goalsFor: r.goalsFor,
      goalsAgainst: r.goalsAgainst,
      goalDifference: r.goalDifference,
      points: r.points,
      form: r.form.slice(-5),
      zone,
    };
  });
}

/** The number the home screen leads with: "one win from first". */
export function positionContext(
  standings: readonly StandingRow[],
  clubId: ClubId,
): { position: number; pointsToAbove: number | null; pointsFromBelow: number | null; zone: StandingRow['zone'] } | null {
  const index = standings.findIndex((r) => r.clubId === clubId);
  if (index < 0) return null;
  const row = standings[index] as StandingRow;
  const above = index > 0 ? (standings[index - 1] as StandingRow) : null;
  const below = index < standings.length - 1 ? (standings[index + 1] as StandingRow) : null;
  return {
    position: row.position,
    pointsToAbove: above ? above.points - row.points : null,
    pointsFromBelow: below ? row.points - below.points : null,
    zone: row.zone,
  };
}
