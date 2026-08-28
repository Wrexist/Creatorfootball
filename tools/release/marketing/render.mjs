/**
 * App Store marketing screenshots — the framed, captioned images that appear
 * on the store listing, as opposed to the raw in-app captures produced by
 * tools/release/store-shots.mjs.
 *
 * Each frame is a headline, a subhead and three angled device mockups whose
 * screens are REAL captures of the running app. That distinction matters:
 * App Review guideline 2.3.1 requires screenshots to show the actual product,
 * so nothing here mocks up UI that does not exist — the marketing layer is
 * only the background, the type and the badges around the device.
 *
 * Renders every shot at all three sizes App Store Connect asks for. Logical
 * viewport x deviceScaleFactor is chosen to land exactly on the required
 * pixel dimensions (430x932 @3 = 1290x2796, and so on), so no image is ever
 * resampled — resampling is what makes store screenshots look soft.
 *
 * Usage (from the repo root):
 *   pnpm shots:store        # first — captures the in-app source images
 *   pnpm shots:marketing    # then — frames them
 *
 *   node tools/release/marketing/render.mjs [--only 05_social] [--size iphone-6.9]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { SHOTS, SIZES } from './shots.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(HERE, '..', 'store-shots');
const OUT_DIR = path.resolve(HERE, 'out');
const FONT_CSS = path.join(HERE, 'fonts', 'inter.css');

const argv = process.argv.slice(2);
const pick = (name) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : null; };
const ONLY = pick('only');
const ONLY_SIZE = pick('size');

const missing = SHOTS.map((s) => s.source).filter((n) => !fs.existsSync(path.join(SRC_DIR, `${n}.png`)));
if (missing.length) {
  console.error(`[marketing] missing source captures: ${missing.join(', ')}`);
  console.error('[marketing] run `pnpm shots:store` first — it writes them to tools/release/store-shots/.');
  process.exit(1);
}
if (!fs.existsSync(FONT_CSS)) { console.error(`[marketing] ${FONT_CSS} is missing.`); process.exit(1); }

const fontCss = fs.readFileSync(FONT_CSS, 'utf8');
const dataUri = (n) => `data:image/png;base64,${fs.readFileSync(path.join(SRC_DIR, `${n}.png`)).toString('base64')}`;
const screens = Object.fromEntries(SHOTS.map((s) => [s.source, dataUri(s.source)]));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

fs.mkdirSync(OUT_DIR, { recursive: true });

/**
 * The two phones flanking the hero are the neighbouring shots, so each frame
 * shows three different real screens and the set as a whole reads as one app
 * rather than eight crops of the same view.
 */
function neighbours(index) {
  const prev = SHOTS[(index - 1 + SHOTS.length) % SHOTS.length];
  const next = SHOTS[(index + 1) % SHOTS.length];
  return [prev.source, next.source];
}

