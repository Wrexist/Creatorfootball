import { describe, expect, it } from 'vitest';
import { ContentRegistry } from './loader';
import type { ContentPack } from './schema';
import { BASE_PACK } from './packs/base';
import { COMMUNITY_EXAMPLE_PACK } from './packs/community/example';
import {
  LICENSED_EXAMPLE_PACK, LICENSED_EXAMPLE_PACK_EXPIRED, LICENSED_EXAMPLE_EXPIRES_AT,
} from './packs/licensed/example';

const BEFORE_EXPIRY = LICENSED_EXAMPLE_EXPIRES_AT - 86_400_000;
const AFTER_EXPIRY = LICENSED_EXAMPLE_EXPIRES_AT + 86_400_000;

const loaded = (...packs: ContentPack[]): ContentRegistry => {
  const registry = new ContentRegistry();
  for (const pack of packs) registry.load(pack);
  return registry;
};

describe('ContentRegistry', () => {
  it('loads the base pack without errors and exposes everything in it', () => {
    const registry = new ContentRegistry();
    const issues = registry.load(BASE_PACK);
    expect(issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(registry.clubs()).toHaveLength(12);
    expect(registry.creators()).toHaveLength(28);
    expect(registry.facilities()).toHaveLength(11);
    expect(registry.seasonConfig().clubCount).toBe(12);
  });

  it('is idempotent: loading the same pack twice does not duplicate anything', () => {
    const registry = loaded(BASE_PACK);
    const before = {
      packs: registry.packs().length,
      clubs: registry.clubs().length,
      names: registry.nameBank().firstNames.length,
      commentary: registry.commentary().length,
    };
    registry.load(BASE_PACK);
    registry.load(BASE_PACK);
    expect(registry.packs()).toHaveLength(before.packs);
    expect(registry.clubs()).toHaveLength(before.clubs);
    expect(registry.nameBank().firstNames).toHaveLength(before.names);
    expect(registry.commentary()).toHaveLength(before.commentary);
  });

  it('refuses to load a pack whose dependency is missing', () => {
    const registry = new ContentRegistry();
    const issues = registry.load(COMMUNITY_EXAMPLE_PACK);
    expect(issues.some((i) => i.severity === 'error' && i.message.includes('requires "base"'))).toBe(true);
    expect(registry.packs()).toHaveLength(0);
    expect(registry.clubs()).toHaveLength(0);
  });

  it('layers a community pack on top of the base pack', () => {
    const registry = loaded(BASE_PACK, COMMUNITY_EXAMPLE_PACK);
    expect(registry.packs().map((p) => p.id)).toEqual(['base', 'community.threetowns']);
    expect(registry.clubs()).toHaveLength(15);
    expect(registry.creators()).toHaveLength(32);
    // The name bank is merged, not replaced.
    expect(registry.nameBank().cities).toContain('Ironhollow');
    expect(registry.nameBank().cities).toContain('Blackmoor Cross');
    expect(registry.nameBank().nationalities.some((n) => n.code === 'MRV')).toBe(true);
  });

  it('resolves overrides: a later pack replaces an entity with the same id', () => {
    const override: ContentPack = {
      manifest: {
        ...COMMUNITY_EXAMPLE_PACK.manifest,
        id: 'community.reskin',
        overrides: ['club_cinderwick_town'],
      },
      data: {
        clubs: [{
          ...BASE_PACK.data.clubs![11]!,
          name: 'Cinderwick Athletic Society',
          strength: 61,
        }],
      },
    };
    const registry = loaded(BASE_PACK, override);
    // Replaced, not appended.
    expect(registry.clubs()).toHaveLength(12);
    const club = registry.clubById('club_cinderwick_town');
    expect(club?.name).toBe('Cinderwick Athletic Society');
    expect(club?.strength).toBe(61);
  });

  it('warns when an override target does not exist', () => {
    const stray: ContentPack = {
      manifest: { ...COMMUNITY_EXAMPLE_PACK.manifest, id: 'community.stray', overrides: ['club_nowhere'] },
      data: {},
    };
    const registry = loaded(BASE_PACK);
    const issues = registry.load(stray);
    expect(issues.some((i) => i.severity === 'warning' && i.path === 'manifest.overrides')).toBe(true);
    expect(registry.has('community.stray')).toBe(true);
  });

  it('unloading restores the previous view without corrupting state', () => {
    const registry = loaded(BASE_PACK, COMMUNITY_EXAMPLE_PACK);
    expect(registry.clubs()).toHaveLength(15);

    registry.unload('community.threetowns');
    expect(registry.packs().map((p) => p.id)).toEqual(['base']);
    expect(registry.clubs()).toHaveLength(12);
    expect(registry.creators()).toHaveLength(28);
    expect(registry.clubById('club_blackmoor_colliery')).toBeUndefined();
    expect(registry.clubById('club_ironhollow_forge')).toBeDefined();

    // And it can be loaded again cleanly.
    registry.load(COMMUNITY_EXAMPLE_PACK);
    expect(registry.clubs()).toHaveLength(15);

    // Unloading something that was never loaded is a no-op, not a crash.
    registry.unload('does.not.exist');
    expect(registry.clubs()).toHaveLength(15);
  });

  it('unloading the base pack leaves a coherent, empty-ish registry', () => {
    const registry = loaded(BASE_PACK, COMMUNITY_EXAMPLE_PACK);
    registry.unload('base');
    expect(registry.clubs()).toHaveLength(3);
    expect(registry.commentary()).toHaveLength(0);
    expect(registry.nameBank().firstNames.length).toBeGreaterThan(0);
    expect(registry.seasonConfig().clubCount).toBeGreaterThan(0);
  });
});

describe('rights gating via visibleFor', () => {
  it('shows a live licensed pack inside its licensed region', () => {
    const registry = loaded(BASE_PACK, LICENSED_EXAMPLE_PACK);
    const view = registry.visibleFor('GB', BEFORE_EXPIRY);
    expect(view.packs().map((p) => p.id)).toContain('licensed.example');
    expect(view.creators().some((c) => c.id === 'licensed_creator_placeholder_a')).toBe(true);
  });

  it('hides a licensed pack whose rights have expired', () => {
    const registry = loaded(BASE_PACK, LICENSED_EXAMPLE_PACK);
    const view = registry.visibleFor('GB', AFTER_EXPIRY);
    expect(view.packs().map((p) => p.id)).not.toContain('licensed.example');
    expect(view.creators().some((c) => c.id === 'licensed_creator_placeholder_a')).toBe(false);
    // The base pack is untouched by the expiry.
    expect(view.clubs()).toHaveLength(12);
    expect(view.creators()).toHaveLength(28);
  });

  it('hides a licensed pack outside its licensed region', () => {
    const registry = loaded(BASE_PACK, LICENSED_EXAMPLE_PACK);
    const view = registry.visibleFor('DE', BEFORE_EXPIRY);
    expect(view.creators().some((c) => c.id === 'licensed_creator_placeholder_a')).toBe(false);
  });

  it('hides a pack whose licence has already lapsed at any time we check', () => {
    const registry = loaded(BASE_PACK, LICENSED_EXAMPLE_PACK_EXPIRED);
    const view = registry.visibleFor('GB', BEFORE_EXPIRY);
    expect(view.packs().map((p) => p.id)).not.toContain('licensed.example.expired');
  });

  it('never filters fictional content', () => {
    const registry = loaded(BASE_PACK, COMMUNITY_EXAMPLE_PACK);
    const view = registry.visibleFor('JP', AFTER_EXPIRY);
    expect(view.clubs()).toHaveLength(15);
    expect(view.creators()).toHaveLength(32);
  });

  it('does not mutate the source registry', () => {
    const registry = loaded(BASE_PACK, LICENSED_EXAMPLE_PACK);
    registry.visibleFor('DE', AFTER_EXPIRY);
    expect(registry.packs()).toHaveLength(2);
    expect(registry.creators().some((c) => c.id === 'licensed_creator_placeholder_a')).toBe(true);
  });

  it('drops a pack whose dependency was filtered out', () => {
    const dependent: ContentPack = {
      manifest: {
        ...COMMUNITY_EXAMPLE_PACK.manifest,
        id: 'community.dependsonlicensed',
        requires: ['base', 'licensed.example'],
      },
      data: { clubs: COMMUNITY_EXAMPLE_PACK.data.clubs },
    };
    const registry = loaded(BASE_PACK, LICENSED_EXAMPLE_PACK, dependent);
    expect(registry.packs()).toHaveLength(3);

    const view = registry.visibleFor('GB', AFTER_EXPIRY);
    const ids = view.packs().map((p) => p.id);
    expect(ids).not.toContain('licensed.example');
    expect(ids).not.toContain('community.dependsonlicensed');
    expect(ids).toContain('base');
  });
});
