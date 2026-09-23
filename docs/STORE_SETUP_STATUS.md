# Store launch setup status

## Approved launch configuration

- Free game: Creator Football: Club Manager, `com.creatorfootball.app`.
- One-time non-consumables: Club Nights (`cf_club_nights`) USD 1.99; Heritage (`cf_heritage_collection`) USD 2.99; Creator Stories (`cf_creator_stories`) USD 1.99. Store-localized prices.
- Careers remain local. RevenueCat handles anonymous native purchases; no Supabase or cloud-save account.
- Google Play intended audience: all ages, including children (explicit owner decision). Public support: `deeplifesimulator@gmail.com`. The corresponding console fields are still pending.
- Complete App Store Connect, Google Play, then RevenueCat, in that order.

## Verified console progress

- Apple app record: `6806328810`, iOS 1.0 Prepare for Submission. Existing screenshots and metadata require reconciliation with the current app. No build attached to the version when inspected.
- Apple non-consumables created: Club Nights `6814958536` (USD 1.99), Heritage `6814962294` (USD 2.99), Creator Stories `6814963093` (USD 1.99). Price schedules, English (US) localizations and all-territory availability configured. Review notes entered; verify persistence of those notes at final review. Review screenshots still required: the 393 x 852 QA capture was rejected for dimensions.
- Apple version reviewer contact and corrected review notes saved (Save became disabled). Promotional text now accurately describes free gameplay and optional packs rather than claiming an already-live season or world-first status.
- Google Play draft created after explicit approval of developer-policy and export declarations. Developer account `5339927053323856680`; app `4975715571837045585`. English (US), free game, package above.
- Google Play shows a production-access gate: closed release, at least 12 testers, at least 14 days. This is not yet satisfied.
- RevenueCat Creator Football project created: `00d00c7a`. Three matching entitlements created; products and offering still need store app configurations and credentials. No subscriptions were created.
- Apple App Privacy updated and verified as Data Not Linked to You: User ID and Purchase History, used for App Functionality and Analytics, not tracking. RevenueCat's anonymous identity remains separate from local career saves.
- Apple free base-game price and all-territory availability configured. Country-specific game licence requirements (including China/Vietnam) must be resolved or those territories excluded before release.
- Google blocks product creation until a billing-enabled binary is uploaded. Local merged Android manifests include `com.android.vending.BILLING`; no advertising-ID permission found. Five declarations saved: no ads, no advertising ID, non-government, no financial services, and no health features. App-content screen verifies five declarations still require action: privacy policy, reviewer access, content rating, target audience, and data safety.
- Owner explicitly approved reusing RevenueCat's existing Apple purchase key `75QF6982M6` and API key `6G4R6WL94Y` for Creator Football. Apply and verify this connection when Chrome control resumes; it has not yet been applied. No credential values were read or exported. Do not request this same approval again.

## Required remaining work

1. Finish the three Apple non-consumables with valid review screenshots and verify review-note persistence. Prices, localizations and availability are already configured as recorded above.
2. Reconcile app metadata, actual screenshots, privacy disclosures, age rating, free app price and availability. Reviewer contact supplied by the owner in chat is authorized for App Review only; do not publish it in repository metadata or the public listing.
3. Reuse the existing GitHub iOS TestFlight workflow to build the updated source, qualify StoreKit purchases and restoration, then submit the complete version and purchases for review. The remote repository already has macOS signing/upload infrastructure and all four signing-secret names; a physical Mac is not required. The local asset branch lacked that workflow, which initially concealed this route.
4. Complete Play listing, app content and accurate data-safety declarations; create one-time products; upload signed billing-enabled AAB; run internal and required closed testing.
5. Finish the existing RevenueCat project `00d00c7a`: connect both stores with owner-approved credentials, attach products to the three existing entitlements, add the default offering, install public SDK keys in ignored local configuration and GitHub variables, and qualify native transactions. Do not create a duplicate project.
6. Verify localized prices, cancellations, pending purchases, unlocks, offline cache, same-platform reinstall restoration and refunds. Mock tests and a debug APK do not establish live-store readiness.

