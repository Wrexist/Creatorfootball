# Original CF icon restored

The September 24 owner request restores the metallic CF crest that preceded the yellow ball icon. Implementation commit: `4eeaa14`.

## Source and scope

- The opaque 1024px iOS PNG is byte-identical to the original asset in `0bcf661`. Its SHA-256 is `9fa23d3816dec1ff77926e22ea2c75e7263b5580468d07ad3d85b046a9732172`.
- `tools/brand/masters/app-icon.png` preserves that source. `tools/brand/package-app-icon.py` deterministically packages it for iOS, Android and the Play listing.
- Android adaptive and legacy icons use the artwork; themed icons use the matching CF silhouette. The adaptive foreground has a safe inset.
- Web/PWA icons, favicons, the onboarding brand mark and website icon files use the original identity. The icon renderer now references the preserved source instead of drawing the yellow ball.
- Gameplay, purchases, prices and career saves are unchanged. No new artwork was generated.

## Verification and distribution

- Repository lint and typecheck passed. Original-source byte matching, PWA dimensions and the restored image inside the signed Android bundle passed (`artifacts/icon-restoration/verification.json`).
- Android production build, Capacitor sync, release lint, signing and strict signature verification passed. Five existing lint warnings, zero errors.
- Android **1.0.16 (4)** is active on the existing internal track, visibly available September 24 at 18:16 local time. Existing tester access is unchanged. Bundle: `artifacts/store-launch/android-1.0.16-4/creator-football-1.0.16-4.aab`; SHA-256 `B669712652E2689C3CA61D7E44ACA26771C91957FCDE5389F392BF391ABE9995`.
- Google Play's listing icon was replaced with the 512px CF artwork and saved. Its AI-artwork attribution is selected, reflecting the original asset's provenance. The listing is ready to send for review; no public review submission was made.
- iOS **1.0.16 (10)** uploaded successfully at 16:28:06 UTC through [workflow 36025668401](https://github.com/Wrexist/Creatorfootball/actions/runs/36025668401). Both jobs passed, including lint, typecheck, 998 tests, production build, browser smoke, archive/signing and upload. Apple visibly reports build 10 processing.
- Downloaded IPA: `artifacts/store-launch/ios-1.0.16-10/creator-football.ipa`; SHA-256 `8B90A5F535045DA400E52A5861BD76B84C690DE036DD917BAA890CA1C2358098`. Info.plist confirms version 1.0.16, build 10 and bundle `com.creatorfootball.app`. The packaged iPhone icon was decoded from Apple's PNG format and visually inspected: it contains the restored CF crest. Logs, metadata and preview are alongside the IPA.
- App Store Connect sign-in is restored. Version **1.0.16** is **Prepare for Submission**, with manual release selected and the old build detached pending the corrected build. Build 9 has processed successfully, but still contains the superseded icon.

## Remaining release gates

The owner's children's-compliance hold remains in force. Physical-device qualification, actual sandbox purchase/restore/refund checks, Apple first-IAP review assets, current listing galleries and required Google closed testing remain open. Internal distribution does not certify these gates.
