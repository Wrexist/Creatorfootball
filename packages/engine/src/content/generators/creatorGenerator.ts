import { asId, type ClubId, type CreatorId, type PlayerId } from '../../core/brand';
import { clamp } from '../../core/math';
import type { Rng } from '../../core/rng';
import type { IdentityKind } from '../../licensing/identity';
import {
  CREATOR_ATTRIBUTE_KEYS, CREATOR_TIERS, TIER_REACH,
  type Creator, type CreatorAttributeKey, type CreatorAttributes,
  type CreatorContentStyle, type CreatorRole, type CreatorTier,
} from '../../creators/creator';
import type { CreatorTemplate, NameBankDef } from '../schema';
import { GENERATION_BALANCE } from '../balance';
import { BASE_NAME_BANK } from '../packs/base/nameBank';

/**
 * Creator generation.
 *
 * A creator is not a player with different labels: their attributes feed fans,
 * sponsorship, media and social, and the interesting ones are the people whose
 * numbers disagree with each other. Controversy is deliberately decorrelated
 * from tier — a twelve-thousand-follower nobody can be the most toxic voice in
 * the league — because that decorrelation is where the friction comes from.
 *
 * Roles are weighted the way the real thing is: creators own and manage far
 * more often than they play.
 */

export type CreatorTone = CreatorContentStyle['tone'];

export interface GenerateCreatorOptions {
  readonly tier?: CreatorTier;
  readonly tone?: CreatorTone;
  readonly roles?: readonly CreatorRole[];
  readonly clubId?: ClubId | null;
  readonly playerId?: PlayerId | null;
  readonly followers?: number;
  readonly handle?: string;
  readonly displayName?: string;
  readonly bio?: string;
  readonly nameBank?: NameBankDef;
  readonly template?: CreatorTemplate;
  readonly identityKind?: IdentityKind;
  readonly sourcePackId?: string;
  readonly clubSentiment?: number;
  readonly id?: CreatorId;
  readonly idPrefix?: string;
  readonly dealWeeksRemaining?: number | null;
}

const TONES: readonly CreatorTone[] = ['HYPE', 'ANALYTICAL', 'COMEDIC', 'PROVOCATIVE', 'WHOLESOME', 'DRAMATIC'];

/** Roles a generated creator may hold, weighted toward ownership and media. */
const ROLE_WEIGHTS: readonly { role: CreatorRole; weight: number }[] = [
  { role: 'INFLUENCER', weight: 30 },
  { role: 'PUNDIT', weight: 22 },
  { role: 'CLUB_PERSONALITY', weight: 18 },
  { role: 'OWNER', weight: 14 },
  { role: 'MANAGER', weight: 11 },
  { role: 'PLAYER', weight: 5 },
];

/** How each tone bends the attribute spread. */
const TONE_MODIFIERS: Readonly<Record<CreatorTone, Partial<Record<CreatorAttributeKey, number>>>> = {
  HYPE: { entertainment: 16, engagement: 10, charisma: 8, mediaAbility: -8, controversy: 4 },
  ANALYTICAL: { mediaAbility: 18, engagement: 4, entertainment: -14, controversy: -16, charisma: -6 },
  COMEDIC: { entertainment: 20, charisma: 12, engagement: 8, brandValue: -8, mediaAbility: -4 },
  PROVOCATIVE: { controversy: 30, engagement: 10, loyalty: -14, commercialAppeal: -16, fanConversion: -10 },
  WHOLESOME: { fanConversion: 18, loyalty: 20, controversy: -26, entertainment: -6, commercialAppeal: -4 },
  DRAMATIC: { entertainment: 12, mediaAbility: 10, controversy: 12, engagement: 4, brandValue: -6 },
};

const HANDLE_SUFFIXES = ['fc', 'tv', 'live', 'hq', 'daily', 'onair', 'clips', 'talks', 'xi', 'utd'];

