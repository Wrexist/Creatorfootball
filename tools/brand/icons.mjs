/**
 * The one place every icon in this repo comes from.
 *
 * Before this script there were four different marks in circulation — a vector
 * volt-ball in `website/favicon.svg`, a rasterised copy of it in the website's
 * PNG slots, a third artwork in the iOS app icon, and nothing at all in the
 * game's `index.html` — and no way to tell which was current. They are one
 * mark now, and this file is why: every icon, favicon, splash and share card in
 * the repo is *derived*, by this script, from the committed masters in
 * `masters/`. Nothing is hand-exported, so nothing can drift.
 *
 *   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node tools/brand/icons.mjs
 *   … --dry-run     report every slot and its size without writing a byte
 *   … --only game   write one group: game | website | ios
 *
 * **Chromium is the image processor**, for the same reason `ingest.mjs` uses
 * it: there is no ImageMagick, sharp or pngquant here and no network to
 * install one. Decoding, fitting and PNG/JPEG encoding all happen on a
 * `<canvas>` in a headless page; Node reads the masters and writes the output,
 * and assembles the one container format Chromium will not emit — `.ico`.
 *
 * ## Which master feeds which slot, and why
 *
 * `app-icon.png` is the finished icon artwork: the crest lit in a stadium,
 * inside its own rounded square on near-black. It feeds everything rendered at
 * 120px or larger — home screens, PWA installs, the App Store.
 *
 * `mark-mono.png` is the same silhouette, flat. Below about 48px the app icon's
 * bevels, reflections and rim light stop reading as material and start reading
 * as noise, which is exactly what `masters/favicon-sizes-reference.png` shows:
 * the mark losing detail deliberately as it shrinks. So every small slot — the
 * tab favicon, the `.ico`, the pinned tab — is drawn from the traced vector
 * (`mark.path.txt`, see `trace-mark.mjs`) instead, as flat white on graphite.
 * A shape stays a shape at 16px; a photograph does not.
 */
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const brandDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(brandDir, '..', '..');
const mastersDir = path.join(brandDir, 'masters');
const CHROMIUM = process.env.CF_CHROMIUM ?? '/opt/pw-browsers/chromium';

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const onlyIndex = argv.indexOf('--only');
const only = onlyIndex >= 0 ? argv[onlyIndex + 1] : null;

if (argv.includes('--help')) {
  console.log('Usage: icons.mjs [--dry-run] [--only game|website|ios]');
  process.exit(0);
}

/** The product's ground. Every icon that needs an opaque background gets this. */
const GRAPHITE = '#08090b';
/**
 * The corner radius of the flat favicon, as a fraction of its box. Matches the
 * radius already drawn into `app-icon.png`, so the two read as one mark when a
 * browser shows the favicon beside an installed-app tile.
 */
const FAVICON_RADIUS = 0.22;
/**
 * Android maskable icons are cropped to an arbitrary shape inside a circle of
 * 80% of the canvas. Anything outside that is not guaranteed to survive, so the
 * artwork is inset to it and the margin is filled with the ground colour.
 */
const MASKABLE_SAFE = 0.8;

const markPath = fs.readFileSync(path.join(brandDir, 'mark.path.txt'), 'utf8').trim();

/**
 * The flat mark as a standalone SVG document.
 *
 * `ground: false` produces the bare glyph on transparency — what Safari's
 * pinned-tab mask wants, since it recolours the shape itself and a background
 * would swallow the whole tab.
 */
function markSvg({ ground = true, fill = '#ffffff' } = {}) {
  const radius = (FAVICON_RADIUS * 64).toFixed(1);
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64"',
    ' role="img" aria-label="Creator Football">',
    '<title>Creator Football</title>',
    ground ? `<rect width="64" height="64" rx="${radius}" fill="${GRAPHITE}"/>` : '',
    // The mark is traced as one path with both its outer contours and its
    // counters, so it needs even-odd fill for the counters to stay open.
    `<path fill-rule="evenodd" fill="${fill}" d="${markPath}"/>`,
    '</svg>',
  ].join('');
}

// ------------------------------------------------------------------- slots

