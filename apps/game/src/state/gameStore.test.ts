import { describe, expect, it, beforeEach } from 'vitest';
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
