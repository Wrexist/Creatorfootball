# Creator Club membership — implementation and launch checklist

Status: implemented locally; not a launched subscription. Public release remains held for the owner's children's-compliance review. Existing one-time purchases remain separate.

## Benefits delivered in code
- First Lights library: eight alternate commentary lines and six story variants from real events. Original fictional copy; simulation metadata unchanged. Users can enable/disable the issue. Access stops when verified membership expires; saved history remains.
- Aurora and Copper dusk: two member-only lighting configurations for the actual interactive campus renderer.
- £25,000 in-game club funds per UTC calendar month per career, claimed manually during a verified paid period. No real cash value. Trial excluded.
- Choose Mika Sol (analyst) or Remi Vale (community filmmaker), one collaboration per UTC calendar month per career. Four in-game weeks, zero retainer. These are real creator entities handled by existing creator gameplay, not guaranteed follower/revenue multipliers. Trial excluded.
- Claimed funds and signed collaboration state survive subscription expiry. Unclaimed benefits do not accumulate. Library access is rented; the three one-time collections remain permanently owned if separately purchased.

The cash amount is an initial balancing value, not an evidence-based revenue optimum. Test its value against transfer/wage costs before live pricing. Local ledger permanent keys prevent ordinary reload/time-advance duplicate claims. Local saves are deliberately not an account-wide anti-tamper system: restoring an old backup or modifying device data can bypass a local claim history. No backend or Supabase was added.

## Products to configure and qualify before enabling live sales
One membership level / Apple subscription group; all plans share benefits:
- cf_creator_club_weekly: USD1.99, P1W, no intro.
- cf_creator_club_monthly: USD4.99, P1M, no intro.
- cf_creator_club_yearly: USD29.99, P1Y, 7-day eligible free trial.
RevenueCat entitlement: cf_creator_club; named offering: creator_club. Keep the current one-time offering unchanged. Android product IDs use matching IDs with standard auto-renewing base plans. Attach only eligible 7-day free-trial offers to yearly.

App reads store-localized prices and trial eligibility; no USD fallback can launch checkout. Unknown/unsupported prices or offer schedules disable checkout. Android purchases the exact displayed eligible option. Store verification is required for access; claims require a fresh server response, matching career, and writable local save. Expiry is checked on foreground and periodically. Restore/manage/terms/privacy links are present.

## Monthly publishing obligation
First Lights (September 2026) is the only released issue in the local manifest. No October/future issue is claimed as delivered. Add and validate at least one real issue each calendar month before launch promises are fulfilled. Ship authored content via app update, append its manifest entry, validate story tokens and simulation invariants, test all packs together, inspect at phone sizes, and update release notes. Current library pipeline does not remotely download new issues.

## Required release gates
- Configure draft Apple/Google products, trial, subscription group/base plans, RevenueCat offering and entitlement; verify against this catalog.
- Publish matching subscription terms only after review; existing hosted terms still describe one-time purchases. Do not enable real sales first.
- Complete the owner's outstanding children's data/consent review. No certification or public submission is authorized by this change.
- Native sandbox/TestFlight/Play tests: eligible/ineligible trial, purchase, pending/Ask to Buy, cancellation, restore, renewal, refund/revocation, expiry, offline/reconnect, store-account switching, plan changes, save failure, reinstall, and both reward claims.
- Review storefront marketing/age-rating disclosure for the new gameplay benefits.
- Actual store trials and revenue measurements remain unverified. No claim of improved conversion or completed native purchase qualification.

## Verification on September 24
- `pnpm test`: 62 engine suites / 756 tests and 30 app suites / 255 tests passed (1,011 total).
- `pnpm typecheck`: all workspaces passed.
- New tests cover paid versus trial claims, permanent monthly deduplication across JSON reload and game-time advancement, real creator contracts, verified membership/expiry/revocation, cancelled/pending checkout, stale callbacks, shared purchase locking, localized prices, exact Android trial/base-plan selection, and library metadata isolation.
- Chrome inspection at 393x852: actual store card and membership sheet; prices and checkout correctly unavailable in the web build. Screenshot: `artifacts/expansion/screenshots/creator-club.png`.
- Native sandbox transactions were not performed. No store products were published and no public release was submitted in this change. Local `docs/terms.html` and `website/terms.html` now describe the membership; hosted terms have not been published by this change.
- No formatter command is configured in the repository; the actual ESLint check is used without weakening rules.
- Final `pnpm lint` and `pnpm build`: passed. Existing large-chunk warnings remain for the lazy 3D renderer and engine; no build limits were relaxed.
- Browser regression: career flow, store-unavailable state, plan selection/close, pack persistence, local backup/restore, four GLB imports, 130 formation/viewport/text combinations and eight isolated edge-state fixtures passed. Real device purchase qualification remains a separate release gate.
