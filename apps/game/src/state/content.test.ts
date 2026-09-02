import { afterEach, describe, expect, it } from 'vitest';
import { createNewGame, type ContentPack } from '@cf/engine';
import {
  ContentError, content, createContentLoader, importBasePack, packChunkUrl, playerMessageFor, retryUrl,
  type BasePackModule,
} from './content';

/**
 * The content loader.
 *
 * One request loads the pack; everybody else waits for the same result. The
 * promise resolves only once the pack has been validated and is in a
 * registry, never before; a failed load is a recoverable state, not a stuck
 * one; and the engine's own arithmetic cannot tell a pack that arrived late
 * from one that was there all along.
 */

const realModule = (): Promise<BasePackModule> => import('@cf/engine/content/packs/base/index');

interface Deferred {
  readonly promise: Promise<BasePackModule>;
  resolve: (module: BasePackModule) => void;
  reject: (error: unknown) => void;
}
const deferred = (): Deferred => {
  let resolve!: Deferred['resolve'];
  let reject!: Deferred['reject'];
  const promise = new Promise<BasePackModule>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

/** A pack that imports fine and fails validation: a player pointing at a club that does not exist. */
const brokenModule = async (): Promise<BasePackModule> => {
  const real = await realModule();
  const pack: ContentPack = {
    ...real.BASE_PACK,
    data: {
      ...real.BASE_PACK.data,
      players: (real.BASE_PACK.data.players ?? []).map((p, i) => (i === 0 ? { ...p, clubTemplateId: 'club_does_not_exist' } : p)),
    },
  };
  return { ...real, BASE_PACK: pack };
};

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => content.reset());

describe('content loader', () => {
  it('shares one load between every consumer that asks while it is in flight', async () => {
    let imports = 0;
    const gate = deferred();
    const loader = createContentLoader(() => { imports += 1; return gate.promise; });

    const a = loader.load();
    const b = loader.load();
    loader.prefetch();
    const c = loader.load();
    expect(imports).toBe(1);
    expect(loader.store.getState().status).toBe('LOADING');
    // Nothing is handed out early: there is no partial registry to read.
    expect(loader.ready()).toBeNull();
    expect(() => loader.registry()).toThrow(/content/i);

    gate.resolve(await realModule());
    const [ra, rb, rc] = await Promise.all([a, b, c]);
    expect(imports).toBe(1);
    expect(ra).toBe(rb);
    expect(rb).toBe(rc);
    expect(ra.registry.has('base')).toBe(true);
    expect(ra.registry.clubs()).toHaveLength(12);
    expect(loader.store.getState().status).toBe('READY');
  });

  it('is reused after the first load: no second import, the same registry', async () => {
    let imports = 0;
    const loader = createContentLoader(() => { imports += 1; return realModule(); });
    const first = await loader.load();
    const again = await loader.load();
    loader.prefetch();
    expect(imports).toBe(1);
    expect(again).toBe(first);
    expect(loader.ready()).toBe(first);
    expect(loader.registry()).toBe(first.registry);
  });

  it('resolves only once the pack has been validated and loaded', async () => {
    const seen: string[] = [];
    const loader = createContentLoader(realModule);
    loader.store.subscribe((s) => { seen.push(s.status); });
    const loaded = await loader.load();
    // The promise never resolves with an empty registry.
    expect(loaded.registry.packs().map((m) => m.id)).toEqual(['base']);
    expect(seen).toEqual(['LOADING', 'READY']);
  });

  it('a failed import is a recoverable failure, and the next request retries', async () => {
    let attempt = 0;
    const loader = createContentLoader(async () => {
      attempt += 1;
      if (attempt === 1) throw new TypeError('Failed to fetch dynamically imported module');
      return realModule();
    });

    await expect(loader.load()).rejects.toBeInstanceOf(ContentError);
    const state = loader.store.getState();
    expect(state.status).toBe('FAILED');
    expect(state.failure?.kind).toBe('UNAVAILABLE');
    expect(loader.ready()).toBeNull();
    expect(() => loader.registry()).toThrow();
    // The player hears football, not the bundler.
    expect(playerMessageFor(state.failure)).not.toMatch(/chunk|module|import|fetch|bundle/i);
    expect(playerMessageFor(state.failure)).toMatch(/connection/i);

    const loaded = await loader.load();
    expect(attempt).toBe(2);
    expect(loaded.registry.has('base')).toBe(true);
    expect(loader.store.getState().status).toBe('READY');
  });

  it('a pack that fails validation is refused: no registry, a useful error, still retryable', async () => {
    let attempt = 0;
    const loader = createContentLoader(() => { attempt += 1; return attempt === 1 ? brokenModule() : realModule(); });

    const failure = await loader.load().catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(ContentError);
    const error = failure as ContentError;
    expect(error.kind).toBe('INVALID');
    expect(error.issues.length).toBeGreaterThan(0);
    expect(error.issues.some((i) => /club_does_not_exist/.test(i.message))).toBe(true);
    expect(loader.ready()).toBeNull();
    expect(loader.store.getState().status).toBe('FAILED');
    expect(playerMessageFor(error)).not.toMatch(/validation|schema|reference|pack/i);

    await expect(loader.load()).resolves.toMatchObject({ registry: expect.anything() });
  });

  it('prefetch never produces an unhandled rejection', async () => {
    const loader = createContentLoader(async () => { throw new Error('offline'); });
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown): void => { unhandled.push(reason); };
    process.on('unhandledRejection', onUnhandled);
    try {
      loader.prefetch();
      await tick();
      await tick();
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
    expect(unhandled).toHaveLength(0);
    expect(loader.store.getState().status).toBe('FAILED');
  });

  it('a late resolution after the flow moved on cannot change what a consumer already has', async () => {
    // Two independent loaders stand in for "the flow the player abandoned" and
    // "the flow they are in now". The first resolving late touches nothing of
    // the second's: no shared registry, no shared status.
    const abandoned = deferred();
    const old = createContentLoader(() => abandoned.promise);
    const current = createContentLoader(realModule);
    const oldLoad = old.load().catch(() => null);
    const now = await current.load();
    abandoned.resolve(await brokenModule());
    await oldLoad;
    expect(current.ready()).toBe(now);
    expect(current.store.getState().status).toBe('READY');
    expect(old.store.getState().status).toBe('FAILED');
  });

  it('loading timing cannot change the world that gets built', async () => {
    const immediate = createContentLoader(realModule);
    const slow = createContentLoader(async () => {
      await new Promise((resolve) => setTimeout(resolve, 25));
      return realModule();
    });
    const [a, b] = await Promise.all([immediate.load(), slow.load()]);
    const build = (registry: typeof a.registry) => createNewGame({
      registry,
      seed: 'timing',
      now: 1_700_000_000_000,
      manager: { kind: 'PREMADE', templateId: 'manager_vera_lindqvist' },
      club: { kind: 'TEMPLATE', templateId: 'club_cinderwick_town' },
    });
    expect(JSON.stringify(build(a.registry))).toBe(JSON.stringify(build(b.registry)));
  });

  it('the app loader really loads the base universe through the lazy path', async () => {
    const loaded = await content.load();
    expect(loaded.registry.clubs().map((c) => c.id)).toContain('club_cinderwick_town');
    expect(loaded.registry.managers().length).toBeGreaterThan(0);
    expect(Object.keys(loaded.lore).length).toBeGreaterThan(0);
    expect(loaded.packs.map((p) => p.manifest.id)).toEqual(['base']);
  });
});

