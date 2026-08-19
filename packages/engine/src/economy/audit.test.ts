import { describe, expect, it } from 'vitest';
import { asId, type ClubId, type PlayerId } from '../core/brand';
import type { GameState } from '../game/state';
import { auditEconomy, isEconomyClean, summariseAudit } from './audit';
import { clubAccount, Ledger, type LedgerSnapshot, type PostContext, type Transaction } from './ledger';
import { makeClub, makeContract, makePlayer, makeState } from './testing';

const POST: PostContext = { cycle: 0, season: 1, at: 0 };
const WAGE = 12_000;

/** A state and ledger that should audit completely clean. */
function cleanWorld(): { state: GameState; ledger: Ledger } {
  const players = Object.fromEntries(
    Array.from({ length: 4 }, (_, i) => {
      const id = `p_${i}`;
      return [id, makePlayer({ id, clubId: 'club_a', contractId: `ct_${i}` })];
    }),
  );
  const contracts = Object.fromEntries(
    Array.from({ length: 4 }, (_, i) => [
      `ct_${i}`,
      makeContract({ id: `ct_${i}`, playerId: `p_${i}`, clubId: 'club_a', wage: WAGE }),
    ]),
  );
  const clubA = makeClub({ id: 'club_a', squad: ['p_0', 'p_1', 'p_2', 'p_3'] });
  const clubB = makeClub({ id: 'club_b' });

  const state = makeState({
    clubs: { club_a: clubA, club_b: clubB },
    players,
    contracts,
    playerClubId: clubA.id,
  });

  const ledger = new Ledger();
  ledger.open(clubA.id, 5_000_000, POST);
  ledger.open(clubB.id, 5_000_000, POST);
  ledger.debit(clubA.id, 'WAGES', WAGE * 4, 'Squad wages, 4 players', POST);
  return { state, ledger };
}

const codes = (state: GameState, ledger: Ledger): string[] =>
  auditEconomy(state, ledger).map((v) => v.code);

