/**
 * Rasteriser for the App Store creative assets (iOS 27 product page header and
 * search results placement). Each composition is a deterministic HTML/canvas
 * master in this folder; this screenshots it at its exact pixel size.
 *
 *   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers \
 *     node tools/brand/appstore/render.mjs <out-dir> [--scale 0.5] [--only header]
 *
 * `--scale` renders a proportionally smaller proof (the compositions scale
 * themselves); omit it for the upload files. App Store Connect rejects images
 * with an alpha channel, so every PNG is checked to be opaque 8-bit RGB.
 */
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i < 0 ? null : args.splice(i, 2)[1]; };
const scale = Number(flag('--scale') ?? 1);
const only = flag('--only');
const out = args[0];
if (!out) throw new Error('usage: node tools/brand/appstore/render.mjs <out-dir> [--scale k] [--only name]');
fs.mkdirSync(out, { recursive: true });

const mark = fs.readFileSync(path.join(here, '..', 'mark.path.txt'), 'utf8').trim();
const ASSETS = [
  { name: 'header', file: 'header.html', width: 3840, height: 1646 },
  { name: 'search-results', file: 'search.html', width: 3840, height: 2560 },
];

const browser = await chromium.launch({
  executablePath: process.env.CF_CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--allow-file-access-from-files'],
});
for (const a of ASSETS) {
  if (only && a.name !== only) continue;
  const width = Math.round(a.width * scale), height = Math.round(a.height * scale);
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error(a.name, e));
  page.on('console', (m) => m.type() === 'error' && console.error(a.name, m.text()));
  await page.addInitScript((d) => { window.CF_MARK = d; }, mark);
  await page.goto(`file://${path.join(here, a.file)}?scale=${scale}`);
  await page.waitForSelector('body[data-ready="1"]', { state: 'attached', timeout: 120000 });
  await page.waitForTimeout(200);
  const target = path.join(out, `${a.name}.png`);
  const buf = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width, height } });
  // IHDR: bit depth at byte 24, colour type at 25 (2 = RGB, 6 = RGBA).
  if (buf[24] !== 8 || buf[25] !== 2) throw new Error(`${a.name}: expected opaque 8-bit RGB, got depth ${buf[24]} type ${buf[25]}`);
  fs.writeFileSync(target, buf);
  console.log(`${a.name}.png`, `${width}x${height}`, `${(buf.length / 1024 / 1024).toFixed(2)} MB`);
  await page.close();
}
await browser.close();
