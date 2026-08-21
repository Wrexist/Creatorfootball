import { memo, useMemo, useState, type ReactNode } from 'react';
import type {
  DefensiveLine, Player, PlayerId, PressIntensity, RiskLevel, SpecialRuleDefinition,
  SpecialRuleId, TacticSetup, Tempo, Width, CounterStyle,
} from '@cf/engine';
import {
  GlassButton, GlassPill, GlassSegmented, GlassSheet, IconCheck, IconFastForward, PlayerPortrait,
  PositionChip, ProgressBar, RatingBadge, SheetCloseRow, cn, haptics,
} from '@/design';
import { useMatchStore, type MatchSpeed } from '@/state/matchStore';
import type { KitColors } from '../shared/kit';
import { SPECIAL_RULE_TONE, SPEED_HINT, SPEED_LABEL } from '../shared/format';

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
  subsRemaining: number;
  onSubstitute: (out: PlayerId, in_: PlayerId) => boolean;
}

export function SubstitutionSheet({
  open, onClose, squad, kit, subsRemaining, onSubstitute,
}: SubstitutionSheetProps): ReactNode {
  const frame = useMatchStore((s) => s.frame);
  const [outId, setOutId] = useState<PlayerId | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { onPitch, bench, stamina } = useMemo(() => {
    const byId = new Map(squad.map((p) => [p.id as string, p]));
    const staminaMap = new Map<string, number>();
    const pitchIds = new Set<string>();
    for (const p of frame?.players ?? []) {
      staminaMap.set(p.playerId, p.stamina);
      pitchIds.add(p.playerId);
    }
    const on: Player[] = [];
    for (const id of pitchIds) {
      const player = byId.get(id);
      if (player) on.push(player);
    }
    on.sort((a, b) => (staminaMap.get(a.id) ?? 100) - (staminaMap.get(b.id) ?? 100));
    return {
      onPitch: on,
      bench: squad.filter((p) => !pitchIds.has(p.id) && p.injury === null).sort((a, b) => b.overall - a.overall),
      stamina: staminaMap,
    };
  }, [frame, squad]);

  const commit = (inId: PlayerId): void => {
    if (!outId) return;
    const ok = onSubstitute(outId, inId);
    if (ok) {
      haptics.success();
      setOutId(null);
      setError(null);
      onClose();
    } else {
      haptics.error();
      setError('That change is not allowed — check your remaining substitutions.');
    }
  };

  return (
    <GlassSheet
      open={open}
      onClose={onClose}
      size="tall"
      title="Substitutions"
      subtitle={
        subsRemaining > 0
          ? `${subsRemaining} change${subsRemaining === 1 ? '' : 's'} left · tap who comes off, then who comes on`
          : 'No changes left'
      }
      footer={<SheetCloseRow onClose={onClose} label="Done" />}
    >
      {error && (
        <p role="alert" className="mb-3 rounded-md bg-danger/14 px-3 py-2 text-[13px] text-danger">
          {error}
        </p>
      )}

      <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-dim">On the pitch</h3>
      <ul className="flex flex-col gap-1.5">
        {onPitch.map((player) => (
          <SubRow
            key={player.id}
            player={player}
            kit={kit}
            stamina={stamina.get(player.id) ?? 100}
            selected={outId === player.id}
            mode="OFF"
            onPress={() => {
              haptics.selection();
              setOutId((current) => (current === player.id ? null : player.id));
            }}
          />
        ))}
      </ul>

      <h3 className="mb-2 mt-5 text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-dim">
        Bench{outId ? ' · tap a player to bring him on' : ''}
      </h3>
      <ul className="flex flex-col gap-1.5">
        {bench.map((player) => (
          <SubRow
            key={player.id}
            player={player}
            kit={kit}
            stamina={player.fitness}
            selected={false}
            mode="ON"
            disabled={!outId || subsRemaining <= 0}
            onPress={() => commit(player.id)}
          />
        ))}
        {bench.length === 0 && (
          <li className="py-4 text-center text-[13px] text-ink-dim">Nobody left on the bench.</li>
        )}
      </ul>
    </GlassSheet>
  );
}

const SubRow = memo(function SubRow({
  player, kit, stamina, selected, mode, disabled, onPress,
}: {
  player: Player;
  kit: KitColors;
  stamina: number;
  selected: boolean;
  mode: 'OFF' | 'ON';
  disabled?: boolean;
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
          </div>
          <div className="mt-1 flex items-center gap-2">
            <ProgressBar value={stamina} max={100} tone={tone} size="xs" className="w-24" />
            <span className="tnum text-[11px] text-ink-dim">{Math.round(stamina)}%</span>
          </div>
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
