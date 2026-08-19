import { describe, expect, it } from 'vitest';
import { Rng } from '../core/rng';
import { asId, type ClubId } from '../core/brand';
import { ContentRegistry } from '../content/loader';
import { BASE_PACK } from '../content/packs/base';
import { AI_PROFILE_IDS } from '../content/packs/base/clubs';
import { clubFromTemplate } from '../content/generators/clubGenerator';
import { generateStories } from '../media/mediaEngine';
import { generatePosts } from '../social/socialEngine';
import { rivalryFor, seedRivalries } from '../rivalries/rivalries';
import { AI_PROFILES, profileFor } from './aiClub';
import { buildTestWorld, makeTestEvent } from './fixtures';
import { TRIGGER_FALLBACKS } from './templating';

/**
 * Cross-workstream contract tests.
 *
 * The living world is only as alive as the content it can reach. These tests
 * fail loudly if the two halves drift apart: if the content pack renames an AI
 * profile, re-keys a template trigger, or declares a rivalry this engine cannot
 * resolve, the product degrades silently into generic filler — which is the
 * exact failure mode this workstream exists to prevent.
 */

const registry = new ContentRegistry();
registry.load(BASE_PACK);
const templates = registry.clubs();
const realClubs = () => templates.map((t, i) => clubFromTemplate(new Rng(`club-${i}`), t, asId<ClubId>(`cf_club_${i}`)));

describe('AI profiles and the content pack', () => {
  it('shares one vocabulary of profile ids', () => {
    expect(AI_PROFILES.map((p) => p.id).sort()).toEqual([...AI_PROFILE_IDS].sort());
  });

  it('resolves a distinct profile for every base club', () => {
    for (const club of realClubs()) {
      expect(profileFor(club).id, club.name).toBe(club.aiProfileId);
    }
  });
});

describe('rivalry seeding against real club templates', () => {
  it('honours every declared rivalry even after ids are reassigned', () => {
    const clubs = realClubs();
    const byTemplateId = new Map(templates.map((t, i) => [t.id, clubs[i]]));
    const rivalries = seedRivalries(clubs, templates, new Rng('seed'));
    let declared = 0;
    for (const template of templates) {
      for (const rivalId of template.rivalOf ?? []) {
        declared++;
        const a = byTemplateId.get(template.id);
        const b = byTemplateId.get(rivalId);
        expect(a && b, `${template.id} -> ${rivalId}`).toBeTruthy();
        if (!a || !b) continue;
        expect(rivalryFor({ rivalries } as never, a.id, b.id), `${template.id} -> ${rivalId}`).not.toBeNull();
      }
    }
    expect(declared).toBeGreaterThan(10);
  });
});

describe('trigger vocabulary', () => {
  /** Every trigger the cascade and the emergent detectors can emit. */
  const EMITTED = [
    'RED_CARD', 'SUSPENSION_AFTERMATH', 'MARQUEE_SIGNING', 'SIGNING', 'DEBUT_WATCH',
    'SHOCK_DEFEAT', 'DEFEAT', 'DERBY_DEFEAT', 'DEFEAT_FALLOUT', 'WIN', 'STATEMENT_WIN', 'DERBY_WIN',
    'GOAL', 'SPECIAL_GOAL', 'WONDERKID', 'BREAKOUT_INTEREST', 'INJURY_BLOW', 'RECORD_BROKEN',
    'RECORD_REACTION', 'FAN_UNREST', 'FAN_BUZZ', 'RIVALRY_HEAT', 'TRANSFER_HIJACK', 'TROPHY_WON',
    'TROPHY_AFTERGLOW', 'MANAGER_SACKED', 'SPONSOR_SIGNED', 'CREATOR_JOINED',
    'PLAYER_UNHAPPY', 'PLAYER_LIFTED',
  ];

  it('reaches authored content for every trigger, directly or through an alias', () => {
    const social = new Set(registry.socialTemplates().map((t) => t.trigger));
    const media = new Set(registry.mediaTemplates().map((t) => t.trigger));
    const uncovered = EMITTED.filter((trigger) => {
      const alias = TRIGGER_FALLBACKS[trigger];
      const reaches = (set: ReadonlySet<string>): boolean => set.has(trigger) || (!!alias && set.has(alias));
      return !reaches(social) && !reaches(media);
    });
    expect(uncovered).toEqual([]);
  });

  it('lets authored content carry the feed rather than the built-in fallbacks', () => {
    const { state } = buildTestWorld();
    let authored = 0;
    let builtIn = 0;
    for (let i = 0; i < 8; i++) {
      const events = [
        makeTestEvent('RED_CARD', { playerId: 'p_0_5', clubId: 'club_0', matchId: 'm1', minute: 20 + i } as never, { id: `ci_red_${i}`, importance: 4 }),
        makeTestEvent('MATCH_WON', { matchId: 'm1', clubId: 'club_0', opponentId: 'club_1', homeScore: 3, awayScore: 1, margin: 2 } as never, { id: `ci_win_${i}`, importance: 4 }),
        makeTestEvent('PLAYER_SIGNED', { playerId: 'p_1_2', clubId: 'club_0', fee: 20_000_000, wage: 80_000 } as never, { id: `ci_sign_${i}`, importance: 4 }),
      ];
      const rng = new Rng(`share-${i}`);
      const items = [
        ...generatePosts(events, state, rng, registry, { maxPosts: 40 }),
        ...generateStories(events, state, rng, registry),
      ];
      for (const item of items) {
        const id = item.tags.find((tag) => tag.startsWith('tpl:'))?.slice(4) ?? '';
        if (id.startsWith('fs_') || id.startsWith('fm_')) builtIn++; else authored++;
      }
    }
    expect(authored).toBeGreaterThan(builtIn);
  });

  it('still speaks when no pack is loaded at all', () => {
    const { state } = buildTestWorld();
    const events = [makeTestEvent('RED_CARD', { playerId: 'p_0_5', clubId: 'club_0', matchId: 'm1', minute: 30 } as never, { id: 'ci_solo', importance: 4 })];
    expect(generateStories(events, state, new Rng('solo'), null).length).toBeGreaterThan(0);
    expect(generatePosts(events, state, new Rng('solo'), null).length).toBeGreaterThan(0);
  });
});

describe('objectives against the authored templates', () => {
  it('rolls achievable objectives from the pack', async () => {
    const { rollObjectives } = await import('../progression/objectives');
    const { state } = buildTestWorld();
    const objectives = rollObjectives(state, new Rng('pack-objectives'), registry);
    expect(objectives.length).toBeGreaterThan(0);
    const season = state.seasons[state.currentSeasonId];
    const remaining = (season?.totalWeeks ?? 0) - (season?.currentWeek ?? 0);
    for (const objective of objectives) {
      expect(objective.title).not.toContain('{');
      if (objective.kind === 'WIN_MATCHES') expect(objective.target).toBeLessThanOrEqual(remaining);
    }
  });
});
