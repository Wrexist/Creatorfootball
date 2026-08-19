import { memo, useMemo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  negotiationSummary,
  type ClubId,
  type GameState,
  type Negotiation,
  type PlayerId,
  type TransferRumour,
} from '@cf/engine';
import {
  ClubBadge, Divider, EmptyState, GlassButton, GlassIcon, GlassPanel, GlassPill,
  IconMarket, IconScout, IconSearch, IconStar, KeyValueRow, MoneyLabel, ProgressBar,
  Screen, SectionHeader, StatCard, StatGrid, useToast,
} from '@/design';
import { ROUTES, buildPath } from '@/app/routes';
import { GateScreen, useGameStatus } from './gate';
import { useClubLookup, type ClubLookup } from './clubs';
import { openTalks, useHeadroom, useOurNegotiations, windowState } from './engine';
import { PlayerRow } from './components/PlayerRow';
import { cyclesLeft, relativeCycle } from './format';

/**
 * The market's front door.
 *
 * It answers four questions before the player has to ask any of them: is the
 * window open, what can I spend, what am I already in the middle of, and what
 * is the rest of the league doing behind my back.
 */

const STAGE_TONE = {
  OPENING: 'neutral', CLUB_TALKS: 'info', PLAYER_TALKS: 'volt', AGENT_TALKS: 'warning',
  AGREED: 'positive', FAILED: 'danger', HIJACKED: 'danger',
} as const;

const STAGE_LABEL = {
  OPENING: 'Opening', CLUB_TALKS: 'Club talks', PLAYER_TALKS: 'Player talks',
  AGENT_TALKS: 'Agent talks', AGREED: 'Agreed', FAILED: 'Failed', HIJACKED: 'Hijacked',
} as const;

/* --- window ------------------------------------------------------------ */

const WindowBanner = memo(function WindowBanner({ state }: { state: GameState }): ReactNode {
  const window = windowState(state);
  return (
    <GlassPanel accent={window.open ? 'volt' : 'none'} padding="md">
      <div className="flex items-start gap-3">
        <span
          className={window.open ? 'mt-1 size-2 shrink-0 rounded-pill bg-volt' : 'mt-1 size-2 shrink-0 rounded-pill bg-ink-faint'}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p className="font-display text-[18px] font-bold text-ink">
            {window.open ? 'The window is open' : 'The window is shut'}
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-muted text-pretty">
            {window.open
              ? `You are in ${window.phaseLabel}, matchweek ${window.week} of ${window.totalWeeks}. ` +
                (window.closesWeek !== null
                  ? `Business closes when the calendar moves on after matchweek ${window.closesWeek}.`
                  : 'It stays open for the rest of the calendar.')
              : `You are in ${window.phaseLabel}, matchweek ${window.week} of ${window.totalWeeks}. ` +
                (window.opensWeek !== null
                  ? `The next window is matchweek ${window.opensWeek} — it opens because the calendar reaches it, not because a timer runs down.`
                  : 'No further window is scheduled this season.')}
          </p>
        </div>
      </div>
    </GlassPanel>
  );
});

/* --- negotiations ------------------------------------------------------ */

interface NegotiationRowProps {
  negotiation: Negotiation;
  playerName: string;
  cycle: number;
  onPress: (id: string) => void;
}

