import { describe, expect, it } from 'vitest';
import { Rng, rngFrom } from '../../core/rng';
import { mean } from '../../core/math';
import { POSITIONS, positionGroup, type Position } from '../../players/positions';
import { TRAIT_BY_ID } from '../../players/traits';
import { asId, type ClubId } from '../../core/brand';
import { generatePlayer, generateSquad, positionPlan, squadCoverage } from './playerGenerator';
import { generateCreator, tierForFollowers } from './creatorGenerator';
import { clubFromTemplate, DEFAULT_FORMATION_ID } from './clubGenerator';
import { MANAGER_ARCHETYPES, PREMADE_MANAGERS, generateManager } from './managerGenerator';
import { BASE_CLUBS } from '../packs/base/clubs';
import { GENERATION_BALANCE } from '../balance';

const SAMPLES = 2000;

const correlation = (xs: readonly number[], ys: readonly number[]): number => {
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0; let dx = 0; let dy = 0;
  for (let i = 0; i < xs.length; i++) {
    const a = (xs[i] as number) - mx;
    const b = (ys[i] as number) - my;
    num += a * b; dx += a * a; dy += b * b;
  }
  return dx === 0 || dy === 0 ? 0 : num / Math.sqrt(dx * dy);
};

describe('generatePlayer distributions', () => {
  const rng = rngFrom('dist-test');
  const players = Array.from({ length: SAMPLES }, (_, i) =>
    generatePlayer(rng, {
      targetOverall: 40 + (i % 51), // sweep 40..90 so the whole range is exercised
      ageRange: [16, 36],
      idPrefix: 'dist',
      idIndex: i,
    }),
  );

  it('lands every player within the contracted tolerance of the target', () => {
    const tolerance = GENERATION_BALANCE.overallTolerance;
    for (let i = 0; i < players.length; i++) {
      const target = 40 + (i % 51);
      const player = players[i]!;
      expect(Math.abs(player.overall - target)).toBeLessThanOrEqual(tolerance);
    }
  });

  it('produces a mean overall that tracks the mean target', () => {
    const targets = players.map((_, i) => 40 + (i % 51));
    expect(mean(players.map((p) => p.overall))).toBeCloseTo(mean(targets), 0);
  });

  it('gives young players headroom and old players none', () => {
    const headroom = players.map((p) => p.potential - p.overall);
    const ages = players.map((p) => p.age);
    // Potential is age-gated, so the correlation must be clearly negative.
    expect(correlation(ages, headroom)).toBeLessThan(-0.5);

    const teenagers = players.filter((p) => p.age <= 18);
    const veterans = players.filter((p) => p.age >= 32);
    expect(teenagers.length).toBeGreaterThan(50);
    expect(veterans.length).toBeGreaterThan(50);
    expect(mean(teenagers.map((p) => p.potential - p.overall))).toBeGreaterThan(5);
    expect(mean(veterans.map((p) => p.potential - p.overall))).toBeLessThan(1.5);
    for (const veteran of veterans) {
      expect(veteran.potential - veteran.overall).toBeLessThanOrEqual(2);
    }
  });

  it('never lets potential fall below current overall', () => {
    for (const player of players) expect(player.potential).toBeGreaterThanOrEqual(player.overall);
  });

  it('keeps every attribute and mental value inside 1-99', () => {
    for (const player of players) {
      for (const value of Object.values(player.attributes)) {
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(99);
      }
      for (const value of Object.values(player.mental)) {
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(99);
      }
    }
  });

  it('respects trait position and condition constraints', () => {
    let wonderkids = 0;
    for (const player of players) {
      for (const id of player.traitIds) {
        const trait = TRAIT_BY_ID.get(id);
        expect(trait).toBeDefined();
        if (trait?.positions?.length) expect(trait.positions).toContain(player.position);
        if (trait?.conditions?.includes('YOUNG')) expect(player.age).toBeLessThanOrEqual(21);
        if (trait?.conditions?.includes('VETERAN')) expect(player.age).toBeGreaterThanOrEqual(31);
      }
      expect(new Set(player.traitIds).size).toBe(player.traitIds.length);
      expect(player.traitIds.length).toBeLessThanOrEqual(GENERATION_BALANCE.traitCount.max + 1);
      if (player.traitIds.includes('wonderkid')) wonderkids++;
    }
    // Wonderkids are meant to be rare and are gated to the young.
    expect(wonderkids).toBeGreaterThan(0);
    expect(wonderkids / SAMPLES).toBeLessThan(0.02);
  });

  it('gives most players at least one trait and nobody an empty personality', () => {
    const withTraits = players.filter((p) => p.traitIds.length > 0).length;
    expect(withTraits / SAMPLES).toBeGreaterThan(0.4);
    expect(withTraits / SAMPLES).toBeLessThan(0.98);
  });

  it('produces meaningfully varied mental profiles, including real archetypes', () => {
    const ambitiousDisloyal = players.filter((p) => p.mental.ambition > 65 && p.mental.loyalty < 35);
    const loyalUnambitious = players.filter((p) => p.mental.loyalty > 70 && p.mental.ambition < 40);
    expect(ambitiousDisloyal.length).toBeGreaterThan(20);
    expect(loyalUnambitious.length).toBeGreaterThan(20);

    // Leadership must not be a flat 50 with noise: the spread has to be wide.
    const leadership = players.map((p) => p.mental.leadership);
    expect(Math.max(...leadership) - Math.min(...leadership)).toBeGreaterThan(50);
  });

  it('populates shirt number, footedness, height and nationality plausibly', () => {
    for (const player of players) {
      expect(player.shirtNumber).not.toBeNull();
      expect(['left', 'right', 'both']).toContain(player.footedness);
      expect(player.height).toBeGreaterThanOrEqual(160);
      expect(player.height).toBeLessThanOrEqual(206);
      expect(player.nationality.length).toBeGreaterThan(0);
      expect(player.displayName.length).toBeGreaterThan(0);
      expect(player.identityKind).toBe('FICTIONAL');
    }
    const leftFooted = players.filter((p) => p.footedness === 'left').length / SAMPLES;
    expect(leftFooted).toBeGreaterThan(0.1);
    expect(leftFooted).toBeLessThan(0.5);
  });
});

