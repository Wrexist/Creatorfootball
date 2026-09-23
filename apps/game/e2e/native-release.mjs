import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { chromium } from 'playwright';

// Deliberately refuse personal devices and unrelated emulators: this test
// changes a career, stops its process and temporarily disables its networking.
const device = process.env.CF_ANDROID_TEST_SERIAL ?? 'emulator-5556';
const sdk = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT;
assert.ok(sdk, 'Set ANDROID_HOME to the Android SDK directory.');
const adb = join(sdk, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');
const cmd = args => execFileSync(adb, ['-s', device, ...args], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
assert.match(device, /^emulator-\d+$/);
assert.equal(cmd(['emu', 'avd', 'name']).split('\n')[0].trim(), 'CreatorFootball_Expansion_QA');
const app = 'com.creatorfootball.app';
const out = fileURLToPath(new URL('../../../artifacts/release-qualification/screenshots/', import.meta.url));
await mkdir(out, { recursive: true });
const errors = [], coldLaunches = [];
let browser, page;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const launch = async () => {
  const start = performance.now();
  cmd(['shell', 'am', 'start', '-W', '-n', `${app}/.MainActivity`]);
  let socket = '';
  for (let attempt = 0; attempt < 30 && !socket; attempt++) {
    try {
      const pid = cmd(['shell', 'pidof', app]).trim();
      if (pid && cmd(['shell', 'cat', '/proc/net/unix']).includes(`@webview_devtools_remote_${pid}`)) socket = `webview_devtools_remote_${pid}`;
    } catch { /* Process and WebView start asynchronously. */ }
    if (!socket) await delay(1000);
  }
  assert.ok(socket, 'The debug WebView must expose a CDP socket.');
  cmd(['forward', 'tcp:9224', `localabstract:${socket}`]);
  browser = await chromium.connectOverCDP('http://127.0.0.1:9224', { noDefaults: true });
  page = browser.contexts()[0].pages()[0];
  page.setDefaultTimeout(30000);
  page.on('pageerror', error => errors.push(String(error)));
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => document.querySelector('button, a[href="/home"]'));
  return start;
};
const navigate = async path => {
  await page.evaluate(path => { history.pushState({}, '', path); window.dispatchEvent(new PopStateEvent('popstate')); }, path);
};
const home = async () => {
  await navigate('/home');
  await page.getByText('Manager\u2019s desk', { exact: false }).first().waitFor();
};
const snapshot = async () => {
  const raw = await page.evaluate(() => localStorage.getItem('cf.save.v1'));
  assert.ok(raw, 'A persisted career must exist.');
  return JSON.parse(raw.startsWith('cf:gzip:1:') ? gunzipSync(Buffer.from(raw.slice(10), 'base64')).toString() : raw).state;
};
const shot = async name => {
  await page.waitForTimeout(400);
  const png = execFileSync(adb, ['-s', device, 'exec-out', 'screencap', '-p'], { maxBuffer: 10 * 1024 * 1024 });
  await writeFile(resolve(out, `${name}.png`), png);
};
const wifiEnabled = /Wi-Fi is enabled/.test(cmd(['shell', 'cmd', 'wifi', 'status']));
const dataEnabled = cmd(['shell', 'settings', 'get', 'global', 'mobile_data']).trim() === '1';
try {
  await launch();
  // First run on a freshly installed QA emulator still exercises real onboarding.
  if (await page.getByRole('button', { name: 'Start your career', exact: true }).count()) {
    await page.getByRole('button', { name: 'Start your career', exact: true }).click();
    await page.getByRole('button', { name: /Vera Lindqvist/ }).click();
    await page.getByRole('button', { name: 'Next: your club', exact: true }).click();
    await page.getByRole('button', { name: /Larkspur Wolves of/ }).click();
    await page.getByRole('button', { name: 'Take over Larkspur', exact: true }).click();
    await page.getByRole('button', { name: 'Meet your squad', exact: true }).click();
  }
  await home();
  await navigate('/squad/tactics');
  await page.getByRole('button', { name: 'Auto pick', exact: true }).click();
  await page.getByRole('button', { name: 'Formation & instructions', exact: true }).click();
  await page.getByRole('button', { name: /^3-2-1/ }).click();
  await page.getByRole('radio', { name: 'Quick', exact: true }).click();
  cmd(['shell', 'input', 'keyevent', '4']);
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await shot('tactics');
  await navigate('/squad/training');
  await page.getByRole('button', { name: /^Technical Work/ }).click();
  await page.getByRole('radio', { name: 'Hard', exact: true }).click();
  await shot('training');
  await navigate('/settings');
  for (const name of ['Reduce motion', 'Reduce effects']) {
    const toggle = page.getByRole('switch', { name, exact: true });
    if (await toggle.getAttribute('aria-checked') !== 'true') await toggle.click();
  }
  await page.getByRole('button', { name: 'Save now', exact: true }).click();
  await page.getByText('Saved', { exact: true }).waitFor();
  await shot('settings');
  const before = await snapshot();
  assert.equal(before.clubs[before.playerClubId].tactics.tempo, 'QUICK');
  assert.equal(before.training.programId, 'TECHNICAL');
  assert.equal(Object.values(before.clubs[before.playerClubId].tactics.lineup).filter(Boolean).length, 7);

  cmd(['shell', 'svc', 'wifi', 'disable']);
  cmd(['shell', 'svc', 'data', 'disable']);
  for (let attempt = 0; attempt < 2; attempt++) {
    await browser.close(); browser = null;
    cmd(['shell', 'am', 'force-stop', app]);
    const start = await launch();
    await home();
    coldLaunches.push({ controlsReadyIncludingAutomationMs: Math.round(performance.now() - start) });
    assert.deepEqual(await snapshot(), before, 'The complete career must survive offline process termination unchanged.');
  }
  await shot('offline-home');
  await navigate('/club/3d');
  await page.getByRole('button', { name: 'Open interactive 3D', exact: true }).waitFor();
  assert.equal(await page.locator('canvas').count(), 0, 'Reduced-effects mode must not create a renderer until requested.');
  await shot('reduced-effects-3d');
  await navigate('/settings/saves');
  await page.getByRole('button', { name: 'Export career file', exact: true }).click();
  await delay(1500);
  const exported = cmd(['shell', 'run-as', app, 'ls', 'cache/career-exports']).trim().split('\n').map(name => name.trim());
  const name = `creator-football-season-${before.clock.season}-week-${before.clock.week}.json`;
  assert.ok(exported.includes(name), 'The export must use the restricted provider directory.');
  const exportedState = JSON.parse(cmd(['exec-out', 'run-as', app, 'cat', `cache/career-exports/${name}`])).state;
  assert.deepEqual(exportedState, before);
  await shot('restricted-export-share');
  cmd(['shell', 'input', 'keyevent', '4']);
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.textContent.trim() === 'Export career file' && !button.disabled));
  assert.equal(await page.getByRole('alert').filter({ hasText: 'Share canceled' }).count(), 0, 'Dismissing export is a normal cancellation.');
  await shot('local-saves');
  cmd(['shell', 'am', 'start', '-a', 'android.settings.APPLICATION_DETAILS_SETTINGS', '-d', `package:${app}`]);
  let settingsUi = '';
  for (let attempt = 0; attempt < 8; attempt++) {
    cmd(['shell', 'uiautomator', 'dump', '/sdcard/cf-release-ui.xml']);
    settingsUi = cmd(['shell', 'cat', '/sdcard/cf-release-ui.xml']);
    if (settingsUi.includes('text="Creator Football"')) break;
    await delay(500);
  }
  assert.ok(settingsUi.includes('text="Creator Football"'), 'Wait for Android App info before inspecting the launcher icon.');
  await shot('android-app-icon');
  cmd(['shell', 'input', 'keyevent', '4']);
  assert.deepEqual(errors, []);
  await writeFile(resolve(out, 'results.json'), JSON.stringify({ device, network: 'Wi-Fi and mobile data disabled during both cold launches and export', coldLaunches, savedCareerSha256: createHash('sha256').update(JSON.stringify(before)).digest('hex'), wholeCareerComparison: 'identical after both process restarts and in exported file', errors }, null, 2));
  console.log('PASS: lineup, training, accessibility, two offline process restarts, full-career equality, restricted native export/share, adaptive launcher and reduced-effects 3D fallback.');
} finally {
  if (browser) await browser.close();
  cmd(['shell', 'svc', 'wifi', wifiEnabled ? 'enable' : 'disable']);
  cmd(['shell', 'svc', 'data', dataEnabled ? 'enable' : 'disable']);
  cmd(['forward', '--remove', 'tcp:9224']);
}
