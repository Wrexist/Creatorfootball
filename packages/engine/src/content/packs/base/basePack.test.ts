import { describe, expect, it } from 'vitest';
import { CREATOR_TIERS } from '../../../creators/creator';
import { MATCH_EVENT_TYPES } from '../../../matches/events';
import { errorsOnly, validatePack } from '../../validate';
import { NAME_BANK_MINIMUMS } from '../../validate';
import { BASE_SEASON_CONFIG } from '../../seasonConfig';
import { MANAGER_ARCHETYPES } from '../../generators/managerGenerator';
import {
  AI_PROFILE_IDS, BASE_CLUBS, BASE_COMMENTARY, BASE_CREATORS, BASE_FACILITIES,
  BASE_MEDIA_TEMPLATES, BASE_NAME_BANK, BASE_OBJECTIVES, BASE_OFFERS, BASE_PACK,
  BASE_PLAYERS, BASE_SOCIAL_TEMPLATES, BASE_SPONSORS, CLUB_LORE, FACILITY_EFFECT_KEYS,
} from './index';
import { COMMUNITY_EXAMPLE_PACK } from '../community/example';
import { LICENSED_EXAMPLE_PACK } from '../licensed/example';

/**
 * The base pack has to be complete and legally clean on its own. These tests
 * are the contract for both: the required inventory counts, and a denylist
 * sweep over every string the pack ships.
 */