## Previous interruption (resolved September 23)

Historical note: Chrome initially recovered through a fresh tab, then timed out at initialization. Chrome control recovered September 23; see the current update below. A full runtime reset, browser inventory and a new RevenueCat Chrome tab all failed. No store-console mutations occurred after the Apple-key approval. No app release was published; the three-console setup remains incomplete. Local and GitHub release work continued while this connection was unavailable.

## Existing iOS build infrastructure (verified remotely)

- GitHub workflow: iOS TestFlight, ID `344715621`, `.github/workflows/ios-testflight.yml`.
- Successful run: https://github.com/Wrexist/Creatorfootball/actions/runs/34063109215
- Source: `claude/stt-production-hardening-3lrw2t`, commit `b8a1784589b72e78fdcfffbd839c4d6f0df4b42c`.
- Apple TestFlight: version `1.0.14`, build `6`, uploaded September 7, 2026 local time. This predates the current local changes.
- Existing secret names (values not accessed): `APPLE_TEAM_ID`, `APP_STORE_CONNECT_KEY_ID`, `APP_STORE_CONNECT_ISSUER_ID`, `APP_STORE_CONNECT_API_KEY_BASE64`.
- Workflow performs validation on Ubuntu, archive/sign/export on macOS 26, and optional TestFlight upload. Preserve this route and add the new RevenueCat release gate before publishing a purchase-enabled build.
- Restored the workflow and build-number helper into the current local branch, pinned workflow actions to the same revisions used by the local CI, and added the iOS RevenueCat production-build gate. Syntax checks passed for the helper and workflow YAML. No new cloud build was dispatched yet; the public RevenueCat SDK key is not configured.
- Google Play public support email explicitly supplied by owner: `deeplifesimulator@gmail.com`. It has not yet been entered in the console. All ages, including children, is now approved. The separate Apple reviewer contact remains private.
- Latest connection attempt: both the prepared RevenueCat tab inspection and the fresh browser inventory timed out and reset the browser-control session. No store-console mutation was attempted after the credential approval.

## Work completed during the browser interruption

- Updated and published privacy/support/terms pages using the approved public contact, accurate local-backup instructions, RevenueCat purchase processing, and the distinction between fictional social content and public messaging. Both `docs/` and `website/` copies were updated. GitHub's actual Pages source is `Main:/docs`, not the local workflow's assumed source. Public-site commit `125adc576c76cf0544f2abd2679561b6384c4d23` was pushed in an isolated worktree; GitHub reports its Pages build succeeded. The app's large in-progress source tree was not included in that commit.
- Prepared accurate Apple and Google listing files under `apps/game/fastlane/metadata/`. Character limits checked. These text drafts have not yet been pasted into the store consoles.
- Added `.github/workflows/android-release.yml` for a signed AAB with explicit versions, the RevenueCat release gate, signature verification and no automatic Play publication. Added Gradle version/signing validation. This is locally prepared infrastructure, not evidence of a signed release run.
- Prepared [Play declarations and all-ages review](PLAY_CONTENT_DECLARATIONS.md). Child-directed SDK suitability and real store transactions remain unverified; no Families compliance certification was submitted.

## Latest verification

- Published privacy, support and terms URLs each return HTTP 200 and the approved public contact. Both Pages workflows report successful deployment of site commit `125adc5`.
- Repository lint, typecheck, all 970 tests (746 engine + 224 app), and production build pass. Existing large-bundle advisories remain; no thresholds were changed. Browser visual checks could not be repeated while CUA was unavailable.
- Android Gradle evaluates normally with qualification defaults. Explicit store-release mode without a keystore fails as intended. The workflow's strict certificate-verification command passed against an isolated non-production signing fixture; this is not a signed app or store receipt.
- Workflow YAML, listing character limits, public-page HTML/relative links and whitespace checks pass. Updated iOS release-number resolution refuses missing App Store Connect access without emitting a fallback number; the workflow propagates that failure.
- New release workflow and listing changes remain in the local asset branch. Only the six public website files were committed/pushed. No new TestFlight or Google Play build was uploaded in this continuation.


