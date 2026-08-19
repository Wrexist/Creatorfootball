# Integration Contract

This file is the coordination point for parallel work. Every module below is
owned by exactly one workstream. **Do not create or edit files outside your
assigned paths.** If you need something another module owns, import it by the
exact signature listed here and assume it exists — it will.

Everything already in `packages/engine/src/core`, `players`, `creators`,
`clubs`, `tactics`, `contracts`, `matches` (types only), `league`, `licensing`,
`content/schema.ts` and `game/state.ts` is **frozen contract**. Read it, import
from it, do not change it. If a contract genuinely blocks you, add a *new*
file in your own directory rather than editing a frozen one, and note it in
your summary.

## Universal rules

1. `packages/engine` must never import React, the DOM, `window`, `document`,
   `localStorage`, Capacitor, or any Node built-in. It is pure TypeScript.
2. No `Math.random()` anywhere in `packages/engine`. Take an `Rng` as a
   parameter. Derive sub-streams with `rng.fork('label')`.
3. No `Date.now()` inside simulation logic. Timestamps arrive as parameters.
4. All state is immutable at the boundary: functions take state and return new
   state or a described delta. Never mutate an argument the caller owns.
5. Money never moves except through `Ledger.post/credit/debit`.
6. Every behaviour that a designer would want to tune lives in a `balance.ts`
   constants object in your module, not inline in the logic.
7. Write Vitest tests next to the code as `*.test.ts`. Test behaviour, not
   implementation detail.
8. TypeScript is `strict` with `noUncheckedIndexedAccess`. `pnpm --filter
   @cf/engine typecheck` must pass with zero errors when you finish.
9. Comments explain *why*, never *what*. Match the density of the existing
   files: a short block comment at the top of a module explaining its role and
   its trade-offs, and inline comments only where the reason is non-obvious.

---

## Workstream A — Match Simulation Engine
**Owns:** `packages/engine/src/matches/**` (except the frozen type files
`events.ts`, `decisions.ts`, `specialRules.ts`, `result.ts`),
`packages/engine/src/tactics/**` (except frozen `tactics.ts`).

Must export from `packages/engine/src/matches/simulator.ts`:
```ts
export interface MatchSetup {
  matchId: MatchId; seed: string;
  home: MatchTeam; away: MatchTeam;
  config: MatchConfig;
  importance: number;      // 1-5
  isDerby: boolean;
  rivalryIntensity: number; // 0-100
  attendance: number; homeAdvantage: number; // 0-1
  enabledSpecialRules: readonly SpecialRuleId[];
  neutralVenue?: boolean;
}
export interface MatchTeam {
  clubId: ClubId; name: string; shortName: string;
  players: readonly Player[];          // full squad available for selection
  tactics: TacticSetup;
  managerBonus: ManagerMatchBonus;     // derived from Manager attributes
  creatorPresence: number;             // 0-1, drives CREATOR_MOMENT frequency
  ruleCards: readonly SpecialRuleId[];
  isPlayerControlled: boolean;
}
export interface MatchConfig {
  minutes: number; halves: number; playersOnPitch: number;
  benchSize: number; substitutions: number;
  liveDecisions: boolean; maxDecisions: number;
}
export interface ManagerMatchBonus {
  tactical: number; motivation: number; adaptability: number; discipline: number;
}

/** Runs the whole match with no player input. Deterministic given the seed. */
export function simulateMatch(setup: MatchSetup): MatchResult;

/** Steppable simulation for the live, player-controlled match. */
export class MatchSimulator {
  constructor(setup: MatchSetup);
  readonly setup: MatchSetup;
  /** Advance one tick. Returns events produced this tick. */
  step(): readonly MatchEvent[];
  /** Current renderer frame. */
  frame(): PitchFrame;
  /** Non-null while awaiting a live decision; the sim will not advance until resolved. */
  pendingDecision(): DecisionPrompt | null;
  resolveDecision(promptId: string, optionId: string): void;
  applyTacticalChange(side: Side, change: Partial<TacticSetup>): void;
  makeSubstitution(side: Side, out: PlayerId, in_: PlayerId): boolean;
  playRuleCard(side: Side, ruleId: SpecialRuleId): boolean;
  readonly isComplete: boolean;
  /** Available only once complete. */
  result(): MatchResult;
  /** Skip to the end without further prompts (used by "simulate rest"). */
  finish(): MatchResult;
  score(): { home: number; away: number };
  minute(): number;
  momentum(): number;
}
```
Also export from `packages/engine/src/tactics/vector.ts`:
```ts
export function toTacticVector(t: TacticSetup, ctx: { squadQuality: number; managerTactical: number }): TacticVector;
export const FORMATIONS: readonly Formation[];         // in tactics/formations.ts
export function formationById(id: string): Formation;
export function autoLineup(players: readonly Player[], formation: Formation): TacticSetup;
```

