import { rolePromiseDelta } from '../contracts/contract';
import type { ClubId, PlayerId } from '../core/brand';
import { clamp, clamp01, mean } from '../core/math';
import type { Rng } from '../core/rng';
import type { GameState, TransferListing, TransferRumour } from '../game/state';
import { POSITIONS, type Position } from '../players/positions';
import type { Player } from '../players/player';
import { MARKET_BALANCE as M, TRANSFER_BALANCE as T } from './balance';
import { estimatedOverall } from './scouting';
import { askingPrice, marketValue, wageDemand, type ValuationContext } from './valuation';

/**
 * The transfer market as a living thing.
 *
 * The market is refreshed rather than queried: every cycle it re-prices every
 * player, decides who has become available, works out who is interested in whom
 * and emits the rumours that make the world feel populated. Crucially the
 * player's club is not special — AI clubs list and chase players by the same
 * rules, so the market the player shops in is one they can also be beaten in.
 */

export interface MarketContext {
  readonly cycle: number;
  readonly season: number;
  readonly windowOpen: boolean;
  readonly leagueSize: number;
  /** Overridden by the world engine as the league gets richer. */
  readonly inflation?: number;
}

export interface MarketDelta {
  /** Full replacement set of listings, keyed by playerId. */
  readonly listings: Readonly<Record<string, TransferListing>>;
  readonly rumours: readonly TransferRumour[];
  /** Fresh cached valuations, keyed by playerId. Merge into the player records. */
  readonly playerValues: Readonly<Record<string, number>>;
  readonly leagueAverageOverall: number;
  readonly positionScarcity: Readonly<Record<string, number>>;
  readonly inflation: number;
}

/** Scarcity index per position: >1 means the league is short of them. */
export function positionScarcity(players: readonly Player[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const pos of POSITIONS) counts[pos] = 0;
  let total = 0;
  for (const p of players) {
    if (!p.clubId) continue;
    counts[p.position] = (counts[p.position] ?? 0) + 1;
    total++;
  }
  const expected = total / POSITIONS.length;
  const out: Record<string, number> = {};
  for (const pos of POSITIONS) {
    const n = counts[pos] ?? 0;
    // Guard the divide: an empty position is scarce, not infinite.
    out[pos] = expected <= 0 ? 1 : clamp(expected / Math.max(1, n), 0.5, 2.5);
  }
  return out;
}

/** Build the shared valuation context for a whole league in one pass. */
export function buildValuationContext(
  state: GameState,
  ctx: MarketContext,
  over: Partial<ValuationContext> = {},
): ValuationContext {
  const players = Object.values(state.players);
  const squadPlayers = players.filter((p) => p.clubId !== null);
  const leagueAverageOverall = squadPlayers.length
    ? Math.round(mean(squadPlayers.map((p) => p.overall)))
    : 60;
  return {
    cycle: ctx.cycle,
    season: ctx.season,
    inflation: ctx.inflation ?? 1,
    leagueAverageOverall,
    positionScarcity: positionScarcity(players),
    suitorCount: 0,
    contract: null,
    ...over,
  };
}

function contractFor(state: GameState, player: Player) {
  return player.contractId ? state.contracts[player.contractId] ?? null : null;
}

/**
 * The bars a signing has to clear to be worth the player's attention.
 *
 * `tempting` is the *median* of the starting seven: a player who would walk
 * into the middle of the side, not merely displace its weakest link. `minimum`
 * is that weakest link, used only when nothing affordable clears the real bar —
 * the window is allowed to be thin, it is not allowed to be empty.
 */
function starterBars(
  state: GameState,
  squad: readonly PlayerId[],
): { tempting: number; minimum: number } {
  const overalls = squad
    .map((id) => state.players[id]?.overall ?? 0)
    .sort((a, b) => b - a)
    .slice(0, 7);
  const minimum = overalls[overalls.length - 1] ?? 0;
  const tempting = overalls[Math.floor(overalls.length / 2)] ?? minimum;
  return { tempting, minimum };
}

/** Squad overalls of a player's club, excluding himself — used for asking price. */
function squadOveralls(state: GameState, player: Player): number[] {
  if (!player.clubId) return [];
  const club = state.clubs[player.clubId];
  if (!club) return [];
  const out: number[] = [];
  for (const id of club.squad) {
    if (id === player.id) continue;
    const other = state.players[id];
    if (other) out.push(other.overall);
  }
  return out;
}

/**
 * Would this club put this player on the market? AI clubs sell for reasons the
 * player can read off the squad screen — he is surplus, he is not playing, or
 * he is old and expensive — never at random.
 */
