import type { Club, FanState } from '../clubs/club';
import { clamp, clamp01, decayToward, lerp } from '../core/math';
import type { Rng } from '../core/rng';
import { FAN_BALANCE as F } from './balance';

/**
 * The fan loop: performance → sentiment → fandom → attendance and revenue →
 * investment → performance.
 *
 * The loop is closed but explicitly *damped*. Three counter-pressures stop it
 * running away, and they are the whole reason the system is interesting:
 *
 *  1. Expectation drifts up with reputation, position, spending and trophies,
 *     and the sentiment target is a function of (performance − expectation).
 *     Winning therefore raises the bar you are judged against.
 *  2. Reach converts to fandom at roughly 1%, and fandom converts to a gate at
 *     well under half again. Audience growth does NOT become money one-for-one.
 *  3. Attention churns every cycle. Standing still shrinks you.
 *
 * See fans/balance.ts for why the gate is deliberately a small income line.
 */

export interface FanInputs {
  readonly cycle: number;
  /** Newest last. Only the most recent few are remembered. */
  readonly recentResults: readonly ('W' | 'D' | 'L')[];
  readonly leaguePosition: number;
  readonly leagueSize: number;
  readonly reputation: number;
  /** Impressions the club's creators actually delivered this cycle. */
  readonly creatorReach: number;
  /** 0-1 mean `fanConversion` across attached creators. The reach→fandom lever. */
  readonly creatorFanConversion: number;
  /** 0-1: how watchable the football has been (goals, attacking intent). */
  readonly entertainment: number;
  /** 0-1: summed `fanAppeal` of the squad's stars, normalised. */
  readonly starAppeal: number;
  readonly ticketPrice: number;
  /** Net cash spent on transfers this cycle. Fans read spending as ambition. */
  readonly netTransferSpend: number;
  readonly marqueeSignings: number;
  readonly cultHeroesSold: number;
  readonly derbyResult?: 'W' | 'D' | 'L';
  readonly trophyWon?: boolean;
  readonly relegated?: boolean;
  /** Running count of trophies; expectation never comes back down from these. */
  readonly trophiesWon?: number;
  readonly stadiumCapacity: number;
}

/** 0-1 performance score from where the club sits and how it has been playing. */
export function performanceScore(inputs: FanInputs): number {
  const size = Math.max(2, inputs.leagueSize);
  const positional = clamp01(1 - (inputs.leaguePosition - 1) / (size - 1));
  const recent = inputs.recentResults.slice(-F.RESULT_MEMORY);
  const resultScore = recent.length
    ? recent.reduce((sum, r) => sum + (r === 'W' ? 1 : r === 'D' ? 0.4 : 0), 0) / recent.length
    : positional;
  return clamp01(positional * F.POSITION_WEIGHT + resultScore * F.RESULT_WEIGHT);
}

/** What fans think this club ought to be achieving, 0-100. */
export function expectationTarget(inputs: FanInputs): number {
  const size = Math.max(2, inputs.leagueSize);
  const positional = clamp01(1 - (inputs.leaguePosition - 1) / (size - 1));
  const spendMillions = Math.max(0, inputs.netTransferSpend) / 1_000_000;
  const raw =
    inputs.reputation * F.EXPECTATION_PER_REPUTATION +
    positional * F.EXPECTATION_FROM_POSITION +
    Math.min(F.EXPECTATION_SPEND_CAP, spendMillions * F.EXPECTATION_PER_MILLION_NET_SPEND) +
    (inputs.trophiesWon ?? 0) * F.EXPECTATION_PER_TROPHY;
  return clamp(raw, F.EXPECTATION_MIN, F.EXPECTATION_MAX);
}

/** Attendance and sentiment penalty for pricing above what fans think is fair. */
export function priceFactor(ticketPrice: number): number {
  const ratio = Math.max(0.2, ticketPrice / F.TICKET_PRICE_REFERENCE);
  return clamp(ratio ** F.PRICE_ELASTICITY, F.PRICE_FACTOR_MIN, F.PRICE_FACTOR_MAX);
}

/**
 * Advance the fan state by one cycle. Returns a new FanState; the club passed
 * in is never touched.
 */
