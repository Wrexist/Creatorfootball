import { memo, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  clubCreators, expiringContracts, injuredPlayers, playerById, recentForm, squadOf, squadStrength,
  wageBudgetUsage, PHASE_LABELS,
  type Club, type GameState, type Player,
} from '@cf/engine';
import {
  ClubBadge, CardRail, Divider, FormGuide, GlassButton, GlassCard, GlassPanel, GlassPill,
  HeroSurface, ListRow, NameText, PlayerPortrait, ProgressBar, RatingBadge, ScorePanel, Screen,
  StatBlock, Text, cn, formatCount, formatMoney,
  IconBall, IconCalendar, IconChevronRight, IconClock, IconFans, IconFlame, IconInjury, IconLeague, IconMarket,
  IconMoney, IconScout, IconSocial, IconStar, IconTraining, IconTrophy, IconWarning,
} from '@/design';
import { ROUTES, buildPath } from '@/app/routes';
import { useGameStore } from '@/state/gameStore';
import { ScreenStatus } from './status';
import { homeFeed, type Glyph, type PriorityCard, type Tone } from './priority';

/**
 * Home — the command centre.
 *
 * The screen answers four questions a first-time player should never have to
 * be told: *what is happening next, what should I do about it, why does it
 * matter, and what else is going on?* It answers them in that order and in
 * plain English, and it re-orders itself every week: the composition below is
 * driven entirely by `homeFeed()`, so a derby week, an injury crisis and an
 * open transfer window each produce a visibly different page from the same
 * code.
 *
 * The hierarchy is deliberately steep. One hero (the match), one primary action
 * ("Take charge"), one thing that needs the player *this week*, then a short
 * ranked list, then the week's numbers. Nothing on this screen exists to fill
 * space, and every figure comes from an engine selector.
 */

/* --- glyphs ----------------------------------------------------------- */

const GLYPHS: Record<Glyph, (props: { size?: number; className?: string }) => ReactNode> = {
  injury: IconInjury,
  contract: IconClock,
  money: IconMoney,
  fans: IconFans,
  trophy: IconTrophy,
  market: IconMarket,
  star: IconStar,
  flame: IconFlame,
  calendar: IconCalendar,
  ball: IconBall,
  warning: IconWarning,
  social: IconSocial,
  scout: IconScout,
  league: IconLeague,
  training: IconTraining,
};

const TONE_TEXT: Record<Tone, string> = {
  volt: 'text-volt',
  danger: 'text-danger',
  warning: 'text-warning',
  positive: 'text-positive',
  neutral: 'text-ink-muted',
};

const TONE_DOT: Record<Tone, string> = {
  volt: 'bg-volt',
  danger: 'bg-danger',
  warning: 'bg-warning',
  positive: 'bg-positive',
  neutral: 'bg-ink-faint',
};

/**
 * Depth in place of a coloured edge.
 *
 * These cards used to carry a hairline down the leading edge in the tone of the
 * news. Stacked down a feed that read as decoration rather than hierarchy, so
 * the card that needs the player now is lifted instead, and the tone survives
 * in its kicker.
 */
const ACCENT_EDGE: Record<Tone, string> = {
  volt: 'raised-strong raised-edge',
  danger: 'raised-strong raised-edge',
  warning: 'raised raised-edge',
  positive: 'raised raised-edge',
  neutral: 'raised',
};

const TONE_BLOCK: Record<Tone, 'volt' | 'danger' | 'warning' | 'positive' | 'neutral'> = {
  volt: 'volt', danger: 'danger', warning: 'warning', positive: 'positive', neutral: 'neutral',
};

/** The kicker has to match the news. "Needs you this week" over good news reads
 *  as a bug the first time a player sees it. */
const TONE_KICKER: Record<Tone, string> = {
  danger: 'Deal with this',
  warning: 'Keep an eye on this',
  volt: 'Worth doing now',
  positive: 'Good news',
  neutral: 'Worth knowing',
};

