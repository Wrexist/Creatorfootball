# Current State

**The single authoritative status document for Creator Football.**

Where any other document in `docs/` disagrees with this one, this one is
correct. Every number below was produced by running the command named beside
it, on the commit that introduced this file. Nothing is estimated.

---

## 1. Verification, measured

| Gate | Command | Result |
|---|---|---|
| Types | `pnpm typecheck` | pass (engine, app, sim) |
| Lint | `pnpm lint` | pass, `--max-warnings=0` |
| Engine tests | `pnpm --filter @cf/engine test` | **66 files, 849 tests, all passing** |
| App tests | `pnpm --filter @cf/game test` | **30 files, 302 tests, all passing** |
| **Total** | `pnpm test` | **1,101 tests, all passing** |
| Production build | `pnpm build` | pass |
| Browser smoke | `pnpm test:smoke` | **10/10** happy path + **8/8** content-failure journeys + **9/9** repeated-failure recovery checks + **5/5** matchday checks (live motion, pause, resume, goalkeeper substitution), against the real bundle |
| Balance audits | `pnpm audit:all` | economy, simulation, 9 invariants — all pass |

Earlier documents state 262, 531, 653 and 753 tests. All are historical.
`pnpm test` is the only source of truth.

**Tooling note.** Earlier in this cycle `pnpm test` could exit non-zero on a
loaded machine after every test passed, with `[vitest-worker]: Timeout calling
"onTaskUpdate"` — the reporter's RPC starved by a worker blocked in tens of
seconds of synchronous simulation. The one heavy suite that never yielded
(`test/season.test.ts`) now yields between cycles, the same remedy the balance
suite already used; the balance suite yields four times as often. Assertions,
seeds and ordering are unchanged. Not observed since; see `REMAINING_RISKS.md` §9.

**Environment note.** This sandbox ships Chromium build 1194 while Playwright
1.62 expects 1234, so the smoke test needs its existing escape hatch:

```
CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome pnpm test:smoke
```

---

## 2. Architecture

Unchanged in shape and still sound. Full detail in `CURRENT_ARCHITECTURE.md`.

- `packages/engine` (`@cf/engine`) — every game rule, headless, no DOM. One
  public entry point.
- `apps/game` (`@cf/game`) — React 19 + Vite 7 + Tailwind 4, Capacitor iOS shell.
- `tools/sim` (`@cf/sim`) — headless balance and invariant harness running the
  same engine the player runs.

The rule that holds it together — **no game rule lives in a component** — still
holds in the current code.

**Determinism** is enforced by tests: seeded RNG, counter-derived ids, and an
audit that catches two subsystems accidentally sharing a random stream.

---

## 3. Persistence — changed

Careers now live in **IndexedDB**, not localStorage.

This was a measured P0. A career's save does *not* grow without bound — it
plateaus — but it plateaus too high for localStorage:

| Seasons played | Save size |
|---|---|
| 1 | 1.1 MB |
| 5 | 2.5 MB |
| 10 | 3.0 MB |
| 20 | 3.2 MB (plateau) |

The save layer deliberately keeps a backup copy, so a mature career needs
~6.3 MB against a ~5 MB localStorage budget. **Careers were failing to save
from roughly their fifth season.**

Composition at the plateau: ledger 41%, players 33% (mostly the 12-season
career history that the history screens exist to show), event log 5%.

Trimming was measured and **rejected**: cutting ledger retention to the edge of
usefulness still lands near 4.7 MB of a 5 MB budget. That is a later failure,
not a fix, and it costs the player financial history. IndexedDB's quota is in
the hundreds of megabytes.

`apps/game/src/platform/storage.ts` now layers IndexedDB over the existing
localStorage adapter over an in-memory fallback, resolving once behind the
first read.

