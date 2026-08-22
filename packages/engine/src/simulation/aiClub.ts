import type { ClubId, PlayerId } from '../core/brand';
import type { Club, ClubPhilosophy } from '../clubs/club';
import type { GameState } from '../game/state';
import type { Player } from '../players/player';
import type { Position } from '../players/positions';
import { positionGroup } from '../players/positions';
import type { TacticSetup } from '../tactics/tactics';
import type { Rng } from '../core/rng';
import { clamp } from '../core/math';
import { formatMoney } from '../economy/ledger';
import { AI_BALANCE as AI } from './balance';

/**
 * AI club behaviour.
 *
 * The world has to keep moving whether or not the player touches it, and it has
 * to move *differently* club by club. Eight strategy profiles express that:
 * each one weights recruitment, wages, youth, facilities and tactics
 * differently enough that after a season you could name the profile from the
 * squad list alone.
 *
 * The turn is deliberately bounded work — a scored shortlist over listed
 * players and free agents — so a twelve-club league costs twelve small passes,
 * not a quadratic scan.
 */

export interface AiProfile {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly philosophy: ClubPhilosophy;
  /** 0-1. How often the club actually pulls the trigger on a target. */
  readonly transferAggression: number;
  /** Multiple of asking price this club will go to. */
  readonly spendMultiplier: number;
  /** Share of the transfer budget committed in one window. */
  readonly reinvestRatio: number;
  /** Weight on current ability vs. ceiling when scoring a target. */
  readonly overallWeight: number;
  readonly potentialWeight: number;
  /** Preferred age band; targets outside it are penalised. */
  readonly targetAge: readonly [number, number];
  /** Positions this club overpays for. */
  readonly favouredPositions: readonly Position[];
  /** 0-1. Willingness to sell a good player for the right price. */
  readonly sellPressure: number;
  /** 0-1. Chance per cycle of promoting the best academy player. */
  readonly youthPromotionRate: number;
  /** 0-1. Eagerness to tie down expiring contracts. */
  readonly renewalEagerness: number;
  /** Wage offered as a multiple of the player's demand. */
  readonly wageWillingness: number;
  /** 0-1. Drives tactical aggression and willingness to overspend. */
  readonly riskTolerance: number;
  /** Facility ids in the order this club invests in them. */
  readonly facilityPriorities: readonly string[];
  /** Tactical leaning applied when the club changes shape. */
  readonly tacticalLean: Partial<TacticSetup>;
  /** 0-1. How much the club chases creators and reach over pure ability. */
  readonly creatorFocus: number;
  readonly squadTarget: number;
}

