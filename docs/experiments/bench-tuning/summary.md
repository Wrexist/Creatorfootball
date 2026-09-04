# Matchday bench balance experiment

Commit `d38d463d519f4b6503c457f3974325bfd2009293` (working tree had uncommitted changes) · 40 worlds × 1 season × 5 configurations
· 5280 matches per configuration
· runtime 615 s.

Everything except the selector constants is held identical: the same seeds,
clubs, squads, fixtures, match configuration, opponent adaptation, injuries
and economy. Raw numbers are in `results.json`.

| Metric | A current (0.70 / 0.12) | B low cover (0.60 / 0.12) | C high cover (0.80 / 0.12) | D no lean (0.70 / 0.00) | E strong lean (0.70 / 0.20) |
|---|---|---|---|---|---|
| goals/match | 7.979 | 7.994 | 7.967 | 7.962 | 7.979 |
| goal sd | 3.1 | 3.08 | 3.11 | 3.11 | 3.1 |
| margin >= 4 | 0.373 | 0.367 | 0.362 | 0.376 | 0.373 |
| draws | 0.103 | 0.11 | 0.109 | 0.106 | 0.103 |
| season points sd | 11.817 | 11.687 | 11.979 | 11.828 | 11.817 |
| strong-weak ppg | 0.874 | 0.859 | 0.898 | 0.877 | 0.874 |
| deep-shallow ppg | 0.152 | 0.163 | 0.165 | 0.128 | 0.152 |
| subs/match | 9.019 | 8.999 | 8.865 | 9.03 | 9.019 |
| bench used | 0.646 | 0.645 | 0.635 | 0.647 | 0.646 |
| ATT cover/bench | 2.25 | 2.253 | 2.137 | 2.251 | 2.25 |
| DEF cover/bench | 3.286 | 3.28 | 3.248 | 3.289 | 3.286 |
| utility seats | 2.028 | 1.973 | 1.938 | 2.041 | 2.028 |
| late goal share | 0.322 | 0.321 | 0.326 | 0.323 | 0.322 |
| matches changed vs A | - | 2558 (48.4%) | 4205 (79.6%) | 781 (14.8%) | 0 (0.0%) |
| winner changed vs A | - | 1093 (20.7%) | 1852 (35.1%) | 339 (6.4%) | 0 (0.0%) |

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
| bench mean overall vs best seven reserves | 66.27 vs 68.98 |
| rating forgone to buy cover | 2.712 |
