/**
 * Route map.
 *
 * Navigation is data. The tab bar, the side navigation on wide screens, deep
 * links and analytics screen-tracking all read from this one table, so a new
 * screen is registered in exactly one place.
 */
export const ROUTES = {
  splash: '/',
  onboarding: '/onboarding',
  managerCreation: '/create/manager',
  clubCreation: '/create/club',
  squadBuilder: '/create/squad',

  home: '/home',
  club: '/club',
  facilities: '/club/facilities',
  sponsors: '/club/sponsors',
  fans: '/club/fans',
  finances: '/club/finances',
  history: '/club/history',
  trophyRoom: '/club/trophies',

  squad: '/squad',
  player: '/squad/player/:playerId',
  tactics: '/squad/tactics',
  training: '/squad/training',

  matchday: '/matchday',
  matchPreview: '/matchday/preview/:fixtureId',
  matchLive: '/matchday/live/:fixtureId',
  matchResult: '/matchday/result/:matchId',

  market: '/market',
  playerSearch: '/market/search',
  negotiation: '/market/negotiation/:negotiationId',
  scouting: '/market/scouting',

  league: '/league',
  standings: '/league/standings',
  fixtures: '/league/fixtures',
  rivalries: '/league/rivalries',
  seasonOverview: '/league/season',

  social: '/social',
  media: '/social/media',
  creator: '/social/creator/:creatorId',

  objectives: '/objectives',
  rewards: '/rewards',
  store: '/store',
  contentPacks: '/settings/content',
  settings: '/settings',
  gallery: '/dev/gallery',
} as const;

export type RouteKey = keyof typeof ROUTES;

export interface NavDestination {
  readonly key: RouteKey;
  readonly path: string;
  readonly label: string;
  readonly icon: string;
  /** Matched as a prefix so sub-screens keep the parent tab active. */
  readonly matchPrefix: string;
}

/**
 * Seven destinations, per the navigation brief. Everything deeper is reached
 * contextually — putting every feature in the tab bar is how manager games end
 * up feeling like a settings menu.
 */
export const PRIMARY_NAV: readonly NavDestination[] = [
  { key: 'home', path: ROUTES.home, label: 'Home', icon: 'home', matchPrefix: '/home' },
  { key: 'club', path: ROUTES.club, label: 'Club', icon: 'shield', matchPrefix: '/club' },
  { key: 'squad', path: ROUTES.squad, label: 'Squad', icon: 'squad', matchPrefix: '/squad' },
  { key: 'matchday', path: ROUTES.matchday, label: 'Matchday', icon: 'ball', matchPrefix: '/matchday' },
  { key: 'market', path: ROUTES.market, label: 'Market', icon: 'market', matchPrefix: '/market' },
  { key: 'league', path: ROUTES.league, label: 'League', icon: 'trophy', matchPrefix: '/league' },
  { key: 'social', path: ROUTES.social, label: 'Social', icon: 'social', matchPrefix: '/social' },
] as const;

export const buildPath = (route: string, params: Record<string, string>): string =>
  Object.entries(params).reduce((acc, [key, value]) => acc.replace(`:${key}`, value), route);

/** Screens that hide the tab bar because they own the full viewport. */
export const IMMERSIVE_PREFIXES = [
  '/onboarding', '/create', '/matchday/live', '/matchday/result', '/dev/gallery',
] as const;

export const isImmersive = (pathname: string): boolean =>
  IMMERSIVE_PREFIXES.some((p) => pathname.startsWith(p));

/** Analytics screen name for a pathname. Keeps tracking consistent across surfaces. */
export function screenNameFor(pathname: string): string {
  const entry = Object.entries(ROUTES).find(([, path]) => {
    if (path === pathname) return true;
    if (!path.includes(':')) return false;
    const pattern = new RegExp(`^${path.replace(/:[^/]+/g, '[^/]+')}$`);
    return pattern.test(pathname);
  });
  return entry?.[0] ?? 'unknown';
}
