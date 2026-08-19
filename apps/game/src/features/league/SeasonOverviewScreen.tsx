import { memo, useMemo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PHASE_LABELS, currentCompetition, fixturesFor, summariseSeason,
  type GameState, type Player,
} from '@cf/engine';
import {
  ClubBadge, EmptyState, GlassPanel, GlassPill, IconBall, IconTrophy, KeyValueRow,
  MatchCard, PlayerPortrait, ProgressBar, Screen, SectionHeader, StatCard, StatGrid,
  cn, type MatchCardSide,
} from '@/design';
import { ROUTES, buildPath } from '@/app/routes';
import { GateScreen, useGameStatus } from './gate';
import { useClubLookup } from './clubs';
import { ZONE_LABEL, ZONE_TONE, positionAsk, useSeasonShape, useTopScorers } from './data';

/**
 * The season, seen whole.
 *
 * Where it stands, what is still reachable, what the run-in looks like and who
 * is scoring. "Still reachable" is arithmetic and is labelled as arithmetic —
 * the maximum points a club can still reach is a fact, and this screen is
 * careful never to dress a fact up as a prediction.
 */

const ScorerRow = memo(function ScorerRow({
  player, goals, assists, side, rank,
}: {
  player: Player;
  goals: number;
  assists: number;
  side: MatchCardSide | undefined;
  rank: number;
}): ReactNode {
  return (
    <li className="flex items-center gap-3 border-b border-white/[0.06] py-2 last:border-b-0">
      <span className="tnum w-5 shrink-0 text-center text-[13px] font-semibold text-ink-dim">
        {rank}
      </span>
      <PlayerPortrait seed={player.portraitSeed} size={32} shape="circle" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-semibold text-ink">{player.displayName}</span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-ink-dim">
          {side && <ClubBadge visual={side.visual} size={13} flat />}
          {side?.shortName ?? 'Free agent'}
        </span>
      </span>
      <span className="text-right">
        <span className="tnum block text-[16px] font-bold text-ink">{goals}</span>
        <span className="block text-[10px] uppercase tracking-[0.12em] text-ink-dim">
          {assists} ast
        </span>
      </span>
    </li>
  );
});