describe('auditEconomy', () => {
  it('reports nothing on a healthy save', () => {
    const { state, ledger } = cleanWorld();
    const violations = auditEconomy(state, ledger);
    expect(violations).toEqual([]);
    expect(isEconomyClean(violations)).toBe(true);
  });

  it('catches a negative balance', () => {
    const { state, ledger } = cleanWorld();
    ledger.debit(state.playerClubId, 'PENALTY', 50_000_000, 'Overdraft', POST, { allowOverdraft: true });
    expect(codes(state, ledger)).toContain('NEGATIVE_BALANCE');
  });

  it('catches a non-finite value on a contract, a player and a club', () => {
    const { state, ledger } = cleanWorld();

    const badContract = {
      ...state,
      contracts: { ...state.contracts, ct_0: { ...state.contracts.ct_0!, wage: Number.NaN } },
    };
    expect(codes(badContract, ledger)).toContain('NON_FINITE_VALUE');

    const badPlayer = {
      ...state,
      players: { ...state.players, p_0: { ...state.players.p_0!, marketValue: Number.POSITIVE_INFINITY } },
    };
    expect(codes(badPlayer, ledger)).toContain('NON_FINITE_VALUE');

    const badClub = {
      ...state,
      clubs: {
        ...state.clubs,
        club_a: {
          ...state.clubs.club_a!,
          finance: { ...state.clubs.club_a!.finance, transferBudget: Number.NaN },
        },
      },
    };
    expect(codes(badClub, ledger)).toContain('NON_FINITE_VALUE');
  });

  it('catches a double-claimed reward in the ledger', () => {
    const { state } = cleanWorld();
    const duplicate: Transaction = {
      id: asId('tx_dup_1'), kind: 'OBJECTIVE_REWARD', currency: 'CASH', amount: 250_000,
      from: { kind: 'world', label: 'objective_reward' }, to: clubAccount(state.playerClubId),
      cycle: 0, season: 1, at: 0, memo: 'Objective reward', idempotencyKey: 'objective:win-derby',
    };
    const snapshot: LedgerSnapshot = {
      balances: { [`club:${state.playerClubId}`]: { CASH: 500_000, PREMIUM: 0 } },
      transactions: [duplicate, { ...duplicate, id: asId('tx_dup_2') }],
      idCounters: {},
      appliedKeys: ['objective:win-derby'],
    };
    const restored = Ledger.restore(snapshot);
    expect(codes(state, restored)).toContain('DOUBLE_CLAIMED');
  });

  it('catches an objective that appears as claimed twice', () => {
    const { state, ledger } = cleanWorld();
    const objective = {
      id: 'obj_1', title: 'Win the derby', description: '', kind: 'DERBY_WIN',
      target: 1, progress: 1, rewards: [], expiresCycle: null,
      status: 'CLAIMED' as const, source: 'DYNAMIC' as const, importance: 3 as const,
    };
    const doubled = {
      ...state,
      objectives: { active: [objective], completed: [objective], seasonTargets: [] },
    };
    expect(codes(doubled, ledger)).toContain('DOUBLE_CLAIMED');
  });

  it('catches a wage bill that does not reconcile against the contracts', () => {
    const { state, ledger } = cleanWorld();
    const underpaid = {
      ...state,
      contracts: { ...state.contracts, ct_0: { ...state.contracts.ct_0!, wage: WAGE * 5 } },
    };
    expect(codes(underpaid, ledger)).toContain('WAGE_MISMATCH');

    // ...and stays quiet when it does reconcile.
    expect(codes(state, ledger)).not.toContain('WAGE_MISMATCH');
  });

  it('catches a transfer fee that never moved between the two clubs', () => {
    const { state, ledger } = cleanWorld();
    const withGhostTransfer: GameState = {
      ...state,
      transfers: {
        ...state.transfers,
        completed: [{
          playerId: asId<PlayerId>('p_0'),
          fromClubId: asId<ClubId>('club_b'),
          toClubId: asId<ClubId>('club_a'),
          fee: 4_000_000,
          cycle: 0,
          season: 1,
        }],
      },
    };
    expect(codes(withGhostTransfer, ledger)).toContain('TRANSFER_IMBALANCE');

    // Post the matching movement and the complaint goes away.
    ledger.post({
      kind: 'TRANSFER_OUT', amount: 4_000_000,
      from: clubAccount(asId<ClubId>('club_a')), to: clubAccount(asId<ClubId>('club_b')),
      memo: 'Transfer fee',
    }, POST);
    expect(codes(withGhostTransfer, ledger)).not.toContain('TRANSFER_IMBALANCE');
  });

  it('catches a player owned by two clubs, and a registration that disagrees with itself', () => {
    const { state, ledger } = cleanWorld();

    const shared: GameState = {
      ...state,
      clubs: {
        ...state.clubs,
        club_b: { ...state.clubs.club_b!, squad: [asId<PlayerId>('p_0')] },
      },
    };
    expect(codes(shared, ledger)).toContain('DUAL_OWNERSHIP');

    const orphaned: GameState = {
      ...state,
      players: { ...state.players, p_0: { ...state.players.p_0!, clubId: asId<ClubId>('club_b') } },
    };
    expect(codes(orphaned, ledger)).toContain('DUAL_OWNERSHIP');
  });

  it('groups its findings for display', () => {
    const { state, ledger } = cleanWorld();
    ledger.debit(state.playerClubId, 'PENALTY', 50_000_000, 'Overdraft', POST, { allowOverdraft: true });
    const summary = summariseAudit(auditEconomy(state, ledger));
    expect(Object.keys(summary)).toContain('NEGATIVE_BALANCE');
    expect(summary.NEGATIVE_BALANCE![0]).toMatch(/negative cash balance/);
  });
});
