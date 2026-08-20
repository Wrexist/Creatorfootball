import { memo, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { rewardSummary, type GameState, type Objective } from '@cf/engine';
import {
  Divider, EmptyState, GlassButton, GlassPanel, GlassPill, HeroSurface, IconCheck, IconTrophy, ListRow, ProgressBar, Screen, SectionHeader, StatBlock, Text, useToast,
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
          <Text role="title" as="p" className="mt-1.5 text-[19px] text-pretty">
            {objective.title}
          </Text>
          <Text role="caption" as="p" className="mt-1 text-pretty">
            {objective.description}
          </Text>
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
        label={
          claimed ? 'Done and paid'
            : claimable ? 'Done — waiting on you'
              : objective.status === 'FAILED' ? 'Missed'
                : `${objective.progress} of ${objective.target} so far`
        }
        valueLabel={`${pct}%`}
      />

      {/* What it pays, stated before the button that pays it. */}
      <div className="mt-3">
        <Text role="micro" as="p">It pays</Text>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {objective.rewards.map((reward, index) => (
            <GlassPill key={`${reward.kind}-${index}`} size="sm" tone={claimable ? 'volt' : 'neutral'}>
              {reward.label}
            </GlassPill>
          ))}
          {objective.rewards.length === 0 && (
            <Text role="caption" as="span" className="text-ink-dim">
              Nothing material — this one is for the record books.
            </Text>
          )}
        </div>
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
        <Text role="caption" as="p" className="mt-3 text-ink-dim text-pretty">
          Paid out. Rewards are posted through the ledger with a one-time key, so this can never be
          claimed again.
        </Text>
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
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(SOURCE_LABEL) as Objective['source'][]).map((source) => (
                <GlassPill key={source} tone={SOURCE_TONE[source]} size="xs">
                  {SOURCE_LABEL[source]}
                </GlassPill>
              ))}
            </div>
            <Divider className="my-3" />
            <Text role="caption" as="p" className="text-ink-dim text-pretty">
              Objectives are set against what your club can actually do right now. The board will
              not ask a struggling side for twelve wins in four matches.
            </Text>
          </GlassPanel>
          <GlassButton variant="secondary" block onClick={() => navigate(ROUTES.rewards)}>
            See what you have earned
          </GlassButton>
        </>
      }
    >
      <HeroSurface
        eyebrow="Objectives"
        title={
          claimable > 0
            ? `${claimable} reward${claimable === 1 ? '' : 's'} waiting to be claimed`
            : active.length > 0
              ? `${active.length} thing${active.length === 1 ? '' : 's'} the club wants from you`
              : 'Nobody is asking anything of you yet'
        }
        subtitle={
          claimable > 0
            ? 'Finished work that has not been paid out. Claiming posts the reward straight into your accounts.'
            : active.length > 0
              ? 'The board, the fans and your sponsors each want different things. Each one says plainly what it asks and what it pays.'
              : 'Objectives are set as the season moves and as your situation changes. Play a matchweek and the board will find something to ask of you.'
        }
        texture="stadium"
        padding="md"
        {...(claimable > 0 ? { trailing: <GlassPill tone="volt" size="sm" filled>Ready</GlassPill> } : {})}
      >
        <div className="grid grid-cols-3 gap-3">
          <StatBlock
            label="In progress"
            value={active.length}
            tone="neutral"
            caption="Being worked on"
          />
          <StatBlock
            label="Ready"
            value={claimable}
            tone={claimable > 0 ? 'volt' : 'neutral'}
            caption="Waiting on you"
          />
          <StatBlock
            label="Settled"
            value={state.objectives.completed.length}
            tone="neutral"
            caption="Done this career"
          />
        </div>
      </HeroSurface>

      {seasonTargets.length > 0 && (
        <>
          <SectionHeader
            title="Season targets"
            subtitle="What you are actually being judged on. Miss these and the board notices."
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

      <SectionHeader
        title="In progress"
        subtitle="Anything finished and unpaid is at the top"
      />
      {active.length === 0 ? (
        <GlassPanel padding="md">
          <EmptyState
            size="sm"
            icon={<IconTrophy />}
            title="Nothing on the board"
            description="Objectives arrive from the board, your sponsors and the supporters as the season moves. Play a matchweek and something will be asked of you."
            action={
              <GlassButton variant="secondary" size="sm" onClick={() => navigate(ROUTES.matchday)}>
                Go to matchday
              </GlassButton>
            }
          />
        </GlassPanel>
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
          <div className="flex flex-col">
            {completed.map((objective, index) => (
              <ListRow
                key={objective.id}
                density="compact"
                divided={index < completed.length - 1}
                title={objective.title}
                subtitle={rewardSummary(objective) || 'No material reward'}
                trailing={
                  <GlassPill
                    tone={objective.status === 'CLAIMED' ? 'positive' : objective.status === 'FAILED' ? 'danger' : 'neutral'}
                    size="xs"
                  >
                    {objective.status === 'CLAIMED' ? 'Claimed' : objective.status === 'FAILED' ? 'Failed' : 'Complete'}
                  </GlassPill>
                }
              />
            ))}
          </div>
        </GlassPanel>
      )}

      <GlassPanel padding="md">
        <Text role="section" as="p">Why you cannot be paid twice</Text>
        <Text role="caption" as="p" className="mt-1 text-ink-dim text-pretty">
          Rewards move through the same ledger as everything else in your club, with a single-use
          key per reward. Double-claiming is impossible rather than merely discouraged — if a claim
          is refused, this screen tells you exactly why.
        </Text>
        <GlassButton
          className="mt-3"
          variant="secondary"
          size="sm"
          block
          onClick={() => navigate(ROUTES.rewards)}
        >
          See everything you have earned
        </GlassButton>
      </GlassPanel>
    </Screen>
  );
}

export function ObjectivesScreen(): ReactNode {
  const gate = useGameStatus();
  if (gate.status !== 'ready') return <GateScreen gate={gate} title="Objectives" />;
  return <ObjectivesView state={gate.state} />;
}
