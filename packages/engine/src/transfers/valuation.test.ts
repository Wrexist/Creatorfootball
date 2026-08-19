import { describe, expect, it } from 'vitest';
import { makeClub, makeContract, makePlayer } from '../economy/testing';
import { emptyAttributes } from '../players/attributes';
import { emptyMental } from '../players/mental';
import {
  askingPrice, defaultValuationContext, deservedRole, marketValue, wageDemand,
} from './valuation';

const ctx = defaultValuationContext({ leagueAverageOverall: 60 });

const player = (over: Parameters<typeof makePlayer>[0]) =>
  makePlayer({ attributes: emptyAttributes(70), ...over });

describe('marketValue', () => {
  it('peaks in the mid-twenties and collapses in the mid-thirties', () => {
    const base = { id: 'p1', potential: 70 } as const;
    const young = marketValue(player({ ...base, age: 20 }), ctx);
    const peak = marketValue(player({ ...base, age: 26 }), ctx);
    const veteran = marketValue(player({ ...base, age: 34 }), ctx);

    expect(peak).toBeGreaterThan(young);
    expect(peak).toBeGreaterThan(veteran * 3);
  });

  it('pays a premium for unrealised potential, but only while there is time to realise it', () => {
    const prodigy = marketValue(player({ id: 'a', age: 19, potential: 88 }), ctx);
    const finished = marketValue(player({ id: 'b', age: 19, potential: 70 }), ctx);
    const oldWithHeadroom = marketValue(player({ id: 'c', age: 31, potential: 88 }), ctx);
    const oldWithout = marketValue(player({ id: 'd', age: 31, potential: 70 }), ctx);

    expect(prodigy).toBeGreaterThan(finished * 1.3);
    expect(oldWithHeadroom).toBe(oldWithout);
  });

  it('collapses as a contract runs down and is cheapest at expiry', () => {
    const p = player({ id: 'p', age: 26, potential: 70 });
    const long = marketValue(p, { ...ctx, contract: makeContract({ id: 'c1', playerId: 'p', clubId: 'x', weeksRemaining: 80 }) });
    const short = marketValue(p, { ...ctx, contract: makeContract({ id: 'c2', playerId: 'p', clubId: 'x', weeksRemaining: 8 }) });
    const free = marketValue(p, { ...ctx, contract: null });

    expect(short).toBeLessThan(long * 0.6);
    expect(free).toBeLessThan(short);
  });

  it('responds to form, but only once there is a run of games to judge', () => {
    const hot = player({ id: 'h', age: 26, potential: 70, form: { rating: 0.9, recentRatings: [], appearances: 12, goals: 8, assists: 2, cleanSheets: 0, yellowCards: 0, redCards: 0, minutes: 900 } });
    const cold = player({ id: 'c', age: 26, potential: 70, form: { rating: -0.9, recentRatings: [], appearances: 12, goals: 0, assists: 0, cleanSheets: 0, yellowCards: 2, redCards: 0, minutes: 900 } });
    const hotButUntested = player({ id: 'u', age: 26, potential: 70, form: { rating: 0.9, recentRatings: [], appearances: 1, goals: 1, assists: 0, cleanSheets: 0, yellowCards: 0, redCards: 0, minutes: 90 } });

    expect(marketValue(hot, ctx)).toBeGreaterThan(marketValue(cold, ctx));
    expect(marketValue(hotButUntested, ctx)).toBeLessThan(marketValue(hot, ctx));
  });

  it('charges more when the position is scarce and when rivals are circling', () => {
    const p = player({ id: 'p', age: 26, potential: 70, position: 'ST' });
    const plain = marketValue(p, ctx);
    const scarce = marketValue(p, { ...ctx, positionScarcity: { ST: 2 } });
    const contested = marketValue(p, { ...ctx, suitorCount: 4 });

    expect(scarce).toBeGreaterThan(plain);
    expect(contested).toBeGreaterThan(plain);
  });

  it('never produces a non-finite or negative price', () => {
    for (const age of [16, 22, 27, 33, 40]) {
      for (const overall of [30, 55, 75, 92]) {
        const p = player({ id: `p${age}${overall}`, age, overall, potential: Math.max(overall, 80) });
        const value = marketValue(p, ctx);
        expect(Number.isFinite(value)).toBe(true);
        expect(value).toBeGreaterThan(0);
      }
    }
  });
});

