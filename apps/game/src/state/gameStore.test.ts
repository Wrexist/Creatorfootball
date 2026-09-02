import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadGame, loadMeta, SAVE_KEY, BACKUP_KEY, META_KEY, type ClubChoice, type ManagerChoice } from '@cf/engine';
import { storage } from '@/platform/storage';
import { useGameStore } from './gameStore';

/**
 * These drive the real store against the real save layer. In Node there is no
 * `window` and no `indexedDB`, so the layered adapter falls through to its
 * in-memory backing — which is exactly the seam we want to exercise: the
 * ordering and lifecycle of writes, not the storage medium.
 */
const MANAGER = { kind: 'PREMADE', templateId: 'manager_vera_lindqvist' } as unknown as ManagerChoice;
const CLUB = { kind: 'TEMPLATE', templateId: 'club_cinderwick_town' } as unknown as ClubChoice;

const newCareer = () => useGameStore.getState().startNewGame({ seed: 'store-test', manager: MANAGER, club: CLUB });

/** Long enough for anything the store fired without awaiting to land. */
const quiesce = () => new Promise((resolve) => setTimeout(resolve, 50));

describe('game store persistence', () => {
  beforeEach(async () => {
    for (const key of [SAVE_KEY, BACKUP_KEY, META_KEY]) await storage.remove(key);
    useGameStore.setState({ state: null, meta: null, phase: 'BOOTING', persistFailed: false, error: null });
  });

  /**
   * The bug this guards was reproduced before the save queue existed: the
   * delete ran, the app showed "no save", and an `apply()` already in flight
   * wrote the career straight back. The player's next boot loaded the career
   * they had just abandoned.
   */
  it('abandoning a career is not undone by a save already in flight', async () => {
    await newCareer();
    useGameStore.getState().apply((s) => ({ ...s, settings: { ...s.settings, sound: false } }));
    await useGameStore.getState().abandon();
    await quiesce();

    const loaded = await loadGame(storage);
    expect(loaded.ok).toBe(false);
    if (loaded.ok) return;
    expect(loaded.error.code).toBe('NOT_FOUND');
    await expect(loadMeta(storage)).resolves.toBeNull();
    expect(useGameStore.getState().phase).toBe('NO_SAVE');
  });

  it('does not report a persistence failure when a write is dropped by abandon', async () => {
    await newCareer();
    useGameStore.getState().apply((s) => ({ ...s, settings: { ...s.settings, sound: false } }));
    await useGameStore.getState().abandon();
    await quiesce();

    // A cancelled write is not a failed one; the player must not be told
    // their changes could not be saved for a career they just deleted.
    expect(useGameStore.getState().persistFailed).toBe(false);
  });

  it('leaves the newest state on disk after a burst of rapid actions', async () => {
    await newCareer();
    const store = useGameStore.getState();
    for (const cycle of [101, 102, 103]) {
      store.apply((s) => ({ ...s, clock: { ...s.clock, cycle } }));
    }
    await quiesce();

    const loaded = await loadGame(storage);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.value.state.clock.cycle).toBe(103);
    // In-memory store state and the save must agree.
    expect(useGameStore.getState().state?.clock.cycle).toBe(103);
  });

  it('starting a fresh career after abandoning one persists the new one', async () => {
    await newCareer();
    await useGameStore.getState().abandon();
    await newCareer();
    await quiesce();

    const loaded = await loadGame(storage);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(useGameStore.getState().phase).toBe('READY');
    expect(loaded.value.state.saveId).toBe(useGameStore.getState().state?.saveId);
  });

  /**
   * The browser suite proves a career created through onboarding is on disk by
   * the time the player reaches matchday. It cannot prove *when* the write
   * happened: by then the player has clicked through a reveal and a squad
   * screen, and a write merely racing them would have landed anyway. Verified
   * — removing the `await` in `startNewGame` leaves the browser test green.
   *
   * The ordering is what matters on a phone, where the app can be killed
   * during the reveal. So it is asserted directly: the save must be on disk
   * before creating a career resolves, not shortly afterwards.
   */
  it('finishes creating a career only once it is on disk', async () => {
    const order: string[] = [];
    const realSet = storage.set.bind(storage);
    const spy = storage as unknown as { set: (k: string, v: string) => Promise<void> };
    spy.set = async (key, value) => {
      await realSet(key, value);
      order.push(`wrote:${key}`);
    };

    try {
      await newCareer();
      order.push('createResolved');
    } finally {
      spy.set = realSet;
    }

    const wrote = order.indexOf(`wrote:${SAVE_KEY}`);
    const resolved = order.indexOf('createResolved');
    expect(wrote, 'the career was never written during creation').toBeGreaterThanOrEqual(0);
    expect(wrote).toBeLessThan(resolved);
  });

  it('boots a career back from storage exactly as it was saved', async () => {
    await newCareer();
    useGameStore.getState().apply((s) => ({ ...s, clock: { ...s.clock, cycle: 42 } }));
    await quiesce();

    useGameStore.setState({ state: null, meta: null, phase: 'BOOTING' });
    await useGameStore.getState().boot();

    expect(useGameStore.getState().phase).toBe('READY');
    expect(useGameStore.getState().state?.clock.cycle).toBe(42);
  });
});

