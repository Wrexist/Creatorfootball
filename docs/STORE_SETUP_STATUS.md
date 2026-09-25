# Store launch setup status

## Original icon restoration - September 24, 2026

This section supersedes the earlier build 3/9 checkpoint below. Source `4eeaa14` restores the owner's original metallic CF crest across native, web and onboarding icons. See [the restoration report](ICON_RESTORATION_2026-09-24.md) for provenance, file scope, artifact hashes and verification.

- Android **1.0.16 (4)** is active on the existing internal track, available to internal testers September 24 at 18:16 local time. The signed bundle contains the restored icon. Tester access is unchanged.
- iOS **1.0.16 (10)** uploaded successfully at 16:28:06 UTC through [workflow 36025668401](https://github.com/Wrexist/Creatorfootball/actions/runs/36025668401). All checks passed, including 998 tests and browser flows. The downloaded IPA's version, build, bundle and actual packaged icon were verified. Apple currently reports processing.
- Google Play's CF listing icon and its original AI-artwork attribution were saved. The listing remains ready to send for review; no public submission was made.
- App Store Connect login is restored. Version 1.0.16 is **Prepare for Submission**, with manual release selected. The old build was detached pending corrected build 10. Build 9 completed processing but contains the superseded icon.
- The owner's children's-compliance hold, native commerce qualification, physical-device testing, first-IAP review assets, gallery refresh and required Google closed testing remain open. No public release or legal certification was submitted.

## Test-release continuation — September 24, 2026

This section supersedes the September 23 test-build versions below. **Public release and the owner's children's-compliance hold are unchanged.**

- Android **1.0.16 (3)** is active on the existing internal test track. Google Play visibly reports it available to internal testers, released September 24 at 17:34 local time. Only the previously approved tester email list remains selected; no additional tester groups were enabled.
- The bundle was built from `85c72e1` (the same implementation as qualified source `2a926c3`) with the Android production purchase-key gate, the retained upload key, release lint and strict signature verification. Five existing lint warnings and zero errors. The merged release manifest confirms version 3, Billing permission, no advertising-ID permission, and automatic backup disabled. Play's only rollout warning is the absent deobfuscation file; native code minification is disabled in this build.
- Android artifact: `artifacts/store-launch/android-1.0.16-3/creator-football-1.0.16-3.aab`; SHA-256 `66CB42D96A7FA67F4BE4E553E9DD7C500E07F841DF8F940C8843B7EF1A5170E2`. Build/signature evidence is alongside it. A first local build hit the previously documented Windows Gradle transform-cache rename issue; the build using the regular cache passed without changing source or disabling checks.
- iOS **1.0.16 (9)** uploaded successfully through [workflow 36020470132](https://github.com/Wrexist/Creatorfootball/actions/runs/36020470132), explicitly with `submit=true`. Both jobs passed, including lint, typecheck, 998 tests, production build, browser flows, archive/signing and upload. Xcode reported `Upload succeeded` at 15:44:57 UTC. Apple's processing and tester availability have not yet been verified because the browser requires sign-in.
- iOS artifact: `artifacts/store-launch/ios-1.0.16-9/creator-football.ipa`; SHA-256 `2C242F3ED718ECAB385FDDA0060064FDA251B6992A546E7FA56FF26759FA13E4`. The downloaded IPA's Info.plist confirms bundle `com.creatorfootball.app`, version `1.0.16`, build `9`, and its packaged assets contain the repaired engine. The workflow log and result are retained beside the IPA.
- App Store Connect's Chrome login expired. The owner has been asked to sign in again. This blocks browser-only listing, first-IAP review-image and build-selection work, but not the existing authenticated signing/upload workflow.
- RevenueCat was rechecked: Apple purchase/API credentials and Google credentials are valid; Apple server notification configuration is correct; Google remains connected with its September 23 test notification received. The default offering still maps all three packs to both store products. No sandbox transaction has been recorded; real purchase/restore/refund qualification is not claimed.
- Use [the native test handoff](NATIVE_TEST_HANDOFF.md) for the remaining device and commerce checks. Store listing images, Apple first-IAP review assets, operational purchase-data deletion, the compliance review and required Google closed testing remain open. No public release or legal certification was submitted.

## Current launch checkpoint - September 23, 2026

This checkpoint supersedes all historical pending notes below. **The game is not publicly launched. The owner has explicitly held the children's compliance certification for review.**

| Area | Verified state | Remaining gate |
| --- | --- | --- |
| iOS | `1.0.15 (8)` uploaded by successful [workflow 35841115481](https://github.com/Wrexist/Creatorfootball/actions/runs/35841115481); internal TestFlight groups and instructions saved; build 8 attached; App Store version added to a **Ready for Review draft**, not submitted | Native IAP review screenshots and purchase/restore/refund checks; tablet polish and replacement gallery; complete app + first IAP submission after release gates |
| Android | Signed `1.0.15 (2)` is **active on the internal track**; only the approved `deeplifesimulator@gmail.com` tester list is enabled | Native purchase tests; held audience certification and Data safety; required 12 testers / 14 days closed test |
| Google listing | Icon, 1024 x 500 feature graphic, eight current phone screenshots, English text and public contact saved; **Ready to send for review** | App-content release gates remain |
| Google content | IARC questionnaire and reviewer access saved. Ratings include ESRB Everyone, PEGI 3 and Brazil 14+ as assigned by IARC. Free codes cover all three packs, with two backups per pack | Intended all-ages audience remains unchanged, but step 2 publisher certification is **unchecked and on owner-requested hold** |
| Google Data safety | Complete draft saved: purchase history collected for functionality and analytics, required, non-ephemeral, encrypted in transit; no third-party sharing beyond service-provider processing; no game accounts; public deletion-request URL | Final Save blocked until audience/content is completed; operational deletion test outstanding |
| RevenueCat | Both apps show **Valid credentials**; three non-consumables, three matching entitlements, and both-platform default offering packages configured; Google test notification received | Real native transactions, cancellation, pending approval, restoration and refunds unqualified |

[Android internal-test invitation](https://play.google.com/apps/internaltest/4701630808819754067) requires the approved tester Google account. No public rollout or closed-test completion is claimed.

### Latest source and verification

- Source branch: `codex/launch-candidate-20260923`; release code `1469e54` follows the full redesign/native release commit `45827a0`.
- A real fresh-career walkthrough completed lineup selection, a played first match, post-match finances/fan effects and week-two progression. Screenshot inspection caught home/away score order being reused in club-first social posts. `1469e54` fixes only story formatting and adds four home/away win/loss regression cases; simulation and recorded scores are unchanged. Posts already saved before the fix retain their original text.
- Targeted cascade tests: 18 passed. The iOS workflow passed repository lint, typecheck, all 974 tests (750 engine + 224 app), production build, browser smoke, archive, signing and upload.
- Local Android production-key gate, `bundleRelease lintRelease` and strict signature verification passed. Five pre-existing app lint warnings, zero errors. Existing large web-chunk advisories remain. No formatter is configured.
- The signed Android workflow is committed but cannot be manually dispatched until its workflow file exists on the default branch. The qualified build 2 was produced locally with the retained upload key instead.
- iOS IPA: `artifacts/store-launch/ios-1.0.15-8/creator-football.ipa`, SHA-256 `F9FF796E1747AD98A57A6D3B037A2451A0983AE7450A09421E7248A283A284CE`.
- Android AAB: `artifacts/store-launch/android-1.0.15-2/creator-football-1.0.15-2.aab`, SHA-256 `52A475C52809CB5F82D0F3249D98E4DE0C72DEB1D6C12FD66BDB1FE4B04A6912`.
- No physical-device performance certification, paid transaction, refund, restoration, deletion-operation test or children's compliance certification is claimed.

### Apple listing and review preparation

- Owner-approved replacement completed: eight current 6.9-inch screenshots in order Home, Stadium, Live Match, Tactics, Market, Squad, Social, Training. The old 6.5-inch set was removed and now uses the current 6.9-inch images.
- Content rights saved as no third-party content, based on the original fictional game assets. China mainland and Vietnam excluded because the required game licences were not supplied; 173 app territories remain available.
- Corrected review instructions saved. Private reviewer contact remains confined to App Store Connect and is not recorded here.
- A separate 13-inch iPad gallery still contains eight old images. Tablet captures are prepared locally, but that gallery was not deleted: the earlier deletion approval covered only iPhone sets. Resolve the visual findings below before requesting its replacement.
- The version is in a review draft, not submitted. Apple's draft-submission item list displayed a transient error; complete validation again before final submission. First-release IAP review images and inclusion of all three packs remain outstanding.

### Current screenshot evidence

`artifacts/store-launch/creator-football-current-screenshots.zip` contains fourteen actual phone captures plus the Play icon/feature image and `screenshot-manifest.json`. Screens: Home, Squad, Tactics, Training, Market, Matchday, Live Match, Result, Club, Stadium, Facilities, Finances, Social and its empty state.

Phone captures use the real production web UI in Chrome at 430 x 932 CSS pixels rendered at 3x (1290 x 2796). They use a fresh career and real match progression, not injected game state. They demonstrate shared UI, **not native purchase sheets**. The Play gallery accepted eight captures. The feature graphic source is `tools/brand/play-feature.html`, using original generated stadium art and code-rendered typography. Serve the production game on `127.0.0.1:4175` and the HTML through a local server to reproduce it. Google AI labels were applied to the feature image and seven screenshots containing generated artwork; the procedural stadium scene and original vector icon were not labelled as generated raster artwork.

Nine tablet QA captures are saved separately under `artifacts/store-launch/screenshots/ipad-*.jpg` at 2048 x 2732 (1024 x 1366 CSS, 2x): Home, Squad, Tactics, Training, Market, Matchday, Club, Stadium and Facilities. They are browser responsive-layout evidence, not physical iPad certification. Inspection found two issues to correct before tablet listing replacement and final release:

1. **Repaired September 23:** Matchday lineup/bench columns now respond to their actual available width. Schematic player rows reserve space for names and positions; 768×1024 and 1024×1366 browser fixtures pass.
2. **Repaired September 23:** Stadium reputation is rounded for display while saved precision remains intact. A fractional-reputation fixture verifies the visible value.

The [mobile repair report](MEDIA_REPAIR_REPORT_2026-09-23.md) records these corrections and the 31 supplied-media findings. New evidence is in `artifacts/media-repair-20260923/`; the existing TestFlight/internal-track binaries and console galleries do **not** yet contain this repair pass. The old iPad gallery still requires replacement after native qualification.

Repair source `2a926c3` also corrects content-pack save confirmation and reduced-effects portrait rendering. Android `1.0.16 (3)` debug/unsigned qualification binaries build and pass the documented emulator gameplay checks. The [iOS 1.0.16 archive workflow](https://github.com/Wrexist/Creatorfootball/actions/runs/35864912564) is explicitly build-only (`submit=false`). These qualification outputs do not change either store's existing test-track release or the compliance hold.

### Compliance hold and reviewer access

The owner answered **"Hold for compliance review"** to Google's separate publisher certification covering the app, every API/SDK and applicable children's laws. Leave that checkbox unchecked. Do not change the intended audience or submit a public release dependent on this certification. No ads/ad ID and local career saves are technical facts, not a legal compliance determination. Review the startup RevenueCat data flow, processor terms, lawful basis/consent where applicable, deletion operation and child-appropriate purchase presentation against the signed artifacts; see [Play declarations](PLAY_CONTENT_DECLARATIONS.md).

The owner-approved promo-code and IARC agreements were accepted. Three free review codes per pack were created and placed in Google's restricted reviewer instructions (no game login); optional reuse for partner feedback was disabled. Campaigns: Club Nights `131118650`, Heritage `131123679`, Creator Stories `131123578`, scheduled September 23 to December 22, 2026. Codes and their CSV backups remain outside Git in the private credentials directory. They have not been redeemed or verified on a test phone. Do not copy them into public documentation. Renew reviewer access before those codes expire if review is delayed.

The approved Cloud/API/topic configuration remains intact. No new credential or broader access is needed. Updated signed binaries, native commerce/device qualification, compliance review, replacement tablet listing images and the mandatory closed-test duration remain release gates.

## Historical setup record

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

## Launch candidate uploaded and product wiring complete - September 23, 2026

This section supersedes the earlier pending-build and pending-product notes.

- Source commit `45827a0` is pushed on `codex/launch-candidate-20260923`. The staged source/assets were checked for private keys and reviewer contact data before committing; neither is included.
- iOS workflow [35837277259](https://github.com/Wrexist/Creatorfootball/actions/runs/35837277259) succeeded: lint, typecheck, all 970 tests, production build, browser smoke, macOS archive/sign/export and TestFlight upload. Apple processed **1.0.15 (7)** successfully. Test instructions are saved and existing internal groups remain attached.
- App Store distribution draft is now **1.0.15**, with build **7** attached and saved. It has not been submitted for review. Store screenshots, IAP review assets, rights/territory reconciliation and actual StoreKit purchase qualification remain open.
- IPA SHA-256: `1CD640075FCBC24DAE51641C7DE3150039CF2EAA8DC1B1ECD619DD2BDA813EEC`; local artifact `artifacts/store-launch/ios-1.0.15-7/creator-football.ipa`.
- Play accepted signed Android **1.0.15 (1)**. The internal release is saved as a draft; no rollout or tester list has been configured. The owner has been asked which Google account should receive internal-test access.
- All three Play one-time products are **Active** in 173 regions with a backwards-compatible `standard` purchase option. Approved USD base prices: Club Nights $1.99, Heritage $2.99, Creator Stories $1.99. Local prices are generated by Google. Multi-quantity purchases are disabled.
- RevenueCat imported these as **non-consumables**: Club Nights `prodaab0c3aa41`, Heritage `prod61a26cf2d2`, Creator Stories `prode02e0ee7e2`. Each product is attached to its matching entitlement. The default offering's three packages now each include both their Apple and Google products; saved console state verified.
- Google catalog-read validation and notification transport pass. The last purchase-validation check still reported package-name propagation trouble; product import succeeding does not qualify transactions. Recheck after the Play testing release is available.
- No public launch, native store purchase/restore/refund qualification, Families certification or required 12-testers/14-days closed-test completion is claimed.


## 2026-09-25 follow-up: native prices and fixed checkout

- Owner screenshots from TestFlight 1.0.16 (11) confirm real annual $29.99/year and monthly $4.99/month prices and eligible seven-day annual trial. This verifies product loading, not a purchase/restore/refund transaction.
- Paywall now uses a separate bottom checkout panel: three billing periods, localized selected-plan terms, purchase action and paid-reward trial exclusion. Benefits scroll independently. The funds coin crest is centered using both axes.
- Native Home launch offer waits for verified membership refresh and available products. Suppressed for members, store errors/unavailability and unsafe save states; once per runtime session, with a persisted 72-hour impression cooldown. No onboarding or match-route popup. Close remains immediately available.
- Google Play annual, monthly and weekly `standard` base plans are active, with USD base prices 29.99 / 4.99 / 1.99. Annual `trial-7-days` offer active for new subscription customers; other periods have no trial. Availability excludes Vietnam and automatic future territories.
- RevenueCat imports all three Android base plans, attaches them to `cf_creator_club` and maps them to the annual/monthly/weekly packages in `creator_club`. Apple mappings remain intact.
- Apple draft 1.0.16 currently references build 11. The sticky checkout changes require a new native build; do not claim build 11 contains them.
- Public release remains held for the owner's children's-compliance review. Apple review screenshots/metadata completion, latest native binary deployment and device transaction lifecycle verification remain release tasks.


### Follow-up verification and Android delivery

- Lint, workspace typecheck, production build and all 259 app unit tests passed. Full local browser suite passed: career, expansion/paywall fixed-footer checks at 360/393/430px, media audit, 130 formation/viewport/text combinations and eight state fixtures. Updated screenshot: `artifacts/expansion/screenshots/creator-club.png` (web preview, native purchases intentionally unavailable).
- Android 1.0.16 (5), source `51d201d`, signed bundle SHA-256 `3D2847EFF9DF1AFE86D2CC402F040A56DFFBB5C52492C0B0BC0EFCB5458FE6C2`, passed `lintRelease` and strict signature verification. Uploaded and published only to the existing internal test track; Play confirms available to internal testers on September 25. No supported-device losses reported. The sole Play warning is the absent deobfuscation file; this release does not enable R8 minification.
- New iOS pipeline: https://github.com/Wrexist/Creatorfootball/actions/runs/36115658936. Source `51d201d`; native upload status must be checked before telling the owner to install the update.

- iOS run 36115658936 completed successfully (verification and native archive/upload). App Store Connect now lists 1.0.16 (12) as Processing. Build 12 includes the sticky checkout, startup cooldown and centered funds crest; processing/tester availability remains Apple's pending step. Public submission remains held.
