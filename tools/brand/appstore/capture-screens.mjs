/**
 * Captures the real in-game screens the search results asset is built from.
 * They are screenshots of the shipping web build, never mock-ups, so Apple's
 * "show the firsthand experience" rule holds by construction.
 *
 *   pnpm build && (cd apps/game && npx vite preview --port 4173 --host 127.0.0.1 &)
 *   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers \
 *     node tools/brand/appstore/capture-screens.mjs [http://127.0.0.1:4173]
 *
 * Writes 1179 × 2556 (iPhone 393 × 852 pt @3x) JPEGs to `screens/`. The match
 * engine is seeded per career, so a re-capture can land on a different live
 * decision; check the frames before re-rendering.
 */
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const base = process.argv[2] ?? 'http://127.0.0.1:4173';
const browser = await chromium.launch({ executablePath: process.env.CF_CHROMIUM ?? '/opt/pw-browsers/chromium' });
try {
  const context = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3 });
  context.setDefaultTimeout(30000);
  const page = await context.newPage();
  const shot = async (name, settle = 1500) => {
    await page.waitForTimeout(settle);
    await page.screenshot({ path: path.join(here, 'screens', `${name}.jpg`), type: 'jpeg', quality: 92 });
    console.log(`screens/${name}.jpg`);
  };

  await page.goto(base);
  await page.getByRole('button', { name: 'Start your career', exact: true }).click();
  await page.getByRole('button', { name: /Vera Lindqvist/ }).click();
  await page.getByRole('button', { name: 'Next: your club', exact: true }).click();
  await page.getByRole('button', { name: /Larkspur Wolves of/ }).click();
  await page.getByRole('button', { name: 'Take over Larkspur', exact: true }).click();
  await page.getByRole('button', { name: 'Meet your squad', exact: true }).click();
  await page.goto(`${base}/matchday`);
  await page.getByRole('button', { name: 'Play Match', exact: true }).click();
  await page.getByRole('button', { name: 'Pause', exact: true }).waitFor();
  await shot('live-match', 2500);
  // The first live decision: wait for the sheet, then for its entrance to settle.
  await page.getByText(/· your call/i).waitFor({ timeout: 60000 });
  await shot('your-call', 1800);
} finally {
  await browser.close();
}