describe('retrying for real', () => {
  it('asks the importer for a fresh attempt each time, telling it what failed before', async () => {
    const calls: [number, unknown][] = [];
    const loader = createContentLoader(async (attempt, previous) => {
      calls.push([attempt, previous]);
      if (attempt < 2) throw new TypeError(`Failed to fetch dynamically imported module: http://x/assets/content-abc.js (${attempt})`);
      return realModule();
    });
    await loader.load().catch(() => null);
    await loader.load().catch(() => null);
    expect(loader.failures()).toBe(2);
    await loader.load();
    expect(loader.failures()).toBe(2);
    expect(calls.map(([a]) => a)).toEqual([0, 1, 2]);
    expect(calls[0]?.[1]).toBeNull();
    expect(String(calls[1]?.[1])).toMatch(/\(0\)/);
    expect(String(calls[2]?.[1])).toMatch(/\(1\)/);
    expect(loader.store.getState().status).toBe('READY');
  });

  it('rapid retries after a failure share one attempt', async () => {
    let imports = 0;
    const gate = deferred();
    const loader = createContentLoader(async (attempt) => {
      imports += 1;
      if (attempt === 0) throw new Error('offline');
      return gate.promise;
    });
    await loader.load().catch(() => null);
    loader.prefetch(); loader.prefetch(); loader.prefetch();
    const a = loader.load();
    const b = loader.load();
    expect(imports).toBe(2);
    gate.resolve(await realModule());
    expect(await a).toBe(await b);
    expect(imports).toBe(2);
  });

  it('finds the chunk in the browser\'s error message when there is no document', () => {
    expect(packChunkUrl(new TypeError('Failed to fetch dynamically imported module: http://h/assets/content-Bqi15S5f.js')))
      .toBe('http://h/assets/content-Bqi15S5f.js');
    expect(packChunkUrl(new Error('error loading dynamically imported module: https://cf.app/assets/content-x1.js')))
      .toBe('https://cf.app/assets/content-x1.js');
    expect(packChunkUrl(new Error('Importing a module script failed.'))).toBeNull();
    expect(packChunkUrl(null)).toBeNull();
  });

  it('the app importer retries under a URL the browser has not given up on', async () => {
    // The first attempt is the static specifier and works in Node too.
    await expect(importBasePack(0, null)).resolves.toMatchObject({ BASE_PACK: expect.anything() });
    const previous = new TypeError('Failed to fetch dynamically imported module: http://h/assets/content-abc.js');
    expect(retryUrl(0, previous)).toBeNull();
    expect(retryUrl(1, previous)).toBe('http://h/assets/content-abc.js?retry=1');
    expect(retryUrl(3, previous)).toBe('http://h/assets/content-abc.js?retry=3');
    // With no way to locate the chunk, a retry falls back to the specifier.
    expect(retryUrl(1, new Error('Importing a module script failed.'))).toBeNull();
    await expect(importBasePack(1, new Error('Importing a module script failed.'))).resolves.toMatchObject({ BASE_PACK: expect.anything() });
  });
});