function SeasonView({ state }: { state: GameState }): ReactNode {
  const navigate = useNavigate();
  const clubs = useClubLookup(state);
  const shape = useSeasonShape(state);
  const scorers = useTopScorers(state, 8);
  const competition = currentCompetition(state);

  const summary = useMemo(() => summariseSeason(state), [state]);

  const runIn = useMemo(
    () => fixturesFor(state, state.playerClubId).filter((f) => f.status === 'SCHEDULED').slice(0, 5),
    [state],
  );

  const picture = useMemo(() => {
    const leader = shape.table[0];
    const playoffLine = shape.table[Math.min(shape.table.length - 1, shape.playoffSpots - 1)];
    const dropLine = shape.table[Math.max(0, shape.table.length - shape.relegationSpots)];
    return { leader, playoffLine, dropLine };
  }, [shape]);

  const context = shape.context;
  const canStillTop = shape.ceiling >= shape.leaderPoints;

  return (
    <Screen
      title="Season"
      subtitle={`Season ${state.clock.season} · ${PHASE_LABELS[state.clock.phase]}`}
      onBack={() => navigate(ROUTES.league)}
      aside={
        <>
          <GlassPanel title="Season so far" padding="md">
            <KeyValueRow label="Played" value={`${summary.played}`} />
            <KeyValueRow label="Won / drawn / lost" value={`${summary.won} / ${summary.drawn} / ${summary.lost}`} />
            <KeyValueRow label="Goals" value={`${summary.goalsFor} : ${summary.goalsAgainst}`} />
            <KeyValueRow label="Fan sentiment" value={`${Math.round(summary.endFanSentiment)}`} />
            <KeyValueRow label="Reputation" value={`${Math.round(summary.endReputation)}`} divided={false} />
          </GlassPanel>

          <GlassPanel title="The picture" padding="md">
            <PictureRow
              label="Title"
              clubName={picture.leader ? clubs.name(picture.leader.clubId) : '—'}
              value={picture.leader ? `${picture.leader.points} pts` : '—'}
              tone="volt"
            />
            <PictureRow
              label={`Playoff line (${shape.playoffSpots}th)`}
              clubName={picture.playoffLine ? clubs.name(picture.playoffLine.clubId) : '—'}
              value={picture.playoffLine ? `${picture.playoffLine.points} pts` : '—'}
              tone="info"
            />
            <PictureRow
              label="Relegation line"
              clubName={picture.dropLine ? clubs.name(picture.dropLine.clubId) : '—'}
              value={picture.dropLine ? `${picture.dropLine.points} pts` : '—'}
              tone="danger"
            />
          </GlassPanel>
        </>
      }
    >
      <GlassPanel accent={context?.zone === 'RELEGATION' ? 'danger' : 'volt'} padding="md">
        <div className="flex items-center gap-2">
          {context && (
            <GlassPill tone={ZONE_TONE[context.zone]} size="xs" filled>
              {ZONE_LABEL[context.zone]}
            </GlassPill>
          )}
          <span className="text-[11px] uppercase tracking-[0.14em] text-ink-dim">
            {competition?.name ?? 'League'}
          </span>
        </div>
        <p className="mt-2 text-[15px] leading-relaxed text-ink text-pretty">{positionAsk(shape)}</p>
        <ProgressBar
          className="mt-3"
          value={shape.totalMatches > 0 ? Math.round((shape.played / shape.totalMatches) * 100) : 0}
          tone="volt"
          label="Season played"
          valueLabel={`${shape.played} / ${shape.totalMatches}`}
        />
      </GlassPanel>

      <StatGrid columns={3}>
        <StatCard label="Points" value={shape.ourRow?.points ?? 0} size="sm" icon={<IconTrophy />} />
        <StatCard label="Still available" value={shape.pointsAvailable} size="sm" />
        <StatCard
          label="Your ceiling"
          value={shape.ceiling}
          size="sm"
          footnote={canStillTop ? 'Top is still reachable' : 'Out of reach of the leaders'}
          tone={canStillTop ? 'volt' : 'warning'}
        />
      </StatGrid>

      <GlassPanel padding="md">
        <SectionHeader
          title="What is still achievable"
          subtitle="Arithmetic, not a forecast"
          className="mb-2"
        />
        <div>
          <KeyValueRow
            label="Win every remaining match"
            value={`${shape.ceiling} pts`}
            hint={`${shape.remaining} matches left, ${shape.pointsAvailable} points on the table`}
          />
          <KeyValueRow
            label="Gap to the leaders"
            value={`${Math.max(0, shape.leaderPoints - (shape.ourRow?.points ?? 0))} pts`}
            hint={canStillTop ? 'Reachable on points alone' : 'Beyond what is left to play for'}
          />
          <KeyValueRow
            label="Gap to the playoff line"
            value={`${Math.max(0, shape.playoffLinePoints - (shape.ourRow?.points ?? 0))} pts`}
          />
          <KeyValueRow
            label="Cushion above the drop"
            value={`${Math.max(0, (shape.ourRow?.points ?? 0) - shape.relegationLinePoints)} pts`}
            divided={false}
          />
        </div>
      </GlassPanel>

      <div>
        <SectionHeader title="The run-in" subtitle="Your next five" className="mb-2" />
        {runIn.length === 0 ? (
          <EmptyState
            size="sm"
            icon={<IconBall />}
            title="Nothing left to play"
            description="The season is done. What happens next is written in the history."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {runIn.map((fixture) => (
              <MatchCard
                key={fixture.id}
                home={clubs.side(fixture.homeClubId)}
                away={clubs.side(fixture.awayClubId)}
                variant="upcoming"
                status={`MW ${fixture.week}`}
                importance={fixture.importance}
                isDerby={fixture.isDerby}
                competitionLabel={PHASE_LABELS[fixture.phase]}
                onPress={() => navigate(buildPath(ROUTES.matchPreview, { fixtureId: fixture.id }))}
              />
            ))}
          </div>
        )}
      </div>

      <GlassPanel title="Top scorers" padding="md">
        {scorers.length === 0 ? (
          <EmptyState
            size="sm"
            icon={<IconBall />}
            title="Nobody has scored yet"
            description="The golden boot race starts with the first goal of the season."
          />
        ) : (
          <ul>
            {scorers.map((row, index) => (
              <ScorerRow
                key={row.player.id}
                player={row.player}
                goals={row.goals}
                assists={row.assists}
                side={row.clubId ? clubs.side(row.clubId) : undefined}
                rank={index + 1}
              />
            ))}
          </ul>
        )}
      </GlassPanel>
    </Screen>
  );
}

function PictureRow({
  label, clubName, value, tone,
}: {
  label: string;
  clubName: string;
  value: string;
  tone: 'volt' | 'info' | 'danger';
}): ReactNode {
  const bar = tone === 'volt' ? 'bg-volt' : tone === 'info' ? 'bg-info' : 'bg-danger';
  return (
    <div className="flex items-center gap-2.5 border-b border-white/[0.06] py-2.5 last:border-b-0">
      <span aria-hidden="true" className={cn('h-6 w-0.5 shrink-0 rounded-pill', bar)} />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-[0.14em] text-ink-dim">{label}</p>
        <p className="truncate text-[14px] font-semibold text-ink">{clubName}</p>
      </div>
      <span className="tnum text-[14px] font-bold text-ink">{value}</span>
    </div>
  );
}

export function SeasonOverviewScreen(): ReactNode {
  const gate = useGameStatus();
  if (gate.status !== 'ready') return <GateScreen gate={gate} title="Season" />;
  return <SeasonView state={gate.state} />;
}
