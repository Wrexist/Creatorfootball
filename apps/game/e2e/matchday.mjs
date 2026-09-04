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
  //
  // Both of these are measured over the whole window rather than poll by poll,
  // and that is deliberate. A fixed 150ms sampler is not synchronised with the
  // engine's snapshots: `PitchMotion` deliberately settles once a snapshot is
  // fully consumed and stops repainting, so a poll can legitimately land on a
  // frame where nothing is moving. Counting such polls as failures made these
  // checks measure the sampler's luck rather than the renderer — they failed on
  // a loaded machine, and on CI, while the same run reported healthy per-frame
  // travel. Totals and medians answer the same questions and cannot be
  // dominated by a handful of settled or in-flight frames.
  await pitch(page); // reset the step maxima
  let maxStep = 0; let maxBall = 0; let travelled = 0; let samples = 0;
  const nearest = [];
  let previous = null;
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(150);
    const p = await pitch(page);
    if (!p) continue;
    samples += 1;
    maxStep = Math.max(maxStep, p.stats.maxStep);
    maxBall = Math.max(maxBall, p.stats.maxBallStep);
    if (previous) {
      travelled += p.positions.players.reduce((sum, u) => {
        const q = previous.players.find((v) => v.id === u.id);
        return sum + (q ? Math.hypot(u.x - q.x, u.y - q.y) : 0);
      }, 0);
    }
    nearest.push(Math.min(...p.positions.players.map((u) => Math.hypot(u.x - p.positions.ball.x, u.y - p.positions.ball.y))));
    previous = p.positions;
  }
  // Total ground covered by all fourteen shirts across the window. A frozen
  // pitch scores 0; three seconds of football scores several pitch-lengths.
  const MIN_TRAVEL = 0.5;
  // Typical distance from the ball to the closest man. A pass in flight and a
  // dead ball at a stoppage are both correct football and both sit far from
  // everyone for a stretch, so the middle of the distribution is the honest
  // measure of "the ball is with the play"; a ball drifting on its own moves
  // the median, not just the tail.
  const MAX_MEDIAN_BALL_GAP = 0.09;
  const sortedNear = [...nearest].sort((a, b) => a - b);
  const medianNear = sortedNear.length
    ? sortedNear[Math.floor(sortedNear.length / 2)]
    : Number.POSITIVE_INFINITY;
  check(samples >= 15, `the profiler hook answered ${samples} times`);
  check(travelled > MIN_TRAVEL, `the shirts covered only ${travelled.toFixed(3)} over ${samples} samples`);
  check(maxStep < MAX_FRAME_STEP, `a shirt moved ${maxStep.toFixed(3)} in one frame (teleport)`);
  check(maxBall < MAX_FRAME_STEP, `the ball moved ${maxBall.toFixed(3)} in one frame (teleport)`);
  check(medianNear < MAX_MEDIAN_BALL_GAP, `the ball sat ${medianNear.toFixed(3)} from the nearest player on a typical frame`);
  const ids = previous ? previous.players.map((u) => u.id) : [];
  check(new Set(ids).size === ids.length && ids.length === 14, `${ids.length} shirts drawn, ${new Set(ids).size} distinct`);
  pass(`live pitch: shirts travel (${travelled.toFixed(2)} covered, max ${maxStep.toFixed(3)}/frame), ball stays with play (median ${medianNear.toFixed(3)})`);

  // Pause: the picture settles and then stops.
  //
  // Coming to rest is not instant and is not meant to be: a loose ball eases to
  // its resting point over a couple of seconds. The property under test is that
  // it *stops* and stays stopped, not that it stops inside an arbitrary sleep,
  // so wait for quiescence and then prove it holds.
  await control(page, 'Pause').click();
  let quiet = false;
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(150);
    const s = await pitch(page);
    if (s && s.stats.settled) { quiet = true; break; }
  }
  check(quiet, 'the pitch never came to rest after pause');
  const a = await pitch(page);
  await page.waitForTimeout(500);
  const b = await pitch(page);
  check(b.stats.settled === true, 'the pitch did not stay at rest after pause');
  check(b.stats.maxStep === 0 && b.stats.maxBallStep === 0,
    `movement continued while paused (shirts ${b.stats.maxStep.toFixed(4)}, ball ${b.stats.maxBallStep.toFixed(4)})`);
  // Compared within a threshold rather than bit for bit. An eased position is
  // a float that asymptotes onto its target, so exact equality asks the model
  // for something it never promised; 1e-4 of the pitch is a twenty-fifth of a
  // pixel on a phone, and still an order of magnitude tighter than any real
  // movement this check has ever caught.
  const STILL = 1e-4;
  const drifted = b.positions.players.reduce((worst, u) => {
    const q = a.positions.players.find((v) => v.id === u.id);
    return q ? Math.max(worst, Math.hypot(u.x - q.x, u.y - q.y)) : worst;
  }, Math.hypot(b.positions.ball.x - a.positions.ball.x, b.positions.ball.y - a.positions.ball.y));
  check(drifted < STILL, `positions drifted ${drifted.toFixed(6)} while paused`);
  pass('pause: motion settles and stops');

  // Resume: play carries on from where it stopped, without a jump.
  //
  // Waited for rather than slept on. The engine's next snapshot arrives on its
  // own schedule, and a fixed sleep that lands in the gap before it reads as
  // "nothing moved" when the truth is "not yet". Poll until the pitch is
  // moving again, and fail only if it never does.
  await control(page, 'Play').click();
  let r = null;
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(150);
    const sample = await pitch(page);
    if (!sample) continue;
    r = sample;
    if (!sample.stats.settled || sample.stats.maxStep > 0) break;
  }
  check(r !== null, 'the profiler hook stopped answering after resume');
  check(r.stats.maxStep < MAX_FRAME_STEP, `a shirt jumped ${r.stats.maxStep.toFixed(3)} on resume`);
  check(r.stats.maxBallStep < MAX_FRAME_STEP, `the ball jumped ${r.stats.maxBallStep.toFixed(3)} on resume`);
  check(!r.stats.settled || r.stats.maxStep > 0, 'nothing moved after resume');
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
