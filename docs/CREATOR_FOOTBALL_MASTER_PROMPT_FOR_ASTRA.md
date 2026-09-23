# Creator Football — Complete Premium Redesign Master Prompt for Astra

Attach `reference-ui/home-redesign.png` to Astra together with the prompt below.

```text
You are the lead product designer, game UI engineer, technical art director and QA owner for Creator Football, a portrait mobile football-management game about building a fictional club, managing players and tactics, competing in creator-driven leagues, growing fans, handling finances and progressing from a small club to a global football brand.

Your assignment is to redesign and implement the entire game at a premium, high-budget quality bar. Use the supplied redesigned Home mockup as the visual source of truth. Do not stop after planning or after rebuilding one screen. Inspect the existing repository, establish a reusable design system, implement the redesign across every current route and state, integrate a coherent asset pipeline, verify the real gameplay flows, and report evidence.

The goal is not to create a generic dark dashboard. The goal is to make the player feel that they are physically inside their club: looking through the manager’s office toward the stadium, standing at the tactics desk, walking through training and facilities, entering the tunnel on matchday and watching the club grow into a football institution.

## 1. Start by auditing the real project

Before changing code:

1. Read all repository instructions and configuration.
2. Identify the framework, routing, state management, save system, data models, styling approach, image pipeline, tests and build commands.
3. Map every current screen, subroute, modal, drawer, popup, filter, action and state transition.
4. Trace the full gameplay loop from a fresh save through squad selection, tactics, training, market activity, matchday, live match, results, finances and week advancement.
5. Capture baseline screenshots at the project’s supported phone sizes, especially 393×852, 390×844 and 430×932.
6. Record existing functionality that must remain intact. Do not replace real game data or actions with static mockups.
7. Find current performance constraints before adding animation, blur or real-time 3D.

Create a short audit note inside the repository before implementation. It must identify the shared shell, route owners, state boundaries, risky screens, test commands and the safest migration order.

## 2. Non-negotiable product direction

Creator Football must become a cinematic football-management experience with these qualities:

- Premium stylized 3D football world layered behind a clear management UI.
- One strong emotional focal point on every screen.
- Original fictional football culture rather than copied real clubs, kits, sponsors or players.
- Dark charcoal and deep forest foundation with acid lime reserved for primary actions and active states.
- Warm gold for trophies, history and elite progression.
- Red only for danger, injuries, losses and destructive actions.
- Soft glass, satin metal, textured fabric, dark stone and stadium-light materials.
- Clear information hierarchy and readable text at actual phone size.
- Tactile buttons, responsive transitions and meaningful celebration moments.
- The creator-football identity must appear in social growth, personalities, fan culture, media events and club storytelling, not only in the title.

Do not imitate any specific commercial football game screen-for-screen. Use the supplied mockup’s quality, composition, depth, materials and hierarchy while keeping the design original.

## 3. Preserve all working gameplay

Preserve every existing:

- simulation formula;
- schedule and season rule;
- save format and migration;
- player, team and finance data;
- route and navigation target;
- market, filter and sorting behavior;
- tactics and lineup action;
- training selection;
- match speed and simulation control;
- live-match event;
- objective and reward condition;
- settings and accessibility preference;
- automation and auto-resolve behavior;
- analytics, test ID and QA hook.

Visual improvements may require adapters, selectors or presentational components, but they must not rewrite proven simulation logic without a demonstrated need.

## 4. Global design system

### Layout

- Portrait-first mobile game, optimised for 393×852 and scaled safely from 360×800 to 430×932.
- Respect device safe areas.
- Use a 4 px spacing base with 8, 12, 16, 20, 24 and 32 px as the main rhythm.
- Main page horizontal padding: 16–20 px.
- Card gaps: 12–16 px.
- Standard card radius: 18–24 px.
- Large cinematic hero radius: 24–30 px.
- Bottom navigation remains reachable and never covers important content.
- Keep scroll depth purposeful. Important decisions should appear within the first viewport whenever possible.

### Colour tokens

Create semantic tokens rather than repeating literals:

- `bg-void`: `#080B0B`
- `bg-deep`: `#0D1211`
- `surface-1`: `rgba(22, 29, 27, 0.92)`
- `surface-2`: `rgba(38, 47, 43, 0.82)`
- `surface-selected`: `rgba(77, 103, 62, 0.48)`
- `border-soft`: `rgba(232, 244, 232, 0.10)`
- `border-focus`: `rgba(190, 255, 31, 0.55)`
- `text-primary`: `#F6F7F2`
- `text-secondary`: `#BDC5BC`
- `text-muted`: `#79827A`
- `lime`: `#BEFF1F`
- `lime-strong`: `#A9F000`
- `gold`: `#F2BF4C`
- `green`: `#50D596`
- `red`: `#FF6471`
- `blue`: `#68A7FF`

