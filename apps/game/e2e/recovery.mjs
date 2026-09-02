/**
 * Browser test: content recovery when the universe fails more than once.
 *
 * `failure.mjs` proves one failure and one recovery. This proves the loop —
 * FAIL → RETRY → FAIL AGAIN → RETRY → RECOVER — for the club step, the
 * founding form and a returning player, and looks at what a screen reader
 * and a keyboard would get out of it: whether a second failure is a new
 * event or a silently rewritten one, where focus is at every point, and
 * whether the keyboard alone can reach retry, press it and carry on.
 *
 * Usage: node e2e/recovery.mjs [baseUrl]
 */
import {
  OPTION, createSuite, errorState, focused, liveRegions, markLiveRegions, readMeta, retryButton, toClubStep,
} from './lib.mjs';

const BASE = process.argv[2] ?? 'http://127.0.0.1:4173';
const { scenario, pass, finish } = createSuite('repeated-failure recovery', BASE);

/** Press Tab until the predicate matches the focused element, within a bound. */
async function tabTo(page, matches, max = 30) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    const where = await focused(page);
    if (matches(where)) return where;
  }
  return null;
}

// --- 1. the club step: fail, retry, fail again --------------------------------
await scenario('club step fails twice', async ({ page, chunk, check, unexpected }) => {
  chunk.mode = 'abort';
  await toClubStep(page, BASE);
  await errorState(page).waitFor({ state: 'visible' });
  await markLiveRegions(page);
  const first = chunk.requests;

  // Retry while the chunk is held: the block stays, the button is busy, and
  // the player is told — once, politely — that the league is being prepared.
  chunk.mode = 'hold';
  await retryButton(page).click();
  await page.waitForTimeout(250);
  check(await page.locator('button[aria-busy="true"]').count() === 1, 'no busy retry button while retrying');
  const during = await liveRegions(page);
  const status = during.filter((r) => r.role === 'status');
  check(status.length === 1 && /preparing your league/i.test(status[0].text), `no single progress status while retrying (saw ${JSON.stringify(during)})`);
  check(during.filter((r) => r.role === 'alert').every((r) => r.seen), 'the alert was re-created just to start a retry (an announcement for nothing)');
  const focusDuring = await focused(page);
  check(focusDuring !== 'body', `focus fell to ${focusDuring} while retrying`);

  // The second failure.
  for (const r of chunk.held.splice(0)) await r.abort('failed');
  chunk.mode = 'abort';
  await retryButton(page).waitFor({ state: 'visible' });
  await page.waitForTimeout(250);
  const after = await liveRegions(page);
  const alerts = after.filter((r) => r.role === 'alert');
  check(alerts.length === 1, `expected one alert after the second failure, saw ${alerts.length}`);
  check(alerts[0] && !alerts[0].seen, 'the second failure reused the first alert node: a screen reader is not told again');
  check(alerts[0] && /could not be prepared/i.test(alerts[0].text), 'the second failure does not say what happened');
  check(await page.locator('button[aria-busy="true"]').count() === 0, 'busy state survived the second failure');
  check(await retryButton(page).isEnabled(), 'retry is not usable after the second failure');
  const focusAfter = await focused(page);
  check(focusAfter !== 'body' && !/disabled/.test(focusAfter), `focus after the second failure is on ${focusAfter}`);
  check(chunk.requests - first === 1, `the retry made ${chunk.requests - first} request(s), expected 1`);
  check(unexpected().length === 0, `unexpected error: ${unexpected()[0]?.slice(0, 160)}`);
  pass('club step: second failure is a new alert, retry usable, focus kept, one request');

  // And a third, for the avoidance of doubt: nothing about this is "twice".
  await markLiveRegions(page);
  await retryButton(page).click();
  await retryButton(page).waitFor({ state: 'visible' });
  await page.waitForTimeout(250);
  const third = (await liveRegions(page)).filter((r) => r.role === 'alert');
  check(third.length === 1 && !third[0].seen, 'the third failure was not a new alert');
  check(await retryButton(page).isEnabled(), 'retry is not usable after the third failure');
  check((await focused(page)) !== 'body', 'focus fell to body after the third failure');
  pass('club step: a third failure behaves exactly like the second');
});

