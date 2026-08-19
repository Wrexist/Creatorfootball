import { describe, expect, it } from 'vitest';
import type { Club } from '../clubs/club';
import { Rng } from '../core/rng';
import { makeClub } from '../economy/testing';
import { attendanceFor, matchdayRevenue, priceFactor, updateFanState, type FanInputs } from './fans';

const inputs = (over: Partial<FanInputs> = {}): FanInputs => ({
  cycle: 0,
  recentResults: [],
  leaguePosition: 6,
  leagueSize: 12,
  reputation: 50,
  creatorReach: 900_000,
  creatorFanConversion: 0.4,
  entertainment: 0.5,
  starAppeal: 0.3,
  ticketPrice: 14,
  netTransferSpend: 0,
  marqueeSignings: 0,
  cultHeroesSold: 0,
  stadiumCapacity: 8_000,
  ...over,
});

/** Run the loop for n cycles, feeding the club's own new fan state back in. */
function runLoop(
  club: Club,
  n: number,
  per: (cycle: number) => Partial<FanInputs>,
  seed = 'loop',
): { club: Club; history: number[]; expectations: number[] } {
  const rng = new Rng(seed);
  let current = club;
  const history: number[] = [];
  const expectations: number[] = [];
  for (let cycle = 0; cycle < n; cycle++) {
    const fans = updateFanState(current, inputs({ cycle, ...per(cycle) }), rng);
    current = { ...current, fans };
    history.push(fans.sentiment);
    expectations.push(fans.expectation);
  }
  return { club: current, history, expectations };
}

describe('the fan loop', () => {
  it('stabilises rather than exploding over 100 cycles of relentless success', () => {
    const club = makeClub({ id: 'winners', reputation: 62 });
    const { club: after, history, expectations } = runLoop(club, 100, () => ({
      recentResults: ['W', 'W', 'W', 'W', 'W', 'W'],
      leaguePosition: 1,
      entertainment: 0.9,
      creatorReach: 2_400_000,
      trophiesWon: 3,
      netTransferSpend: 8_000_000,
    }));

    for (const value of history) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    }

    // The brake: expectation climbs with the success and eats the sentiment gain.
    expect(expectations.at(-1)!).toBeGreaterThan(expectations[0]!);
    expect(after.fans.sentiment).toBeLessThan(96);

    // Converged, not oscillating or drifting: the last twenty cycles sit in a band.
    const tail = history.slice(-20);
    expect(Math.max(...tail) - Math.min(...tail)).toBeLessThan(6);

    expect(Number.isFinite(after.fans.base)).toBe(true);
    expect(Number.isFinite(after.fans.onlineFollowers)).toBe(true);
    expect(after.fans.onlineFollowers).toBeLessThan(62 * 260_000 * 1.05);
  });

  it('bottoms out rather than going negative over 100 cycles of failure', () => {
    const club = makeClub({ id: 'strugglers', reputation: 40 });
    const { club: after, history } = runLoop(club, 100, () => ({
      recentResults: ['L', 'L', 'L', 'L', 'L', 'L'],
      leaguePosition: 12,
      entertainment: 0.1,
      creatorReach: 120_000,
      relegated: false,
    }), 'grim');

    expect(Math.min(...history)).toBeGreaterThanOrEqual(0);
    expect(after.fans.sentiment).toBeLessThan(club.fans.sentiment);
    // Expectation falls too, which is what stops a bad club being permanently furious.
    expect(after.fans.expectation).toBeLessThan(club.fans.expectation + 1);
    expect(after.fans.base).toBeGreaterThan(0);
  });

  it('rewards winning and punishes losing, relative to the same expectation', () => {
    const club = makeClub({ id: 'c', reputation: 50 });
    const winning = runLoop(club, 12, () => ({ recentResults: ['W', 'W', 'W'], leaguePosition: 2 }));
    const losing = runLoop(club, 12, () => ({ recentResults: ['L', 'L', 'L'], leaguePosition: 11 }));
    expect(winning.club.fans.sentiment).toBeGreaterThan(losing.club.fans.sentiment + 15);
  });

  it('makes selling a cult hero and hiking the price both hurt', () => {
    const club = makeClub({ id: 'c', reputation: 50 });
    const calm = runLoop(club, 6, () => ({}));
    const sold = runLoop(club, 6, (cycle) => (cycle === 0 ? { cultHeroesSold: 1 } : {}));
    const pricey = runLoop(club, 6, () => ({ ticketPrice: 34 }));
    expect(sold.club.fans.sentiment).toBeLessThan(calm.club.fans.sentiment);
    expect(pricey.club.fans.sentiment).toBeLessThan(calm.club.fans.sentiment);
  });

  it('converts reach to fandom lossily — a huge audience is not a full stadium', () => {
    const club = makeClub({
      id: 'creators',
      reputation: 45,
      fans: { sentiment: 60, trust: 55, excitement: 50, loyalty: 50, base: 4_000, expectation: 50, lastAttendance: 0, seasonTicketHolders: 400, onlineFollowers: 2_000_000 },
    });
    const { club: after } = runLoop(club, 40, () => ({ creatorReach: 3_000_000, creatorFanConversion: 0.5 }));

    // Two million-plus following, four figures actually through the turnstiles.
    expect(after.fans.onlineFollowers).toBeGreaterThan(1_500_000);
    expect(after.fans.base).toBeLessThan(after.fans.onlineFollowers * 0.06);
    const attendance = attendanceFor(after, 3, new Rng('gate'));
    expect(attendance).toBeLessThan(after.fans.onlineFollowers * 0.01);
  });
});

describe('attendance and matchday money', () => {
  const club = makeClub({ id: 'c' });

  it('never exceeds capacity and rises with sentiment and importance', () => {
    const rng = new Rng('att');
    const happy = { ...club, fans: { ...club.fans, sentiment: 90 } };
    const angry = { ...club, fans: { ...club.fans, sentiment: 15 } };
    expect(attendanceFor(happy, 3, rng)).toBeGreaterThan(attendanceFor(angry, 3, rng));
    expect(attendanceFor(happy, 5, rng)).toBeGreaterThan(attendanceFor(happy, 1, rng) * 0.9);

    const tiny = { ...club, stadium: { ...club.stadium, capacity: 500 } };
    expect(attendanceFor(tiny, 5, rng)).toBeLessThanOrEqual(500);
  });

  it('makes ticket pricing a genuine trade-off: more per head, fewer heads', () => {
    const cheap = { ...club, finance: { ...club.finance, ticketPrice: 8 } };
    const dear = { ...club, finance: { ...club.finance, ticketPrice: 30 } };
    const rng = new Rng('price');
    const cheapGate = attendanceFor(cheap, 3, rng);
    const dearGate = attendanceFor(dear, 3, rng);

    expect(dearGate).toBeLessThan(cheapGate);
    expect(priceFactor(30)).toBeLessThan(priceFactor(8));
    expect(matchdayRevenue(dear, 1_000).tickets).toBeGreaterThan(matchdayRevenue(cheap, 1_000).tickets);
  });

  it('breaks matchday income into lines that sum to the total', () => {
    const revenue = matchdayRevenue(club, 2_000);
    expect(revenue.tickets + revenue.concessions + revenue.hospitality + revenue.matchdayMerch)
      .toBe(revenue.total);
    expect(revenue.total).toBeGreaterThan(0);
  });
});
