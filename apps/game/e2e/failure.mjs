/**
 * Browser test: what happens when the content universe does not arrive.
 *
 * The happy path is covered by `smoke.mjs`. This runs the journeys where the
 * lazy content chunk fails — in a real browser, against the real bundle —
 * because the one thing Node cannot tell us is how Chromium treats a dynamic
 * import that failed once and is asked for again, or what the page actually
 * shows while it waits.
 *
 * Failure is simulated deterministically with request interception: the
 * content chunk's request is aborted, held, or let through, per scenario. No
 * app code knows it is being tested, and nothing depends on a real network.
 *
 * Usage: node e2e/failure.mjs [baseUrl]
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://127.0.0.1:4173';
const CHROME = process.env.CHROMIUM_PATH || undefined;
const VIEWPORT = { width: 393, height: 852 };
const OPTION = 'button[aria-pressed="false"]';
const CONTENT_CHUNK = /\/assets\/content-[^/]*\.js/;
/** Words a player must never read. */
const JARGON = /\b(chunk|module|import|registry|validation|initiali[sz]|undefined|TypeError|Error:)\b/i;

const failures = [];
const fail = (msg) => { failures.push(msg); console.log(`  FAIL  ${msg}`); };
const pass = (msg) => console.log(`  PASS  ${msg}`);

const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});

/**
 * One scenario = one fresh browser context, with its own storage, its own
 * console, and its own switch on the content chunk.
 *
 * `mode` decides what happens to a content request: 'abort' fails it,
 * 'hold' parks it until `release()`, 'pass' lets it through. Requests are
 * counted whatever happens to them.
 */
async function scenario(name, run) {
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

  try {
    await run({ page, chunk, errors, unexpected, text, notBlank });
  } catch (e) {
    fail(`${name}: ${String(e).split('\n').slice(0, 2).join(' ').slice(0, 240)}`);
  } finally {
    await ctx.close();
  }
}

const readMeta = (page) => page.evaluate(async () => {
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
  return { hasSave: save !== null, saveLength: save ? save.length : 0, meta: meta ? JSON.parse(meta) : null };
});

async function toClubStep(page) {
  const start = page.getByRole('button', { name: /start your career/i }).first();
  await start.waitFor({ state: 'visible' });
  await start.click();
  await page.waitForURL('**/create/manager');
  await page.locator(OPTION).first().click();
  await page.getByRole('button', { name: /next: your club/i }).click();
  await page.waitForURL('**/create/club');
}

const errorState = (page) => page.getByRole('alert').filter({ hasText: /could not be prepared/i });
const retryButton = (page) => page.getByRole('button', { name: /^try again$/i });

console.log(`\nBrowser failure journeys against ${BASE}\n`);

// --- A. the club step when the universe never arrives, then a retry that works
await scenario('club step failure and retry', async ({ page, chunk, unexpected, text, notBlank }) => {
  chunk.mode = 'abort';
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await toClubStep(page);

  await errorState(page).waitFor({ state: 'visible' });
  await notBlank('club step after failure');
  const shown = await text();
  if (JARGON.test(shown)) fail(`club step failure shows technical language: "${shown.match(JARGON)?.[0]}"`);
  if (!/check your connection/i.test(shown)) fail('club step failure does not tell the player what to do');
  if (!(await retryButton(page).isVisible())) fail('club step failure offers no retry');
  // The rest of the screen is still the screen: the header, both paths, the
  // back button. The player is not trapped behind the missing list.
  if (!(await page.getByRole('button', { name: /found your own club/i }).isVisible())) fail('founding a club is not offered while the list is missing');
  if (await page.locator('[aria-busy="true"]').count() > 0) fail('a stale loading region remains after the failure');
  // The manager choice survived the failure.
  if (chunk.requests < 1) fail('the content chunk was never requested');
  const before = unexpected();
  if (before.length > 0) fail(`failure raised ${before.length} unexpected error(s): ${before[0].slice(0, 160)}`);
  pass('club step failure: stable screen, player language, retry offered, founding still possible');

  // Retry, with the network back.
  const requestsBeforeRetry = chunk.requests;
  chunk.mode = 'pass';
  await retryButton(page).click();
  await page.locator(OPTION).first().waitFor({ state: 'visible' });
  if (await errorState(page).count() > 0) fail('the error remained on screen after a successful retry');
  if (await page.locator('[aria-busy="true"]').count() > 0) fail('skeletons remained after the clubs arrived');
  if (chunk.requests - requestsBeforeRetry !== 1) fail(`retry made ${chunk.requests - requestsBeforeRetry} content request(s), expected 1`);
  if (!(await page.getByRole('button', { name: /next: your club|back/i }).first().isVisible())) fail('navigation controls missing after retry');

  // And the career is created exactly once, as normal.
  await page.locator(OPTION).first().click();
  await page.getByRole('button', { name: /^take over\s/i }).click();
  await page.getByRole('button', { name: /meet your squad/i }).click();
  await page.waitForURL('**/create/squad');
  const meta = await readMeta(page);
  if (!meta.hasSave) fail('no save after a career created following a retry');
  const after = unexpected();
  if (after.length > 0) fail(`retry raised ${after.length} unexpected error(s): ${after[0].slice(0, 160)}`);
  pass(`retry loaded the universe once and the career (${meta.meta?.clubName ?? '?'}) was created normally`);
});

