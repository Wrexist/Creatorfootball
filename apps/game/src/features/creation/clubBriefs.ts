import {
  PHILOSOPHY_LABELS,
  type ClubPhilosophy, type ClubTemplate, type FanCulture,
} from '@cf/engine';
import { FAN_CULTURE_LABELS } from './clubIdentity';

/**
 * The twelve clubs, framed so somebody who has never heard of any of them can
 * choose between them.
 *
 * The lore in the content pack is excellent and it is also six sentences long.
 * Six sentences is a thing you read *after* you have decided; it is not a thing
 * you choose from. What a first-time player needs before they commit three
 * minutes and a season is four facts and one sentence:
 *
 *   1. Are they expected to win, or to struggle?  → `tier`
 *   2. What kind of football is this?             → philosophy + fan culture
 *   3. What can I spend?                          → `budget`
 *   4. Who already hates me?                      → `rivalOf`
 *   5. What am I actually taking on?              → `honest`
 *
 * Nothing here is a rating. The tier is the *league's own* ordering — the base
 * pack is authored as one clear favourite, four who can challenge, five in a
 * mid-table scrap and two in trouble from matchday one — so it is read off the
 * strength ranking rather than invented from a threshold somebody made up. If
 * the pack is rebalanced the framing follows it.
 *
 * This file is deliberately not a component. Every screen in this flow reads
 * the same derived brief, and none of them derives one itself.
 *
 * It is also deliberately a function of the clubs it is given rather than a
 * module-scope read of the base pack: the pack is a lazy chunk, and a module
 * that imported it at load time would drag it into the screen's own bundle
 * and quietly undo the split. The screen hands in the clubs once the content
 * has arrived, and memoises the result.
 */

export type ClubTier = 'FAVOURITE' | 'CONTENDER' | 'MID_TABLE' | 'STRUGGLING';

export interface TierCopy {
  /** The word on the chip. Short, and never the only carrier of meaning. */
  readonly label: string;
  /** The expectation, in plain language. This is the "difficulty read". */
  readonly expectation: string;
  /**
   * Pill tone. An ordinal ramp across the four tiers, always paired with the
   * word and with the expectation sentence beside it, so colour is a second
   * encoding and never the only one. Volt is left alone — it belongs to the
   * one action on the screen — and danger is left to the rival pills, which
   * sit two lines below on the same card.
   */
  readonly tone: 'positive' | 'info' | 'neutral' | 'warning';
}

export const TIER_COPY: Record<ClubTier, TierCopy> = {
  FAVOURITE: {
    label: 'Favourite',
    expectation: 'Expected to win the league. Anything else is a failure.',
    tone: 'positive',
  },
  CONTENDER: {
    label: 'Contender',
    expectation: 'Expected to challenge. Close enough that a good season decides it.',
    tone: 'info',
  },
  MID_TABLE: {
    label: 'Mid-table',
    expectation: 'Expected to finish in the middle. Nobody is watching you yet.',
    tone: 'neutral',
  },
  STRUGGLING: {
    label: 'Underdog',
    expectation: 'Expected to struggle. Survival would be an achievement.',
    tone: 'warning',
  },
};

/**
 * One honest sentence per club about what taking them on actually means.
 *
 * The rule for writing these: state the cost, not the pitch. A player who reads
 * one of these and picks that club anyway has chosen their own story, which is
 * the entire point of the beat.
 */
const HONEST: Readonly<Record<string, string>> = {
  club_marrowgate_athletic:
    'Everything you win here was expected, and everything you drop is a scandal by Monday.',
  club_neon_row_fc:
    'The squad is good enough to win it — but the cameras never stop, and the numbers count as results.',
  club_vantage_point_fc:
    'You inherit the best analysts in the league and a dressing room that has been told it is a spreadsheet.',
  club_aurelia_sc:
    'The money is real, the scrutiny is worse, and the squad is one bad month from being called a brand exercise.',
  club_ironhollow_forge:
    'You can beat anybody here on a cold Tuesday and still be called boring for it in the morning.',
  club_verrow_wanderers:
    'The oldest squad in the league, a members’ vote on everything, and wins that come from refusing to let matches happen.',
  club_larkspur_wolves:
    'You will be told to entertain them, and you will concede more goals than anyone finishing above you.',
  club_duskford_rovers:
    'The academy hands you a star every year and the board sells him before you have finished the sentence.',
  club_saltpine_harbour:
    'No money, one brilliant youth coach, and a season that is a survival job from the first whistle.',
  club_redmere_republic:
    'Eleven thousand owners, a published wage cap you are not allowed to break, and the loudest away end in the league.',
  club_ember_nine:
    'A club brought back from the dead in public — half the support was there before, half found it on a screen, and both are watching you.',
  club_cinderwick_town:
    'The ground is falling down and the squad is a decade too old; every point you take is one nobody expected.',
};

