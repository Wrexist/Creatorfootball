import { memo, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  negotiationSummary,
  type ClubId,
  type ClubVisualIdentity,
  type GameState,
  type Negotiation,
  type NegotiationOutcome,
  type NegotiationStage,
  type NegotiationTerms,
  type Player,
  type PlayerId,
} from '@cf/engine';
import {
  ClubBadge, Divider, EmptyState, GlassButton, GlassPanel, GlassPill, KeyValueRow, MoneyLabel,
  PlayerCard, PlayerPortrait, PositionChip, ProgressBar, Screen, SectionHeader, SigningMoment,
  cn, useConfirm, useToast,
} from '@/design';
import { ROUTES } from '@/app/routes';
import { GateScreen, useGameStatus } from './gate';
import { useClubLookup } from './clubs';
import { abandonTalks, finaliseTransfer, submitTerms, useHeadroom } from './engine';
import { Transcript } from './components/Transcript';
import { OfferComposer } from './components/OfferComposer';
import { describeOffer, gapBetween, roleLabel } from './terms';
import { cyclesLeft, plainMoney } from './format';
import { KnownRating, useKnowledge } from './components/scouting';

/**
 * A transfer is a conversation.
 *
 * Everything on this screen exists to keep that true. The stages are visible so
 * the player knows who they are talking to right now; patience is a draining
 * meter rather than a hidden roll; rival bidders sit in the room with their
 * bids on show; and the whole thing is anchored by a transcript in which both
 * sides speak. Nothing here decides anything — every reply comes back from
 * `submitOffer` in the engine, headline and all.
 */

const STAGES: readonly NegotiationStage[] = ['CLUB_TALKS', 'PLAYER_TALKS', 'AGENT_TALKS', 'AGREED'];

const STAGE_COPY: Record<NegotiationStage, { title: string; who: string }> = {
  OPENING: { title: 'Opening', who: 'Making contact' },
  CLUB_TALKS: { title: 'Club talks', who: 'Agreeing a fee' },
  PLAYER_TALKS: { title: 'Player talks', who: 'Agreeing his terms' },
  AGENT_TALKS: { title: 'Agent talks', who: 'Settling the agent' },
  AGREED: { title: 'Agreed', who: 'Everything is signed off' },
  FAILED: { title: 'Over', who: 'Talks broke down' },
  HIJACKED: { title: 'Gone', who: 'Somebody else got him' },
};

/**
 * Every terminal outcome is a different story, and the player must be able to
 * tell them apart at a glance — "he lost interest" and "you were outbid" are
 * not the same failure and should never look the same.
 */
const OUTCOME_STORY: Partial<Record<NegotiationOutcome, {
  readonly kicker: string;
  readonly tone: 'danger' | 'warning' | 'positive';
  readonly lesson: string;
}>> = {
  REJECTED: {
    kicker: 'Rejected',
    tone: 'warning',
    lesson: 'The bid was not serious enough to be answered seriously. You can go again.',
  },
  COUNTERED: {
    kicker: 'Countered',
    tone: 'warning',
    lesson: 'They have moved. Now you decide whether their new number is one you can live with.',
  },
  DELAYED: {
    kicker: 'No answer',
    tone: 'warning',
    lesson: 'They are taking their time. The deadline is not.',
  },
  PLAYER_LOST_INTEREST: {
    kicker: 'He lost interest',
    tone: 'danger',
    lesson: 'Too many rounds of haggling. Nobody rejected you — he simply stopped caring.',
  },
  HIJACKED: {
    kicker: 'Hijacked',
    tone: 'danger',
    lesson: 'A rival went over the top of you while you were still talking. Speed is a term too.',
  },
  COLLAPSED: {
    kicker: 'Collapsed',
    tone: 'danger',
    lesson: 'Patience ran out on the other side of the table. This one is not coming back.',
  },
  AGREED: {
    kicker: 'Agreed',
    tone: 'positive',
    lesson: 'Fee, terms and agent all settled. Sign him.',
  },
};