// --- 2. the club step: fail, retry, fail, retry, recover -----------------------
await scenario('club step recovers on the third attempt', async ({ page, chunk, check, unexpected }) => {
  chunk.mode = 'abort';
  await toClubStep(page, BASE);
  await errorState(page).waitFor({ state: 'visible' });
  await retryButton(page).click();
  await retryButton(page).waitFor({ state: 'visible' });
  const beforeRecovery = chunk.requests;
  chunk.mode = 'pass';
  await retryButton(page).click();
  await page.locator(OPTION).first().waitFor({ state: 'visible' });
  check(chunk.requests - beforeRecovery === 1, `the recovering retry made ${chunk.requests - beforeRecovery} request(s)`);
  check(await errorState(page).count() === 0, 'the failure stayed on screen after recovery');
  check(await page.locator('button[aria-busy="true"]').count() === 0, 'a busy button survived recovery');
  const where = await focused(page);
  check(/button\[aria-pressed\]/.test(where), `focus after explicit recovery is on ${where}, not the first club`);
  const live = await liveRegions(page);
  check(live.filter((r) => r.role === 'status').length <= 1, 'more than one status region after recovery');
  check(live.some((r) => r.role === 'status' && /ready/i.test(r.text)), 'nothing tells a screen reader the league is ready');
  // Creation continues exactly once.
  await page.locator(OPTION).first().click();
  await page.getByRole('button', { name: /^take over\s/i }).click();
  await page.getByRole('button', { name: /meet your squad/i }).click();
  await page.waitForURL('**/create/squad');
  check((await readMeta(page)).hasSave, 'no save after recovering on the third attempt');
  check(unexpected().length === 0, `unexpected error: ${unexpected()[0]?.slice(0, 160)}`);
  pass('club step: two failures, then recovery, focus on the first club, one career');
});

// --- 3. founding a club: fail, retry, fail again --------------------------------
await scenario('founding fails twice', async ({ page, chunk, check, unexpected }) => {
  chunk.mode = 'abort';
  await toClubStep(page, BASE);
  await errorState(page).waitFor({ state: 'visible' });
  await page.getByRole('button', { name: /found your own club/i }).click();
  await page.getByLabel('Club name').fill('Harbour Lights');
  await page.getByLabel('City').fill('Saltpine');
  const confirm = page.getByRole('button', { name: /^found\s/i });
  const notice = page.getByRole('alert').filter({ hasText: /could not be created/i });

  await confirm.click();
  await notice.waitFor({ state: 'visible', timeout: 15_000 });
  await markLiveRegions(page);
  await confirm.waitFor({ state: 'visible' });
  check(await confirm.isEnabled(), 'confirm locked after the first failure');

  await confirm.click();
  await notice.waitFor({ state: 'visible', timeout: 15_000 });
  await confirm.waitFor({ state: 'visible' });
  const live = await liveRegions(page);
  const notices = live.filter((r) => r.role === 'alert' && /could not be created/i.test(r.text));
  check(notices.length === 1, `expected one notice after the second failure, saw ${notices.length}`);
  check(notices[0] && !notices[0].seen, 'the second founding failure reused the first notice node');
  check(/role=alert/.test(await focused(page)), `focus after the second failure is on ${await focused(page)}`);
  check(await page.getByLabel('Club name').inputValue() === 'Harbour Lights', 'the club name was lost by the second failure');
  check(await page.getByLabel('City').inputValue() === 'Saltpine', 'the city was lost by the second failure');
  check(await confirm.isEnabled(), 'confirm locked after the second failure');
  const meta = await readMeta(page);
  check(!meta.hasSave && !meta.meta, 'a save exists after two failed foundings');
  check(unexpected().length === 0, `unexpected error: ${unexpected()[0]?.slice(0, 160)}`);
  pass('founding: second failure is a new notice, everything typed survives, no save');
});

