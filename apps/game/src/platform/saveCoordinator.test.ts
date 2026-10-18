import { afterEach, describe, it, expect, vi } from 'vitest';
const platform = vi.hoisted(() => ({ native: false }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => platform.native } }));
import { MemoryStorage, SAVE_KEY } from '@cf/engine';
import { SaveCoordinator, SaveConflict } from './saveCoordinator';

afterEach(() => { platform.native = false; vi.unstubAllGlobals(); });

describe('career write lock', () => {
  const tick = () => new Promise(resolve => setTimeout(resolve, 2));
  it('serialises concurrent native writes without Web Locks (iOS 15.0–15.3)', async () => {
    platform.native = true;
    vi.stubGlobal('window', {}); vi.stubGlobal('navigator', {});
    const storage = new MemoryStorage(), coordinator = new SaveCoordinator(storage), log: string[] = [];
    const op = (n: number, fail = false) => async () => {
      log.push(`start ${n}`); await tick(); await storage.set(SAVE_KEY, `v${n}`); log.push(`end ${n}`);
      if (fail) throw new Error(`write ${n} failed`);
      return n;
    };
    const results = await Promise.allSettled([coordinator.write(op(1)), coordinator.write(op(2, true)), coordinator.write(op(3))]);
    expect(log).toEqual(['start 1', 'end 1', 'start 2', 'end 2', 'start 3', 'end 3']);
    expect(results.map(r => r.status)).toEqual(['fulfilled', 'rejected', 'fulfilled']);
    expect(await storage.get(SAVE_KEY)).toBe('v3');
  });
  it('keeps requiring Web Locks in a browser', async () => {
    vi.stubGlobal('window', {}); vi.stubGlobal('navigator', {});
    await expect(new SaveCoordinator(new MemoryStorage()).write(async () => 1)).rejects.toThrow('This browser cannot coordinate career saves');
    const request = vi.fn((_name: string, run: () => Promise<number>) => run());
    vi.stubGlobal('navigator', { locks: { request } });
    expect(await new SaveCoordinator(new MemoryStorage()).write(async () => 2)).toBe(2);
    expect(request).toHaveBeenCalledWith('creator-football:career-write', expect.any(Function));
  });
});

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
