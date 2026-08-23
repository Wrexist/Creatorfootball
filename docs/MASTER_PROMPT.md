# Creator Football — Master Prompt

> **What this is.** The complete working context for any AI agent (or new engineer) continuing
> development of Creator Football in this repository. Read it top to bottom before touching code.
> It compresses the full documentation set, the fourteen architectural laws, the design language,
> the current product state, and the live prioritized backlog from the August 2026 five-track audit
> (UX · fun · content · cleanliness · assets). Where this file and another doc disagree, this file
> wins; update this file when reality changes.

---

## 1. The product in one paragraph

Creator Football is a premium, iPhone-first football-management game set in a **100% fictional
creator league**: twelve invented clubs, twenty-two matches per season, thirty-minute short-format
games, ten-to-fifteen-minute sessions. You take over a club, recruit footballers **and** creators,
pick a shape, then make two or three genuinely difficult decisions during a live animated match.
Between matches you run the business — transfers, training, facilities, sponsors, fans, media,
social, rivalries — and across seasons you build a dynasty the world remembers. **Deep systems
underneath, few decisions on the surface.** No energy, no timers, no pay-to-win. Every club,
player, creator, sponsor and broadcaster is invented; licensed real people are structurally
impossible in base content (see §7).

The player fantasy to protect in every decision: *"that result was mine."* Few decisions, real
stakes, honest feedback.

---

## 2. Repository map

```
packages/engine/    @cf/engine — PURE TypeScript game engine. No DOM/React/Node built-ins.
  src/core/         rng, math, events(EventBus), ids(branded), clock, invariant, result
  src/players|creators|clubs|contracts|tactics|matches|league|economy|licensing|content/
  src/game/         serialisable GameState + cycle orchestration
  src/persistence/  storage port, versioned saves, migrations, backup recovery
  src/simulation/   worldTick, cascade (event→follow-ups), aiClub, emergent story detection
  src/social|media|rivalries|fans|sponsors|facilities|training|transfers|objectives|progression/
apps/game/          @cf/game — React 19 + Vite 7 + Tailwind 4, Capacitor 8 iOS shell
  src/app/          Shell, SectionNav, router, routes (five sections, rail inside each)
  src/design/       tokens.css (FROZEN), glass system, hero moments, icons (~60 stroke SVG),
                    seeded procedural art: faces, crests, pitch renderer (canvas), StoryArt
  src/features/     onboarding, home, squad, market, league, social, club, progression, matchday
  src/state/        gameStore (zustand-style store over engine GameState)
tools/sim/          @cf/sim — headless audits: 1,000-match sim, 100-season economy, invariants
docs/               PRD, ARCHITECTURE, GAME_SYSTEMS, ECONOMY, DESIGN_SYSTEM, CONTENT_SCHEMA,
                    LICENSING_ARCHITECTURE, ANALYTICS, TEST_PLAN, RISKS, ROADMAP, audits…
website/            static marketing site (privacy/terms/support required by the App Store)
.github/workflows/  ci.yml gates every push; pages.yml deploys website
```

Commands: `pnpm dev` (:5173) · `pnpm test` · `pnpm typecheck` · `pnpm build` · `pnpm lint` ·
`pnpm audit:sim|economy|invariants|all`. Native: `pnpm --filter @cf/game build && pnpm --filter @cf/game cap:sync`.

---

## 3. The fourteen laws (violating any of these is a bug, not a style choice)

1. **`packages/engine` is pure TypeScript** — never import React/DOM/window/localStorage/Capacitor/Node built-ins. Lint-enforced.
2. **No `Math.random()` in the engine.** Take an `Rng`; derive sub-streams with `rng.fork('unique-label')`. Determinism buys replays, regression tests, balance audits.
3. **No `Date.now()` inside simulation logic.** Timestamps arrive as parameters (`ctx.at`, `now`).
4. **State is immutable at the boundary.** Take state, return new state or a described delta.
5. **Money moves only through `Ledger.post/credit/debit`** — positive amounts, source, destination, memo.
6. **Systems learn about each other only through domain events** on the EventBus. Every generated post/story traces to a real event via `relatedEventId`.
7. **Every designer-tunable number lives in a `balance.ts` constants object**, never inline in logic.
8. **Derivable state is derived, never stored** (standings included).
9. **No progression lives only in component state.** If losing it costs the player, it belongs in `GameState`.
10. **No component invents a design value.** All colours/radii/durations/easings come from `src/design/tokens.css` — frozen; extend by adding tokens.
11. **No real names ever, in base content** — clubs, players, creators, sponsors, broadcasters; no near-misses. Logic branches on `IdentityKind` + rights metadata only.
12. **Tests live next to code as `*.test.ts`, testing behaviour not implementation.**
13. **`pnpm --filter @cf/engine typecheck` passes with zero errors** before finishing. TS `strict` + `noUncheckedIndexedAccess`.
14. **Comments explain why, never what.**

