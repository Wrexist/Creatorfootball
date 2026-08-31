import type { StorageAdapter } from '@cf/engine';
import { SAVE_KEY, BACKUP_KEY, META_KEY } from '@cf/engine';
import { IdbStorage, idbAvailable } from './idb';

/**
 * Web/native storage adapter.
 *
 * The engine defines the interface; this file is the only place in the product
 * that knows localStorage exists. Swapping in Capacitor Preferences or a server
 * store later means replacing this file and nothing else.
 *
 * Writes are wrapped because Safari throws on quota exhaustion and in private
 * mode — losing a save silently would be far worse than surfacing the failure.
 */
export class WebStorage implements StorageAdapter {
  private memoryFallback = new Map<string, string>();
  private usingFallback = false;

  constructor(private readonly prefix = '') {}

  private key(k: string): string { return this.prefix + k; }

  private get backing(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'> | null {
    if (this.usingFallback) return null;
    try {
      const probe = '__cf_probe__';
      window.localStorage.setItem(probe, '1');
      window.localStorage.removeItem(probe);
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
    return backing.getItem(this.key(key));
  }

  async set(key: string, value: string): Promise<void> {
    const backing = this.backing;
    if (!backing) { this.memoryFallback.set(this.key(key), value); return; }
    try {
      backing.setItem(this.key(key), value);
    } catch (error) {
      // Quota exceeded. Fall back rather than losing the write entirely.
      this.usingFallback = true;
      this.memoryFallback.set(this.key(key), value);
      throw new Error(`Storage write failed, session is now in-memory only: ${String(error)}`);
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

/** The keys a career lives in. Migrated together or not at all. */
const SAVE_KEYS = [SAVE_KEY, BACKUP_KEY, META_KEY] as const;

/**
 * The storage the game actually uses: IndexedDB where it exists, localStorage
 * where it does not, memory where neither will accept a write.
 *
 * Resolved lazily and exactly once. Every method on `StorageAdapter` is already
 * async, so the whole negotiation — open the database, move an existing
 * localStorage career across, fall back if any of that fails — hides behind the
 * first `get`. Callers keep importing one `storage` object and never learn that
 * any of this happened, which is the reason the adapter interface exists.
 */
class LayeredStorage implements StorageAdapter {
  private readonly web = new WebStorage();
  private resolved: Promise<StorageAdapter> | null = null;
  private usingIdb = false;

  /**
   * True when nothing written will outlive the session. IndexedDB is durable,
   * so this can only be true once we have fallen back to the web layer and it
   * has itself fallen back to memory.
   */
  get isEphemeral(): boolean {
    return !this.usingIdb && this.web.isEphemeral;
  }

  private backend(): Promise<StorageAdapter> {
    if (!this.resolved) this.resolved = this.choose();
    return this.resolved;
  }

  private async choose(): Promise<StorageAdapter> {
    if (!idbAvailable()) return this.web;
    const idb = new IdbStorage();
    try {
      // Prove the database actually works before committing to it. An open
      // that succeeds and a transaction that aborts is a real combination in
      // private browsing, and discovering it on the first save would be far
      // worse than discovering it now.
      await idb.set('__cf_probe__', '1');
      await idb.remove('__cf_probe__');
      await this.migrateFromWeb(idb);
      this.usingIdb = true;
      return idb;
    } catch {
      return this.web;
    }
  }

  /**
   * Move a career written before this app used IndexedDB.
   *
   * Copy, read back, and only then clear the originals — reclaiming several
   * megabytes of localStorage that would otherwise stay spent forever. If any
   * step fails the originals are left exactly as they were, and the next boot
   * simply tries again.
   */
  private async migrateFromWeb(idb: IdbStorage): Promise<void> {
    if (await idb.get(SAVE_KEY)) return; // Already living in IndexedDB.

    const carried: string[] = [];
    for (const key of SAVE_KEYS) {
      const value = await this.web.get(key);
      if (value === null) continue;
      await idb.set(key, value);
      if ((await idb.get(key)) !== value) throw new Error(`Verification failed migrating ${key}`);
      carried.push(key);
    }
    for (const key of carried) await this.web.remove(key);
  }

  async get(key: string): Promise<string | null> { return (await this.backend()).get(key); }
  async set(key: string, value: string): Promise<void> { return (await this.backend()).set(key, value); }
  async remove(key: string): Promise<void> { return (await this.backend()).remove(key); }
  async keys(): Promise<string[]> { return (await this.backend()).keys(); }
}

export const storage = new LayeredStorage();
