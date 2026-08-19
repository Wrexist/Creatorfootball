import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { currentCompetition, type ClubId, type GameState } from '@cf/engine';
import {
  Divider, EmptyState, GlassPanel, GlassPill, GlassSegmented, GlassSheet, IconTrophy,
  KeyValueRow, ProgressBar, Screen, SectionHeader, cn,
} from '@/design';
import { ROUTES } from '@/app/routes';
import { GateScreen, useGameStatus } from './gate';
import { useClubLookup } from './clubs';
import { ZONE_LABEL, ZONE_TONE, positionAsk, useSeasonShape } from './data';
import { StandingsTable } from './components/StandingsTable';

/**
 * The table.
 *
 * The header answers "what do I need?" before the player has to work it out
 * from twelve rows of numbers — `positionContext` exists precisely so that
 * question has one authoritative answer rather than one per screen.
 */

type Mode = 'TABLE' | 'FORM' | 'HOME_AWAY';

const MODES = [
  { value: 'TABLE' as const, label: 'Table' },
  { value: 'FORM' as const, label: 'Form' },
];

function StandingsView({ state }: { state: GameState }): ReactNode {
  const navigate = useNavigate();
  const clubs = useClubLookup(state);
  const shape = useSeasonShape(state);
  const [mode, setMode] = useState<Mode>('TABLE');
  const [detail, setDetail] = useState<ClubId | null>(null);

  const competition = currentCompetition(state);
  const context = shape.context;

  const rows = useMemo(() => {
    if (mode !== 'FORM') return shape.table;
    // Same rows, ordered by what has happened lately rather than all season.
    const points = (form: readonly ('W' | 'D' | 'L')[]): number =>
      form.reduce((total, result) => total + (result === 'W' ? 3 : result === 'D' ? 1 : 0), 0);
    return shape.table.slice().sort((a, b) => points(b.form) - points(a.form) || b.points - a.points);
  }, [shape.table, mode]);

  const detailRow = detail ? shape.table.find((row) => row.clubId === detail) : undefined;
  const detailClub = detail ? clubs.club(detail) : undefined;

  return (
    <Screen
      title="Standings"
      subtitle={competition?.name ?? 'League table'}
      onBack={() => navigate(ROUTES.league)}
      headerAccessory={
        <GlassSegmented
          options={MODES}
          value={mode}
          onChange={setMode}
          aria-label="Table ordering"
          size="sm"
          block
        />
      }
      aside={
        <GlassPanel title="The zones" padding="md">
          <div className="flex flex-col gap-2">
            <ZoneLegend tone="volt" label="Champion" detail="First place takes the title." />
            <ZoneLegend
              tone="info"
              label="Playoff"
              detail={`Top ${shape.playoffSpots} go into the playoffs.`}
            />
            <ZoneLegend tone="neutral" label="Mid-table" detail="Safe, and playing for pride." />
            <ZoneLegend
              tone="danger"
              label="Relegation"
              detail={`Bottom ${shape.relegationSpots} go down.`}
            />
          </div>
          <Divider className="my-3" />
          <p className="text-[12px] leading-relaxed text-ink-dim text-pretty">
            The table is derived from results every time it is drawn, so it can never disagree with
            the fixture list.
          </p>
        </GlassPanel>
      }
    >
      <GlassPanel accent={context?.zone === 'RELEGATION' ? 'danger' : 'volt'} padding="md">
        <div className="flex items-center gap-3">
          {context && (
            <GlassPill tone={ZONE_TONE[context.zone]} size="sm" filled>
              {ZONE_LABEL[context.zone]}
            </GlassPill>
          )}
          <span className="text-[12px] uppercase tracking-[0.14em] text-ink-dim">
            {shape.played} played · {shape.remaining} to go
          </span>
        </div>
        <p className="mt-2 text-[15px] leading-relaxed text-ink text-pretty">{positionAsk(shape)}</p>
        {context && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <KeyValueRow
              label="To the place above"
              value={context.pointsToAbove === null ? '—' : `${context.pointsToAbove} pts`}
              divided={false}
            />
            <KeyValueRow
              label="From the place below"
              value={context.pointsFromBelow === null ? '—' : `${context.pointsFromBelow} pts`}
              divided={false}
            />
          </div>
        )}
      </GlassPanel>

      <GlassPanel padding="md">
        {shape.table.length === 0 ? (
          <EmptyState
            icon={<IconTrophy />}
            title="No table yet"
            description="Nothing has been played. The table fills in from the first result onwards."
          />
        ) : (
          <StandingsTable
            rows={rows}
            side={clubs.side}
            ourClubId={state.playerClubId}
            onPress={setDetail}
          />
        )}
      </GlassPanel>

      <GlassSheet
        open={detail !== null}
        onClose={() => setDetail(null)}
        title={detailClub?.name ?? 'Club'}
        subtitle={detailRow ? `${ZONE_LABEL[detailRow.zone]} · ${detailRow.points} points` : undefined}
        size="auto"
      >
        {detailRow && detailClub ? (
          <div className="flex flex-col gap-3">
            <ProgressBar
              value={shape.leaderPoints > 0 ? Math.round((detailRow.points / shape.leaderPoints) * 100) : 0}
              tone={ZONE_TONE[detailRow.zone] === 'neutral' ? 'neutral' : ZONE_TONE[detailRow.zone]}
              label="Points against the leader"
              valueLabel={`${detailRow.points} / ${shape.leaderPoints}`}
            />
            <div>
              <KeyValueRow label="Played" value={detailRow.played} />
              <KeyValueRow label="Won / drawn / lost" value={`${detailRow.won} / ${detailRow.drawn} / ${detailRow.lost}`} />
              <KeyValueRow label="Goals" value={`${detailRow.goalsFor} : ${detailRow.goalsAgainst}`} />
              <KeyValueRow
                label="Goal difference"
                value={detailRow.goalDifference > 0 ? `+${detailRow.goalDifference}` : detailRow.goalDifference}
              />
              <KeyValueRow label="Philosophy" value={detailClub.philosophy.replace(/_/g, ' ').toLowerCase()} />
              <KeyValueRow label="Home" value={detailClub.stadium.name} divided={false} />
            </div>
            <p className="text-[13px] leading-relaxed text-ink-muted text-pretty">
              {detailClub.motto}
            </p>
          </div>
        ) : null}
      </GlassSheet>
    </Screen>
  );
}

function ZoneLegend({
  tone, label, detail,
}: { tone: 'volt' | 'info' | 'neutral' | 'danger'; label: string; detail: string }): ReactNode {
  const bar = tone === 'volt' ? 'bg-volt' : tone === 'info' ? 'bg-info' : tone === 'danger' ? 'bg-danger' : 'bg-white/20';
  return (
    <div className="flex items-start gap-2.5">
      <span aria-hidden="true" className={cn('mt-1 h-4 w-0.5 shrink-0 rounded-pill', bar)} />
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-ink">{label}</p>
        <p className="text-[12px] text-ink-muted text-pretty">{detail}</p>
      </div>
    </div>
  );
}

export function StandingsScreen(): ReactNode {
  const gate = useGameStatus();
  if (gate.status !== 'ready') return <GateScreen gate={gate} title="Standings" />;
  return <StandingsView state={gate.state} />;
}
