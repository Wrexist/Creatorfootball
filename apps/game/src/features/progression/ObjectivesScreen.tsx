import { memo, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { rewardSummary, type GameState, type Objective } from '@cf/engine';
import {
  Divider, EmptyState, GlassButton, GlassPanel, GlassPill, IconCheck, IconStar, IconTrophy,
  KeyValueRow, ProgressBar, Screen, SectionHeader, StatCard, StatGrid, cn, useToast,
} from '@/design';
import { ROUTES } from '@/app/routes';
import { GateScreen, useGameStatus } from './gate';
import { claimReward } from './engine';

/**
 * Objectives.
 *
 * The board, the fans, your sponsors and the season itself all want different
 * things from you, and this screen keeps those voices separate rather than
 * flattening them into a quest log. Claiming goes through the engine, which is
 * idempotent — so the button is disabled the moment a reward is paid, and if a
 * claim is refused the screen says exactly why instead of pretending.
 */

const SOURCE_LABEL: Record<Objective['source'], string> = {
  SEASON: 'Season target',
  DYNAMIC: 'Opportunity',
  SPONSOR: 'Sponsor',
  BOARD: 'The board',
  FANS: 'The supporters',
};

const SOURCE_TONE: Record<Objective['source'], 'volt' | 'info' | 'warning' | 'special' | 'neutral'> = {
  SEASON: 'volt',
  DYNAMIC: 'info',
  SPONSOR: 'warning',
  BOARD: 'special',
  FANS: 'neutral',
};

interface ObjectiveCardProps {
  objective: Objective;
  cycle: number;
  claiming: boolean;
  onClaim: (objective: Objective) => void;
}

const ObjectiveCard = memo(function ObjectiveCard({
  objective, cycle, claiming, onClaim,
}: ObjectiveCardProps): ReactNode {
  const pct = objective.target > 0
    ? Math.min(100, Math.round((objective.progress / objective.target) * 100))
    : 0;
  const claimable = objective.status === 'COMPLETED';
  const claimed = objective.status === 'CLAIMED';
  const expiresIn = objective.expiresCycle === null ? null : objective.expiresCycle - cycle;

  return (
    <GlassPanel
      padding="md"
      accent={claimable ? 'volt' : objective.status === 'FAILED' ? 'danger' : 'none'}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <GlassPill tone={SOURCE_TONE[objective.source]} size="xs" filled={claimable}>
              {SOURCE_LABEL[objective.source]}
            </GlassPill>
            {objective.importance >= 4 && <GlassPill tone="warning" size="xs">Major</GlassPill>}
            {expiresIn !== null && expiresIn <= 3 && !claimed && (
              <GlassPill tone={expiresIn <= 1 ? 'danger' : 'warning'} size="xs">
                {expiresIn <= 0 ? 'Expired' : expiresIn === 1 ? 'Last week' : `${expiresIn} weeks left`}
              </GlassPill>
            )}
          </div>
          <p className="mt-1.5 font-display text-[17px] font-bold leading-tight text-ink text-pretty">
            {objective.title}
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-muted text-pretty">
            {objective.description}
          </p>
        </div>
        {claimed && (
          <span
            aria-label="Claimed"
            className="flex size-7 shrink-0 items-center justify-center rounded-pill bg-positive/20 text-positive"
          >
            <IconCheck size={16} />
          </span>
        )}
      </div>

      <ProgressBar
        className="mt-3"
        value={pct}
        tone={claimable || claimed ? 'positive' : objective.status === 'FAILED' ? 'danger' : 'volt'}
        label="Progress"
        valueLabel={`${objective.progress} / ${objective.target}`}
      />

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {objective.rewards.map((reward, index) => (
          <GlassPill key={`${reward.kind}-${index}`} size="xs">
            {reward.label}
          </GlassPill>
        ))}
        {objective.rewards.length === 0 && (
          <span className="text-[12px] text-ink-dim">No material reward — just the record.</span>
        )}
      </div>

      {claimable && (
        <GlassButton
          className="mt-3"
          variant="primary"
          block
          loading={claiming}
          onClick={() => onClaim(objective)}
        >
          Claim {rewardSummary(objective) || 'reward'}
        </GlassButton>
      )}
      {claimed && (
        <p className="mt-3 text-[12px] text-ink-dim">
          Paid out. Rewards are posted through the ledger with a one-time key, so this can never be
          claimed again.
        </p>
      )}
    </GlassPanel>
  );
});

function ObjectivesView({ state }: { state: GameState }): ReactNode {
  const navigate = useNavigate();
  const toast = useToast();
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const seasonTargets = state.objectives.seasonTargets;
  const active = useMemo(
    () =>
      state.objectives.active
        .slice()
        .sort((a, b) => {
          const rank = (o: Objective): number => (o.status === 'COMPLETED' ? 0 : 1);
          return rank(a) - rank(b) || b.importance - a.importance;
        }),
    [state.objectives.active],
  );
  const completed = useMemo(
    () => state.objectives.completed.slice().reverse().slice(0, 12),
    [state.objectives.completed],
  );

  const claimable = useMemo(
    () => [...active, ...seasonTargets].filter((o) => o.status === 'COMPLETED').length,
    [active, seasonTargets],
  );

  const handleClaim = (objective: Objective): void => {
    setClaimingId(objective.id);
    const report = claimReward(objective);
    setClaimingId(null);
    if (report.ok) toast.success(report.title, report.detail);
    else toast.error(report.title, report.detail);
  };

  return (
    <Screen
      title="Objectives"
      subtitle={claimable > 0 ? `${claimable} ready to claim` : `${active.length} in progress`}
      aside={
        <>
          <GlassPanel title="Where they come from" padding="md">
            <div className="flex flex-col gap-2">
              {(Object.keys(SOURCE_LABEL) as Objective['source'][]).map((source) => (
                <div key={source} className="flex items-start gap-2.5">
                  <GlassPill tone={SOURCE_TONE[source]} size="xs">{SOURCE_LABEL[source]}</GlassPill>
                </div>
              ))}
            </div>
            <Divider className="my-3" />
            <p className="text-[12px] leading-relaxed text-ink-dim text-pretty">
              Objectives are set against what your club can actually do right now. The board will
              not ask a struggling side for twelve wins in four matches.
            </p>
          </GlassPanel>
          <GlassButton variant="secondary" block onClick={() => navigate(ROUTES.rewards)}>
            See what you have earned
          </GlassButton>
        </>
      }
    >
      <StatGrid columns={3}>
        <StatCard label="Active" value={active.length} size="sm" />
        <StatCard
          label="Ready to claim"
          value={claimable}
          size="sm"
          tone={claimable > 0 ? 'positive' : 'neutral'}
          icon={<IconStar />}
        />
        <StatCard label="Completed" value={state.objectives.completed.length} size="sm" icon={<IconTrophy />} />
      </StatGrid>

      {seasonTargets.length > 0 && (
        <>
          <SectionHeader
            title="Season targets"
            subtitle="What you are actually being judged on"
          />
          {seasonTargets.map((objective) => (
            <ObjectiveCard
              key={objective.id}
              objective={objective}
              cycle={state.clock.cycle}
              claiming={claimingId === objective.id}
              onClaim={handleClaim}
            />
          ))}
        </>
      )}

      <SectionHeader title="In progress" subtitle="Claimable ones first" />
      {active.length === 0 ? (
        <EmptyState
          icon={<IconTrophy />}
          title="Nothing on the board"
          description="New objectives are set as the season moves and as your situation changes. Play a matchweek and the board will find something to ask of you."
        />
      ) : (
        active.map((objective) => (
          <ObjectiveCard
            key={objective.id}
            objective={objective}
            cycle={state.clock.cycle}
            claiming={claimingId === objective.id}
            onClaim={handleClaim}
          />
        ))
      )}

      {completed.length > 0 && (
        <GlassPanel title="Settled" padding="md">
          {completed.map((objective) => (
            <KeyValueRow
              key={objective.id}
              label={objective.title}
              hint={rewardSummary(objective)}
              value={
                <GlassPill
                  tone={objective.status === 'CLAIMED' ? 'positive' : objective.status === 'FAILED' ? 'danger' : 'neutral'}
                  size="xs"
                >
                  {objective.status === 'CLAIMED' ? 'Claimed' : objective.status === 'FAILED' ? 'Failed' : 'Complete'}
                </GlassPill>
              }
            />
          ))}
        </GlassPanel>
      )}

      <p className={cn('text-[12px] leading-relaxed text-ink-dim text-pretty')}>
        Rewards move through the same ledger as everything else in your club, with a single-use key
        per reward. That is what makes double-claiming impossible rather than merely discouraged.
      </p>
    </Screen>
  );
}

export function ObjectivesScreen(): ReactNode {
  const gate = useGameStatus();
  if (gate.status !== 'ready') return <GateScreen gate={gate} title="Objectives" />;
  return <ObjectivesView state={gate.state} />;
}
