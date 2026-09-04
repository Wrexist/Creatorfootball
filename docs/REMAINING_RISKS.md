# Remaining Risks

Open risks after the hardening pass, ordered by expected damage. Each entry says
what could actually go wrong, not just what is imperfect.

## 1. RESOLVED — entity ids now scoped to the career that created them

Entity ids used to be identical in every save ever created: clubs were
`club_0`..`club_11`, the first season was literally `season_1`, and fixture and
match ids derived from those. Two careers shared their ids exactly, which had
already cost one silent bug.

`createNewGame` now derives a six-character token from the seed and the
creation time and scopes the ids it creates with it — `mwru75_club_0`,
`mwru75_season_1`, `fx_mwru75_season_1_0`. Determinism is untouched: the token
is a pure function of `createNewGame`'s inputs, so the same seed and time still
produce a byte-identical world, and a test asserts it.

Measured cost: **+144 kB on a ten-season save (+4.7%)**, most of it the club
prefix repeated on every ledger account. Worth it now that careers live in
IndexedDB rather than against a 5 MB ceiling.

**Existing careers keep the ids they have.** Rewriting every club, fixture and
ledger reference inside a live save would be far riskier than the collision
warrants, so the v6→v7 migration only gives an old save a token — taken from
its own save id — for the ids it creates from that point on. Two *pre-existing*
careers with different seeds therefore stop sharing season ids going forward,
but their existing clubs and fixtures still collide with each other's. Anything
that keys across saves should treat pre-v7 careers as unreliable.

## 2. RESOLVED — the content pack is its own lazy chunk

The engine chunk is 205 kB gzip (was 282) and the 77 kB content chunk is
fetched once, on intent, by one loader (`apps/game/src/state/content.ts`).
See CURRENT_STATE §4b.

**What actually caused the old cycle** was simpler than the analysis below
believed: the *engine* imported the packs — `newGame.ts` and `cycle.ts` read
`BASE_PACK`, the generators read the base name bank and facility ids as
fallbacks, and the engine barrel re-exported all of it. Once those edges were
removed, the pack's own value imports of engine leaves (listed below) are a
one-way content → engine dependency, which a bundler orders without trouble.
The six-leaf recipe was not needed. The failure paths are now proven in a
real browser (`e2e/failure.mjs`, run by `pnpm test:smoke`): the club step
failing and recovering, founding a club with no universe, rapid retries,
a late arrival, and a returning player whose universe fails at boot. What
that run found and fixed: Chromium remembers a failed module fetch, so a
retry has to import the chunk under a fresh query string. The remaining
risk is Safari: it names no URL in its module-load error, so a retry there
depends on the bundler's preload link being present (it is, in every Vite
build, but the polyfilled path on older WebKit is unverified without a
device). A retry that can find no URL falls back to the plain specifier,
which is enough in a browser that does not cache failures and is not known
to be enough in Safari. Real-device work should try airplane mode on the
club step and on a cold boot with a save. The recovery UX itself — focus
after a retry, the busy retry button, the persistent inline notice on the
founding form, and the repeated-failure loop with its keyed alerts and single
status line — is browser-proven in Chromium. VoiceOver's actual reading of a
remounted alert, of the polite status line and of focus moving to the first
club is a device check.

*The earlier analysis, kept for the record:*

**The cycle is now precisely characterised, and it is not what the note in
`vite.config.ts` implies.** There is no module cycle: nothing under `content/`
imports `game/` or `simulation/`, so the module graph is a DAG. What broke the
earlier attempt was a *chunk* cycle. The base pack imports six engine leaf
modules as **values at module scope** — `CREATOR_TIERS` and
`CREATOR_ATTRIBUTE_KEYS` (`creators/creator`), `OUTLETS`/`OUTLET_MERGES`/
`outletByName` (`media/balance`), `FALLBACK_MEDIA_TEMPLATES`,
`FALLBACK_SOCIAL_TEMPLATES`, `MATCH_EVENT_TYPES`, `MENTAL_KEYS` — so a chunk
holding only `content/packs` depends on the engine chunk, while the engine
chunk depends on it. Rollup hoists such cycles and the pack constants evaluate
before the leaves they read: the temporal-dead-zone error on load.

