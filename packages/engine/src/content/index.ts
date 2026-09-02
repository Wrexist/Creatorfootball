/**
 * Public surface of the content workstream.
 *
 * The engine's root `index.ts` is owned elsewhere and currently re-exports only
 * `content/schema`. This barrel is the one place other workstreams need to
 * import from to get the base universe, the registry and the generators.
 */

export * from './schema';
export * from './loader';
export * from './validate';
export * from './balance';
export * from './seasonConfig';

/**
 * The packs themselves are deliberately NOT re-exported here.
 *
 * `packs/base` is the game's largest static payload and is only ever read to
 * build a world. Anything that imports it at module scope drags it into the
 * engine's own bundle and, worse, closes a cycle (the pack imports engine
 * modules for its types and constants) that a bundler cannot order. So the
 * pack is reached by exactly one path — `content/packs/base` — and only by
 * code that means to load it: the app's content loader, the headless
 * harness, and tests. The engine receives content through a
 * `ContentRegistry` handed to it, never by importing a pack.
 */
export type { AiProfileId } from './packs/base/clubs';
export type { FacilityEffectKey } from './packs/base/facilities';

export * from './generators/profiles';
export * from './generators/playerGenerator';
export * from './generators/creatorGenerator';
export * from './generators/clubGenerator';
export * from './generators/managerGenerator';
