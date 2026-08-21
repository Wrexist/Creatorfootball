import type { ClubId, CreatorId, PlayerId } from '../core/brand';
import type { AnyDomainEvent, DomainEventType } from '../core/events';
import type { GameState, LegacyState, SeasonSummary } from '../game/state';
import { formatMoney } from '../economy/ledger';
import { points as leaguePoints } from '../clubs/club';
import { PROGRESSION_BALANCE as P } from './balance';

/**
 * Legacy: the part of the game that only pays off in year five.
 *
 * The history screen has to be able to tell a story years later, so this module
 * keeps the durable things — trophies, records, legends, milestones and one
 * summary per season — and nothing that can be recomputed cheaply. Records are
 * *detected* from state and announced as events, rather than being written here
 * silently, so that a broken record cascades like any other moment.
 */

export interface RecordCandidate {
  readonly key: string;
  readonly label: string;
  readonly value: number;
  readonly holderId?: PlayerId;
  readonly holderName?: string;
  readonly clubId: ClubId;
}

export interface RecordDetectionOptions {
  /**
   * Whether to evaluate records built from *cumulative season aggregates*
   * (points so far, goals so far, top scorer's tally).
   *
   * These are monotonically increasing, so a level-triggered comparison against
   * the record book sets a new record every single week of a club's first
   * season — which is exactly how a quarter of a season's press became the same
   * headline. They are edge-triggered instead: evaluated once, when the season
   * they summarise is actually finished. Per-event records (biggest win, record
   * signing) are already edge-shaped and stay live.
   */
  readonly seasonAggregates?: boolean;
}

/** Records the player's club could be setting right now. */
export function detectRecords(
  state: GameState,
  opts: RecordDetectionOptions = {},
): RecordCandidate[] {
  const clubId = state.playerClubId;
  const club = state.clubs[clubId];
  if (!club) return [];
  const out: RecordCandidate[] = [];
  const existing = state.legacy.records;

  if (opts.seasonAggregates) {
    let topScorer: { id: PlayerId; name: string; goals: number } | null = null;
    for (const id of club.squad) {
      const player = state.players[id];
      if (!player) continue;
      if (!topScorer || player.form.goals > topScorer.goals) {
        topScorer = { id: player.id, name: player.displayName, goals: player.form.goals };
      }
    }
    if (topScorer && topScorer.goals > 0 && topScorer.goals > (existing['PLAYER_SEASON_GOALS']?.value ?? 0)) {
      out.push({
        key: 'PLAYER_SEASON_GOALS', label: 'Most goals in a season',
        value: topScorer.goals, holderId: topScorer.id, holderName: topScorer.name, clubId,
      });
    }

    const seasonPoints = leaguePoints(club.seasonRecord);
    if (seasonPoints > (existing['CLUB_SEASON_POINTS']?.value ?? 0)) {
      out.push({
        key: 'CLUB_SEASON_POINTS', label: 'Most points in a season', value: seasonPoints, clubId,
      });
    }
    if (club.seasonRecord.goalsFor > (existing['CLUB_SEASON_GOALS']?.value ?? 0)) {
      out.push({
        key: 'CLUB_SEASON_GOALS', label: 'Most goals in a season', value: club.seasonRecord.goalsFor, clubId,
      });
    }
  }

  let biggestWin = existing['BIGGEST_WIN']?.value ?? 0;
  let biggestFee = existing['RECORD_SIGNING']?.value ?? 0;
  let feeHolder: { id: PlayerId; name: string } | null = null;
  for (const event of state.eventLog) {
    if (event.type === 'MATCH_WON' && event.payload.clubId === clubId && event.payload.margin > biggestWin) {
      biggestWin = event.payload.margin;
    }
    if (event.type === 'PLAYER_SIGNED' && event.payload.clubId === clubId && event.payload.fee > biggestFee) {
      biggestFee = event.payload.fee;
      const player = state.players[event.payload.playerId];
      feeHolder = player ? { id: player.id, name: player.displayName } : null;
    }
  }
  const standingWin = existing['BIGGEST_WIN']?.value ?? 0;
  if (biggestWin >= standingWin + (standingWin > 0 ? (P.recordMinImprovement['BIGGEST_WIN'] ?? 1) : 1)) {
    out.push({
      key: 'BIGGEST_WIN', label: 'Biggest winning margin', value: biggestWin, clubId,
    });
  }
  const standingFee = existing['RECORD_SIGNING']?.value ?? 0;
  if (biggestFee > standingFee * (standingFee > 0 ? P.recordSigningStep : 1)) {
    out.push({
      key: 'RECORD_SIGNING', label: 'Record signing', value: biggestFee, clubId,
      ...(feeHolder ? { holderId: feeHolder.id, holderName: feeHolder.name } : {}),
    });
  }
  return out;
}

