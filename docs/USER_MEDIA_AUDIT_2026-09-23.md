# Creator Football — supplied screenshot and recording audit

Date: 23 September 2026. Scope: five supplied screenshots and the complete supplied 4.06-second recording, with targeted inspection of the current repository at commit `4b976e5` on `codex/launch-candidate-20260923`.

The most urgent work is to stabilize text and layout, correct tactics clipping and substitute identification, and reclaim readable space around the fixed chrome. The next pass should unify character art and rebuild the reveal/result compositions. Adding more effects before those repairs would make the problems harder to assess.

This document records **31 repair/refinement items and seven verification workstreams**. It is an audit, not a claim that the fixes have been implemented. No application code, save data, store declarations, or release settings were changed during this review.

## Evidence and confidence

| Evidence | Screen | What it establishes |
| --- | --- | --- |
| IMG_3217.png | Manager selection | Mixed portrait styles, dense cards, intrusive edge treatment, ambiguous disabled-action presentation |
| IMG_3218.png | Club reveal | Oversized burst composition, inconsistent crest/kit rendering, repeated identity information |
| IMG_3219.png | Tactics pitch | Goalkeeper label clipping, sparse token information, controls obscured by edge treatment |
| IMG_3220.png | Tactics bench | Named substitutes and reserves visually mixed, repeated faces, lower section veiled by navigation |
| IMG_3221.png | Result hero | Visible character rectangle/cutoff, oversized hero, weak team/attendance context, unclear staged navigation |
| Recording, 0.00–4.06 s | Result reaction, news, finance, standings | Alternating author labels, repeated layout changes, unrelated match reaction, weak news/context presentation |

The MP4 is 1180×2556 HEVC, approximately 59.36 encoded frames/second. The complete clip was decoded (241 frames); temporal inspection used 41 retained samples approximately 0.1 seconds apart, covering the complete clip. The encoded frame rate is **not** a measurement of app rendering performance. The audio track decoded to silence; no conclusion about game audio can be drawn.

Evidence copies, the original recording, contact sheets, and an HTML gallery are in `artifacts/user-media-audit-20260923/`. That directory is ignored by Git. The gallery links back to this report, and the downloadable evidence archive includes a portable copy.

- **Observed** means the supplied media shows the problem.
- **Source-confirmed** means the current source contains the relevant behavior. The exact installed build in the recording was not identified, so code correspondence is evidence rather than proof of the recording's binary version.
- **Suspected cause** means a plausible implementation cause that still requires runtime reproduction.
- **Refinement** means a concrete design improvement rather than a demonstrated functional failure.
- **P1**: fix before visual release sign-off because stability, readability, selection clarity, or accessibility is affected.
- **P2**: complete in the premium polish pass before calling this redesign finished.

## Shared layout and rendering

### G01 — Author names alternate between names and handles — P1

**Evidence:** recording 0.00–1.32 s. ClipCity repeatedly alternates with `@clipcity`; Mo Ashbury alternates with `@emberninemo`. This happens over consecutive samples, rather than as a single intentional name reveal.

**Impact:** the feed appears unstable and becomes difficult to scan. It also changes identity presentation without user action.

**Likely owner/cause:** [feed.tsx](../apps/game/src/design/domain/feed.tsx), particularly the author row around line 439, supplies the handle as the short alternative to the display name and then renders the handle again in a second shrinking `NameText`. [FitText.tsx](../apps/game/src/design/typography/FitText.tsx) measures a host whose width can itself depend on the currently fitted child. A flex-width/text-fitting feedback loop is a strong hypothesis, not a proven native trace.

**Required work:** reserve stable space for the identity row; make display name and handle distinct; choose one deterministic wrapping/truncation policy per width. Measure against a constraint independent of the chosen text variant. Avoid measuring visible text through transient mutations when an isolated measurement node will do.

**Acceptance:** after fonts load, record ten idle seconds and repeated scrolls. Author strings and element widths must remain unchanged unless the post or viewport actually changes. Test long names, verified badges, missing handles, localization, and every supported text size.

### G02 — Cards repeatedly change height and move surrounding content — P1

**Evidence:** throughout the recording; especially 2.51–4.01 s, when finance and standings positions keep changing after the main scroll. Text wrapping and card height are visibly unsettled.

