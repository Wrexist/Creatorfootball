import type { ClubId, ContractId, CreatorId, EventId, RivalryId, SponsorId, TransferId } from '../core/brand';
import type { AnyDomainEvent, DomainEventPayloads, DomainEventType, EntityRef, EventImportance } from '../core/events';
import type {
  GameState, Negotiation, NewsStory, SocialPost, TransferListing,
} from '../game/state';
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
import { traitModifier } from '../players/traits';
import { generateStories } from '../media/mediaEngine';
import { generatePosts, socialReach } from '../social/socialEngine';
import { SOCIAL_BALANCE } from '../social/balance';
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


/**
 * The loudest creator post of a given cycle, if it cleared the bar that makes a
 * clip a *moment* rather than a post. Read back off the retained feed so the
 * event describes something the player can scroll to.
 */
function topCreatorPost(
  state: GameState,
  cycle: number,
): { creatorId: CreatorId; clubId: ClubId; reach: number } | null {
  let best: SocialPost | null = null;
  for (const post of state.social.posts) {
    if (post.cycle !== cycle) continue;
    if (!post.tags.includes('creator-voice')) continue;
    if (!best || post.likes > best.likes || (post.likes === best.likes && post.id < best.id)) best = post;
  }
  if (!best) return null;
  const reach = best.likes * SOCIAL_BALANCE.impressionsPerLike
    + best.reposts * SOCIAL_BALANCE.impressionsPerRepost;
  if (reach < W.creatorNews.momentReach) return null;
  const creator = Object.values(state.creators)
    .filter((c) => `@${c.handle.replace(/^@/, '')}` === best?.authorHandle)
    .sort((a, b) => (a.id < b.id ? -1 : 1))[0];
  if (!creator) return null;
  const clubId = creator.clubId ?? state.playerClubId;
  return { creatorId: creator.id, clubId, reach };
}

/**
 * Things that happen to a club rather than to a player, announced.
 *
 * Every one of these was already true in the state and simply never said out
 * loud, which is why the templates written for them were unreachable. Nothing
 * here invents a fact: the sponsor really did walk (the ledger has the penalty),
 * the balance really is that low, the fixture really is next on the list.
 */
function emitWorldNews(args: {
  state: GameState;
  clubs: Record<string, Club>;
  players: Record<string, Player>;
  cycle: number;
  emit: <T extends DomainEventType>(
    type: T, payload: DomainEventPayloads[T], importance: EventImportance,
    entities: readonly EntityRef[],
  ) => void;
  ledger: Ledger | null;
  lastCycleTopCreatorPost: { creatorId: CreatorId; clubId: ClubId; reach: number } | null;
}): void {
  const { state, clubs, cycle, emit, ledger } = args;
  const playerClub = clubs[state.playerClubId];

  // A sponsor walking away is recorded as a termination penalty in the ledger.
  // Reading it back is how this stays honest — no event without the money.
  if (ledger) {
    for (const tx of ledger.snapshot().transactions) {
      if (tx.cycle !== cycle || tx.kind !== 'PENALTY') continue;
      const sponsorId = tx.metadata?.['sponsorId'];
      if (typeof sponsorId !== 'string') continue;
      const clubId = tx.from.kind === 'club' ? tx.from.clubId : state.playerClubId;
      emit('SPONSOR_LOST', {
        clubId, sponsorId: sponsorId as SponsorId, reason: 'performance clause triggered',
      }, 3, clubRefOf(clubs[clubId]));
    }
  }

  // Running out of money, said once rather than every week until it is fixed.
  if (ledger && playerClub) {
    const cash = ledger.balanceOf(state.playerClubId).CASH;
    const saidRecently = state.eventLog.some(
      (e) => e.type === 'BALANCE_LOW' && e.cycle > cycle - W.financeNews.repeatCooldownCycles,
    );
    if (cash < W.financeNews.lowBalance && !saidRecently) {
      emit('BALANCE_LOW', { clubId: state.playerClubId, balance: cash }, 3, clubRefOf(playerClub));
    }
  }

  // Next week's fixture. The press previewing a match is not a simulation
  // detail, it is the only forward-looking beat the world has.
  const nextWeek = state.clock.week + 2;
  const upcoming = Object.values(state.fixtures)
    .filter((f) => f.week === nextWeek && f.status === 'SCHEDULED'
      && (f.homeClubId === state.playerClubId || f.awayClubId === state.playerClubId))
    .sort((a, b) => (a.id < b.id ? -1 : 1))[0];
  if (upcoming) {
    emit('MATCH_SCHEDULED', {
      matchId: (upcoming.matchId ?? upcoming.id) as never,
      homeClubId: upcoming.homeClubId, awayClubId: upcoming.awayClubId, week: upcoming.week,
    }, 2, [...clubRefOf(clubs[upcoming.homeClubId]), ...clubRefOf(clubs[upcoming.awayClubId])]);
  }

  // A creator clip that actually travelled.
  const moment = args.lastCycleTopCreatorPost;
  if (moment) {
    const creator = state.creators[moment.creatorId];
    emit('CREATOR_MOMENT', {
      creatorId: moment.creatorId, clubId: moment.clubId, kind: 'clip', reach: moment.reach,
    }, 2, [
      ...(creator ? [{ kind: 'creator' as const, id: creator.id, name: creator.displayName }] : []),
      ...clubRefOf(clubs[moment.clubId]),
    ]);
  }
}


