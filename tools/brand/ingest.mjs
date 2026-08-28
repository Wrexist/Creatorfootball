/**
 * Ingest pipeline for generated game art.
 *
 * ChatGPT (and every other image generator) hands back a PNG at *its* canvas
 * size — 1024², 1024×1536, 1536×1024 — usually with an opaque graphite
 * background where the spec asked for alpha, and never at the exact pixel size
 * or weight budget `docs/AI_ASSET_PROMPTS.md` §2 contracts for. This script is
 * the bridge: drop the downloads in `tools/brand/inbox/`, run it, and every
 * recognised file lands at its destination path, cropped or letterboxed to the
 * exact target size, keyed to transparency where alpha is required, scrimmed
 * where the entry calls for a scrim, and compressed down to fit its budget.
 *
 * **Chromium is the image processor.** There is no cwebp, ImageMagick, sharp,
 * pngquant or ffmpeg in this environment and no network to install one. So all
 * decoding, scaling, keying and WebP/JPEG/PNG encoding happens inside a
 * headless page via `<canvas>`, `drawImage`, `getImageData` and
 * `canvas.toDataURL(...)`, exactly as `tools/brand/icons.mjs` derives the icon
 * set. Node only reads the input bytes and writes the decoded output.
 *
 *   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node tools/brand/ingest.mjs --list
 *   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node tools/brand/ingest.mjs --all
 *   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node tools/brand/ingest.mjs B4a ~/Downloads/league.png
 *
 * Exits non-zero if any processed asset misses its budget or its dimensions,
 * so it can gate CI later.
 */
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

import { ASSETS, KEY_COLORS, findAsset, destSlug } from './assets.manifest.mjs';

const brandDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(brandDir, '..', '..');
const inboxDir = path.join(brandDir, 'inbox');
const CHROMIUM = process.env.CF_CHROMIUM ?? '/opt/pw-browsers/chromium';

const INPUT_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const QUALITY_LADDER = [0.94, 0.9, 0.86, 0.82, 0.78, 0.74, 0.7, 0.65, 0.6, 0.55, 0.5, 0.44, 0.38];

// ---------------------------------------------------------------- arguments

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith('--')));
const positional = argv.filter((a) => !a.startsWith('--'));
const dryRun = flags.has('--dry-run');
const force = flags.has('--force');

const USAGE = `Usage:
  ingest.mjs --list                    show every asset, its spec and whether the inbox has it
  ingest.mjs --all [--dry-run] [--force]
                                       process everything matched in tools/brand/inbox/
  ingest.mjs <assetId> <file> [--dry-run] [--force]
                                       process one named asset from an explicit file

Filename conventions for --all — any of, case-insensitive:
  <id>.png             B4a.png, C2.png, A1-icon.png
  <id>-<anything>.png  B4a-league.png, B1-title-v3.png
  <slug>.png           league.png, title-stadium.png  (the destination basename)
Accepted extensions: .png .jpg .jpeg .webp`;

if (flags.has('--help') || flags.has('-h') || (!flags.has('--list') && !flags.has('--all') && positional.length === 0)) {
  console.log(USAGE);
  process.exit(flags.has('--help') || flags.has('-h') ? 0 : 1);
}

const unknown = [...flags].filter((f) => !['--list', '--all', '--dry-run', '--force', '--help', '-h'].includes(f));
if (unknown.length) {
  console.error(`Unknown flag(s): ${unknown.join(', ')}\n\n${USAGE}`);
  process.exit(1);
}

// ------------------------------------------------------------------ helpers

const kb = (bytes) => bytes / 1024;
const fmtKB = (bytes) => `${kb(bytes).toFixed(1)} KB`;

/** Sniff the container from the magic bytes; generators lie in filenames. */
function sniffType(buf) {
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (buf.length >= 12 && buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp';
  return null;
}

function readInput(file) {
  const abs = path.resolve(file);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) throw new Error(`input not found: ${file}`);
  const buf = fs.readFileSync(abs);
  const type = sniffType(buf);
  if (!type) throw new Error(`not a PNG, JPEG or WebP (magic bytes did not match): ${file}`);
  return { abs, buf, type, dataUrl: `data:image/${type};base64,${buf.toString('base64')}` };
}

