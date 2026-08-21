import { lazy, type ReactNode } from 'react';
import {
  Navigate, Outlet, Route, Routes, useNavigate, type Location,
} from 'react-router-dom';
import { nextFixture } from '@cf/engine';
import { EmptyState, GlassButton, Screen, Skeleton, SkeletonRegion } from '@/design';
import { useGameStore } from '@/state/gameStore';
import { TitleScreen } from '@/features/onboarding';
import { ROUTES, buildPath } from './routes';
import {
  ClubScreen, ContentPacksScreen, CreatorProfileScreen, FacilitiesScreen, FansScreen,
  FinancesScreen, FixturesScreen, HistoryScreen, HomeScreen, LeagueScreen, MarketScreen,
  MatchLiveScreen, MatchPreviewScreen, MatchResultScreen, MediaScreen, NegotiationScreen,
  ObjectivesScreen, PlayerProfileScreen, PlayerSearchScreen, RewardsScreen, RivalriesScreen,
  ScoutingScreen, SeasonOverviewScreen, SettingsScreen, SocialScreen, SponsorsScreen,
  PressConferenceScreen, CreatorHubScreen, CommunityScreen,
  SquadScreen, StandingsScreen, StoreScreen, TacticsScreen, TrainingScreen, TrophyRoomScreen,
} from './featureModules';

/**
 * The route table, one-to-one with the frozen map in `routes.ts`.
 *
 * Two rules hold this together. First, nothing here invents a path: every
 * `path` is read from `ROUTES`, so a deep link, the tab bar and the analytics
 * screen name can never disagree. Second, every screen behind a save sits
 * inside one guard rather than checking for itself — a screen that has to
 * defend against a missing game is a screen written twice.
 */

/* Creation screens are lazy for the same reason the feature areas are: a
   returning player with a save never downloads the badge designer. */
const ManagerCreationScreen = lazy(async () => ({
  default: (await import('@/features/creation')).ManagerCreationScreen,
}));
const ClubCreationScreen = lazy(async () => ({
  default: (await import('@/features/creation')).ClubCreationScreen,
}));
const SquadIntroScreen = lazy(async () => ({
  default: (await import('@/features/creation')).SquadIntroScreen,
}));

/* The gallery is a development surface and the one deliberate exception to
   "import only from @/design": it is not part of the kit's public barrel, and
   it must never be pulled into a player-facing chunk. */
const Gallery = lazy(async () => ({ default: (await import('@/design/Gallery')).Gallery }));

/**
 * Shown while a route's chunk is in flight. It mirrors the shape of a `Screen`
 * — header band, title, cards — so the arriving screen settles into the layout
 * instead of replacing it.
 */
export function ScreenFallback(): ReactNode {
  return (
    <SkeletonRegion loading label="Loading screen" className="h-full bg-base">
      <div className="flex h-full flex-col">
        <div className="glass-3 shrink-0 border-b border-white/[0.07] pt-[var(--safe-top)]">
          <div className="mx-auto flex h-[52px] w-full max-w-[1180px] items-center px-4 sm:px-6">
            <Skeleton variant="text" width={120} />
          </div>
        </div>
        <div className="mx-auto w-full max-w-[1180px] flex-1 px-4 pt-4 sm:px-6">
          <Skeleton variant="title" width="60%" />
          <div className="mt-5 flex flex-col gap-3">
            <Skeleton variant="card" height={132} />
            <Skeleton variant="row" lines={4} />
          </div>
        </div>
      </div>
    </SkeletonRegion>
  );
}

/**
 * The save guard.
 *
 * A deep link into a game screen with no save is a completely ordinary thing —
 * a shared link, a stale home-screen shortcut, a bookmark after a reset — and
 * it must land somewhere sensible rather than crashing on the first selector
 * that assumes a club.
 *
 * The guard's one hard rule: **it may only decide once boot has decided.**
 * `BOOTING` is not "no save", it is "we have not looked yet", and treating the
 * two as the same thing is what made a deep link bounce to the title screen on
 * roughly one load in twenty-seven — whenever the first render landed before
 * `loadGame` resolved. Because the bounce is a `replace`, the player could not
 * even go back to the link they followed. `CREATING` is the same story from the
 * other end: a game is being built right now, so waiting is correct and
 * redirecting is not.
 *
 * There is deliberately no `state.from` here any more. It had no consumer, and
 * with the boot race fixed there is nothing left for it to describe: the only
 * redirects that survive are "there is genuinely no save" and "the save is
 * broken", and in both of those the destination the player asked for cannot be
 * restored by remembering it — there is no game to open it against.
 */
function RequireGame(): ReactNode {
  const phase = useGameStore((s) => s.phase);
  if (phase === 'READY') return <Outlet />;
  if (phase === 'BOOTING' || phase === 'CREATING') return <ScreenFallback />;
  return <Navigate to={ROUTES.onboarding} replace />;
}

/**
 * Where `/` goes once boot has decided what exists — and not one render before.
 * Same race as `RequireGame`: sending a returning player to the title screen
 * because the save had not finished loading is a bug they experience as "it
 * forgot my club".
 */