Verify contrast rather than treating these values as untouchable.

### Typography

- Use one strong condensed sports display face for major headlines only.
- Use one highly readable geometric sans for UI, data and body copy.
- No more than two font families.
- Hero title: 32–42 px.
- Page title: 28–34 px.
- Section title: 17–21 px.
- Body: 13–16 px.
- Important data: 20–32 px with tabular numerals.
- Never use tiny low-contrast uppercase text for essential instructions.

### Materials and surfaces

- Use layered translucent charcoal panels with subtle green undertones.
- Use thin warm-gray or pale-green borders instead of thick glowing outlines.
- Add restrained backdrop blur only if measured performance is acceptable.
- Use two shadow levels: normal card and elevated/hero.
- Use subtle fabric grain, stadium haze and reflected light as atmospheric layers.
- Do not use pure black for every panel.
- Do not make every card glow.

### Buttons and states

Build primary, secondary, ghost, danger and icon-button variants with:

- default;
- hover where relevant;
- pressed;
- keyboard/controller focus;
- disabled;
- loading;
- success confirmation;
- insufficient-funds/blocked explanation.

The acid-lime primary button is reserved for the screen’s most important action.

### Motion

- 160–220 ms for taps, tabs and small state changes.
- 260–400 ms for page/hero transitions.
- Use opacity, 4–12 px translation and subtle scale, not excessive bouncing.
- Matchday may use cinematic transitions, but menus should remain fast.
- Respect reduced-motion settings.
- Add restrained haptic feedback for primary decisions if the platform supports it.

## 5. Shared component architecture

Build the system before duplicating page-specific UI. Follow the project’s current framework conventions.

Required primitives:

- `GameShell`
- `TopClubBar`
- `BottomGameNav`
- `PageHero`
- `CinematicMatchCard`
- `GlassPanel`
- `SectionHeader`
- `MetricCard`
- `ProgressRing`
- `PlayerPortrait`
- `PlayerCard`
- `CharacterHero`
- `TeamCrest`
- `KitPreview`
- `FacilityCard`
- `ObjectAssetCard`
- `StoryCard`
- `DecisionCard`
- `TacticPitch`
- `LineupToken`
- `FormStrip`
- `SegmentedControl`
- `FilterChip`
- `PrimaryButton`
- `SecondaryButton`
- `IconButton`
- `BottomSheet`
- `Modal`
- `Tooltip`
- `Toast`
- `LoadingState`
- `EmptyState`
- `LockedState`
- `ErrorState`

Build icons, charts, pitch lines, formation markers, progress indicators and interaction graphics as scalable code-native SVG/canvas/components. Generated raster images must never contain functional UI text.

## 6. Character system

Characters are essential to the new experience. Create a coherent original stylized semi-realistic 3D cast rather than unrelated AI portraits.

### Character categories

1. Club manager: persistent identity used on Home, Club, press and narrative events.
2. Senior players: position-appropriate body types and distinct silhouettes.
3. Youth prospects: visibly younger styling without caricature.
4. Coaches: head coach, assistant, fitness coach and goalkeeper coach.
5. Recruitment staff: chief scout and regional scouts.
6. Medical staff: physio and doctor.
7. Creator personalities: streamers, analysts, interviewers and rivals.
8. Supporters: reusable fan groups for stories and match atmosphere.

### Character art rules

- Original adult fictional people only.
- Consistent face proportions, lighting, skin shader and clothing materials.
- No celebrity or real-player likeness.
- Neutral portrait, happy, focused, disappointed and celebratory expressions for key recurring characters.
- Team apparel must use fictional crests and configurable colours.
- Supply chest-up portrait variants and larger waist-up hero variants.
- Use consistent camera focal length, background and rim light so characters belong to one universe.
- Provide fallbacks and deterministic mapping. A player must not randomly change face between screens.

