# Membership reward celebrations — 25 September 2026

Implemented five presentations: trial welcome, paid welcome, saved club funds, saved superstar signing, and saved creator collaboration. The purchase store returns a verified active membership only after a completed checkout; cancellations, pending transactions, absent entitlements and failed verification return no welcome event. Refresh and restore do not replay purchase celebrations.

Paid welcome describes claimable rewards, not credited rewards. Trial welcome covers library/lighting and explicitly excludes paid career benefits. Career reward reveals follow the engine claim, application to the current career and successful persistence. Duplicate and failed-save paths do not celebrate. No reward values, subscription prices, entitlements or simulation formulas changed.

Presentation includes a brief card entrance, 14 finite gold particles, settings-bound sound/haptics, immediate dismissal, trapped focus and a fixed bottom action. System/in-game reduced motion and reduced effects remove animations. No new art downloads or animation dependency. The coin uses the current club crest; the creator uses the same deterministic portrait mapping as the paywall.

Validation:
- Typecheck, lint, production build passed; existing bundle-size advisory remains.
- Engine: 758 tests passed. Game: 262 tests passed.
- Focused store/identity suite: 16 passed after shared portrait helper change.
- UI fixture: all five presentations at 360/393/430 × 852, CTA visibility, focus containment, dismissal, trial copy, reduced motion/effects.
- UI integration with explicit billing/persistence doubles: all three real engine claims, duplicate prevention, trial exclusion, failed-save suppression. This does not substitute for native sandbox billing.
- Screenshots visually inspected: artifacts/membership-rewards/{paid,trial,cash,superstar,creator}-393.png.
- Fixture lives under e2e and is not included in the production build. Run a Vite dev server on 5193, then `node apps/game/e2e/member-rewards.mjs` from repository root.

Owner reported native sandbox purchase/restore/rewards tested before this change. New native celebration behavior still requires the replacement TestFlight build. Apple public release has not occurred; the existing Google children’s-compliance hold remains.

Full production browser regression passed: startup/routes, complete career and live substitution/result persistence, collection/store/local backup/3D controls, media stability, 130 formation/viewport/text combinations, and eight isolated edge-state fixtures. Source commit: a93da32. Replacement iOS TestFlight workflow: https://github.com/Wrexist/Creatorfootball/actions/runs/36125854210 (dispatched with upload enabled; do not call it uploaded until the archive/upload job succeeds).

Initial upload run 36125854210 passed all verification but failed archive at the Apple Development certificate cap (build number 13 reserved by the helper, not uploaded). No certificates revoked. Workflow changed to unsigned intermediate archive plus mandatory cloud distribution export/signature verification; replacement run required.

Replacement workflow: https://github.com/Wrexist/Creatorfootball/actions/runs/36127001078 at commit 7629279. Pending hosted validation of the certificate-cap repair.

Apple Heritage screenshot preparation: artifacts/store-launch/review/heritage.png is a 1179x2556 RGB resize of the actual paid-pack QA sash-kit screenshot. Two UI upload attempts returned Apple's "There was an error uploading your screenshot. Try again later." No screenshot is confirmed attached, no product review submission added, and modified notes were not confirmed persisted. Do not claim Heritage complete.

## Final native upload evidence

Run 36127001078 succeeded. Source 7629279 includes reward UI a93da32. Xcode archived 1.0.16 (13), exported via cloud signing, passed the new distribution signature/profile gate, and uploaded to Apple successfully at 11:16 UTC. App Store Connect's Build Uploads UI independently shows 1.0.16 (13), Processing, created 25 September 2026 13:15 CEST. Thus the certificate-cap repair is validated for this app; no certificates were revoked. Apple processing/tester assignment and selecting 13 in the review draft remain separate steps. Build 12 is still the staged review binary; public release has not occurred.
