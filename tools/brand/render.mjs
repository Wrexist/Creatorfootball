/**
 * Rasteriser for the website's brand assets.
 *
 * The masters in this folder are HTML/SVG compositions, not binaries: `og.html`
 * draws the share card (a stadium at dusk with the wordmark on glass, the same
 * construction as the in-app `HeroScene`) and `icon.html` draws the volt-ball
 * mark that `website/favicon.svg` carries as vector. Both are deterministic —
 * the crowd scatter runs off a fixed seed — so re-running this produces the same
 * pixels rather than a slightly different card every time.
 *
 * Only the places that cannot take an SVG get a PNG or a JPEG: the Open Graph
 * card, the Android/PWA icon slot and the iOS home screen. Everything else on
 * the site points at `favicon.svg`.
 *
 *   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers \
 *     node tools/brand/render.mjs website
 */
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const here = process.env.CF_HTML_DIR ?? path.dirname(fileURLToPath(import.meta.url));
const out = process.argv[2];
if (!out) throw new Error('usage: node tools/brand/render.mjs <website-dir>');

const browser = await chromium.launch({
  executablePath: process.env.CF_CHROMIUM ?? '/opt/pw-browsers/chromium',
});

async function shot(file, { width, height, query = '', target, type = 'png', quality }) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.goto(`file://${path.join(here, file)}${query}`);
  await page.waitForTimeout(300);
  const buf = await page.screenshot({
    type,
    ...(type === 'jpeg' ? { quality } : {}),
    clip: { x: 0, y: 0, width, height },
  });
  fs.writeFileSync(path.join(out, target), buf);
  console.log(target, `${width}x${height}`, `${(buf.length / 1024).toFixed(1)} KB`);
  await page.close();
}

// Under the 300 KB share-card budget by a wide margin at q88; the composition is
// flat colour and gradients, which is exactly what JPEG is good at.
await shot('og.html', { width: 1200, height: 630, target: 'og-image.jpg', type: 'jpeg', quality: 88 });
// The PWA slot keeps a corner radius of its own; iOS applies its own mask, so
// the home-screen icon is square and full-bleed.
await shot('icon.html', { width: 192, height: 192, query: '?size=192&radius=42', target: 'icon-192.png' });
await shot('icon.html', { width: 180, height: 180, query: '?size=180&radius=0', target: 'apple-touch-icon.png' });

await browser.close();
