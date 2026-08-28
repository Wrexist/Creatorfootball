# App Store Submission Package

Everything needed to create the App Store Connect record and ship v1.0 of
**Creator Football** (`com.creatorfootball.app`). Machine-readable copies of
every text field live in `apps/game/fastlane/metadata/en-US/` — this document
is the source of truth for *why*, plus everything fastlane files can't carry.
The **How to ship** — workflows, secrets, signing, build numbers — lives in
[`RELEASE_IOS.md`](RELEASE_IOS.md): the binary ships via the *iOS TestFlight*
workflow and this listing ships via the *App Store metadata* workflow, so
none of the copy below is ever retyped into a web form. The click-by-click
list of what a human still has to do in Apple's UI is
[`GO_LIVE_GUIDE.md`](GO_LIVE_GUIDE.md).

All character counts were measured, not estimated — and they are *character*
counts of the trimmed text, which is what Apple counts and what the metadata
workflow's limit gate re-measures on every run. (Byte counts run higher:
`description.txt` is 2,796 bytes because of its em dashes.)

---

## 1. Listing copy (en-US)

| Field | Limit | Value | Used |
|---|---|---|---|
| **Name** | 30 | `Creator Football: Club Manager` | 30/30 |
| **Subtitle** | 30 | `Build a Club. Rule the League.` | 30/30 |
| **Keywords** | 100 | see below | 97/100 |
| **Promotional Text** | 170 | see `promotional_text.txt` | 136/170 |
| **Description** | 4,000 | see `description.txt` | 2,761/4,000 |
| **What's New (1.0)** | 4,000 | see `release_notes.txt` | 315/4,000 |

### Keywords field

```
soccer,gm,franchise,dynasty,tactics,transfers,scouting,influencer,coach,sim,sports,strategy,owner
```

ASO rules followed:

- **No word already in Name/Subtitle** — Apple indexes those automatically.
  That is why `football`, `manager`, `club`, `league`, `build` are absent here.
- **Singular/stem-friendly forms only**, no spaces after commas (spaces count).
- **No trademarked terms** ("FM", "FIFA", "eFootball") — rejection risk under
  guideline 2.3.7 and a legal line the project holds anyway.
- `soccer` + `gm` + `franchise` capture the US "GM game" audience; `influencer`
  captures the creator-economy crossover; `dynasty` captures the retention hook.

### Title/subtitle structure

`Brand: What It Does` (highest-weight field) + a subtitle that states the
fantasy rather than the category. Both read as one sentence in search results:
*"Creator Football: Club Manager — Build a Club. Rule the League."*

---

## 2. App information

| Field | Value |
|---|---|
| Bundle ID | `com.creatorfootball.app` |
| Primary language | en-US |
| Category (primary) | Games → Sports |
| Category (secondary) | Games → Simulation |
| Copyright | `© 2026 Wrexist` |
| Support URL | https://wrexist.github.io/Creatorfootball/support.html |
| Marketing URL | https://wrexist.github.io/Creatorfootball/ |
| Privacy Policy URL | https://wrexist.github.io/Creatorfootball/privacy.html |
| SKU | `creator-football-1` |

The three URLs are served by GitHub Pages from `website/` in this repo,
deployed by `.github/workflows/pages.yml`. First deploy requires a one-time
repo setting: **Settings → Pages → Source: GitHub Actions**.

---

## 3. Age rating questionnaire

Answers that produce a rating of **4+** on the updated (2026) questionnaire:

| Question | Answer |
|---|---|
| Cartoon/fantasy violence | None |
| Realistic violence | None (sporting context only; no violence against persons) |
| Sexual content / nudity | None |
| Profanity/crude humour | None |
| Mature/suggestive themes | None |
| Horror/fear themes | None |
| Medical information | None |
| Gambling (real money) | None |
| Simulated gambling | None |
| Alcohol/tobacco/drugs | None |
| Unrestricted web access | No |
| User-generated content sharing | No |
| Chat (filtered/unfiltered) | None |
| Contests/ads for other products | No |

The game contains no user-generated content sharing, no chat and no external
links from inside gameplay, so no moderation obligations attach.

---

## 4. App Privacy label

Declare: **Data Not Collected.**

The app has no accounts, no ads, no third-party analytics or crash SDKs, and
saves never leave the device. The website sets no cookies and runs no scripts.
`website/privacy.html` documents exactly this — Apple cross-checks the label
against the policy, and a mismatch triggers a 5.1.1 rejection.

> If telemetry is ever added, update: the engine's analytics sink config, the
> privacy page, this label, and re-review — in that order, before shipping.

---

## 5. Screenshots

Sizes App Store Connect accepts, per its own upload error text. **The boxes do
not accept each other's images** — a 1290×2796 file dropped into the 6.5" box
fails the whole upload:

