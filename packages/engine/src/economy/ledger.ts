import type { ClubId, TransactionId } from '../core/brand';
import { IdFactory } from '../core/ids';
import { invariant } from '../core/invariant';
import { isFiniteNumber } from '../core/math';
import { err, ok, type Result } from '../core/result';

/**
 * Double-entry-inspired transaction ledger.
 *
 * RULE: no module may mutate a balance directly. Every movement of value is a
 * recorded transaction with a source, a destination and a reason. This is what
 * makes the economy auditable, makes "where did my money go?" answerable in the
 * UI, and makes duplicate-reward exploits detectable rather than invisible.
 */

export type Currency = 'CASH' | 'PREMIUM';

export const TRANSACTION_KINDS = [
  'MATCH_REVENUE', 'TICKET_REVENUE', 'MERCH_REVENUE', 'SPONSOR_REVENUE',
  'PRIZE_MONEY', 'TRANSFER_IN', 'TRANSFER_OUT', 'WAGES', 'FACILITY_UPGRADE',
  'FACILITY_UPKEEP', 'SCOUTING', 'MEDICAL', 'AGENT_FEE', 'SIGNING_BONUS',
  'PERFORMANCE_BONUS', 'OBJECTIVE_REWARD', 'STORE_PURCHASE', 'GRANT',
  'PENALTY', 'ADJUSTMENT',
] as const;
export type TransactionKind = (typeof TRANSACTION_KINDS)[number];

/** A named bucket money can come from or go to. `world` is the sink/source outside any club. */
export type LedgerAccount =
  | { readonly kind: 'club'; readonly clubId: ClubId }
  | { readonly kind: 'world'; readonly label: string };

export const clubAccount = (clubId: ClubId): LedgerAccount => ({ kind: 'club', clubId });
export const worldAccount = (label: string): LedgerAccount => ({ kind: 'world', label });

export interface Transaction {
  readonly id: TransactionId;
  readonly kind: TransactionKind;
  readonly currency: Currency;
  /** Always positive. Direction is expressed by from/to, never by sign. */
  readonly amount: number;
  readonly from: LedgerAccount;
  readonly to: LedgerAccount;
  readonly cycle: number;
  readonly season: number;
  readonly at: number;
  readonly memo: string;
  readonly metadata?: Readonly<Record<string, string | number | boolean>>;
  /** Set for transactions that must never be applied twice (rewards, purchases). */
  readonly idempotencyKey?: string;
}

export interface Balances {
  readonly CASH: number;
  readonly PREMIUM: number;
}

export type LedgerError =
  | { readonly code: 'INSUFFICIENT_FUNDS'; readonly clubId: ClubId; readonly required: number; readonly available: number }
  | { readonly code: 'INVALID_AMOUNT'; readonly amount: number }
  | { readonly code: 'DUPLICATE'; readonly key: string };

export interface LedgerSnapshot {
  readonly balances: Record<string, Balances>;
  readonly transactions: readonly Transaction[];
  readonly idCounters: Record<string, number>;
  /** key -> cycle applied. Pruned on a long window; see KEY_RETENTION_CYCLES. */
  readonly appliedKeys: Readonly<Record<string, number>>;
  /** Never pruned: real-money purchases must stay idempotent forever. */
  readonly permanentKeys: readonly string[];
  readonly seasonTotals: readonly SeasonLedgerTotals[];
}

/**
 * Per-season aggregate totals, retained for the life of the save.
 *
 * Individual transactions are pruned so a twenty-season dynasty does not carry
 * a hundred thousand rows in its save file, but the aggregate must survive:
 * without it the "100 seasons" economy audit would only ever be auditing a
 * recent window, and the club history screen would forget its own past.
 */
export interface SeasonLedgerTotals {
  readonly season: number;
  readonly clubId: string;
  readonly income: number;
  readonly expenditure: number;
  readonly byKind: Readonly<Record<string, number>>;
  readonly closingBalance: number;
}