export function updateFanState(club: Club, inputs: FanInputs, rng: Rng): FanState {
  const stream = rng.fork(`fans:${club.id}:${inputs.cycle}`);
  const fans = club.fans;

  const expectation = clamp(
    decayToward(fans.expectation, expectationTarget(inputs), F.EXPECTATION_DRIFT),
    F.EXPECTATION_MIN,
    F.EXPECTATION_MAX,
  );

  const performance = performanceScore(inputs) * 100;
  const gap = performance - expectation;

  const priceOver = Math.max(0, inputs.ticketPrice - F.TICKET_PRICE_REFERENCE);
  const derby = inputs.derbyResult
    ? inputs.derbyResult === 'W' ? F.DERBY_SWING : inputs.derbyResult === 'L' ? -F.DERBY_SWING : 0
    : 0;

  const sentimentTarget = clamp(
    F.SENTIMENT_NEUTRAL +
      gap * F.GAP_TO_SENTIMENT +
      clamp01(inputs.entertainment) * F.STYLE_BONUS +
      clamp01(inputs.starAppeal) * F.STAR_BONUS +
      clamp01(inputs.creatorReach / 1_000_000) * F.CREATOR_BONUS +
      inputs.marqueeSignings * F.MARQUEE_SIGNING_BONUS -
      inputs.cultHeroesSold * F.CULT_HERO_SALE_PENALTY -
      priceOver * F.SENTIMENT_PER_PRICE_UNIT +
      derby +
      (inputs.trophyWon ? F.TROPHY_SWING : 0) +
      (inputs.relegated ? F.RELEGATION_SWING : 0),
    0,
    100,
  );

  const sentiment = clamp(decayToward(fans.sentiment, sentimentTarget, F.SENTIMENT_RESPONSE), 0, 100);
  const trust = clamp(decayToward(fans.trust, sentimentTarget, F.TRUST_RESPONSE), 0, 100);
  const loyalty = clamp(
    decayToward(fans.loyalty, lerp(40, sentiment, 0.8), F.LOYALTY_RESPONSE) -
      inputs.cultHeroesSold * 1.5,
    0,
    100,
  );
  const excitementTarget =
    F.EXCITEMENT_RESTING +
    clamp01(inputs.entertainment) * 30 +
    inputs.marqueeSignings * 12 +
    (inputs.trophyWon ? 25 : 0);
  const excitement = clamp(
    decayToward(fans.excitement, excitementTarget, F.EXCITEMENT_RESPONSE),
    0,
    100,
  );

  // --- Reach: big, cheap, churning ---------------------------------------
  const reachGain =
    inputs.creatorReach *
    F.FOLLOWERS_PER_REACH *
    (0.4 + (sentiment / 100) * F.FOLLOWER_SENTIMENT_SWING);
  const followerCap = Math.max(50_000, inputs.reputation * F.FOLLOWER_CAP_PER_REPUTATION);
  const churn = fans.onlineFollowers * F.FOLLOWER_CHURN;
  const saturation = clamp01(1 - fans.onlineFollowers / followerCap);
  const onlineFollowers = Math.max(
    0,
    Math.round(fans.onlineFollowers + reachGain * saturation - churn),
  );

  // --- Fandom: the lossy step that keeps the loop honest ------------------
  const conversionRate =
    F.REACH_TO_FANDOM_BASE *
    (1 + clamp01(inputs.creatorFanConversion) * F.REACH_TO_FANDOM_CREATOR_SWING) *
    (0.35 + (sentiment / 100) * F.REACH_TO_FANDOM_SENTIMENT_SWING);
  const fandomTarget =
    onlineFollowers * conversionRate + inputs.reputation * F.LOCAL_SUPPORT_PER_REPUTATION;
  const floor = fans.base * F.FANDOM_FLOOR_RATIO;
  const base = Math.max(
    0,
    Math.round(Math.max(floor, decayToward(fans.base, fandomTarget, F.FANDOM_DRIFT))),
  );

  const seasonTicketHolders = Math.round(
    Math.min(
      inputs.stadiumCapacity * 0.7,
      base * F.SEASON_TICKET_SHARE * (0.5 + loyalty / 150) * priceFactor(inputs.ticketPrice),
    ),
  );

  // A tiny deterministic wobble so two identical cycles are not pixel-identical.
  const wobble = stream.float(-0.4, 0.4);

  return {
    sentiment: clamp(sentiment + wobble, 0, 100),
    trust,
    excitement,
    loyalty,
    base,
    expectation,
    lastAttendance: fans.lastAttendance,
    seasonTicketHolders: Math.max(0, seasonTicketHolders),
    onlineFollowers,
  };
}

