import { memo, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  facilityLevel, isProjectKey, nextUpgrade, pendingProjects, playerClub, setClub, totalUpkeep,
  upgradeFacility,
  type Club, type FacilityDef, type GameState, type UpgradeOutcome,
} from '@cf/engine';
import {
  Accordion, Divider, GlassButton, GlassPanel, GlassPill, GlassSegmented, GlassSheet, KeyValueRow,
  ProgressBar, Screen, SectionHeader, StatCard, StatGrid, cn, formatMoney,
  IconCheck, IconClock, IconStadium, IconWarning,
} from '@/design';
import { ROUTES } from '@/app/routes';
import { useGameStore } from '@/state/gameStore';
import { ScreenStatus } from './status';
import { facilityDefs, ledgerOf, postContextOf } from './bridge';

/**
 * Facilities.
 *
 * Buying a building is the slowest decision in the game: the money leaves now
 * and the benefit arrives in cycles. So this screen refuses to sell an upgrade
 * on a number alone — every row states what the level you own does *today*,
 * what the next one changes, what it costs to run, and how long you will wait.
 *
 * A completed upgrade is deliberately *not* a hero moment. Hero moments are
 * rationed to nine events and a new gym is not one of them; it gets a line of
 * confirmation and a build timer, which is exactly what it is worth.
 */

const CATEGORIES = [
  { value: 'ALL', label: 'All' },
  { value: 'PERFORMANCE', label: 'Match' },
  { value: 'DEVELOPMENT', label: 'Develop' },
  { value: 'COMMERCIAL', label: 'Money' },
  { value: 'FAN', label: 'Fans' },
] as const;
type CategoryFilter = (typeof CATEGORIES)[number]['value'];

/** Machine-readable effect keys, translated into what the player actually feels. */
const EFFECT_LABELS: Record<string, string> = {
  trainingGain: 'Training gains',
  injuryRecovery: 'Injury recovery',
  injuryResistance: 'Injury resistance',
  youthQuality: 'Academy quality',
  scoutSpeed: 'Scouting speed',
  scoutAccuracy: 'Scout accuracy',
  tacticalInsight: 'Tactical insight',
  mediaDamping: 'Media damping',
  creatorReach: 'Creator reach',
  merchMultiplier: 'Merchandise',
  matchdayRevenue: 'Matchday revenue',
  fanSentimentGain: 'Fan sentiment',
  stadiumCapacity: 'Stadium capacity',
  atmosphere: 'Atmosphere',
};

const formatEffect = (key: string, value: number): string => {
  if (key === 'stadiumCapacity') return `+${Math.round(value).toLocaleString('en-GB')} seats`;
  if (Math.abs(value) < 3) return `${value >= 0 ? '+' : ''}${Math.round(value * 100)}%`;
  return `${value >= 0 ? '+' : ''}${Math.round(value)}`;
};

