import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { gunzipSync } from 'node:zlib';

const base = process.argv[2] ?? 'http://127.0.0.1:4173';
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
try {
  const context = await browser.newContext({ viewport: { width: 393, height: 852 } });
  context.setDefaultTimeout(20000);
  context.setDefaultNavigationTimeout(20000);
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  const snapshot = async () => {
    await page.waitForTimeout(250);
    const raw = await page.evaluate(() => localStorage.getItem('cf.save.v1'));
    return JSON.parse(raw.startsWith('cf:gzip:1:') ? gunzipSync(Buffer.from(raw.slice(10), 'base64')).toString() : raw).state;
  };
  await page.goto(base);
  await page.getByRole('button', { name: 'Start your career', exact: true }).click();
  await page.getByRole('button', { name: /Vera Lindqvist/ }).click();
  await page.getByRole('button', { name: 'Next: your club', exact: true }).click();
  await page.getByRole('button', { name: /Larkspur Wolves of/ }).click();
  await page.getByRole('button', { name: 'Take over Larkspur', exact: true }).click();
  await page.getByRole('button', { name: 'Meet your squad', exact: true }).click();
  console.log('Career created');
  await page.goto(`${base}/squad/tactics`);
  const auto = page.getByRole('button', { name: 'Auto pick', exact: true });
  await auto.click();
  await page.getByRole('button', { name: 'Formation & instructions', exact: true }).click();
  await page.getByRole('button', { name: /^3-2-1/ }).click();
  await page.getByRole('radio', { name: 'Quick', exact: true }).click();
  await page.keyboard.press('Escape');
  await page.goto(`${base}/squad/training`);
  await page.getByRole('button', { name: /^Technical Work/ }).click();
  await page.getByRole('radio', { name: 'Hard', exact: true }).click();
  let state = await snapshot();
  assert.equal(state.clubs[state.playerClubId].tactics.tempo, 'QUICK');
  assert.equal(Object.values(state.clubs[state.playerClubId].tactics.lineup).filter(Boolean).length, 7);
  assert.equal(state.training.programId, 'TECHNICAL');
  console.log('Lineup and training saved');
  await page.goto(`${base}/market/search`);
  await page.getByRole('textbox', { name: 'Search players by name' }).fill('nobody-matches-this');
  await page.getByText('Nobody matches', { exact: true }).waitFor();
  console.log('Market empty search verified');
  await page.goto(`${base}/matchday`);
  await page.getByRole('button', { name: 'Play Match', exact: true }).click();
  await page.getByRole('button', { name: 'Pause', exact: true }).waitFor();
  await page.waitForTimeout(3000);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: /Subs\./ }).click();
  const sheet = page.getByRole('dialog');
  await sheet.locator('ul').nth(0).getByRole('button').first().click();
  await sheet.locator('ul').nth(1).getByRole('button').first().click();
  await sheet.waitFor({ state: 'hidden' });
  console.log('Live substitution completed');
  await page.getByRole('button', { name: /Match speed/ }).click();
  await page.getByRole('button', { name: 'Jump to the final whistle', exact: true }).click();
  await page.waitForURL(/result/, { timeout: 30000 });
  await page.getByRole('button', { name: 'Continue', exact: true }).waitFor();
  state = await snapshot();
  assert.equal(state.clock.week, 1); assert.ok(state.latestMatchReport);
  const reportId = state.latestMatchReport.matchId;
  await page.reload(); await page.getByRole('button', { name: 'Continue', exact: true }).waitFor();
  state = await snapshot(); assert.equal(state.clock.week, 1); assert.equal(state.latestMatchReport.matchId, reportId);
  console.log('Result persisted and reloaded');

  // Two tabs boot from the same revision; the second must not overwrite the first.
  await page.goto(`${base}/settings`);
  await page.getByRole('button', { name: 'Save now', exact: true }).waitFor();
  const other = await context.newPage();
  await other.goto(`${base}/settings`); await other.getByRole('button', { name: 'Save now', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Save now', exact: true }).click();
  await page.waitForTimeout(400);
  await other.getByRole('button', { name: 'Save now', exact: true }).click();
  await other.getByText('This career changed in another tab', { exact: true }).waitFor();
  const before = await snapshot();
  const download = other.waitForEvent('download');
  await other.getByRole('button', { name: 'Export save', exact: true }).click();
  assert.match((await download).suggestedFilename(), /creator-football/);
  assert.deepEqual(await snapshot(), before);
  await other.close();

  for (const width of [320, 375, 393, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${base}/home`); await page.getByTestId('premium-home').waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${width}px overflow`);
  }
  await page.keyboard.press('Tab');
  assert.notEqual(await page.evaluate(() => document.activeElement?.tagName), 'BODY');
  assert.deepEqual(errors, []);
  console.log('PASS career: creation, lineup, tactics, training, search, live substitution, result/reload, save conflict/export and responsive keyboard checks');
} finally { await browser.close(); }