export const AI_PROFILES: readonly AiProfile[] = [
  {
    id: 'YOUTH_FACTORY', name: 'Youth Factory',
    description: 'Buys teenagers, plays them early, sells them at their peak.',
    philosophy: 'YOUTH_ACADEMY',
    transferAggression: 0.55, spendMultiplier: 0.9, reinvestRatio: 0.5,
    overallWeight: 0.3, potentialWeight: 0.9, targetAge: [16, 21],
    favouredPositions: ['CAM', 'CM', 'LW', 'RW'],
    sellPressure: 0.75, youthPromotionRate: 0.55, renewalEagerness: 0.8,
    wageWillingness: 0.85, riskTolerance: 0.5,
    facilityPriorities: ['academy', 'training_centre', 'scouting', 'medical'],
    tacticalLean: { tempo: 'QUICK', press: 'HIGH_PRESS', risk: 'BOLD' },
    creatorFocus: 0.2, squadTarget: 20,
  },
  {
    id: 'BIG_SPENDERS', name: 'Big Spenders',
    description: 'Solves every problem with a cheque and a headline.',
    philosophy: 'BIG_SPENDERS',
    transferAggression: 0.85, spendMultiplier: 1.45, reinvestRatio: 0.85,
    overallWeight: 1, potentialWeight: 0.35, targetAge: [23, 29],
    favouredPositions: ['ST', 'CAM', 'CB'],
    sellPressure: 0.3, youthPromotionRate: 0.1, renewalEagerness: 0.6,
    wageWillingness: 1.3, riskTolerance: 0.7,
    facilityPriorities: ['stadium', 'merchandising', 'medical', 'training_centre'],
    tacticalLean: { tempo: 'QUICK', press: 'HIGH_PRESS', line: 'HIGH', risk: 'BOLD' },
    creatorFocus: 0.4, squadTarget: 22,
  },
  {
    id: 'ANALYTICS', name: 'Analytics',
    description: 'Buys undervalued profiles, sells a season before the decline.',
    philosophy: 'DATA_DRIVEN',
    transferAggression: 0.6, spendMultiplier: 0.95, reinvestRatio: 0.6,
    overallWeight: 0.65, potentialWeight: 0.65, targetAge: [22, 26],
    favouredPositions: ['CDM', 'CM', 'RB', 'LB'],
    sellPressure: 0.8, youthPromotionRate: 0.3, renewalEagerness: 0.5,
    wageWillingness: 0.9, riskTolerance: 0.35,
    facilityPriorities: ['analytics', 'scouting', 'training_centre', 'medical'],
    tacticalLean: { tempo: 'BALANCED', press: 'MID_BLOCK', passing: 'SHORT', risk: 'MEASURED' },
    creatorFocus: 0.15, squadTarget: 21,
  },
  {
    id: 'CREATOR_CLUB', name: 'Creator Club',
    description: 'Signs reach as readily as ability; the feed is the product.',
    philosophy: 'CREATOR_FIRST',
    transferAggression: 0.7, spendMultiplier: 1.2, reinvestRatio: 0.7,
    overallWeight: 0.6, potentialWeight: 0.5, targetAge: [19, 27],
    favouredPositions: ['LW', 'RW', 'ST'],
    sellPressure: 0.5, youthPromotionRate: 0.35, renewalEagerness: 0.65,
    wageWillingness: 1.15, riskTolerance: 0.65,
    facilityPriorities: ['creator_studio', 'media_dept', 'fan_zone', 'merchandising'],
    tacticalLean: { tempo: 'QUICK', focus: 'BALANCED', risk: 'BOLD', counter: 'ALWAYS' },
    creatorFocus: 1, squadTarget: 21,
  },
  {
    id: 'DEFENSIVE_SPECIALISTS', name: 'Defensive Specialists',
    description: 'Wins 1-0 and enjoys it. Recruits spine first, always.',
    philosophy: 'DEFENSIVE_ROCK',
    transferAggression: 0.5, spendMultiplier: 1, reinvestRatio: 0.55,
    overallWeight: 0.8, potentialWeight: 0.4, targetAge: [24, 30],
    favouredPositions: ['GK', 'CB', 'CDM'],
    sellPressure: 0.35, youthPromotionRate: 0.25, renewalEagerness: 0.85,
    wageWillingness: 0.95, riskTolerance: 0.2,
    facilityPriorities: ['medical', 'training_centre', 'recovery', 'analytics'],
    tacticalLean: { tempo: 'PATIENT', press: 'LOW_BLOCK', line: 'DEEP', risk: 'CAUTIOUS', marking: 'MAN' },
    creatorFocus: 0.1, squadTarget: 20,
  },
  {
    id: 'LOCAL_UNDERDOG', name: 'Local Underdog',
    description: 'Free transfers, loyalty bonuses and a full away end.',
    philosophy: 'LOCAL_ROOTS',
    transferAggression: 0.35, spendMultiplier: 0.75, reinvestRatio: 0.35,
    overallWeight: 0.55, potentialWeight: 0.55, targetAge: [18, 28],
    favouredPositions: ['CM', 'CB', 'ST'],
    sellPressure: 0.6, youthPromotionRate: 0.5, renewalEagerness: 0.9,
    wageWillingness: 0.75, riskTolerance: 0.3,
    facilityPriorities: ['fan_zone', 'academy', 'stadium', 'training_centre'],
    tacticalLean: { tempo: 'BALANCED', press: 'BALANCED', risk: 'MEASURED' },
    creatorFocus: 0.25, squadTarget: 19,
  },
  {
    id: 'SHOWTIME', name: 'Showtime',
    description: 'Entertainment first. Wingers, chaos, and a highlight reel.',
    philosophy: 'ENTERTAINERS',
    transferAggression: 0.75, spendMultiplier: 1.25, reinvestRatio: 0.75,
    overallWeight: 0.6, potentialWeight: 0.6, targetAge: [20, 27],
    favouredPositions: ['LW', 'RW', 'CAM', 'ST'],
    sellPressure: 0.45, youthPromotionRate: 0.35, renewalEagerness: 0.55,
    wageWillingness: 1.2, riskTolerance: 0.9,
    facilityPriorities: ['stadium', 'creator_studio', 'fan_zone', 'training_centre'],
    tacticalLean: { tempo: 'FRANTIC', press: 'HIGH_PRESS', line: 'HIGH', width: 'WIDE', risk: 'RECKLESS' },
    creatorFocus: 0.7, squadTarget: 22,
  },
  {
    id: 'VETERAN_CORE', name: 'Veteran Core',
    description: 'Experience over projection. Wins now, worries later.',
    philosophy: 'VETERAN_CORE',
    transferAggression: 0.6, spendMultiplier: 1.05, reinvestRatio: 0.6,
    overallWeight: 1, potentialWeight: 0.15, targetAge: [29, 35],
    favouredPositions: ['CB', 'CM', 'ST'],
    sellPressure: 0.4, youthPromotionRate: 0.15, renewalEagerness: 0.75,
    wageWillingness: 1.1, riskTolerance: 0.45,
    facilityPriorities: ['medical', 'recovery', 'training_centre', 'stadium'],
    tacticalLean: { tempo: 'PATIENT', press: 'MID_BLOCK', passing: 'SHORT', risk: 'MEASURED' },
    creatorFocus: 0.2, squadTarget: 20,
  },
];