function buildAttributes(rng: Rng, tier: CreatorTier, tone: CreatorTone): CreatorAttributes {
  const cfg = GENERATION_BALANCE.creator;
  const tierIndex = CREATOR_TIERS.indexOf(tier);
  const mean = cfg.tierAttributeMean[tierIndex] ?? 50;
  const toneMods = TONE_MODIFIERS[tone];

  const out = {} as Record<CreatorAttributeKey, number>;
  for (const key of CREATOR_ATTRIBUTE_KEYS) {
    if (key === 'controversy') {
      out[key] = clamp(
        Math.round(rng.normal(cfg.controversyMean + (toneMods.controversy ?? 0), cfg.controversySpread)),
        1, 99,
      );
      continue;
    }
    out[key] = clamp(Math.round(rng.normal(mean + (toneMods[key] ?? 0), cfg.attributeSpread)), 1, 99);
  }
  // Audience is what the tier means; keep it honest so sponsor gates behave.
  out.audience = clamp(Math.round(mean + 8 + rng.normal(0, 6)), 1, 99);
  return out as CreatorAttributes;
}

function buildStyle(rng: Rng, tone: CreatorTone): CreatorContentStyle {
  const pool: readonly CreatorContentStyle['platforms'][number][] =
    tone === 'ANALYTICAL' ? ['LONGFORM', 'TEXT', 'PODCAST']
      : tone === 'COMEDIC' ? ['SHORTFORM', 'STREAM', 'SHORTFORM']
        : tone === 'PROVOCATIVE' ? ['TEXT', 'SHORTFORM', 'PODCAST']
          : ['SHORTFORM', 'STREAM', 'LONGFORM', 'PODCAST', 'TEXT'];
  const platforms = Array.from(new Set(rng.sample(pool, rng.int(1, Math.min(3, pool.length)))));
  return {
    tone,
    platforms: platforms.length > 0 ? platforms : ['SHORTFORM'],
    postingFrequency: clamp(Math.round(rng.triangular(1, 4, 12)), 1, 14),
  };
}

/**
 * Bio fragments. Generated creators still have to read like people, so the
 * fragments are written as observations about a person rather than as filler.
 */
const BIO_OPENERS: Readonly<Record<CreatorTone, readonly string[]>> = {
  HYPE: [
    'Has never described a football match quietly and is not about to start.',
    'Treats a Tuesday training clip like a cup final and has the numbers to justify it.',
    'Turns up the moment something good happens and is gone by the time it is analysed.',
  ],
  ANALYTICAL: [
    'Explains things properly, at length, to an audience that keeps growing anyway.',
    'Reads the match everyone else watched and finds a different game in it.',
    'Has a spreadsheet for this and will show you the spreadsheet.',
  ],
  COMEDIC: [
    'Is funny about football, which is rarer and harder than being right about it.',
    'Has built an audience entirely out of other people\'s worst moments.',
    'Never intended any of this to become a job and is visibly still enjoying it.',
  ],
  PROVOCATIVE: [
    'Says the thing, waits for the reaction, and monetises the reaction.',
    'Has fallen out with four clubs and considers that a performance metric.',
    'Is disliked in a way that converts to reach with unnerving efficiency.',
  ],
  WHOLESOME: [
    'Is kind about a sport that rarely rewards it, and the audience has noticed.',
    'Turns up to the small games nobody films and posts them anyway.',
    'Answers every message, which at this follower count is close to insane.',
  ],
  DRAMATIC: [
    'Narrates a goal-line clearance like the end of a war film.',
    'Has never used a small word where an enormous one was available.',
    'Makes a mid-table fixture sound like the last thing that will ever happen.',
  ],
};

const BIO_CLOSERS: readonly string[] = [
  'Would leave for the right offer and would be insulted by the wrong one.',
  'Claims not to read the replies.',
  'Has one opinion they will not be moved on and it is the wrong one.',
  'Genuinely does not know what the follower count is for yet.',
  'Turns down more sponsorship than they accept, which nobody believes.',
  'Is at every away game, including the ones not worth attending.',
  'Has been threatened with legal action twice and enjoyed both.',
  'Is quietly better at this than anybody gives them credit for.',
];

