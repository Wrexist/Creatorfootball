# Go-live guide — the parts only you can do

Everything in this repo that could be automated, is. What is left needs an
Apple login, a credit card, a real iPhone, or a button in a web UI that no API
exposes. This is that list, in order, written to be followed literally.

**Time:** about 90 minutes of your attention, spread over a few days (Apple's
enrolment and review are the waits, not the work).

**Legend:** 🧑 you do it · 🤖 Claude/CI does it once you have

Progress so far:

| | Step | State |
|---|---|---|
| ✅ | Release automation built and merged | done |
| ✅ | Website live (support / marketing / privacy URLs) | done — verified 200 |
| ✅ | Store listing copy written and limit-checked | done |
| ✅ | Store screenshots captured at 1290×2796 | done — drafts ready to curate |
| 🧑 | **Everything below** | ← you are here |

---

## Step 1 · Merge the hardening branch (2 min)

One branch is still open with three fixes to the metadata gate (details in
`docs/RELEASE_IOS.md` and the commit message).

1. Go to https://github.com/Wrexist/Creatorfootball/branches
2. Open a PR from `claude/creatorfootball-app-store-setup-o2dyhk` into `Main`.
3. Squash-merge it.

Do this before Step 8, not necessarily now.

---

## Step 2 · Apple Developer Program (15 min + up to 48h wait) 🧑

You need a paid membership before anything can be signed or uploaded.

1. Go to https://developer.apple.com/programs/enroll/
2. Sign in with the Apple ID that should **own** this app. Choose carefully —
   moving an app between Apple IDs later is painful.
3. Enrol as **Individual** (fastest) unless you have a registered company and
   a D-U-N-S number, in which case **Organization**.
4. Pay the fee (**$99 / year**).
5. Wait for the activation email. Usually hours; occasionally 48h.

**Then note your Team ID:**
1. https://developer.apple.com/account → **Membership details**
2. Copy the **Team ID** — 10 characters, like `A1B2C3D4E5`.
3. Paste it somewhere temporary; it is Secret #1 of 4.

---

## Step 3 · App Store Connect API key (10 min) 🧑

This is what lets the automation sign and upload without a Mac.

1. Go to https://appstoreconnect.apple.com/access/integrations/api
   (or: App Store Connect → **Users and Access** → **Integrations** →
   **App Store Connect API** → **Team Keys**)
2. Click **+** (Generate API Key).
3. Name: `GitHub Actions`.
4. Access: **Admin**.
   > Admin matters. On the very first build, Xcode's cloud signing has to
   > create the distribution certificate for you, and App Manager cannot do
   > that. You can downgrade the key to App Manager after your first
   > successful build.
5. Click **Generate**.
6. **Download the `.p8` file now.** Apple shows it exactly once. If you lose
   it, revoke the key and make a new one.
