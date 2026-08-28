# iOS release runbook — TestFlight and the App Store

How a commit on `Main` becomes a build on a phone and a listing on the store.
The *what to say on the store page* lives in [`APP_STORE.md`](APP_STORE.md);
this document is the *how to ship*, and everything here is automated by two
workflows:

| Workflow | What it ships | Runs on |
|---|---|---|
| [`ios-testflight.yml`](../.github/workflows/ios-testflight.yml) | The binary: archive → .ipa artifact → (opt-in) TestFlight upload | ubuntu gates, then macOS |
| [`appstore-metadata.yml`](../.github/workflows/appstore-metadata.yml) | The listing: name, subtitle, keywords, description, categories, review notes, optionally screenshots | ubuntu only |

The architecture is ported from Wrexist/WorldQuest's local-build workflow
(itself from DeepLifeSimulator), adapted from Expo/EAS to this repo's
Capacitor + xcodebuild shape. The inherited lessons are recorded as comments
in the workflow files — read them before "simplifying" anything.

---

## One-time setup, in order

### 1 · Apple Developer Program

Enroll (or confirm) the Apple Developer Program membership that will own
`com.creatorfootball.app`. Note the **Team ID** (10 characters, at
developer.apple.com → Membership details). The bundle ID does **not** need to
be registered by hand — the workflow's `-allowProvisioningUpdates` registers
it on first archive.

### 2 · App Store Connect API key

App Store Connect → **Users and Access → Integrations → App Store Connect
API → Team Keys → +**.

- **Role: Admin.** Cloud signing may need to mint the distribution
  certificate on the very first archive, which App Manager cannot do. After
  a certificate exists, App Manager is enough — you can rotate to a
  narrower key later.
- Download the `.p8` **once** (Apple never shows it again) and note the
  **Key ID** and the **Issuer ID** shown on the same page.

### 3 · GitHub repository secrets

Settings → Secrets and variables → Actions:

| Secret | Value |
|---|---|
| `APPLE_TEAM_ID` | The 10-character Team ID |
| `APP_STORE_CONNECT_KEY_ID` | Key ID from step 2 |
| `APP_STORE_CONNECT_ISSUER_ID` | Issuer ID from step 2 |
| `APP_STORE_CONNECT_API_KEY_BASE64` | `base64 -i AuthKey_XXXX.p8` (the workflows also accept the raw `.p8` text pasted directly) |

All four gate the **build**, not just the upload: signing itself
authenticates with the API key. There is no certificate or provisioning
profile to export, upload, or watch expire — Xcode's cloud signing manages
both against the API key.

### 4 · Create the app record

App Store Connect → My Apps → **+ → New App**. This is the one step no API
can do. Fields come from [`APP_STORE.md §2`](APP_STORE.md):

- Platform iOS · Name `Creator Football: Club Manager` · Primary language
  en-US · Bundle ID `com.creatorfootball.app` · SKU `creator-football-1`.
- If the bundle ID is not offered in the dropdown yet, run the TestFlight
  workflow once first (without submit) — first archive registers it.

Once the record exists, the build-number resolver
([`tools/release/next-build-number.mjs`](../tools/release/next-build-number.mjs))
starts tracking App Store Connect's highest build automatically; before
that it falls back to epoch seconds, which is also always unique.

### 5 · First listing push

Run **App Store metadata** (Actions → App Store metadata → Run workflow).
It validates every field against Apple's character limits at 1x cost, then
pushes `apps/game/fastlane/metadata/` + the Deliverfile settings
(categories, copyright, review notes). Re-run it whenever listing copy
changes — the repo is the source of truth, not the web form.

### 6 · Make sure the URLs resolve

The support/marketing/privacy URLs in the listing are served by GitHub Pages
from `website/` ([`pages.yml`](../.github/workflows/pages.yml)); first deploy
needs Settings → Pages → Source: **GitHub Actions** once.

---

## Shipping a build

Actions → **iOS TestFlight** → Run workflow:

- **version** — the marketing version, always full `MAJOR.MINOR.PATCH`
  (e.g. `1.0.0`). Apple permanently burns released version numbers; bump for
  every store release. Deliberately has no default so a stale number can
  never ship by accident.
- **submit** — unticked, the run ends with a downloadable `.ipa` artifact
  (kept 14 days; uploadable by hand via the Transporter app). Ticked, the
  same archive is validated and uploaded to App Store Connect.

What happens, in order: ubuntu re-runs the full CI surface (lint, typecheck,
tests, build, browser smoke) and checks the secrets — everything that can
fail cheaply fails before a macOS minute (billed ~10x) is spent. Then macOS
builds the web bundle, `cap sync`s it into the native shell, resolves a
unique build number against App Store Connect, archives with cloud signing,
exports the `.ipa`, and — if asked — uploads.

After an upload: the build appears in **TestFlight** after Apple processes
it (5–30 min). **Internal testing** (App Store Connect team members) needs
no review and is installable within minutes of processing. **External
testing** and the public release both go through Apple review, using the
listing that `appstore-metadata.yml` maintains. Export compliance never
prompts: `ITSAppUsesNonExemptEncryption=false` is already declared in
Info.plist.

Versions and build numbers never need editing in the repo: the pbxproj's
`MARKETING_VERSION`/`CURRENT_PROJECT_VERSION` are placeholders that the
workflow overrides per run as build settings.

---

## Screenshots

`pnpm shots:store` renders draft candidates from the real bundle at exactly
1290×2796 into `tools/release/store-shots/` (gitignored). Curate the final
conversion-ranked set from [`APP_STORE.md §5`](APP_STORE.md) — the in-match
moments need a played save — drop them in
`apps/game/fastlane/screenshots/en-US/` (numbered; see the README there),
and run the metadata workflow with *include screenshots* ticked.

---

## Troubleshooting

**Archive fails on signing / "No profiles for 'com.creatorfootball.app'".**
Cloud signing needs the API key to reach the team: check the key's role
(Admin for the first run — see §2) and that `APPLE_TEAM_ID` matches the team
the key belongs to. Fallback if cloud signing is ever unavailable: create a
distribution certificate + App Store profile in Xcode on any Mac, export a
`.p12`, and switch the workflow to keychain-based signing — but try the role
fix first; the fallback reintroduces silent expiry.

**"You've already submitted this version of the app."** That marketing
version is burned on Apple's side — re-run with the patch version bumped.

**"You've already submitted this build of the app."** Should be impossible
while the resolver can reach App Store Connect (it always goes one higher
than Apple's records); if it appears, the run likely fell back to a stale
`ASC_APP_ID`. Re-run; the epoch fallback is always unique.

**Upload rejected over the SDK version.** Apple requires the iOS 26 SDK
(Xcode 26) for all uploads — inherited from WorldQuest, where a
macos-15-built .ipa compiled cleanly and was then refused at validation.
The workflow pins `macos-26`; do not move it down to dodge a compile error.

**`deliver` fails with "Could not find app".** The app record doesn't exist
yet (§4), or the API key can't see it (wrong team).

**`cap sync` / SPM path errors on macOS.** The committed
`ios/App/CapApp-SPM/Package.swift` was generated on Windows and carries
backslash paths; the workflow always regenerates it via `cap sync ios`
before archiving, so only local builds that skip sync ever see this.
