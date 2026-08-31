import type { StorageAdapter } from '@cf/engine';

/**
 * IndexedDB key-value storage.
 *
 * localStorage cannot hold this game. Measured on a real career: the save
 * plateaus around 3.1 MB, and the save layer deliberately keeps a backup copy,
 * so a long dynasty needs roughly 6.3 MB. The localStorage budget is about
 * 5 MB per origin, which a career crosses somewhere around its fifth season —
 * after which every write is refused and the player is told, correctly but
 * uselessly, that their progress can no longer be saved.
 *
 * Trimming was measured too, and rejected: the largest slice is the ledger,
 * and cutting its retention to the point of usefulness still lands near 4.7 MB.
 * That is not a fix, it is a slightly later failure that also costs the player
 * their financial history. IndexedDB has a quota in the hundreds of megabytes,
 * which is the difference between a ceiling players hit and one they do not.
 *
 * Written against the raw API rather than a wrapper library so the bundle gains
 * nothing: the surface needed here is four operations.
 */

const DB_NAME = 'cf.game';
const DB_VERSION = 1;
const STORE = 'kv';

/** IndexedDB is absent in some embedded webviews and blocked outright in others. */
export function idbAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
    // A blocked open never settles on its own. Without this the whole boot
    // hangs behind a promise that will never resolve, which presents as a
    // splash screen that never leaves.
    request.onblocked = () => reject(new Error('IndexedDB open blocked by another tab'));
  });
}

export class IdbStorage implements StorageAdapter {
  private db: Promise<IDBDatabase> | null = null;

  private handle(): Promise<IDBDatabase> {
    // Cached, but not cached on failure: a rejected promise must not become the
    // permanent answer for the rest of the session.
    if (!this.db) {
      this.db = openDb().catch((error: unknown) => {
        this.db = null;
        throw error;
      });
    }
    return this.db;
  }

  private async run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.handle();
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = work(tx.objectStore(STORE));
      let value: T;
      request.onsuccess = () => { value = request.result; };
      request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
      // Resolve on transaction completion, not on request success: a write is
      // only durable once the transaction commits, and quota failures surface
      // here rather than on the request.
      tx.oncomplete = () => resolve(value);
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    });
  }

  async get(key: string): Promise<string | null> {
    const value = await this.run<unknown>('readonly', (store) => store.get(key) as IDBRequest<unknown>);
    return typeof value === 'string' ? value : null;
  }

  async set(key: string, value: string): Promise<void> {
    await this.run('readwrite', (store) => store.put(value, key) as IDBRequest<IDBValidKey>);
  }

  async remove(key: string): Promise<void> {
    await this.run('readwrite', (store) => store.delete(key) as IDBRequest<undefined>);
  }

  async keys(): Promise<string[]> {
    const found = await this.run<IDBValidKey[]>('readonly', (store) => store.getAllKeys() as IDBRequest<IDBValidKey[]>);
    return found.filter((k): k is string => typeof k === 'string');
  }
}
