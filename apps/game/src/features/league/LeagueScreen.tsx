import { useMemo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PHASE_LABELS, currentCompetition, nextFixture, rivalriesOf, rivalOpponent,
  type GameState, type NewsStory,
} from '@cf/engine';
import {
  ClubBadge, Divider, EmptyState, FormGuide, GlassButton, GlassPanel, GlassPill,
  HeroSurface, IconCalendar, IconFlame, IconLeague, IconTrophy, KeyValueRow, ListRow,
  NameText, Numeric, ProgressBar, Screen, SectionHeader, StatBlock, Text,
} from '@/design';
import { ROUTES, buildPath } from '@/app/routes';
import { GateScreen, useGameStatus } from './gate';
import { useClubLookup } from './clubs';
import {
  ZONE_LABEL, ZONE_MEANING, ZONE_TONE, phaseLabelOf, positionMeaning, seasonProgress,
  useDerbiesAhead, useLeagueNews, useOurForm, useSeasonShape, useTopScorers,
} from './data';
import { FixtureCard } from './components/FixtureCard';
import { StandingsTable } from './components/StandingsTable';

/**
 * The league hub.
 *
 * Read top to bottom it answers, in order: where am I and what does that mean,
 * who is next, how does the table look, what have I actually done, and what is
 * the league talking about. Nothing below the first screenful is required to
 * understand the first screenful — the hierarchy is progressive rather than a
 * dashboard of equal tiles, which is what the earlier version was.
 *
 * Every figure comes from `useSeasonShape`, which is a memo over engine
 * selectors. No component here works anything out.
 */

/* --- league news --------------------------------------------------------- */

function NewsRow({ story }: { story: NewsStory }): ReactNode {
  return (
    <article className="border-b border-white/[0.06] py-2.5 last:border-b-0">
      <Text role="micro" as="p">{story.outlet}</Text>
      <Text role="bodyStrong" as="p" className="mt-1 text-pretty">{story.headline}</Text>
      <Text role="caption" as="p" className="mt-0.5 text-pretty" clamp={3}>{story.body}</Text>
    </article>
  );
}

/* --- screen -------------------------------------------------------------- */