7. From the same page copy:
   - **Key ID** — 10 characters (Secret #2)
   - **Issuer ID** — a long UUID at the top of the page (Secret #3)

---

## Step 4 · Add the four GitHub secrets (5 min) 🧑

First turn the `.p8` into one line of text. In Terminal (macOS/Linux):

```bash
base64 -i ~/Downloads/AuthKey_XXXXXXXXXX.p8 | pbcopy
```

On Windows PowerShell:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("$HOME\Downloads\AuthKey_XXXXXXXXXX.p8")) | Set-Clipboard
```

> No terminal? Open the `.p8` in TextEdit/Notepad and paste its whole
> contents (including the `-----BEGIN PRIVATE KEY-----` lines) instead. The
> workflows accept either form.

Now add them:

1. Go to https://github.com/Wrexist/Creatorfootball/settings/secrets/actions
2. Click **New repository secret** four times, exactly these names:

| Name | Value |
|---|---|
| `APPLE_TEAM_ID` | The 10-char Team ID from Step 2 |
| `APP_STORE_CONNECT_KEY_ID` | The Key ID from Step 3 |
| `APP_STORE_CONNECT_ISSUER_ID` | The Issuer ID (UUID) from Step 3 |
| `APP_STORE_CONNECT_API_KEY_BASE64` | What you just copied |

Names must match character for character — the workflow looks them up by name
and fails fast (cheaply) if one is missing or misspelled.

---

## Step 5 · First test build (5 min of your time) 🤖

This proves the credentials work, registers your bundle ID with Apple, and
creates your distribution certificate — **without shipping anything.**

1. Go to https://github.com/Wrexist/Creatorfootball/actions/workflows/ios-testflight.yml
2. Click **Run workflow**.
3. Fill in:
   - **version**: `1.0.0`
   - **submit**: **leave unticked** ← important
4. Click the green **Run workflow**.
5. Wait ~25 minutes. Green tick = your Apple setup is correct and a signed
   `.ipa` is attached at the bottom of the run page.

**If it fails**, open the failed step and match the error to the
Troubleshooting section of `docs/RELEASE_IOS.md`. The usual cause is the API
key not being Admin (Step 3.4). Claude can read the logs and fix it.

---

## Step 6 · Create the app record (10 min) 🧑

No API can do this one.

1. Go to https://appstoreconnect.apple.com/apps → **+** → **New App**
2. Fill in **exactly**:

| Field | Value |
|---|---|
| Platforms | ☑ iOS |
| Name | `Creator Football: Club Manager` |
| Primary Language | English (U.S.) |
| Bundle ID | `com.creatorfootball.app` (in the dropdown after Step 5) |
| SKU | `creator-football-1` |
| User Access | Full Access |

3. Click **Create**.

> Bundle ID missing from the dropdown? Step 5 didn't complete. Finish it first.

---

## Step 7 · Push the listing text (2 min) 🤖

1. Go to https://github.com/Wrexist/Creatorfootball/actions/workflows/appstore-metadata.yml
2. **Run workflow** → leave *include screenshots* unticked → **Run**.

This fills in the name, subtitle, keywords, description, promotional text,
support/marketing/privacy URLs, categories, copyright and review notes — all
from the repo, all pre-checked against Apple's character limits.

---

## Step 8 · The five things the API cannot set (15 min) 🧑

In App Store Connect, open your app. Work down the left sidebar.

### 8a · Age rating → **4+**

**App Information → Age Rating → Edit.** Answer **None / No** to every
question. There is no violence against people, no gambling, no chat, no
user-generated content and no web access in this game. Full table:
`docs/APP_STORE.md` §3.

### 8b · App Privacy → **Data Not Collected**

**App Privacy → Get Started.** Answer **No, we do not collect data from this
app**. Then **Publish**.

> This must stay true. The game has no accounts, no ads, no analytics and no
> crash SDK, and your privacy page says exactly that. Apple cross-checks the
> two, and a mismatch is a 5.1.1 rejection.

### 8c · Pricing → **Free**

**Pricing and Availability** → Price: **Free** (USD 0). Availability: leave
all countries selected.

### 8d · App Review contact 🧑

**In the version page → App Review Information.** Your name, a monitored email
and a phone number. Deliberately not in the repo — it is your personal contact
detail, and the repo is public.

Tick **Sign-in required? No** (the game has no accounts).

### 8e · Screenshots

Claude has generated eight candidates at the exact required size. To use them:

1. Have Claude run `pnpm shots:store` (or run it yourself) — output lands in
   `tools/release/store-shots/`.
2. Pick your favourites, rename them `01_…` to `08_…` in the order in
   `docs/APP_STORE.md` §5, and put them in
   `apps/game/fastlane/screenshots/en-US/`.
3. Commit, then run the **App Store metadata** workflow again with
   *include screenshots* **ticked**.

Or just drag the PNGs into App Store Connect by hand — same result.

---

## Step 9 · Ship a build to TestFlight (30 min) 🤖 + 🧑

1. Run **iOS TestFlight** again, this time:
   - **version**: `1.0.0`
   - **submit**: **ticked** ☑
2. Wait for green (~25 min), then wait for Apple to process the build
   (5–30 min more). It appears under **TestFlight** in App Store Connect.
3. 🧑 **TestFlight → Internal Testing → +** → add yourself → add the build.
   No review needed for internal testers.
4. 🧑 Install **TestFlight** from the App Store on your iPhone, accept the
   invite email, install Creator Football.

---

## Step 10 · Play it on a real phone 🧑 — the one true blocker

This is the item no CI can ever close, and the last one standing between you
and submission. Play a full match and check:

- [ ] The glass/blur surfaces look right on a real display
- [ ] The pitch renderer holds a smooth frame rate during a live match
- [ ] Haptics feel right on decisions and goals
- [ ] The keyboard does not cover the input when naming your club
- [ ] Nothing is clipped by the notch or the home indicator

Report anything wrong and Claude will fix it, then repeat Step 9 with the
version bumped to `1.0.1`.

---

## Step 11 · Submit for review 🧑

1. App Store Connect → your app → the **1.0.0** version page.
2. **Build** section → **+** → pick the TestFlight build.
3. Check the listing text is all there (Step 7 filled it).
4. Click **Add for Review** → **Submit to App Review**.

Export compliance will not prompt you — the binary already declares
`ITSAppUsesNonExemptEncryption=false`.

**Then wait.** Apple review is typically 24–48 hours. You will get an email.

- **Approved** → status goes *Ready for Sale*. It is live. 🎉
- **Rejected** → do not panic, most first submissions get a note. Send Claude
  the exact rejection text and it will map it to the guideline and fix it.

---

## After launch

- **Promotional text** can be changed any time, with **no review**: edit
  `apps/game/fastlane/metadata/en-US/promotional_text.txt` and run the
  metadata workflow.
- **Name, subtitle and keywords** only change with a version update — batch
  them with releases.
- **After two weeks**, check App Store Connect → **Analytics → Search Terms**
  and prune keywords with zero impressions. `docs/APP_STORE.md` explains the
  ASO reasoning behind every current choice.

---

## Quick reference — the four secrets

| Secret | Where it comes from |
|---|---|
| `APPLE_TEAM_ID` | developer.apple.com → Membership details |
| `APP_STORE_CONNECT_KEY_ID` | App Store Connect → Integrations → the key row |
| `APP_STORE_CONNECT_ISSUER_ID` | Same page, top of the Team Keys section |
| `APP_STORE_CONNECT_API_KEY_BASE64` | `base64 -i AuthKey_*.p8` |

## Quick reference — the two workflows

| Want to… | Run |
|---|---|
| Test the setup safely | **iOS TestFlight**, submit **off** |
| Ship a build to testers | **iOS TestFlight**, submit **on** |
| Update store text | **App Store metadata**, screenshots off |
| Update screenshots | **App Store metadata**, screenshots on |
