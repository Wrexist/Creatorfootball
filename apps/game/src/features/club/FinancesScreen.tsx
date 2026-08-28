import { memo, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  playerClub, squadWageBill, totalUpkeep, wageBudgetUsage,
  type GameState, type SeasonLedgerTotals, type Transaction,
} from '@cf/engine';
import {
  Divider, EmptyState, GlassButton, GlassPanel, GlassPill, GlassSegmented, KeyValueRow, ProgressBar,
  Screen, SectionHeader, Sparkline, StatCard, StatGrid, cn, formatMoney,
  IconMoney, IconWarning,
} from '@/design';
import { ROUTES } from '@/app/routes';
import { useGameStore } from '@/state/gameStore';
import { ScreenStatus } from './status';
import { facilityDefs, ledgerOf } from './bridge';
import { humanise } from '@/design/text';

/**
 * Finances.
 *
 * The ledger is the source of truth for every number here — no screen-local
 * arithmetic on top of it beyond splitting signed totals into an income column
 * and an expenditure column. If a figure on this screen is wrong, the ledger is
 * wrong, and that is exactly the property we want when a player asks where
 * their money went.
 */

const KIND_LABELS: Record<string, string> = {
  MATCH_REVENUE: 'Matchday', TICKET_REVENUE: 'Tickets', MERCH_REVENUE: 'Merchandise',
  SPONSOR_REVENUE: 'Sponsorship', PRIZE_MONEY: 'Prize money', TRANSFER_IN: 'Player sales',
  TRANSFER_OUT: 'Transfer fees', WAGES: 'Wages', FACILITY_UPGRADE: 'Facility builds',
  FACILITY_UPKEEP: 'Facility upkeep', SCOUTING: 'Scouting', MEDICAL: 'Medical',
  AGENT_FEE: 'Agent fees', SIGNING_BONUS: 'Signing bonuses', PERFORMANCE_BONUS: 'Player bonuses',
  OBJECTIVE_REWARD: 'Objective rewards', STORE_PURCHASE: 'Store', GRANT: 'Grants',
  PENALTY: 'Fines', ADJUSTMENT: 'Adjustments',
};

const label = (kind: string): string => KIND_LABELS[kind] ?? humanise(kind);

type Period = 'recent' | 'season' | 'all';

const LineRow = memo(function LineRow({
  kind, amount, share,
}: {
  kind: string;
  amount: number;
  share: number;
}): ReactNode {
  const positive = amount >= 0;
  return (
    <div className="flex items-center gap-3 border-b border-white/[0.06] py-2.5 last:border-b-0">
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] text-ink">{label(kind)}</span>
        <span className="mt-1 block h-1 w-full overflow-hidden rounded-pill bg-white/[0.06]">
          <span
            className={cn('block h-full rounded-pill', positive ? 'bg-positive' : 'bg-danger/80')}
            style={{ width: `${Math.min(100, share * 100)}%` }}
          />
        </span>
      </span>
      <span className={cn('tnum shrink-0 text-[14px] font-semibold', positive ? 'text-positive' : 'text-danger')}>
        {positive ? '+' : '−'}{formatMoney(Math.abs(amount))}
      </span>
    </div>
  );
});

const TransactionRow = memo(function TransactionRow({
  tx, clubKey,
}: {
  tx: Transaction;
  clubKey: string;
}): ReactNode {
  const inbound = tx.to.kind === 'club' && tx.to.clubId === clubKey;
  return (
    <div className="flex items-center gap-3 border-b border-white/[0.06] py-2 last:border-b-0">
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 block text-[13px] text-ink text-pretty">{tx.memo}</span>
        <span className="block text-[11px] text-ink-dim">
          {label(tx.kind)} · week {tx.cycle}
        </span>
      </span>
      <span className={cn('tnum shrink-0 text-[13px] font-semibold', inbound ? 'text-positive' : 'text-ink-muted')}>
        {inbound ? '+' : '−'}{formatMoney(tx.amount)}
      </span>
    </div>
  );
});

export function FinancesScreen(): ReactNode {
  const phase = useGameStore((s) => s.phase);
  const error = useGameStore((s) => s.error);
  const state = useGameStore((s) => s.state);
  const navigate = useNavigate();

  if (!state) {
    return (
      <Screen title="Finances" onBack={() => navigate(ROUTES.club)}>
        <ScreenStatus phase={phase} error={error} onStart={() => navigate(ROUTES.onboarding)} />
      </Screen>
    );
  }
  return <FinancesBody state={state} />;
}