function isListable(state: GameState, player: Player, ctx: MarketContext): boolean {
  if (!player.clubId) return true; // free agents are always available
  const club = state.clubs[player.clubId];
  if (!club || club.isPlayerClub) return false;
  const contract = contractFor(state, player);
  if (!contract) return true;

  const squadTooBig = club.squad.length > M.SQUAD_COMFORT_SIZE;
  const neglected =
    contract.minutesAvailable > 240 &&
    contract.minutesPlayed / Math.max(1, contract.minutesAvailable) < M.NEGLECTED_MINUTES_RATIO;
  // The last year of a deal, not the last five months. A club that cannot sell
  // now gets nothing later, and this is the route by which a good player
  // becomes affordable to a club that cannot outbid anybody.
  const runningDown = contract.weeksRemaining <= T.CONTRACT_SAFE_WEEKS;
  const surplusVeteran = player.age >= 31 && rolePromiseDelta(contract) < 0;
  // Depth a club is not using. Every one of the old conditions described a
  // player somebody had already given up on, which is why the reachable market
  // contained nothing worth buying; a squad of twenty with eleven starters has
  // real assets sitting in it and would listen on any of them.
  const surplusToDepth = club.squad.length >= M.DEPTH_SQUAD_SIZE
    && squadRank(state, player) >= M.DEPTH_PROTECTED;
  // A club in the red sells because it has to.
  const distressed = club.finance.debt > 0 || club.finance.transferBudget <= 0;

  return (squadTooBig && neglected)
    || (runningDown && ctx.windowOpen)
    || surplusVeteran
    || (surplusToDepth && ctx.windowOpen)
    || (distressed && ctx.windowOpen);
}

/** Where a player sits in his own club's pecking order, 0 = best. */
function squadRank(state: GameState, player: Player): number {
  if (!player.clubId) return 99;
  const club = state.clubs[player.clubId];
  if (!club) return 99;
  let better = 0;
  for (const id of club.squad) {
    if (id === player.id) continue;
    const other = state.players[id];
    if (other && other.overall > player.overall) better++;
  }
  return better;
}

function availabilityFor(
  player: Player,
  interested: number,
  contractWeeks: number,
): TransferListing['availability'] {
  if (interested >= 3) return 'WANTED_BY_OTHERS';
  if (contractWeeks > 60 && player.mental.loyalty > 70) return 'RELUCTANT';
  return 'AVAILABLE';
}

/**
 * Re-price the league, refresh listings and generate rumours. Returns a delta;
 * the caller merges it into state.
 */