function html(shot, index, size) {
  const tablet = size.kind === 'tablet';
  const [left, right] = neighbours(index);
  // One scale knob drives the whole layout: the phone frames are tuned at
  // 430pt wide, and the iPad canvas is 2.4x that with proportionally more air.
  const u = tablet ? size.css.width / 430 * 0.62 : size.css.width / 430;

  return `<!doctype html><html><head><meta charset="utf-8"><style>
${fontCss}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${size.css.width}px;height:${size.css.height}px;overflow:hidden}
body{font-family:Inter,system-ui,sans-serif;background:#08090b;
  -webkit-font-smoothing:antialiased;text-rendering:geometricPrecision}
.bg{position:absolute;inset:0;
  background:
    radial-gradient(120% 60% at 10% 0%, rgba(124,92,255,.44) 0%, rgba(124,92,255,0) 56%),
    radial-gradient(112% 52% at 94% 2%, rgba(46,86,190,.34) 0%, rgba(46,86,190,0) 58%),
    radial-gradient(126% 70% at 50% 70%, rgba(16,132,92,.42) 0%, rgba(16,132,92,0) 62%),
    radial-gradient(92% 42% at 50% 106%, rgba(200,255,46,.22) 0%, rgba(200,255,46,0) 70%),
    #08090b;}
/* Faint pitch-line grid: brand texture that reads as football without being a
   literal photograph of grass. Masked so it never competes with the type. */
.grid{position:absolute;inset:0;opacity:.05;
  background-image:linear-gradient(rgba(255,255,255,.9) 1px,transparent 1px),
                   linear-gradient(90deg,rgba(255,255,255,.9) 1px,transparent 1px);
  background-size:${46 * u}px ${46 * u}px;
  mask-image:radial-gradient(66% 46% at 50% 30%,#000 0%,transparent 76%);
  -webkit-mask-image:radial-gradient(66% 46% at 50% 30%,#000 0%,transparent 76%);}
.wrap{position:relative;width:100%;height:100%;display:flex;flex-direction:column;
  align-items:center;padding:${68 * u}px ${(tablet ? 60 : 28) * u}px 0}
.eyebrow{font-size:${13 * u}px;font-weight:600;letter-spacing:${0.3 * u}em;
  color:rgba(244,246,248,.60);text-transform:uppercase;margin-bottom:${16 * u}px}
h1{font-size:${62 * u}px;font-weight:900;line-height:.94;letter-spacing:-.035em;
  color:#f4f6f8;text-align:center;width:100%;max-width:${386 * u}px}
h1 span{display:block;white-space:nowrap}
h1 .accent{background:linear-gradient(96deg,#c8ff2e 4%,#8ef0a4 44%,#ffd76a 98%);
  -webkit-background-clip:text;background-clip:text;color:transparent;display:block}
.sub{margin-top:${18 * u}px;font-size:${20 * u}px;font-weight:500;line-height:1.34;
  color:rgba(244,246,248,.70);text-align:center;max-width:${368 * u}px;text-wrap:balance}

/* The hero sits fully in frame with room for the pill to overlap its lower
   edge; the two behind it bleed off the sides on purpose, so the set reads as
   "there is more app here" rather than as three cropped pictures. */
.stage{position:relative;flex:1;width:100%;display:flex;align-items:flex-start;
  justify-content:center;margin-top:${26 * u}px}
.phone{position:absolute;border-radius:${40 * u}px;overflow:hidden;background:#08090b;
  border:${1.5 * u}px solid rgba(255,255,255,.13);}
.phone img{display:block;width:100%;height:100%;object-fit:cover;object-position:top center}
.hero{width:${258 * u}px;height:${559 * u}px;z-index:3;
  box-shadow:0 ${40 * u}px ${92 * u}px -${18 * u}px rgba(0,0,0,.92),
             0 0 0 ${1.5 * u}px rgba(255,255,255,.17),
             0 ${8 * u}px ${44 * u}px rgba(200,255,46,.09);}
.side{width:${210 * u}px;height:${455 * u}px;z-index:1;opacity:.78;
  filter:saturate(.8) brightness(.66);
  box-shadow:0 ${28 * u}px ${60 * u}px -${16 * u}px rgba(0,0,0,.85);}
.l{transform:translateX(-${(tablet ? 330 : 152) * u}px) translateY(${72 * u}px) rotate(-8deg)}
.r{transform:translateX(${(tablet ? 330 : 152) * u}px) translateY(${72 * u}px) rotate(8deg)}

.badge{position:absolute;z-index:5;left:50%;
  transform:translateX(-${140 * u}px) translateY(${4 * u}px) rotate(-4deg);
  background:linear-gradient(180deg,#dcff6b,#c8ff2e);color:#0d1400;
  font-size:${17 * u}px;font-weight:800;letter-spacing:-.01em;
  padding:${13 * u}px ${22 * u}px;border-radius:999px;white-space:nowrap;
  box-shadow:0 ${12 * u}px ${34 * u}px -${6 * u}px rgba(200,255,46,.48),
             0 ${2 * u}px ${8 * u}px rgba(0,0,0,.45);}
.pill{position:absolute;z-index:5;left:50%;top:${524 * u}px;transform:translateX(-50%);
  display:flex;align-items:center;gap:${10 * u}px;
  background:rgba(18,21,25,.94);color:#f4f6f8;
  border:${1 * u}px solid rgba(255,255,255,.14);
  font-size:${17 * u}px;font-weight:700;padding:${13 * u}px ${24 * u}px;
  border-radius:999px;white-space:nowrap;
  box-shadow:0 ${14 * u}px ${38 * u}px -${8 * u}px rgba(0,0,0,.85);}
.pill i{width:${9 * u}px;height:${9 * u}px;border-radius:50%;background:#c8ff2e;
  box-shadow:0 0 ${12 * u}px rgba(200,255,46,.9);display:block}
.deco{position:absolute;z-index:4;font-size:${44 * u}px;line-height:1;
  filter:drop-shadow(0 ${8 * u}px ${18 * u}px rgba(0,0,0,.65))}
.d1{left:${(tablet ? 150 : 2) * u}px;top:${22 * u}px;transform:rotate(-13deg)}
.d2{right:${(tablet ? 150 : 2) * u}px;top:${54 * u}px;transform:rotate(13deg)}
</style></head><body>
<div class="bg"></div><div class="grid"></div>
<div class="wrap">
  <div class="eyebrow">${esc(shot.eyebrow)}</div>
  <h1><span>${esc(shot.line1)}</span><span class="accent">${esc(shot.line2)}</span></h1>
  <div class="sub">${esc(shot.sub)}</div>
  <div class="stage">
    <div class="phone side l"><img src="${screens[left]}"></div>
    <div class="phone side r"><img src="${screens[right]}"></div>
    <div class="phone hero"><img src="${screens[shot.source]}"></div>
    <div class="deco d1">${shot.emoji[0]}</div>
    <div class="deco d2">${shot.emoji[1]}</div>
    <div class="badge">${esc(shot.badge)}</div>
    <div class="pill"><i></i>${esc(shot.pill)}</div>
  </div>
</div>
<script>
/* Fit the headline to two lines. Copy length varies per shot and a wrapped
   third line pushes the device stack off the bottom of the canvas, so shrink
   until both lines fit rather than trusting one hand-tuned size. */
(function(){
  var h1=document.querySelector('h1');
  var lines=[].slice.call(h1.querySelectorAll('span'));
  var fs=${62 * u};
  h1.style.fontSize=fs+'px';
  for(var i=0;i<240;i++){
    var over=lines.some(function(l){return l.scrollWidth>h1.clientWidth;});
    if(!over) break;
    fs-=0.5; h1.style.fontSize=fs+'px';
  }
})();
</script>
</body></html>`;
}