function LeagueView({ state }: { state: GameState }): ReactNode {
  const navigate = useNavigate();
  const clubs = useClubLookup(state);
  const shape = useSeasonShape(state);
  const form = useOurForm(state);
  const derbies = useDerbiesAhead(state, 2);
  const news = useLeagueNews(state, 2);
  const scorers = useTopScorers(state, 3);

  const competition = currentCompetition(state);
  const upcoming = useMemo(() => nextFixture(state), [state]);
  const rivalries = useMemo(() => rivalriesOf(state, state.playerClubId), [state]);
  const topRivalry = rivalries[0];
  const ourClub = state.clubs[state.playerClubId];

  const miniTable = useMemo(() => {
    const ourIndex = shape.table.findIndex((row) => row.clubId === state.playerClubId);
    if (ourIndex < 0) return shape.table.slice(0, 5);
    if (ourIndex < 4) return shape.table.slice(0, 5);
    return [...shape.table.slice(0, 3), ...shape.table.slice(ourIndex - 1, ourIndex + 2)];
  }, [shape.table, state.playerClubId]);

  const context = shape.context;
  const started = shape.played > 0;
  const ourRow = shape.ourRow;

  /* The lead. One number, one sentence, and the state of the season. */
  const lead = (
    <HeroSurface
      eyebrow={`Season ${state.clock.season}`}
      texture="pitch"
      {...(ourClub ? { bleed: ourClub.visual.primary } : {})}
      padding="md"
      trailing={
        context ? (
          <GlassPill tone={ZONE_TONE[context.zone]} size="sm" filled>
            {ZONE_LABEL[context.zone]}
          </GlassPill>
        ) : undefined
      }
      title={
        <span className="flex items-baseline gap-2.5">
          <Numeric role="giant">{context?.position ?? '—'}</Numeric>
          <span className="text-[15px] font-semibold text-ink-muted">
            of {shape.table.length}
          </span>
        </span>
      }
      subtitle={positionMeaning(shape)}
    >
      <ProgressBar
        value={shape.totalWeeks > 0 ? Math.round((state.clock.week / shape.totalWeeks) * 100) : 0}
        tone="volt"
        size="sm"
        label={`Matchweek ${state.clock.week} of ${shape.totalWeeks}`}
        valueLabel={seasonProgress(shape)}
      />
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <GlassPill size="xs">{PHASE_LABELS[state.clock.phase]}</GlassPill>
        {started && (
          <GlassPill size="xs" tone="volt">
            {shape.pointsAvailable} points still to play for
          </GlassPill>
        )}
      </div>
    </HeroSurface>
  );

  return (
    <Screen
      title="League"
      subtitle={
        competition
          ? `${competition.name} · ${PHASE_LABELS[state.clock.phase]}`
          : 'Your competition'
      }
      leading={
        ourClub ? <ClubBadge visual={ourClub.visual} size={30} label={ourClub.name} /> : undefined
      }
      aside={
        <>
          {topRivalry && (
            <GlassPanel title="Your biggest rivalry" padding="md" accent="danger">
              <NameText
                name={clubs.side(rivalOpponent(topRivalry, state.playerClubId)).name}
                short={clubs.side(rivalOpponent(topRivalry, state.playerClubId)).shortName}
                abbr={clubs.side(rivalOpponent(topRivalry, state.playerClubId)).abbreviation}
                role="title"
                lines={2}
              />
              <p className="mt-1 text-[13px] leading-relaxed text-ink-muted text-pretty">
                {topRivalry.origin}
              </p>
              <ProgressBar
                className="mt-3"
                value={topRivalry.intensity}
                tone="danger"
                label="Intensity"
                valueLabel={`${Math.round(topRivalry.intensity)}`}
              />
              <GlassButton
                className="mt-3"
                variant="secondary"
                size="sm"
                block
                onClick={() => navigate(ROUTES.rivalries)}
              >
                All rivalries
              </GlassButton>
            </GlassPanel>
          )}
        </>
      }
    >
      {lead}

      {/* --- who is next ------------------------------------------------- */}
      {upcoming ? (
        <FixtureCard
          fixture={upcoming}
          home={clubs.side(upcoming.homeClubId)}
          away={clubs.side(upcoming.awayClubId)}
          phaseLabel={phaseLabelOf(upcoming)}
          kicker="Next up"
          size="lg"
          {...(competition ? { competitionLabel: competition.name } : {})}
          onPress={() => navigate(buildPath(ROUTES.matchPreview, { fixtureId: upcoming.id }))}
        />
      ) : (
        <GlassPanel padding="md">
          <EmptyState
            size="sm"
            icon={<IconCalendar />}
            title="No fixture scheduled"
            description="Either the season has finished or the calendar has not been drawn yet."
            action={
              <GlassButton variant="secondary" size="sm" onClick={() => navigate(ROUTES.fixtures)}>
                Open the calendar
              </GlassButton>
            }
          />
        </GlassPanel>
      )}

      {/* --- the table ---------------------------------------------------- */}
      <GlassPanel padding="md">
        <SectionHeader
          title="The table"
          subtitle={
            context
              ? `You are ${ZONE_MEANING[context.zone].split(' — ')[0]}`
              : 'Where everyone stands'
          }
          action="Full table"
          onPress={() => navigate(ROUTES.standings)}
          className="mb-2.5"
        />
        {shape.table.length === 0 ? (
          <EmptyState
            size="sm"
            icon={<IconTrophy />}
            title="No table yet"
            description="The table appears once the competition has been set up and a fixture has been played."
          />
        ) : (
          <>
            <StandingsTable
              rows={miniTable}
              side={clubs.side}
              ourClubId={state.playerClubId}
              compact
              zones={false}
            />
            <Text role="caption" as="p" className="mt-3 text-ink-dim text-pretty">
              Top {shape.playoffSpots} go into the playoffs. Bottom {shape.relegationSpots} go
              down. Everything in between is mid-table.
            </Text>
          </>
        )}
      </GlassPanel>

      {/* --- what you have actually done ---------------------------------- */}
      {started && ourRow ? (
        <GlassPanel title="Your season so far" padding="md">
          <div className="grid grid-cols-2 gap-3">
            <StatBlock
              label="Points"
              value={ourRow.points}
              unit="pts"
              tone="volt"
              caption={`${ourRow.won} won, ${ourRow.drawn} drawn, ${ourRow.lost} lost`}
            />
            <StatBlock
              label="Goal difference"
              value={ourRow.goalDifference > 0 ? `+${ourRow.goalDifference}` : ourRow.goalDifference}
              tone={ourRow.goalDifference > 0 ? 'positive' : ourRow.goalDifference < 0 ? 'danger' : 'neutral'}
              caption={`Scored ${ourRow.goalsFor}, conceded ${ourRow.goalsAgainst}`}
            />
          </div>
          <Divider className="my-3" />
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <Text role="section" as="p">Recent form</Text>
              <Text role="caption" as="p" className="mt-0.5 text-ink-dim">
                Oldest on the left
              </Text>
            </div>
            <FormGuide results={form} slots={5} />
          </div>
        </GlassPanel>
      ) : (
        <GlassPanel title="Once the season starts" padding="md">
          <Text role="caption" as="p" className="text-pretty">
            Nothing has been played, so there is nothing to report yet. From your first result this
            screen fills in with:
          </Text>
          <ul className="mt-3 flex flex-col gap-2">
            {[
              ['Your record', 'Points, goal difference and the last five results.'],
              ['Top scorers', 'Who is scoring across the whole league, not just your squad.'],
              ['League news', 'What the press is making of the season.'],
            ].map(([title, detail]) => (
              <li key={title} className="flex gap-2.5">
                <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-pill bg-volt/60" />
                <span className="min-w-0">
                  <Text role="section" as="span" className="block">{title}</Text>
                  <Text role="caption" as="span" className="block text-pretty">{detail}</Text>
                </span>
              </li>
            ))}
          </ul>
        </GlassPanel>
      )}

      {/* --- top scorers -------------------------------------------------- */}
      {scorers.length > 0 && (
        <GlassPanel padding="md">
          <SectionHeader
            title="Top scorers"
            subtitle="Across the whole league"
            className="mb-2"
          />
          <div className="flex flex-col">
            {scorers.map((row, index) => (
              <ListRow
                key={row.player.id}
                density="compact"
                divided={index < scorers.length - 1}
                leading={
                  <Numeric role="stat" tone="dim" className="w-4 text-center">
                    {index + 1}
                  </Numeric>
                }
                title={
                  <NameText name={row.player.displayName} role="bodyStrong" lines={2} />
                }
                subtitle={row.clubId ? clubs.side(row.clubId).name : 'No club'}
                trailing={
                  <span className="text-right">
                    <Numeric role="stat" className="block">{row.goals}</Numeric>
                    <Text role="micro" as="span" className="mt-0.5 block">
                      {row.goals === 1 ? 'goal' : 'goals'} · {row.assists} a
                    </Text>
                  </span>
                }
              />
            ))}
          </div>
        </GlassPanel>
      )}

      {/* --- derbies ------------------------------------------------------ */}
      {derbies.length > 0 && (
        <GlassPanel padding="md" accent="danger">
          <SectionHeader
            title="Derbies ahead"
            subtitle="The weeks that decide how the season is remembered"
            action="Rivalries"
            onPress={() => navigate(ROUTES.rivalries)}
            className="mb-2"
          />
          <div className="flex flex-col">
            {derbies.map((derby, index) => (
              <ListRow
                key={derby.fixture.id}
                density="compact"
                divided={index < derbies.length - 1}
                leading={<ClubBadge visual={clubs.side(derby.opponentId).visual} size={26} flat />}
                title={
                  <NameText
                    name={clubs.side(derby.opponentId).name}
                    short={clubs.side(derby.opponentId).shortName}
                    abbr={clubs.side(derby.opponentId).abbreviation}
                    role="bodyStrong"
                    lines={2}
                  />
                }
                subtitle={`${derby.phaseLabel} · matchweek ${derby.fixture.week}`}
                trailing={
                  <GlassPill tone="danger" size="xs" icon={<IconFlame size={11} />}>
                    {derby.weeksAway === 0
                      ? 'This week'
                      : derby.weeksAway === 1
                        ? 'Next week'
                        : `${derby.weeksAway} weeks`}
                  </GlassPill>
                }
              />
            ))}
          </div>
        </GlassPanel>
      )}

      {/* --- news --------------------------------------------------------- */}
      {news.length > 0 && (
        <GlassPanel padding="md">
          <SectionHeader
            title="League news"
            subtitle="What the press is running"
            action="All media"
            onPress={() => navigate(ROUTES.media)}
            className="mb-1"
          />
          {news.map((story) => (
            <NewsRow key={story.id} story={story} />
          ))}
        </GlassPanel>
      )}

      {/* --- go deeper ---------------------------------------------------- */}
      <GlassPanel title="Go deeper" padding="md">
        <KeyValueRow
          label="Full table"
          hint="Every club, form, goal difference and what each zone is worth"
          value=""
          icon={<IconLeague />}
          onPress={() => navigate(ROUTES.standings)}
        />
        <KeyValueRow
          label="Fixtures"
          hint="The calendar, named week by week — Rivalry Week, Derby Week, the run-in"
          value=""
          icon={<IconCalendar />}
          onPress={() => navigate(ROUTES.fixtures)}
        />
        <KeyValueRow
          label="Rivalries"
          hint="Who hates you, why, and what it does to a match"
          value=""
          icon={<IconFlame />}
          onPress={() => navigate(ROUTES.rivalries)}
        />
        <KeyValueRow
          label="Season overview"
          hint="The whole year in one place, once there is a year to look back on"
          value=""
          icon={<IconTrophy />}
          onPress={() => navigate(ROUTES.seasonOverview)}
          divided={false}
        />
      </GlassPanel>
    </Screen>
  );
}

export function LeagueScreen(): ReactNode {
  const gate = useGameStatus();
  if (gate.status !== 'ready') return <GateScreen gate={gate} title="League" />;
  return <LeagueView state={gate.state} />;
}
