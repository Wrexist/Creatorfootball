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
await page.getByRole('button', { name: 'Start your career', exact: true }).click();
await page.getByRole('button', { name: /Vera Lindqvist/ }).click();
await page.getByRole('button', { name: 'Next: your club', exact: true }).click();
await page.getByRole('button', { name: /Larkspur Wolves of/ }).click();
await page.getByRole('button', { name: 'Take over Larkspur', exact: true }).click();
await page.getByRole('button', { name: 'Meet your squad', exact: true }).click();
await page.goto(`${BASE}/home`);
await page.getByTestId('premium-home').waitFor();
const ready = await page.evaluate(() => {
  const raw = localStorage.getItem('cf.save.v1');
  if (!raw) return false;
  const state = JSON.parse(raw).state;
  return Boolean(state?.clubs?.[state.playerClubId]?.squad?.length && state?.managers?.[state.playerManagerId]);
});
if (!ready) throw new Error('Creation did not reach a persisted, playable career.');
pass('fresh career reaches Home with a real persisted squad and manager');

// --- 3. every primary action is actually clickable ---------------------
// The tab bar is fixed above the page. A sticky footer left in normal flow
// ends up underneath it, and the screen's most important control stops
// responding while still looking perfectly fine in a screenshot.
const ROUTES = ['/home', '/matchday', '/squad', '/league', '/market', '/social', '/club'];

// Stand-in side safe-area inset (px). Chromium has no env() emulation, but the
// app reads --safe-area-inset-* first, so setting it after each load is enough.
let sideInset = 0;

async function visit(route, settle) {
  await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
  if (sideInset > 0) {
    await page.evaluate((value) => {
      document.documentElement.style.setProperty('--safe-area-inset-right', `${value}px`);
    }, sideInset);
  }
  await page.waitForTimeout(settle);
}

/** Controls still covered by other chrome after scrolling them into view. */
async function coveredControls(route) {
  await visit(route, 1200);

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
  return blocked;
}

let obstructed = 0;
for (const route of ROUTES) {
  const blocked = await coveredControls(route);
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

/** Horizontal spill on the current route, naming the widest offender. */
async function overflowOf(route) {
  await visit(route, 1000);
  return page.evaluate(() => {
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
}

for (const route of ROUTES) {
  const over = await overflowOf(route);
  if (over) {
    overflowing += 1;
    fail(`${route}: overflows ${NARROW.width}px by ${over.scrollWidth - over.clientWidth}px — widest offender ${over.worst?.tag} "${over.worst?.text}"`);
  }
}
if (overflowing === 0) pass(`no route overflows a ${NARROW.width}px viewport`);

// --- 4b. iPhone Duo: both displays, and folding between them ----------
// The outer display is 466x678pt with the status bar and camera beside it,
// so the side safe-area inset is real there; the inner display is 890x626pt
// open flat and 626x890pt turned. Chromium cannot emulate env() insets, but
// the app reads --safe-area-inset-* first, so a stand-in right inset of 44px
// proves no control is laid out under the side status bar. The exact inset
// still needs confirming on the Xcode 27.1 iPhone Duo simulator.
const DUO_INSET = 44;
const DUO = [
  { name: 'Duo outer', width: 466, height: 678, insetRight: DUO_INSET },
  { name: 'Duo inner', width: 890, height: 626, insetRight: 0 },
  { name: 'Duo inner turned', width: 626, height: 890, insetRight: 0 },
];
let duoProblems = 0;
for (const duo of DUO) {
  await page.setViewportSize({ width: duo.width, height: duo.height });
  sideInset = duo.insetRight;
  for (const route of ROUTES) {
    const over = await overflowOf(route);
    if (over) {
      duoProblems += 1;
      fail(`${duo.name} ${route}: overflows by ${over.scrollWidth - over.clientWidth}px — widest offender ${over.worst?.tag} "${over.worst?.text}"`);
    }
    const blocked = await coveredControls(route);
    if (blocked.length > 0) {
      duoProblems += blocked.length;
      fail(`${duo.name} ${route}: ${blocked.length} control(s) covered, e.g. "${blocked[0]}"`);
    }
    if (duo.insetRight > 0) {
      // Hit-tested, not just measured: a tab in a horizontally scrolling
      // rail can extend past the edge while being clipped, never drawn there.
      const underInset = await page.evaluate((inset) => {
        const w = document.documentElement.clientWidth;
        const edge = w - inset;
        for (const el of document.querySelectorAll('button, a[href]')) {
          const r = el.getBoundingClientRect();
          if (r.width <= 0 || r.height <= 0 || r.right <= edge + 1) continue;
          const y = r.top + r.height / 2;
          if (y < 0 || y > window.innerHeight) continue;
          const hit = document.elementFromPoint(Math.min(r.right, w) - 1, y);
          if (hit && (el === hit || el.contains(hit))) {
            return (el.innerText || el.getAttribute('aria-label') || 'control').trim().slice(0, 40).replace(/\n/g, ' ');
          }
        }
        return null;
      }, duo.insetRight);
      if (underInset) {
        duoProblems += 1;
        fail(`${duo.name} ${route}: "${underInset}" sits under the side status bar`);
      }
    }
  }
}
sideInset = 0;

// Fold and unfold with a career open: resizing must not throw or blank the app.
const errorsBeforeFold = pageErrors.length;
await page.goto(`${BASE}/home`, { waitUntil: 'networkidle' });
for (const size of [DUO[1], DUO[0], DUO[2], DUO[0], DUO[1]]) {
  await page.setViewportSize({ width: size.width, height: size.height });
  await page.waitForTimeout(400);
}
const afterFold = await page.evaluate(() => document.body.innerText.trim().length);
if (pageErrors.length > errorsBeforeFold || afterFold < 10) {
  duoProblems += 1;
  fail(`folding between Duo displays broke the app: ${pageErrors.at(-1)?.slice(0, 180) ?? 'blank screen'}`);
}
if (duoProblems === 0) pass('iPhone Duo outer, inner and turned inner layouts fit, stay clear of the side inset and survive folding');
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
