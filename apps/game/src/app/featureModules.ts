import { createElement, use, type ComponentType, type ReactNode } from 'react';

/**
 * Where the router gets its screens.
 *
 * Every entry is an async loader, so each feature area becomes its own chunk
 * and only the shell plus the route the player actually opened is downloaded.
 * The matchday module is the one that matters most: the live match carries the
 * pitch renderer and the commentary engine, and it must never sit in the chunk
 * that has to arrive before the splash can leave.
 *
 * Each loader is typed to the exact export list its barrel promises, so a
 * feature area that renames or drops a screen fails the typecheck here rather
 * than at runtime on the route nobody opened before shipping.
 */

type ScreenModule<K extends string> = Readonly<Record<K, ComponentType>>;
type Loader<K extends string> = () => Promise<ScreenModule<K>>;

interface Chunk<K extends string> {
  /** Begins the download, or hands back the one already in flight. */
  readonly preload: () => Promise<void>;
  /** The module, if it has already arrived. `null` means it has not. */
  readonly ready: () => ScreenModule<K> | null;
}

/**
 * A dynamic import that remembers what it loaded.
 *
 * This is the whole reason these screens are not plain `React.lazy`. Warming a
 * chunk ahead of time puts the module in the bundler's cache, but `React.lazy`
 * does not look there: it runs its own loader on first render and suspends
 * until *that* promise settles. A promise that resolves from cache still
 * resolves a microtask later than the render that needed it — which is late
 * enough for React to commit the `Suspense` fallback, so the player gets a
 * full-page skeleton flashed at them for one frame on a screen that was
 * already downloaded.
 *
 * Holding the module here instead means a warmed chunk is available
 * *synchronously*, during the render that asks for it, and the fallback never
 * enters the picture. A cold chunk behaves exactly as before.
 */
function chunk<K extends string>(load: Loader<K>): Chunk<K> {
  let module: ScreenModule<K> | null = null;
  let pending: Promise<void> | null = null;
  return {
    // Cached, because `use` requires a stable promise across render attempts —
    // and because two screens in the same area must not fetch it twice.
    preload: () => (pending ??= load().then((m) => { module = m; })),
    ready: () => module,
  };
}

const home = chunk<'HomeScreen'>(() => import('@/features/home'));

const matchday = chunk<'MatchPreviewScreen' | 'MatchLiveScreen' | 'MatchResultScreen'>(
  () => import('@/features/matchday'),
);

const club = chunk<
  | 'ClubScreen' | 'FacilitiesScreen' | 'SponsorsScreen' | 'FansScreen'
  | 'FinancesScreen' | 'HistoryScreen' | 'TrophyRoomScreen'
>(() => import('@/features/club'));

const squad = chunk<'SquadScreen' | 'PlayerProfileScreen' | 'TacticsScreen' | 'TrainingScreen'>(
  () => import('@/features/squad'),
);

const market = chunk<'MarketScreen' | 'PlayerSearchScreen' | 'NegotiationScreen' | 'ScoutingScreen'>(
  () => import('@/features/market'),
);

const league = chunk<
  'LeagueScreen' | 'StandingsScreen' | 'FixturesScreen' | 'RivalriesScreen' | 'SeasonOverviewScreen'
>(() => import('@/features/league'));

const social = chunk<
  'SocialScreen' | 'MediaScreen' | 'CreatorProfileScreen'
  | 'PressConferenceScreen' | 'CreatorHubScreen' | 'CommunityScreen'
>(() => import('@/features/social'));

const progression = chunk<
  'ObjectivesScreen' | 'RewardsScreen' | 'StoreScreen' | 'SettingsScreen' | 'ContentPacksScreen'
>(() => import('@/features/progression'));

/** One named export of a chunk, as a component the router can route to. */
function screen<K extends string>(source: Chunk<K>, name: K): ComponentType {
  function Screen(): ReactNode {
    // Warmed: straight through, same as any ordinary component.
    // Cold: `use` suspends on the download and React retries this render when
    // it lands, at which point `ready()` answers.
    const module = source.ready() ?? (use(source.preload()), source.ready());
    if (!module) throw new Error(`the chunk owning ${name} resolved to nothing`);
    return createElement(module[name]);
  }
  Screen.displayName = name;
  return Screen;
}