const BY_ID = new Map(AI_PROFILES.map((p) => [p.id, p]));
const BY_PHILOSOPHY = new Map(AI_PROFILES.map((p) => [p.philosophy, p]));

/**
 * Resolve a club's profile.
 *
 * Profile ids are shared vocabulary with the content pack (`AI_PROFILE_IDS` in
 * the base clubs table), so the common path is an exact hit. The philosophy
 * fallback exists for community packs that set a philosophy but no profile, and
 * matching is case-insensitive so a pack written in snake_case still lands.
 */
export function profileFor(club: Club): AiProfile {
  if (club.aiProfileId) {
    const direct = BY_ID.get(club.aiProfileId) ?? BY_ID.get(club.aiProfileId.toUpperCase());
    if (direct) return direct;
  }
  return BY_PHILOSOPHY.get(club.philosophy) ?? (AI_PROFILES[2] as AiProfile);
}


/**
 * How a club responds to failure.
 *
 * A twelve-season run finished with two clubs holding every title and the
 * player's club twelfth in ten of twelve seasons. The cause was not that the
 * strong clubs were strong — it was that **nothing in this file responded to
 * a season going wrong**. `desperation` was `position - (1 - reputation/100)`,
 * which is zero for a club whose reputation already predicts a bad season, so
 * the clubs at the foot of the table were the only ones that never changed
 * anything. Champions, meanwhile, faced no pressure of any kind.
 *
 * Three responses, all derived from state the club can actually see:
 *
 *  - **Failing your own supporters** (`expectationGap`) is felt by everyone,
 *    including clubs nobody else expects anything from. It opens the wallet.
 *  - **An old squad going nowhere** starts a *rebuild*: sell hard, buy young,
 *    put the money into the academy rather than the first team.
 *  - **Winning** breeds complacency. A club cruising at the top invests less,
 *    which is the mechanism by which a league changes hands at all.
 */
