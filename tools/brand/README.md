# `tools/brand/` — brand masters and the art ingest pipeline

Two things live here.

**1. The vector masters and their rasteriser.** `og.html` draws the share card and `icon.html`
draws the volt-ball mark; both are deterministic HTML/SVG compositions, not binaries.
`render.mjs` screenshots them into the few slots that cannot take an SVG:

```sh
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node tools/brand/render.mjs website
```

**2. The ingest pipeline for generated art.** `assets.manifest.mjs` + `ingest.mjs` turn a folder of
downloaded generations into correctly sized, correctly named, correctly compressed files at their
exact destination paths, with a pass/fail report against the spec in
`docs/AI_ASSET_PROMPTS.md` §2. `inbox/` is where the downloads go; its contents are gitignored.

---

## Why Chromium is the image processor

There is **no `cwebp`, no ImageMagick, no `sharp`, no `pngquant`, no `ffmpeg`** in this
environment, and no network to install one. So `ingest.mjs` does all of its decoding, scaling,
cropping, background keying, scrim application and WebP/JPEG/PNG encoding inside a headless
Chromium page — `<canvas>`, `drawImage`, `getImageData`/`putImageData`, and
`canvas.toDataURL('image/webp', q)` — and Node only reads the input bytes and writes the decoded
output. That is the same trick `render.mjs` already uses, and it is why every command below is
prefixed with `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`. Never run `playwright install`; the
browser is pre-installed at `/opt/pw-browsers/chromium`.

The one consequence worth knowing: the quality ladder is Chromium's WebP/JPEG encoder, not
`cwebp -m 6`, so a file that squeaks past its budget here would usually be a little smaller with
the real tool. Budgets are hard ceilings either way.

---

## End-to-end workflow

1. **Generate in ChatGPT** (or any generator) from the prompt in `docs/AI_ASSET_PROMPTS.md`.
   It returns a PNG at *its* canvas size — 1024×1024, 1024×1536, 1536×1024 — usually with an
   opaque graphite background even when the entry asked for transparency, and never at the target
   pixel size or weight.
2. **Download into `tools/brand/inbox/`** and rename to one of the conventions below.
3. **Run the pipeline.**
   ```sh
   pnpm assets:ingest --list          # what exists, what the inbox has
   pnpm assets:ingest --all --dry-run # report without writing a byte
   pnpm assets:ingest --all           # write
   ```
4. **Read the report.** Every asset prints input size → output size, final bytes against budget,
   PASS/FAIL, and — for alpha assets — whether a background was keyed or the source already had
   one. The command exits non-zero if anything missed its budget or its dimensions, so it can gate
   CI later. A FAIL writes nothing.
5. **Eyeball the result, then commit** the destination files. The acceptance checklists in the
   prompt pack (silhouette agreement, seam tests, "no legible glyph anywhere") are human checks —
   this script cannot make them for you.

Nothing here is load-bearing: every destination is an override layer over a working procedural
path, so a missing or rejected file is never a bug.

## CLI

```
pnpm assets:ingest --list                          # every asset, its spec, and inbox presence
pnpm assets:ingest --all [--dry-run] [--force]     # everything matched in tools/brand/inbox/
pnpm assets:ingest <assetId> <file> [--dry-run] [--force]
pnpm assets:ingest --help
```

- `--dry-run` reports exactly what would happen and writes nothing.
- `--force` is required to replace a destination file that already exists; without it the asset is
  skipped and the report names the file and its current size.
- Inputs are validated by magic bytes — a `.png` that is really something else is rejected before
  processing.

## Filename conventions for `--all`

Case-insensitive; `.png`, `.jpg`, `.jpeg` and `.webp` are accepted. Any of:

| Form | Example |
|---|---|
| `<assetId>.png` | `B4a.png`, `C2.png`, `A1-icon.png` |
| `<assetId>-<anything>.png` | `B4a-league.png`, `B1-title-v3.png` |
| `<destination basename>.png` | `league.png`, `title-stadium.png`, `reward-tokens.png` |

Files that match nothing are listed and ignored — ChatGPT's own
`ChatGPT Image Aug 23, 2026.png` needs renaming first. Two files matching the same asset is an
error: pick the take you want and delete the other.

## What the pipeline does per asset

1. **Decode** the input at its native size.
2. **Fit** to the exact target box using the manifest's mode, never distorting:
   `cover` centre-crops the overflow (full-bleed plates, whose components crop and never
   letterbox); `contain` fits the whole source and centres it, leaving transparent margins for
   alpha assets and a flat matte for opaque ones (isolated subjects that must not lose an edge);
   `exact` scales straight to the box when the aspect ratios already agree.
3. **Key the background** where the manifest says `alpha: true` *and* the source arrived opaque:
   a tolerance-based key on the graphite ground `#050607`/`#08090B`, with a feather band whose
   partial pixels are un-matted (`c = (c − bg·(1−a)) / a`) so gold edges keep their colour instead
   of carrying a dark fringe. A source that already has alpha is left alone, and the report says
   which happened.
4. **Scrim** the plates whose entry calls for one: a `#050607` multiply gradient — B1/B2 run 0% at
   45% height to 62% at the bottom, B3 to 50%, A3 runs horizontally 0% at 55% width to 55% at the
   left edge.
5. **Greyscale / normalise** where the entry asks (C3 only: greyscale, mean luminance forced to
   50% so `overlay` is a no-op on average).
6. **Encode** to the target format, walking quality down from q94 until the weight budget is met.
7. **Verify** by decoding the encoded bytes back and checking the dimensions, then write —
   creating directories as needed.

## Manifest judgement calls

`assets.manifest.mjs` transcribes `docs/AI_ASSET_PROMPTS.md` §2 verbatim for destination, format,
size and budget. Two fields are not in that table and were derived from each entry's
post-processing block:

- **`alpha`** follows "remove background to true alpha" (B4×5, B6a/b, B7×5, C1, C2, C4, C5) and
  "flatten / kill alpha" (A1, A1-icon, A2). B1–B3, B5, B8 and C3 are opaque plates.
- **`fit`** is `cover` where the entry says to crop, `contain` where an edge is load-bearing
  (trophy silhouettes, the ball's circle, C5's transparent end columns, the B7 set's shared
  optical area).

Known gaps, all documented on the entries themselves:

- **A2** writes one file; the imageset's three identical entries still need copying by hand.
- **B5 / C3** seamlessness is not verified here — run the 3×3 offset test by eye.
- **C4** scales an 8-up strip; it does not re-slice or re-centre cells, so the source must already
  be a 4:1 strip of eight tokens.
- **PNG** has no quality ladder (no `pngquant` here). An oversized A1/A1-icon/A2 fails the budget
  rather than being crushed — simplify the source or reduce its detail.