function BootRedirect(): ReactNode {
  const phase = useGameStore((s) => s.phase);
  if (phase === 'BOOTING' || phase === 'CREATING') return <ScreenFallback />;
  return <Navigate to={phase === 'READY' ? ROUTES.home : ROUTES.onboarding} replace />;
}

/**
 * The matchday tab has no screen of its own — it is a pointer at whatever is
 * next. Resolving that here keeps the fixture lookup in one place instead of
 * making the preview screen guess when it arrives without an id.
 */
function MatchdayIndex(): ReactNode {
  const state = useGameStore((s) => s.state);
  const fixture = state ? nextFixture(state) : null;
  if (fixture) {
    return <Navigate to={buildPath(ROUTES.matchPreview, { fixtureId: fixture.id })} replace />;
  }
  // Nothing left to play — the preview screen says so better than a redirect can.
  return <MatchPreviewScreen />;
}

function NotFound(): ReactNode {
  const phase = useGameStore((s) => s.phase);
  const navigate = useNavigate();
  const home = phase === 'READY' ? ROUTES.home : ROUTES.onboarding;
  return (
    <Screen title="Not found" withTabBar={false}>
      <EmptyState
        title="There is nothing here"
        description="That link points at a screen this version of the game does not have."
        action={
          <GlassButton variant="secondary" size="md" onClick={() => navigate(home, { replace: true })}>
            Back to {phase === 'READY' ? 'the club' : 'the start'}
          </GlassButton>
        }
      />
    </Screen>
  );
}

/**
 * `location` is passed in rather than read from context so that the screen
 * currently animating out keeps rendering its own route until it has gone.
 */
export function AppRoutes({ location }: { location: Location }): ReactNode {
  return (
    <Routes location={location}>
      <Route path={ROUTES.splash} element={<BootRedirect />} />

      {/* Onboarding and creation: reachable with or without a save. */}
      <Route path={ROUTES.onboarding} element={<TitleScreen />} />
      <Route path={ROUTES.managerCreation} element={<ManagerCreationScreen />} />
      <Route path={ROUTES.clubCreation} element={<ClubCreationScreen />} />

      {/* Everything from here needs a game. */}
      <Route element={<RequireGame />}>
        <Route path={ROUTES.squadBuilder} element={<SquadIntroScreen />} />

        <Route path={ROUTES.home} element={<HomeScreen />} />

        <Route path={ROUTES.club} element={<ClubScreen />} />
        <Route path={ROUTES.facilities} element={<FacilitiesScreen />} />
        <Route path={ROUTES.sponsors} element={<SponsorsScreen />} />
        <Route path={ROUTES.fans} element={<FansScreen />} />
        <Route path={ROUTES.finances} element={<FinancesScreen />} />
        <Route path={ROUTES.history} element={<HistoryScreen />} />
        <Route path={ROUTES.trophyRoom} element={<TrophyRoomScreen />} />

        <Route path={ROUTES.squad} element={<SquadScreen />} />
        <Route path={ROUTES.player} element={<PlayerProfileScreen />} />
        <Route path={ROUTES.tactics} element={<TacticsScreen />} />
        <Route path={ROUTES.training} element={<TrainingScreen />} />

        <Route path={ROUTES.matchday} element={<MatchdayIndex />} />
        <Route path={ROUTES.matchPreview} element={<MatchPreviewScreen />} />
        <Route path={ROUTES.matchLive} element={<MatchLiveScreen />} />
        <Route path={ROUTES.matchResult} element={<MatchResultScreen />} />

        <Route path={ROUTES.market} element={<MarketScreen />} />
        <Route path={ROUTES.playerSearch} element={<PlayerSearchScreen />} />
        <Route path={ROUTES.negotiation} element={<NegotiationScreen />} />
        <Route path={ROUTES.scouting} element={<ScoutingScreen />} />

        <Route path={ROUTES.league} element={<LeagueScreen />} />
        <Route path={ROUTES.standings} element={<StandingsScreen />} />
        <Route path={ROUTES.fixtures} element={<FixturesScreen />} />
        <Route path={ROUTES.rivalries} element={<RivalriesScreen />} />
        <Route path={ROUTES.seasonOverview} element={<SeasonOverviewScreen />} />

        <Route path={ROUTES.social} element={<SocialScreen />} />
        <Route path={ROUTES.press} element={<PressConferenceScreen />} />
        <Route path={ROUTES.creators} element={<CreatorHubScreen />} />
        <Route path={ROUTES.community} element={<CommunityScreen />} />
        <Route path={ROUTES.media} element={<MediaScreen />} />
        <Route path={ROUTES.creator} element={<CreatorProfileScreen />} />

        <Route path={ROUTES.objectives} element={<ObjectivesScreen />} />
        <Route path={ROUTES.rewards} element={<RewardsScreen />} />
        <Route path={ROUTES.store} element={<StoreScreen />} />
        <Route path={ROUTES.contentPacks} element={<ContentPacksScreen />} />
        <Route path={ROUTES.settings} element={<SettingsScreen />} />
      </Route>

      <Route path={ROUTES.gallery} element={<Gallery />} />
      {/* `/design` is the name people say out loud; the route table's canonical
          path is `/dev/gallery`, so this is an alias rather than a second entry. */}
      <Route path="/design" element={<Navigate to={ROUTES.gallery} replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
