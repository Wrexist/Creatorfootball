import { memo, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  negotiationSummary,
  type ClubId,
  type GameState,
  type Negotiation,
  type Player,
  type PlayerId,
  type TransferRumour,
} from '@cf/engine';
import {
  CardRail, ClubBadge, Divider, EmptyState, GlassButton, GlassIcon, GlassInput, GlassPanel,
  GlassPill, HeroSurface, IconFilter, IconMarket, IconScout, IconSearch, IconStar,
  ListRow, MoneyLabel, NameText, ProgressBar, Screen, SectionHeader, StatBlock, Text,
  useToast,
} from '@/design';
import { ROUTES, buildPath } from '@/app/routes';
import { GateScreen, useGameStatus } from './gate';
import { useClubLookup, type ClubLookup } from './clubs';
import { openTalks, useHeadroom, useOurNegotiations, windowState } from './engine';
import { useMarketRails, type Rail } from './rails';
import { buildTargetStory } from './story';
import { TargetCard } from './components/TargetCard';
import { PlayerRow } from './components/PlayerRow';
import { cyclesLeft, relativeCycle } from './format';

/**
 * The market's front door.
 *
 * Top of the screen is the tooling — search, filter, sort — for the manager who
 * already knows the name he is after. Everything below it is for the one who
 * does not: six curated rails, each answering a question rather than offering a
 * sort order, and each player in them carrying the *story* around the deal
 * instead of only a price.
 *
 * Every figure on this screen — asking price, market value, wage demand, the
 * agent's cut, who else is watching — is produced by an engine function in
 * `story.ts`. Nothing here works out what a player is worth.
 */

const STAGE_TONE = {
  OPENING: 'neutral', CLUB_TALKS: 'info', PLAYER_TALKS: 'volt', AGENT_TALKS: 'warning',
  AGREED: 'positive', FAILED: 'danger', HIJACKED: 'danger',
} as const;

const STAGE_LABEL = {
  OPENING: 'Opening', CLUB_TALKS: 'Club talks', PLAYER_TALKS: 'Player talks',
  AGENT_TALKS: 'Agent talks', AGREED: 'Agreed', FAILED: 'Failed', HIJACKED: 'Hijacked',
} as const;

/* --- negotiations ------------------------------------------------------ */

interface NegotiationRowProps {
  negotiation: Negotiation;
  playerName: string;
  cycle: number;
  divided: boolean;
  onPress: (id: string) => void;
}

const NegotiationRow = memo(function NegotiationRow({
  negotiation, playerName, cycle, divided, onPress,
}: NegotiationRowProps): ReactNode {
  const rivals = negotiation.rivalBidders.length;
  return (
    <ListRow
      divided={divided}
      leading={
        <GlassPill tone={STAGE_TONE[negotiation.stage]} size="xs" filled>
          {STAGE_LABEL[negotiation.stage]}
        </GlassPill>
      }
      title={<NameText name={playerName} role="bodyStrong" lines={2} />}
      subtitle={
        `${negotiationSummary(negotiation)}${
          rivals > 0 ? ` · ${rivals} rival ${rivals === 1 ? 'bidder' : 'bidders'}` : ''
        }`
      }
      trailing={
        <Text role="micro" as="span">{cyclesLeft(cycle, negotiation.deadlineCycle)}</Text>
      }
      chevron
      onPress={() => onPress(negotiation.id)}
    />
  );
});

/* --- rumours ----------------------------------------------------------- */

const RumourRow = memo(function RumourRow({
  rumour, cycle, clubName,
}: { rumour: TransferRumour; cycle: number; clubName: string }): ReactNode {
  const credible = rumour.credibility >= 0.6;
  return (
    <div className="flex items-start gap-3 border-b border-white/[0.06] py-2.5 last:border-b-0">
      <span
        className={credible ? 'mt-1.5 size-1.5 shrink-0 rounded-pill bg-volt' : 'mt-1.5 size-1.5 shrink-0 rounded-pill bg-ink-faint'}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <Text role="caption" as="p" className="text-ink text-pretty">{rumour.text}</Text>
        <Text role="micro" as="p" className="mt-0.5">
          {credible ? 'Well sourced' : 'Unconfirmed'} · {clubName} · {relativeCycle(cycle, rumour.cycle)}
        </Text>
      </div>
    </div>
  );
});