## Current update ? September 23, 2026

This section supersedes the earlier interruption and pending-configuration notes above.

- Chrome control recovered; App Store Connect, Google Play and RevenueCat are accessible.
- RevenueCat Apple app `appa8fc37098f` is saved for `com.creatorfootball.app`. Both previously approved existing Apple keys show **Valid credentials**. No private key material was exported.
- Imported Apple products and attached each to its matching entitlement: Club Nights `prod2616c746e2`, Heritage `proddbf1f01906`, Creator Stories `prod197d3c7abd`. The imported Apple metadata status still needs completion; import alone is not review readiness.
- Default offering `default` (`ofrngbad2922418`, Creator Football collections) contains three custom packages using the matching product identifiers. Each currently has its Apple product; Android products remain pending the first billing-enabled AAB.
- RevenueCat Android app `app23adbee5c3` is saved with package `com.creatorfootball.app`. Google service-account credentials have NOT been connected.
- Both public SDK keys are configured in ignored `apps/game/.env.local` and GitHub Actions variables `VITE_REVENUECAT_IOS_KEY` / `VITE_REVENUECAT_ANDROID_KEY`. No private credential is committed.
- Applied RevenueCat's Apple server notification endpoint. App Store Connect visibly confirms the endpoint in BOTH Production Server URL and Sandbox Server URL. No notification/transaction has yet been received.
- RevenueCat restore policy currently reads Transfer to new App User ID; sandbox entitlements allowed for Anybody. Inspected without changing these defaults.
- Apple English (U.K.) description updated from the prepared accurate listing; private reviewer contact re-entered and saved. Club Nights review-note persistence verified. Review screenshots and a qualified current native build remain required.
- Google privacy URL saved successfully. Public support email `deeplifesimulator@gmail.com` and HTTPS support URL `https://wrexist.github.io/Creatorfootball/support.html` saved successfully. No public phone number supplied.
- Google reviewer access remains unsubmitted: optional paid packs mean access is restricted, and the current form requires full reviewer access without purchasing. Do not falsely declare unrestricted access or certify a non-working review method. The target-audience form is blocked behind this declaration.
- All-ages intent remains the owner's choice; Families and data-safety verification, IARC, signed Android release, store products and purchase qualification are still outstanding. The mandatory 12-testers/14-days production gate remains outstanding.
- Production build with `CF_PURCHASE_RELEASE_PLATFORM=ios` passed after configuring the real public SDK key. Existing bundle-size advisories remain. This is a web build/release-gate check, not a native transaction test.
- No new TestFlight build or signed Play release has been uploaded and no public launch has occurred.
- Google Sports game category and English (US) title/short/full description saved as drafts. Required listing artwork and screenshots are still missing. Public-site CI and both Pages deployments are successful.
- Created isolated Google Cloud project Creator Football Billing (`creatorfootball-billing`) without attaching a billing account. No service account, private key or Google Play access grant has been created yet.
- Prepared (not created) service account `revenuecat-creatorfootball@creatorfootball-billing.iam.gserviceaccount.com`. Waiting for explicit approval of Google credential creation/upload and Creator Football-scoped Play purchase/order/product access plus isolated-project Pub/Sub Editor and Monitoring Viewer roles. Earlier Apple-key approval does not cover this new Google access.


## Google credential connection ? approved and applied September 23