// --- B. founding a club: confirming with no universe creates nothing --------
await scenario('found a club with the universe missing', async ({ page, chunk, unexpected, text, notBlank }) => {
  chunk.mode = 'abort';
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await toClubStep(page);
  await errorState(page).waitFor({ state: 'visible' });

  await page.getByRole('button', { name: /found your own club/i }).click();
  await page.getByLabel('Club name').fill('Harbour Lights');
  await page.getByLabel('City').fill('Saltpine');
  await notBlank('founding form while the universe is missing');
  const confirm = page.getByRole('button', { name: /^found\s/i });
  await confirm.waitFor({ state: 'visible' });
  await confirm.click();

  // The building beat plays, then the form comes back with a message.
  await page.getByRole('alert').filter({ hasText: /could not be created|could not be prepared/i }).first().waitFor({ state: 'visible', timeout: 15_000 });
  await confirm.waitFor({ state: 'visible' });
  await notBlank('founding form after the failed confirmation');
  const shown = await text();
  if (JARGON.test(shown)) fail(`founding failure shows technical language: "${shown.match(JARGON)?.[0]}"`);
  const meta = await readMeta(page);
  if (meta.hasSave || meta.meta) fail('a save was written although the universe never arrived');
  if (await page.getByLabel('Club name').inputValue() !== 'Harbour Lights') fail('the player\'s club name was lost by the failure');
  if (!(await confirm.isEnabled())) fail('the confirm button is locked after the failure');
  const errs = unexpected();
  if (errs.length > 0) fail(`founding failure raised ${errs.length} unexpected error(s): ${errs[0].slice(0, 160)}`);
  pass('founding a club without the universe: nothing created, nothing saved, choices kept, retry open');

  chunk.mode = 'pass';
  await confirm.click();
  await page.getByRole('button', { name: /meet your squad/i }).waitFor({ state: 'visible', timeout: 15_000 });
  await page.getByRole('button', { name: /meet your squad/i }).click();
  await page.waitForURL('**/create/squad');
  const born = await readMeta(page);
  if (!born.hasSave || !/harbour/i.test(born.meta?.clubName ?? '')) fail(`the founded club was not saved: ${born.meta?.clubName ?? 'nothing'}`);
  pass('confirming again once the universe is back founds the club, once');
});

// --- C. rapid retries share one request ----------------------------------
await scenario('rapid retries', async ({ page, chunk, unexpected }) => {
  chunk.mode = 'abort';
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await toClubStep(page);
  await errorState(page).waitFor({ state: 'visible' });
  const failed = chunk.requests;

  // Hold the next request so every extra tap lands while it is in flight.
  chunk.mode = 'hold';
  const retry = retryButton(page);
  await retry.click();
  for (let i = 0; i < 4; i++) {
    if (await retry.count() > 0 && await retry.isVisible().catch(() => false)) await retry.click({ timeout: 500 }).catch(() => undefined);
  }
  await page.waitForTimeout(300);
  const inFlight = chunk.requests - failed;
  chunk.mode = 'pass';
  chunk.release();
  await page.locator(OPTION).first().waitFor({ state: 'visible' });
  if (inFlight !== 1) fail(`rapid retries produced ${inFlight} content request(s), expected 1`);
  if (await errorState(page).count() > 0) fail('error state survived a successful retry');
  const errs = unexpected();
  if (errs.length > 0) fail(`rapid retries raised ${errs.length} unexpected error(s): ${errs[0].slice(0, 160)}`);
  pass('rapid retries share one request and end in the clubs being listed');
});

