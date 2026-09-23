# Native purchases: configuration and release testing

Careers stay local. There is no Supabase project, game account, cloud database or web checkout. RevenueCat manages anonymous native purchase identity, receipt verification and entitlement restoration through Apple/Google store accounts.

## Products to configure

Create these **non-consumable, one-time** products on both stores, with the exact identifiers below. Use the same identifier for the corresponding RevenueCat entitlement. Attach each store product to its entitlement, and include all three products as custom packages in the current/default RevenueCat offering. Choose prices and territories in the store consoles; the app shows each returned localized price and has no hardcoded price.

| Product and entitlement ID | Pack | Delivered content |
| --- | --- | --- |
| `cf_club_nights` | `club-nights` | Floodlit, sunset and creator-night lighting in the 3D viewer |
| `cf_heritage_collection` | `heritage-collection` | Sash, hoops and pinstripe GLB kits; antique-gold and silver trophy finishes |
| `cf_creator_stories` | `creator-stories` | 16 alternate commentary lines, 12 original media-story versions, triggered by real events |

The included Touchline Voices pack supplies eight free commentary variants. Base gameplay, classic kit, bronze trophy, football and daytime campus remain included. Content is installed with the application; purchases grant access. Enable a purchased pack in Content packs for the current career. Existing historical reports remain intact when a pack is disabled.

## Keys and identity

Copy `apps/game/.env.example` to the ignored `.env.local` and set `VITE_REVENUECAT_ANDROID_KEY` (`goog_…`) and `VITE_REVENUECAT_IOS_KEY` (`appl_…`). These are public SDK keys. Never add secret RevenueCat API keys or store service credentials to Vite environment variables. A `test_…` Test Store key may be used in an explicitly labelled test build; replace it before store release.

Connect the Google Play service credentials and Apple's in-app purchase key in RevenueCat's dashboard, not the repository. Configure restoration to support reinstalling with a new anonymous RevenueCat ID. Do not configure a policy that strands purchases on an inaccessible anonymous identity. Restoration is on the original store platform: local career files do not transfer paid ownership between Apple and Google.

The SDK generates and caches its anonymous identity. The app never calls `logIn`, invents an account identifier, or transmits career state. It grants content only from trusted signed entitlement responses (`VERIFIED` or `VERIFIED_ON_DEVICE`) and uses the SDK's native cache for offline access. A saved game's pack selection never proves ownership. A newer verified response can revoke a refunded entitlement. Purchases and restoration share one serialized operation lane.

## Local and real-store qualification

Vite now rejects malformed, secret and wrong-platform RevenueCat keys before creating a bundle. Diagnostics name only the environment variable, never its value. The native adapter enforces the same platform rule.

For a store release, set `CF_PURCHASE_RELEASE_PLATFORM=android` or `ios` before running `corepack pnpm build`. That explicit gate rejects a missing key or a Test Store key for the selected platform. Leave it unset for the disconnected local/unsigned qualification build. A correctly formatted public key does not prove that products, entitlements or store credentials are configured; the real sandbox checks below remain required.

Startup retries also re-register a purchase listener if bridge registration failed. Tests cover concurrent startup, later approval/refund delivery and recovery after an offerings error.

Run `corepack pnpm test`, `corepack pnpm typecheck`, `corepack pnpm lint`, `corepack pnpm build`, then `corepack pnpm --filter @cf/game cap:sync`.

Unit tests use an isolated mock of the native RevenueCat SDK to verify configuration, localized quotes, unavailable products, purchase/restore, pending/cancelled transactions, signed response validation and refunds. `apps/game/e2e/paid-packs.mjs` injects test ownership into a development-only browser session to inspect all delivered models and finishes. Neither constitutes a store transaction, and no test ownership switch exists in the production UI.

Run `node apps/game/e2e/paid-packs.mjs` for this presentation check. It owns a fresh local Vite server and browser session and closes them afterward, avoiding duplicate store modules left by development hot reload.

Before shipping, test on Google Play internal testing and Apple Sandbox/TestFlight:

1. Each one-time product returns its correct localized price and description.
2. Cancel and pending/approval flows grant nothing prematurely; store approval eventually unlocks the right pack.
3. Buy once, enable, relaunch offline, and verify the content. Buying an owned item is blocked.
4. Reinstall on the same platform and use Restore purchases; export the career before uninstalling.
5. Confirm a refund/revocation removes paid access on receipt refresh while leaving the career intact.
6. Simulate network failures and response verification failure. Restore a charged but unverified transaction instead of encouraging another payment.
7. Verify no secret keys or test-store keys exist in the release bundle; reconcile privacy labels, merged SDK manifests and the published privacy policy.

References: [Capacitor setup](https://www.revenuecat.com/docs/getting-started/installation/capacitor), [trusted entitlements](https://www.revenuecat.com/docs/customers/trusted-entitlements), [non-subscription purchases](https://www.revenuecat.com/docs/platform-resources/non-subscriptions), [restoring purchases](https://www.revenuecat.com/docs/getting-started/restoring-purchases), [Apple privacy](https://www.revenuecat.com/docs/platform-resources/apple-platform-resources/apple-app-privacy).
