import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Every icon the product asks for is an icon the product ships.
 *
 * Unlike the art plates, an icon is *not* an optional override. A `<link
 * rel="icon">` that 404s does not fall back to anything — the browser shows
 * its own blank page glyph, an installed PWA gets a grey square, and none of
 * it fails a build or logs anything anyone reads. The mistake that produces it
 * is a one-character path typo, and it survives review because nobody notices
 * a favicon that was never there.
 *
 * So the rule this holds is narrow and mechanical: for every icon *referenced*
 * by the shell HTML or the web manifest, the file exists. It is the check that
 * `tools/brand/icons.mjs` and the markup have not drifted apart, and the only
 * thing standing between a renamed slot and a silently iconless app.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const gameRoot = path.resolve(here, '..', '..', '..');
const repoRoot = path.resolve(gameRoot, '..', '..');
const publicDir = path.join(gameRoot, 'public');

/** Every `href`/`src` in `markup` that points at something under `/`. */
function referencedPaths(markup: string): string[] {
  return [...markup.matchAll(/(?:href|src)="(\/[^"]+)"/g)]
    .map((m) => m[1] ?? '')
    // Vite resolves the entry module from source; only static files are ours.
    .filter((href) => !href.startsWith('/src/'));
}

describe('the game shell icon set', () => {
  const html = readFileSync(path.join(gameRoot, 'index.html'), 'utf8');

  it('ships every file index.html references', () => {
    const referenced = referencedPaths(html);
    expect(referenced.length).toBeGreaterThan(0);
    for (const href of referenced) {
      expect(existsSync(path.join(publicDir, href)), `index.html references ${href}, which is not in public/`)
        .toBe(true);
    }
  });

  it('declares an icon at all', () => {
    // The shell shipped without a single icon link for long enough that its
    // absence read as intentional. It was not.
    expect(html).toMatch(/<link rel="icon"/);
    expect(html).toMatch(/<link rel="apple-touch-icon"/);
    expect(html).toMatch(/<link rel="manifest"/);
  });

  it('keeps a favicon.ico at the root for the clients that ask by name', () => {
    // Deliberately unlinked: nothing references it, it is requested by
    // convention, and a missing one shows up as a 404 in every server log.
    expect(existsSync(path.join(publicDir, 'favicon.ico'))).toBe(true);
  });

  it('ships every icon the web manifest lists, at the size it claims', () => {
    const manifest = JSON.parse(readFileSync(path.join(publicDir, 'manifest.webmanifest'), 'utf8')) as {
      icons: { src: string; sizes: string; purpose?: string }[];
    };
    expect(manifest.icons.length).toBeGreaterThan(0);
    for (const icon of manifest.icons) {
      const file = path.join(publicDir, icon.src);
      expect(existsSync(file), `the manifest lists ${icon.src}, which is not in public/`).toBe(true);
      // The PNG header carries the real dimensions; a slot renamed without
      // being re-derived would still exist and still be the old size.
      const header = readFileSync(file).subarray(16, 24);
      const declared = Number(icon.sizes.split('x')[0]);
      expect(header.readUInt32BE(0), `${icon.src} is not ${icon.sizes}`).toBe(declared);
      expect(header.readUInt32BE(4), `${icon.src} is not ${icon.sizes}`).toBe(declared);
    }
  });

  it('offers a maskable icon, so Android does not letterbox the mark', () => {
    const manifest = JSON.parse(readFileSync(path.join(publicDir, 'manifest.webmanifest'), 'utf8')) as {
      icons: { purpose?: string }[];
    };
    expect(manifest.icons.some((i) => i.purpose === 'maskable')).toBe(true);
  });
});

describe('the marketing site icon set', () => {
  const pages = ['index', 'creators', 'privacy', 'support', 'terms'];

  it.each(pages)('%s.html references only files the site ships', (page) => {
    const file = path.join(repoRoot, 'website', `${page}.html`);
    const markup = readFileSync(file, 'utf8');
    const icons = [...markup.matchAll(/<link rel="(?:icon|apple-touch-icon)"[^>]*href="([^"]+)"/g)]
      .map((m) => m[1] ?? '');
    expect(icons.length, `${page}.html declares no icon`).toBeGreaterThan(0);
    for (const href of icons) {
      expect(existsSync(path.join(repoRoot, 'website', href)), `${page}.html references ${href}`)
        .toBe(true);
    }
  });

  it('points every page at the same icons', () => {
    // Five pages hand-editing their own `<head>` is exactly how a site ends up
    // with two marks. They are identical or this fails.
    const sets = pages.map((page) => {
      const markup = readFileSync(path.join(repoRoot, 'website', `${page}.html`), 'utf8');
      return [...markup.matchAll(/<link rel="(?:icon|apple-touch-icon)"[^>]*href="([^"]+)"/g)]
        .map((m) => m[1] ?? '')
        .join(',');
    });
    expect(new Set(sets).size).toBe(1);
  });
});