describe('position identity', () => {
  it('gives each position genuinely different raw numbers, not the same player reweighted', () => {
    const rng = rngFrom('position-shape');
    const byPosition = new Map<Position, ReturnType<typeof generatePlayer>[]>();
    for (const position of POSITIONS) {
      byPosition.set(position, Array.from({ length: 120 }, (_, i) =>
        generatePlayer(rng, { targetOverall: 72, position, idPrefix: 'pos', idIndex: i })));
    }
    const avg = (position: Position, key: keyof ReturnType<typeof generatePlayer>['attributes']): number =>
      mean((byPosition.get(position) ?? []).map((p) => p.attributes[key]));

    expect(avg('CB', 'defending')).toBeGreaterThan(avg('ST', 'defending') + 25);
    expect(avg('ST', 'finishing')).toBeGreaterThan(avg('CB', 'finishing') + 30);
    expect(avg('GK', 'reflexes')).toBeGreaterThan(avg('CM', 'reflexes') + 40);
    expect(avg('LW', 'pace')).toBeGreaterThan(avg('CB', 'pace') + 10);
    expect(avg('CAM', 'vision')).toBeGreaterThan(avg('CB', 'vision') + 15);
    expect(avg('LB', 'stamina')).toBeGreaterThan(avg('ST', 'stamina') + 8);
    // And keepers must be taller than wingers.
    expect(mean((byPosition.get('GK') ?? []).map((p) => p.height)))
      .toBeGreaterThan(mean((byPosition.get('RW') ?? []).map((p) => p.height)) + 8);
  });
});

