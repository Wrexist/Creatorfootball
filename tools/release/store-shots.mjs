/**
 * Store screenshot capture, from the real bundle, on a real played save.
 *
 * Renders the built app in Chromium at exactly the App Store's required 6.9"
 * iPhone size — 1290×2796, produced as a 430×932 CSS viewport at 3x — and
 * drives it far enough that the screens have something worth photographing.
 *
 * The first version of this tool walked club creation and then screenshotted
 * the routes on a fresh save. That produced an empty league table, a social
 * feed with nothing in it, and (because it picked the club by DOM position) a
 * save at Cinderwick Town — squad strength 57 of twelve clubs, losing 7-1 and
 * sitting in the relegation places. Honest, and useless as a store listing:
 * docs/APP_STORE.md §5 ranks these shots by conversion and asks for a
 * late-season table and a feed reacting to a result.
 *
 * So this plays the game instead. It picks the manager and club BY NAME
 * (default Marrowgate Athletic, the "Favourite" — a club whose season looks
 * like a title race rather than a relegation fight), simulates most of a
 * 22-week season, then plays one match live to catch the two moments that
 * only exist mid-match: the pitch, and the decision sheet with its countdown
 * ring still running.
 *
 * These remain DRAFT CANDIDATES, deliberately. Apple requires screenshots to
 * show the real product (guideline 2.3.1) and these do, but which frame sells
 * the game is a judgement call — cull, reorder and caption them per
 * docs/APP_STORE.md §5, then move the keepers to
 * apps/game/fastlane/screenshots/en-US/ as described in the README there.
 * Nothing here uploads anything.
 *
 * Usage (from the repo root, after `pnpm build`, or via `pnpm shots:store`):
 *   node tools/release/store-shots.mjs [--club "Larkspur Wolves"] [--weeks 16]
 *
 *   --club <name>   Club to take over. Any of the three offered on the club
 *                   screen: Marrowgate Athletic, Larkspur Wolves, Cinderwick
 *                   Town. Default: Marrowgate Athletic.
 *   --weeks <n>     Fixtures to simulate before capturing, of 22. Default 16
 *                   — far enough that the table reads as a run-in.
 *   --keep-open     Leave the preview server up on exit (debugging).
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GAME_DIR = path.resolve(HERE, '..', '..', 'apps', 'game');
const OUT_DIR = path.resolve(HERE, 'store-shots');
const PORT = 4181;
const BASE = `http://127.0.0.1:${PORT}`;
const READY_TIMEOUT_MS = 30_000;

// 430×932 @3x = 1290×2796, the 6.9" iPhone portrait size App Store Connect
// requires (it derives the smaller iPhone sets from this one).
const VIEWPORT = { width: 430, height: 932 };
const SCALE = 3;

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const CLUB = flag('club', 'Marrowgate Athletic');
const WEEKS = Number(flag('weeks', '16'));
const KEEP_OPEN = argv.includes('--keep-open');

if (!Number.isFinite(WEEKS) || WEEKS < 0 || WEEKS > 21) {
  console.error(`[store-shots] --weeks must be 0..21 (a season is 22 fixtures); got "${flag('weeks', '')}".`);
  process.exit(1);
}
if (!fs.existsSync(path.join(GAME_DIR, 'dist', 'index.html'))) {
  console.error('[store-shots] apps/game/dist is missing — run `pnpm build` first (or use `pnpm shots:store`).');
  process.exit(1);
}
fs.mkdirSync(OUT_DIR, { recursive: true });

const preview = spawn(`npx vite preview --port ${PORT} --strictPort`, {
  cwd: GAME_DIR, shell: true, stdio: 'ignore',
});
function killPreview() {
  if (KEEP_OPEN || !preview.pid) return;
  if (process.platform === 'win32') spawn('taskkill', ['/pid', String(preview.pid), '/f', '/t'], { stdio: 'ignore' });
  else preview.kill('SIGTERM');
}

async function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { if ((await fetch(url)).ok) return true; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

const CHROME = process.env.CHROMIUM_PATH || undefined;
const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});
const ctx = await browser.newContext({
  viewport: VIEWPORT, deviceScaleFactor: SCALE, isMobile: true, hasTouch: true,
});
const page = await ctx.newPage();

const saved = [];
async function shot(name) {
  const file = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: file });
  saved.push(name);
  console.log(`  saved ${name}.png`);
}

const footerBtn = () => page.locator('button').last();
const footerDisabled = async () => footerBtn().isDisabled().catch(() => false);

/** Click the option whose text matches, among everything but the footer. */
async function chooseOption(rx) {
  const opts = page.locator('button');
  const n = await opts.count();
  for (let i = 0; i < n - 1; i++) {
    const t = ((await opts.nth(i).innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
    if (t && rx.test(t)) { await opts.nth(i).click(); await page.waitForTimeout(700); return true; }
  }
  return false;
}

/**
 * Walk manager → club → squad. Each step gates its footer until something is
 * picked, so this selects deliberately (by name where it matters) rather than
 * clicking whatever sits at a given index — the positional guess is what
 * silently chose the league's weakest club before.
 */
async function createCareer() {
  const start = page.getByRole('button', { name: /start your career|continue/i }).first();
  if (await start.count()) { await start.click(); await page.waitForTimeout(1400); }

  for (let step = 0; step < 8; step++) {
    if (/\/home|\/matchday/.test(page.url())) return;

    if (await footerDisabled()) {
      const url = page.url();
      let picked = false;
      if (url.includes('/create/club')) {
        picked = await chooseOption(new RegExp(CLUB.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
        if (!picked) {
          // The three featured clubs are the fast path; the rest hide behind
          // "All twelve". Open it and try once more before giving up.
          await chooseOption(/all twelve/i);
          picked = await chooseOption(new RegExp(CLUB.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
          if (!picked) throw new Error(`club "${CLUB}" not offered on the club screen`);
        }
        console.log(`  club: ${CLUB}`);
      } else {
        // Manager, squad, and anything else: the first real option is fine —
        // none of them change whether a screenshot is worth shipping.
        picked = await chooseOption(/\S/);
      }
      // Some steps ask for typed input rather than a choice.
      if (!picked || (await footerDisabled())) {
        const inputs = await page.$$('input');
        if (inputs[0]) { await inputs[0].click(); await inputs[0].type('Union Creators', { delay: 6 }); }
        if (inputs[1]) { await inputs[1].click(); await inputs[1].type('Northbridge', { delay: 6 }); }
        await page.waitForTimeout(400);
      }
      if (await footerDisabled()) throw new Error(`stuck on ${url} — footer still disabled`);
    }

    await footerBtn().click();
    await page.waitForTimeout(1600);
  }
}

/** Simulate one fixture and clear the result screen. Returns false when done. */
async function simulateOneWeek() {
  await page.goto(`${BASE}/matchday`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  const sim = page.getByRole('button', { name: /^simulate$/i }).first();
  if (!(await sim.count())) return false;
  await sim.click();
  await page.waitForTimeout(2600);
  const cont = page.getByRole('button', { name: /^continue$/i }).first();
  if (await cont.count()) { await cont.click(); await page.waitForTimeout(1500); }
  return true;
}

/**
 * Play a fixture live, capturing the two frames that exist only during a
 * match. The decision sheet is on a real countdown driven by wall-clock time
 * — pausing does not stop it — so this polls fast and shoots the moment the
 * ring appears rather than trying to hold the prompt open.
 */
async function playLiveAndCapture() {
  await page.goto(`${BASE}/matchday`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const play = page.getByRole('button', { name: /^play$/i }).first();
  if (!(await play.count())) { console.log('  ! no Play button — skipping live capture'); return; }
  await play.click();
  await page.waitForTimeout(3000);

  const decisionUp = () => page.evaluate(() =>
    [...document.querySelectorAll('svg')].some((s) => s.classList.contains('-rotate-90')));

  let gotPitch = false, gotDecision = false;
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline && !(gotPitch && gotDecision)) {
    if (!gotDecision && (await decisionUp())) {
      await shot('01_matchday_decision');
      gotDecision = true;
      continue;
    }
    if (!gotPitch && Date.now() > deadline - 84_000) {
      // A few seconds in: the scoreline and feed have something in them, and
      // no prompt is covering the pitch.
      if (!(await decisionUp())) { await shot('04_pitch_live'); gotPitch = true; }
    }
    await page.waitForTimeout(140);
  }
  if (!gotDecision) console.log('  ! no decision prompt appeared within 90s (match may have ended first)');
  if (!gotPitch) console.log('  ! did not catch a clean pitch frame');

  // Finish the match so the feed and table reflect a played result.
  for (const rx of [/^skip$/i, /skip to end/i]) {
    const b = page.getByRole('button', { name: rx }).first();
    if (await b.count()) { await b.click(); await page.waitForTimeout(2600); break; }
  }
  const cont = page.getByRole('button', { name: /^continue$/i }).first();
  if (await cont.count()) { await cont.click(); await page.waitForTimeout(1800); }
}

async function captureRoute(route, name, settleMs = 2200) {
  await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
  // Entrance animations: a half-faded card is not a screenshot.
  await page.waitForTimeout(settleMs);
  await shot(name);
}

try {
  if (!(await waitForServer(BASE, READY_TIMEOUT_MS))) {
    console.error(`[store-shots] preview server never answered at ${BASE} within ${READY_TIMEOUT_MS / 1000}s`);
    process.exit(1);
  }

  console.log(`\nStore screenshots — ${VIEWPORT.width}×${VIEWPORT.height} @${SCALE}x = 1290×2796`);
  console.log(`Club: ${CLUB} · simulating ${WEEKS} of 22 fixtures before capture\n`);

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);
  await createCareer();

  // The transfer window shuts later in the season, and the Market screen then
  // reads "Nothing can be signed" — true, and the worst possible frame to sit
  // under a headline about signing players. Capture it now, while it is open.
  await captureRoute('/market', '03_market');

  process.stdout.write('  simulating season');
  for (let w = 0; w < WEEKS; w++) {
    if (!(await simulateOneWeek())) { console.log(`\n  ! season ended early at week ${w}`); break; }
    process.stdout.write('.');
  }
  console.log('');

  // The two in-match frames first: they need a fixture still to play.
  await playLiveAndCapture();

  // Then everything that reads better with a season behind it. Names follow
  // the conversion ranking in docs/APP_STORE.md §5.
  await captureRoute('/home', '02_home');
  await captureRoute('/social', '05_social');
  await captureRoute('/league', '06_league');
  await captureRoute('/squad/training', '07_training');
  await captureRoute('/club', '08_club');

  console.log(`\n${saved.length} screenshots in ${path.relative(process.cwd(), OUT_DIR)}`);
  console.log('Next: cull and caption per docs/APP_STORE.md §5, then move the keepers to');
  console.log('apps/game/fastlane/screenshots/en-US/ — see the README there.\n');
} finally {
  await browser.close().catch(() => {});
  killPreview();
}
