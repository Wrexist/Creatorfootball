# AI formation identity experiment

Commit `d38d463d519f4b6503c457f3974325bfd2009293` (working tree had uncommitted changes) · 24 worlds × 1 season × 4 candidates · 3168 matches each · runtime 282 s.

The same seeds generate the same clubs, squads, fixtures and tactics in every
candidate; only the formation each club plays differs. Raw numbers are in
`results.json`.

| Metric | control (every club 2-3-1) | A squad suitability only | B squad + identity (0.06 / 0.04) | C identity-led (0.20 / 0.20) |
|---|---|---|---|---|
| shapes used | 1 | 10 | 10 | 10 |
| dominant share | 1 | 0.403 | 0.285 | 0.264 |
| entropy (bits) | 0 | 2.704 | 2.987 | 2.736 |
| shape fits identity | 0.083 | 0.257 | 0.521 | 0.851 |
| suitability loss | 0.0374 | 0 | 0.0071 | 0.019 |
| out-of-position XI | 0.438 | 0.181 | 0.188 | 0.26 |
| bench line gaps | 0.0313 | 0.0698 | 0.0848 | 0.1363 |
| bench no keeper | 0 | 0 | 0 | 0 |
| goals/match | 7.952 | 7.965 | 7.891 | 7.94 |
| draws | 0.111 | 0.1 | 0.1 | 0.101 |
| season points sd | 12.017 | 11.968 | 11.382 | 11.751 |
| strong ppg | 1.91 | 1.944 | 1.865 | 1.869 |
| middle ppg | 1.424 | 1.386 | 1.414 | 1.392 |
| weak ppg | 1 | 1.02 | 1.071 | 1.087 |
| strong-weak gap | 0.91 | 0.924 | 0.794 | 0.782 |
| attack share sd | 0 | 0.14 | 0.15 | 0.146 |

## Shape distribution

- **control (every club 2-3-1)**: 2-3-1 288
- **A squad suitability only**: 3-2-1 116, 3-1-2 40, 3-3 37, 2-4 25, 1-3-2 16, 2-2-1-1 15, 2-1-2-1 14, 2-3-1 14, 2-2-2 7, 2-1-3 4
- **B squad + identity (0.06 / 0.04)**: 3-2-1 82, 3-3 44, 1-3-2 37, 2-2-1-1 28, 3-1-2 27, 2-1-3 21, 2-4 18, 2-3-1 16, 2-2-2 9, 2-1-2-1 6
- **C identity-led (0.20 / 0.20)**: 2-1-3 76, 3-2-1 65, 1-3-2 61, 2-2-1-1 26, 3-1-2 19, 2-3-1 12, 3-3 12, 2-4 8, 2-2-2 8, 2-1-2-1 1