/** Every inbox filename that maps onto a manifest entry. */
function matchInbox() {
  if (!fs.existsSync(inboxDir)) return new Map();
  const files = fs
    .readdirSync(inboxDir)
    .filter((f) => !f.startsWith('.') && INPUT_EXT.has(path.extname(f).toLowerCase()))
    .sort();
  /** @type {Map<string, string[]>} */
  const byId = new Map();
  const unmatched = [];
  for (const file of files) {
    const stem = path.basename(file, path.extname(file)).toLowerCase();
    const asset =
      // 1. destination basename — `league.png`, `title-stadium.png`
      ASSETS.find((a) => destSlug(a).toLowerCase() === stem) ??
      // 2. exact asset id — `B4a.png`
      ASSETS.find((a) => a.id.toLowerCase() === stem) ??
      // 3. id prefix — `B4a-league.png`, `B1-title-v3.png`. Longest id first so
      //    `A1-icon-…` never gets swallowed by `A1-…`.
      [...ASSETS]
        .sort((x, y) => y.id.length - x.id.length)
        .find((a) => stem.startsWith(`${a.id.toLowerCase()}-`));
    if (!asset) {
      unmatched.push(file);
      continue;
    }
    const list = byId.get(asset.id) ?? [];
    list.push(path.join(inboxDir, file));
    byId.set(asset.id, list);
  }
  return Object.assign(byId, { unmatched });
}

// --------------------------------------------------------------------- list

function list() {
  const inbox = matchInbox();
  const rows = ASSETS.map((a) => {
    const hits = inbox.get(a.id) ?? [];
    return [
      a.id.padEnd(8),
      `${a.width}×${a.height}`.padEnd(12),
      a.format.padEnd(5),
      `≤${a.budgetKB} KB`.padEnd(9),
      (a.alpha ? 'alpha' : 'opaque').padEnd(7),
      a.fit.padEnd(8),
      hits.length ? `IN  ${hits.map((h) => path.basename(h)).join(', ')}` : '—   ',
      a.dest,
    ].join(' ');
  });
  console.log('id       size         fmt   budget    matte   fit      inbox / destination');
  console.log('-'.repeat(110));
  console.log(rows.join('\n'));
  console.log('');
  console.log(`${ASSETS.length} image assets. Inbox: ${inboxDir}`);
  if (inbox.unmatched.length) {
    console.log(`Unmatched inbox files (rename them to match a convention below): ${inbox.unmatched.join(', ')}`);
  }
  console.log('');
  console.log(USAGE.split('\nFilename conventions')[1] ? `Filename conventions${USAGE.split('\nFilename conventions')[1]}` : '');
}

// ------------------------------------------------------------------ browser

async function launch() {
  if (!fs.existsSync(CHROMIUM)) {
    throw new Error(
      `Chromium not found at ${CHROMIUM}.\n` +
        `This script uses Chromium as its image processor (there is no cwebp/ImageMagick/sharp here).\n` +
        `Run with PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers, or point CF_CHROMIUM at a Chromium binary.\n` +
        `Do not run \`playwright install\` — this environment has no network.`,
    );
  }
  try {
    return await chromium.launch({ executablePath: CHROMIUM });
  } catch (err) {
    throw new Error(
      `Could not launch Chromium at ${CHROMIUM}: ${err.message}\n` +
        `Set PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers (or CF_CHROMIUM) and try again.`,
    );
  }
}

/**
 * The whole image pipeline, run inside the page. Returns the encoded file as
 * base64 plus everything the report needs.
 */
