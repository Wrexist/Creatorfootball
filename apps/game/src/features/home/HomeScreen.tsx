import { MembershipLaunchPrompt } from '@/features/progression/MembershipLaunchPrompt';
import { MemberInvite } from '@/features/progression/MemberInvite';
import { memo, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { GradualBlur } from '@/design/glass/GradualBlur';
import {
  clubCreators, expiringContracts, injuredPlayers, playerById, recentForm, squadOf, squadStrength,
  wageBudgetUsage, PHASE_LABELS,
  type Club, type GameState, type Player,
} from '@cf/engine';
import {
  ClubBadge, CardRail, FormGuide, GlassButton, GlassCard, GlassPanel,
  ListRow, NameText, PlayerPortrait, ProgressBar, RatingBadge, Screen,
  StatBlock, Text, cn, formatCount, formatMoney,
  IconBall, IconCalendar, IconChevronRight, IconClock, IconFans, IconFlame, IconInjury, IconLeague, IconMarket,
  IconMoney, IconScout, IconSocial, IconStar, IconTraining, IconTrophy, IconWarning,
} from '@/design';
import { ROUTES, buildPath } from '@/app/routes';
import { useGameStore } from '@/state/gameStore';
import { ScreenStatus } from './status';
import { ArtImage, TopClubBar, CharacterHero, ObjectAssetCard, ProgressRing, StoryCard } from '@/design/premium/components';
import { art, storyArt } from '@/design/art/manifest';
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
  const squad = squadOf(state, club.id);
  const average = (read: (player: Player) => number) => squad.length ? squad.reduce((sum, player) => sum + read(player), 0) / squad.length : 0;
  const [lead, ...rest] = feed.cards;
  const leadPlayer = lead?.playerId ? playerById(state, lead.playerId as Player['id']) : undefined;
  const upcoming = feed.upcoming;
  const competition = upcoming ? state.competitions[upcoming.fixture.competitionId]?.shortName ?? 'League' : 'Season journey';
  const news = state.media.stories[0];
  const go = (route: string) => navigate(route === ROUTES.rewards && state.objectives.active.some(o => o.status === 'COMPLETED') ? ROUTES.objectives : route);

  return <div className="cf-home-frame">
    <GradualBlur side="top" height="calc(var(--safe-top) + 28px)" className="cf-home-edge" />
    <div className="cf-home" data-testid="premium-home">
    <div className="cf-home-world">
      <ArtImage asset={art.office} crop="hero" eager className="cf-home-backdrop" />
      <TopClubBar state={state} club={club} onNavigate={go}/>
      <div className="cf-home-welcome">
        <div><h1>YOUR CLUB.<em>YOUR STORY.</em></h1><p>CREATORS BUILD LEGACIES</p></div>
        <CharacterHero manager={state.managers[state.playerManagerId]} className="cf-home-manager"/>
      </div>
      <section className="cf-match-card" aria-label="Next match">
        <span className="cf-eyebrow">{upcoming ? 'Next match' : 'Your next chapter'}</span>
        <p className="cf-match-context">{competition} · {upcoming ? `Week ${upcoming.fixture.week}` : PHASE_LABELS[state.clock.phase]}</p>
        {upcoming ? <>
          <div className="cf-match-sides">
            <div className="cf-match-team"><ClubBadge visual={club.visual} size={60}/><strong>{club.shortName}</strong><FormGuide results={recentForm(state, club.id, 5)} slots={5}/></div>
            <div className="cf-match-center"><strong>{upcoming.fixture.week > state.clock.week ? `${upcoming.fixture.week - state.clock.week} WK` : 'NEXT UP'}</strong><span>VS</span></div>
            <div className="cf-match-team"><ClubBadge visual={upcoming.opponent.visual} size={60}/><strong>{upcoming.opponent.shortName}</strong><FormGuide results={recentForm(state, upcoming.opponent.id, 5)} slots={5}/></div>
          </div>
          <p className="cf-match-stake">{upcoming.home ? 'Home ground' : 'Away day'} · {feed.lead.kind === 'MATCH' ? feed.lead.stake : 'Write the next chapter of your season.'}</p>
          <GlassButton variant="primary" block loading={busy} icon={<IconBall size={21}/>} iconRight={<IconChevronRight size={20}/>} onClick={() => navigate(buildPath(ROUTES.matchPreview, {fixtureId:upcoming.fixture.id}))}>Prepare Match</GlassButton>
        </> : feed.lead.kind === 'IDLE' ? <>
          <Text as="h2" role="title" className="my-3">{feed.lead.headline}</Text><p className="cf-match-stake">{feed.lead.meaning}</p>
          <GlassButton variant="primary" block onClick={() => feed.lead.kind === 'IDLE' && go(feed.lead.route)}>{feed.lead.actionLabel}</GlassButton>
        </> : <GlassButton variant="primary" block onClick={() => navigate(ROUTES.matchday)}>Continue season</GlassButton>}
      </section>
    </div>
    <div className="cf-home-body">
      <MembershipLaunchPrompt /><MemberInvite />
      {feed.lead.kind === 'RESULT' && <GlassCard onPress={() => feed.lead.kind === 'RESULT' && feed.lead.matchId && navigate(buildPath(ROUTES.matchResult,{matchId:feed.lead.matchId}))} padding="md">
        <Text role="label" className="text-volt">Last result · {feed.lead.us} – {feed.lead.them}</Text><Text role="section" as="h2" className="mt-1">{feed.lead.headline}</Text><Text role="caption" className="mt-1">{feed.lead.meaning}</Text>
      </GlassCard>}
      <section>
        <div className="cf-section-title"><div><h2>Manager’s desk</h2><p>Small decisions. A bigger tomorrow.</p></div></div>
        <div className="cf-desk">
          <ObjectAssetCard asset={art.tactics} title="Set the Team" description="Your starting XI" onClick={() => go(ROUTES.tactics)}/>
          <ObjectAssetCard asset={art.training} title="Training Plan" description="Build better players" onClick={() => go(ROUTES.training)}/>
          <ObjectAssetCard asset={art.scouting} title="Scout Report" description="Find your next star" onClick={() => go(ROUTES.scouting)}/>
        </div>
      </section>
      {lead && (lead.tone === 'danger' || lead.tone === 'warning') && <LeadCard card={lead} player={leadPlayer} club={club} onGo={go}/>}
      <section>
        <div className="cf-section-title"><div><h2>Club pulse</h2><p>A stronger club, together.</p></div><button onClick={() => go(ROUTES.club)}>View club →</button></div>
        <div className="cf-pulse"><ProgressRing value={average(p => p.mental.morale)} label="Morale"/><ProgressRing value={average(p => p.fitness)} label="Fitness"/><ProgressRing value={club.fans.sentiment} label="Supporters" tone="gold"/></div>
      </section>
      <section>
        <div className="cf-section-title"><div><h2>World moves</h2><p>News. Rivalries. Opportunities.</p></div><button onClick={() => go(ROUTES.media)}>View all →</button></div>
        <StoryCard asset={storyArt(news?.tags.join(' ') ?? 'matchday')} title={news?.headline ?? 'The season begins here.'} description={news?.body ?? `${club.name}. Your club, a bigger stage. Every decision shapes what happens next.`} eyebrow={`Season ${state.clock.season}`} onClick={() => go(ROUTES.media)}/>
      </section>
      <section className="cf-home-urgent">
        <div className="cf-section-title"><h2>What matters now</h2></div>
        {lead && lead.tone !== 'danger' && lead.tone !== 'warning' && <LeadCard card={lead} player={leadPlayer} club={club} onGo={go}/>}
        {rest.length > 0 && <GlassPanel padding="sm" className="mt-3">{(expanded ? rest : rest.slice(0,3)).map((card,index)=><FeedRow key={card.id} card={card} divided={index !== rest.length-1} onGo={go}/>)}</GlassPanel>}
        {rest.length > 3 && <GlassButton variant="ghost" block onClick={() => setExpanded(!expanded)}>{expanded ? 'Show less' : `Show ${rest.length-3} more`}</GlassButton>}
      </section>
      <GlassPanel padding="sm">
        <ListRow title="Transfer budget" subtitle="Available for player fees" trailing={<Text role="stat">{formatMoney(club.finance.transferBudget)}</Text>} onPress={() => go(ROUTES.finances)} chevron/>
        <ListRow title="Squad rating" subtitle={`${squad.length} players · ${injuredPlayers(state,club.id).length} injured`} trailing={<Text role="stat">{squadStrength(state,club.id)}</Text>} onPress={() => go(ROUTES.squad)} chevron/>
        <ListRow title="Wages used" subtitle={`${expiringContracts(state,club.id,6).length} contracts expiring within six weeks`} trailing={<Text role="stat">{Math.round(wageBudgetUsage(state,club.id)*100)}%</Text>} onPress={() => go(ROUTES.squad)} chevron/>
        <ListRow title="Your audience" subtitle="Supporters and online followers" trailing={<Text role="stat">{formatCount(club.fans.base+club.fans.onlineFollowers)}</Text>} onPress={() => go(ROUTES.fans)} chevron divided={false}/>
      </GlassPanel>
      {clubCreators(state,club.id).length > 0 && <section><div className="cf-section-title"><h2>Your creators</h2></div><CardRail itemWidth={190} ariaLabel="Creators attached to your club">{clubCreators(state,club.id).map(creator=><GlassCard key={creator.id} padding="md" onPress={() => go(buildPath(ROUTES.creator,{creatorId:creator.id}))}><NameText name={creator.displayName} role="bodyStrong"/><Text role="caption">@{creator.handle}</Text><Text role="stat" className="mt-2">{formatCount(creator.followers)}</Text></GlassCard>)}</CardRail></section>}
      <div className="grid grid-cols-3 gap-2"><GlassButton variant="ghost" onClick={() => go(ROUTES.social)}>Social</GlassButton><GlassButton variant="ghost" onClick={() => go(ROUTES.standings)}>League</GlassButton><GlassButton variant="ghost" onClick={() => go(ROUTES.objectives)}>Objectives</GlassButton></div>
    </div>
  </div></div>;
}
