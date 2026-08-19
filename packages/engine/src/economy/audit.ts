import type { ClubId } from '../core/brand';
import type { InvariantViolation } from '../core/invariant';
import { isFiniteNumber } from '../core/math';
import type { GameState } from '../game/state';
import { AUDIT_BALANCE as A } from './balance';
import type { Ledger, Transaction } from './ledger';

/**
 * Economy audit.
 *
 * This is the safety net for the one class of bug that destroys a management
 * game quietly: money that appears from nowhere, or disappears into it. Every
 * check here corresponds to a way we could plausibly get it wrong, and each one
 * has a test that deliberately breaks the invariant to prove the check fires.
 *
 * The audit reports rather than throws. Losing a save is worse than a wrong
 * number, and the report is what the automated balance run consumes.
 */

const violation = (
  code: string,
  message: string,
  context?: Record<string, unknown>,
): InvariantViolation => ({ code, message, context });

const accountKey = (a: Transaction['from']): string =>
  a.kind === 'club' ? `club:${a.clubId}` : `world:${a.label}`;

export function auditEconomy(state: GameState, ledger: Ledger): InvariantViolation[] {
  const out: InvariantViolation[] = [];
  const transactions = ledger.all();

  // --- Ledger's own integrity, folded in so callers need one entry point ----
  for (const problem of ledger.verify()) {
    out.push(violation('LEDGER_INTEGRITY', problem));
  }

  // --- Negative balances and non-finite money ------------------------------
  for (const clubId of Object.keys(state.clubs) as ClubId[]) {
    const balances = ledger.balanceOf(clubId);
    const club = state.clubs[clubId];
    const name = club?.shortName ?? clubId;

    if (!isFiniteNumber(balances.CASH) || !isFiniteNumber(balances.PREMIUM)) {
      out.push(violation('NON_FINITE_VALUE', `${name} has a non-finite balance.`, { clubId, balances }));
    }
    if (balances.CASH < 0) {
      out.push(violation('NEGATIVE_BALANCE', `${name} has a negative cash balance of ${balances.CASH}.`, { clubId, cash: balances.CASH }));
    }
    if (balances.PREMIUM < 0) {
      out.push(violation('NEGATIVE_BALANCE', `${name} has a negative premium balance.`, { clubId, premium: balances.PREMIUM }));
    }

    if (!club) continue;
    const finance = club.finance;
    for (const [key, value] of Object.entries(finance)) {
      if (typeof value === 'number' && !isFiniteNumber(value)) {
        out.push(violation('NON_FINITE_VALUE', `${name}.finance.${key} is not finite.`, { clubId, key, value }));
      }
    }
    if (finance.debt < 0) {
      out.push(violation('NEGATIVE_BALANCE', `${name} has negative debt, which is not a thing.`, { clubId, debt: finance.debt }));
    }
    for (const [key, value] of Object.entries(club.fans)) {
      if (typeof value === 'number' && !isFiniteNumber(value)) {
        out.push(violation('NON_FINITE_VALUE', `${name}.fans.${key} is not finite.`, { clubId, key }));
      }
    }
  }

  // --- Non-finite values on players and contracts ---------------------------
  for (const player of Object.values(state.players)) {
    if (!isFiniteNumber(player.marketValue) || !isFiniteNumber(player.overall) || !isFiniteNumber(player.fitness)) {
      out.push(violation('NON_FINITE_VALUE', `${player.displayName} carries a non-finite value.`, { playerId: player.id }));
    }
  }
  for (const contract of Object.values(state.contracts)) {
    if (!isFiniteNumber(contract.wage) || contract.wage < 0) {
      out.push(violation('NON_FINITE_VALUE', `Contract ${contract.id} has an invalid wage.`, { contractId: contract.id, wage: contract.wage }));
    }
  }

  // --- Double-claimed rewards ----------------------------------------------
  const keyCounts = new Map<string, number>();
  for (const tx of transactions) {
    if (!tx.idempotencyKey) continue;
    keyCounts.set(tx.idempotencyKey, (keyCounts.get(tx.idempotencyKey) ?? 0) + 1);
  }
  for (const [key, count] of keyCounts) {
    if (count > 1) {
      out.push(violation('DOUBLE_CLAIMED', `Idempotency key "${key}" was applied ${count} times.`, { key, count }));
    }
  }

  const claimed = new Set<string>();
  for (const objective of [...state.objectives.completed, ...state.objectives.active]) {
    if (objective.status !== 'CLAIMED') continue;
    if (claimed.has(objective.id)) {
      out.push(violation('DOUBLE_CLAIMED', `Objective "${objective.title}" appears as claimed twice.`, { objectiveId: objective.id }));
    }
    claimed.add(objective.id);
  }

  // --- Wage reconciliation --------------------------------------------------
  const cycle = state.clock.cycle;
  const wagesByClub = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.kind !== 'WAGES') continue;
    if (tx.cycle < cycle - A.WAGE_LOOKBACK_CYCLES + 1 || tx.cycle > cycle) continue;
    if (tx.from.kind !== 'club') continue;
    const key = `${tx.from.clubId}:${tx.cycle}`;
    wagesByClub.set(key, (wagesByClub.get(key) ?? 0) + tx.amount);
  }
  for (const [key, paid] of wagesByClub) {
    const clubId = key.slice(0, key.lastIndexOf(':')) as ClubId;
    const club = state.clubs[clubId];
    if (!club) continue;
    let expected = 0;
    for (const playerId of club.squad) {
      const player = state.players[playerId];
      if (!player?.contractId) continue;
      const contract = state.contracts[player.contractId];
      if (contract && contract.clubId === clubId) expected += Math.max(0, contract.wage);
    }
    if (Math.abs(expected - paid) > A.WAGE_TOLERANCE) {
      out.push(violation(
        'WAGE_MISMATCH',
        `${club.shortName} paid ${paid} in wages but its contracts total ${expected}.`,
        { clubId, paid, expected },
      ));
    }
  }

  // --- Transfer fees must balance between buyer and seller ------------------
  for (const transfer of state.transfers.completed) {
    if (transfer.fee <= 0 || transfer.fromClubId === null) continue;
    const buyerKey = `club:${transfer.toClubId}`;
    const sellerKey = `club:${transfer.fromClubId}`;
    const match = transactions.find(
      (tx) =>
        (tx.kind === 'TRANSFER_OUT' || tx.kind === 'TRANSFER_IN') &&
        tx.cycle === transfer.cycle &&
        accountKey(tx.from) === buyerKey &&
        accountKey(tx.to) === sellerKey &&
        Math.abs(tx.amount - transfer.fee) <= A.TRANSFER_TOLERANCE,
    );
    if (!match) {
      out.push(violation(
        'TRANSFER_IMBALANCE',
        `Transfer of ${transfer.playerId} for ${transfer.fee} has no matching ledger movement between buyer and seller.`,
        { playerId: transfer.playerId, fee: transfer.fee, cycle: transfer.cycle },
      ));
    }
  }

  // --- Ownership ------------------------------------------------------------
  const owner = new Map<string, ClubId>();
  for (const club of Object.values(state.clubs)) {
    for (const playerId of [...club.squad, ...club.youthSquad]) {
      const existing = owner.get(playerId);
      if (existing && existing !== club.id) {
        out.push(violation(
          'DUAL_OWNERSHIP',
          `Player ${playerId} is registered to both ${existing} and ${club.id}.`,
          { playerId, clubs: [existing, club.id] },
        ));
      }
      owner.set(playerId, club.id);
    }
  }
  for (const player of Object.values(state.players)) {
    const registered = owner.get(player.id) ?? null;
    if (player.clubId !== registered) {
      out.push(violation(
        'DUAL_OWNERSHIP',
        `${player.displayName} thinks he plays for ${player.clubId ?? 'nobody'} but is registered to ${registered ?? 'nobody'}.`,
        { playerId: player.id, playerClubId: player.clubId, registeredTo: registered },
      ));
    }
    if (player.contractId) {
      const contract = state.contracts[player.contractId];
      if (contract && player.clubId && contract.clubId !== player.clubId) {
        out.push(violation(
          'DUAL_OWNERSHIP',
          `${player.displayName}'s contract is with a different club than his registration.`,
          { playerId: player.id, contractClubId: contract.clubId, playerClubId: player.clubId },
        ));
      }
    }
  }

  return out;
}

/** Group an audit report for display: code -> messages. */
export function summariseAudit(violations: readonly InvariantViolation[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const v of violations) {
    const list = out[v.code] ?? (out[v.code] = []);
    list.push(v.message);
  }
  return out;
}

/** True when the economy is in a state we would be happy to ship a save from. */
export const isEconomyClean = (violations: readonly InvariantViolation[]): boolean =>
  violations.length === 0;
