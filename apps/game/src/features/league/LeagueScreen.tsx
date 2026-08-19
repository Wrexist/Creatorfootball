import { useMemo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PHASE_LABELS, nextFixture, rivalriesOf, rivalOpponent, type GameState,
} from '@cf/engine';
import {
  Divider, EmptyState, GlassButton, GlassPanel, GlassPill, IconCalendar, IconFlame, IconTrophy,
  KeyValueRow, MatchCard, ProgressBar, Screen, SectionHeader, StatCard, StatGrid,
} from '@/design';
import { ROUTES } from '@/app/routes';
import { GateScreen, useGameStatus } from './gate';
import { useClubLookup } from './clubs';
import { ZONE_LABEL, ZONE_TONE, positionAsk, useSeasonShape } from './data';
import { StandingsTable } from './components/StandingsTable';

/**
 * The league hub.
 *
 * It leads with the answer to the only question a manager actually has in the
 * middle of a season — where am I, and what do I need — and then hands off to
 * the table, the calendar, the rivalries and the season picture.
 */

function LeagueView({ state }: { state: GameState }): ReactNode {
  const navigate = useNavigate();
  const clubs = useClubLookup(state);
  const shape = useSeasonShape(state);

  const upcoming = useMemo(() => nextFixture(state), [state]);
  const rivalries = useMemo(() => rivalriesOf(state, state.playerClubId), [state]);
  const topRivalry = rivalries[0];

  const miniTable = useMemo(() => {
    const top = shape.table.slice(0, 4);
    const ourIndex = shape.table.findIndex((row) => row.clubId === state.playerClubId);
    if (ourIndex < 0 || ourIndex < 4) return top;
    const around = shape.table.slice(Math.max(0, ourIndex - 1), ourIndex + 2);
    return [...top, ...around];
  }, [shape.table, state.playerClubId]);

  const context = shape.context;

  return (
    <Screen
      title="League"
      subtitle={`${PHASE_LABELS[state.clock.phase]} · matchweek ${state.clock.week} of ${shape.totalWeeks}`}
      aside={
        <>
          <GlassPanel title="Season progress" padding="md">
            <ProgressBar
              value={shape.totalWeeks > 0 ? Math.round((state.clock.week / shape.totalWeeks) * 100) : 0}
              tone="volt"
              label={`Matchweek ${state.clock.week}`}
              valueLabel={`${shape.weeksLeft} left`}
            />
            <Divider className="my-3" />
            <KeyValueRow label="Played" value={`${shape.played} of ${shape.totalMatches}`} />
            <KeyValueRow label="Still to play for" value={`${shape.pointsAvailable} pts`} />
            <KeyValueRow label="Your ceiling" value={`${shape.ceiling} pts`} divided={false} hint="If you won every remaining match" />
          </GlassPanel>

          {topRivalry && (
            <GlassPanel title="Your biggest rivalry" padding="md" accent="danger">
              <p className="font-display text-[18px] font-bold text-ink">
                {clubs.name(rivalOpponent(topRivalry, state.playerClubId))}
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-muted text-pretty">
                {topRivalry.origin}
              </p>
              <ProgressBar
                className="mt-3"
                value={topRivalry.intensity}
                tone="danger"
                label="Intensity"
                valueLabel={`${Math.round(topRivalry.intensity)}`}
              />
              <GlassButton
                className="mt-3"
                variant="secondary"
                size="sm"
                block
                onClick={() => navigate(ROUTES.rivalries)}
              >
                All rivalries
              </GlassButton>
            </GlassPanel>
          )}
        </>
      }
    >
      <GlassPanel accent={context ? (context.zone === 'RELEGATION' ? 'danger' : 'volt') : 'none'} padding="md">
        <div className="flex items-baseline gap-3">
          <span className="tnum font-display text-[46px] font-bold leading-none tracking-[-0.04em] text-ink">
            {context?.position ?? '—'}
          </span>
          <div className="min-w-0 flex-1">
            {context && (
              <GlassPill tone={ZONE_TONE[context.zone]} size="xs" filled>
                {ZONE_LABEL[context.zone]}
              </GlassPill>
            )}
            <p className="mt-1.5 text-[14px] leading-relaxed text-ink-muted text-pretty">
              {positionAsk(shape)}
            </p>
          </div>
        </div>
      </GlassPanel>

      {upcoming ? (
        <div>
          <SectionHeader title="Next up" subtitle={PHASE_LABELS[upcoming.phase]} className="mb-2" />
          <MatchCard
            home={clubs.side(upcoming.homeClubId)}
            away={clubs.side(upcoming.awayClubId)}
            variant="upcoming"
            status={`Matchweek ${upcoming.week}`}
            importance={upcoming.importance}
            isDerby={upcoming.isDerby}
            competitionLabel={state.competitions[upcoming.competitionId]?.shortName}
            onPress={() => navigate(ROUTES.fixtures)}
          />
        </div>
      ) : (
        <EmptyState
          size="sm"
          icon={<IconCalendar />}
          title="No fixture scheduled"
          description="Either the season has finished or the calendar has not been drawn yet."
        />
      )}

      <GlassPanel padding="md">
        <SectionHeader
          title="Table"
          action="Full table"
          onPress={() => navigate(ROUTES.standings)}
          className="mb-2"
        />
        {shape.table.length === 0 ? (
          <EmptyState size="sm" title="No table yet" description="It appears once the competition is set up." />
        ) : (
          <StandingsTable
            rows={miniTable}
            side={clubs.side}
            ourClubId={state.playerClubId}
            compact
          />
        )}
      </GlassPanel>

      <StatGrid columns={3}>
        <StatCard
          label="Points"
          value={shape.ourRow?.points ?? 0}
          icon={<IconTrophy />}
          size="sm"
        />
        <StatCard
          label="Goal difference"
          value={shape.ourRow?.goalDifference ?? 0}
          size="sm"
        />
        <StatCard
          label="Rivalries"
          value={rivalries.length}
          icon={<IconFlame />}
          size="sm"
        />
      </StatGrid>

      <div className="grid grid-cols-2 gap-3">
        <GlassButton variant="secondary" block onClick={() => navigate(ROUTES.fixtures)}>
          Fixtures
        </GlassButton>
        <GlassButton variant="secondary" block onClick={() => navigate(ROUTES.rivalries)}>
          Rivalries
        </GlassButton>
        <GlassButton variant="secondary" block onClick={() => navigate(ROUTES.standings)}>
          Standings
        </GlassButton>
        <GlassButton variant="secondary" block onClick={() => navigate(ROUTES.seasonOverview)}>
          Season
        </GlassButton>
      </div>
    </Screen>
  );
}

export function LeagueScreen(): ReactNode {
  const gate = useGameStatus();
  if (gate.status !== 'ready') return <GateScreen gate={gate} title="League" />;
  return <LeagueView state={gate.state} />;
}