/* eslint-disable no-undef -- runs in the page, not in Node */
function pipeline({ dataUrl, spec, keyColors, ladder }) {
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const keys = keyColors.map(hex);

  const load = (src) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('the browser could not decode this image'));
      img.src = src;
    });

  const make = (w, h) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  };

  return (async () => {
    const img = await load(dataUrl);
    const sw = img.naturalWidth;
    const sh = img.naturalHeight;
    if (!sw || !sh) throw new Error('decoded image has zero size');

    // --- 1. decode at native size --------------------------------------
    const src = make(sw, sh);
    const sctx = src.getContext('2d', { willReadFrequently: true });
    sctx.drawImage(img, 0, 0);

    let hadAlpha = false;
    let keyed = 0;
    let keyedPct = 0;

    if (spec.alpha) {
      const id = sctx.getImageData(0, 0, sw, sh);
      const px = id.data;
      for (let i = 3; i < px.length; i += 4) {
        if (px[i] < 250) {
          hadAlpha = true;
          break;
        }
      }
      if (!hadAlpha) {
        // Key the flat graphite ground the generator painted in. Distance-based
        // with a feather band, then un-matte the partials so gold edges do not
        // keep a dark fringe (which is what reads as a green halo once the
        // plate is composited over a lighter surface).
        const inner = 20; // ≤ this from a key colour: fully transparent
        const outer = 52; // ≥ this: fully opaque
        for (let i = 0; i < px.length; i += 4) {
          const r = px[i];
          const g = px[i + 1];
          const b = px[i + 2];
          let best = Infinity;
          let bk = keys[0];
          for (const k of keys) {
            const d = Math.hypot(r - k[0], g - k[1], b - k[2]);
            if (d < best) {
              best = d;
              bk = k;
            }
          }
          if (best >= outer) continue;
          const a = best <= inner ? 0 : (best - inner) / (outer - inner);
          if (a <= 0.03) {
            px[i + 3] = 0;
            keyed++;
            continue;
          }
          // c = (c_observed - bg·(1-a)) / a
          px[i] = Math.max(0, Math.min(255, (r - bk[0] * (1 - a)) / a));
          px[i + 1] = Math.max(0, Math.min(255, (g - bk[1] * (1 - a)) / a));
          px[i + 2] = Math.max(0, Math.min(255, (b - bk[2] * (1 - a)) / a));
          px[i + 3] = Math.round(a * 255);
          keyed++;
        }
        sctx.putImageData(id, 0, 0);
        keyedPct = (keyed / (sw * sh)) * 100;
      }
    }

    // --- 2. fit to the exact target box --------------------------------
    const tw = spec.width;
    const th = spec.height;
    const out = make(tw, th);
    const octx = out.getContext('2d', { willReadFrequently: true });
    octx.imageSmoothingEnabled = true;
    octx.imageSmoothingQuality = 'high';
    if (!spec.alpha) {
      octx.fillStyle = spec.flatten ?? '#050607';
      octx.fillRect(0, 0, tw, th);
    }
    const sameAspect = Math.abs(sw / sh - tw / th) < 0.002;
    const mode = spec.fit === 'exact' && !sameAspect ? 'cover' : spec.fit;
    const scale = mode === 'contain' ? Math.min(tw / sw, th / sh) : Math.max(tw / sw, th / sh);
    const dw = sw * scale;
    const dh = sh * scale;
    // Draw from the working canvas, not the raw <img>: it carries the keyed
    // alpha when the background had to be removed, and is identical otherwise.
    octx.drawImage(src, 0, 0, sw, sh, (tw - dw) / 2, (th - dh) / 2, dw, dh);

    // --- 3. greyscale, and the mean-luminance normalisation the tiles need
    if (spec.grayscale || spec.normalizeMean !== null) {
      const id = octx.getImageData(0, 0, tw, th);
      const px = id.data;
      let sum = 0;
      for (let i = 0; i < px.length; i += 4) {
        const y = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
        sum += y;
        if (spec.grayscale) {
          const v = Math.round(y);
          px[i] = px[i + 1] = px[i + 2] = v;
        }
      }
      if (spec.normalizeMean !== null) {
        // Shift the histogram so `overlay` is a no-op on average, exactly as
        // the C3 post-process asks for.
        const shift = spec.normalizeMean - sum / (tw * th);
        for (let i = 0; i < px.length; i += 4) {
          px[i] = Math.max(0, Math.min(255, px[i] + shift));
          px[i + 1] = Math.max(0, Math.min(255, px[i + 1] + shift));
          px[i + 2] = Math.max(0, Math.min(255, px[i + 2] + shift));
        }
      }
      octx.putImageData(id, 0, 0);
    }

    // --- 4. scrim -------------------------------------------------------
    if (spec.scrim) {
      const s = spec.scrim;
      const [kr, kg, kb2] = hex('#050607');
      const horizontal = s.axis === 'x';
      const grad = horizontal
        ? octx.createLinearGradient(s.from * tw, 0, s.to * tw, 0)
        : octx.createLinearGradient(0, s.from * th, 0, s.to * th);
      // A multiply of `#050607` at opacity a is a multiply by the colour
      // lerp(white, #050607, a) — so bake the opacity into the stop colours
      // and multiply once.
      const stop = (a) =>
        `rgb(${Math.round(255 + (kr - 255) * a)}, ${Math.round(255 + (kg - 255) * a)}, ${Math.round(255 + (kb2 - 255) * a)})`;
      for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        grad.addColorStop(t, stop(s.fromAlpha + (s.toAlpha - s.fromAlpha) * t));
      }
      octx.save();
      octx.globalCompositeOperation = 'multiply';
      octx.fillStyle = grad;
      const x0 = horizontal ? Math.min(s.from, s.to) * tw : 0;
      const x1 = horizontal ? Math.max(s.from, s.to) * tw : tw;
      const y0 = horizontal ? 0 : Math.min(s.from, s.to) * th;
      const y1 = horizontal ? th : Math.max(s.from, s.to) * th;
      octx.fillRect(x0, y0, x1 - x0, y1 - y0);
      octx.restore();
    }

    // --- 5. guarantee opacity where the spec forbids alpha --------------
    if (!spec.alpha) {
      octx.save();
      octx.globalCompositeOperation = 'destination-over';
      octx.fillStyle = spec.flatten ?? '#050607';
      octx.fillRect(0, 0, tw, th);
      octx.restore();
    }

    // --- 6. encode, walking quality down until the budget is met --------
    const budget = spec.budgetKB * 1024;
    const mime = spec.format === 'jpeg' ? 'image/jpeg' : spec.format === 'png' ? 'image/png' : 'image/webp';
    const bytesOf = (url) => Math.floor((url.length - (url.indexOf(',') + 1)) * 0.75);
    let chosen = null;
    if (mime === 'image/png') {
      const url = out.toDataURL('image/png');
      chosen = { url, quality: null, bytes: bytesOf(url) };
    } else {
      for (const q of ladder) {
        const url = out.toDataURL(mime, q);
        const bytes = bytesOf(url);
        if (!chosen) chosen = { url, quality: q, bytes };
        if (bytes <= budget) {
          chosen = { url, quality: q, bytes };
          break;
        }
        chosen = { url, quality: q, bytes };
      }
    }

    // --- 7. verify the encoded file really is the target size ----------
    const back = await load(chosen.url);
    const verified = { width: back.naturalWidth, height: back.naturalHeight };

    return {
      base64: chosen.url.slice(chosen.url.indexOf(',') + 1),
      quality: chosen.quality,
      bytes: chosen.bytes,
      source: { width: sw, height: sh },
      verified,
      fit: mode,
      hadAlpha,
      keyed: keyed > 0,
      keyedPct: Math.round(keyedPct * 10) / 10,
    };
  })();
}
/* eslint-enable no-undef */