const playerNameOf = (state: GameState, id: PlayerId | undefined): string =>
  (id ? state.players[id]?.displayName : undefined) ?? 'A player';
const clubNameOf = (state: GameState, id: ClubId | undefined): string =>
  (id ? state.clubs[id]?.name : undefined) ?? 'Another club';
const creatorNameOf = (state: GameState, id: CreatorId | undefined): string =>
  (id ? state.creators[id]?.displayName : undefined) ?? 'A creator';

/**
 * Prose for milestone-worthy events the switch above does not model explicitly.
 *
 * The default branch used to write `${event.type}` with underscores swapped for
 * spaces straight onto the history screen — "player morale changed", "objective
 * completed" — which told every reader that nobody had written the sentence on
 * purpose. This table is keyed exhaustively by event type, so a new emitter can
 * never silently reintroduce a slug: adding a key to DomainEventPayloads without
 * an entry here is a compile error, not a code-review catch. Most entries will
 * never fire at milestone importance; they exist because any event CAN be pushed
 * at importance 5, and whatever fires should read like someone wrote it.
 */
const MILESTONE_PROSE: {
  [K in DomainEventType]: (
    event: Extract<AnyDomainEvent, { type: K }>,
    state: GameState,
  ) => string;
} = {
  /* --- lifecycle ------------------------------------------------------- */
  GAME_STARTED: (e, s) => `Took charge of ${clubNameOf(s, e.payload.clubId)}`,
  SEASON_STARTED: (e) => `Season ${e.payload.season} began`,
  SEASON_COMPLETED: (e) => `Season ${e.payload.season} came to a close`,
  CYCLE_ADVANCED: () => 'Another week at the club',

  /* --- match ----------------------------------------------------------- */
  MATCH_SCHEDULED: () => 'A new fixture landed on the calendar',
  MATCH_STARTED: () => 'Kick-off',
  GOAL_SCORED: (e, s) =>
    `${playerNameOf(s, e.payload.scorerId)} scored in a ${e.payload.homeScore}-${e.payload.awayScore} match`,
  MATCH_WON: (e, s) => `Beat ${clubNameOf(s, e.payload.opponentId)} by ${e.payload.margin}`,
  MATCH_LOST: (e, s) => `Defeat to ${clubNameOf(s, e.payload.opponentId)}, by ${e.payload.margin}`,
  MATCH_DRAWN: (e, s) => `Drew ${e.payload.score} with ${clubNameOf(s, e.payload.opponentId)}`,
  PLAYER_INJURED: (e, s) =>
    `${playerNameOf(s, e.payload.playerId)} was ruled out for ${e.payload.weeksOut} weeks`,
  PLAYER_RECOVERED: (e, s) => `${playerNameOf(s, e.payload.playerId)} returned to full training`,
  RED_CARD: (e, s) => `${playerNameOf(s, e.payload.playerId)} was sent off`,
  MOTM_AWARDED: (e, s) => `${playerNameOf(s, e.payload.playerId)} took man of the match`,
  SPECIAL_RULE_TRIGGERED: (e) =>
    `The ${e.payload.rule.replace(/_/g, ' ').toLowerCase()} card changed everything`,
  LIVE_DECISION_MADE: () => 'A touchline call reshaped the match',

  /* --- squad ----------------------------------------------------------- */
  PLAYER_SIGNED: (e, s) =>
    `${playerNameOf(s, e.payload.playerId)} arrived${e.payload.fee > 0 ? ` for ${formatMoney(e.payload.fee)}` : ' on a free'}`,
  PLAYER_SOLD: (e, s) => `${playerNameOf(s, e.payload.playerId)} left for ${clubNameOf(s, e.payload.toClubId)}`,
  PLAYER_RELEASED: (e, s) => `${playerNameOf(s, e.payload.playerId)} was released`,
  CONTRACT_SIGNED: (e, s) => `${playerNameOf(s, e.payload.playerId)} signed a new deal`,
  CONTRACT_EXPIRING: (e, s) =>
    `${playerNameOf(s, e.payload.playerId)} entered the final weeks of his contract`,
  PLAYER_DEVELOPED: (e, s) =>
    `${playerNameOf(s, e.payload.playerId)} took his ${e.payload.attribute} to ${e.payload.to}`,
  PLAYER_BREAKOUT: (e, s) => `${playerNameOf(s, e.payload.playerId)} forced his way into the first team`,
  YOUTH_PROSPECT_PROMOTED: (e, s) => `${playerNameOf(s, e.payload.playerId)} stepped up from the academy`,
  PLAYER_MORALE_CHANGED: (e, s) => `${playerNameOf(s, e.payload.playerId)}'s head turned (${e.payload.reason})`,

  /* --- transfers ------------------------------------------------------- */
  TRANSFER_BID_MADE: (e, s) =>
    `${formatMoney(e.payload.amount)} bid lodged for ${playerNameOf(s, e.payload.playerId)}`,
  TRANSFER_BID_REJECTED: (e, s) =>
    `A bid for ${playerNameOf(s, e.payload.playerId)} was knocked back`,
  TRANSFER_COMPLETED: (e, s) =>
    `${playerNameOf(s, e.payload.playerId)} completed a move to ${clubNameOf(s, e.payload.toClubId)}`,
  TRANSFER_HIJACKED: (e, s) =>
    `${clubNameOf(s, e.payload.byClubId)} snatched ${playerNameOf(s, e.payload.playerId)} at the last moment`,
  SCOUT_REPORT_READY: (e, s) => `Scouts filed their report on ${playerNameOf(s, e.payload.playerId)}`,

  /* --- club / world ---------------------------------------------------- */
  CLUB_CREATED: (e, s) => `${clubNameOf(s, e.payload.clubId)} came into existence`,
  FACILITY_UPGRADED: () => 'Training ground work was completed',
  SPONSOR_SIGNED: (e) => `New sponsorship income secured (${formatMoney(e.payload.value)})`,
  SPONSOR_LOST: (e) => `A sponsor walked away (${e.payload.reason})`,
  FAN_SENTIMENT_CHANGED: (e) => `Supporters reacted: ${e.payload.reason}`,
  ATTENDANCE_RECORDED: (e) =>
    `A crowd of ${e.payload.attendance.toLocaleString('en-GB')} filled the ground`,
  REPUTATION_CHANGED: (e) => `Reputation shifted (${e.payload.reason})`,
  MANAGER_SACKED: (e) => `${e.payload.managerName} lost his job`,

  /* --- rivalry / story -------------------------------------------------- */
  RIVALRY_INTENSIFIED: (e) => `The rivalry boiled over (${e.payload.reason})`,
  RIVALRY_CREATED: () => 'A new rivalry was born',
  RECORD_BROKEN: () => 'The record book was rewritten',
  STORY_PUBLISHED: (e) => `"${e.payload.headline}" made the papers`,
  CREATOR_MOMENT: (e) =>
    `Creator content about the club reached ${e.payload.reach.toLocaleString('en-GB')} people`,
  CREATOR_JOINED: (e, s) => `${creatorNameOf(s, e.payload.creatorId)} joined the club's content team`,

  /* --- progression / economy -------------------------------------------- */
  OBJECTIVE_COMPLETED: (e) => `"${e.payload.title}" delivered (${e.payload.rewardSummary})`,
  OBJECTIVE_FAILED: (e) => `"${e.payload.title}" slipped away`,
  REWARD_CLAIMED: () => 'A reward was claimed',
  TROPHY_WON: (e) => `Won the ${e.payload.competition}`,
  PROMOTED: (e) => `Promoted to tier ${e.payload.toTier}`,
  RELEGATED: (e) => `Relegated to tier ${e.payload.toTier}`,
  BALANCE_LOW: () => 'The money ran low',
};