Read `docs/INTEGRATION_CONTRACT.md` before writing code: module ownership is per-workstream;
frozen contracts must be imported by exact signature. If a contract blocks you, add a *new* file
rather than editing a frozen one, and say so in your summary.

---

## 4. Systems you will touch (how they interlock)

- **Match:** `MatchSimulator` (possession ticks → xG shots → decisions) emits pitch frames + live
  decision windows. **Swing windows**: clock-anchored drama spikes at fixed minutes, governed by
  special rules (`specialRuleEngine.ts`) — predictable drama beats random drama; that insight is the
  game's most original mechanic. Live decisions encode their own downside and get graded honestly
  post-match against xG windows (BACKFIRED is possible). Protect that honesty contract.
- **Tactics:** `TacticSetup → TacticVector`; formations are trade-offs, auto-lineup exists.
- **Transfers:** staged multi-round negotiation (patience, hijacks, walk-aways), valuation model,
  scouting reports, phase-gated windows.
- **Creators:** distinct entity class — audience/reach vs playing ability; campaigns (CONTENT_DROP
  etc.), feuds, press conferences. Creator reach feeds fan growth and sponsor value.
- **Living world:** `worldTick` advances all twelve clubs weekly (AI transfers, renewals, youth,
  facilities, board pressure); `cascade` turns events into follow-up posts/stories; `emergent`
  detects streaks/storylines; rivalries heat from real match events (red cards, late winners).
- **Economy:** single ledger; prize money, sponsors (4 tiers), fans, facilities upkeep; anti-inflation brakes documented in `docs/ECONOMY.md`.
- **Progression:** objectives (46 authored), reputation, legacy records + milestone timeline.

---

## 5. Design language (non-negotiable look & feel)

Dark glassmorphism, four elevation levels, electric-lime volt accent used as **state, never
decoration** (≤3% of pixels). Motion: chrome 140–220ms · content 380ms · reveals 720ms · cinematic
1400ms reserved for hero moments; bouncy springs = celebrations only. Haptics via platform driver;
silent fallback everywhere. Accessibility: ≥44pt targets, text ≥7:1 contrast on glass, reduced-motion/transparency variants exist and are regression-tested. Hero moments (goal burst, trophy,
signing flip) are the emotional peaks — spend craft there first. Full rules: `docs/DESIGN_SYSTEM.md`.

---

## 6. Current state (August 2026, post-audit-campaign)

Engine complete and audited; app has full component library + gallery; CI gates lint (incl.
purity boundary), typecheck, tests, build, real-browser smoke, three balance audits. iOS wired
via Capacitor; archive build needs macOS.

### What the August 2026 campaign changed (all verified green)
- **Fun depth:** board-confidence crisis ladder with ultimatums and forced consequences (progression/board.ts + migration); AI now counters your recent shape pre-match and makes one scripted trailing response in-match; decision recipes have context variants + recency memory; arena support rebalanced into the documented 2–4pp band and surfaced ("X% of the arena is in your colours", preview + walk-out); opponent's held rule cards shown pre-match; board pressure surfaces as a home lead card; per-trigger decision mastery record persists (v4 migration).
- **Content freshness:** one reconciled press universe (16 outlets, every citation resolves); every thin social trigger ≥4 variants; recurring media beats have 2nd/3rd stories; press room expanded; sponsor sector voices + doubled leaks; creators now spawn/retire each season (the scene is no longer frozen); name-bank headroom raised.
- **Cleanliness:** dead exports deleted (re-verified against live usage); ContentRegistry singleton ×1; branded-ID double-casts gone; retention caps hoisted into named balance constants (save-size ceiling now reviewable); micro-helpers consolidated; smoke harness portable (Windows-friendly run.mjs); .shots untracked.
- **UX:** contract renewal wired (meet demands / lowball through real engine verdicts), season-complete screen, failure surfacing everywhere, safe auto-pick, "predicted seven".