// ------------------------------------------------------------------ process

async function processOne(page, asset, inputFile) {
  const input = readInput(inputFile);
  const destAbs = path.join(repoRoot, asset.dest);
  const exists = fs.existsSync(destAbs);

  if (exists && !force) {
    return {
      asset,
      status: 'SKIP',
      lines: [
        `${asset.dest} already exists (${fmtKB(fs.statSync(destAbs).size)}) and would be replaced — pass --force to overwrite`,
      ],
    };
  }

  const r = await page.evaluate(pipeline, {
    dataUrl: input.dataUrl,
    spec: {
      width: asset.width,
      height: asset.height,
      format: asset.format,
      budgetKB: asset.budgetKB,
      alpha: Boolean(asset.alpha),
      fit: asset.fit,
      flatten: asset.flatten ?? null,
      grayscale: Boolean(asset.grayscale),
      normalizeMean: asset.normalizeMean ?? null,
      scrim: asset.scrim ?? null,
    },
    keyColors: KEY_COLORS,
    ladder: QUALITY_LADDER,
  });

  const buf = Buffer.from(r.base64, 'base64');
  const sizeOk = r.verified.width === asset.width && r.verified.height === asset.height;
  const budgetOk = buf.length <= asset.budgetKB * 1024;
  const status = sizeOk && budgetOk ? 'PASS' : 'FAIL';

  const lines = [
    `in   ${path.basename(input.abs)}  ${input.type.toUpperCase()} ${r.source.width}×${r.source.height}` +
      `  →  out ${r.verified.width}×${r.verified.height} (${r.fit})`,
    `size ${fmtKB(buf.length)} / ≤${asset.budgetKB} KB${r.quality === null ? '' : `  at q${Math.round(r.quality * 100)}`}` +
      `  ${budgetOk ? 'within budget' : 'OVER BUDGET'}`,
  ];
  if (asset.alpha) {
    lines.push(
      r.hadAlpha
        ? 'matte source already carried alpha — no keying applied'
        : `matte keyed flat graphite background (${KEY_COLORS.join('/')}), ${r.keyedPct}% of source pixels, edges un-matted`,
    );
  }
  if (!sizeOk) lines.push(`dimensions MISMATCH — expected ${asset.width}×${asset.height}`);
  if (exists && force) lines.push(`replaced existing file (${fmtKB(fs.statSync(destAbs).size)})`);

  if (dryRun) {
    lines.push(`dry run — nothing written to ${asset.dest}`);
  } else if (status === 'PASS') {
    fs.mkdirSync(path.dirname(destAbs), { recursive: true });
    fs.writeFileSync(destAbs, buf);
    lines.push(`wrote ${asset.dest}`);
  } else {
    lines.push(`not written — ${asset.dest} left untouched`);
  }
  if (asset.note) lines.push(`note ${asset.note}`);

  return { asset, status, lines };
}

