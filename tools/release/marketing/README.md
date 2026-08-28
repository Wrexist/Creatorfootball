# App Store marketing screenshots

The framed, captioned images that appear on the store listing — as opposed to
the raw in-app captures in `../store-shots/`, which are what goes *inside* the
device frames here.

```bash
pnpm shots:all          # capture the app, then frame it (what you usually want)
pnpm shots:store        # just the raw in-app captures
pnpm shots:marketing    # just re-frame existing captures (fast: no game replay)

node tools/release/marketing/render.mjs --only 05_social --size iphone-6.5
```

Output lands in `out/<device>-<width>x<height>/` (gitignored).

## Which folder goes in which App Store Connect box

App Store Connect rejects an entire upload if one image is the wrong size, and
the error names only the pixel dimensions it wanted. **The 6.9" and 6.5" boxes
do not accept each other's images** — this is the single easiest mistake to
make, so the folders are named after their pixel size.

| Folder | Upload into | Apple also accepts |
|---|---|---|
| `iphone-6.9-1290x2796/` | iPhone **6.9"** Display | 1260×2736, 1320×2868 |
| `iphone-6.5-1284x2778/` | iPhone **6.5"** Display | 1242×2688 |
| `ipad-13-2064x2752/` | iPad **13"** Display | 2048×2732 |

Do **not** upload anything from `../store-shots/` directly: those are 1290×2796,
which the 6.5" box rejects.

The renderer reads each PNG's IHDR back after writing and fails loudly if a
dimension is off by even one pixel, so anything in `out/` is known-good.

## Editing the copy

Headlines, subheads, badges and the emoji live in `shots.mjs`, one object per
frame. The headline auto-fits to two lines, so longer copy shrinks rather than
wrapping to a third line and pushing the device off the canvas.

`shots.mjs` also holds `SIZES`. Logical viewport × DPR is chosen to land
exactly on Apple's pixel sizes (430×932 @3 = 1290×2796), so nothing is ever
resampled — resampling is what makes store screenshots look soft.

## Why the phone shows the real app

App Review guideline 2.3.1 requires screenshots to show the actual product.
Every screen inside every device frame is a real capture of the running build;
the marketing layer is only the background, the type and the badges around it.
