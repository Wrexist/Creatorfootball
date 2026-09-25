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
