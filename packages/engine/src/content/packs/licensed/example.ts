import { asId, type LicenseId } from '../../../core/brand';
import type { LicensedEntityBinding } from '../../../licensing/identity';
import { CONTENT_PACK_VERSION, type ContentPack } from '../../schema';
import { CREATOR_ATTRIBUTE_KEYS, type CreatorAttributeKey } from '../../../creators/creator';

/**
 * A STRUCTURAL EXAMPLE of a licensed content pack.
 *
 * This file exists to prove two things and nothing else: that the schema can
 * express a licence, and that `ContentRegistry.visibleFor` genuinely hides
 * entities whose rights have lapsed or which were never licensed in the caller's
 * region.
 *
 * IT CONTAINS NO REAL NAMES. Every entity is an obvious placeholder —
 * "Licensed Creator Placeholder A" — precisely so that nobody can mistake this
 * for shipped content or quietly edit a real person's name into it. If and when
 * a real licence is signed, the agreement's entities replace these placeholders
 * in a pack built from this exact shape; nothing in the engine changes.
 *
 * Note the pack-level design: rights live on the manifest, so the granularity
 * of a licence is the pack. One agreement, one pack. That keeps takedown and
 * expiry a single atomic operation instead of a sweep across entity tables.
 */

const LICENSED_PACK_CREATED_AT = 1_740_787_200_000;

/** An expiry in the past, used by the rights-gating test. */
export const LICENSED_EXAMPLE_EXPIRES_AT = 1_746_057_600_000;

const ca = (partial: Partial<Record<CreatorAttributeKey, number>>): Record<string, number> =>
  Object.fromEntries(CREATOR_ATTRIBUTE_KEYS.map((k) => [k, partial[k] ?? 50]));

/**
 * Every licensed entity must name the fictional entity it falls back to when
 * the licence lapses, so a save built with the pack degrades instead of
 * breaking. The bindings point at base-pack creators.
 */
export const LICENSED_EXAMPLE_BINDINGS: readonly LicensedEntityBinding[] = [
  {
    licensedId: 'licensed_creator_placeholder_a',
    fallbackId: 'creator_ruse_vandry',
    fallbackDisplayName: 'Ruse Vandry',
  },
  {
    licensedId: 'licensed_creator_placeholder_b',
    fallbackId: 'creator_bex_calloway',
    fallbackDisplayName: 'Bex Calloway',
  },
];

export const LICENSED_EXAMPLE_PACK: ContentPack = {
  manifest: {
    id: 'licensed.example',
    version: '0.1.0',
    schemaVersion: CONTENT_PACK_VERSION,
    kind: 'LICENSED',
    name: 'Licensed Pack Structural Example',
    description:
      'A placeholder-only licensed pack demonstrating rights metadata, regional gating and expiry. Contains no real identities.',
    provider: 'Example Rights Holder (placeholder)',
    identityKind: 'LICENSED_CREATOR',
    rights: {
      licenseId: asId<LicenseId>('license_example_0001'),
      status: 'ACTIVE',
      // A genuinely regional licence: this pack is invisible outside these codes.
      regions: ['GB', 'IE'],
      expiresAt: LICENSED_EXAMPLE_EXPIRES_AT,
      provider: 'Example Rights Holder (placeholder)',
      grants: {
        name: true,
        likeness: true,
        voice: false,
        logo: false,
        merchandising: false,
      },
      attribution: 'Placeholder attribution line supplied by the rights holder.',
    },
    requires: ['base'],
    overrides: [],
    // Region gating is enforced twice: here, and again by the rights metadata.
    regions: ['GB', 'IE'],
    createdAt: LICENSED_PACK_CREATED_AT,
  },
  data: {
    creators: [
      {
        id: 'licensed_creator_placeholder_a',
        handle: 'licensed_placeholder_a',
        displayName: 'Licensed Creator Placeholder A',
        roles: ['OWNER', 'MANAGER'],
        tier: 'GLOBAL',
        followers: 18_000_000,
        attributes: ca({
          audience: 90, engagement: 70, charisma: 80, controversy: 50, brandValue: 88,
          loyalty: 50, leadership: 70, entertainment: 82, mediaAbility: 76,
          fanConversion: 60, commercialAppeal: 90,
        }),
        style: { tone: 'HYPE', platforms: ['STREAM', 'SHORTFORM'], postingFrequency: 6 },
        bio: 'Placeholder biography for a licensed creator. Replaced at pack-build time by copy approved under the agreement.',
        avatarSeed: 'licensed-placeholder-a',
      },
      {
        id: 'licensed_creator_placeholder_b',
        handle: 'licensed_placeholder_b',
        displayName: 'Licensed Creator Placeholder B',
        roles: ['PUNDIT'],
        tier: 'MAJOR',
        followers: 4_500_000,
        attributes: ca({
          audience: 78, engagement: 66, charisma: 72, controversy: 44, brandValue: 70,
          loyalty: 60, leadership: 55, entertainment: 68, mediaAbility: 86,
          fanConversion: 52, commercialAppeal: 74,
        }),
        style: { tone: 'ANALYTICAL', platforms: ['LONGFORM', 'PODCAST'], postingFrequency: 3 },
        bio: 'Placeholder biography for a licensed pundit. Replaced at pack-build time by copy approved under the agreement.',
        avatarSeed: 'licensed-placeholder-b',
      },
    ],
  },
};

/**
 * The same pack with its licence already expired, kept beside the live one so
 * the rights-gating test has an unambiguous fixture rather than a hand-mutated
 * clone. Note the entities are identical: only the rights differ.
 */
export const LICENSED_EXAMPLE_PACK_EXPIRED: ContentPack = {
  manifest: {
    ...LICENSED_EXAMPLE_PACK.manifest,
    id: 'licensed.example.expired',
    rights: {
      ...LICENSED_EXAMPLE_PACK.manifest.rights!,
      licenseId: asId<LicenseId>('license_example_0002'),
      expiresAt: LICENSED_PACK_CREATED_AT,
    },
  },
  data: LICENSED_EXAMPLE_PACK.data,
};
