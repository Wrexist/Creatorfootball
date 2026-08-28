/**
 * Vector tracer for the flat CF mark.
 *
 * `masters/mark-mono.png` is the only master that is *flat* — a two-panel
 * sheet with the mark in white on graphite and again in graphite on white. It
 * is the shape underneath every other master: the 3D app icon, the chrome
 * crest and the lockups are all that silhouette with material on top. Which
 * makes it the one master that can become geometry rather than pixels.
 *
 * That matters in exactly two places, and both of them are places a raster
 * file is the wrong answer:
 *
 *   - `apps/game/src/features/onboarding/BrandMark.tsx` paints in the first
 *     frame, before any chunk beyond the entry has loaded. It cannot wait for
 *     a network round-trip, so the mark there has to be geometry inlined in
 *     the bundle.
 *   - a tab favicon and a Safari pinned-tab mask are rendered at 16-24px and
 *     at arbitrary DPR. A downscaled 3D render turns to mush at that size;
 *     a path stays a shape.
 *
 * So this script reads the master, thresholds it to a binary mask, walks the
 * pixel boundary into closed loops, simplifies them, and prints the path data.
 * It is run by hand when the master changes — its *output* is committed, not
 * regenerated at build time, because a build that depends on a headless
 * browser to draw its own logo is a build that breaks for the wrong reasons.
 *
 *   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node tools/brand/trace-mark.mjs
 *   … --tolerance 0.16 --viewbox 64 --out tools/brand/mark.path.txt
 */
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const brandDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(brandDir, '..', '..');
const CHROMIUM = process.env.CF_CHROMIUM ?? '/opt/pw-browsers/chromium';

const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : fallback;
};

const master = path.resolve(repoRoot, opt('master', 'tools/brand/masters/mark-mono.png'));
/** Simplification tolerance, in units of the output viewBox. */
const tolerance = Number(opt('tolerance', '0.09'));
/** Square viewBox the path is emitted in. 64 matches `BrandMark`. */
const viewBox = Number(opt('viewbox', '64'));
/** Luminance above which a pixel is ink. The master is pure black and white. */
const threshold = Number(opt('threshold', '128'));
const outFile = opt('out', null);

// ------------------------------------------------------------------ decode

/**
 * The master's left panel as a binary ink mask.
 *
 * The sheet is two panels of the same mark — white-on-graphite then
 * graphite-on-white — so half of it is the negative of the other half and
 * tracing both would produce the shape twice, once inside-out. We take the
 * left panel and read "bright" as ink. The panel split is found from the
 * image rather than assumed at exactly 50%, because the master is a
 * generation and its seam does not land on a round number.
 */
async function readMask() {
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  try {
    const page = await browser.newPage();
    await page.setContent('<body></body>');
    /* eslint-disable no-undef -- the callback below runs in the page, not in Node */
    return await page.evaluate(async ({ b64, threshold }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);

      const lum = (x, y) => {
        const i = (y * width + x) * 4;
        return 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      };

      // Column mean luminance: the left panel is dark, the right one light, and
      // the seam is the steepest step between them.
      const means = new Float64Array(width);
      for (let x = 0; x < width; x += 1) {
        let sum = 0;
        for (let y = 0; y < height; y += 1) sum += lum(x, y);
        means[x] = sum / height;
      }
      let seam = width >> 1;
      let best = -1;
      for (let x = Math.round(width * 0.3); x < Math.round(width * 0.7); x += 1) {
        const step = means[x + 1] - means[x - 1];
        if (step > best) { best = step; seam = x; }
      }

      // Trim the panel to the mark's own bounding box so the emitted path fills
      // its viewBox rather than inheriting the master's letterboxing.
      let minX = seam, minY = height, maxX = 0, maxY = 0;
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < seam; x += 1) {
          if (lum(x, y) >= threshold) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      if (maxX < minX || maxY < minY) throw new Error('no ink found in the left panel');

      const w = maxX - minX + 1;
      const h = maxY - minY + 1;
      const mask = new Uint8Array(w * h);
      for (let y = 0; y < h; y += 1) {
        for (let x = 0; x < w; x += 1) {
          mask[y * w + x] = lum(minX + x, minY + y) >= threshold ? 1 : 0;
        }
      }
      return { mask: Array.from(mask), width: w, height: h, seam };
    }, { b64: fs.readFileSync(master).toString('base64'), threshold });
    /* eslint-enable no-undef */
  } finally {
    await browser.close();
  }
}

// ------------------------------------------------------------------- trace

/**
 * Every closed boundary of the mask, as pixel-lattice polygons.
 *
 * One directed edge per ink-pixel side that faces non-ink, oriented so the ink
 * is consistently on the same hand, then chained end-to-start into loops. This
 * traces outer contours and holes alike and never has to know which is which —
 * the path is filled `evenodd`, so a hole is simply a loop inside another one.
 *
 * The only ambiguity is a vertex where two ink pixels meet corner-to-corner:
 * four edges arrive and four leave. Preferring the sharpest right turn treats
 * diagonally touching ink as connected, which keeps the counter of the `C`
 * and the spur of the `F` as one shape instead of pinching them apart.
 */
