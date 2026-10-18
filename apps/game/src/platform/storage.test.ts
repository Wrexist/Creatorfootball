import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface FsOptions { path: string; directory?: string; data?: string }
interface RenameOptions { from: string; to: string; directory?: string; toDirectory?: string }

const mocks = vi.hoisted(() => {
  const files = new Map<string, string>();
  const missing = (method: string, path: string) =>
    Object.assign(new Error(`'${method}' failed because file at '${path}' does not exist.`), { code: 'OS-PLUG-FILE-0008' });
  const at = (directory: string | undefined, path: string) => `${directory}/${path}`;
  const fs = {
    writeFile: vi.fn(async (o: FsOptions) => { files.set(at(o.directory, o.path), o.data ?? ''); return { uri: o.path }; }),
    readFile: vi.fn(async (o: FsOptions) => {
      const data = files.get(at(o.directory, o.path));
      if (data === undefined) throw missing('readFile', o.path);
      return { data };
    }),
    // Mirrors the shipped iOS plugin: delete the destination, then move.
    rename: vi.fn(async (o: RenameOptions) => {
      const from = at(o.directory, o.from), to = at(o.toDirectory ?? o.directory, o.to);
      const data = files.get(from);
      if (data === undefined) throw missing('rename', o.from);
      files.delete(to); files.set(to, data); files.delete(from);
    }),
    deleteFile: vi.fn(async (o: FsOptions) => { if (!files.delete(at(o.directory, o.path))) throw missing('deleteFile', o.path); }),
    readdir: vi.fn(async (o: FsOptions) => {
      const dir = `${at(o.directory, o.path)}/`;
      const names = [...files.keys()].filter(k => k.startsWith(dir)).map(k => k.slice(dir.length));
      if (names.length === 0) throw missing('readdir', o.path); // never created
      return { files: names.map(name => ({ name, type: 'file' as const, size: 0, mtime: 0, uri: name })) };
    }),
  };
  return { native: true, files, fs };
});
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => mocks.native } }));
vi.mock('@capacitor/filesystem', () => ({ Filesystem: mocks.fs, Directory: { Library: 'LIBRARY' }, Encoding: { UTF8: 'utf8' } }));

import { BACKUP_KEY, SAVE_KEY } from '@cf/engine';
import { NativeFileStorage, WebStorage, createStorage, fileNameToKey, keyToFileName } from './storage';
import { encodeStoredSave } from './saveCodec';

class FakeLocalStorage {
  private map = new Map<string, string>();
  get length(): number { return this.map.size; }
  key(i: number): string | null { return [...this.map.keys()][i] ?? null; }
  getItem(k: string): string | null { return this.map.get(k) ?? null; }
  setItem(k: string, v: string): void { this.map.set(k, v); }
  removeItem(k: string): void { this.map.delete(k); }
}

