# Release readiness — 25 September 2026

The owner approved the game/build and subsequently reported testing a TestFlight sandbox subscription, Restore membership and reward unlocks. This is owner-reported device evidence, not an independently observed transaction or completion of every billing edge case. It is distinct from the previously held children's-compliance certification. No public release is claimed.

## Prepared

- iOS 1.0.16 (12) processed, assigned to existing internal TestFlight groups, selected in the distribution draft. Manual release selected.
- Android 1.0.16 (5) available in the existing internal test track.
- RevenueCat annual/monthly/weekly offerings mapped on both stores. Native screenshots verify Apple price loading, not transactions.
- Apple subscription review screenshots uploaded for all three periods, with notes identifying the owner's build-11 native capture and build-12 layout changes. App version, subscription group, all three plans and Club Nights are staged in a six-item review draft; final submission remains outstanding.
- Featuring nomination submitted: `1df9e9d4-e227-4c86-b982-d09d7048621f`, earliest-approved-release intent, provisional 25 September–4 October window.
- New reward celebrations passed local and hosted app checks. iOS 1.0.16 (13) uploaded successfully in run 36127001078; Apple UI shows Processing at 13:15 CEST. The certificate-cap repair passed archive, cloud export, distribution signature/profile verification and upload. No certificate revoked. Build 12 remains in the review draft until 13 finishes processing and is selected. See `MEMBERSHIP_REWARDS_20260925.md`.
- Existing superstar terms moved from below the page footer into the membership section in both terms pages; wording unchanged.

## Outstanding gates

1. Children's compliance: review RevenueCat's SDK/data processing, applicable consent requirements, purchase presentation and deletion process for the selected all-ages audience. The publisher's explicit hold remains. No Families compliance certification has been submitted.
2. Google dashboard shows 9/11 setup tasks complete, with Target audience and Data safety outstanding. The current Data safety draft declares purchase history for app functionality and analytics, encrypted in transit, not ephemeral, and no game accounts. Final review/certification is pending.
3. Google production access requires a closed test with at least 12 enrolled testers for 14 continuous days; dashboard currently shows zero. Internal testing is a separate track. Real testers and elapsed time cannot be substituted with automated tests.
4. Owner reports sandbox purchase, restore and rewards tested. Cancellation, trial conversion, expiry/refund and native repeat-claim behavior are not independently evidenced. Reward UI integration tests use explicitly isolated billing/persistence doubles; the new native celebration build remains pending.
5. Apple reviewer contact fields appear empty in browser inspection, but Add for Review passed without a missing-contact validation error. Do not equate the browser representation with definitive evidence of missing server data.
6. Final Apple product attachment/submission validation, remaining review assets and tablet screenshot accuracy still need completion. Do not delete existing iPad assets without specific irreversible-delete approval.
7. Maintain the promised monthly membership content cadence after release.

## Technical privacy evidence

The inspected app uses anonymous RevenueCat configuration, local career saves and no production remote analytics sink in its app analytics module. No game account, Supabase or advertising SDK integration was identified in the inspected app dependencies. RevenueCat purchase analytics still constitutes data processing. These observations are technical evidence, not a children's-law certification or proof of every native SDK's network behavior.

Primary references:

- [RevenueCat Google Data safety guidance](https://www.revenuecat.com/docs/platform-resources/google-platform-resources/google-plays-data-safety)
- [RevenueCat Apple privacy guidance](https://www.revenuecat.com/docs/platform-resources/apple-platform-resources/apple-app-privacy)
- [Google Families requirements](https://support.google.com/googleplay/android-developer/answer/9893335?hl=en)
- [Google testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465)

Next release action: resolve the held compliance review and native billing evidence, finish console validation, then submit for store review. Store approval and public availability must be verified separately.

Deployment verification: Pages run 36122345350 rejected the release branch under existing github-pages environment protection. Terms layout is committed, not deployed. Use the repository's approved main-branch review/merge path; do not weaken environment protection. Google Data safety preview explicitly disables submission until Target audience and content is completed.