**Impact:** reading position moves, the screen looks unfinished, and a moving target can make taps unreliable.

**Suspected cause:** investigate G01 together with `FitBox` in [FitText.tsx](../apps/game/src/design/typography/FitText.tsx), around line 351. Its ResizeObserver resets the font to its ceiling on any observed size change, including height; fitting can then reduce it again. [StatCard.tsx](../apps/game/src/design/domain/StatCard.tsx) uses this component. Counter animation, font loading, and stage scrolling should also be isolated before declaring a single root cause.

**Required work:** make fitting converge to a stable result, respond only to meaningful constraint changes, and preserve the scroll anchor while sections mount. Give images and counters stable geometry. Do not suppress the symptom by hiding overflow or freezing all live data.

**Acceptance:** no repeated size oscillation during ten idle seconds after settling; one stable final layout after a value, font, orientation, or text-size change. Capture bounding rectangles and observer activity on the affected native WebView.

### G03 — Progressive blur obscures useful content beyond the chrome — P1

**Evidence:** IMG_3217 loses the manager introduction under the top fade and the next manager under the bottom fade. IMG_3219 veils the formation control and Auto pick/Squad list area. IMG_3220 veils the Set-piece duties heading.

**Source:** [Screen.tsx](../apps/game/src/design/layout/Screen.tsx) adds a 36 px top fade and a separate footer fade; [TabBar.tsx](../apps/game/src/design/layout/TabBar.tsx) adds a navigation fade covering nav height, safe area, and an additional 44 px. [premium.css](../apps/game/src/design/premium.css) adds a strong opaque gradient. These layers must be tuned together.

**Required work:** keep the requested progressive blur, but confine its heavy portion to the protected chrome. Add appropriate content clearance and scroll padding; use a shallow transition at the reading edge. Share one policy between normal screens and the custom result screen, which currently presents harder cutoffs.

**Acceptance:** content can scroll completely into a clear reading region; first and last actions remain visible and operable. Check top, middle, bottom, overscroll, sheets, keyboard, and reduced-effects mode. A partially scrolled item behind navigation is normal; these screenshots do not prove permanent inaccessibility.

### G04 — Fixed header/footer space overwhelms the phone viewport — P2

**Evidence:** the Tactics title, subnavigation, top safe area, bottom navigation, and fades leave too little contiguous room for the actual team. The result header devotes a large area to “FULL TIME” and two tabs while the match score disappears on scroll.

**Required work:** compress app-owned header rows, remove redundant vertical padding, and retain useful compact context. On results, a compact score/teams header would be more useful than a large empty status area. Keep the genuine device safe area and reachable navigation.

**Acceptance:** at 393×852, key tactics context and its primary action are reachable without scrolling through decorative spacing; result tabs and match context stay legible without covering content. Repeat at 360×800, 390×844, and 430×932.

### G05 — The active navigation destination has duplicate indicators — P2

**Evidence:** both tactics screenshots show an upper lime line, a lower lime pill, a glow, and lime icon/text for Squad.

**Source:** [premium.css](../apps/game/src/design/premium.css), line 43, adds an active-button `::after` line; [TabBar.tsx](../apps/game/src/design/layout/TabBar.tsx) also renders its existing active marker.

**Required work:** choose one indicator, supported by the icon/label selected state. Reduce glow to match the calmer reference material treatment.

**Acceptance:** one coherent marker per active destination, consistent across all five tabs, with focus still independently visible and `aria-current` retained.

### G06 — Typography, contrast, and lime usage need a systematic pass — P2

**Evidence:** tiny secondary feed metadata, small tactics ratings, muted card text, very large reveal lettering, and lime used simultaneously for ratings, headings, navigation, and primary actions. These competing priorities weaken the information hierarchy.

**Required work:** apply a stable size hierarchy at actual phone scale. Use the condensed display face for major titles, a readable UI face for data, and neutral ratings unless a specific status is being communicated. Audit visible text over the actual final backgrounds. Fix cramped layouts instead of continually shrinking text.

**Acceptance:** essential text remains readable at default and increased text sizes; verify actual contrast, rather than declaring failure or compliance from compressed screenshots. Selected, dangerous, unavailable, and disabled states must be distinguishable beyond color alone.

## Manager selection — IMG_3217

### M01 — Manager portrait styles are inconsistent — P2

