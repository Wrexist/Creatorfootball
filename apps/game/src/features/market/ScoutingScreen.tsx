import { memo, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  knowledgeConfidence,
  type GameState,
  type Player,
  type PlayerId,
  type ScoutAssignment,
  type ScoutDepth,
} from '@cf/engine';
import {
  Accordion, Divider, EmptyState, GlassButton, GlassPanel, GlassPill, GlassSheet, IconScout,
  IconSearch, IconStar, KeyValueRow, MoneyLabel, ProgressBar, Screen, SectionHeader, StatCard,
  StatGrid, cn, useToast,
} from '@/design';
import { ROUTES } from '@/app/routes';
import { GateScreen, useGameStatus } from './gate';
import { useClubLookup } from './clubs';
import { orderScoutReport, scoutingCapacity } from './engine';
import { PlayerRow } from './components/PlayerRow';
import { AttributeDossier, ConfidenceMeter, PotentialPill, useKnowledge } from './components/scouting';

/**
 * Scouting.
 *
 * Two managers looking at the same transfer list are not seeing the same
 * information, and this is the screen where that becomes obvious. The payoff
 * section is deliberately the largest thing here: watching a band narrow from
 * "somewhere between 61 and 84" to "74" is the product of the money and the
 * weeks you spent, and it should feel like it.
 */

const DEPTHS: readonly { id: ScoutDepth; title: string; blurb: string }[] = [
  { id: 'BASIC', title: 'A quick look', blurb: 'One scout, one match. Enough to stop you signing a disaster.' },
  { id: 'DETAILED', title: 'A proper report', blurb: 'Several viewings. The bands close up meaningfully.' },
  { id: 'DEEP', title: 'Live with him', blurb: 'Weeks of work. As close to certainty as this game allows.' },
];

const DEPTH_LABEL: Record<ScoutDepth, string> = {
  BASIC: 'Quick look',
  DETAILED: 'Detailed',
  DEEP: 'Deep',
};

/* --- assignments -------------------------------------------------------- */

const AssignmentRow = memo(function AssignmentRow({
  assignment, player, totalCycles,
}: {
  assignment: ScoutAssignment;
  player: Player;
  totalCycles: number;
}): ReactNode {
  const done = Math.max(0, totalCycles - assignment.cyclesRemaining);
  return (
    <div className="border-b border-white/[0.06] py-2 last:border-b-0">
      <PlayerRow
        player={player}
        detail={
          <span className="text-[12px] text-ink-muted">
            {DEPTH_LABEL[assignment.depth]} report
          </span>
        }
        trailing={
          <GlassPill tone={assignment.cyclesRemaining <= 1 ? 'volt' : 'neutral'} size="xs">
            {assignment.cyclesRemaining === 1 ? 'next week' : `${assignment.cyclesRemaining} weeks`}
          </GlassPill>
        }
      />
      <ProgressBar
        className="mx-2 mt-1"
        value={totalCycles > 0 ? Math.round((done / totalCycles) * 100) : 0}
        tone="volt"
        size="xs"
      />
    </div>
  );
});

/* --- the payoff --------------------------------------------------------- */

const ReportCard = memo(function ReportCard({ player }: { player: Player }): ReactNode {
  const knowledge = useKnowledge(player);
  return (
    <Accordion
      title={player.displayName}
      subtitle={`${knowledge.label} · ${knowledge.exact ? `ability ${knowledge.estimate}` : `ability ${knowledge.band[0]}–${knowledge.band[1]}`}`}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <ConfidenceMeter knowledge={knowledge} className="min-w-0 flex-1" />
          <PotentialPill knowledge={knowledge} />
        </div>
        <AttributeDossier player={player} knowledge={knowledge} full />
        {!knowledge.exact && (
          <p className="text-[12px] leading-relaxed text-ink-dim text-pretty">
            Every band above is what your scouts will commit to. Send someone back and they close
            further — that narrowing is the entire edge you are buying.
          </p>
        )}
      </div>
    </Accordion>
  );
});

/* --- depth picker ------------------------------------------------------- */