describe('generateSquad', () => {
  it('produces a valid, balanced squad with correct positional cover', () => {
    const rng = rngFrom('squad-test');
    for (let i = 0; i < 40; i++) {
      const squad = generateSquad(rng, { targetOverall: 55 + i, size: 18, idPrefix: `sq${i}` });
      expect(squad).toHaveLength(18);
      const coverage = squadCoverage(squad);
      expect(coverage.GK).toBeGreaterThanOrEqual(2);
      expect(coverage.DEF).toBeGreaterThanOrEqual(5);
      expect(coverage.MID).toBeGreaterThanOrEqual(4);
      expect(coverage.ATT).toBeGreaterThanOrEqual(3);

      // Shirt numbers are unique.
      const numbers = squad.map((p) => p.shirtNumber);
      expect(new Set(numbers).size).toBe(numbers.length);
      // Ids are unique.
      expect(new Set(squad.map((p) => p.id)).size).toBe(squad.length);
    }
  });

  it('centres the squad mean on the requested target', () => {
    const rng = rngFrom('squad-mean');
    for (const target of [48, 62, 74, 86]) {
      const means: number[] = [];
      for (let i = 0; i < 25; i++) {
        means.push(mean(generateSquad(rng, { targetOverall: target, idPrefix: `m${target}${i}` }).map((p) => p.overall)));
      }
      expect(mean(means)).toBeGreaterThan(target - 2.5);
      expect(mean(means)).toBeLessThan(target + 2.5);
    }
  });

  it('spreads ages and includes prospects and a standout', () => {
    const rng = rngFrom('squad-shape');
    let prospectTotal = 0;
    let veteranTotal = 0;
    const runs = 40;
    for (let i = 0; i < runs; i++) {
      const squad = generateSquad(rng, { targetOverall: 70, idPrefix: `sh${i}` });
      const ages = squad.map((p) => p.age);
      expect(Math.max(...ages) - Math.min(...ages)).toBeGreaterThanOrEqual(8);
      prospectTotal += squad.filter((p) => p.age <= 20).length;
      veteranTotal += squad.filter((p) => p.age >= 31).length;

      const overalls = squad.map((p) => p.overall).sort((a, b) => b - a);
      // A recognisable best player, not a flat squad.
      expect((overalls[0] as number) - mean(overalls)).toBeGreaterThan(3);
    }
    expect(prospectTotal / runs).toBeGreaterThanOrEqual(2);
    expect(veteranTotal / runs).toBeGreaterThanOrEqual(1);
  });

  it('honours the home nation bias without producing a monoculture', () => {
    const rng = rngFrom('squad-nation');
    const squad = generateSquad(rng, { targetOverall: 70, size: 18, homeNation: 'VLK', idPrefix: 'nat' });
    const home = squad.filter((p) => p.nationality === 'VLK').length;
    expect(home).toBeGreaterThan(4);
    expect(home).toBeLessThan(18);
    expect(new Set(squad.map((p) => p.nationality)).size).toBeGreaterThan(2);
  });

  it('builds a legal plan for any squad size', () => {
    for (let size = 14; size <= 26; size++) {
      const plan = positionPlan(size);
      const total = Object.values(plan).reduce((a, b) => a + b, 0);
      expect(total).toBe(size);
      expect(plan.GK).toBeGreaterThanOrEqual(2);
      for (const position of POSITIONS) expect(plan[position]).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('determinism', () => {
  it('produces identical players from identical seeds', () => {
    const a = generatePlayer(new Rng('fixed-seed'), { targetOverall: 78, idPrefix: 'd', idIndex: 1 });
    const b = generatePlayer(new Rng('fixed-seed'), { targetOverall: 78, idPrefix: 'd', idIndex: 1 });
    expect(a).toEqual(b);
  });

  it('produces identical squads from identical seeds and different ones otherwise', () => {
    const a = generateSquad(new Rng('squad-seed'), { targetOverall: 70, idPrefix: 'x' });
    const b = generateSquad(new Rng('squad-seed'), { targetOverall: 70, idPrefix: 'x' });
    const c = generateSquad(new Rng('squad-seed-2'), { targetOverall: 70, idPrefix: 'x' });
    expect(a).toEqual(b);
    expect(a.map((p) => p.displayName)).not.toEqual(c.map((p) => p.displayName));
  });

  it('produces identical creators, managers and clubs from identical seeds', () => {
    expect(generateCreator(new Rng('c'), {})).toEqual(generateCreator(new Rng('c'), {}));
    expect(generateManager(new Rng('m'), {})).toEqual(generateManager(new Rng('m'), {}));
    const id = asId<ClubId>('club_1');
    const template = BASE_CLUBS[0]!;
    expect(clubFromTemplate(new Rng('k'), template, id)).toEqual(clubFromTemplate(new Rng('k'), template, id));
  });

  it('forked streams do not disturb each other', () => {
    const root = new Rng('root');
    const first = generatePlayer(root.fork('players'), { targetOverall: 70, idPrefix: 'f', idIndex: 0 });
    root.fork('transfers').int(0, 1000); // an unrelated subsystem burning draws
    const second = generatePlayer(new Rng('root').fork('players'), { targetOverall: 70, idPrefix: 'f', idIndex: 0 });
    expect(first).toEqual(second);
  });
});

describe('generateCreator', () => {
  it('produces creators whose followers match their tier band', () => {
    const rng = rngFrom('creator-dist');
    const creators = Array.from({ length: 600 }, () => generateCreator(rng, {}));
    for (const creator of creators) {
      expect(tierForFollowers(creator.followers)).toBe(creator.tier);
      expect(creator.roles.length).toBeGreaterThan(0);
      expect(creator.bio.length).toBeGreaterThan(20);
      for (const value of Object.values(creator.attributes)) {
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(99);
      }
    }
    // Ownership and media dominate; playing creators are the exception.
    const players = creators.filter((c) => c.roles.includes('PLAYER')).length;
    const owners = creators.filter((c) => c.roles.includes('OWNER') || c.roles.includes('MANAGER')).length;
    expect(players / creators.length).toBeLessThan(0.15);
    expect(owners).toBeGreaterThan(players);
  });

  it('scales attributes with tier but leaves controversy free to vary', () => {
    const rng = rngFrom('creator-tiers');
    const local = Array.from({ length: 300 }, () => generateCreator(rng, { tier: 'LOCAL' }));
    const global = Array.from({ length: 300 }, () => generateCreator(rng, { tier: 'GLOBAL' }));
    expect(mean(global.map((c) => c.attributes.audience)))
      .toBeGreaterThan(mean(local.map((c) => c.attributes.audience)) + 20);
    // A nobody can still be toxic: controversy must not track tier.
    expect(Math.abs(
      mean(global.map((c) => c.attributes.controversy)) - mean(local.map((c) => c.attributes.controversy)),
    )).toBeLessThan(10);
  });
});

describe('clubFromTemplate', () => {
  it('derives a coherent club from every base template', () => {
    const rng = rngFrom('clubs');
    for (const [i, template] of BASE_CLUBS.entries()) {
      const club = clubFromTemplate(rng, template, asId<ClubId>(`club_${i}`));
      expect(club.name).toBe(template.name);
      expect(club.stadium.capacity).toBe(template.stadiumCapacity);
      expect(club.tactics.formationId).toBe(DEFAULT_FORMATION_ID);
      expect(club.finance.transferBudget).toBe(template.budget);
      expect(club.finance.wageBudgetPerCycle).toBeGreaterThan(0);
      expect(club.fans.base).toBeGreaterThan(template.stadiumCapacity);
      expect(club.aiProfileId).toBe(template.aiProfileId);
      expect(Object.keys(club.facilityLevels)).toHaveLength(11);
      for (const level of Object.values(club.facilityLevels)) {
        expect(level).toBeGreaterThanOrEqual(0);
        expect(level).toBeLessThanOrEqual(5);
      }
      expect(club.squad).toEqual([]);
    }
  });

  it('gives clubs of different philosophies genuinely different tactical setups', () => {
    const rng = rngFrom('club-tactics');
    const setups = BASE_CLUBS.map((t, i) => clubFromTemplate(rng, t, asId<ClubId>(`c${i}`)).tactics);
    const signatures = new Set(setups.map((t) => `${t.press}|${t.line}|${t.risk}|${t.tempo}`));
    expect(signatures.size).toBeGreaterThan(4);
  });

  it('flags the player club and strips its AI profile', () => {
    const club = clubFromTemplate(rngFrom('mine'), BASE_CLUBS[0]!, asId<ClubId>('mine'), { isPlayerClub: true });
    expect(club.isPlayerClub).toBe(true);
    expect(club.aiProfileId).toBeNull();
  });
});

describe('managers', () => {
  it('ships eight archetypes, each with real strengths and real weaknesses', () => {
    expect(MANAGER_ARCHETYPES).toHaveLength(8);
    for (const archetype of MANAGER_ARCHETYPES) {
      const values = Object.values(archetype.modifiers);
      expect(values.some((v) => v > 0)).toBe(true);
      expect(values.some((v) => v < 0)).toBe(true);
      expect(archetype.strength.length).toBeGreaterThan(10);
      expect(archetype.weakness.length).toBeGreaterThan(10);
      // Zero-sum: no archetype is a strictly better pick than another.
      expect(Math.abs(values.reduce((a, b) => a + b, 0))).toBeLessThanOrEqual(2);
    }
  });

  it('ships ten selectable pre-made managers covering every archetype', () => {
    expect(PREMADE_MANAGERS).toHaveLength(10);
    const ids = new Set(MANAGER_ARCHETYPES.map((a) => a.id));
    const used = new Set(PREMADE_MANAGERS.map((m) => m.archetypeId));
    for (const id of used) expect(ids.has(id)).toBe(true);
    expect(used.size).toBe(8);
    for (const manager of PREMADE_MANAGERS) {
      expect(manager.selectable).toBe(true);
      expect(manager.bio.length).toBeGreaterThan(60);
    }
  });

  it('expresses the archetype in the generated attributes', () => {
    const rng = rngFrom('managers');
    const showmen = Array.from({ length: 200 }, () => generateManager(rng, { archetypeId: 'showman' }));
    const tacticians = Array.from({ length: 200 }, () => generateManager(rng, { archetypeId: 'tactician' }));
    expect(mean(showmen.map((m) => m.attributes.brandBuilding)))
      .toBeGreaterThan(mean(tacticians.map((m) => m.attributes.brandBuilding)) + 25);
    expect(mean(tacticians.map((m) => m.attributes.tacticalKnowledge)))
      .toBeGreaterThan(mean(showmen.map((m) => m.attributes.tacticalKnowledge)) + 25);
    expect(mean(showmen.map((m) => m.attributes.discipline)))
      .toBeLessThan(mean(tacticians.map((m) => m.attributes.discipline)));
  });

  it('builds a manager from a pre-made template without losing the person', () => {
    const template = PREMADE_MANAGERS[0]!;
    const manager = generateManager(rngFrom('premade'), { template });
    expect(manager.name).toBe(template.name);
    expect(manager.archetypeId).toBe(template.archetypeId);
    expect(manager.bio).toBe(template.bio);
    expect(manager.appearance.outfit).toBe(template.appearance?.outfit);
    for (const value of Object.values(manager.attributes)) {
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(99);
    }
  });
});

describe('position grouping sanity', () => {
  it('maps every position to a group', () => {
    for (const position of POSITIONS) {
      expect(['GK', 'DEF', 'MID', 'ATT']).toContain(positionGroup(position));
    }
  });
});