/**
 * Squad chemistry, and what it is worth.
 *
 * `chemistry`, `teammateMorale` and `moraleResilience` were three trait
 * modifier keys with **no consumer anywhere in the repo** while being labelled
 * on the player profile screen — the product advertising an effect that did not
 * exist. They belong here rather than in the match model: they are properties
 * of a dressing room over weeks, not of a duel over ninety seconds.
 *
 * `squadCohesion` is a 0-1 read of how well a squad holds together: the sum of
 * its `chemistry` traits against squad size, centred so an untraited squad
 * sits at the neutral point and a squad of selfish mercenaries sits below it.
 */
export function squadCohesion(club: Club, players: Readonly<Record<string, Player>>): number {
  if (club.squad.length === 0) return W.chemistry.neutralCohesion;
  let total = 0;
  let counted = 0;
  for (const id of club.squad) {
    const player = players[id];
    if (!player) continue;
    counted++;
    total += traitModifier(player.traitIds, 'chemistry');
  }
  if (counted === 0) return W.chemistry.neutralCohesion;
  return clamp(
    W.chemistry.neutralCohesion + (total / counted) * W.chemistry.cohesionPerChemistryPoint,
    0, 1,
  );
}

/** The squad-wide morale pull the dressing room's leaders exert, in points. */
export function squadMoraleSpread(club: Club, players: Readonly<Record<string, Player>>): number {
  let total = 0;
  for (const id of club.squad) {
    const player = players[id];
    if (!player) continue;
    total += traitModifier(player.traitIds, 'teammateMorale');
  }
  return total * W.chemistry.moralePerTeammatePoint;
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
  const negotiations: Record<string, Negotiation> = { ...state.transfers.negotiations };
  let bidEvents = 0;

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

  // Cohesion is read once per club, before anyone moves, so a squad's chemistry
  // is a property of the squad the week started with. It pulls form as well as
  // morale: a settled dressing room drifts toward playing well rather than
  // toward nothing, and `form.rating` is read by the match model.
  const cohesionByClub = new Map<string, number>();
  for (const clubId of sortedIds(state.clubs)) {
    const club = state.clubs[clubId];
    if (club) cohesionByClub.set(clubId, squadCohesion(club, state.players));
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

    // Form drifts toward the level the dressing room supports, with variance
    // inversely proportional to consistency.
    const volatility = W.form.driftScale * (1 - next.mental.consistency / 100);
    const cohesion = next.clubId ? cohesionByClub.get(next.clubId) ?? W.chemistry.neutralCohesion : W.chemistry.neutralCohesion;
    const formTarget = (cohesion - W.chemistry.neutralCohesion) * W.chemistry.formPerCohesion;
    const rating = clamp(
      decayToward(next.form.rating, formTarget, W.form.idleDecay) + local.normal(0, volatility),
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
    // Fork per club, not once per label: forking 'ai' repeatedly handed every
    // club in the league the identical stream, so twelve supposedly independent
    // AI clubs were making correlated decisions every single cycle.
    const actions = aiClubTurn(interimForAi, club.id, root.fork(`ai:${club.id}`), {
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
      if (released.contractId) delete contracts[released.contractId];
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
      for (const target of actions.transferTargets) {
        // Re-read the club each iteration. Capturing it once meant a second
        // signing in the same cycle wrote from a stale copy and silently
        // dropped the first, leaving the player pointing at a club whose squad
        // no longer listed him.
        const buyer = clubs[actions.clubId];
        if (!buyer) continue;
        const player = players[target.playerId];
        if (!player) continue;
        // Never move a player out of the human's club behind their back.
        if (player.clubId === state.playerClubId) continue;
        const seller = player.clubId ? clubs[player.clubId] : null;
        const listing = listings[player.id];
        const fee = Math.min(target.maxFee, listing?.askingPrice ?? (player.clubId ? player.marketValue : 0));
        if (fee > 0) {
          if (bidEvents < W.transferNews.maxBidEventsPerCycle && seller) {
            bidEvents++;
            emit('TRANSFER_BID_MADE', {
              transferId: `tr_ai_${cycle}_${player.id}` as TransferId,
              playerId: player.id, fromClubId: seller.id, toClubId: buyer.id, amount: fee,
            }, 2, [...playerRefOf(player), ...clubRefOf(buyer)]);
          }
          if (!ledger.canAfford(buyer.id, fee)) {
            // A bid the buyer cannot fund is a rejection with a reason, not a
            // silent `continue` — it is one of the transfer stories the pack
            // has lines for and the world never told.
            if (bidEvents <= W.transferNews.maxBidEventsPerCycle && seller) {
              emit('TRANSFER_BID_REJECTED', {
                transferId: `tr_ai_${cycle}_${player.id}` as TransferId,
                playerId: player.id, reason: 'the money is not there',
              }, 2, [...playerRefOf(player), ...clubRefOf(seller)]);
            }
            continue;
          }
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

        // Retire the previous deal. Leaving it behind is how a player ends up
        // holding two contracts, which makes the league-wide wage bill wrong.
        if (player.contractId) delete contracts[player.contractId];
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
            // Academy players are listed in youthSquad, not squad. Filtering
            // only the senior list left a sold prospect registered at both
            // clubs at once — the duplicate-ownership corruption that silently
            // doubles a player's value and that the save validator hunts for.
            youthSquad: seller.youthSquad.filter((id) => id !== player.id),
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
        if (seller) {
          emit('TRANSFER_COMPLETED', {
            transferId: `tr_ai_${cycle}_${player.id}` as TransferId,
            playerId: player.id, fromClubId: seller.id, toClubId: buyer.id, fee,
          }, 2, [...playerRefOf(player), ...clubRefOf(seller), ...clubRefOf(buyer)]);
        }
        // If the human was in talks for this player, they have just been
        // gazumped. The negotiation is closed for real, so the story the feed
        // tells about it is describing something that actually happened.
        for (const negId of Object.keys(negotiations).sort()) {
          const neg = negotiations[negId];
          if (!neg || neg.playerId !== player.id) continue;
          if (neg.toClubId !== state.playerClubId) continue;
          if (neg.stage === 'AGREED' || neg.stage === 'FAILED' || neg.stage === 'HIJACKED') continue;
          negotiations[negId] = { ...neg, stage: 'HIJACKED' };
          emit('TRANSFER_HIJACKED', {
            playerId: player.id, byClubId: buyer.id, fromClubId: state.playerClubId,
          }, 4, [...playerRefOf(player), ...clubRefOf(buyer), ...clubRefOf(clubs[state.playerClubId])]);
        }
        break;
      }
    }
  }

  // --- phase 3: records ----------------------------------------------------
  const preCascadeState: GameState = { ...state, players, clubs, contracts, rivalries };
  // Season aggregates are only news once the season they summarise is over.
  // Evaluating "most points in a season" every week against a running total
  // re-broke the same record twenty-two times and made a quarter of the press
  // one headline; see progression/legacy.ts for the full argument.
  const totalWeeks = state.seasons[state.currentSeasonId]?.totalWeeks ?? 22;
  const finalWeekOfSeason = state.clock.week + 1 >= totalWeeks;
  for (const record of detectRecords(preCascadeState, { seasonAggregates: finalWeekOfSeason })) {
    emit('RECORD_BROKEN', {
      clubId: record.clubId, record: record.label, value: record.value,
      ...(record.holderId ? { holderId: record.holderId } : {}),
    }, 5, [...clubRefOf(clubs[record.clubId]), ...playerRefOf(record.holderId ? players[record.holderId] : undefined)]);
  }

  // --- phase 3b: the world's own news --------------------------------------
  emitWorldNews({
    state, clubs, players, cycle, emit, ledger: ctx.ledger ?? null,
    lastCycleTopCreatorPost: topCreatorPost(state, cycle - 1),
  });

  // --- phase 3c: objectives ------------------------------------------------
  // Evaluated *before* the cascade rather than after it, so that finishing or
  // missing an objective is news this cycle instead of a line in the log that
  // no template can ever see. Objective progress reads match and squad events
  // only, none of which the cascade derives, so nothing is lost by the move.
  const objectiveState: GameState = {
    ...preCascadeState,
    eventLog: [...state.eventLog, ...inputEvents, ...worldEvents].slice(-W.retention.eventLog),
  };
  const objectiveUpdates = updateObjectiveProgress(objectiveState, [...inputEvents, ...worldEvents]);
  const objectives = applyObjectiveUpdates(objectiveState, objectiveUpdates);
  const liveObjectives = [...state.objectives.active, ...state.objectives.seasonTargets];
  for (const update of objectiveUpdates) {
    const objective = liveObjectives.find((o) => o.id === update.objectiveId);
    if (!objective) continue;
    if (update.justCompleted) {
      emit('OBJECTIVE_COMPLETED', {
        objectiveId: objective.id as never,
        title: objective.title,
        rewardSummary: objective.rewards.map((r) => r.label).join(', '),
      }, objective.importance as EventImportance, clubRefOf(clubs[state.playerClubId]));
    } else if (update.justFailed) {
      emit('OBJECTIVE_FAILED', {
        objectiveId: objective.id as never, title: objective.title,
      }, objective.importance as EventImportance, clubRefOf(clubs[state.playerClubId]));
    }
  }

  // --- phase 4: cascade ----------------------------------------------------
  const batch = [...inputEvents, ...worldEvents];
  const worldEventsBeforeCascade = worldEvents.length;
  const baseCascade = expandCascade(batch, preCascadeState, { cycle });

  // A rivalry the cascade wants to heat up but that does not exist yet is a
  // rivalry being *born* — two clubs that keep colliding. Creating it here is
  // what turns an unseeded pairing into a fixture with a history, and it is the
  // only producer of RIVALRY_CREATED in the game.
  for (const delta of baseCascade.deltas) {
    if (delta.kind !== 'RIVALRY_INTENSITY') continue;
    const key = rivalryKey(delta.clubA, delta.clubB);
    if (rivalries[key]) continue;
    rivalries[key] = {
      id: key,
      clubAId: delta.clubA,
      clubBId: delta.clubB,
      intensity: W.rivalries.bornIntensity,
      origin: 'PROXIMITY',
      meetings: 0,
      aWins: 0,
      bWins: 0,
      draws: 0,
      incidents: [],
      lastMeetingCycle: cycle,
    };
    emit('RIVALRY_CREATED', {
      rivalryId: key as RivalryId, clubA: delta.clubA, clubB: delta.clubB,
    }, 3, [...clubRefOf(clubs[delta.clubA]), ...clubRefOf(clubs[delta.clubB])]);
  }

  const reputationBefore = new Map<string, number>();
  for (const clubId of sortedIds(clubs)) reputationBefore.set(clubId, clubs[clubId]?.reputation ?? 0);

  for (const delta of baseCascade.deltas) applyDelta(delta, players, clubs, rivalries, cycle);

  // Reputation moving is a fact about the world, and until now it moved in
  // silence — the specific thing the event contract says must never happen.
  for (const clubId of sortedIds(clubs)) {
    const before = reputationBefore.get(clubId) ?? 0;
    const after = clubs[clubId]?.reputation ?? 0;
    if (Math.abs(after - before) < W.reputationNews.minDelta) continue;
    emit('REPUTATION_CHANGED', {
      clubId: clubId as ClubId, from: before, to: after,
      reason: after > before ? 'results on the pitch' : 'a season going the wrong way',
    }, 2, clubRefOf(clubs[clubId]));
  }

  // The events raised while resolving the cascade — a rivalry born, a
  // reputation moved — deserve the same treatment as the ones that caused
  // them. Without this second pass they land in the journal and no template
  // ever sees them, which is the exact failure this whole pass is fixing.
  const lateEvents = worldEvents.slice(worldEventsBeforeCascade);
  const lateCascade = lateEvents.length > 0
    ? expandCascade(lateEvents, preCascadeState, { cycle, skipFollowUps: true })
    : null;
  if (lateCascade) {
    for (const delta of lateCascade.deltas) applyDelta(delta, players, clubs, rivalries, cycle);
  }
  const cascade: CascadeResult = lateCascade
    ? {
      derivedEvents: [...baseCascade.derivedEvents, ...lateCascade.derivedEvents],
      nodes: [...baseCascade.nodes, ...lateCascade.nodes],
      deltas: [...baseCascade.deltas, ...lateCascade.deltas],
      mediaHooks: [...baseCascade.mediaHooks, ...lateCascade.mediaHooks],
      socialHooks: [...baseCascade.socialHooks, ...lateCascade.socialHooks],
      chains: { ...baseCascade.chains, ...lateCascade.chains },
    }
    : baseCascade;
  const fullBatch = [...batch, ...lateEvents];

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

  // --- phase 5b: the dressing room ----------------------------------------
  //
  // Morale drifts toward a resting point set by how the season is going and by
  // how well the squad holds together, and the leaders in the room drag
  // everyone with them. `moraleResilience` is what decides how far a player is
  // dragged *down*: a resilient professional barely moves on a bad week, and
  // Fragile (moraleResilience -0.35) falls off a cliff.
  for (const clubId of sortedIds(clubs)) {
    const club = clubs[clubId];
    if (!club || club.squad.length === 0) continue;
    const cohesion = squadCohesion(club, players);
    const spread = squadMoraleSpread(club, players);
    const record = club.seasonRecord;
    const formShare = record.played > 0 ? leaguePoints(record) / (record.played * 3) : 0.4;
    const resting = clamp(
      W.chemistry.restingMorale
      + (formShare - 0.4) * W.chemistry.moralePerFormShare
      + (cohesion - W.chemistry.neutralCohesion) * W.chemistry.moralePerCohesion
      + spread,
      5, 95,
    );
    for (const id of club.squad) {
      const player = players[id];
      if (!player) continue;
      const raw = (resting - player.mental.morale) * W.chemistry.moraleDriftRate;
      // Resistance applies to the fall, not the rise. A resilient player is
      // hard to knock down, not slow to cheer up.
      const resilience = traitModifier(player.traitIds, 'moraleResilience');
      const delta = raw < 0 ? raw / Math.max(0.25, 1 + resilience) : raw;
      const morale = clamp(player.mental.morale + delta, 1, 99);
      if (morale === player.mental.morale) continue;
      players[id] = { ...player, mental: { ...player.mental, morale } };
    }
  }

  // --- phase 6: content ----------------------------------------------------
  const contentState: GameState = {
    ...state,
    players, clubs, contracts, rivalries,
    eventLog: [...state.eventLog, ...fullBatch, ...cascade.derivedEvents].slice(-W.retention.eventLog),
  };
  const emergent = ctx.skipContent ? [] : detectEmergentStories(contentState, cycle);
  const extraHooks = emergentHooks(emergent, cycle);

  const stories = ctx.skipContent ? [] : generateStories(
    fullBatch, contentState, root.fork('media'), ctx.registry ?? null, { cascade, extraHooks, cycle },
  );
  const posts = ctx.skipContent ? [] : generatePosts(
    fullBatch, contentState, root.fork('social'), ctx.registry ?? null, { cascade, extraHooks, cycle },
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
  const allEvents = [...fullBatch, ...cascade.derivedEvents];
  const legacy = updateLegacy(contentState, allEvents);

  const finalEvents = [...worldEvents, ...cascade.derivedEvents];
  const nextState: GameState = {
    ...state,
    players,
    clubs,
    contracts,
    rivalries,
    transfers: { ...state.transfers, listings, negotiations },
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