export interface ClubMood {
  /** 0-1. How badly this season is going against what was expected. */
  readonly desperation: number;
  /** Selling the old guard and backing the academy instead. */
  readonly rebuilding: boolean;
  /** Comfortably where it wants to be, and behaving like it. */
  readonly complacent: boolean;
  /** True when the club has abandoned its usual shape to chase results. */
  readonly changedApproach: boolean;
}

export function clubMood(
  state: GameState,
  club: Club,
  profile: AiProfile,
  positionPressure: number,
  rng: Rng,
): ClubMood {
  const record = club.seasonRecord;
  const pace = record.played > 0
    ? (record.won * 3 + record.drawn) / (record.played * 3)
    : AI.neutralPointsPace;
  // What the people who turn up every week think they are owed, against what
  // they are getting. Available to every club at every level of the table.
  const expectationGap = clamp(club.fans.expectation / 100 - pace, 0, 1);
  const reputationShortfall = clamp(positionPressure - (1 - club.reputation / 100), 0, 1);
  const desperation = clamp(
    Math.max(reputationShortfall, expectationGap * AI.expectationWeight),
    0, 1,
  );

  let ages = 0;
  let counted = 0;
  for (const id of club.squad) {
    const player = state.players[id];
    if (!player) continue;
    ages += player.age;
    counted++;
  }
  const meanAge = counted > 0 ? ages / counted : AI.rebuildAge;

  const rebuilding = desperation >= AI.rebuildDesperation && meanAge >= AI.rebuildAge;
  const complacent = positionPressure <= AI.complacencyPosition
    && club.reputation >= AI.complacencyReputation
    && desperation <= AI.complacencyDesperation;
  const changedApproach = desperation >= AI.changeApproachDesperation
    && rng.chance(AI.changeApproachChance);
  return { desperation, rebuilding, complacent, changedApproach };
}

/**
 * The profile a club is actually playing to this cycle. Mood bends the club's
 * own identity rather than replacing it — a rebuilding Veteran Core still wants
 * experience, it just stops paying a premium for thirty-four-year-olds.
 */
export function profileUnderMood(profile: AiProfile, mood: ClubMood): AiProfile {
  if (!mood.rebuilding && !mood.complacent) return profile;
  const rebuilt: AiProfile = mood.rebuilding
    ? {
      ...profile,
      sellPressure: clamp(profile.sellPressure + AI.rebuildSellPressure, 0, 1),
      youthPromotionRate: clamp(profile.youthPromotionRate + AI.rebuildYouthRate, 0, 1),
      potentialWeight: profile.potentialWeight + AI.rebuildPotentialWeight,
      overallWeight: Math.max(0.2, profile.overallWeight - AI.rebuildOverallWeight),
      targetAge: [
        Math.max(16, profile.targetAge[0] - AI.rebuildAgeShift),
        Math.max(20, profile.targetAge[1] - AI.rebuildAgeShift),
      ] as const,
      facilityPriorities: ['academy', 'training_centre', ...profile.facilityPriorities],
    }
    : profile;
  return mood.complacent
    ? {
      ...rebuilt,
      transferAggression: rebuilt.transferAggression * AI.complacencyAggression,
      reinvestRatio: rebuilt.reinvestRatio * AI.complacencyReinvest,
    }
    : rebuilt;
}

export interface AiTransferIntent {
  readonly playerId: PlayerId;
  readonly maxFee: number;
  readonly wageOffer: number;
  readonly priority: number;
  readonly reason: string;
}

export interface AiListingIntent {
  readonly playerId: PlayerId;
  readonly askingPrice: number;
  readonly reason: string;
}