export function refreshMarket(state: GameState, rng: Rng, ctx: MarketContext): MarketDelta {
  const stream = rng.fork(`market:${ctx.cycle}`);
  const base = buildValuationContext(state, ctx);
  const players = Object.values(state.players);

  const playerValues: Record<string, number> = {};
  const listings: Record<string, TransferListing> = {};
  const candidates: { player: Player; value: number }[] = [];

  for (const player of players) {
    const contract = contractFor(state, player);
    const value = marketValue(player, { ...base, contract });
    // Drift rather than snap, so a single good week does not double a price tag.
    const drifted = Math.round(
      player.marketValue > 0
        ? player.marketValue + (value - player.marketValue) * M.VALUE_DRIFT_RATE
        : value,
    );
    playerValues[player.id] = drifted;
    candidates.push({ player, value: drifted });
  }

  for (const { player } of candidates) {
    const existing = state.transfers.listings[player.id];
    const shouldList = existing !== undefined || isListable(state, player, ctx);
    if (!shouldList) continue;
    // Not everything eligible surfaces at once; the market reveals itself
    // slowly. Free agents are the exception — they have nowhere else to be.
    const hidden =
      !existing && player.clubId !== null &&
      !stream.chance(M.LISTING_RATE * (ctx.windowOpen ? 2.2 : 1));
    if (hidden) continue;

    const contract = contractFor(state, player);
    const club = player.clubId ? state.clubs[player.clubId] ?? null : null;

    const interestCount = Math.min(
      M.MAX_INTERESTED_CLUBS,
      Math.max(
        0,
        Math.round(
          (player.overall - base.leagueAverageOverall) * M.INTEREST_PER_OVERALL_POINT +
            (stream.chance(0.35) ? 1 : 0),
        ),
      ),
    );
    const interestedClubIds = stream
      .sample(
        Object.values(state.clubs).filter((c) => c.id !== player.clubId),
        interestCount,
      )
      .map((c) => c.id);

    const valuationCtx: ValuationContext = {
      ...base,
      contract,
      suitorCount: interestedClubIds.length,
      sellingSquadOveralls: squadOveralls(state, player),
    };

    listings[player.id] = {
      playerId: player.id,
      clubId: club?.id ?? null,
      askingPrice: club ? askingPrice(player, club, valuationCtx) : 0,
      wageDemand: wageDemand(player, valuationCtx),
      availability: availabilityFor(player, interestedClubIds.length, contract?.weeksRemaining ?? 0),
      interestedClubIds,
      listedCycle: existing?.listedCycle ?? ctx.cycle,
    };
  }

  // --- the window's promise ------------------------------------------------
  //
  // An open window that contains nothing the player can both afford and use is
  // not a decision, and the audit found exactly that: the best reachable signing
  // was rated 61 against a weakest starter of 60. This pass guarantees a floor
  // on *visibility* — it reveals players whose clubs were already willing to
  // sell, at their real asking price, that happen to be affordable and better
  // than what the player has. It invents nobody and discounts nothing; if the
  // eligible pool holds no affordable upgrade, the window stays quiet.
  if (ctx.windowOpen) {
    const buyer = state.clubs[state.playerClubId];
    const budget = buyer?.finance.transferBudget ?? 0;
    const bars = buyer ? starterBars(state, buyer.squad) : { tempting: 0, minimum: 0 };
    const bar = bars.tempting + M.UPGRADE_MARGIN;
    const floorBar = bars.minimum + M.UPGRADE_MARGIN;
    let upgrades = 0;
    for (const listing of Object.values(listings)) {
      const p = state.players[listing.playerId];
      if (p && p.overall >= bar && listing.askingPrice <= budget) upgrades++;
    }
    if (buyer && upgrades < M.WINDOW_MIN_UPGRADES) {
      const hopefuls = candidates
        .filter(({ player }) => !listings[player.id]
          && player.overall >= floorBar
          && player.clubId !== state.playerClubId
          && isListable(state, player, ctx))
        .map(({ player }) => {
          const contract = contractFor(state, player);
          const club = player.clubId ? state.clubs[player.clubId] ?? null : null;
          const valuationCtx: ValuationContext = {
            ...base, contract, suitorCount: 0, sellingSquadOveralls: squadOveralls(state, player),
          };
          return {
            player,
            price: club ? askingPrice(player, club, valuationCtx) : 0,
            wage: wageDemand(player, valuationCtx),
            contractWeeks: contract?.weeksRemaining ?? 0,
            clubId: club?.id ?? null,
          };
        })
        .filter((x) => x.price <= budget)
        // Best player first among those within reach: the window should tempt,
        // not merely tick a box.
        .sort((a, b) => b.player.overall - a.player.overall
          || a.price - b.price
          || (a.player.id < b.player.id ? -1 : 1));

      for (const hopeful of hopefuls) {
        if (upgrades >= M.WINDOW_MIN_UPGRADES) break;
        listings[hopeful.player.id] = {
          playerId: hopeful.player.id,
          clubId: hopeful.clubId,
          askingPrice: hopeful.price,
          wageDemand: hopeful.wage,
          availability: 'AVAILABLE',
          interestedClubIds: [],
          listedCycle: ctx.cycle,
        };
        upgrades++;
      }
    }
  }

  // Rumours are grounded: they only ever come from a listing that has interest.
  const rumourPool = Object.values(listings).filter((l) => l.interestedClubIds.length > 0);
  const rumours: TransferRumour[] = [];
  const fresh = state.transfers.rumours.filter(
    (r) => ctx.cycle - r.cycle < M.RUMOUR_LIFETIME_CYCLES,
  );
  rumours.push(...fresh);

  for (const listing of stream.sample(rumourPool, M.RUMOURS_PER_REFRESH)) {
    const player = state.players[listing.playerId];
    const clubId = listing.interestedClubIds[0];
    if (!player || !clubId) continue;
    const club = state.clubs[clubId];
    if (!club) continue;
    const credibility = clamp01(
      M.RUMOUR_MIN_CREDIBILITY + listing.interestedClubIds.length * 0.18 + stream.float(0, 0.3),
    );
    rumours.push({
      id: `rumour_${ctx.cycle}_${player.id}_${club.id}`,
      playerId: player.id,
      clubId: club.id,
      credibility,
      cycle: ctx.cycle,
      text:
        credibility > 0.6
          ? `${club.shortName} are close to a move for ${player.displayName}.`
          : `${player.displayName} has been linked with ${club.shortName}.`,
    });
  }

  return {
    listings,
    rumours: rumours.slice(-24),
    playerValues,
    leagueAverageOverall: base.leagueAverageOverall,
    positionScarcity: base.positionScarcity,
    inflation: base.inflation,
  };
}

