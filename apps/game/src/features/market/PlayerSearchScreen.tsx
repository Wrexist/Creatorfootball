import { memo, useCallback, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  POSITIONS,
  POSITION_LABELS,
  contractFor,
  searchPlayers,
  type GameState,
  type Player,
  type PlayerFilters,
  type PlayerId,
  type Position,
  type TransferListing,
} from '@cf/engine';
import {
  Divider, EmptyState, FOCUS_RING, GlassButton, GlassIcon, GlassInput, GlassPanel, GlassPill,
  GlassSegmented, GlassSheet, GlassSlider, GlassToggle, IconFilter, IconScout, IconSearch,
  IconStar, KeyValueRow, MoneyLabel, Screen, SectionHeader, SheetCloseRow, cn, useToast,
  type PlayerCardClub,
} from '@/design';
import { ROUTES, buildPath } from '@/app/routes';
import { GateScreen, useGameStatus } from './gate';
import { useClubLookup } from './clubs';
import { openTalks, orderScoutReport, toggleShortlist } from './engine';
import { MarketPlayerCard, AVAILABILITY } from './components/MarketPlayerCard';
import { AttributeDossier, ConfidenceMeter, KnownRating, PotentialPill, useKnowledge } from './components/scouting';
import { plainMoney } from './format';

/**
 * Player search.
 *
 * Two decisions define this screen. First, ability filters run against the
 * *scouted estimate*, which is the engine's own behaviour — you search what you
 * know, so a world-class player nobody has watched simply will not appear in a
 * "minimum 80" search. Second, there is deliberately no potential filter or
 * potential sort: both would read straight through the fog that scouting exists
 * to sell.
 */

/** Mirrors the engine market's own definition of a contract running down. */
const RUNNING_DOWN_WEEKS = 20;

const PAGE = 24;

type SortKey = 'VALUE' | 'OVERALL' | 'AGE' | 'WAGE' | 'NAME';

interface Draft {
  readonly positions: readonly Position[];
  readonly minAge: number;
  readonly maxAge: number;
  readonly minOverall: number;
  readonly maxValue: number;
  readonly availability: readonly TransferListing['availability'][];
  readonly listedOnly: boolean;
  readonly freeAgentsOnly: boolean;
  readonly shortlistedOnly: boolean;
  readonly runningDownOnly: boolean;
  readonly sort: SortKey;
}

const DEFAULT_DRAFT: Draft = {
  positions: [],
  minAge: 15,
  maxAge: 40,
  minOverall: 0,
  maxValue: 0,
  availability: [],
  listedOnly: false,
  freeAgentsOnly: false,
  shortlistedOnly: false,
  runningDownOnly: false,
  sort: 'VALUE',
};

const SORT_OPTIONS = [
  { value: 'VALUE' as const, label: 'Value' },
  { value: 'OVERALL' as const, label: 'Ability' },
  { value: 'AGE' as const, label: 'Age' },
  { value: 'WAGE' as const, label: 'Wage' },
  { value: 'NAME' as const, label: 'Name' },
];

/* --- filter sheet ------------------------------------------------------ */

interface FilterSheetProps {
  open: boolean;
  draft: Draft;
  maxBudget: number;
  onChange: (next: Draft) => void;
  onClose: () => void;
}