**Observed:** Vera has semi-realistic rendered art while Dez and the next manager use flat procedural portraits.

**Source:** [manifest.ts](../apps/game/src/design/art/manifest.ts), `managerAssetFor`, recognizes only a limited set of appearances, with other appearances falling back to the vector manager renderer.

**Required work:** give every premade manager a coherent portrait, crop, lighting setup, clothing material, and expression family. Provide a deliberately compatible fallback and preserve user-created identities. An unrelated premade face is not a valid replacement for a custom manager.

**Acceptance:** inspect the full manager roster, Home, press, and win/draw/loss results. Each manager retains the same face and art direction across all appearances, including failed-image loading.

### M02 — Cards are too text-heavy for comparing managers — P2

**Observed:** a small portrait sits beside long biography, strength, and weakness paragraphs. Around two cards consume almost the complete useful viewport.

**Required work:** make the default card a concise comparison: name, archetype, short strength, short tradeoff. Reveal the full biography and supported numerical effects on selection or in a detail sheet. Increase the portrait's visual presence without increasing card height. Keep the full existing content available.

**Acceptance:** the player can compare several options without remembering paragraphs from earlier scroll positions; all real bonuses/tradeoffs remain discoverable and accurately described.

### M03 — Selection and disabled continuation need clearer communication — P2

**Observed:** every card has a colored accent stripe, while the disabled “Choose your manager” button still resembles the primary lime action. There is no selected manager in this capture; disabling continuation is expected.

**Required work:** distinguish role color from the actual selected state. Retain a clear selected tick/border and a concise instruction such as “Select a manager to continue.” Use a consistent disabled treatment; once selected, show the chosen name in the confirmation context.

**Acceptance:** unselected, selected, keyboard-focused, and disabled states are unmistakable. Selecting and switching a manager updates the correct saved identity; continuation never silently chooses a default.

## Club reveal — IMG_3218

### C01 — The burst overwhelms the club identity — P2

**Observed:** long rays, a large dark ring, and soft bubble shapes dominate the composition. The visual center of the ring sits below the crest, making the reveal feel assembled from separate effects.

**Required work:** replace the busy burst stack with one restrained lighting treatment and a meaningful club/stadium backdrop. Keep a short celebratory moment, but give the crest a clean silhouette and the club name a quiet reading area.

**Owner:** [moments.tsx](../apps/game/src/design/hero/moments.tsx), `HeroReveal`/`Rays`, and [ClubReveal.tsx](../apps/game/src/features/creation/ClubReveal.tsx).

**Acceptance:** a still frame at every major animation stage looks intentional. Reduced motion/effects preserves the identity and action without the ray/mote stack.

### C02 — Crest and kit do not share a material language — P2

**Observed:** the detailed metallic wolf crest sits above a flat striped shirt graphic. A small detached shadow/reflection shape is visible below the crest.

**Required work:** inspect the crest's isolation/crop and remove unwanted matte/reflection artifacts from its reusable presentation. Give kit presentation compatible depth, lighting, and edge quality while preserving actual editable colors and pattern. Keep all functional text rendered in code.

**Acceptance:** all club crest and kit combinations look coherent on both dark and lighter contextual backgrounds; no stray plate, halo, or floating shadow remains at final mobile size.

### C03 — Identity repetition and empty space weaken the reveal — P2

**Observed:** crest, LKW, Larkspur, “YOUR CLUB,” and Larkspur Wolves repeat similar information; the large lime title competes with the lime CTA. There is substantial unstructured space above and below the central composition.

**Required work:** choose a clear sequence: crest and club name, short club identity/motto, then “Meet your squad.” Move secondary abbreviation/city/history into a compact supporting line. Use strong display typography and reserve the brightest lime for the action.

**Acceptance:** long club names and mottos work without awkward wraps or clipping, and the button remains visible on short screens and increased text size.

### C04 — Reveal dismissal and dialog accessibility need repair — P1, source-confirmed

**Source:** `HeroOverlay` in [moments.tsx](../apps/game/src/design/hero/moments.tsx), around lines 39–82, dismisses the entire overlay on any click and on document-level Enter/Space/Escape. It sets `role="dialog"` and `aria-modal`, but supplies no accessible name or focus management. [Portal.tsx](../apps/game/src/design/glass/Portal.tsx) only portals the content; it does not provide those behaviors.

