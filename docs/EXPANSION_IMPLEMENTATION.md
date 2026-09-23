# Platform and online expansion

Scope requested on 22 September 2026: Android, working purchases/content packs, local save management and true runtime 3D (the user subsequently declined accounts/cloud saves). Existing simulation, save version, primary navigation and artwork remain compatible.

## Implementation order and boundaries

1. Android: Capacitor 8 shell, project-specific icons/splash, secure networking, hardware back/lifecycle handling, debug APK and emulator verification. Signing configuration reads deployment secrets; no private keystore is committed.
2. Local saves: validated import/export, previous-generation recovery and safe replacement. No game account, cloud upload, database or Supabase integration. Careers remain on-device.
3. Purchases/content: RevenueCat Apple/Google adapters, real provider prices, cancellation/pending/failure/restore handling, verified durable non-consumable entitlements and refund reconciliation. The native store account restores ownership independently of a career. Web can use free packs and browse paid content; it does not offer a checkout that cannot restore after clearing storage. Only implemented cosmetic/content products can be sold.
4. Runtime 3D: original procedural GLB models and a lazy-loaded Three.js club/stadium viewer driven by facility levels and club colours, plus inspectable football/kit/trophy objects. Orbit/zoom/reset, keyboard alternatives, render-on-demand, reduced-effects fallback, context-loss handling, disposal and explicit mesh/draw/texture budgets. No provider meshes or paid model-generation calls are required.

The existing asset-production CLI is unavailable; its provider workflow cannot run. Local source-authored meshes will have deterministic generation, GLB validation, provenance, engine import and browser-render evidence. This is not a photorealistic rigged-character production claim.

## Verification plan

- Actual Android Gradle build and running-emulator launch, reload and screenshot.
- Local import/export/recovery tests, with invalid data and pending-write protection.
- Purchase adapter tests for cancellation, pending approval, failure, stale/offline entitlements, restored/refunded products and persistence independent of career replacement.
- Real browser and Android flows for content enable/disable and runtime 3D/fallback. Store sandbox transactions require configured public RevenueCat keys and product catalogues.
- Full lint/typecheck/tests/production build and dependency audit. Baseline gameplay smoke remains mandatory.

## External configuration

The user explicitly selected local saves and RevenueCat, with no Supabase. All initial Supabase source/dependencies/configuration were removed; no external database was created or changed. No login or cloud upload is present. RevenueCat Apple/Google products, public SDK keys and store credentials must be configured by the account holder. No secret API key is needed by this app. Native paid packs are non-consumable, repeatable restore is idempotent, and the SDK's entitlement response is the ownership authority.
