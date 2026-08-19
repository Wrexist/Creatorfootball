import { memo, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BONUS_LABELS, clubTotalReach, playerClub, signSponsorOffer, sponsorIncomePerCycle,
  type GameState, type SponsorDeal, type SponsorOffer,
} from '@cf/engine';
import {
  Divider, EmptyState, GlassButton, GlassPanel, GlassPill, GlassSegmented, GlassSheet, KeyValueRow,
  ProgressBar, Screen, SectionHeader, StatCard, StatGrid, cn, formatCount, formatMoney,
  IconCheck, IconClock, IconSponsor, IconWarning,
} from '@/design';
import { ROUTES } from '@/app/routes';
import { useGameStore } from '@/state/gameStore';
import { ScreenStatus } from './status';
import { ledgerOf, postContextOf } from './bridge';

/**
 * Sponsors.
 *
 * Sponsorship is the dominant income line in this game and the screen says so
 * out loud: the first thing on it is the share of everything the club earns
 * that arrives from commercial partners. Everything else follows from that —
 * satisfaction is not a decoration, it is next season's contract; reach is not
 * vanity, it is the thing being sold.
 */

const SLOT_LABELS: Record<SponsorOffer['slot'], string> = {
  SHIRT: 'Shirt front', SLEEVE: 'Sleeve', STADIUM: 'Stadium naming',
  TRAINING: 'Training kit', CREATOR: 'Creator series',
};

const satisfactionTone = (value: number): 'positive' | 'warning' | 'danger' =>
  value >= 65 ? 'positive' : value >= 40 ? 'warning' : 'danger';

const satisfactionWord = (value: number): string =>
  value >= 80 ? 'Delighted' : value >= 65 ? 'Happy' : value >= 45 ? 'Watching closely' : value >= 30 ? 'Unhappy' : 'Ready to walk';

