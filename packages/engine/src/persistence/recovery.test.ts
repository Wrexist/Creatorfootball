import { describe, expect, it } from 'vitest';
import { buildTestWorld } from '../simulation/fixtures';
import { MemoryStorage } from './storage';
import { BACKUP_KEY, SAVE_KEY, loadGame, saveGame, validateState } from './save';
import type { GameState } from '../game/state';

describe('career recovery', () => {
  it('reads the backup when the primary was removed', async () => {
    const storage = new MemoryStorage();
    const { state } = buildTestWorld({ clubCount: 4 });
    await saveGame(storage, state, 1);
    await saveGame(storage, state, 2);
    await storage.remove(SAVE_KEY);
    const loaded = await loadGame(storage);
    expect(loaded.ok && loaded.value.recoveredFromBackup).toBe(true);
  });
  it('never replaces a usable backup with corrupt primary data', async () => {
    const storage = new MemoryStorage();
    const { state } = buildTestWorld({ clubCount: 4 });
    await saveGame(storage, state, 1);
    await saveGame(storage, state, 2);
    const good = await storage.get(BACKUP_KEY);
    await storage.set(SAVE_KEY, '{broken');
    expect((await saveGame(storage, state, 3)).ok).toBe(true);
    expect(await storage.get(BACKUP_KEY)).toBe(good);
  });
  it('reports quota errors without throwing or replacing the career', async () => {
    const storage = new MemoryStorage();
    const { state } = buildTestWorld({ clubCount: 4 });
    await saveGame(storage, state, 1);
    const before = await storage.get(SAVE_KEY);
    storage.set = async () => { throw new Error('Quota exceeded'); };
    expect((await saveGame(storage, state, 2)).ok).toBe(false);
    expect(await storage.get(SAVE_KEY)).toBe(before);
  });
  it('treats malformed nested squads as damage instead of crashing recovery', () => {
    const { state } = buildTestWorld({ clubCount: 4 });
    const malformed = { ...state, clubs: { broken: null } } as unknown as GameState;
    expect(validateState(malformed)).toContain('Invalid club squad');
  });
});
