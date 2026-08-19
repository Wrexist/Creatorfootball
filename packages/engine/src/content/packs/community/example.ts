import { CONTENT_PACK_VERSION, type ContentPack } from '../../schema';
import { attributesForOverall } from '../../generators/profiles';
import { MENTAL_KEYS, type MentalKey } from '../../../players/mental';
import { CREATOR_ATTRIBUTE_KEYS, type CreatorAttributeKey } from '../../../creators/creator';

/**
 * An example community pack.
 *
 * Its job is to prove the pack system genuinely composes rather than to ship
 * content: three clubs, six players and four creators that slot into the base
 * league and reference each other correctly. It declares `requires: ['base']`
 * so the registry exercises the dependency check, and it overrides nothing.
 *
 * Everything is `COMMUNITY_CREATED` and one hundred per cent fictional. A
 * community pack carries no rights metadata, and validation would reject it if
 * it claimed a licensed identity kind without any.
 */

const COMMUNITY_PACK_CREATED_AT = 1_738_368_000_000;

const mn = (partial: Partial<Record<MentalKey, number>>): Record<string, number> =>
  Object.fromEntries(MENTAL_KEYS.map((k) => [k, partial[k] ?? 50]));

const ca = (partial: Partial<Record<CreatorAttributeKey, number>>): Record<string, number> =>
  Object.fromEntries(CREATOR_ATTRIBUTE_KEYS.map((k) => [k, partial[k] ?? 50]));

