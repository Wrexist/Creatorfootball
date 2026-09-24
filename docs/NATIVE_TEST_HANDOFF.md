# Native test handoff — September 24, 2026

Use the repaired 1.0.16 build. This checklist records work that automation has **not** certified. Keep the public-release and children's-compliance hold in place.

## Install and preserve the career

- Android: use the previously approved Google account and [internal-test invitation](https://play.google.com/apps/internaltest/4701630808819754067). Check that the installed version is **1.0.16 (4)**. Play propagation may delay the update.
- iOS: update Creator Football through TestFlight when **1.0.16 (10)** finishes processing. Build 10 restores the original CF crest; build 9 has the gameplay repairs but the superseded icon. Do not assume the old 1.0.15 build contains the fixes.
- Export a career using the existing local save controls before any destructive test. Updating should preserve the current career; do not uninstall or clear app data to test an ordinary update.
- Record device model, OS, installed version/build, and the result of each check below. Do not place receipts, purchase tokens, account credentials or private customer IDs in public GitHub issues.

## Actual purchase qualification

Use a store sandbox/test checkout. For Google Play, internal-track membership alone is not evidence that checkout is free: verify the account's license-testing configuration and the test payment sheet before confirming. Stop if checkout would create an unintended real charge.

| Case | Expected result | Evidence still needed |
| --- | --- | --- |
| Load the store | Club Nights, Heritage and Creator Stories show the store's localized one-time price and accurate contents | Screenshot from each native platform |
| Cancel checkout | The store closes normally; no ownership or content is granted | Native result and unchanged entitlement |
| Complete test checkout for each pack | Correct pack becomes owned once; store receipt is recorded by RevenueCat | Store and RevenueCat sandbox transaction, matching entitlement |
| Enable/disable owned content | Saving state remains visible until the local preference persists; next launch preserves the choice | Restart and pack-content check |
| Restore purchases | Owned packs return without another charge; unowned packs stay locked | Native restoration and entitlement result |
| Pending approval, where supported | Pending status is clear; access waits for approval; approval updates ownership | Store test flow and entitlement update |
| Refund/revoke a sandbox purchase | Ownership refresh removes paid access without damaging the career | Store event, RevenueCat event and in-app state |
| Temporary network loss | The app explains unavailable checkout/restore and recovers on retry | Device recording; local career remains usable |

Never use manually granted or mocked ownership as evidence that the store transaction path works. Existing automated pack tests qualify presentation and state handling only.

## Physical-device gameplay and accessibility

1. Update an existing save, restart the app, and verify club, lineup, week and balance are preserved.
2. Scroll manager selection and tactics with normal and larger text. Check that edge blur does not hide reachable actions or player labels.
3. Swap players and bench/reserve selections. Reload and verify the actual lineup persists.
4. Play a match, pause, change speed, substitute, finish, then inspect club reactions and finances. Confirm no repeated finance application after reload.
5. Check reduced motion/effects, native Back/sheets, VoiceOver or TalkBack reading order, focus and button names.
6. Use the game for a sustained session, including the 3D stadium. Record visible stutter, memory-related termination, unusual heat and battery impact; emulator results do not establish phone performance.

## Release gates

The publisher's children's-compliance review, operational purchase-data deletion test, Apple first-IAP review assets, current listing galleries, and Google's required closed-test period remain separate gates. Completing this checklist does not accept or certify legal declarations.