describe('base pack inventory', () => {
  it('validates with no errors', () => {
    expect(errorsOnly(validatePack(BASE_PACK))).toEqual([]);
  });

  it('ships twelve distinct clubs with a spread of strength', () => {
    expect(BASE_CLUBS).toHaveLength(12);
    expect(new Set(BASE_CLUBS.map((c) => c.id)).size).toBe(12);
    expect(new Set(BASE_CLUBS.map((c) => c.abbreviation)).size).toBe(12);
    expect(new Set(BASE_CLUBS.map((c) => c.city)).size).toBe(12);
    expect(new Set(BASE_CLUBS.map((c) => c.visual.badgeMotif)).size).toBe(12);
    expect(new Set(BASE_CLUBS.map((c) => c.visual.primary)).size).toBe(12);

    const strengths = BASE_CLUBS.map((c) => c.strength).sort((a, b) => b - a);
    const best = strengths[0] as number;
    const second = strengths[1] as number;
    const worst = strengths[strengths.length - 1] as number;
    expect(best - second).toBeGreaterThanOrEqual(5);   // a clear favourite
    expect(best - worst).toBeGreaterThanOrEqual(25);   // real strugglers
    // A genuine mid pack: at least five clubs inside a narrow band.
    const midPack = strengths.filter((s) => s >= 62 && s <= 78).length;
    expect(midPack).toBeGreaterThanOrEqual(5);
  });

  it('gives every club a one-paragraph identity and declared rivals', () => {
    for (const club of BASE_CLUBS) {
      const lore = CLUB_LORE[club.id];
      expect(lore, `missing lore for ${club.id}`).toBeDefined();
      expect((lore ?? '').length).toBeGreaterThan(300);
      expect(club.motto.length).toBeGreaterThan(4);
      expect((AI_PROFILE_IDS as readonly string[])).toContain(club.aiProfileId);
    }
    const withRivals = BASE_CLUBS.filter((c) => (c.rivalOf ?? []).length > 0);
    expect(withRivals.length).toBeGreaterThanOrEqual(10);
    // Every AI profile is used by at least one club.
    const used = new Set(BASE_CLUBS.map((c) => c.aiProfileId));
    expect(used.size).toBe(AI_PROFILE_IDS.length);
  });

  it('ships a name bank large enough that generated players rarely repeat', () => {
    expect(BASE_NAME_BANK.firstNames.length).toBeGreaterThanOrEqual(NAME_BANK_MINIMUMS.firstNames);
    expect(BASE_NAME_BANK.lastNames.length).toBeGreaterThanOrEqual(NAME_BANK_MINIMUMS.lastNames);
    expect(BASE_NAME_BANK.cities.length).toBeGreaterThanOrEqual(NAME_BANK_MINIMUMS.cities);
    expect(BASE_NAME_BANK.handles.length).toBeGreaterThanOrEqual(NAME_BANK_MINIMUMS.handles);
    expect(BASE_NAME_BANK.clubPrefixes.length + BASE_NAME_BANK.clubSuffixes.length)
      .toBeGreaterThanOrEqual(NAME_BANK_MINIMUMS.clubAffixes);
    expect(BASE_NAME_BANK.nationalities).toHaveLength(NAME_BANK_MINIMUMS.nationalities);

    for (const list of [BASE_NAME_BANK.firstNames, BASE_NAME_BANK.lastNames]) {
      expect(new Set(list.map((n) => n.value)).size).toBe(list.length);
    }
    expect(new Set(BASE_NAME_BANK.cities).size).toBe(BASE_NAME_BANK.cities.length);
    expect(new Set(BASE_NAME_BANK.handles).size).toBe(BASE_NAME_BANK.handles.length);
  });

  it('ships twenty-eight creators across every tier and every tone', () => {
    expect(BASE_CREATORS).toHaveLength(28);
    expect(new Set(BASE_CREATORS.map((c) => c.handle)).size).toBe(28);

    for (const tier of CREATOR_TIERS) {
      expect(BASE_CREATORS.filter((c) => c.tier === tier).length,
        `no creators in tier ${tier}`).toBeGreaterThan(0);
    }
    const tones = ['HYPE', 'ANALYTICAL', 'COMEDIC', 'PROVOCATIVE', 'WHOLESOME', 'DRAMATIC'];
    for (const tone of tones) {
      expect(BASE_CREATORS.filter((c) => c.style.tone === tone).length,
        `no creators with tone ${tone}`).toBeGreaterThan(0);
    }
    for (const creator of BASE_CREATORS) {
      expect(creator.bio.length, `thin bio for ${creator.id}`).toBeGreaterThan(60);
    }
  });

  it('weights creators toward ownership and media, with players as the exception', () => {
    const withRole = (role: string) => BASE_CREATORS.filter((c) => c.roles.includes(role)).length;
    expect(withRole('OWNER')).toBe(12);          // one president per club
    expect(withRole('PLAYER')).toBe(4);
    expect(withRole('PLAYER')).toBeLessThan(withRole('OWNER'));
    expect(withRole('MANAGER') + withRole('OWNER') + withRole('CLUB_PERSONALITY') + withRole('INFLUENCER'))
      .toBeGreaterThan(withRole('PLAYER') * 5);

    // Each club has exactly one president.
    const presidentsByClub = new Map<string, number>();
    for (const creator of BASE_CREATORS) {
      if (!creator.roles.includes('OWNER') || !creator.clubTemplateId) continue;
      presidentsByClub.set(creator.clubTemplateId, (presidentsByClub.get(creator.clubTemplateId) ?? 0) + 1);
    }
    expect(presidentsByClub.size).toBe(12);
    for (const count of presidentsByClub.values()) expect(count).toBe(1);
  });

  it('ships named players including the creator-players', () => {
    expect(BASE_PLAYERS.length).toBeGreaterThanOrEqual(16);
    const creatorLinked = BASE_PLAYERS.filter((p) => p.creatorTemplateId);
    expect(creatorLinked).toHaveLength(4);
    for (const player of creatorLinked) {
      const creator = BASE_CREATORS.find((c) => c.id === player.creatorTemplateId);
      expect(creator, `unmatched creator for ${player.id}`).toBeDefined();
      expect(creator?.playerTemplateId).toBe(player.id);
    }
  });

  it('ships ten pre-made managers and eight archetypes through the pack', () => {
    expect(BASE_PACK.data.managers).toHaveLength(10);
    expect(MANAGER_ARCHETYPES).toHaveLength(8);
  });

  it('ships twenty sponsors with meaningful progression gates', () => {
    expect(BASE_SPONSORS).toHaveLength(20);
    const tiers = new Set(BASE_SPONSORS.map((s) => s.tier));
    expect(tiers.size).toBeGreaterThanOrEqual(4);
    const slots = new Set(BASE_SPONSORS.flatMap((s) => s.slots));
    for (const slot of ['SHIRT', 'SLEEVE', 'STADIUM', 'TRAINING', 'CREATOR']) {
      expect(slots.has(slot), `no sponsor for slot ${slot}`).toBe(true);
    }
    // Value and reputation gate must rise together, or progression is not felt.
    const byTier = [1, 2, 3, 4].map((tier) => {
      const group = BASE_SPONSORS.filter((s) => s.tier === tier);
      return {
        value: group.reduce((a, s) => a + s.baseValue, 0) / group.length,
        gate: group.reduce((a, s) => a + s.requiresReputation, 0) / group.length,
      };
    });
    for (let i = 1; i < byTier.length; i++) {
      expect(byTier[i]!.value).toBeGreaterThan(byTier[i - 1]!.value);
      expect(byTier[i]!.gate).toBeGreaterThan(byTier[i - 1]!.gate);
    }
    // Follower gates exist on the creator-facing deals.
    expect(BASE_SPONSORS.filter((s) => s.requiresFollowers).length).toBeGreaterThanOrEqual(5);
  });

  it('ships eleven facilities with five levels and machine-readable effects', () => {
    expect(BASE_FACILITIES).toHaveLength(11);
    const emitted = new Set(BASE_FACILITIES.flatMap((f) => Object.keys(f.effects)));
    for (const key of FACILITY_EFFECT_KEYS) {
      expect(emitted.has(key), `no facility emits "${key}"`).toBe(true);
    }
    for (const facility of BASE_FACILITIES) {
      expect(facility.maxLevel).toBe(5);
      expect(facility.upgradeCosts).toHaveLength(5);
      expect(facility.levelEffects).toHaveLength(6);
      expect(facility.upkeepPerCycle).toHaveLength(6);
      // Costs and upkeep escalate; effects improve monotonically.
      for (let i = 1; i < facility.upgradeCosts.length; i++) {
        expect(facility.upgradeCosts[i]!).toBeGreaterThan(facility.upgradeCosts[i - 1]!);
      }
      for (let i = 1; i < facility.upkeepPerCycle.length; i++) {
        expect(facility.upkeepPerCycle[i]!).toBeGreaterThan(facility.upkeepPerCycle[i - 1]!);
      }
      for (const values of Object.values(facility.effects)) {
        expect(values).toHaveLength(6);
        for (let i = 1; i < values.length; i++) {
          expect(values[i]!).toBeGreaterThan(values[i - 1]!);
        }
      }
    }
  });

  it('ships forty-plus objectives across all five sources', () => {
    expect(BASE_OBJECTIVES.length).toBeGreaterThanOrEqual(40);
    for (const source of ['SEASON', 'DYNAMIC', 'SPONSOR', 'BOARD', 'FANS']) {
      expect(BASE_OBJECTIVES.filter((o) => o.source === source).length,
        `no objectives from ${source}`).toBeGreaterThanOrEqual(5);
    }
    expect(new Set(BASE_OBJECTIVES.map((o) => o.id)).size).toBe(BASE_OBJECTIVES.length);
  });

  it('ships twenty-four store offers on a four-week rotation, selling no advantage', () => {
    expect(BASE_OFFERS).toHaveLength(24);
    for (const week of [1, 2, 3, 4]) {
      expect(BASE_OFFERS.filter((o) => o.rotationWeek === week)).toHaveLength(6);
    }
    // The hard rule: the store never sells raw competitive advantage.
    const allowed = new Set(['COSMETIC', 'PREMIUM', 'SCOUT_CREDIT']);
    for (const offer of BASE_OFFERS) {
      for (const item of offer.contents) {
        expect(allowed.has(item.kind), `offer ${offer.sku} sells ${item.kind}`).toBe(true);
      }
    }
  });

  it('ships enough commentary, social and media copy to feel written', () => {
    expect(BASE_COMMENTARY.length).toBeGreaterThanOrEqual(200);
    expect(BASE_SOCIAL_TEMPLATES.length).toBeGreaterThanOrEqual(120);
    expect(BASE_MEDIA_TEMPLATES.length).toBeGreaterThanOrEqual(60);

    expect(new Set(BASE_COMMENTARY.map((c) => c.id)).size).toBe(BASE_COMMENTARY.length);
    expect(new Set(BASE_COMMENTARY.map((c) => c.text)).size).toBe(BASE_COMMENTARY.length);
    expect(new Set(BASE_SOCIAL_TEMPLATES.map((s) => s.id)).size).toBe(BASE_SOCIAL_TEMPLATES.length);
    expect(new Set(BASE_MEDIA_TEMPLATES.map((m) => m.id)).size).toBe(BASE_MEDIA_TEMPLATES.length);

    // The high-frequency events need genuine depth or a match repeats itself.
    for (const eventType of ['GOAL', 'SHOT', 'SAVE', 'MISS']) {
      expect(BASE_COMMENTARY.filter((c) => c.eventType === eventType).length,
        `thin commentary for ${eventType}`).toBeGreaterThanOrEqual(14);
    }
    for (const line of BASE_COMMENTARY) {
      expect((MATCH_EVENT_TYPES as readonly string[])).toContain(line.eventType);
    }
    // Every tone is represented.
    for (const tone of ['NEUTRAL', 'HYPE', 'CRITICAL', 'DRAMATIC', 'WRY']) {
      expect(BASE_COMMENTARY.filter((c) => c.tone === tone).length).toBeGreaterThan(10);
    }
    // Every social author kind is used.
    for (const author of ['FAN', 'CREATOR', 'MEDIA', 'CLUB', 'PLAYER', 'RIVAL', 'SPONSOR', 'LEAK']) {
      expect(BASE_SOCIAL_TEMPLATES.filter((s) => s.authorKind === author).length,
        `no social templates authored by ${author}`).toBeGreaterThan(0);
    }
  });

  it('ships the agreed season config, including the wildcard meta', () => {
    expect(BASE_SEASON_CONFIG.clubCount).toBe(12);
    expect(BASE_SEASON_CONFIG.rounds).toBe(2);
    expect(BASE_SEASON_CONFIG.matchMinutes).toBe(30);
    expect(BASE_SEASON_CONFIG.halves).toBe(2);
    expect(BASE_SEASON_CONFIG.playersOnPitch).toBe(7);
    expect(BASE_SEASON_CONFIG.squadSize).toBe(18);
    expect(BASE_SEASON_CONFIG.benchSize).toBe(7);
    expect(BASE_SEASON_CONFIG.substitutions).toBe(5);
    // The roster-construction meta, which is not the same thing as the bench.
    expect(BASE_SEASON_CONFIG.draftedSquadSize).toBe(14);
    expect(BASE_SEASON_CONFIG.seasonWildcardSlots).toBe(1);
    expect(BASE_SEASON_CONFIG.rotatingWildcardSlots).toBe(1);
    expect(
      BASE_SEASON_CONFIG.draftedSquadSize
      + BASE_SEASON_CONFIG.seasonWildcardSlots
      + BASE_SEASON_CONFIG.rotatingWildcardSlots,
    ).toBeLessThanOrEqual(BASE_SEASON_CONFIG.squadSize);
  });

  it('uses a fixed creation stamp rather than a clock read', () => {
    expect(BASE_PACK.manifest.createdAt).toBe(1_735_689_600_000);
    expect(BASE_PACK.manifest.identityKind).toBe('FICTIONAL');
    expect(BASE_PACK.manifest.rights).toBeUndefined();
    expect(BASE_PACK.manifest.requires).toEqual([]);
  });
});