/**
 * How long an idempotency key is remembered. Nine seasons at 22 matchweeks is
 * far longer than any objective, sponsor bonus or reward stays claimable, so
 * pruning past it cannot resurrect a double-claim — while keeping save growth
 * bounded rather than monotonic.
 */
export const KEY_RETENTION_CYCLES = 200;

/** Transaction kinds whose idempotency must never expire. */
const PERMANENT_KEY_KINDS: ReadonlySet<TransactionKind> = new Set(['STORE_PURCHASE']);

const ZERO: Balances = { CASH: 0, PREMIUM: 0 };

export class Ledger {
  private balances = new Map<string, Balances>();
  private transactions: Transaction[] = [];
  private appliedKeys = new Map<string, number>();
  private permanentKeys = new Set<string>();
  private seasonTotals: SeasonLedgerTotals[] = [];
  private ids: IdFactory;
  /** Keep the tail bounded; the season roll-up archives older entries. */
  private maxEntries: number;

  constructor(prefix = 'tx', maxEntries = 4000) {
    this.ids = new IdFactory(prefix);
    this.maxEntries = maxEntries;
  }

  private key(a: LedgerAccount): string {
    return a.kind === 'club' ? `club:${a.clubId}` : `world:${a.label}`;
  }

  balanceOf(clubId: ClubId): Balances {
    return this.balances.get(`club:${clubId}`) ?? ZERO;
  }

  cashOf(clubId: ClubId): number { return this.balanceOf(clubId).CASH; }

  canAfford(clubId: ClubId, amount: number, currency: Currency = 'CASH'): boolean {
    return this.balanceOf(clubId)[currency] >= amount;
  }

  /** Seed a club's opening balance. Recorded as a GRANT from the world. */
  open(clubId: ClubId, amount: number, ctx: PostContext, currency: Currency = 'CASH'): void {
    this.post({
      kind: 'GRANT', currency, amount,
      from: worldAccount('genesis'), to: clubAccount(clubId),
      memo: 'Opening balance',
    }, ctx, { allowOverdraft: true });
  }

  /**
   * Record a transaction. Rejects rather than throws so callers can surface a
   * user-facing "you can't afford this" without exception handling.
   */
  post(
    input: {
      kind: TransactionKind;
      currency?: Currency;
      amount: number;
      from: LedgerAccount;
      to: LedgerAccount;
      memo: string;
      metadata?: Record<string, string | number | boolean>;
      idempotencyKey?: string;
    },
    ctx: PostContext,
    opts: { allowOverdraft?: boolean } = {},
  ): Result<Transaction, LedgerError> {
    const currency = input.currency ?? 'CASH';
    const amount = Math.round(input.amount);

    if (!isFiniteNumber(amount) || amount < 0) {
      return err({ code: 'INVALID_AMOUNT', amount: input.amount });
    }
    if (input.idempotencyKey && this.hasApplied(input.idempotencyKey)) {
      return err({ code: 'DUPLICATE', key: input.idempotencyKey });
    }

    const fromKey = this.key(input.from);
    const fromBal = this.balances.get(fromKey) ?? ZERO;
    if (input.from.kind === 'club' && !opts.allowOverdraft && fromBal[currency] < amount) {
      return err({
        code: 'INSUFFICIENT_FUNDS',
        clubId: input.from.clubId,
        required: amount,
        available: fromBal[currency],
      });
    }

    const tx: Transaction = {
      id: this.ids.next<TransactionId>('tx'),
      kind: input.kind,
      currency,
      amount,
      from: input.from,
      to: input.to,
      cycle: ctx.cycle,
      season: ctx.season,
      at: ctx.at,
      memo: input.memo,
      ...(input.metadata ? { metadata: input.metadata } : {}),
      ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
    };

    // Only club accounts carry a tracked balance; the world is an infinite sink.
    if (input.from.kind === 'club') {
      this.balances.set(fromKey, { ...fromBal, [currency]: fromBal[currency] - amount });
    }
    if (input.to.kind === 'club') {
      const toKey = this.key(input.to);
      const toBal = this.balances.get(toKey) ?? ZERO;
      this.balances.set(toKey, { ...toBal, [currency]: toBal[currency] + amount });
    }

    if (input.idempotencyKey) {
      if (PERMANENT_KEY_KINDS.has(input.kind)) this.permanentKeys.add(input.idempotencyKey);
      else this.appliedKeys.set(input.idempotencyKey, ctx.cycle);
    }
    this.accumulate(tx);
    this.transactions.push(tx);
    if (this.transactions.length > this.maxEntries) {
      this.transactions.splice(0, this.transactions.length - this.maxEntries);
    }
    return ok(tx);
  }

