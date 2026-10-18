/* global URL, console, process */
/**
 * iPhone Duo App Store screenshots, captured from the real production bundle.
 *
 * App Store Connect accepts iPhone Duo screenshots at exactly:
 *   outer display  1398 x 2034 (portrait)  ->  466 x 678 CSS at 3x
 *   inner display  2853 x 2007 (landscape) ->  951 x 669 CSS at 3x
 * Logical viewport x scale lands on those pixels, so nothing is resampled.
 * The inner set is landscape on purpose: that is how the unfolded device is
 * held, and it shows the side-rail, two-column layout.
 *
 * Same eight screens, same order, as the current iPhone listing
 * (docs/STORE_SETUP_STATUS.md): Home, Stadium, Live Match, Tactics, Market,
 * Squad, Social, Training. One fresh career with real simulated progression is
 * shared by both sizes; nothing is injected into game state. JPEG, because
 * Apple rejects images with an alpha channel.
 *
 * Usage (after `pnpm build`), from apps/game:
 *   node scripts/duo-screenshots.mjs [outDir]
 * Default outDir: ../../artifacts/store-launch/duo
 */
import { preview } from 'vite';
import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const OUT = resolve(process.argv[2] ?? fileURLToPath(new URL('../../../artifacts/store-launch/duo', import.meta.url)));
const SIZES = [
  { name: 'iphone-duo-outer-1398x2034', viewport: { width: 466, height: 678 }, pixels: [1398, 2034] },
  { name: 'iphone-duo-inner-2853x2007', viewport: { width: 951, height: 669 }, pixels: [2853, 2007] },
];
const SCALE = 3;
const SIMULATED_MATCHES = 3;

const server = await preview({ preview: { host: '127.0.0.1', port: 0, strictPort: true } });
const address = server.httpServer.address();
if (!address || typeof address === 'string') throw new Error('Preview did not bind a TCP port.');
const BASE = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});

const settle = (page, ms = 1500) => page.waitForTimeout(ms);
async function go(page, path, ms) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
  await settle(page, ms);
}

/** JPEG SOF0/SOF2 dimensions, to prove every file is exactly Apple's size. */
function jpegSize(buffer) {
  let i = 2;
  while (i < buffer.length) {
    if (buffer[i] !== 0xff) { i += 1; continue; }
    const marker = buffer[i + 1];
    const length = buffer.readUInt16BE(i + 2);
    if (marker === 0xc0 || marker === 0xc2) return [buffer.readUInt16BE(i + 7), buffer.readUInt16BE(i + 5)];
    i += 2 + length;
  }
  throw new Error('No JPEG frame header found.');
}

try {
  // --- one career, with a few results behind it ------------------------
  const setup = await browser.newContext({ viewport: SIZES[0].viewport });
  const page = await setup.newPage();
  await go(page, '/', 2500);
  await page.getByRole('button', { name: 'Start your career', exact: true }).click();
  await page.getByRole('button', { name: /Vera Lindqvist/ }).click();
  await page.getByRole('button', { name: 'Next: your club', exact: true }).click();
  await page.getByRole('button', { name: /Larkspur Wolves of/ }).click();
  await page.getByRole('button', { name: 'Take over Larkspur', exact: true }).click();
  await page.getByRole('button', { name: 'Meet your squad', exact: true }).click();
  await go(page, '/home');
  await page.getByTestId('premium-home').waitFor();

  for (let played = 0; played < SIMULATED_MATCHES; played += 1) {
    await go(page, '/home');
    await page.getByRole('button', { name: 'Prepare Match' }).click();
    await page.getByRole('button', { name: 'Simulate', exact: true }).click();
    await page.waitForURL(/\/matchday\/result\//, { timeout: 60_000 });
    await settle(page, 2000);
  }
  const state = await setup.storageState();
  await setup.close();

  // --- the same eight screens at each Duo size -------------------------
  for (const size of SIZES) {
    const dir = resolve(OUT, size.name);
    await mkdir(dir, { recursive: true });
    const context = await browser.newContext({
      storageState: state, viewport: size.viewport, deviceScaleFactor: SCALE,
      isMobile: true, hasTouch: true, reducedMotion: 'no-preference',
    });
    const shot = await context.newPage();
    const errors = [];
    shot.on('pageerror', (e) => errors.push(String(e)));
    const capture = async (index, name) => {
      const file = resolve(dir, `${String(index).padStart(2, '0')}-${name}.jpg`);
      await shot.screenshot({ path: file, type: 'jpeg', quality: 92 });
      const [w, h] = jpegSize(await readFile(file));
      if (w !== size.pixels[0] || h !== size.pixels[1]) {
        throw new Error(`${file} is ${w}x${h}, expected ${size.pixels.join('x')}`);
      }
      console.log(`  ${size.name}/${index}-${name}.jpg  ${w}x${h}`);
      return file;
    };

    await go(shot, '/home');
    await shot.getByTestId('premium-home').waitFor();
    await capture(1, 'home');

    // The 3D campus only starts when asked; the model is ready once the
    // viewer stamps data-model on its stage.
    await go(shot, '/club/3d', 1000);
    await shot.getByRole('button', { name: 'Open interactive 3D' }).click();
    await shot.locator('[data-model]').first().waitFor({ state: 'attached', timeout: 45_000 });
    await settle(shot, 2000);
    await capture(2, 'stadium');

    await go(shot, '/squad/tactics');
    await capture(4, 'tactics');
    await go(shot, '/market');
    await capture(5, 'market');
    await go(shot, '/squad');
    await capture(6, 'squad');
    await go(shot, '/social');
    await capture(7, 'social');
    await go(shot, '/squad/training');
    await capture(8, 'training');

    // Live match last: kicking off changes the career.
    await go(shot, '/home');
    await shot.getByRole('button', { name: 'Prepare Match' }).click();
    await shot.getByRole('button', { name: 'Play Match', exact: true }).click();
    await shot.locator('section[aria-label="Live pitch"] canvas').waitFor({ timeout: 30_000 });
    // Catch the decision sheet if one opens within the first half; otherwise
    // the live pitch with its feed is the frame.
    await shot.getByText('Your call', { exact: false }).first()
      .waitFor({ timeout: 45_000 }).catch(() => undefined);
    await settle(shot, 1200);
    await capture(3, 'live-match');

    if (errors.length > 0) throw new Error(`${size.name}: ${errors.length} runtime error(s): ${errors[0]}`);
    await context.close();
  }

  await writeFile(resolve(OUT, 'manifest.json'), `${JSON.stringify({
    captured: new Date().toISOString().slice(0, 10),
    source: 'Production web bundle in Chromium; fresh career with simulated matches; no injected state.',
    order: ['home', 'stadium', 'live-match', 'tactics', 'market', 'squad', 'social', 'training'],
    sizes: SIZES.map(({ name, viewport, pixels }) => ({ name, viewportCss: viewport, scale: SCALE, pixels })),
  }, null, 2)}\n`);
  console.log(`\nDuo screenshots written to ${OUT}`);
} finally {
  await browser.close();
  await new Promise((done, fail) => server.httpServer.close((error) => (error ? fail(error) : done())));
}