/**
 * The legal sweep.
 *
 * Every string the packs ship is flattened and checked against terms that are
 * either claimed marks or real-world identities. This is the CI lint the
 * research dossier asks for, expressed as a test so it cannot be skipped.
 */
describe('originality and IP guardrails', () => {
  const flatten = (value: unknown): string => JSON.stringify(value).toLowerCase();
  const corpus = [
    flatten(BASE_PACK),
    flatten(CLUB_LORE),
    flatten(COMMUNITY_EXAMPLE_PACK),
    flatten(LICENSED_EXAMPLE_PACK),
  ].join(' ');

  // Rule names and league marks assumed claimed by existing competitions.
  const CLAIMED_TERMS = [
    'gamechanger', 'game changer', 'secret weapon', 'arma secreta', 'president penalty',
    'reverse penalty', 'rulebreaker', 'rule breaker', '3play', 'plus one', 'fairplay',
    'fast forward', 'baller league', 'kings league', 'queens league', 'icon league',
    'sidemen', 'liga de creadores',
  ];

  // Real clubs, competitions, nations and brands that must never appear.
  const REAL_WORLD_TERMS = [
    'manchester', 'liverpool', 'chelsea', 'arsenal', 'tottenham', 'barcelona', 'barca',
    'real madrid', 'juventus', 'bayern', 'dortmund', 'ajax', 'inter milan', 'wrexham',
    'premier league', 'la liga', 'bundesliga', 'serie a', 'ligue 1', 'champions league',
    'fifa', 'uefa', 'wembley', 'copper box', 'cupra',
    'england', 'scotland', 'wales', 'ireland', 'france', 'germany', 'spain', 'italy',
    'brazil', 'argentina', 'portugal', 'netherlands', 'belgium', 'croatia', 'japan',
    'nigeria', 'ghana', 'senegal', 'mexico', 'colombia', 'sweden', 'norway', 'denmark',
    'nike', 'adidas', 'puma', 'pepsi', 'coca-cola', 'twitch', 'youtube', 'tiktok',
    'instagram', 'sky sports', 'dazn', 'espn',
  ];

  it('contains none of the claimed rule or league terms', () => {
    for (const term of CLAIMED_TERMS) {
      expect(corpus.includes(term), `claimed term "${term}" appears in shipped content`).toBe(false);
    }
  });

  it('contains no real club, competition, nation or brand names', () => {
    for (const term of REAL_WORLD_TERMS) {
      expect(corpus.includes(term), `real-world term "${term}" appears in shipped content`).toBe(false);
    }
  });

  it('invents every nationality rather than using a real one', () => {
    for (const nation of BASE_NAME_BANK.nationalities) {
      expect(nation.code).toMatch(/^[A-Z]{3}$/);
      expect(nation.name.length).toBeGreaterThan(3);
      for (const term of REAL_WORLD_TERMS) {
        expect(nation.name.toLowerCase()).not.toBe(term);
      }
    }
  });

  it('keeps the licensed example free of any real identity', () => {
    const creators = LICENSED_EXAMPLE_PACK.data.creators ?? [];
    expect(creators.length).toBeGreaterThan(0);
    for (const creator of creators) {
      expect(creator.displayName).toMatch(/Placeholder/);
      expect(creator.bio.toLowerCase()).toContain('placeholder');
    }
    expect(LICENSED_EXAMPLE_PACK.manifest.rights?.licenseId).toBeTruthy();
    expect(LICENSED_EXAMPLE_PACK.manifest.rights?.grants).toBeDefined();
  });

  it('marks the community example as community-created', () => {
    expect(COMMUNITY_EXAMPLE_PACK.manifest.identityKind).toBe('COMMUNITY_CREATED');
    expect(COMMUNITY_EXAMPLE_PACK.manifest.kind).toBe('COMMUNITY');
    expect(COMMUNITY_EXAMPLE_PACK.manifest.rights).toBeUndefined();
    expect(COMMUNITY_EXAMPLE_PACK.data.clubs).toHaveLength(3);
    expect(COMMUNITY_EXAMPLE_PACK.data.players).toHaveLength(6);
    expect(COMMUNITY_EXAMPLE_PACK.data.creators).toHaveLength(4);
  });
});