  /** Convenience: money entering a club from outside the club system. */
  credit(clubId: ClubId, kind: TransactionKind, amount: number, memo: string, ctx: PostContext, extra: { currency?: Currency; idempotencyKey?: string; metadata?: Record<string, string | number | boolean> } = {}) {
    return this.post({ kind, amount, from: worldAccount(kind.toLowerCase()), to: clubAccount(clubId), memo, ...extra }, ctx);
  }

  /** Convenience: money leaving a club to outside the club system. */
  debit(clubId: ClubId, kind: TransactionKind, amount: number, memo: string, ctx: PostContext, extra: { currency?: Currency; idempotencyKey?: string; allowOverdraft?: boolean; metadata?: Record<string, string | number | boolean> } = {}) {
    const { allowOverdraft, ...rest } = extra;
    return this.post(
      { kind, amount, from: clubAccount(clubId), to: worldAccount(kind.toLowerCase()), memo, ...rest },
      ctx,
      { allowOverdraft: allowOverdraft ?? false },
    );
  }

  ledgerFor(clubId: ClubId, limit = 50): Transaction[] {
    const key = `club:${clubId}`;
    const out: Transaction[] = [];
    for (let i = this.transactions.length - 1; i >= 0 && out.length < limit; i--) {
      const tx = this.transactions[i] as Transaction;
      if (this.key(tx.from) === key || this.key(tx.to) === key) out.push(tx);
    }
    return out;
  }

  /** Net movement per transaction kind over a cycle window, for the finance screen. */
  summaryFor(clubId: ClubId, sinceCycle: number): Record<string, number> {
    const key = `club:${clubId}`;
    const out: Record<string, number> = {};
    for (const tx of this.transactions) {
      if (tx.cycle < sinceCycle || tx.currency !== 'CASH') continue;
      const inbound = this.key(tx.to) === key;
      const outbound = this.key(tx.from) === key;
      if (!inbound && !outbound) continue;
      out[tx.kind] = (out[tx.kind] ?? 0) + (inbound ? tx.amount : -tx.amount);
    }
    return out;
  }

  all(): readonly Transaction[] { return this.transactions; }

  hasApplied(key: string): boolean {
    return this.permanentKeys.has(key) || this.appliedKeys.has(key);
  }

  /**
   * Fold a transaction into the per-season aggregate. Called on every post, so
   * the rollup is always complete regardless of how aggressively the individual
   * transaction tail is pruned.
   */
  private accumulate(tx: Transaction): void {
    if (tx.currency !== 'CASH') return;
    for (const [account, inbound] of [[tx.to, true], [tx.from, false]] as const) {
      if (account.kind !== 'club') continue;
      const clubId = account.clubId as string;
      let row = this.seasonTotals.find((r) => r.season === tx.season && r.clubId === clubId);
      if (!row) {
        row = { season: tx.season, clubId, income: 0, expenditure: 0, byKind: {}, closingBalance: 0 };
        this.seasonTotals.push(row);
      }
      const byKind = { ...row.byKind };
      byKind[tx.kind] = (byKind[tx.kind] ?? 0) + (inbound ? tx.amount : -tx.amount);
      const updated: SeasonLedgerTotals = {
        ...row,
        income: row.income + (inbound ? tx.amount : 0),
        expenditure: row.expenditure + (inbound ? 0 : tx.amount),
        byKind,
        closingBalance: (this.balances.get(`club:${clubId}`) ?? ZERO).CASH,
      };
      this.seasonTotals[this.seasonTotals.indexOf(row)] = updated;
    }
  }

