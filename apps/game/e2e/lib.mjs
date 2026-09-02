/**
 * Shared harness for the browser suites that simulate the content universe
 * failing to arrive.
 *
 * Failure is simulated deterministically with request interception: the
 * content chunk's request is aborted, held, or let through, per scenario. No
 * app code knows it is being tested, and nothing depends on a real network.
 */
import { chromium } from 'playwright';

export const VIEWPORT = { width: 393, height: 852 };
export const OPTION = 'button[aria-pressed="false"]';
export const CONTENT_CHUNK = /\/assets\/content-[^/]*\.js/;
/** Words a player must never read. */
export const JARGON = /\b(chunk|module|import|registry|validation|initiali[sz]|undefined|TypeError|Error:|attempt \d)\b/i;

export function createSuite(title, base) {
  const failures = [];
  const fail = (msg) => { failures.push(msg); console.log(`  FAIL  ${msg}`); };
  const pass = (msg) => console.log(`  PASS  ${msg}`);
  let browser = null;

  /**
   * One scenario = one fresh browser context, with its own storage, its own
   * console, and its own switch on the content chunk.
   *
   * `mode` decides what happens to a content request: 'abort' fails it,
   * 'hold' parks it until `release()`, 'pass' lets it through. Requests are
   * counted whatever happens to them.
   */
  async function scenario(name, run) {
    browser ??= await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
    const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${String(e)}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });

    const chunk = { mode: 'pass', requests: 0, held: [] };
    await page.route(CONTENT_CHUNK, (route) => {
      chunk.requests += 1;
      if (chunk.mode === 'abort') return route.abort('failed');
      if (chunk.mode === 'hold') { chunk.held.push(route); return undefined; }
      return route.continue();
    });
    chunk.release = () => { for (const r of chunk.held.splice(0)) void r.continue(); };

    /**
     * Errors a deliberate content failure is allowed to produce: the browser's
     * own report of the blocked request, and the loader's one line saying so.
     * Anything else — an uncaught exception, an unhandled rejection, a React
     * error — is a bug.
     */
    const unexpected = () => errors.filter((e) =>
      !/favicon|404/i.test(e)
      && !/net::ERR_FAILED|Failed to fetch dynamically imported module|Failed to load resource|preloadError|\[content\] load failed|Importing a module script failed|error loading dynamically imported module/i.test(e));

    const text = () => page.evaluate(() => document.body.innerText);
    const notBlank = async (step) => {
      const body = (await text()).trim();
      const controls = await page.locator('button:visible, input:visible').count();
      if (body.length < 20 || controls === 0) fail(`${name}: blank screen at ${step} (${body.length} chars, ${controls} controls)`);
    };
    const check = (ok, msg) => { if (!ok) fail(`${name}: ${msg}`); return ok; };

    try {
      await run({ page, chunk, errors, unexpected, text, notBlank, check });
    } catch (e) {
      fail(`${name}: ${String(e).split('\n').slice(0, 2).join(' ').slice(0, 240)}`);
    } finally {
      await ctx.close();
    }
  }

  async function finish() {
    if (browser) await browser.close();
    if (failures.length > 0) {
      console.log(`\n[X] ${failures.length} ${title} check(s) failed\n`);
      process.exit(1);
    }
    console.log(`\n[OK] ${title} passed\n`);
  }

  console.log(`\n${title[0].toUpperCase()}${title.slice(1)} against ${base}\n`);
  return { scenario, pass, fail, finish };
}

/** What the app has actually written, read the way the app stores it. */
export const readMeta = (page) => page.evaluate(async () => {
  const db = await new Promise((resolve, reject) => {
    const r = indexedDB.open('cf.game', 1);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  const get = (key) => new Promise((resolve, reject) => {
    const rq = db.transaction('kv', 'readonly').objectStore('kv').get(key);
    rq.onsuccess = () => resolve(rq.result ?? null);
    rq.onerror = () => reject(rq.error);
  });
  const save = await get('cf.save.v1');
  const meta = await get('cf.save.meta.v1');
  return { hasSave: save !== null, saveLength: save ? save.length : 0, save, meta: meta ? JSON.parse(meta) : null };
});

export async function toClubStep(page, base) {
  await page.goto(base, { waitUntil: 'networkidle' });
  const start = page.getByRole('button', { name: /start your career/i }).first();
  await start.waitFor({ state: 'visible' });
  await start.click();
  await page.waitForURL('**/create/manager');
  await page.locator(OPTION).first().click();
  await page.getByRole('button', { name: /next: your club/i }).click();
  await page.waitForURL('**/create/club');
}

export const errorState = (page) => page.getByRole('alert').filter({ hasText: /could not be prepared/i });
export const retryButton = (page) => page.getByRole('button', { name: /^try again$/i });

/** What has keyboard focus, described. `body` means focus was lost. */
export const focused = (page) => page.evaluate(() => {
  const el = document.activeElement;
  if (!el || el === document.body) return 'body';
  const bits = [el.tagName.toLowerCase()];
  if (el.getAttribute('aria-pressed') !== null) bits.push('[aria-pressed]');
  if (el.getAttribute('role')) bits.push(`[role=${el.getAttribute('role')}]`);
  if (el.getAttribute('aria-label')) bits.push(`[${el.getAttribute('aria-label')}]`);
  if (el.hasAttribute('disabled')) bits.push('[disabled]');
  const label = (el.innerText || '').trim().slice(0, 30);
  if (label) bits.push(`"${label}"`);
  return bits.join('');
});

/**
 * Mark the live regions on screen so a later look can tell a node that is
 * still the same element from one that was replaced. A screen reader
 * announces an alert when it is inserted; the same node with its text
 * quietly swapped is not reliably a new event.
 */
export const markLiveRegions = (page) => page.evaluate(() => {
  for (const el of document.querySelectorAll('[role="alert"], [role="status"]')) el.dataset.seen = '1';
});
export const liveRegions = (page) => page.evaluate(() => Array.from(document.querySelectorAll('[role="alert"], [role="status"]')).map((el) => ({
  role: el.getAttribute('role'),
  seen: el.dataset.seen === '1',
  text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80),
  visible: el.getClientRects().length > 0,
})));