Every write goes through a single-slot queue (`state/saveQueue.ts`): writes are
serialised, a backlog coalesces down to the newest state, and abandoning a
career drops queued writes and waits for the in-flight one before deleting.
Without it, abandoning a career could be undone by a save already on its way —
the delete ran, the app showed "no save", and the next boot loaded the career
the player had just deleted. An existing localStorage career is copied across on first boot,
verified, and only then removed to reclaim the space. If any step fails the
originals are left untouched and the next boot retries. This is covered by a
real-browser check in `pnpm test:smoke`.

Save format: `SAVE_VERSION` is **7**, with a registered migration for every
step from 1 and a test asserting the chain has no holes. Writes are validated
before they replace a good save, the previous save is promoted to a backup, and
adapter failures are returned rather than thrown.

---

## 4. Opponent AI — changed

The opponent now counters **what it has seen you do**, not what is in your
tactics screen.

The previous implementation read `playerClub.tactics` directly at match setup.
Its own comment described the intended design — "the shape the player has been
playing all month" — but the code implemented omniscience: it knew a tactical
change before a ball had been kicked with it, and knew nothing about what the
player had actually been doing.

`packages/engine/src/simulation/opponentModel.ts` replaces it:

- One observation is filed per match the player actually plays (shape,
  attacking focus, formation). The window holds 6 and is bounded.
- A tendency must be what the player does **more often than not** — a bare
  plurality is not a habit, so mixing your approach up is a real
  counter-strategy.
- Confidence is agreement damped by how few observations exist, and a club acts
  only above a threshold that scales with its **manager's adaptability**. A
  sharp opponent reads you weeks before a poor one.
- A first meeting is played blind. Nothing is ever countered that has not been
  seen.
- Two independent dimensions — shape and repeated attacking flank — so the
  counter is not a single rock-paper-scissors throw.

**It is surfaced.** The match preview shows a "they have done their homework"
briefing naming what was noticed and what they will do about it, generated from
the same call that produces their tactics, so the briefing can never describe a
different plan from the one that walks out. A silent counter reads as the game
cheating; a stated one is a decision.

---

**And it closes the loop after the match.** The same decision that produces the
pre-match briefing also produces a past-tense recap — *"They came in having
watched you sit deep, and pressed high to pull that block apart"* — captured at
kick-off (before the cycle files a new observation) and shown on the result
screen. Preview and result can never describe different opponents.

**And it now happens during the match.** `packages/engine/src/matches/adaptation.ts`
takes the same read inside a match: every attack the player's side makes files
one observation — the shape and the attacking focus it was played in — into a
bounded window of the last 8, and the opposing bench acts on it with the same
majority rule, the same adaptability threshold and the same `counterPlan` the
pre-match model uses. There is one system, not two.

- **Observe.** An attack is filed where it ends, on the SHOT, and the event is
  stamped with the same value, so the replay shows exactly what the bench saw.
- **Identify.** At least 5 attacks; a real majority of the window in one
  shape or down one flank; confidence above the manager's threshold. A blunt
  manager needs the full window, a sharp one moves at the minimum.
- **Decide.** Shape first, focus only if the shape gave nothing. One dimension
  per adaptation. A side already set up to counter what it sees does nothing.
  The decision is a pure function that cannot be told the score: the type has
  no field for it (`@ts-expect-error` in the test proves the compiler refuses).
- **Adapt.** Max one adaptation per side per half, and none in a half in which
  the side has already changed shape (its scripted trailing response counts).
  A change the player makes is invisible until it has been played: the record
  keeps saying what the side *was* doing until attacks in the new shape out-vote
  it, so a just-changed tactic is never countered.
