import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import { pendingProgression, pendingSocial, pendingSquad } from './pending';

/**
 * Where the router gets its screens.
 *
 * Every entry is an async loader, so each feature area becomes its own chunk
 * and only the shell plus the route the player actually opened is downloaded.
 * The matchday module is the one that matters most: the live match carries the
 * pitch renderer and the commentary engine, and it must never sit in the chunk
 * that has to arrive before the splash can leave.
 *
 * Each loader is typed to the exact export list its barrel promises, which
 * means the temporary stand-ins in `pending.tsx` can be swapped for the real
 * modules — the expression is written beside each one — and the compiler
 * checks the swap rather than the reviewer. Deleting `pending.tsx` after that
 * swap is the whole cleanup.
 */

type ScreenModule<K extends string> = Readonly<Record<K, ComponentType>>;
type Loader<K extends string> = () => Promise<ScreenModule<K>>;

/* --- The three lines still pointing at `pending.tsx` are the only temporary
       ones left; each carries the real expression to swap in. Home, matchday,
       club, market and league are already wired to their real barrels. ----- */

const home: Loader<'HomeScreen'> =
  () => import('@/features/home');

const matchday: Loader<'MatchPreviewScreen' | 'MatchLiveScreen' | 'MatchResultScreen'> =
  () => import('@/features/matchday');

const club: Loader<
  | 'ClubScreen' | 'FacilitiesScreen' | 'SponsorsScreen' | 'FansScreen'
  | 'FinancesScreen' | 'HistoryScreen' | 'TrophyRoomScreen'
> = () => import('@/features/club');

const squad: Loader<'SquadScreen' | 'PlayerProfileScreen' | 'TacticsScreen' | 'TrainingScreen'> =
  pendingSquad; // → () => import('@/features/squad')

const market: Loader<'MarketScreen' | 'PlayerSearchScreen' | 'NegotiationScreen' | 'ScoutingScreen'> =
  () => import('@/features/market');

const league: Loader<
  'LeagueScreen' | 'StandingsScreen' | 'FixturesScreen' | 'RivalriesScreen' | 'SeasonOverviewScreen'
> = () => import('@/features/league');

const social: Loader<'SocialScreen' | 'MediaScreen' | 'CreatorProfileScreen'> =
  pendingSocial; // → () => import('@/features/social')

const progression: Loader<
  'ObjectivesScreen' | 'RewardsScreen' | 'StoreScreen' | 'SettingsScreen' | 'ContentPacksScreen'
> = pendingProgression; // → () => import('@/features/progression')

/* --- end temporary block ---------------------------------------------- */

/** `React.lazy` over a named export rather than a default one. */
function screen<K extends string>(load: Loader<K>, name: K): LazyExoticComponent<ComponentType> {
  return lazy(async () => ({ default: (await load())[name] }));
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
export const MediaScreen = screen(social, 'MediaScreen');
export const CreatorProfileScreen = screen(social, 'CreatorProfileScreen');

/* Progression, settings and store */
export const ObjectivesScreen = screen(progression, 'ObjectivesScreen');
export const RewardsScreen = screen(progression, 'RewardsScreen');
export const StoreScreen = screen(progression, 'StoreScreen');
export const SettingsScreen = screen(progression, 'SettingsScreen');
export const ContentPacksScreen = screen(progression, 'ContentPacksScreen');

/** Warms the chunk the player is most likely to need next. */
export const preloadHome = (): void => { void home(); };
export const preloadMatchday = (): void => { void matchday(); };
