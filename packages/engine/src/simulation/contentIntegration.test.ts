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
import { CASCADE_RULE_TYPES, expandCascade } from './cascade';
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
  /**
   * Every trigger the cascade can emit, derived from the cascade itself rather
   * than hand-maintained.
   *
   * The previous version of this list was a literal array inside this file. It
   * was green while 85% of the authored library was unreachable, because a
   * hand-written list of what the code emits proves only that somebody wrote a
   * list. This walks the rules instead: one synthetic event of every declared
   * domain type, through `expandCascade`, collecting the triggers that come out.
   */
  const CLUB = 'club_0';
  const RIVAL = 'club_1';
  const PLAYER = 'p_0_5';
  /** One representative payload per rule, so the rule can actually run. */
  const SAMPLE: Partial<Record<string, Record<string, unknown>>> = {
    RED_CARD: { playerId: PLAYER, clubId: CLUB, matchId: 'm1', minute: 30 },
    PLAYER_MORALE_CHANGED: { playerId: PLAYER, clubId: CLUB, from: 60, to: 40, reason: 'dropped' },
    FAN_SENTIMENT_CHANGED: { clubId: CLUB, from: 60, to: 40, reason: 'a bad month' },
    RIVALRY_INTENSIFIED: { rivalryId: 'r1', clubA: CLUB, clubB: RIVAL, intensity: 8, reason: 'a bad night' },
    PLAYER_SIGNED: { playerId: PLAYER, clubId: CLUB, fee: 20_000_000, wage: 80_000 },
    MATCH_LOST: { matchId: 'm1', clubId: CLUB, opponentId: RIVAL, homeScore: 0, awayScore: 4, margin: 4 },
    MATCH_WON: { matchId: 'm1', clubId: CLUB, opponentId: RIVAL, homeScore: 4, awayScore: 0, margin: 4 },
    MATCH_DRAWN: { matchId: 'm1', clubId: CLUB, opponentId: RIVAL, score: 1 },
    PLAYER_BREAKOUT: { playerId: PLAYER, clubId: CLUB, overall: 74 },
    PLAYER_INJURED: { playerId: PLAYER, clubId: CLUB, weeksOut: 8, severity: 'SERIOUS' },
    PLAYER_RECOVERED: { playerId: PLAYER, clubId: CLUB },
    PLAYER_RELEASED: { playerId: PLAYER, clubId: CLUB },
    PLAYER_SOLD: { playerId: PLAYER, fromClubId: CLUB, toClubId: RIVAL, fee: 9_000_000 },
    PLAYER_DEVELOPED: { playerId: PLAYER, clubId: CLUB, attribute: 'finishing', from: 60, to: 63 },
    RECORD_BROKEN: { clubId: CLUB, record: 'Most goals in a season', value: 24, holderId: PLAYER },
    TRANSFER_HIJACKED: { playerId: PLAYER, byClubId: RIVAL, fromClubId: CLUB },
    TRANSFER_COMPLETED: { transferId: 't1', playerId: PLAYER, fromClubId: RIVAL, toClubId: CLUB, fee: 4_000_000 },
    TRANSFER_BID_MADE: { transferId: 't1', playerId: PLAYER, fromClubId: RIVAL, toClubId: CLUB, amount: 4_000_000 },
    TRANSFER_BID_REJECTED: { transferId: 't1', playerId: PLAYER, reason: 'nowhere near' },
    GOAL_SCORED: { matchId: 'm1', clubId: CLUB, scorerId: PLAYER, minute: 28, homeScore: 1, awayScore: 0 },
    TROPHY_WON: { clubId: CLUB, competition: 'The Creator Cup', season: 1 },
    MANAGER_SACKED: { clubId: CLUB, managerName: 'A. Manager' },
    SPONSOR_SIGNED: { clubId: CLUB, sponsorId: 'spn_1', value: 400_000 },
    SPONSOR_LOST: { clubId: CLUB, sponsorId: 'spn_1', reason: 'performance clause' },
    CREATOR_JOINED: { creatorId: 'cr_0', clubId: CLUB, role: 'AMBASSADOR' },
    CREATOR_MOMENT: { creatorId: 'cr_0', clubId: CLUB, kind: 'clip', reach: 2_000_000 },
    MOTM_AWARDED: { playerId: PLAYER, clubId: CLUB, matchId: 'm1', rating: 8.4 },
    CONTRACT_SIGNED: { contractId: 'ct1', playerId: PLAYER, clubId: CLUB, years: 3, wage: 30_000 },
    CONTRACT_EXPIRING: { playerId: PLAYER, clubId: CLUB, weeksLeft: 12 },
    FACILITY_UPGRADED: { clubId: CLUB, facilityId: 'academy', level: 3 },
    ATTENDANCE_RECORDED: { clubId: CLUB, matchId: 'm1', attendance: 10_000, capacity: 10_000 },
    SEASON_STARTED: { seasonId: 'season_1', season: 2 },
    SEASON_COMPLETED: { seasonId: 'season_1', season: 1, championClubId: RIVAL, playerPosition: 9 },
    YOUTH_PROSPECT_PROMOTED: { playerId: PLAYER, clubId: CLUB },
    OBJECTIVE_COMPLETED: { objectiveId: 'o1', title: 'Shut the door', rewardSummary: '£50,000' },
    OBJECTIVE_FAILED: { objectiveId: 'o1', title: 'Shut the door' },
    REPUTATION_CHANGED: { clubId: CLUB, from: 50, to: 54, reason: 'results' },
    BALANCE_LOW: { clubId: CLUB, balance: 40_000 },
    RIVALRY_CREATED: { rivalryId: 'r2', clubA: CLUB, clubB: RIVAL },
    SCOUT_REPORT_READY: { playerId: PLAYER, clubId: CLUB, confidence: 0.8 },
    MATCH_SCHEDULED: { matchId: 'm2', homeClubId: CLUB, awayClubId: RIVAL, week: 4 },
  };

  const emittedTriggers = (): string[] => {
    const { state } = buildTestWorld();
    const triggers = new Set<string>();
    let n = 0;
    for (const type of CASCADE_RULE_TYPES) {
      const payload = SAMPLE[type];
      if (!payload) continue;
      const event = makeTestEvent(type, payload as never, { id: `tv_${(n += 1)}`, importance: 4 });
      const result = expandCascade([event], state, { cycle: state.clock.cycle, skipFollowUps: true });
      for (const hook of [...result.mediaHooks, ...result.socialHooks]) triggers.add(hook.trigger);
    }
    return [...triggers].sort();
  };

  it('has a sample payload for every rule the cascade declares', () => {
    expect(CASCADE_RULE_TYPES.filter((type) => !SAMPLE[type])).toEqual([]);
  });

  it('turns most of the declared event vocabulary into content', () => {
    // A few types belong to the match engine and cannot be produced here, but
    // the bulk must be, or the authored library cannot be reached at all.
    expect(CASCADE_RULE_TYPES.length).toBeGreaterThanOrEqual(30);
    expect(emittedTriggers().length).toBeGreaterThanOrEqual(24);
  });

  it('reaches authored content for every trigger the cascade actually emits', () => {
    const social = new Set(registry.socialTemplates().map((t) => t.trigger));
    const media = new Set(registry.mediaTemplates().map((t) => t.trigger));
    const uncovered = emittedTriggers().filter((trigger) => {
      const alias = TRIGGER_FALLBACKS[trigger];
      const reaches = (set: ReadonlySet<string>): boolean => set.has(trigger) || (!!alias && set.has(alias));
      return !reaches(social) && !reaches(media);
    });
    expect(uncovered).toEqual([]);
  });

  /** Semantic trigger names the cascade uses that are not domain event types. */
  const LEGACY_TRIGGERS = [
    'SUSPENSION_AFTERMATH', 'MARQUEE_SIGNING', 'SIGNING', 'DEBUT_WATCH',
    'SHOCK_DEFEAT', 'DEFEAT', 'DERBY_DEFEAT', 'DEFEAT_FALLOUT', 'WIN', 'STATEMENT_WIN', 'DERBY_WIN',
    'GOAL', 'SPECIAL_GOAL', 'WONDERKID', 'BREAKOUT_INTEREST', 'INJURY_BLOW',
    'RECORD_REACTION', 'FAN_UNREST', 'FAN_BUZZ', 'RIVALRY_HEAT', 'TRANSFER_HIJACK',
    'TROPHY_AFTERGLOW', 'PLAYER_UNHAPPY', 'PLAYER_LIFTED',
  ];

  it('reaches authored content for every semantic trigger name too', () => {
    const social = new Set(registry.socialTemplates().map((t) => t.trigger));
    const media = new Set(registry.mediaTemplates().map((t) => t.trigger));
    const uncovered = LEGACY_TRIGGERS.filter((trigger) => {
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
