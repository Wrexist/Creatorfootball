# Remaining Risks

Open risks after the hardening pass, ordered by expected damage. Each entry says
what could actually go wrong, not just what is imperfect.

## 1. Entity ids are not unique across careers (medium, partially mitigated)

The season id is the literal string `season_1` for every new game, so fixture
ids and match ids repeat between saves. This already caused one silent
progression bug (see PRODUCTION_READINESS_AUDIT §3), which is fixed — but the
*root cause* is untouched, and the fix is local to match commits.

Anything else that caches, dedupes, or keys by entity id across a save boundary
will hit the same trap: analytics keyed by match id, a future cloud save, a
share/replay link, crash-report grouping.

**Recommended next step:** derive the season id from the save id (or seed) so
ids are globally unique, and delete this class of bug rather than defending
against it one call site at a time. `matchCommitGuard.test.ts` asserts the
collision today, so it will fail loudly and correctly when this is fixed —
update that test as part of the change.

## 2. The engine loads as one 273 kB gzip chunk on first visit (medium)

First-visit cost on a mobile network, behind the splash. Cached afterwards.
Splitting the content packs out requires breaking a module-scope cycle between
engine modules and content data; a previous attempt shipped a page that died on
load. Full detail and the prerequisite in PERFORMANCE_NOTES.

## 3. RESOLVED — concurrent `apply()` writes

Listed last pass as raised by the move to IndexedDB. Now fixed, and the
underlying bug turned out to be worse than the one predicted.

The predicted risk — overlapping writes landing out of order — was **not**
reproducible. What was reproducible, immediately, was different: abandoning a
career could be undone by a save already in flight. The delete ran, the app
showed "no save", and the next boot loaded the career the player had just
deleted.

All writes now go through a single-slot queue (`apps/game/src/state/saveQueue.ts`)
that serialises them, coalesces a backlog down to the newest state, and lets
`abandon()` drop queued writes and wait for the in-flight one before deleting.
Covered by 12 tests, one of which fails against the previous code.

## 4. Snapshot-compute-apply in the feature engines (low)

Several actions read `store.state` into a local `s`, compute from it, then write
the result onto whatever `current` is inside `apply()`. If those ever diverge,
freshly computed data is written onto a different base state — `orderScoutReport`
writing a ledger snapshot derived from `s.ledger` is the clearest example.

Today every one of these paths is fully synchronous, so `s === current` always
holds and no bug is reachable. It is listed because the invariant is implicit
and one `await` anywhere in these functions would break it silently.

## 5. IndexedDB has failure modes localStorage did not (medium)

The move to IndexedDB fixed the save ceiling and introduced a different set of
edges, all handled but none yet seen on a real device:

- An `open` that is *blocked* by another tab never settles on its own. This is
  rejected explicitly, because without that the boot hangs behind a promise
  that never resolves and presents as a splash screen that never leaves.
- An open that succeeds and a transaction that then aborts is a real
  combination in private browsing, so the layer probes with a real write and
  delete before committing to IndexedDB.
- Writes resolve on transaction commit, not request success, so quota failures
  surface where they can be handled.

The localStorage→IndexedDB migration is covered by a real-browser check in
`pnpm test:smoke`. What is **not** covered is the multi-tab case and Safari's
storage eviction under pressure. Both need a real device.

## 6. Save-format guarantees that are weaker than they look (low, by design)

- The checksum is FNV-1a. It catches truncation and casual hand-editing. It is
  **not** tamper-proof and must never be treated as an anti-cheat control if
  leaderboards or any server-trusted progression are added.
- `validateState` checks structure and the single most damaging corruption
  (a player owned by two clubs). It does not verify economic consistency — a
  save with an impossible balance that is structurally intact will load.
- Migrations are forward-only and untested against *real* old saves; they are
  tested against synthetic states stripped of newer fields. That is a good
  proxy, not the real thing. Keep a corpus of genuine saves from each shipped
  version once the game is in players' hands.

## 7. Live match state can outlive its screen (low)

Leaving a live match unmounts the screen but deliberately does not `reset()` —
the result screen reads the finished result off the store. Consequently,
navigating away mid-match and back re-creates the simulator and restarts from
minute 0. The match RNG is seeded deterministically, so this is not a re-roll
exploit in the usual sense, but a player who dislikes how a match is going can
replay it with different in-match decisions.

Whether that matters is a design call, not a bug. Flagging it so it is a
decision rather than an accident.

## 8. The browser smoke test is the only guard on the built artefact (low)

It covers five things: boot without runtime errors, content renders, no control
covered by other chrome, no overflow at 375 px, and every primary route
navigates. That is a well-chosen set and it caught two real shipped bugs. It is
still five checks against a whole product, and it does not play a match, save,
reload, or exercise the recovery paths in a real browser.

**Partly addressed.** A sixth check now drives the real localStorage →
IndexedDB migration in a browser. Still missing is the full loop: create a
career, play a match, reload, assert the world survived. That remains the
single most valuable test this repository does not have.

## 9. `pnpm test` can exit non-zero on a fully green run (tooling, pre-existing)

On a slow or loaded machine the engine suite finishes with all 767 tests
passing and then fails the process:

```
Error: [vitest-worker]: Timeout calling "onTaskUpdate"
Test Files  59 passed (59)
Tests  767 passed (767)
Errors  1 error
```

This is Vitest's reporter RPC timing out, not a test failing. It appeared when
this sandbox got slower — the same suite took ~150 s in earlier sessions and
~232 s now — and **it reproduces at `HEAD` with no local changes**, so it is
neither new nor caused by the save-queue work. It has not been seen on a
machine running the suite at its normal speed.

It is left alone deliberately. The obvious workarounds — reducing worker
concurrency, or a quieter reporter — would slow the suite everywhere to
accommodate one slow container, and cannot be validated against the project's
real CI from here.

**Recommended next step:** if this appears in real CI, prefer shortening the
suite over throttling it. `PERFORMANCE_NOTES.md` names the lever: shard the
long headless-season tests, which account for most of the 203 s of test time.

## 10. Environment: pinned Chromium mismatch (tooling, not product)

The sandbox provides Chromium build 1194; Playwright 1.62 expects 1234. The
smoke test fails to launch unless `CHROMIUM_PATH` is set:

```
CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome pnpm test:smoke
```

The escape hatch already existed and works. Worth wiring into CI configuration
so it is not rediscovered each time.

## Documentation overlap (housekeeping)

`docs/` carries several earlier audit and planning documents —
`CURRENT_STATE_AUDIT.md`, `FINAL_AUDIT.md`, `AUDIT_ARCHITECTURE.md`,
`AUDIT_GAMEPLAY.md`, `AUDIT_UX.md`, `ARCHITECTURE.md`, `IMPLEMENTATION_PLAN.md`
— that overlap with the four documents added in this pass and were written
against earlier states of the code.

They were **not** deleted here: they are the project's history, some are
published via GitHub Pages, and removing another author's documents on
inference is not this pass's call. Before trusting any of them, check the claim
against the code. `CURRENT_ARCHITECTURE.md` is the one written from the current
source.
