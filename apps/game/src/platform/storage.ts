import { Capacitor } from '@capacitor/core';
import type * as FilesystemApi from '@capacitor/filesystem';
import type { StorageAdapter } from '@cf/engine';
import { encodeStoredSave, decodeStoredSave } from './saveCodec';
import { createMutex } from './mutex';

/**
 * Web/native storage adapters.
 *
 * The engine defines the interface; this file is the only place in the product
 * that knows localStorage or the native filesystem exists. Callers get one
 * adapter from `createStorage()` and never learn which backend they hold.
 *
 * Writes are wrapped because Safari throws on quota exhaustion and in private
 * mode — losing a save silently would be far worse than surfacing the failure.
 */
export interface AppStorage extends StorageAdapter {
  /** True when writes cannot outlive this session. */
  readonly isEphemeral: boolean;
}

export class WebStorage implements AppStorage {
  private memoryFallback = new Map<string, string>();
  private usingFallback = false;

  constructor(private readonly prefix = '') {}

  private key(k: string): string { return this.prefix + k; }

  private get backing(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'> | null {
    if (this.usingFallback) return null;
    try {
      return window.localStorage;
    } catch {
      // Private browsing or a storage-disabled environment. Degrade to memory so
      // the session still works, and let the caller warn the user.
      this.usingFallback = true;
      return null;
    }
  }

  get isEphemeral(): boolean { return this.usingFallback; }

  async get(key: string): Promise<string | null> {
    const backing = this.backing;
    if (!backing) return this.memoryFallback.get(this.key(key)) ?? null;
    const raw = backing.getItem(this.key(key));
    if (raw === null) return null;
    try { return await decodeStoredSave(raw); }
    catch { return raw; } // Let the engine identify corruption and recover its backup.
  }

  async set(key: string, value: string): Promise<void> {
    const backing = this.backing;
    if (!backing) {
      this.memoryFallback.set(this.key(key), value);
      throw new Error('Persistent storage is unavailable. Progress is only in this session.');
    }
    try {
      backing.setItem(this.key(key), await encodeStoredSave(value));
    } catch (error) {
      // Quota exceeded. Fall back rather than losing the write entirely.
      // A full quota must never hide the readable career or prevent a retry.
      throw new Error(`Storage write failed: ${String(error)}`);
    }
  }

  async remove(key: string): Promise<void> {
    this.memoryFallback.delete(this.key(key));
    this.backing?.removeItem(this.key(key));
  }

  async keys(): Promise<string[]> {
    const backing = this.backing;
    if (!backing) return [...this.memoryFallback.keys()];
    const out: string[] = [];
    for (let i = 0; i < backing.length; i++) {
      const k = backing.key(i);
      if (k && k.startsWith(this.prefix)) out.push(k.slice(this.prefix.length));
    }
    return out;
  }
}

/** Folder under Library/ — iOS backs it up and never purges it, unlike WebView storage. */
export const NATIVE_SAVE_DIR = 'cf-saves';
const FILE_SUFFIX = '.dat';
const TEMP_SUFFIX = '.tmp';

/**
 * Keys become filenames that are safe on every native volume: lowercase ASCII,
 * digits, '.', '_' and '-' pass through; every other UTF-8 byte (including '/',
 * '%' and capitals, so case-insensitive volumes cannot collide) is
 * percent-encoded. The suffix means a name is never '.' or '..'.
 */
export function keyToFileName(key: string): string {
  let out = '';
  for (const byte of new TextEncoder().encode(key)) {
    const ch = String.fromCharCode(byte);
    out += /[a-z0-9._-]/.test(ch) ? ch : `%${byte.toString(16).toUpperCase().padStart(2, '0')}`;
  }
  return out + FILE_SUFFIX;
}

/** Inverse of `keyToFileName`; `null` for anything this adapter did not write. */
export function fileNameToKey(name: string): string | null {
  if (!name.endsWith(FILE_SUFFIX)) return null;
  try {
    const key = decodeURIComponent(name.slice(0, -FILE_SUFFIX.length));
    return keyToFileName(key) === name ? key : null;
  } catch { return null; }
}

let filesystem: Promise<typeof FilesystemApi> | undefined;
/** Dynamic so a plain web build never pulls the plugin into its chunks (see native.ts). */
function loadFilesystem(): Promise<typeof FilesystemApi> {
  filesystem ??= import('@capacitor/filesystem').catch((error: unknown) => { filesystem = undefined; throw error; });
  return filesystem;
}

/** Both native implementations report a missing file as OS-PLUG-FILE-0008. */
function isMissing(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { code, message } = error as { code?: unknown; message?: unknown };
  // The plugin maps a missing file to OS-PLUG-FILE-0008, but a raw Foundation
  // error ("no such file") can surface instead as a generic failure. Both mean
  // "no save yet"; treating either as fatal would block every first launch.
  return code === 'OS-PLUG-FILE-0008'
    || (typeof message === 'string' && /does not exist|no such file|couldn.t be opened because there is no such|ENOENT/i.test(message));
}

