import type { ClubId, FixtureId } from '../core/brand';
import type { GameState } from './state';
import type { AnyDomainEvent } from '../core/events';
import type { MatchResult } from '../matches/result';
import type { NewsStory, SocialPost, Objective } from './state';
import { Rng } from '../core/rng';
import { Ledger } from '../economy/ledger';
import { clamp } from '../core/math';
import { phaseForWeek } from '../league/fixtures';
import { computeStandings } from '../league/standings';
import { simulateMatch } from '../matches/simulator';
import { tickWorld } from '../simulation/worldTick';
import { runFinancialCycle } from '../economy/cycle';
import { updateRivalry, rivalryFor } from '../rivalries/rivalries';
import { rollObjectives, updateObjectiveProgress, applyObjectiveUpdates } from '../progression/objectives';
import { updateLegacy } from '../progression/legacy';
import { ContentRegistry, BASE_PACK, type CreatorSeasonConfigDef } from '../content';
import { applyMatchResult } from './applyResult';
import { buildMatchSetup } from './matchSetup';
import { GameEventFactory } from './eventFactory';
import { appendEvents, patchClub, patchPlayer } from './mutations';
import { clubCreators, recentForm } from './selectors';

/**
 * The cycle.
 *
 * One cycle is one matchweek, and it is the only unit of time the game has. The
 * world advances because the player completed a match, never because real days
 * elapsed — that is the central design decision separating this from a
 * live-service manager that holds progress hostage to a timer.
 *
 * Order matters and is not arbitrary:
 *   match results first, because everything downstream reacts to them;
 *   rivalries next, since they read the result and feed next week's atmosphere;
 *   finances, which need the attendance the match produced;
 *   the world tick, which needs the events the above generated;
 *   then objectives and legacy, which are pure consumers of the event stream.
 * Anything reading state before its producer has run will silently work on
 * last week's world.
 */

export interface AdvanceCycleOptions {
  readonly now: number;
  /**
   * The player's own match, already played live. When absent the player's
   * fixture is simulated like any other.
   */
  readonly playerResult?: MatchResult | null;
  readonly registry?: ContentRegistry;
  readonly ledger?: Ledger;
}

export interface CycleSummary {
  readonly week: number;
  readonly season: number;
  readonly matchesPlayed: number;
  readonly playerResult: 'W' | 'D' | 'L' | null;
  readonly income: number;
  readonly expenditure: number;
  readonly storiesPublished: number;
  readonly postsPublished: number;
  readonly objectivesCompleted: number;
  readonly seasonComplete: boolean;
  readonly notes: readonly string[];
}

export interface AdvanceCycleResult {
  readonly state: GameState;
  readonly events: readonly AnyDomainEvent[];
  readonly stories: readonly NewsStory[];
  readonly posts: readonly SocialPost[];
  readonly results: readonly MatchResult[];
  readonly summary: CycleSummary;
}

/** Fitness recovered between matchweeks, before facility effects. */
const BASE_RECOVERY = 26;