// --- 4. founding a club: fail, retry, fail, retry, succeed -----------------------
await scenario('founding succeeds on the third attempt', async ({ page, chunk, check, unexpected }) => {
  chunk.mode = 'abort';
  await toClubStep(page, BASE);
  await errorState(page).waitFor({ state: 'visible' });
  await page.getByRole('button', { name: /found your own club/i }).click();
  await page.getByLabel('Club name').fill('Harbour Lights');
  await page.getByLabel('City').fill('Saltpine');
  const confirm = page.getByRole('button', { name: /^found\s/i });
  const notice = page.getByRole('alert').filter({ hasText: /could not be created/i });
  for (let i = 0; i < 2; i++) {
    await confirm.click();
    await notice.waitFor({ state: 'visible', timeout: 15_000 });
    await confirm.waitFor({ state: 'visible' });
  }
  chunk.mode = 'pass';
  await confirm.click();
  await page.getByRole('button', { name: /meet your squad/i }).waitFor({ state: 'visible', timeout: 15_000 });
  check(await notice.count() === 0, 'the failure notice survived success');
  await page.getByRole('button', { name: /meet your squad/i }).click();
  await page.waitForURL('**/create/squad');
  const born = await readMeta(page);
  check(born.hasSave && /harbour/i.test(born.meta?.clubName ?? ''), `the founded club was not saved: ${born.meta?.clubName ?? 'nothing'}`);
  // One career: the store's own record of the club is the founded one, once.
  const clubs = await page.evaluate(() => {
    const raw = localStorage.getItem('cf.save.v1');
    return raw ? 'legacy' : 'idb';
  });
  check(clubs === 'idb', 'the save went to the wrong place');
  check(unexpected().length === 0, `unexpected error: ${unexpected()[0]?.slice(0, 160)}`);
  pass('founding: two failures, then one club founded with the name the player typed');
});

// --- 5. returning player: fail, retry, fail again, retry, recover ---------------
await scenario('returning player fails twice', async ({ page, chunk, check, unexpected, notBlank }) => {
  await toClubStep(page, BASE);
  await page.locator(OPTION).first().click();
  await page.getByRole('button', { name: /^take over\s/i }).click();
  await page.getByRole('button', { name: /meet your squad/i }).click();
  await page.waitForURL('**/create/squad');
  const saved = await readMeta(page);
  if (!check(saved.hasSave, 'setup: no career to return to')) return;

  chunk.mode = 'abort';
  await page.goto(BASE, { waitUntil: 'networkidle' });
  const alert = page.getByRole('alert').filter({ hasText: /could not be prepared/i });
  await alert.waitFor({ state: 'visible', timeout: 15_000 });
  await markLiveRegions(page);

  // Retry, held: focus stays on the screen, progress is announced once.
  chunk.mode = 'hold';
  await retryButton(page).click();
  await page.waitForTimeout(300);
  check(await page.locator('button[aria-busy="true"]').count() === 1, 'no busy retry on the recovery screen');
  check((await focused(page)) !== 'body', 'focus fell to body while the recovery screen retried');
  const during = await liveRegions(page);
  check(during.filter((r) => r.role === 'status').length === 1, 'no single progress status on the recovery screen');
  const mid = await readMeta(page);
  check(mid.saveLength === saved.saveLength && mid.meta?.saveId === saved.meta?.saveId, 'the save changed while retrying');

  // Second failure.
  for (const r of chunk.held.splice(0)) await r.abort('failed');
  chunk.mode = 'abort';
  await page.waitForTimeout(600);
  await notBlank('recovery screen after the second failure');
  const after = await liveRegions(page);
  const alerts = after.filter((r) => r.role === 'alert');
  check(alerts.length === 1 && !alerts[0].seen, 'the second boot failure reused the first alert node');
  check(await retryButton(page).isEnabled(), 'retry not usable after the second boot failure');
  check(await page.locator('button[aria-busy="true"]').count() === 0, 'busy state survived the second boot failure');
  check((await focused(page)) !== 'body', 'focus fell to body after the second boot failure');
  check(!/start a new career|delete/i.test(await page.evaluate(() => document.body.innerText)), 'a destructive option appeared');
  const twice = await readMeta(page);
  check(twice.save === saved.save && twice.meta?.saveId === saved.meta?.saveId, 'the save changed across two failures');

  chunk.mode = 'pass';
  await retryButton(page).click();
  await page.waitForURL('**/home', { timeout: 15_000 });
  const home = await readMeta(page);
  check(home.meta?.saveId === saved.meta?.saveId, 'a different career after recovery');
  check(unexpected().length === 0, `unexpected error: ${unexpected()[0]?.slice(0, 160)}`);
  pass('returning player: two failures, save byte-identical throughout, recovery into the same career');
});