describe('askingPrice', () => {
  const seller = makeClub({ id: 'sell', reputation: 45 });
  const p = player({ id: 'p', age: 26, potential: 74, overall: 74, clubId: 'sell' });

  it('charges far more for a star than for a squad player', () => {
    const star = askingPrice(p, seller, {
      ...ctx,
      contract: makeContract({ id: 'c', playerId: 'p', clubId: 'sell', role: 'STAR' }),
    });
    const squad = askingPrice(p, seller, {
      ...ctx,
      contract: makeContract({ id: 'c', playerId: 'p', clubId: 'sell', role: 'SQUAD' }),
    });
    expect(star).toBeGreaterThan(squad * 1.5);
  });

  it('applies a big-club tax when the buyer is visibly richer in reputation', () => {
    const contract = makeContract({ id: 'c', playerId: 'p', clubId: 'sell' });
    const toPeer = askingPrice(p, seller, { ...ctx, contract, buyingClubReputation: 45 });
    const toGiant = askingPrice(p, seller, { ...ctx, contract, buyingClubReputation: 95 });
    expect(toGiant).toBeGreaterThan(toPeer * 1.15);
  });

  it('discounts when the seller is in financial trouble', () => {
    const contract = makeContract({ id: 'c', playerId: 'p', clubId: 'sell' });
    const comfortable = makeClub({ id: 'sell', reputation: 45, finance: { wageBudgetPerCycle: 100_000, transferBudget: 20_000_000, ticketPrice: 14, merchPrice: 55, lastCycleIncome: 0, lastCycleExpenditure: 0, debt: 0 } });
    const broke = makeClub({ id: 'sell', reputation: 45, finance: { wageBudgetPerCycle: 100_000, transferBudget: 0, ticketPrice: 14, merchPrice: 55, lastCycleIncome: 0, lastCycleExpenditure: 0, debt: 5_000_000 } });

    expect(askingPrice(p, broke, { ...ctx, contract }))
      .toBeLessThan(askingPrice(p, comfortable, { ...ctx, contract }));
  });

  it('is zero for a free agent — there is nobody to pay', () => {
    expect(askingPrice(p, null, ctx)).toBe(0);
  });

  it('never quotes below a floor share of market value', () => {
    const contract = makeContract({ id: 'c', playerId: 'p', clubId: 'sell', role: 'SQUAD' });
    const value = marketValue(p, { ...ctx, contract });
    expect(askingPrice(p, seller, { ...ctx, contract, managerNegotiation: 99 }))
      .toBeGreaterThanOrEqual(Math.round(value * 0.59));
  });
});

describe('wageDemand', () => {
  it('scales with overall, ambition and reputation', () => {
    const modest = player({ id: 'm', overall: 70, mental: { ...emptyMental(50), ambition: 20 }, reputation: 30 });
    const greedy = player({ id: 'g', overall: 70, mental: { ...emptyMental(50), ambition: 90 }, reputation: 80 });
    expect(wageDemand(greedy, ctx)).toBeGreaterThan(wageDemand(modest, ctx) * 1.3);

    const better = player({ id: 'b', overall: 84 });
    expect(wageDemand(better, ctx)).toBeGreaterThan(wageDemand(modest, ctx) * 2);
  });

  it('is inflated by the wageDemand trait and discounted by club prestige', () => {
    const plain = player({ id: 'p', overall: 72 });
    const mercenary = player({ id: 'm', overall: 72, traitIds: ['mercenary'] });
    expect(wageDemand(mercenary, ctx)).toBeGreaterThan(wageDemand(plain, ctx));

    const atGiant = wageDemand(plain, { ...ctx, buyingClubReputation: 95 });
    const atMinnow = wageDemand(plain, { ...ctx, buyingClubReputation: 10 });
    expect(atMinnow).toBeGreaterThan(atGiant);
  });
});

describe('deservedRole', () => {
  it('gives a star rating to a player far above league average', () => {
    expect(deservedRole(player({ id: 's', overall: 85 }), ctx)).toBe('STAR');
    expect(deservedRole(player({ id: 'a', overall: 45 }), ctx)).toBe('SQUAD');
  });
});
