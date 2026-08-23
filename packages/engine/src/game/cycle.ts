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
import { refreshMarket } from '../transfers/market';
import { tickSocialWorld, type SettledStake } from '../social/socialTick';
import { generateSponsorOffers, signSponsorOffer } from '../sponsors/sponsors';
import { advanceScouting } from '../transfers/scouting';
import { facilityEffect } from '../facilities/facilities';
import { renewContract } from '../contracts/wages';
import { defaultValuationContext, wageDemand } from '../transfers/valuation';
import { asId } from '../core/brand';
import type { ContractId } from '../core/brand';
import { emptyBonuses } from '../contracts/contract';
import { updateRivalry, rivalryFor } from '../rivalries/rivalries';
import { rollObjectives } from '../progression/objectives';
import { updateLegacy } from '../progression/legacy';
import { ContentRegistry, BASE_PACK, type CreatorSeasonConfigDef } from '../content';
import { applyMatchResult } from './applyResult';
import { buildMatchSetup } from './matchSetup';
import { rolloverSeason } from './seasonRollover';
import { GameEventFactory } from './eventFactory';
import { appendEvents, patchClub, patchPlayer, setContract, transferPlayer } from './mutations';
import { clubCreators, recentForm, squadWageBill } from './selectors';

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
  /** Promises the player made in public that this week's results judged. */
  readonly settledStakes: readonly SettledStake[];
  readonly followerMilestones: readonly string[];
  readonly viralMoments: readonly string[];
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
      : simulateMatch(buildMatchSetup(next, fixture, config, {
        // The registry's authored bank finally reaches a runtime reader: the
        // live book merges it with its built-in table for every simulated match.
        commentaryLines: registry.commentary(),
      }));

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

  // --- 3b. clubs protect the players they want to keep -----------------
  next = renewKeyContracts(next, rng.fork('renewals'));

  // --- 3c. contracts run down, and some of them run out ----------------
  const contractOutcome = tickContracts(next, events);
  next = contractOutcome.state;
  allEvents.push(...contractOutcome.events);

  // --- 3d. clubs left short of bodies go to the free market ------------
  const rebuilt = replenishSquads(next, rng.fork('replenish'), config.squadSize, events);
  next = rebuilt.state;
  allEvents.push(...rebuilt.events);

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

  // --- 4b. sponsors come to the table ----------------------------------
  // The financial cycle advances deals that already exist but never creates
  // one, so without this the club could never sign its first sponsor and
  // sponsorship — the dominant income line in this format by design — stayed
  // permanently at zero.
  const sponsorOffers = generateSponsorOffers(
    finance.club,
    registry,
    rng.fork('sponsorOffers'),
    {
      cycle: next.clock.cycle,
      season: next.clock.season,
      reach: finance.reach,
      leaguePosition: position > 0 ? position : standings.length,
      leagueSize: standings.length,
      brandBuilding: next.managers[next.playerManagerId]?.attributes.brandBuilding ?? 50,
      creatorReachBonus: facilityEffect(finance.club, 'creatorReach', registry),
      seed: next.seed,
    },
    next.sponsors.active,
  );

  // A club is never simply without a shirt sponsor.
  //
  // Deals expire, and with no player present to sign a replacement the club's
  // commercial income fell to zero — which cut the wage budget, which stopped
  // squad replenishment, which cost results, which cost fans, which cut income
  // again. That spiral is what turned a mid-table side into seven players over
  // three seasons. A real club in that position takes whatever deal is on the
  // table; the player's job is to negotiate a *better* one, not to prevent the
  // club from having any.
  const liveOffers = [...next.sponsors.available, ...sponsorOffers];
  if (next.sponsors.active.length === 0 && liveOffers.length > 0) {
    const best = liveOffers.reduce((top, o) => (o.valuePerCycle > top.valuePerCycle ? o : top), liveOffers[0]!);
    const signed = signSponsorOffer(finance.club, best, ledger, {
      cycle: next.clock.cycle, season: next.clock.season, at: opts.now,
    });
    if (signed.ok && signed.deal) {
      next = {
        ...next,
        sponsors: {
          available: liveOffers.filter((o) => o.id !== best.id),
          active: [signed.deal],
        },
      };
      allEvents.push(events.make('SPONSOR_SIGNED', {
        clubId: playerClubId,
        sponsorId: best.sponsorId as never,
        value: best.valuePerCycle,
      }, { importance: 2, entities: [events.clubRef(playerClubId)] }));
      notes.push(`${best.name} step in as ${best.slot.toLowerCase()} partner.`);
    }
  } else if (sponsorOffers.length > 0) {
    // Offers expire; carry forward only the ones still on the table so the
    // screen never shows a deal that has quietly lapsed.
    const live = next.sponsors.available.filter((o) => o.expiresCycle > next.clock.cycle);
    const known = new Set(live.map((o) => o.id));
    next = {
      ...next,
      sponsors: {
        ...next.sponsors,
        available: [...live, ...sponsorOffers.filter((o) => !known.has(o.id))],
      },
    };
  }

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

  // --- 5b. scouts report back ------------------------------------------
  // Nothing called advanceScouting, so an assignment the player paid for never
  // progressed and a report was never delivered. Progressive disclosure — the
  // whole point of scouting, and the thing that makes it a competitive edge —
  // simply did not happen in a real save.
  const scoutOutcome = advanceScouting(next, rng.fork('scouting'), {
    clubId: playerClubId,
    cycle: next.clock.cycle,
    registry,
    managerScouting: next.managers[next.playerManagerId]?.attributes.scouting ?? 50,
  });

  if (Object.keys(scoutOutcome.players).length > 0) {
    next = { ...next, players: { ...next.players, ...scoutOutcome.players } };
  }
  next = { ...next, scouting: scoutOutcome.scouting };

  for (const report of scoutOutcome.reports) {
    allEvents.push(events.make('SCOUT_REPORT_READY', {
      playerId: report.playerId,
      clubId: playerClubId,
      confidence: report.confidenceAfter,
    }, { importance: 2, entities: [events.playerRef(report.playerId)] }));
  }

  // --- 5b. the internet remembers what you said ------------------------
  // Stakes settle against the result, polls close, commissioned content lands,
  // milestones pay out. It runs here rather than on a screen mount so its
  // consequences are part of the matchweek, and so a player who never opens
  // the feed is still held to what they posted.
  const socialTick = tickSocialWorld(next, {
    at: opts.now,
    ...(registry ? { registry } : {}),
  });
  next = socialTick.state;
  allEvents.push(...socialTick.events);
  notes.push(...socialTick.notes);

  // --- 6. revalue the market ------------------------------------------
  // Without this, players develop but their price tags never move, and the
  // brake the design depends on — a growing club facing bigger fees and bigger
  // wages — never engages. The economy audit catches exactly this as a flat
  // mean value across seasons.
  const market = refreshMarket(next, rng.fork('market'), {
    cycle: next.clock.cycle,
    season: next.clock.season,
    windowOpen: next.transfers.windowOpen,
    leagueSize: standings.length,
  });

  const revalued = { ...next.players };
  for (const [playerId, value] of Object.entries(market.playerValues)) {
    const player = revalued[playerId];
    if (player && player.marketValue !== value) revalued[playerId] = { ...player, marketValue: value };
  }
  next = {
    ...next,
    players: revalued,
    transfers: { ...next.transfers, listings: market.listings, rumours: market.rumours },
  };

  // --- 7. objectives and legacy are pure consumers of the stream --------
  // The world tick already folded this cycle's events into objective progress.
  // Doing it again here over the same events double-counted every objective —
  // two goals scored advanced a "score ten goals" target by four.
  const objectiveUpdates = world.objectiveUpdates;

  const rolled = rollObjectives(next, rng.fork('objectives'), registry);
  if (rolled.length > 0) {
    next = {
      ...next,
      objectives: { ...next.objectives, active: [...next.objectives.active, ...rolled] },
    };
  }

  next = { ...next, legacy: updateLegacy(next, allEvents) };

  // --- 8. advance the clock --------------------------------------------
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

  // --- 9. when the fixtures run out, roll into the next season ---------
  // Without this the clock keeps counting weeks that contain no football and
  // the world quietly decays: squads shed players nobody replaces, sponsorship
  // lapses with nothing to renew against, and reputation drains to nothing.
  if (seasonComplete) {
    const rolled = rolloverSeason(next, rng.fork('rollover'), ledger, events, { now: opts.now, registry });
    next = { ...rolled.state, ledger: ledger.snapshot() };
    allEvents.push(...rolled.events);
    notes.push(
      `Season ${state.clock.season} complete. ${rolled.retired.length} players retired, ` +
      `${rolled.promoted.length} promoted from the academy.`,
    );
    // Idempotency keys for the season just gone can never fire again.
    ledger.pruneKeys(next.clock.cycle);
  }

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
      settledStakes: socialTick.settled,
      followerMilestones: socialTick.milestones.map((m) => m.label),
      viralMoments: socialTick.viral.map((v) => v.label),
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