export interface AiRenewalIntent {
  readonly playerId: PlayerId;
  readonly years: number;
  readonly wage: number;
}

export interface AiFacilityIntent {
  readonly facilityId: string;
  readonly toLevel: number;
  readonly cost: number;
}

export interface AiActions {
  readonly clubId: ClubId;
  readonly profileId: string;
  readonly transferTargets: readonly AiTransferIntent[];
  readonly listings: readonly AiListingIntent[];
  readonly renewals: readonly AiRenewalIntent[];
  readonly releases: readonly PlayerId[];
  readonly youthPromotions: readonly PlayerId[];
  readonly tacticalShift: Partial<TacticSetup> | null;
  readonly facilityInvestment: AiFacilityIntent | null;
  readonly budgetPlan: { readonly transferSpend: number; readonly wageHeadroom: number };
  /** One line for the transfer-rumour feed. */
  readonly narrative: string;
  readonly notes: readonly string[];
}

export interface AiTurnContext {
  readonly cycle: number;
  readonly season: number;
  /** 1-based league position; drives panic and ambition. */
  readonly leaguePosition?: number;
  readonly clubCount?: number;
  /** Cost of the next level of a facility. Defaults to a generic curve. */
  readonly facilityCost?: (facilityId: string, toLevel: number) => number;
  /** Cap on scored candidates; the default keeps a turn cheap. */
  readonly maxCandidates?: number;
  readonly transferWindowOpen?: boolean;
}

const DEFAULT_FACILITY_COST = (level: number): number => 250_000 * level ** 1.7;

// ------------------------------------------------------------- countering ---

/**
 * The three-way shape map the counter system keys on.
 *
 * Match history records results, not formations — but a club's tactics persist
 * between matches, so its current setup IS the shape it has been playing all
 * month. Reading it keeps the counter honest without inventing data.
 */
export type PlayShape = 'LOW_BLOCK' | 'HIGH_PRESS' | 'BALANCED';

/** Classify how a side sets up. The press slider is the primary signal; the line breaks ties of ambiguity. */
export function playShapeOf(tactics: TacticSetup): PlayShape {
  if (tactics.press === 'LOW_BLOCK' || tactics.line === 'DEEP') return 'LOW_BLOCK';
  if (tactics.press === 'HIGH_PRESS' || tactics.line === 'HIGH') return 'HIGH_PRESS';
  return 'BALANCED';
}

/**
 * The lean that attacks the given shape. Rock-paper-scissors, restored:
 * parking the bus gets pressed and stretched wide; pressing gets invited on
 * and played straight over with counters into the space behind. Against a
 * balanced shape there is nothing to attack — return null so the AI club
 * keeps its own identity rather than drifting toward a league-wide average.
 */
export function counterLeanAgainst(shape: PlayShape): Partial<TacticSetup> | null {
  switch (shape) {
    case 'LOW_BLOCK':
      return { press: 'HIGH_PRESS', line: 'HIGH', tempo: 'QUICK', width: 'WIDE', risk: 'BOLD' };
    case 'HIGH_PRESS':
      return { line: 'DEEP', passing: 'DIRECT', buildUp: 'BYPASS', counter: 'ALWAYS', tempo: 'QUICK' };
    default:
      return null;
  }
}

/**
 * The lean an AI club should start with against the player's club, read from
 * what the player has set up. Pure derivation — no state is stored, so it
 * cannot drift from the tactics the player actually controls.
 */
export function aiCounterLeanVsPlayer(state: GameState): Partial<TacticSetup> | null {
  const playerClub = state.clubs[state.playerClubId];
  if (!playerClub) return null;
  return counterLeanAgainst(playShapeOf(playerClub.tactics));
}

const ageFit = (age: number, band: readonly [number, number]): number => {
  if (age >= band[0] && age <= band[1]) return 1;
  const distance = age < band[0] ? band[0] - age : age - band[1];
  return Math.max(0, 1 - distance * 0.18);
};

