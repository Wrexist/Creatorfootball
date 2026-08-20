import { memo, useCallback, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  playerById, playerClub, programById, projectTraining, squadOf,
  ATTRIBUTE_LABELS, INTENSITY_LABELS, TRAINING_PROGRAMS,
  type AttributeKey, type GameState, type Player, type TrainingIntensity,
  type TrainingProgram,
} from '@cf/engine';
import {
  Divider, EmptyState, GlassButton, GlassPanel, GlassPill, GlassSegmented, GlassSheet, KeyValueRow,
  PlayerPortrait, PositionChip, ProgressBar, Screen, SectionHeader, StatCard, StatGrid, cn,
  IconCheck, IconInjury, IconStar, IconTraining, IconWarning,
} from '@/design';
import { ROUTES, buildPath } from '@/app/routes';
import { useGameStore } from '@/state/gameStore';
import { ScreenStatus } from './status';
import { facilityRegistry } from './bridge';

/**
 * Training.
 *
 * Seven programmes and three intensities — twenty-one combinations, every one
 * of which costs something. There are no sliders here on purpose: depth in a
 * management game comes from choices a player can hold in their head, and a
 * wall of percentage dials is homework, not depth.
 *
 * The projection under each choice is `projectTraining` — the engine's own
 * expected-value pass over the exact same growth curve the weekly cycle runs.
 * It is dice-free, so it never promises a number the simulation then refuses
 * to deliver; it reports what the squad should average, not what it will roll.
 */

const INTENSITY_TRADEOFFS: Record<TrainingIntensity, string> = {
  LIGHT: 'Slower growth, fresh legs, almost nobody gets hurt. The safe way to stand still.',
  NORMAL: 'The reference. Steady development at a manageable injury rate.',
  HARD: 'The fastest development available, bought with fatigue and a materially higher chance of losing someone for weeks.',
};

const weightList = (program: TrainingProgram, positive: boolean): string =>
  (Object.entries(program.weights) as [AttributeKey, number][])
    .filter(([, weight]) => (positive ? weight > 0 : weight < 0))
    .sort((a, b) => (positive ? b[1] - a[1] : a[1] - b[1]))
    .slice(0, 4)
    .map(([key]) => ATTRIBUTE_LABELS[key])
    .join(', ');

