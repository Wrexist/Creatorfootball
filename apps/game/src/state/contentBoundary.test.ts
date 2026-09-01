import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The content pack is a lazy chunk, and it stays one only while exactly one
 * module reaches for it.
 *
 * The split failed once before: the engine and the pack referenced each other
 * at module scope, the bundler could not order the two chunks, and the
 * production page died on load while every unit test passed. What makes the
 * split safe now is a boundary, and boundaries erode one convenient import at
 * a time. This test reads the source and refuses the first one:
 *
 *  - no engine module outside `content/packs/` may import a pack;
 *  - no app module may import a pack, except the loader, and only dynamically;
 *  - the engine's barrels do not re-export a pack.
 *
 * Tests and the headless harness may import packs directly — they are
 * fixtures there, not a bundle — so they are outside the scan.
 */

const here = fileURLToPath(new URL('.', import.meta.url));
const APP_SRC = join(here, '..');
const ENGINE_SRC = join(here, '../../../../packages/engine/src');

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) { out.push(...sources(path)); continue; }
    if (!/\.tsx?$/.test(entry) || /\.test\.tsx?$/.test(entry)) continue;
    out.push(path);
  }
  return out;
}

const PACK_IMPORT = /import\s[^;]*?from\s+['"]([^'"]*content\/packs\/[^'"]*)['"]/g;
const PACK_REEXPORT = /export\s[^;]*?from\s+['"]([^'"]*packs\/[^'"]*)['"]/g;
const PACK_DYNAMIC = /import\(\s*['"]([^'"]*content\/packs\/[^'"]*)['"]\s*\)/g;

describe('the content pack boundary', () => {
  it('no engine module outside the packs imports a pack', () => {
    const offenders: string[] = [];
    for (const file of sources(ENGINE_SRC)) {
      if (file.includes('/content/packs/')) continue;
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(PACK_IMPORT)) offenders.push(`${relative(ENGINE_SRC, file)} -> ${m[1]}`);
      for (const m of text.matchAll(PACK_REEXPORT)) {
        // Type-only re-exports carry no runtime edge and are allowed.
        if (/^export\s+type\b/.test(m[0])) continue;
        offenders.push(`${relative(ENGINE_SRC, file)} re-exports ${m[1]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the app reaches the pack through the loader alone, and only lazily', () => {
    const offenders: string[] = [];
    const dynamic: string[] = [];
    for (const file of sources(APP_SRC)) {
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(PACK_IMPORT)) offenders.push(`${relative(APP_SRC, file)} -> ${m[1]}`);
      for (const m of text.matchAll(PACK_DYNAMIC)) dynamic.push(`${relative(APP_SRC, file)} -> ${m[1]}`);
    }
    expect(offenders).toEqual([]);
    expect(dynamic).toEqual(['state/content.ts -> @cf/engine/content/packs/base/index']);
  });

  it('no app module reads a pack constant from the engine barrel', () => {
    // The barrel no longer exports these; this guards against them coming back.
    const offenders: string[] = [];
    for (const file of sources(APP_SRC)) {
      const text = readFileSync(file, 'utf8');
      if (/\b(BASE_PACK|BASE_CLUBS|CLUB_LORE|BASE_NAME_BANK|COMMUNITY_EXAMPLE_PACK|LICENSED_EXAMPLE_PACK)\b/.test(text)) {
        if (file.endsWith('state/content.ts')) continue;
        offenders.push(relative(APP_SRC, file));
      }
    }
    expect(offenders).toEqual([]);
  });
});
