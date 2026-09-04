import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type {
  DefensiveLine, Player, PlayerId, PressIntensity, RiskLevel, SpecialRuleDefinition,
  SpecialRuleId, SubstitutionVerdict, TacticSetup, Tempo, Width, CounterStyle,
} from '@cf/engine';
import {
  GlassButton, GlassPill, GlassSegmented, GlassSheet, IconCheck, IconFastForward, PlayerPortrait,
  PositionChip, ProgressBar, RatingBadge, SheetCloseRow, cn, haptics, sfx,
} from '@/design';
import { useMatchStore, type MatchSpeed } from '@/state/matchStore';
import type { KitColors } from '../shared/kit';
import { SPECIAL_RULE_TONE, SPEED_HINT, SPEED_LABEL } from '../shared/format';
import {
  REPLACEMENT_LABEL, rankReplacements, refusalMessage,
  type BenchSeat, type ReplacementContext, type ReplacementLabel,
} from './replacements';

/**
 * The three things a manager can actually do while the ball is rolling:
 * change the personnel, change the shape, or spend a rule card.
 *
 * All three are sheets rather than inline panels. A sheet is the screen's
 * second and last blurring surface, it pauses nothing (the match keeps running
 * behind it, which is the point — hesitating has a cost), and it gives every
 * control the full width of the phone for a comfortable target.
 */

/* --- substitutions ---------------------------------------------------- */

export interface SubstitutionSheetProps {
  open: boolean;
  onClose: () => void;
  squad: readonly Player[];
  kit: KitColors;
  /** Regulation length, for how far into the match the change is being made. */
  durationMinutes: number;
  onSubstitute: (out: PlayerId, in_: PlayerId) => SubstitutionVerdict;
}

const LABEL_TONE: Record<ReplacementLabel, 'positive' | 'info' | 'warning' | 'neutral'> = {
  BEST_FIT: 'positive',
  FRESH_LEGS: 'info',
  ATTACKING: 'warning',
  DEFENSIVE: 'neutral',
};

/**
 * Two taps: who comes off, then who comes on.
 *
 * The bench shown here is the simulator's own — the seven it will actually
 * accept, with the used and the sent-off marked as such — and the count in
 * the subtitle is the simulator's own too. The interface used to show the
 * whole squad as "the bench" and keep its own tally, and the manager it lied
 * to was told to "check your remaining substitutions" with five left.
 *
 * Once a man is chosen to come off, the sheet reorganises around the
 * decision he creates: he sits at the top, the recommended replacements come
 * next with a word each about why, the rest of the bench follows, and the
 * eleven still on the pitch drop out of the way — one tap on the man at the
 * top brings them back. Nobody scrolls past a whole team to find a keeper.
 */
