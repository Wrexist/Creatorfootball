import { useMemo } from 'react';
import {
  PHASE_LABELS,
  currentCompetition,
  currentSeason,
  fixturesFor,
  leaguePosition,
  recentForm,
  standings,
  type ClubId,
  type Fixture,
  type GameState,
  type NewsStory,
  type Player,
  type SeasonPhase,
  type StandingRow,
} from '@cf/engine';

/**
 * League reads.
 *
 * Every figure below either comes straight out of an engine selector or is an
 * arithmetic restatement of one (points still available, matches still to
 * play). Nothing here predicts anything — the moment a screen wants to know
 * *who will win*, that is a question for the simulation, not for a hook.
 */

export interface Matchweek {
  readonly week: number;
  readonly phase: SeasonPhase;
  readonly phaseLabel: string;
  readonly fixtures: readonly Fixture[];
  readonly played: boolean;
  readonly hasDerby: boolean;
  readonly isCurrent: boolean;
}

/**
 * The calendar, grouped and named.
 *
 * Matchweeks are labelled by the narrative phase the engine assigned them —
 * "Rivalry Week", "Playoff Push" — because a season made of twenty-two
 * anonymous numbers has no shape to remember afterwards.
 */
export function useCalendar(state: GameState): Matchweek[] {
  return useMemo(() => {
    const byWeek = new Map<number, Fixture[]>();
    for (const fixture of Object.values(state.fixtures)) {
      if (fixture.seasonId !== state.currentSeasonId) continue;
      const list = byWeek.get(fixture.week);
      if (list) list.push(fixture);
      else byWeek.set(fixture.week, [fixture]);
    }
    return [...byWeek.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([week, fixtures]) => {
        const sorted = fixtures
          .slice()
          .sort((a, b) => (a.id < b.id ? -1 : 1));
        const phase = sorted[0]?.phase ?? 'MID_SEASON_PUSH';
        return {
          week,
          phase,
          phaseLabel: PHASE_LABELS[phase],
          fixtures: sorted,
          played: sorted.every((f) => f.status === 'COMPLETED'),
          hasDerby: sorted.some((f) => f.isDerby),
          isCurrent: week === state.clock.week + 1 || (week === state.clock.week && !sorted.every((f) => f.status === 'COMPLETED')),
        };
      });
  }, [state.fixtures, state.currentSeasonId, state.clock.week]);
}

export interface SeasonShape {
  readonly table: readonly StandingRow[];
  readonly ourRow: StandingRow | undefined;
  readonly context: ReturnType<typeof leaguePosition>;
  readonly played: number;
  readonly totalMatches: number;
  readonly remaining: number;
  readonly pointsAvailable: number;
  /** Highest total we could still reach if we won everything left. */
  readonly ceiling: number;
  readonly leaderPoints: number;
  readonly playoffLinePoints: number;
  readonly relegationLinePoints: number;
  readonly playoffSpots: number;
  readonly relegationSpots: number;
  readonly weeksLeft: number;
  readonly totalWeeks: number;
}

export function useSeasonShape(state: GameState): SeasonShape {
  return useMemo(() => {
    const table = standings(state);
    const competition = currentCompetition(state);
    const season = currentSeason(state);
    const ourRow = table.find((row) => row.clubId === state.playerClubId);
    const rounds = competition?.rounds ?? 2;
    const totalMatches = Math.max(0, ((competition?.clubIds.length ?? 12) - 1) * rounds);
    const played = ourRow?.played ?? 0;
    const remaining = Math.max(0, totalMatches - played);
    const points = ourRow?.points ?? 0;
    const playoffSpots = competition?.playoffSpots ?? 4;
    const relegationSpots = competition?.relegationSpots ?? 2;

    const playoffRow = table[Math.min(table.length - 1, playoffSpots - 1)];
    const relegationRow = table[Math.max(0, table.length - relegationSpots)];

    return {
      table,
      ourRow,
      context: leaguePosition(state),
      played,
      totalMatches,
      remaining,
      pointsAvailable: remaining * 3,
      ceiling: points + remaining * 3,
      leaderPoints: table[0]?.points ?? 0,
      playoffLinePoints: playoffRow?.points ?? 0,
      relegationLinePoints: relegationRow?.points ?? 0,
      playoffSpots,
      relegationSpots,
      weeksLeft: Math.max(0, (season?.totalWeeks ?? 22) - state.clock.week),
      totalWeeks: season?.totalWeeks ?? 22,
    };
  }, [state]);
}

export interface ScorerRow {
  readonly player: Player;
  readonly clubId: ClubId | null;
  readonly goals: number;
  readonly assists: number;
}

/** League-wide top scorers. A tally of what happened, not a projection. */
export function useTopScorers(state: GameState, limit = 8): ScorerRow[] {
  return useMemo(() => {
    const rows: ScorerRow[] = [];
    for (const player of Object.values(state.players)) {
      if (player.form.goals <= 0) continue;
      rows.push({
        player,
        clubId: player.clubId,
        goals: player.form.goals,
        assists: player.form.assists,
      });
    }
    return rows
      .sort((a, b) => b.goals - a.goals || b.assists - a.assists)
      .slice(0, limit);
  }, [state.players, limit]);
}

