/**
 * Browser smoke test.
 *
 * This exists because the project once shipped a production bundle that built
 * cleanly, passed 531 unit tests, and then died on load with a
 * temporal-dead-zone error — the tests run the source in Node and never touch
 * the bundle, so nothing noticed. It also guards the second defect found the
 * same day: a screen's primary action rendering underneath the fixed tab bar,
 * which made PLAY unclickable on the match preview.
 *
 * Both are classes of bug that only exist in the built artefact in a real
 * browser, which is exactly what this runs against.
 *
 * Usage: node e2e/smoke.mjs [baseUrl]
 */
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.argv[2] ?? 'http://127.0.0.1:4173';
// CHROMIUM_PATH pins a specific Chromium (sandboxed machines, pinned builds).
// Unset, Playwright resolves the browser it installed itself — which is what
// CI does via `playwright install chromium`.
const CHROME = process.env.CHROMIUM_PATH || undefined;
const VIEWPORT = { width: 393, height: 852 };

const failures = [];
const fail = (msg) => { failures.push(msg); console.log(`  FAIL  ${msg}`); };
const pass = (msg) => console.log(`  PASS  ${msg}`);

const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});
const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();

const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') pageErrors.push(m.text()); });

console.log(`\nBrowser smoke test against ${BASE}\n`);

// --- 1. the built app boots at all ------------------------------------
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

const bootErrors = pageErrors.filter((e) => !/favicon|404/i.test(e));
if (bootErrors.length > 0) {
  fail(`the app logged ${bootErrors.length} error(s) on boot: ${bootErrors[0].slice(0, 180)}`);
} else {
  pass('the built app boots with no runtime errors');
}

const bodyText = await page.evaluate(() => document.body.innerText);
if (/could not finish loading|something went wrong/i.test(bodyText)) {
  fail('the app rendered its own failure screen on boot');
} else if (bodyText.trim().length < 10) {
  fail('the app rendered nothing');
} else {
  pass('the app rendered content');
}

// --- 2. walk into a real game ------------------------------------------
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
    const i = await page.$$('input'); if (i[0]) { await i[0].click(); await i[0].type('Smoke United', { delay: 8 }); }
  } else if (/city/i.test(s.txt)) {
    const i = await page.$$('input'); const t = i[1] ?? i[0]; if (t) { await t.click(); await t.type('Smoketon', { delay: 8 }); }
  } else if (/name/i.test(s.txt)) {
    const i = await page.$$('input'); if (i[0]) { await i[0].click(); await i[0].type('Smoke Tester', { delay: 8 }); }
  } else if (/archetype|manager/i.test(s.txt)) {
    const c = page.getByRole('button', { name: /tactician|motivator|showman/i }).first();
    if (await c.count()) await c.click();
  } else if (/club|philosoph|culture/i.test(s.txt)) {
    const c = page.locator('button').nth(4);
    if (await c.count()) await c.click();
  } else break;
  await page.waitForTimeout(600);
}

// --- 3. every primary action is actually clickable ---------------------
// The tab bar is fixed above the page. A sticky footer left in normal flow
// ends up underneath it, and the screen's most important control stops
// responding while still looking perfectly fine in a screenshot.
const ROUTES = ['/home', '/matchday', '/squad', '/league', '/market', '/social', '/club'];
let obstructed = 0;

for (const route of ROUTES) {
  await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  // Two passes, because "covered" and "unreachable" are different things.
  //
  // A scrolling list of tall rows will always have one row whose visible
  // portion happens to sit under the fixed navigation, and that is normal —
  // the player scrolls a notch and taps it. What actually matters is a control
  // that stays buried no matter what, which is what put PLAY underneath the
  // tab bar. So we collect suspects, then do what a user would do: scroll each
  // one into view and test again. Only a control that is still covered when
  // centred in the viewport is a real defect.
  const suspects = await page.evaluate(() => {
    const ids = [];
    document.querySelectorAll('button, a[href]').forEach((el, index) => {
      const r = el.getBoundingClientRect();
      if (r.width < 24 || r.height < 24) return;
      if (r.bottom < 0 || r.top > window.innerHeight) return;
      const x = r.left + r.width / 2;
      const y = Math.min(Math.max(r.top + r.height / 2, 1), window.innerHeight - 1);
      const hit = document.elementFromPoint(x, y);
      if (hit && !el.contains(hit) && !hit.contains(el)) ids.push(index);
    });
    return ids;
  });

  const blocked = [];
  for (const index of suspects) {
    const stillCovered = await page.evaluate((i) => {
      const el = document.querySelectorAll('button, a[href]')[i];
      if (!el) return null;
      el.scrollIntoView({ block: 'center', behavior: 'instant' });
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (hit && !el.contains(hit) && !hit.contains(el)) {
        return (el.innerText || el.getAttribute('aria-label') || 'control').trim().slice(0, 40).replace(/\n/g, ' ');
      }
      return null;
    }, index);
    if (stillCovered) blocked.push(stillCovered);
  }

  if (blocked.length > 0) {
    obstructed += blocked.length;
    fail(`${route}: ${blocked.length} control(s) covered by other chrome, e.g. "${blocked[0]}"`);
  }
}
if (obstructed === 0) pass('no visible control is covered by other chrome on any primary route');

