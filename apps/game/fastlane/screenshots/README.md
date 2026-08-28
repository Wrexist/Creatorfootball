# Store screenshots

Drop the final store screenshots in `en-US/` and run the **App Store
metadata** workflow with *include screenshots* ticked to upload them. Empty,
this directory is ignored (`skip_screenshots true` in the Deliverfile).

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

**Known issue affecting shot 5:** the Social screen's filter row
(`GlassSegmented`) wraps "Creators" mid-word at 430 pt — five labels do not fit
across. Cosmetic, but visible in a store screenshot; see the note in
`docs/APP_STORE.md` §5.