### Character implementation

- Create a typed character manifest with stable IDs.
- Separate identity from clothing, role, expression and club-colour overlays where the stack allows it.
- Pre-rendered 3D portrait art is preferred for normal screens.
- Use real-time 3D only if the current stack already supports it reliably and device profiling proves acceptable.

## 7. 3D world and asset direction

Create the feeling of 3D through cinematic pre-rendered scenes, layered parallax, object renders and selective real-time elements. Do not force a heavy 3D runtime into the app merely for spectacle.

### Required environments

- Manager’s office overlooking the stadium.
- Home stadium exterior, day and night.
- Dressing room.
- Players’ tunnel.
- Training ground.
- Tactics room.
- Medical/recovery room.
- Scouting/analytics room.
- Boardroom and finance office.
- Media/creator studio.
- Fan zone and club shop.
- Trophy room/history gallery.
- Youth academy.
- Transfer presentation stage.

### Required 3D object assets

- Tactical tablet and magnetic tactics board.
- Training cones, bibs, footballs, mannequin wall and hurdles.
- Scout binoculars, report folder and analytics tablet.
- Manager clipboard, notebook, whistle and club mug.
- Player boots in tiered quality variants.
- Home, away and goalkeeper kit mannequins.
- Footballs in several progression tiers.
- Trophy set and medals.
- Stadium seat, floodlight, turnstile and ticket objects.
- Camera, microphone, creator lights and streaming desk.
- Treatment table, medical bag and recovery equipment.
- Sponsor backdrop, press desk and podium without baked-in brand text.
- Bus, tunnel signage and locker-room props.

### 3D production constraints

If true runtime 3D is justified, establish budgets before generating or importing models:

- Hero character: 25k–45k triangles, 2K PBR textures, LODs.
- Supporting character: 12k–25k triangles, 1K–2K textures, LODs.
- Hero environment module: 20k–60k triangles depending on reuse.
- Small prop: 500–8k triangles, 512–1K textures.
- Mobile materials should be consolidated and texture atlases used where sensible.
- GLB is the canonical portable format unless the project requires another format.
- Every external/generated 3D asset requires provenance, licence, inspection, validation and an engine import test before being called game-ready.

Because the 3D-production CLI may not be available in every Astra environment, do not pretend a concept render is a validated 3D model. When the model pipeline is unavailable, implement the design with optimised pre-rendered 2D assets and leave an explicit 3D production backlog.

## 8. Full screen redesign

### Home

Use the supplied mockup as the exact quality bar. The screen should include the club identity/status bar, cinematic next-match hero, manager character, Manager’s Desk decisions, Club Pulse, World Moves and premium bottom navigation. Keep one dominant Prepare Match action.

### Squad

Replace the long list feeling with a living dressing-room roster. Use a squad hero showing team rating, morale, fitness and wage pressure. Player cards use consistent portraits, position colour, status, form and availability. Support sorting, filters, injuries, suspensions, selection state and player details. Add a visual starting-XI/bench toggle.

### Player profile

Create a character-led dossier with large portrait, role, age, overall, potential, contract, market value, form, morale and fitness. Include attributes, traits, season stats, career history, training focus, relationships and equipment/boots if supported. Make player development emotionally visible.

### Tactics

Make the pitch the focal point. Use a rich dark-green 3D-like tactical pitch with depth, lighting and clear zones. Player tokens contain portrait, position, rating, fitness and status. Support drag or existing selection behavior without regression. Add formation, mentality, tempo, width, press and instructions in an accessible bottom sheet. Show tactical strengths, weaknesses and chemistry clearly.

### Training

Place the team at a premium training ground. Present a weekly programme with session cards using object/environment art. Show expected development, fatigue and injury risk before confirmation. Add individual focus and coach impact. Make consequences understandable, not merely decorative.

### Market and scouting

Use a scouting-office environment and search cockpit. Player results must remain fast and readable. Add portrait, role, OVR range, potential uncertainty, form, personality hints, wage expectation and scout confidence. Use a selected-player sheet for shortlist, scout, compare, approach and sign actions.

### Matchday

Build anticipation: stadium exterior/tunnel scene, opponent, venue, conditions, attendance, stakes, form and tactical warning. Show starting XI and last-minute decisions. The Play Match CTA is the only primary action. Simulation remains clearly available as a secondary choice.