/**
 * Every derived icon in the repo.
 *
 * `from` is a master basename, or `mark` for the traced vector. `fit` follows
 * `assets.manifest.mjs`: `cover` centre-crops the overflow, `contain` fits the
 * whole source and fills the margin with `ground`.
 */
const SLOTS = [
  // ---- the game's web shell ------------------------------------------------
  {
    group: 'game', from: 'mark', dest: 'apps/game/public/favicon.svg', format: 'svg',
    note: 'The tab icon at any DPR. Vector, so it never resamples.',
  },
  {
    group: 'game', from: 'mark', dest: 'apps/game/public/favicon.ico', format: 'ico',
    sizes: [16, 32, 48],
    note: 'For the browsers and OS surfaces that still ask for /favicon.ico by name.',
  },
  {
    group: 'game', from: 'mark', dest: 'apps/game/public/icons/favicon-96.png', format: 'png',
    size: 96, note: 'The PNG fallback where an SVG favicon is not honoured.',
  },
  {
    group: 'game', from: 'app-icon.png', dest: 'apps/game/public/icons/icon-192.png',
    format: 'png', size: 192, fit: 'cover', palette: true, budgetKB: 40,
  },
  {
    group: 'game', from: 'app-icon.png', dest: 'apps/game/public/icons/icon-512.png',
    format: 'png', size: 512, fit: 'cover', palette: true, budgetKB: 200,
  },
  {
    group: 'game', from: 'app-icon.png', dest: 'apps/game/public/icons/icon-maskable-512.png',
    format: 'png', size: 512, fit: 'cover', inset: MASKABLE_SAFE, ground: GRAPHITE,
    palette: true, budgetKB: 200,
    note: 'Inset to the maskable safe zone; Android crops this to its own shape.',
  },
  {
    group: 'game', from: 'app-icon.png', dest: 'apps/game/public/icons/apple-touch-icon.png',
    format: 'png', size: 180, fit: 'cover', palette: true, budgetKB: 40,
    note: 'iOS applies its own mask, so this is square and full-bleed.',
  },

  // ---- the marketing site --------------------------------------------------
  { group: 'website', from: 'mark', dest: 'website/favicon.svg', format: 'svg' },
  { group: 'website', from: 'mark', dest: 'website/favicon.ico', format: 'ico', sizes: [16, 32, 48] },
  {
    group: 'website', from: 'app-icon.png', dest: 'website/icon-192.png',
    format: 'png', size: 192, fit: 'cover', palette: true, budgetKB: 40,
  },
  {
    group: 'website', from: 'app-icon.png', dest: 'website/apple-touch-icon.png',
    format: 'png', size: 180, fit: 'cover', palette: true, budgetKB: 40,
  },
  {
    group: 'website', from: 'share-card.png', dest: 'website/og-image.jpg',
    format: 'jpeg', width: 1200, height: 630, fit: 'cover', budgetKB: 160,
    note: 'The lockup is already in the master, so this takes no scrim.',
  },

  // ---- the iOS shell -------------------------------------------------------
  {
    group: 'ios', from: 'app-icon.png',
    dest: 'apps/game/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png',
    // Truecolour with **no alpha channel**, which nothing else here needs and
    // which the browser cannot produce: `canvas.toDataURL('image/png')` always
    // emits RGBA, transparent pixels or not. An app icon that carries an alpha
    // channel is an automatic rejection, discovered at upload after everything
    // else is finished — so this slot writes its own colour-type-2 bytes. See
    // `encodeRgbPng`. The palette encoder would also satisfy Apple (indexed
    // PNGs have no alpha either) but this is the format Apple's own
    // documentation asks for, and this is not the file to be clever on.
    format: 'png', size: 1024, fit: 'cover', flatten: GRAPHITE, noAlpha: true, budgetKB: 1400,
    note: 'No alpha and no rounded corners of our own — the catalogue rejects the first and iOS draws the second.',
  },
  ...['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png'].map((file) => ({
    group: 'ios', from: 'splash.png',
    dest: `apps/game/ios/App/App/Assets.xcassets/Splash.imageset/${file}`,
    format: 'png', size: 2732, fit: 'cover', flatten: GRAPHITE,
    palette: true, paletteColors: 128, budgetKB: 900,
    note: 'The launch image is square and centre-cropped because it is shown at every device aspect.',
  })),
];

