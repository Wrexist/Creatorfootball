import { memo, useCallback, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  contractFor, expiringContracts, patchClub, playerClub, squadOf, squadWageBill, starPlayer,
  wageBudgetUsage, POSITIONS, SQUAD_ROLE_LABELS, TRAIT_BY_ID, positionGroup,
  type Contract, type GameState, type Player, type PositionGroup, type SquadRole,
  type TraitDefinition,
} from '@cf/engine';
import {
  Divider, EmptyState, GlassButton, GlassIcon, GlassPanel, GlassPill, GlassSegmented, GlassSheet,
  GlassToggle, HeroSurface, ListRow, NameText, PlayerPortrait, PositionChip,
  RatingBadge, Screen, StatBlock, Text, TraitChip, cn, formatMoney,
  IconArrowDown, IconArrowUp, IconCheck, IconFlame, IconInjury, IconCard, IconSort, IconSwap,
  IconWarning,
} from '@/design';
import { ROUTES, buildPath } from '@/app/routes';
import { useGameStore } from '@/state/gameStore';
import { ScreenStatus } from './status';
import { PlayerSheet } from './PlayerSheet';

/**
 * Squad.
 *
 * The brief for this screen was that it had stopped being a football squad and
 * become a database: forty identical rows, each carrying a name, a number and
 * two more numbers, none of which told you who the player *was*.
 *
 * So every row now carries identity rather than fields. The face, the shirt
 * number worn on the portrait, the position, the age, the squad role you
 * promised him, one trait that makes him different, how fit he is and how long
 * his deal has left — and the rows are visibly not the same as each other: your
 * star wears a volt rule, a player in the treatment room is dimmed and marked,
 * a contract running down is amber, a player in form carries a flame. Scanning
 * the list should feel like looking at a dressing room, not a spreadsheet.
 *
 * Tapping a row opens the player sheet over the list rather than navigating
 * away, so checking three players in a row costs three taps and no page loads.
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
  { value: 'DEF', label: 'Def' },
  { value: 'MID', label: 'Mid' },
  { value: 'ATT', label: 'Att' },
] as const;
type GroupFilter = (typeof GROUP_OPTIONS)[number]['value'];

const GROUP_TITLES: Record<PositionGroup, string> = {
  GK: 'Goalkeepers',
  DEF: 'Defenders',
  MID: 'Midfielders',
  ATT: 'Forwards',
};

const GROUP_ORDER: readonly PositionGroup[] = ['GK', 'DEF', 'MID', 'ATT'];
const POSITION_ORDER = new Map(POSITIONS.map((p, index) => [p, index]));

/** The left rule. It is the fastest read on the row: who matters, who is a problem. */
const ROLE_RULE: Record<SquadRole, string> = {
  STAR: 'border-l-volt',
  STARTER: 'border-l-volt/45',
  ROTATION: 'border-l-info/40',
  SQUAD: 'border-l-white/12',
  PROSPECT: 'border-l-special/45',
};

interface SquadEntry {
  readonly player: Player;
  readonly contract: Contract | undefined;
  readonly group: PositionGroup;
  readonly unavailable: boolean;
  readonly expiring: boolean;
  readonly trait: TraitDefinition | undefined;
}

const fitnessTone = (value: number): 'positive' | 'warning' | 'danger' =>
  (value >= 75 ? 'positive' : value >= 45 ? 'warning' : 'danger');

const FITNESS_FILL = {
  positive: 'bg-positive', warning: 'bg-warning', danger: 'bg-danger',
} as const;

/* --- the row ----------------------------------------------------------- */