export function generateCreator(rng: Rng, opts: GenerateCreatorOptions = {}): Creator {
  const template = opts.template;
  const bank = opts.nameBank ?? BASE_NAME_BANK;

  const tier = opts.tier ?? (template?.tier as CreatorTier | undefined) ?? rng.weighted(
    CREATOR_TIERS, (_t, i) => [30, 26, 20, 14, 10][i] ?? 10,
  );
  const tone = opts.tone ?? (template?.style.tone as CreatorTone | undefined) ?? rng.pick(TONES);

  const roles: readonly CreatorRole[] = opts.roles
    ?? (template?.roles as CreatorRole[] | undefined)
    ?? (() => {
      const primary = rng.weighted(ROLE_WEIGHTS, (r) => r.weight).role;
      // Owners very often manage as well; that pairing is the genre.
      if (primary === 'OWNER' && rng.chance(0.45)) return ['OWNER', 'MANAGER'] as CreatorRole[];
      if (primary === 'PLAYER') return ['PLAYER', 'INFLUENCER'] as CreatorRole[];
      return [primary];
    })();

  const [floor, ceiling] = TIER_REACH[tier];
  const followers = opts.followers ?? template?.followers ?? Math.round(
    rng.triangular(floor, floor + (ceiling - floor) * GENERATION_BALANCE.creator.followerMode, ceiling),
  );

  const displayName = opts.displayName ?? template?.displayName ?? [
    rng.weighted(bank.firstNames, (n) => n.weight ?? 1).value,
    rng.weighted(bank.lastNames, (n) => n.weight ?? 1).value,
  ].join(' ');

  const handle = opts.handle ?? template?.handle ?? (
    bank.handles.length > 0 && rng.chance(0.6)
      ? rng.pick(bank.handles)
      : `${displayName.toLowerCase().replace(/[^a-z]/g, '')}${rng.chance(0.5) ? rng.pick(HANDLE_SUFFIXES) : ''}`
  );

  const attributes = template
    ? (Object.fromEntries(
        CREATOR_ATTRIBUTE_KEYS.map((k) => [k, clamp(Math.round(template.attributes[k] ?? 50), 1, 99)]),
      ) as CreatorAttributes)
    : buildAttributes(rng, tier, tone);

  const style: CreatorContentStyle = template
    ? {
        tone,
        platforms: template.style.platforms as CreatorContentStyle['platforms'],
        postingFrequency: template.style.postingFrequency,
      }
    : buildStyle(rng, tone);

  const bio = opts.bio ?? template?.bio
    ?? `${rng.pick(BIO_OPENERS[tone])} ${rng.pick(BIO_CLOSERS)}`;

  const id = opts.id ?? asId<CreatorId>(
    `${opts.idPrefix ?? 'gc'}_${rng.int(0, 0x7fffffff).toString(36)}`,
  );

  // Reach is not fandom: value scales with the audience that actually converts,
  // not the raw follower count.
  const marketValue = Math.round(
    (followers / 1000) * (0.6 + attributes.fanConversion / 100) * (0.5 + attributes.commercialAppeal / 100) * 42,
  );

  return {
    id,
    identityKind: opts.identityKind ?? 'FICTIONAL',
    ...(opts.sourcePackId ? { sourcePackId: opts.sourcePackId } : {}),
    handle,
    displayName,
    roles,
    tier,
    followers,
    attributes,
    style,
    clubId: opts.clubId ?? null,
    playerId: opts.playerId ?? null,
    clubSentiment: opts.clubSentiment
      ?? clamp(Math.round(rng.normal(20, 40) - attributes.controversy * 0.25), -100, 100),
    marketValue,
    dealWeeksRemaining: opts.dealWeeksRemaining ?? null,
    avatarSeed: template?.avatarSeed ?? `${id}:${tone.toLowerCase()}`,
    bio,
  };
}

/** Tier implied by a raw follower count. Used when importing external numbers. */
export function tierForFollowers(followers: number): CreatorTier {
  for (const tier of CREATOR_TIERS) {
    const [, ceiling] = TIER_REACH[tier];
    if (followers < ceiling) return tier;
  }
  return 'GLOBAL';
}
