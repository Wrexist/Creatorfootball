import { describe, it, expect } from 'vitest';
import { MemoryStorage, SAVE_KEY } from '@cf/engine';
import { SaveCoordinator, SaveConflict } from './saveCoordinator';

describe('career write ownership', () => {
  it('refuses a stale tab without overwriting the newer career', async () => {
    const storage = new MemoryStorage();
    await storage.set(SAVE_KEY, 'original');
    const a = new SaveCoordinator(storage), b = new SaveCoordinator(storage);
    a.acceptRevision(await a.readRevision()); b.acceptRevision(await b.readRevision());
    await a.write(() => storage.set(SAVE_KEY, 'newer'));
    await expect(b.write(() => storage.set(SAVE_KEY, 'stale'))).rejects.toBeInstanceOf(SaveConflict);
    expect(await storage.get(SAVE_KEY)).toBe('newer');
    b.acceptRevision(await b.readRevision());
    await b.write(() => storage.set(SAVE_KEY, 'reloaded'));
    expect(await storage.get(SAVE_KEY)).toBe('reloaded');
  });
  it('can retry after a partial write without treating its own revision as foreign', async () => {
    const storage = new MemoryStorage(), coordinator = new SaveCoordinator(storage);
    coordinator.acceptRevision(null);
    await expect(coordinator.write(async () => { await storage.set(SAVE_KEY, 'primary'); throw new Error('metadata interrupted'); })).rejects.toThrow('metadata');
    await coordinator.write(() => storage.set(SAVE_KEY, 'retried'));
    expect(await storage.get(SAVE_KEY)).toBe('retried');
  });
});