// -------------------------------------------------------------- PNG palette

/**
 * An 8-bit palette PNG encoder, as source to be injected into the page.
 *
 * `tools/brand/README.md` records the gap this fills: with no `pngquant` in
 * the environment, "an oversized PNG fails the budget rather than being
 * crushed". Chromium will not emit an indexed PNG, but the format is simple
 * and the browser has `CompressionStream('deflate')`, which produces exactly
 * the zlib stream an `IDAT` chunk wants — so we can write one ourselves.
 *
 * The splash is the slot that needs it. At 2732² a truecolour PNG of a lit 3D
 * render runs past 3 MB; the same image indexed lands near a tenth of that,
 * and the artwork is a near-monochrome graphite gradient with one volt accent,
 * which is precisely the kind of image 256 colours can hold without banding.
 *
 * This lives as a string rather than a function because it has to run *inside*
 * the page. Encoding it in Node would mean shipping the raw pixels across the
 * CDP bridge, and at 2732² that is 30 million array entries to serialise as
 * JSON — which does not take a long time, it never finishes.
 */
const PALETTE_PNG_SOURCE = `
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(bytes) {
  let c = -1;
  for (let i = 0; i < bytes.length; i += 1) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

/** One length-prefixed, CRC-suffixed PNG chunk. */
function pngChunk(type, data) {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i += 1) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

async function deflate(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * Median-cut \`rgba\` to at most \`maxColors\`, then write an indexed PNG.
 *
 * Boxes are split on the channel with the widest population-weighted spread,
 * at the population median rather than the midpoint, so a large flat area of
 * near-black cannot spend the whole palette on shades nobody can tell apart.
 * No dithering: these are smooth studio gradients, and the noise a diffusion
 * dither adds costs more bytes than the banding it removes.
 */
/**
 * Encode as truecolour PNG with **no alpha channel at all** (colour type 2).
 *
 * Not an optimisation — a correctness requirement, and the only reason it
 * exists. Apple rejects an app icon that carries an alpha channel, and
 * \`canvas.toDataURL('image/png')\` always emits RGBA whether or not anything
 * in the image is transparent. So the browser cannot produce a legal app icon,
 * and the choice is between an indexed PNG (no alpha, but a palette) and
 * writing the truecolour bytes ourselves. This writes them.
 *
 * Paeth filtering, unlike the palette encoder's none-filtering: this is a lit
 * 3D render rather than a flat graphic, and unfiltered photographic RGB
 * deflates badly enough to triple the file.
 */
async function encodeRgbPng(rgba, width, height) {
  const stride = width * 3;
  const raw = new Uint8Array(height * (stride + 1));
  const line = new Uint8Array(stride);
  const previous = new Uint8Array(stride);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const from = (y * width + x) * 4;
      const to = x * 3;
      line[to] = rgba[from];
      line[to + 1] = rgba[from + 1];
      line[to + 2] = rgba[from + 2];
    }
    const out = y * (stride + 1);
    raw[out] = 4; // Paeth
    for (let i = 0; i < stride; i += 1) {
      const a = i >= 3 ? line[i - 3] : 0;      // left
      const b = previous[i];                    // above
      const c = i >= 3 ? previous[i - 3] : 0;   // above-left
      const p = a + b - c;
      const pa = Math.abs(p - a);
      const pb = Math.abs(p - b);
      const pc = Math.abs(p - c);
      const predictor = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      raw[out + 1 + i] = (line[i] - predictor) & 0xff;
    }
    previous.set(line);
  }

  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 2;   // colour type 2 — truecolour, no alpha
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const parts = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', await deflate(raw)),
    pngChunk('IEND', new Uint8Array(0)),
  ];
  const size = parts.reduce((n, p) => n + p.length, 0);
  const png = new Uint8Array(size);
  let at = 0;
  for (const p of parts) { png.set(p, at); at += p.length; }

  let binary = '';
  for (let i = 0; i < png.length; i += 0x8000) {
    binary += String.fromCharCode.apply(null, png.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

async function encodeIndexedPng(rgba, width, height, maxColors) {
  const counts = new Map();
  for (let i = 0; i < rgba.length; i += 4) {
    const key = (rgba[i] << 16) | (rgba[i + 1] << 8) | rgba[i + 2];
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const colors = [];
  for (const [key, n] of counts) {
    colors.push({ r: (key >> 16) & 255, g: (key >> 8) & 255, b: key & 255, n });
  }
  if (colors.length === 0) return null;

  let boxes = [colors];
  while (boxes.length < maxColors) {
    let target = -1;
    let bestScore = 0;
    let bestChannel = 'r';
    for (let index = 0; index < boxes.length; index += 1) {
      const box = boxes[index];
      if (box.length < 2) continue;
      let weight = 0;
      for (const c of box) weight += c.n;
      for (const channel of ['r', 'g', 'b']) {
        let lo = 255;
        let hi = 0;
        for (const c of box) {
          if (c[channel] < lo) lo = c[channel];
          if (c[channel] > hi) hi = c[channel];
        }
        const score = (hi - lo) * Math.log2(weight + 1);
        if (score > bestScore) { bestScore = score; target = index; bestChannel = channel; }
      }
    }
    if (target < 0) break;

    const box = boxes[target];
    box.sort((a, b) => a[bestChannel] - b[bestChannel]);
    let total = 0;
    for (const c of box) total += c.n;
    let running = 0;
    let cut = 1;
    for (let i = 0; i < box.length - 1; i += 1) {
      running += box[i].n;
      if (running * 2 >= total) { cut = i + 1; break; }
    }
    boxes = boxes.slice(0, target).concat([box.slice(0, cut), box.slice(cut)], boxes.slice(target + 1));
  }

  const palette = boxes.map((box) => {
    let r = 0; let g = 0; let b = 0; let n = 0;
    for (const c of box) { r += c.r * c.n; g += c.g * c.n; b += c.b * c.n; n += c.n; }
    return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
  });

  // Nearest entry per distinct source colour, memoised: the image has millions
  // of pixels but only tens of thousands of distinct colours.
  const nearest = new Map();
  const lookup = (r, g, b) => {
    const key = (r << 16) | (g << 8) | b;
    const hit = nearest.get(key);
    if (hit !== undefined) return hit;
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < palette.length; i += 1) {
      const dr = palette[i][0] - r;
      const dg = palette[i][1] - g;
      const db = palette[i][2] - b;
      // Weighted toward green, which is where the eye resolves the most detail.
      const dist = dr * dr * 2 + dg * dg * 4 + db * db;
      if (dist < bestDist) { bestDist = dist; best = i; }
    }
    nearest.set(key, best);
    return best;
  };

  // One filter byte (0 = None) per scanline, then one palette index per pixel.
  const raw = new Uint8Array(height * (width + 1));
  let out = 0;
  for (let y = 0; y < height; y += 1) {
    raw[out] = 0;
    out += 1;
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      raw[out] = lookup(rgba[i], rgba[i + 1], rgba[i + 2]);
      out += 1;
    }
  }

  const plte = new Uint8Array(palette.length * 3);
  palette.forEach(([r, g, b], i) => {
    plte[i * 3] = r; plte[i * 3 + 1] = g; plte[i * 3 + 2] = b;
  });

  const ihdr = new Uint8Array(13);
  new DataView(ihdr.buffer).setUint32(0, width);
  new DataView(ihdr.buffer).setUint32(4, height);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 3;   // colour type 3 — indexed
  ihdr[10] = 0;  // deflate
  ihdr[11] = 0;  // adaptive filtering
  ihdr[12] = 0;  // no interlace

  const parts = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('PLTE', plte),
    pngChunk('IDAT', await deflate(raw)),
    pngChunk('IEND', new Uint8Array(0)),
  ];
  const size = parts.reduce((n, p) => n + p.length, 0);
  const png = new Uint8Array(size);
  let at = 0;
  for (const p of parts) { png.set(p, at); at += p.length; }

  let binary = '';
  for (let i = 0; i < png.length; i += 0x8000) {
    binary += String.fromCharCode.apply(null, png.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}
`;

