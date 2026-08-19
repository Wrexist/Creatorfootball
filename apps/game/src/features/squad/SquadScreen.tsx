import { memo, useCallback, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  contractFor, expiringContracts, patchClub, playerClub, squadOf, squadWageBill, wageBudgetUsage,
  POSITIONS, POSITION_GROUPS, SQUAD_ROLE_LABELS, positionGroup,
  type Contract, type GameState, type Player, type PositionGroup,
} from '@cf/engine';
import {
  Divider, EmptyState, GlassButton, GlassIcon, GlassPanel, GlassPill, GlassSegmented, GlassSheet,
  GlassToggle, KeyValueRow, PlayerCard, PlayerFormPip, ProgressBar, RatingBadge, Screen,
  SectionHeader, StatCard, StatGrid, cn, formatMoney,
  IconArrowDown, IconArrowUp, IconCheck, IconInjury, IconSort, IconSwap, IconWarning,
  type PlayerCardClub,
} from '@/design';
import { ROUTES, buildPath } from '@/app/routes';
import { useGameStore } from '@/state/gameStore';
import { ScreenStatus } from './status';

/**
 * Squad.
 *
 * A roster screen lives or dies on scanning speed, so every row carries the
 * five things a manager actually looks for — who, where, how good, how fresh,
 * how long left — and nothing else. Everything deeper is one tap away on the
 * player profile.
 *
 * Ordering is tap-to-select rather than drag-and-drop. Two reasons: a drag on a
 * forty-row scrolling list fights the scroll gesture on a phone, and a
 * tap-to-pick-up model is operable with a screen reader and a keyboard, which a
 * drag never is. The same interaction also exposes explicit move controls.
 */

type SortKey = 'order' | 'rating' | 'position' | 'age' | 'form' | 'fitness' | 'wage' | 'contract';

const SORT_LABELS: Record<SortKey, string> = {
  order: 'Squad order',
  rating: 'Rating',
  position: 'Position',
  age: 'Age',
  form: 'Form',
  fitness: 'Fitness',
  wage: 'Wage',
  contract: 'Contract length',
};

const GROUP_OPTIONS = [
  { value: 'ALL', label: 'All' },
  { value: 'GK', label: 'GK' },
  { value: 'DEF', label: 'DEF' },
  { value: 'MID', label: 'MID' },
  { value: 'ATT', label: 'ATT' },
] as const;
type GroupFilter = (typeof GROUP_OPTIONS)[number]['value'];

const POSITION_ORDER = new Map(POSITIONS.map((p, index) => [p, index]));

interface SquadEntry {
  readonly player: Player;
  readonly contract: Contract | undefined;
  readonly group: PositionGroup;
  readonly unavailable: boolean;
  readonly expiring: boolean;
}

const fitnessTone = (value: number): 'positive' | 'warning' | 'danger' =>
  value >= 75 ? 'positive' : value >= 45 ? 'warning' : 'danger';

const SquadRow = memo(function SquadRow({
  entry, club, selected, reordering, onOpen, onSelect, onMove,
}: {
  entry: SquadEntry;
  club: PlayerCardClub;
  selected: boolean;
  reordering: boolean;
  onOpen: (playerId: string) => void;
  onSelect: (playerId: string) => void;
  onMove: (playerId: string, delta: number) => void;
}): ReactNode {
  const { player, contract } = entry;
  return (
    <div className="flex items-center gap-1">
      <div className="min-w-0 flex-1">
        <PlayerCard
          player={player}
          club={club}
          variant="compact"
          selected={selected}
          dimmed={entry.unavailable}
          onPress={reordering ? onSelect : onOpen}
          trailing={
            <span className="flex shrink-0 items-center gap-2.5">
              <span className="hidden w-16 sm:block">
                <ProgressBar value={player.fitness} tone={fitnessTone(player.fitness)} size="xs" />
              </span>
              {contract && (
                <span
                  className={cn(
                    'tnum w-9 text-right text-[12px] font-semibold',
                    entry.expiring ? 'text-warning' : 'text-ink-dim',
                  )}
                  title={`${contract.weeksRemaining} cycles remaining`}
                >
                  {contract.weeksRemaining}w
                </span>
              )}
              <PlayerFormPip rating={player.form.rating} />
              <RatingBadge value={player.overall} size="sm" />
            </span>
          }
        />
      </div>
      {reordering && (
        <span className="flex shrink-0 flex-col gap-0.5">
          <GlassIcon
            label={`Move ${player.displayName} up`}
            icon={<IconArrowUp size={16} />}
            size="sm"
            variant="ghost"
            onClick={() => onMove(player.id, -1)}
          />
          <GlassIcon
            label={`Move ${player.displayName} down`}
            icon={<IconArrowDown size={16} />}
            size="sm"
            variant="ghost"
            onClick={() => onMove(player.id, 1)}
          />
        </span>
      )}
    </div>
  );
});