const ProgramCard = memo(function ProgramCard({
  program, active, onSelect,
}: {
  program: TrainingProgram;
  active: boolean;
  onSelect: (id: string) => void;
}): ReactNode {
  const grows = weightList(program, true);
  const erodes = weightList(program, false);
  return (
    <button
      type="button"
      onClick={() => onSelect(program.id)}
      aria-pressed={active}
      className={cn(
        'w-full rounded-lg px-4 py-3.5 text-left',
        'outline-none focus-visible:ring-2 focus-visible:ring-volt focus-visible:ring-offset-2 focus-visible:ring-offset-base',
        active ? 'bg-volt/12 ring-1 ring-volt/40' : 'bg-white/[0.03] hover:bg-white/[0.06]',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-ink">{program.name}</h3>
          <p className="mt-0.5 text-[12px] leading-relaxed text-ink-muted text-pretty">{program.blurb}</p>
        </div>
        {active
          ? <IconCheck size={18} className="shrink-0 text-volt" />
          : <span className="shrink-0" aria-hidden="true" />}
      </div>

      <p className="mt-2.5 text-[12px] leading-relaxed text-warning text-pretty">{program.tradeOff}</p>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {grows && <GlassPill size="xs" tone="positive">↑ {grows}</GlassPill>}
        {erodes && <GlassPill size="xs" tone="danger">↓ {erodes}</GlassPill>}
        {program.recovery && <GlassPill size="xs" tone="info">Restores fitness</GlassPill>}
        {program.youthBias > 0 && <GlassPill size="xs" tone="special">Academy first</GlassPill>}
        {program.cohesion > 0.5 && <GlassPill size="xs" tone="volt">Builds cohesion</GlassPill>}
        {program.injuryBias > 1.2 && <GlassPill size="xs" tone="danger">Injury risk</GlassPill>}
      </div>
    </button>
  );
});

export function TrainingScreen(): ReactNode {
  const phase = useGameStore((s) => s.phase);
  const error = useGameStore((s) => s.error);
  const state = useGameStore((s) => s.state);
  const navigate = useNavigate();

  if (!state) {
    return (
      <Screen title="Training" onBack={() => navigate(ROUTES.squad)}>
        <ScreenStatus phase={phase} error={error} onStart={() => navigate(ROUTES.onboarding)} />
      </Screen>
    );
  }
  return <TrainingBody state={state} />;
}

function TrainingBody({ state }: { state: GameState }): ReactNode {
  const navigate = useNavigate();
  const apply = useGameStore((s) => s.apply);
  const [focusFor, setFocusFor] = useState<Player | null>(null);
  const [picker, setPicker] = useState(false);

  const data = useMemo(() => {
    const club = playerClub(state);
    const program = programById(state.training.programId);
    const intensity = state.training.intensity;
    const manager = state.managers[state.playerManagerId];
    const squad = squadOf(state, club.id);

    const projection = projectTraining(state, {
      clubId: club.id,
      cycle: state.clock.cycle,
      season: state.clock.season,
      registry: facilityRegistry(),
      managerDevelopment: manager?.attributes.playerDevelopment ?? 50,
    });

    const byId = new Map(squad.map((p) => [p.id, p]));
    const ranked = [...projection]
      .sort((a, b) => b.expectedGain - a.expectedGain)
      .map((row) => ({ ...row, player: byId.get(row.playerId) }))
      .filter((row): row is typeof row & { player: Player } => Boolean(row.player));

    const meanGain = projection.length
      ? projection.reduce((sum, row) => sum + row.expectedGain, 0) / projection.length
      : 0;

    return {
      club,
      program,
      intensity,
      squad,
      ranked,
      meanGain,
      risk: projection[0]?.risk ?? 0,
      results: [...state.training.lastResults].sort((a, b) => b.cycle - a.cycle).slice(0, 12),
      focus: state.training.individualFocus,
    };
  }, [state]);

  const setProgram = useCallback((programId: string) => {
    apply((current) => ({ ...current, training: { ...current.training, programId } }));
  }, [apply]);

  const setIntensity = useCallback((intensity: TrainingIntensity) => {
    apply((current) => ({ ...current, training: { ...current.training, intensity } }));
  }, [apply]);

  const setFocus = useCallback((playerId: string, attribute: AttributeKey | null) => {
    apply((current) => {
      const next = { ...current.training.individualFocus };
      if (attribute) next[playerId] = attribute;
      else delete next[playerId];
      return { ...current, training: { ...current.training, individualFocus: next } };
    });
  }, [apply]);

  const focusCount = Object.keys(data.focus).length;

  return (
    <Screen
      title="Training"
      subtitle={`${data.program.name} · ${INTENSITY_LABELS[data.intensity].toLowerCase()} intensity`}
      onBack={() => navigate(ROUTES.squad)}
      aside={
        <>
          <GlassPanel title="This week" padding="md">
            <KeyValueRow label="Programme" value={data.program.name} />
            <KeyValueRow label="Intensity" value={INTENSITY_LABELS[data.intensity]} />
            <KeyValueRow label="Individual focus" value={focusCount} hint="Players with a personal target" />
            <KeyValueRow
              label="Academy included"
              value={data.program.youthBias > 0 ? 'Yes' : 'No'}
              divided={false}
            />
          </GlassPanel>
          <GlassPanel title="Who gains most" padding="md">
            {data.ranked.slice(0, 5).map((row, index, all) => (
              <KeyValueRow
                key={row.playerId}
                label={row.player.displayName}
                hint={`${row.player.age} · ${row.player.position}`}
                value={`+${row.expectedGain.toFixed(2)}`}
                divided={index !== all.length - 1}
              />
            ))}
          </GlassPanel>
        </>
      }
    >
      {/* --- projection ------------------------------------------------ */}
      <StatGrid columns={2}>
        <StatCard
          label="Expected gain"
          value={Number(data.meanGain.toFixed(2))}
          decimals={2}
          suffix=" pts"
          icon={<IconStar size={13} />}
          tone="volt"
          footnote="Average attribute points per player, per week"
        />
        <StatCard
          label="Injury risk"
          value={Number(data.risk.toFixed(2))}
          decimals={2}
          suffix="%"
          icon={<IconInjury size={13} />}
          tone={data.risk > 1.2 ? 'danger' : 'positive'}
          footnote="Per player, per week"
        />
      </StatGrid>

      {/* --- intensity ------------------------------------------------- */}
      <GlassPanel padding="md">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-[15px] font-semibold text-ink">Intensity</h3>
          <span className="text-[12px] text-ink-dim">Growth against bodies</span>
        </div>
        <div className="mt-3">
          <GlassSegmented
            nested
            value={data.intensity}
            onChange={setIntensity}
            aria-label="Training intensity"
            options={(['LIGHT', 'NORMAL', 'HARD'] as const).map((value) => ({
              value,
              label: INTENSITY_LABELS[value],
            }))}
          />
        </div>
        <p className="mt-3 text-[13px] leading-relaxed text-ink text-pretty">
          {INTENSITY_TRADEOFFS[data.intensity]}
        </p>
        {data.intensity === 'HARD' && (
          <div className="mt-3 flex items-start gap-2.5 rounded-md bg-danger/10 p-3">
            <IconWarning size={17} className="mt-0.5 shrink-0 text-danger" />
            <p className="text-[12px] leading-relaxed text-danger text-pretty">
              At this intensity you will lose players to the treatment room. Over a season that is a real cost, and it lands
              in the weeks you can least afford it.
            </p>
          </div>
        )}
      </GlassPanel>

      {/* --- programmes ------------------------------------------------ */}
      <SectionHeader
        title="Programme"
        subtitle="Seven choices. Every one declines something else."
      />
      <div className="flex flex-col gap-2">
        {TRAINING_PROGRAMS.map((program) => (
          <ProgramCard
            key={program.id}
            program={program}
            active={program.id === data.program.id}
            onSelect={setProgram}
          />
        ))}
      </div>

      {/* --- individual focus ------------------------------------------ */}
      <SectionHeader
        title="Individual focus"
        subtitle="A personal target for the handful of players it matters for"
        action={
          <GlassButton variant="ghost" size="sm" onClick={() => setPicker(true)}>
            {focusCount > 0 ? `${focusCount} set` : 'Add'}
          </GlassButton>
        }
      />
      {focusCount === 0 ? (
        <EmptyState
          size="sm"
          icon={<IconTraining />}
          title="Nobody has a personal focus"
          description="Pick out the two or three players whose development you are actually managing. Spreading focus across the whole squad is the same as setting none."
          action={<GlassButton variant="secondary" onClick={() => setPicker(true)}>Choose a player</GlassButton>}
        />
      ) : (
        <GlassPanel padding="md">
          {Object.entries(data.focus).map(([playerId, attribute], index, all) => {
            const player = playerById(state, playerId as Player['id']);
            return (
              <KeyValueRow
                key={playerId}
                label={player?.displayName ?? 'Unknown player'}
                hint={`Working on ${ATTRIBUTE_LABELS[attribute as AttributeKey] ?? attribute}`}
                value={player ? player.attributes[attribute as AttributeKey] ?? '—' : '—'}
                divided={index !== all.length - 1}
                onPress={player ? () => setFocusFor(player) : undefined}
              />
            );
          })}
        </GlassPanel>
      )}

      {/* --- recent results -------------------------------------------- */}
      <SectionHeader title="Recent results" subtitle="What the sessions actually produced" />
      {data.results.length === 0 ? (
        <EmptyState
          size="sm"
          title="No sessions yet"
          description="Training runs when you advance the week. Results land here, player by player."
        />
      ) : (
        <GlassPanel padding="md">
          {data.results.map((result, index) => {
            const player = playerById(state, result.playerId);
            return (
              <button
                key={`${result.playerId}-${result.cycle}-${index}`}
                type="button"
                onClick={() => navigate(buildPath(ROUTES.player, { playerId: result.playerId }))}
                className={cn(
                  'flex w-full min-h-11 items-center gap-3 py-2 text-left',
                  index !== data.results.length - 1 && 'border-b border-white/[0.06]',
                  'outline-none focus-visible:ring-2 focus-visible:ring-volt focus-visible:ring-offset-2 focus-visible:ring-offset-base',
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold text-ink">
                    {player?.displayName ?? 'Unknown player'}
                  </span>
                  <span className="block truncate text-[12px] text-ink-muted">{result.note}</span>
                </span>
                <span
                  className={cn(
                    'tnum shrink-0 text-[13px] font-semibold',
                    result.delta > 0 ? 'text-positive' : result.delta < 0 ? 'text-danger' : 'text-ink-dim',
                  )}
                >
                  {result.delta > 0 ? '+' : ''}{result.delta.toFixed(2)}{' '}
                  <span className="text-ink-dim">{ATTRIBUTE_LABELS[result.attribute as AttributeKey] ?? result.attribute}</span>
                </span>
              </button>
            );
          })}
        </GlassPanel>
      )}

      <Divider />
      <p className="pb-2 text-[12px] leading-relaxed text-ink-dim text-pretty">
        Minutes are the biggest development lever in the game — bigger than any programme on this screen. A nineteen-year-old
        on the bench falls behind a nineteen-year-old who plays, whatever you do here.
      </p>

      {/* --- player picker --------------------------------------------- */}
      <GlassSheet
        open={picker}
        onClose={() => setPicker(false)}
        title="Individual focus"
        subtitle="Pick the player first"
        size="tall"
      >
        <div className="flex flex-col">
          {data.squad.map((player) => (
            <button
              key={player.id}
              type="button"
              onClick={() => { setPicker(false); setFocusFor(player); }}
              className={cn(
                'flex min-h-11 items-center gap-3 rounded-md px-2 py-2 text-left',
                'outline-none focus-visible:ring-2 focus-visible:ring-volt focus-visible:ring-offset-2 focus-visible:ring-offset-base',
                data.focus[player.id] ? 'bg-volt/10' : 'hover:bg-white/[0.05]',
              )}
            >
              <PlayerPortrait seed={player.portraitSeed} size={34} shape="squircle" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold text-ink">{player.displayName}</span>
                <span className="block text-[12px] text-ink-muted">
                  {data.focus[player.id]
                    ? `Focusing on ${ATTRIBUTE_LABELS[data.focus[player.id] as AttributeKey] ?? data.focus[player.id]}`
                    : `Age ${player.age} · potential headroom ${Math.max(0, player.potential - player.overall)}`}
                </span>
              </span>
              <PositionChip position={player.position} size="xs" />
            </button>
          ))}
        </div>
      </GlassSheet>

      <GlassSheet
        open={focusFor !== null}
        onClose={() => setFocusFor(null)}
        title={focusFor ? `${focusFor.displayName}'s focus` : ''}
        subtitle="One attribute. Choosing everything is choosing nothing."
        size="tall"
        footer={
          focusFor && data.focus[focusFor.id] ? (
            <GlassButton
              variant="ghost"
              block
              onClick={() => { setFocus(focusFor.id, null); setFocusFor(null); }}
            >
              Clear focus
            </GlassButton>
          ) : undefined
        }
      >
        {focusFor && (
          <div className="flex flex-col gap-1">
            {(Object.keys(ATTRIBUTE_LABELS) as AttributeKey[]).map((key) => {
              const value = focusFor.attributes[key];
              const selected = data.focus[focusFor.id] === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => { setFocus(focusFor.id, key); setFocusFor(null); }}
                  className={cn(
                    'flex min-h-11 items-center gap-3 rounded-md px-3 text-left',
                    'outline-none focus-visible:ring-2 focus-visible:ring-volt focus-visible:ring-offset-2 focus-visible:ring-offset-base',
                    selected ? 'bg-volt/12 text-volt' : 'text-ink hover:bg-white/[0.05]',
                  )}
                >
                  <span className="min-w-0 flex-1 text-[14px]">{ATTRIBUTE_LABELS[key]}</span>
                  <span className="w-24 shrink-0">
                    <ProgressBar value={value} tone={selected ? 'volt' : 'neutral'} size="xs" />
                  </span>
                  <span className="tnum w-8 shrink-0 text-right text-[13px] font-semibold">{value}</span>
                </button>
              );
            })}
          </div>
        )}
      </GlassSheet>
    </Screen>
  );
}