/**
 * Career creation against content that has not arrived yet.
 *
 * The pack is a lazy chunk. Every rule below is about the gap between "the
 * player confirmed" and "the content is here": nothing may be created, saved
 * or shown in that gap, a failure in it must leave the player somewhere they
 * can act, and whichever creation the player asked for *last* is the one that
 * gets built.
 */
import {
  content, type BasePackModule,
} from './content';

const realModule = (): Promise<BasePackModule> => import('@cf/engine/content/packs/base/index');

interface Gate {
  readonly promise: Promise<BasePackModule>;
  resolve: (module: BasePackModule) => void;
  reject: (error: unknown) => void;
}
const gate = (): Gate => {
  let resolve!: Gate['resolve'];
  let reject!: Gate['reject'];
  const promise = new Promise<BasePackModule>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

const OTHER_CLUB = { kind: 'TEMPLATE', templateId: 'club_marrowgate_athletic' } as unknown as ClubChoice;
const onDisk = async () => (await loadGame(storage)).ok;

describe('career creation waits for content', () => {
  beforeEach(async () => {
    for (const key of [SAVE_KEY, BACKUP_KEY, META_KEY]) await storage.remove(key);
    useGameStore.setState({ state: null, meta: null, phase: 'NO_SAVE', persistFailed: false, error: null });
  });
  afterEach(() => content.reset());

  it('creates nothing until the content is here, then creates the career', async () => {
    const g = gate();
    content.reset(() => g.promise);
    const creating = newCareer();
    await quiesce();

    expect(useGameStore.getState().phase).toBe('CREATING');
    expect(useGameStore.getState().state).toBeNull();
    expect(await onDisk()).toBe(false);

    g.resolve(await realModule());
    await creating;
    expect(useGameStore.getState().phase).toBe('READY');
    expect(useGameStore.getState().state?.playerClubId).toBeTruthy();
    expect(await onDisk()).toBe(true);
  });

  it('cannot save while creation is incomplete, and saves nothing when the content never arrives', async () => {
    const g = gate();
    content.reset(() => g.promise);
    const creating = newCareer();
    await quiesce();
    await useGameStore.getState().save();
    expect(await onDisk()).toBe(false);

    g.reject(new TypeError('Failed to fetch dynamically imported module'));
    await creating;
    expect(useGameStore.getState().state).toBeNull();
    expect(await onDisk()).toBe(false);
    await expect(loadMeta(storage)).resolves.toBeNull();
  });

  it('a failed load leaves the player where they can try again, with a message in their language', async () => {
    content.reset(async () => { throw new TypeError('Failed to fetch dynamically imported module'); });
    await newCareer();
    const s = useGameStore.getState();
    expect(s.phase).toBe('NO_SAVE');
    expect(s.state).toBeNull();
    expect(s.busy).toBe(false);
    expect(s.error).toMatch(/connection/i);
    expect(s.error).not.toMatch(/chunk|module|import|fetch/i);
    expect(await onDisk()).toBe(false);

    // The retry is the same action again: the loader tries the import afresh.
    content.reset(realModule);
    await newCareer();
    expect(useGameStore.getState().phase).toBe('READY');
    expect(await onDisk()).toBe(true);
  });

  it('content that fails validation blocks creation and creates no state', async () => {
    content.reset(async () => {
      const real = await realModule();
      return {
        ...real,
        BASE_PACK: { ...real.BASE_PACK, data: { ...real.BASE_PACK.data, clubs: [] } },
      };
    });
    await newCareer();
    const s = useGameStore.getState();
    expect(s.phase).toBe('NO_SAVE');
    expect(s.state).toBeNull();
    expect(s.error).toBeTruthy();
    expect(await onDisk()).toBe(false);
  });

  it('an abandoned flow is not touched when its content arrives late', async () => {
    const g = gate();
    content.reset(() => g.promise);
    // The player opened creation (which prefetches) and then left.
    content.prefetch();
    await quiesce();
    expect(useGameStore.getState().phase).toBe('NO_SAVE');

    g.resolve(await realModule());
    await quiesce();
    // The content is ready for next time; the game itself did not move.
    expect(content.ready()).not.toBeNull();
    expect(useGameStore.getState().phase).toBe('NO_SAVE');
    expect(useGameStore.getState().state).toBeNull();
    expect(await onDisk()).toBe(false);
  });

  it('switching branch while content is loading builds the branch the player chose last, once', async () => {
    const g = gate();
    content.reset(() => g.promise);
    const writes: string[] = [];
    const realSet = storage.set.bind(storage);
    const spy = storage as unknown as { set: (k: string, v: string) => Promise<void> };
    spy.set = async (key, value) => { await realSet(key, value); writes.push(key); };

    try {
      const first = useGameStore.getState().startNewGame({ seed: 'branch', manager: MANAGER, club: CLUB });
      const second = useGameStore.getState().startNewGame({ seed: 'branch', manager: MANAGER, club: OTHER_CLUB });
      g.resolve(await realModule());
      await Promise.all([first, second]);
    } finally {
      spy.set = realSet;
    }

    const s = useGameStore.getState();
    expect(s.phase).toBe('READY');
    const club = s.state ? s.state.clubs[s.state.playerClubId] : null;
    expect(club?.name).toMatch(/marrowgate/i);
    expect(s.meta?.clubName).toMatch(/marrowgate/i);
    expect(writes.filter((k) => k === SAVE_KEY)).toHaveLength(1);
  });

  it('builds the same career whether the content was instant or slow', async () => {
    content.reset(realModule);
    await useGameStore.getState().startNewGame({ seed: 'same', now: 1_700_000_000_000, manager: MANAGER, club: CLUB });
    const instant = JSON.stringify(useGameStore.getState().state);

    await useGameStore.getState().abandon();
    content.reset(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
      return realModule();
    });
    await useGameStore.getState().startNewGame({ seed: 'same', now: 1_700_000_000_000, manager: MANAGER, club: CLUB });
    expect(JSON.stringify(useGameStore.getState().state)).toBe(instant);
  });
});

