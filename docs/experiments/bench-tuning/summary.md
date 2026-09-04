# Matchday bench balance experiment

Commit `b4cedf78afc32c9dc13c417673290d9e48abb9aa` · 40 worlds × 1 season × 5 configurations
· 5280 matches per configuration
· runtime 623 s.

Everything except the selector constants is held identical: the same seeds,
clubs, squads, fixtures, match configuration, opponent adaptation, injuries
and economy. Raw numbers are in `results.json`.

| Metric | A current (0.70 / 0.12) | B low cover (0.60 / 0.12) | C high cover (0.80 / 0.12) | D no lean (0.70 / 0.00) | E strong lean (0.70 / 0.20) |
|---|---|---|---|---|---|
| goals/match | 8.013 | 8.013 | 8.017 | 8.012 | 8.013 |
| goal sd | 3.18 | 3.18 | 3.16 | 3.18 | 3.18 |
| margin >= 4 | 0.369 | 0.369 | 0.369 | 0.371 | 0.369 |
| draws | 0.106 | 0.106 | 0.106 | 0.107 | 0.106 |
| season points sd | 11.733 | 11.733 | 12.155 | 11.793 | 11.733 |
| strong-weak ppg | 0.918 | 0.918 | 0.934 | 0.92 | 0.918 |
| deep-shallow ppg | 0.216 | 0.216 | 0.192 | 0.213 | 0.216 |
| subs/match | 9.261 | 9.261 | 9.126 | 9.261 | 9.261 |
| bench used | 0.663 | 0.663 | 0.654 | 0.663 | 0.663 |
| ATT cover/bench | 1.465 | 1.465 | 1.5 | 1.465 | 1.465 |
| DEF cover/bench | 2.909 | 2.909 | 2.878 | 2.91 | 2.909 |
| utility seats | 3.595 | 3.595 | 3.415 | 3.596 | 3.595 |
| late goal share | 0.325 | 0.325 | 0.328 | 0.325 | 0.325 |
| matches changed vs A | - | 0 (0.0%) | 4486 (85.0%) | 85 (1.6%) | 0 (0.0%) |
| winner changed vs A | - | 0 (0.0%) | 1917 (36.3%) | 22 (0.4%) | 0 (0.0%) |

## How the selector itself responds

Every real squad against every shape the game offers, with no match played.

| Question | Answer |
|---|---|
| benches changed by cover 0.60 vs 0.70 | 0.379 |
| benches changed by cover 0.70 vs 0.80 | 0.797 |
| benches changed by lean 0 vs 0.12 | 0.103 |
| benches changed by lean 0.12 vs 0.20 | 0 |
| shapes the lean can reach | 2-1-3, 1-3-2, 4-4-2, 2-2-2, 3-3, 4-3-3, 3-5-2 |
| distinct benches across the ten seven-a-side shapes | 0.99 |
| bench turnover when one starter is unavailable | 0.143 |
| seats held by a two-line utility player | 0.318 |
| bench mean overall vs best seven reserves | 67.26 vs 70.06 |
| rating forgone to buy cover | 2.796 |