/* --- completed deals --------------------------------------------------- */

interface DoneDealProps {
  playerName: string;
  fee: number;
  fromClubId: ClubId | null;
  toClubId: ClubId;
  cycle: number;
  now: number;
  clubs: ClubLookup;
  divided: boolean;
}

const DoneDeal = memo(function DoneDeal({
  playerName, fee, fromClubId, toClubId, cycle, now, clubs, divided,
}: DoneDealProps): ReactNode {
  const from = clubs(fromClubId);
  const to = clubs(toClubId);
  return (
    <ListRow
      density="compact"
      divided={divided}
      leading={
        <span className="flex items-center gap-1">
          {from ? <ClubBadge visual={from.visual} size={20} flat label={from.name} /> : (
            <Text role="micro" as="span">Free</Text>
          )}
          <span className="text-ink-dim" aria-hidden="true">→</span>
          {to && <ClubBadge visual={to.visual} size={20} flat label={to.name} />}
        </span>
      }
      title={<NameText name={playerName} role="bodyStrong" lines={2} />}
      subtitle={relativeCycle(now, cycle)}
      trailing={<MoneyLabel amount={fee} size="sm" />}
    />
  );
});

/* --- rails ------------------------------------------------------------- */

interface RailSectionProps {
  rail: Rail;
  state: GameState;
  clubs: ClubLookup;
  onOpen: (playerId: PlayerId) => void;
}

const RailSection = memo(function RailSection({
  rail, state, clubs, onOpen,
}: RailSectionProps): ReactNode {
  return (
    <section className="flex flex-col gap-2">
      <SectionHeader title={rail.title} subtitle={rail.blurb} />
      <CardRail itemWidth={228} ariaLabel={`${rail.title} players`}>
          {rail.players.map((player: Player) => (
            <TargetCard
              key={player.id}
              player={player}
              story={buildTargetStory(state, player, state.transfers.listings[player.id])}
              {...(clubs(player.clubId) ? { club: clubs(player.clubId) } : {})}
              {...(state.transfers.listings[player.id]
                ? { listing: state.transfers.listings[player.id] }
                : {})}
              onPress={onOpen}
            />
          ))}
      </CardRail>
    </section>
  );
});

/* --- screen ------------------------------------------------------------ */

