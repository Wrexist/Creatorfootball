import { memo, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  clubById, clubCreators, expiringContracts, injuredPlayers, lastFixture,
  leaguePosition, nextFixture, playerById, playerClub, recentForm, rivalryFor, squadOf,
  squadStrength, standings, starPlayer, topConcern, wageBudgetUsage,
  PHASE_LABELS, type ClubConcern, type Club, type Fixture, type GameState, type Objective,
  type Player, type StandingRow,
} from '@cf/engine';
import {
  CardRail, Divider, FormGuide, GlassButton, GlassCard, GlassPanel, GlassPill, KeyValueRow,
  MatchCard, MoneyLabel, NewsCard, PlayerCard, ProgressBar, RatingBadge, SectionHeader,
  SocialPost, StatCard, StatGrid, Screen, formatMoney,
  IconBall, IconCalendar, IconFans, IconFlame, IconInjury, IconMarket, IconSocial, IconStar,
  IconTrophy, IconWarning,
} from '@/design';
import { ROUTES, buildPath } from '@/app/routes';
import { useGameStore } from '@/state/gameStore';
import { ScreenStatus } from './status';

/**
 * Home.
 *
 * This screen is not a dashboard and must never become one. It answers one
 * question — *what happens next, and what should I care about?* — and it
 * answers it in order of urgency. The next fixture always leads, because
 * anticipation is the emotional engine of a management game; everything below
 * it is ranked by a relevance score and only the top few are shown. A card that
 * has nothing to say does not appear.
 *
 * Every number here comes from an engine selector. The only thing this file
 * computes is *which* of the engine's truths deserve the player's attention
 * this week.
 */

/* --- the storyline ---------------------------------------------------- */

interface Beat {
  readonly id: string;
  readonly icon: ReactNode;
  readonly text: string;
  readonly tone: 'neutral' | 'volt' | 'danger' | 'warning';
}

const streakWord = (form: readonly ('W' | 'D' | 'L')[]): string | null => {
  if (form.length < 3) return null;
  const last = form[form.length - 1];
  if (!last) return null;
  let run = 0;
  for (let i = form.length - 1; i >= 0 && form[i] === last; i--) run++;
  if (run < 3) return null;
  return last === 'W' ? `${run} straight wins` : last === 'L' ? `${run} straight defeats` : `${run} straight draws`;
};

/**
 * The two or three sentences that make the opponent a *specific* team this
 * week rather than a name and a badge. Everything is read from state — a
 * completed transfer, a rivalry record, a run of results — so the storyline can
 * never claim something that did not happen.
 */
