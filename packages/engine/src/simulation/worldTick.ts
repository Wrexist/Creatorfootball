import type { ClubId, ContractId, EventId, PlayerId, SponsorId } from '../core/brand';
import type { AnyDomainEvent, DomainEventPayloads, DomainEventType, EntityRef, EventImportance } from '../core/events';
import type { GameState, NewsStory, SocialPost, TransferListing } from '../game/state';
import type { Player } from '../players/player';
import type { Club } from '../clubs/club';
import type { Contract } from '../contracts/contract';
import type { Rng } from '../core/rng';
import type { Ledger } from '../economy/ledger';
import { clubAccount, worldAccount } from '../economy/ledger';
import { ATTRIBUTE_KEYS, overallFor, POSITION_WEIGHTS } from '../players/attributes';
import type { AttributeKey } from '../players/attributes';
import { points as leaguePoints } from '../clubs/club';
import { clamp, decayToward } from '../core/math';
import { decayRivalry, rivalryKey } from '../rivalries/rivalries';
import { generateStories } from '../media/mediaEngine';
import { generatePosts, socialReach } from '../social/socialEngine';
import { detectRecords, updateLegacy } from '../progression/legacy';
import { applyObjectiveUpdates, updateObjectiveProgress, type ObjectiveUpdate } from '../progression/objectives';
import { aiClubTurn, type AiActions } from './aiClub';
import { CASCADE_BALANCE, WORLD_BALANCE as W } from './balance';
import { expandCascade, managerPressure, type CascadeResult, type WorldDelta } from './cascade';
import { detectEmergentStories, emergentHooks, type EmergentStory } from './emergent';
import type { ContentRegistryPort } from './ports';

/**
 * The world tick.
 *
 * Everything outside the player's direct control advances here, once per cycle:
 * AI clubs act, players across the league develop and get injured, form drifts,
 * fans change their minds, rivalries cool, the press write and the feed reacts.
 *
 * Three constraints shape the implementation:
 *  - Deterministic. Every random decision comes from a labelled fork of the
 *    supplied Rng, and every collection is iterated in sorted id order so that
 *    object insertion order can never change the outcome.
 *  - Linear. One pass over players, one bounded pass per AI club. No club-by-
 *    club comparisons, so a bigger league costs proportionally more, not
 *    quadratically more.
 *  - Immutable at the boundary. The argument state is never written to; a new
 *    state is returned.
 *
 * Ownership note: player-club training, transfers, fan economics and finance
 * belong to the squad-management workstream. This tick deliberately applies
 * *drift* to the player's club and full development to AI clubs, so the two
 * systems add rather than fight.
 */

export interface WorldTickContext {
  /** Events produced this cycle by matches and player actions. */
  readonly events?: readonly AnyDomainEvent[];
  /** Wall-clock stamp for generated events. Never read from a clock in here. */
  readonly at: number;
  readonly registry?: ContentRegistryPort | null;
  /** Required for any AI money movement; without it, AI transfers are intents only. */
  readonly ledger?: Ledger;
  readonly transferWindowOpen?: boolean;
  readonly maxAiTurns?: number;
  readonly nextEventId?: () => EventId;
  /** Skip media/social generation, for fast-forward tooling. */
  readonly skipContent?: boolean;
}

export interface WorldTickSummary {
  readonly aiTurns: number;
  readonly transfersCompleted: number;
  readonly injuries: number;
  readonly recoveries: number;
  readonly developments: number;
  readonly promotions: number;
  readonly managerChanges: number;
  readonly storiesPublished: number;
  readonly postsPublished: number;
  readonly followerDelta: number;
  readonly impressions: number;
}

export interface WorldTickResult {
  readonly state: GameState;
  /** Everything the world emitted; the caller publishes these on the bus. */
  readonly events: readonly AnyDomainEvent[];
  readonly stories: readonly NewsStory[];
  readonly posts: readonly SocialPost[];
  readonly aiActions: readonly AiActions[];
  readonly cascade: CascadeResult;
  readonly emergent: readonly EmergentStory[];
  readonly objectiveUpdates: readonly ObjectiveUpdate[];
  readonly summary: WorldTickSummary;
}

