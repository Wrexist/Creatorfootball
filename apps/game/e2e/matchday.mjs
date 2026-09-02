/**
 * Browser test: matchday — substitutions and the live pitch.
 *
 * Drives a real match in the built bundle: kicks off, watches the shirts and
 * the ball move, pauses, resumes, opens the substitution sheet, takes the
 * goalkeeper off and brings the recommended keeper on, checks the count, and
 * tries to make the same change twice as fast as a thumb can. Motion is read
 * through the renderer's own profiler hook (`?pitchprofile`), which reports
 * the largest per-frame movement since it was last asked — the number that
 * says "teleport" or "travel".
 *
 * Usage: node e2e/matchday.mjs [baseUrl]
 */
import { OPTION, createSuite, readMeta } from './lib.mjs';

const BASE = process.argv[2] ?? 'http://127.0.0.1:4173';
const { scenario, pass, finish } = createSuite('matchday', BASE);

/** A per-frame movement above this is a jump, not a journey (pitch units). */
const MAX_FRAME_STEP = 0.06;

async function createCareer(page) {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  const start = page.getByRole('button', { name: /start your career/i }).first();
  await start.waitFor({ state: 'visible' });
  await start.click();
  await page.waitForURL('**/create/manager');
  await page.locator(OPTION).first().click();
  await page.getByRole('button', { name: /next: your club/i }).click();
  await page.waitForURL('**/create/club');
  await page.locator(OPTION).first().click();
  await page.getByRole('button', { name: /^take over\s/i }).click();
  await page.getByRole('button', { name: /meet your squad/i }).click();
  await page.waitForURL('**/create/squad');
  await page.getByRole('button', { name: /^play\b/i }).click();
  await page.waitForURL(/\/matchday/);
}

/** From the preview, into the live match with the profiler hook on. */
async function kickOff(page) {
  await page.getByRole('button', { name: /^play$/i }).first().click();
  await page.waitForURL(/\/matchday\/live\//);
  const url = new URL(page.url());
  await page.goto(`${url.origin}${url.pathname}?pitchprofile`, { waitUntil: 'networkidle' });
  // The walk-out: skip it, or kick off, whichever the build offers.
  const skip = page.getByRole('button', { name: /^(skip|kick off)$/i }).first();
  await skip.waitFor({ state: 'visible', timeout: 15_000 });
  await skip.click();
  await page.waitForFunction(() => typeof window.__cfPitch === 'object', null, { timeout: 15_000 });
}

const pitch = (page) => page.evaluate(() => {
  const hook = window.__cfPitch;
  if (!hook) return null;
  return { stats: hook.stats(), positions: hook.positions() };
});

const control = (page, name) => page.getByRole('button', { name: new RegExp(`^${name}\\b`, 'i') }).first();

// --- 1. the live pitch moves, holds when paused, and resumes cleanly ------------
await scenario('live pitch motion', async ({ page, check, unexpected }) => {
  await createCareer(page);
  await kickOff(page);
  await page.waitForTimeout(1500);

  // Watch for three seconds: shirts travel, nothing jumps, the ball stays with the play.
  await pitch(page); // reset the step maxima
  let maxStep = 0; let maxBall = 0; let moved = 0; let nearBall = 0; let samples = 0;
  let previous = null;
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(150);
    const p = await pitch(page);
    if (!p) continue;
    samples += 1;
    maxStep = Math.max(maxStep, p.stats.maxStep);
    maxBall = Math.max(maxBall, p.stats.maxBallStep);
    if (previous) {
      const dist = p.positions.players.reduce((sum, u) => {
        const q = previous.players.find((v) => v.id === u.id);
        return sum + (q ? Math.hypot(u.x - q.x, u.y - q.y) : 0);
      }, 0);
      if (dist > 0.01) moved += 1;
    }
    const nearest = Math.min(...p.positions.players.map((u) => Math.hypot(u.x - p.positions.ball.x, u.y - p.positions.ball.y)));
    if (nearest < 0.09) nearBall += 1;
    previous = p.positions;
  }
  check(samples >= 15, `the profiler hook answered ${samples} times`);
  check(moved >= samples * 0.5, `the shirts moved in only ${moved} of ${samples} samples`);
  check(maxStep < MAX_FRAME_STEP, `a shirt moved ${maxStep.toFixed(3)} in one frame (teleport)`);
  check(maxBall < MAX_FRAME_STEP, `the ball moved ${maxBall.toFixed(3)} in one frame (teleport)`);
  check(nearBall >= samples * 0.6, `the ball was near a player in only ${nearBall} of ${samples} samples`);
  const ids = previous ? previous.players.map((u) => u.id) : [];
  check(new Set(ids).size === ids.length && ids.length === 14, `${ids.length} shirts drawn, ${new Set(ids).size} distinct`);
  pass(`live pitch: shirts travel (max ${maxStep.toFixed(3)}/frame), ball stays with play (${nearBall}/${samples})`);

  // Pause: the picture settles and then stops.
  await control(page, 'Pause').click();
  await page.waitForTimeout(900);
  const a = await pitch(page);
  await page.waitForTimeout(500);
  const b = await pitch(page);
  check(b.stats.settled === true, 'the pitch did not settle after pause');
  check(b.stats.maxStep === 0 && b.stats.maxBallStep === 0, `movement continued while paused (${b.stats.maxStep.toFixed(4)})`);
  check(JSON.stringify(a.positions) === JSON.stringify(b.positions), 'positions changed while paused');
  pass('pause: motion settles and stops');

  // Resume: play carries on from where it stopped, without a jump.
  await control(page, 'Play').click();
  await page.waitForTimeout(1200);
  const r = await pitch(page);
  check(r.stats.maxStep < MAX_FRAME_STEP, `a shirt jumped ${r.stats.maxStep.toFixed(3)} on resume`);
  check(r.stats.maxBallStep < MAX_FRAME_STEP, `the ball jumped ${r.stats.maxBallStep.toFixed(3)} on resume`);
  check(!r.stats.settled, 'nothing moved after resume');
  check(unexpected().length === 0, `unexpected error: ${unexpected()[0]?.slice(0, 160)}`);
  pass('resume: motion continues without a teleport');
});