function FinancesBody({ state }: { state: GameState }): ReactNode {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<Period>('season');

  const data = useMemo(() => {
    const club = playerClub(state);
    const ledger = ledgerOf(state);
    const history: readonly SeasonLedgerTotals[] = ledger.seasonHistory(club.id);
    const seasonRow = history.find((row) => row.season === state.clock.season);

    const byKind: Record<string, number> =
      period === 'recent'
        ? ledger.summaryFor(club.id, Math.max(0, state.clock.cycle - 6))
        : period === 'season'
          ? { ...(seasonRow?.byKind ?? {}) }
          : history.reduce<Record<string, number>>((acc, row) => {
            for (const [kind, value] of Object.entries(row.byKind)) {
              acc[kind] = (acc[kind] ?? 0) + value;
            }
            return acc;
          }, {});

    const income = Object.entries(byKind).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    const spend = Object.entries(byKind).filter(([, v]) => v < 0).sort((a, b) => a[1] - b[1]);
    const incomeTotal = income.reduce((sum, [, v]) => sum + v, 0);
    const spendTotal = spend.reduce((sum, [, v]) => sum + Math.abs(v), 0);

    return {
      club,
      history,
      income,
      spend,
      incomeTotal,
      spendTotal,
      balance: ledger.cashOf(club.id),
      transactions: ledger.ledgerFor(club.id, 40),
      wages: squadWageBill(state, club.id),
      usage: wageBudgetUsage(state, club.id),
      upkeep: totalUpkeep(club, { facilities: () => facilityDefs() }),
      balanceTrend: history.map((row) => row.closingBalance),
    };
  }, [state, period]);

  const { club } = data;
  const net = data.incomeTotal - data.spendTotal;

  return (
    <Screen
      title="Finances"
      subtitle={`${formatMoney(data.balance)} in the bank`}
      onBack={() => navigate(ROUTES.club)}
      headerAccessory={
        <GlassSegmented
          nested
          value={period}
          onChange={setPeriod}
          size="sm"
          aria-label="Reporting period"
          options={[
            { value: 'recent', label: 'Last 6' },
            { value: 'season', label: 'Season' },
            { value: 'all', label: 'All time' },
          ]}
        />
      }
      aside={
        <>
          <GlassPanel title="Standing orders" padding="md">
            <KeyValueRow label="Wage bill" value={`${formatMoney(data.wages)}/wk`} hint={`Budget ${formatMoney(club.finance.wageBudgetPerCycle)}`} />
            <KeyValueRow label="Facility upkeep" value={`${formatMoney(data.upkeep)}/wk`} />
            <KeyValueRow label="Transfer budget" value={formatMoney(club.finance.transferBudget)} />
            <KeyValueRow label="Debt" value={formatMoney(club.finance.debt)} divided={false} />
          </GlassPanel>
          <GlassPanel title="Last week" padding="md">
            <KeyValueRow label="Income" value={formatMoney(club.finance.lastCycleIncome)} />
            <KeyValueRow label="Expenditure" value={formatMoney(club.finance.lastCycleExpenditure)} />
            <KeyValueRow
              label="Net"
              value={formatMoney(club.finance.lastCycleIncome - club.finance.lastCycleExpenditure)}
              divided={false}
              emphasis
            />
          </GlassPanel>
        </>
      }
    >
      <StatGrid columns={2}>
        <StatCard
          label="Balance"
          value={<span>{formatMoney(data.balance)}</span>}
          icon={<IconMoney size={13} />}
          {...(data.balanceTrend.length > 1 ? { history: data.balanceTrend } : {})}
          footnote="Cash available now"
        />
        <StatCard
          label={period === 'season' ? 'Season net' : period === 'recent' ? 'Net, last 6 weeks' : 'Net, all time'}
          value={<span>{formatMoney(net)}</span>}
          tone={net >= 0 ? 'positive' : 'danger'}
          footnote={`${formatMoney(data.incomeTotal)} in · ${formatMoney(data.spendTotal)} out`}
        />
      </StatGrid>

      {/* --- wages against budget ------------------------------------- */}
      <GlassPanel padding="md" accent={data.usage > 1 ? 'danger' : 'none'}>
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-ink-muted">Wage bill</h3>
          <GlassPill size="sm" tone={data.usage > 1 ? 'danger' : data.usage > 0.9 ? 'warning' : 'positive'}>
            {Math.round(data.usage * 100)}% of budget
          </GlassPill>
        </div>
        <div className="mt-3">
          <ProgressBar
            value={Math.min(150, data.usage * 100)}
            max={150}
            marker={100}
            size="md"
            tone={data.usage > 1 ? 'danger' : data.usage > 0.9 ? 'warning' : 'positive'}
            valueLabel={`${formatMoney(data.wages)} / ${formatMoney(club.finance.wageBudgetPerCycle)}`}
          />
        </div>
        {data.usage > 1 && (
          <div className="mt-3 flex items-start gap-2.5">
            <IconWarning size={17} className="mt-0.5 shrink-0 text-danger" />
            <p className="text-[12px] leading-relaxed text-danger text-pretty">
              You are over the wage allowance. Every week this continues eats into cash you would otherwise spend on
              facilities or fees — and the board notices before the fans do.
            </p>
          </div>
        )}
      </GlassPanel>

      {/* --- income and expenditure ---------------------------------- */}
      <SectionHeader title="Income" subtitle={`${formatMoney(data.incomeTotal)} total`} />
      <GlassPanel padding="md">
        {data.income.length === 0 ? (
          <p className="py-2 text-[13px] text-ink-muted">Nothing has come in during this period yet.</p>
        ) : (
          data.income.map(([kind, value]) => (
            <LineRow key={kind} kind={kind} amount={value} share={data.incomeTotal > 0 ? value / data.incomeTotal : 0} />
          ))
        )}
      </GlassPanel>

      <SectionHeader title="Expenditure" subtitle={`${formatMoney(data.spendTotal)} total`} />
      <GlassPanel padding="md">
        {data.spend.length === 0 ? (
          <p className="py-2 text-[13px] text-ink-muted">Nothing has gone out during this period yet.</p>
        ) : (
          data.spend.map(([kind, value]) => (
            <LineRow key={kind} kind={kind} amount={value} share={data.spendTotal > 0 ? Math.abs(value) / data.spendTotal : 0} />
          ))
        )}
      </GlassPanel>

      {/* --- season history ------------------------------------------ */}
      {data.history.length > 0 && (
        <>
          <SectionHeader title="Season by season" subtitle="Closing balance at the end of each campaign" />
          <GlassPanel padding="md">
            {data.balanceTrend.length > 1 && (
              <div className="mb-3 flex items-center gap-3">
                <Sparkline values={data.balanceTrend} width={180} height={40} tone="volt" fill label="Balance by season" />
                <span className="text-[12px] text-ink-muted">{data.history.length} seasons recorded</span>
              </div>
            )}
            {data.history.map((row) => (
              <KeyValueRow
                key={row.season}
                label={`Season ${row.season}`}
                hint={`${formatMoney(row.income)} in · ${formatMoney(row.expenditure)} out`}
                value={formatMoney(row.closingBalance)}
                divided={row.season !== data.history[data.history.length - 1]?.season}
              />
            ))}
          </GlassPanel>
        </>
      )}

      {/* --- transactions -------------------------------------------- */}
      <SectionHeader title="Recent transactions" subtitle="Every movement, with the reason attached" />
      <GlassPanel padding="md">
        {data.transactions.length === 0 ? (
          <EmptyState
            size="sm"
            icon={<IconMoney />}
            title="No transactions yet"
            description="Money starts moving on your first matchweek: wages out, gate receipts and sponsorship in."
          />
        ) : (
          data.transactions.map((tx) => <TransactionRow key={tx.id} tx={tx} clubKey={club.id} />)
        )}
      </GlassPanel>

      <Divider />
      <div className="flex flex-wrap gap-2 pb-2">
        <GlassButton variant="ghost" size="sm" onClick={() => navigate(ROUTES.sponsors)}>Sponsorship</GlassButton>
        <GlassButton variant="ghost" size="sm" onClick={() => navigate(ROUTES.facilities)}>Facilities</GlassButton>
        <GlassButton variant="ghost" size="sm" onClick={() => navigate(ROUTES.squad)}>Wages by player</GlassButton>
      </div>
    </Screen>
  );
}
