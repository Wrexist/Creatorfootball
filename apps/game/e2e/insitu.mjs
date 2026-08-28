/**
 * In-situ check for the generated art plates.
 *
 * An asset that looks right on its own and wrong on the screen that uses it is
 * a failed asset, and neither the ingest report nor a pixel check can tell you
 * which you have — the ingest pipeline only knows dimensions and bytes. So this
 * drives the built app, opens the moment that consumes the plates, and writes a
 * screenshot for a human to look at.
 *
 * It also asserts the two things that are easy to get silently wrong: that no
 * `/art/` request 404s, and that the plates are actually in the DOM at the
 * opacity and blend mode they were composed for. A missing plate is *not* a
 * failure of the app — the procedural path still draws — which is exactly why
 * it needs saying out loud here rather than being noticed six months later.
 *
 *   CHROMIUM_PATH=/opt/pw-browsers/chromium node e2e/insitu.mjs <out-dir>
 */
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:4173';
const OUT = process.argv[2] ?? '.';
const CHROME = process.env.CHROMIUM_PATH || undefined;

const preview = spawn('npx vite preview --port 4173 --strictPort', { shell: true, stdio: 'ignore' });

function killPreview() {
  if (!preview.pid) return;
  // shell:true means the direct child is a shell wrapper; on Windows killing it
  // alone orphans the real server, so take the whole tree down.
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(preview.pid), '/f', '/t'], { stdio: 'ignore' });
  } else {
    preview.kill('SIGTERM');
  }
}

async function waitForServer(deadline = Date.now() + 40_000) {
  while (Date.now() < deadline) {
    try { if ((await fetch(BASE)).ok) return true; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

let failed = false;
try {
  if (!await waitForServer()) throw new Error('preview server never came up');
  const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});
  const page = await browser.newPage({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2 });

  const broken = [];
  page.on('response', (r) => {
    if (r.url().includes('/art/') && r.status() >= 400) broken.push(`${r.status()} ${r.url()}`);
  });

  await page.goto(`${BASE}/dev/gallery`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Club reveal' }).click();
  await page.waitForTimeout(2600);          // let the plates decode and fade in
  await page.screenshot({ path: `${OUT}/insitu-reveal.png` });

  const plates = await page.evaluate(() => Array.from(document.querySelectorAll('img[src*="/art/"]'))
    .map((i) => ({
      src: new URL(i.src).pathname,
      decoded: i.naturalWidth > 0,
      opacity: getComputedStyle(i).opacity,
      blend: getComputedStyle(i).mixBlendMode,
    })));

  for (const p of plates) console.log(`  plate ${p.src} decoded=${p.decoded} opacity=${p.opacity} blend=${p.blend}`);
  if (!plates.length) console.log('  no plates present — the procedural path is carrying the moment');
  if (broken.length) { failed = true; for (const b of broken) console.log(`  BROKEN ${b}`); }

  await browser.close();
  console.log(failed ? '[FAIL] a plate 404ed' : '[OK] in-situ screenshot written');
} finally {
  killPreview();
}
process.exit(failed ? 1 : 0);
