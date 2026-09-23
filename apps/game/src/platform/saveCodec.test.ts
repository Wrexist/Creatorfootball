import { describe, expect, it, vi } from 'vitest';
import { encodeStoredSave, decodeStoredSave } from './saveCodec';

describe('large career storage', () => {
  const large = JSON.stringify({ history: Array.from({ length: 15000 }, (_, i) => ({ season: i, name: 'Åström United ⚽', record: 'A preserved club story with accurate financial and sporting figures.' })) });
  it('keeps small and legacy JSON readable', async () => {
    const raw = '{"version":5}';
    expect(await encodeStoredSave(raw)).toBe(raw);
    expect(await decodeStoredSave(raw)).toBe(raw);
  });
  it('round trips a long career within the primary-plus-backup budget', async () => {
    const encoded = await encodeStoredSave(large);
    expect(encoded.length * 4).toBeLessThan(5 * 1024 * 1024);
    expect(await decodeStoredSave(encoded)).toBe(large);
  });
  it('supports older native webviews without CompressionStream', async () => {
    vi.stubGlobal('CompressionStream', undefined); vi.stubGlobal('DecompressionStream', undefined);
    try { expect(await decodeStoredSave(await encodeStoredSave(large))).toBe(large); }
    finally { vi.unstubAllGlobals(); }
  });
  it('rejects damaged compressed data', async () => {
    await expect(decodeStoredSave('cf:gzip:1:not-valid')).rejects.toThrow();
  });
});
