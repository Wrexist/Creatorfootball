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

const BASE = process.argv[2] ?? 'http://127.0.0.1:4173';
const CHROME = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const VIEWPORT = { width: 393, height: 852 };

const failures = [];
const fail = (msg) => { failures.push(msg); console.log(`  FAIL  ${msg}`); };
const pass = (msg) => console.log(`  PASS  ${msg}`);

const browser = await chromium.launch({ executablePath: CHROME });
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

await browser.close();

console.log(
  failures.length === 0
    ? '\n[OK] smoke test passed\n'
    : `\n[X] smoke test failed with ${failures.length} problem(s)\n`,
);
if (failures.length > 0) process.exit(1);