function matchBeats(state: GameState, fixture: Fixture, us: Club, them: Club): Beat[] {
  const beats: Beat[] = [];
  const rivalry = rivalryFor(state, us.id, them.id);

  if (rivalry && (fixture.isDerby || rivalry.intensity >= 45)) {
    const ourWins = rivalry.clubAId === us.id ? rivalry.aWins : rivalry.bWins;
    const theirWins = rivalry.clubAId === us.id ? rivalry.bWins : rivalry.aWins;
    beats.push({
      id: 'rivalry',
      icon: <IconFlame size={15} />,
      tone: 'volt',
      text: rivalry.meetings > 0
        ? `${rivalry.origin} — ${ourWins}–${rivalry.draws}–${theirWins} in ${rivalry.meetings} meetings.`
        : rivalry.origin,
    });
  }

  const signing = state.transfers.completed
    .filter((t) => t.toClubId === them.id && state.clock.cycle - t.cycle <= 6)
    .sort((a, b) => b.fee - a.fee)[0];
  if (signing) {
    const player = playerById(state, signing.playerId);
    if (player) {
      beats.push({
        id: 'signing',
        icon: <IconMarket size={15} />,
        tone: 'warning',
        text: `${them.shortName} signed ${player.displayName} for ${formatMoney(signing.fee)} — ${player.position}, rated ${player.overall}.`,
      });
    }
  }

  const streak = streakWord(recentForm(state, them.id, 6));
  if (streak) {
    beats.push({
      id: 'streak',
      icon: <IconCalendar size={15} />,
      tone: streak.includes('wins') ? 'danger' : 'neutral',
      text: `They arrive on ${streak}.`,
    });
  }

  const danger = starPlayer(state, them.id);
  if (danger) {
    beats.push({
      id: 'danger',
      icon: <IconStar size={15} />,
      tone: 'neutral',
      text: `Their danger: ${danger.displayName}, ${danger.overall} rated, ${danger.form.goals} goals this season.`,
    });
  }

  const previous = Object.values(state.fixtures)
    .filter((f) => f.status === 'COMPLETED'
      && ((f.homeClubId === us.id && f.awayClubId === them.id) || (f.homeClubId === them.id && f.awayClubId === us.id)))
    .sort((a, b) => b.week - a.week)[0];
  if (previous && previous.homeScore !== null && previous.awayScore !== null) {
    const home = previous.homeClubId === us.id;
    const ours = home ? previous.homeScore : previous.awayScore;
    const theirs = home ? previous.awayScore : previous.homeScore;
    beats.push({
      id: 'lastmeeting',
      icon: <IconBall size={15} />,
      tone: ours > theirs ? 'volt' : ours < theirs ? 'danger' : 'neutral',
      text: `Last time out: ${ours}–${theirs} ${ours > theirs ? 'to you' : ours < theirs ? 'to them' : 'draw'}.`,
    });
  }

  return beats.slice(0, 3);
}

const BEAT_TONE: Record<Beat['tone'], string> = {
  neutral: 'text-ink-muted',
  volt: 'text-volt',
  danger: 'text-danger',
  warning: 'text-warning',
};

/* --- ranked cards ----------------------------------------------------- */

type CardKind = 'CONCERN' | 'POSITION' | 'OBJECTIVE' | 'TRANSFER' | 'STORY' | 'MOMENTUM' | 'SOCIAL';

interface RankedCard {
  readonly kind: CardKind;
  readonly score: number;
  readonly node: ReactNode;
}

const CONCERN_TONE: Record<ClubConcern['kind'], 'danger' | 'warning' | 'info' | 'neutral'> = {
  INJURY: 'danger', CONTRACT: 'warning', MORALE: 'warning',
  FINANCE: 'danger', FORM: 'warning', FANS: 'warning', NONE: 'neutral',
};