/**
 * How many actually turn up. Season-ticket holders are a floor: they have paid
 * whether or not they come, which is why a struggling club still looks half-full.
 */
export function attendanceFor(club: Club, fixtureImportance: number, rng: Rng): number {
  const stream = rng.fork(`attendance:${club.id}:${club.seasonRecord.played}:${fixtureImportance}`);
  const fans = club.fans;
  const capacity = Math.max(0, club.stadium.capacity);
  if (capacity === 0) return 0;

  const pool = fans.base * F.ATTENDANCE_SHARE_OF_FANDOM;
  const importance = 1 + Math.max(0, fixtureImportance - 3) * F.IMPORTANCE_FILL_BONUS;
  const atmosphere = 0.9 + clamp01(club.stadium.atmosphere / 100) * 0.2;

  const fill = clamp(
    (F.BASE_FILL + (fans.sentiment / 100 - 0.5) * F.FILL_SENTIMENT_SWING) *
      importance *
      priceFactor(club.finance.ticketPrice) *
      atmosphere *
      (1 + stream.float(-F.ATTENDANCE_NOISE, F.ATTENDANCE_NOISE)),
    F.MIN_FILL,
    1,
  );

  // Season-ticket holders are a soft floor, not a hard one: they have paid, but
  // when the mood turns they stop coming, and the empty seats are the story.
  const turnout =
    F.SEASON_TICKET_TURNOUT_FLOOR +
    (1 - F.SEASON_TICKET_TURNOUT_FLOOR) * clamp01(fans.sentiment / 100);
  const demand = Math.max(fans.seasonTicketHolders * turnout, pool * fill);
  return Math.round(clamp(demand, 0, capacity));
}

export interface RevenueBreakdown {
  readonly tickets: number;
  readonly concessions: number;
  readonly hospitality: number;
  readonly matchdayMerch: number;
  readonly total: number;
}

/**
 * Matchday money. Deliberately the smallest of the three income lines: in
 * creator football the gate buys atmosphere and identity, not solvency.
 */
export function matchdayRevenue(club: Club, attendance: number): RevenueBreakdown {
  const price = Math.max(0, club.finance.ticketPrice);
  const seasonTickets = Math.min(attendance, club.fans.seasonTicketHolders);
  const walkUp = Math.max(0, attendance - seasonTickets);

  const tickets = Math.round(
    walkUp * price + seasonTickets * price * F.SEASON_TICKET_DISCOUNT,
  );
  const quality = clamp01(club.stadium.quality / 100);
  const concessions = Math.round(attendance * F.CONCESSION_PER_HEAD * (0.7 + quality * 0.6));
  const hospitality = Math.round(
    club.stadium.capacity * F.HOSPITALITY_PER_CAPACITY * quality,
  );
  const matchdayMerch = Math.round(attendance * F.MATCHDAY_MERCH_PER_HEAD);

  return {
    tickets,
    concessions,
    hospitality,
    matchdayMerch,
    total: tickets + concessions + hospitality + matchdayMerch,
  };
}

/** Record an attendance without mutating the club. */
export const withAttendance = (fans: FanState, attendance: number): FanState => ({
  ...fans,
  lastAttendance: attendance,
});

/**
 * Total impressions the club can put in front of people this cycle. This is the
 * quantity sponsors actually buy — not the gate, and not the fandom.
 */
export function clubReach(fans: FanState, creatorReach: number): number {
  return Math.round(fans.onlineFollowers * 0.35 + creatorReach);
}

/** One-line read on where the club stands with its support, for the UI. */
export function fanMood(fans: FanState): string {
  const gap = fans.sentiment - fans.expectation;
  if (fans.sentiment >= 80) return 'Euphoric';
  if (gap >= 12) return 'Delighted';
  if (gap >= -5) return 'Content';
  if (gap >= -18) return 'Restless';
  if (fans.sentiment >= 25) return 'Angry';
  return 'In revolt';
}