// --- 4. nothing overflows the viewport --------------------------------
// A horizontal scrollbar on a phone is always a bug, and it is invisible in a
// screenshot taken at the width that causes it. The tab bar overflowed by 11px
// at 375px on every screen and nothing caught it.
const NARROW = { width: 375, height: 667 };
await page.setViewportSize(NARROW);
let overflowing = 0;

for (const route of ROUTES) {
  await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const over = await page.evaluate(() => {
    const w = document.documentElement.clientWidth;
    if (document.documentElement.scrollWidth <= w + 1) return null;
    // Name the widest offender so the failure is actionable.
    let worst = null;
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      const spill = Math.max(r.right - w, -r.left);
      if (spill > 1 && (!worst || spill > worst.spill)) {
        worst = {
          spill: Math.round(spill),
          tag: el.tagName,
          cls: String(el.className).slice(0, 60),
          text: (el.textContent ?? '').trim().slice(0, 40),
        };
      }
    }
    return { scrollWidth: document.documentElement.scrollWidth, clientWidth: w, worst };
  });
  if (over) {
    overflowing += 1;
    fail(`${route}: overflows ${NARROW.width}px by ${over.scrollWidth - over.clientWidth}px — widest offender ${over.worst?.tag} "${over.worst?.text}"`);
  }
}
if (overflowing === 0) pass(`no route overflows a ${NARROW.width}px viewport`);
await page.setViewportSize(VIEWPORT);

// --- 5. nothing threw while navigating ---------------------------------
const navErrors = pageErrors.filter((e) => !/favicon|404/i.test(e));
if (navErrors.length > bootErrors.length) {
  fail(`${navErrors.length - bootErrors.length} runtime error(s) while navigating: ${navErrors.at(-1)?.slice(0, 180)}`);
} else {
  pass('navigating every primary route threw nothing');
}

