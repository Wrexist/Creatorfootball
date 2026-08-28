/**
 * Store screenshot drafts, from the real bundle.
 *
 * Renders the built app in Chromium at exactly the App Store's required 6.9"
 * iPhone size — 1290×2796, produced as a 430×932 CSS viewport at 3x — walks
 * through club creation the same way e2e/smoke.mjs does, and captures every
 * main route. Output lands in tools/release/store-shots/ (gitignored).
 *
 * These are DRAFT CANDIDATES for docs/APP_STORE.md §5, not the final set:
 * the conversion-ranked shots there want a played save behind them (a 2–2
 * matchday with the decision sheet up, a late-season table, a reacting feed),
 * which a fresh save cannot show. Capture those moments manually from a real
 * session, at the same size; this tool guarantees the size, the frame and a
 * repeatable baseline. Final picks go in apps/game/fastlane/screenshots/en-US/
 * and ship via the "App Store metadata" workflow.
 *
 * Usage: node tools/release/store-shots.mjs   (after `pnpm build`, or via
 *        `pnpm shots:store` at the repo root, which builds first)
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const GAME_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'apps', 'game');
const OUT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'store-shots');
const BASE = 'http://127.0.0.1:4181';
const READY_TIMEOUT_MS = 30_000;

// 430×932 @3x = 1290×2796, the 6.9" iPhone portrait size App Store Connect
// requires (it derives the smaller iPhone sets from this one).
const VIEWPORT = { width: 430, height: 932 };
const SCALE = 3;

// Route → filename. Numbered to match the conversion ranking in
// docs/APP_STORE.md §5 where a route can carry it; drafts only.
const SHOTS = [
  ['/matchday', '01_matchday'],
  ['/home', '02_home'],
  ['/market', '03_market'],
  ['/social', '05_social'],
  ['/league', '06_league'],
  ['/squad', '07_squad'],
  ['/club', '08_club'],
];

if (!fs.existsSync(path.join(GAME_DIR, 'dist', 'index.html'))) {
  console.error('[store-shots] apps/game/dist is missing — run `pnpm build` first (or `pnpm shots:store`).');
  process.exit(1);
}
fs.mkdirSync(OUT_DIR, { recursive: true });

const preview = spawn('npx vite preview --port 4181 --strictPort', {
  cwd: GAME_DIR,
  shell: true,
  stdio: 'ignore',
});

function killPreview() {
  if (!preview.pid) return;
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(preview.pid), '/f', '/t'], { stdio: 'ignore' });
  } else {
    preview.kill('SIGTERM');
  }
}

async function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      // Not up yet; keep polling until the deadline.
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

// Same drive-through as e2e/smoke.mjs: click the footer action forward,
// filling whatever the current creation step asks for.
async function walkClubCreation(page) {
  const footerState = () => page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].pop();
    return { txt: b?.innerText.trim().replace(/\n/g, ' ') ?? '', disabled: Boolean(b?.disabled) };
  });

  const start = page.getByRole('button', { name: /start your career|continue/i }).first();
  if (await start.count()) { await start.click(); await page.waitForTimeout(1400); }

  for (let step = 0; step < 14; step++) {
    const s = await footerState();
    if (!s.disabled) {
      await page.locator('button').last().click();
      await page.waitForTimeout(1400);
      if (page.url().includes('/home') || page.url().includes('/matchday')) break;
      continue;
    }
    if (/name your club/i.test(s.txt)) {
      const i = await page.$$('input'); if (i[0]) { await i[0].click(); await i[0].type('Union Creators', { delay: 8 }); }
    } else if (/city/i.test(s.txt)) {
      const i = await page.$$('input'); const t = i[1] ?? i[0]; if (t) { await t.click(); await t.type('Northbridge', { delay: 8 }); }
    } else if (/name/i.test(s.txt)) {
      const i = await page.$$('input'); if (i[0]) { await i[0].click(); await i[0].type('Alex Mercer', { delay: 8 }); }
    } else if (/archetype|manager/i.test(s.txt)) {
      const c = page.getByRole('button', { name: /tactician|motivator|showman/i }).first();
      if (await c.count()) await c.click();
    } else if (/club|philosoph|culture/i.test(s.txt)) {
      const c = page.locator('button').nth(4);
      if (await c.count()) await c.click();
    } else break;
    await page.waitForTimeout(600);
  }
}

const CHROME = process.env.CHROMIUM_PATH || undefined;
const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});
const ctx = await browser.newContext({
  viewport: VIEWPORT,
  deviceScaleFactor: SCALE,
  isMobile: true,
  hasTouch: true,
});
const page = await ctx.newPage();

try {
  if (!(await waitForServer(BASE, READY_TIMEOUT_MS))) {
    console.error(`[store-shots] preview server never answered at ${BASE} within ${READY_TIMEOUT_MS / 1000}s`);
    process.exit(1);
  }

  console.log(`\nCapturing store screenshot drafts at ${VIEWPORT.width}×${VIEWPORT.height} @${SCALE}x → 1290×2796\n`);

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await walkClubCreation(page);

  for (const [route, name] of SHOTS) {
    await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
    // Let entrance animations settle — a half-faded card is not a screenshot.
    await page.waitForTimeout(2200);
    const file = path.join(OUT_DIR, `${name}.png`);
    await page.screenshot({ path: file });
    console.log(`  saved ${path.relative(process.cwd(), file)}`);
  }

  console.log(`\nDone. Drafts in ${path.relative(process.cwd(), OUT_DIR)} — see apps/game/fastlane/screenshots/README.md for what happens next.\n`);
} finally {
  await browser.close().catch(() => {});
  killPreview();
}
