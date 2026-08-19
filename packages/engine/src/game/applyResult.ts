import type { ClubId, PlayerId } from '../core/brand';
import type { GameState } from './state';
import type { MatchResult } from '../matches/result';
import type { Fixture } from '../league/types';
import type { Player, PlayerForm } from '../players/player';
import type { AnyDomainEvent } from '../core/events';
import { clamp, decayToward, mean } from '../core/math';
import { patchClub, patchPlayer, setFixture, setContract } from './mutations';
import type { GameEventFactory } from './eventFactory';

/**
 * Folding a match result back into the world.
 *
 * The match engine is deliberately ignorant of persistent state — it returns a
 * result and nothing else. This module is the only place that turns a result
 * into consequences: stats, form, fitness, injuries, suspensions, morale,
 * contract minutes, club records, and the domain events that the media, social,
 * objective and legacy systems then react to. Keeping the translation in one
 * place is what stops a match outcome from being applied twice, or half-applied.
 */

/** Matches missed for a sending off. */
const RED_CARD_SUSPENSION = 2;

/** How fast rolling form responds. Low enough that one bad game is not a crisis. */
const FORM_RESPONSIVENESS = 0.32;

/** A competent, unremarkable performance. Form is measured as distance from here. */
const BASELINE_RATING = 6.5;

const pushRating = (form: PlayerForm, rating: number): number[] =>
  [...form.recentRatings, rating].slice(-8);

function updateForm(
  player: Player,
  stats: { minutes: number; goals: number; assists: number; rating: number; yellowCards: number; redCards: number },
  cleanSheet: boolean,
): PlayerForm {
  const ratings = pushRating(player.form, stats.rating);
  const target = clamp((mean(ratings) - BASELINE_RATING) / 2, -1, 1);
  return {
    rating: decayToward(player.form.rating, target, FORM_RESPONSIVENESS),
    recentRatings: ratings,
    appearances: player.form.appearances + (stats.minutes > 0 ? 1 : 0),
    goals: player.form.goals + stats.goals,
    assists: player.form.assists + stats.assists,
    cleanSheets: player.form.cleanSheets + (cleanSheet && stats.minutes > 0 ? 1 : 0),
    yellowCards: player.form.yellowCards + stats.yellowCards,
    redCards: player.form.redCards + stats.redCards,
    minutes: player.form.minutes + stats.minutes,
  };
}

export interface ApplyResultOutput {
  readonly state: GameState;
  readonly events: readonly AnyDomainEvent[];
}