### Remaining known work
1. Save-size ceiling measurement on a long-running save (caps are constants now — measure and tune them).
2. Event-emission type escapes (`as unknown as AnyDomainEvent` ×6, `as never` ×11) — typed payload plumbing.
3. `tickWorld` (~710 lines) and TacticsBody/HomeBody decomposition — dedicated refactor sessions.
4. Creator recruiting parley (deliverables-as-trade-offs) — design doc first.
5. Real-device iOS pass; store screenshots (docs/ASSET_PLAN.md P0).
6. Economy audit wage-growth floor passes knife-edge at baseline (0.65 vs 0.60) — consider multi-seeding that gate.

### Audit verdict (this repo's own five-track audit)

**Verdict overall:** unusually clean codebase, strong moment-to-moment craft, but **fun depth lasted ~one season**. The campaign below closed nearly all of it; this section is kept as the audit record with status annotations — new work should start from §6 "Remaining known work", not from here.

#### A. Ship-blockers — ALL CLOSED
1. ~~Contract renewal had no UI~~ → wired (meet demands / lowball, real engine verdicts).
2. ~~Season end = error loop~~ → season-complete screen with final table and champions.
3. ~~Save/cycle failures swallowed~~ → persistFailed global toast + retryable advance banner.
4. ~~Auto-pick positional~~ → lowest-risk option by RISK_RANK.
5. ~~Dead primary button on Home~~ → fixed.

#### B. Fun depth — CLOSED except creator parley
- ~~Swing-window pool filtered to BOTH~~ → full pool, fire-time resolution.
- ~~Losing has no teeth~~ → board crisis ladder + ultimatums with forced consequences.
- ~~AI never contests your brain~~ → pre-match counter-lean + one trailing response.
- ~~Decision recipes verbatim / HALFTIME_TALK spam~~ → context variants + recency memory.
- Creator signing is still one click ⇒ deliverables parley remains open (design doc first).
- ~~Arena support invisible~~ → rebalanced into the 2–4pp band AND surfaced.

#### C. Content freshness — CLOSED
Commentary bank merged live (incl. player matches) · rumour templates by band · campaign variant pools · one press universe · press room expanded · creators regenerate yearly · legacy prose complete · social/media depth raised across the board.

#### D. Cleanliness — mostly closed
Dead exports deleted · singleton ×1 · double-casts gone · .shots untracked · retention caps in balance.ts · micro-helpers consolidated · config scrubbed. **Still open:** event-emission type escapes; tickWorld/TacticsBody/HomeBody decomposition.

#### E. What is genuinely good — protect it
1. The decision engine's honesty contract (options encode downsides; grading compares real windows).
2. Clock-anchored pre-announced swing windows as a format property.
3. The living world that misbehaves on its own (AI rebuilds when desperate, complacent when cruising; squads renew so March still matters).

---

## 7. Licensing guardrails (structural, not advisory)

Four identity kinds (`IdentityKind`): FICTIONAL / COMMUNITY / LICENSED / GENERIC. Base content ships
FICTIONAL-only. Rights metadata carries region/expiry gating; every licensed entity declares a
`fallbackId` pointing at a fictional equivalent and degrades whole-entity. Game logic never branches
on names. Any hand-made art asset must keep its procedural path working (nothing load-bearing may
404). Filenames pass a legal denylist CI check.

---

## 8. How to work here (agent workflow)

1. Read this file + `docs/INTEGRATION_CONTRACT.md`. Find your workstream; stay in your paths.
2. Plan: state intent, files touched, and how you'll verify — before editing.
3. TDD where it pays: engine behaviour changes get a failing test first (`*.test.ts` beside code).
4. Implement following the fourteen laws; match existing file conventions; comments explain why.
5. Verify before claiming done: `pnpm typecheck && pnpm test && pnpm lint` clean; run
   `pnpm audit:all` for balance-touching changes; screenshot UI changes rather than asserting they look right.
6. Never commit secrets; conventional commit messages; leave work committed only when asked.
7. When you change balance-affecting numbers, expect the headless audits to catch drift — read their output, don't tune tests to silence them.
8. Update this file's §6 when reality moves (shipped fixes, new blockers, new audit results).

### Tone
Be direct and evidence-based. Cite `file:line` for claims. Prefer small focused diffs. Do not add
speculative abstraction; do not simplify away deliberate tension. When something is genuinely good,
say so and protect it.