### Live match

Make the pitch larger and easier to read. Use depth and stadium atmosphere around the tactical map without reducing clarity. Player markers must be distinguishable by club, number and selected state. Keep timeline commentary, possession, shots, momentum, score, clock, speed, pause, subs, tactics and cards functional. Important events use short cinematic overlays with player portraits and club colours.

### Match result

Turn the result into a story. Use stadium/tunnel art, correct emotion for win/draw/loss, hero score, key player, ratings, goals, cards, injuries, fan reaction, finances and progression. Continue remains primary. Analytics and detailed report remain available.

### Club overview

Create an evolving club world. Show the 3D club campus/stadium as the hero, with hotspots for Facilities, Sponsors, Fans, Finances, Academy and History. Club level changes should visibly improve the world.

### Facilities

Use immersive facility art and level progression. Each upgrade must show current effect, next effect, cost, construction time and upkeep. Make upgrades visible in the club world rather than only increasing a number.

### Sponsors

Use original fictional sponsor identities and clean contract cards. Show payment, objectives, exposure requirements, duration, brand fit and risks. Never bake sponsor text into reusable 3D backdrops.

### Fans

Visualise supporter mood, attendance, follower growth, chants, community and fan events. Use original supporter group art and stadium scenes.

### Finances

Preserve accurate figures and make them understandable. Show balance, runway, weekly net, wages, transfer budget, sponsorship, matchday income and commitments. Avoid looking like a banking app. Tie financial information to club-world visuals and decisions.

### Objectives and history

Use a trophy-room/club-history environment. Objectives should feel like a season journey with meaningful rewards, not identical progress cards. History should preserve past seasons, honours, records, famous matches and club legends.

### League, fixtures and world

Improve tables, fixtures and rankings with strong club identity, compact rows and meaningful selected states. Add world-news cards, rivalry stories, manager changes, transfer rumours and creator events.

### Social, press and creators

Make the creator layer central. Include an original social feed, press questions, streaming opportunities, collaborations, controversies and fan sentiment. Use character art for creators, journalists and rivals. Decisions should influence reputation, morale, fans, sponsorship and match pressure where existing systems allow it. Do not add fake mechanics without wiring them to real game state.

### Settings

Keep the screen calm, clear and functional. Resolve toggle ambiguity. Include match speed, presentation, commentary, auto-resolve, audio, reduced motion, reduced effects, text size, colour accessibility and save/account controls as supported.

## 9. Asset-generation plan

Use image generation for art content, not functional UI. Preserve every final prompt and asset purpose in an asset manifest.

Generate the following coherent pack in separate, controlled jobs:

1. 1 persistent manager hero with 5 expressions and 3 crops.
2. 24 fictional player portraits covering goalkeeper, defender, midfielder and attacker archetypes.
3. 8 staff/creator characters.
4. 16 original fictional club crests with transparent or clean isolation.
5. 4 original kit families: home, away, goalkeeper and training.
6. 13 environment scenes listed above, with both hero and card crops where needed.
7. 20 isolated 3D object renders listed above.
8. 12 match/news/story thumbnails covering victories, defeats, transfer signing, injury, training, press, fans and sponsorship.
9. 8 trophy/achievement assets.
10. 6 weather/time stadium variants for matchday atmosphere.

Every generated asset must:

- share the same stylized semi-realistic 3D art direction;
- use consistent lighting and materials;
- avoid real brands and likenesses;
- contain no functional UI or baked-in copy;
- be mapped to a stable manifest key;
- have a documented crop, intended screen and fallback;
- be optimised to the project’s supported image formats;
- be visually inspected at the final rendered size.

## 10. Data-driven asset manifest

Create a central typed manifest rather than scattering file paths throughout components. It should map:

- character ID → portrait/hero/expression assets;
- club ID → crest, colours, kit and stadium assets;
- facility type/level → environment art;
- object type/tier → object render;
- event type → story thumbnail and fallback;
- weather/time → stadium ambience.

Do not assign generated faces randomly at render time. Save the mapping with the game data so identities remain consistent.

## 11. Implementation phases

### Phase 0 — audit and safety

- Map current game and test baseline flows.
- Create a visual migration checklist.
- Identify performance budget and low-end device target.

### Phase 1 — design foundation

