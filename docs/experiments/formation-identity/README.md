# AI formation identity experiment

`summary.md` is the human read; `results.json` is the record. Both are
generated — do not hand-edit them.

## Reproducing

```
pnpm --filter @cf/sim experiment:formation             # 24 worlds, writes here
pnpm --filter @cf/sim experiment:formation 3 /tmp/x    # a quick shape-check
```

Roughly 285 s for the default 24 worlds (288 clubs, 3,168 matches per
candidate). Deterministic: the same worlds and candidates produce byte-identical
output every time.

## What it compares

Every candidate generates the *same* worlds from the same seeds — same clubs,
squads, player attributes, fixtures and tactics — and then changes only which
formation each club plays.

- **control** — every club in `2-3-1`, which is what the game shipped before:
  `newGame` wrote `DEFAULT_FORMATION_ID` into all twelve and nothing
  reconsidered.
- **A squad suitability only** — each club gets the shape its players suit best,
  with identity switched off entirely.
- **B squad + identity** — the shipped hierarchy: only shapes within 6% of the
  best-suited one are candidates, and the club's own tactics then move a
  candidate by at most 4%.
- **C identity-led** — the same machinery with the band and the identity weight
  both raised to 0.20, so identity can overrule squad suitability. This is the
  failure mode, measured rather than assumed.

All four call the real `selectFormation`; there is no second implementation.

## What it does not answer

One season per world, so multi-season drift is out of scope: as squads change
through transfers and development, a club's best shape may change with them, and
this measures none of that. The selector runs once at world generation and the
choice is then stable for the save.