/* Home */
export const HomeScreen = screen(home, 'HomeScreen');

/* Matchday */
export const MatchPreviewScreen = screen(matchday, 'MatchPreviewScreen');
export const MatchLiveScreen = screen(matchday, 'MatchLiveScreen');
export const MatchResultScreen = screen(matchday, 'MatchResultScreen');

/* Club */
export const ClubScreen = screen(club, 'ClubScreen');
export const FacilitiesScreen = screen(club, 'FacilitiesScreen');
export const SponsorsScreen = screen(club, 'SponsorsScreen');
export const FansScreen = screen(club, 'FansScreen');
export const FinancesScreen = screen(club, 'FinancesScreen');
export const HistoryScreen = screen(club, 'HistoryScreen');
export const TrophyRoomScreen = screen(club, 'TrophyRoomScreen');

/* Squad */
export const SquadScreen = screen(squad, 'SquadScreen');
export const PlayerProfileScreen = screen(squad, 'PlayerProfileScreen');
export const TacticsScreen = screen(squad, 'TacticsScreen');
export const TrainingScreen = screen(squad, 'TrainingScreen');

/* Market */
export const MarketScreen = screen(market, 'MarketScreen');
export const PlayerSearchScreen = screen(market, 'PlayerSearchScreen');
export const NegotiationScreen = screen(market, 'NegotiationScreen');
export const ScoutingScreen = screen(market, 'ScoutingScreen');

/* League */
export const LeagueScreen = screen(league, 'LeagueScreen');
export const StandingsScreen = screen(league, 'StandingsScreen');
export const FixturesScreen = screen(league, 'FixturesScreen');
export const RivalriesScreen = screen(league, 'RivalriesScreen');
export const SeasonOverviewScreen = screen(league, 'SeasonOverviewScreen');

/* Social */
export const SocialScreen = screen(social, 'SocialScreen');
export const PressConferenceScreen = screen(social, 'PressConferenceScreen');
export const CreatorHubScreen = screen(social, 'CreatorHubScreen');
export const CommunityScreen = screen(social, 'CommunityScreen');
export const MediaScreen = screen(social, 'MediaScreen');
export const CreatorProfileScreen = screen(social, 'CreatorProfileScreen');

/* Progression, settings and store */
export const ObjectivesScreen = screen(progression, 'ObjectivesScreen');
export const RewardsScreen = screen(progression, 'RewardsScreen');
export const StoreScreen = screen(progression, 'StoreScreen');
export const SettingsScreen = screen(progression, 'SettingsScreen');
export const ContentPacksScreen = screen(progression, 'ContentPacksScreen');

/** Warms the chunk the player is most likely to need next. */
export const preloadHome = (): void => { void home.preload(); };
export const preloadMatchday = (): void => { void matchday.preload(); };

/**
 * Warms every chunk the tab bar can reach, once the app has gone quiet.
 *
 * Code splitting buys a fast first paint and charges for it on the first visit
 * to each tab: the screen mounts, its chunk is not there yet, and the player
 * watches a skeleton for as long as the download takes. On a tab bar that is
 * the wrong trade entirely — every one of these is a single tap away, and four
 * of the five would pay the toll.
 *
 * So keep the splitting and stop it ever being visible: once the first screen
 * has settled and the main thread is idle, fetch the rest in the background.
 * Idle-scheduled precisely so this never competes with the screen the player is
 * actually looking at.
 */
export function preloadPrimaryNav(): void {
  const warm = (): void => {
    void home.preload(); void squad.preload(); void club.preload();
    void league.preload(); void social.preload();
  };
  const idle = (globalThis as {
    requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => void;
  }).requestIdleCallback;
  // Safari has no `requestIdleCallback`, and iOS is the target platform.
  if (idle) idle(warm, { timeout: 3000 });
  else setTimeout(warm, 1200);
}
