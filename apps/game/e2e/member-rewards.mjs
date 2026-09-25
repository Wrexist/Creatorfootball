import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const out = 'artifacts/membership-rewards';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
try {
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  for (const width of [360, 393, 430]) {
    await page.setViewportSize({ width, height: 852 });
    for (const kind of ['trial', 'paid', 'cash', 'superstar', 'creator']) {
      await page.goto(`http://127.0.0.1:5193/e2e/member-rewards.html?kind=${kind}`);
      await page.getByRole('heading', { level: 2 }).waitFor();
      await page.evaluate(() => document.fonts.ready);
      const button = page.getByRole('button', { name: /^(Explore|Back to) my benefits$/ });
      const bounds = await button.boundingBox();
      assert.ok(bounds && bounds.y >= 0 && bounds.y + bounds.height <= 852, 'Continue stays visible');
      assert.ok(await page.getByRole('dialog').evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'No horizontal overflow');
      await page.getByRole('button', { name: 'Close reward celebration' }).focus();
      await page.keyboard.press('Shift+Tab');
      assert.equal(await button.evaluate(el => el === document.activeElement), true, 'Focus stays in reward dialog');
      if (kind === 'trial') assert.ok((await page.getByRole('dialog').innerText()).includes('They have not been granted during your trial'));
      if (width === 393) { await page.waitForTimeout(1800); await page.screenshot({ path: `${out}/${kind}-393.png` }); }
      await button.click();
      await page.getByText('Celebration dismissed', { exact: true }).waitFor();
    }
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('http://127.0.0.1:5193/e2e/member-rewards.html?kind=superstar');
  await page.getByRole('heading', { level: 2 }).waitFor();
  assert.equal(await page.locator('.cf-reward-hero').evaluate(el => getComputedStyle(el).animationName), 'none');
  assert.equal(await page.locator('.cf-reward-sparks').count(), 0);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('http://127.0.0.1:5193/e2e/member-rewards.html?kind=paid&simple=1');
  await page.getByRole('heading', { level: 2 }).waitFor();
  assert.equal(await page.locator('.cf-reward-sparks').count(), 0);
  assert.equal(await page.locator('.cf-reward-hero').evaluate(el => getComputedStyle(el).animationName), 'none');
  await page.goto('http://127.0.0.1:5193/e2e/member-rewards.html?flow=1');
  await page.getByRole('button', { name: /^Sign Kai Arden/ }).click();
  await page.getByRole('heading', { name: 'Kai Arden is yours' }).waitFor();
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('button', { name: 'Welcome signing claimed' }).isDisabled(), true);
  await page.getByRole('button', { name: /^Claim .*in-game funds/ }).click();
  await page.getByRole('heading', { name: '+£250,000', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Back to my benefits' }).click();
  assert.equal(await page.getByRole('button', { name: 'Club funds claimed this month' }).isDisabled(), true);
  await page.getByRole('button', { name: 'Choose Mika Sol' }).click();
  await page.getByRole('heading', { name: 'Mika Sol joins the club' }).waitFor();
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('button', { name: 'Creator collaboration claimed' }).count(), 2);
  await page.goto('http://127.0.0.1:5193/e2e/member-rewards.html?flow=1&save-failure=1');
  await page.getByRole('button', { name: /^Claim .*in-game funds/ }).click();
  await page.getByRole('status').filter({ hasText: 'saving failed' }).waitFor();
  assert.equal(await page.locator('.cf-member-celebration').count(), 0, 'Failed save never celebrates');
  await page.goto('http://127.0.0.1:5193/e2e/member-rewards.html?flow=1&kind=trial');
  assert.equal(await page.getByRole('button', { name: /^Sign Kai Arden/ }).isDisabled(), true);
  assert.deepEqual(errors, []);
  console.log('PASS: 15 reward/viewport combinations, fixed CTA, dismissal, focus trap, reduced motion/effects; all three claims, duplicate prevention, trial exclusion and failed-save suppression.');
} finally { await browser.close(); }
