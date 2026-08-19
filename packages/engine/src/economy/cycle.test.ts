import { describe, expect, it } from 'vitest';
import type { Club } from '../clubs/club';
import type { Contract } from '../contracts/contract';
import { Rng } from '../core/rng';
import type { SponsorDeal } from '../game/state';
import { emptyAttributes } from '../players/attributes';
import type { Player } from '../players/player';
import { ECONOMY_BALANCE as E } from './balance';
import { runFinancialCycle, type FinanceCycleContext } from './cycle';
import { Ledger, type PostContext } from './ledger';
import { makeClub, makeContract, makePlayer, makeState, testRegistry } from './testing';

const POST: PostContext = { cycle: 1, season: 1, at: 0 };

function world(opts: {
  wage?: number;
  squadSize?: number;
  deals?: SponsorDeal[];
  clubOver?: Parameters<typeof makeClub>[0];
} = {}) {
  const wage = opts.wage ?? 10_000;
  const squadSize = opts.squadSize ?? 18;
  const players: Record<string, Player> = {};
  const contracts: Record<string, Contract> = {};
  const squad: string[] = [];
  for (let i = 0; i < squadSize; i++) {
    const id = `p_${i}`;
    players[id] = makePlayer({
      id, age: 24, attributes: emptyAttributes(66), overall: 66,
      clubId: 'club_home', contractId: `ct_${i}`,
    });
    contracts[`ct_${i}`] = makeContract({ id: `ct_${i}`, playerId: id, clubId: 'club_home', wage });
    squad.push(id);
  }
  const club = makeClub({
    id: 'club_home', shortName: 'Kestrel', isPlayerClub: true, reputation: 55, squad,
    ...(opts.clubOver ?? {}),
  });
  const state = makeState({
    clubs: { club_home: club },
    players,
    contracts,
    playerClubId: club.id,
    sponsors: {
      available: [],
      active: opts.deals ?? [
        { id: 'd_shirt', sponsorId: 'sp_mid', name: 'Volta Energy', slot: 'SHIRT', valuePerCycle: 150_000, weeksRemaining: 30, satisfaction: 70 },
        { id: 'd_sleeve', sponsorId: 'sp_local', name: 'Northgate Tools', slot: 'SLEEVE', valuePerCycle: 40_000, weeksRemaining: 30, satisfaction: 70 },
      ],
    },
  });
  return { state, club };
}

const financeCtx = (over: Partial<FinanceCycleContext> = {}): FinanceCycleContext => ({
  clubId: 'club_home' as Club['id'],
  cycle: 1,
  season: 1,
  at: 0,
  seed: 'econ-seed',
  registry: testRegistry,
  rng: new Rng('finance'),
  creatorReach: 1_200_000,
  creatorFanConversion: 0.4,
  leaguePosition: 6,
  leagueSize: 12,
  recentResults: ['W', 'D', 'L', 'W'],
  homeFixtureImportance: 3,
  ...over,
});

describe('the revenue mix', () => {
  it('is audience-led: sponsorship dominates and the gate is a minor line', () => {
    const { state } = world();
    const ledger = new Ledger();
    ledger.open(state.playerClubId, 2_000_000, POST);

    const result = runFinancialCycle(state, ledger, financeCtx());

    expect(result.mix.sponsorship!).toBeGreaterThan(E.REVENUE_MIX_TARGET.sponsorshipMin!);
    expect(result.mix.matchday!).toBeLessThan(E.REVENUE_MIX_TARGET.matchdayMax!);
    expect(result.income.sponsorship).toBeGreaterThan(result.income.matchday * 3);
    expect(result.income.total).toBe(
      result.income.sponsorship + result.income.merchandise + result.income.matchday,
    );
  });

  it('holds that shape even in a bad commercial climate', () => {
    const { state } = world();
    for (let cycle = 1; cycle <= 40; cycle++) {
      const ledger = new Ledger();
      ledger.open(state.playerClubId, 2_000_000, POST);
      const result = runFinancialCycle(state, ledger, financeCtx({ cycle, at: cycle }));
      expect(result.mix.matchday!).toBeLessThan(E.REVENUE_MIX_TARGET.matchdayMax!);
    }
  });

  it('grows income with reach rather than with the stadium', () => {
    const { state } = world();
    const run = (over: Partial<FinanceCycleContext>, clubPatch: Partial<Club> = {}) => {
      const patched = {
        ...state,
        clubs: { club_home: { ...state.clubs.club_home!, ...clubPatch } },
      };
      const ledger = new Ledger();
      ledger.open(state.playerClubId, 2_000_000, POST);
      return runFinancialCycle(patched, ledger, financeCtx(over));
    };

    const baseline = run({});
    const moreReach = run({ creatorReach: 6_000_000 });
    const biggerGround = run({}, { stadium: { ...state.clubs.club_home!.stadium, capacity: 40_000 } });

    expect(moreReach.income.total).toBeGreaterThan(baseline.income.total * 1.2);
    expect(biggerGround.income.total).toBeLessThan(baseline.income.total * 1.15);
  });

  it('posts every movement to the ledger with a readable memo', () => {
    const { state } = world();
    const ledger = new Ledger();
    ledger.open(state.playerClubId, 2_000_000, POST);
    runFinancialCycle(state, ledger, financeCtx());

    const kinds = new Set(ledger.all().map((tx) => tx.kind));
    expect(kinds.has('SPONSOR_REVENUE')).toBe(true);
    expect(kinds.has('MERCH_REVENUE')).toBe(true);
    expect(kinds.has('TICKET_REVENUE')).toBe(true);
    expect(kinds.has('WAGES')).toBe(true);
    for (const tx of ledger.all()) expect(tx.memo.length).toBeGreaterThan(4);
    expect(ledger.verify()).toEqual([]);
  });

  it('is idempotent per cycle for the revenue lines', () => {
    const { state } = world();
    const ledger = new Ledger();
    ledger.open(state.playerClubId, 5_000_000, POST);
    const first = runFinancialCycle(state, ledger, financeCtx());
    const second = runFinancialCycle(state, ledger, financeCtx());
    expect(second.income.merchandise).toBe(first.income.merchandise);
    const merchPosts = ledger.all().filter((tx) => tx.kind === 'MERCH_REVENUE');
    expect(merchPosts).toHaveLength(1);
  });
});

