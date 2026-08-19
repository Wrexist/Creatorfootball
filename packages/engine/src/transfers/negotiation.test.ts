import { describe, expect, it } from 'vitest';
import { IdFactory } from '../core/ids';
import { Rng } from '../core/rng';
import { Ledger, type PostContext } from '../economy/ledger';
import { makeClub, makeContract, makePlayer } from '../economy/testing';
import type { Negotiation, NegotiationTerms } from '../game/state';
import { emptyAttributes } from '../players/attributes';
import { emptyMental } from '../players/mental';
import {
  aiCounter, completeTransfer, isTerminal, openNegotiation, submitOffer,
  type NegotiationContext, type NegotiationOutcome, type RivalClub,
} from './negotiation';
import { defaultValuationContext } from './valuation';

const POST: PostContext = { cycle: 1, season: 1, at: 0 };

function scenario(opts: { rivals?: RivalClub[]; loyalty?: number; charisma?: number } = {}) {
  const target = makePlayer({
    id: 'p_target',
    displayName: 'Ilo Vantes',
    age: 26,
    attributes: emptyAttributes(74),
    overall: 74,
    potential: 78,
    reputation: 62,
    clubId: 'club_sell',
    contractId: 'ct_target',
    mental: { ...emptyMental(55), ambition: 60, loyalty: opts.loyalty ?? 50, morale: 60 },
  });
  const contract = makeContract({
    id: 'ct_target', playerId: 'p_target', clubId: 'club_sell',
    role: 'STARTER', wage: 22_000, weeksRemaining: 70,
    minutesPlayed: 900, minutesAvailable: 1_400,
  });
  const seller = makeClub({ id: 'club_sell', shortName: 'Ashvale', reputation: 50 });
  const buyer = makeClub({ id: 'club_buy', shortName: 'Kestrel', reputation: 70, isPlayerClub: true });

  const ctx: NegotiationContext = {
    id: 'neg_1',
    cycle: 1,
    season: 1,
    player: target,
    sellingClub: seller,
    buyingClub: buyer,
    contract,
    valuation: defaultValuationContext({ leagueAverageOverall: 62, contract }),
    leaguePosition: 2,
    leagueSize: 12,
    managerCharisma: opts.charisma ?? 70,
    managerNegotiation: 60,
    rivals: opts.rivals ?? [],
    rolePromiseDelta: 0,
  };
  return { ctx, target, contract, seller, buyer };
}

/** Drive a negotiation by always meeting the standing demand in full. */
function runToConclusion(
  ctx: NegotiationContext,
  seed: string,
  offerFor: (neg: Negotiation) => NegotiationTerms,
  maxRounds = 12,
): { negotiation: Negotiation; outcomes: NegotiationOutcome[]; headline: string } {
  const rng = new Rng(seed);
  let neg = openNegotiation(ctx, rng);
  const outcomes: NegotiationOutcome[] = [];
  let headline = '';
  for (let round = 0; round < maxRounds && !isTerminal(neg); round++) {
    const step = submitOffer(neg, offerFor(neg), { ...ctx, cycle: ctx.cycle + round }, rng, {
      agentFee: neg.agentFeeDemand,
    });
    outcomes.push(step.outcome);
    headline = step.headline;
    neg = step.negotiation;
  }
  return { negotiation: neg, outcomes, headline };
}

const meetDemand = (neg: Negotiation): NegotiationTerms => ({ ...neg.theirDemand });

const lowball = (neg: Negotiation): NegotiationTerms => ({
  ...neg.theirDemand,
  fee: Math.round(neg.theirDemand.fee * 0.1),
  wage: Math.round(neg.theirDemand.wage * 0.35),
  role: 'SQUAD',
  signingBonus: 0,
});

