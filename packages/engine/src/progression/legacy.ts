import type { ClubId, PlayerId } from '../core/brand';
import type { AnyDomainEvent } from '../core/events';
import type { GameState, LegacyState, SeasonSummary } from '../game/state';
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

/** Records the player's club could be setting right now. */
export function detectRecords(state: GameState): RecordCandidate[] {
  const clubId = state.playerClubId;
  const club = state.clubs[clubId];
  if (!club) return [];
  const out: RecordCandidate[] = [];
  const existing = state.legacy.records;

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
    out.push({ key: 'CLUB_SEASON_POINTS', label: 'Most points in a season', value: seasonPoints, clubId });
  }
  if (club.seasonRecord.goalsFor > (existing['CLUB_SEASON_GOALS']?.value ?? 0)) {
    out.push({ key: 'CLUB_SEASON_GOALS', label: 'Most goals in a season', value: club.seasonRecord.goalsFor, clubId });
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
  if (biggestWin > (existing['BIGGEST_WIN']?.value ?? 0)) {
    out.push({ key: 'BIGGEST_WIN', label: 'Biggest winning margin', value: biggestWin, clubId });
  }
  if (biggestFee > (existing['RECORD_SIGNING']?.value ?? 0)) {
    out.push({
      key: 'RECORD_SIGNING', label: 'Record signing', value: biggestFee, clubId,
      ...(feeHolder ? { holderId: feeHolder.id, holderName: feeHolder.name } : {}),
    });
  }
  return out;
}

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
      default:
        // Anything genuinely big that we did not model explicitly still belongs
        // in the history feed rather than being lost.
        if (event.importance >= 5 && event.entities.some((e) => e.id === clubId)) {
          milestones.push({ cycle: event.cycle, text: `${event.type.replace(/_/g, ' ').toLowerCase()}`, importance: 5 });
        }
        break;
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
