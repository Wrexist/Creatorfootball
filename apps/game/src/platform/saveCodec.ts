import { gzipSync, gunzipSync, strToU8, strFromU8 } from 'fflate';

const PREFIX = 'cf:gzip:1:';
/** Small saves remain readable JSON. Large careers retain the same engine format. */
export async function encodeStoredSave(value: string): Promise<string> {
  if (value.length < 900_000) return value;
  const bytes = typeof CompressionStream === 'function'
    ? new Uint8Array(await new Response(new Blob([value]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer())
    : gzipSync(strToU8(value), { level: 6 });
  let binary = '';
  for (let i = 0; i < bytes.length; i += 16384) binary += String.fromCharCode(...bytes.subarray(i, i + 16384));
  const encoded = PREFIX + btoa(binary);
  return encoded.length < value.length ? encoded : value;
}

export async function decodeStoredSave(value: string): Promise<string> {
  if (!value.startsWith(PREFIX)) return value;
  const bytes = Uint8Array.from(atob(value.slice(PREFIX.length)), c => c.charCodeAt(0));
  if (typeof DecompressionStream === 'function') {
    return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
  }
  return strFromU8(gunzipSync(bytes));
}
