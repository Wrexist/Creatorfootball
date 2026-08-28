# Store screenshots

`en-US/` holds the finished listing images. Run the **App Store metadata**
workflow with *include screenshots* ticked to upload them; nothing uploads by
accident, because the Deliverfile sets `skip_screenshots true` and the workflow
input is what overrides it.

**Currently in place:** all eight screens, framed and captioned, at both sizes a
universal build needs — 6.9" iPhone (1290×2796) and 13" iPad (2064×2752), the
iPad set prefixed `ipad_` so each device's eight stay in conversion order.
They were captured from the real bundle on a played save and re-framed by
`pnpm shots:all`, so re-running that command regenerates them in place. They are
a *good* set, not a final one: the culling and caption pass in
[`docs/APP_STORE.md §5`](../../../../docs/APP_STORE.md) is still worth doing
before launch, and the first image is the one that sells the app.

- **Required set:** 6.9" iPhone — **1290×2796** portrait PNG. App Store
  Connect derives the smaller iPhone sizes from it.
- **Recommended:** 13" iPad — **2064×2752**, since the build targets device
  family 1,2 (iPhone + iPad).
- Order in App Store Connect follows filename sort, so prefix with `01_`,
  `02_`, … in the conversion-ranked order from
  [`docs/APP_STORE.md §5`](../../../../docs/APP_STORE.md), which also carries
  the caption for each shot and the rules Apple enforces (real product only,
  no pricing/ranking claims, real status bar content).

`pnpm shots:store` (repo root) captures all eight candidates from the real web
bundle at exactly 1290×2796 into `tools/release/store-shots/` (gitignored). It
plays the game to get them: it takes over **Marrowgate Athletic**, simulates 16
of the 22 fixtures, then plays one match live — so the table reads as a title
run-in, the feed is full of rivals reacting to real results, and the two
in-match frames (the pitch, and the decision sheet with its countdown still
running) are genuine. Options:

```bash
pnpm shots:store                      # defaults: Marrowgate Athletic, 16 weeks
node tools/release/store-shots.mjs --club "Cinderwick Town" --weeks 20
```

It is a starting point, not an auto-publisher — pick the best frame of each
moment, order them per §5, and copy the keepers here. Nothing it writes is
uploaded until you run the metadata workflow with *include screenshots*.

For the **finished, captioned** listing images (headline + framed devices at
all three required sizes), run `pnpm shots:all` and see
`tools/release/marketing/README.md` — including which folder goes in which
App Store Connect box, since the 6.9" and 6.5" boxes reject each other's files.
