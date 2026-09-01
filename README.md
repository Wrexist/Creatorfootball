# Creator Football

A premium, iPhone-first (Android-compatible) football-management game built around a
compressed, high-energy short-format creator league.

You take over a club in a twelve-team league. You recruit footballers **and** creators, pick
a shape, and then make two or three genuinely difficult decisions during a live animated
match. Between matches you run the business — transfers, training, facilities, sponsors,
fans, media — and across seasons you build a dynasty the world remembers.

**Deep systems underneath, few decisions on the surface.** Twelve clubs, twenty-two matches,
thirty-minute short-format games, ten-to-fifteen-minute sessions. No energy, no timers, no
pay-to-win.

The universe is **100% original fiction**. Every club, player, creator, sponsor and
competition is invented. The content architecture allows licensed real creators and
footballers to be added later as an optional, separately gated pack — never as base content.

---

## Quick start

Requires **Node ≥ 20** and **pnpm 10**.

```bash
pnpm install          # install the workspace
pnpm dev              # Vite dev server for the game on :5173 (host: true — reachable from a phone on your LAN)
pnpm test             # Vitest, engine package, node environment
pnpm typecheck        # tsc --noEmit across every package
pnpm build            # type-check the engine, then build the app
pnpm lint             # lint every package
```

Headless audit harness (`tools/sim`):

```bash
pnpm audit:sim         # 1,000-match simulation audit: distributions, determinism, impossible states
pnpm audit:economy     # 100-season economy stress: inflation ceilings, reconciliation, invariants
pnpm audit:invariants  # state-legality sweep at every cycle boundary
pnpm audit:all         # all of the above
```

Native shells:

```bash
pnpm --filter @cf/game build
pnpm --filter @cf/game cap:sync   # copy the web build into the iOS/Android shells
```

> **Current state.** The engine is complete: the match simulator, the fictional
> base content pack and generators, transfers, scouting, training, facilities,
> fans, sponsors, the economy cycle and audit, media, social, rivalries, AI
> clubs, the world tick, objectives, legacy and analytics. `apps/game` has a
> full design component library and a gallery. 83 test files, 1,015 tests.
> Careers persist to IndexedDB. See `docs/CURRENT_STATE.md` for verified status.
>
> CI gates every push on lint (including the engine-purity boundary),
> typecheck, all tests, the production build, a real-browser smoke test of the
> built artefact, and three headless balance audits.
>
> iOS is wired for release: Capacitor 8 with haptics, status bar and splash
> plugins, a committed `ios/` shell with brand icon and splash assets, and
> App Store metadata in `docs/APP_STORE.md` +
> `apps/game/fastlane/metadata/en-US/`. Building the archive itself requires
> macOS/Xcode; everything up to that point is reproducible here.
>
> Known remaining work before shipping (`docs/FINAL_AUDIT.md` §6): a real-
> device pass, the save-size ceiling against localStorage quota, and an AI
> that counters the player's tactics.

---

## Repository layout

```
Creatorfootball/
├── packages/
│   └── engine/            @cf/engine — pure TypeScript. No DOM, no React, no Node built-ins.
│       └── src/
│           ├── core/         rng, math, events, ids, clock, invariant, result, branded ids
│           ├── players/      positions, attributes, mental profile, traits, the Player entity
│           ├── creators/     Creator and Manager entities
│           ├── clubs/        the Club entity, fan state, finance, visual identity
│           ├── contracts/    contracts, squad roles, minutes promises
│           ├── tactics/      TacticSetup → TacticVector, formations, auto-lineup
│           ├── matches/      match events, pitch frames, live decisions, special rules, results
│           ├── league/       competitions, fixture generation, standings
│           ├── economy/      the transaction ledger
│           ├── licensing/    identity kinds, rights metadata, renderability
│           ├── content/      the content-pack schema
│           ├── game/         the complete serialisable GameState
│           ├── persistence/  storage port, versioned saves, migrations, backup recovery
│           ├── simulation/   ports and template rendering for the living world
│           └── transfers/    market, valuation, wage and scouting balance constants
├── apps/
│   └── game/              @cf/game — React 19 + Vite 7 + Tailwind 4, wrapped by Capacitor
│       └── src/design/       design tokens, motion language, haptics, seeded procedural art
├── tools/
│   └── sim/               @cf/sim — headless balance and audit harness
└── docs/                  the documentation set (below)
```

---

## Architectural rules you must not break

These are not style preferences. Each one protects a property the whole product depends on.
The full reasoning is in `docs/ARCHITECTURE.md`.

1. **`packages/engine` is pure TypeScript.** It must never import React, the DOM, `window`,
   `document`, `localStorage`, Capacitor, or any Node built-in. This is what buys us headless
   balance sims, real testability, a future server, and no rewrite for multiplayer.

2. **No `Math.random()` anywhere in the engine.** Take an `Rng` as a parameter and derive
   sub-streams with `rng.fork('unique-label')`. Determinism is what makes replays, regression
   tests, balance audits and bug reproduction possible.

3. **No `Date.now()` inside simulation logic.** Timestamps arrive as parameters
   (`ctx.at`, `now`). Wall-clock fields exist for display ordering only — never simulate from
   them.

4. **State is immutable at the boundary.** Functions take state and return new state or a
   described delta. Never mutate an argument the caller owns.

5. **Money moves only through `Ledger.post` / `credit` / `debit`.** No module mutates a
   balance directly. Every movement has a source, a destination, an amount that is always
   positive, and a human-readable memo.

