import { memo, useMemo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  specialRuleById, type GameState, type Objective, type Transaction,
} from '@cf/engine';
import {
  Divider, EmptyState, GlassButton, GlassPanel, GlassPill, IconCard, IconScout, IconStadium,
  IconTrophy, KeyValueRow, MoneyLabel, Screen, SectionHeader, StatCard, StatGrid, Timeline,
  type TimelineItem,
} from '@/design';
import { ROUTES } from '@/app/routes';
import { GateScreen, useGameStatus } from './gate';

/**
 * Rewards.
 *
 * Not a trophy wall — a record of what was earned and what it did. Every row
 * has a consequence attached, because a reward whose effect you cannot see is
 * indistinguishable from a number going up.
 */

const relative = (now: number, then: number): string => {
  const delta = Math.max(0, now - then);
  if (delta === 0) return 'this week';
  if (delta === 1) return 'last week';
  return `${delta} weeks ago`;
};

const CONSEQUENCE: Record<string, string> = {
  CASH: 'Went straight into the transfer and wage budgets.',
  PREMIUM: 'Tokens, spendable on cosmetics and convenience only.',
  RULE_CARD: 'A rule card you can play in a match.',
  SCOUT_CREDIT: 'Credits toward scouting reports.',
  COSMETIC: 'A cosmetic unlock. No effect on results.',
  FACILITY_CREDIT: 'Credit against a facility upgrade.',
  REPUTATION: 'Club reputation, which gates sponsors and player interest.',
};

