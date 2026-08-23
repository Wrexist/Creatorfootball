import { describe, expect, it } from 'vitest';
import { BASE_PACK, ContentRegistry } from '../content';
import { asId, type CreatorId } from '../core/brand';
import { Rng } from '../core/rng';
import { Ledger } from '../economy/ledger';
import { generateCreator } from '../content/generators/creatorGenerator';
import { CREATOR_BALANCE } from '../creators/balance';
import { TIER_REACH, type Creator } from '../creators/creator';
import { createNewGame } from './newGame';
import { GameEventFactory } from './eventFactory';
import { rolloverSeason } from './seasonRollover';

/**
 * The creator scene has to keep breathing across seasons.
 *
 * Until now every pundit and personality in the world was frozen at save
 * creation while players regenerated yearly underneath them. These tests pin
 * the life-cycle: new faces arrive every summer, and small local accounts whose
 * moment has passed leave it — through real domain events, like everything
 * else the world does.
 */

const registry = (() => {
  const r = new ContentRegistry();
  r.load(BASE_PACK);
  return r;
})();

const AT = 1_700_000_000_000;

const freshState = () => createNewGame({
  seed: 'creator-lifecycle',
  now: AT,
  manager: {
    kind: 'CUSTOM',
    name: 'Rowan Vance',
    archetypeId: 'tactician',
    mediaStyle: 'HONEST',
    socialPersonality: 'ACTIVE',
    appearance: {
      skinTone: 2, hairStyle: 'short', hairColor: 'brown', facialHair: 'none',
      outfit: 'tracksuit', accessory: 'none', accentColor: '#c8ff2e',
    },
  },
  club: {
    kind: 'CUSTOM',
    name: 'Lifecycle FC',
    shortName: 'Lifecycle',
    abbreviation: 'LFC',
    city: 'Redmere',
    philosophy: 'CREATOR_FIRST',
    fanCulture: 'ONLINE_NATIVE',
    visual: {
      primary: '#c8ff2e', secondary: '#08090b', accent: '#ffffff',
      badgeShape: 'CIRCLE', badgeMotif: 'STAR', style: 'MODERN', kitPattern: 'SOLID',
    },
    motto: 'Keep moving.',
  },
});

/** Inject a creator as if the life-cycle itself had produced it. */
const plantCreator = (
  state: ReturnType<typeof freshState>,
  partial: { id: string; tier: 'LOCAL'; followers: number; spawnedSeason?: number },
): ReturnType<typeof freshState> => {
  const base = generateCreator(new Rng(`plant:${partial.id}`), {
    id: asId<CreatorId>(partial.id),
    tier: partial.tier,
    followers: partial.followers,
    handle: partial.id.replace(/_/g, ''),
    displayName: partial.id.split('_').map((w) => w[0]!.toUpperCase() + w.slice(1)).join(' '),
    bio: 'Planted for the test. Gone soon enough.',
  });
  const creator = (
    partial.spawnedSeason === undefined ? base : { ...base, spawnedSeason: partial.spawnedSeason }
  ) as Creator;
  const [floor] = TIER_REACH.LOCAL;
  expect(creator.followers).toBeGreaterThanOrEqual(floor);
  return { ...state, creators: { ...state.creators, [creator.id]: creator } };
};

