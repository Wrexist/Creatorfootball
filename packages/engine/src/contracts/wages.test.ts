import { describe, expect, it } from 'vitest';
import { Ledger, type PostContext } from '../economy/ledger';
import { makeContract, makePlayer } from '../economy/testing';
import { emptyAttributes } from '../players/attributes';
import { emptyMental } from '../players/mental';
import { defaultValuationContext } from '../transfers/valuation';
import { rolePromiseDelta } from './contract';
import { demandedTerms, packageValue, type TalksContext } from './negotiation';
import {
  assessRenewal, bonusPayouts, payBonuses, renewContract, respondToRenewal,
  rolePromiseMoraleDelta, tickContract, wageBill, wagePressure,
} from './wages';

const POST: PostContext = { cycle: 10, season: 1, at: 0 };

const talks: TalksContext = {
  valuation: defaultValuationContext({ leagueAverageOverall: 62 }),
  clubReputation: 55,
  leaguePosition: 5,
  leagueSize: 12,
  managerCharisma: 60,
  isRenewal: true,
};

const star = makePlayer({
  id: 'p_star',
  displayName: 'Rui Serra',
  age: 25,
  attributes: emptyAttributes(80),
  overall: 80,
  potential: 84,
  reputation: 70,
  mental: { ...emptyMental(60), ambition: 70, loyalty: 55, morale: 65 },
});

describe('the wage bill', () => {
  it('sums contracts and reports pressure against the budget', () => {
    const contracts = [
      makeContract({ id: 'a', playerId: 'x', clubId: 'c', wage: 20_000 }),
      makeContract({ id: 'b', playerId: 'y', clubId: 'c', wage: 30_000 }),
    ];
    expect(wageBill(contracts)).toBe(50_000);
    expect(wagePressure(contracts, 100_000).state).toBe('HEALTHY');
    expect(wagePressure(contracts, 52_000).state).toBe('TIGHT');
    expect(wagePressure(contracts, 40_000).state).toBe('OVERCOMMITTED');
    expect(wagePressure(contracts, 40_000).headroom).toBeLessThan(0);
  });
});

describe('renewals', () => {
  const cheapContract = makeContract({
    id: 'ct', playerId: 'p_star', clubId: 'c', wage: 9_000,
    weeksRemaining: 12, minutesPlayed: 1_100, minutesAvailable: 1_200, role: 'STARTER',
  });

  it('spots a player who has outgrown his deal and flags the urgency', () => {
    const assessment = assessRenewal(star, cheapContract, talks);
    expect(assessment.wantsMore).toBe(true);
    expect(assessment.deservedWage).toBeGreaterThan(cheapContract.wage * 1.2);
    expect(assessment.urgency).toBe('URGENT');
    expect(assessment.summary).toContain('/week');
  });

  it('leaves a fairly-paid player alone', () => {
    const fair = { ...cheapContract, wage: 60_000, weeksRemaining: 100 };
    const assessment = assessRenewal(star, fair, talks);
    expect(assessment.wantsMore).toBe(false);
    expect(assessment.urgency).toBe('NONE');
  });

  it('costs morale now and loyalty later when a justified demand is refused', () => {
    const refused = respondToRenewal(star, cheapContract, null, talks);
    expect(refused.verdict).toBe('INSULTED');
    expect(refused.moraleDelta).toBeLessThan(0);
    expect(refused.loyaltyDelta).toBeLessThan(0);
  });

  it('accepts a fair offer, counters a light one, and takes a lowball as an insult', () => {
    const demand = assessRenewal(star, cheapContract, talks).demand;

    expect(respondToRenewal(star, cheapContract, demand, talks).verdict).toBe('SIGNED');
    expect(respondToRenewal(star, cheapContract, { ...demand, wage: Math.round(demand.wage * 0.8) }, talks).verdict)
      .toBe('COUNTERED');
    const insulted = respondToRenewal(star, cheapContract, { ...demand, wage: Math.round(demand.wage * 0.3), signingBonus: 0 }, talks);
    expect(insulted.verdict).toBe('INSULTED');
    expect(insulted.moraleDelta).toBeLessThan(0);
  });

  it('rewards generosity with morale, and resets the role-promise clock on signature', () => {
    const demand = assessRenewal(star, cheapContract, talks).demand;
    const generous = { ...demand, wage: Math.round(demand.wage * 1.25) };
    const response = respondToRenewal(star, cheapContract, generous, talks);
    expect(response.verdict).toBe('SIGNED');
    expect(response.moraleDelta).toBeGreaterThan(0);

    const renewed = renewContract(cheapContract, generous, 20);
    expect(renewed.wage).toBe(generous.wage);
    expect(renewed.minutesPlayed).toBe(0);
    expect(renewed.minutesAvailable).toBe(0);
    expect(renewed.weeksRemaining).toBe(generous.years * 38);
  });

  it('asks for more money when the role on offer is beneath him', () => {
    const asStar = demandedTerms(star, talks, { role: 'STAR' });
    const asRotation = demandedTerms(star, talks, { role: 'ROTATION' });
    expect(asRotation.wage).toBeGreaterThan(asStar.wage);
    expect(packageValue(asRotation)).toBeGreaterThan(packageValue(asStar));
  });
});

