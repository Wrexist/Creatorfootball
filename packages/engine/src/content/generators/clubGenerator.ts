import type { ClubId } from '../../core/brand';
import { clamp } from '../../core/math';
import type { Rng } from '../../core/rng';
import {
  CLUB_PHILOSOPHIES, emptyRecord,
  type BadgeMotif, type BadgeShape, type Club, type ClubIdentityStyle,
  type ClubPhilosophy, type ClubVisualIdentity, type FanCulture,
} from '../../clubs/club';
import { DEFAULT_TACTICS, type TacticSetup } from '../../tactics/tactics';
import type { ClubTemplate } from '../schema';
import { GENERATION_BALANCE } from '../balance';

/**
 * Turning a ClubTemplate into a live Club.
 *
 * The template is the authored identity; this file derives everything the
 * simulation needs from it. The important choice here is that a club's starting
 * tactical setup falls out of its declared philosophy — Ironhollow opens deep
 * and cautious because Ironhollow *is* deep and cautious. An AI league where
 * every club starts on the same default sliders reads as twelve copies of one
 * club wearing different colours.
 */

/**
 * Default formation id for the 7-a-side base format. Workstream A owns the
 * formation table; this is the id the base content commits to, and the pack
 * test asserts it so a rename is caught rather than silently producing a club
 * with no shape.
 */
export const DEFAULT_FORMATION_ID = '2-3-1';

const PHILOSOPHY_SET = new Set<string>(CLUB_PHILOSOPHIES);
const FAN_CULTURES = new Set<string>(['ULTRAS', 'FAMILY', 'ONLINE_NATIVE', 'TRADITIONAL', 'BANDWAGON', 'DIEHARD']);

/** Tactical disposition per philosophy. Trade-offs, never free upgrades. */
const PHILOSOPHY_TACTICS: Readonly<Record<ClubPhilosophy, Partial<TacticSetup>>> = {
  DEFENSIVE_ROCK: { press: 'LOW_BLOCK', line: 'DEEP', risk: 'CAUTIOUS', tempo: 'PATIENT', counter: 'WHEN_ON', marking: 'MAN' },
  ENTERTAINERS: { press: 'HIGH_PRESS', line: 'HIGH', risk: 'BOLD', tempo: 'QUICK', width: 'WIDE', counter: 'ALWAYS' },
  BIG_SPENDERS: { press: 'BALANCED', line: 'HIGH', risk: 'MEASURED', passing: 'SHORT', buildUp: 'FROM_THE_BACK' },
  DATA_DRIVEN: { press: 'MID_BLOCK', line: 'NORMAL', risk: 'MEASURED', passing: 'SHORT', marking: 'ZONAL', subStrategy: 'AGGRESSIVE' },
  CREATOR_FIRST: { press: 'HIGH_PRESS', tempo: 'FRANTIC', risk: 'BOLD', width: 'WIDE', counter: 'ALWAYS' },
  YOUTH_ACADEMY: { press: 'HIGH_PRESS', line: 'NORMAL', tempo: 'QUICK', buildUp: 'FROM_THE_BACK', subStrategy: 'AGGRESSIVE' },
  LOCAL_ROOTS: { press: 'MID_BLOCK', line: 'NORMAL', risk: 'CAUTIOUS', passing: 'DIRECT', buildUp: 'BYPASS' },
  VETERAN_CORE: { press: 'LOW_BLOCK', line: 'DEEP', tempo: 'PATIENT', passing: 'SHORT', risk: 'CAUTIOUS', subStrategy: 'CONSERVATIVE' },
};

/** Fan-state seed per culture. These are the personalities of twelve crowds. */
const FAN_CULTURE_PROFILE: Readonly<Record<FanCulture, {
  sentiment: number; trust: number; excitement: number; loyalty: number;
  expectation: number; onlineShare: number; seasonTicketShare: number;
}>> = {
  ULTRAS: { sentiment: 58, trust: 52, excitement: 74, loyalty: 92, expectation: 62, onlineShare: 1.4, seasonTicketShare: 0.52 },
  FAMILY: { sentiment: 68, trust: 72, excitement: 52, loyalty: 80, expectation: 44, onlineShare: 0.9, seasonTicketShare: 0.46 },
  ONLINE_NATIVE: { sentiment: 64, trust: 48, excitement: 82, loyalty: 44, expectation: 66, onlineShare: 6.5, seasonTicketShare: 0.22 },
  TRADITIONAL: { sentiment: 55, trust: 66, excitement: 46, loyalty: 86, expectation: 70, onlineShare: 1.1, seasonTicketShare: 0.58 },
  BANDWAGON: { sentiment: 72, trust: 40, excitement: 78, loyalty: 30, expectation: 74, onlineShare: 4.2, seasonTicketShare: 0.18 },
  DIEHARD: { sentiment: 62, trust: 74, excitement: 62, loyalty: 96, expectation: 48, onlineShare: 1.6, seasonTicketShare: 0.61 },
};

const asPhilosophy = (value: string): ClubPhilosophy =>
  (PHILOSOPHY_SET.has(value) ? value : 'LOCAL_ROOTS') as ClubPhilosophy;

const asFanCulture = (value: string): FanCulture =>
  (FAN_CULTURES.has(value) ? value : 'TRADITIONAL') as FanCulture;

