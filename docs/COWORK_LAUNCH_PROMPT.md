# Claude Cowork prompt — take Creator Football live

Copy everything below the line into a new Claude Cowork (or Claude Code)
session with access to the `Wrexist/Creatorfootball` repository. It contains
the complete remaining path from "automation merged" to "live on the App
Store", in order, with the human-only steps marked.

---

You are shipping **Creator Football** (`com.creatorfootball.app`), a
single-player Capacitor iOS game in the repo `Wrexist/Creatorfootball`, to
TestFlight and then the App Store. All of the automation already exists —
your job is to drive it, guide me through the few steps only a human can do
in Apple's web UI, verify each phase actually worked before moving on, and
fix anything that fails.

## Ground rules

- Work **one phase at a time, in order**. At the end of each phase, verify
  the stated exit condition yourself where you can; where you can't, ask me
  to confirm before continuing.
- **Ask before anything outward-facing or hard to reverse**: dispatching a
  workflow with `submit` ticked, uploading screenshots, submitting for
  review. Dry runs and read-only checks never need asking.
- **Never invent values.** Marketing versions, copy, categories, age-rating
  answers all have a single source of truth in the repo — quote it, don't
  improvise. If something is genuinely unknown, say so and ask.
- When a workflow run fails, read the actual logs, root-cause against the
  Troubleshooting section of `docs/RELEASE_IOS.md`, fix, and re-run. Do not
  re-run unchanged more than once.
- Store listing copy is governed by `docs/APP_STORE.md` (ASO reasoning and
  character limits) — if I ask you to change copy, follow its rules and keep
  the measured character counts under the limits.

## Phase 0 — Orient and confirm the baseline

1. Read `docs/RELEASE_IOS.md` (the release runbook) and `docs/APP_STORE.md`
   (the listing source of truth) in full. Everything below assumes them.
2. Confirm the release automation is on the default branch (`Main`): the
   files `.github/workflows/ios-testflight.yml`,
   `.github/workflows/appstore-metadata.yml`,
   `apps/game/fastlane/Deliverfile`, `tools/release/next-build-number.mjs`
   and `apps/game/ios/App/App.xcodeproj/xcshareddata/xcschemes/App.xcscheme`
   must exist there. If they only exist on the branch
   `claude/creatorfootball-app-store-setup-o2dyhk`, help me open and merge
   that PR first (squash-merge; ask me before merging).
3. Confirm CI is green on `Main`.

**Exit:** automation on `Main`, CI green.

## Phase 1 — Website live (the listing's three URLs)

The support / marketing / privacy URLs in the listing point at GitHub Pages
serving `website/`.

1. **[Human]** Walk me through: repo **Settings → Pages → Source: GitHub
   Actions** (one-time). Wait for my confirmation.
2. Dispatch the `Pages` workflow (or push nothing — it also runs on `Main`
   pushes touching `website/`), wait for it to finish.
3. Verify all three URLs from `docs/APP_STORE.md` §2 return HTTP 200 and
   render real content:
   - https://wrexist.github.io/Creatorfootball/
   - https://wrexist.github.io/Creatorfootball/support.html
   - https://wrexist.github.io/Creatorfootball/privacy.html

**Exit:** all three URLs live.

## Phase 2 — Apple credentials (human, guided step-by-step)

Guide me through each of these interactively — one step, wait, next step.
These are exactly `docs/RELEASE_IOS.md` §1–3; use its wording.

1. **[Human]** Apple Developer Program membership active for the account
   that will own the app. If not enrolled: developer.apple.com/programs
   (≈ $99/year, can take 24–48h to activate). I'll tell you when it's
   active.
2. **[Human]** Note the **Team ID** (developer.apple.com → Membership
   details, 10 characters).
3. **[Human]** Create an App Store Connect API key: App Store Connect →
   Users and Access → Integrations → App Store Connect API → Team Keys → +.
   **Role: Admin** (cloud signing must be able to mint the distribution
   certificate on first archive). Download the `.p8` — Apple shows it
   exactly once — and note the Key ID and Issuer ID.
4. **[Human]** Add the four repository secrets (Settings → Secrets and
   variables → Actions):
   - `APPLE_TEAM_ID`
   - `APP_STORE_CONNECT_KEY_ID`
   - `APP_STORE_CONNECT_ISSUER_ID`
   - `APP_STORE_CONNECT_API_KEY_BASE64` — give me the exact encode command
     for my OS (`base64 -i AuthKey_XXXX.p8 | pbcopy` on macOS; the PowerShell
     variant is in the workflow header). Raw `.p8` text pasted directly also
     works.