const SquadRow = memo(function SquadRow({
  entry, primary, secondary, selected, reordering, divided, onOpen, onSelect, onMove,
}: {
  entry: SquadEntry;
  primary: string;
  secondary: string;
  selected: boolean;
  reordering: boolean;
  divided: boolean;
  onOpen: (playerId: Player['id']) => void;
  onSelect: (playerId: Player['id']) => void;
  onMove: (playerId: Player['id'], delta: number) => void;
}): ReactNode {
  const { player, contract } = entry;
  const role = contract?.role ?? 'SQUAD';
  const hot = player.form.rating >= 0.45;
  const cold = player.form.rating <= -0.45;

  const rule = entry.unavailable
    ? 'border-l-danger/70'
    : entry.expiring
      ? 'border-l-warning/70'
      : ROLE_RULE[role];

  return (
    <div className="flex items-center gap-1">
      <ListRow
        className={cn('min-w-0 flex-1 border-l-2 pl-2.5', rule)}
        divided={divided}
        density="relaxed"
        selected={selected}
        dimmed={entry.unavailable}
        onPress={() => (reordering ? onSelect(player.id) : onOpen(player.id))}
        leading={
          <span className="relative">
            <PlayerPortrait
              seed={player.portraitSeed}
              size={46}
              shape="squircle"
              colors={{ primary, secondary }}
            />
            {player.shirtNumber !== null && (
              <span
                className="absolute -bottom-1 -right-1 flex min-w-5 items-center justify-center rounded-pill bg-base px-1 num-broadcast text-[10px] font-bold text-ink-muted ring-1 ring-white/10"
                aria-hidden="true"
              >
                {player.shirtNumber}
              </span>
            )}
          </span>
        }
        title={
          <span className="flex items-center gap-1.5">
            <NameText
              name={player.displayName}
              short={`${player.firstName.charAt(0)}. ${player.lastName}`}
              role="bodyStrong"
              className="min-w-0 flex-1"
            />
            {player.injury && (
              <span className="inline-flex shrink-0 items-center gap-0.5 rounded-pill bg-danger/85 px-1.5 py-0.5 text-[10px] font-bold text-ink">
                <IconInjury size={11} />
                {player.injury.weeksRemaining}w
              </span>
            )}
            {!player.injury && player.suspensionMatches > 0 && (
              <span className="inline-flex shrink-0 items-center gap-0.5 rounded-pill bg-warning/85 px-1.5 py-0.5 text-[10px] font-bold text-void">
                <IconCard size={11} />
                {player.suspensionMatches}
              </span>
            )}
            {!entry.unavailable && hot && (
              <span className="inline-flex shrink-0 items-center gap-0.5 rounded-pill bg-volt/18 px-1.5 py-0.5 text-[10px] font-bold text-volt">
                <IconFlame size={11} />
                Hot
              </span>
            )}
          </span>
        }
        subtitle={
          <span className="mt-1 flex flex-col gap-1.5">
            <span className="flex flex-wrap items-center gap-1.5">
              <PositionChip position={player.position} size="xs" />
              <span className="num-broadcast text-[12px] text-ink-muted">{player.age}</span>
              {entry.trait
                ? <TraitChip trait={entry.trait} />
                : <span className="text-[12px] text-ink-dim">{SQUAD_ROLE_LABELS[role]}</span>}
            </span>
            <span className="flex items-center gap-2">
              <span
                className="h-1 w-16 shrink-0 overflow-hidden rounded-pill bg-white/10"
                title={`Fitness ${Math.round(player.fitness)}%`}
              >
                <span
                  className={cn('block h-full rounded-pill', FITNESS_FILL[fitnessTone(player.fitness)])}
                  style={{ width: `${Math.max(2, Math.min(100, player.fitness))}%` }}
                />
              </span>
              <span className="text-[11px] text-ink-dim">
                {player.fitness >= 80 ? 'Fresh' : player.fitness >= 55 ? 'Tiring' : 'Needs a rest'}
              </span>
              {entry.trait && (
                <span className="text-[11px] text-ink-dim">· {SQUAD_ROLE_LABELS[role]}</span>
              )}
              {contract && (
                <span className={cn('text-[11px]', entry.expiring ? 'text-warning' : 'text-ink-dim')}>
                  · {entry.expiring ? `deal ends in ${contract.weeksRemaining}w` : `${contract.weeksRemaining}w left`}
                </span>
              )}
              {cold && !entry.unavailable && (
                <span className="text-[11px] text-danger">· off form</span>
              )}
            </span>
          </span>
        }
        trailing={<RatingBadge value={player.overall} size="sm" />}
      />
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

/* --- screen ------------------------------------------------------------ */

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
  const [sort, setSort] = useState<SortKey>('position');
  const [availableOnly, setAvailableOnly] = useState(false);
  const [expiringOnly, setExpiringOnly] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [picked, setPicked] = useState<Player['id'] | null>(null);
  const [opened, setOpened] = useState<Player['id'] | null>(null);

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
      trait: player.traitIds
        .map((id) => TRAIT_BY_ID.get(id))
        .find((t): t is TraitDefinition => t !== undefined && t.kind !== 'negative'),
    }));

    const injured = entries.filter((e) => e.player.injury !== null).length;
    const suspended = entries.filter((e) => e.player.suspensionMatches > 0).length;

    return {
      club,
      entries,
      expiringCount: expiringIds.size,
      injured,
      suspended,
      unavailable: injured + suspended,
      wages: squadWageBill(state, club.id),
      usage: wageBudgetUsage(state, club.id),
      averageAge: squad.length ? squad.reduce((sum, p) => sum + p.age, 0) / squad.length : 0,
      averageRating: squad.length ? squad.reduce((sum, p) => sum + p.overall, 0) / squad.length : 0,
      youth: state.clubs[club.id]?.youthSquad.length ?? 0,
      best: starPlayer(state, club.id),
    };
  }, [state]);

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

  /**
   * The list is grouped by department whenever the ordering is one the player
   * did not explicitly choose to break — a squad reads as a team sheet, not as
   * one undifferentiated column of twenty names.
   */
  const sections = useMemo(() => {
    if (sort !== 'position' || group !== 'ALL') {
      return [{ key: 'all' as const, title: null, rows: visible }];
    }
    return GROUP_ORDER
      .map((key) => ({ key, title: GROUP_TITLES[key], rows: visible.filter((e) => e.group === key) }))
      .filter((section) => section.rows.length > 0);
  }, [visible, sort, group]);

  const reorder = useCallback((playerId: Player['id'], targetId: Player['id']) => {
    apply((current) => patchClub(current, current.playerClubId, (club) => {
      const ids = [...club.squad];
      const from = ids.indexOf(playerId);
      const to = ids.indexOf(targetId);
      if (from < 0 || to < 0 || from === to) return {};
      const [moved] = ids.splice(from, 1);
      if (!moved) return {};
      ids.splice(to, 0, moved);
      return { squad: ids };
    }));
  }, [apply]);

  const move = useCallback((playerId: Player['id'], delta: number) => {
    apply((current) => patchClub(current, current.playerClubId, (club) => {
      const ids = [...club.squad];
      const from = ids.indexOf(playerId);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= ids.length) return {};
      const [moved] = ids.splice(from, 1);
      if (!moved) return {};
      ids.splice(to, 0, moved);
      return { squad: ids };
    }));
  }, [apply]);

  const onSelect = useCallback((playerId: Player['id']) => {
    setPicked((current) => {
      if (current === null) return playerId;
      if (current === playerId) return null;
      reorder(current, playerId);
      return null;
    });
  }, [reorder]);

  const onOpen = useCallback((playerId: Player['id']) => setOpened(playerId), []);

  const groupCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: data.entries.length };
    for (const key of GROUP_ORDER) counts[key] = data.entries.filter((e) => e.group === key).length;
    return counts;
  }, [data.entries]);

  const openedPlayer = opened ? data.entries.find((e) => e.player.id === opened)?.player ?? null : null;
  const verdict = data.unavailable === 0
    ? `${data.entries.length} players, everybody available`
    : `${data.entries.length} players, ${data.unavailable} unavailable`;

  return (
    <Screen
      title="Squad"
      subtitle={`${formatMoney(data.wages)} a week in wages · ${Math.round(data.usage * 100)}% of your budget`}
      actions={
        <>
          <GlassIcon
            label={reordering ? 'Finish reordering' : 'Reorder the squad'}
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
          aria-label="Filter by position"
          options={GROUP_OPTIONS.map((option) => ({
            value: option.value,
            label: `${option.label} ${groupCounts[option.value] ?? 0}`,
          }))}
        />
      }
      aside={
        <GlassPanel title="Squad shape" padding="md">
          <ListRow title="Average rating" trailing={<Text role="stat">{Math.round(data.averageRating)}</Text>} />
          <ListRow title="Average age" trailing={<Text role="stat">{data.averageAge.toFixed(1)}</Text>} />
          <ListRow title="In the academy" trailing={<Text role="stat">{data.youth}</Text>} />
          <ListRow
            divided={false}
            title="Unavailable"
            subtitle={`${data.injured} injured, ${data.suspended} suspended`}
            trailing={<Text role="stat">{data.unavailable}</Text>}
          />
        </GlassPanel>
      }
      footer={
        reordering ? (
          <div className="flex items-center gap-3">
            <Text role="caption" className="min-w-0 flex-1 text-pretty">
              {picked ? 'Now tap where you want him.' : 'Tap a player to pick him up, or use the arrows.'}
            </Text>
            <GlassButton variant="primary" size="sm" onClick={() => { setReordering(false); setPicked(null); }}>
              Done
            </GlassButton>
          </div>
        ) : undefined
      }
    >
      {/* --- the state of the squad ----------------------------------- */}
      <HeroSurface
        eyebrow="Your squad"
        texture="haze"
        bleed={data.club.visual.primary}
        padding="md"
      >
        <Text role="title" as="h2" className="text-pretty">{verdict}</Text>
        <Text role="caption" className="mt-1.5 text-pretty">
          The rule down the left of each row is the job you have promised him. Amber means his contract is nearly up;
          red means he cannot play.
        </Text>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <StatBlock
            tone="volt"
            label="Average rating"
            value={Math.round(data.averageRating)}
            caption="Across the whole squad"
          />
          <StatBlock
            label="Average age"
            value={data.averageAge.toFixed(1)}
            caption={data.averageAge >= 29 ? 'An old squad — plan the rebuild' : data.averageAge <= 24 ? 'A young squad with room to grow' : 'A balanced age profile'}
          />
        </div>

        {data.best && (
          <button
            type="button"
            onClick={() => setOpened(data.best?.id ?? null)}
            className="mt-3 flex w-full items-center gap-3 rounded-md bg-white/[0.05] p-2 text-left outline-none hover:bg-white/[0.08] focus-visible:ring-2 focus-visible:ring-volt focus-visible:ring-offset-2 focus-visible:ring-offset-base"
          >
            <PlayerPortrait
              seed={data.best.portraitSeed}
              size={40}
              shape="squircle"
              colors={{ primary: data.club.visual.primary, secondary: data.club.visual.secondary }}
            />
            <span className="min-w-0 flex-1">
              <Text role="micro" as="span" className="block">Your best player</Text>
              <NameText name={data.best.displayName} role="bodyStrong" className="mt-0.5" />
            </span>
            <RatingBadge value={data.best.overall} size="sm" />
          </button>
        )}
      </HeroSurface>

      {/* --- what needs doing ----------------------------------------- */}
      {data.expiringCount > 0 && (
        <GlassPanel padding="sm" accent="danger">
          <button
            type="button"
            onClick={() => { setExpiringOnly(true); setSort('contract'); }}
            className="flex w-full min-h-11 items-center gap-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-volt focus-visible:ring-offset-2 focus-visible:ring-offset-base"
          >
            <IconWarning size={18} className="shrink-0 text-warning" />
            <span className="min-w-0 flex-1">
              <Text role="bodyStrong" as="span" className="block text-pretty">
                {data.expiringCount} {data.expiringCount === 1 ? 'contract is' : 'contracts are'} running out
              </Text>
              <Text role="caption" as="span" className="mt-0.5 block text-pretty">
                Renew them now, or they leave at the end of their deal and you get nothing for them.
              </Text>
            </span>
          </button>
        </GlassPanel>
      )}

      {/* --- the list -------------------------------------------------- */}
      <div className="flex items-end justify-between gap-3 pt-1">
        <div className="min-w-0">
          <Text role="section" as="h2">
            {group === 'ALL' ? 'Every player' : GROUP_TITLES[group as PositionGroup]}
          </Text>
          <Text role="caption" className="mt-0.5 text-ink-dim">
            {visible.length} shown, sorted by {SORT_LABELS[sort].toLowerCase()}
          </Text>
        </div>
        <GlassButton variant="ghost" size="sm" icon={<IconSort size={15} />} onClick={() => setSortOpen(true)}>
          Sort
        </GlassButton>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="Nobody matches those filters"
          description="Loosen the filters, or head to the market if the squad really is this thin."
          action={
            <GlassButton
              variant="secondary"
              onClick={() => { setGroup('ALL'); setAvailableOnly(false); setExpiringOnly(false); }}
            >
              Clear the filters
            </GlassButton>
          }
        />
      ) : (
        sections.map((section) => (
          <div key={section.key} className="flex flex-col gap-2">
            {section.title && (
              <div className="flex items-baseline gap-2 pt-1">
                <Text role="section" as="h3" className="text-[13px]">{section.title}</Text>
                <Text role="caption" className="text-ink-dim">{section.rows.length}</Text>
              </div>
            )}
            <GlassPanel padding="sm">
              <div className="flex flex-col">
                {section.rows.map((entry, index) => (
                  <SquadRow
                    key={entry.player.id}
                    entry={entry}
                    primary={data.club.visual.primary}
                    secondary={data.club.visual.secondary}
                    selected={picked === entry.player.id}
                    reordering={reordering}
                    divided={index !== section.rows.length - 1}
                    onOpen={onOpen}
                    onSelect={onSelect}
                    onMove={move}
                  />
                ))}
              </div>
            </GlassPanel>
          </div>
        ))
      )}

      <Divider />
      <div className="flex flex-wrap gap-2 pb-2">
        <GlassButton variant="secondary" size="sm" onClick={() => navigate(ROUTES.tactics)}>Tactics</GlassButton>
        <GlassButton variant="secondary" size="sm" onClick={() => navigate(ROUTES.training)}>Training</GlassButton>
        <GlassButton variant="ghost" size="sm" onClick={() => navigate(ROUTES.market)}>Sign somebody</GlassButton>
      </div>

      {/* --- the player sheet ------------------------------------------ */}
      <PlayerSheet
        state={state}
        player={openedPlayer}
        open={openedPlayer !== null}
        onClose={() => setOpened(null)}
        onOpenProfile={(playerId) => {
          setOpened(null);
          navigate(buildPath(ROUTES.player, { playerId }));
        }}
        onOpenTactics={() => { setOpened(null); navigate(ROUTES.tactics); }}
      />

      {/* --- sort and filter ------------------------------------------- */}
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
          description="Six weeks or fewer remaining"
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
