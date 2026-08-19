import type { ClubId, EventId, PlayerId } from '../core/brand';
import type { AnyDomainEvent, EntityRef, EventImportance } from '../core/events';
import type { Fixture } from '../league/types';
import type { GameState } from '../game/state';
import { points } from '../clubs/club';
import { mean } from '../core/math';
import { formatMoney } from '../economy/ledger';
import { RIVALRY_BALANCE } from '../rivalries/balance';
import { EMERGENT_BALANCE } from './balance';
import type { ContentHook, HookFacts, SocialPostKind, TokenMap } from './ports';
import { sentimentBand } from './templating';

/**
 * Emergent story detection.
 *
 * Nothing here is a scripted narrative. Each detector is a query over what has
 * actually accumulated — fixtures, the event journal, player stats, rivalry
 * temperature, the record book — and fires only when the pattern is really
 * there. That is what makes the payoff feel earned: the game noticed something
 * true about *your* save rather than playing a cutscene on schedule.
 *
 * Every detector must anchor to a real event id. A pattern we cannot trace to
 * an event is not promoted, because a post without a source is a bug.
 */

export type EmergentKind =
  | 'DERBY_KING' | 'CLEAN_SHEET_RUN' | 'FLOP_SIGNING' | 'BREAKOUT_ARC'
  | 'UNBEATEN_RUN' | 'WINLESS_RUN' | 'RIVALRY_BOILING' | 'RECORD_CHASE' | 'TITLE_RACE';

export interface EmergentStory {
  readonly id: string;
  readonly kind: EmergentKind;
  /** Media/social trigger key, always `EMERGENT_<KIND>`. */
  readonly trigger: string;
  readonly importance: EventImportance;
  readonly sentiment: number;
  readonly clubId?: ClubId;
  readonly opponentClubId?: ClubId;
  readonly playerId?: PlayerId;
  readonly tokens: TokenMap;
  readonly facts: HookFacts;
  readonly entities: readonly EntityRef[];
  /** Human-readable justification; shown in debug tooling and tested against. */
  readonly evidence: readonly string[];
  /** The real event this pattern is pinned to. */
  readonly anchorEventId: EventId;
  readonly audiences: readonly SocialPostKind[];
}

// --- indexes ---------------------------------------------------------------

interface HistoryIndex {
  readonly byClub: ReadonlyMap<string, readonly Fixture[]>;
  readonly derbyByClub: ReadonlyMap<string, readonly Fixture[]>;
  readonly scorersByMatch: ReadonlyMap<string, ReadonlySet<string>>;
  readonly log: readonly AnyDomainEvent[];
}

function buildIndex(state: GameState): HistoryIndex {
  const byClub = new Map<string, Fixture[]>();
  const derbyByClub = new Map<string, Fixture[]>();
  const push = (map: Map<string, Fixture[]>, key: string, fixture: Fixture): void => {
    const list = map.get(key);
    if (list) list.push(fixture); else map.set(key, [fixture]);
  };
  const completed = Object.values(state.fixtures)
    .filter((f) => f.status === 'COMPLETED' && f.homeScore !== null && f.awayScore !== null)
    .sort((a, b) => a.week - b.week || (a.id < b.id ? -1 : 1));
  for (const fixture of completed) {
    push(byClub, fixture.homeClubId, fixture);
    push(byClub, fixture.awayClubId, fixture);
    if (fixture.isDerby) {
      push(derbyByClub, fixture.homeClubId, fixture);
      push(derbyByClub, fixture.awayClubId, fixture);
    }
  }
  const scorersByMatch = new Map<string, Set<string>>();
  for (const event of state.eventLog) {
    if (event.type !== 'GOAL_SCORED') continue;
    const set = scorersByMatch.get(event.payload.matchId);
    if (set) set.add(event.payload.scorerId); else scorersByMatch.set(event.payload.matchId, new Set([event.payload.scorerId]));
  }
  return { byClub, derbyByClub, scorersByMatch, log: state.eventLog };
}

const conceded = (fixture: Fixture, clubId: string): number =>
  (fixture.homeClubId === clubId ? fixture.awayScore ?? 0 : fixture.homeScore ?? 0);
const scored = (fixture: Fixture, clubId: string): number =>
  (fixture.homeClubId === clubId ? fixture.homeScore ?? 0 : fixture.awayScore ?? 0);

function findEvent(
  log: readonly AnyDomainEvent[],
  predicate: (e: AnyDomainEvent) => boolean,
): AnyDomainEvent | null {
  for (let i = log.length - 1; i >= 0; i--) {
    const event = log[i];
    if (event && predicate(event)) return event;
  }
  return null;
}