- Implement tokens, typography, shell, navigation and shared primitives.
- Add asset manifest and reliable fallbacks.
- Rebuild Home as the approved vertical slice.

### Phase 2 — team management

- Squad, player profile, tactics and training.
- Verify lineup, bench, training and injuries still work.

### Phase 3 — recruitment and economy

- Market, scouting, transfers, finances and sponsors.
- Verify budget, wages, contracts and filters.

### Phase 4 — complete match journey

- Matchday, live match, event overlays, substitutions, tactics and result.
- Verify all speeds, simulation paths and stats.

### Phase 5 — club world and creator identity

- Club, facilities, academy, fans, social, press, creators, objectives and history.
- Connect visuals to actual progression.

### Phase 6 — asset completion

- Replace placeholders with the coherent asset pack.
- Optimise sizes and loading.
- Verify deterministic mappings and licences/provenance.

### Phase 7 — polish and release verification

- Motion, sound hooks, accessibility, empty/error states and lower-end performance.
- Full build, test and screenshot pass.

Do not begin the next phase while the current phase has broken core flows.

## 12. Performance rules

- Measure startup, navigation and match-screen performance before and after.
- Prefer optimised pre-rendered 3D art for normal UI.
- Lazy-load secondary scenes and story imagery.
- Use thumbnails rather than full-resolution assets in lists.
- Avoid stacking several large blur layers.
- Prevent re-render storms on the live-match screen.
- Respect memory limits and test on a representative physical phone if available.
- Provide lower-effects mode using simpler overlays and reduced animation.

## 13. Accessibility and UX requirements

- Minimum practical touch target of 44×44 points.
- Never communicate state through colour alone.
- Text must remain readable over every background.
- Support reduced motion/effects.
- Use clear confirmation for destructive financial and squad decisions.
- Explain why locked/disabled actions cannot be used.
- Preserve screen-reader semantics where supported.
- Keep important decisions reachable without excessive scrolling.

## 14. Required verification

Run the project’s actual formatter, lint, typecheck, tests and production build. Do not weaken checks to obtain a green result.

Verify these real flows:

1. Fresh save → Home → Squad → select lineup.
2. Change formation and tactical instruction.
3. Choose training and observe predicted consequences.
4. Search/filter/scout a player and complete or reject a transfer.
5. Open matchday, play or simulate, use live controls, make a substitution and finish the match.
6. Inspect result, progression, fan response and finances.
7. Upgrade a facility and confirm the correct cost/effect.
8. Advance time and reload the save.
9. Test empty states, injuries, suspension, insufficient funds, transfer window closed and no social posts.
10. Test settings, reduced motion/effects and supported screen sizes.

Capture final screenshots of Home, Squad, Tactics, Training, Market, Matchday, Live Match, Result, Club, Facilities, Finances and Social at 393×852. Compare every screenshot to the supplied Home mockup’s quality bar.

## 15. Definition of done

The redesign is complete only when:

- every current route uses the same design language;
- no legacy flat-black/gray page remains;
- gameplay and saves still work;
- the five main navigation destinations feel visually distinct but coherent;
- the characters retain consistent identities;
- generated imagery contains no functional text or unauthorised brands;
- 3D concepts are not misrepresented as validated runtime models;
- important screens meet the approved Home mockup’s hierarchy and polish;
- performance and accessibility have been checked;
- all relevant tests and builds pass;
- a final report lists changed files, asset manifest, tests, screenshots, limitations and the next highest-impact task.

Work autonomously within the repository. Make reversible changes, reuse strong existing systems and solve root causes. Do not stop at a plan. Implement, test, visually inspect, iterate and report.
```

## Priority asset checklist

- [ ] Manager character: neutral, focused, happy, disappointed, celebrating
- [ ] 24 stable player identities
- [ ] 8 coaches/scouts/creator characters
- [ ] 16 fictional club crests
- [ ] Home, away, goalkeeper and training kits
- [ ] 13 club/stadium environments
- [ ] 20 football/management object renders
- [ ] 12 match and story images
- [ ] 8 trophies and achievements
- [ ] 6 stadium weather/time variants
- [ ] Typed asset manifest with deterministic mappings

## First implementation checkpoint

The first checkpoint should contain the shared design tokens, shell, navigation, image manifest and rebuilt Home screen using `reference-ui/home-redesign.png`. Verify it on 393×852 before expanding to the remaining screens.