const ClaimRow = memo(function ClaimRow({
  objective,
}: { objective: Objective }): ReactNode {
  return (
    <div className="border-b border-white/[0.06] py-3 last:border-b-0">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-ink text-pretty">{objective.title}</p>
          <p className="mt-0.5 text-[12px] text-ink-dim">{objective.source.toLowerCase()}</p>
        </div>
        <GlassPill tone={objective.status === 'CLAIMED' ? 'positive' : 'neutral'} size="xs">
          {objective.status === 'CLAIMED' ? 'Paid' : 'Unclaimed'}
        </GlassPill>
      </div>
      <ul className="mt-2 flex flex-col gap-1.5">
        {objective.rewards.map((reward, index) => (
          <li key={`${reward.kind}-${index}`} className="flex items-start gap-2">
            <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-pill bg-volt" />
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold text-ink">{reward.label}</span>
              <span className="block text-[12px] text-ink-muted text-pretty">
                {CONSEQUENCE[reward.kind] ?? 'Recorded against your club.'}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
});

function RewardsView({ state }: { state: GameState }): ReactNode {
  const navigate = useNavigate();

  const claimed = useMemo(
    () => state.objectives.completed.filter((o) => o.status === 'CLAIMED').slice().reverse(),
    [state.objectives.completed],
  );

  /** The ledger is the record of record: these rows actually moved money. */
  const payouts = useMemo<Transaction[]>(
    () =>
      state.ledger.transactions
        .filter((tx) => tx.kind === 'OBJECTIVE_REWARD')
        .slice(-20)
        .reverse(),
    [state.ledger.transactions],
  );

  const cashTotal = useMemo(
    () => payouts.filter((tx) => tx.currency === 'CASH').reduce((sum, tx) => sum + tx.amount, 0),
    [payouts],
  );

  const milestones = useMemo<TimelineItem[]>(
    () =>
      state.legacy.milestones
        .slice()
        .reverse()
        .slice(0, 12)
        .map((milestone, index) => ({
          id: `milestone-${index}`,
          title: milestone.text,
          time: relative(state.clock.cycle, milestone.cycle),
          tone: milestone.importance >= 4 ? 'volt' : 'neutral',
        })),
    [state.legacy.milestones, state.clock.cycle],
  );

  const ruleCards = state.inventory.ruleCards.filter((card) => card.quantity > 0);

  return (
    <Screen
      title="Rewards"
      subtitle="What you earned, and what it did"
      onBack={() => navigate(ROUTES.objectives)}
      aside={
        <GlassPanel title="What you hold" padding="md">
          <KeyValueRow
            label="Scouting credits"
            value={state.inventory.scoutCredits}
            hint="Spent on reports"
            icon={<IconScout />}
          />
          <KeyValueRow
            label="Facility credits"
            value={state.inventory.facilityCredits}
            hint="Offset against an upgrade"
            icon={<IconStadium />}
          />
          <KeyValueRow
            label="Cosmetics"
            value={state.inventory.cosmeticIds.length}
            hint="Kits, badges, presentation"
            divided={false}
          />
        </GlassPanel>
      }
    >
      <StatGrid columns={3}>
        <StatCard label="Rewards claimed" value={claimed.length} size="sm" icon={<IconTrophy />} />
        <StatCard label="Cash earned" value={<MoneyLabel amount={cashTotal} size="lg" />} size="sm" />
        <StatCard label="Rule cards held" value={ruleCards.reduce((n, c) => n + c.quantity, 0)} size="sm" icon={<IconCard />} />
      </StatGrid>

      {ruleCards.length > 0 && (
        <GlassPanel title="Rule cards" padding="md">
          <div className="flex flex-col gap-2.5">
            {ruleCards.map((card) => {
              const rule = specialRuleById(card.ruleId);
              return (
                <div key={card.ruleId} className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-3">
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ink">
                      {rule.name}
                    </span>
                    <GlassPill tone="special" size="xs" filled>×{card.quantity}</GlassPill>
                  </div>
                  <p className="mt-1 text-[13px] leading-relaxed text-ink-muted text-pretty">
                    {rule.description}
                  </p>
                  <p className="mt-1 text-[12px] leading-relaxed text-warning text-pretty">
                    {rule.counterplay}
                  </p>
                </div>
              );
            })}
          </div>
        </GlassPanel>
      )}

      <GlassPanel title="Claimed" padding="md">
        {claimed.length === 0 ? (
          <EmptyState
            size="sm"
            icon={<IconTrophy />}
            title="Nothing claimed yet"
            description="Finish an objective and the reward — and what it changed — will be recorded here."
            action={
              <GlassButton variant="secondary" size="sm" onClick={() => navigate(ROUTES.objectives)}>
                See your objectives
              </GlassButton>
            }
          />
        ) : (
          <div>
            {claimed.map((objective) => (
              <ClaimRow key={objective.id} objective={objective} />
            ))}
          </div>
        )}
      </GlassPanel>

      <GlassPanel title="Posted to your accounts" padding="md">
        {payouts.length === 0 ? (
          <EmptyState
            size="sm"
            title="No payouts recorded"
            description="Every reward moves through the ledger. When one does, the transaction appears here."
          />
        ) : (
          <div>
            {payouts.map((tx) => (
              <KeyValueRow
                key={tx.id}
                label={tx.memo}
                hint={`Matchweek ${tx.cycle} · ${tx.currency.toLowerCase()}`}
                value={tx.amount > 0 ? <MoneyLabel amount={tx.amount} size="md" /> : '—'}
              />
            ))}
          </div>
        )}
        <Divider className="my-3" />
        <p className="text-[12px] leading-relaxed text-ink-dim text-pretty">
          Non-cash rewards post a zero-value record so the ledger still knows they were granted.
          That is how a reward is guaranteed to be paid exactly once.
        </p>
      </GlassPanel>

      {milestones.length > 0 && (
        <>
          <SectionHeader title="Milestones" subtitle="The moments worth remembering" />
          <GlassPanel padding="md">
            <Timeline items={milestones} animate={false} />
          </GlassPanel>
        </>
      )}
    </Screen>
  );
}

export function RewardsScreen(): ReactNode {
  const gate = useGameStatus();
  if (gate.status !== 'ready') return <GateScreen gate={gate} title="Rewards" />;
  return <RewardsView state={gate.state} />;
}
