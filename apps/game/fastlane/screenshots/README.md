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

`pnpm shots:store` (repo root) renders draft candidates from the real web
bundle at exactly 1290×2796 into `tools/release/store-shots/` — a starting
point to select and polish from, not an auto-publisher: the in-match moments
(decision sheet up, feed reacting) still need a played save behind them.