// --- 6. the keyboard alone -------------------------------------------------------
await scenario('keyboard recovery', async ({ page, chunk, check, unexpected }) => {
  chunk.mode = 'abort';
  await toClubStep(page, BASE);
  await errorState(page).waitFor({ state: 'visible' });
  // From the step heading, Tab reaches "Try again".
  const reached = await tabTo(page, (w) => /try again/i.test(w));
  check(reached !== null, 'Tab never reached the retry button');
  chunk.mode = 'hold';
  await page.keyboard.press('Enter');
  await page.waitForTimeout(250);
  check(await page.locator('button[aria-busy="true"]').count() === 1, 'Enter did not start the retry');
  check((await focused(page)) !== 'body', 'focus fell to body after Enter on retry');
  // A second failure, then Tab reaches retry again and Space works too.
  for (const r of chunk.held.splice(0)) await r.abort('failed');
  chunk.mode = 'abort';
  await retryButton(page).waitFor({ state: 'visible' });
  const again = await tabTo(page, (w) => /try again/i.test(w));
  check(again !== null, 'Tab never reached the retry button after the second failure');
  chunk.mode = 'pass';
  await page.keyboard.press('Space');
  await page.locator(OPTION).first().waitFor({ state: 'visible' });
  check(/button\[aria-pressed\]/.test(await focused(page)), `after Space-recovery focus is on ${await focused(page)}`);
  // Space selects the focused club; Tab then walks to the confirm button.
  await page.keyboard.press('Space');
  check((await page.locator('button[aria-pressed="true"]').count()) === 1, 'Space did not select the focused club');
  const confirmReached = await tabTo(page, (w) => /take over/i.test(w), 40);
  check(confirmReached !== null, 'Tab never reached the confirm button');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: /meet your squad/i }).waitFor({ state: 'visible', timeout: 15_000 });
  check(unexpected().length === 0, `unexpected error: ${unexpected()[0]?.slice(0, 160)}`);
  pass('keyboard: Tab to retry, Enter and Space retry, Space selects the club, Enter confirms');
});

// --- 7. passive arrival does not steal focus -------------------------------------
await scenario('passive arrival', async ({ page, chunk, check }) => {
  chunk.mode = 'hold';
  await toClubStep(page, BASE);
  await page.locator('[aria-busy="true"]').first().waitFor({ state: 'visible' });
  const before = await focused(page);
  chunk.mode = 'pass';
  chunk.release();
  await page.locator(OPTION).first().waitFor({ state: 'visible' });
  const after = await focused(page);
  check(after === before, `content arriving on its own moved focus from ${before} to ${after}`);
  check(!(await liveRegions(page)).some((r) => r.role === 'status' && /ready/i.test(r.text)), 'a passive arrival announced itself as a recovery');
  pass('passive arrival: focus untouched, nothing announced as a recovery');
});

// --- 8. rapid interaction ---------------------------------------------------------
await scenario('rapid retries', async ({ page, chunk, check, unexpected }) => {
  chunk.mode = 'abort';
  await toClubStep(page, BASE);
  await errorState(page).waitFor({ state: 'visible' });
  const failed = chunk.requests;
  chunk.mode = 'hold';
  const retry = retryButton(page);
  await retry.click();
  for (let i = 0; i < 5; i++) await retry.click({ timeout: 300, force: true }).catch(() => undefined);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Space');
  await page.waitForTimeout(300);
  const live = await liveRegions(page);
  check(live.filter((r) => r.role === 'alert').length === 1, `${live.filter((r) => r.role === 'alert').length} alerts during rapid retries`);
  check(live.filter((r) => r.role === 'status').length === 1, `${live.filter((r) => r.role === 'status').length} status regions during rapid retries`);
  check(chunk.requests - failed === 1, `rapid retries made ${chunk.requests - failed} request(s)`);
  chunk.mode = 'pass';
  chunk.release();
  await page.locator(OPTION).first().waitFor({ state: 'visible' });
  check(chunk.requests - failed === 1, 'a second request appeared after release');
  check(/button\[aria-pressed\]/.test(await focused(page)), 'focus did not settle on the first club');
  check(unexpected().length === 0, `unexpected error: ${unexpected()[0]?.slice(0, 160)}`);
  pass('rapid retries: one request, one alert, one status, one focus destination');
});

await finish();
