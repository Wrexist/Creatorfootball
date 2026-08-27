import { describe, expect, it } from 'vitest';
// @ts-expect-error - the ingest manifest is untyped ESM JavaScript. Importing
// the real file is the entire point: a typed copy of it here could drift from
// the thing that actually writes the bytes, which is the bug being guarded.
import { ASSETS } from '../../../../../tools/brand/assets.manifest.mjs';
import { ART_ASSETS } from './assets';
import { artImage, resetArtImages } from './loadArt';

/**
 * The registry and the ingest manifest are two halves of one contract.
 *
 * `tools/brand/README.md` names the exact failure this guards: a typo in a
 * destination path "silently means 'no override', which looks identical to
 * 'asset not made yet'". Both states render the procedural fallback, so
 * nothing is visibly broken and the mistake can survive review indefinitely.
 * A string equality check is the only thing standing between a renamed asset
 * and an override that never loads again.
 */

interface ManifestAsset { id: string; dest: string }

const manifest = ASSETS as ManifestAsset[];

describe('generated-art registry', () => {
  it('points every entry at a path the ingest manifest actually writes', () => {
    const written = new Set(
      manifest.map((asset) => `/${asset.dest.replace(/^apps\/game\/public\//, '')}`),
    );

    for (const [name, url] of Object.entries(ART_ASSETS)) {
      expect(written, `${name} -> ${url} is not a destination in assets.manifest.mjs`)
        .toContain(url);
    }
  });

  it('serves every asset from the public root, not a bundled import', () => {
    // These are fetched at runtime and must 404 cleanly when absent. A bundled
    // import would fail the build instead, which is the load-bearing failure
    // mode the whole override layer exists to avoid.
    for (const url of Object.values(ART_ASSETS)) {
      expect(url.startsWith('/art/')).toBe(true);
    }
  });

  it('has no duplicate destinations', () => {
    const urls = Object.values(ART_ASSETS);
    expect(new Set(urls).size).toBe(urls.length);
  });
});

describe('artImage in an environment with no image decoder', () => {
  // The pitch renderer calls this every frame from inside requestAnimationFrame.
  // If it can throw, it takes the whole match render down with it - which is the
  // precise failure the override layer exists to make impossible.
  it('returns null rather than throwing', () => {
    resetArtImages();
    expect(() => artImage(ART_ASSETS.ball)).not.toThrow();
    expect(artImage(ART_ASSETS.ball)).toBeNull();
  });

  it('stays null across repeated calls, as a render loop would make', () => {
    resetArtImages();
    for (let i = 0; i < 120; i += 1) expect(artImage(ART_ASSETS.ball)).toBeNull();
  });
});
