# Seasonal formation evolution experiment

`summary.md` is the human read; `results.json` is the record. Both are
generated — do not hand-edit them.

## Reproducing

```
pnpm --filter @cf/sim experiment:evolution              # 12 worlds x 8 seasons
pnpm --filter @cf/sim experiment:evolution 2 3 /tmp/x   # a quick shape-check
```

Roughly 1,830 s for the default 12 worlds × 8 seasons — 144 club careers and
12,672 matches per candidate. Deterministic: two full runs were byte-identical
including every hash.

## What it compares

Every candidate plays the *same* worlds from the same seeds. Only one thing
differs: how far behind the best available shape a club's current one must fall
before it is replaced.

- **A frozen** — shapes never reassessed, which is what the game shipped.
- **B greedy** — reassessed every summer with no stability preference at all
  (`changeThreshold: 0, band: 0`). The diagnostic control; expected to churn,
  measured so the churn is a number.
- **C / D / E** — thresholds of 0.06, 0.08 and 0.12. C sits exactly on the
  selector's own suitability band, the smallest value the rule can coherently
  take in production.

All five drive the real `reviewFormation` through the engine's `formationEvolution`
option, which defaults to the production rule. There is no second implementation.

## What it does not answer

Eight seasons, not twenty. It also measures the world as it is: **players'
positions never change** — nothing in the engine retrains a centre-back into a
midfielder — so a squad's positional makeup moves only through who joins and
who leaves. If positional retraining is ever added, this experiment should be
re-run, because the drift it measures would come from a second source.