**The recipe:** put `content/packs/**` *and* those six leaf modules, plus
`content/schema`, `core/brand` and `licensing/identity` (their only upstream
imports, all type-level), into one `content` chunk. That set is ~59 kB of
source and has no runtime edge back into the engine chunk, so no cycle.
`pnpm test:smoke` boots the real bundle and would catch a regression.

**The caveat, which is why it was not done here:** a static split only loads
two files in parallel; the bytes are identical and still arrive before first
paint. The real win — deferring the pack until a career is created — needs
`createNewGame` and the content registry to load it through a dynamic
`import()`, which makes them asynchronous and changes the engine's public API.
That is a deliberate design change, not a chunk-config tweak.

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
`pnpm test:smoke`. The connection now honours `versionchange` — it closes and
forgets its handle so a newer build in another tab can upgrade the schema
instead of being blocked into a localStorage fallback — and a browser check
opens a second page on the same career and requires it to see the first page's
change. What is **not** covered is Safari's storage eviction under pressure,
which needs a real device.

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

## 8. Browser coverage of the built artefact (low — improved)

Seven checks now run against the real bundle: boot without runtime errors,
content renders, no control covered by other chrome, no overflow at 375 px,
every primary route navigates, the localStorage→IndexedDB migration, and — new
— a real career loading out of IndexedDB, taking a change made through the
interface, and surviving a page reload. That last one was previously listed
here as "the single most valuable test this repository does not have". It was
verified to fail when persistence is disabled, so it is not passing vacuously.

The career it loads is built by the engine rather than by clicking through the
three creation screens. That is deliberate — driving those would make the test
a hostage to their layout while proving nothing extra about persistence — but
it does mean **onboarding itself is still not covered by any browser test**.
A regression that breaks career creation would be caught only by a human.

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

**Addressed.** The starvation mechanism is a worker blocked in synchronous
simulation for tens of seconds. The balance suite already yielded to the event
loop every hundred simulations for exactly this reason; `test/season.test.ts`
— twenty-two cycles per season, sixty-six in the multi-season test — never
yielded at all. It now yields every four cycles, and the balance suite every
twenty-five simulations. Assertions, seeds and ordering are unchanged, and the
suites take the same time. Not observed since. A controlled load reproduction
was attempted three times and each was killed by the tool harness the moment a
CPU-burner child was spawned, so this rests on the documented mechanism and on
the natural before/after observation rather than on an A/B.

## 10. Environment: pinned Chromium mismatch (tooling, not product)

The sandbox provides Chromium build 1194; Playwright 1.62 expects 1234. The
smoke test fails to launch unless `CHROMIUM_PATH` is set:

```
CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome pnpm test:smoke
```

The escape hatch already existed and works. Worth wiring into CI configuration
so it is not rediscovered each time.

## 11. Every AI bench now adapts, including in matches the player is not in (low, by design)

`MatchConfig.adaptation` defaults on, so the league's AI-versus-AI fixtures
are played by two benches that read each other with the same rule the player
faces. That is the honest choice — the player's opponents should not be the
only ones who think — and the balance and invariant audits pass with it on
(the balance audit itself runs with it off, so a setup is measured alone).
Two residual points. First, the underlying results distribution of the league
moved by whatever the adaptation is worth, which the aggregate tests bound but
do not describe; if the league table ever looks flatter or steeper than the
reference data, this is the first knob to A/B by flipping the flag. Second,
the read is of the shape a side *plays in*, not the routes its attacks take:
the routes were measured and found to be dice at this simulation's tactic
weights. A future balance pass that makes width or directness express more
strongly in play would let the observable move to what the ball actually did,
and `adaptation.ts` is written so only `sampleOf` and the sample type change.

