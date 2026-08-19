import { describe, expect, it } from 'vitest';
import { CONTENT_PACK_VERSION, type ContentPack } from './schema';
import { errorsOnly, validatePack } from './validate';
import { BASE_PACK } from './packs/base';
import { COMMUNITY_EXAMPLE_PACK } from './packs/community/example';
import { LICENSED_EXAMPLE_PACK } from './packs/licensed/example';

/**
 * Validation must catch each class of failure on its own, with a message that
 * points at the field. These tests deliberately break one thing at a time.
 */

const emptyPack = (): ContentPack => ({
  manifest: {
    id: 'test.pack', version: '1.0.0', schemaVersion: CONTENT_PACK_VERSION, kind: 'COMMUNITY',
    name: 'Test', description: 'Test pack', provider: 'Tests', identityKind: 'COMMUNITY_CREATED',
    requires: [], overrides: [], regions: [], createdAt: 1_700_000_000_000,
  },
  data: {},
});

const club = (id: string) => ({
  id, name: 'Test Club', shortName: 'Test', abbreviation: 'TST', city: 'Testville',
  founded: 1900, philosophy: 'LOCAL_ROOTS', fanCulture: 'FAMILY', reputation: 50,
  strength: 60, budget: 1_000_000, stadiumName: 'Test Park', stadiumCapacity: 5_000,
  visual: {
    primary: '#112233', secondary: '#445566', accent: '#778899',
    badgeShape: 'SHIELD', badgeMotif: 'STAR', style: 'CLASSIC', kitPattern: 'SOLID',
  },
  aiProfileId: 'LOCAL_UNDERDOG', motto: 'Test.',
});

const player = (id: string, overrides: Record<string, unknown> = {}) => ({
  id, firstName: 'Test', lastName: 'Player', age: 25, nationality: 'VLK', position: 'CB',
  attributes: {
    pace: 60, acceleration: 60, shooting: 40, finishing: 38, passing: 55, vision: 50,
    dribbling: 45, technique: 50, crossing: 42, defending: 70, positioning: 68,
    physical: 68, strength: 70, stamina: 62, decisionMaking: 60, composure: 58, reflexes: 20,
  },
  potential: 75,
  ...overrides,
});