**Risk:** a stray tap advances the onboarding moment, and keyboard/screen-reader interaction can reach or act on unintended content. The screenshot alone does not demonstrate this interaction.

**Required work:** use the explicit continuation action for onboarding; give the dialog an accessible name, initial focus, focus containment, and appropriate focus restoration. Scope keyboard handling to intentional controls. Allow content scrolling when space is constrained.

**Acceptance:** tapping art does not unexpectedly advance the onboarding step; VoiceOver/TalkBack announces the dialog and its purpose; focus cannot escape to the underlying screen; Enter/Space does not double-advance.

## Tactics — IMG_3219 and IMG_3220

### T01 — The goalkeeper rating is clipped — P1

**Observed:** Novak's name sits against the lower pitch boundary and his rating is missing below it, unlike the other players.

**Source:** [TacticsScreen.tsx](../apps/game/src/features/squad/TacticsScreen.tsx) positions full token boxes using formation percentages, half-size translations, and an overflow-hidden pitch. The presentation does not reserve sufficient space for the token's actual lower extent. The six-pixel pitch border further reduces usable space.

**Required work:** inset display coordinates according to rendered token bounds; preserve the engine's actual formation coordinates. Account for portrait, multiline name, rating, status, and increased text size.

**Acceptance:** every token is completely visible in every supported formation and team size, including goalkeeper, touchline players, long names, and selected states. No simulation coordinate changes are needed to fix presentation clipping.

### T02 — Named substitutes and reserves are indistinguishable — P1

**Observed:** “7 named · 4 not involved” appears above eleven identically styled players. The player cannot tell which seven are available from the match bench.

**Source:** [TacticsScreen.tsx](../apps/game/src/features/squad/TacticsScreen.tsx), line 527, renders `[...data.bench, ...data.reserves]` as one grid.

**Required work:** separate “Match bench — 7” and “Not selected — 4,” or use a clear labeled segmented view. Show eligibility and the effect of moving a player. Preserve existing selection rules and bench limits.

**Acceptance:** a new user can identify every eligible substitute without opening eleven profiles; swapping bench/reserve players updates both sections and the actual match squad correctly.

### T03 — Tokens omit decision-critical player information — P2

**Observed/source:** occupied tokens show portrait, surname, and overall rating; position is not visible, and there is no visible fitness value. Unavailable players share a generic injury icon even though availability can also reflect suspension.

**Required work:** add compact role labels and an understandable fitness/status treatment. Distinguish injury, suspension, unselected, and out-of-position states. Give the selected player a readable detail strip or sheet with full identity and the consequence of the proposed move.

**Acceptance:** a user can distinguish a tired defender from an unavailable midfielder without relying on face or color. Maintain practical touch targets; the current 34 px portrait is inside a larger button, so portrait size alone does not prove a touch-target failure.

### T04 — Multiple visible players appear to share the same face — P2

**Observed:** Nyland and Abernathy appear to use the same portrait; Krause appears to repeat that face in the bench capture. This requires asset/mapping comparison before declaring every apparent match identical.

**Source context:** [identity.ts](../apps/game/src/design/art/identity.ts) already persists deterministic identity mappings. Its finite position pools can reuse art when exhausted; imported/existing assignments also need collision handling. This is not evidence of random faces changing between renders.

**Required work:** audit image content as well as manifest keys, improve unique coverage for the player's squad, and define a safe identity-preserving policy for transfers and large squads. Do not silently reassign established faces to eliminate collisions.

**Acceptance:** a new squad has distinct, recognizable faces within supported roster sizes; each saved player retains the same identity across lineup, profile, match, transfer, and reload.

### T05 — Formation, pitch, and squad actions are too disconnected — P2

**Observed:** the formation/instructions control is above the visible pitch while Auto pick and Squad list are below it; the fade obscures those actions at the captured scroll position.

**Required work:** place a compact, readable formation/action toolbar adjacent to the pitch and make the main action reachable without excessive scrolling. Use a viewport-aware pitch size or a compact overview/detail mode; do not shrink all labels to force a fit.

**Acceptance:** formation changes, lineup selection, bench access, and instructions remain obvious at 393×852, with no newly stacked sticky bars consuming the recovered space.