/**
 * Fold events into the durable record. Pure; returns a new LegacyState.
 */
export function updateLegacy(state: GameState, events: readonly AnyDomainEvent[]): LegacyState {
  const clubId = state.playerClubId;
  const trophies = [...state.legacy.trophies];
  const records = { ...state.legacy.records };
  const milestones = [...state.legacy.milestones];
  const seasonSummaries = [...state.legacy.seasonSummaries];
  const legends = [...state.legacy.legends];

  for (const event of events) {
    switch (event.type) {
      case 'TROPHY_WON': {
        if (event.payload.clubId !== clubId) break;
        trophies.push({ competition: event.payload.competition, season: event.payload.season, clubId });
        milestones.push({ cycle: event.cycle, text: `Won the ${event.payload.competition}`, importance: 5 });
        break;
      }
      case 'RECORD_BROKEN': {
        if (event.payload.clubId !== clubId) break;
        const holder = event.payload.holderId ? state.players[event.payload.holderId] : undefined;
        records[event.payload.record] = {
          value: event.payload.value,
          season: event.season,
          ...(event.payload.holderId ? { holderId: event.payload.holderId } : {}),
          ...(holder ? { holderName: holder.displayName } : {}),
        };
        milestones.push({ cycle: event.cycle, text: `${event.payload.record}: ${event.payload.value}`, importance: 4 });
        break;
      }
      case 'SEASON_COMPLETED': {
        seasonSummaries.push(summariseSeason(state));
        milestones.push({
          cycle: event.cycle,
          text: `Season ${event.payload.season} finished in position ${event.payload.playerPosition}`,
          importance: 4,
        });
        break;
      }
      case 'PROMOTED':
        if (event.payload.clubId === clubId) milestones.push({ cycle: event.cycle, text: `Promoted to tier ${event.payload.toTier}`, importance: 5 });
        break;
      case 'RELEGATED':
        if (event.payload.clubId === clubId) milestones.push({ cycle: event.cycle, text: `Relegated to tier ${event.payload.toTier}`, importance: 5 });
        break;
      case 'PLAYER_BREAKOUT': {
        if (event.payload.clubId !== clubId) break;
        const player = state.players[event.payload.playerId];
        if (player) milestones.push({ cycle: event.cycle, text: `${player.displayName} broke into the first team`, importance: 3 });
        break;
      }
      default: {
        // Anything genuinely big that we did not model explicitly still belongs
        // in the history feed rather than being lost — written as prose, never
        // as the raw event slug. The exhaustive MILESTONE_PROSE table above
        // makes that a compile-time guarantee for every known event type.
        if (event.importance >= 5 && event.entities.some((e) => e.id === clubId)) {
          // The cast only erases the per-key event narrowing TypeScript cannot
          // correlate through a union index; the table itself stays exhaustive.
          const prose = (MILESTONE_PROSE as Readonly<
            Record<DomainEventType, (e: AnyDomainEvent, s: GameState) => string>
          >)[event.type];
          milestones.push({ cycle: event.cycle, text: prose(event, state), importance: 5 });
        }
        break;
      }
    }
  }

  // Legends are earned by service, not selected. Recomputed each call so a
  // player who keeps playing eventually crosses the line on their own.
  const club = state.clubs[clubId];
  if (club) {
    const known = new Set(legends.map((l) => l.playerId));
    for (const id of club.squad) {
      const player = state.players[id];
      if (!player || known.has(player.id)) continue;
      const appearances = player.form.appearances
        + player.history.reduce((total, season) => total + season.appearances, 0);
      const contributions = player.form.goals + player.form.assists
        + player.history.reduce((total, season) => total + season.goals + season.assists, 0);
      if (appearances >= P.legendAppearances && contributions >= P.legendGoalContributions) {
        legends.push({
          playerId: player.id,
          name: player.displayName,
          reason: `${appearances} appearances, ${contributions} goal contributions`,
          season: state.clock.season,
        });
      }
    }
  }

  return {
    trophies,
    records,
    seasonSummaries,
    legends,
    milestones: milestones.slice(-P.maxMilestones),
  };
}