export interface ClubBrief {
  readonly club: ClubTemplate;
  readonly tier: ClubTier;
  readonly tierCopy: TierCopy;
  /** One sentence. What taking this club on costs you. */
  readonly honest: string;
  /** Six sentences of authored history. Read after the decision, not before. */
  readonly lore: string;
  readonly philosophyLabel: string;
  readonly fanCultureLabel: string;
  /** Short names of the clubs that already have a grudge. */
  readonly rivals: readonly string[];
}

/** Authored league shape: 1 favourite, 4 challengers, 5 in the scrap, 2 in trouble. */
const TIER_BY_RANK = (rank: number, total: number): ClubTier => {
  if (rank === 0) return 'FAVOURITE';
  if (rank <= 4) return 'CONTENDER';
  if (rank >= total - 2) return 'STRUGGLING';
  return 'MID_TABLE';
};

export interface ClubBriefs {
  /** Every club, strongest first. */
  readonly all: readonly ClubBrief[];
  /** The three the flow opens on. */
  readonly featured: readonly ClubBrief[];
  /** Everybody else, strongest first. */
  readonly remaining: readonly ClubBrief[];
  readonly briefFor: (clubId: string | null) => ClubBrief | undefined;
}

/** Frame every club in the league from the loaded content. */
export function buildClubBriefs(
  clubs: readonly ClubTemplate[],
  lore: Readonly<Record<string, string>>,
): ClubBriefs {
  const shortName = new Map(clubs.map((c) => [c.id, c.shortName]));
  const ranked: readonly ClubTemplate[] = [...clubs].sort((a, b) => b.strength - a.strength);
  const all: readonly ClubBrief[] = ranked.map((club, rank) => {
    const tier = TIER_BY_RANK(rank, ranked.length);
    return {
      club,
      tier,
      tierCopy: TIER_COPY[tier],
      honest: HONEST[club.id] ?? '',
      lore: lore[club.id] ?? '',
      philosophyLabel:
        PHILOSOPHY_LABELS[club.philosophy as ClubPhilosophy] ?? club.philosophy,
      fanCultureLabel:
        FAN_CULTURE_LABELS[club.fanCulture as FanCulture] ?? club.fanCulture,
      rivals: (club.rivalOf ?? []).map((id) => shortName.get(id) ?? id),
    };
  });
  const featured = FEATURED_IDS
    .map((id) => all.find((b) => b.club.id === id))
    .filter((b): b is ClubBrief => b !== undefined);
  return {
    all,
    featured,
    remaining: all.filter((b) => !FEATURED_IDS.includes(b.club.id)),
    briefFor: (clubId) => (clubId ? all.find((b) => b.club.id === clubId) : undefined),
  };
}

/**
 * The three the flow opens on.
 *
 * Twelve clubs sorted by strength is a leaderboard, and a leaderboard tells a
 * newcomer exactly one thing: pick the top one. Three clubs at deliberately
 * contrasting difficulty is a *choice* — win-or-else, entertain-or-else, or
 * keep the lights on — and the other nine are one tap away for anybody who
 * wants them.
 *
 * Fixed, not sampled: the same three every time, so two players comparing notes
 * on their first three minutes are talking about the same screen.
 */
const FEATURED_IDS: readonly string[] = [
  'club_marrowgate_athletic', // favourite — the institution
  'club_larkspur_wolves',     // mid-table — the entertainers
  'club_cinderwick_town',     // underdog — the club holding on
];