describe('the creator life-cycle at season rollover', () => {
  const span = CREATOR_BALANCE.lifecycle.localSpanSeasons;

  it('spawns between two and four generated creators every summer', () => {
    const state = freshState();
    const before = Object.keys(state.creators).length;
    const result = rolloverSeason(
      state, new Rng('spawn'), new Ledger(), new GameEventFactory(state, AT),
      { now: AT, registry },
    );
    const arrivals = Object.values(result.state.creators)
      .filter((c) => c.spawnedSeason === state.clock.season + 1);
    expect(arrivals.length).toBeGreaterThanOrEqual(CREATOR_BALANCE.lifecycle.spawnsMin);
    expect(arrivals.length).toBeLessThanOrEqual(CREATOR_BALANCE.lifecycle.spawnsMax);
    expect(Object.keys(result.state.creators).length).toBe(before + arrivals.length);
    for (const arrival of arrivals) {
      expect(arrival.handle.length).toBeGreaterThan(0);
      expect(arrival.displayName.length).toBeGreaterThan(0);
      expect(arrival.bio.length).toBeGreaterThan(0);
      // Fresh voices start small: never attached to a club mid-save, never
      // wearing a player label without a player behind it.
      expect(arrival.clubId).toBeNull();
      expect(arrival.roles).not.toContain('PLAYER');
    }
  });

  it('announces arrivals and departures through the event bus', () => {
    let state = freshState();
    state = plantCreator(state, {
      id: 'gc_expired', tier: 'LOCAL', followers: 9_000,
      spawnedSeason: state.clock.season - span,
    });
    const result = rolloverSeason(
      state, new Rng('events'), new Ledger(), new GameEventFactory(state, AT),
      { now: AT, registry },
    );
    const emerged = result.events.filter((e) => e.type === 'CREATOR_EMERGED');
    const retired = result.events.filter((e) => e.type === 'CREATOR_RETIRED');
    const arrivals = Object.values(result.state.creators)
      .filter((c) => c.spawnedSeason === state.clock.season + 1);
    expect(emerged).toHaveLength(arrivals.length);
    for (const e of emerged) {
      expect(result.state.creators[(e.payload as { creatorId: string }).creatorId]).toBeDefined();
    }
    expect(retired).toHaveLength(1);
    expect((retired[0]!.payload as { creatorId: string }).creatorId).toBe('gc_expired');
    expect(result.state.creators.gc_expired).toBeUndefined();
  });

  it('retires only spent generated locals — never the authored roster', () => {
    let state = freshState();
    const authoredLocal = Object.values(state.creators).find((c) => c.tier === 'LOCAL');
    expect(authoredLocal).toBeDefined();
    state = plantCreator(state, {
      id: 'gc_spent_small', tier: 'LOCAL', followers: 6_000,
      spawnedSeason: state.clock.season - span,
    });
    state = plantCreator(state, {
      id: 'gc_still_fresh', tier: 'LOCAL', followers: 48_000,
      // Arrived a summer later than the spent one, so it is still inside its span.
      spawnedSeason: state.clock.season - span + 2,
    });
    const result = rolloverSeason(
      state, new Rng('selective'), new Ledger(), new GameEventFactory(state, AT),
      { now: AT, registry },
    );
    expect(result.state.creators.gc_spent_small).toBeUndefined();
    expect(result.state.creators.gc_still_fresh).toBeDefined();
    expect(authoredLocal && result.state.creators[authoredLocal.id]).toBeDefined();
  });

  it('spends the smallest accounts first when several expire together', () => {
    let state = freshState();
    state = plantCreator(state, {
      id: 'gc_big_spent', tier: 'LOCAL', followers: 49_000,
      spawnedSeason: state.clock.season - span,
    });
    state = plantCreator(state, {
      id: 'gc_small_spent', tier: 'LOCAL', followers: 5_500,
      spawnedSeason: state.clock.season - span,
    });
    const result = rolloverSeason(
      state, new Rng('order'), new Ledger(), new GameEventFactory(state, AT),
      { now: AT, registry },
    );
    const retiredIds = result.events
      .filter((e) => e.type === 'CREATOR_RETIRED')
      .map((e) => (e.payload as { creatorId: string }).creatorId);
    expect(retiredIds).toEqual(['gc_small_spent', 'gc_big_spent']);
  });

  it('is deterministic for a given seed', () => {
    const run = (): string[] => {
      const state = freshState();
      const result = rolloverSeason(
        state, new Rng('determinism'), new Ledger(), new GameEventFactory(state, AT),
        { now: AT, registry },
      );
      return Object.values(result.state.creators)
        .filter((c) => c.spawnedSeason === state.clock.season + 1)
        .flatMap((c) => [c.id, c.handle, String(c.followers)])
        .sort();
    };
    expect(run()).toEqual(run());
  });

  it('leaves a save alone outside the rollover path', () => {
    // The life-cycle is wired to summer only; spawning must not leak into
    // ordinary generation.
    const state = freshState();
    const seeded = Object.values(state.creators).every((c) => c.spawnedSeason === undefined);
    expect(seeded).toBe(true);
  });
});
