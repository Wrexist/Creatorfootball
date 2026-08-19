import { memo, useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  autoLineup, familiarity, formationById, formationsFor, isAvailable, patchClub,
  playerClub, slotFit, squadOf, squadStrength, toTacticVector,
  type Formation, type FormationSlot, type GameState, type PlayerId, type Player,
  type TacticSetup, type TacticVector,
} from '@cf/engine';
import {
  Divider, EmptyState, GlassButton, GlassPanel, GlassPill, GlassSegmented, GlassSheet, KeyValueRow,
  PlayerPortrait, PositionChip, RatingBadge, Screen, SectionHeader, cn,
  IconCheck, IconInjury, IconStar, IconSwap, IconTactics, IconWarning,
} from '@/design';
import { ROUTES } from '@/app/routes';
import { useGameStore } from '@/state/gameStore';
import { ScreenStatus } from './status';
import { SETTINGS, VECTOR_TERMS, type SettingKey } from './tacticsCopy';

/**
 * Tactics.
 *
 * Two rules shaped this screen.
 *
 * First: **no setting is allowed to look free.** Every instruction shows the
 * sentence describing what it costs *and* the engine's own movement in the
 * tactic vector, computed by running `toTacticVector` twice — once with the
 * setting as chosen and once with it neutral. The player never has to take our
 * word for it, and the screen cannot drift away from the model, because the
 * numbers are the model.
 *
 * Second: **the team sheet must work with a thumb and with a screen reader.**
 * Dragging a token onto a slot is the fast path, implemented with raw pointer
 * events so a drag never fights the list scroll. Tap-to-pick-up-then-tap-to-
 * place does exactly the same job with no gesture at all, and is what keyboard
 * and assistive-technology users get.
 */

type Selection = { kind: 'slot'; slotId: string } | { kind: 'bench'; playerId: PlayerId } | null;

interface DragState {
  readonly source: Exclude<Selection, null>;
  readonly node: HTMLElement;
  readonly startX: number;
  readonly startY: number;
  moved: boolean;
}

/* --- the token ------------------------------------------------------- */

interface TokenProps {
  player: Player | undefined;
  slot?: FormationSlot;
  selected: boolean;
  dropTarget?: string;
  colors: { primary: string; secondary: string };
  label: string;
  onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
  onClick: () => void;
}

const Token = memo(function Token({
  player, slot, selected, dropTarget, colors, label, onPointerDown, onClick,
}: TokenProps): ReactNode {
  const fit = player && slot ? familiarity(player.position, slot.position) : 1;
  return (
    <button
      type="button"
      data-drop-slot={dropTarget}
      onPointerDown={onPointerDown}
      onClick={onClick}
      aria-label={label}
      aria-pressed={selected}
      className={cn(
        'flex min-h-11 w-full touch-none select-none flex-col items-center gap-1 rounded-md px-1 py-1.5',
        'outline-none focus-visible:ring-2 focus-visible:ring-volt focus-visible:ring-offset-2 focus-visible:ring-offset-base',
        selected && 'bg-volt/16 ring-2 ring-volt',
      )}
    >
      {player ? (
        <>
          <span className="relative">
            <PlayerPortrait seed={player.portraitSeed} size={34} shape="circle" colors={colors} />
            {!isAvailable(player) && (
              <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-pill bg-danger text-ink [&_svg]:size-2.5">
                <IconInjury />
              </span>
            )}
            {fit < 1 && (
              <span
                className={cn(
                  'absolute -bottom-0.5 -left-1 size-2.5 rounded-pill border border-base',
                  fit >= 0.7 ? 'bg-warning' : 'bg-danger',
                )}
                aria-hidden="true"
              />
            )}
          </span>
          <span className="max-w-full truncate text-[10px] font-semibold leading-tight text-ink">
            {player.lastName}
          </span>
          <span className="tnum text-[10px] font-bold leading-none text-volt">{player.overall}</span>
        </>
      ) : (
        <>
          <span className="flex size-[34px] items-center justify-center rounded-pill border border-dashed border-white/25 text-ink-dim [&_svg]:size-4">
            <IconStar />
          </span>
          <span className="text-[10px] uppercase tracking-[0.1em] text-ink-dim">{slot?.position ?? 'Empty'}</span>
        </>
      )}
    </button>
  );
});