**Design requirements**
- Tick-based possession model. A tick is ~6 seconds of match time. State
  machine over phases: build-up → progression → final third → shot / turnover.
- Chance quality is a continuous xG value, not a coin flip. Goals come from xG.
- Fatigue accrues per tick from tactic vector + player stamina + traits, and
  degrades effective attributes. This is what makes a high press cost something.
- Momentum is a *derived summary* of recent xG, possession and events —
  explicitly NOT rubber-banding. It must not directly add goal probability by
  more than a small, documented amount.
- Traits are read via `traitModifier()` with the correct active conditions
  (`BIG_MATCH` when importance ≥ 4, `DERBY`, `LATE_GAME` after 75% elapsed,
  `LOSING`, `HOME`, `YOUNG` age ≤ 21, `VETERAN` age ≥ 31).
- Live decisions: generate at most `config.maxDecisions` prompts per match, at
  genuinely meaningful moments. Each prompt gets 2-3 options; every option must
  have a real downside encoded in its modifiers. Never generate two prompts
  within 6 match minutes of each other.
- Special rules fire from `enabledSpecialRules` plus played rule cards, obeying
  each definition's phase window. Emit `SPECIAL_RULE_START`/`END` events with a
  human-readable `reason`.
- Produce `PitchFrame`s good enough to animate: players move toward plausible
  positions given the formation, phase and ball location. It does not need to
  be a physics sim; it needs to be legible.
- Commentary: generate `text` on every event via a template table you own at
  `matches/commentary.ts`. Vary lines; never repeat the same line twice within
  one match if alternatives exist.
- Player ratings 1.0-10.0 computed from contributions, not from the scoreline.

**Validation targets** (see `docs/SIMULATION_REFERENCE_DATA.md` if present;
otherwise use these): for the default 30-minute short format, mean total goals
per match 4.5-6.5, shots per team 8-14, conversion 12-20%, possession split
within 35-65%, yellow cards 1-3 per match, red cards under 0.12 per match,
injuries under 0.15 per match. A team with a 15-point squad-quality advantage
should win roughly 60-70% of the time, never 95%+.

Write `matches/simulator.test.ts` proving: determinism (same seed → identical
result twice), aggregate realism over 500 simulated matches, that the stronger
side wins more often than the weaker, that an upset is still possible, and that
no impossible state occurs (negative scores, players on pitch after a red card,
more than the allowed substitutions).

---

## Workstream B — Content: fictional universe + generators
**Owns:** `packages/engine/src/content/**` except the frozen `schema.ts`.

Must export:
```ts
// content/packs/base/index.ts
export const BASE_PACK: ContentPack;   // 100% fictional, complete on its own

// content/loader.ts
export class ContentRegistry {
  load(pack: ContentPack): ValidationIssue[];
  unload(packId: string): void;
  packs(): readonly ContentPackManifest[];
  clubs(): readonly ClubTemplate[];
  players(): readonly PlayerTemplate[];
  creators(): readonly CreatorTemplate[];
  managers(): readonly ManagerTemplate[];
  sponsors(): readonly SponsorTemplate[];
  facilities(): readonly FacilityDef[];
  objectives(): readonly ObjectiveTemplate[];
  offers(): readonly StoreOfferDef[];
  commentary(): readonly CommentaryLine[];
  socialTemplates(): readonly SocialTemplate[];
  mediaTemplates(): readonly MediaTemplate[];
  nameBank(): NameBankDef;
  seasonConfig(): SeasonConfigDef;
  /** Region + clock aware; filters out licensed content whose rights lapsed. */
  visibleFor(region: string, now: number): ContentRegistry;
}
export function validatePack(pack: ContentPack): ValidationIssue[];

// content/generators/playerGenerator.ts
export function generatePlayer(rng: Rng, opts: GeneratePlayerOptions): Player;
export function generateSquad(rng: Rng, opts: GenerateSquadOptions): Player[];
// content/generators/creatorGenerator.ts
export function generateCreator(rng: Rng, opts: GenerateCreatorOptions): Creator;
// content/generators/clubGenerator.ts
export function clubFromTemplate(rng: Rng, t: ClubTemplate, id: ClubId): Club;
// content/generators/managerGenerator.ts
export const MANAGER_ARCHETYPES: readonly ManagerArchetype[];
export const PREMADE_MANAGERS: readonly ManagerTemplate[];
export function generateManager(rng: Rng, opts): Manager;
```