/**
 * Contracts count down once per cycle for every player in the league, and a
 * deal that reaches zero actually ends.
 *
 * Without this the transfer market has no clock: nobody ever enters their final
 * year, nobody becomes a free agent, and the wage bill is frozen for the life
 * of the save. The economy audit surfaced it as a mean wage flat to three
 * significant figures across four seasons.
 */
function tickContracts(
  state: GameState,
  events: GameEventFactory,
): { state: GameState; events: AnyDomainEvent[] } {
  let next = state;
  const emitted: AnyDomainEvent[] = [];
  const EXPIRY_WARNING_CYCLES = 6;

  for (const contract of Object.values(state.contracts)) {
    const weeksRemaining = Math.max(0, contract.weeksRemaining - 1);
    next = {
      ...next,
      contracts: { ...next.contracts, [contract.id]: { ...contract, weeksRemaining } },
    };

    if (weeksRemaining === EXPIRY_WARNING_CYCLES) {
      emitted.push(events.make('CONTRACT_EXPIRING', {
        playerId: contract.playerId,
        clubId: contract.clubId,
        weeksLeft: weeksRemaining,
      }, { importance: 3, entities: [events.playerRef(contract.playerId)] }));
    }

    if (weeksRemaining > 0) continue;

    // The deal is up. He leaves for nothing — which is precisely the pressure
    // that makes renewing a contract a decision rather than a formality.
    const player = next.players[contract.playerId];
    if (!player) continue;

    next = patchClub(next, contract.clubId, (club) => ({
      squad: club.squad.filter((id) => id !== contract.playerId),
      youthSquad: club.youthSquad.filter((id) => id !== contract.playerId),
    }));
    next = patchPlayer(next, contract.playerId, { clubId: null, contractId: null });

    const remaining = { ...next.contracts };
    delete remaining[contract.id];
    next = { ...next, contracts: remaining };

    emitted.push(events.make('PLAYER_RELEASED', {
      playerId: contract.playerId,
      clubId: contract.clubId,
    }, {
      importance: player.overall >= 70 ? 4 : 2,
      entities: [events.playerRef(contract.playerId), events.clubRef(contract.clubId)],
    }));
  }

  return { state: next, events: emitted };
}