// ------------------------------------------------------------------ the ico

/**
 * An `.ico` holding PNG-compressed entries.
 *
 * Every browser and shell that still reads `.ico` has understood PNG payloads
 * since Windows Vista, and a BMP payload would need its own upside-down,
 * AND-masked encoder for no benefit.
 */
function buildIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);              // reserved
  header.writeUInt16LE(1, 2);              // type 1 — icon
  header.writeUInt16LE(entries.length, 4);

  const directory = Buffer.alloc(16 * entries.length);
  let offset = header.length + directory.length;
  entries.forEach(({ size, png }, i) => {
    const at = i * 16;
    directory[at] = size >= 256 ? 0 : size;      // 0 means 256
    directory[at + 1] = size >= 256 ? 0 : size;
    directory[at + 2] = 0;                       // palette size — 0 for PNG
    directory[at + 3] = 0;                       // reserved
    directory.writeUInt16LE(1, at + 4);          // colour planes
    directory.writeUInt16LE(32, at + 6);         // bits per pixel
    directory.writeUInt32LE(png.length, at + 8);
    directory.writeUInt32LE(offset, at + 12);
    offset += png.length;
  });

  return Buffer.concat([header, directory, ...entries.map((e) => e.png)]);
}

// ----------------------------------------------------------------- rasterise