interface DepthSheetProps {
  open: boolean;
  player: Player | null;
  lastCosts: Partial<Record<ScoutDepth, number>>;
  onClose: () => void;
  onPick: (depth: ScoutDepth) => void;
}

function DepthSheet({ open, player, lastCosts, onClose, onPick }: DepthSheetProps): ReactNode {
  return (
    <GlassSheet
      open={open && player !== null}
      onClose={onClose}
      title={player ? `Scout ${player.displayName}` : 'Send a scout'}
      subtitle="Deeper reports cost more and take longer"
      size="auto"
    >
      <div className="flex flex-col gap-2">
        {DEPTHS.map((depth) => (
          <button
            key={depth.id}
            type="button"
            onClick={() => onPick(depth.id)}
            className={cn(
              'flex min-h-11 w-full flex-col gap-1 rounded-lg border border-white/[0.08] bg-white/[0.03] p-3 text-left',
              'hover:bg-white/[0.06] outline-none focus-visible:ring-2 focus-visible:ring-volt focus-visible:ring-offset-2 focus-visible:ring-offset-base',
            )}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="text-[15px] font-semibold text-ink">{depth.title}</span>
              {lastCosts[depth.id] !== undefined && (
                <span className="text-[12px] text-ink-dim">
                  last cost <MoneyLabel amount={lastCosts[depth.id] ?? 0} size="sm" />
                </span>
              )}
            </span>
            <span className="text-[13px] leading-relaxed text-ink-muted text-pretty">
              {depth.blurb}
            </span>
          </button>
        ))}
        <p className="mt-1 text-[12px] leading-relaxed text-ink-dim text-pretty">
          The exact fee is set by your scouting network and comes straight out of the club account —
          you will see it posted in your finances the moment the scout goes out.
        </p>
      </div>
    </GlassSheet>
  );
}

/* --- screen ------------------------------------------------------------- */

