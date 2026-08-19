import { describe, expect, it } from 'vitest';
import { Rng } from '../core/rng';
import { Ledger, type PostContext } from '../economy/ledger';
import { makeClub, testRegistry } from '../economy/testing';
import type { SponsorDeal, SponsorState } from '../game/state';
import { SPONSOR_BALANCE as S } from './balance';
import {
  advanceSponsorDeals, generateSponsorOffers, signSponsorOffer, sponsorMarketIndex,
  sponsorIncomePerCycle, reachFactor, type SponsorContext,
} from './sponsors';

const POST: PostContext = { cycle: 1, season: 1, at: 0 };

const ctx = (over: Partial<SponsorContext> = {}): SponsorContext => ({
  cycle: 1,
  season: 1,
  reach: 1_500_000,
  previousReach: 1_500_000,
  leaguePosition: 6,
  leagueSize: 12,
  brandBuilding: 50,
  seed: 'sponsor-seed',
  ...over,
});

const smallClub = makeClub({ id: 'small', reputation: 20, fans: { sentiment: 50, trust: 50, excitement: 50, loyalty: 50, base: 6_000, expectation: 45, lastAttendance: 0, seasonTicketHolders: 500, onlineFollowers: 60_000 } });
const bigClub = makeClub({ id: 'big', reputation: 80, fans: { sentiment: 70, trust: 65, excitement: 60, loyalty: 65, base: 60_000, expectation: 70, lastAttendance: 0, seasonTicketHolders: 5_000, onlineFollowers: 4_000_000 } });

describe('sponsor offers', () => {
  it('gates the good sponsors behind reputation and follower count', () => {
    const smallNames = new Set<string>();
    const bigNames = new Set<string>();
    for (let seed = 0; seed < 30; seed++) {
      for (const o of generateSponsorOffers(smallClub, testRegistry, new Rng(`s${seed}`), ctx())) smallNames.add(o.sponsorId);
      for (const o of generateSponsorOffers(bigClub, testRegistry, new Rng(`b${seed}`), ctx())) bigNames.add(o.sponsorId);
    }
    expect(smallNames.has('sp_local')).toBe(true);
    expect(smallNames.has('sp_big')).toBe(false);
    expect(bigNames.has('sp_big')).toBe(true);
  });

  it('pays more for more reach, but sub-linearly', () => {
    expect(reachFactor(3_000_000)).toBeGreaterThan(reachFactor(1_500_000));
    expect(reachFactor(3_000_000)).toBeLessThan(reachFactor(1_500_000) * 2);
    expect(reachFactor(0)).toBeGreaterThanOrEqual(S.REACH_FACTOR_MIN);
  });

  it('does not offer a slot that is already taken', () => {
    const active: SponsorDeal[] = [
      { id: 'd1', sponsorId: 'sp_mid', name: 'Volta', slot: 'SHIRT', valuePerCycle: 100_000, weeksRemaining: 20, satisfaction: 70 },
    ];
    for (let seed = 0; seed < 25; seed++) {
      const offers = generateSponsorOffers(bigClub, testRegistry, new Rng(`slot${seed}`), ctx(), active);
      expect(offers.every((o) => o.slot !== 'SHIRT')).toBe(true);
    }
  });

  it('dries up when the market contracts', () => {
    // Find a cycle where the deterministic climate is genuinely poor.
    let droughtCycle = -1;
    for (let cycle = 0; cycle < 300; cycle++) {
      if (sponsorMarketIndex('sponsor-seed', cycle) < S.CLIMATE_DROUGHT_THRESHOLD) { droughtCycle = cycle; break; }
    }
    expect(droughtCycle).toBeGreaterThanOrEqual(0);

    let droughtOffers = 0;
    let boomOffers = 0;
    let boomCycle = 0;
    for (let cycle = 0; cycle < 300; cycle++) {
      if (sponsorMarketIndex('sponsor-seed', cycle) > 1.15) { boomCycle = cycle; break; }
    }
    for (let seed = 0; seed < 30; seed++) {
      droughtOffers += generateSponsorOffers(bigClub, testRegistry, new Rng(`d${seed}`), ctx({ cycle: droughtCycle })).length;
      boomOffers += generateSponsorOffers(bigClub, testRegistry, new Rng(`b${seed}`), ctx({ cycle: boomCycle })).length;
    }
    expect(droughtOffers).toBeLessThan(boomOffers);
  });

  it('has a climate that is smooth, bounded and reproducible', () => {
    for (let cycle = 0; cycle < 200; cycle++) {
      const value = sponsorMarketIndex('seed', cycle);
      expect(value).toBeGreaterThanOrEqual(S.CLIMATE_MIN - 1e-9);
      expect(value).toBeLessThanOrEqual(S.CLIMATE_MAX + 1e-9);
      expect(Math.abs(value - sponsorMarketIndex('seed', cycle + 1))).toBeLessThan(0.2);
    }
    expect(sponsorMarketIndex('seed', 42)).toBe(sponsorMarketIndex('seed', 42));
  });
});

