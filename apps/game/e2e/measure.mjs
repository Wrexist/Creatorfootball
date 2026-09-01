/**
 * Player-facing latency and payload measurement for career creation.
 *
 * Runs the same journey a new player makes and records, in the browser's own
 * clock, how long each beat took and how many script bytes had to arrive
 * before it could happen. Numbers, not opinions: this is what "the first
 * screen is faster" is measured against.
 *
 * Usage: node e2e/measure.mjs [baseUrl] [runs]
 *
 * Every figure is a desktop headless Chromium number on the machine running
 * it. It compares one build against another on the same machine; it says
 * nothing about an iPhone.
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://127.0.0.1:4173';
const RUNS = Number(process.argv[3] ?? 3);
const CHROME = process.env.CHROMIUM_PATH || undefined;
const OPTION = 'button[aria-pressed="false"]';

const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});

async function once() {
  const ctx = await browser.newContext({
    viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  });
  const page = await ctx.newPage();
  const scripts = [];
  page.on('response', async (res) => {
    const url = res.url();
    if (!/\.js(\?|$)/.test(url)) return;
    let bytes = 0;
    try { bytes = (await res.body()).length; } catch { /* aborted */ }
    scripts.push({ file: url.split('/').pop(), bytes, at: performance.now() });
  });
  const now = () => performance.now();
  const bytesSoFar = () => scripts.reduce((sum, s) => sum + s.bytes, 0);

  const t0 = now();
  await page.goto(BASE);
  const start = page.getByRole('button', { name: /start your career/i }).first();
  await start.waitFor({ state: 'visible' });
  const firstScreen = now() - t0;
  const bytesAtFirstScreen = bytesSoFar();

  const t1 = now();
  await start.click();
  await page.waitForURL('**/create/manager');
  await page.locator(OPTION).first().waitFor({ state: 'visible' });
  const managerStep = now() - t1;

  const t2 = now();
  await page.locator(OPTION).first().click();
  await page.getByRole('button', { name: /next: your club/i }).click();
  await page.waitForURL('**/create/club');
  await page.locator(OPTION).first().waitFor({ state: 'visible' });
  const clubStep = now() - t2;
  const bytesAtClubStep = bytesSoFar();

  await page.locator(OPTION).first().click();
  const t3 = now();
  await page.getByRole('button', { name: /^take over\s/i }).click();
  await page.getByRole('button', { name: /meet your squad/i }).waitFor({ state: 'visible' });
  const confirmToReveal = now() - t3;

  await page.getByRole('button', { name: /meet your squad/i }).click();
  await page.waitForURL('**/create/squad');
  await page.getByRole('button', { name: /^play\b/i }).waitFor({ state: 'visible' });
  const confirmToPlayable = now() - t3;

  const content = scripts.filter((s) => /content-/.test(s.file));
  await ctx.close();
  return {
    firstScreen, bytesAtFirstScreen, managerStep, clubStep, bytesAtClubStep,
    confirmToReveal, confirmToPlayable,
    contentRequests: content.length, contentBytes: content.reduce((n, s) => n + s.bytes, 0),
    totalBytes: bytesSoFar(),
  };
}

const runs = [];
for (let i = 0; i < RUNS; i++) runs.push(await once());
await browser.close();

const median = (key) => {
  const xs = runs.map((r) => r[key]).sort((a, b) => a - b);
  return xs[Math.floor(xs.length / 2)];
};
const ms = (key) => `${Math.round(median(key))} ms`;
const kb = (key) => `${(median(key) / 1024).toFixed(1)} kB`;

console.log(`\nCareer creation, median of ${RUNS} runs against ${BASE}\n`);
console.log(`  first screen (title visible)          ${ms('firstScreen')}   script bytes ${kb('bytesAtFirstScreen')}`);
console.log(`  start -> manager step interactive     ${ms('managerStep')}`);
console.log(`  next -> club step interactive         ${ms('clubStep')}   script bytes ${kb('bytesAtClubStep')}`);
console.log(`  confirm -> club reveal                ${ms('confirmToReveal')}   (includes the 1500 ms build beat)`);
console.log(`  confirm -> playable (squad screen)    ${ms('confirmToPlayable')}`);
console.log(`  content chunk requests                ${median('contentRequests')}   bytes ${kb('contentBytes')}`);
console.log(`  script bytes for the whole journey    ${kb('totalBytes')}\n`);