| Box | Use | Also accepted |
|---|---|---|
| iPhone 6.9" | **1290×2796** | 1260×2736, 1320×2868 |
| iPhone 6.5" | **1284×2778** | 1242×2688 |
| iPad 13" | **2064×2752** | 2048×2732 |

`pnpm shots:marketing` writes all three sets into folders named after their
pixel size and verifies each file's dimensions before finishing.

`pnpm shots:all` produces the finished listing images in two stages.
`shots:store` captures the eight app screens from the real bundle on a *played*
save — it takes over Marrowgate Athletic, simulates 16 of 22 fixtures and plays
one match live, so the table, the feed and the two in-match frames are real
rather than a fresh save's empty state. `shots:marketing` then frames each one
as a captioned marketing image (headline, subhead, three angled devices,
badges) at all three sizes above; see
[`tools/release/marketing/README.md`](../tools/release/marketing/README.md).

Finals go in `apps/game/fastlane/screenshots/en-US/` (numbered in the order
below) and upload via the metadata workflow. Order is conversion-ranked:

| # | Screen | Caption |
|---|---|---|
| 1 | Live match, decision sheet up | *Matchday. Two-all. One call.* |
| 2 | Home hub with next fixture | *Your club. Your problem.* |
| 3 | Transfer market, negotiation sheet | *Sign the finisher. Or the streamer.* |
| 4 | Pitch view mid-match | *Watch it unfold live* |
| 5 | Social feed reacting to a result | *The feed reacts to how you play* |
| 6 | League table late season | *Twenty-two matches. One champion.* |
| 7 | Squad & training | *Develop wonderkids your way* |
| 8 | Club identity / badge | *Build something they remember* |

Rules Apple enforces: screenshots must show the actual product (guideline
2.3.1), no pricing/ranking claims in the artwork, and status bar content must
be real. The smoke test already guarantees nothing overflows at 375px, so full-
bleed captures are safe.

Screens inside the frames are real captures of the running build, which is
what guideline 2.3.1 requires; only the background, type and badges around the
device are marketing.

---

## 6. Review notes (paste into App Review Information)

```
Creator Football is a single-player football management game. Everything runs
on-device; there is no server, account or online component.

To review quickly:
1. Launch and tap through club creation (any choices work).
2. From Home, tap PLAY to reach matchday. Decisions appear as timed prompts;
   any choice progresses the match.
3. Saves persist locally between launches; deleting the app deletes the save.

The app uses no tracking, shows no ads, and requires no special permissions.
No demo account is needed because there are no accounts.
```

Export compliance: the app uses only standard HTTPS (ATS enforced by
WKWebView). Info.plist declares `ITSAppUsesNonExemptEncryption = false`, so
the export question is answered once and skips the annual report.

---

## 7. Pre-submission checklist

Build side (this repo):

- [x] CI green: lint, typecheck, tests, build, browser smoke test, audits
- [x] Capacitor iOS shell committed (`apps/game/ios/`)
- [x] Icon (1024×1024) and splash (2732×2732) installed in the asset catalogue
- [x] Launch screen background = brand base (no white flash)
- [x] Portrait-only on iPhone; all orientations on iPad
- [x] `ITSAppUsesNonExemptEncryption=false`; `arm64` device capability
- [x] Native haptics/status-bar/splash wired behind capability detection
- [x] Shared Xcode scheme committed so CI can archive headlessly
- [x] Store screenshots captured at 1290×2796 from a played save
      (`pnpm shots:store`) — drafts ready to curate
- [x] Archive + TestFlight upload automated: *iOS TestFlight* workflow
      (versions stamped per run, build number resolved against App Store
      Connect — nothing to bump by hand; see `RELEASE_IOS.md`)
- [ ] **Real-device pass** (FINAL_AUDIT §6 blocking item): glass blur, pitch
      renderer frame rate, haptics feel, keyboard avoidance on iPhone

Store side (App Store Connect):

- [ ] Secrets added + API key created — see `GO_LIVE_GUIDE.md` steps 2–4
- [ ] App record created with bundle ID above; SKU set
- [ ] All en-US fields, categories, copyright and review notes pushed by the
      *App Store metadata* workflow (replaces pasting from
      `fastlane/metadata/en-US/`)
- [ ] Age rating questionnaire submitted (section 3 answers)
- [ ] App Privacy: Data Not Collected
- [x] URLs reachable — Pages is live; all three return 200
- [ ] Screenshots uploaded per section 5
- [ ] Review notes pushed by the metadata workflow; review contact
      name/email/phone filled in App Store Connect (deliberately not
      committed to the repo) and the email confirmed monitored
- [ ] Pricing: free, no IAP in v1.0; availability: all 175 regions default

Post-launch ASO cadence: refresh Promotional Text freely (no review); revisit
Name/Subtitle/Keywords only with version updates; check App Store Connect's
Search Terms report after two weeks and prune keywords with zero impressions.