**Content requirements** — all fictional, all original. Legally this must not
resemble any real club, league, creator or footballer in name, badge, colours
or biography.
- **12 clubs** forming one league, each with a genuinely distinct identity:
  name, city, colours (from the token palette family, but each visually
  separable), badge shape + motif, philosophy, fan culture, reputation,
  strength rating, budget, stadium, motto, AI profile, and 1-2 declared rivals.
  Spread strength so the league has a clear favourite, a mid pack and strugglers.
- **A name bank** large enough that generated players rarely repeat: 220+ first
  names and 220+ surnames spanning a plausible mix of invented and
  common-across-many-cultures names, plus 60+ city names, 40+ club prefixes and
  suffixes, 80+ social handles, and 25 fictional nationalities with weights.
  Do NOT use real-world country names; invent nations with plausible demonyms.
- **28 named creators** spanning all five tiers and all six content tones, each
  with a one-line bio that establishes a personality. Some are players, some
  managers, some pure media. They must feel like people, not stat blocks.
- **10 pre-made selectable managers**, each mapping to a distinct archetype.
- **8 manager archetypes** (Tactician, Motivator, Showman, Data Nerd, Gambler,
  Disciplinarian, People's Manager, Entrepreneur) with real strengths AND real
  weaknesses in their attribute modifiers.
- **20 fictional sponsors** across tiers and slots, with reputation/follower
  gates so sponsorship progression is felt.
- **11 facilities** (stadium, training centre, medical, academy, scouting,
  analytics, media dept, creator studio, merchandising, fan zone, recovery),
  each with 5 levels, real costs, real upkeep, and a machine-readable `effects`
  map keyed to systems that will read them: `trainingGain`, `injuryRecovery`,
  `injuryResistance`, `youthQuality`, `scoutSpeed`, `scoutAccuracy`,
  `tacticalInsight`, `mediaDamping`, `creatorReach`, `merchMultiplier`,
  `matchdayRevenue`, `fanSentimentGain`, `stadiumCapacity`, `atmosphere`.
- **40+ objective templates** across sources (season/dynamic/sponsor/board/fans).
- **24 store offer definitions** on a 4-week rotation. Cosmetics, convenience
  and content only — nothing that sells competitive advantage outright.
- **200+ commentary lines** across match event types and tones. They must sound
  like a broadcast, be varied, and never name a real person or club.
- **120+ social post templates** and **60+ media story templates**, keyed to
  triggers the world engine emits.
- **Season config**: 12 clubs, 2 rounds (22 matches), 30-minute matches in 2
  halves, 6 outfield + 1 GK on the pitch, squad of 18, bench 7, 5 subs.

Generators must produce players whose overall matches a requested target within
±3, whose potential respects age (young players have headroom, 30+ do not), and
whose traits obey the trait's `positions` and `conditions` constraints. Test
the distributions.

---

## Workstream C — Squad & club management systems
**Owns:** `packages/engine/src/transfers/**`, `contracts/negotiation.ts` and
`contracts/wages.ts`, `training/**`, `facilities/**`, `fans/**`, `sponsors/**`,
`economy/**` except the frozen `ledger.ts`.

Must export:
```ts
// transfers/valuation.ts
export function marketValue(p: Player, ctx: ValuationContext): number;
export function wageDemand(p: Player, ctx: ValuationContext): number;
export function askingPrice(p: Player, sellingClub: Club | null, ctx: ValuationContext): number;
// transfers/market.ts
export function refreshMarket(state, rng, ctx): MarketDelta;      // free agents, listings, rumours
export function searchPlayers(state, filters): PlayerId[];
// transfers/negotiation.ts
export function openNegotiation(...): Negotiation;
export function submitOffer(neg, terms, ctx, rng): NegotiationStep;
export function aiCounter(neg, ctx, rng): Negotiation;
export function completeTransfer(...): TransferOutcome;   // must post to the Ledger
// training/training.ts
export const TRAINING_PROGRAMS: readonly TrainingProgram[];
export function runTrainingCycle(state, rng, ctx): TrainingCycleResult;
// training/development.ts
export function developPlayer(p, rng, ctx): PlayerDevelopment;
// scouting lives here too: transfers/scouting.ts
export function assignScout(...); export function advanceScouting(...);
export function knowledgeRange(p: Player, key: AttributeKey): [number, number];
// facilities/facilities.ts
export function facilityEffect(club: Club, key: string, registry): number;
export function upgradeFacility(...): UpgradeOutcome;   // must post to the Ledger
// fans/fans.ts
export function updateFanState(club, inputs, rng): FanState;
export function attendanceFor(club, fixtureImportance, rng): number;
export function matchdayRevenue(club, attendance): RevenueBreakdown;
// sponsors/sponsors.ts
export function generateSponsorOffers(...): SponsorOffer[];
export function advanceSponsorDeals(...): SponsorCycleResult;
// economy/cycle.ts
export function runFinancialCycle(state, ledger, ctx): FinanceCycleResult;
// economy/audit.ts
export function auditEconomy(state, ledger): InvariantViolation[];
```

**Design requirements**
- Transfers are a negotiation with counter-offers, agent demands, rival
  bidders, player preference and patience — never a one-click buy. Failure
  modes must include "the player lost interest" and "a rival hijacked it".
- Progressive scouting: `knowledgeRange` returns a wide band at confidence 0
  and the exact value at confidence 1. Good scouting is a real edge.
- Training programs are a small set with trade-offs, not sliders. Fitness
  training costs technical growth; hard intensity raises injury risk.
- Development depends on age, potential, facility level, minutes played,
  professionalism and the manager's `playerDevelopment`.
- The fan loop must close: performance → sentiment → attendance → revenue →
  investment → performance, with the counter-pressures the brief demands
  (rising wages, rising expectations, bigger fees) so it cannot run away.
- Everything that costs or earns money posts a Ledger transaction with a
  meaningful memo. `auditEconomy` must catch: negative balances, double-claimed
  rewards, wage totals that do not reconcile, and non-finite values.

---

## Workstream D — Living world: media, social, rivalries, AI, story
**Owns:** `packages/engine/src/media/**`, `social/**`, `rivalries/**`,
`simulation/**`, `analytics/**`, `progression/**`, `objectives/**`.

Must export:
```ts
// media/mediaEngine.ts
export function generateStories(events: readonly AnyDomainEvent[], state, rng, registry): NewsStory[];
// social/socialEngine.ts
export function generatePosts(events: readonly AnyDomainEvent[], state, rng, registry): SocialPost[];
export function socialReach(state): { impressions: number; followerDelta: number };
// rivalries/rivalries.ts
export function seedRivalries(clubs, templates, rng): Record<string, Rivalry>;
export function updateRivalry(r, result, rng): Rivalry;
export function rivalryFor(state, a: ClubId, b: ClubId): Rivalry | null;
// simulation/aiClub.ts
export const AI_PROFILES: readonly AiProfile[];
export function aiClubTurn(state, clubId, rng, ctx): AiActions;
// simulation/worldTick.ts
export function tickWorld(state, rng, ctx): WorldTickResult;  // AI transfers, dev, form, injuries, fan drift
// progression/objectives.ts
export function rollObjectives(state, rng, registry): Objective[];
export function updateObjectiveProgress(state, events): ObjectiveUpdate[];
export function claimObjective(state, ledger, id, ctx): ClaimResult;
// progression/legacy.ts
export function updateLegacy(state, events): LegacyState;
export function summariseSeason(state): SeasonSummary;
// analytics/analytics.ts
export const ANALYTICS_EVENTS: readonly string[];
export function trackEvent(name: string, props?: Record<string, unknown>): void;
export function setAnalyticsSink(sink: (name: string, props: Record<string, unknown>) => void): void;
```

**Design requirements**
- Social and media content is generated **from domain events only**. A post
  that does not trace back to something that actually happened is a bug. Every
  post carries `relatedEventId` where one exists.
- A single event should be able to cascade: red card → suspension → fan anger →
  media story → rival creator dunk → morale hit → rivalry intensity. Implement
  that cascade explicitly.
- Feed weighting: important stories get higher `weight` so the UI can render
  them larger. Minor chatter stays compact.
- AI clubs act on strategy profiles (Youth Factory, Big Spenders, Analytics,
  Creator Club, Defensive Specialists, Local Underdog, Showtime, Veteran Core).
  Their transfer behaviour must reflect finances, needs, philosophy and league
  position. The world must evolve whether or not the player acts.
- Emergent stories: detect patterns over history (a player scoring in three
  consecutive derbies; a keeper on a clean-sheet run; a signing flopping) and
  promote them into media and social content. Do not hard-script narratives.
- Objectives react to game state and must never be trivially or impossibly set.

---

## Workstream E — Documentation
**Owns:** `docs/**` except `docs/RESEARCH_CREATOR_FOOTBALL.md`,
`docs/SIMULATION_REFERENCE_DATA.md` and this file.

---

## Workstream F — Design system (React)
**Owns:** `apps/game/src/design/**`.
The token layer `apps/game/src/design/tokens.css` is frozen — extend it by
adding tokens, never by changing existing ones.

---

## Workstream G — Game orchestration (owner: lead)
**Owns:** `packages/engine/src/game/**` except frozen `state.ts`,
`packages/engine/src/league/**` except frozen `types.ts`,
`packages/engine/src/persistence/**`.
