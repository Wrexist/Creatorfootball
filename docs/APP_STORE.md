# App Store Submission Package

Draft metadata and release checklist for the App Store Connect record for v1.0 of
**Creator Football** (`com.creatorfootball.app`). Machine-readable copies of
every text field live in `apps/game/fastlane/metadata/en-US/` — this document
is the source of truth for *why*, plus everything fastlane files can't carry.

Description and promotional copy were refreshed September 22, 2026. This is not evidence of a signed or approved release. See [current console status and open release gates](STORE_SETUP_STATUS.md).

---

## 1. Listing copy (en-US)

| Field | Limit | Value | Used |
|---|---|---|---|
| **Name** | 30 | `Creator Football: Club Manager` | 30/30 |
| **Subtitle** | 30 | `Build a Club. Rule the League.` | 30/30 |
| **Keywords** | 100 | see below | 97/100 |
| **Promotional Text** | 170 | see `promotional_text.txt` | 154/170 |
| **Description** | 4,000 | see `description.txt` | 2,177/4,000 |
| **What's New (1.0)** | 4,000 | see `release_notes.txt` | 316/4,000 |

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
| Primary language | English (U.K.), as verified in App Store Connect; en-US copy is also prepared |
| Category (primary) | Games → Sports |
| Category (secondary) | Games → Simulation |
| Copyright | `© 2026 Wrexist` |
| Support URL | https://wrexist.github.io/Creatorfootball/support.html |
| Marketing URL | https://wrexist.github.io/Creatorfootball/ |
| Privacy Policy URL | https://wrexist.github.io/Creatorfootball/privacy.html |
| SKU | `creator-football-1` |

GitHub's Pages API currently reports legacy deployment from `Main:/docs`.
Keep the public HTML copies in `docs/` and `website/` consistent. The Pages
workflow also exists; do not assume a local edit to `website/` is live without
checking deployment status and the actual public URLs.

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

The social feed is fictional game content, not public user-generated content or
chat. The owner selected an all-ages Google Play audience, including children;
that is separate from Apple's content rating. Review the actual SDKs, purchase
flow and Families requirements before claiming the all-ages release is qualified.

---

## 4. App Privacy label

The optional native purchase integration uses RevenueCat. Do not submit the old "Data Not Collected" label for a purchase-enabled build. The current console label declares purchase history and the anonymous app user identifier for app functionality and analytics, not linked to identity or used for advertising tracking. Careers remain local and no game account exists. Reconcile these answers with the archived binary's privacy report and the configured RevenueCat project before submission.

Sources: [RevenueCat Apple privacy guidance](https://www.revenuecat.com/docs/platform-resources/apple-platform-resources/apple-app-privacy), [anonymous customer IDs](https://www.revenuecat.com/docs/customers/identifying-customers). The app privacy manifest includes Filesystem's timestamp access reason C617.1. Review the merged SDK manifests in Xcode as part of release qualification.

---

## 5. Screenshots

Required set: **6.9" iPhone (1290×2796)** — App Store Connect derives the
6.5"/6.1" sets. Optional but recommended: **13" iPad (2064×2752)** since the
build targets device family 1,2.

Capture from the real build at those sizes (no device frames needed; captions
below each). Order is conversion-ranked:

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

### 5a. Creative assets: product page header and search results (iOS 27)

App Store Connect → the version → **Header and Search Results**. Both files are
in `apps/game/fastlane/creative_assets/en-US/`. They are opaque 8-bit RGB PNGs,
because Apple rejects images with an alpha channel.

| Placement | File | Size | What it shows |
|---|---|---|---|
| Header | `header.png` | 3840 × 1646 (21:9) | The home end at night under a ring of floodlights. Fans hold a *YOUR CLUB · YOUR STORY* tifo of the CF crest, the crest is projected into the centre circle, and both sides line up before kick-off. |
| Search results | `search-results.png` | 3840 × 2560 (3:2) | *YOUR CLUB. YOUR CALL.* beside two real in-game screens: a live decision (*Under pressure*: Safe / Gamble / Calculated) and the live match view. |

How they meet Apple's guidance:

- **Safe areas.** The key art sits inside Apple's centred art-safe rectangles:
  1646 × 661 on the header (the tifo and the crowd around it) and 2168 × 1030 on
  search results (the headline, line and front decision card). Everything
  outside those boxes is scene extension that devices may crop.
- **Firsthand experience.** The search results phones show screenshots of the
  shipping build, not mock-ups. Text is a short phrase, with no prices, awards,
  URLs or other platforms. It is all 4+ content, and the crowd, kits and crest
  are original fiction.
- **Header text.** The header has no overlay text. The only words are on the
  tifo, inside the scene.
- **Localisation.** The text is English. For another locale, change the strings
  in `tools/brand/appstore/search.html` and the tifo words in `stadium.js`,
  then re-render.

Regenerate:

```sh
pnpm assets:appstore                                  # both PNGs at upload size
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers \
  node tools/brand/appstore/render.mjs /tmp/proof --scale 0.5   # quick half-size proof
```

The scene comes from `tools/brand/appstore/stadium.js`, a seeded perspective
renderer. It draws a modelled bowl, tens of thousands of seat-by-seat crowd figures, the
roof floodlight ring and bloom. The tifo and the pitch projection are mapped
per pixel through a homography, so the crest stays sharp at 4K. The phone
screens are in `tools/brand/appstore/screens/`, and
`capture-screens.mjs` re-captures them from a `vite preview` build. Each career
is seeded, so a new capture can land on a different decision. Check the
frames before you re-render.

Before submitting, check both assets in App Store Connect's **Preview** on
iPhone and iPad, in both orientations and in Dark Mode.

---

## 6. Review notes (paste into App Review Information)

```
Creator Football is a single-player football management game. Everything runs
on-device. Optional one-time content purchases are verified through RevenueCat and the Apple store account. There is no game sign-in or cloud save.

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
- [ ] **Real-device pass** (FINAL_AUDIT §6 blocking item): glass blur, pitch
      renderer frame rate, haptics feel, keyboard avoidance on iPhone
- [ ] Archive with Xcode (requires macOS): bump `MARKETING_VERSION` /
      `CURRENT_PROJECT_VERSION` if re-submitting, then validate + upload

Store side (App Store Connect):

- [ ] App record created with bundle ID above; SKU set
- [ ] All en-US fields pasted from `fastlane/metadata/en-US/`
- [ ] Age rating questionnaire submitted (section 3 answers)
- [ ] App Privacy: reconcile purchase history and anonymous user identifier declarations with the RevenueCat-enabled release; do not use Data Not Collected for that build.
- [ ] URLs reachable (after first Pages deploy)
- [ ] Screenshots uploaded per section 5
- [ ] Review notes pasted; contact email confirmed monitored
- [ ] Configure the three non-consumable products and their prices/regions, attach RevenueCat entitlements, and complete sandbox purchase/restore/refund tests before enabling IAP.

Post-launch ASO cadence: refresh Promotional Text freely (no review); revisit
Name/Subtitle/Keywords only with version updates; check App Store Connect's
Search Terms report after two weeks and prune keywords with zero impressions.