### T06 — Pitch styling does not match the surrounding premium direction — P2

**Observed:** a heavy double frame and large empty pitch areas surround comparatively tiny portraits. The floor-like lighting and token labels lack a clear shared visual hierarchy.

**Required work:** lighten the frame, tune grass contrast and lines, and give selected tokens a purposeful plate. Use restrained stadium/tactics-room depth around the pitch while keeping tactical geometry clear. Tune token scale together with T01 and T03.

**Acceptance:** names, positions, and selection dominate decorative lines; all pitch markings remain legible; added atmosphere does not increase clipping or obscure the formation.

## Result hero — IMG_3221

### R01 — The manager looks pasted into a rectangular image region — P2

**Observed:** the portrait has visible rectangular background transitions, a crowded top crop, and an abrupt lower-body cutoff.

**Source:** [premium.css](../apps/game/src/design/premium.css), lines 149–150, combines a 240 px clipped container with a 320 px character image, a negative top offset, and a mask later overridden around line 168.

**Required work:** establish one intentional crop/mask system with compatible background colors or properly isolated character art. Give the head and shoulders breathing room and make the lower fade finish before the clipping boundary.

**Acceptance:** neutral, happy, disappointed, and celebrating variants all integrate cleanly at the final phone size. No rectangular matte, head clipping, or cut waist remains.

### R02 — Character scale takes priority over the match outcome — P2

**Observed:** the manager occupies most of the upper hero while score, team context, and action compete for the remaining space. The card plus fixed chrome leaves little room for the next piece of information.

**Required work:** lead with the score and club identity; use the manager as a supporting emotional focal point. Rebalance hero padding, score size, and character crop so useful outcome/progression context can appear earlier.

**Acceptance:** the opening viewport communicates who played, the result, its meaning, and the next action without scrolling. Preserve the correct manager identity and loss emotion already present here.

### R03 — Score ownership and outcome copy need clearer labeling — P2

**Observed:** crests flank 3–5, but team names are combined into one smaller line below. “Lost it” gives little match-specific meaning.

**Required work:** associate each crest/score with its team name and use concise outcome language, such as “Defeat,” supported by an actual match fact. Add competition/round context where space permits. Handle long names and abbreviations consistently.

**Acceptance:** users can identify both teams and their scores without recognizing either crest. Home/away order, draws, wins, and any supported extra-time/penalty results remain accurate.

### R04 — Attendance is ambiguously described as everyone supporting one side — P2

**Observed:** “3 809 in behind you” is awkward and unclear.

**Source:** [MatchResultScreen.tsx](../apps/game/src/features/matchday/result/MatchResultScreen.tsx), around line 345, appends “behind you” or “against you” to total attendance based on whether the player is home or away.

**Required work:** label total attendance explicitly. Only show home/away support allocation when the game actually stores or computes it. Apply locale-aware number formatting consistently.

**Acceptance:** the displayed attendance equals the result data and does not imply a supporter split the simulation does not know.

### R05 — Continue/Skip does not explain the result journey — P2

**Observed/source:** the opening screen offers Continue and Skip with no stage count. The source has eight stages; Skip reveals all stages rather than simply leaving the result.

**Required work:** show lightweight progress and a meaningful next-step label, or offer “View full report” explicitly. Make the final action clearly return to the club/next fixture. Keep Analytics accessible without losing the user's place.

**Acceptance:** users understand what each action will do; skipping, switching tabs, and returning cannot duplicate match rewards, advance the week twice, or lose the result.

### R06 — Full-page character scenery competes with the report — P2

**Evidence:** IMG_3221 and the entire video show the defeated-player scene behind later reaction, news, finances, and table sections. Torso, hands, and clothing fragments remain visible between otherwise unrelated cards.

**Required work:** contain the strong narrative scene in the hero and transition into a calmer report surface. Maintain subtle club atmosphere rather than a giant character crop behind every section.

**Acceptance:** every report section has predictable contrast and one focal point. Reduced-effects mode retains equivalent hierarchy without relying on blur.

## Reaction, news, finance, and standings — recording

### F01 — “The reaction” mixes this match with unrelated clubs — P2

**Observed:** the Larkspur/Ember result report includes Cinderwick/Duskford reaction, including a 0–10 result, under the same reaction section.