const isResultFor = (event: AnyDomainEvent, clubId: string): boolean =>
  (event.type === 'MATCH_WON' || event.type === 'MATCH_LOST' || event.type === 'MATCH_DRAWN')
  && (event.payload as { clubId: string }).clubId === clubId;

/** Has this exact story already been told about this subject recently? */
function toldRecently(state: GameState, trigger: string, subjectId: string, cycle: number): boolean {
  for (const story of state.media.stories) {
    if (cycle - story.cycle > EMERGENT_BALANCE.cooldownCycles) continue;
    if (!story.tags.includes(`trigger:${trigger}`)) continue;
    if (story.entities.some((e) => e.id === subjectId)) return true;
  }
  return false;
}

// --- detectors -------------------------------------------------------------

type Detector = (state: GameState, index: HistoryIndex, cycle: number) => EmergentStory[];

const clubEntity = (state: GameState, id: string): EntityRef[] => {
  const club = state.clubs[id];
  return club ? [{ kind: 'club', id, name: club.name }] : [];
};
const playerEntity = (state: GameState, id: string): EntityRef[] => {
  const player = state.players[id];
  return player ? [{ kind: 'player', id, name: player.displayName }] : [];
};

/** A player who keeps scoring in the fixture that matters most. */
const detectDerbyKing: Detector = (state, index, cycle) => {
  const out: EmergentStory[] = [];
  for (const [clubId, derbies] of index.derbyByClub) {
    if (derbies.length < EMERGENT_BALANCE.derbyStreak) continue;
    const recent = derbies.slice(-EMERGENT_BALANCE.derbyStreak);
    const scorerSets = recent.map((f) => (f.matchId ? index.scorersByMatch.get(f.matchId) ?? new Set<string>() : new Set<string>()));
    const first = scorerSets[0];
    if (!first) continue;
    for (const playerId of first) {
      const player = state.players[playerId];
      if (!player || player.clubId !== clubId) continue;
      if (!scorerSets.every((set) => set.has(playerId))) continue;
      const lastMatchId = recent[recent.length - 1]?.matchId;
      const anchor = findEvent(index.log, (e) => e.type === 'GOAL_SCORED' && e.payload.scorerId === playerId && e.payload.matchId === lastMatchId);
      if (!anchor) continue;
      if (toldRecently(state, 'EMERGENT_DERBY_KING', playerId, cycle)) continue;
      const club = state.clubs[clubId];
      out.push({
        id: `em_derbyking_${playerId}_${cycle}`,
        kind: 'DERBY_KING', trigger: 'EMERGENT_DERBY_KING',
        importance: 4, sentiment: 0.7,
        clubId: clubId as ClubId, playerId: playerId as PlayerId,
        tokens: { player: player.displayName, club: club?.name ?? 'the club', count: EMERGENT_BALANCE.derbyStreak },
        facts: { count: EMERGENT_BALANCE.derbyStreak, derby: true },
        entities: [...playerEntity(state, playerId), ...clubEntity(state, clubId)],
        evidence: recent.map((f) => `Scored in derby week ${f.week}`),
        anchorEventId: anchor.id,
        audiences: ['FAN', 'CREATOR', 'RIVAL', 'MEDIA'],
      });
    }
  }
  return out;
};

/** A goalkeeper nobody can beat. */
const detectCleanSheetRun: Detector = (state, index, cycle) => {
  const out: EmergentStory[] = [];
  for (const [clubId, fixtures] of index.byClub) {
    let streak = 0;
    for (let i = fixtures.length - 1; i >= 0; i--) {
      const fixture = fixtures[i];
      if (!fixture || conceded(fixture, clubId) > 0) break;
      streak++;
    }
    if (streak < EMERGENT_BALANCE.cleanSheetRun) continue;
    const club = state.clubs[clubId];
    if (!club) continue;
    const keeper = club.squad
      .map((id) => state.players[id])
      .filter((p): p is NonNullable<typeof p> => !!p && p.position === 'GK')
      .sort((a, b) => b.overall - a.overall)[0];
    if (!keeper) continue;
    const anchor = findEvent(index.log, (e) => isResultFor(e, clubId));
    if (!anchor) continue;
    if (toldRecently(state, 'EMERGENT_CLEAN_SHEET_RUN', keeper.id, cycle)) continue;
    out.push({
      id: `em_cleansheet_${clubId}_${cycle}`,
      kind: 'CLEAN_SHEET_RUN', trigger: 'EMERGENT_CLEAN_SHEET_RUN',
      importance: 3, sentiment: 0.65,
      clubId: clubId as ClubId, playerId: keeper.id,
      tokens: { player: keeper.displayName, club: club.name, count: streak },
      facts: { count: streak, streak },
      entities: [...playerEntity(state, keeper.id), ...clubEntity(state, clubId)],
      evidence: [`${streak} consecutive matches without conceding`],
      anchorEventId: anchor.id,
      audiences: ['FAN', 'CREATOR', 'MEDIA'],
    });
  }
  return out;
};