function FilterSheet({ open, draft, maxBudget, onChange, onClose }: FilterSheetProps): ReactNode {
  const togglePosition = (position: Position): void => {
    onChange({
      ...draft,
      positions: draft.positions.includes(position)
        ? draft.positions.filter((p) => p !== position)
        : [...draft.positions, position],
    });
  };

  return (
    <GlassSheet
      open={open}
      onClose={onClose}
      title="Filter the market"
      subtitle="Ability filters read your scouting estimates, not the truth"
      size="tall"
      footer={
        <div className="flex gap-3">
          <GlassButton variant="ghost" block onClick={() => onChange(DEFAULT_DRAFT)}>
            Reset
          </GlassButton>
          <GlassButton variant="primary" block onClick={onClose}>
            Show results
          </GlassButton>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <section>
          <SectionHeader title="Position" className="mb-2" />
          <div className="flex flex-wrap gap-2">
            {POSITIONS.map((position) => {
              const active = draft.positions.includes(position);
              return (
                <button
                  key={position}
                  type="button"
                  aria-pressed={active}
                  onClick={() => togglePosition(position)}
                  className={cn(
                    'min-h-11 rounded-pill border px-3.5 text-[13px] font-semibold',
                    active
                      ? 'border-volt/50 bg-volt/15 text-volt'
                      : 'border-white/10 bg-white/[0.04] text-ink-muted',
                    FOCUS_RING,
                  )}
                >
                  <span className="sr-only">{POSITION_LABELS[position]}</span>
                  <span aria-hidden="true">{position}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <SectionHeader title="Profile" />
          <GlassSlider
            label="Youngest"
            value={draft.minAge}
            min={15}
            max={40}
            onChange={(minAge) => onChange({ ...draft, minAge, maxAge: Math.max(minAge, draft.maxAge) })}
            formatValue={(v) => `${v}`}
          />
          <GlassSlider
            label="Oldest"
            value={draft.maxAge}
            min={15}
            max={40}
            onChange={(maxAge) => onChange({ ...draft, maxAge, minAge: Math.min(maxAge, draft.minAge) })}
            formatValue={(v) => `${v}`}
          />
          <GlassSlider
            label="Minimum estimated ability"
            value={draft.minOverall}
            min={0}
            max={95}
            step={1}
            onChange={(minOverall) => onChange({ ...draft, minOverall })}
            formatValue={(v) => (v === 0 ? 'Any' : `${v}+`)}
          />
          <GlassSlider
            label="Maximum price"
            value={draft.maxValue}
            min={0}
            max={Math.max(1_000_000, Math.round(maxBudget * 2))}
            step={50_000}
            onChange={(maxValue) => onChange({ ...draft, maxValue })}
            formatValue={(v) => (v === 0 ? 'Any' : plainMoney(v))}
          />
        </section>

        <section>
          <SectionHeader title="Availability" className="mb-2" />
          <div className="flex flex-wrap gap-2">
            {(Object.keys(AVAILABILITY) as TransferListing['availability'][]).map((key) => {
              const active = draft.availability.includes(key);
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    onChange({
                      ...draft,
                      availability: active
                        ? draft.availability.filter((a) => a !== key)
                        : [...draft.availability, key],
                    })
                  }
                  className={cn(
                    'min-h-11 rounded-pill border px-3.5 text-[13px] font-semibold',
                    active
                      ? 'border-volt/50 bg-volt/15 text-volt'
                      : 'border-white/10 bg-white/[0.04] text-ink-muted',
                    FOCUS_RING,
                  )}
                >
                  {AVAILABILITY[key].label}
                </button>
              );
            })}
          </div>
        </section>

        <section className="flex flex-col gap-1">
          <SectionHeader title="Contract status" className="mb-1" />
          <GlassToggle
            asRow
            label="Out of contract"
            description="Free agents. No fee, but the wage and signing-on fee are all yours."
            checked={draft.freeAgentsOnly}
            onChange={(freeAgentsOnly) => onChange({ ...draft, freeAgentsOnly })}
          />
          <GlassToggle
            asRow
            label="Deal running down"
            description={`Fewer than ${RUNNING_DOWN_WEEKS} weeks left. Their club knows it too.`}
            checked={draft.runningDownOnly}
            onChange={(runningDownOnly) => onChange({ ...draft, runningDownOnly })}
          />
          <GlassToggle
            asRow
            label="Listed for transfer only"
            checked={draft.listedOnly}
            onChange={(listedOnly) => onChange({ ...draft, listedOnly })}
          />
          <GlassToggle
            asRow
            label="Shortlisted only"
            checked={draft.shortlistedOnly}
            onChange={(shortlistedOnly) => onChange({ ...draft, shortlistedOnly })}
          />
        </section>

        <SheetCloseRow onClose={onClose} />
      </div>
    </GlassSheet>
  );
}

/* --- player detail sheet ------------------------------------------------ */

interface DetailSheetProps {
  state: GameState;
  player: Player | null;
  onClose: () => void;
  onOpenTalks: (id: PlayerId) => void;
}

function DetailSheet({ state, player, onClose, onOpenTalks }: DetailSheetProps): ReactNode {
  const toast = useToast();
  if (!player) return null;
  return (
    <DetailSheetBody
      state={state}
      player={player}
      onClose={onClose}
      onOpenTalks={onOpenTalks}
      toastError={(t, d) => toast.error(t, d)}
      toastOk={(t, d) => toast.success(t, d)}
    />
  );
}

function DetailSheetBody({
  state, player, onClose, onOpenTalks, toastError, toastOk,
}: {
  state: GameState;
  player: Player;
  onClose: () => void;
  onOpenTalks: (id: PlayerId) => void;
  toastError: (title: string, description?: string) => void;
  toastOk: (title: string, description?: string) => void;
}): ReactNode {
  const knowledge = useKnowledge(player);
  const listing = state.transfers.listings[player.id];
  const contract = contractFor(state, player.id);
  const club = player.clubId ? state.clubs[player.clubId] : undefined;
  const shortlisted = state.scouting.shortlist.includes(player.id);
  const watching = state.scouting.assignments.some((a) => a.playerId === player.id);

  return (
    <GlassSheet
      open
      onClose={onClose}
      title={player.displayName}
      subtitle={`${POSITION_LABELS[player.position]} · ${player.age} · ${club?.shortName ?? 'Free agent'}`}
      size="tall"
      footer={
        <div className="flex gap-3">
          <GlassButton
            variant="secondary"
            block
            icon={<IconStar />}
            onClick={() => {
              toggleShortlist(player.id);
              toastOk(shortlisted ? 'Removed from shortlist' : 'Added to shortlist');
            }}
          >
            {shortlisted ? 'Unshortlist' : 'Shortlist'}
          </GlassButton>
          <GlassButton variant="primary" block onClick={() => onOpenTalks(player.id)}>
            Open talks
          </GlassButton>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <KnownRating knowledge={knowledge} size="lg" />
          <div className="flex flex-wrap items-center justify-end gap-2">
            <PotentialPill knowledge={knowledge} />
            {listing && (
              <GlassPill tone={AVAILABILITY[listing.availability].tone} size="xs" filled>
                {AVAILABILITY[listing.availability].label}
              </GlassPill>
            )}
          </div>
        </div>

        <ConfidenceMeter knowledge={knowledge} />

        <div>
          <KeyValueRow
            label="Asking price"
            value={<MoneyLabel amount={listing?.askingPrice ?? player.marketValue} size="md" />}
          />
          <KeyValueRow
            label="Wage demand"
            value={<MoneyLabel amount={listing?.wageDemand ?? 0} size="md" />}
            hint="per week"
          />
          <KeyValueRow
            label="Contract"
            value={contract ? `${contract.weeksRemaining} weeks left` : 'None'}
            hint={contract ? `Signed as ${contract.role.toLowerCase()}` : 'He can talk to anyone'}
          />
          <KeyValueRow
            label="Clubs circling"
            value={String(listing?.interestedClubIds.length ?? 0)}
            divided={false}
          />
        </div>

        <Divider label="Scouting report" />

        {knowledge.exact ? (
          <p className="text-[13px] leading-relaxed text-ink-muted text-pretty">
            You have watched him enough. These are his real numbers.
          </p>
        ) : (
          <div className="flex items-center gap-3">
            <p className="flex-1 text-[13px] leading-relaxed text-ink-muted text-pretty">
              {watching
                ? 'A scout is already watching him. The bands narrow when the report lands.'
                : 'Nobody has watched him properly. Every number below is a range, not a fact.'}
            </p>
            {!watching && (
              <GlassButton
                size="sm"
                variant="secondary"
                icon={<IconScout />}
                onClick={() => {
                  const result = orderScoutReport(player.id, 'DETAILED');
                  if (result.ok) toastOk('Scout assigned', result.reason);
                  else toastError('Could not assign a scout', result.reason);
                }}
              >
                Scout
              </GlassButton>
            )}
          </div>
        )}

        <AttributeDossier player={player} knowledge={knowledge} full />
      </div>
    </GlassSheet>
  );
}

/* --- results ------------------------------------------------------------ */

const ResultCard = memo(function ResultCard({
  player, club, listing, onPress,
}: {
  player: Player;
  club?: PlayerCardClub;
  listing?: TransferListing;
  onPress: (id: PlayerId) => void;
}): ReactNode {
  return (
    <MarketPlayerCard
      player={player}
      {...(club ? { club } : {})}
      {...(listing ? { listing } : {})}
      onPress={onPress}
    />
  );
});

/* --- screen ------------------------------------------------------------- */

function SearchView({ state }: { state: GameState }): ReactNode {
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams] = useSearchParams();

  // A name typed into the market's own search box arrives as ?q= — the search
  // screen is the same screen either way, just pre-seeded.
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '');
  const [draft, setDraft] = useState<Draft>(DEFAULT_DRAFT);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [selected, setSelected] = useState<PlayerId | null>(null);

  const clubs = useClubLookup(state);
  const budget = state.clubs[state.playerClubId]?.finance.transferBudget ?? 0;

  const filters = useMemo<PlayerFilters>(() => {
    const base: PlayerFilters = {
      excludeClubId: state.playerClubId,
      minAge: draft.minAge,
      maxAge: draft.maxAge,
      sort: draft.sort,
      ...(draft.positions.length ? { positions: draft.positions } : {}),
      ...(draft.minOverall > 0 ? { minOverall: draft.minOverall } : {}),
      ...(draft.maxValue > 0 ? { maxValue: draft.maxValue } : {}),
      ...(draft.availability.length ? { availability: draft.availability } : {}),
      ...(draft.listedOnly ? { listedOnly: true } : {}),
      ...(draft.freeAgentsOnly ? { freeAgentsOnly: true } : {}),
      ...(draft.shortlistedOnly ? { shortlistedOnly: true } : {}),
      ...(query.trim() ? { query: query.trim() } : {}),
    };
    return base;
  }, [draft, query, state.playerClubId]);

  const results = useMemo(() => {
    const ids = searchPlayers(state, filters);
    const players: Player[] = [];
    for (const id of ids) {
      const player = state.players[id];
      if (!player) continue;
      if (draft.runningDownOnly) {
        const contract = contractFor(state, id);
        if (!contract || contract.weeksRemaining > RUNNING_DOWN_WEEKS) continue;
      }
      players.push(player);
    }
    return players;
  }, [state, filters, draft.runningDownOnly]);

  const visible = useMemo(() => results.slice(0, limit), [results, limit]);
  const selectedPlayer = selected ? state.players[selected] ?? null : null;

  const startTalks = useCallback(
    (playerId: PlayerId) => {
      const result = openTalks(playerId);
      if (!result.ok || !result.negotiationId) {
        toast.error('Talks could not be opened', result.reason);
        return;
      }
      navigate(buildPath(ROUTES.negotiation, { negotiationId: result.negotiationId }));
    },
    [navigate, toast],
  );

  const activeFilterCount =
    draft.positions.length +
    draft.availability.length +
    (draft.minOverall > 0 ? 1 : 0) +
    (draft.maxValue > 0 ? 1 : 0) +
    (draft.minAge !== DEFAULT_DRAFT.minAge || draft.maxAge !== DEFAULT_DRAFT.maxAge ? 1 : 0) +
    (draft.listedOnly ? 1 : 0) +
    (draft.freeAgentsOnly ? 1 : 0) +
    (draft.shortlistedOnly ? 1 : 0) +
    (draft.runningDownOnly ? 1 : 0);

  return (
    <Screen
      title="Search"
      subtitle={`${results.length} player${results.length === 1 ? '' : 's'} match what you know`}
      onBack={() => navigate(ROUTES.market)}
      headerAccessory={
        <div className="flex items-center gap-2">
          <GlassInput
            label="Search players by name"
            labelHidden
            placeholder="Search by name"
            value={query}
            icon={<IconSearch />}
            size="sm"
            nested
            onChange={(event) => { setQuery(event.target.value); setLimit(PAGE); }}
            className="flex-1"
          />
          <GlassIcon
            label={`Filters${activeFilterCount > 0 ? `, ${activeFilterCount} active` : ''}`}
            icon={<IconFilter />}
            nested
            active={activeFilterCount > 0}
            {...(activeFilterCount > 0 ? { badge: activeFilterCount } : {})}
            onClick={() => setFiltersOpen(true)}
          />
        </div>
      }
      aside={
        <GlassPanel title="How this list works" padding="md">
          <p className="text-[13px] leading-relaxed text-ink-muted text-pretty">
            Ability filters run against your own scouting estimates. A player nobody has watched
            will not appear in a high-ability search — not because he is not good enough, but
            because you have no way of knowing that he is.
          </p>
          <Divider className="my-3" />
          <p className="text-[12px] leading-relaxed text-ink-dim text-pretty">
            There is no potential filter here on purpose. Sorting the world by a number nobody in
            the world can see would make scouting pointless.
          </p>
        </GlassPanel>
      }
    >
      <div className="flex items-center gap-2">
        <GlassSegmented
          options={SORT_OPTIONS}
          value={draft.sort}
          onChange={(sort) => setDraft({ ...draft, sort })}
          aria-label="Sort results"
          size="sm"
          block
        />
      </div>

      {activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {draft.positions.map((position) => (
            <GlassPill key={position} tone="volt" size="xs" filled>{position}</GlassPill>
          ))}
          {draft.minOverall > 0 && <GlassPill size="xs">{draft.minOverall}+ est.</GlassPill>}
          {draft.maxValue > 0 && <GlassPill size="xs">under {plainMoney(draft.maxValue)}</GlassPill>}
          {draft.freeAgentsOnly && <GlassPill size="xs">free agents</GlassPill>}
          {draft.runningDownOnly && <GlassPill size="xs">running down</GlassPill>}
          {draft.shortlistedOnly && <GlassPill size="xs">shortlisted</GlassPill>}
          {draft.listedOnly && <GlassPill size="xs">listed</GlassPill>}
          <GlassButton size="sm" variant="ghost" onClick={() => setDraft(DEFAULT_DRAFT)}>
            Clear
          </GlassButton>
        </div>
      )}

      {results.length === 0 ? (
        <EmptyState
          icon={<IconSearch />}
          title="Nobody matches"
          description="Loosen the filters, or send a scout out. Players you have never watched are invisible to an ability search — that is the point of scouting, not a bug in the list."
          action={
            <GlassButton variant="secondary" onClick={() => navigate(ROUTES.scouting)}>
              Go to scouting
            </GlassButton>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {visible.map((player) => {
              const club = clubs(player.clubId);
              const listing = state.transfers.listings[player.id];
              return (
                <ResultCard
                  key={player.id}
                  player={player}
                  {...(club ? { club } : {})}
                  {...(listing ? { listing } : {})}
                  onPress={setSelected}
                />
              );
            })}
          </div>
          {visible.length < results.length && (
            <GlassButton variant="secondary" block onClick={() => setLimit((n) => n + PAGE)}>
              Show {Math.min(PAGE, results.length - visible.length)} more
            </GlassButton>
          )}
        </>
      )}

      <FilterSheet
        open={filtersOpen}
        draft={draft}
        maxBudget={budget}
        onChange={(next) => { setDraft(next); setLimit(PAGE); }}
        onClose={() => setFiltersOpen(false)}
      />

      <DetailSheet
        state={state}
        player={selectedPlayer}
        onClose={() => setSelected(null)}
        onOpenTalks={(id) => { setSelected(null); startTalks(id); }}
      />
    </Screen>
  );
}

export function PlayerSearchScreen(): ReactNode {
  const gate = useGameStatus();
  if (gate.status !== 'ready') return <GateScreen gate={gate} title="Search" />;
  return <SearchView state={gate.state} />;
}