describe('the negotiation flow', () => {
  it('walks club talks, then player talks, then the agent, and reaches agreement', () => {
    const { ctx } = scenario();
    let agreed = 0;
    let sawClubThenPlayer = false;

    for (let seed = 0; seed < 30; seed++) {
      const run = runToConclusion(ctx, `agree-${seed}`, meetDemand);
      if (run.negotiation.stage === 'AGREED') {
        agreed++;
        const actors = run.negotiation.history.map((h) => h.actor);
        if (actors.includes('Ashvale') && actors.some((a) => a.includes('Ilo Vantes'))) {
          sawClubThenPlayer = true;
        }
      }
    }

    expect(agreed).toBeGreaterThan(20);
    expect(sawClubThenPlayer).toBe(true);
  });

  it('collapses when the bid is an insult, and never reaches agreement', () => {
    const { ctx } = scenario();
    for (let seed = 0; seed < 20; seed++) {
      const run = runToConclusion(ctx, `collapse-${seed}`, lowball);
      expect(run.negotiation.stage).not.toBe('AGREED');
      expect(isTerminal(run.negotiation)).toBe(true);
      expect(run.negotiation.clubPatience).toBeLessThan(100);
    }
  });

  it('refuses to open at all for a loyal, well-treated player', () => {
    const { ctx } = scenario({ loyalty: 95 });
    const neg = openNegotiation(ctx, new Rng('loyal'));
    expect(neg.stage).toBe('FAILED');
    expect(neg.history[0]?.text).toContain('happy where he is');
  });

  it('can be hijacked by a rival that was circling', () => {
    const rivals: RivalClub[] = [
      { clubId: makeClub({ id: 'r1' }).id, name: 'Dunmoor', reputation: 80, spendingPower: 90_000_000 },
      { clubId: makeClub({ id: 'r2' }).id, name: 'Port Vane', reputation: 78, spendingPower: 90_000_000 },
      { clubId: makeClub({ id: 'r3' }).id, name: 'Ardley', reputation: 74, spendingPower: 90_000_000 },
    ];
    const { ctx } = scenario({ rivals });

    let hijacks = 0;
    let hijackHeadline = '';
    for (let seed = 0; seed < 60; seed++) {
      // Haggling rather than meeting the demand keeps the talks alive long
      // enough for the rivals to act — dithering is what gets you hijacked.
      const run = runToConclusion(ctx, `hijack-${seed}`, (neg) => ({
        ...neg.theirDemand,
        fee: Math.round(neg.theirDemand.fee * 0.85),
      }));
      if (run.negotiation.stage === 'HIJACKED') {
        hijacks++;
        hijackHeadline = run.headline;
      }
    }

    expect(hijacks).toBeGreaterThan(0);
    expect(hijackHeadline).toMatch(/gone over the top/);
  });

  it('produces the full range of story-worthy outcomes across seeds', () => {
    const rivals: RivalClub[] = [
      { clubId: makeClub({ id: 'r1' }).id, name: 'Dunmoor', reputation: 80, spendingPower: 90_000_000 },
      { clubId: makeClub({ id: 'r2' }).id, name: 'Port Vane', reputation: 78, spendingPower: 90_000_000 },
    ];
    const { ctx } = scenario({ rivals });
    const seen = new Set<NegotiationOutcome>();
    for (let seed = 0; seed < 120; seed++) {
      const run = runToConclusion(ctx, `mix-${seed}`, (neg) => ({
        ...neg.theirDemand,
        fee: Math.round(neg.theirDemand.fee * 0.8),
        wage: Math.round(neg.theirDemand.wage * 0.8),
      }));
      for (const outcome of run.outcomes) seen.add(outcome);
    }
    expect(seen.has('COUNTERED')).toBe(true);
    expect(seen.has('DELAYED')).toBe(true);
    expect([...seen].some((o) => o === 'HIJACKED' || o === 'COLLAPSED' || o === 'PLAYER_LOST_INTEREST')).toBe(true);
  });

  it('lets the world move between offers: rivals arrive and patience decays', () => {
    const rivals: RivalClub[] = [
      { clubId: makeClub({ id: 'r1' }).id, name: 'Dunmoor', reputation: 80, spendingPower: 90_000_000 },
    ];
    const { ctx } = scenario({ rivals });
    const rng = new Rng('world');
    let neg = openNegotiation(ctx, rng);
    const startPatience = neg.playerPatience;
    for (let i = 0; i < 3; i++) neg = aiCounter(neg, { ...ctx, cycle: ctx.cycle + i }, rng);
    expect(neg.playerPatience).toBeLessThan(startPatience);
  });

  it('expires once the deadline passes', () => {
    const { ctx } = scenario();
    const rng = new Rng('expiry');
    const neg = openNegotiation(ctx, rng);
    const late = aiCounter(neg, { ...ctx, cycle: neg.deadlineCycle + 1 }, rng);
    expect(late.stage).toBe('FAILED');
  });
});

describe('completeTransfer', () => {
  function agreedNegotiation(): { neg: Negotiation; ctx: NegotiationContext } | null {
    const { ctx } = scenario();
    for (let seed = 0; seed < 40; seed++) {
      const run = runToConclusion(ctx, `complete-${seed}`, meetDemand);
      if (run.negotiation.stage === 'AGREED') return { neg: run.negotiation, ctx };
    }
    return null;
  }

  it('moves the fee between the two clubs and registers the player', () => {
    const agreed = agreedNegotiation();
    expect(agreed).not.toBeNull();
    if (!agreed) return;

    const ledger = new Ledger();
    ledger.open(agreed.ctx.buyingClub.id, 80_000_000, POST);
    ledger.open(agreed.ctx.sellingClub!.id, 1_000_000, POST);
    const buyerBefore = ledger.cashOf(agreed.ctx.buyingClub.id);
    const sellerBefore = ledger.cashOf(agreed.ctx.sellingClub!.id);

    const outcome = completeTransfer(agreed.neg, agreed.ctx, ledger, POST, new IdFactory('t'));

    expect(outcome.ok).toBe(true);
    expect(outcome.player?.clubId).toBe(agreed.ctx.buyingClub.id);
    expect(outcome.toClub?.squad).toContain(agreed.ctx.player.id);
    expect(outcome.fromClub?.squad).not.toContain(agreed.ctx.player.id);
    expect(outcome.contract?.wage).toBe(agreed.neg.ourOffer?.wage);

    const fee = agreed.neg.ourOffer?.fee ?? 0;
    expect(ledger.cashOf(agreed.ctx.sellingClub!.id)).toBe(sellerBefore + fee);
    expect(buyerBefore - ledger.cashOf(agreed.ctx.buyingClub.id)).toBe(outcome.totalCost);
    expect(ledger.verify()).toEqual([]);
  });

  it('falls through when the buyer cannot cover the total cost', () => {
    const agreed = agreedNegotiation();
    if (!agreed) return;
    const ledger = new Ledger();
    ledger.open(agreed.ctx.buyingClub.id, 1_000, POST);
    const outcome = completeTransfer(agreed.neg, agreed.ctx, ledger, POST, new IdFactory('t'));
    expect(outcome.ok).toBe(false);
    expect(outcome.reason).toMatch(/cannot cover/);
    expect(ledger.cashOf(agreed.ctx.buyingClub.id)).toBe(1_000);
  });

  it('refuses to settle a negotiation that is not agreed', () => {
    const { ctx } = scenario();
    const neg = openNegotiation(ctx, new Rng('unagreed'));
    const outcome = completeTransfer(neg, ctx, new Ledger(), POST, new IdFactory('t'));
    expect(outcome.ok).toBe(false);
  });
});