/** An expensive signing the table says is not working. */
const detectFlopSigning: Detector = (state, index, cycle) => {
  const out: EmergentStory[] = [];
  for (const event of index.log) {
    if (event.type !== 'PLAYER_SIGNED') continue;
    const { playerId, clubId, fee } = event.payload;
    const club = state.clubs[clubId];
    const player = state.players[playerId];
    if (!club || !player || player.clubId !== clubId) continue;
    if (fee < club.finance.wageBudgetPerCycle * EMERGENT_BALANCE.flopFeeToWageBudget) continue;
    if (player.form.appearances < EMERGENT_BALANCE.flopMinAppearances) continue;
    const rating = mean(player.form.recentRatings);
    const contributions = player.form.goals + player.form.assists;
    if (rating > EMERGENT_BALANCE.flopMaxRating) continue;
    if (contributions > EMERGENT_BALANCE.flopMaxGoalContributions) continue;
    if (toldRecently(state, 'EMERGENT_FLOP_SIGNING', playerId, cycle)) continue;
    out.push({
      id: `em_flop_${playerId}_${cycle}`,
      kind: 'FLOP_SIGNING', trigger: 'EMERGENT_FLOP_SIGNING',
      importance: 4, sentiment: -0.65,
      clubId, playerId,
      tokens: { player: player.displayName, club: club.name, fee: formatMoney(fee), count: player.form.appearances },
      facts: { fee, count: player.form.appearances, rating: Math.round(rating * 10) / 10 },
      entities: [...playerEntity(state, playerId), ...clubEntity(state, clubId)],
      evidence: [
        `${formatMoney(fee)} fee`,
        `${player.form.appearances} appearances`,
        `${contributions} goal contributions`,
        `average rating ${rating.toFixed(2)}`,
      ],
      anchorEventId: event.id,
      audiences: ['FAN', 'CREATOR', 'RIVAL', 'MEDIA'],
    });
  }
  return out;
};

/** A young player whose numbers are climbing fast enough to be a story. */
const detectBreakoutArc: Detector = (state, index, cycle) => {
  const gains = new Map<string, number>();
  for (const event of index.log) {
    if (event.type !== 'PLAYER_DEVELOPED') continue;
    if (event.season !== state.clock.season) continue;
    const delta = event.payload.to - event.payload.from;
    if (delta <= 0) continue;
    gains.set(event.payload.playerId, (gains.get(event.payload.playerId) ?? 0) + delta);
  }
  const out: EmergentStory[] = [];
  for (const [playerId, gain] of gains) {
    if (gain < EMERGENT_BALANCE.breakoutGain) continue;
    const player = state.players[playerId];
    if (!player || player.age > EMERGENT_BALANCE.breakoutMaxAge || !player.clubId) continue;
    const anchor = findEvent(index.log, (e) =>
      (e.type === 'PLAYER_DEVELOPED' && e.payload.playerId === playerId)
      || (e.type === 'PLAYER_BREAKOUT' && e.payload.playerId === playerId));
    if (!anchor) continue;
    if (toldRecently(state, 'EMERGENT_BREAKOUT_ARC', playerId, cycle)) continue;
    const club = state.clubs[player.clubId];
    out.push({
      id: `em_arc_${playerId}_${cycle}`,
      kind: 'BREAKOUT_ARC', trigger: 'EMERGENT_BREAKOUT_ARC',
      importance: 4, sentiment: 0.7,
      clubId: player.clubId, playerId: player.id,
      tokens: { player: player.displayName, club: club?.name ?? 'the club', count: Math.round(gain), age: player.age, overall: player.overall },
      facts: { count: Math.round(gain), age: player.age, overall: player.overall },
      entities: [...playerEntity(state, playerId), ...clubEntity(state, player.clubId)],
      evidence: [`+${Math.round(gain)} attribute points this season`, `age ${player.age}`],
      anchorEventId: anchor.id,
      audiences: ['FAN', 'CREATOR', 'MEDIA', 'LEAK'],
    });
  }
  return out;
};

