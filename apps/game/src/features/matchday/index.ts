/**
 * Matchday — preview, live match, result and analytics.
 *
 * The router imports the three route components from here and nothing else
 * from inside this folder. Everything below `matchday/` is private to the
 * workstream so the internals can be restructured without touching routing.
 *
 * Route bindings:
 *   /matchday/preview/:fixtureId  -> MatchPreviewScreen
 *   /matchday/live/:fixtureId     -> MatchLiveScreen      (immersive)
 *   /matchday/result/:matchId     -> MatchResultScreen    (immersive)
 *
 * Analytics is a tab inside the result screen, not a route of its own.
 */

export { MatchPreviewScreen } from './preview/MatchPreviewScreen';
export { MatchLiveScreen } from './live/MatchLiveScreen';
export { MatchResultScreen } from './result/MatchResultScreen';

/* Shared matchday derivations, for a hub screen or a home-screen card that
   wants the same fixture context without duplicating the selectors. */
export {
  useMatchdayContext, buildMatchdayContext,
  type MatchdayContext, type KeyBattle, type LineupSlot, type StakesLine, type SideAvailability,
} from './shared/context';
export { kitColors, kitPalette, paletteFor, type KitColors, type KitPalette } from './shared/kit';