interface SquadNeed {
  readonly group: 'GK' | 'DEF' | 'MID' | 'ATT';
  readonly deficit: number;
  readonly averageOverall: number;
}

const GROUP_TARGET: Record<SquadNeed['group'], number> = { GK: 2, DEF: 6, MID: 6, ATT: 5 };

function squadNeeds(state: GameState, club: Club): SquadNeed[] {
  const counts: Record<string, { n: number; total: number }> = {
    GK: { n: 0, total: 0 }, DEF: { n: 0, total: 0 }, MID: { n: 0, total: 0 }, ATT: { n: 0, total: 0 },
  };
  for (const id of club.squad) {
    const player = state.players[id];
    if (!player) continue;
    const bucket = counts[positionGroup(player.position)];
    if (!bucket) continue;
    bucket.n++;
    bucket.total += player.overall;
  }
  return (Object.keys(GROUP_TARGET) as SquadNeed['group'][]).map((group) => {
    const bucket = counts[group] ?? { n: 0, total: 0 };
    return {
      group,
      deficit: (GROUP_TARGET[group] ?? 0) - bucket.n,
      averageOverall: bucket.n > 0 ? bucket.total / bucket.n : 0,
    };
  }).sort((a, b) => b.deficit - a.deficit || a.averageOverall - b.averageOverall);
}

/** Candidate pool: listed players plus free agents, bounded and deterministic. */
function candidatePool(state: GameState, club: Club, limit: number): Player[] {
  const out: Player[] = [];
  const seen = new Set<string>();
  for (const listing of Object.values(state.transfers.listings)) {
    if (listing.availability === 'UNAVAILABLE') continue;
    const player = state.players[listing.playerId];
    if (!player || player.clubId === club.id) continue;
    if (seen.has(player.id)) continue;
    seen.add(player.id);
    out.push(player);
  }
  if (out.length < limit) {
    for (const player of Object.values(state.players)) {
      if (out.length >= limit * 2) break;
      if (player.clubId !== null || seen.has(player.id)) continue;
      seen.add(player.id);
      out.push(player);
    }
  }
  return out;
}

const askingPriceOf = (state: GameState, player: Player): number => {
  const listing = state.transfers.listings[player.id];
  if (listing) return listing.askingPrice;
  return player.clubId === null ? 0 : Math.round(player.marketValue * 1.2);
};

/**
 * Score a target through the club's philosophy. The spread between profiles is
 * the whole point: the same 19-year-old is a priority for Youth Factory, a
 * rounding error for Veteran Core.
 */
function scoreTarget(
  player: Player,
  profile: AiProfile,
  need: SquadNeed | undefined,
  price: number,
  budget: number,
): number {
  const overall = player.overall / 100;
  const headroom = Math.max(0, player.potential - player.overall) / 40;
  let score = profile.overallWeight * overall + profile.potentialWeight * (player.potential / 100) * (0.5 + headroom);
  score *= 0.4 + 0.6 * ageFit(player.age, profile.targetAge);
  if (profile.favouredPositions.includes(player.position)) score *= 1.25;
  if (need && positionGroup(player.position) === need.group && need.deficit > 0) score *= 1.3;
  if (profile.creatorFocus > 0.5 && player.creatorId) score *= 1 + profile.creatorFocus * 0.4;
  // Cost discipline: analytics and underdogs feel price, big spenders barely do.
  const affordability = budget <= 0 ? 0 : clamp(1 - price / (budget * profile.spendMultiplier), -1, 1);
  const priceSensitivity = 1.4 - profile.spendMultiplier;
  score += affordability * priceSensitivity * 0.5;
  return score;
}

/**
 * One club's turn. Returns *intents*: the world tick decides what is actually
 * affordable and posts any money movement through the Ledger.
 */