/** Form runs, in both directions. */
const detectRuns: Detector = (state, index, cycle) => {
  const out: EmergentStory[] = [];
  for (const [clubId, fixtures] of index.byClub) {
    const club = state.clubs[clubId];
    if (!club) continue;
    let unbeaten = 0;
    let winless = 0;
    for (let i = fixtures.length - 1; i >= 0; i--) {
      const fixture = fixtures[i];
      if (!fixture) break;
      if (scored(fixture, clubId) < conceded(fixture, clubId)) break;
      unbeaten++;
    }
    for (let i = fixtures.length - 1; i >= 0; i--) {
      const fixture = fixtures[i];
      if (!fixture) break;
      if (scored(fixture, clubId) > conceded(fixture, clubId)) break;
      winless++;
    }
    const anchor = findEvent(index.log, (e) => isResultFor(e, clubId));
    if (!anchor) continue;
    if (unbeaten >= EMERGENT_BALANCE.unbeatenRun && !toldRecently(state, 'EMERGENT_UNBEATEN_RUN', clubId, cycle)) {
      out.push({
        id: `em_unbeaten_${clubId}_${cycle}`,
        kind: 'UNBEATEN_RUN', trigger: 'EMERGENT_UNBEATEN_RUN',
        importance: 3, sentiment: 0.7, clubId: clubId as ClubId,
        tokens: { club: club.name, count: unbeaten },
        facts: { count: unbeaten, streak: unbeaten },
        entities: clubEntity(state, clubId),
        evidence: [`${unbeaten} matches unbeaten`],
        anchorEventId: anchor.id,
        audiences: ['FAN', 'CREATOR', 'MEDIA'],
      });
    }
    if (winless >= EMERGENT_BALANCE.winlessRun && !toldRecently(state, 'EMERGENT_WINLESS_RUN', clubId, cycle)) {
      out.push({
        id: `em_winless_${clubId}_${cycle}`,
        kind: 'WINLESS_RUN', trigger: 'EMERGENT_WINLESS_RUN',
        importance: 4, sentiment: -0.65, clubId: clubId as ClubId,
        tokens: { club: club.name, count: winless },
        facts: { count: winless, streak: winless },
        entities: clubEntity(state, clubId),
        evidence: [`${winless} matches without a win`],
        anchorEventId: anchor.id,
        audiences: ['FAN', 'CREATOR', 'RIVAL', 'MEDIA'],
      });
    }
  }
  return out;
};

/** A rivalry that has stopped being sport. */
const detectRivalryBoiling: Detector = (state, index, cycle) => {
  const out: EmergentStory[] = [];
  for (const rivalry of Object.values(state.rivalries)) {
    if (rivalry.intensity < RIVALRY_BALANCE.boilingPoint) continue;
    const recentIncidents = rivalry.incidents.filter((i) => cycle - i.cycle <= 12).length;
    if (recentIncidents < 2) continue;
    const anchor = findEvent(index.log, (e) =>
      e.type === 'RIVALRY_INTENSIFIED'
      && ((e.payload.clubA === rivalry.clubAId && e.payload.clubB === rivalry.clubBId)
        || (e.payload.clubA === rivalry.clubBId && e.payload.clubB === rivalry.clubAId)));
    if (!anchor) continue;
    if (toldRecently(state, 'EMERGENT_RIVALRY_BOILING', rivalry.clubAId, cycle)) continue;
    const a = state.clubs[rivalry.clubAId];
    const b = state.clubs[rivalry.clubBId];
    if (!a || !b) continue;
    out.push({
      id: `em_boiling_${rivalry.id}_${cycle}`,
      kind: 'RIVALRY_BOILING', trigger: 'EMERGENT_RIVALRY_BOILING',
      importance: 4, sentiment: -0.45,
      clubId: rivalry.clubAId, opponentClubId: rivalry.clubBId,
      tokens: { club: a.name, rival: b.name, opponent: b.name, intensity: Math.round(rivalry.intensity), count: recentIncidents },
      facts: { intensity: Math.round(rivalry.intensity), derby: true, count: recentIncidents },
      entities: [...clubEntity(state, rivalry.clubAId), ...clubEntity(state, rivalry.clubBId)],
      evidence: [`intensity ${Math.round(rivalry.intensity)}`, `${recentIncidents} recent incidents`],
      anchorEventId: anchor.id,
      audiences: ['RIVAL', 'FAN', 'MEDIA', 'CREATOR'],
    });
  }
  return out;
};