const sortedIds = (record: Readonly<Record<string, unknown>>): string[] => Object.keys(record).sort();

const clubRefOf = (club: Club | undefined): EntityRef[] =>
  (club ? [{ kind: 'club' as const, id: club.id, name: club.name }] : []);
const playerRefOf = (player: Player | undefined): EntityRef[] =>
  (player ? [{ kind: 'player' as const, id: player.id, name: player.displayName }] : []);

/** Attribute a position actually cares about, so growth is legible on the card. */
function developableAttribute(player: Player, rng: Rng): AttributeKey {
  const weights = POSITION_WEIGHTS[player.position];
  const keys = ATTRIBUTE_KEYS.filter((k) => (weights[k] ?? 0) > 0);
  const pool = keys.length > 0 ? keys : ATTRIBUTE_KEYS;
  return rng.weighted(pool, (k) => (weights[k] ?? 0.2) + 0.2);
}

export function tickWorld(state: GameState, rng: Rng, ctx: WorldTickContext): WorldTickResult {
  const cycle = state.clock.cycle;
  const root = rng.fork(`world:${cycle}`);
  const inputEvents = ctx.events ?? [];

  let counter = 0;
  const nextEventId = ctx.nextEventId ?? (() => `wev_${cycle}_${(counter++).toString(36)}` as EventId);
  const worldEvents: AnyDomainEvent[] = [];
  const emit = <T extends DomainEventType>(
    type: T,
    payload: DomainEventPayloads[T],
    importance: EventImportance,
    entities: readonly EntityRef[],
  ): void => {
    worldEvents.push({
      id: nextEventId(),
      type,
      payload,
      cycle,
      season: state.clock.season,
      week: state.clock.week,
      at: ctx.at,
      importance,
      entities,
    } as unknown as AnyDomainEvent);
  };

  const players: Record<string, Player> = { ...state.players };
  const clubs: Record<string, Club> = { ...state.clubs };
  const contracts: Record<string, Contract> = { ...state.contracts };
  const rivalries = { ...state.rivalries };
  const listings: Record<string, TransferListing> = { ...state.transfers.listings };

  const summary = {
    aiTurns: 0, transfersCompleted: 0, injuries: 0, recoveries: 0, developments: 0,
    promotions: 0, managerChanges: 0, storiesPublished: 0, postsPublished: 0,
    followerDelta: 0, impressions: 0,
  };

  // Which clubs played this cycle — drives fatigue and fan reaction.
  const playedThisCycle = new Set<string>();
  for (const event of inputEvents) {
    if (event.type === 'MATCH_WON' || event.type === 'MATCH_LOST' || event.type === 'MATCH_DRAWN') {
      playedThisCycle.add(event.payload.clubId);
      playedThisCycle.add((event.payload as { opponentId?: string }).opponentId ?? '');
    }
  }

  // --- phase 1: players ----------------------------------------------------
  const involvedRank = new Map<string, number>();
  for (const clubId of sortedIds(clubs)) {
    const club = clubs[clubId];
    if (!club) continue;
    const ranked = club.squad
      .map((id) => players[id])
      .filter((p): p is Player => !!p)
      .sort((a, b) => b.overall - a.overall);
    ranked.forEach((player, index) => involvedRank.set(player.id, index));
  }

  let developmentEvents = 0;
  for (const playerId of sortedIds(players)) {
    const player = players[playerId];
    if (!player) continue;
    const local = root.fork(`player:${playerId}`);
    let next: Player = player;

    if (next.injury) {
      const weeksRemaining = next.injury.weeksRemaining - 1;
      if (weeksRemaining <= 0) {
        next = { ...next, injury: null, fitness: Math.min(next.fitness, 72) };
        summary.recoveries++;
        emit('PLAYER_RECOVERED', { playerId: next.id, clubId: next.clubId as ClubId }, 2,
          [...playerRefOf(next), ...clubRefOf(next.clubId ? clubs[next.clubId] : undefined)]);
      } else {
        next = { ...next, injury: { ...next.injury, weeksRemaining } };
      }
    } else {
      const fatigueRisk = 1 + (1 - next.fitness / 100) * (W.injuries.fatigueMultiplier - 1);
      const ageRisk = next.age >= 31 ? W.injuries.veteranMultiplier : next.age <= 19 ? W.injuries.youthMultiplier : 1;
      if (local.chance(W.injuries.basePerCycle * fatigueRisk * ageRisk)) {
        const severities = Object.keys(W.injuries.severityWeights) as (keyof typeof W.injuries.severityWeights)[];
        const severity = local.weighted(severities, (s) => W.injuries.severityWeights[s]);
        const band = W.injuries.weeksBySeverity[severity];
        const weeksOut = local.int(band[0], band[1]);
        next = {
          ...next,
          injury: { severity, weeksRemaining: weeksOut, description: `${severity.toLowerCase()} injury`, sustainedCycle: cycle },
          fitness: Math.max(20, next.fitness - 15),
        };
        summary.injuries++;
        emit('PLAYER_INJURED', {
          playerId: next.id, clubId: next.clubId as ClubId, weeksOut, severity,
        }, weeksOut >= 6 ? 3 : 2, [...playerRefOf(next), ...clubRefOf(next.clubId ? clubs[next.clubId] : undefined)]);
      }
    }

    if (next.suspensionMatches > 0 && next.clubId && playedThisCycle.has(next.clubId)) {
      next = { ...next, suspensionMatches: next.suspensionMatches - 1 };
    }

    // Fitness: rest recovers, involvement costs.
    const played = next.clubId !== null && playedThisCycle.has(next.clubId) && (involvedRank.get(next.id) ?? 99) < 9;
    const fitnessDelta = next.injury ? -2 : played ? W.form.fitnessRecovery - W.form.fitnessDrain * 2 : W.form.fitnessRecovery;
    next = { ...next, fitness: clamp(next.fitness + fitnessDelta, 10, 100) };

    // Form drifts toward neutral, with variance inversely proportional to consistency.
    const volatility = W.form.driftScale * (1 - next.mental.consistency / 100);
    const rating = clamp(
      decayToward(next.form.rating, 0, W.form.idleDecay) + local.normal(0, volatility),
      -1, 1,
    );
    next = { ...next, form: { ...next.form, rating } };

    // Development. The player's own club is trained by the squad-management
    // systems; here we move the rest of the league so it does not stand still.
    const isPlayerClub = next.clubId === state.playerClubId;
    if (!isPlayerClub && !next.injury && local.chance(W.development.chancePerCycle)) {
      const growing = next.age < W.development.peakAge && next.overall < next.potential;
      const declining = next.age >= W.development.declineAge;
      if (growing || declining) {
        const key = developableAttribute(next, local);
        const step = growing
          ? local.int(1, W.development.maxStep)
          : -local.int(1, Math.max(1, W.development.maxStep - 1));
        const from = next.attributes[key];
        const to = clamp(from + step, 1, 99);
        if (to !== from) {
          const attributes = { ...next.attributes, [key]: to };
          const overall = overallFor(attributes, next.position);
          const overallChanged = overall !== next.overall;
          next = { ...next, attributes, overall };
          if (overallChanged && developmentEvents < 14 && (next.age <= 23 || next.overall >= 70)) {
            developmentEvents++;
            summary.developments++;
            emit('PLAYER_DEVELOPED', {
              playerId: next.id, clubId: next.clubId as ClubId, attribute: key, from, to,
            }, 1, [...playerRefOf(next), ...clubRefOf(next.clubId ? clubs[next.clubId] : undefined)]);
          }
        }
      }
    }

    // Market value nudges with form and age; true valuation lives in the market module.
    const formSwing = next.form.rating * W.market.formSwing;
    const agePenalty = next.age > W.development.peakAge ? (next.age - W.development.peakAge) * W.market.agePenaltyPerYear : 0;
    const drift = 1 + (formSwing - agePenalty) * W.market.driftRate;
    next = { ...next, marketValue: Math.max(1000, Math.round(next.marketValue * drift)) };

    if (next !== player) players[playerId] = next;
  }

  // Breakout detection: a young player whose numbers have climbed enough to be
  // a first-team fact, announced once per season.
  const alreadyBrokeOut = new Set<string>();
  for (const event of state.eventLog) {
    if (event.type === 'PLAYER_BREAKOUT' && event.season === state.clock.season) {
      alreadyBrokeOut.add(event.payload.playerId);
    }
  }
  for (const playerId of sortedIds(players)) {
    const player = players[playerId];
    if (!player || !player.clubId || player.age > W.development.breakoutMaxAge) continue;
    if (alreadyBrokeOut.has(playerId)) continue;
    const club = clubs[player.clubId];
    if (!club || club.squad.length === 0) continue;
    const squadAverage = club.squad.reduce((total, id) => total + (players[id]?.overall ?? 0), 0) / club.squad.length;
    if (player.overall >= squadAverage + 3 && player.form.appearances >= 3) {
      emit('PLAYER_BREAKOUT', { playerId: player.id, clubId: player.clubId, overall: player.overall }, 4,
        [...playerRefOf(player), ...clubRefOf(club)]);
      alreadyBrokeOut.add(playerId);
    }
  }

  // --- phase 2: AI clubs ---------------------------------------------------
  const table = Object.values(clubs)
    .map((club) => ({ id: club.id, pts: leaguePoints(club.seasonRecord), gd: club.seasonRecord.goalsFor - club.seasonRecord.goalsAgainst }))
    .sort((a, b) => b.pts - a.pts || b.gd - a.gd || (a.id < b.id ? -1 : 1));
  const positionOf = new Map(table.map((row, index) => [row.id, index + 1]));
  const clubCount = table.length;

  const interimForAi: GameState = { ...state, players, clubs, contracts, rivalries };
  const aiActions: AiActions[] = [];
  const aiClubIds = sortedIds(clubs)
    .filter((id) => id !== state.playerClubId)
    .slice(0, ctx.maxAiTurns ?? W.maxAiTurnsPerCycle);

  for (const clubId of aiClubIds) {
    const club = clubs[clubId];
    if (!club) continue;
    const actions = aiClubTurn(interimForAi, club.id, root.fork('ai'), {
      cycle,
      season: state.clock.season,
      leaguePosition: positionOf.get(club.id) ?? clubCount,
      clubCount,
      transferWindowOpen: ctx.transferWindowOpen ?? state.transfers.windowOpen,
    });
    aiActions.push(actions);
    summary.aiTurns++;
    const local = root.fork(`exec:${clubId}:${cycle}`);
    let nextClub = club;

    // Youth promotion.
    for (const promotedId of actions.youthPromotions) {
      const prospect = players[promotedId];
      if (!prospect) continue;
      nextClub = {
        ...nextClub,
        youthSquad: nextClub.youthSquad.filter((id) => id !== promotedId),
        squad: [...nextClub.squad, prospect.id],
      };
      summary.promotions++;
      emit('YOUTH_PROSPECT_PROMOTED', { playerId: prospect.id, clubId: nextClub.id }, 2,
        [...playerRefOf(prospect), ...clubRefOf(nextClub)]);
    }

    // Listings stock the market for everyone, including the player.
    for (const listing of actions.listings) {
      const listed = players[listing.playerId];
      if (!listed) continue;
      listings[listing.playerId] = {
        playerId: listing.playerId,
        clubId: nextClub.id,
        askingPrice: listing.askingPrice,
        wageDemand: Math.round(listed.marketValue * 0.0012),
        availability: 'AVAILABLE',
        interestedClubIds: [],
        listedCycle: cycle,
      };
    }

    // Contract renewals keep AI squads coherent over seasons.
    for (const renewal of actions.renewals) {
      const contractId = Object.keys(contracts).find(
        (id) => contracts[id]?.playerId === renewal.playerId && contracts[id]?.clubId === nextClub.id,
      );
      const contract = contractId ? contracts[contractId] : undefined;
      if (!contract || !contractId) continue;
      contracts[contractId] = {
        ...contract,
        wage: renewal.wage,
        weeksRemaining: contract.weeksRemaining + renewal.years * 20,
        totalWeeks: contract.totalWeeks + renewal.years * 20,
        signedCycle: cycle,
      };
      emit('CONTRACT_SIGNED', {
        contractId: contract.id, playerId: renewal.playerId, clubId: nextClub.id,
        years: renewal.years, wage: renewal.wage,
      }, 1, [...playerRefOf(players[renewal.playerId]), ...clubRefOf(nextClub)]);
    }

    for (const releasedId of actions.releases) {
      const released = players[releasedId];
      if (!released) continue;
      players[releasedId] = { ...released, clubId: null, contractId: null };
      nextClub = { ...nextClub, squad: nextClub.squad.filter((id) => id !== releasedId) };
      emit('PLAYER_RELEASED', { playerId: released.id, clubId: nextClub.id }, 1,
        [...playerRefOf(released), ...clubRefOf(nextClub)]);
    }

    if (actions.tacticalShift) {
      nextClub = { ...nextClub, tactics: { ...nextClub.tactics, ...actions.tacticalShift } };
    }

    // Facility investment. Money only ever moves through the ledger.
    const ledger = ctx.ledger;
    if (actions.facilityInvestment && ledger) {
      const investment = actions.facilityInvestment;
      const result = ledger.debit(nextClub.id, 'FACILITY_UPGRADE', investment.cost,
        `Upgrade ${investment.facilityId} to level ${investment.toLevel}`,
        { cycle, season: state.clock.season, at: ctx.at });
      if (result.ok) {
        nextClub = {
          ...nextClub,
          facilityLevels: { ...nextClub.facilityLevels, [investment.facilityId]: investment.toLevel },
          finance: { ...nextClub.finance, transferBudget: Math.max(0, nextClub.finance.transferBudget - investment.cost) },
        };
        emit('FACILITY_UPGRADED', {
          clubId: nextClub.id, facilityId: investment.facilityId as never, level: investment.toLevel,
        }, 2, clubRefOf(nextClub));
      }
    }

    // Commercial growth: reputation converts into deals over time.
    if (ledger && nextClub.reputation >= 58 && local.chance(0.06)) {
      const value = Math.round(nextClub.reputation * 9_000);
      const result = ledger.credit(nextClub.id, 'SPONSOR_REVENUE', value,
        'New sponsorship agreement', { cycle, season: state.clock.season, at: ctx.at });
      if (result.ok) {
        emit('SPONSOR_SIGNED', {
          clubId: nextClub.id, sponsorId: `spn_ai_${clubId}_${cycle}` as SponsorId, value,
        }, 2, clubRefOf(nextClub));
      }
    }

    // A board that has run out of patience.
    if (nextClub.managerId && managerPressure(interimForAi, nextClub.id) >= CASCADE_BALANCE.managerPressure.crisisThreshold
      && local.chance(0.3)) {
      const manager = state.managers[nextClub.managerId];
      emit('MANAGER_SACKED', { clubId: nextClub.id, managerName: manager?.name ?? 'The manager' }, 4, clubRefOf(nextClub));
      nextClub = { ...nextClub, managerId: null };
      summary.managerChanges++;
    }

    clubs[clubId] = nextClub;
  }

  // AI transfer execution, one deal per club per cycle so the market breathes.
  const ledger = ctx.ledger;
  if (ledger && (ctx.transferWindowOpen ?? state.transfers.windowOpen)) {
    for (const actions of aiActions) {
      const buyer = clubs[actions.clubId];
      if (!buyer) continue;
      for (const target of actions.transferTargets) {
        const player = players[target.playerId];
        if (!player) continue;
        // Never move a player out of the human's club behind their back.
        if (player.clubId === state.playerClubId) continue;
        const seller = player.clubId ? clubs[player.clubId] : null;
        const listing = listings[player.id];
        const fee = Math.min(target.maxFee, listing?.askingPrice ?? (player.clubId ? player.marketValue : 0));
        if (fee > 0) {
          if (!ledger.canAfford(buyer.id, fee)) continue;
          const paid = ledger.post({
            kind: 'TRANSFER_OUT', amount: fee,
            from: clubAccount(buyer.id), to: worldAccount('transfer_market'),
            memo: `Signed ${player.displayName}`,
            metadata: { playerId: player.id },
          }, { cycle, season: state.clock.season, at: ctx.at });
          if (!paid.ok) continue;
          if (seller) {
            ledger.post({
              kind: 'TRANSFER_IN', amount: fee,
              from: worldAccount('transfer_market'), to: clubAccount(seller.id),
              memo: `Sold ${player.displayName}`,
              metadata: { playerId: player.id },
            }, { cycle, season: state.clock.season, at: ctx.at });
          }
        }

        players[player.id] = { ...player, clubId: buyer.id, contractId: `ct_ai_${cycle}_${player.id}` as ContractId };
        contracts[`ct_ai_${cycle}_${player.id}`] = {
          id: `ct_ai_${cycle}_${player.id}` as ContractId,
          playerId: player.id,
          clubId: buyer.id,
          wage: target.wageOffer,
          weeksRemaining: 60,
          totalWeeks: 60,
          signingBonus: 0,
          bonuses: { appearance: 0, goal: 0, cleanSheet: 0, seasonPerformance: 0, trophy: 0, promotion: 0 },
          role: 'ROTATION',
          releaseClause: null,
          loyaltyBonus: 0,
          signedCycle: cycle,
          minutesPlayed: 0,
          minutesAvailable: 0,
        };
        clubs[buyer.id] = {
          ...buyer,
          squad: [...buyer.squad, player.id],
          finance: { ...buyer.finance, transferBudget: Math.max(0, buyer.finance.transferBudget - fee) },
        };
        if (seller) {
          clubs[seller.id] = {
            ...seller,
            squad: seller.squad.filter((id) => id !== player.id),
            finance: { ...seller.finance, transferBudget: seller.finance.transferBudget + fee },
          };
          emit('PLAYER_SOLD', { playerId: player.id, fromClubId: seller.id, toClubId: buyer.id, fee }, 2,
            [...playerRefOf(player), ...clubRefOf(seller), ...clubRefOf(buyer)]);
        }
        delete listings[player.id];
        summary.transfersCompleted++;
        emit('PLAYER_SIGNED', {
          playerId: player.id, clubId: buyer.id, fee, wage: target.wageOffer,
          ...(seller ? { fromClubId: seller.id } : {}),
        }, fee > buyer.finance.wageBudgetPerCycle * 6 ? 4 : 2,
          [...playerRefOf(player), ...clubRefOf(buyer)]);
        break;
      }
    }
  }

  // --- phase 3: records ----------------------------------------------------
  const preCascadeState: GameState = { ...state, players, clubs, contracts, rivalries };
  for (const record of detectRecords(preCascadeState)) {
    emit('RECORD_BROKEN', {
      clubId: record.clubId, record: record.label, value: record.value,
      ...(record.holderId ? { holderId: record.holderId } : {}),
    }, 5, [...clubRefOf(clubs[record.clubId]), ...playerRefOf(record.holderId ? players[record.holderId] : undefined)]);
  }

  // --- phase 4: cascade ----------------------------------------------------
  const batch = [...inputEvents, ...worldEvents];
  const cascade = expandCascade(batch, preCascadeState, { cycle });
  for (const delta of cascade.deltas) applyDelta(delta, players, clubs, rivalries, cycle);

  // --- phase 5: drift ------------------------------------------------------
  for (const clubId of sortedIds(clubs)) {
    const club = clubs[clubId];
    if (!club) continue;
    const sentiment = decayToward(club.fans.sentiment, W.fans.restingSentiment, W.fans.driftRate);
    const excitement = decayToward(club.fans.excitement, 50, W.fans.driftRate);
    const performing = leaguePoints(club.seasonRecord) >= club.seasonRecord.played * 1.6;
    const expectation = clamp(
      club.fans.expectation + (performing ? W.fans.expectationDrift * 10 : -W.fans.expectationDrift * 4),
      10, 100,
    );
    clubs[clubId] = {
      ...club,
      fans: {
        ...club.fans,
        sentiment: clamp(sentiment, 0, 100),
        excitement: clamp(excitement, 0, 100),
        expectation,
      },
    };
  }
  for (const key of Object.keys(rivalries).sort()) {
    const rivalry = rivalries[key];
    if (rivalry) rivalries[key] = decayRivalry(rivalry, cycle);
  }

  // --- phase 6: content ----------------------------------------------------
  const contentState: GameState = {
    ...state,
    players, clubs, contracts, rivalries,
    eventLog: [...state.eventLog, ...batch, ...cascade.derivedEvents].slice(-W.retention.eventLog),
  };
  const emergent = ctx.skipContent ? [] : detectEmergentStories(contentState, cycle);
  const extraHooks = emergentHooks(emergent, cycle);

  const stories = ctx.skipContent ? [] : generateStories(
    batch, contentState, root.fork('media'), ctx.registry ?? null, { cascade, extraHooks, cycle },
  );
  const posts = ctx.skipContent ? [] : generatePosts(
    batch, contentState, root.fork('social'), ctx.registry ?? null, { cascade, extraHooks, cycle },
  );
  summary.storiesPublished = stories.length;
  summary.postsPublished = posts.length;

  const nextSocial = {
    posts: [...state.social.posts, ...posts].slice(-W.retention.posts),
    clubFollowers: state.social.clubFollowers,
    weeklyImpressions: state.social.weeklyImpressions,
  };
  const reach = socialReach({ ...contentState, social: nextSocial });
  summary.followerDelta = reach.followerDelta;
  summary.impressions = reach.impressions;

  const playerClub = clubs[state.playerClubId];
  if (playerClub) {
    const followers = Math.max(0, playerClub.fans.onlineFollowers + reach.followerDelta);
    clubs[state.playerClubId] = { ...playerClub, fans: { ...playerClub.fans, onlineFollowers: followers } };
  }
  for (const story of stories) {
    if (story.importance >= 4) {
      emit('STORY_PUBLISHED', {
        storyId: story.id as never, headline: story.headline, importance: story.importance,
      }, story.importance, story.entities.map((e) => ({ kind: e.kind as EntityRef['kind'], id: e.id, name: e.name })));
    }
  }

  // --- phase 7: progression ------------------------------------------------
  const allEvents = [...batch, ...cascade.derivedEvents];
  const objectiveUpdates = updateObjectiveProgress(contentState, allEvents);
  const objectives = applyObjectiveUpdates(contentState, objectiveUpdates);
  const legacy = updateLegacy(contentState, allEvents);

  for (const update of objectiveUpdates) {
    if (!update.justCompleted) continue;
    const objective = [...contentState.objectives.active, ...contentState.objectives.seasonTargets]
      .find((o) => o.id === update.objectiveId);
    if (!objective) continue;
    emit('OBJECTIVE_COMPLETED', {
      objectiveId: objective.id as never,
      title: objective.title,
      rewardSummary: objective.rewards.map((r) => r.label).join(', '),
    }, objective.importance as EventImportance, clubRefOf(clubs[state.playerClubId]));
  }

  const finalEvents = [...worldEvents, ...cascade.derivedEvents];
  const nextState: GameState = {
    ...state,
    players,
    clubs,
    contracts,
    rivalries,
    transfers: { ...state.transfers, listings },
    media: { stories: [...state.media.stories, ...stories].slice(-W.retention.stories) },
    social: {
      posts: nextSocial.posts,
      clubFollowers: clubs[state.playerClubId]?.fans.onlineFollowers ?? state.social.clubFollowers,
      weeklyImpressions: reach.impressions,
    },
    objectives,
    legacy,
    eventLog: [...state.eventLog, ...inputEvents, ...finalEvents].slice(-W.retention.eventLog),
    ...(ctx.ledger ? { ledger: ctx.ledger.snapshot() } : {}),
  };

  return {
    state: nextState,
    events: finalEvents,
    stories,
    posts,
    aiActions,
    cascade,
    emergent,
    objectiveUpdates,
    summary,
  };
}