// --- 6. a career survives the storage layer ----------------------------
//
// The game outgrew localStorage: a plateaued save measures ~3.1 MB and the
// save layer keeps a backup copy, against a ~5 MB origin budget. Careers now
// live in IndexedDB, with anything already written to localStorage carried
// across on first boot. That migration is the riskiest code in the storage
// path and it only exists in a browser, so it is checked in one — in its own
// context, so nothing above can have primed it.
{
  const ctx2 = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p2 = await ctx2.newPage();
  const KEYS = ['cf.save.v1', 'cf.save.backup.v1', 'cf.save.meta.v1'];

  // A career written by a previous version of the app, before IndexedDB.
  await p2.addInitScript((keys) => {
    for (const k of keys) window.localStorage.setItem(k, `legacy-value-for-${k}`);
  }, KEYS);

  await p2.goto(BASE, { waitUntil: 'networkidle' });
  await p2.waitForTimeout(2500);

  const moved = await p2.evaluate(async (keys) => {
    const db = await new Promise((resolve, reject) => {
      const r = indexedDB.open('cf.game', 1);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    const read = (key) => new Promise((resolve, reject) => {
      const req = db.transaction('kv', 'readonly').objectStore('kv').get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
    const out = {};
    for (const k of keys) out[k] = { idb: await read(k), local: window.localStorage.getItem(k) };
    return out;
  }, KEYS).catch((e) => ({ error: String(e) }));

  if (moved.error) {
    fail(`the storage layer never reached IndexedDB: ${moved.error.slice(0, 160)}`);
  } else {
    const notCarried = KEYS.filter((k) => moved[k]?.idb !== `legacy-value-for-${k}`);
    const notReclaimed = KEYS.filter((k) => moved[k]?.local !== null);
    if (notCarried.length > 0) {
      fail(`localStorage career was not carried into IndexedDB: ${notCarried.join(', ')}`);
    } else if (notReclaimed.length > 0) {
      fail(`localStorage copies were not reclaimed after migration: ${notReclaimed.join(', ')}`);
    } else {
      pass('an existing localStorage career migrates into IndexedDB and frees the old copies');
    }
  }
  await ctx2.close();
}

// --- 7. a real career survives a reload --------------------------------
//
// The loop that matters and that nothing else covered: a genuine save loads
// out of IndexedDB into the running app, a change made through the interface
// is persisted, and it is still there after the page is reloaded. Every part
// of that is real — the built bundle, the real storage layer, the real save
// queue — except the career itself, which is built by the engine rather than
// by clicking through three creation screens. Driving those would make this
// test a hostage to their layout while testing nothing extra about
// persistence, which is what it is here to check.
{
  const fixturePath = join(tmpdir(), `cf-smoke-save-${process.pid}.json`);
  let fixture = null;
  try {
    execFileSync('pnpm', ['--filter', '@cf/sim', 'exec', 'tsx', 'src/saveFixture.ts', fixturePath], {
      stdio: 'ignore',
    });
    fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));
  } catch (e) {
    fail(`could not build a save fixture: ${String(e).slice(0, 160)}`);
  }

  if (fixture) {
    const ctx3 = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const p3 = await ctx3.newPage();
    const loopErrors = [];
    p3.on('pageerror', (e) => loopErrors.push(String(e)));

    // First load creates the database; then the career is written into it.
    await p3.goto(BASE, { waitUntil: 'networkidle' });
    await p3.waitForTimeout(1500);

    const seeded = await p3.evaluate(async (entries) => {
      const db = await new Promise((resolve, reject) => {
        const r = indexedDB.open('cf.game', 1);
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
      await new Promise((resolve, reject) => {
        const tx = db.transaction('kv', 'readwrite');
        const store = tx.objectStore('kv');
        for (const [key, value] of entries) store.put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
      return true;
    }, [['cf.save.v1', fixture['cf.save.v1']], ['cf.save.meta.v1', fixture['cf.save.meta.v1']]])
      .catch((e) => String(e));

    if (seeded !== true) {
      fail(`could not seed a career into IndexedDB: ${String(seeded).slice(0, 160)}`);
    } else {
      // The app must boot that career, not a fresh world.
      await p3.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });
      await p3.waitForTimeout(2500);
      const body = (await p3.textContent('body')) ?? '';
      // The club and the clock come from the loaded save, so seeing both is
      // proof the app booted this career rather than a fresh world. Checked at
      // the mobile viewport, where the wide-screen "Your save" aside is
      // correctly absent — so it deliberately is not part of the assertion.
      const loadedOurCareer =
        body.includes(fixture.expect.clubShortName) && body.includes(`Season ${fixture.expect.season}`);

      if (!loadedOurCareer) {
        fail(`the seeded career did not load: settings showed neither "${fixture.expect.clubShortName}" nor its season`);
      } else {
        const motion = p3.getByRole('switch', { name: 'Reduce motion' });
        if ((await motion.count()) === 0) {
          fail('could not find the "Reduce motion" control to change a persisted setting');
        } else {
          const before = await motion.first().getAttribute('aria-checked');
          await motion.first().click();
          await p3.waitForTimeout(1200); // let the save queue drain

          // The whole point: reload the page and see whether it stuck.
          await p3.reload({ waitUntil: 'networkidle' });
          await p3.waitForTimeout(2500);
          const after = await p3.getByRole('switch', { name: 'Reduce motion' }).first().getAttribute('aria-checked');
          const stillOurs = ((await p3.textContent('body')) ?? '').includes(fixture.expect.clubShortName);

          if (after === before) {
            fail(`a setting changed in the app did not survive a reload (still ${String(after)})`);
          } else if (!stillOurs) {
            fail('the career was lost across a reload');
          } else {
            pass('a real career loads from IndexedDB, takes a change, and survives a reload');
          }
        }
      }
    }

    const loopFailures = loopErrors.filter((e) => !/favicon|404/i.test(e));
    if (loopFailures.length > 0) {
      fail(`${loopFailures.length} runtime error(s) during the save loop: ${loopFailures[0].slice(0, 180)}`);
    }
    await ctx3.close();
  }
  rmSync(fixturePath, { force: true });
}

await browser.close();

console.log(
  failures.length === 0
    ? '\n[OK] smoke test passed\n'
    : `\n[X] smoke test failed with ${failures.length} problem(s)\n`,
);
if (failures.length > 0) process.exit(1);