- Owner approved creation of the dedicated service-account key, transmission to RevenueCat and the specified app-scoped permissions.
- Created `revenuecat-creatorfootball@creatorfootball-billing.iam.gserviceaccount.com` (unique ID `106231844541078618532`). Google Cloud confirmed policy update for Pub/Sub Editor and Monitoring Viewer in `creatorfootball-billing` only. No impersonation principals added.
- Google Play shows this service account **Active**, with access to Creator Football only. Selected read app information, financial/purchase information, order/subscription management and store presence. Google automatically includes read app-quality information and policy declarations as dependencies of these bundled roles. No admin, release-publishing, test-management, review-response or all-app account grant selected.
- Generated one JSON key and uploaded it directly through RevenueCat's file chooser. The private contents were not printed or committed. Local backup moved out of Downloads/repository into the access-restricted user directory `.creatorfootball/credentials`.
- RevenueCat credentials validation currently needs attention. Android Publisher, Play Developer Reporting and Pub/Sub APIs still need activation; the activation page explicitly incorporates API terms. Separate action-time approval requested for those terms; do not treat the earlier credential-access approval as acceptance of these new API terms.
- Google purchase verification, product import and real-time notifications are NOT yet qualified. No transactions or release were published.
- Owner explicitly approved accepting terms and enabling Android Publisher, Play Developer Reporting and Pub/Sub APIs. Android Publisher activation verified as Enabled; remaining activations/validation in progress.
- All three approved APIs are now verified Enabled. RevenueCat can read the in-app product catalog and subscription/base-plan catalog. Remaining validation error is package name not found (first billing-enabled Android AAB not uploaded). RevenueCat generated and connected topic `projects/creatorfootball-billing/topics/Play-Store-Notifications`; Play notification configuration/test in progress.
- Play saved real-time notifications with all one-time products and voided purchases. RevenueCat shows Connected to Google and the generated subscriber exists. Actual Play test notification FAILED. Topic IAM has Owner and RevenueCat Pub/Sub Editor but lacks Google Play notification sender Publisher. Prepared topic-only Pub/Sub Publisher grant for `google-play-developer-notifications@system.gserviceaccount.com`; separate approval requested before Save because this is a new principal. Do not claim notification delivery works yet.

## Google notification delivery verified — September 23, 2026

- Owner explicitly approved the Google-owned notification sender's topic-only Publisher grant. Applied and verified `google-play-developer-notifications@system.gserviceaccount.com` under Pub/Sub Publisher on `projects/creatorfootball-billing/topics/Play-Store-Notifications`; no project-wide grant added.
- Retried the Play Console test notification after the policy update. RevenueCat now visibly reports **Last received 2026-09-23, 7:04 a.m. UTC** and **Connected to Google**. The earlier delivery failure is resolved.
- Play notification content remains subscriptions, voided purchases and all one-time products. Tracking new purchases not yet seen by the SDK remains disabled.
- All three approved APIs are enabled. Google catalog-read validation passes. Purchase validation still reports package name not found until the first billing-enabled Android build is uploaded. Successful test-notification delivery does not establish real purchase, refund or restoration correctness.

## Signed launch candidate — September 23, 2026

- Created a retained RSA-4096 Android upload key outside the repository. Its password is stored locally using Windows user/machine encryption; signing material is restricted to the local credentials directory and encrypted GitHub Actions secrets. No private credential is committed.
- Configured all four Android signing secrets for the release workflow. Both real public RevenueCat SDK keys were already configured as GitHub variables.
- Built Android `1.0.15 (1)` with the production purchase-key gate and passed `bundleRelease lintRelease` (five app warnings, zero errors). Strict JAR signature verification passed against the retained upload certificate.
- Release manifest confirms `com.creatorfootball.app`, target API 36, Billing Library 8.3.0, no advertising-ID permission and automatic backup disabled.
- AAB SHA-256: `DB20153BBC542B38073149E0E71F89ED8BC5FAF02C4BB212075BD839C044208B`. Artifact is retained locally under `artifacts/store-launch/android-1.0.15-1/`.
- Source is being preserved on `codex/launch-candidate-20260923`. Play upload, current TestFlight processing and native transaction qualification are still pending; no public launch has occurred.