describe('booting a saved career waits for content', () => {
  beforeEach(async () => {
    for (const key of [SAVE_KEY, BACKUP_KEY, META_KEY]) await storage.remove(key);
    content.reset();
    useGameStore.setState({ state: null, meta: null, phase: 'NO_SAVE', persistFailed: false, error: null });
    await newCareer();
  });
  afterEach(() => content.reset());

  it('is READY only once the content the save depends on is loaded', async () => {
    const g = gate();
    content.reset(() => g.promise);
    useGameStore.setState({ state: null, meta: null, phase: 'BOOTING' });
    const booting = useGameStore.getState().boot();
    await quiesce();
    expect(useGameStore.getState().phase).toBe('BOOTING');

    g.resolve(await realModule());
    await booting;
    expect(useGameStore.getState().phase).toBe('READY');
    expect(useGameStore.getState().state).not.toBeNull();
  });

  it('a content failure at boot is reported as such and never touches the save', async () => {
    content.reset(async () => { throw new TypeError('Failed to fetch dynamically imported module'); });
    useGameStore.setState({ state: null, meta: null, phase: 'BOOTING' });
    await useGameStore.getState().boot();
    const s = useGameStore.getState();
    expect(s.phase).toBe('ERROR');
    expect(s.errorSource).toBe('CONTENT');
    expect(s.error).not.toMatch(/save/i);
    expect(await onDisk()).toBe(true);

    // Trying again is the whole recovery.
    content.reset(realModule);
    await useGameStore.getState().boot();
    expect(useGameStore.getState().phase).toBe('READY');
    expect(useGameStore.getState().errorSource).toBeNull();
  });

  it('a fresh install does not wait for content to show the first screen', async () => {
    for (const key of [SAVE_KEY, BACKUP_KEY, META_KEY]) await storage.remove(key);
    const g = gate();
    content.reset(() => g.promise);
    useGameStore.setState({ state: null, meta: null, phase: 'BOOTING' });
    await useGameStore.getState().boot();
    expect(useGameStore.getState().phase).toBe('NO_SAVE');
    // Nothing asked for the content, so nothing started loading it.
    expect(content.store.getState().status).toBe('IDLE');
    g.resolve(await realModule());
  });
});
