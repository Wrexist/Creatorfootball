import { memo, useMemo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  playerById, playerClub,
  type GameState, type SeasonSummary,
} from '@cf/engine';
import {
  Divider, EmptyState, GlassButton, GlassPanel, GlassPill, KeyValueRow, Screen,
  SectionHeader, Silverware, Sparkline, StatCard, StatGrid, Timeline, cn, formatMoney,
  silverwareVariantFor, IconCalendar, IconStar, IconTrophy,
  type TimelineItem,
} from '@/design';
import { ROUTES } from '@/app/routes';
import { useGameStore } from '@/state/gameStore';
import { ScreenStatus } from './status';

/**
 * History.
 *
 * The long view. Twenty seasons in, this is the screen that makes a save feel
 * like a career rather than a session, so it is built around the record rather
 * than around the current week: every completed season as a row you can read
 * across, and every milestone in the order it happened.
 */

const SeasonRow = memo(function SeasonRow({
  summary, scorerName, best,
}: {
  summary: SeasonSummary;
  scorerName: string | null;
  best: boolean;
}): ReactNode {
  const points = summary.won * 3 + summary.drawn;
  const gd = summary.goalsFor - summary.goalsAgainst;
  return (
    <GlassPanel padding="md" accent={summary.trophies.length > 0 ? 'volt' : 'none'}>
      <div className="flex items-start gap-4">
        <div className="flex w-14 shrink-0 flex-col items-center">
          <span className="text-micro font-semibold uppercase tracking-[0.16em] text-ink-dim">Season</span>
          <span className="tnum font-display text-[28px] font-bold leading-none tracking-[-0.04em] text-ink">
            {summary.season}
          </span>
          {/* A won season is visibly a different row from a nearly-won one,
              before anyone reads a word of it. */}
          {summary.trophies.length > 0 && (
            <span className="mt-2 flex flex-wrap items-end justify-center gap-0.5" aria-hidden="true">
              {summary.trophies.slice(0, 3).map((trophy) => (
                <Silverware key={trophy} variant={silverwareVariantFor(trophy)} size={34} />
              ))}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <GlassPill tone={summary.position === 1 ? 'volt' : summary.position <= 3 ? 'positive' : 'neutral'} size="sm">
              {summary.position === 1 ? 'Champions' : `${summary.position}${suffix(summary.position)} place`}
            </GlassPill>
            {best && <GlassPill tone="special" size="xs" icon={<IconStar />}>Best finish</GlassPill>}
            {summary.trophies.map((trophy) => (
              <GlassPill key={trophy} tone="volt" size="xs" icon={<IconTrophy />}>{trophy}</GlassPill>
            ))}
          </div>
          <p className="tnum mt-2 text-[13px] text-ink-muted">
            {summary.played} played · {summary.won}W {summary.drawn}D {summary.lost}L · {points} pts ·{' '}
            {summary.goalsFor}–{summary.goalsAgainst} ({gd >= 0 ? '+' : ''}{gd})
          </p>
          {scorerName && (
            <p className="mt-1 text-[12px] text-ink-dim">
              Top scorer: {scorerName} with {summary.topScorerGoals}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <GlassPill size="xs">Rep {Math.round(summary.endReputation)}</GlassPill>
            <GlassPill size="xs">Mood {Math.round(summary.endFanSentiment)}</GlassPill>
            <GlassPill size="xs" tone={summary.netSpend > 0 ? 'warning' : 'positive'}>
              Net {formatMoney(summary.netSpend)}
            </GlassPill>
          </div>
        </div>
      </div>
    </GlassPanel>
  );
});

const suffix = (n: number): string => {
  const rest = n % 100;
  if (rest >= 11 && rest <= 13) return 'th';
  switch (n % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
};

export function HistoryScreen(): ReactNode {
  const phase = useGameStore((s) => s.phase);
  const error = useGameStore((s) => s.error);
  const state = useGameStore((s) => s.state);
  const navigate = useNavigate();

  if (!state) {
    return (
      <Screen title="History" onBack={() => navigate(ROUTES.club)}>
        <ScreenStatus phase={phase} error={error} onStart={() => navigate(ROUTES.onboarding)} />
      </Screen>
    );
  }
  return <HistoryBody state={state} />;
}

function HistoryBody({ state }: { state: GameState }): ReactNode {
  const navigate = useNavigate();

  const data = useMemo(() => {
    const club = playerClub(state);
    const summaries = [...state.legacy.seasonSummaries].sort((a, b) => b.season - a.season);
    const bestPosition = summaries.reduce((best, s) => Math.min(best, s.position), Infinity);
    const milestones: TimelineItem[] = [...state.legacy.milestones]
      .sort((a, b) => b.cycle - a.cycle)
      .slice(0, 40)
      .map((milestone, index) => ({
        id: `${milestone.cycle}-${index}`,
        title: milestone.text,
        time: `Cycle ${milestone.cycle}`,
        tone: milestone.importance >= 5 ? 'volt' : milestone.importance >= 4 ? 'positive' : 'neutral',
        icon: milestone.importance >= 5 ? <IconTrophy size={14} /> : <IconCalendar size={14} />,
      }));

    return {
      club,
      summaries,
      bestPosition,
      milestones,
      positions: [...summaries].reverse().map((s) => -s.position),
      allTime: club.allTimeRecord,
    };
  }, [state]);

  const { club } = data;
  const total = data.allTime.played;

  return (
    <Screen
      title="History"
      subtitle={`${club.name} · founded ${club.founded}`}
      onBack={() => navigate(ROUTES.club)}
      aside={
        <GlassPanel title="All time" padding="md">
          <KeyValueRow label="Played" value={data.allTime.played} />
          <KeyValueRow label="Won" value={data.allTime.won} />
          <KeyValueRow label="Drawn" value={data.allTime.drawn} />
          <KeyValueRow label="Lost" value={data.allTime.lost} />
          <KeyValueRow label="Goals for" value={data.allTime.goalsFor} />
          <KeyValueRow label="Goals against" value={data.allTime.goalsAgainst} divided={false} />
        </GlassPanel>
      }
    >
      <StatGrid columns={2}>
        <StatCard
          label="Seasons"
          value={state.legacy.seasonSummaries.length}
          icon={<IconCalendar size={13} />}
          footnote={`Currently in season ${state.clock.season}`}
        />
        <StatCard
          label="Win rate"
          value={total > 0 ? Math.round((data.allTime.won / total) * 100) : 0}
          suffix="%"
          tone="positive"
          footnote={`${data.allTime.won} wins from ${total}`}
        />
      </StatGrid>

      {data.summaries.length > 1 && (
        <GlassPanel title="Where you have finished" padding="md">
          <div className="flex items-center gap-3">
            <Sparkline values={data.positions} width={200} height={44} tone="volt" fill label="League position by season" />
            <p className="text-[12px] text-ink-muted text-pretty">
              Higher is better. Best finish: {data.bestPosition}{suffix(data.bestPosition)}.
            </p>
          </div>
        </GlassPanel>
      )}

      <SectionHeader title="Seasons" subtitle="Newest first" />
      {data.summaries.length === 0 ? (
        <EmptyState
          icon={<IconCalendar />}
          title="No completed seasons yet"
          description="Your first season is still running. When it ends it is written here permanently, with the table position, the record and what it cost."
          action={<GlassButton variant="secondary" onClick={() => navigate(ROUTES.seasonOverview)}>This season so far</GlassButton>}
        />
      ) : (
        data.summaries.map((summary) => (
          <SeasonRow
            key={summary.season}
            summary={summary}
            scorerName={summary.topScorerId ? playerById(state, summary.topScorerId)?.displayName ?? null : null}
            best={summary.position === data.bestPosition}
          />
        ))
      )}

      <Divider />

      <SectionHeader title="Milestones" subtitle="Everything the club will remember" />
      {data.milestones.length === 0 ? (
        <EmptyState
          size="sm"
          icon={<IconStar />}
          title="Nothing has happened yet"
          description="Trophies, records and breakthroughs land here as they happen."
        />
      ) : (
        <GlassPanel padding="md">
          <Timeline items={data.milestones} animate={data.milestones.length <= 12} />
        </GlassPanel>
      )}

      <div className={cn('flex flex-wrap gap-2 pb-2')}>
        <GlassButton variant="secondary" size="sm" icon={<IconTrophy size={16} />} onClick={() => navigate(ROUTES.trophyRoom)}>
          Trophy room
        </GlassButton>
        <GlassButton variant="ghost" size="sm" onClick={() => navigate(ROUTES.seasonOverview)}>
          Current season
        </GlassButton>
      </div>
    </Screen>
  );
}