function traceLoops(mask, width, height) {
  const ink = (x, y) => (x < 0 || y < 0 || x >= width || y >= height ? 0 : mask[y * width + x]);
  const key = (x, y) => y * (width + 1) + x;

  /** @type {Map<number, {to: [number, number], used: boolean}[]>} */
  const out = new Map();
  const add = (from, to) => {
    const k = key(from[0], from[1]);
    const list = out.get(k);
    const edge = { to, used: false };
    if (list) list.push(edge); else out.set(k, [edge]);
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!ink(x, y)) continue;
      if (!ink(x, y - 1)) add([x + 1, y], [x, y]);
      if (!ink(x - 1, y)) add([x, y], [x, y + 1]);
      if (!ink(x, y + 1)) add([x, y + 1], [x + 1, y + 1]);
      if (!ink(x + 1, y)) add([x + 1, y + 1], [x + 1, y]);
    }
  }

  const loops = [];
  for (const [startKey, edges] of out) {
    for (const seed of edges) {
      if (seed.used) continue;
      seed.used = true;
      const startX = startKey % (width + 1);
      const startY = Math.floor(startKey / (width + 1));
      const loop = [[startX, startY]];
      let cursor = seed.to;
      let dir = [seed.to[0] - startX, seed.to[1] - startY];

      for (;;) {
        loop.push(cursor);
        if (cursor[0] === startX && cursor[1] === startY) break;
        const next = out.get(key(cursor[0], cursor[1]))?.filter((e) => !e.used) ?? [];
        if (next.length === 0) break;
        // Sharpest right turn first: right, straight, left, back.
        const rank = (e) => {
          const d = [e.to[0] - cursor[0], e.to[1] - cursor[1]];
          const cross = dir[0] * d[1] - dir[1] * d[0];
          const dot = dir[0] * d[0] + dir[1] * d[1];
          if (cross > 0) return 0;
          if (dot > 0) return 1;
          if (cross < 0) return 2;
          return 3;
        };
        next.sort((a, b) => rank(a) - rank(b));
        const chosen = next[0];
        chosen.used = true;
        dir = [chosen.to[0] - cursor[0], chosen.to[1] - cursor[1]];
        cursor = chosen.to;
      }
      if (loop.length > 4) loops.push(loop);
    }
  }
  return loops;
}

// ---------------------------------------------------------------- simplify

/** Ramer–Douglas–Peucker on an open run of points. */
function rdp(points, epsilon) {
  if (points.length < 3) return points;
  const [ax, ay] = points[0];
  const [bx, by] = points[points.length - 1];
  const dx = bx - ax;
  const dy = by - ay;
  const norm = Math.hypot(dx, dy);

  let worst = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i += 1) {
    const [px, py] = points[i];
    const d = norm === 0
      ? Math.hypot(px - ax, py - ay)
      : Math.abs(dy * px - dx * py + bx * ay - by * ax) / norm;
    if (d > worst) { worst = d; index = i; }
  }
  if (worst <= epsilon) return [points[0], points[points.length - 1]];
  return [
    ...rdp(points.slice(0, index + 1), epsilon).slice(0, -1),
    ...rdp(points.slice(index), epsilon),
  ];
}

/**
 * Simplify a closed loop without pinning an arbitrary vertex.
 *
 * RDP anchors its first and last point, and on a closed ring those are the
 * same arbitrary pixel corner where the trace happened to start — leaving a
 * visible kink there. Splitting the ring at its two most distant points and
 * simplifying each half separately puts the anchors somewhere the shape
 * actually turns.
 */
function simplifyLoop(loop, epsilon) {
  const ring = loop.slice(0, -1);
  if (ring.length < 8) return ring;

  let far = 0;
  let best = -1;
  for (let i = 1; i < ring.length; i += 1) {
    const d = Math.hypot(ring[i][0] - ring[0][0], ring[i][1] - ring[0][1]);
    if (d > best) { best = d; far = i; }
  }
  const head = rdp([...ring.slice(0, far + 1)], epsilon);
  const tail = rdp([...ring.slice(far), ring[0]], epsilon);
  return [...head.slice(0, -1), ...tail.slice(0, -1)];
}

// ------------------------------------------------------------------ output

const { mask, width, height } = await readMask();
const loops = traceLoops(Uint8Array.from(mask), width, height);

// Fit the traced bounding box into the viewBox, centred, preserving aspect.
const scale = viewBox / Math.max(width, height);
const offsetX = (viewBox - width * scale) / 2;
const offsetY = (viewBox - height * scale) / 2;
const round = (n) => {
  const r = Math.round(n * 100) / 100;
  return Object.is(r, -0) ? 0 : r;
};

const areaOf = (pts) => {
  let a = 0;
  for (let i = 0; i < pts.length; i += 1) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
};

const d = loops
  .map((loop) => loop.map(([x, y]) => [offsetX + x * scale, offsetY + y * scale]))
  // A stray speck from a compression artefact is not part of the mark. Anything
  // under a thousandth of the viewBox area is noise, not geometry.
  .filter((pts) => areaOf(pts) > (viewBox * viewBox) / 1000)
  .map((pts) => simplifyLoop([...pts, pts[0]], tolerance))
  .sort((a, b) => areaOf(b) - areaOf(a))
  .map((pts) => `M${pts.map(([x, y]) => `${round(x)} ${round(y)}`).join('L')}Z`)
  .join('');

const report = [
  `master      ${path.relative(repoRoot, master)}`,
  `mask        ${width}x${height}`,
  `loops       ${loops.length} traced`,
  `viewBox     0 0 ${viewBox} ${viewBox}`,
  `tolerance   ${tolerance}`,
  `path        ${d.length} chars, ${(d.match(/[ML]/g) ?? []).length} points`,
].join('\n');

if (outFile) {
  fs.writeFileSync(path.resolve(repoRoot, outFile), `${d}\n`);
  console.log(report);
  console.log(`written     ${outFile}`);
} else {
  console.log(report);
  console.log('');
  console.log(d);
}