function MarketView({ state }: { state: GameState }): ReactNode {
  const navigate = useNavigate();
  const toast = useToast();
  const [query, setQuery] = useState('');

  const clubs = useClubLookup(state);
  const headroom = useHeadroom(state);
  const negotiations = useOurNegotiations(state);
  const rails = useMarketRails(state);
  const filledRails = useMemo(() => rails.filter((r) => r.players.length > 0), [rails]);
  const emptyRails = useMemo(() => rails.filter((r) => r.players.length === 0), [rails]);
  const window = windowState(state);
  const cycle = state.clock.cycle;

  const shortlist = useMemo(
    () =>
      state.scouting.shortlist
        .map((id) => state.players[id])
        .filter((p): p is NonNullable<typeof p> => Boolean(p)),
    [state.scouting.shortlist, state.players],
  );

  const rumours = useMemo(
    () => state.transfers.rumours.slice().sort((a, b) => b.cycle - a.cycle).slice(0, 6),
    [state.transfers.rumours],
  );

  const completed = useMemo(
    () => state.transfers.completed.slice(-6).reverse(),
    [state.transfers.completed],
  );

  const goToNegotiation = (id: string): void => {
    navigate(buildPath(ROUTES.negotiation, { negotiationId: id }));
  };

  const openPlayer = (playerId: PlayerId): void => {
    navigate(buildPath(ROUTES.player, { playerId }));
  };

  const runSearch = (): void => {
    navigate(query.trim() ? `${ROUTES.playerSearch}?q=${encodeURIComponent(query.trim())}` : ROUTES.playerSearch);
  };

  const startTalks = (playerId: PlayerId): void => {
    const result = openTalks(playerId);
    if (!result.ok || !result.negotiationId) {
      toast.error('Talks could not be opened', result.reason);
      return;
    }
    goToNegotiation(result.negotiationId);
  };

  const budgets = (
    <GlassPanel title="What you can spend" padding="md">
      <div className="grid grid-cols-2 gap-3">
        <StatBlock
          label="Transfer budget"
          value={<MoneyLabel amount={headroom.transferBudget} size="lg" />}
          tone="volt"
          caption="Cash for fees, once"
        />
        <StatBlock
          label="Wage room"
          value={<MoneyLabel amount={headroom.wageFree} size="lg" />}
          tone={headroom.usage > 1 ? 'danger' : headroom.usage > 0.85 ? 'warning' : 'positive'}
          caption="Spare, every week"
        />
      </div>
      <ProgressBar
        className="mt-3"
        value={Math.min(100, Math.round(headroom.usage * 100))}
        tone={headroom.usage > 1 ? 'danger' : headroom.usage > 0.85 ? 'warning' : 'positive'}
        label="Wage bill committed"
        valueLabel={`${Math.round(headroom.usage * 100)}%`}
        marker={100}
      />
      <Text role="caption" as="p" className="mt-2.5 text-ink-dim text-pretty">
        A signing costs you twice: the fee comes out of the budget once, the wage comes out of
        every week that follows.
      </Text>
    </GlassPanel>
  );

  const rumourPanel = (
    <GlassPanel title="Doing the rounds" padding="md">
      {rumours.length === 0 ? (
        <EmptyState
          size="sm"
          title="Nothing is being said"
          description="Rumours come out of real interest in real players. Once clubs start circling, you will hear about it here."
        />
      ) : (
        <div>
          {rumours.map((rumour) => (
            <RumourRow
              key={rumour.id}
              rumour={rumour}
              cycle={cycle}
              clubName={clubs(rumour.clubId)?.name ?? 'A club'}
            />
          ))}
        </div>
      )}
    </GlassPanel>
  );

  return (
    <Screen
      title="Market"
      subtitle={
        window.open
          ? 'The window is open — you can do business'
          : 'The window is shut — you can look, not buy'
      }
      actions={
        <GlassIcon
          label="Scouting"
          icon={<IconScout />}
          variant="ghost"
          onClick={() => navigate(ROUTES.scouting)}
        />
      }
      headerAccessory={
        <div className="flex items-center gap-2">
          <GlassInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') runSearch(); }}
            placeholder="Search players by name"
            label="Search players by name"
            labelHidden
            icon={<IconSearch />}
            size="sm"
            nested
            className="min-w-0 flex-1"
          />
          <GlassIcon
            label="Filter and sort"
            icon={<IconFilter />}
            variant="ghost"
            onClick={() => navigate(ROUTES.playerSearch)}
          />
        </div>
      }
      aside={
        <>
          {budgets}
          {rumourPanel}
        </>
      }
    >
      <HeroSurface
        eyebrow={window.open ? 'Window open' : 'Window shut'}
        title={window.open ? 'You can do business' : 'Nothing can be signed'}
        subtitle={
          window.open
            ? window.closesWeek !== null
              ? `You are in ${window.phaseLabel}, matchweek ${window.week} of ${window.totalWeeks}. Business closes when the calendar moves on after matchweek ${window.closesWeek}.`
              : `You are in ${window.phaseLabel}. The window stays open for the rest of the calendar.`
            : window.opensWeek !== null
              ? `You are in ${window.phaseLabel}, matchweek ${window.week} of ${window.totalWeeks}. The next window opens at matchweek ${window.opensWeek} — because the calendar reaches it, not because a timer runs down.`
              : `You are in ${window.phaseLabel}. No further window is scheduled this season.`
        }
        texture="stadium"
        padding="md"
        footer={
          <GlassButton variant="primary" onClick={() => navigate(ROUTES.playerSearch)} block>
            Browse, filter and sort every player
          </GlassButton>
        }
      />

      <div className="md:hidden">{budgets}</div>

      <GlassPanel title="In the room" padding="md">
        {negotiations.length === 0 ? (
          <EmptyState
            size="sm"
            icon={<IconMarket />}
            title="No talks open"
            description="A transfer here is a conversation with a club, a player and an agent. Start one from a rail below, from a search result, or from your shortlist."
          />
        ) : (
          <div className="flex flex-col">
            {negotiations.map((negotiation, index) => (
              <NegotiationRow
                key={negotiation.id}
                negotiation={negotiation}
                playerName={state.players[negotiation.playerId]?.displayName ?? 'Unknown player'}
                cycle={cycle}
                divided={index < negotiations.length - 1}
                onPress={goToNegotiation}
              />
            ))}
          </div>
        )}
      </GlassPanel>

      {/* A rail with nothing in it is a heading, a paragraph and an apology.
          Six of those on day one is the dead space the review complained
          about — so empty rails collapse into a single honest note instead. */}
      {filledRails.map((rail) => (
        <RailSection key={rail.id} rail={rail} state={state} clubs={clubs} onOpen={openPlayer} />
      ))}

      {emptyRails.length > 0 && (
        <GlassPanel
          title={filledRails.length > 0 ? 'Not showing yet' : 'The market has not opened up yet'}
          padding="md"
        >
          <div className="flex flex-col">
            {emptyRails.map((rail, index) => (
              <ListRow
                key={rail.id}
                density="compact"
                divided={index < emptyRails.length - 1}
                title={rail.title}
                subtitle={rail.emptyLine}
              />
            ))}
          </div>
          <Text role="caption" as="p" className="mt-3 text-ink-dim text-pretty">
            Each of these fills in on its own as the season moves. Nothing is locked behind a
            purchase.
          </Text>
        </GlassPanel>
      )}

      <GlassPanel padding="md">
        <SectionHeader
          title="Shortlist"
          subtitle={
            shortlist.length > 0
              ? `${shortlist.length} watched — a scout looks at these first`
              : 'Players you are keeping an eye on'
          }
          className="mb-2"
        />
        {shortlist.length === 0 ? (
          <EmptyState
            size="sm"
            icon={<IconStar />}
            title="Nobody on the list"
            description="Shortlisting a player keeps him in front of you and makes him the first thing a scout looks at."
            action={
              <GlassButton variant="secondary" size="sm" onClick={() => navigate(ROUTES.playerSearch)}>
                Open the market
              </GlassButton>
            }
          />
        ) : (
          <div className="-mx-2">
            {shortlist.map((player) => (
              <PlayerRow
                key={player.id}
                player={player}
                {...(clubs(player.clubId) ? { club: clubs(player.clubId) } : {})}
                {...(state.transfers.listings[player.id]
                  ? { listing: state.transfers.listings[player.id] }
                  : {})}
                trailing={
                  <GlassButton size="sm" variant="secondary" onClick={() => startTalks(player.id)}>
                    Open talks
                  </GlassButton>
                }
              />
            ))}
          </div>
        )}
      </GlassPanel>

      <div className="md:hidden">{rumourPanel}</div>

      <GlassPanel title="Around the league" padding="md">
        {completed.length === 0 ? (
          <EmptyState
            size="sm"
            title="No business done yet"
            description="Every completed transfer in the league lands here, yours and theirs alike."
          />
        ) : (
          <div className="flex flex-col">
            {completed.map((deal, index) => (
              <DoneDeal
                key={`${deal.playerId}-${deal.cycle}-${index}`}
                playerName={state.players[deal.playerId]?.displayName ?? 'A player'}
                fee={deal.fee}
                fromClubId={deal.fromClubId}
                toClubId={deal.toClubId}
                cycle={deal.cycle}
                now={cycle}
                clubs={clubs}
                divided={index < completed.length - 1}
              />
            ))}
          </div>
        )}
        <Divider className="my-3" />
        <Text role="caption" as="p" className="text-ink-dim text-pretty">
          Rival clubs buy and sell whether or not you do. A player you watched all season can be
          gone by the time you decide.
        </Text>
      </GlassPanel>
    </Screen>
  );
}

export function MarketScreen(): ReactNode {
  const gate = useGameStatus();
  if (gate.status !== 'ready') return <GateScreen gate={gate} title="Market" />;
  return <MarketView state={gate.state} />;
}
