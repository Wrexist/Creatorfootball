import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  attendanceFor, clubCreators, clubReach, creatorReach, fanMood, matchdayRevenue, nextFixture,
  patchClub, playerClub, priceFactor, rngFrom,
  type Club, type GameState,
} from '@cf/engine';
import {
  Divider, GlassButton, GlassPanel, GlassPill, GlassSlider, KeyValueRow, ProgressBar, Screen,
  SectionHeader, StatCard, StatGrid, cn, formatCount, formatMoney,
  IconFans, IconSocial, IconStadium, IconWarning,
} from '@/design';
import { ROUTES } from '@/app/routes';
import { useGameStore } from '@/state/gameStore';
import { ScreenStatus } from './status';

/**
 * Fans.
 *
 * The honest version of the fan loop. Reach, fandom and a matchday gate are
 * three different quantities with lossy conversion between them, and this
 * screen refuses to blur them into one "popularity" number: roughly one percent
 * of the people you reach ever become supporters, and well under a fifth of
 * supporters come to a game. A club can be enormous online and play in front of
 * empty seats, and if that is happening the player should be able to see it in
 * one glance.
 *
 * Ticket price is a real decision and is presented as one. Every projection
 * below comes from the engine's own `priceFactor`, `attendanceFor` and
 * `matchdayRevenue` — the same functions matchday itself runs.
 */

const METERS = [
  { key: 'sentiment', label: 'Sentiment', hint: 'How they feel right now' },
  { key: 'trust', label: 'Trust', hint: 'Whether they believe in the project' },
  { key: 'excitement', label: 'Excitement', hint: 'Is it worth watching?' },
  { key: 'loyalty', label: 'Loyalty', hint: 'Will they stay through a bad run?' },
] as const;

const meterTone = (value: number): 'positive' | 'warning' | 'danger' =>
  value >= 60 ? 'positive' : value >= 35 ? 'warning' : 'danger';

/** The engine's fair price is wherever the price factor is neutral. Found, not hardcoded. */
function fairPrice(): number {
  let best = 10;
  let bestDelta = Infinity;
  for (let price = 2; price <= 120; price++) {
    const delta = Math.abs(priceFactor(price) - 1);
    if (delta < bestDelta) { bestDelta = delta; best = price; }
  }
  return best;
}

export function FansScreen(): ReactNode {
  const phase = useGameStore((s) => s.phase);
  const error = useGameStore((s) => s.error);
  const state = useGameStore((s) => s.state);
  const navigate = useNavigate();

  if (!state) {
    return (
      <Screen title="Fans" onBack={() => navigate(ROUTES.club)}>
        <ScreenStatus phase={phase} error={error} onStart={() => navigate(ROUTES.onboarding)} />
      </Screen>
    );
  }
  return <FansBody state={state} />;
}

