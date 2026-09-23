import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const base = process.argv[2] ?? 'http://127.0.0.1:5173';
const output = resolve('../../artifacts/media-repair-20260923');
await mkdir(output, { recursive: true });
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const context = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
const page = await context.newPage();
page.setDefaultTimeout(20000);
const errors = [], failedArt = [], timings = [];
page.on('pageerror', error => errors.push(String(error)));
page.on('response', response => { if (response.url().includes('/art/') && response.status() >= 400) failedArt.push(response.url()); });
const capture = async name => { await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(300); await page.screenshot({ path: `${output}/${name}.png` }); };
const route = async path => { const start = performance.now(); await page.goto(`${base}${path}`); await page.locator('main').waitFor(); await page.evaluate(() => document.fonts.ready); timings.push({ route: path, navigationMs: Math.round(performance.now() - start) }); };
try {
  await page.goto(base);
  await page.getByRole('button', { name: 'Start your career', exact: true }).click();
  await page.getByRole('button', { name: /Vera Lindqvist/ }).waitFor();
  await capture('01-manager-selection');
  await page.getByRole('button', { name: /Vera Lindqvist/ }).click();
  await page.getByRole('button', { name: 'Next: your club', exact: true }).click();
  await page.getByRole('button', { name: /Larkspur Wolves of/ }).click();
  await page.getByRole('button', { name: 'Take over Larkspur', exact: true }).click();
  const reveal = page.getByRole('dialog', { name: 'Larkspur Wolves', exact: true });
  await reveal.waitFor();
  await capture('02-club-reveal');
  await reveal.locator('h1,h2').first().click();
  await reveal.waitFor();
  await page.keyboard.press('Tab');
  assert.equal(await reveal.evaluate(el => el.contains(document.activeElement)), true, 'reveal traps focus');
  await page.getByRole('button', { name: 'Meet your squad', exact: true }).click();
  await page.waitForURL(/create\/squad/);
  await route('/home');
  await capture('03-home');
  await route('/squad/tactics');
  await page.getByRole('button', { name: 'Auto pick', exact: true }).click();
  await capture('04-tactics');
  await page.getByRole('heading', { name: 'Not selected', exact: false }).scrollIntoViewIfNeeded();
  await capture('05-bench-reserves');
  await route('/matchday');
  await capture('06-matchday');
  await page.getByRole('button', { name: 'Play Match', exact: true }).click();
  await page.getByRole('button', { name: 'Pause', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await capture('07-live-match');
  await page.getByRole('button', { name: /Match speed/ }).click();
  await page.getByRole('button', { name: 'Jump to the final whistle', exact: true }).click();
  await page.waitForURL(/result/);
  await page.getByRole('button', { name: 'Next: Key moment', exact: true }).waitFor();
  await capture('08-result');
  await page.getByRole('button', { name: 'View full report', exact: true }).click();
  await page.locator('#stage-SOCIAL').scrollIntoViewIfNeeded();
  await capture('09-club-reaction');
  const initialText = await page.locator('#stage-SOCIAL').innerText();
  const initialHeight = await page.locator('#stage-SOCIAL').evaluate(el => el.getBoundingClientRect().height);
  for (let frame = 0; frame < 20; frame++) {
    await page.waitForTimeout(250);
    assert.equal(await page.locator('#stage-SOCIAL').innerText(), initialText, 'author text remains stable');
    assert.ok(Math.abs(await page.locator('#stage-SOCIAL').evaluate(el => el.getBoundingClientRect().height) - initialHeight) < 1, 'social cards do not oscillate');
  }
  await page.locator('#stage-MONEY').scrollIntoViewIfNeeded();
  await capture('10-result-finances');
  const financeHeight = await page.locator('#stage-MONEY').evaluate(el => el.getBoundingClientRect().height);
  for (let frame = 0; frame < 12; frame++) { await page.waitForTimeout(250); assert.ok(Math.abs(await page.locator('#stage-MONEY').evaluate(el => el.getBoundingClientRect().height) - financeHeight) < 1, 'finance cards do not oscillate'); }
  const news=page.locator('#stage-SOCIAL button').filter({has:page.locator('h3')}).first();
  if(await news.count()) { const title=await news.locator('h3').innerText();await news.click();await page.getByRole('dialog').waitFor();assert.ok((await page.getByRole('dialog').innerText()).includes(title),'report news opens its actual story');await page.keyboard.press('Escape'); }
  for (const [name,path] of [['11-squad','/squad'], ['12-training','/squad/training'], ['13-market','/market/search'], ['14-club','/club'], ['15-facilities','/club/facilities'], ['16-finances','/club/finances'], ['17-social','/social']]) {
    await route(path); await capture(name);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${path} horizontal overflow`);
  }
  await context.storageState({ path: `${output}/browser-state.json` });
  await writeFile(`${output}/metrics.json`, JSON.stringify({timings, errors, failedArt}, null, 2));
  assert.deepEqual(errors, []); assert.deepEqual(failedArt, []);
  console.log(`PASS media audit: stable text and cards, modal focus, explicit reveal action, fresh career and match journey. Screenshots: ${output}`);
} catch(error) {
  await page.screenshot({path:`${output}/failure.png`});
  await writeFile(`${output}/failure.json`,JSON.stringify({url:page.url(),body:await page.locator('body').innerText(),errors,error:String(error)},null,2));
  throw error;
} finally { await browser.close(); }
