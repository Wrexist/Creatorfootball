# Seasonal formation evolution experiment

Commit `acc6647ef582aec77db97357d5215706ef8040f7` (working tree had uncommitted changes) · 12 worlds × 8 seasons × 5 candidates · 12672 matches each · runtime 1831 s.

The same seeds generate the same worlds in every candidate; only the threshold
a club's current shape must fall behind before it is replaced differs.
Raw numbers are in `results.json`.

| Metric | A frozen (shipped) | B greedy (no guard) | C threshold 0.06 | D threshold 0.08 | E threshold 0.12 |
|---|---|---|---|---|---|
| changes/club | 0 | 3.319 | 0.493 | 0.257 | 0.049 |
| changes/club/season | 0 | 0.4149 | 0.0616 | 0.0321 | 0.0061 |
| never changed | 1 | 0.09 | 0.583 | 0.764 | 0.951 |
| changed once | 0 | 0.118 | 0.354 | 0.215 | 0.049 |
| changed 2+ | 0 | 0.792 | 0.063 | 0.021 | 0 |
| reversals/club | 0 | 0.3958 | 0.0069 | 0 | 0 |
| clubs w/ reversal | 0 | 0.306 | 0.007 | 0 | 0 |
| shortfall final | 0.0354 | 0.0019 | 0.0191 | 0.025 | 0.0348 |
| shortfall p90 | 0.0745 | 0 | 0.043 | 0.0579 | 0.0762 |
| out-of-position XI | 0.778 | 0.396 | 0.597 | 0.639 | 0.757 |
| fits identity | 0.361 | 0.257 | 0.354 | 0.375 | 0.361 |
| shapes used | 10 | 10 | 10 | 10 | 10 |
| dominant share | 0.278 | 0.264 | 0.319 | 0.264 | 0.278 |
| entropy (bits) | 3.032 | 3.02 | 2.868 | 3.015 | 2.98 |
| bench line gaps | 0.1005 | 0.0801 | 0.0918 | 0.0848 | 0.087 |
| season points sd | 11.89 | 12.191 | 12.065 | 12.077 | 11.822 |
| weak ppg | 1.064 | 0.984 | 1.043 | 1.049 | 1.064 |
| strong-weak gap | 0.681 | 0.791 | 0.726 | 0.681 | 0.671 |
| rollover ms | 209.19 | 216.34 | 214.68 | 218.06 | 219.94 |

## Final-season shape distribution

- **A frozen (shipped)**: 3-2-1 40, 3-3 22, 1-3-2 17, 2-2-1-1 14, 2-4 12, 2-1-3 12, 2-3-1 9, 3-1-2 8, 2-1-2-1 6, 2-2-2 4
- **B greedy (no guard)**: 3-2-1 38, 3-3 27, 2-4 18, 3-1-2 13, 2-2-1-1 11, 2-2-2 10, 1-3-2 9, 2-3-1 7, 2-1-3 6, 2-1-2-1 5
- **C threshold 0.06**: 3-2-1 46, 3-3 30, 2-2-1-1 14, 1-3-2 11, 2-1-3 11, 2-4 10, 2-2-2 8, 3-1-2 6, 2-3-1 4, 2-1-2-1 4
- **D threshold 0.08**: 3-2-1 38, 3-3 26, 2-4 17, 1-3-2 15, 2-2-1-1 12, 2-1-3 12, 2-2-2 7, 3-1-2 7, 2-1-2-1 5, 2-3-1 5
- **E threshold 0.12**: 3-2-1 40, 3-3 28, 1-3-2 15, 2-2-1-1 13, 2-4 13, 2-1-3 10, 2-3-1 9, 3-1-2 7, 2-1-2-1 5, 2-2-2 4