/** Somebody one goal from the club's record book. */
const detectRecordChase: Detector = (state, index, cycle) => {
  const record = state.legacy.records['PLAYER_SEASON_GOALS'];
  if (!record) return [];
  const out: EmergentStory[] = [];
  for (const player of Object.values(state.players)) {
    if (!player.clubId) continue;
    if (player.form.goals !== record.value - 1) continue;
    const anchor = findEvent(index.log, (e) => e.type === 'GOAL_SCORED' && e.payload.scorerId === player.id);
    if (!anchor) continue;
    if (toldRecently(state, 'EMERGENT_RECORD_CHASE', player.id, cycle)) continue;
    const club = state.clubs[player.clubId];
    out.push({
      id: `em_chase_${player.id}_${cycle}`,
      kind: 'RECORD_CHASE', trigger: 'EMERGENT_RECORD_CHASE',
      importance: 4, sentiment: 0.6,
      clubId: player.clubId, playerId: player.id,
      tokens: { player: player.displayName, club: club?.name ?? 'the club', record: 'the club goalscoring record', value: record.value, count: player.form.goals },
      facts: { record: 'PLAYER_SEASON_GOALS', value: record.value, count: player.form.goals },
      entities: [...playerEntity(state, player.id), ...clubEntity(state, player.clubId)],
      evidence: [`${player.form.goals} goals, record is ${record.value}`],
      anchorEventId: anchor.id,
      audiences: ['FAN', 'CREATOR', 'MEDIA'],
    });
  }
  return out;
};

/** Two clubs that cannot shake each other off. */
const detectTitleRace: Detector = (state, index, cycle) => {
  const season = state.seasons[state.currentSeasonId];
  if (!season || season.totalWeeks <= 0) return [];
  if (season.currentWeek / season.totalWeeks < EMERGENT_BALANCE.titleRaceProgress) return [];
  const table = Object.values(state.clubs)
    .map((club) => ({ club, pts: points(club.seasonRecord) }))
    .sort((a, b) => b.pts - a.pts);
  const first = table[0];
  const second = table[1];
  if (!first || !second) return [];
  if (first.pts - second.pts > EMERGENT_BALANCE.titleRacePoints) return [];
  const anchor = findEvent(index.log, (e) => isResultFor(e, first.club.id) || isResultFor(e, second.club.id));
  if (!anchor) return [];
  if (toldRecently(state, 'EMERGENT_TITLE_RACE', first.club.id, cycle)) return [];
  return [{
    id: `em_title_${first.club.id}_${cycle}`,
    kind: 'TITLE_RACE', trigger: 'EMERGENT_TITLE_RACE',
    importance: 5, sentiment: 0.3,
    clubId: first.club.id, opponentClubId: second.club.id,
    tokens: { club: first.club.name, rival: second.club.name, opponent: second.club.name, count: first.pts - second.pts },
    facts: { count: first.pts - second.pts },
    entities: [...clubEntity(state, first.club.id), ...clubEntity(state, second.club.id)],
    evidence: [`${first.pts} v ${second.pts} points with ${season.totalWeeks - season.currentWeek} weeks left`],
    anchorEventId: anchor.id,
    audiences: ['FAN', 'CREATOR', 'MEDIA'],
  }];
};

const DETECTORS: readonly Detector[] = [
  detectDerbyKing, detectCleanSheetRun, detectFlopSigning, detectBreakoutArc,
  detectRuns, detectRivalryBoiling, detectRecordChase, detectTitleRace,
];

/** Run every detector over accumulated history. Pure and deterministic. */
export function detectEmergentStories(state: GameState, cycle = state.clock.cycle): EmergentStory[] {
  const index = buildIndex(state);
  const out: EmergentStory[] = [];
  for (const detector of DETECTORS) out.push(...detector(state, index, cycle));
  return out.sort((a, b) => b.importance - a.importance || (a.id < b.id ? -1 : 1));
}

/** Promote detected patterns into hooks the media and social engines consume. */
export function emergentHooks(stories: readonly EmergentStory[], cycle: number): ContentHook[] {
  return stories.map((story) => ({
    trigger: story.trigger,
    sourceEventId: story.anchorEventId,
    rootEventId: story.anchorEventId,
    depth: 0,
    importance: story.importance,
    sentiment: story.sentiment,
    tokens: story.tokens,
    facts: {
      ...story.facts,
      trigger: story.trigger,
      importance: story.importance,
      sentiment: story.sentiment,
      sentimentBand: sentimentBand(story.sentiment),
      emergent: true,
      depth: 0,
    },
    entities: story.entities,
    ...(story.clubId ? { clubId: story.clubId } : {}),
    ...(story.opponentClubId ? { opponentClubId: story.opponentClubId } : {}),
    ...(story.playerId ? { playerId: story.playerId } : {}),
    audiences: story.audiences,
    tags: ['emergent', story.kind.toLowerCase()],
    cycle,
  }));
}