function legacyStore(): Storage | null {
  try { return typeof window === 'undefined' ? null : window.localStorage; }
  catch { return null; }
}

/**
 * Every file operation runs in order, so a first-read migration can never land
 * on top of a newer write and two writes never share a temp file mid-flight.
 */
const fileQueue = createMutex();

/**
 * Native adapter: one file per key under Library/cf-saves.
 *
 * Writes go to `<name>.tmp` and are renamed over the target, so a crash leaves
 * either the old or the new value, never half of one. The plugin's rename
 * deletes the target before moving, so a read that finds no target recovers a
 * temp file first. Careers saved before this adapter existed live in WebView
 * localStorage; the first read of each key copies it across and leaves the
 * original in place as a fallback.
 */
export class NativeFileStorage implements AppStorage {
  readonly isEphemeral = false;

  constructor(private readonly prefix = '') {}

  private path(key: string, temp = false): string {
    return `${NATIVE_SAVE_DIR}/${keyToFileName(this.prefix + key)}${temp ? TEMP_SUFFIX : ''}`;
  }

  get(key: string): Promise<string | null> {
    return fileQueue(async () => {
      const raw = await this.readRaw(key);
      if (raw === null) return null;
      try { return await decodeStoredSave(raw); }
      catch { return raw; } // Let the engine identify corruption and recover its backup.
    });
  }

  set(key: string, value: string): Promise<void> {
    return fileQueue(async () => {
      try { await this.writeRaw(key, await encodeStoredSave(value)); }
      catch (error) { throw new Error(`Storage write failed: ${String(error)}`); }
    });
  }

  remove(key: string): Promise<void> {
    return fileQueue(async () => {
      // Legacy first, target last: an interrupted delete may keep the newest
      // career, but can never resurrect an older one on the next read.
      try { legacyStore()?.removeItem(this.prefix + key); } catch { /* storage disabled */ }
      const { Filesystem, Directory } = await loadFilesystem();
      for (const path of [this.path(key, true), this.path(key)]) {
        try { await Filesystem.deleteFile({ path, directory: Directory.Library }); }
        catch (error) { if (!isMissing(error)) throw new Error(`Storage delete failed: ${String(error)}`); }
      }
    });
  }

  async keys(): Promise<string[]> {
    const { Filesystem, Directory } = await loadFilesystem();
    const found = new Set<string>();
    const add = (k: string | null): void => { if (k !== null && k.startsWith(this.prefix)) found.add(k.slice(this.prefix.length)); };
    try {
      const { files } = await Filesystem.readdir({ path: NATIVE_SAVE_DIR, directory: Directory.Library });
      for (const file of files) {
        if (file.type !== 'file') continue;
        add(fileNameToKey(file.name.endsWith(TEMP_SUFFIX) ? file.name.slice(0, -TEMP_SUFFIX.length) : file.name));
      }
    } catch (error) {
      if (!isMissing(error)) throw new Error(`Storage list failed: ${String(error)}`);
    }
    const legacy = legacyStore();
    if (legacy) for (let i = 0; i < legacy.length; i++) add(legacy.key(i));
    return [...found];
  }

  private async readRaw(key: string): Promise<string | null> {
    const target = await this.readFile(this.path(key));
    if (target !== null) return target;
    const temp = await this.readFile(this.path(key, true));
    if (temp !== null) {
      await this.promote(key).catch(() => undefined);
      return temp;
    }
    let legacy: string | null = null;
    try { legacy = legacyStore()?.getItem(this.prefix + key) ?? null; } catch { /* storage disabled */ }
    if (legacy === null) return null;
    // Copy the stored bytes verbatim: even a damaged legacy value must reach
    // the engine unchanged so it can choose the backup instead.
    await this.writeRaw(key, legacy).catch((error: unknown) => console.warn('Career migration to native storage failed', error));
    return legacy;
  }

  private async readFile(path: string): Promise<string | null> {
    const { Filesystem, Directory, Encoding } = await loadFilesystem();
    try {
      const { data } = await Filesystem.readFile({ path, directory: Directory.Library, encoding: Encoding.UTF8 });
      return typeof data === 'string' ? data : await data.text();
    } catch (error) {
      if (isMissing(error)) return null;
      throw new Error(`Storage read failed: ${String(error)}`);
    }
  }

  private async writeRaw(key: string, raw: string): Promise<void> {
    const { Filesystem, Directory, Encoding } = await loadFilesystem();
    await Filesystem.writeFile({ path: this.path(key, true), data: raw, directory: Directory.Library, encoding: Encoding.UTF8, recursive: true });
    await this.promote(key);
  }

  private async promote(key: string): Promise<void> {
    const { Filesystem, Directory } = await loadFilesystem();
    await Filesystem.rename({ from: this.path(key, true), to: this.path(key), directory: Directory.Library, toDirectory: Directory.Library });
  }
}

/** The one place a backend is chosen. Web keeps localStorage exactly as before. */
export function createStorage(prefix = ''): AppStorage {
  return Capacitor.isNativePlatform() ? new NativeFileStorage(prefix) : new WebStorage(prefix);
}

export const storage: AppStorage = createStorage();