describe('distress', () => {
  it('borrows rather than going negative when it cannot meet the wage bill', () => {
    const { state } = world({ wage: 40_000 });
    const ledger = new Ledger();
    ledger.open(state.playerClubId, 50_000, POST);

    const result = runFinancialCycle(state, ledger, financeCtx());

    expect(ledger.cashOf(state.playerClubId)).toBeGreaterThanOrEqual(0);
    expect(result.distress.level).toBe('CRISIS');
    expect(result.distress.loanDrawn).toBeGreaterThan(0);
    expect(result.club.finance.debt).toBeGreaterThan(0);
    expect(result.distress.mustSell).toBe(true);

    // Wages are still paid in full — that is what keeps the audit meaningful.
    const wages = ledger.all().filter((tx) => tx.kind === 'WAGES');
    expect(wages).toHaveLength(1);
    expect(wages[0]!.amount).toBe(18 * 40_000);
    expect(ledger.all().some((tx) => tx.memo.includes('Emergency board loan'))).toBe(true);
  });

  it('declares insolvency past the debt ceiling, with sporting consequences', () => {
    const { state } = world({
      wage: 40_000,
      clubOver: {
        id: 'club_home', shortName: 'Kestrel', isPlayerClub: true, reputation: 55,
        squad: Array.from({ length: 18 }, (_, i) => `p_${i}`),
        finance: {
          wageBudgetPerCycle: 500_000, transferBudget: 0, ticketPrice: 14, merchPrice: 55,
          lastCycleIncome: 0, lastCycleExpenditure: 0, debt: 40_000_000,
        },
      },
    });
    const ledger = new Ledger();
    ledger.open(state.playerClubId, 10_000, POST);

    const result = runFinancialCycle(state, ledger, financeCtx());
    expect(result.distress.level).toBe('INSOLVENT');
    expect(result.distress.transferEmbargo).toBe(true);
    expect(result.club.fans.sentiment).toBeLessThan(state.clubs.club_home!.fans.sentiment);
    expect(result.club.reputation).toBeLessThan(state.clubs.club_home!.reputation);
    expect(ledger.cashOf(state.playerClubId)).toBeGreaterThanOrEqual(0);
  });

  it('is healthy when income comfortably covers the bill, and repays debt', () => {
    const { state } = world({ wage: 6_000 });
    const withDebt = {
      ...state,
      clubs: {
        club_home: {
          ...state.clubs.club_home!,
          finance: { ...state.clubs.club_home!.finance, debt: 1_000_000 },
        },
      },
    };
    const ledger = new Ledger();
    ledger.open(state.playerClubId, 3_000_000, POST);
    const result = runFinancialCycle(withDebt, ledger, financeCtx());

    expect(result.distress.level).toBe('NONE');
    expect(result.expenditure.debtService).toBeGreaterThan(0);
    expect(result.club.finance.debt).toBeLessThan(1_000_000);
    expect(result.net).toBeGreaterThan(0);
  });

  it('never produces a non-finite number, over a long run', () => {
    const { state } = world();
    const ledger = new Ledger();
    ledger.open(state.playerClubId, 2_000_000, POST);
    let current = state;
    for (let cycle = 1; cycle <= 60; cycle++) {
      const result = runFinancialCycle(current, ledger, financeCtx({ cycle, at: cycle }));
      for (const value of Object.values(result.income)) expect(Number.isFinite(value)).toBe(true);
      for (const value of Object.values(result.club.finance)) expect(Number.isFinite(value)).toBe(true);
      for (const value of Object.values(result.club.fans)) expect(Number.isFinite(value)).toBe(true);
      expect(ledger.cashOf(state.playerClubId)).toBeGreaterThanOrEqual(0);
      current = {
        ...current,
        clubs: { club_home: result.club },
        sponsors: result.sponsors,
      };
    }
    expect(ledger.verify()).toEqual([]);
  });
});

describe('the wider loop', () => {
  it('closes: winning raises sentiment, reach and reputation, which raises income', () => {
    const { state } = world();
    const ledger = new Ledger();
    ledger.open(state.playerClubId, 5_000_000, POST);

    let current = state;
    let firstIncome = 0;
    let lastIncome = 0;
    for (let cycle = 1; cycle <= 30; cycle++) {
      const result = runFinancialCycle(current, ledger, financeCtx({
        cycle, at: cycle, leaguePosition: 1, recentResults: ['W', 'W', 'W', 'W'],
        creatorReach: 2_000_000, entertainment: 0.85,
        // The sponsorship already signed is fixed, so the growth we are
        // measuring has to come through merch and the gate.
      }));
      if (cycle === 1) firstIncome = result.income.merchandise + result.income.matchday;
      lastIncome = result.income.merchandise + result.income.matchday;
      current = { ...current, clubs: { club_home: result.club }, sponsors: result.sponsors };
    }

    expect(current.clubs.club_home!.reputation).toBeGreaterThan(55);
    expect(current.clubs.club_home!.fans.onlineFollowers).toBeGreaterThan(900_000);
    expect(lastIncome).toBeGreaterThan(firstIncome);
  });
});