/**
 * Renewals.
 *
 * A club with a player worth keeping and a deal running out will act before it
 * expires. Without this, every contract in the league eventually runs to zero
 * and squads empty — the economy audit measured one club reaching zero players
 * by the third season. Whether a club renews is a judgement about the player's
 * standing in his own squad and whether the wage bill can carry him, which is
 * what makes losing a star on a free feel like a mistake rather than a rule.
 */
const RENEWAL_WINDOW_CYCLES = 10;

function renewKeyContracts(state: GameState, rng: Rng): GameState {
  let next = state;

  for (const club of Object.values(state.clubs)) {
    const squad = club.squad
      .map((id) => next.players[id])
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
      .sort((a, b) => b.overall - a.overall);
    if (squad.length === 0) continue;

    const medianOverall = squad[Math.floor(squad.length / 2)]?.overall ?? 0;
    const valuation = defaultValuationContext({
      leagueAverageOverall: 62,
      sellingSquadOveralls: squad.map((p) => p.overall),
    });

    for (const player of squad) {
      if (!player.contractId) continue;
      const contract = next.contracts[player.contractId];
      if (!contract || contract.weeksRemaining > RENEWAL_WINDOW_CYCLES) continue;

      // Keep the players who are at or above the middle of your own squad, and
      // let the rest go. A club that renewed everyone would never turn over.
      const wanted = player.overall >= medianOverall - 2;
      if (!wanted) continue;

      const wage = Math.round(wageDemand(player, valuation));
      const committed = squadWageBill(next, club.id) - contract.wage + wage;
      // Never renew past what the club can carry: this is the brake that makes
      // a growing wage bill an actual constraint.
      if (committed > club.finance.wageBudgetPerCycle * 1.35) continue;

      next = setContract(next, renewContract(contract, {
        fee: 0,
        wage,
        years: rng.int(2, 4),
        role: contract.role,
        signingBonus: 0,
        releaseClause: contract.releaseClause,
        goalBonus: contract.bonuses.goal,
        appearanceBonus: contract.bonuses.appearance,
      }, next.clock.cycle));
    }
  }

  return next;
}

