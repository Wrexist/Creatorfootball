import type { ComponentType, ReactNode } from 'react';
import { EmptyState, GlassPill, Screen } from '@/design';

/**
 * TEMPORARY — delete this file.
 *
 * The router is written against the real feature barrels (`@/features/home`,
 * `@/features/matchday`, …). Those modules are being built in parallel and do
 * not exist on disk yet, and an unresolvable dynamic import fails the *build*,
 * not just the render — so the shell could not be verified at all without a
 * stand-in.
 *
 * Everything temporary is therefore in this one file. `app/featureModules.ts`
 * is the single place that points at it: swap each loader there for the real
 * `() => import('@/features/…')` expression written in the comment beside it,
 * delete this file, and the cleanup is complete. Nothing else in the app
 * references it, and the loader signatures are typed to exactly the exports
 * each barrel promises, so the swap is checked by the compiler rather than by
 * hand.
 */

function PendingScreen({ name, area }: { name: string; area: string }): ReactNode {
  return (
    <Screen
      title={name.replace(/Screen$/, '').replace(/([a-z])([A-Z])/g, '$1 $2')}
      subtitle="This screen is being built in a parallel workstream."
    >
      <EmptyState
        title="Not wired up yet"
        description={`${name} ships with the ${area} workstream. The shell, its navigation and its transitions are already routing here correctly.`}
        action={<GlassPill tone="neutral">{area}</GlassPill>}
      />
    </Screen>
  );
}

const stub = (name: string, area: string): ComponentType => {
  const Component = (): ReactNode => <PendingScreen name={name} area={area} />;
  Component.displayName = `Pending(${name})`;
  return Component;
};

/** Builds a module-shaped promise so `React.lazy` sees the real thing. */
const pendingModule = <K extends string>(area: string, ...names: readonly K[]) =>
  (): Promise<Record<K, ComponentType>> =>
    Promise.resolve(
      Object.fromEntries(names.map((n) => [n, stub(n, area)])) as Record<K, ComponentType>,
    );

export const pendingHome = pendingModule('Home', 'HomeScreen');

export const pendingMatchday = pendingModule(
  'Matchday', 'MatchPreviewScreen', 'MatchLiveScreen', 'MatchResultScreen',
);

export const pendingClub = pendingModule(
  'Club', 'ClubScreen', 'FacilitiesScreen', 'SponsorsScreen', 'FansScreen',
  'FinancesScreen', 'HistoryScreen', 'TrophyRoomScreen',
);

export const pendingSquad = pendingModule(
  'Squad', 'SquadScreen', 'PlayerProfileScreen', 'TacticsScreen', 'TrainingScreen',
);

export const pendingMarket = pendingModule(
  'Market', 'MarketScreen', 'PlayerSearchScreen', 'NegotiationScreen', 'ScoutingScreen',
);

export const pendingLeague = pendingModule(
  'League', 'LeagueScreen', 'StandingsScreen', 'FixturesScreen', 'RivalriesScreen',
  'SeasonOverviewScreen',
);

export const pendingSocial = pendingModule(
  'Social', 'SocialScreen', 'MediaScreen', 'CreatorProfileScreen',
);

export const pendingProgression = pendingModule(
  'Progression', 'ObjectivesScreen', 'RewardsScreen', 'StoreScreen', 'SettingsScreen',
  'ContentPacksScreen',
);