// --- Search -----------------------------------------------------------------

export interface PlayerFilters {
  readonly positions?: readonly Position[];
  readonly maxValue?: number;
  readonly maxWage?: number;
  /** Uses the *scouted estimate*, not the true value — you search what you know. */
  readonly minOverall?: number;
  readonly maxAge?: number;
  readonly minAge?: number;
  readonly minPotential?: number;
  readonly availability?: readonly TransferListing['availability'][];
  readonly excludeClubId?: ClubId;
  readonly clubId?: ClubId;
  readonly freeAgentsOnly?: boolean;
  readonly listedOnly?: boolean;
  readonly shortlistedOnly?: boolean;
  readonly query?: string;
  readonly sort?: 'VALUE' | 'OVERALL' | 'AGE' | 'POTENTIAL' | 'WAGE' | 'NAME';
  readonly descending?: boolean;
  readonly limit?: number;
}

/**
 * Search the market. Ability filters run against the *scouted estimate*, which
 * is the whole point of scouting: an unscouted 82-rated player will not show up
 * in a "minimum 80" search until somebody has actually gone and watched him.
 */
export function searchPlayers(state: GameState, filters: PlayerFilters): PlayerId[] {
  const listings = state.transfers.listings;
  const shortlist = new Set(state.scouting.shortlist);
  const query = filters.query?.trim().toLowerCase();

  const rows = Object.values(state.players).filter((p) => {
    if (filters.freeAgentsOnly && p.clubId !== null) return false;
    if (filters.listedOnly && !listings[p.id]) return false;
    if (filters.shortlistedOnly && !shortlist.has(p.id)) return false;
    if (filters.excludeClubId && p.clubId === filters.excludeClubId) return false;
    if (filters.clubId && p.clubId !== filters.clubId) return false;
    if (filters.positions?.length && !filters.positions.includes(p.position)) return false;
    if (filters.maxAge !== undefined && p.age > filters.maxAge) return false;
    if (filters.minAge !== undefined && p.age < filters.minAge) return false;
    if (filters.minOverall !== undefined && estimatedOverall(p) < filters.minOverall) return false;
    if (filters.minPotential !== undefined && p.potential < filters.minPotential) return false;

    const listing = listings[p.id];
    if (filters.maxValue !== undefined) {
      const price = listing?.askingPrice ?? p.marketValue;
      if (price > filters.maxValue) return false;
    }
    if (filters.maxWage !== undefined) {
      const wage = listing?.wageDemand ?? 0;
      if (wage > filters.maxWage) return false;
    }
    if (filters.availability?.length) {
      if (!listing || !filters.availability.includes(listing.availability)) return false;
    }
    if (query && !p.displayName.toLowerCase().includes(query) && !p.lastName.toLowerCase().includes(query)) {
      return false;
    }
    return true;
  });

  const sort = filters.sort ?? 'VALUE';
  const key = (p: Player): number | string => {
    switch (sort) {
      case 'OVERALL': return estimatedOverall(p);
      case 'AGE': return p.age;
      case 'POTENTIAL': return p.potential;
      case 'WAGE': return listings[p.id]?.wageDemand ?? 0;
      case 'NAME': return p.displayName.toLowerCase();
      default: return listings[p.id]?.askingPrice ?? p.marketValue;
    }
  };
  const descending = filters.descending ?? (sort !== 'AGE' && sort !== 'NAME');

  rows.sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    if (typeof ka === 'string' || typeof kb === 'string') {
      return String(ka).localeCompare(String(kb)) * (descending ? -1 : 1);
    }
    return (ka - kb) * (descending ? -1 : 1);
  });

  const limited = filters.limit !== undefined ? rows.slice(0, filters.limit) : rows;
  return limited.map((p) => p.id);
}

/** Positions where the club is thin, for the "you need a..." prompt. */
export function squadNeeds(state: GameState, clubId: ClubId): Position[] {
  const club = state.clubs[clubId];
  if (!club) return [];
  const counts: Record<string, number> = {};
  for (const id of club.squad) {
    const p = state.players[id];
    if (p) counts[p.position] = (counts[p.position] ?? 0) + 1;
  }
  return POSITIONS.filter((pos) => (counts[pos] ?? 0) < (pos === 'GK' ? 2 : 2));
}
