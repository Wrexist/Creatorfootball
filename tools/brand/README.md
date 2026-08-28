# `tools/brand/` — the brand masters and the two pipelines that consume them

Everything the product shows that is *not* drawn in code starts in this folder.

**`masters/`** holds the brand artwork itself, as committed source: the app icon, the flat
mark, the isolated crest, the crest in an arena, two wordmark lockups, the launch image and the
share card. These are the originals, at whatever size and weight they were made at, and nothing
ships them directly — every destination in the repo is derived from one of them.

`masters/favicon-sizes-reference.png` is the odd one out: it is a *contact sheet*, not artwork.
It shows the mark at 128 / 64 / 32 / 24 / 16 px on both grounds, and it is the reason the small
icon slots are drawn from the flat vector rather than downscaled from the 3D icon.

## Two pipelines, one brand

**1. `icons.mjs` — the identity slots.** Every favicon, `.ico`, PWA icon, apple-touch icon, iOS
app icon, launch image and share card in the repo, derived from `masters/` in one command:

```sh
pnpm assets:icons                 # write every slot
pnpm assets:icons --dry-run       # report sizes, write nothing
pnpm assets:icons --only website  # one group: game | website | ios
```

This exists because the identity used to have four sources — a vector volt-ball in
`website/favicon.svg`, PNG rasterisations of it, a different artwork in the iOS app icon, and no
icon at all in the game's `index.html`. Re-deriving is now a command rather than an export
session, so the mark cannot drift between surfaces. `apps/game/src/design/art/icons.test.ts`
fails if the markup and the written slots disagree.

**2. `trace-mark.mjs` — the mark as geometry.** Traces `masters/mark-mono.png` into a single SVG
path, committed at `mark.path.txt`:

```sh
pnpm assets:trace-mark
```

Two places need the mark as a shape rather than as pixels: `BrandMark.tsx`, which paints in the
first frame before any other chunk exists, and the favicon, which is rendered at 16–24 px where a
downscaled 3D render turns to mush. The output is committed and pasted into `BrandMark.tsx` by
hand — a build that needs a headless browser to draw its own logo is a build that breaks for the
wrong reasons — and `BrandMark.test.ts` fails if the paste goes stale.

**3. `ingest.mjs` — the generated game art.** `assets.manifest.mjs` + `ingest.mjs` turn a folder of
downloaded generations into correctly sized, correctly named, correctly compressed files at their
exact destination paths, with a pass/fail report against the spec in
`docs/AI_ASSET_PROMPTS.md` §2. `inbox/` is where the downloads go; its contents are gitignored.

The split is by *lifecycle*, not by file type: `icons.mjs` re-derives the same slots from the same
committed masters every time it runs, while `ingest.mjs` places one-off generations that will
never be made twice.

---

## Why Chromium is the image processor

There is **no `cwebp`, no ImageMagick, no `sharp`, no `pngquant`, no `ffmpeg`** in this
environment, and no network to install one. So `ingest.mjs` does all of its decoding, scaling,
cropping, background keying, scrim application and WebP/JPEG/PNG encoding inside a headless
Chromium page — `<canvas>`, `drawImage`, `getImageData`/`putImageData`, and
`canvas.toDataURL('image/webp', q)` — and Node only reads the input bytes and writes the decoded
output. `icons.mjs` and `trace-mark.mjs` do the same, which is why the `pnpm assets:*` scripts all
set `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`. Never run `playwright install`; the browser is
pre-installed at `/opt/pw-browsers/chromium`.

One gap is now filled rather than documented around. There is no `pngquant` either, and Chromium
will not emit an indexed PNG — so `icons.mjs` writes one itself, median-cutting to a 256-colour
palette and deflating the scanlines through the browser's own `CompressionStream`. It keeps the
result only when it beats the truecolour encode, so opting a slot into it can never make that slot
worse. The iOS app icon goes from 1.86 MB to 358 KB that way, and the launch image from over 3 MB
to 794 KB.

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
| `<assetId>.png` | `B4a.png`, `C2.png`, `E1.png` |
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
   45% height to 62% at the bottom and B3 to 50%.
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
  "flatten / kill alpha". B1–B3, B5, B8, C3 and E2/E3 are opaque plates.
- **`fit`** is `cover` where the entry says to crop, `contain` where an edge is load-bearing
  (trophy silhouettes, the ball's circle, C5's transparent end columns, the B7 set's shared
  optical area).

Known gaps, all documented on the entries themselves:

- **B5 / C3** seamlessness is not verified here — run the 3×3 offset test by eye.
- **C4** scales an 8-up strip; it does not re-slice or re-centre cells, so the source must already
  be a 4:1 strip of eight tokens.
- **PNG** has no quality ladder in `ingest.mjs`. An oversized PNG destination fails its budget
  rather than being crushed — simplify the source, or move the slot to `icons.mjs`, which can
  palette-encode it.