// --------------------------------------------------------------------- main

if (flags.has('--list')) {
  list();
  process.exit(0);
}

/** @type {{ asset: object, file: string }[]} */
const jobs = [];

if (flags.has('--all')) {
  const inbox = matchInbox();
  for (const asset of ASSETS) {
    const hits = inbox.get(asset.id) ?? [];
    if (hits.length > 1) {
      console.error(`✗ ${asset.id}: ${hits.length} inbox files match (${hits.map((h) => path.basename(h)).join(', ')}) — keep one`);
      process.exit(1);
    }
    if (hits.length === 1) jobs.push({ asset, file: hits[0] });
  }
  if (inbox.unmatched.length) {
    console.log(`Ignoring ${inbox.unmatched.length} unmatched inbox file(s): ${inbox.unmatched.join(', ')}`);
    console.log('Rename them to <assetId>.png, <assetId>-<label>.png or <destination-basename>.png.\n');
  }
  if (!jobs.length) {
    console.log(`Nothing to do — no recognised images in ${inboxDir}. Try --list.`);
    process.exit(0);
  }
} else {
  const [id, file] = positional;
  if (!id || !file) {
    console.error(`Expected an asset id and a file path.\n\n${USAGE}`);
    process.exit(1);
  }
  const asset = findAsset(id);
  if (!asset) {
    console.error(`Unknown asset id "${id}". Run --list for the full set.`);
    process.exit(1);
  }
  jobs.push({ asset, file });
}

let browser;
try {
  browser = await launch();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
const page = await browser.newPage();
await page.goto('about:blank');

let failed = 0;
let skipped = 0;
let passed = 0;

console.log(`Processing ${jobs.length} asset(s)${dryRun ? ' (dry run)' : ''} — Chromium is the image processor.\n`);

for (const { asset, file } of jobs) {
  let result;
  try {
    result = await processOne(page, asset, file);
  } catch (err) {
    result = { asset, status: 'FAIL', lines: [`error ${err.message}`] };
  }
  const mark = result.status === 'PASS' ? '✓' : result.status === 'SKIP' ? '·' : '✗';
  console.log(`${mark} ${asset.id}  ${asset.name}`);
  for (const line of result.lines) console.log(`    ${line}`);
  console.log('');
  if (result.status === 'FAIL') failed++;
  else if (result.status === 'SKIP') skipped++;
  else passed++;
}

await page.close();
await browser.close();

console.log(`${passed} passed, ${failed} failed, ${skipped} skipped (already present, no --force).`);
if (failed) {
  console.error('Some assets missed their spec — regenerate or re-crop the source and run again.');
  process.exit(1);
}