const visualFrom = (t: ClubTemplate): ClubVisualIdentity => ({
  primary: t.visual.primary,
  secondary: t.visual.secondary,
  accent: t.visual.accent,
  badgeShape: t.visual.badgeShape as BadgeShape,
  badgeMotif: t.visual.badgeMotif as BadgeMotif,
  style: t.visual.style as ClubIdentityStyle,
  kitPattern: t.visual.kitPattern as ClubVisualIdentity['kitPattern'],
});

export interface ClubFromTemplateOptions {
  readonly isPlayerClub?: boolean;
  /** Every facility the club gets a level in. Content is handed in; the generator imports none. */
  readonly facilityIds: readonly string[];
  readonly startingBudget?: number;
}

export function clubFromTemplate(
  rng: Rng,
  t: ClubTemplate,
  id: ClubId,
  opts: ClubFromTemplateOptions,
): Club {
  const cfg = GENERATION_BALANCE.club;
  const philosophy = asPhilosophy(t.philosophy);
  const fanCulture = asFanCulture(t.fanCulture);
  const profile = FAN_CULTURE_PROFILE[fanCulture];

  const facilityIds = opts.facilityIds;
  const baseLevel = cfg.facilityFromReputation(t.reputation);
  const facilityLevels: Record<string, number> = {};
  for (const facilityId of facilityIds) {
    // A little jitter so two clubs of equal reputation are not identical
    // buildings — one has spent on the academy, another on the studio.
    facilityLevels[facilityId] = clamp(baseLevel + rng.int(-1, 1), 0, 5);
  }

  const budget = opts.startingBudget ?? t.budget;
  // Local, gate-going support scales with the ground, as it does anywhere.
  const supporterBase = Math.round(t.stadiumCapacity * (3.2 + t.reputation / 30) * rng.float(0.9, 1.1));

  // Online audience does NOT. This is the defining economic fact of creator
  // football: reach is the independent variable and the stadium is close to
  // irrelevant to it — one real creator club with two million subscribers
  // averaged a few hundred people through the turnstiles. Deriving followers
  // from capacity, as an ordinary football club would, made audience a rounding
  // error and left sponsorship — the dominant income line by design — at under
  // 1% of revenue. Reputation drives it on a steep curve, and fan culture
  // decides how much of that following is online rather than in the ground.
  const audienceBase = 25_000 * (t.reputation / 20) ** 2.6;

  const tactics: TacticSetup = {
    ...DEFAULT_TACTICS,
    ...PHILOSOPHY_TACTICS[philosophy],
    formationId: DEFAULT_FORMATION_ID,
    lineup: {},
    bench: [],
    captainId: null,
    setPieceTakerId: null,
    penaltyTakerId: null,
  };

  return {
    id,
    name: t.name,
    shortName: t.shortName,
    abbreviation: t.abbreviation,
    city: t.city,
    founded: t.founded,
    isPlayerClub: opts.isPlayerClub ?? false,
    visual: visualFrom(t),
    philosophy,
    fanCulture,
    reputation: clamp(Math.round(t.reputation), 1, 100),
    stadium: {
      name: t.stadiumName,
      capacity: t.stadiumCapacity,
      quality: clamp(Math.round(30 + t.reputation * 0.55 + rng.normal(0, 5)), 10, 100),
      atmosphere: clamp(Math.round(profile.excitement * 0.6 + profile.loyalty * 0.45 + rng.normal(0, 4)), 10, 100),
      pitchQuality: clamp(Math.round(45 + t.reputation * 0.45 + rng.normal(0, 6)), 20, 100),
    },
    fans: {
      sentiment: clamp(Math.round(profile.sentiment + rng.normal(0, 4)), 1, 100),
      trust: clamp(Math.round(profile.trust + rng.normal(0, 4)), 1, 100),
      excitement: clamp(Math.round(profile.excitement + rng.normal(0, 4)), 1, 100),
      loyalty: clamp(Math.round(profile.loyalty + rng.normal(0, 3)), 1, 100),
      base: supporterBase,
      // Expectation tracks reputation: the price of being big is being judged.
      expectation: clamp(Math.round(profile.expectation * 0.55 + t.reputation * 0.5), 1, 100),
      lastAttendance: 0,
      seasonTicketHolders: Math.round(t.stadiumCapacity * profile.seasonTicketShare),
      onlineFollowers: Math.round(audienceBase * profile.onlineShare * rng.float(0.85, 1.15)),
    },
    finance: {
      wageBudgetPerCycle: Math.round(budget * cfg.wageBudgetShare),
      transferBudget: budget,
      ticketPrice: Math.round(cfg.ticketPriceBase * (0.7 + t.reputation / 90)),
      merchPrice: Math.round(cfg.merchPriceBase * (0.8 + t.reputation / 140)),
      lastCycleIncome: 0,
      lastCycleExpenditure: 0,
      debt: 0,
    },
    managerId: null,
    squad: [],
    youthSquad: [],
    creatorIds: [],
    tactics,
    facilityLevels,
    sponsorDealIds: [],
    rivalryIds: [],
    aiProfileId: opts.isPlayerClub ? null : t.aiProfileId,
    seasonRecord: emptyRecord(),
    allTimeRecord: emptyRecord(),
    motto: t.motto,
  };
}

/** Squad quality target implied by a template's strength rating. */
export const squadTargetFor = (t: ClubTemplate): number => clamp(Math.round(t.strength), 30, 92);