describe('active deals', () => {
  function deal(over: Partial<SponsorDeal> = {}): SponsorDeal {
    return {
      id: 'deal_1', sponsorId: 'sp_mid', name: 'Volta Energy', slot: 'SHIRT',
      valuePerCycle: 120_000, weeksRemaining: 10, satisfaction: 70,
      bonusCondition: { kind: 'WINS', target: 3, reward: 400_000, progress: 0 },
      ...over,
    };
  }
  const state = (active: SponsorDeal[]): SponsorState => ({ available: [], active });

  it('pays the club every cycle through the ledger', () => {
    const ledger = new Ledger();
    ledger.open(bigClub.id, 0, POST);
    const result = advanceSponsorDeals(bigClub, state([deal()]), {}, new Rng('pay'), ledger, ctx(), POST);
    expect(result.income).toBe(120_000);
    expect(ledger.cashOf(bigClub.id)).toBe(120_000);
    expect(ledger.all().some((tx) => tx.kind === 'SPONSOR_REVENUE' && tx.memo.includes('Volta'))).toBe(true);
  });

  it('pays a bonus exactly once when the condition is met', () => {
    const ledger = new Ledger();
    ledger.open(bigClub.id, 0, POST);
    let sponsors = state([deal()]);
    const first = advanceSponsorDeals(bigClub, sponsors, { wins: 3 }, new Rng('b'), ledger, ctx(), POST);
    expect(first.bonusesPaid).toBe(400_000);
    sponsors = first.sponsors;

    const second = advanceSponsorDeals(bigClub, sponsors, { wins: 3 }, new Rng('b'), ledger, ctx({ cycle: 2 }), { ...POST, cycle: 2 });
    expect(second.bonusesPaid).toBe(0);
  });

  it('terminates and charges a penalty when the club stops delivering', () => {
    const ledger = new Ledger();
    ledger.open(bigClub.id, 5_000_000, POST);
    const collapsing = makeClub({ ...bigClub, fans: { ...bigClub.fans, sentiment: 2 } });
    let sponsors = state([deal({ satisfaction: 28 })]);
    let terminated = 0;
    let penalties = 0;
    for (let cycle = 1; cycle <= 12; cycle++) {
      const result = advanceSponsorDeals(
        collapsing, sponsors, {}, new Rng(`t${cycle}`), ledger,
        ctx({ cycle, leaguePosition: 12, reach: 500_000, previousReach: 2_000_000 }),
        { ...POST, cycle },
      );
      terminated += result.terminated.length;
      penalties += result.penalties;
      sponsors = result.sponsors;
      if (terminated) {
        expect(result.reputationDelta).toBeLessThan(0);
        break;
      }
    }
    expect(terminated).toBe(1);
    expect(penalties).toBeGreaterThan(0);
    expect(sponsors.active).toHaveLength(0);
  });

  it('can decline to renew a happy deal when the market has turned', () => {
    let droughtCycle = 0;
    for (let cycle = 0; cycle < 300; cycle++) {
      if (sponsorMarketIndex('sponsor-seed', cycle) < S.CLIMATE_DROUGHT_THRESHOLD) { droughtCycle = cycle; break; }
    }
    let declined = 0;
    let renewed = 0;
    for (let seed = 0; seed < 40; seed++) {
      const ledger = new Ledger();
      ledger.open(bigClub.id, 1_000_000, POST);
      const result = advanceSponsorDeals(
        bigClub, state([deal({ weeksRemaining: 1, satisfaction: 85 })]), {},
        new Rng(`r${seed}`), ledger, ctx({ cycle: droughtCycle }), POST,
      );
      if (result.expired[0]?.renewed) renewed++; else declined++;
    }
    expect(declined).toBeGreaterThan(0);
    expect(renewed).toBeGreaterThan(0);
  });

  it('signs an offer once, and only once', () => {
    const ledger = new Ledger();
    ledger.open(bigClub.id, 0, POST);
    const offer = generateSponsorOffers(bigClub, testRegistry, new Rng('sign'), ctx())[0];
    expect(offer).toBeDefined();
    if (!offer) return;
    const first = signSponsorOffer(bigClub, offer, ledger, POST);
    expect(first.ok).toBe(true);
    expect(first.deal!.satisfaction).toBe(S.START_SATISFACTION);
    expect(signSponsorOffer(bigClub, offer, ledger, POST).ok).toBe(false);
    expect(sponsorIncomePerCycle({ available: [], active: [first.deal!] })).toBe(offer.valuePerCycle);
  });
});