**Source:** `SocialStage` in [MatchResultScreen.tsx](../apps/game/src/features/matchday/result/MatchResultScreen.tsx), lines 591–592, takes the first four cycle posts and first two stories without matching them to the player's fixture.

**Required work:** prioritize reaction to the player's club/current match using existing event/club references. Place other matches in an explicitly named league roundup. If nothing relevant exists, use the existing empty state rather than mislabeling unrelated content.

**Acceptance:** test a cycle with multiple fixtures, no player-related posts, postponed fixtures, and a quiet social feed. The section title always describes its content honestly.

### F02 — Read-only reaction counts look like actionable social controls — P2

**Observed/source:** reply, repost, like, and share icons resemble buttons. `SocialStage` passes no handlers, and `ActionButton` in [feed.tsx](../apps/game/src/design/domain/feed.tsx) disables actions when a handler is absent. Compact news items similarly have no opening handler here.

**Required work:** either connect supported actions/detail views to real game state, or present counts as non-interactive metadata. Give disabled actions an explanation only when they are genuinely available in another state. Avoid implying a real external social network or adding fake mechanics.

**Acceptance:** every control that looks tappable has a meaningful supported outcome; read-only metrics are announced as text, not unexplained disabled buttons.

### F03 — Generated news does not reliably fit score margin or venue — P2

**Observed:** “Duskford Rovers find a way past Cinderwick Town” accompanies a reported 10–0 win elsewhere in the reaction. That language undersells an extreme result.

**Source:** [media.ts](../packages/engine/src/content/packs/base/media.ts), around lines 161 and 175, uses generic win/loss templates; the loss headline always says “at {opponent}.” The media alone does not establish whether the Larkspur venue wording is wrong for this specific fixture.

**Required work:** select truthful headline variants using result margin, home/away, competition, and supported event facts. Avoid close-game claims after routs and venue claims without venue data.

**Acceptance:** check narrow win, rout, draw, home loss, and away loss against actual fixtures. Editorial variation must never alter or fabricate simulation facts.

### F04 — Numerical social claims can be authored rather than state-driven — P2

**Observed/source:** the creator post says interest increased “about four hundred percent this month.” [social.ts](../packages/engine/src/content/packs/base/social.ts), around line 712, contains this as a literal template.

**Required work:** derive quantified growth from actual history when available. Otherwise use clearly qualitative creator commentary, without invented measurable growth presented as game feedback.

**Acceptance:** numerical social claims can be traced to saved data or are removed. This requirement applies to attendance, followers, records, streaks, and sponsor claims as well.

### F05 — The finance summary needs a cleaner mobile layout and period labels — P2

**Observed:** three statistics become a two-column grid with a lone transfer-budget tile and empty space beside it. “In” and “Out” are terse; week cash flow and remaining transfer budget are different kinds of figures.

**Source:** `MoneyStage` uses `StatGrid columns={3}`; [structure.tsx](../apps/game/src/design/layout/structure.tsx) deliberately renders that as two columns below the small-screen breakpoint.

**Required work:** use two equal flow tiles and one full-width budget row, or a compact ledger. Name the cycle/week and distinguish weekly income/expenditure from current balance/budget. Keep the net easy to scan.

**Acceptance:** figures stay stable and do not wrap or jump. The visible arithmetic is already correct: £993K − £296K = +£697K. Do not change accounting formulas to solve this presentation issue.

### F06 — Standings movement needs explanatory context — P2 refinement

**Observed:** “Up 1 place” appears after the supplied defeat. A loss can legitimately coincide with moving up because other fixtures and tiebreakers affect the table.

**Required work:** display a compact previous-to-current rank or otherwise anchor the comparison to the correct completed round. Make the player's row easy to find and give a clear route to the full table when supported.

**Acceptance:** compare the pre-round and post-round standings for an actual completed cycle. Verify ties, other results, reload, and season transitions before changing logic. The media does not prove an incorrect table calculation.

## Verification workstreams that the supplied media cannot settle

These are required follow-up checks, not additional claims that a bug was observed.