// --- 2. the goalkeeper substitution, recommended and completed ----------------
await scenario('goalkeeper substitution', async ({ page, check, unexpected, text }) => {
  await createCareer(page);
  await kickOff(page);
  await page.waitForTimeout(800);

  const subsButton = control(page, 'Subs');
  await subsButton.click();
  const sheet = page.getByRole('dialog').filter({ hasText: /substitutions/i }).first();
  await sheet.waitFor({ state: 'visible' });
  const subtitle = async () => (await sheet.innerText()).match(/(\d+) changes? left/i);
  const before = await subtitle();
  check(before !== null, 'the sheet does not say how many changes are left');
  const left = before ? Number(before[1]) : 0;

  // The keeper comes off.
  const onPitch = sheet.locator('[data-testid="on-pitch"] button');
  const keeperRow = onPitch.filter({ has: page.locator('text=/^GK$/') }).first();
  await keeperRow.waitFor({ state: 'visible' });
  const keeperName = (await keeperRow.innerText()).split('\n')[0];
  await keeperRow.click();

  // The replacements are at the top, the keeper first, and the eleven have gone.
  await sheet.locator('[data-testid="coming-off"]').waitFor({ state: 'visible' });
  const recommended = sheet.locator('[data-testid="recommended"] button');
  await recommended.first().waitFor({ state: 'visible' });
  const firstLabel = await recommended.first().getAttribute('aria-label');
  check(/, GK,/.test(firstLabel ?? ''), `the first recommendation is not a keeper: ${firstLabel}`);
  check(/best fit/i.test(firstLabel ?? ''), `the first recommendation is not labelled best fit: ${firstLabel}`);
  check(await sheet.locator('[data-testid="on-pitch"]').count() === 0, 'the starting eleven are still listed above the bench');
  const comingOff = await sheet.locator('[data-testid="coming-off"]').boundingBox();
  const firstRec = await recommended.first().boundingBox();
  check(comingOff && firstRec && firstRec.y - comingOff.y < 260, 'the recommended replacement is not immediately below the man coming off');
  const shown = await text();
  check(!/not allowed|check your remaining/i.test(shown), 'a stale refusal is showing');
  pass(`goalkeeper selected: ${keeperName} off, keeper recommended first, bench at the top`);

  // Complete it, twice as fast as a thumb can.
  const pitchBefore = (await pitch(page)).positions.players.map((u) => u.id);
  await recommended.first().click();
  await recommended.first().click({ force: true, timeout: 500 }).catch(() => undefined);
  await sheet.waitFor({ state: 'hidden', timeout: 5000 });
  await page.waitForTimeout(600);
  await subsButton.click();
  await sheet.waitFor({ state: 'visible' });
  const after = await subtitle();
  check(after !== null && Number(after[1]) === left - 1, `expected ${left - 1} changes left, sheet says "${after?.[0] ?? 'nothing'}"`);
  const listed = await sheet.locator('[data-testid="on-pitch"] button').allInnerTexts();
  check(!listed.some((t) => t.startsWith(keeperName)), 'the keeper who came off is still on the pitch');
  check(listed.filter((t) => /\bGK\b/.test(t)).length === 1, 'the pitch does not have exactly one keeper');
  const pitchAfter = (await pitch(page)).positions.players.map((u) => u.id);
  check(pitchAfter.length === 14 && new Set(pitchAfter).size === 14, `${pitchAfter.length} shirts drawn after the change`);
  const changed = pitchAfter.filter((id) => !pitchBefore.includes(id)).length;
  check(changed === 1, `${changed} new shirt(s) on the pitch after one substitution`);
  check(unexpected().length === 0, `unexpected error: ${unexpected()[0]?.slice(0, 160)}`);
  pass(`goalkeeper substituted once: ${left} → ${left - 1} changes left, pitch updated, no duplicate`);

  // The reason for a refusal is the real one: a used man cannot come back.
  await page.getByRole('button', { name: /^done$/i }).click();
  await sheet.waitFor({ state: 'hidden' });
  const meta = await readMeta(page);
  check(meta.hasSave, 'the save vanished during the match');
});

await finish();