/* --- screen ---------------------------------------------------------- */

export function TacticsScreen(): ReactNode {
  const phase = useGameStore((s) => s.phase);
  const error = useGameStore((s) => s.error);
  const state = useGameStore((s) => s.state);
  const navigate = useNavigate();

  if (!state) {
    return (
      <Screen title="Tactics" onBack={() => navigate(ROUTES.squad)}>
        <ScreenStatus phase={phase} error={error} onStart={() => navigate(ROUTES.onboarding)} />
      </Screen>
    );
  }
  return <TacticsBody state={state} />;
}

function TacticsBody({ state }: { state: GameState }): ReactNode {
  const navigate = useNavigate();
  const apply = useGameStore((s) => s.apply);
  const [selection, setSelection] = useState<Selection>(null);
  const [shapeSize, setShapeSize] = useState<'7' | '11'>('7');
  const [duty, setDuty] = useState<null | 'captainId' | 'penaltyTakerId' | 'setPieceTakerId'>(null);
  const drag = useRef<DragState | null>(null);

  const data = useMemo(() => {
    const club = playerClub(state);
    const tactics = club.tactics;
    const formation = formationById(tactics.formationId);
    const squad = squadOf(state, club.id);
    const byId = new Map(squad.map((p) => [p.id, p]));
    const lineupIds = new Set(
      formation.slots.map((s) => tactics.lineup[s.id]).filter((id): id is PlayerId => Boolean(id)),
    );
    const bench = tactics.bench.map((id) => byId.get(id)).filter((p): p is Player => Boolean(p));
    const reserves = squad.filter((p) => !lineupIds.has(p.id) && !tactics.bench.includes(p.id));

    const manager = state.managers[state.playerManagerId];
    const vectorContext = {
      squadQuality: squadStrength(state, club.id),
      managerTactical: manager?.attributes.tacticalKnowledge ?? 50,
    };

    const warnings: { id: string; text: string; tone: 'danger' | 'warning' }[] = [];
    for (const slot of formation.slots) {
      const playerId = tactics.lineup[slot.id];
      const player = playerId ? byId.get(playerId) : undefined;
      if (!player) {
        warnings.push({ id: `empty-${slot.id}`, text: `${slot.position} is empty — the simulator will fill it for you.`, tone: 'warning' });
        continue;
      }
      if (!isAvailable(player)) {
        warnings.push({ id: `out-${slot.id}`, text: `${player.displayName} cannot play — ${player.injury ? 'injured' : 'suspended'}.`, tone: 'danger' });
      }
      const fit = familiarity(player.position, slot.position);
      if (fit < 0.8) {
        warnings.push({
          id: `fit-${slot.id}`,
          text: `${player.displayName} is a ${player.position} playing ${slot.position} — ${Math.round(fit * 100)}% familiar.`,
          tone: fit < 0.6 ? 'danger' : 'warning',
        });
      }
      if (player.fitness < 60) {
        warnings.push({ id: `fit2-${slot.id}`, text: `${player.displayName} is at ${Math.round(player.fitness)}% fitness.`, tone: 'warning' });
      }

      // `slotFit` is the same score `autoLineup` picks with, so a suggestion
      // here is exactly what the auto-pick would have done differently.
      const currentFit = slotFit(player, slot);
      let better: { player: Player; fit: number } | null = null;
      for (const candidate of squad) {
        if (lineupIds.has(candidate.id) || !isAvailable(candidate)) continue;
        const candidateFit = slotFit(candidate, slot);
        if (candidateFit > currentFit * 1.15 && (!better || candidateFit > better.fit)) {
          better = { player: candidate, fit: candidateFit };
        }
      }
      if (better) {
        warnings.push({
          id: `better-${slot.id}`,
          text: `${better.player.displayName} is a better fit at ${slot.position} than ${player.displayName}.`,
          tone: 'warning',
        });
      }
    }

    return {
      club, tactics, formation, squad, byId, bench, reserves, vectorContext,
      warnings: warnings.slice(0, 5),
      vector: toTacticVector(tactics, vectorContext),
    };
  }, [state]);

  const { club, tactics, formation, byId } = data;

  const colors = useMemo(
    () => ({ primary: club.visual.primary, secondary: club.visual.secondary }),
    [club.visual.primary, club.visual.secondary],
  );

  const setTactics = useCallback((patch: Partial<TacticSetup>) => {
    apply((current) => patchClub(current, current.playerClubId, (c) => ({
      tactics: { ...c.tactics, ...patch },
    })));
  }, [apply]);

  /** Move a player into a slot, sending whoever was there to the bench. */
  const place = useCallback((slotId: string, playerId: PlayerId) => {
    const outgoing = tactics.lineup[slotId] ?? null;
    const fromSlot = Object.keys(tactics.lineup).find((id) => tactics.lineup[id] === playerId);
    const lineup: Record<string, PlayerId | null> = { ...tactics.lineup };

    if (fromSlot) {
      lineup[fromSlot] = outgoing;
      lineup[slotId] = playerId;
      setTactics({ lineup });
      return;
    }

    lineup[slotId] = playerId;
    const bench = tactics.bench.filter((id) => id !== playerId);
    setTactics({
      lineup,
      bench: outgoing ? [outgoing, ...bench] : bench,
    });
  }, [tactics, setTactics]);

  const commitDrop = useCallback((source: Exclude<Selection, null>, slotId: string) => {
    if (source.kind === 'slot') {
      if (source.slotId === slotId) return;
      const a = tactics.lineup[source.slotId] ?? null;
      const b = tactics.lineup[slotId] ?? null;
      setTactics({ lineup: { ...tactics.lineup, [source.slotId]: b, [slotId]: a } });
      return;
    }
    place(slotId, source.playerId);
  }, [tactics, setTactics, place]);

  /**
   * Pointer-event drag. Raw rather than a gesture library so the token can opt
   * out of hit-testing itself (`pointer-events: none` while lifted) and the
   * drop target is simply whatever is under the finger when it lifts.
   */
  const startDrag = useCallback((event: React.PointerEvent<HTMLElement>, source: Exclude<Selection, null>) => {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    const node = event.currentTarget;
    const record: DragState = { source, node, startX: event.clientX, startY: event.clientY, moved: false };
    drag.current = record;

    const onMove = (move: PointerEvent): void => {
      const current = drag.current;
      if (!current) return;
      const dx = move.clientX - current.startX;
      const dy = move.clientY - current.startY;
      if (!current.moved && Math.hypot(dx, dy) < 6) return;
      if (!current.moved) {
        current.moved = true;
        current.node.style.pointerEvents = 'none';
        current.node.style.zIndex = '40';
        current.node.style.opacity = '0.92';
      }
      current.node.style.transform = `translate(${dx}px, ${dy}px) scale(1.08)`;
    };

    const onUp = (up: PointerEvent): void => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      const current = drag.current;
      drag.current = null;
      if (!current) return;
      current.node.style.transform = '';
      current.node.style.pointerEvents = '';
      current.node.style.zIndex = '';
      current.node.style.opacity = '';
      if (!current.moved) return;
      const target = document.elementFromPoint(up.clientX, up.clientY);
      const slotId = target?.closest<HTMLElement>('[data-drop-slot]')?.dataset['dropSlot'];
      if (slotId) {
        commitDrop(current.source, slotId);
        setSelection(null);
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }, [commitDrop]);

  const tapSlot = useCallback((slotId: string) => {
    if (drag.current?.moved) return;
    setSelection((current) => {
      if (!current) return { kind: 'slot', slotId };
      if (current.kind === 'slot' && current.slotId === slotId) return null;
      commitDrop(current, slotId);
      return null;
    });
  }, [commitDrop]);

  const tapBench = useCallback((playerId: PlayerId) => {
    if (drag.current?.moved) return;
    setSelection((current) => {
      if (current && current.kind === 'slot') {
        place(current.slotId, playerId);
        return null;
      }
      if (current && current.kind === 'bench' && current.playerId === playerId) return null;
      return { kind: 'bench', playerId };
    });
  }, [place]);

  const pickFormation = useCallback((next: Formation) => {
    const suggestion = autoLineup(data.squad, next);
    setTactics({
      formationId: next.id,
      lineup: suggestion.lineup,
      bench: suggestion.bench,
    });
    setSelection(null);
  }, [data.squad, setTactics]);

  const autoPick = useCallback(() => {
    const suggestion = autoLineup(data.squad, formation);
    setTactics({
      lineup: suggestion.lineup,
      bench: suggestion.bench,
      captainId: suggestion.captainId,
      setPieceTakerId: suggestion.setPieceTakerId,
      penaltyTakerId: suggestion.penaltyTakerId,
    });
    setSelection(null);
  }, [data.squad, formation, setTactics]);

  const shapes = useMemo(
    () => formationsFor(shapeSize === '7' ? 7 : 11),
    [shapeSize],
  );

  const dutyPlayer = (id: PlayerId | null): Player | undefined => (id ? byId.get(id) : undefined);

  return (
    <Screen
      title="Tactics"
      subtitle={`${formation.name} · ${formation.shape.toLowerCase()}`}
      onBack={() => navigate(ROUTES.squad)}
      footer={
        selection ? (
          <div className="flex items-center gap-3">
            <p className="min-w-0 flex-1 text-[13px] text-ink-muted text-pretty">
              {selection.kind === 'slot'
                ? 'Tap another position to swap, or a bench player to bring them on.'
                : 'Tap a position on the pitch to put them there.'}
            </p>
            <GlassButton variant="ghost" size="sm" onClick={() => setSelection(null)}>Cancel</GlassButton>
          </div>
        ) : undefined
      }
      aside={
        <>
          <GlassPanel title="Set-piece duties" padding="md">
            <KeyValueRow
              label="Captain"
              value={dutyPlayer(tactics.captainId)?.displayName ?? 'Nobody'}
              onPress={() => setDuty('captainId')}
            />
            <KeyValueRow
              label="Penalties"
              value={dutyPlayer(tactics.penaltyTakerId)?.displayName ?? 'Nobody'}
              onPress={() => setDuty('penaltyTakerId')}
            />
            <KeyValueRow
              label="Set pieces"
              value={dutyPlayer(tactics.setPieceTakerId)?.displayName ?? 'Nobody'}
              divided={false}
              onPress={() => setDuty('setPieceTakerId')}
            />
          </GlassPanel>
          <GlassPanel title="Shape right now" padding="md">
            {(Object.keys(VECTOR_TERMS) as (keyof TacticVector)[]).slice(0, 6).map((key, index, all) => (
              <KeyValueRow
                key={key}
                label={VECTOR_TERMS[key].label}
                value={data.vector[key].toFixed(2)}
                divided={index !== all.length - 1}
              />
            ))}
          </GlassPanel>
        </>
      }
    >
      {/* --- warnings ------------------------------------------------- */}
      {data.warnings.length > 0 && (
        <GlassPanel padding="sm" accent="danger">
          <ul className="flex flex-col gap-1.5">
            {data.warnings.map((warning) => (
              <li key={warning.id} className="flex items-start gap-2">
                <IconWarning
                  size={15}
                  className={cn('mt-0.5 shrink-0', warning.tone === 'danger' ? 'text-danger' : 'text-warning')}
                />
                <span className="text-[12px] leading-relaxed text-ink-muted text-pretty">{warning.text}</span>
              </li>
            ))}
          </ul>
        </GlassPanel>
      )}

      {/* --- the pitch ------------------------------------------------ */}
      <div className="relative mx-auto w-full max-w-[420px]">
        <div
          className="relative aspect-[3/4] w-full overflow-hidden rounded-xl border border-white/[0.08]"
          style={{ background: 'linear-gradient(180deg, var(--color-pitch-mid) 0%, var(--color-pitch-deep) 100%)' }}
        >
          <svg viewBox="0 0 100 133" className="absolute inset-0 size-full" aria-hidden="true">
            <g fill="none" stroke="var(--color-pitch-line)" strokeWidth="0.6">
              <rect x="4" y="4" width="92" height="125" rx="2" />
              <line x1="4" y1="66.5" x2="96" y2="66.5" />
              <circle cx="50" cy="66.5" r="14" />
              <rect x="26" y="4" width="48" height="18" />
              <rect x="26" y="111" width="48" height="18" />
              <rect x="38" y="4" width="24" height="8" />
              <rect x="38" y="121" width="24" height="8" />
            </g>
          </svg>

          {formation.slots.map((slot) => {
            const playerId = tactics.lineup[slot.id] ?? null;
            const player = playerId ? byId.get(playerId) : undefined;
            return (
              <div
                key={slot.id}
                className="absolute w-[72px] -translate-x-1/2 translate-y-1/2"
                style={{ left: `${slot.y * 100}%`, bottom: `${slot.x * 100}%` }}
              >
                <Token
                  player={player}
                  slot={slot}
                  dropTarget={slot.id}
                  selected={selection?.kind === 'slot' && selection.slotId === slot.id}
                  colors={colors}
                  label={player
                    ? `${player.displayName}, ${slot.position}. Tap to select or drag to move.`
                    : `Empty ${slot.position} slot. Tap to fill.`}
                  onPointerDown={(event) => startDrag(event, { kind: 'slot', slotId: slot.id })}
                  onClick={() => tapSlot(slot.id)}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <GlassButton variant="secondary" size="sm" icon={<IconSwap size={16} />} onClick={autoPick}>
          Auto pick
        </GlassButton>
        <GlassButton variant="ghost" size="sm" icon={<IconTactics size={16} />} onClick={() => navigate(ROUTES.squad)}>
          Squad list
        </GlassButton>
      </div>

      {/* --- bench ---------------------------------------------------- */}
      <SectionHeader title="Bench" subtitle={`${data.bench.length} named · ${data.reserves.length} not involved`} />
      {data.bench.length === 0 && data.reserves.length === 0 ? (
        <EmptyState size="sm" title="Nobody left" description="Every fit player is in the starting side." />
      ) : (
        <GlassPanel padding="sm">
          <div className="grid grid-cols-4 gap-1 sm:grid-cols-6">
            {[...data.bench, ...data.reserves].map((player) => (
              <Token
                key={player.id}
                player={player}
                selected={selection?.kind === 'bench' && selection.playerId === player.id}
                colors={colors}
                label={`${player.displayName}, ${player.position}, rated ${player.overall}. Tap to select or drag onto the pitch.`}
                onPointerDown={(event) => startDrag(event, { kind: 'bench', playerId: player.id })}
                onClick={() => tapBench(player.id)}
              />
            ))}
          </div>
        </GlassPanel>
      )}

      {/* --- formation ------------------------------------------------ */}
      <SectionHeader
        title="Shape"
        subtitle="Ids read back to front, keeper implied"
        action={
          <GlassSegmented
            value={shapeSize}
            onChange={setShapeSize}
            size="sm"
            block={false}
            aria-label="Squad size"
            options={[{ value: '7', label: '7-a-side' }, { value: '11', label: '11-a-side' }]}
          />
        }
      />
      <div className="flex flex-col gap-2">
        {shapes.map((shape) => {
          const active = shape.id === formation.id;
          return (
            <button
              key={shape.id}
              type="button"
              onClick={() => pickFormation(shape)}
              aria-pressed={active}
              className={cn(
                'flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-3 text-left',
                'outline-none focus-visible:ring-2 focus-visible:ring-volt focus-visible:ring-offset-2 focus-visible:ring-offset-base',
                active ? 'bg-volt/12 ring-1 ring-volt/40' : 'bg-white/[0.03] hover:bg-white/[0.06]',
              )}
            >
              <span className="tnum w-14 shrink-0 font-display text-[15px] font-bold text-ink">{shape.id}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold text-ink">{shape.name}</span>
                <span className="block text-[12px] leading-relaxed text-ink-muted text-pretty">{shape.blurb}</span>
              </span>
              {active ? <IconCheck size={18} className="shrink-0 text-volt" /> : (
                <GlassPill size="xs">{shape.shape.toLowerCase()}</GlassPill>
              )}
            </button>
          );
        })}
      </div>

      {/* --- instructions --------------------------------------------- */}
      <SectionHeader
        title="Instructions"
        subtitle="Every one of these costs you something. The numbers under each are the engine's, not ours."
      />
      {SETTINGS.map((setting) => (
        <SettingCard
          key={setting.key}
          setting={setting}
          tactics={tactics}
          context={data.vectorContext}
          onChange={(value) => setTactics({ [setting.key]: value } as Partial<TacticSetup>)}
        />
      ))}

      <Divider />
      <p className="pb-2 text-[12px] leading-relaxed text-ink-dim text-pretty">
        A better coach gets more out of the same instruction, and a weaker squad pays the full physical bill for the
        demanding ones while collecting less of the reward. That is why the same tactics read differently here than they
        would at the club above you.
      </p>

      {/* --- duty picker ---------------------------------------------- */}
      <GlassSheet
        open={duty !== null}
        onClose={() => setDuty(null)}
        title={duty === 'captainId' ? 'Pick a captain' : duty === 'penaltyTakerId' ? 'Penalty taker' : 'Set-piece taker'}
        size="tall"
      >
        <div className="flex flex-col">
          {data.squad.map((player) => (
            <button
              key={player.id}
              type="button"
              onClick={() => {
                if (duty) setTactics({ [duty]: player.id } as Partial<TacticSetup>);
                setDuty(null);
              }}
              className={cn(
                'flex min-h-11 items-center gap-3 rounded-md px-2 py-2 text-left',
                'outline-none focus-visible:ring-2 focus-visible:ring-volt focus-visible:ring-offset-2 focus-visible:ring-offset-base',
                duty && tactics[duty] === player.id ? 'bg-volt/12' : 'hover:bg-white/[0.05]',
              )}
            >
              <PlayerPortrait seed={player.portraitSeed} size={34} shape="squircle" colors={colors} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold text-ink">{player.displayName}</span>
                <span className="block text-[12px] text-ink-muted">
                  {duty === 'captainId'
                    ? `Leadership ${Math.round(player.mental.leadership)}`
                    : duty === 'penaltyTakerId'
                      ? `Finishing ${player.attributes.finishing} · composure ${player.attributes.composure}`
                      : `Crossing ${player.attributes.crossing} · technique ${player.attributes.technique}`}
                </span>
              </span>
              <PositionChip position={player.position} size="xs" />
              <RatingBadge value={player.overall} size="xs" />
            </button>
          ))}
        </div>
      </GlassSheet>
    </Screen>
  );
}

/* --- one instruction, with its cost ---------------------------------- */

const SettingCard = memo(function SettingCard({
  setting, tactics, context, onChange,
}: {
  setting: (typeof SETTINGS)[number];
  tactics: TacticSetup;
  context: { squadQuality: number; managerTactical: number };
  onChange: (value: string) => void;
}): ReactNode {
  const current = String(tactics[setting.key as SettingKey]);
  const option = setting.options.find((o) => o.value === current) ?? setting.options[0];

  // The honest comparison: this instruction as chosen, against the same team
  // with this one instruction neutral. Everything else is held constant.
  const deltas = useMemo(() => {
    const chosen = toTacticVector(tactics, context);
    const neutral = toTacticVector(
      { ...tactics, [setting.key]: setting.neutral } as TacticSetup,
      context,
    );
    return (Object.keys(VECTOR_TERMS) as (keyof TacticVector)[])
      .map((key) => ({ key, delta: chosen[key] - neutral[key] }))
      .filter((entry) => Math.abs(entry.delta) >= 0.015)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 4);
  }, [tactics, context, setting]);

  return (
    <GlassPanel padding="md">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[15px] font-semibold text-ink">{setting.label}</h3>
        <span className="text-[12px] text-ink-dim">{setting.question}</span>
      </div>

      <div className="mt-3">
        <GlassSegmented
          nested
          value={current}
          onChange={onChange}
          size="sm"
          aria-label={setting.label}
          options={setting.options.map((o) => ({ value: o.value, label: o.label }))}
        />
      </div>

      <p className="mt-3 text-[13px] leading-relaxed text-ink text-pretty">{option?.tradeOff}</p>

      {deltas.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {deltas.map(({ key, delta }) => {
            const term = VECTOR_TERMS[key];
            const good = term.higher === 'neutral'
              ? 'neutral'
              : (delta > 0) === (term.higher === 'good') ? 'good' : 'bad';
            return (
              <GlassPill
                key={key}
                size="sm"
                tone={good === 'good' ? 'positive' : good === 'bad' ? 'danger' : 'neutral'}
              >
                {term.label} {delta > 0 ? '+' : '−'}{Math.abs(delta * term.scale).toFixed(0)}
              </GlassPill>
            );
          })}
        </div>
      ) : (
        <p className="mt-2 text-[12px] text-ink-dim">Neutral — this setting is currently costing and buying nothing.</p>
      )}
    </GlassPanel>
  );
});