describe('validatePack', () => {
  it('accepts the shipped packs with no errors', () => {
    expect(errorsOnly(validatePack(BASE_PACK))).toEqual([]);
    expect(errorsOnly(validatePack(COMMUNITY_EXAMPLE_PACK))).toEqual([]);
    expect(errorsOnly(validatePack(LICENSED_EXAMPLE_PACK))).toEqual([]);
  });

  it('catches duplicate ids within a collection', () => {
    const pack = emptyPack();
    (pack.data as Record<string, unknown>).clubs = [club('club_a'), club('club_a')];
    const issues = errorsOnly(validatePack(pack));
    expect(issues.some((i) => i.message.includes('duplicate club id "club_a"'))).toBe(true);
  });

  it('catches a dangling club reference from a player', () => {
    const pack = emptyPack();
    (pack.data as Record<string, unknown>).clubs = [club('club_a')];
    (pack.data as Record<string, unknown>).players = [
      player('player_a', { clubTemplateId: 'club_does_not_exist' }),
    ];
    const issues = errorsOnly(validatePack(pack));
    expect(issues.some((i) =>
      i.path === 'players[0].clubTemplateId' && i.message.includes('dangling reference'))).toBe(true);
  });

  it('catches a dangling rival reference between clubs', () => {
    const pack = emptyPack();
    (pack.data as Record<string, unknown>).clubs = [{ ...club('club_a'), rivalOf: ['club_ghost'] }];
    const issues = errorsOnly(validatePack(pack));
    expect(issues.some((i) => i.message.includes('rival club "club_ghost"'))).toBe(true);
  });

  it('catches a dangling creator reference from a player', () => {
    const pack = emptyPack();
    (pack.data as Record<string, unknown>).players = [
      player('player_a', { creatorTemplateId: 'creator_ghost' }),
    ];
    const issues = errorsOnly(validatePack(pack));
    expect(issues.some((i) => i.message.includes('creator template "creator_ghost"'))).toBe(true);
  });

  it('catches out-of-range attributes', () => {
    const pack = emptyPack();
    const broken = player('player_a');
    (broken.attributes as Record<string, number>).defending = 140;
    (broken.attributes as Record<string, number>).pace = -3;
    (pack.data as Record<string, unknown>).players = [broken];
    const issues = errorsOnly(validatePack(pack));
    expect(issues.some((i) => i.path === 'players[0].attributes.defending')).toBe(true);
    expect(issues.some((i) => i.path === 'players[0].attributes.pace')).toBe(true);
  });

  it('catches a missing attribute rather than silently defaulting it', () => {
    const pack = emptyPack();
    const broken = player('player_a');
    delete (broken.attributes as Record<string, number>).reflexes;
    (pack.data as Record<string, unknown>).players = [broken];
    expect(errorsOnly(validatePack(pack)).some((i) =>
      i.message.includes('attribute "reflexes" is missing'))).toBe(true);
  });

  it('catches potential below current overall', () => {
    const pack = emptyPack();
    (pack.data as Record<string, unknown>).players = [player('player_a', { potential: 10 })];
    expect(errorsOnly(validatePack(pack)).some((i) =>
      i.path === 'players[0].potential' && i.message.includes('below current overall'))).toBe(true);
  });

  it('catches missing required fields', () => {
    const pack = emptyPack();
    (pack.data as Record<string, unknown>).clubs = [{ ...club('club_a'), name: '', motto: '' }];
    const issues = errorsOnly(validatePack(pack));
    expect(issues.some((i) => i.path === 'clubs[0].name')).toBe(true);
    expect(issues.some((i) => i.path === 'clubs[0].motto')).toBe(true);
  });

  it('catches schema violations in enumerated fields', () => {
    const pack = emptyPack();
    (pack.data as Record<string, unknown>).clubs = [{
      ...club('club_a'), philosophy: 'VIBES_BASED', fanCulture: 'UNKNOWN',
      visual: { ...club('club_a').visual, badgeMotif: 'TOASTER', primary: 'blue' },
    }];
    const issues = errorsOnly(validatePack(pack));
    expect(issues.some((i) => i.path === 'clubs[0].philosophy')).toBe(true);
    expect(issues.some((i) => i.path === 'clubs[0].fanCulture')).toBe(true);
    expect(issues.some((i) => i.path === 'clubs[0].visual.badgeMotif')).toBe(true);
    expect(issues.some((i) => i.path === 'clubs[0].visual.primary')).toBe(true);
  });

  it('catches a commentary line bound to an event the match engine never emits', () => {
    const pack = emptyPack();
    (pack.data as Record<string, unknown>).commentary = [
      { id: 'cm_1', eventType: 'VAR_OVERTURNED', text: 'x', tone: 'NEUTRAL', weight: 1 },
    ];
    expect(errorsOnly(validatePack(pack)).some((i) =>
      i.path === 'commentary[0].eventType')).toBe(true);
  });

  it('rejects licensed content with no rights metadata', () => {
    const pack = emptyPack();
    (pack.manifest as unknown as Record<string, unknown>).kind = 'LICENSED';
    (pack.manifest as unknown as Record<string, unknown>).identityKind = 'LICENSED_CREATOR';
    const issues = errorsOnly(validatePack(pack));
    expect(issues.some((i) =>
      i.path === 'manifest.rights' && i.message.includes('rights metadata'))).toBe(true);
  });

  it('rejects licensed content with incomplete grants', () => {
    const pack: ContentPack = {
      manifest: {
        ...LICENSED_EXAMPLE_PACK.manifest,
        rights: {
          ...LICENSED_EXAMPLE_PACK.manifest.rights!,
          grants: { name: true, likeness: true, voice: false, logo: false } as never,
        },
      },
      data: LICENSED_EXAMPLE_PACK.data,
    };
    expect(errorsOnly(validatePack(pack)).some((i) =>
      i.path === 'manifest.rights.grants.merchandising')).toBe(true);
  });

  it('catches facility level arrays that do not line up with maxLevel', () => {
    const pack = emptyPack();
    (pack.data as Record<string, unknown>).facilities = [{
      id: 'facility_broken', name: 'Broken', description: 'x', icon: 'x', maxLevel: 5,
      category: 'FAN',
      upgradeCosts: [1, 2, 3], upgradeCycles: [1, 1, 1, 1, 1],
      upkeepPerCycle: [0, 1, 2, 3, 4, 5], levelEffects: ['a', 'b', 'c', 'd', 'e', 'f'],
      effects: { atmosphere: [1, 1, 1] },
    }];
    const issues = errorsOnly(validatePack(pack));
    expect(issues.some((i) => i.path === 'facilities[0].upgradeCosts')).toBe(true);
    expect(issues.some((i) => i.path === 'facilities[0].effects.atmosphere')).toBe(true);
  });

  it('catches an objective with no reward', () => {
    const pack = emptyPack();
    (pack.data as Record<string, unknown>).objectives = [{
      id: 'obj_x', title: 'T', description: 'D', kind: 'WINS', target: 3,
      rewards: [], durationCycles: 4, source: 'DYNAMIC', importance: 3, weight: 1,
    }];
    expect(errorsOnly(validatePack(pack)).some((i) => i.path === 'objectives[0].rewards')).toBe(true);
  });

  it('catches an incoherent season config', () => {
    const pack = emptyPack();
    (pack.data as Record<string, unknown>).seasonConfig = {
      clubCount: 12, rounds: 2, matchMinutes: 30, halves: 2, squadSize: 5,
      playersOnPitch: 7, benchSize: 9, substitutions: 12, playoffSpots: 8,
      relegationSpots: 8, prizeMoney: [1], startingBudget: 1, startingWageBudget: 1,
    };
    const issues = errorsOnly(validatePack(pack));
    expect(issues.some((i) => i.path === 'seasonConfig.benchSize')).toBe(true);
    expect(issues.some((i) => i.path === 'seasonConfig.substitutions')).toBe(true);
    expect(issues.some((i) => i.path === 'seasonConfig.playersOnPitch')).toBe(true);
    expect(issues.some((i) => i.path === 'seasonConfig.playoffSpots')).toBe(true);
  });

  it('warns rather than errors on a thin name bank', () => {
    const pack = emptyPack();
    (pack.data as Record<string, unknown>).nameBanks = {
      firstNames: [{ value: 'A' }], lastNames: [{ value: 'B' }], clubPrefixes: [],
      clubSuffixes: [], cities: [], handles: [], nationalities: [],
    };
    const issues = validatePack(pack);
    expect(errorsOnly(issues)).toEqual([]);
    expect(issues.some((i) => i.severity === 'warning' && i.path === 'nameBanks.firstNames')).toBe(true);
  });
});