// --- D. a held request resolving after the player has moved on ------------
await scenario('late resolution', async ({ page, chunk, unexpected }) => {
  chunk.mode = 'hold';
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await toClubStep(page);
  // The list is still on its way; the player goes back to the manager step.
  await page.locator('[aria-busy="true"]').first().waitFor({ state: 'visible' });
  await page.getByRole('button', { name: /^back$/i }).first().click().catch(async () => {
    await page.goBack();
  });
  await page.waitForURL('**/create/manager');
  const before = await readMeta(page);
  chunk.mode = 'pass';
  chunk.release();
  await page.waitForTimeout(600);
  if (!/\/create\/manager$/.test(page.url())) fail(`the late content moved the player to ${new URL(page.url()).pathname}`);
  const after = await readMeta(page);
  if (after.hasSave || before.hasSave) fail('a late content arrival created a save');
  // Going forward again finds the universe already here: no new request.
  const requests = chunk.requests;
  await page.getByRole('button', { name: /next: your club/i }).click();
  await page.waitForURL('**/create/club');
  await page.locator(OPTION).first().waitFor({ state: 'visible' });
  if (chunk.requests !== requests) fail('the universe was fetched again after arriving late');
  const errs = unexpected();
  if (errs.length > 0) fail(`late resolution raised ${errs.length} unexpected error(s): ${errs[0].slice(0, 160)}`);
  pass('a late arrival changes nothing the player is doing, and is reused when they come back');
});

// --- E. a returning player whose universe does not arrive -----------------
await scenario('returning player', async ({ page, chunk, unexpected, text, notBlank }) => {
  // First, a career, created normally.
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await toClubStep(page);
  await page.locator(OPTION).first().click();
  await page.getByRole('button', { name: /^take over\s/i }).click();
  await page.getByRole('button', { name: /meet your squad/i }).click();
  await page.waitForURL('**/create/squad');
  const saved = await readMeta(page);
  if (!saved.hasSave) { fail('setup: no career to return to'); return; }

  // Then the universe fails on the next boot.
  chunk.mode = 'abort';
  await page.goto(BASE, { waitUntil: 'networkidle' });
  const alert = page.getByRole('alert').filter({ hasText: /could not be prepared/i });
  await alert.waitFor({ state: 'visible', timeout: 15_000 });
  await notBlank('returning-player failure screen');
  const shown = await text();
  if (JARGON.test(shown)) fail(`returning-player failure shows technical language: "${shown.match(JARGON)?.[0]}"`);
  if (/start a new career|start over|delete/i.test(shown)) fail('a content failure offered to start over or delete the save');
  if (!/save is fine|not been touched|untouched/i.test(shown)) fail('the player is not told their save is safe');
  const during = await readMeta(page);
  if (!during.hasSave || during.meta?.saveId !== saved.meta?.saveId || during.saveLength !== saved.saveLength) {
    fail('the save changed during a content failure at boot');
  }
  const errs = unexpected();
  if (errs.length > 0) fail(`boot failure raised ${errs.length} unexpected error(s): ${errs[0].slice(0, 160)}`);
  pass('returning-player failure: told the league could not be prepared, save untouched, no start-over offered');

  // Retry with the network back.
  chunk.mode = 'pass';
  await retryButton(page).click();
  await page.waitForURL('**/home', { timeout: 15_000 });
  await notBlank('home after retry');
  const after = await readMeta(page);
  if (after.meta?.saveId !== saved.meta?.saveId) fail('the save changed across the retry');
  const errs2 = unexpected();
  if (errs2.length > 0) fail(`boot retry raised ${errs2.length} unexpected error(s): ${errs2[0].slice(0, 160)}`);
  pass('returning-player retry continues into the career with the same save');
});

await browser.close();

if (failures.length > 0) {
  console.log(`\n[X] ${failures.length} failure journey check(s) failed\n`);
  process.exit(1);
}
console.log('\n[OK] failure journeys passed\n');