function FansBody({ state }: { state: GameState }): ReactNode {
  const navigate = useNavigate();
  const apply = useGameStore((s) => s.apply);

  const club: Club = useMemo(() => playerClub(state), [state]);
  const [price, setPrice] = useState(() => Math.round(club.finance.ticketPrice));

  const data = useMemo(() => {
    const creators = clubCreators(state, club.id);
    const creatorImpressions = creators.reduce((sum, c) => sum + creatorReach(c), 0);
    const reach = clubReach(club.fans, creatorImpressions);
    const importance = nextFixture(state)?.importance ?? 3;
    // Deterministic preview: seeded from the save, so it never jitters between
    // renders. The real gate is drawn by the same function on matchday.
    const rng = rngFrom(`${state.seed}:fans-preview`);
    const currentAttendance = attendanceFor(club, importance, rng);
    return {
      creators,
      creatorImpressions,
      reach,
      importance,
      currentAttendance,
      currentRevenue: matchdayRevenue(club, currentAttendance),
      fill: club.stadium.capacity > 0 ? club.fans.lastAttendance / club.stadium.capacity : 0,
      reachToFandom: reach > 0 ? club.fans.base / reach : 0,
      fandomToGate: club.fans.base > 0 ? club.fans.lastAttendance / club.fans.base : 0,
      fair: fairPrice(),
    };
  }, [state, club]);

  const preview = useMemo(() => {
    const hypothetical: Club = {
      ...club,
      finance: { ...club.finance, ticketPrice: price },
    };
    const rng = rngFrom(`${state.seed}:fans-preview`);
    const attendance = attendanceFor(hypothetical, data.importance, rng);
    return {
      attendance,
      revenue: matchdayRevenue(hypothetical, attendance),
      factor: priceFactor(price),
    };
  }, [club, price, data.importance, state.seed]);

  const changed = price !== Math.round(club.finance.ticketPrice);
  const revenueDelta = preview.revenue.total - data.currentRevenue.total;
  const attendanceDelta = preview.attendance - data.currentAttendance;
  const gap = club.fans.sentiment - club.fans.expectation;

  const commitPrice = (): void => {
    apply((current) => patchClub(current, current.playerClubId, (c) => ({
      finance: { ...c.finance, ticketPrice: price },
    })));
  };

  return (
    <Screen
      title="Fans"
      subtitle={`${fanMood(club.fans)} · ${formatCount(club.fans.base)} supporters`}
      onBack={() => navigate(ROUTES.club)}
      aside={
        <GlassPanel title="The three numbers" padding="md">
          <KeyValueRow label="Reach" value={formatCount(data.reach)} hint="People you put content in front of" />
          <KeyValueRow label="Fandom" value={formatCount(club.fans.base)} hint="People who call it their club" />
          <KeyValueRow label="Last gate" value={club.fans.lastAttendance.toLocaleString('en-GB')} divided={false} hint="People who actually came" />
        </GlassPanel>
      }
    >
      {/* --- mood ----------------------------------------------------- */}
      <GlassPanel padding="lg" accent={gap >= 0 ? 'volt' : 'danger'}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-dim">The mood</p>
        <h2 className="mt-1 font-display text-[30px] font-bold leading-none tracking-[-0.04em] text-ink">
          {fanMood(club.fans)}
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-muted text-pretty">
          Sentiment sits at {Math.round(club.fans.sentiment)} against an expectation of {Math.round(club.fans.expectation)}.
          {gap >= 0
            ? ' You are giving them more than they were promised — and the bar rises with every win.'
            : ' They expected more than this. Expectation only falls slowly, and never below what you have already achieved.'}
        </p>
        <div className="mt-4">
          <ProgressBar
            label="Sentiment against expectation"
            value={club.fans.sentiment}
            marker={club.fans.expectation}
            tone={gap >= 0 ? 'positive' : 'danger'}
            size="md"
            valueLabel={`${gap >= 0 ? '+' : ''}${Math.round(gap)}`}
          />
        </div>
      </GlassPanel>

      <div className="grid grid-cols-2 gap-3">
        {METERS.map((meter) => (
          <GlassPanel key={meter.key} padding="sm" sheen={false}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-dim">{meter.label}</p>
            <p className="tnum mt-1 font-display text-[24px] font-bold leading-none tracking-[-0.03em] text-ink">
              {Math.round(club.fans[meter.key])}
            </p>
            <div className="mt-2">
              <ProgressBar value={club.fans[meter.key]} tone={meterTone(club.fans[meter.key])} size="xs" />
            </div>
            <p className="mt-1.5 text-[11px] text-ink-dim text-pretty">{meter.hint}</p>
          </GlassPanel>
        ))}
      </div>

      {/* --- the funnel ---------------------------------------------- */}
      <SectionHeader
        title="Reach is not fandom"
        subtitle="Three quantities, two lossy conversions. Nothing here is the same number twice."
      />
      <GlassPanel padding="md">
        <FunnelStage
          icon={<IconSocial size={18} />}
          label="Reach"
          value={formatCount(data.reach)}
          detail={`${formatCount(club.fans.onlineFollowers)} followers + ${formatCount(data.creatorImpressions)} creator impressions`}
        />
        <Conversion
          percent={data.reachToFandom}
          note="of the people you reach have become supporters"
        />
        <FunnelStage
          icon={<IconFans size={18} />}
          label="Fandom"
          value={formatCount(club.fans.base)}
          detail={`${formatCount(club.fans.seasonTicketHolders)} season-ticket holders`}
        />
        <Conversion
          percent={data.fandomToGate}
          note="of supporters were at the last home game"
        />
        <FunnelStage
          icon={<IconStadium size={18} />}
          label="Matchday"
          value={club.fans.lastAttendance.toLocaleString('en-GB')}
          detail={`${Math.round(data.fill * 100)}% of ${club.stadium.capacity.toLocaleString('en-GB')} seats`}
          last
        />
        <Divider className="my-3" />
        <p className="text-[12px] leading-relaxed text-ink-muted text-pretty">
          Audience does not become money one-for-one. Reach is what sponsors buy; the gate is the smallest of your three
          income lines and buys atmosphere rather than solvency. A huge following and an empty ground is a real, survivable
          state — it just is not a proud one.
        </p>
        {data.fill < 0.45 && (
          <div className="mt-3 flex items-start gap-2.5 rounded-md bg-warning/10 p-3">
            <IconWarning size={17} className="mt-0.5 shrink-0 text-warning" />
            <p className="text-[12px] leading-relaxed text-warning text-pretty">
              Under half the ground is turning up. Atmosphere feeds your home advantage, and empty seats are the story the
              media writes when results turn.
            </p>
          </div>
        )}
      </GlassPanel>

      {/* --- ticket price -------------------------------------------- */}
      <SectionHeader
        title="Ticket price"
        subtitle="Charge more per head, or fill the ground. You cannot do both."
      />
      <GlassPanel padding="md">
        <div className="flex items-baseline justify-between gap-3">
          <span className="tnum font-display text-[34px] font-bold leading-none tracking-[-0.04em] text-ink">
            {formatMoney(price, false)}
          </span>
          <GlassPill size="sm" tone={preview.factor >= 1 ? 'positive' : preview.factor >= 0.85 ? 'warning' : 'danger'}>
            Demand ×{preview.factor.toFixed(2)}
          </GlassPill>
        </div>
        <p className="mt-1 text-[12px] text-ink-dim">
          Fans think {formatMoney(data.fair, false)} is fair. Anything above that costs sentiment as well as attendance.
        </p>

        <div className="mt-4">
          <GlassSlider
            label="Price per ticket"
            value={price}
            min={Math.max(2, Math.round(data.fair * 0.3))}
            max={Math.round(data.fair * 2.6)}
            step={1}
            onChange={setPrice}
            formatValue={(v) => formatMoney(v, false)}
            marks={[
              { value: Math.max(2, Math.round(data.fair * 0.5)), label: 'Cheap' },
              { value: data.fair, label: 'Fair' },
              { value: Math.round(data.fair * 2), label: 'Steep' },
            ]}
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <StatCard
            nested
            level={1}
            size="sm"
            label="Projected gate"
            value={preview.attendance}
            delta={changed ? attendanceDelta : undefined}
            tone="info"
            footnote={`${Math.round((preview.attendance / Math.max(1, club.stadium.capacity)) * 100)}% full`}
          />
          <StatCard
            nested
            level={1}
            size="sm"
            label="Matchday income"
            value={<span>{formatMoney(preview.revenue.total)}</span>}
            delta={changed ? revenueDelta : undefined}
            deltaFormat={(v) => formatMoney(v)}
            tone="volt"
            footnote="Tickets, food, hospitality"
          />
        </div>

        <div className="mt-3">
          <KeyValueRow label="Tickets" value={formatMoney(preview.revenue.tickets)} />
          <KeyValueRow label="Concessions" value={formatMoney(preview.revenue.concessions)} />
          <KeyValueRow label="Hospitality" value={formatMoney(preview.revenue.hospitality)} />
          <KeyValueRow label="Matchday merchandise" value={formatMoney(preview.revenue.matchdayMerch)} divided={false} />
        </div>

        <p className={cn('mt-3 text-[12px] leading-relaxed text-pretty', price > data.fair ? 'text-warning' : 'text-ink-muted')}>
          {price > data.fair
            ? 'Above the fair price you take a sentiment penalty every week on top of the empty seats — and sentiment is what sponsors and attendance both read.'
            : price < data.fair
              ? 'Below the fair price the ground fills and the mood lifts, and you are leaving money on the table every week.'
              : 'Priced exactly where fans expect. Neither a bonus nor a penalty.'}
        </p>

        <div className="mt-4 flex gap-2">
          <GlassButton variant="primary" disabled={!changed} onClick={commitPrice}>
            {changed ? 'Set this price' : 'Price unchanged'}
          </GlassButton>
          {changed && (
            <GlassButton variant="ghost" onClick={() => setPrice(Math.round(club.finance.ticketPrice))}>
              Reset
            </GlassButton>
          )}
        </div>
      </GlassPanel>

      <StatGrid columns={2}>
        <StatCard label="Season tickets" value={club.fans.seasonTicketHolders} footnote="A soft floor, not a guarantee" />
        <StatCard label="Online followers" value={<span>{formatCount(club.fans.onlineFollowers)}</span>} footnote="Churns every week" tone="info" />
      </StatGrid>
    </Screen>
  );
}

function FunnelStage({
  icon, label, value, detail, last = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  last?: boolean;
}): ReactNode {
  return (
    <div className={cn('flex items-center gap-3', !last && 'pb-1')}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-pill bg-white/[0.06] text-ink-dim" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-dim">{label}</p>
        <p className="tnum font-display text-[20px] font-bold leading-tight tracking-[-0.03em] text-ink">{value}</p>
        <p className="truncate text-[11px] text-ink-dim">{detail}</p>
      </div>
    </div>
  );
}

function Conversion({ percent, note }: { percent: number; note: string }): ReactNode {
  const shown = percent >= 0.1 ? `${Math.round(percent * 100)}%` : `${(percent * 100).toFixed(1)}%`;
  return (
    <div className="my-1 flex items-center gap-3 pl-4">
      <span className="h-8 w-px bg-white/[0.12]" aria-hidden="true" />
      <p className="text-[12px] text-ink-muted">
        <span className="tnum font-semibold text-volt">{shown}</span> {note}
      </p>
    </div>
  );
}