/** Snapshot of the player's club season, used by the history screen. */
export function summariseSeason(state: GameState): SeasonSummary {
  const clubId = state.playerClubId;
  const club = state.clubs[clubId];
  const season = state.seasons[state.currentSeasonId];
  const record = club?.seasonRecord ?? { played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0 };

  const table = Object.values(state.clubs)
    .map((c) => ({ id: c.id, pts: leaguePoints(c.seasonRecord), gd: c.seasonRecord.goalsFor - c.seasonRecord.goalsAgainst }))
    .sort((a, b) => b.pts - a.pts || b.gd - a.gd);
  const index = table.findIndex((row) => row.id === clubId);

  let topScorerId: PlayerId | null = null;
  let topScorerGoals = 0;
  for (const id of club?.squad ?? []) {
    const player = state.players[id];
    if (!player) continue;
    if (player.form.goals > topScorerGoals) {
      topScorerGoals = player.form.goals;
      topScorerId = player.id;
    }
  }

  let spend = 0;
  let income = 0;
  for (const tx of state.ledger.transactions) {
    if (tx.season !== state.clock.season) continue;
    const fromUs = tx.from.kind === 'club' && tx.from.clubId === clubId;
    const toUs = tx.to.kind === 'club' && tx.to.clubId === clubId;
    if (tx.kind === 'TRANSFER_OUT' && fromUs) spend += tx.amount;
    if (tx.kind === 'TRANSFER_IN' && toUs) income += tx.amount;
  }

  return {
    season: season?.number ?? state.clock.season,
    position: index < 0 ? table.length : index + 1,
    played: record.played,
    won: record.won,
    drawn: record.drawn,
    lost: record.lost,
    goalsFor: record.goalsFor,
    goalsAgainst: record.goalsAgainst,
    topScorerId,
    topScorerGoals,
    trophies: state.legacy.trophies
      .filter((t) => t.season === (season?.number ?? state.clock.season))
      .map((t) => t.competition),
    netSpend: spend - income,
    endReputation: club?.reputation ?? 0,
    endFanSentiment: club?.fans.sentiment ?? 0,
  };
}