const sizes = SIZES.filter((s) => !ONLY_SIZE || s.key === ONLY_SIZE);
const shots = SHOTS.filter((s) => !ONLY || s.id === ONLY);
if (!sizes.length) { console.error(`[marketing] unknown --size "${ONLY_SIZE}"`); process.exit(1); }
if (!shots.length) { console.error(`[marketing] unknown --only "${ONLY}"`); process.exit(1); }

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
let n = 0;
try {
  for (const size of sizes) {
    const dir = path.join(OUT_DIR, `${size.key}-${size.w}x${size.h}`);
    fs.mkdirSync(dir, { recursive: true });
    const ctx = await browser.newContext({ viewport: size.css, deviceScaleFactor: size.dpr });
    const page = await ctx.newPage();
    console.log(`\n${size.key} — ${size.w}x${size.h}`);
    for (const [i, shot] of SHOTS.entries()) {
      if (!shots.includes(shot)) continue;
      await page.setContent(html(shot, i, size), { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(160);
      const file = path.join(dir, `${shot.id}.png`);
      await page.screenshot({ path: file });
      // Read the PNG's IHDR back rather than trusting the viewport maths: a
      // rounding slip of one pixel is invisible here and fails the upload.
      const hdr = fs.readFileSync(file).subarray(16, 24);
      const got = [hdr.readUInt32BE(0), hdr.readUInt32BE(4)];
      if (got[0] !== size.w || got[1] !== size.h) {
        throw new Error(`${shot.id} for ${size.key}: wrote ${got[0]}x${got[1]}, expected ${size.w}x${size.h}`);
      }
      console.log(`  ${shot.id}.png  ${got[0]}x${got[1]}`);
      n++;
    }
    await ctx.close();
  }
  console.log(`\n${n} images in ${path.relative(process.cwd(), OUT_DIR)}\n`);
} finally { await browser.close().catch(() => {}); }