| ID | Workstream | Required checks and completion evidence |
| --- | --- | --- |
| Q01 | Tactics touch behavior | `touch-none` and a 6 px drag threshold are present on tokens. Test vertical swipes starting on a portrait, tap-to-select, drag to another slot, drag cancellation, drop outside pitch, bench-to-slot, and slot-to-bench where supported. Inspect pointer-cancel handling and ensure a completed drag does not also trigger a selection tap. Preserve all availability/formation rules. |
| Q02 | Viewport, safe area, and text scaling | Capture 360×800, 390×844, 393×852, and 430×932, plus supported tablets. Test default and largest supported text, long names, keyboard open, first/last scroll positions, and landscape if supported. Every important action must reach a clear region outside blur and chrome. The reveal's overflow-hidden layout needs particular attention. |
| Q03 | State coverage | Capture no manager selected, each manager selected, custom manager, injury, suspension, out-of-position, no bench, reserve overflow, all supported formations, empty feed, image failure, and win/draw/loss results. Check disabled explanations and confirmation states. |
| Q04 | Native stability and performance | Reproduce the video on the installed build and compare with this commit. Measure layout settling, long frames, memory, and scroll responsiveness on a representative iPhone and Android device. Compare blur enabled/disabled and normal/reduced effects. A smooth desktop capture alone is insufficient. |
| Q05 | Identity and save integrity | Verify identity persistence through save/reload, transfer, promotion, newly generated players, and migration from existing saves. Inspect duplicate image contents as well as duplicate asset keys. Preserve established identities and custom manager choices. |
| Q06 | Result and finance correctness | Verify one match commit and one week advancement across Continue, View full report/Skip, Analytics, back navigation, interruption, and reload. Reconcile score, attendance, income, expenditure, budget, rewards, and table movement to the same saved cycle. The screenshots do not establish a save or economy failure. |
| Q07 | Accessibility and effects preferences | Test VoiceOver/TalkBack, keyboard focus, selected-state announcements, touch bounds, contrast, reduced motion, reduced effects, and text size. `apps/game/index.html` disables viewport scaling; evaluate accessible zoom for the web build and ensure the native accessibility/text-size strategy is actually usable. Decorative fades must not hide essential text even when blur is disabled. |

## Recommended repair order

1. **Reproduce and stabilize:** identify the installed build, capture the supplied result state, fix G01/G02, and add a meaningful regression check for stable idle layout and author strings.
2. **Recover clear interaction space:** G03–G05, T01/T02, and C04. Check scroll end, safe areas, selection eligibility, and dialog input before expanding visual work.
3. **Finish team/manager presentation:** M01–M03 and T03–T06. Confirm persistent identities and lineup behavior before moving on.
4. **Recompose the emotional screens:** C01–C03 and R01–R06, using the original premium Home direction and the user's preference for a clean, atmospheric club world.
5. **Make the report truthful and coherent:** F01–F06, including relevant reaction, real actions, factual copy, and clear finance/standings context.
6. **Run the full acceptance matrix:** Q01–Q07, then capture stable screenshots and a fresh complete interaction recording. Finish G06 against the rendered states rather than isolated components.

Keep the repairs in small reversible commits. Avoid changing proven simulation formulas for presentation problems. Do not add mechanics merely to fill visual space.

After implementation, run the repository's actual checks: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and the applicable `pnpm test:smoke` workflow. The root manifest has no separate formatter script; inspect the repository's current formatting conventions instead of claiming a nonexistent formatter passed. Add focused regression coverage for the observed failures; screenshot appearance and native scroll stability still require visual/device verification.

## What this audit does not conclude

- Seven visible players are not automatically a missing-XI defect; the game supports smaller-team formats.
- A disabled manager continuation button before selection is expected behavior.
- A partially scrolled card behind fixed chrome does not prove it can never be reached.
- Repeated-looking faces do not prove identities are randomly reassigned at render time; the repository already has persistent mappings.
- The finance arithmetic in the clip is correct; moving up after a defeat is possible.
- The T3 Dynamic Island activity, status time, battery, and recording indicator belong to the operating system. They are not app UI defects. Use clean captures for release marketing.
- This recording does not establish defects in stadium progression, purchases, save reliability, simulation balance, audio, or screens not shown. Those need their own evidence.
- This was a media and targeted source audit. No runtime test suite, native profiler, contrast measurement, or new-build comparison was run in this turn. Existing test results do not constitute proof that these visual issues are fixed.
- The publisher's earlier Google children-compliance hold remains unchanged.