export function SubstitutionSheet({
  open, onClose, squad, kit, durationMinutes, onSubstitute,
}: SubstitutionSheetProps): ReactNode {
  const frame = useMatchStore((s) => s.frame);
  const subs = useMatchStore((s) => s.subs);
  const minute = useMatchStore((s) => s.minute);
  const homeScore = useMatchStore((s) => s.homeScore);
  const awayScore = useMatchStore((s) => s.awayScore);
  const playerSide = useMatchStore((s) => s.playerSide);
  const [outId, setOutId] = useState<PlayerId | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** A change is being made. Nothing else is accepted until it has been answered. */
  const busy = useRef(false);

  const remaining = subs?.remaining ?? 0;
  const byId = useMemo(() => new Map(squad.map((p) => [p.id as string, p])), [squad]);

  const { onPitch, stamina } = useMemo(() => {
    const staminaMap = new Map<string, number>();
    const on: Player[] = [];
    for (const unit of frame?.players ?? []) {
      const player = byId.get(unit.playerId);
      if (!player) continue;
      staminaMap.set(unit.playerId, unit.stamina);
      on.push(player);
    }
    on.sort((a, b) => (staminaMap.get(a.id) ?? 100) - (staminaMap.get(b.id) ?? 100));
    return { onPitch: on, stamina: staminaMap };
  }, [frame, byId]);

  const bench = useMemo<BenchSeat[]>(() => {
    const seats: BenchSeat[] = [];
    for (const seat of subs?.bench ?? []) {
      const player = byId.get(seat.playerId);
      if (!player) continue;
      seats.push(seat.available ? { player, available: true } : { player, available: false, reason: seat.reason });
    }
    return seats;
  }, [subs, byId]);

  const out = outId ? byId.get(outId) : undefined;
  const context = useMemo<ReplacementContext>(() => {
    const us = playerSide === 'home' ? homeScore : awayScore;
    const them = playerSide === 'home' ? awayScore : homeScore;
    return {
      scoreline: us < them ? 'TRAILING' : us > them ? 'LEADING' : 'LEVEL',
      elapsed: durationMinutes > 0 ? Math.min(1, minute / durationMinutes) : 0,
    };
  }, [playerSide, homeScore, awayScore, minute, durationMinutes]);
  const ranked = useMemo(() => (out ? rankReplacements(out, bench, context) : []), [out, bench, context]);
  const recommended = ranked.filter((r) => r.available && r.label);
  const others = ranked.filter((r) => r.available && !r.label);
  const unavailable = ranked.filter((r) => !r.available);

  // The man chosen to come off may have gone off anyway — an injury
  // replacement the engine made. The choice is then stale and is dropped.
  useEffect(() => {
    if (outId && !onPitch.some((p) => p.id === outId)) setOutId(null);
  }, [onPitch, outId]);

  const chooseOut = (id: PlayerId): void => {
    haptics.selection();
    setError(null);
    setOutId((current) => (current === id ? null : id));
  };

  const commit = (inId: PlayerId): void => {
    if (!outId || busy.current) return;
    busy.current = true;
    try {
      const verdict = onSubstitute(outId, inId);
      if (verdict.ok) {
        haptics.success();
        sfx.select();
        setOutId(null);
        setError(null);
        onClose();
      } else {
        haptics.error();
        setError(refusalMessage(verdict.reason));
      }
    } finally {
      busy.current = false;
    }
  };

  return (
    <GlassSheet
      open={open}
      onClose={onClose}
      size="tall"
      title="Substitutions"
      subtitle={
        remaining > 0
          ? `${remaining} change${remaining === 1 ? '' : 's'} left · ${out ? 'tap who comes on' : 'tap who comes off'}`
          : 'No changes left'
      }
      footer={<SheetCloseRow onClose={onClose} label="Done" />}
    >
      {error && (
        <p role="alert" className="mb-3 rounded-md bg-danger/14 px-3 py-2 text-[13px] text-danger">
          {error}
        </p>
      )}

      {out ? (
        <>
          <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-dim">Coming off</h3>
          <ul className="flex flex-col gap-1.5" data-testid="coming-off">
            <SubRow
              player={out}
              kit={kit}
              stamina={stamina.get(out.id) ?? 100}
              selected
              mode="OFF"
              note="Tap to choose someone else"
              onPress={() => chooseOut(out.id)}
            />
          </ul>

          {remaining <= 0 ? (
            <p className="mt-4 text-[13px] text-ink-dim">You have used all your changes for this match.</p>
          ) : (
            <>
              {recommended.length > 0 && (
                <>
                  <h3 className="mb-2 mt-5 text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-dim">Recommended</h3>
                  <ul className="flex flex-col gap-1.5" data-testid="recommended">
                    {recommended.map((r) => (
                      <SubRow
                        key={r.player.id}
                        player={r.player}
                        kit={kit}
                        stamina={r.player.fitness}
                        selected={false}
                        mode="ON"
                        label={r.label ? REPLACEMENT_LABEL[r.label] : undefined}
                        labelTone={r.label ? LABEL_TONE[r.label] : undefined}
                        onPress={() => commit(r.player.id)}
                      />
                    ))}
                  </ul>
                </>
              )}
              {others.length > 0 && (
                <>
                  <h3 className="mb-2 mt-5 text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-dim">
                    {recommended.length > 0 ? 'Other bench options' : 'Bench'}
                  </h3>
                  <ul className="flex flex-col gap-1.5" data-testid="other-bench">
                    {others.map((r) => (
                      <SubRow
                        key={r.player.id}
                        player={r.player}
                        kit={kit}
                        stamina={r.player.fitness}
                        selected={false}
                        mode="ON"
                        onPress={() => commit(r.player.id)}
                      />
                    ))}
                  </ul>
                </>
              )}
              {recommended.length === 0 && others.length === 0 && (
                <p className="mt-4 text-[13px] text-ink-dim">Nobody on the bench can come on.</p>
              )}
              {unavailable.length > 0 && (
                <>
                  <h3 className="mb-2 mt-5 text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-dim">Not available</h3>
                  <ul className="flex flex-col gap-1.5" data-testid="unavailable">
                    {unavailable.map((r) => (
                      <SubRow
                        key={r.player.id}
                        player={r.player}
                        kit={kit}
                        stamina={r.player.fitness}
                        selected={false}
                        mode="ON"
                        disabled
                        note={r.reason ? refusalMessage(r.reason) : undefined}
                        onPress={() => undefined}
                      />
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </>
      ) : (
        <>
          <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-dim">
            On the pitch{remaining > 0 ? ' · tap who comes off' : ''}
          </h3>
          {remaining <= 0 && (
            <p className="mb-3 text-[13px] text-ink-dim">You have used all your changes for this match.</p>
          )}
          <ul className="flex flex-col gap-1.5" data-testid="on-pitch">
            {onPitch.map((player) => (
              <SubRow
                key={player.id}
                player={player}
                kit={kit}
                stamina={stamina.get(player.id) ?? 100}
                selected={false}
                mode="OFF"
                disabled={remaining <= 0}
                onPress={() => chooseOut(player.id)}
              />
            ))}
          </ul>
        </>
      )}
    </GlassSheet>
  );
}

const SubRow = memo(function SubRow({
  player, kit, stamina, selected, mode, disabled, label, labelTone, note, onPress,
}: {
  player: Player;
  kit: KitColors;
  stamina: number;
  selected: boolean;
  mode: 'OFF' | 'ON';
  disabled?: boolean;
  /** Why he is recommended, in two words. */
  label?: string;
  labelTone?: 'positive' | 'info' | 'warning' | 'neutral';
  /** A line under the name: why he cannot come on, or what tapping does. */
  note?: string;
  onPress: () => void;
}): ReactNode {
  const tone = stamina < 35 ? 'danger' : stamina < 62 ? 'warning' : 'positive';
  return (
    <li>
      <button
        type="button"
        onClick={onPress}
        disabled={disabled}
        aria-pressed={selected}
        aria-label={`${player.displayName}, ${player.position}${label ? `, ${label}` : ''}${note ? `. ${note}` : ''}`}
        className={cn(
          'flex min-h-14 w-full items-center gap-3 rounded-md border px-3 py-2 text-left',
          'transition-colors duration-[var(--duration-fast)]',
          selected
            ? 'border-volt/60 bg-volt/12'
            : 'border-white/[0.07] bg-white/[0.04] hover:bg-white/[0.08]',
          disabled && 'pointer-events-none opacity-40',
          'outline-none focus-visible:ring-2 focus-visible:ring-volt focus-visible:ring-offset-2 focus-visible:ring-offset-base',
        )}
      >
        <PlayerPortrait seed={player.portraitSeed} size={36} colors={kit} shape="squircle" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[15px] font-semibold leading-tight text-ink text-pretty">
              {player.displayName}
            </span>
            <PositionChip position={player.position} size="xs" />
            {label && labelTone && <GlassPill tone={labelTone} size="xs" filled>{label}</GlassPill>}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <ProgressBar value={stamina} max={100} tone={tone} size="xs" className="w-24" />
            <span className="tnum text-[11px] text-ink-dim">{Math.round(stamina)}%</span>
          </div>
          {note && <p className="mt-1 text-[12px] text-ink-dim text-pretty">{note}</p>}
        </div>
        <RatingBadge value={player.overall} scale="overall" size="sm" />
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-dim">
          {mode === 'OFF' ? 'Off' : 'On'}
        </span>
      </button>
    </li>
  );
});

/* --- tactical adjustments --------------------------------------------- */

interface TacticRow<T extends string> {
  readonly key: keyof TacticSetup;
  readonly label: string;
  readonly hint: string;
  readonly options: readonly { readonly value: T; readonly label: string }[];
}

const TEMPO_ROW: TacticRow<Tempo> = {
  key: 'tempo',
  label: 'Tempo',
  hint: 'Faster ball movement creates more, and gives it away more.',
  options: [
    { value: 'PATIENT', label: 'Patient' },
    { value: 'BALANCED', label: 'Balanced' },
    { value: 'QUICK', label: 'Quick' },
    { value: 'FRANTIC', label: 'Frantic' },
  ],
};

const PRESS_ROW: TacticRow<PressIntensity> = {
  key: 'press',
  label: 'Press',
  hint: 'A high press wins the ball higher and burns legs you will want later.',
  options: [
    { value: 'LOW_BLOCK', label: 'Low' },
    { value: 'MID_BLOCK', label: 'Mid' },
    { value: 'BALANCED', label: 'Even' },
    { value: 'HIGH_PRESS', label: 'High' },
  ],
};

const LINE_ROW: TacticRow<DefensiveLine> = {
  key: 'line',
  label: 'Defensive line',
  hint: 'A high line squeezes the pitch and leaves space in behind.',
  options: [
    { value: 'DEEP', label: 'Deep' },
    { value: 'NORMAL', label: 'Normal' },
    { value: 'HIGH', label: 'High' },
  ],
};

const WIDTH_ROW: TacticRow<Width> = {
  key: 'width',
  label: 'Width',
  hint: 'Wide stretches them; narrow crowds the middle and concedes the flanks.',
  options: [
    { value: 'NARROW', label: 'Narrow' },
    { value: 'BALANCED', label: 'Balanced' },
    { value: 'WIDE', label: 'Wide' },
  ],
};

const RISK_ROW: TacticRow<RiskLevel> = {
  key: 'risk',
  label: 'Risk',
  hint: 'Reckless swings the match — in both directions.',
  options: [
    { value: 'CAUTIOUS', label: 'Cautious' },
    { value: 'MEASURED', label: 'Measured' },
    { value: 'BOLD', label: 'Bold' },
    { value: 'RECKLESS', label: 'Reckless' },
  ],
};

const COUNTER_ROW: TacticRow<CounterStyle> = {
  key: 'counter',
  label: 'Counter attack',
  hint: 'Always countering means committing bodies forward every turnover.',
  options: [
    { value: 'NEVER', label: 'Never' },
    { value: 'WHEN_ON', label: 'When on' },
    { value: 'ALWAYS', label: 'Always' },
  ],
};

export interface TacticsSheetProps {
  open: boolean;
  onClose: () => void;
  tactics: TacticSetup;
  formationName: string;
  onChange: (change: Partial<TacticSetup>) => void;
}

export function TacticsSheet({
  open, onClose, tactics, formationName, onChange,
}: TacticsSheetProps): ReactNode {
  return (
    <GlassSheet
      open={open}
      onClose={onClose}
      size="tall"
      title="Tactical adjustment"
      subtitle={`${formationName} · changes take effect on the next passage of play`}
      footer={<SheetCloseRow onClose={onClose} label="Done" />}
    >
      <div className="flex flex-col gap-5">
        <TacticControl row={TEMPO_ROW} value={tactics.tempo} onChange={onChange} />
        <TacticControl row={PRESS_ROW} value={tactics.press} onChange={onChange} />
        <TacticControl row={LINE_ROW} value={tactics.line} onChange={onChange} />
        <TacticControl row={WIDTH_ROW} value={tactics.width} onChange={onChange} />
        <TacticControl row={RISK_ROW} value={tactics.risk} onChange={onChange} />
        <TacticControl row={COUNTER_ROW} value={tactics.counter} onChange={onChange} />
      </div>
    </GlassSheet>
  );
}

function TacticControl<T extends string>({
  row, value, onChange,
}: {
  row: TacticRow<T>;
  value: T;
  onChange: (change: Partial<TacticSetup>) => void;
}): ReactNode {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <h3 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-ink-muted">{row.label}</h3>
      </div>
      <GlassSegmented
        size="sm"
        level={1}
        nested
        aria-label={row.label}
        value={value}
        options={row.options}
        onChange={(next) => onChange({ [row.key]: next } as Partial<TacticSetup>)}
      />
      <p className="mt-1.5 text-[12px] leading-snug text-ink-dim text-pretty">{row.hint}</p>
    </div>
  );
}

/* --- rule cards -------------------------------------------------------- */

export interface RuleCardSheetProps {
  open: boolean;
  onClose: () => void;
  cards: readonly { readonly definition: SpecialRuleDefinition; readonly quantity: number }[];
  onPlay: (ruleId: SpecialRuleId) => boolean;
}

export function RuleCardSheet({ open, onClose, cards, onPlay }: RuleCardSheetProps): ReactNode {
  const [error, setError] = useState<string | null>(null);

  const play = (id: SpecialRuleId): void => {
    if (onPlay(id)) {
      haptics.success();
      sfx.select();
      setError(null);
      onClose();
    } else {
      haptics.error();
      setError('That card cannot be played right now — it has a window it must fall inside.');
    }
  };

  return (
    <GlassSheet
      open={open}
      onClose={onClose}
      size="auto"
      title="Rule cards"
      subtitle="One card, one window. Every one of them can be played against."
      footer={<SheetCloseRow onClose={onClose} label="Keep them" />}
    >
      {error && (
        <p role="alert" className="mb-3 rounded-md bg-danger/14 px-3 py-2 text-[13px] text-danger">
          {error}
        </p>
      )}
      <ul className="flex flex-col gap-2.5">
        {cards.map(({ definition, quantity }) => (
          <li
            key={definition.id}
            className="raised raised-edge relative overflow-hidden rounded-lg border border-white/[0.07] bg-white/[0.04] p-3.5"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-[16px] font-bold tracking-[-0.01em] text-ink">{definition.name}</h3>
                <p className="mt-0.5 text-[13px] leading-snug text-ink-muted text-pretty">
                  {definition.description}
                </p>
              </div>
              <GlassPill tone={SPECIAL_RULE_TONE[definition.id]} size="sm">
                ×{quantity}
              </GlassPill>
            </div>
            <p className="mt-2 text-[12px] leading-snug text-warning text-pretty">
              Counterplay: {definition.counterplay}
            </p>
            <GlassButton
              variant="secondary"
              size="sm"
              block
              className="mt-3"
              onClick={() => play(definition.id)}
            >
              Play {definition.name}
            </GlassButton>
          </li>
        ))}
        {cards.length === 0 && (
          <li className="py-4 text-center text-[13px] text-ink-dim">You are not holding any rule cards.</li>
        )}
      </ul>
    </GlassSheet>
  );
}

/* --- speed ------------------------------------------------------------- */

export interface SpeedSheetProps {
  open: boolean;
  onClose: () => void;
  speed: MatchSpeed;
  onChange: (speed: MatchSpeed) => void;
  onSkipToEnd: () => void;
  canSkip: boolean;
}

const SPEEDS: readonly MatchSpeed[] = ['SLOW', 'NORMAL', 'FAST', 'INSTANT'];

/**
 * Speed, as four sentences rather than four cramped segments.
 *
 * A segmented control had to fit "Instant" into roughly forty points beside a
 * play button, and it did not: the word overflowed its own pill. The deeper
 * problem was that "Fast" and "Instant" mean nothing until you have used them,
 * so the control was illegible for exactly the player who most needed it. Given
 * a full sheet, each option can say what it does — and the one destructive
 * option, jumping to the final whistle, can sit apart from the four that only
 * change the pace and warn that it ends the match.
 */
export function SpeedSheet({
  open, onClose, speed, onChange, onSkipToEnd, canSkip,
}: SpeedSheetProps): ReactNode {
  return (
    <GlassSheet
      open={open}
      onClose={onClose}
      size="auto"
      title="Match speed"
      subtitle="Big moments always slow down by themselves, whatever you pick."
      footer={<SheetCloseRow onClose={onClose} label="Done" />}
    >
      <ul className="flex flex-col gap-2">
        {SPEEDS.map((option) => {
          const selected = option === speed;
          return (
            <li key={option}>
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  haptics.selection();
                  onChange(option);
                  onClose();
                }}
                className={cn(
                  'flex min-h-14 w-full items-center gap-3 rounded-lg border p-3 text-left',
                  'transition-colors duration-[var(--duration-fast)]',
                  'outline-none focus-visible:ring-2 focus-visible:ring-volt focus-visible:ring-offset-2 focus-visible:ring-offset-base',
                  selected
                    ? 'border-volt/50 bg-volt/12'
                    : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.08]',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex size-6 shrink-0 items-center justify-center rounded-pill border',
                    selected ? 'border-volt bg-volt text-volt-ink' : 'border-white/25 text-transparent',
                  )}
                >
                  <IconCheck size={14} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-bold text-ink">{SPEED_LABEL[option]}</span>
                  <span className="mt-0.5 block text-[13px] leading-snug text-ink-muted text-pretty">
                    {SPEED_HINT[option]}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 border-t border-white/[0.07] pt-4">
        <GlassButton
          variant="ghost"
          size="md"
          block
          icon={<IconFastForward />}
          disabled={!canSkip}
          onClick={() => { onSkipToEnd(); onClose(); }}
        >
          Jump to the final whistle
        </GlassButton>
        <p className="mt-1.5 text-center text-[12px] text-ink-dim text-pretty">
          The rest of the match is played out at once. You will not be asked anything else.
        </p>
      </div>
    </GlassSheet>
  );
}