- **Told in football.** The live feed uses tagged commentary chosen exclusively
  for the change ("{club} sit off and go long. They've worked out where the
  space is."); the result screen's recap heading becomes "How they solved you"
  and adds the past-tense sentence. The word "adaptation" never appears.

The emergent routes an attack takes (cross, ball in behind, counter) were
measured first and rejected as the observable: tactics move them by a few
percent, dice move them by far more, and a majority appeared as often against
a narrow side as a wide one. Reading dice and calling it a read would be the
game cheating in the other direction.

## 4a. Entity ids — changed

Ids used to be identical in every save ever created: clubs `club_0`..`club_11`,
the first season literally `season_1`, fixtures and matches derived from those.
Two careers shared their ids exactly, which had already caused one silent bug.

`createNewGame` now derives a six-character token from the seed and creation
time and scopes what it creates: `mwru75_club_0`, `mwru75_season_1`,
`fx_mwru75_season_1_0`. Determinism is untouched — the token is a pure function
of the inputs, and a test asserts two runs stay byte-identical. Measured cost:
+144 kB on a ten-season save (+4.7%), affordable now careers are in IndexedDB.

The v6→v7 migration gives an existing career a token for ids it creates from
now on and leaves the ids it already holds alone.

## 4b. Content loading — changed

The base content pack is now a lazy chunk, and the player cannot tell.

Before, `BASE_PACK` was imported at module scope by the engine itself —
`newGame.ts` built a registry from it on every call, `cycle.ts` kept a module
cache of it, the generators used its name bank as a fallback, and the engine's
barrel re-exported it — so the pack lived inside the engine chunk and every
first visit downloaded 388 kB of fiction before the title screen. The earlier
attempt to split it died on load because of exactly those edges.

Now:

- **The engine never imports a pack.** `createNewGame` and `advanceCycle`
  take a `ContentRegistry`; the generators take a name bank and facility list.
  The engine's barrel exports no pack constants. A boundary test
  (`contentBoundary.test.ts`) fails on the first import that comes back.
- **One loader owns the lifecycle** — `apps/game/src/state/content.ts`:
  REQUEST → LOAD (one dynamic `import()`) → VALIDATE (the registry, same rules
  as any pack) → CACHE → READY. Concurrent callers share the in-flight
  promise; later callers share the registry; the promise never resolves with
  a partial registry; a failure drops the in-flight promise so the next call
  retries. Status (`IDLE`/`LOADING`/`READY`/`FAILED`) is subscribable.
- **Intent is the prefetch signal.** "Start your career" starts the load; the
  manager step (which needs nothing) makes sure it started; the club step
  renders immediately with its header, both paths and the whole club designer,
  and fills the takeover list in when the universe arrives — three card-shaped
  skeletons under "Preparing your league" until then, an inline "try again" if
  it never does. Confirming waits inside the existing "building the league"
  beat. Nothing says chunk, module or loading.
- **Nothing is created early.** `startNewGame` awaits the content, then
  builds, then saves, then says READY. A failure returns the phase to where
  it was with a message in the player's language. If a second creation is
  asked for while the first waits, the first stands down: only the latest
  request builds and saves. Booting a saved career waits for the content too;
  a content failure there is reported as such, offers "try again", and never
  offers to delete the save.
- **Determinism is untouched.** The same registry produces byte-identical
  worlds however it arrived; the three reference world hashes are unchanged
  by this refactor.

**When the universe does not arrive.** A browser remembers a module fetch
that failed and rejects the next `import()` of the same URL without touching
the network (Chromium does; measured, not assumed), which would have made
every "Try again" a lie. So a retry imports the chunk under a fresh query
string, with the URL taken from the preload link the bundler's helper leaves
in the document, or from the browser's error message; a browser that offers
neither falls back to the plain specifier. The loader passes the attempt
number and the previous failure to its importer and nothing else changed.
The failure journeys are proven in a real browser by `e2e/failure.mjs`, run
by `pnpm test:smoke` after the smoke suite: the club step failing and
recovering on retry, founding a club with no universe (nothing created,
nothing saved, choices kept), rapid retries sharing one request, a held
request resolving after the player has moved on, and a returning player
whose universe fails at boot (save untouched, no "start over" offered, retry
lands in the career). Failure is simulated by intercepting the chunk's
request — no app code knows it is being tested.

**Recovery is designed, not merely functional.** On the club step, "Try
again" keeps its block on screen with the button busy and the text reading
"Preparing your league…", so nothing jumps and nothing can be pressed twice;
when the clubs arrive, focus moves to the first of them — the first thing the
player can now do. A prefetch arriving on its own never moves focus. A failed
confirmation on the founding path returns the form exactly as it was with a
persistent inline notice above the button — "Your club could not be created.
Nothing was saved and everything you entered is still here." — that takes
focus, stays until the player acts, and is gone on the next attempt; it is no
longer a toast that left before it could be read. Both are asserted in the
browser suite: where focus is at failure, during the retry and after it, that
the notice survives longer than a toast would, and that the typed club name
survives the failure.

**And it holds when the network fails more than once.** Every failure is
a new event: the club step's alert and the recovery screen's alert are keyed
on the loader's failure count, so a second or tenth failure is a fresh
`role="alert"` element (a new announcement) rather than the first one with its
words changed; the founding notice already remounts per attempt. Progress and
recovery go through one polite `role="status"` line per screen that stays in
the tree — "Preparing your league…" while a retry runs, "Your league is
ready." when the player's own retry brought the clubs — so a screen reader
hears each change once and never a chorus. Focus is held by the block the
player acted on through the retry and through another failure, moves to the
first club only after an explicit retry succeeds, and stays put when content
arrives on its own. A boot retried from the recovery screen keeps that screen
up and busy instead of swapping in the splash. `e2e/recovery.mjs` proves the
loop in Chromium — fail, retry, fail again, retry, recover — for the club
step, the founding form (name and city survive, no save, one club at the
end) and a returning player (save byte-identical throughout), by keyboard
alone as well as by touch, and checks that rapid retries produce one
request, one alert, one status and one focus destination.

Measured on the built bundle (desktop headless Chromium, medians of three):
first screen 1738 → 1507 kB of script (−13%), engine chunk 282 → 205 kB
gzip, content chunk 77 kB gzip requested exactly once, confirm-to-playable
2390 → 2373 ms, journey bytes unchanged (no duplication).

## 4c. Matchday — changed

**The goalkeeper substitution bug, and what was actually wrong.** A player
was shown "5 changes left", took their keeper off, tapped the keeper on the
bench and was told the change was not allowed and to check their remaining
substitutions. Three defects, none of them the count: every club is created
with an empty `tactics.bench`, so the simulator quietly picked its own seven
(see *Who is on the bench* below); the sheet listed the *whole squad* minus the eleven as
"the bench", so four of the names it offered were never on the match bench;
and `makeSubstitution` returned a bare `false`, which the sheet dressed as a
substitutions problem. Two more surfaced on the way: the remaining count was
a React counter that ignored the substitutions the engine made by itself
(it made fatigue changes for the human's side too), and a change made from
the sheet was filed into the record but never handed to the live feed,
because `step()` only returned events from inside its own tick.

Now: the simulator answers `checkSubstitution` with a verdict and a reason
(`NO_SUBS_LEFT`, `NOT_ON_PITCH`, `NOT_ON_BENCH`, `ALREADY_USED`, `SENT_OFF`,
`INJURED`, `SAME_PLAYER`) in the order a manager thinks — the man coming
off, the man coming on, and only then the count — and exposes
`substitutionStatus` (used, allowed, remaining, the match-day bench with each
seat's availability). The store reads it every tick; the sheet lists that
bench and no other; the count in the rail is the engine's; every refusal is
its own sentence. In a live match the engine no longer spends a human
manager's changes on tired legs (injury replacements are still made, and a
fixture nobody is watching is still managed on both benches, so simulated
worlds are byte-identical). `step()` returns everything since the last step.

**Who is on the bench.** The seven names were chosen three different ways.
`autoLineup` had a cover-based pick, but it only ran when a club's sheet was
*incomplete*; a sheet that named an eleven and no substitutes fell through to
the simulator, which filled the seats from squad order — on a real squad that
is seven midfielders and no reserve keeper; and the match preview showed the
seven highest-rated reserves, which across 72 measured benches was never once
the bench the simulator played with (4/72 even as an unordered set).

There is now one selector, `selectMatchdayBench` in `tactics/formations.ts`,
called by the team-sheet suggestion, the match preview and the simulator. It
is pure, synchronous and takes the *starting eleven* as an input, because what
a bench has to insure depends on the side in front of it. Seats go: one
reserve goalkeeper, and only ever one, and only a real keeper (a squad with no
second keeper does not lose the seat to whichever outfielder is least bad in
goal); then one option for each line, most exposed first, and only somebody
who can genuinely play there; then the remaining seats to the line with the
most starters still uncovered; then, once every starter has an answer, the
best man left. Quality, position familiarity and readiness all enter through
`selectionFit`, the same score that picks the eleven — there is no second
position model and no second fitness model. Ties break on player id. **A bench
the manager named himself is played exactly as named**, in his order, capped
only by the competition's bench size: nothing is topped up or reordered.

The preview lists each seat with a football reason under the name
(*Goalkeeper cover*, *Defensive cover*, *Midfield cover*, *Attacking option*)
and never a score. A bench the manager picked shows no reasons, because the
reason is that he picked them.

This changed simulated results, which was expected and was measured rather
than assumed. World *generation* is byte-identical (the `new=` reference
hashes are unchanged, so existing saves load the same); three seeds played
three weeks now hash differently. Feeding the old benches back into the new
engine reproduces the old results hash exactly (`ae00e57f857ab3ec`), so every
changed scoreline comes from bench composition and nothing else. The new
system is identical on repeat. Across the same 72 benches, line cover now
mirrors the shape being played rather than the formation in the abstract:
defensive options 3.33 → 2.81 per bench, midfield 5.22 → 5.31, attacking
1.75 → 1.44, against a 2-3-1 starting two, three and one. Every bench in both
runs answers all four lines; the win is that the selector now runs on every
club on every matchday, and that the preview and the pitch agree.

**A club's shape now outlives its squad, but not by a decade.** Formation was
chosen once, when the world was made, and then frozen for the life of the save
while the squad underneath it moved. Measured over eight seasons: a club turns
over 11-23% of its squad a year through retirement, academy graduates and the
positions its recruitment profile favours, and a frozen shape ends **3.5%
behind** the shape its squad should now be playing, the worst tenth 7.5% adrift,
with starters played out of position rising to 0.78 per club.

`reviewFormation` reconsiders once a season, at the one moment in the calendar
when the squad for the coming year is settled — after retirements and academy
promotions, and after the rollover has already put everyone back to full fitness
with injuries and suspensions cleared. The current shape is the default and has
to be *beaten*, not matched: only when it has fallen more than 8% behind the
best available does `selectFormation` — the same selector that chose at
generation — pick the replacement. The player's club is never touched.

The decision is provably blind to how the season went. Fitness, injuries and
suspensions are already reset by that point, and form — the one remaining
channel by which results reach `selectionFit` — is zeroed inside the review. A
club does not change shape because it lost; it changes because it is a different
team.

Measured over 12 worlds × 8 seasons × 5 settings, 144 club careers each
(`docs/experiments/formation-evolution/`). Reassessing greedily — taking the
best shape every summer — moves 79% of clubs two or more times, flips 31% of
them back and forth between the same two shapes, and is the only setting that
damages the league: the weakest third fall to 0.984 points per game against
1.064 frozen, and the strong-weak gap widens from 0.681 to 0.791. At 0.12 the
rule is inert (95% never change, 3.48% adrift — the frozen world with extra
steps). At **0.08**: three quarters of clubs never change shape at all, 2%
change more than once in eight seasons, and **no club in 144 careers ever
reverted to a shape it had left**. Drift halves (3.54% → 2.50%), out-of-position
starters fall from 0.78 to 0.64, competitive balance is exactly where the frozen
world had it (strong-weak gap 0.681, unchanged), and shapes fit club identity
better than in any other setting including frozen (37.5% against 36.1%). 0.06
was the other serious candidate and loses narrowly: it reverts a club
occasionally rather than never, moves twice as many, widens the strong-weak gap
to 0.726 and *lowers* shape diversity, because a lower bar funnels clubs toward
the same handful of best-fitting shapes.

Cost: **2.90 ms** to reassess a whole twelve-club league — 241 µs per club, for
ten shapes each — against a season rollover that costs about 215 ms, once a
year. That is measured directly; the rollover wall-clock in the experiment
varies by more between repeat runs (209-217 ms for the frozen candidate alone)
than the feature costs, so the per-candidate rollover timings in `results.json`
are noise and should not be read as a cost. No reference hash moved — the
pinned worlds cover generation and week-two matches, and a rollover fires after
week 22.

**Every club plays its own shape.** Twelve clubs with eight distinct
philosophies — low blocks and high presses, cautious and reckless — all walked
out in 2-3-1, because `newGame` wrote `DEFAULT_FORMATION_ID` into every one of
them and nothing ever reconsidered. That was the entire cause: not squad
composition, not the scoring, not a shortage of shapes. Measured before
changing anything, the ten seven-a-side shapes sit within a few per cent of each
other for a typical squad, the best-suited shape varied by club (2-3-1 for four,
3-2-1 for four, 2-2-2 for three, 2-4 for one in a sample league), and forcing
everyone into 2-3-1 cost 3.7% of the selection value the squads could have
reached. Diversity was not being suppressed by football logic; it had simply
never been asked for.

`selectFormation` now asks. It reads the squad first — only shapes within 6% of
the best-suited one are candidates at all — then the club's own tactics, which
can move a candidate by at most 4%. `Formation.shape` (BALANCED, ATTACKING,
DEFENSIVE, WIDE, NARROW) already existed on every shape and was read by two UI
labels and nothing else; `shapeAffinity` turns the press, line, risk, tempo,
width, focus, passing, counter and build-up a club already holds into a
preference over exactly those five words. Nothing new is invented and there is
no second position model: suitability is the mean `selectionFit` of the side
`autoLineup` would pick, the same score that picks every team sheet.

Measured over 24 worlds and 288 clubs (`docs/experiments/formation-identity/`),
against three alternatives. All ten shapes now appear; the commonest holds 28.5%
of clubs where it used to hold 100%; shape entropy is 2.99 bits of a possible
3.32. Defensive rocks and veteran cores field a defensive shape every time,
entertainers an attacking one two thirds of the time, creator clubs a wide one
60% of the time — while *which* defensive shape depends on the squad, so clubs
sharing a philosophy do not become copies. The league got better, not just
noisier: season points spread 12.02 → 11.38, the strong-weak gap 0.910 → 0.794
points per game, the weakest third 1.000 → 1.071, and starters asked to play out
of position fell from 0.44 to 0.19 per club. Pure squad suitability with no
identity (candidate A) was rejected — it widened the strong-weak gap to 0.924,
worse than the old world — and identity-led selection (candidate C) was rejected
for tripling the suitability cost and *lowering* diversity, because a heavy
identity weight collapses clubs of one philosophy onto one shape.

The cost is honest and small: world generation 12.3 → 15.5 ms per career (the
selector runs the assignment solver once per candidate shape), and 8.5% of
bench line-cover requirements go unmet against 3.1% before, because a squad plan
built for one shape does not cover all ten equally. Nothing was weakened to hide
that.

This also switched on tactical systems that were already there. Re-running the
bench experiment against the new world: the cover threshold's lower direction
went from changing **0** matches to changing **48.4%** of them, and the tactical
lean from 1.6% to **14.8%**. The previous phase predicted exactly that — "if
tactical identity should show on AI benches, the lever is varied club
formations" — and it is now measured rather than argued.

**Are the bench constants right?** Measured, not asserted. `selectMatchdayBench`
takes an optional `benchTuning` — the same shape as `MatchConfig.adaptation`,
absent in every real match, defaulting to the production constants — so a
balance harness can run the same league at different values through the *real*
selector rather than a copy. `tools/sim/src/benchExperiment.ts` does that: five
configurations x 40 worlds x one season, 5,280 matches each, identical seeds,
clubs, squads, fixtures, injuries and economy throughout. Results in
`docs/experiments/bench-tuning/`. Byte-identical across three full runs.

The answer is keep both values.

*Cover threshold* is a step function, not a dial. The best player-to-line
familiarity that actually occurs takes only the values 0.45, 0.70, 0.75, 0.82,
0.87, 0.88, 0.90 and 1.00 — nothing between 0.46 and 0.69 — so every threshold
in (0.45, 0.70] is the same selector *for a given shape*. When every club played
2-3-1, running the league at 0.60 reproduced 0.70 byte for byte (0 of 5,280
matches changed). That is no longer true: with clubs playing all ten shapes, the
0.60 arm now changes 48.4% of matches and 20.7% of winners, because shapes with
wing-back and wide slots have links in the 0.60 band that 2-3-1 does not. The
current value still measures well — at 0.60 the league is a shade flatter
(points sd 11.69 vs 11.82, weakest third 1.010 vs 1.001 points per game) — but
this is now a live parameter rather than a settled one, and is flagged for
re-validation in REMAINING_RISKS. The only other behaviour is
above 0.70, and it is worse: at 0.80, 85% of matches change and 36% change
winner, the league gets less competitive (season points sd 11.73 -> 12.16), the
weakest third of clubs lose ground (0.993 -> 0.971 points per game), and more
benches end up with no attacking option (5.4% -> 8.4%) or no reserve keeper
(6.7% -> 7.5%). 0.7 is the most permissive value of the only sensible class.

*Tactical lean* cannot be tuned by magnitude at all — exposure counts are
integers, so any value in (0, 1) breaks exactly the ties and nothing else, and
0.20 still reproduces 0.12 byte for byte. Only its presence matters. When every
club played 2-3-1 that presence was worth 1.6% of matches; now that clubs field
shapes whose lines can level it is worth 14.8% of matches and 6.4% of winners,
and switching it off measurably costs the weakest clubs (0.995 vs 1.001 points
per game) and flattens the reward for squad depth (0.128 vs 0.152).
Asked directly across every shape the game ships, the lean changes 10.3% of
benches, in exactly the shapes with lines that can level (1-3-2, 2-2-2, 2-1-3,
3-3, and the eleven-a-side shapes) — which AI clubs now actually play.

Two other things the experiment settled. The selector does not disproportionately
reward strong clubs: the strong-weak gap is 0.918 points per game at 0.70 and
*wider* at 0.80, so the current setting is the more forgiving one. Depth is
rewarded but not runaway — deep squads take 0.216 more points per game than
shallow ones of the same starting strength — and versatility is not an exploit:
almost every reserve in this content already covers two lines (6.69 of ~11,
sd 0.53), so utility cannot differentiate clubs, and buying cover costs 2.8
rating points against a bench picked on rating alone.

**Who comes on.** Tapping the man coming off reorganises the sheet around
that decision: he sits at the top, then "Recommended" (like-for-like first,
labelled *Best fit*; *Fresh legs* when somebody who plays there has clearly
more left; late and behind, an *Attacking option*; late and ahead, a
*Defensive option*), then the rest of the bench, then anyone unavailable with
the reason under his name. The eleven drop out of the way; a tap on the man
at the top brings them back. Ranking is quality × position familiarity (the
engine's own table, over natural and secondary positions) × legs; a keeper's
shirt is only covered by a keeper. A double tap makes one change.

**The live pitch moves.** The renderer already smoothed positions, but it
chased a coarse per-tick ball point with a short time constant, so the ball
darted sideways on channel noise, jumped to the centre circle at every
stoppage (the simulator's "no possession" point) and led its carrier around
by a length. `motion.ts` is the presentation layer now: every shirt travels
from where it is drawn to where the new snapshot puts it, timed to arrive as
the next snapshot is due (the interval is measured from the frames, so it is
smooth at every match speed, and a paused match finishes its last segment
and stops); the ball is glued to whoever has it, at his drawn position — the
named carrier, or when the engine names none, the man nearest its point, with
a little loyalty — flies to the receiver at a bounded pace when it changes
hands, flies at the goal on a shot, and stays where play stopped through a
stoppage. Nothing in it is read by the simulation. Browser-measured on the
built bundle: largest per-frame shirt movement 0.016–0.019 of the pitch,
ball within a shirt's reach in 19–20 of 20 samples, zero movement while
paused, no jump on resume.

## 5. What is strong

- Engine/UI separation is real, not aspirational.
- The 12-season headless invariant harness: no duplicated player ownership, no
  negative or double-paid money, tables that reconcile with their results.
- Long-session growth is bounded by design — event log capped at 600, ratings
  at 8, season summaries at 30, transcripts at 24.
- No Zustand selector returns a fresh object or array, so the usual
  over-render trap is absent; expensive derivations are memoised.
- Save integrity: versioned, checksummed, validated, backed up, and hardened
  against a storage adapter that refuses reads, writes and deletes.

---

## 6. Known limitations

- **Onboarding is now covered end to end.** A browser check creates a career
  from an empty install through every step of the real UI, and requires it back
  after a reload. It proves the career is *written*; the ordering — that
  creation does not resolve until the save is on disk — is asserted separately
  in `gameStore.test.ts`, because a write that merely races the player still
  lands before the browser test looks.
- **Content safety is audited and guarded.** `basePack.test.ts` asserts no real
  club, competition, nation or brand — and no competitor league mark — appears
  anywhere in the base pack, the club lore or either example pack. Licensed and
  community packs are test fixtures and are never loaded at runtime; the app
  loads `BASE_PACK` and nothing else. The App Store listing and the marketing
  site are guarded separately in `appStore.test.ts`, because the engine's
  corpus cannot reach them and hand-written marketing copy is where a
  competitor's name actually gets typed.
- **The snapshot-compute-apply invariant is enforced.** Feature engines that
  commit through `apply` must contain no async boundary; see
  `CURRENT_ARCHITECTURE.md` and `engineInvariant.test.ts`.
- **Two tabs share one career.** The IndexedDB connection now honours
  `versionchange`, so a newer build in another tab can upgrade the schema
  instead of being blocked into a localStorage fallback; a browser check opens a
  second page and requires it to see the first page's change.
- **Pre-v7 careers still share entity ids with each other.** New careers scope
  their ids to the career that created them (see §4a); existing saves keep the
  ids already written into them, because rewriting every club, fixture and
  ledger reference inside a live save is riskier than the collision warrants.
- **The engine ships as a 205 kB gzip chunk plus a 77 kB content chunk** that
  arrives only when a career is created or opened (see §4b). The split is
  guarded by a source-level boundary test and by the browser smoke suite,
  which counts the content request and refuses a blank step.
- **No real-device testing has been done.** Every performance number in this
  repository is desktop-browser or headless Node. Phase 23 of the current
  brief cannot be closed from CI.
- Several `docs/` files predate this one and describe earlier states. They are
  marked as superseded rather than deleted — they are the project's history.

Full list with severity and recommended next steps: `REMAINING_RISKS.md`.