/**
 * Draw one source into an exact box and return the encoded bytes.
 *
 * Runs entirely in the page: a data-URI source (a PNG master or an SVG
 * document) is decoded, fitted, optionally inset and flattened, and encoded.
 * `palette` slots take the extra step of encoding an indexed PNG in the page
 * too, rather than sending pixels back for Node to compress — see
 * `PALETTE_PNG_SOURCE` for why that direction is the only one that finishes.
 */
async function rasterise(page, { source, width, height, fit, inset, ground, flatten, format, quality, palette, paletteColors, noAlpha }) {
  /* eslint-disable no-undef -- the callback below runs in the page, where
     `document`, `Image` and the injected `encodeIndexedPng` all exist */
  return page.evaluate(async (spec) => {
    const img = new Image();
    img.src = spec.source;
    await img.decode();

    const canvas = document.createElement('canvas');
    canvas.width = spec.width;
    canvas.height = spec.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingQuality = 'high';

    if (spec.flatten || spec.ground) {
      ctx.fillStyle = spec.flatten ?? spec.ground;
      ctx.fillRect(0, 0, spec.width, spec.height);
    }

    const boxW = spec.width * (spec.inset ?? 1);
    const boxH = spec.height * (spec.inset ?? 1);
    const scale = spec.fit === 'contain'
      ? Math.min(boxW / img.naturalWidth, boxH / img.naturalHeight)
      : Math.max(boxW / img.naturalWidth, boxH / img.naturalHeight);
    const drawW = img.naturalWidth * scale;
    const drawH = img.naturalHeight * scale;
    ctx.drawImage(img, (spec.width - drawW) / 2, (spec.height - drawH) / 2, drawW, drawH);

    if (spec.noAlpha) {
      const { data } = ctx.getImageData(0, 0, spec.width, spec.height);
      return { rgb: await encodeRgbPng(data, spec.width, spec.height) };
    }
    if (spec.palette) {
      const { data } = ctx.getImageData(0, 0, spec.width, spec.height);
      const indexed = await encodeIndexedPng(data, spec.width, spec.height, spec.paletteColors ?? 256);
      return { indexed, dataUrl: canvas.toDataURL('image/png') };
    }
    const mime = spec.format === 'jpeg' ? 'image/jpeg' : 'image/png';
    return { dataUrl: canvas.toDataURL(mime, spec.quality) };
  }, { source, width, height, fit: fit ?? 'cover', inset, ground, flatten, format, quality, palette, paletteColors, noAlpha });
  /* eslint-enable no-undef */
}

/** A master, or the traced mark, as a data URI a page can decode. */
function sourceFor(slot) {
  if (slot.from === 'mark') {
    return `data:image/svg+xml;base64,${Buffer.from(markSvg()).toString('base64')}`;
  }
  const file = path.join(mastersDir, slot.from);
  if (!fs.existsSync(file)) throw new Error(`missing master: ${path.relative(repoRoot, file)}`);
  return `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`;
}

