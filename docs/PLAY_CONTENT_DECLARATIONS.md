# Google Play launch declarations

Prepared September 22, 2026 for `com.creatorfootball.app`. These are evidence-backed draft answers, **not a record of saved console forms or a compliance certification**. The owner selected all ages, including children, and public support `deeplifesimulator@gmail.com`.

## Evidence in this build

- Career state, manager/club names, saves and simulated social posts stay on-device. No sign-in, user messaging or public content sharing exists.
- `src/app/analytics.ts` uses a development-only console sink; no production event uploader is installed.
- `src/commerce/revenuecat.ts` configures anonymous native purchase identity, disables optional diagnostics, and does not attach names, email, contacts or advertising identifiers. It starts from `ExpansionBridge` when the app opens, including before a purchase.
- The checked Android merged manifests include billing and internet access. No advertising-ID permission was found. Recheck the exact signed release artifact after SDK changes.
- Store packs are optional, one-time and non-random, with full contents shown before checkout. They do not sell currency, stat boosts or match outcomes.

## Forms to finish in the console

| Form | Prepared answer / evidence |
| --- | --- |
| Support contact | `deeplifesimulator@gmail.com` |
| Privacy | `https://wrexist.github.io/Creatorfootball/privacy.html` |
| Ads | No; already saved |
| Advertising ID | No; already saved |
| App access | No game login. Base career unrestricted. Explain optional store purchases, restoration and Content packs; do not claim paid features are freely accessible to every reviewer. |
| Intended audience | Owner selected all ages, including children. Still not saved; complete the Families questions against the release artifact. |
| Data safety | Data collected: purchase history, for app functionality and analytics; encrypted in transit, not ephemeral. No non-service-provider integrations configured. Collection begins at native startup and cannot currently be disabled. |
| Deletion | Public privacy page provides email requests. Verify a real anonymous record can be located and deleted before claiming the operational process has been tested. Career deletion and purchase-record deletion are separate. |
| Content rating | Complete the actual IARC questionnaire. In-app purchases exist; the social feed is fictional. Do not equate an intended all-ages audience with an assigned content rating. |

RevenueCat's [Google data-safety guidance](https://www.revenuecat.com/docs/platform-resources/google-platform-resources/google-plays-data-safety) requires purchase-history disclosure for functionality and analytics. Its default guidance does not require advertising/device identifiers without relevant integrations. Reconcile that guidance with the exact SDK and any project integrations before submitting.

## All-ages release gate

Google's [Families policy](https://support.google.com/googleplay/android-developer/answer/9893335?hl=en) applies when children are included. Review content suitability, SDK data practices and purchase presentation. No ad SDK is present, so an advertising-specific age screen must not be added as a substitute for checking purchase-SDK behavior. If an SDK is unsuitable for child-directed use, mixed-audience use needs an appropriate age boundary or implementation that avoids collecting children's data. Confirm RevenueCat's applicable processor terms and implementation before certifying this requirement; its website's age restriction alone does not establish SDK suitability.

Still required: signed-binary SDK review, real store approval/pending/cancel/restore/refund checks, and an age-appropriate usability/content pass. Do not silently change the owner's audience to adults or mark this gate complete on the strength of mock tests.