export const COMMUNITY_EXAMPLE_PACK: ContentPack = {
  manifest: {
    id: 'community.threetowns',
    version: '0.3.0',
    schemaVersion: CONTENT_PACK_VERSION,
    kind: 'COMMUNITY',
    name: 'Three Towns',
    description:
      'A community-built expansion adding three clubs from the far side of the moor, six players and four creators.',
    provider: 'Three Towns Collective',
    identityKind: 'COMMUNITY_CREATED',
    requires: ['base'],
    overrides: [],
    regions: [],
    createdAt: COMMUNITY_PACK_CREATED_AT,
  },
  data: {
    nameBanks: {
      // A community pack can extend the name bank without replacing it; the
      // registry merges and de-duplicates across packs.
      firstNames: [{ value: 'Ossian' }, { value: 'Perrin' }, { value: 'Vesna' }, { value: 'Ottoline' }],
      lastNames: [{ value: 'Marrowby' }, { value: 'Quintrell' }, { value: 'Vayne' }, { value: 'Ashdown' }],
      clubPrefixes: ['Moorside'],
      clubSuffixes: ['Colliery', 'Mill'],
      cities: ['Blackmoor Cross', 'Wynding', 'Pitchfell'],
      handles: ['moorsidemutter', 'threetownstv', 'colliery90'],
      nationalities: [{ code: 'MRV', name: 'Marovian', weight: 2 }],
    },
    clubs: [
      {
        id: 'club_blackmoor_colliery',
        name: 'Blackmoor Colliery',
        shortName: 'Blackmoor',
        abbreviation: 'BMC',
        city: 'Blackmoor Cross',
        founded: 1893,
        philosophy: 'LOCAL_ROOTS',
        fanCulture: 'DIEHARD',
        reputation: 41,
        strength: 59,
        budget: 1_250_000,
        stadiumName: 'The Winding House',
        stadiumCapacity: 5_400,
        visual: {
          primary: '#1A1D22', secondary: '#D9C7A3', accent: '#5B8C5A',
          badgeShape: 'SHIELD', badgeMotif: 'HAMMER', style: 'RETRO', kitPattern: 'STRIPES',
        },
        aiProfileId: 'LOCAL_UNDERDOG',
        motto: 'Down here we dig.',
        rivalOf: ['club_wynding_mill'],
      },
      {
        id: 'club_wynding_mill',
        name: 'Wynding Mill',
        shortName: 'Wynding',
        abbreviation: 'WYM',
        city: 'Wynding',
        founded: 1902,
        philosophy: 'YOUTH_ACADEMY',
        fanCulture: 'FAMILY',
        reputation: 37,
        strength: 56,
        budget: 980_000,
        stadiumName: 'Loom Park',
        stadiumCapacity: 4_900,
        visual: {
          primary: '#3E6B8C', secondary: '#F1EDE4', accent: '#C4553B',
          badgeShape: 'CIRCLE', badgeMotif: 'TOWER', style: 'CLASSIC', kitPattern: 'HOOPS',
        },
        aiProfileId: 'YOUTH_FACTORY',
        motto: 'Spun here, stays here.',
        rivalOf: ['club_blackmoor_colliery'],
      },
      {
        id: 'club_pitchfell_signal',
        name: 'Pitchfell Signal',
        shortName: 'Pitchfell',
        abbreviation: 'PFS',
        city: 'Pitchfell',
        founded: 2018,
        philosophy: 'CREATOR_FIRST',
        fanCulture: 'ONLINE_NATIVE',
        reputation: 34,
        strength: 54,
        budget: 1_100_000,
        stadiumName: 'The Relay',
        stadiumCapacity: 4_200,
        visual: {
          primary: '#12131A', secondary: '#42E2B8', accent: '#F2C14E',
          badgeShape: 'HEX', badgeMotif: 'BOLT', style: 'STREET', kitPattern: 'GRADIENT',
        },
        aiProfileId: 'CREATOR_CLUB',
        motto: 'Signal over noise.',
      },
    ],
    players: [
      {
        id: 'player_ossian_marrowby',
        firstName: 'Ossian', lastName: 'Marrowby', age: 29, nationality: 'MRV',
        position: 'CB', secondaryPositions: ['CDM'], footedness: 'left', height: 191,
        attributes: attributesForOverall('CB', 66, { defending: 74, strength: 79 }),
        mental: mn({ leadership: 84, discipline: 74, loyalty: 90, consistency: 70 }),
        traitIds: ['leader', 'aerial_threat'],
        potential: 68,
        clubTemplateId: 'club_blackmoor_colliery',
        portraitSeed: 'ossian-marrowby',
      },
      {
        id: 'player_perrin_quintrell',
        firstName: 'Perrin', lastName: 'Quintrell', age: 18, nationality: 'VLK',
        position: 'CAM', secondaryPositions: ['CM'], footedness: 'right', height: 173,
        attributes: attributesForOverall('CAM', 58, { vision: 68, technique: 70 }),
        mental: mn({ ambition: 82, confidence: 66, consistency: 40, pressureHandling: 38 }),
        traitIds: ['wonderkid'],
        potential: 82,
        clubTemplateId: 'club_wynding_mill',
        creatorTemplateId: 'creator_perrin_quintrell',
        portraitSeed: 'perrin-quintrell',
      },
      {
        id: 'player_vesna_ashdown',
        firstName: 'Vesna', lastName: 'Ashdown', age: 25, nationality: 'OST',
        position: 'GK', footedness: 'right', height: 189,
        attributes: attributesForOverall('GK', 63, { reflexes: 70 }),
        mental: mn({ professionalism: 80, pressureHandling: 66 }),
        traitIds: ['wall'],
        potential: 71,
        clubTemplateId: 'club_pitchfell_signal',
        portraitSeed: 'vesna-ashdown',
      },
      {
        id: 'player_ottoline_vayne',
        firstName: 'Ottoline', lastName: 'Vayne', age: 31, nationality: 'MRV',
        position: 'ST', secondaryPositions: ['CAM'], footedness: 'right', height: 180,
        attributes: attributesForOverall('ST', 64, { finishing: 74, composure: 72 }),
        mental: mn({ leadership: 72, loyalty: 78, ambition: 34 }),
        traitIds: ['veteran', 'cult_hero'],
        potential: 65,
        clubTemplateId: 'club_blackmoor_colliery',
        portraitSeed: 'ottoline-vayne',
      },
      {
        id: 'player_hale_quintrell',
        firstName: 'Hale', lastName: 'Quintrell', age: 22, nationality: 'VLK',
        position: 'RW', secondaryPositions: ['LW'], footedness: 'left', height: 174,
        attributes: attributesForOverall('RW', 61, { pace: 78, dribbling: 72 }),
        mental: mn({ confidence: 74, discipline: 46, temperament: 44 }),
        traitIds: ['speedster'],
        potential: 76,
        clubTemplateId: 'club_wynding_mill',
        portraitSeed: 'hale-quintrell',
      },
      {
        id: 'player_marek_ashdown',
        firstName: 'Marek', lastName: 'Ashdown', age: 27, nationality: 'DRA',
        position: 'CM', secondaryPositions: ['CDM'], footedness: 'right', height: 181,
        attributes: attributesForOverall('CM', 62, { passing: 72, stamina: 76 }),
        mental: mn({ professionalism: 78, consistency: 74, leadership: 58 }),
        traitIds: ['workhorse'],
        potential: 66,
        clubTemplateId: 'club_pitchfell_signal',
        portraitSeed: 'marek-ashdown',
      },
    ],
    creators: [
      {
        id: 'creator_perrin_quintrell',
        handle: 'colliery90',
        displayName: 'Perrin Quintrell',
        roles: ['PLAYER'],
        tier: 'LOCAL',
        followers: 18_000,
        attributes: ca({ audience: 16, engagement: 84, charisma: 58, controversy: 20, entertainment: 66, fanConversion: 62, loyalty: 82 }),
        style: { tone: 'WHOLESOME', platforms: ['SHORTFORM'], postingFrequency: 3 },
        clubTemplateId: 'club_wynding_mill',
        playerTemplateId: 'player_perrin_quintrell',
        bio: 'Eighteen, plays for the club his grandfather played for, and posts almost entirely about the dog.',
        avatarSeed: 'perrin-quintrell-01',
      },
      {
        id: 'creator_iona_marrowby',
        handle: 'moorsidemutter',
        displayName: 'Iona Marrowby',
        roles: ['OWNER', 'CLUB_PERSONALITY'],
        tier: 'LOCAL',
        followers: 31_000,
        attributes: ca({ audience: 20, engagement: 78, charisma: 64, controversy: 58, leadership: 74, loyalty: 96, fanConversion: 70 }),
        style: { tone: 'DRAMATIC', platforms: ['TEXT', 'STREAM'], postingFrequency: 5 },
        clubTemplateId: 'club_blackmoor_colliery',
        bio: 'Took over a club with three thousand pounds and a grievance. Still has the grievance.',
        avatarSeed: 'iona-marrowby-01',
      },
      {
        id: 'creator_dax_pell',
        handle: 'threetownstv',
        displayName: 'Dax Pell',
        roles: ['INFLUENCER', 'PUNDIT'],
        tier: 'RISING',
        followers: 142_000,
        attributes: ca({ audience: 40, engagement: 72, charisma: 70, controversy: 66, entertainment: 80, mediaAbility: 58 }),
        style: { tone: 'COMEDIC', platforms: ['SHORTFORM', 'STREAM'], postingFrequency: 9 },
        bio: 'Covers all three towns and is banned from one of them. Will not say which, which is very much the bit.',
        avatarSeed: 'dax-pell-01',
      },
      {
        id: 'creator_sable_reyne',
        handle: 'sablereyne',
        displayName: 'Sable Reyne',
        roles: ['OWNER', 'MANAGER'],
        tier: 'ESTABLISHED',
        followers: 470_000,
        attributes: ca({ audience: 48, engagement: 66, charisma: 76, controversy: 44, brandValue: 62, leadership: 80, commercialAppeal: 68 }),
        style: { tone: 'ANALYTICAL', platforms: ['LONGFORM', 'PODCAST'], postingFrequency: 2 },
        clubTemplateId: 'club_pitchfell_signal',
        bio: 'Built a club out of a group chat and runs it with an unnerving amount of paperwork.',
        avatarSeed: 'sable-reyne-01',
      },
    ],
  },
};