export function aiClubTurn(
  state: GameState,
  clubId: ClubId,
  rng: Rng,
  ctx: AiTurnContext,
): AiActions {
  const club = state.clubs[clubId];
  const empty: AiActions = {
    clubId, profileId: 'none', transferTargets: [], listings: [], renewals: [], releases: [],
    youthPromotions: [], tacticalShift: null, facilityInvestment: null,
    budgetPlan: { transferSpend: 0, wageHeadroom: 0 }, narrative: '', notes: ['club not found'],
  };
  if (!club) return empty;

  const baseProfile = profileFor(club);
  const local = rng.fork(`ai:${clubId}:${ctx.cycle}`);
  const notes: string[] = [];

  // --- money ---
  const wageBill = club.squad.reduce((total, id) => {
    const contract = Object.values(state.contracts).find((c) => c.playerId === id);
    return total + (contract?.wage ?? 0);
  }, 0);
  const wageHeadroom = club.finance.wageBudgetPerCycle - wageBill;
  const positionPressure = ctx.leaguePosition && ctx.clubCount
    ? clamp((ctx.leaguePosition - 1) / Math.max(1, ctx.clubCount - 1), 0, 1)
    : 0.5;
  const mood = clubMood(state, club, baseProfile, positionPressure, local.fork('mood'));
  const profile = profileUnderMood(baseProfile, mood);
  if (mood.rebuilding) notes.push('rebuilding: cashing in on the old guard and backing the academy');
  if (mood.complacent) notes.push('comfortable: no appetite to spend');
  const desperation = mood.desperation;
  const transferSpend = Math.round(
    club.finance.transferBudget * profile.reinvestRatio * (1 + desperation * profile.riskTolerance),
  );

  // --- recruitment ---
  const needs = squadNeeds(state, club);
  const topNeed = needs[0];
  const targets: AiTransferIntent[] = [];
  if (ctx.transferWindowOpen !== false && club.squad.length < profile.squadTarget + 4) {
    const pool = candidatePool(state, club, ctx.maxCandidates ?? 40);
    const scored = pool
      .map((player) => {
        const price = askingPriceOf(state, player);
        return { player, price, score: scoreTarget(player, profile, topNeed, price, Math.max(1, transferSpend)) };
      })
      .sort((a, b) => b.score - a.score || (a.player.id < b.player.id ? -1 : 1))
      .slice(0, 6);
    for (const entry of scored) {
      if (!local.chance(profile.transferAggression)) continue;
      const maxFee = Math.round(Math.min(transferSpend, entry.price * profile.spendMultiplier));
      if (maxFee <= 0 && entry.price > 0) continue;
      targets.push({
        playerId: entry.player.id,
        maxFee,
        wageOffer: Math.round(entry.player.marketValue * 0.0012 * profile.wageWillingness),
        priority: Math.round(entry.score * 100) / 100,
        reason: topNeed && positionGroup(entry.player.position) === topNeed.group
          ? `${topNeed.group} reinforcement`
          : `${profile.name} profile fit`,
      });
      if (targets.length >= 3) break;
    }
    if (targets.length === 0) notes.push('no target cleared the profile threshold');
  }

  // --- sales, renewals, releases ---
  const listings: AiListingIntent[] = [];
  const renewals: AiRenewalIntent[] = [];
  const releases: PlayerId[] = [];
  for (const id of club.squad) {
    const player = state.players[id];
    if (!player) continue;
    const fit = ageFit(player.age, profile.targetAge);
    const surplus = fit < 0.5 && player.overall < 70;
    if (surplus && local.chance(profile.sellPressure)) {
      listings.push({
        playerId: player.id,
        askingPrice: Math.round(player.marketValue * (0.85 + profile.sellPressure * 0.4)),
        reason: player.age > profile.targetAge[1] ? 'outside the age profile' : 'squad reshaping',
      });
      continue;
    }
    // Cash in at the top of the market rather than watch value decay.
    if (profile.sellPressure > 0.7 && player.age >= profile.targetAge[1] && player.marketValue > club.finance.transferBudget * 0.4) {
      listings.push({ playerId: player.id, askingPrice: Math.round(player.marketValue * 1.35), reason: 'selling at peak value' });
      continue;
    }
    const contract = Object.values(state.contracts).find((c) => c.playerId === player.id && c.clubId === club.id);
    if (contract && contract.weeksRemaining <= 12) {
      if (fit > 0.5 && local.chance(profile.renewalEagerness)) {
        renewals.push({
          playerId: player.id,
          years: player.age >= 30 ? 1 : player.age <= 21 ? 4 : 3,
          wage: Math.round(contract.wage * (1 + 0.12 * profile.wageWillingness)),
        });
      } else if (player.overall < 62 && wageHeadroom < 0) {
        releases.push(player.id);
      }
    }
  }

  // --- youth ---
  const youthPromotions: PlayerId[] = [];
  if (club.youthSquad.length > 0 && local.chance(profile.youthPromotionRate)) {
    const best = club.youthSquad
      .map((id) => state.players[id])
      .filter((p): p is Player => !!p)
      .sort((a, b) => b.potential - a.potential || (a.id < b.id ? -1 : 1))[0];
    if (best) youthPromotions.push(best.id);
  }

  // --- tactics ---
  //
  // The old behaviour under pressure was to double down on the club's own
  // profile lean, which is not a response to failure — it is the thing that was
  // already failing. A club that has run out of patience with its own idea
  // borrows somebody else's.
  let tacticalShift: Partial<TacticSetup> | null = null;
  const losingBadly = positionPressure > 0.7;
  const cruising = positionPressure < 0.25;
  if (mood.changedApproach) {
    const alternatives = AI_PROFILES.filter((p) => p.id !== baseProfile.id);
    const borrowed = local.pick(alternatives);
    tacticalShift = { ...borrowed.tacticalLean };
    notes.push(`out of ideas: switching to a ${borrowed.name.toLowerCase()} shape`);
  } else if (losingBadly && local.chance(0.35 + profile.riskTolerance * 0.4)) {
    tacticalShift = { ...profile.tacticalLean, risk: profile.riskTolerance > 0.6 ? 'RECKLESS' : 'BOLD' };
    notes.push('chasing results: shape pushed forward');
  } else if (cruising && local.chance(0.2)) {
    tacticalShift = { ...profile.tacticalLean };
    notes.push('settling into the profile shape');
  }

  // --- facilities ---
  let facilityInvestment: AiFacilityIntent | null = null;
  const spare = club.finance.transferBudget - transferSpend;
  for (const facilityId of profile.facilityPriorities) {
    const level = club.facilityLevels[facilityId] ?? 0;
    if (level >= 5) continue;
    const cost = ctx.facilityCost ? ctx.facilityCost(facilityId, level + 1) : DEFAULT_FACILITY_COST(level + 1);
    if (cost <= spare && local.chance(0.4 + (1 - profile.transferAggression) * 0.4)) {
      facilityInvestment = { facilityId, toLevel: level + 1, cost: Math.round(cost) };
      break;
    }
  }

  const headline = targets[0]
    ? `${club.shortName} are pushing for ${state.players[targets[0].playerId]?.displayName ?? 'a new signing'} (up to ${formatMoney(targets[0].maxFee)}).`
    : listings[0]
      ? `${club.shortName} are ready to listen to offers as they reshape the squad.`
      : `${club.shortName} are holding steady and backing the ${profile.name.toLowerCase()} plan.`;

  return {
    clubId,
    profileId: profile.id,
    transferTargets: targets,
    listings,
    renewals,
    releases,
    youthPromotions,
    tacticalShift,
    facilityInvestment,
    budgetPlan: { transferSpend, wageHeadroom },
    narrative: headline,
    notes,
  };
}
