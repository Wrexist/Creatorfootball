/**
 * Storage abstraction.
 *
 * The engine never touches localStorage, IndexedDB, the filesystem or any
 * Capacitor plugin. The host application supplies an adapter. This is what lets
 * the identical engine run in a browser, in a native shell, in a Node balance
 * harness and later on a server without a single change.
 */
export interface StorageAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
  keys(): Promise<string[]>;
}

/** In-memory adapter used by tests and the headless simulation tools. */
export class MemoryStorage implements StorageAdapter {
  private map = new Map<string, string>();
  async get(key: string) { return this.map.get(key) ?? null; }
  async set(key: string, value: string) { this.map.set(key, value); }
  async remove(key: string) { this.map.delete(key); }
  async keys() { return [...this.map.keys()]; }
}
