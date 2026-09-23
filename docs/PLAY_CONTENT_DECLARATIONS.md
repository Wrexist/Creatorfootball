# Google Play launch declarations

Prepared September 22 and updated September 23, 2026 for `com.creatorfootball.app`. The owner selected all ages, including children, and public support `deeplifesimulator@gmail.com`.

**Current hold:** the owner explicitly requested compliance review before Google's publisher certification for applicable children's laws. That checkbox remains unchecked; no certification is made. Keep the intended audience unchanged and do not submit a public release dependent on it. The console is on step 2 of the audience form. See [current launch checkpoint](STORE_SETUP_STATUS.md) for signed builds and console evidence.

IARC and app-access forms are now saved. IARC assigned ESRB Everyone, PEGI 3 and Brazil 14+ among its regional ratings; intended audience does not override these ratings. Paid-pack review instructions contain approved free promo codes and backups in Google's restricted form. Codes are kept outside the repository. Data safety is a saved draft, blocked from final Save by the incomplete audience declaration. These saved forms do not establish children's compliance or native transaction correctness.

## Evidence in this build

- Career state, manager/club names, saves and simulated social posts stay on-device. No sign-in, user messaging or public content sharing exists.
- `src/app/analytics.ts` uses a development-only console sink; no production event uploader is installed.
- `src/commerce/revenuecat.ts` configures anonymous native purchase identity, disables optional diagnostics, and does not attach names, email, contacts or advertising identifiers. It starts from `ExpansionBridge` when the app opens, including before a purchase.
- The checked Android merged manifests include billing and internet access. No advertising-ID permission was found. Recheck the exact signed release artifact after SDK changes.
- Store packs are optional, one-time and non-random, with full contents shown before checkout. They do not sell currency, stat boosts or match outcomes.

## Console answers and remaining verification

| Form | Prepared answer / evidence |
| --- | --- |
| Support contact | `deeplifesimulator@gmail.com` |
| Privacy | `https://wrexist.github.io/Creatorfootball/privacy.html` |
| Ads | No; already saved |
| Advertising ID | No; already saved |
| App access | Saved: no game login, base career unrestricted, restricted paid packs with free reviewer codes, restoration and enable-pack instructions. Code redemption is still untested; refresh access before expiry. |
| Intended audience | All six age groups selected; not finally saved. Publisher children's-law certification explicitly held for compliance review by the owner. |
| Data safety | Data collected: purchase history, for app functionality and analytics; encrypted in transit, not ephemeral. No non-service-provider integrations configured. Collection begins at native startup and cannot currently be disabled. |
| Deletion | Public privacy page provides email requests. Verify a real anonymous record can be located and deleted before claiming the operational process has been tested. Career deletion and purchase-record deletion are separate. |
| Content rating | IARC agreement approved and questionnaire saved. In-app purchases disclosed; no random paid items, gambling or user communication. Preserve assigned regional ratings. |

RevenueCat's [Google data-safety guidance](https://www.revenuecat.com/docs/platform-resources/google-platform-resources/google-plays-data-safety) requires purchase-history disclosure for functionality and analytics. Its default guidance does not require advertising/device identifiers without relevant integrations. Reconcile that guidance with the exact SDK and any project integrations before submitting.

## All-ages release gate

Google's [Families policy](https://support.google.com/googleplay/android-developer/answer/9893335?hl=en) applies when children are included. Review content suitability, SDK data practices and purchase presentation. No ad SDK is present, so an advertising-specific age screen must not be added as a substitute for checking purchase-SDK behavior. If an SDK is unsuitable for child-directed use, mixed-audience use needs an appropriate age boundary or implementation that avoids collecting children's data. Confirm RevenueCat's applicable processor terms and implementation before certifying this requirement; its website's age restriction alone does not establish SDK suitability.

Still required: signed-binary SDK review, real store approval/pending/cancel/restore/refund checks, and an age-appropriate usability/content pass. Do not silently change the owner's audience to adults or mark this gate complete on the strength of mock tests.