export function applyMatchResult(
  state: GameState,
  fixture: Fixture,
  result: MatchResult,
  events: GameEventFactory,
): ApplyResultOutput {
  let next = state;
  const emitted: AnyDomainEvent[] = [];

  const homeId = result.homeClubId;
  const awayId = result.awayClubId;
  const homeWon = result.homeScore > result.awayScore;
  const drawn = result.homeScore === result.awayScore;

  next = setFixture(next, {
    ...fixture,
    status: 'COMPLETED',
    matchId: result.matchId,
    homeScore: result.homeScore,
    awayScore: result.awayScore,
  });

  for (const [clubId, scored, conceded] of [
    [homeId, result.homeScore, result.awayScore],
    [awayId, result.awayScore, result.homeScore],
  ] as const) {
    const won = scored > conceded;
    const lost = scored < conceded;
    next = patchClub(next, clubId, (club) => ({
      seasonRecord: {
        played: club.seasonRecord.played + 1,
        won: club.seasonRecord.won + (won ? 1 : 0),
        drawn: club.seasonRecord.drawn + (drawn ? 1 : 0),
        lost: club.seasonRecord.lost + (lost ? 1 : 0),
        goalsFor: club.seasonRecord.goalsFor + scored,
        goalsAgainst: club.seasonRecord.goalsAgainst + conceded,
      },
      allTimeRecord: {
        played: club.allTimeRecord.played + 1,
        won: club.allTimeRecord.won + (won ? 1 : 0),
        drawn: club.allTimeRecord.drawn + (drawn ? 1 : 0),
        lost: club.allTimeRecord.lost + (lost ? 1 : 0),
        goalsFor: club.allTimeRecord.goalsFor + scored,
        goalsAgainst: club.allTimeRecord.goalsAgainst + conceded,
      },
    }));
  }

  const injuriesById = new Map(result.injuries.map((i) => [i.playerId as string, i]));
  const totalMinutes = Math.max(1, result.durationMinutes);

  for (const [playerId, stats] of Object.entries(result.playerStats)) {
    const player = next.players[playerId];
    if (!player) continue;
    const clubId = player.clubId;
    const isHome = clubId === homeId;
    const conceded = isHome ? result.awayScore : result.homeScore;
    const cleanSheet = conceded === 0;

    const injury = injuriesById.get(playerId);
    const suspension = stats.redCards > 0 ? RED_CARD_SUSPENSION : 0;
    const fitnessCost = (stats.minutes / totalMinutes) * 22;

    // Confidence tracks personal contribution; morale tracks the result.
    // Keeping them apart is what lets a player be excellent and still unhappy
    // at a losing club — which is where transfer requests come from.
    const contributed = stats.goals * 6 + stats.assists * 4 + (stats.rating - BASELINE_RATING) * 3;
    const resultSwing = drawn ? 0 : isHome === homeWon ? 3 : -3;

    next = patchPlayer(next, playerId as PlayerId, {
      form: updateForm(player, stats, cleanSheet),
      fitness: clamp(player.fitness - fitnessCost, 10, 100),
      suspensionMatches: player.suspensionMatches + suspension,
      injury: injury
        ? {
            severity: injury.severity as NonNullable<Player['injury']>['severity'],
            weeksRemaining: injury.weeksOut,
            description: `Injured against ${next.clubs[isHome ? awayId : homeId]?.shortName ?? 'the opposition'}`,
            sustainedCycle: next.clock.cycle,
          }
        : player.injury,
      mental: {
        ...player.mental,
        confidence: clamp(player.mental.confidence + contributed * 0.25, 1, 99),
        morale: clamp(player.mental.morale + resultSwing, 1, 99),
      },
    });

    if (player.contractId) {
      const contract = next.contracts[player.contractId];
      // Minutes only. The weekly countdown happens once per cycle for every
      // contract in the league, not here — otherwise a fringe player's deal
      // would never run down because he never appears.
      if (contract) {
        next = setContract(next, {
          ...contract,
          minutesPlayed: contract.minutesPlayed + Math.max(0, stats.minutes),
          minutesAvailable: contract.minutesAvailable + totalMinutes,
        });
      }
    }

    if (injury) {
      emitted.push(events.make('PLAYER_INJURED', {
        playerId: playerId as PlayerId,
        clubId: clubId as ClubId,
        weeksOut: injury.weeksOut,
        severity: injury.severity,
        matchId: result.matchId,
      }, { importance: injury.weeksOut >= 4 ? 4 : 3, entities: [events.playerRef(playerId)] }));
    }

    if (stats.redCards > 0) {
      const cardEvent = result.events.find((e) => e.type === 'RED_CARD' && e.playerId === playerId);
      emitted.push(events.make('RED_CARD', {
        playerId: playerId as PlayerId,
        clubId: clubId as ClubId,
        matchId: result.matchId,
        minute: cardEvent?.minute ?? 0,
      }, { importance: 4, entities: [events.playerRef(playerId)] }));
    }
  }

  // A ban is served in matches, not in cycles: anyone suspended who therefore
  // did not appear ticks down here. Tying it to a timer instead would let a
  // player sit out a fixture-free week and serve nothing.
  for (const clubId of [homeId, awayId]) {
    const club = next.clubs[clubId];
    if (!club) continue;
    for (const playerId of club.squad) {
      const player = next.players[playerId];
      if (!player || player.suspensionMatches <= 0) continue;
      if (result.playerStats[playerId]) continue;
      next = patchPlayer(next, playerId, { suspensionMatches: player.suspensionMatches - 1 });
    }
  }

  for (const event of result.events) {
    if (event.type !== 'GOAL' || !event.playerId || !event.clubId) continue;
    emitted.push(events.make('GOAL_SCORED', {
      matchId: result.matchId,
      clubId: event.clubId,
      scorerId: event.playerId,
      ...(event.secondaryPlayerId ? { assistId: event.secondaryPlayerId } : {}),
      minute: event.minute,
      homeScore: event.homeScore,
      awayScore: event.awayScore,
      ...(event.detail?.['window'] ? { special: String(event.detail['window']) } : {}),
    }, {
      importance: 3,
      entities: [events.playerRef(event.playerId), events.clubRef(event.clubId)],
    }));
  }

  const margin = Math.abs(result.homeScore - result.awayScore);
  if (drawn) {
    for (const [clubId, opponentId] of [[homeId, awayId], [awayId, homeId]] as const) {
      emitted.push(events.make('MATCH_DRAWN', {
        matchId: result.matchId, clubId, opponentId, score: result.homeScore,
      }, { importance: 2, entities: [events.clubRef(clubId), events.clubRef(opponentId)] }));
    }
  } else {
    const winnerId = homeWon ? homeId : awayId;
    const loserId = homeWon ? awayId : homeId;
    const importance = fixture.isDerby || margin >= 3 ? 4 : 3;
    emitted.push(events.make('MATCH_WON', {
      matchId: result.matchId, clubId: winnerId, opponentId: loserId,
      homeScore: result.homeScore, awayScore: result.awayScore, margin,
    }, { importance, entities: [events.clubRef(winnerId), events.clubRef(loserId)] }));
    emitted.push(events.make('MATCH_LOST', {
      matchId: result.matchId, clubId: loserId, opponentId: winnerId,
      homeScore: result.homeScore, awayScore: result.awayScore, margin,
    }, { importance, entities: [events.clubRef(loserId), events.clubRef(winnerId)] }));
  }

  if (result.motmPlayerId) {
    const motm = next.players[result.motmPlayerId];
    emitted.push(events.make('MOTM_AWARDED', {
      playerId: result.motmPlayerId,
      clubId: (motm?.clubId ?? homeId) as ClubId,
      matchId: result.matchId,
      rating: result.playerStats[result.motmPlayerId]?.rating ?? 0,
    }, { importance: 3, entities: [events.playerRef(result.motmPlayerId)] }));
  }

  emitted.push(events.make('ATTENDANCE_RECORDED', {
    clubId: homeId,
    matchId: result.matchId,
    attendance: result.attendance,
    capacity: next.clubs[homeId]?.stadium.capacity ?? 0,
  }, { importance: 1, entities: [events.clubRef(homeId)] }));

  return { state: next, events: emitted };
}