  /** Complete per-season history, retained for the life of the save. */
  seasonHistory(clubId?: ClubId): readonly SeasonLedgerTotals[] {
    return clubId ? this.seasonTotals.filter((r) => r.clubId === clubId) : this.seasonTotals;
  }

  /**
   * Drop idempotency keys older than the retention window. Called at each
   * season boundary so save size stays bounded across a long dynasty.
   */
  pruneKeys(currentCycle: number): number {
    let pruned = 0;
    for (const [key, cycle] of this.appliedKeys) {
      if (currentCycle - cycle > KEY_RETENTION_CYCLES) {
        this.appliedKeys.delete(key);
        pruned++;
      }
    }
    return pruned;
  }

  /** Every tracked balance must be finite and every transaction auditable. */
  verify(): string[] {
    const problems: string[] = [];
    for (const [account, bal] of this.balances) {
      if (!isFiniteNumber(bal.CASH) || !isFiniteNumber(bal.PREMIUM)) {
        problems.push(`Non-finite balance on ${account}`);
      }
    }
    const seen = new Set<string>();
    for (const tx of this.transactions) {
      if (seen.has(tx.id)) problems.push(`Duplicate transaction id ${tx.id}`);
      seen.add(tx.id);
      if (tx.amount < 0) problems.push(`Negative amount on ${tx.id}`);
      if (!isFiniteNumber(tx.amount)) problems.push(`Non-finite amount on ${tx.id}`);
    }
    return problems;
  }

  snapshot(): LedgerSnapshot {
    return {
      balances: Object.fromEntries(this.balances),
      // Persist the same window we keep in memory: a loaded save that knows
      // less than the session that wrote it is a confusing class of bug.
      transactions: this.transactions.slice(-this.maxEntries),
      idCounters: this.ids.serialize(),
      appliedKeys: Object.fromEntries(this.appliedKeys),
      permanentKeys: [...this.permanentKeys],
      seasonTotals: this.seasonTotals,
    };
  }

  static restore(snapshot: LedgerSnapshot, prefix = 'tx'): Ledger {
    const l = new Ledger(prefix);
    l.balances = new Map(Object.entries(snapshot.balances));
    l.transactions = snapshot.transactions.slice();
    // Tolerate the pre-rollup snapshot shape so an in-flight save still loads.
    l.appliedKeys = new Map(
      Array.isArray(snapshot.appliedKeys)
        ? (snapshot.appliedKeys as readonly string[]).map((k) => [k, 0] as const)
        : Object.entries(snapshot.appliedKeys ?? {}),
    );
    l.permanentKeys = new Set(snapshot.permanentKeys ?? []);
    l.seasonTotals = (snapshot.seasonTotals ?? []).slice();
    l.ids = IdFactory.restore(prefix, snapshot.idCounters);
    return l;
  }
}

export interface PostContext {
  readonly cycle: number;
  readonly season: number;
  readonly at: number;
}

/** Formats money for the UI. Kept in the engine so every surface agrees. */
export function formatMoney(amount: number, opts: { compact?: boolean } = {}): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (opts.compact !== false) {
    if (abs >= 1_000_000_000) return `${sign}£${(abs / 1_000_000_000).toFixed(abs >= 10_000_000_000 ? 0 : 1)}B`;
    if (abs >= 1_000_000) return `${sign}£${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
    if (abs >= 1_000) return `${sign}£${(abs / 1_000).toFixed(abs >= 100_000 ? 0 : 0)}K`;
  }
  return `${sign}£${Math.round(abs).toLocaleString('en-GB')}`;
}

export const assertLedgerClean = (ledger: Ledger): void => {
  const problems = ledger.verify();
  invariant(problems.length === 0, 'LEDGER_DIRTY', problems.join('; '));
};