/** Apply one described change. Deltas are damped by the cascade, not here. */
function applyDelta(
  delta: WorldDelta,
  players: Record<string, Player>,
  clubs: Record<string, Club>,
  rivalries: Record<string, GameState['rivalries'][string]>,
  cycle: number,
): void {
  switch (delta.kind) {
    case 'PLAYER_SUSPENSION': {
      const player = players[delta.playerId];
      if (player) players[delta.playerId] = { ...player, suspensionMatches: player.suspensionMatches + delta.matches };
      break;
    }
    case 'PLAYER_MORALE': {
      const player = players[delta.playerId];
      if (player) {
        players[delta.playerId] = {
          ...player,
          mental: { ...player.mental, morale: clamp(player.mental.morale + delta.delta, 1, 99) },
        };
      }
      break;
    }
    case 'SQUAD_MORALE': {
      const club = clubs[delta.clubId];
      if (!club) break;
      for (const id of club.squad) {
        const player = players[id];
        if (!player) continue;
        players[id] = {
          ...player,
          mental: { ...player.mental, morale: clamp(player.mental.morale + delta.delta, 1, 99) },
        };
      }
      break;
    }
    case 'FAN_SENTIMENT': {
      const club = clubs[delta.clubId];
      if (club) {
        clubs[delta.clubId] = {
          ...club,
          fans: { ...club.fans, sentiment: clamp(club.fans.sentiment + delta.delta, 0, 100) },
        };
      }
      break;
    }
    case 'FAN_EXCITEMENT': {
      const club = clubs[delta.clubId];
      if (club) {
        clubs[delta.clubId] = {
          ...club,
          fans: { ...club.fans, excitement: clamp(club.fans.excitement + delta.delta, 0, 100) },
        };
      }
      break;
    }
    case 'FAN_EXPECTATION': {
      const club = clubs[delta.clubId];
      if (club) {
        clubs[delta.clubId] = {
          ...club,
          fans: { ...club.fans, expectation: clamp(club.fans.expectation + delta.delta, 0, 100) },
        };
      }
      break;
    }
    case 'CLUB_REPUTATION': {
      const club = clubs[delta.clubId];
      if (club) clubs[delta.clubId] = { ...club, reputation: clamp(club.reputation + delta.delta, 1, 100) };
      break;
    }
    case 'RIVALRY_INTENSITY': {
      const key = rivalryKey(delta.clubA, delta.clubB);
      const rivalry = rivalries[key];
      if (rivalry) {
        rivalries[key] = {
          ...rivalry,
          intensity: clamp(rivalry.intensity + delta.delta, 0, 100),
          incidents: [...rivalry.incidents, { cycle, text: delta.reason, severity: 2 }].slice(-24),
        };
      }
      break;
    }
    case 'MANAGER_PRESSURE':
      // Pressure is derived from results on read, never stored, so there is
      // nothing to write here — the delta exists for the UI and for tests.
      break;
    default:
      break;
  }
}