export function SquadScreen(): ReactNode {
  const phase = useGameStore((s) => s.phase);
  const error = useGameStore((s) => s.error);
  const state = useGameStore((s) => s.state);
  const navigate = useNavigate();

  if (!state) {
    return (
      <Screen title="Squad">
        <ScreenStatus phase={phase} error={error} onStart={() => navigate(ROUTES.onboarding)} />
      </Screen>
    );
  }
  return <SquadBody state={state} />;
}

function SquadBody({ state }: { state: GameState }): ReactNode {
  const navigate = useNavigate();
  const apply = useGameStore((s) => s.apply);

  const [group, setGroup] = useState<GroupFilter>('ALL');
  const [sort, setSort] = useState<SortKey>('order');
  const [availableOnly, setAvailableOnly] = useState(false);
  const [expiringOnly, setExpiringOnly] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);

  const data = useMemo(() => {
    const club = playerClub(state);
    const squad = squadOf(state, club.id);
    const expiringIds = new Set(expiringContracts(state, club.id, 6).map((p) => p.id));

    const entries: SquadEntry[] = squad.map((player) => ({
      player,
      contract: contractFor(state, player.id),
      group: positionGroup(player.position),
      unavailable: player.injury !== null || player.suspensionMatches > 0,
      expiring: expiringIds.has(player.id),
    }));

    return {
      club,
      entries,
      expiringCount: expiringIds.size,
      injured: entries.filter((e) => e.player.injury !== null).length,
      suspended: entries.filter((e) => e.player.suspensionMatches > 0).length,
      wages: squadWageBill(state, club.id),
      usage: wageBudgetUsage(state, club.id),
      averageAge: squad.length ? squad.reduce((sum, p) => sum + p.age, 0) / squad.length : 0,
      averageRating: squad.length ? squad.reduce((sum, p) => sum + p.overall, 0) / squad.length : 0,
      youth: state.clubs[club.id]?.youthSquad.length ?? 0,
    };
  }, [state]);

  const clubCard = useMemo(
    () => ({ name: data.club.name, abbreviation: data.club.abbreviation, visual: data.club.visual }),
    [data.club.name, data.club.abbreviation, data.club.visual],
  );

  const visible = useMemo(() => {
    let rows = data.entries;
    if (group !== 'ALL') rows = rows.filter((e) => e.group === group);
    if (availableOnly) rows = rows.filter((e) => !e.unavailable);
    if (expiringOnly) rows = rows.filter((e) => e.expiring);
    if (sort === 'order') return rows;

    const sorted = [...rows];
    sorted.sort((a, b) => {
      switch (sort) {
        case 'rating': return b.player.overall - a.player.overall;
        case 'age': return a.player.age - b.player.age;
        case 'form': return b.player.form.rating - a.player.form.rating;
        case 'fitness': return b.player.fitness - a.player.fitness;
        case 'wage': return (b.contract?.wage ?? 0) - (a.contract?.wage ?? 0);
        case 'contract': return (a.contract?.weeksRemaining ?? 9999) - (b.contract?.weeksRemaining ?? 9999);
        case 'position':
          return (POSITION_ORDER.get(a.player.position) ?? 99) - (POSITION_ORDER.get(b.player.position) ?? 99)
            || b.player.overall - a.player.overall;
        default: return 0;
      }
    });
    return sorted;
  }, [data.entries, group, sort, availableOnly, expiringOnly]);

  /** Squad order is stored on the club; reordering is a plain state write. */
  const reorder = useCallback((playerId: string, targetId: string) => {
    apply((current) => patchClub(current, current.playerClubId, (club) => {
      const ids = [...club.squad];
      const from = ids.indexOf(playerId as Player['id']);
      const to = ids.indexOf(targetId as Player['id']);
      if (from < 0 || to < 0 || from === to) return {};
      const [moved] = ids.splice(from, 1);
      if (!moved) return {};
      ids.splice(to, 0, moved);
      return { squad: ids };
    }));
  }, [apply]);

  const move = useCallback((playerId: string, delta: number) => {
    apply((current) => patchClub(current, current.playerClubId, (club) => {
      const ids = [...club.squad];
      const from = ids.indexOf(playerId as Player['id']);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= ids.length) return {};
      const [moved] = ids.splice(from, 1);
      if (!moved) return {};
      ids.splice(to, 0, moved);
      return { squad: ids };
    }));
  }, [apply]);

  const onSelect = useCallback((playerId: string) => {
    setPicked((current) => {
      if (current === null) return playerId;
      if (current === playerId) return null;
      reorder(current, playerId);
      return null;
    });
  }, [reorder]);

  const onOpen = useCallback((playerId: string) => {
    navigate(buildPath(ROUTES.player, { playerId }));
  }, [navigate]);

  const groupCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: data.entries.length };
    for (const key of Object.keys(POSITION_GROUPS)) {
      counts[key] = data.entries.filter((e) => e.group === key).length;
    }
    return counts;
  }, [data.entries]);

  return (
    <Screen
      title="Squad"
      subtitle={`${data.entries.length} players · ${formatMoney(data.wages)} a cycle in wages`}
      actions={
        <>
          <GlassIcon
            label={reordering ? 'Finish reordering' : 'Reorder squad'}
            icon={reordering ? <IconCheck /> : <IconSwap />}
            variant={reordering ? 'volt' : 'ghost'}
            active={reordering}
            onClick={() => {
              setReordering((v) => !v);
              setPicked(null);
              if (!reordering) setSort('order');
            }}
          />
          <GlassIcon label="Sort and filter" icon={<IconSort />} variant="ghost" onClick={() => setSortOpen(true)} />
        </>
      }
      headerAccessory={
        <GlassSegmented
          nested
          value={group}
          onChange={setGroup}
          size="sm"
          aria-label="Filter by position group"
          options={GROUP_OPTIONS.map((option) => ({
            value: option.value,
            label: `${option.label}${groupCounts[option.value] ? ` ${groupCounts[option.value]}` : ''}`,
          }))}
        />
      }
      aside={
        <>
          <GlassPanel title="Squad shape" padding="md">
            <KeyValueRow label="Average rating" value={Math.round(data.averageRating)} />
            <KeyValueRow label="Average age" value={data.averageAge.toFixed(1)} />
            <KeyValueRow label="Youth squad" value={data.youth} />
            <KeyValueRow label="Unavailable" value={data.injured + data.suspended} divided={false} hint={`${data.injured} injured, ${data.suspended} suspended`} />
          </GlassPanel>
          <GlassPanel title="Wages" padding="md">
            <ProgressBar
              value={Math.min(150, data.usage * 100)}
              max={150}
              marker={100}
              tone={data.usage > 1 ? 'danger' : data.usage > 0.9 ? 'warning' : 'positive'}
              label="Against budget"
              valueLabel={`${Math.round(data.usage * 100)}%`}
            />
          </GlassPanel>
        </>
      }
      footer={
        reordering ? (
          <div className="flex items-center gap-3">
            <p className="min-w-0 flex-1 text-[13px] text-ink-muted text-pretty">
              {picked ? 'Now tap where you want them.' : 'Tap a player to pick them up, or use the arrows.'}
            </p>
            <GlassButton variant="primary" size="sm" onClick={() => { setReordering(false); setPicked(null); }}>
              Done
            </GlassButton>
          </div>
        ) : undefined
      }
    >
      {data.expiringCount > 0 && (
        <GlassPanel padding="sm" accent="danger">
          <button
            type="button"
            onClick={() => { setExpiringOnly(true); setSort('contract'); }}
            className="flex w-full min-h-11 items-center gap-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-volt focus-visible:ring-offset-2 focus-visible:ring-offset-base"
          >
            <IconWarning size={18} className="shrink-0 text-warning" />
            <span className="min-w-0 flex-1 text-[13px] text-ink text-pretty">
              <strong className="font-semibold">{data.expiringCount} contract{data.expiringCount === 1 ? '' : 's'} running down.</strong>{' '}
              Renew now or lose them for nothing.
            </span>
          </button>
        </GlassPanel>
      )}

      <StatGrid columns={2}>
        <StatCard label="Squad" value={data.entries.length} footnote={`${data.youth} in the academy`} />
        <StatCard
          label="Unavailable"
          value={data.injured + data.suspended}
          tone={data.injured + data.suspended > 2 ? 'danger' : 'positive'}
          icon={<IconInjury size={13} />}
          footnote={`${data.injured} injured · ${data.suspended} suspended`}
        />
      </StatGrid>

      <SectionHeader
        title={group === 'ALL' ? 'Every player' : `${group} — ${groupCounts[group] ?? 0}`}
        subtitle={`Sorted by ${SORT_LABELS[sort].toLowerCase()}`}
        action={
          <GlassButton variant="ghost" size="sm" icon={<IconSort size={15} />} onClick={() => setSortOpen(true)}>
            {SORT_LABELS[sort]}
          </GlassButton>
        }
      />

      {visible.length === 0 ? (
        <EmptyState
          title="Nobody matches those filters"
          description="Loosen the filters, or head to the market if the squad really is this thin."
          action={
            <GlassButton
              variant="secondary"
              onClick={() => { setGroup('ALL'); setAvailableOnly(false); setExpiringOnly(false); }}
            >
              Clear filters
            </GlassButton>
          }
        />
      ) : (
        <GlassPanel padding="sm">
          <div className="flex flex-col">
            {visible.map((entry) => (
              <SquadRow
                key={entry.player.id}
                entry={entry}
                club={clubCard}
                selected={picked === entry.player.id}
                reordering={reordering}
                onOpen={onOpen}
                onSelect={onSelect}
                onMove={move}
              />
            ))}
          </div>
        </GlassPanel>
      )}

      <Divider />
      <div className="flex flex-wrap gap-2 pb-2">
        <GlassButton variant="secondary" size="sm" onClick={() => navigate(ROUTES.tactics)}>Tactics</GlassButton>
        <GlassButton variant="secondary" size="sm" onClick={() => navigate(ROUTES.training)}>Training</GlassButton>
        <GlassButton variant="ghost" size="sm" onClick={() => navigate(ROUTES.market)}>Market</GlassButton>
      </div>

      <GlassSheet
        open={sortOpen}
        onClose={() => setSortOpen(false)}
        title="Sort and filter"
        subtitle="How you want to read the squad"
      >
        <div className="flex flex-col gap-1">
          {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => { setSort(key); setSortOpen(false); }}
              className={cn(
                'flex min-h-11 items-center justify-between rounded-md px-3 text-left text-[15px]',
                'outline-none focus-visible:ring-2 focus-visible:ring-volt focus-visible:ring-offset-2 focus-visible:ring-offset-base',
                sort === key ? 'bg-volt/12 text-volt' : 'text-ink hover:bg-white/[0.05]',
              )}
            >
              {SORT_LABELS[key]}
              {sort === key && <IconCheck size={18} />}
            </button>
          ))}
        </div>
        <Divider className="my-3" />
        <GlassToggle
          asRow
          checked={availableOnly}
          onChange={setAvailableOnly}
          label="Available only"
          description="Hide injured and suspended players"
        />
        <GlassToggle
          asRow
          checked={expiringOnly}
          onChange={setExpiringOnly}
          label="Expiring contracts only"
          description="Six cycles or fewer remaining"
        />
        <div className="mt-3 flex flex-wrap gap-1.5">
          {(['STAR', 'STARTER', 'ROTATION', 'SQUAD', 'PROSPECT'] as const).map((role) => (
            <GlassPill key={role} size="sm">
              {SQUAD_ROLE_LABELS[role]} {data.entries.filter((e) => e.contract?.role === role).length}
            </GlassPill>
          ))}
        </div>
      </GlassSheet>
    </Screen>
  );
}