const DealCard = memo(function DealCard({ deal }: { deal: SponsorDeal }): ReactNode {
  const bonus = deal.bonusCondition;
  return (
    <GlassPanel padding="md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-[16px] font-semibold text-ink">{deal.name}</h3>
          <p className="mt-0.5 text-[12px] uppercase tracking-[0.12em] text-ink-dim">{SLOT_LABELS[deal.slot]}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="tnum font-display text-[20px] font-bold tracking-[-0.03em] text-ink">
            {formatMoney(deal.valuePerCycle)}
          </p>
          <p className="text-[11px] text-ink-dim">per cycle</p>
        </div>
      </div>

      <div className="mt-3">
        <ProgressBar
          label={`Satisfaction — ${satisfactionWord(deal.satisfaction)}`}
          value={deal.satisfaction}
          tone={satisfactionTone(deal.satisfaction)}
          valueLabel={`${Math.round(deal.satisfaction)}%`}
        />
        <p className="mt-1.5 text-[12px] leading-relaxed text-ink-muted text-pretty">
          {deal.satisfaction >= 65
            ? 'They are getting what they paid for. Renewal talks will go your way.'
            : deal.satisfaction >= 40
              ? 'Results, mood and reach growth are all short of what they expected. They will renew, but for less.'
              : 'This deal is in danger. Sponsors leave when the club stops delivering an audience.'}
        </p>
      </div>

      {bonus && (
        <div className="mt-3 rounded-md bg-volt/8 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[12px] font-semibold text-volt">
              Bonus: {formatMoney(bonus.reward)} for {bonus.target} {BONUS_LABELS[bonus.kind] ?? bonus.kind.toLowerCase()}
            </p>
            <span className="tnum text-[12px] text-ink-muted">{Math.round(bonus.progress)}/{bonus.target}</span>
          </div>
          <div className="mt-2">
            <ProgressBar value={bonus.progress} max={Math.max(1, bonus.target)} tone="volt" size="xs" />
          </div>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-white/[0.07] pt-2.5">
        <span className="text-[12px] text-ink-muted">Time remaining</span>
        <GlassPill size="sm" tone={deal.weeksRemaining <= 4 ? 'warning' : 'neutral'} icon={<IconClock />}>
          {deal.weeksRemaining} cycles
        </GlassPill>
      </div>
    </GlassPanel>
  );
});

const OfferCard = memo(function OfferCard({
  offer, cyclesLeft, onSign,
}: {
  offer: SponsorOffer;
  cyclesLeft: number;
  onSign: (offer: SponsorOffer) => void;
}): ReactNode {
  return (
    <GlassPanel padding="md" accent={offer.signingFee > 0 ? 'volt' : 'none'}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-[16px] font-semibold text-ink">{offer.name}</h3>
          <p className="mt-0.5 text-[12px] uppercase tracking-[0.12em] text-ink-dim">{SLOT_LABELS[offer.slot]}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="tnum font-display text-[20px] font-bold tracking-[-0.03em] text-volt">
            {formatMoney(offer.valuePerCycle)}
          </p>
          <p className="text-[11px] text-ink-dim">per cycle</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <GlassPill size="sm">{offer.weeks} cycles</GlassPill>
        {offer.signingFee > 0 && <GlassPill size="sm" tone="volt">{formatMoney(offer.signingFee)} up front</GlassPill>}
        <GlassPill size="sm" tone={cyclesLeft <= 1 ? 'danger' : 'neutral'}>
          {cyclesLeft <= 0 ? 'Expires now' : `Open ${cyclesLeft} more cycles`}
        </GlassPill>
      </div>

      {offer.bonusCondition && (
        <p className="mt-2.5 text-[12px] text-ink-muted text-pretty">
          Pays {formatMoney(offer.bonusCondition.reward)} extra for {offer.bonusCondition.target}{' '}
          {BONUS_LABELS[offer.bonusCondition.kind] ?? offer.bonusCondition.kind.toLowerCase()}.
        </p>
      )}

      {offer.requirements.length > 0 && (
        <p className="mt-2 text-[12px] text-ink-dim">Wants: {offer.requirements.join(' · ')}</p>
      )}

      <div className="mt-3">
        <GlassButton variant="secondary" size="sm" onClick={() => onSign(offer)}>
          Review the deal
        </GlassButton>
      </div>
    </GlassPanel>
  );
});

export function SponsorsScreen(): ReactNode {
  const phase = useGameStore((s) => s.phase);
  const error = useGameStore((s) => s.error);
  const state = useGameStore((s) => s.state);
  const navigate = useNavigate();

  if (!state) {
    return (
      <Screen title="Sponsors" onBack={() => navigate(ROUTES.club)}>
        <ScreenStatus phase={phase} error={error} onStart={() => navigate(ROUTES.onboarding)} />
      </Screen>
    );
  }
  return <SponsorsBody state={state} />;
}

function SponsorsBody({ state }: { state: GameState }): ReactNode {
  const navigate = useNavigate();
  const apply = useGameStore((s) => s.apply);
  const [tab, setTab] = useState<'active' | 'offers'>('active');
  const [pending, setPending] = useState<SponsorOffer | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const data = useMemo(() => {
    const club = playerClub(state);
    const ledger = ledgerOf(state);
    const season = ledger.seasonHistory(club.id).find((row) => row.season === state.clock.season);
    const byKind = season?.byKind ?? ledger.summaryFor(club.id, 0);

    let income = 0;
    let sponsorIncome = 0;
    for (const [kind, value] of Object.entries(byKind)) {
      if (value <= 0) continue;
      income += value;
      if (kind === 'SPONSOR_REVENUE') sponsorIncome += value;
    }

    return {
      club,
      perCycle: sponsorIncomePerCycle(state.sponsors),
      reach: clubTotalReach(state, club.id),
      income,
      sponsorIncome,
      share: income > 0 ? sponsorIncome / income : 0,
      active: state.sponsors.active,
      available: state.sponsors.available,
    };
  }, [state]);

  const sign = (offer: SponsorOffer): void => {
    let ok = false;
    let reason = '';
    apply((current) => {
      const club = playerClub(current);
      const ledger = ledgerOf(current);
      const result = signSponsorOffer(club, offer, ledger, postContextOf(current));
      ok = result.ok;
      reason = result.reason;
      if (!result.ok || !result.deal) return current;
      const deal = result.deal;
      return {
        ...current,
        ledger: ledger.snapshot(),
        sponsors: {
          active: [...current.sponsors.active, deal],
          available: current.sponsors.available.filter((o) => o.id !== offer.id),
        },
      };
    });
    setFeedback({ ok, text: reason });
    setPending(null);
    if (ok) setTab('active');
  };

  const list = tab === 'active' ? data.active : data.available;

  return (
    <Screen
      title="Sponsors"
      subtitle={`${formatMoney(data.perCycle)} a cycle from ${data.active.length} partner${data.active.length === 1 ? '' : 's'}`}
      onBack={() => navigate(ROUTES.club)}
      headerAccessory={
        <GlassSegmented
          value={tab}
          onChange={setTab}
          size="sm"
          aria-label="Sponsorship view"
          options={[
            { value: 'active', label: `Active (${data.active.length})` },
            { value: 'offers', label: `Offers (${data.available.length})` },
          ]}
        />
      }
      aside={
        <GlassPanel title="What sponsors buy" padding="md">
          <KeyValueRow label="Reach" value={formatCount(data.reach)} hint="Impressions, not supporters" />
          <KeyValueRow label="Reputation" value={Math.round(data.club.reputation)} hint="Gates which tiers will call" />
          <KeyValueRow label="Online followers" value={formatCount(data.club.fans.onlineFollowers)} divided={false} hint="The hard gate on big deals" />
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

      {/* --- the headline: sponsorship dominates the books ------------ */}
      <GlassPanel padding="md" accent="volt">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-volt">Where the money comes from</p>
        <p className="mt-1.5 font-display text-[28px] font-bold leading-none tracking-[-0.04em] text-ink">
          {Math.round(data.share * 100)}%
        </p>
        <p className="mt-1 text-[13px] text-ink-muted text-pretty">
          of everything {data.club.shortName} has earned this season came from sponsors — {formatMoney(data.sponsorIncome)} of{' '}
          {formatMoney(data.income)}. Gate receipts cannot replace this; reach can only grow it.
        </p>
        <div className="mt-3 flex h-2 overflow-hidden rounded-pill bg-white/[0.08]" aria-hidden="true">
          <span className="h-full bg-volt" style={{ width: `${Math.min(100, data.share * 100)}%` }} />
        </div>
      </GlassPanel>

      <StatGrid columns={2}>
        <StatCard label="Per cycle" value={<span>{formatMoney(data.perCycle)}</span>} icon={<IconSponsor size={13} />} footnote="Guaranteed commercial income" />
        <StatCard
          label="Mean satisfaction"
          value={data.active.length
            ? Math.round(data.active.reduce((sum, d) => sum + d.satisfaction, 0) / data.active.length)
            : 0}
          suffix="%"
          tone={data.active.length && data.active.some((d) => d.satisfaction < 40) ? 'danger' : 'positive'}
          footnote="Below 40% and they start leaving"
        />
      </StatGrid>

      <SectionHeader
        title={tab === 'active' ? 'Active deals' : 'On the table'}
        subtitle={tab === 'active'
          ? 'Satisfaction decides what they offer at renewal'
          : 'Offers expire. Reputation and followers decide which ones appear at all'}
      />

      {list.length === 0 ? (
        <EmptyState
          icon={<IconSponsor />}
          title={tab === 'active' ? 'No sponsors yet' : 'Nobody is calling'}
          description={tab === 'active'
            ? 'Sign a partner from the offers tab. Without commercial income the wage bill has nothing to sit on.'
            : 'Offers are gated on reputation and online followers, and the market goes quiet in a downturn. Win, entertain, and grow the audience — the phone rings again.'}
          action={
            <GlassButton
              variant="secondary"
              onClick={() => setTab(tab === 'active' ? 'offers' : 'active')}
            >
              {tab === 'active' ? 'See offers' : 'See active deals'}
            </GlassButton>
          }
        />
      ) : tab === 'active' ? (
        data.active.map((deal) => <DealCard key={deal.id} deal={deal} />)
      ) : (
        data.available.map((offer) => (
          <OfferCard
            key={offer.id}
            offer={offer}
            cyclesLeft={offer.expiresCycle - state.clock.cycle}
            onSign={setPending}
          />
        ))
      )}

      <GlassSheet
        open={pending !== null}
        onClose={() => setPending(null)}
        title={pending ? pending.name : ''}
        subtitle={pending ? SLOT_LABELS[pending.slot] : undefined}
        footer={
          pending ? (
            <div className="flex flex-col gap-2">
              <GlassButton variant="primary" block onClick={() => sign(pending)}>
                Sign for {formatMoney(pending.valuePerCycle)} a cycle
              </GlassButton>
              <GlassButton variant="ghost" block onClick={() => setPending(null)}>Leave it</GlassButton>
            </div>
          ) : undefined
        }
      >
        {pending && (
          <div className="flex flex-col gap-3">
            <GlassPanel nested level={1} padding="sm">
              <KeyValueRow label="Value" value={`${formatMoney(pending.valuePerCycle)}/cycle`} emphasis />
              <KeyValueRow label="Signing fee" value={formatMoney(pending.signingFee)} hint="Paid immediately" />
              <KeyValueRow label="Length" value={`${pending.weeks} cycles`} />
              <KeyValueRow
                label="Total if it runs"
                value={formatMoney(pending.signingFee + pending.valuePerCycle * pending.weeks)}
                divided={false}
              />
            </GlassPanel>
            {pending.bonusCondition && (
              <div className={cn('rounded-md bg-volt/8 p-3')}>
                <p className="text-[13px] font-semibold text-volt">
                  {formatMoney(pending.bonusCondition.reward)} bonus
                </p>
                <p className="mt-1 text-[12px] text-ink-muted text-pretty">
                  Paid if you reach {pending.bonusCondition.target}{' '}
                  {BONUS_LABELS[pending.bonusCondition.kind] ?? pending.bonusCondition.kind.toLowerCase()} while the deal runs.
                </p>
              </div>
            )}
            <Divider />
            <p className="text-[12px] leading-relaxed text-ink-muted text-pretty">
              Sponsors judge you on league position, fan sentiment and whether your reach is *growing*. A deal signed at a
              high after a good run will be renewed at a lower number if the club stands still.
            </p>
          </div>
        )}
      </GlassSheet>
    </Screen>
  );
}
