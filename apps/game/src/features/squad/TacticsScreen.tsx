import { memo, useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  autoLineup, familiarity, formationById, formationsFor, isAvailable, patchClub,
  playerClub, slotFit, squadOf, squadStrength, toTacticVector,
  type Formation, type FormationSlot, type GameState, type PlayerId, type Player,
  type TacticSetup, type TacticVector,
} from '@cf/engine';
import {
  ConditionRing, Divider, EmptyState, FitText, GlassButton, GlassPanel, GlassPill, GlassSegmented,
  GlassSheet, KeyValueRow, NameText, PlayerPortrait, PositionChip, RatingBadge, Screen,
  SectionHeader, cn, conditionLabel, haptics, sidesWord,
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

/**
 * Drop-target id for the bench panel.
 *
 * Slot ids come from the formation, so this needs to be something no formation
 * can mint. The double underscore is the whole guard, and it is enough: slot
 * ids are `gk`, `dl`, `mc` and friends.
 */
const BENCH_TARGET = '__bench';

/**
 * Distance from a token's top edge to the centre of its portrait, in px.
 *
 * Tokens are anchored by their *portrait*, not by their bounding box. A box
 * centred on the slot puts the face above where the player actually is and the
 * name below it, and the error grows with every row of the token — which is how
 * the goalkeeper ended up standing on his own six-yard line with his name
 * sliced off by the touchline.
 *
 * The value is the button's top padding plus half the condition ring. Both are
 * fixed by the token's own layout, so this is a constant rather than a
 * measurement.
 */
const PORTRAIT_ANCHOR = 4 + 21;

interface DragState {
  readonly source: Exclude<Selection, null>;
  readonly node: HTMLElement;
  readonly startX: number;
  readonly startY: number;
  /** The scrolling ancestor, so a drag can reach past the fold. */
  readonly scroller: HTMLElement | null;
  /** Where that ancestor was scrolled to when the drag began. */
  readonly startScrollTop: number;
  /** Last pointer position, in client coordinates. Drives the edge scroll. */
  clientX: number;
  clientY: number;
  /** Handle for the auto-scroll loop, so it can be stopped on release. */
  frame: number;
  moved: boolean;
}

/** How close to an edge the finger has to be before the list starts moving. */
const SCROLL_EDGE = 72;
/** Fastest auto-scroll, in px per frame, reached at the very edge. */
const SCROLL_SPEED = 14;

/* --- the token ------------------------------------------------------- */

interface TokenProps {
  player: Player | undefined;
  /** The pitch slot this token sits in. Absent for a bench token. */
  slot?: FormationSlot;
  selected: boolean;
  /** Set on anything a dragged token may be dropped onto. */
  dropTarget?: string;
  /** Lit while a drag is hovering this target. */
  dropActive?: boolean;
  /** Dimmed while it is the token being dragged. */
  lifted?: boolean;
  colors: { primary: string; secondary: string };
  label: string;
  onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
  onClick: () => void;
}

/**
 * One player on the team sheet.
 *
 * Three things have to be legible at 72px wide, and only one of them used to
 * be: **who** (the portrait and surname), **where** (the position this slot is,
 * and whether this player actually plays there) and **how fit** (whether they
 * can be asked to do it for ninety minutes).
 *
 * Position was the gap. It was drawn only on *empty* slots, so the moment a
 * slot was filled the pitch stopped saying what any of its shapes meant — you
 * could see eleven faces and not one position, and the only way to find out
 * that your striker was in goal was to read a warning sentence above the pitch.
 * The chip is now always there, and it turns red when the player in the slot
 * does not belong in it, which is the same fact the warning states in words.
 */
const Token = memo(function Token({
  player, slot, selected, dropTarget, dropActive = false, lifted = false,
  colors, label, onPointerDown, onClick,
}: TokenProps): ReactNode {
  // On the pitch a token shows the *slot's* position, because that is the
  // question ("what is this shape?"). On the bench there is no slot, so it
  // shows the player's own, which is the question there ("what is he?").
  const position = slot?.position ?? player?.position;
  const fit = player && slot ? familiarity(player.position, slot.position) : 1;
  const available = player ? isAvailable(player) : true;

  return (
    <button
      type="button"
      data-drop-slot={dropTarget}
      onPointerDown={onPointerDown}
      onClick={onClick}
      aria-label={label}
      aria-pressed={selected}
      className={cn(
        'flex min-h-11 w-full touch-none select-none flex-col items-center gap-1 rounded-md px-1 pb-1.5 pt-1',
        'outline-none transition-[background-color,box-shadow] duration-[var(--duration-fast)] ease-out-quint',
        'focus-visible:ring-2 focus-visible:ring-volt focus-visible:ring-offset-2 focus-visible:ring-offset-base',
        selected && 'bg-volt/16 ring-2 ring-volt',
        // A drop target has to answer "will it land here?" while a finger is
        // still over it — after the release is too late to be feedback.
        dropActive && !selected && 'bg-volt/10 ring-2 ring-volt/70',
        lifted && 'opacity-40',
      )}
    >
      {player ? (
        <>
          <span className="relative">
            <ConditionRing
              fitness={player.fitness}
              size={42}
              unavailable={!available}
            >
              <PlayerPortrait seed={player.portraitSeed} size={34} shape="circle" colors={colors} />
            </ConditionRing>
            {!available && (
              <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-pill bg-danger text-ink [&_svg]:size-2.5">
                <IconInjury />
              </span>
            )}
          </span>

          {position && (
            <PositionChip
              position={position}
              size="xs"
              outOfPosition={fit < 1}
              className={cn(
                '-mt-1.5 relative z-1',
                // Out of position is a fact about the *team sheet*, not about
                // the player, so it is stated where the sheet is read rather
                // than only in a sentence above it.
                fit < 0.6 && 'border-danger/70 bg-danger/20 text-ink',
                fit >= 0.6 && fit < 1 && 'border-warning/60 bg-warning/15 text-ink',
              )}
            />
          )}

          {/* The slot is 60-odd pixels wide and a surname is content, so it is
              fitted rather than cut: it shrinks to the type floor, then falls
              back to the first part of a double-barrelled name. */}
          <FitText
            size={11}
            min={9}
            lines={2}
            alternates={[player.lastName.split(/[\s-]/)[0] ?? player.lastName]}
            className="max-w-full text-center font-semibold leading-tight text-ink"
          >
            {player.lastName}
          </FitText>
          <span className="tnum text-micro font-bold leading-none text-volt">{player.overall}</span>
        </>
      ) : (
        <>
          <span className="flex size-[42px] items-center justify-center rounded-pill border border-dashed border-white/25 text-ink-dim [&_svg]:size-4">
            <IconStar />
          </span>
          {position ? (
            <PositionChip position={position} size="xs" className="-mt-1.5 relative z-1" />
          ) : (
            <span className="text-micro uppercase tracking-[0.1em] text-ink-dim">Empty</span>
          )}
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
  // Mirrored into state so the tokens can react to the drag. The ref is what
  // the pointer handlers read (they run outside React and must not go stale);
  // these two are what the pitch renders from.
  const [dragging, setDragging] = useState<Exclude<Selection, null> | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

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
    let empty = 0;
    for (const slot of formation.slots) {
      const playerId = tactics.lineup[slot.id];
      const player = playerId ? byId.get(playerId) : undefined;
      if (!player) {
        empty++;
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

    // One line for the whole problem rather than seven identical ones: a wall
    // of "GK is empty" is noise, and the fix is the same button either way.
    if (empty > 0 && empty < formation.slots.length) {
      warnings.unshift({
        id: 'empty',
        text: `${empty} position${empty === 1 ? ' is' : 's are'} unfilled — the simulator will pick for you if you leave it.`,
        tone: 'warning',
      });
    }

    return {
      club, tactics, formation, squad, byId, bench, reserves, vectorContext,
      empty,
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

  /** Take a player out of the side and name them on the bench instead. */
  const benchPlayer = useCallback((slotId: string) => {
    const outgoing = tactics.lineup[slotId] ?? null;
    if (!outgoing) return;
    setTactics({
      lineup: { ...tactics.lineup, [slotId]: null },
      bench: [outgoing, ...tactics.bench.filter((id) => id !== outgoing)],
    });
  }, [tactics, setTactics]);

  const commitDrop = useCallback((source: Exclude<Selection, null>, target: string) => {
    // Dropping onto the bench is the move that was missing. Every other
    // arrangement could be made by dragging, but taking a player *out* of the
    // side could only be done by dragging somebody else on top of them — so a
    // ten-man shape was unreachable by the gesture the screen teaches.
    if (target === BENCH_TARGET) {
      if (source.kind === 'slot') benchPlayer(source.slotId);
      return;
    }
    if (source.kind === 'slot') {
      if (source.slotId === target) return;
      const a = tactics.lineup[source.slotId] ?? null;
      const b = tactics.lineup[target] ?? null;
      setTactics({ lineup: { ...tactics.lineup, [source.slotId]: b, [target]: a } });
      return;
    }
    place(target, source.playerId);
  }, [tactics, setTactics, place, benchPlayer]);

  /**
   * Pointer-event drag. Raw rather than a gesture library so the token can opt
   * out of hit-testing itself (`pointer-events: none` while lifted) and the
   * drop target is simply whatever is under the finger.
   *
   * The target is now resolved on every move rather than only on release, which
   * is what lets the pitch light the slot a finger is over. Without it the
   * gesture is a leap of faith: you let go and find out, and the undo for a
   * wrong drop is another drag.
   */
  const startDrag = useCallback((event: React.PointerEvent<HTMLElement>, source: Exclude<Selection, null>) => {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    const node = event.currentTarget;
    const scroller = node.closest<HTMLElement>('.scroll-y');
    const record: DragState = {
      source,
      node,
      startX: event.clientX,
      startY: event.clientY,
      scroller,
      startScrollTop: scroller?.scrollTop ?? 0,
      clientX: event.clientX,
      clientY: event.clientY,
      frame: 0,
      moved: false,
    };
    drag.current = record;

    const targetUnder = (x: number, y: number): string | null => {
      const element = document.elementFromPoint(x, y);
      return element?.closest<HTMLElement>('[data-drop-slot]')?.dataset['dropSlot'] ?? null;
    };

    /**
     * Follow the finger, in content coordinates.
     *
     * The scroll offset is part of the sum because the list moves underneath a
     * held token: the token's own origin scrolls with the content, so tracking
     * the pointer alone would leave it sliding away from the finger by exactly
     * the distance scrolled.
     */
    const paint = (current: DragState): void => {
      const scrolled = (current.scroller?.scrollTop ?? 0) - current.startScrollTop;
      const dx = current.clientX - current.startX;
      const dy = current.clientY - current.startY + scrolled;
      current.node.style.transform = `translate(${dx}px, ${dy}px) scale(1.08)`;
    };

    /**
     * Scroll the list when the finger nears its edges.
     *
     * Without this the gesture stops at the fold, and on a phone the bench is
     * always past the fold — so "drag a substitute on" was a gesture the screen
     * advertised and the layout made impossible. Speed ramps with depth into
     * the edge band, so a finger parked just inside it creeps and a finger held
     * at the very edge moves properly.
     */
    const step = (): void => {
      const current = drag.current;
      if (!current?.moved || !current.scroller) return;
      const box = current.scroller.getBoundingClientRect();
      const fromTop = current.clientY - box.top;
      const fromBottom = box.bottom - current.clientY;
      let delta = 0;
      if (fromTop < SCROLL_EDGE) delta = -SCROLL_SPEED * (1 - Math.max(0, fromTop) / SCROLL_EDGE);
      else if (fromBottom < SCROLL_EDGE) delta = SCROLL_SPEED * (1 - Math.max(0, fromBottom) / SCROLL_EDGE);

      if (delta !== 0) {
        const before = current.scroller.scrollTop;
        current.scroller.scrollTop = before + delta;
        if (current.scroller.scrollTop !== before) {
          paint(current);
          const over = targetUnder(current.clientX, current.clientY);
          setHovered((was) => (was === over ? was : over));
        }
      }
      current.frame = requestAnimationFrame(step);
    };

    const onMove = (move: PointerEvent): void => {
      const current = drag.current;
      if (!current) return;
      current.clientX = move.clientX;
      current.clientY = move.clientY;
      const dx = move.clientX - current.startX;
      const dy = move.clientY - current.startY;
      if (!current.moved && Math.hypot(dx, dy) < 6) return;
      if (!current.moved) {
        current.moved = true;
        current.node.style.pointerEvents = 'none';
        current.node.style.zIndex = '40';
        // The token is picked up, so it says so: a nudge, the source dims, and
        // the lifted copy starts following the finger.
        haptics.selection();
        setDragging(current.source);
        current.frame = requestAnimationFrame(step);
      }
      paint(current);
      const over = targetUnder(move.clientX, move.clientY);
      setHovered((was) => {
        if (was === over) return was;
        if (over !== null) haptics.selection();
        return over;
      });
    };

    const finish = (current: DragState | null): void => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      if (current?.frame) cancelAnimationFrame(current.frame);
      setDragging(null);
      setHovered(null);
      if (!current) return;
      current.node.style.transform = '';
      current.node.style.pointerEvents = '';
      current.node.style.zIndex = '';
      current.node.style.opacity = '';
    };

    const onUp = (up: PointerEvent): void => {
      const current = drag.current;
      drag.current = null;
      finish(current);
      if (!current?.moved) return;
      const target = targetUnder(up.clientX, up.clientY);
      if (target) {
        commitDrop(current.source, target);
        haptics.impact();
        setSelection(null);
      }
    };

    // A cancelled pointer — a system gesture, a call arriving — puts the token
    // back rather than committing wherever the finger happened to be.
    const onCancel = (): void => {
      const current = drag.current;
      drag.current = null;
      finish(current);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
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
      {/* --- no team picked yet ---------------------------------------- */}
      {data.empty === formation.slots.length && (
        <GlassPanel padding="md" accent="volt">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-volt">No team selected</p>
          <h2 className="mt-1 font-display text-[20px] font-bold tracking-[-0.03em] text-ink">
            Pick a side for {formation.name}
          </h2>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-muted text-pretty">
            Start from a sensible {sidesWord(formation.slots.length)} and adjust it, or drag players onto the pitch
            yourself. Leave it empty and the simulator picks for you — it will not pick badly, but it will not pick your
            way either.
          </p>
          <div className="mt-3">
            <GlassButton variant="primary" icon={<IconSwap size={18} />} onClick={autoPick}>
              Pick a team for me
            </GlassButton>
          </div>
        </GlassPanel>
      )}

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
      {/*
        Two layers, and the split is the fix for a real bug: the markings are
        clipped to the pitch and the tokens are not.

        Tokens are centred on their slot, so a slot near an end line puts half
        a token past the touchline — which is correct, and which the pitch's own
        `overflow-hidden` was cutting in half. The goalkeeper lost his name and
        his rating to it on every formation. Padding the outer box by half a
        token and letting the tokens draw into that padding gives them the room
        they were always asking for, while the grass and its lines stay crisply
        clipped to the rounded rectangle they belong to.
      */}
      <div className="relative mx-auto w-full max-w-[420px] px-2 pb-11 pt-2">
        <div
          className="relative aspect-[3/4] w-full rounded-xl border border-white/[0.08]"
          style={{ background: 'linear-gradient(180deg, var(--color-pitch-mid) 0%, var(--color-pitch-deep) 100%)' }}
        >
          <svg
            viewBox="0 0 100 133"
            className="absolute inset-0 size-full overflow-hidden rounded-xl"
            aria-hidden="true"
          >
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
            const fit = player ? familiarity(player.position, slot.position) : 1;
            return (
              <div
                key={slot.id}
                className="absolute w-[72px]"
                style={{
                  left: `${slot.y * 100}%`,
                  // Slot x runs back to front, so it is measured from the goal
                  // line the team is defending.
                  top: `${(1 - slot.x) * 100}%`,
                  transform: `translate(-50%, -${PORTRAIT_ANCHOR}px)`,
                }}
              >
                <Token
                  player={player}
                  slot={slot}
                  dropTarget={slot.id}
                  dropActive={hovered === slot.id}
                  lifted={dragging?.kind === 'slot' && dragging.slotId === slot.id}
                  selected={selection?.kind === 'slot' && selection.slotId === slot.id}
                  colors={colors}
                  label={player
                    ? [
                      `${player.displayName}, ${slot.position}`,
                      fit < 1 ? `out of position, ${Math.round(fit * 100)}% familiar` : null,
                      conditionLabel(player.fitness),
                      'Tap to select, or drag to move.',
                    ].filter(Boolean).join('. ')
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
        // The panel itself is a drop target, so a player can be dragged *off*
        // the pitch. Without it the gesture only worked in one direction and
        // the way to drop to ten men was to find it in a menu.
        <div
          data-drop-slot={BENCH_TARGET}
          className={cn(
            'rounded-lg transition-shadow duration-[var(--duration-fast)] ease-out-quint',
            hovered === BENCH_TARGET && dragging?.kind === 'slot' && 'ring-2 ring-volt',
          )}
        >
          <GlassPanel padding="sm">
            {dragging?.kind === 'slot' && (
              <p className="mb-2 text-center text-[12px] font-semibold text-volt">
                Drop here to take them off
              </p>
            )}
            <div className="grid grid-cols-4 gap-1 sm:grid-cols-6">
              {[...data.bench, ...data.reserves].map((player) => (
                <Token
                  key={player.id}
                  player={player}
                  lifted={dragging?.kind === 'bench' && dragging.playerId === player.id}
                  selected={selection?.kind === 'bench' && selection.playerId === player.id}
                  colors={colors}
                  label={[
                    `${player.displayName}, ${player.position}, rated ${player.overall}`,
                    conditionLabel(player.fitness),
                    'Tap to select, or drag onto the pitch.',
                  ].join('. ')}
                  onPointerDown={(event) => startDrag(event, { kind: 'bench', playerId: player.id })}
                  onClick={() => tapBench(player.id)}
                />
              ))}
            </div>
          </GlassPanel>
        </div>
      )}

      {/* --- formation ------------------------------------------------ */}
      <SectionHeader
        title="Shape"
        subtitle="Defenders, midfielders, then attackers. The keeper is a given."
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
                <NameText
                  name={player.displayName}
                  short={`${player.firstName.charAt(0)}. ${player.lastName}`}
                  role="bodyStrong"
                />
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

interface VectorDelta {
  readonly key: keyof TacticVector;
  readonly delta: number;
}

/**
 * What one instruction is actually doing, measured rather than asserted: the
 * team's vector with this setting as given, against the identical team with
 * this one setting neutral. Everything else is held constant, so the difference
 * is the instruction and nothing else.
 */
function deltasFor(
  tactics: TacticSetup,
  key: SettingKey,
  value: string,
  neutral: string,
  context: { squadQuality: number; managerTactical: number },
): VectorDelta[] {
  const chosen = toTacticVector({ ...tactics, [key]: value } as TacticSetup, context);
  const base = toTacticVector({ ...tactics, [key]: neutral } as TacticSetup, context);
  return (Object.keys(VECTOR_TERMS) as (keyof TacticVector)[])
    .map((term) => ({ key: term, delta: chosen[term] - base[term] }))
    .filter((entry) => Math.abs(entry.delta) >= 0.015)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 4);
}

function DeltaPills({ deltas }: { deltas: readonly VectorDelta[] }): ReactNode {
  return (
    <div className="flex flex-wrap gap-1.5">
      {deltas.map(({ key, delta }) => {
        const term = VECTOR_TERMS[key];
        const verdict = term.higher === 'neutral'
          ? 'neutral'
          : (delta > 0) === (term.higher === 'good') ? 'good' : 'bad';
        return (
          <GlassPill
            key={key}
            size="sm"
            tone={verdict === 'good' ? 'positive' : verdict === 'bad' ? 'danger' : 'neutral'}
          >
            {term.label} {delta > 0 ? '+' : '−'}{Math.abs(delta * term.scale).toFixed(0)}
          </GlassPill>
        );
      })}
    </div>
  );
}

const SettingCard = memo(function SettingCard({
  setting, tactics, context, onChange,
}: {
  setting: (typeof SETTINGS)[number];
  tactics: TacticSetup;
  context: { squadQuality: number; managerTactical: number };
  onChange: (value: string) => void;
}): ReactNode {
  const [compare, setCompare] = useState(false);
  const current = String(tactics[setting.key as SettingKey]);

  const rows = useMemo(
    () => setting.options.map((option) => ({
      option,
      deltas: deltasFor(tactics, setting.key, option.value, setting.neutral, context),
    })),
    [setting, tactics, context],
  );
  const active = rows.find((row) => row.option.value === current) ?? rows[0];

  return (
    <GlassPanel padding="md">
      <div>
        <h3 className="text-[15px] font-semibold text-ink">{setting.label}</h3>
        <p className="mt-0.5 text-[12px] text-ink-dim text-pretty">{setting.question}</p>
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

      <p className="mt-3 text-[13px] leading-relaxed text-ink text-pretty">{active?.option.tradeOff}</p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {active && active.deltas.length > 0 ? (
          <DeltaPills deltas={active.deltas} />
        ) : (
          <span className="text-[12px] text-ink-dim">Neutral — buying nothing, costing nothing.</span>
        )}
        <GlassButton variant="ghost" size="sm" onClick={() => setCompare(true)}>
          Compare all {setting.options.length}
        </GlassButton>
      </div>

      <GlassSheet
        open={compare}
        onClose={() => setCompare(false)}
        title={setting.label}
        subtitle={setting.question}
        size="tall"
      >
        <div className="flex flex-col gap-2">
          {rows.map(({ option, deltas }) => (
            <button
              key={option.value}
              type="button"
              onClick={() => { onChange(option.value); setCompare(false); }}
              className={cn(
                'w-full rounded-lg px-3.5 py-3 text-left',
                'outline-none focus-visible:ring-2 focus-visible:ring-volt focus-visible:ring-offset-2 focus-visible:ring-offset-base',
                option.value === current ? 'bg-volt/12 ring-1 ring-volt/40' : 'bg-white/[0.04] hover:bg-white/[0.07]',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[15px] font-semibold text-ink">{option.label}</span>
                {option.value === current && <IconCheck size={17} className="shrink-0 text-volt" />}
              </div>
              <p className="mt-1 text-[12px] leading-relaxed text-ink-muted text-pretty">{option.tradeOff}</p>
              {deltas.length > 0 ? (
                <div className="mt-2"><DeltaPills deltas={deltas} /></div>
              ) : (
                <p className="mt-2 text-[11px] text-ink-dim">The reference setting — no movement either way.</p>
              )}
            </button>
          ))}
        </div>
        <p className="mt-3 text-[12px] leading-relaxed text-ink-dim text-pretty">
          Numbers are this instruction measured against the same team with it set neutral, through your manager and your
          squad. A better coach lands more of it; a weaker squad pays more of the physical cost.
        </p>
      </GlassSheet>
    </GlassPanel>
  );
});
