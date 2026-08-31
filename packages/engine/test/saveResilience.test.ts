import { describe, expect, it } from 'vitest';
import {
  MemoryStorage, saveGame, loadGame, loadMeta, deleteSave,
  SAVE_KEY, BACKUP_KEY,
} from '../src/index';
import { makeGameState } from './factories';

/**
 * A storage adapter that refuses writes, exactly as the browser does.
 *
 * `WebStorage` throws a real `Error` when localStorage rejects a write —
 * Safari's quota exhaustion and private-mode behaviour both land there. The
 * save layer must translate that into a value, because two of its callers
 * cannot survive a thrown promise: one persists without awaiting (an
 * unhandled rejection, and no failure warning to the player) and one would
 * discard an entire simulated week because the write, not the simulation,
 * failed.
 */
class HostileStorage extends MemoryStorage {
  /** Writes start failing once this many have been attempted. */
  failWritesFrom = Infinity;
  failReads = false;
  writes = 0;

  override async set(key: string, value: string): Promise<void> {
    this.writes++;
    if (this.writes >= this.failWritesFrom) throw new Error('QuotaExceededError');
    return super.set(key, value);
  }

  override async get(key: string): Promise<string | null> {
    if (this.failReads) throw new Error('SecurityError: storage is blocked');
    return super.get(key);
  }

  override async remove(key: string): Promise<void> {
    throw new Error(`refused to remove ${key}`);
  }
}

describe('save resilience against a hostile storage adapter', () => {
  it('reports a refused write as an error instead of throwing', async () => {
    const storage = new HostileStorage();
    storage.failWritesFrom = 1;

    const result = await saveGame(storage, makeGameState(), 1000);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('Storage write failed');
  });

  it('leaves the previous good save untouched when a write is refused', async () => {
    const storage = new HostileStorage();
    const state = makeGameState();

    const first = await saveGame(storage, state, 1000);
    expect(first.ok).toBe(true);
    const goodSave = await storage.get(SAVE_KEY);

    // Let the backup promotion through, then refuse the real save write.
    storage.failWritesFrom = storage.writes + 2;
    const second = await saveGame(storage, state, 2000);
    expect(second.ok).toBe(false);

    expect(await storage.get(SAVE_KEY)).toBe(goodSave);
    const loaded = await loadGame(storage);
    expect(loaded.ok).toBe(true);
  });

  it('never advertises metadata for a save that was not written', async () => {
    const storage = new HostileStorage();
    const state = makeGameState();
    await saveGame(storage, state, 1000);
    const metaBefore = await loadMeta(storage);
    expect(metaBefore?.savedAt).toBe(1000);

    storage.failWritesFrom = storage.writes + 2;
    const refused = await saveGame(storage, state, 5000);
    expect(refused.ok).toBe(false);

    // The stale timestamp is the honest one: it describes the save on disk.
    const metaAfter = await loadMeta(storage);
    expect(metaAfter?.savedAt).toBe(1000);
  });

  it('treats an unreadable store as a load failure rather than a crash', async () => {
    const storage = new HostileStorage();
    await saveGame(storage, makeGameState(), 1000);
    storage.failReads = true;

    const loaded = await loadGame(storage);
    expect(loaded.ok).toBe(false);
    if (loaded.ok) return;
    expect(loaded.error.code).toBe('CORRUPT');

    // Metadata is best-effort and must degrade to "unknown", not throw.
    await expect(loadMeta(storage)).resolves.toBeNull();
  });

  it('lets a career be abandoned even when the store refuses to delete', async () => {
    const storage = new HostileStorage();
    await saveGame(storage, makeGameState(), 1000);
    await expect(deleteSave(storage)).resolves.toBeUndefined();
  });

  it('still promotes the previous save to backup on a healthy store', async () => {
    const storage = new HostileStorage();
    const state = makeGameState();
    await saveGame(storage, state, 1000);
    const first = await storage.get(SAVE_KEY);
    await saveGame(storage, state, 2000);
    expect(await storage.get(BACKUP_KEY)).toBe(first);
  });
});