const file = (key: string) => `LIBRARY/cf-saves/${keyToFileName(key)}`;
const large = JSON.stringify({ history: Array.from({ length: 15000 }, (_, i) => ({ season: i, record: 'A preserved club story with accurate financial and sporting figures.' })) });
let legacy: FakeLocalStorage;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.files.clear();
  mocks.native = true;
  legacy = new FakeLocalStorage();
  vi.stubGlobal('window', { localStorage: legacy });
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('native career storage', () => {
  it('is chosen only inside the native shell', () => {
    expect(createStorage()).toBeInstanceOf(NativeFileStorage);
    mocks.native = false;
    expect(createStorage()).toBeInstanceOf(WebStorage);
  });

  it('round trips careers, one file per key under Library, compressed like the web', async () => {
    const storage = new NativeFileStorage();
    expect(storage.isEphemeral).toBe(false);
    expect(await storage.get(SAVE_KEY)).toBeNull();
    await storage.set(SAVE_KEY, '{"version":5}');
    await storage.set(BACKUP_KEY, large);
    expect(mocks.files.get(file(SAVE_KEY))).toBe('{"version":5}');
    expect(mocks.files.get(file(BACKUP_KEY))?.startsWith('cf:gzip:1:')).toBe(true);
    expect(await storage.get(SAVE_KEY)).toBe('{"version":5}');
    expect(await storage.get(BACKUP_KEY)).toBe(large);
  });

  it('writes a temp file and renames it over the target', async () => {
    const storage = new NativeFileStorage();
    await storage.set(SAVE_KEY, 'first');
    await storage.set(SAVE_KEY, 'second');
    const target = `cf-saves/${keyToFileName(SAVE_KEY)}`;
    expect(mocks.fs.writeFile.mock.calls.map(([o]) => o.path)).toEqual([`${target}.tmp`, `${target}.tmp`]);
    expect(mocks.fs.writeFile).toHaveBeenCalledWith(expect.objectContaining({ directory: 'LIBRARY', recursive: true }));
    expect(mocks.fs.rename).toHaveBeenLastCalledWith({ from: `${target}.tmp`, to: target, directory: 'LIBRARY', toDirectory: 'LIBRARY' });
    expect([...mocks.files.keys()]).toEqual([file(SAVE_KEY)]);
    expect(await storage.get(SAVE_KEY)).toBe('second');
  });

  it('keeps the previous career readable when a write fails, with a readable error', async () => {
    const storage = new NativeFileStorage();
    await storage.set(SAVE_KEY, 'previous');
    mocks.fs.rename.mockRejectedValueOnce(new Error('No space left on device'));
    await expect(storage.set(SAVE_KEY, 'next')).rejects.toThrow('Storage write failed: Error: No space left on device');
    expect(await storage.get(SAVE_KEY)).toBe('previous');
  });

  it('recovers the complete temp file when interrupted between delete and move', async () => {
    const storage = new NativeFileStorage();
    await storage.set(SAVE_KEY, 'previous');
    mocks.fs.rename.mockImplementationOnce(async () => { mocks.files.delete(file(SAVE_KEY)); throw new Error('killed'); });
    await expect(storage.set(SAVE_KEY, 'next')).rejects.toThrow('Storage write failed');
    expect(await storage.get(SAVE_KEY)).toBe('next');
    expect([...mocks.files.keys()]).toEqual([file(SAVE_KEY)]);
  });

  it('migrates a legacy localStorage career on first read and leaves the original', async () => {
    const encoded = await encodeStoredSave(large);
    legacy.setItem(SAVE_KEY, encoded);
    const storage = new NativeFileStorage();
    expect(await storage.get(SAVE_KEY)).toBe(large);
    expect(mocks.files.get(file(SAVE_KEY))).toBe(encoded); // bytes copied verbatim
    expect(mocks.fs.rename).toHaveBeenCalledTimes(1); // migrated atomically too
    expect(legacy.getItem(SAVE_KEY)).toBe(encoded);
    legacy.setItem(SAVE_KEY, 'stale');
    expect(await storage.get(SAVE_KEY)).toBe(large); // the file is now authoritative
  });

  it('uses the same prefix scheme as WebStorage for legacy keys', async () => {
    legacy.setItem('qa:' + SAVE_KEY, 'prefixed');
    expect(await new NativeFileStorage('qa:').get(SAVE_KEY)).toBe('prefixed');
    expect(mocks.files.has(file('qa:' + SAVE_KEY))).toBe(true);
  });

  it('still returns the legacy career when the migration write fails', async () => {
    legacy.setItem(SAVE_KEY, 'legacy');
    mocks.fs.writeFile.mockRejectedValueOnce(new Error('disk full'));
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(await new NativeFileStorage().get(SAVE_KEY)).toBe('legacy');
  });

  it('never migrates over a file it merely failed to read', async () => {
    legacy.setItem(SAVE_KEY, 'legacy');
    mocks.files.set(file(SAVE_KEY), 'newer');
    mocks.fs.readFile.mockRejectedValueOnce(new Error('Operation not permitted'));
    await expect(new NativeFileStorage().get(SAVE_KEY)).rejects.toThrow('Storage read failed');
    expect(mocks.fs.writeFile).not.toHaveBeenCalled();
    expect(mocks.files.get(file(SAVE_KEY))).toBe('newer');
  });

  it('orders a first-read migration behind an in-flight write', async () => {
    legacy.setItem(SAVE_KEY, 'legacy');
    const storage = new NativeFileStorage();
    const [, read] = await Promise.all([storage.set(SAVE_KEY, 'fresh'), storage.get(SAVE_KEY)]);
    expect(read).toBe('fresh');
    expect(await storage.get(SAVE_KEY)).toBe('fresh');
  });

  it('passes undecodable data through so the engine can recover its backup', async () => {
    const storage = new NativeFileStorage();
    mocks.files.set(file(SAVE_KEY), 'cf:gzip:1:not-valid');
    expect(await storage.get(SAVE_KEY)).toBe('cf:gzip:1:not-valid');
    legacy.setItem(BACKUP_KEY, 'cf:gzip:1:also-damaged');
    expect(await storage.get(BACKUP_KEY)).toBe('cf:gzip:1:also-damaged');
    expect(mocks.files.get(file(BACKUP_KEY))).toBe('cf:gzip:1:also-damaged');
  });

  it('lists keys from the directory and legacy store, and removes without resurrection', async () => {
    const storage = new NativeFileStorage();
    expect(await storage.keys()).toEqual([]);
    await storage.set(SAVE_KEY, 'a');
    await storage.set(BACKUP_KEY, 'b');
    legacy.setItem(SAVE_KEY, 'old a');
    legacy.setItem('cf.legacy.only', 'c');
    mocks.files.set('LIBRARY/cf-saves/.DS_Store', '');
    expect((await storage.keys()).sort()).toEqual([BACKUP_KEY, 'cf.legacy.only', SAVE_KEY].sort());

    await storage.remove(SAVE_KEY);
    await storage.remove('cf.legacy.only');
    await expect(storage.remove('never-written')).resolves.toBeUndefined();
    expect(await storage.get(SAVE_KEY)).toBeNull(); // legacy copy must not come back
    expect(await storage.get('cf.legacy.only')).toBeNull();
    expect((await storage.keys())).toEqual([BACKUP_KEY]);
  });

  it('reports a delete that genuinely failed', async () => {
    const storage = new NativeFileStorage();
    await storage.set(SAVE_KEY, 'a');
    mocks.fs.deleteFile.mockRejectedValueOnce(new Error('Operation not permitted'));
    await expect(storage.remove(SAVE_KEY)).rejects.toThrow('Storage delete failed');
  });

  it('encodes any key into a single safe, case-distinct filename', () => {
    expect(keyToFileName(SAVE_KEY)).toBe('cf.save.v1.dat');
    for (const key of ['../Évil/Key', '..', 'a%2Fb', 'Save ⚽']) {
      const name = keyToFileName(key);
      expect(name).toMatch(/^[a-z0-9._%A-F-]+\.dat$/);
      expect(name).not.toContain('/');
      expect(fileNameToKey(name)).toBe(key);
    }
    expect(keyToFileName('A').toLowerCase()).not.toBe(keyToFileName('a').toLowerCase());
    expect(fileNameToKey('Foreign.dat')).toBeNull();
    expect(fileNameToKey('.DS_Store')).toBeNull();
  });
});