function Glyphs({ glyph, tone, size = 18 }: { glyph: Glyph; tone: Tone; size?: number }): ReactNode {
  const Icon = GLYPHS[glyph];
  return (
    <span className={TONE_TEXT[tone]} aria-hidden="true">
      <Icon size={size} />
    </span>
  );
}

/* --- the one thing ----------------------------------------------------- */

/**
 * The top-ranked card gets a treatment nothing else on the screen gets: its own
 * accent, a headline set at title size, the evidence (a face, a bar, a figure)
 * and an explicit button. Everything below it is a row. That gap *is* the
 * hierarchy — four equally-weighted cards would say four equally-urgent things,
 * which is the same as saying nothing.
 */
const LeadCard = memo(function LeadCard({
  card, player, club, onGo,
}: {
  card: PriorityCard;
  player: Player | undefined;
  club: Club;
  onGo: (route: string) => void;
}): ReactNode {
  return (
    // The whole card is the target rather than a small button inside it: one
    // action, a 200pt hit area, and nothing for the tab bar to sit on top of.
    <GlassCard
      onPress={() => onGo(card.route)}
      padding="md"
      className={cn('relative', ACCENT_EDGE[card.tone])}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0"><Glyphs glyph={card.glyph} tone={card.tone} size={20} /></span>
        <div className="min-w-0 flex-1">
          <Text role="label" className={TONE_TEXT[card.tone]}>{TONE_KICKER[card.tone]}</Text>
          <Text role="title" as="h3" className="mt-1 text-pretty">{card.headline}</Text>
          <Text role="caption" className="mt-1.5 text-pretty">{card.meaning}</Text>
        </div>
        {card.metric && (
          <div className="shrink-0">
            <StatBlock
              tone={TONE_BLOCK[card.tone]}
              label=""
              value={card.metric.value}
              caption={card.metric.caption}
            />
          </div>
        )}
      </div>

      {player && (
        <div className="mt-3 flex items-center gap-3 rounded-md bg-white/[0.04] p-2">
          <PlayerPortrait
            seed={player.portraitSeed}
            size={40}
            shape="squircle"
            colors={{ primary: club.visual.primary, secondary: club.visual.secondary }}
          />
          <div className="min-w-0 flex-1">
            <NameText name={player.displayName} role="bodyStrong" className="min-w-0" />
            <Text role="caption" className="mt-0.5 text-ink-dim">
              {player.position} · {player.age} years old
            </Text>
          </div>
          <RatingBadge value={player.overall} size="sm" />
        </div>
      )}

      {card.progress && (
        <div className="mt-3">
          <ProgressBar
            value={card.progress.value}
            max={card.progress.max}
            tone={card.tone === 'danger' ? 'danger' : card.tone === 'warning' ? 'warning' : 'volt'}
            valueLabel={card.progress.label}
          />
        </div>
      )}

      <div className="mt-3 flex items-center gap-1.5 text-volt">
        <Text role="label" as="span" className="text-volt">{card.actionLabel}</Text>
        <IconChevronRight size={15} aria-hidden="true" />
      </div>
    </GlassCard>
  );
});

/* --- the rest ---------------------------------------------------------- */