/* --- the room ----------------------------------------------------------- */

const StageRail = memo(function StageRail({
  stage, hasSellingClub,
}: { stage: NegotiationStage; hasSellingClub: boolean }): ReactNode {
  const steps = hasSellingClub ? STAGES : STAGES.filter((s) => s !== 'CLUB_TALKS');
  const terminal = stage === 'FAILED' || stage === 'HIJACKED';
  const currentIndex = steps.indexOf(stage === 'OPENING' ? steps[0] as NegotiationStage : stage);

  return (
    <ol className="flex items-stretch gap-1.5" aria-label="Negotiation stages">
      {steps.map((step, index) => {
        const done = !terminal && currentIndex > index;
        const active = !terminal && currentIndex === index;
        return (
          <li key={step} className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span
              aria-hidden="true"
              className={cn(
                'h-1 rounded-pill',
                terminal ? 'bg-danger/40' : done ? 'bg-volt/60' : active ? 'bg-volt' : 'bg-white/10',
              )}
            />
            <span
              className={cn(
                'truncate text-[11px] font-semibold uppercase tracking-[0.1em]',
                active ? 'text-volt' : done ? 'text-ink-muted' : 'text-ink-dim',
              )}
            >
              {STAGE_COPY[step].title}
            </span>
            {active && (
              <span className="truncate text-[11px] text-ink-muted">{STAGE_COPY[step].who}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
});

interface CounterpartyProps {
  name: string;
  role: string;
  patience?: number;
  demandLabel: string;
  demandValue: ReactNode;
  offerLabel?: string;
  offerValue?: ReactNode;
  gapLabel?: string;
  gapTone?: 'positive' | 'warning' | 'danger' | 'neutral';
  active: boolean;
  badge?: ReactNode;
}

const Counterparty = memo(function Counterparty({
  name, role, patience, demandLabel, demandValue, offerLabel, offerValue, gapLabel, gapTone, active, badge,
}: CounterpartyProps): ReactNode {
  return (
    <div
      className={cn(
        'rounded-lg border p-3',
        active ? 'border-volt/40 bg-volt/[0.06]' : 'border-white/[0.08] bg-white/[0.03]',
      )}
    >
      <div className="flex items-center gap-2">
        {badge}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold text-ink">{name}</p>
          <p className="truncate text-[11px] uppercase tracking-[0.12em] text-ink-dim">{role}</p>
        </div>
        {active && <GlassPill tone="volt" size="xs" filled>In the room</GlassPill>}
      </div>

      {patience !== undefined && (
        <ProgressBar
          className="mt-3"
          value={Math.round(patience)}
          tone={patience > 60 ? 'positive' : patience > 30 ? 'warning' : 'danger'}
          size="xs"
          label="Patience"
          valueLabel={`${Math.round(patience)}%`}
        />
      )}

      <div className="mt-2">
        <KeyValueRow label={demandLabel} value={demandValue} divided={offerValue !== undefined} />
        {offerValue !== undefined && (
          <KeyValueRow label={offerLabel ?? 'Your offer'} value={offerValue} divided={false} />
        )}
      </div>

      {gapLabel && (
        <p
          className={cn(
            'mt-1 text-[12px] font-semibold',
            gapTone === 'positive' ? 'text-positive' : gapTone === 'warning' ? 'text-warning' : gapTone === 'danger' ? 'text-danger' : 'text-ink-dim',
          )}
        >
          {gapLabel}
        </p>
      )}
    </div>
  );
});

const RivalStrip = memo(function RivalStrip({
  bidders, names, ourFee,
}: {
  bidders: readonly { clubId: ClubId; bid: number }[];
  names: (id: ClubId) => { name: string; visual: ClubVisualIdentity } | undefined;
  ourFee: number;
}): ReactNode {
  if (bidders.length === 0) {
    return (
      <p className="text-[13px] leading-relaxed text-ink-muted text-pretty">
        Nobody else is in for him — yet. That will not last if you keep talking.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {bidders.map((bidder) => {
        const club = names(bidder.clubId);
        const ahead = bidder.bid > ourFee;
        return (
          <li key={bidder.clubId} className="flex items-center gap-3">
            {club && <ClubBadge visual={club.visual} size={22} flat label={club.name} />}
            <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink">
              {club?.name ?? 'A rival club'}
            </span>
            <MoneyLabel amount={bidder.bid} size="sm" />
            <GlassPill tone={ahead ? 'danger' : 'neutral'} size="xs" filled={ahead}>
              {ahead ? 'ahead of you' : 'behind you'}
            </GlassPill>
          </li>
        );
      })}
    </ul>
  );
});

/* --- screen ------------------------------------------------------------- */

export interface SignedDeal {
  readonly playerId: PlayerId;
  readonly fee: number;
  readonly wage: number;
  readonly years: number;
}

interface ViewProps {
  state: GameState;
  negotiation: Negotiation;
  player: Player;
  onSigned: (deal: SignedDeal) => void;
}

function NegotiationView({ state, negotiation, player, onSigned }: ViewProps): ReactNode {
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const clubs = useClubLookup(state);
  const headroom = useHeadroom(state);
  const knowledge = useKnowledge(player);

  const [composerOpen, setComposerOpen] = useState(false);
  const [lastOutcome, setLastOutcome] = useState<NegotiationOutcome | null>(null);
  const [lastHeadline, setLastHeadline] = useState<{ title: string; detail: string } | null>(null);

  const ourClub = state.clubs[state.playerClubId];
  const sellingClub = negotiation.fromClubId ? state.clubs[negotiation.fromClubId] : undefined;
  const ourName = ourClub?.shortName ?? 'Your club';
  const terminal = negotiation.stage === 'FAILED' || negotiation.stage === 'HIJACKED';
  const agreed = negotiation.stage === 'AGREED';

  const offer = negotiation.ourOffer;
  const demand = negotiation.theirDemand;
  const feeGap = gapBetween(offer?.fee ?? 0, demand.fee);
  const wageGap = gapBetween(offer?.wage ?? 0, demand.wage);

  const elapsed = state.clock.cycle - negotiation.startedCycle;
  const total = Math.max(1, negotiation.deadlineCycle - negotiation.startedCycle);

  const clubNames = useMemo(
    () => (id: ClubId) => {
      const card = clubs(id);
      return card ? { name: card.name, visual: card.visual } : undefined;
    },
    [clubs],
  );

  const story = lastOutcome ? OUTCOME_STORY[lastOutcome] : undefined;
  const fallbackStory = terminal
    ? OUTCOME_STORY[negotiation.stage === 'HIJACKED' ? 'HIJACKED' : 'COLLAPSED']
    : agreed
      ? OUTCOME_STORY.AGREED
      : undefined;
  const shownStory = story ?? fallbackStory;
  const lastBeat = negotiation.history[negotiation.history.length - 1];

  const handleSubmit = (terms: NegotiationTerms, agentFee: number): void => {
    setComposerOpen(false);
    const line = describeOffer(negotiation.stage, terms, agentFee, player.displayName);
    const step = submitTerms(negotiation.id, terms, { agentFee, ourLine: line });
    if (!step) {
      toast.error('That offer could not be sent', 'These talks are no longer live.');
      return;
    }
    setLastOutcome(step.outcome);
    setLastHeadline({ title: step.headline, detail: step.detail });
    const tone = step.outcome === 'ACCEPTED' || step.outcome === 'AGREED' ? 'success' : 'warning';
    if (tone === 'success') toast.success(step.headline, step.detail);
    else toast.warning(step.headline, step.detail);
  };

  const handleComplete = (): void => {
    const outcome = finaliseTransfer(negotiation.id);
    if (!outcome) {
      toast.error('The deal could not be settled', 'These talks are no longer live.');
      return;
    }
    if (!outcome.ok) {
      toast.error('The deal fell through', outcome.reason);
      return;
    }
    const terms = negotiation.ourOffer;
    // Handed upward: settling the transfer deletes this negotiation, and the
    // celebration must outlive the record that produced it.
    onSigned({
      playerId: player.id,
      fee: terms?.fee ?? 0,
      wage: terms?.wage ?? 0,
      years: terms?.years ?? 0,
    });
  };

  const handleWalkAway = async (): Promise<void> => {
    const ok = await confirm({
      title: `Walk away from ${player.displayName}?`,
      description: 'The file closes and the transcript goes with it. You can approach him again, but you start from nothing.',
      confirmLabel: 'Walk away',
      destructive: true,
    });
    if (!ok) return;
    abandonTalks(negotiation.id);
    navigate(ROUTES.market);
  };

  const composerInitial: NegotiationTerms = offer ?? demand;

  return (
    <Screen
      title={player.displayName}
      subtitle={
        sellingClub
          ? `Talks with ${sellingClub.name}`
          : 'Free agent — the deal lives or dies on the package'
      }
      onBack={() => navigate(ROUTES.market)}
      footer={
        agreed ? (
          <GlassButton variant="primary" size="lg" block onClick={handleComplete}>
            Complete the signing
          </GlassButton>
        ) : terminal ? (
          <GlassButton variant="secondary" size="lg" block onClick={() => { abandonTalks(negotiation.id); navigate(ROUTES.market); }}>
            Close the file
          </GlassButton>
        ) : (
          <div className="flex gap-3">
            <GlassButton variant="ghost" onClick={() => void handleWalkAway()}>
              Walk away
            </GlassButton>
            <GlassButton variant="primary" block onClick={() => setComposerOpen(true)}>
              {offer ? 'Make another offer' : 'Make an offer'}
            </GlassButton>
          </div>
        )
      }
      aside={
        <>
          <GlassPanel title="Who you are buying" padding="md">
            <div className="flex items-center gap-3">
              <PlayerPortrait seed={player.portraitSeed} size={56} shape="squircle" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[16px] font-semibold text-ink">{player.displayName}</p>
                <p className="mt-1 flex items-center gap-2 text-[12px] text-ink-muted">
                  <PositionChip position={player.position} size="xs" />
                  <span className="tnum">{player.age}</span>
                </p>
              </div>
              <KnownRating knowledge={knowledge} />
            </div>
            <Divider className="my-3" />
            <KeyValueRow label="Market value" value={<MoneyLabel amount={player.marketValue} size="md" />} />
            <KeyValueRow label="Scouting" value={knowledge.label} divided={false} />
          </GlassPanel>

          <GlassPanel title="Rivals in the race" padding="md">
            <RivalStrip
              bidders={negotiation.rivalBidders}
              names={clubNames}
              ourFee={offer?.fee ?? 0}
            />
          </GlassPanel>
        </>
      }
    >
      {shownStory && (
        <GlassPanel
          accent={shownStory.tone === 'positive' ? 'positive' : 'danger'}
          padding="md"
        >
          <div className="flex items-center gap-2">
            <GlassPill tone={shownStory.tone} size="xs" filled>{shownStory.kicker}</GlassPill>
            <span className="text-[11px] uppercase tracking-[0.14em] text-ink-dim">
              {STAGE_COPY[negotiation.stage].who}
            </span>
          </div>
          <p className="mt-2 font-display text-[19px] font-bold leading-tight text-ink text-pretty">
            {lastHeadline?.title ?? lastBeat?.text ?? STAGE_COPY[negotiation.stage].title}
          </p>
          {lastHeadline?.detail && (
            <p className="mt-1 text-[14px] leading-relaxed text-ink-muted text-pretty">
              {lastHeadline.detail}
            </p>
          )}
          <p className="mt-2 text-[13px] leading-relaxed text-ink-dim text-pretty">
            {shownStory.lesson}
          </p>
        </GlassPanel>
      )}

      <GlassPanel padding="md">
        <StageRail stage={negotiation.stage} hasSellingClub={sellingClub !== undefined} />
        <Divider className="my-3" />
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13px] text-ink-muted">{negotiationSummary(negotiation)}</p>
          <GlassPill tone={terminal ? 'danger' : elapsed / total > 0.66 ? 'warning' : 'neutral'} size="xs">
            {cyclesLeft(state.clock.cycle, negotiation.deadlineCycle)}
          </GlassPill>
        </div>
        <ProgressBar
          className="mt-2"
          value={Math.min(100, Math.round((elapsed / total) * 100))}
          tone={elapsed / total > 0.66 ? 'warning' : 'volt'}
          size="xs"
          label="Time spent talking"
        />
      </GlassPanel>

      <SectionHeader
        title="The room"
        subtitle="Three counterparties, three separate conversations"
      />

      <div className="grid gap-3 sm:grid-cols-2">
        {sellingClub && (
          <Counterparty
            name={sellingClub.name}
            role="Selling club"
            patience={negotiation.clubPatience}
            demandLabel="Their valuation"
            demandValue={<MoneyLabel amount={demand.fee} size="md" />}
            offerLabel="Your bid"
            offerValue={offer ? <MoneyLabel amount={offer.fee} size="md" /> : '—'}
            {...(offer ? { gapLabel: feeGap.label, gapTone: feeGap.tone } : {})}
            active={negotiation.stage === 'CLUB_TALKS' || negotiation.stage === 'OPENING'}
            badge={<ClubBadge visual={sellingClub.visual} size={28} flat label={sellingClub.name} />}
          />
        )}
        <Counterparty
          name={player.displayName}
          role={`Wants ${roleLabel(demand.role).toLowerCase()} minutes`}
          patience={negotiation.playerPatience}
          demandLabel="His demand"
          demandValue={
            <span className="flex flex-col items-end">
              <MoneyLabel amount={demand.wage} size="md" />
              <span className="text-[11px] font-normal text-ink-dim">
                per week · {demand.years} year{demand.years === 1 ? '' : 's'}
              </span>
            </span>
          }
          offerLabel="Your terms"
          offerValue={offer ? <MoneyLabel amount={offer.wage} size="md" /> : '—'}
          {...(offer ? { gapLabel: wageGap.label, gapTone: wageGap.tone } : {})}
          active={negotiation.stage === 'PLAYER_TALKS'}
          badge={<PlayerPortrait seed={player.portraitSeed} size={28} shape="circle" />}
        />
        <Counterparty
          name="The agent"
          role={`${negotiation.rivalBidders.length} rival${negotiation.rivalBidders.length === 1 ? '' : 's'} give him leverage`}
          demandLabel="His fee"
          demandValue={<MoneyLabel amount={negotiation.agentFeeDemand} size="md" />}
          active={negotiation.stage === 'AGENT_TALKS'}
          badge={
            <span
              aria-hidden="true"
              className="flex size-7 items-center justify-center rounded-pill bg-white/[0.08] text-[11px] font-bold text-ink-muted"
            >
              AG
            </span>
          }
        />
      </div>

      <GlassPanel title="Rivals in the race" padding="md" className="md:hidden">
        <RivalStrip bidders={negotiation.rivalBidders} names={clubNames} ourFee={offer?.fee ?? 0} />
      </GlassPanel>

      {offer && (
        <GlassPanel title="Terms on the table" padding="md">
          <KeyValueRow label="Fee" value={<MoneyLabel amount={offer.fee} size="md" />} />
          <KeyValueRow label="Wage" value={<MoneyLabel amount={offer.wage} size="md" />} hint="per week" />
          <KeyValueRow label="Length" value={`${offer.years} year${offer.years === 1 ? '' : 's'}`} />
          <KeyValueRow label="Role" value={roleLabel(offer.role)} />
          <KeyValueRow label="Signing-on fee" value={<MoneyLabel amount={offer.signingBonus} size="md" />} />
          <KeyValueRow
            label="Release clause"
            value={offer.releaseClause === null ? 'None' : plainMoney(offer.releaseClause)}
          />
          <KeyValueRow label="Goal bonus" value={<MoneyLabel amount={offer.goalBonus} size="md" />} />
          <KeyValueRow
            label="Appearance bonus"
            value={<MoneyLabel amount={offer.appearanceBonus} size="md" />}
            divided={false}
          />
        </GlassPanel>
      )}

      <GlassPanel title="How the talks have gone" padding="md">
        {negotiation.history.length === 0 ? (
          <EmptyState
            size="sm"
            title="Nothing said yet"
            description="Make an opening offer and the room will answer."
          />
        ) : (
          <Transcript beats={negotiation.history} ourActor={ourName} />
        )}
      </GlassPanel>

      <OfferComposer
        open={composerOpen}
        stage={negotiation.stage}
        playerName={player.displayName}
        initial={composerInitial}
        demand={demand}
        agentFeeDemand={negotiation.agentFeeDemand}
        transferBudget={headroom.transferBudget}
        wageHeadroom={headroom.wageFree}
        onClose={() => setComposerOpen(false)}
        onSubmit={handleSubmit}
      />
    </Screen>
  );
}

/**
 * The signing moment.
 *
 * One of the nine events licensed to take over the screen — and the reason it
 * is mounted at the route level rather than inside the negotiation view: the
 * moment `completeTransfer` settles, the negotiation record is gone, and a
 * celebration living inside that view would unmount before it played a frame.
 */
function SigningCelebration({
  state, deal, onDismiss,
}: { state: GameState; deal: SignedDeal; onDismiss: () => void }): ReactNode {
  const clubs = useClubLookup(state);
  const player = state.players[deal.playerId];
  const club = state.clubs[state.playerClubId];
  if (!player) return null;
  const card = clubs(state.playerClubId);
  return (
    <SigningMoment
      open
      onDismiss={onDismiss}
      playerName={player.displayName}
      card={<PlayerCard player={player} {...(card ? { club: card } : {})} variant="featured" />}
      fee={<MoneyLabel amount={deal.fee} size="lg" />}
      contract={`${plainMoney(deal.wage)} a week for ${deal.years} year${deal.years === 1 ? '' : 's'}`}
      clubName={club?.name ?? ''}
      {...(club ? { accent: club.visual.primary } : {})}
    />
  );
}

export function NegotiationScreen(): ReactNode {
  const gate = useGameStatus();
  const navigate = useNavigate();
  const params = useParams();
  const [signed, setSigned] = useState<SignedDeal | null>(null);

  if (gate.status !== 'ready') return <GateScreen gate={gate} title="Negotiation" />;

  const state = gate.state;
  const negotiationId = params.negotiationId ?? '';
  const negotiation = state.transfers.negotiations[negotiationId];
  const player = negotiation ? state.players[negotiation.playerId] : undefined;
  const celebration = signed ? (
    <SigningCelebration
      state={state}
      deal={signed}
      onDismiss={() => { setSigned(null); navigate(ROUTES.market); }}
    />
  ) : null;

  if (!negotiation || !player) {
    return (
      <Screen title="Negotiation" onBack={() => navigate(ROUTES.market)}>
        <EmptyState
          title="These talks are closed"
          description="The file has been filed away — either the deal was done, or it fell apart and the record went with it."
          action={
            <GlassButton variant="secondary" onClick={() => navigate(ROUTES.market)}>
              Back to the market
            </GlassButton>
          }
        />
        {celebration}
      </Screen>
    );
  }

  return (
    <>
      <NegotiationView
        state={state}
        negotiation={negotiation}
        player={player}
        onSigned={setSigned}
      />
      {celebration}
    </>
  );
}