const ConcernCard = memo(function ConcernCard({
  concern, player, club, onPress,
}: {
  concern: ClubConcern;
  player: Player | undefined;
  club: Club;
  onPress: () => void;
}): ReactNode {
  const tone = CONCERN_TONE[concern.kind];
  return (
    <GlassPanel accent={tone === 'danger' ? 'danger' : 'volt'} padding="md">
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 shrink-0 ${tone === 'danger' ? 'text-danger' : 'text-warning'}`} aria-hidden="true">
          <IconWarning size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-dim">
            Needs you this week
          </p>
          <h3 className="mt-1 font-display text-[19px] font-bold leading-tight tracking-[-0.02em] text-ink text-pretty">
            {concern.headline}
          </h3>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-muted text-pretty">{concern.detail}</p>
        </div>
      </div>
      {player && (
        <div className="mt-3 border-t border-white/[0.07] pt-2">
          <PlayerCard
            player={player}
            club={club}
            variant="compact"
            onPress={onPress}
            trailing={<RatingBadge value={player.overall} size="sm" />}
          />
        </div>
      )}
      {!player && (
        <div className="mt-3">
          <GlassButton variant="secondary" size="sm" onClick={onPress}>Look into it</GlassButton>
        </div>
      )}
    </GlassPanel>
  );
});

const PositionCard = memo(function PositionCard({
  row, context, form, onPress,
}: {
  row: StandingRow | undefined;
  context: { position: number; pointsToAbove: number | null; pointsFromBelow: number | null; zone: StandingRow['zone'] };
  form: readonly ('W' | 'D' | 'L')[];
  onPress: () => void;
}): ReactNode {
  const above = context.pointsToAbove;
  const headline = above === null
    ? 'Top of the table. Everyone is chasing you.'
    : above <= 3
      ? `${above <= 1 ? 'One win' : `${above} points`} from ${ordinal(context.position - 1)}.`
      : `${above} points off ${ordinal(context.position - 1)}.`;
  const pressure = context.pointsFromBelow !== null && context.pointsFromBelow <= 2
    ? `Only ${context.pointsFromBelow} clear of ${ordinal(context.position + 1)}.`
    : null;

  return (
    <GlassCard onPress={onPress} padding="md">
      <div className="flex items-center gap-4">
        <div className="flex flex-col items-center">
          <span className="font-display text-[38px] font-bold leading-none tracking-[-0.04em] text-ink">
            {context.position}
          </span>
          <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-dim">
            {ZONE_LABEL[context.zone]}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold leading-snug text-ink text-pretty">{headline}</p>
          {pressure && <p className="mt-1 text-[12px] text-warning">{pressure}</p>}
          <div className="mt-2 flex items-center gap-3">
            <FormGuide results={form} slots={5} />
            {row && (
              <span className="tnum text-[12px] text-ink-muted">
                {row.points} pts · {row.played} played
              </span>
            )}
          </div>
        </div>
      </div>
    </GlassCard>
  );
});

const ZONE_LABEL: Record<StandingRow['zone'], string> = {
  CHAMPION: 'Champions', PLAYOFF: 'Playoffs', MID: 'Mid table', RELEGATION: 'Drop zone',
};

const ordinal = (n: number): string => {
  const rest = n % 100;
  if (rest >= 11 && rest <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
};

const ObjectiveCard = memo(function ObjectiveCard({
  objective, claimable, onPress,
}: {
  objective: Objective;
  claimable: boolean;
  onPress: () => void;
}): ReactNode {
  const reward = objective.rewards[0];
  return (
    <GlassCard onPress={onPress} padding="md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-dim">
            {claimable ? 'Ready to claim' : 'Closest objective'}
          </p>
          <h3 className="mt-1 text-[16px] font-semibold leading-snug text-ink text-pretty">{objective.title}</h3>
          <p className="mt-0.5 text-[12px] text-ink-muted text-pretty">{objective.description}</p>
        </div>
        <IconTrophy size={20} className={claimable ? 'shrink-0 text-volt' : 'shrink-0 text-ink-dim'} />
      </div>
      <div className="mt-3">
        <ProgressBar
          value={objective.progress}
          max={Math.max(1, objective.target)}
          tone={claimable ? 'volt' : 'positive'}
          valueLabel={`${Math.round(objective.progress)} / ${objective.target}`}
        />
      </div>
      {reward && (
        <p className="mt-2 text-[12px] text-volt">Reward: {reward.label}</p>
      )}
    </GlassCard>
  );
});

const MomentumCard = memo(function MomentumCard({
  club, strength, form, wageUsage,
}: {
  club: Club;
  strength: number;
  form: readonly ('W' | 'D' | 'L')[];
  wageUsage: number;
}): ReactNode {
  const mood = club.fans.sentiment - club.fans.expectation;
  return (
    <GlassPanel title="Club momentum" padding="md">
      <StatGrid columns={2} gap="sm">
        <StatCard
          nested
          level={1}
          size="sm"
          label="Squad rating"
          value={strength}
          icon={<IconStar size={13} />}
          footnote="Starting seven weighted"
        />
        <StatCard
          nested
          level={1}
          size="sm"
          label="Fan sentiment"
          value={Math.round(club.fans.sentiment)}
          suffix="%"
          delta={Math.round(mood)}
          icon={<IconFans size={13} />}
          footnote={mood >= 0 ? 'Above expectation' : 'Below expectation'}
        />
      </StatGrid>
      <div className="mt-3">
        <ProgressBar
          value={Math.min(150, wageUsage * 100)}
          max={150}
          marker={100}
          tone={wageUsage > 1 ? 'danger' : wageUsage > 0.9 ? 'warning' : 'positive'}
          label="Wage bill against budget"
          valueLabel={`${Math.round(wageUsage * 100)}%`}
        />
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-[12px] text-ink-muted">Recent form</span>
        <FormGuide results={form} slots={5} />
      </div>
    </GlassPanel>
  );
});

/* --- screen ----------------------------------------------------------- */

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
  const [expanded, setExpanded] = useState(false);
  const busy = useGameStore((s) => s.busy);

  const data = useMemo(() => {
    const club = playerClub(state);
    const fixture = nextFixture(state);
    const opponentId = fixture
      ? (fixture.homeClubId === club.id ? fixture.awayClubId : fixture.homeClubId)
      : null;
    const opponent = opponentId ? clubById(state, opponentId) : undefined;
    const table = standings(state);
    const context = leaguePosition(state);
    const concern = topConcern(state);
    const objectives = [...state.objectives.active]
      .filter((o) => o.status === 'ACTIVE' || o.status === 'COMPLETED')
      .sort((a, b) => {
        const aReady = a.status === 'COMPLETED' ? 1 : 0;
        const bReady = b.status === 'COMPLETED' ? 1 : 0;
        if (aReady !== bReady) return bReady - aReady;
        return (b.progress / Math.max(1, b.target)) - (a.progress / Math.max(1, a.target));
      });
    const listing = Object.values(state.transfers.listings)
      .filter((l) => l.availability !== 'UNAVAILABLE' && l.clubId !== club.id)
      .sort((a, b) => {
        const pa = playerById(state, a.playerId);
        const pb = playerById(state, b.playerId);
        return (pb?.overall ?? 0) - (pa?.overall ?? 0);
      })[0];
    const story = [...state.media.stories].sort(
      (a, b) => b.importance - a.importance || b.cycle - a.cycle,
    )[0];
    const post = [...state.social.posts].sort((a, b) => b.weight - a.weight || b.cycle - a.cycle)[0];

    return {
      club,
      fixture,
      opponent,
      table,
      context,
      concern,
      concernPlayer: concern.playerId ? playerById(state, concern.playerId) : undefined,
      objectives,
      listing,
      listingPlayer: listing ? playerById(state, listing.playerId) : undefined,
      story,
      post,
      form: recentForm(state, club.id, 5),
      strength: squadStrength(state, club.id),
      wageUsage: wageBudgetUsage(state, club.id),
      injuries: injuredPlayers(state, club.id).length,
      expiring: expiringContracts(state, club.id, 6).length,
      creators: clubCreators(state, club.id),
      squadSize: squadOf(state, club.id).length,
      previous: lastFixture(state, club.id),
      row: table.find((r) => r.clubId === club.id),
    };
  }, [state]);

  const { club, fixture, opponent } = data;
  const beats = useMemo(
    () => (fixture && opponent ? matchBeats(state, fixture, club, opponent) : []),
    [state, fixture, club, opponent],
  );

  const cards = useMemo<RankedCard[]>(() => {
    const out: RankedCard[] = [];

    if (data.concern.kind !== 'NONE') {
      out.push({
        kind: 'CONCERN',
        score: 60 + data.concern.severity,
        node: (
          <ConcernCard
            key="concern"
            concern={data.concern}
            player={data.concernPlayer}
            club={club}
            onPress={() => {
              if (data.concernPlayer) {
                navigate(buildPath(ROUTES.player, { playerId: data.concernPlayer.id }));
              } else if (data.concern.kind === 'FINANCE') {
                navigate(ROUTES.finances);
              } else if (data.concern.kind === 'FANS') {
                navigate(ROUTES.fans);
              } else {
                navigate(ROUTES.squad);
              }
            }}
          />
        ),
      });
    }

    if (data.context) {
      const tight = data.context.pointsToAbove !== null && data.context.pointsToAbove <= 3;
      const threatened = data.context.pointsFromBelow !== null && data.context.pointsFromBelow <= 2;
      out.push({
        kind: 'POSITION',
        score: 55 + (tight ? 35 : 0) + (threatened ? 25 : 0) + (data.context.zone === 'RELEGATION' ? 30 : 0),
        node: (
          <PositionCard
            key="position"
            row={data.row}
            context={data.context}
            form={data.form}
            onPress={() => navigate(ROUTES.standings)}
          />
        ),
      });
    }

    const objective = data.objectives[0];
    if (objective) {
      const ratio = objective.progress / Math.max(1, objective.target);
      const claimable = objective.status === 'COMPLETED';
      out.push({
        kind: 'OBJECTIVE',
        score: 40 + (claimable ? 70 : ratio * 45) + objective.importance * 4,
        node: (
          <ObjectiveCard
            key="objective"
            objective={objective}
            claimable={claimable}
            onPress={() => navigate(claimable ? ROUTES.rewards : ROUTES.objectives)}
          />
        ),
      });
    }

    if (data.listingPlayer && data.listing) {
      const wanted = data.listing.availability === 'WANTED_BY_OTHERS';
      out.push({
        kind: 'TRANSFER',
        score: 30 + data.listingPlayer.overall * 0.5 + (wanted ? 18 : 0) + (state.transfers.windowOpen ? 22 : 0),
        node: (
          <GlassPanel key="transfer" title="On the market" padding="md">
            <PlayerCard
              player={data.listingPlayer}
              variant="compact"
              onPress={(id) => navigate(buildPath(ROUTES.player, { playerId: id }))}
              trailing={<MoneyLabel amount={data.listing?.askingPrice ?? 0} size="sm" />}
            />
            <p className="mt-2 text-[12px] text-ink-muted text-pretty">
              {wanted
                ? `${data.listing.interestedClubIds.length} other clubs are circling. Wages ${formatMoney(data.listing.wageDemand)} a week.`
                : `Available now. Wages ${formatMoney(data.listing.wageDemand)} a week.`}
            </p>
            <div className="mt-3">
              <GlassButton variant="secondary" size="sm" onClick={() => navigate(ROUTES.market)}>
                Open the market
              </GlassButton>
            </div>
          </GlassPanel>
        ),
      });
    }

    if (data.story) {
      out.push({
        kind: 'STORY',
        score: 25 + data.story.importance * 12 - (state.clock.cycle - data.story.cycle) * 4,
        node: (
          <NewsCard
            key="story"
            story={data.story}
            variant={data.story.importance >= 4 ? 'lead' : 'standard'}
            onPress={() => navigate(ROUTES.media)}
          />
        ),
      });
    }

    if (data.post) {
      out.push({
        kind: 'SOCIAL',
        score: 18 + data.post.weight * 10 - (state.clock.cycle - data.post.cycle) * 5,
        node: (
          <SocialPost
            key="post"
            post={data.post}
            onPress={() => navigate(ROUTES.social)}
          />
        ),
      });
    }

    out.push({
      kind: 'MOMENTUM',
      score: 22 + (data.wageUsage > 1 ? 30 : 0) + (data.injuries > 2 ? 20 : 0),
      node: (
        <MomentumCard
          key="momentum"
          club={club}
          strength={data.strength}
          form={data.form}
          wageUsage={data.wageUsage}
        />
      ),
    });

    return out.sort((a, b) => b.score - a.score);
  }, [data, club, navigate, state.clock.cycle, state.transfers.windowOpen]);

  const visible = expanded ? cards : cards.slice(0, 4);
  const homeSide = fixture && clubById(state, fixture.homeClubId);
  const awaySide = fixture && clubById(state, fixture.awayClubId);

  return (
    <Screen
      title={club.shortName}
      subtitle={`${PHASE_LABELS[state.clock.phase]} · Season ${state.clock.season}, week ${Math.max(1, state.clock.week)}`}
      actions={
        <GlassPill tone={club.fans.sentiment >= 55 ? 'positive' : 'warning'} size="sm">
          {Math.round(club.fans.sentiment)}% mood
        </GlassPill>
      }
      aside={
        <>
          <GlassPanel title="This week" padding="md">
            <KeyValueRow label="Squad" value={data.squadSize} hint={`${data.injuries} unavailable`} onPress={() => navigate(ROUTES.squad)} />
            <KeyValueRow label="Expiring deals" value={data.expiring} hint="Within six weeks" onPress={() => navigate(ROUTES.squad)} />
            <KeyValueRow label="Creators" value={data.creators.length} hint="Attached to the club" onPress={() => navigate(ROUTES.club)} />
            <KeyValueRow label="Transfer budget" value={formatMoney(club.finance.transferBudget)} divided={false} onPress={() => navigate(ROUTES.finances)} />
          </GlassPanel>
          {data.creators.length > 0 && (
            <GlassPanel title="Your creators" padding="sm">
              <div className="flex flex-col gap-1">
                {data.creators.slice(0, 3).map((creator) => (
                  <KeyValueRow
                    key={creator.id}
                    label={creator.displayName}
                    hint={`@${creator.handle}`}
                    value={`${Math.round(creator.followers / 1000)}k`}
                    onPress={() => navigate(buildPath(ROUTES.creator, { creatorId: creator.id }))}
                  />
                ))}
              </div>
            </GlassPanel>
          )}
        </>
      }
    >
      {/* --- the hero: next match ------------------------------------- */}
      {fixture && opponent && homeSide && awaySide ? (
        <>
          <div className="flex items-baseline justify-between gap-3 pt-1">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-volt">Next match</h2>
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-dim">
              Week {fixture.week} · {fixture.homeClubId === club.id ? 'Home' : 'Away'}
            </span>
          </div>
          <MatchCard
            home={sideOf(homeSide, recentForm(state, homeSide.id, 3))}
            away={sideOf(awaySide, recentForm(state, awaySide.id, 3))}
            variant="hero"
            importance={fixture.importance}
            isDerby={fixture.isDerby}
            competitionLabel={state.competitions[fixture.competitionId]?.shortName ?? 'League'}
            status={fixture.stageLabel ?? `Week ${fixture.week}`}
            action={
              <GlassButton
                variant="primary"
                size="lg"
                block
                loading={busy}
                icon={<IconBall size={20} />}
                onClick={() => navigate(buildPath(ROUTES.matchPreview, { fixtureId: fixture.id }))}
              >
                Take charge
              </GlassButton>
            }
          />
          {beats.length > 0 && (
            <GlassPanel padding="md">
              <ul className="flex flex-col gap-2.5">
                {beats.map((beat) => (
                  <li key={beat.id} className="flex items-start gap-2.5">
                    <span className={`mt-0.5 shrink-0 ${BEAT_TONE[beat.tone]}`} aria-hidden="true">{beat.icon}</span>
                    <span className="text-[13px] leading-relaxed text-ink-muted text-pretty">{beat.text}</span>
                  </li>
                ))}
              </ul>
              <Divider className="my-3" />
              <div className="flex flex-wrap items-center gap-2">
                <GlassPill tone={fixture.importance >= 4 ? 'volt' : 'neutral'} size="sm">
                  Importance {fixture.importance}/5
                </GlassPill>
                <GlassPill size="sm">{opponent.city}</GlassPill>
                <GlassPill size="sm">Rep {Math.round(opponent.reputation)}</GlassPill>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <GlassButton size="sm" onClick={() => navigate(ROUTES.tactics)}>Set the team up</GlassButton>
                <GlassButton size="sm" variant="ghost" onClick={() => navigate(ROUTES.squad)}>Check the squad</GlassButton>
              </div>
            </GlassPanel>
          )}
        </>
      ) : (
        <GlassPanel accent="volt" padding="lg">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-volt">No fixture scheduled</p>
          <h2 className="mt-1 font-display text-[22px] font-bold tracking-[-0.03em] text-ink">
            {data.previous ? 'The season is done' : 'Pre-season'}
          </h2>
          <p className="mt-1 text-[13px] text-ink-muted text-pretty">
            {data.previous
              ? 'Every fixture has been played. Look back at the season, then push on to the next one.'
              : 'The fixture list has not started yet. Set your tactics and take a look at your squad.'}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <GlassButton variant="primary" onClick={() => navigate(ROUTES.seasonOverview)}>Season overview</GlassButton>
            <GlassButton onClick={() => navigate(ROUTES.tactics)}>Tactics</GlassButton>
          </div>
        </GlassPanel>
      )}

      {/* --- ranked cards --------------------------------------------- */}
      <SectionHeader
        title="What matters now"
        subtitle={expanded ? undefined : 'The few things worth your attention this week'}
        action={
          cards.length > 4 ? (
            <GlassButton variant="ghost" size="sm" onClick={() => setExpanded((v) => !v)}>
              {expanded ? 'Show less' : `Show all ${cards.length}`}
            </GlassButton>
          ) : undefined
        }
      />
      {visible.map((card) => card.node)}

      {data.injuries > 0 && (
        <GlassCard padding="sm" onPress={() => navigate(ROUTES.squad)}>
          <div className="flex items-center gap-2.5">
            <IconInjury size={17} className="shrink-0 text-danger" />
            <span className="text-[13px] text-ink-muted">
              {data.injuries} {data.injuries === 1 ? 'player is' : 'players are'} unavailable for selection.
            </span>
          </div>
        </GlassCard>
      )}

      {data.creators.length > 0 && (
        <>
          <SectionHeader title="Creator noise" subtitle="Who is talking about your club" onPress={() => navigate(ROUTES.social)} action="Feed" />
          <CardRail itemWidth={180} ariaLabel="Creators attached to your club">
            {data.creators.slice(0, 6).map((creator) => (
              <GlassCard key={creator.id} padding="sm" onPress={() => navigate(buildPath(ROUTES.creator, { creatorId: creator.id }))}>
                <p className="truncate text-[14px] font-semibold text-ink">{creator.displayName}</p>
                <p className="truncate text-[12px] text-ink-dim">@{creator.handle}</p>
                <div className="mt-2 flex items-center justify-between">
                  <GlassPill size="xs" tone={creator.clubSentiment >= 20 ? 'positive' : creator.clubSentiment <= -20 ? 'danger' : 'neutral'}>
                    {creator.clubSentiment >= 20 ? 'On side' : creator.clubSentiment <= -20 ? 'Critical' : 'Neutral'}
                  </GlassPill>
                  <span className="tnum text-[12px] text-ink-muted">{Math.round(creator.followers / 1000)}k</span>
                </div>
              </GlassCard>
            ))}
          </CardRail>
        </>
      )}

      <div className="pb-2">
        <GlassButton
          variant="ghost"
          size="sm"
          icon={<IconSocial size={16} />}
          onClick={() => navigate(ROUTES.social)}
        >
          Everything happening in the league
        </GlassButton>
      </div>
    </Screen>
  );
}

const sideOf = (club: Club, form: readonly ('W' | 'D' | 'L')[]) => ({
  clubId: club.id,
  name: club.name,
  shortName: club.shortName,
  abbreviation: club.abbreviation,
  visual: club.visual,
  form,
});