export function advanceCycle(state: GameState, opts: AdvanceCycleOptions): AdvanceCycleResult {
  const registry = opts.registry ?? defaultRegistry();
  const config = registry.seasonConfig() as CreatorSeasonConfigDef;
  const ledger = opts.ledger ?? Ledger.restore(state.ledger);
  const events = new GameEventFactory(state, opts.now);
  const rng = new Rng(`${state.seed}:cycle:${state.clock.cycle}`);

  let next = state;
  const allEvents: AnyDomainEvent[] = [];
  const results: MatchResult[] = [];
  const notes: string[] = [];

  const week = state.clock.week + 1;
  const season = state.seasons[state.currentSeasonId];
  const dueFixtures = Object.values(state.fixtures)
    .filter((f) => f.week === week && f.status === 'SCHEDULED')
    .sort((a, b) => (a.id < b.id ? -1 : 1));

  // --- 1. matches -------------------------------------------------------
  for (const fixture of dueFixtures) {
    const involvesPlayer =
      fixture.homeClubId === state.playerClubId || fixture.awayClubId === state.playerClubId;

    const result = involvesPlayer && opts.playerResult
      ? opts.playerResult
      : simulateMatch(buildMatchSetup(next, fixture, config));

    results.push(result);
    const applied = applyMatchResult(next, fixture, result, events);
    next = applied.state;
    allEvents.push(...applied.events);

    // --- 2. rivalry, which reads the result and feeds next week ---------
    const rivalry = rivalryFor(next, fixture.homeClubId, fixture.awayClubId);
    if (rivalry) {
      const stats = Object.values(result.playerStats);
      const decider = result.events
        .filter((e) => e.type === 'GOAL')
        .at(-1);
      const updated = updateRivalry(rivalry, {
        cycle: next.clock.cycle,
        homeClubId: fixture.homeClubId,
        awayClubId: fixture.awayClubId,
        homeScore: result.homeScore,
        awayScore: result.awayScore,
        redCards: stats.reduce((n, s) => n + s.redCards, 0),
        yellowCards: stats.reduce((n, s) => n + s.yellowCards, 0),
        // A goal past the 80% mark that changed the result is the kind of thing
        // a rivalry remembers for a decade.
        lateWinner:
          result.homeScore !== result.awayScore &&
          (decider?.minute ?? 0) > result.durationMinutes * 0.8,
        controversial: stats.reduce((n, s) => n + s.redCards, 0) > 0,
        mediaVolume: fixture.importance,
        importance: fixture.importance,
        incidents: [],
      }, rng.fork(`rivalry:${fixture.id}`));
      next = { ...next, rivalries: { ...next.rivalries, [rivalry.id]: updated } };
    }
  }

  // --- 3. recovery, suspensions and injuries tick down ------------------
  next = recoverSquads(next);

  // --- 4. finances for the player's club --------------------------------
  const playerClubId = state.playerClubId;
  const standings = computeStandings(
    next.competitions[next.currentCompetitionId]?.clubIds ?? [],
    Object.values(next.fixtures),
    {
      playoffSpots: next.competitions[next.currentCompetitionId]?.playoffSpots ?? 4,
      relegationSpots: next.competitions[next.currentCompetitionId]?.relegationSpots ?? 2,
    },
  );
  const position = standings.findIndex((r) => r.clubId === playerClubId) + 1;
  const playerFixture = dueFixtures.find(
    (f) => f.homeClubId === playerClubId || f.awayClubId === playerClubId,
  );
  const creators = clubCreators(next, playerClubId);

  const finance = runFinancialCycle(next, ledger, {
    clubId: playerClubId,
    cycle: next.clock.cycle,
    season: next.clock.season,
    at: opts.now,
    seed: next.seed,
    registry,
    rng: rng.fork('finance'),
    creatorReach: creators.reduce((total, c) => total + c.followers, 0),
    creatorFanConversion: creators.length
      ? creators.reduce((total, c) => total + c.attributes.fanConversion, 0) / creators.length / 100
      : 0,
    leaguePosition: position > 0 ? position : standings.length,
    leagueSize: standings.length,
    recentResults: recentForm(next, playerClubId, 5),
    ...(playerFixture?.homeClubId === playerClubId
      ? { homeFixtureImportance: playerFixture.importance }
      : {}),
    managerBrandBuilding: next.managers[next.playerManagerId]?.attributes.brandBuilding ?? 50,
  });

  next = {
    ...next,
    clubs: { ...next.clubs, [playerClubId]: finance.club },
    sponsors: finance.sponsors,
  };
  notes.push(...finance.notes);

  // --- 5. the world moves whether or not the player did anything --------
  const world = tickWorld(next, rng.fork('world'), {
    events: allEvents,
    at: opts.now,
    registry,
    ledger,
    transferWindowOpen: next.transfers.windowOpen,
    nextEventId: events.nextEventId,
  });
  next = world.state;
  allEvents.push(...world.events);

  // --- 6. objectives and legacy are pure consumers of the stream --------
  const objectiveUpdates = updateObjectiveProgress(next, allEvents);
  next = { ...next, objectives: applyObjectiveUpdates(next, objectiveUpdates) };

  const rolled = rollObjectives(next, rng.fork('objectives'), registry);
  if (rolled.length > 0) {
    next = {
      ...next,
      objectives: { ...next.objectives, active: [...next.objectives.active, ...rolled] },
    };
  }

  next = { ...next, legacy: updateLegacy(next, allEvents) };

  // --- 7. advance the clock --------------------------------------------
  const totalWeeks = season?.totalWeeks ?? 22;
  const seasonComplete = week >= totalWeeks;

  next = {
    ...next,
    clock: {
      cycle: next.clock.cycle + 1,
      season: next.clock.season,
      week,
      phase: phaseForWeek(week, totalWeeks),
      updatedAt: opts.now,
    },
    seasons: season
      ? {
          ...next.seasons,
          [season.id]: { ...season, currentWeek: week, phase: phaseForWeek(week, totalWeeks) },
        }
      : next.seasons,
    // The transfer window is a phase of the calendar, not a separate timer.
    transfers: {
      ...next.transfers,
      windowOpen: phaseForWeek(week, totalWeeks) === 'TRANSFER_WINDOW',
    },
    ledger: ledger.snapshot(),
    analytics: {
      ...next.analytics,
      matchesPlayed: next.analytics.matchesPlayed + results.length,
      lastSeenCycle: next.clock.cycle + 1,
    },
  };

  next = appendEvents(next, allEvents);
  next = events.commit(next);

  const playerMatchResult = playerFixture
    ? results.find((r) => r.matchId === `match_${playerFixture.id}`)
    : undefined;
  const playerOutcome = playerMatchResult
    ? playerMatchResult.homeScore === playerMatchResult.awayScore
      ? 'D'
      : (playerMatchResult.homeClubId === playerClubId) === (playerMatchResult.homeScore > playerMatchResult.awayScore)
        ? 'W'
        : 'L'
    : null;

  return {
    state: next,
    events: allEvents,
    stories: world.stories,
    posts: world.posts,
    results,
    summary: {
      week,
      season: next.clock.season,
      matchesPlayed: results.length,
      playerResult: playerOutcome,
      income: Object.values(finance.income).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0),
      expenditure: Object.values(finance.expenditure).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0),
      storiesPublished: world.stories.length,
      postsPublished: world.posts.length,
      objectivesCompleted: objectiveUpdates.filter((u) => u.justCompleted).length,
      seasonComplete,
      notes,
    },
  };
}

/**
 * Between-match recovery. Fitness returns, injuries heal, bans expire.
 *
 * This runs for every club in the league, not just the player's: an AI squad
 * that never recovered would decay across a season and the table would stop
 * meaning anything by March.
 */
function recoverSquads(state: GameState): GameState {
  let next = state;
  for (const player of Object.values(state.players)) {
    const recovering = player.injury
      ? { ...player.injury, weeksRemaining: player.injury.weeksRemaining - 1 }
      : null;
    const healed = recovering && recovering.weeksRemaining <= 0;

    next = patchPlayer(next, player.id, {
      fitness: clamp(player.fitness + BASE_RECOVERY, 0, 100),
      injury: healed ? null : recovering,
    });
  }
  return next;
}

let cachedRegistry: ContentRegistry | null = null;
function defaultRegistry(): ContentRegistry {
  if (!cachedRegistry) {
    cachedRegistry = new ContentRegistry();
    cachedRegistry.load(BASE_PACK);
  }
  return cachedRegistry;
}

export const isSeasonComplete = (state: GameState): boolean => {
  const season = state.seasons[state.currentSeasonId];
  return season ? season.currentWeek >= season.totalWeeks : false;
};

export type { ClubId, FixtureId, Objective };