/**
 * Free-agent recruitment.
 *
 * Any club below the registered squad size signs the best unattached player its
 * wage budget can carry. This is what closes the loop opened by contract
 * expiry: released players return to squads instead of accumulating in a pool
 * nobody draws from, and no club is ever left unable to field a team.
 */
function replenishSquads(
  state: GameState,
  rng: Rng,
  squadSize: number,
  events: GameEventFactory,
): { state: GameState; events: AnyDomainEvent[] } {
  let next = state;
  const emitted: AnyDomainEvent[] = [];
  const minimum = Math.max(11, squadSize - 2);
  /**
   * Below this, wage discipline stops applying.
   *
   * A club that is over budget could previously never sign anyone — including
   * when it was down to eight players and physically could not field a team.
   * Not fulfilling a fixture is not a choice a club gets to make, so beneath
   * this threshold it signs whoever is available and deals with the wage bill
   * afterwards, which is exactly what a real club in that position does.
   */
  const EMERGENCY_SIZE = 13;

  const freeAgents = Object.values(state.players)
    .filter((p) => p.clubId === null)
    .sort((a, b) => b.overall - a.overall);
  if (freeAgents.length === 0) return { state: next, events: emitted };

  const taken = new Set<string>();
  // Neediest clubs pick first, so nobody is left short while a full squad
  // hoovers up the market.
  const clubs = Object.values(state.clubs).sort((a, b) => a.squad.length - b.squad.length);

  for (const club of clubs) {
    let size = club.squad.length;
    if (size >= minimum) continue;

    const valuation = defaultValuationContext({ leagueAverageOverall: 62 });

    while (size < minimum) {
      const desperate = size < EMERGENCY_SIZE;
      const budgetLeft = club.finance.wageBudgetPerCycle * 1.2 - squadWageBill(next, club.id);
      const ceiling = desperate
        ? Number.POSITIVE_INFINITY
        : Math.max(budgetLeft, club.finance.wageBudgetPerCycle * 0.04);

      const candidate = freeAgents.find((p) => {
        if (taken.has(p.id)) return false;
        return wageDemand(p, valuation) <= ceiling;
      });
      if (!candidate) break;

      taken.add(candidate.id);
      const wage = Math.round(wageDemand(candidate, valuation));
      const contractId = asId<ContractId>(`ct_fa_${club.id}_${candidate.id}_${next.clock.cycle}`);
      const years = rng.int(1, 3);

      next = setContract(next, {
        id: contractId,
        playerId: candidate.id,
        clubId: club.id,
        wage,
        weeksRemaining: years * 22,
        totalWeeks: years * 22,
        signingBonus: 0,
        bonuses: emptyBonuses(),
        role: 'SQUAD',
        releaseClause: null,
        loyaltyBonus: 0,
        signedCycle: next.clock.cycle,
        minutesPlayed: 0,
        minutesAvailable: 0,
      });
      next = transferPlayer(next, candidate.id, club.id);
      next = patchPlayer(next, candidate.id, { contractId });

      emitted.push(events.make('PLAYER_SIGNED', {
        playerId: candidate.id,
        clubId: club.id,
        fee: 0,
        wage,
      }, {
        importance: candidate.overall >= 72 ? 4 : 2,
        entities: [events.playerRef(candidate.id), events.clubRef(club.id)],
      }));

      size++;
    }
  }

  return { state: next, events: emitted };
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