## 12. Matchday on a device (hardware blocked)

The substitution sheet and the live pitch are proven in desktop Chromium
(`e2e/matchday.mjs`): a goalkeeper change with the keeper recommended first,
the count from the engine, one change from a double tap, shirts travelling
at under 0.02 of the pitch per frame, the ball within reach of a shirt, a
clean pause and resume. What that cannot say: how the sheet scrolls under a
thumb, whether 60 fps holds on an older iPhone with the follow camera and
the trail, memory over a full match, and whether Safari's rAF timing gives
the motion model the steady intervals it measures.

**The bench is no longer squad order.** This entry used to end by deferring
that: every club was created with an empty `tactics.bench` and the simulator
filled it from squad order, and fixing it would move simulated results. It is
done — `selectMatchdayBench` is now the one selector for the suggestion, the
preview and the simulator (CURRENT_STATE §4c). The balance move was measured
both ways: world generation is byte-identical, the three reference `after3`
hashes changed, and pinning the old benches into the new engine reproduces the
old results hash exactly, so the difference is bench composition alone. That is now measured
(CURRENT_STATE §4c, `docs/experiments/bench-tuning/`): both constants are
justified, the selector does not disproportionately reward strong clubs, depth
pays without running away, and versatility is not an exploit.

**The ground under that measurement has since moved, deliberately.** AI clubs
now choose their own shape, so the bench experiment was re-run against the new
world. The headline holds — the current values are still the healthy ones, 0.80
is still worse for weak clubs, and the lean's magnitude is still inert — but two
of its supporting facts have expired. The cover threshold's lower direction was
a no-op when every club played 2-3-1 (0 of 5,280 matches); it now changes 48.4%
of matches and 20.7% of winners, and at 0.60 the league measures a shade flatter
than at 0.70 (points sd 11.69 vs 11.82, weakest third 1.010 vs 1.001 points per
game). That difference is small and inside the noise a single-season sample can
resolve, so nothing was changed on it — but `COVER_THRESHOLD` has gone from a
settled constant to a live one and deserves a dedicated re-validation with more
seasons per world before anyone calls it final. The tactical lean moved the same
way in the opposite direction: from 1.6% of matches to 14.8%, which strengthens
rather than weakens the case for keeping it.

**The frozen-formation half of this is now done.** Clubs reassess their shape
once a season (CURRENT_STATE §4c, `docs/experiments/formation-evolution/`),
measured over 12 worlds x 8 seasons: three quarters of clubs never change, no
club in 144 careers ever reverted to a shape it had left, and competitive
balance is unchanged from the frozen world. What that measurement also exposed
is listed below.

**MEASURED, NOT RETUNED — `COVER_THRESHOLD`.** Still live rather than settled,
for the reason recorded above. The evolution experiment did not vary it and this
phase deliberately did not touch it; it still wants a dedicated re-validation
with more seasons per world.

**MEASURED, NOT CHANGED — players never change position.** Nothing in the engine
retrains a player: over two simulated seasons, 0 of 193 surviving players changed
`position` or `secondaryPositions`, while 146 of them moved in `overall` (by up
to 4 points) through `worldTick`'s weekly development. So a club's *positional*
makeup — the thing formation suitability actually reads — moves only through who
joins and who leaves, never through who a player becomes. That is a coherent
world model, not a bug, but it bounds tactical evolution: a club can never grow
into a new shape from within. If positional retraining is ever added, the
evolution experiment must be re-run, because drift would then have a second
source.

Two things remain unmeasured. Both the bench and the formation-identity
experiments run one season per world, so their multi-season compounding is still
out of scope even though the evolution experiment now runs eight. And a club's
shape is reassessed only at rollover: a squad gutted mid-season by a January
window plays on in a shape it may no longer suit until the summer. That is a
deliberate stability choice, not an oversight — one controlled reassessment a
season is what keeps the league from churning — but it is the obvious place to
look if mid-season rebuilds ever feel unresponsive.

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