6. **Systems learn about each other only through domain events.** Nothing may react to a
   state mutation it did not learn about through the `EventBus`. Every generated social post
   or news story must trace back to a real event via `relatedEventId`.

7. **Every designer-tunable number lives in a `balance.ts` constants object** in its own
   module, never inline in logic. A balance change should be a single reviewable diff.

8. **Standings — and anything else derivable — are derived, never stored.** This removes an
   entire class of drift bugs and is a precondition for shared leagues later.

9. **No progression lives only in component state.** If losing it would cost the player
   something, it belongs in `GameState`.

10. **No component invents a design value.** Every colour, radius, blur, duration and easing
    comes from `apps/game/src/design/tokens.css`. That file is frozen — extend it by adding
    tokens, never by changing existing ones.

11. **No real names, ever, in base content.** No real club, league, creator, footballer,
    sponsor or broadcaster — and no near-miss of one. Game logic branches on `IdentityKind`
    and rights metadata only, never on a specific name.

12. **Tests live next to the code as `*.test.ts`, and test behaviour, not implementation.**

13. **`pnpm --filter @cf/engine typecheck` must pass with zero errors before you finish.**
    TypeScript is `strict` with `noUncheckedIndexedAccess`.

14. **Comments explain *why*, never *what*.** Match the density of the existing files: a
    short block comment at the top of a module explaining its role and its trade-offs, and
    inline comments only where the reason is non-obvious.

**Before writing any code in this repository, read `docs/INTEGRATION_CONTRACT.md`.** It
assigns every module to exactly one workstream and lists the frozen contracts. If a contract
genuinely blocks you, add a *new* file in your own directory rather than editing a frozen
one, and say so in your summary.

---

## Documentation

| Document | What it covers |
|---|---|
| [`docs/INTEGRATION_CONTRACT.md`](docs/INTEGRATION_CONTRACT.md) | **Read first.** Module ownership, frozen contracts, the universal rules, and every workstream's required exports |
| [`docs/PRODUCT_REQUIREMENTS.md`](docs/PRODUCT_REQUIREMENTS.md) | The PRD: player fantasy, audience, core loop, season structure, feature requirements by system, the first-ten-minutes onboarding beat sheet, retention design, success metrics, the P0/P1/P2 list, non-goals and open questions |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Monorepo layout, the engine-purity rule and what it buys, the six state layers, the event architecture, seeded determinism and its limits, the ledger, content packs, Capacitor strategy, ports and adapters, V2 extension points, and the recorded architectural decisions |
| [`docs/GAME_SYSTEMS.md`](docs/GAME_SYSTEMS.md) | How every system works and how each one feeds the others: the dependency map, attributes and position weighting, traits, creators, clubs, tactics as trade-offs, fans, the match, facilities, transfers, training, objectives, rivalries, AI — and the six closed loops with their brakes |
| [`docs/ECONOMY.md`](docs/ECONOMY.md) | Currencies, every income and expenditure source, ledger design, economic invariants, balance targets, anti-inflation brakes, and the monetisation architecture |
| [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) | The four glass elevation levels, the colour system and the discipline around the electric-lime accent, typography, spacing, radii, the three motion speeds, the hero-moment inventory, haptics policy, accessibility rules, and the mobile-to-desktop responsive strategy |
| [`docs/CONTENT_SCHEMA.md`](docs/CONTENT_SCHEMA.md) | The content-pack format, every entity type, composition and overrides, validation rules, and a worked example of authoring a new pack |
| [`docs/LICENSING_ARCHITECTURE.md`](docs/LICENSING_ARCHITECTURE.md) | The four identity kinds, rights metadata, region and expiry gating, graceful degradation, fictional fallbacks, and the legal guardrails that make accidental IP infringement structurally difficult |
| [`docs/ANALYTICS.md`](docs/ANALYTICS.md) | The full event taxonomy, the onboarding / first-match / first-transfer / first-purchase funnels, retention and churn indicators, and the pluggable-sink design that keeps the engine free of network code |
| [`docs/TEST_PLAN.md`](docs/TEST_PLAN.md) | Testing across unit, static, content, simulation, economy, invariant, integration and manual UX layers; the 1,000-match, 100-season, 10,000-player and strategy audits; phase gates and what "done" means |
| [`docs/ASSUMPTIONS.md`](docs/ASSUMPTIONS.md) | Every assumption and trade-off, with rationale, cost, falsification signal, and what changes if it turns out wrong |
| [`docs/RISKS.md`](docs/RISKS.md) | A product pre-mortem: twenty ways this fails, with likelihood, impact, early warning signals and mitigations |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | The phased plan with objective gates, mapped to what exists today versus what remains |
| [`docs/RESEARCH_CREATOR_FOOTBALL.md`](docs/RESEARCH_CREATOR_FOOTBALL.md) | Competitive and format research, economic reference figures, and the borrow/do-not-borrow boundary |
| [`docs/SIMULATION_REFERENCE_DATA.md`](docs/SIMULATION_REFERENCE_DATA.md) | **Authoritative** tuning targets for the match engine: goal rates, scoreline distributions, home advantage, favourite-vs-underdog probabilities, and the consolidated validation checklist |

---

## Contributing

1. Read `docs/INTEGRATION_CONTRACT.md` and find your workstream.
2. Work only in the paths your workstream owns.
3. Import from other workstreams by the exact signature in the contract and assume it exists.
4. Follow the fourteen rules above.
5. Write `*.test.ts` next to your code.
6. `pnpm typecheck` and `pnpm test` must pass before you finish.