export const ZONE_LABEL: Record<StandingRow['zone'], string> = {
  CHAMPION: 'Champion',
  PLAYOFF: 'Playoff',
  MID: 'Mid-table',
  RELEGATION: 'Relegation',
};

export const ZONE_TONE: Record<StandingRow['zone'], 'volt' | 'info' | 'neutral' | 'danger'> = {
  CHAMPION: 'volt',
  PLAYOFF: 'info',
  MID: 'neutral',
  RELEGATION: 'danger',
};

/**
 * The one line the standings screen leads with: what the table is actually
 * asking of you right now.
 */
export function positionAsk(shape: SeasonShape): string {
  const context = shape.context;
  if (!context) return 'Your club is not in this competition.';
  if (shape.played === 0) {
    return 'Nothing has been played yet. The table is a formality until the first whistle.';
  }
  if (context.zone === 'CHAMPION') {
    const cushion = context.pointsFromBelow;
    return cushion === null
      ? 'You are top of the table.'
      : `You are top by ${cushion} point${cushion === 1 ? '' : 's'} with ${shape.pointsAvailable} still to play for.`;
  }
  if (context.zone === 'RELEGATION') {
    const gap = context.pointsToAbove;
    return gap === null
      ? `You are bottom with ${shape.pointsAvailable} points still available.`
      : `You are in the drop zone, ${gap} point${gap === 1 ? '' : 's'} from safety, with ${shape.pointsAvailable} still to play for.`;
  }
  const gap = context.pointsToAbove;
  if (gap === null) return `You are ${context.position}th.`;
  if (gap === 0) return `You are ${context.position}th on points — only goal difference separates you from the place above.`;
  return `You are ${context.position}th, ${gap} point${gap === 1 ? '' : 's'} off the place above, with ${shape.pointsAvailable} still to play for.`;
}

/* --- the shape of the week ---------------------------------------------- */

/**
 * What the next fixture is called in the language of the season.
 *
 * The phase lives on the fixture the engine drew, so "Derby Week" is a fact
 * about the calendar rather than a label a screen decided to print.
 */
export const phaseLabelOf = (fixture: Fixture): string => PHASE_LABELS[fixture.phase];

export interface DerbyAhead {
  readonly fixture: Fixture;
  readonly opponentId: ClubId;
  readonly weeksAway: number;
  readonly phaseLabel: string;
}

/** Derbies still to come, nearest first. Ours only — a derby is personal. */
export function useDerbiesAhead(state: GameState, limit = 3): DerbyAhead[] {
  return useMemo(() => {
    const ours = state.playerClubId;
    return fixturesFor(state, ours)
      .filter((f) => f.status === 'SCHEDULED' && f.isDerby)
      .slice(0, limit)
      .map((fixture) => ({
        fixture,
        opponentId: fixture.homeClubId === ours ? fixture.awayClubId : fixture.homeClubId,
        weeksAway: Math.max(0, fixture.week - state.clock.week),
        phaseLabel: PHASE_LABELS[fixture.phase],
      }));
  }, [state, limit]);
}

/** Our last five results, newest last — the same read the home screen uses. */
export function useOurForm(state: GameState): ('W' | 'D' | 'L')[] {
  return useMemo(() => recentForm(state, state.playerClubId, 5), [state]);
}

/** Results from the matchweek just gone, across the whole league. */
export function useLastRound(state: GameState): Fixture[] {
  return useMemo(() => {
    const played = Object.values(state.fixtures).filter(
      (f) => f.seasonId === state.currentSeasonId && f.status === 'COMPLETED',
    );
    if (played.length === 0) return [];
    const latest = played.reduce((week, f) => Math.max(week, f.week), 0);
    return played.filter((f) => f.week === latest).sort((a, b) => (a.id < b.id ? -1 : 1));
  }, [state.fixtures, state.currentSeasonId]);
}

/** League news: the press, newest and most important first. */
export function useLeagueNews(state: GameState, limit = 3): NewsStory[] {
  return useMemo(
    () =>
      state.media.stories
        .slice()
        .sort((a, b) => b.cycle - a.cycle || b.importance - a.importance)
        .slice(0, limit),
    [state.media.stories, limit],
  );
}

/* --- plain language ------------------------------------------------------ */

/** What a zone is actually worth, in one clause a first-time player understands. */
export const ZONE_MEANING: Record<StandingRow['zone'], string> = {
  CHAMPION: 'top of the league — first place takes the title',
  PLAYOFF: 'inside the playoff places — finish here and you play for promotion',
  MID: 'mid-table — safe, but not playing for anything yet',
  RELEGATION: 'in the relegation places — finish here and you go down',
};

/**
 * The one-line answer to "how am I doing?", written for someone who has never
 * seen a league table before. Every figure in it comes from the engine.
 */
export function positionMeaning(shape: SeasonShape): string {
  const context = shape.context;
  if (!context) return 'Your club is not in this competition.';
  if (shape.played === 0) {
    return `Nothing has been played yet, so the table is only a list of the ${shape.table.length} clubs you are up against.`;
  }
  return `You are ${ZONE_MEANING[context.zone]}.`;
}

/** How much of the season is behind you, as a sentence rather than a bar. */
export function seasonProgress(shape: SeasonShape): string {
  if (shape.played === 0) return `${shape.totalMatches} matches to play`;
  if (shape.remaining === 0) return 'Every match played';
  return `${shape.played} played, ${shape.remaining} to go`;
}
