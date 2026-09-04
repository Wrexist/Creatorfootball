# Matchday bench balance experiment

`summary.md` is the human read; `results.json` is the record. Both are
generated — do not hand-edit them.

## Reproducing

```
pnpm --filter @cf/sim experiment:bench            # 40 worlds, writes to this directory
pnpm --filter @cf/sim experiment:bench 4 /tmp/x   # a quick shape-check
```

Roughly 630 s for the default 40 worlds. The run is deterministic: the same
worlds, seeds and configurations produce byte-identical output every time, and
`results.json` carries the commit it was produced from (plus a `dirtyTree` flag,
because a result recorded against a commit it was not run from is a lie).

## What it holds constant

Everything but the two selector constants. The same seeds generate the same
clubs, squads, player attributes, fixtures and rule-card holdings; the same
match configuration, opponent adaptation, injury model and economy run
underneath. `packages/engine/src/tactics/benchTuning.test.ts` pins that: the
tuned selector at its defaults is the production selector bench-for-bench and
result-for-result, a tuning cannot reach world generation, and the production
reference hashes are unchanged.

## What it does not answer

It measures one season per world. Multi-season effects — squads that drift
apart because a bench decision compounded through transfers and development —
are outside it. It also measures the content pack the game ships, in which
every generated club plays 2-3-1; a pack with varied club formations would give
the tactical lean far more to do.