const NegotiationRow = memo(function NegotiationRow({
  negotiation, playerName, cycle, onPress,
}: NegotiationRowProps): ReactNode {
  const rivals = negotiation.rivalBidders.length;
  return (
    <KeyValueRow
      label={playerName}
      hint={`${negotiationSummary(negotiation)} ${rivals > 0 ? `· ${rivals} rival ${rivals === 1 ? 'bidder' : 'bidders'}` : ''}`}
      value={
        <span className="flex items-center gap-2">
          <GlassPill tone={STAGE_TONE[negotiation.stage]} size="xs" filled>
            {STAGE_LABEL[negotiation.stage]}
          </GlassPill>
          <span className="text-[11px] font-normal text-ink-dim">
            {cyclesLeft(cycle, negotiation.deadlineCycle)}
          </span>
        </span>
      }
      onPress={() => onPress(negotiation.id)}
      emphasis
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
        <p className="text-[13px] leading-snug text-ink text-pretty">{rumour.text}</p>
        <p className="mt-0.5 text-[11px] text-ink-dim">
          {credible ? 'Well sourced' : 'Unconfirmed'} · {clubName} · {relativeCycle(cycle, rumour.cycle)}
        </p>
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
}

const DoneDeal = memo(function DoneDeal({
  playerName, fee, fromClubId, toClubId, cycle, now, clubs,
}: DoneDealProps): ReactNode {
  const from = clubs(fromClubId);
  const to = clubs(toClubId);
  return (
    <div className="flex items-center gap-3 border-b border-white/[0.06] py-2.5 last:border-b-0">
      <div className="flex shrink-0 items-center gap-1">
        {from ? <ClubBadge visual={from.visual} size={20} flat label={from.name} /> : (
          <span className="text-[11px] text-ink-dim">Free</span>
        )}
        <span className="text-ink-dim" aria-hidden="true">→</span>
        {to && <ClubBadge visual={to.visual} size={20} flat label={to.name} />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold text-ink">{playerName}</p>
        <p className="text-[11px] text-ink-dim">{relativeCycle(now, cycle)}</p>
      </div>
      <MoneyLabel amount={fee} size="sm" />
    </div>
  );
});

/* --- screen ------------------------------------------------------------ */

function MarketView({ state }: { state: GameState }): ReactNode {
  const navigate = useNavigate();
  const toast = useToast();

  const clubs = useClubLookup(state);
  const headroom = useHeadroom(state);
  const negotiations = useOurNegotiations(state);
  const cycle = state.clock.cycle;

  const shortlist = useMemo(
    () =>
      state.scouting.shortlist
        .map((id) => state.players[id])
        .filter((p): p is NonNullable<typeof p> => Boolean(p)),
    [state.scouting.shortlist, state.players],
  );

  const rumours = useMemo(
    () => state.transfers.rumours.slice().sort((a, b) => b.cycle - a.cycle).slice(0, 8),
    [state.transfers.rumours],
  );

  const completed = useMemo(
    () => state.transfers.completed.slice(-8).reverse(),
    [state.transfers.completed],
  );

  const goToNegotiation = (id: string): void => {
    navigate(buildPath(ROUTES.negotiation, { negotiationId: id }));
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
      <StatGrid columns={2}>
        <StatCard
          label="Transfer budget"
          value={<MoneyLabel amount={headroom.transferBudget} size="lg" />}
          nested
          level={1}
          size="sm"
        />
        <StatCard
          label="Wage headroom"
          value={<MoneyLabel amount={headroom.wageFree} size="lg" />}
          nested
          level={1}
          size="sm"
          footnote="per week"
        />
      </StatGrid>
      <ProgressBar
        className="mt-3"
        value={Math.min(100, Math.round(headroom.usage * 100))}
        tone={headroom.usage > 1 ? 'danger' : headroom.usage > 0.85 ? 'warning' : 'positive'}
        label="Wage bill committed"
        valueLabel={`${Math.round(headroom.usage * 100)}%`}
        marker={100}
      />
      <p className="mt-2 text-[12px] leading-relaxed text-ink-dim text-pretty">
        A signing costs you twice: the fee comes out of the budget once, the wage comes out of
        every week that follows.
      </p>
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
      subtitle={`${windowState(state).phaseLabel} · matchweek ${state.clock.week}`}
      actions={
        <>
          <GlassIcon
            label="Search players"
            icon={<IconSearch />}
            variant="ghost"
            onClick={() => navigate(ROUTES.playerSearch)}
          />
          <GlassIcon
            label="Scouting"
            icon={<IconScout />}
            variant="ghost"
            onClick={() => navigate(ROUTES.scouting)}
          />
        </>
      }
      aside={
        <>
          {budgets}
          {rumourPanel}
        </>
      }
    >
      <WindowBanner state={state} />

      <div className="grid grid-cols-2 gap-3">
        <GlassButton variant="primary" icon={<IconSearch />} onClick={() => navigate(ROUTES.playerSearch)} block>
          Search players
        </GlassButton>
        <GlassButton variant="secondary" icon={<IconScout />} onClick={() => navigate(ROUTES.scouting)} block>
          Scouting
        </GlassButton>
      </div>

      <div className="md:hidden">{budgets}</div>

      <GlassPanel title="In the room" padding="md">
        {negotiations.length === 0 ? (
          <EmptyState
            size="sm"
            icon={<IconMarket />}
            title="No talks open"
            description="A transfer here is a conversation with a club, a player and an agent. Start one from a search result or your shortlist."
            action={
              <GlassButton variant="secondary" size="sm" onClick={() => navigate(ROUTES.playerSearch)}>
                Find someone
              </GlassButton>
            }
          />
        ) : (
          <div>
            {negotiations.map((negotiation) => (
              <NegotiationRow
                key={negotiation.id}
                negotiation={negotiation}
                playerName={state.players[negotiation.playerId]?.displayName ?? 'Unknown player'}
                cycle={cycle}
                onPress={goToNegotiation}
              />
            ))}
          </div>
        )}
      </GlassPanel>

      <GlassPanel padding="md">
        <SectionHeader
          title="Shortlist"
          subtitle={shortlist.length > 0 ? `${shortlist.length} watched` : undefined}
          action={
            shortlist.length > 0 ? (
              <span className="text-[12px] text-ink-dim">{shortlist.length}</span>
            ) : undefined
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
          <div>
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
              />
            ))}
          </div>
        )}
        <Divider className="my-3" />
        <p className="text-[12px] leading-relaxed text-ink-dim text-pretty">
          Rival clubs buy and sell whether or not you do. A player you watched all season can be
          gone by the time you decide.
        </p>
      </GlassPanel>
    </Screen>
  );
}

export function MarketScreen(): ReactNode {
  const gate = useGameStatus();
  if (gate.status !== 'ready') return <GateScreen gate={gate} title="Market" />;
  return <MarketView state={gate.state} />;
}