function ScoutingView({ state }: { state: GameState }): ReactNode {
  const navigate = useNavigate();
  const toast = useToast();

  const clubs = useClubLookup(state);
  const [picking, setPicking] = useState<PlayerId | null>(null);

  const capacity = useMemo(() => scoutingCapacity(state), [state]);
  const assignments = state.scouting.assignments;

  const shortlisted = useMemo(
    () =>
      state.scouting.shortlist
        .map((id) => state.players[id])
        .filter((p): p is Player => Boolean(p))
        .filter((p) => !assignments.some((a) => a.playerId === p.id)),
    [state.scouting.shortlist, state.players, assignments],
  );

  /** Reports we hold, best-known first. This is what the money bought. */
  const reports = useMemo(
    () =>
      Object.values(state.players)
        .filter((p) => p.clubId !== state.playerClubId && knowledgeConfidence(p) > 0)
        .sort((a, b) => knowledgeConfidence(b) - knowledgeConfidence(a))
        .slice(0, 20),
    [state.players, state.playerClubId],
  );

  /**
   * Prices come from the ledger rather than from a number typed into this
   * screen: what a report cost last time is a fact, what it "should" cost is a
   * guess this layer has no business making.
   */
  const lastCosts = useMemo(() => {
    const out: Partial<Record<ScoutDepth, number>> = {};
    for (const tx of state.ledger.transactions) {
      if (tx.kind !== 'SCOUTING') continue;
      const depth = tx.metadata?.depth;
      if (typeof depth === 'string' && (depth === 'BASIC' || depth === 'DETAILED' || depth === 'DEEP')) {
        out[depth] = tx.amount;
      }
    }
    return out;
  }, [state.ledger.transactions]);

  const longestAssignment = Math.max(1, ...assignments.map((a) => a.cyclesRemaining));
  const pickingPlayer = picking ? state.players[picking] ?? null : null;

  const send = (depth: ScoutDepth): void => {
    if (!picking) return;
    const result = orderScoutReport(picking, depth);
    setPicking(null);
    if (result.ok) toast.success('Scout on his way', result.reason);
    else toast.error('Could not send a scout', result.reason);
  };

  const network = (
    <GlassPanel title="Your network" padding="md">
      <StatGrid columns={2}>
        <StatCard
          label="Scouts out"
          value={`${assignments.length} / ${capacity}`}
          nested
          level={1}
          size="sm"
          footnote={assignments.length >= capacity ? 'At capacity' : 'Room for more'}
        />
        <StatCard
          label="Scouting credits"
          value={state.inventory.scoutCredits}
          nested
          level={1}
          size="sm"
        />
      </StatGrid>
      <ProgressBar
        className="mt-3"
        value={Math.round(state.scouting.network)}
        tone={state.scouting.network >= 60 ? 'positive' : state.scouting.network >= 30 ? 'volt' : 'warning'}
        label="Network quality"
        valueLabel={`${Math.round(state.scouting.network)}`}
      />
      <p className="mt-2 text-[12px] leading-relaxed text-ink-dim text-pretty">
        A better scouting facility sends more scouts, sends them faster, and comes back with
        narrower bands. It is the cheapest competitive advantage in the game.
      </p>
    </GlassPanel>
  );

  return (
    <Screen
      title="Scouting"
      subtitle={`${assignments.length} of ${capacity} scouts out`}
      onBack={() => navigate(ROUTES.market)}
      aside={network}
    >
      <div className="md:hidden">{network}</div>

      <GlassPanel title="Out watching" padding="md">
        {assignments.length === 0 ? (
          <EmptyState
            size="sm"
            icon={<IconScout />}
            title="No scouts out"
            description="Every player you have not watched shows as a range. Send someone and the range becomes a number."
            action={
              <GlassButton variant="secondary" size="sm" icon={<IconSearch />} onClick={() => navigate(ROUTES.playerSearch)}>
                Find someone to watch
              </GlassButton>
            }
          />
        ) : (
          <div className="-mx-2">
            {assignments.map((assignment) => {
              const player = state.players[assignment.playerId];
              if (!player) return null;
              return (
                <AssignmentRow
                  key={assignment.playerId}
                  assignment={assignment}
                  player={player}
                  totalCycles={longestAssignment}
                />
              );
            })}
          </div>
        )}
      </GlassPanel>

      <GlassPanel padding="md">
        <SectionHeader
          title="Waiting on the shortlist"
          subtitle="Nobody is watching these players yet"
          className="mb-2"
        />
        {shortlisted.length === 0 ? (
          <EmptyState
            size="sm"
            icon={<IconStar />}
            title="Shortlist is clear"
            description="Everyone you are watching already has a scout on them."
          />
        ) : (
          <div className="-mx-2">
            {shortlisted.map((player) => (
              <PlayerRow
                key={player.id}
                player={player}
                {...(clubs(player.clubId) ? { club: clubs(player.clubId) } : {})}
                trailing={
                  <GlassButton
                    size="sm"
                    variant="secondary"
                    icon={<IconScout />}
                    disabled={assignments.length >= capacity}
                    onClick={() => setPicking(player.id)}
                  >
                    Scout
                  </GlassButton>
                }
              />
            ))}
          </div>
        )}
        {assignments.length >= capacity && (
          <p className="mt-2 text-[12px] text-warning">
            Your network is full. Wait for a report or upgrade the scouting facility.
          </p>
        )}
      </GlassPanel>

      <GlassPanel title="What you know" padding="md">
        {reports.length === 0 ? (
          <EmptyState
            size="sm"
            title="You know nothing about anyone"
            description="That is not a bug — it is the starting position. Every attribute on every player outside your squad is a range until somebody goes and looks."
          />
        ) : (
          <>
            <div>
              {reports.map((player) => (
                <ReportCard key={player.id} player={player} />
              ))}
            </div>
            <Divider className="my-3" />
            <KeyValueRow
              label="Reports held"
              value={String(reports.length)}
              hint="Confidence decays over time — a report from two seasons ago describes a player who no longer exists"
              divided={false}
            />
          </>
        )}
      </GlassPanel>

      <DepthSheet
        open={picking !== null}
        player={pickingPlayer}
        lastCosts={lastCosts}
        onClose={() => setPicking(null)}
        onPick={send}
      />
    </Screen>
  );
}

export function ScoutingScreen(): ReactNode {
  const gate = useGameStatus();
  if (gate.status !== 'ready') return <GateScreen gate={gate} title="Scouting" />;
  return <ScoutingView state={gate.state} />;
}