**Exit:** all four secrets present (you can't read them — verify in Phase 3
by running the pipeline, whose first job fails fast and cheaply if any is
missing or malformed).

## Phase 3 — First archive (no upload) — proves signing end to end

1. Ask me for permission, then dispatch **iOS TestFlight** with
   `version: 1.0.0`, `submit: false`. This validates the secrets, registers
   the bundle ID with Apple (`-allowProvisioningUpdates`), mints the
   cloud-managed distribution certificate, and produces a signed `.ipa`
   artifact — without shipping anything.
2. Watch the run. If the archive fails on signing, apply the Troubleshooting
   entries in `docs/RELEASE_IOS.md` (API key role is the usual culprit).

**Exit:** green run, `creator-football-ios-ipa` artifact downloadable.

## Phase 4 — App Store Connect record (human, guided)

1. **[Human]** App Store Connect → My Apps → **+ → New App** (no API can do
   this). Dictate the exact values from `docs/APP_STORE.md` §2 to me:
   Platform iOS · Name `Creator Football: Club Manager` · Language en-US ·
   Bundle ID `com.creatorfootball.app` (in the dropdown now, thanks to
   Phase 3) · SKU `creator-football-1`.

**Exit:** app record exists. (From now on the build-number resolver tracks
Apple's records automatically.)

## Phase 5 — Push the listing

1. Ask me, then dispatch **App Store metadata** (screenshots unticked). It
   validates character limits, then pushes name, subtitle, keywords,
   description, promotional text, URLs, categories, copyright and review
   notes from the repo.
2. Verify in the run log that deliver succeeded; ask me to spot-check the
   listing in App Store Connect.
3. **[Human]** The pieces deliver cannot set — walk me through each in the
   App Store Connect UI:
   - **Age rating questionnaire** — read me the answer table from
     `docs/APP_STORE.md` §3 (result must be 4+).
   - **App Privacy** → **Data Not Collected** (§4 — do not improvise; the
     privacy page and this label must match).
   - **Pricing**: Free. **Availability**: all regions (default).
   - **App Review contact** name/email/phone (deliberately not in the repo).

**Exit:** listing complete in App Store Connect except screenshots.

## Phase 6 — TestFlight

1. Ask me, then dispatch **iOS TestFlight** with `version: 1.0.0`,
   `submit: true`. Watch it; the build appears in TestFlight after Apple
   processes (5–30 min).
2. **[Human]** Add me (and any testers on the App Store Connect team) to an
   **Internal Testing** group — no review needed, installable in minutes.
3. **[Human]** Real-device pass — the one blocking checklist item no CI can
   do (`docs/APP_STORE.md` §7): glass blur, pitch renderer frame rate,
   haptics feel, keyboard avoidance on iPhone. I report findings; you file
   or fix what comes back, then repeat this phase with a bumped patch
   version if code changed.

**Exit:** a build I've played on a real phone with no blockers.

## Phase 7 — Screenshots

1. Run `pnpm shots:store` (or tell me to) for draft framing at the exact
   required 1290×2796; the conversion-ranked final set in
   `docs/APP_STORE.md` §5 needs a *played* save behind it (a 2–2 matchday
   with the decision sheet up, a late-season table, a reacting feed) — help
   me capture those at the same size, following
   `apps/game/fastlane/screenshots/README.md`.
2. Commit the finals to `apps/game/fastlane/screenshots/en-US/` numbered in
   §5's order (01_, 02_, …).
3. Ask me, then dispatch **App Store metadata** with
   `include_screenshots: true`.

**Exit:** screenshots visible on the App Store Connect version page.

## Phase 8 — Submit for review

1. Pre-flight everything once more against `docs/APP_STORE.md` §7 — every
   box ticked, honestly. Report anything unticked instead of proceeding.
2. **[Human]** In App Store Connect: attach the TestFlight build to version
   1.0.0, confirm the What's New text (already pushed), and press **Submit
   for Review**. Export compliance never prompts —
   `ITSAppUsesNonExemptEncryption=false` is declared in the binary.
3. If Apple rejects: bring me the rejection text, map it to the guideline,
   propose the minimal fix, and rerun the affected phases.

**Exit:** status "Waiting for Review" → eventually "Ready for Sale".

## Phase 9 — Post-launch ASO cadence (set up, then done)

Per `docs/APP_STORE.md`: promotional text may be refreshed any time without
review (edit `promotional_text.txt`, run the metadata workflow);
name/subtitle/keywords only change with version updates; after two weeks,
remind me to check App Store Connect's Search Terms report and prune
keywords with zero impressions. Offer to set a reminder if the environment
supports scheduled tasks.

---

That is the whole path. Begin with Phase 0.