describe('role promises', () => {
  it('hurts visibly when a STAR is not playing, and rewards over-delivery mildly', () => {
    const benchedStar = makeContract({
      id: 'ct', playerId: 'p', clubId: 'c', role: 'STAR',
      minutesPlayed: 200, minutesAvailable: 1_200,
    });
    const usedStar = { ...benchedStar, minutesPlayed: 1_150 };

    expect(rolePromiseDelta(benchedStar)).toBeLessThan(-0.5);
    expect(rolePromiseMoraleDelta(benchedStar)).toBeLessThan(-3);
    expect(rolePromiseMoraleDelta(usedStar)).toBeGreaterThanOrEqual(0);
    expect(Math.abs(rolePromiseMoraleDelta(benchedStar)))
      .toBeGreaterThan(rolePromiseMoraleDelta(usedStar));
  });

  it('says nothing before there is enough evidence to judge', () => {
    const early = makeContract({
      id: 'ct', playerId: 'p', clubId: 'c', role: 'STAR',
      minutesPlayed: 0, minutesAvailable: 90,
    });
    expect(rolePromiseMoraleDelta(early)).toBe(0);
  });

  it('advances the contract clock without mutating it', () => {
    const contract = makeContract({ id: 'ct', playerId: 'p', clubId: 'c', weeksRemaining: 5 });
    const ticked = tickContract(contract, 90, 90);
    expect(contract.weeksRemaining).toBe(5);
    expect(ticked.weeksRemaining).toBe(4);
    expect(ticked.minutesPlayed).toBe(90);
  });
});

describe('bonuses', () => {
  const contract = makeContract({
    id: 'ct_bonus', playerId: 'p_star', clubId: 'club_a', wage: 30_000,
    bonuses: { appearance: 2_000, goal: 8_000, cleanSheet: 4_000, seasonPerformance: 120_000, trophy: 300_000, promotion: 150_000 },
  });

  it('pays out only for what actually happened', () => {
    const payouts = bonusPayouts(contract, { appearances: 2, goals: 3, trophy: true }, 'Rui Serra');
    const total = payouts.reduce((s, p) => s + p.amount, 0);
    expect(total).toBe(2 * 2_000 + 3 * 8_000 + 300_000);
    expect(payouts.every((p) => p.memo.includes('Rui Serra'))).toBe(true);
    expect(bonusPayouts(contract, {}, 'Rui Serra')).toEqual([]);
  });

  it('moves the money through the ledger, exactly once per cycle', () => {
    const ledger = new Ledger();
    ledger.open(contract.clubId, 2_000_000, POST);
    const first = payBonuses(ledger, contract.clubId, contract, { goals: 2 }, 'Rui Serra', POST);
    expect(first.total).toBe(16_000);
    expect(ledger.cashOf(contract.clubId)).toBe(2_000_000 - 16_000);

    const replay = payBonuses(ledger, contract.clubId, contract, { goals: 2 }, 'Rui Serra', POST);
    expect(replay.total).toBe(0);
    expect(replay.unpaid).toHaveLength(1);
    expect(ledger.cashOf(contract.clubId)).toBe(2_000_000 - 16_000);
  });

  it('reports what it could not pay rather than silently overdrawing', () => {
    const ledger = new Ledger();
    ledger.open(contract.clubId, 1_000, POST);
    const settlement = payBonuses(ledger, contract.clubId, contract, { trophy: true }, 'Rui Serra', POST);
    expect(settlement.total).toBe(0);
    expect(settlement.unpaid).toHaveLength(1);
    expect(ledger.cashOf(contract.clubId)).toBe(1_000);
  });
});