/** Walk JPEG quality down until the bytes fit, exactly as `ingest.mjs` does. */
const QUALITY_LADDER = [0.92, 0.88, 0.84, 0.8, 0.76, 0.72, 0.66, 0.6, 0.54];

// ------------------------------------------------------------------- drive

const slots = SLOTS.filter((s) => only === null || s.group === only);
if (slots.length === 0) {
  console.error(`No slots in group "${only}". Groups: game, website, ios.`);
  process.exit(1);
}

const browser = await chromium.launch({ executablePath: CHROMIUM });
const page = await browser.newPage();
await page.setContent('<body></body>');
// The indexed-PNG encoder has to live in the page, next to the pixels.
await page.addScriptTag({ content: PALETTE_PNG_SOURCE });

let failures = 0;
let group = null;

for (const slot of slots) {
  if (slot.group !== group) {
    group = slot.group;
    console.log(`\n${group}`);
  }

  const rel = slot.dest;
  const abs = path.resolve(repoRoot, rel);
  let bytes;
  let detail = '';

  try {
    if (slot.format === 'svg') {
      bytes = Buffer.from(`${markSvg()}\n`, 'utf8');
      detail = 'vector';
    } else if (slot.format === 'ico') {
      const entries = [];
      for (const size of slot.sizes) {
        const { dataUrl } = await rasterise(page, {
          source: sourceFor(slot), width: size, height: size, format: 'png',
        });
        entries.push({ size, png: Buffer.from(dataUrl.split(',')[1], 'base64') });
      }
      bytes = buildIco(entries);
      detail = slot.sizes.join('+');
    } else {
      const width = slot.width ?? slot.size;
      const height = slot.height ?? slot.size;
      const spec = { source: sourceFor(slot), width, height, fit: slot.fit, inset: slot.inset, ground: slot.ground, flatten: slot.flatten, format: slot.format };

      if (slot.noAlpha) {
        const { rgb } = await rasterise(page, { ...spec, noAlpha: true });
        bytes = Buffer.from(rgb, 'base64');
        detail = `${width}x${height} rgb`;
      } else if (slot.palette) {
        const { indexed, dataUrl } = await rasterise(page, { ...spec, palette: true, paletteColors: slot.paletteColors });
        const truecolour = Buffer.from(dataUrl.split(',')[1], 'base64');
        const palette = indexed ? Buffer.from(indexed, 'base64') : null;
        // Indexing is an optimisation, never a downgrade: keep whichever is
        // smaller, so a slot can never get worse by opting into it.
        const useIndexed = palette !== null && palette.length < truecolour.length;
        bytes = useIndexed ? palette : truecolour;
        detail = `${width}x${height} ${useIndexed ? 'indexed' : 'truecolour'}`;
      } else if (slot.format === 'jpeg') {
        for (const quality of QUALITY_LADDER) {
          const { dataUrl } = await rasterise(page, { ...spec, quality });
          bytes = Buffer.from(dataUrl.split(',')[1], 'base64');
          detail = `${width}x${height} q${Math.round(quality * 100)}`;
          if (!slot.budgetKB || bytes.length <= slot.budgetKB * 1024) break;
        }
      } else {
        const { dataUrl } = await rasterise(page, spec);
        bytes = Buffer.from(dataUrl.split(',')[1], 'base64');
        detail = `${width}x${height}`;
      }
    }
  } catch (err) {
    console.log(`  FAIL  ${rel}  ${err.message}`);
    failures += 1;
    continue;
  }

  const kb = `${(bytes.length / 1024).toFixed(1)} KB`;
  const over = slot.budgetKB && bytes.length > slot.budgetKB * 1024;
  if (over) failures += 1;

  if (!dryRun) {
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, bytes);
  }
  console.log(`  ${over ? 'OVER' : 'ok  '}  ${rel.padEnd(66)} ${detail.padEnd(22)} ${kb}`);
}

await browser.close();

console.log(dryRun ? '\nDry run — nothing written.' : '\nDone.');
if (failures > 0) {
  console.error(`${failures} slot(s) failed.`);
  process.exit(1);
}