function LevelPips({ level, max }: { level: number; max: number }): ReactNode {
  return (
    <span className="inline-flex items-center gap-1" role="img" aria-label={`Level ${level} of ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={cn(
            'h-1.5 w-4 rounded-pill',
            i < level ? 'bg-volt' : 'bg-white/[0.12]',
          )}
        />
      ))}
    </span>
  );
}

interface FacilityRow {
  readonly def: FacilityDef;
  readonly level: number;
  readonly next: { level: number; cost: number; cycles: number; effect: string } | null;
  readonly building: { targetLevel: number; cyclesRemaining: number } | null;
  readonly affordable: boolean;
  readonly currentEffect: string;
}

const FacilityCard = memo(function FacilityCard({
  row, onUpgrade,
}: {
  row: FacilityRow;
  onUpgrade: (def: FacilityDef) => void;
}): ReactNode {
  const { def, level, next, building } = row;
  const effectKeys = Object.keys(def.effects);

  return (
    <GlassPanel padding="md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[16px] font-semibold text-ink">{def.name}</h3>
            {building && <GlassPill tone="info" size="xs" icon={<IconClock />}>Building</GlassPill>}
            {!next && !building && <GlassPill tone="volt" size="xs" icon={<IconCheck />}>Maxed</GlassPill>}
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-ink-muted text-pretty">{def.description}</p>
        </div>
        <span className="tnum shrink-0 font-display text-[26px] font-bold leading-none tracking-[-0.04em] text-ink">
          {level}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <LevelPips level={level} max={def.maxLevel} />
        <span className="text-[11px] uppercase tracking-[0.12em] text-ink-dim">{def.category.toLowerCase()}</span>
      </div>

      <p className="mt-3 text-[13px] leading-relaxed text-ink text-pretty">
        {level > 0 ? row.currentEffect : 'Not built. You get nothing from this yet.'}
      </p>

      {building ? (
        <div className="mt-3 rounded-md bg-info/10 p-3">
          <p className="text-[13px] font-semibold text-info">
            Level {building.targetLevel} arrives in {building.cyclesRemaining} cycle{building.cyclesRemaining === 1 ? '' : 's'}
          </p>
          <p className="mt-1 text-[12px] text-ink-muted">
            The money has already left. Nothing changes until the work finishes.
          </p>
        </div>
      ) : next ? (
        <div className="mt-3 rounded-md border border-white/[0.07] p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-dim">
            Level {next.level} would mean
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-ink text-pretty">{next.effect}</p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <GlassPill tone={row.affordable ? 'neutral' : 'danger'} size="sm">{formatMoney(next.cost)}</GlassPill>
            <GlassPill size="sm" icon={<IconClock />}>{next.cycles === 0 ? 'Immediate' : `${next.cycles} cycles`}</GlassPill>
            <GlassPill size="sm">{formatMoney(def.upkeepPerCycle[next.level] ?? 0)}/cycle upkeep</GlassPill>
          </div>
          <div className="mt-3">
            <GlassButton
              variant={row.affordable ? 'secondary' : 'ghost'}
              size="sm"
              disabled={!row.affordable}
              onClick={() => onUpgrade(def)}
            >
              {row.affordable ? `Commission level ${next.level}` : 'Cannot afford this'}
            </GlassButton>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-[12px] text-volt">Fully developed. Nothing more to buy here.</p>
      )}

      {effectKeys.length > 0 && (
        <div className="mt-1">
          <Accordion title="What it feeds" subtitle={effectKeys.map((k) => EFFECT_LABELS[k] ?? k).join(' · ')}>
            <div className="flex flex-col gap-2">
              {effectKeys.map((key) => {
                const table = def.effects[key] ?? [];
                const now = table[Math.min(level, table.length - 1)] ?? 0;
                const then = next ? table[Math.min(next.level, table.length - 1)] ?? now : now;
                return (
                  <KeyValueRow
                    key={key}
                    label={EFFECT_LABELS[key] ?? key}
                    value={
                      <span className="tnum">
                        {formatEffect(key, now)}
                        {next && then !== now && (
                          <span className="ml-1.5 text-volt">→ {formatEffect(key, then)}</span>
                        )}
                      </span>
                    }
                  />
                );
              })}
              <Divider label="Level ladder" className="my-1" />
              <ol className="flex flex-col gap-1.5">
                {def.levelEffects.map((text, index) => (
                  <li
                    key={index}
                    className={cn(
                      'flex gap-2 text-[12px] leading-relaxed text-pretty',
                      index + 1 <= level ? 'text-ink' : 'text-ink-dim',
                    )}
                  >
                    <span className="tnum shrink-0 font-semibold">{index + 1}</span>
                    <span>{text}</span>
                  </li>
                ))}
              </ol>
            </div>
          </Accordion>
        </div>
      )}
    </GlassPanel>
  );
});

export function FacilitiesScreen(): ReactNode {
  const phase = useGameStore((s) => s.phase);
  const error = useGameStore((s) => s.error);
  const state = useGameStore((s) => s.state);
  const navigate = useNavigate();

  if (!state) {
    return (
      <Screen title="Facilities" onBack={() => navigate(ROUTES.club)}>
        <ScreenStatus phase={phase} error={error} onStart={() => navigate(ROUTES.onboarding)} />
      </Screen>
    );
  }
  return <FacilitiesBody state={state} />;
}

function FacilitiesBody({ state }: { state: GameState }): ReactNode {
  const navigate = useNavigate();
  const apply = useGameStore((s) => s.apply);
  const [category, setCategory] = useState<CategoryFilter>('ALL');
  const [pending, setPending] = useState<FacilityDef | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const data = useMemo(() => {
    const club: Club = playerClub(state);
    const defs = facilityDefs();
    const registry = { facilities: () => defs };
    const balance = ledgerOf(state).cashOf(club.id);
    const projects = pendingProjects(club);

    const rows: FacilityRow[] = defs.map((def) => {
      const level = facilityLevel(club, def.id);
      const next = nextUpgrade(club, def.id, registry);
      const project = projects.find((p) => p.facilityId === def.id);
      return {
        def,
        level,
        next,
        building: project ? { targetLevel: project.targetLevel, cyclesRemaining: project.cyclesRemaining } : null,
        affordable: next ? balance >= next.cost : false,
        currentEffect: def.levelEffects[level - 1] ?? def.description,
      };
    });

    // The reserved project keys live in the same record as the levels; anything
    // that counts or lists levels has to skip them explicitly.
    const built = Object.entries(club.facilityLevels)
      .filter(([key]) => !isProjectKey(key))
      .reduce((sum, [, value]) => sum + Math.max(0, value), 0);

    return {
      club,
      rows,
      projects,
      balance,
      built,
      maxLevels: defs.reduce((sum, def) => sum + def.maxLevel, 0),
      upkeep: totalUpkeep(club, registry),
    };
  }, [state]);

  const visible = category === 'ALL' ? data.rows : data.rows.filter((r) => r.def.category === category);

  const commission = (def: FacilityDef, rush: boolean): void => {
    let outcome: UpgradeOutcome | null = null;
    apply((current) => {
      const club = playerClub(current);
      const ledger = ledgerOf(current);
      outcome = upgradeFacility(
        club,
        def.id,
        { facilities: () => facilityDefs() },
        ledger,
        postContextOf(current),
        { rush },
      );
      if (!outcome.ok || !outcome.club) return current;
      return { ...setClub(current, outcome.club), ledger: ledger.snapshot() };
    });
    const result = outcome as UpgradeOutcome | null;
    setFeedback(result ? { ok: result.ok, text: result.reason } : null);
    setPending(null);
  };

  const pendingNext = pending ? nextUpgrade(data.club, pending.id, { facilities: () => facilityDefs() }) : null;

  return (
    <Screen
      title="Facilities"
      subtitle={`${data.built} of ${data.maxLevels} levels built`}
      onBack={() => navigate(ROUTES.club)}
      headerAccessory={
        <GlassSegmented
          nested
          options={CATEGORIES}
          value={category}
          onChange={setCategory}
          size="sm"
          aria-label="Filter facilities by category"
        />
      }
      aside={
        <GlassPanel title="Running costs" padding="md">
          <KeyValueRow label="Upkeep" value={`${formatMoney(data.upkeep)}/cycle`} hint="Paid whether you use them or not" />
          <KeyValueRow label="Cash" value={formatMoney(data.balance)} />
          <KeyValueRow label="In progress" value={data.projects.length} divided={false} hint="Two builds at once is the limit" />
        </GlassPanel>
      }
    >
      {feedback && (
        <GlassPanel padding="sm" accent={feedback.ok ? 'volt' : 'danger'}>
          <div className="flex items-center gap-2.5">
            {feedback.ok
              ? <IconCheck size={18} className="shrink-0 text-volt" />
              : <IconWarning size={18} className="shrink-0 text-danger" />}
            <p className="text-[13px] text-ink text-pretty">{feedback.text}</p>
          </div>
        </GlassPanel>
      )}

      <StatGrid columns={2}>
        <StatCard label="Cash" value={<span>{formatMoney(data.balance)}</span>} footnote="Available to spend now" />
        <StatCard label="Upkeep" value={<span>{formatMoney(data.upkeep)}</span>} tone="warning" footnote="Every cycle, forever" />
      </StatGrid>

      {data.projects.length > 0 && (
        <>
          <SectionHeader title="Under construction" />
          <GlassPanel padding="md">
            {data.projects.map((project, index) => {
              const def = data.rows.find((r) => r.def.id === project.facilityId)?.def;
              const total = Math.max(1, def?.upgradeCycles[project.targetLevel - 1] ?? project.cyclesRemaining);
              return (
                <div key={project.facilityId} className={index > 0 ? 'mt-3' : ''}>
                  <ProgressBar
                    label={`${def?.name ?? project.facilityId} → level ${project.targetLevel}`}
                    value={Math.max(0, total - project.cyclesRemaining)}
                    max={total}
                    tone="info"
                    valueLabel={`${project.cyclesRemaining} left`}
                  />
                </div>
              );
            })}
          </GlassPanel>
        </>
      )}

      <SectionHeader
        title={category === 'ALL' ? 'Every facility' : CATEGORIES.find((c) => c.value === category)?.label ?? ''}
        subtitle="What you own, what the next level buys, and what it costs to keep"
      />

      {visible.length === 0 ? (
        <GlassPanel padding="lg">
          <p className="text-center text-[13px] text-ink-muted">No facilities in this category.</p>
        </GlassPanel>
      ) : (
        visible.map((row) => (
          <FacilityCard key={row.def.id} row={row} onUpgrade={setPending} />
        ))
      )}

      <GlassSheet
        open={pending !== null}
        onClose={() => setPending(null)}
        title={pending ? `Upgrade ${pending.name}?` : ''}
        subtitle={pendingNext ? `Level ${pendingNext.level} · ${formatMoney(pendingNext.cost)}` : undefined}
        footer={
          pending && pendingNext ? (
            <div className="flex flex-col gap-2">
              <GlassButton variant="primary" block onClick={() => commission(pending, false)}>
                Commission the work
              </GlassButton>
              <GlassButton variant="ghost" block onClick={() => setPending(null)}>Not now</GlassButton>
            </div>
          ) : undefined
        }
      >
        {pending && pendingNext && (
          <div className="flex flex-col gap-3">
            <p className="text-[14px] leading-relaxed text-ink text-pretty">{pendingNext.effect}</p>
            <GlassPanel nested level={1} padding="sm">
              <KeyValueRow label="Cost now" value={formatMoney(pendingNext.cost)} emphasis />
              <KeyValueRow label="Ready in" value={pendingNext.cycles === 0 ? 'Immediately' : `${pendingNext.cycles} cycles`} />
              <KeyValueRow label="Upkeep after" value={`${formatMoney(pending.upkeepPerCycle[pendingNext.level] ?? 0)}/cycle`} />
              <KeyValueRow label="Cash left" value={formatMoney(data.balance - pendingNext.cost)} divided={false} />
            </GlassPanel>
            <p className="text-[12px] leading-relaxed text-ink-muted text-pretty">
              The cost leaves your account immediately and the benefit only arrives when the build completes. Leave upkeep
              unpaid and a facility can lose a level.
            </p>
          </div>
        )}
      </GlassSheet>

      <div className="pb-2">
        <GlassButton variant="ghost" size="sm" icon={<IconStadium size={16} />} onClick={() => navigate(ROUTES.finances)}>
          See what this is doing to the books
        </GlassButton>
      </div>
    </Screen>
  );
}