const FeedRow = memo(function FeedRow({
  card, divided, onGo,
}: {
  card: PriorityCard;
  divided: boolean;
  onGo: (route: string) => void;
}): ReactNode {
  return (
    <ListRow
      divided={divided}
      density="relaxed"
      onPress={() => onGo(card.route)}
      chevron
      leading={
        <span className="flex size-9 items-center justify-center rounded-pill bg-white/[0.06]">
          <Glyphs glyph={card.glyph} tone={card.tone} size={17} />
        </span>
      }
      title={
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-pill ${TONE_DOT[card.tone]}`} />
          <span className="min-w-0 text-pretty">{card.headline}</span>
        </span>
      }
      subtitle={<span className="text-pretty">{card.meaning}</span>}
    />
  );
});

/* --- screen ------------------------------------------------------------ */

export function HomeScreen(): ReactNode {
  const phase = useGameStore((s) => s.phase);
  const error = useGameStore((s) => s.error);
  const state = useGameStore((s) => s.state);
  const navigate = useNavigate();

  if (!state) {
    return (
      <Screen title="Home" subtitle="Your week at the club">
        <ScreenStatus phase={phase} error={error} onStart={() => navigate(ROUTES.onboarding)} />
      </Screen>
    );
  }
  return <HomeBody state={state} />;
}

function HomeBody({ state }: { state: GameState }): ReactNode {
  const navigate = useNavigate();
  const busy = useGameStore((s) => s.busy);
  const [expanded, setExpanded] = useState(false);

  const feed = useMemo(() => homeFeed(state), [state]);
  const club = feed.club;

  const week = useMemo(() => {
    const squad = squadOf(state, club.id);
    const injured = injuredPlayers(state, club.id);
    return {
      squad: squad.length,
      injured: injured.length,
      strength: squadStrength(state, club.id),
      expiring: expiringContracts(state, club.id, 6).length,
      wageUsage: wageBudgetUsage(state, club.id),
      creators: clubCreators(state, club.id),
      form: recentForm(state, club.id, 5),
      claimable: state.objectives.active.filter((o) => o.status === 'COMPLETED').length,
      active: state.objectives.active.filter((o) => o.status === 'ACTIVE').length,
    };
  }, [state, club.id]);

  const go = useMemo(() => (route: string) => navigate(route), [navigate]);
  const [lead, ...rest] = feed.cards;
  const leadPlayer = lead?.playerId ? playerById(state, lead.playerId as Player['id']) : undefined;
  const shown = expanded ? rest : rest.slice(0, 3);

  const sides = useMemo(() => {
    if (!feed.upcoming) return null;
    const { fixture, opponent, home } = feed.upcoming;
    const us = {
      name: club.name,
      shortName: club.shortName,
      abbreviation: club.abbreviation,
      color: club.visual.primary,
      emblem: <ClubBadge visual={club.visual} size={26} flat />,
    };
    const them = {
      name: opponent.name,
      shortName: opponent.shortName,
      abbreviation: opponent.abbreviation,
      color: opponent.visual.primary,
      emblem: <ClubBadge visual={opponent.visual} size={26} flat />,
    };
    return { home: home ? us : them, away: home ? them : us, fixture };
  }, [feed.upcoming, club]);

  const competition = feed.upcoming
    ? state.competitions[feed.upcoming.fixture.competitionId]?.shortName ?? 'League'
    : 'League';

  return (
    <Screen
      title={club.shortName}
      subtitle={`Season ${state.clock.season} · Week ${Math.max(1, state.clock.week)} · ${PHASE_LABELS[state.clock.phase]}`}
      leading={<ClubBadge visual={club.visual} size={30} label={club.name} />}
      aside={
        <>
          <GlassPanel title="This week" padding="md">
            <ListRow
              title="Squad"
              subtitle={week.injured > 0 ? `${week.injured} unavailable` : 'Everyone is fit'}
              trailing={<Text role="stat">{week.squad}</Text>}
              onPress={() => navigate(ROUTES.squad)}
              chevron
            />
            <ListRow
              title="Transfer budget"
              subtitle="What you can spend on fees"
              trailing={<Text role="stat">{formatMoney(club.finance.transferBudget)}</Text>}
              onPress={() => navigate(ROUTES.finances)}
              chevron
            />
            <ListRow
              divided={false}
              title="Objectives"
              subtitle={week.claimable > 0 ? `${week.claimable} ready to claim` : `${week.active} in progress`}
              trailing={<Text role="stat">{week.claimable + week.active}</Text>}
              onPress={() => navigate(week.claimable > 0 ? ROUTES.rewards : ROUTES.objectives)}
              chevron
            />
          </GlassPanel>
        </>
      }
    >
      {/* --- the hero ------------------------------------------------- */}
      {feed.lead.kind === 'RESULT' ? (
        <HeroSurface
          eyebrow={<span className="text-volt">Last result</span>}
          texture="stadium"
          bleed={feed.lead.outcome === 'W' ? club.visual.primary : undefined}
          padding="md"
        >
          <Text role="title" as="h2" className="text-pretty">{feed.lead.headline}</Text>
          <Text role="caption" className="mt-1.5 text-pretty">{feed.lead.meaning}</Text>
          <div className="mt-4">
            <ScorePanel
              size="lg"
              context={`${competition} · ${feed.lead.fixture.stageLabel ?? `Week ${feed.lead.fixture.week}`}`}
              status="Full time"
              home={{
                name: club.name,
                shortName: club.shortName,
                abbreviation: club.abbreviation,
                color: club.visual.primary,
                score: feed.lead.us,
                emblem: <ClubBadge visual={club.visual} size={26} flat />,
              }}
              away={{
                name: feed.lead.opponent.name,
                shortName: feed.lead.opponent.shortName,
                abbreviation: feed.lead.opponent.abbreviation,
                color: feed.lead.opponent.visual.primary,
                score: feed.lead.them,
                emblem: <ClubBadge visual={feed.lead.opponent.visual} size={26} flat />,
              }}
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {feed.lead.matchId && (
              <GlassButton
                variant="primary"
                onClick={() => navigate(buildPath(ROUTES.matchResult, { matchId: feed.lead.kind === 'RESULT' ? feed.lead.matchId ?? '' : '' }))}
              >
                See the report
              </GlassButton>
            )}
            <GlassButton variant="secondary" onClick={() => navigate(ROUTES.standings)}>The table</GlassButton>
          </div>
        </HeroSurface>
      ) : feed.lead.kind === 'MATCH' ? (
        <HeroSurface
          eyebrow={<span className="text-volt">Next match</span>}
          texture="stadium"
          bleed={feed.lead.opponent.visual.primary}
          padding="md"
        >
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <Text role="micro" as="p">
                {feed.lead.home ? 'At home to' : 'Away to'}
              </Text>
              {/* The opponent's name gets the full width of the hero. It is the
                  one thing the player has to read, so it is never abbreviated
                  here — the fixture bug below can wear the three letters. */}
              <NameText
                name={feed.lead.opponent.name}
                short={feed.lead.opponent.shortName}
                abbr={feed.lead.opponent.abbreviation}
                role="hero"
                lines={2}
                as="h2"
                className="mt-1"
              />
              <Text role="caption" className="mt-1.5">
                {competition} · {feed.lead.fixture.stageLabel ?? `Week ${feed.lead.fixture.week}`}
                {feed.lead.fixture.isDerby ? ' · Derby' : ''}
              </Text>
            </div>
            <ClubBadge visual={feed.lead.opponent.visual} size={56} label={feed.lead.opponent.name} />
          </div>
          <Text role="bodyStrong" as="p" className="mt-4 text-pretty">{feed.lead.stake}</Text>
          <div className="mt-4">
            <GlassButton
              variant="primary"
              size="lg"
              block
              loading={busy}
              icon={<IconBall size={20} />}
              onClick={() => navigate(buildPath(ROUTES.matchPreview, { fixtureId: feed.lead.kind === 'MATCH' ? feed.lead.fixture.id : '' }))}
            >
              Take charge
            </GlassButton>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <GlassButton size="sm" variant="secondary" block onClick={() => navigate(ROUTES.tactics)}>
              Set the team up
            </GlassButton>
            <GlassButton size="sm" variant="secondary" block onClick={() => navigate(ROUTES.squad)}>
              Check the squad
            </GlassButton>
          </div>
        </HeroSurface>
      ) : feed.lead.kind === 'IDLE' ? (
        <HeroSurface eyebrow="Where you are" texture="haze" padding="md">
          <Text role="title" as="h2">{feed.lead.headline}</Text>
          <Text role="caption" className="mt-1.5 text-pretty">{feed.lead.meaning}</Text>
          <div className="mt-4">
            <GlassButton variant="primary" onClick={() => navigate(feed.lead.kind === 'IDLE' ? feed.lead.route : ROUTES.squad)}>
              {feed.lead.actionLabel}
            </GlassButton>
          </div>
        </HeroSurface>
      ) : null}

      {/* --- the opponent, in three lines ----------------------------- */}
      {feed.lead.kind === 'MATCH' && feed.lead.beats.length > 0 && (
        <GlassPanel padding="md">
          <Text role="label" className="text-ink-dim">
            What you need to know about {feed.lead.opponent.shortName}
          </Text>
          <ul className="mt-2.5 flex flex-col gap-2.5">
            {feed.lead.beats.map((beat) => (
              <li key={beat.id} className="flex items-start gap-2.5">
                <span className="mt-0.5 shrink-0"><Glyphs glyph={beat.glyph} tone={beat.tone} size={15} /></span>
                <Text role="caption" as="span" className="text-pretty">{beat.text}</Text>
              </li>
            ))}
          </ul>
        </GlassPanel>
      )}

      {/* --- the next match, when a result took the hero -------------- */}
      {feed.lead.kind === 'RESULT' && sides && feed.upcoming && (
        <GlassCard padding="md" onPress={() => navigate(buildPath(ROUTES.matchPreview, { fixtureId: feed.upcoming?.fixture.id ?? '' }))}>
          <Text role="label" className="text-volt">Next match</Text>
          <div className="mt-2">
            <ScorePanel home={sides.home} away={sides.away} status="Kick off" context={`${competition} · ${feed.upcoming.home ? 'At home' : 'Away'}`} />
          </div>
          <div className="mt-3">
            <GlassButton
              variant="primary"
              size="lg"
              block
              loading={busy}
              icon={<IconBall size={20} />}
              onClick={() => navigate(buildPath(ROUTES.matchPreview, { fixtureId: feed.upcoming?.fixture.id ?? '' }))}
            >
              Take charge
            </GlassButton>
          </div>
        </GlassCard>
      )}

      {/* --- what matters now ----------------------------------------- */}
      {lead && (
        <>
          <div className="flex items-end justify-between gap-3 pt-1">
            <div className="min-w-0">
              <Text role="section" as="h2">What matters now</Text>
              <Text role="caption" className="mt-0.5 text-ink-dim">
                Ranked by how urgent it is and how much it changes your season
              </Text>
            </div>
          </div>
          <LeadCard card={lead} player={leadPlayer} club={club} onGo={go} />
        </>
      )}

      {shown.length > 0 && (
        <GlassPanel padding="sm">
          <div className="flex flex-col">
            {shown.map((card, index) => (
              <FeedRow
                key={card.id}
                card={card}
                divided={index !== shown.length - 1}
                onGo={go}
              />
            ))}
          </div>
        </GlassPanel>
      )}

      {rest.length > 3 && (
        <GlassButton variant="ghost" size="sm" onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Show less' : `Show ${rest.length - 3} more`}
        </GlassButton>
      )}

      {/* --- the week in numbers -------------------------------------- */}
      <div className="pt-1">
        <Text role="section" as="h2">Your club right now</Text>
        <Text role="caption" className="mt-0.5 text-ink-dim">
          The four numbers the rest of the game runs on
        </Text>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <StatBlock
          tone="volt"
          label="Squad rating"
          value={week.strength}
          caption={`${week.squad} players, ${week.injured} unavailable`}
        />
        <StatBlock
          tone={club.fans.sentiment >= 55 ? 'positive' : club.fans.sentiment >= 40 ? 'warning' : 'danger'}
          label="Fan mood"
          value={Math.round(club.fans.sentiment)}
          unit="/ 100"
          caption={club.fans.sentiment >= club.fans.expectation ? 'Ahead of what they expected' : 'Below what they expected'}
        />
        <StatBlock
          tone={week.wageUsage > 1 ? 'danger' : week.wageUsage > 0.9 ? 'warning' : 'neutral'}
          label="Wages used"
          value={Math.round(week.wageUsage * 100)}
          unit="%"
          caption="Of what the board allows"
        />
        <StatBlock
          tone="neutral"
          label="To spend"
          value={formatMoney(club.finance.transferBudget)}
          caption="Available for transfer fees"
        />
      </div>

      <GlassPanel padding="sm">
        <ListRow
          leading={<IconLeague size={18} className="text-ink-dim" />}
          title="Recent form"
          subtitle={week.form.length ? 'Your last five league results, oldest first' : 'No games played yet this season'}
          trailing={<FormGuide results={week.form} slots={5} />}
          onPress={() => navigate(ROUTES.fixtures)}
        />
        <ListRow
          leading={<IconClock size={18} className="text-ink-dim" />}
          title="Contracts running down"
          subtitle={week.expiring > 0 ? 'Renew them or they leave for nothing' : 'Nothing expiring in the next six weeks'}
          trailing={<Text role="stat" className={week.expiring > 0 ? 'text-warning' : undefined}>{week.expiring}</Text>}
          onPress={() => navigate(ROUTES.squad)}
          chevron
        />
        <ListRow
          divided={false}
          leading={<IconFans size={18} className="text-ink-dim" />}
          title="People following you"
          subtitle="Supporters plus everyone your creators reach"
          trailing={<Text role="stat">{formatCount(club.fans.onlineFollowers + club.fans.base)}</Text>}
          onPress={() => navigate(ROUTES.fans)}
          chevron
        />
      </GlassPanel>

      {/* --- creators --------------------------------------------------- */}
      {week.creators.length > 0 && (
        <>
          <div className="pt-1">
            <Text role="section" as="h2">Creators at your club</Text>
            <Text role="caption" className="mt-0.5 text-ink-dim">
              Their audience is what sponsors are actually buying
            </Text>
          </div>
          <CardRail itemWidth={190} ariaLabel="Creators attached to your club">
            {week.creators.slice(0, 6).map((creator) => (
              <GlassCard
                key={creator.id}
                padding="sm"
                onPress={() => navigate(buildPath(ROUTES.creator, { creatorId: creator.id }))}
              >
                <NameText name={creator.displayName} role="bodyStrong" />
                <Text role="caption" className="mt-0.5 text-ink-dim">@{creator.handle}</Text>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <GlassPill
                    size="xs"
                    tone={creator.clubSentiment >= 20 ? 'positive' : creator.clubSentiment <= -20 ? 'danger' : 'neutral'}
                  >
                    {creator.clubSentiment >= 20 ? 'On side' : creator.clubSentiment <= -20 ? 'Critical' : 'Neutral'}
                  </GlassPill>
                  <Text role="stat">{formatCount(creator.followers)}</Text>
                </div>
              </GlassCard>
            ))}
          </CardRail>
        </>
      )}

      <Divider />
      <div className="grid grid-cols-3 gap-2 pb-2">
        <GlassButton variant="ghost" size="sm" block icon={<IconSocial size={16} />} onClick={() => navigate(ROUTES.social)}>
          Feed
        </GlassButton>
        <GlassButton variant="ghost" size="sm" block icon={<IconLeague size={16} />} onClick={() => navigate(ROUTES.standings)}>
          Table
        </GlassButton>
        <GlassButton variant="ghost" size="sm" block icon={<IconTrophy size={16} />} onClick={() => navigate(ROUTES.objectives)}>
          Objectives
        </GlassButton>
      </div>
    </Screen>
  );
}
