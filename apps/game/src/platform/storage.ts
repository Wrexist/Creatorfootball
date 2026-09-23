import type { StorageAdapter } from '@cf/engine';
import { encodeStoredSave, decodeStoredSave } from './saveCodec';

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

export const storage = new WebStorage();
