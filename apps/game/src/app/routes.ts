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
  readonly key: SectionKey;
  readonly path: string;
  readonly label: string;
  readonly icon: string;
  /**
   * Prefixes that keep this section active. A section owns more than one
   * top-level path — recruitment lives under Squad, the feed lives under
   * World — so a single prefix is not enough to decide what is highlighted.
   */
  readonly matchPrefixes: readonly string[];
}

export type SectionKey = 'home' | 'squad' | 'matchday' | 'club' | 'world';

/**
 * Five destinations, not seven.
 *
 * Seven tabs across a phone leaves each one about fifty points wide, which is
 * below a comfortable target and forces the labels down to a size nobody reads.
 * More importantly it flattens the product: Market and Squad are the same job
 * (assembling a team), and League and Social are the same job (following the
 * world outside your club). Grouping them into five sections with a sub-rail
 * inside each gives every destination room to breathe and makes the shape of
 * the game legible from the bar alone.
 */
export const PRIMARY_NAV: readonly NavDestination[] = [
  { key: 'home', path: ROUTES.home, label: 'Home', icon: 'home', matchPrefixes: ['/home'] },
  {
    key: 'squad', path: ROUTES.squad, label: 'Squad', icon: 'squad',
    // Recruitment is squad building, so the market belongs here.
    matchPrefixes: ['/squad', '/market'],
  },
  { key: 'matchday', path: ROUTES.matchday, label: 'Match', icon: 'ball', matchPrefixes: ['/matchday'] },
  {
    key: 'club', path: ROUTES.club, label: 'Club', icon: 'shield',
    matchPrefixes: ['/club', '/objectives', '/rewards', '/store'],
  },
  {
    key: 'world', path: ROUTES.league, label: 'World', icon: 'trophy',
    // Everything happening outside your own four walls.
    matchPrefixes: ['/league', '/social'],
  },
] as const;

export interface SubDestination {
  readonly path: string;
  readonly label: string;
  /** Matched as a prefix, so a player profile keeps Squad's rail highlighted. */
  readonly matchPrefix: string;
}

/**
 * The rail inside each section.
 *
 * A section with one destination shows no rail at all — a single tab is chrome
 * that explains nothing. Order runs from the screen you open most to the one
 * you open least, because the first item is the one the section lands on.
 */
export const SECTION_NAV: Readonly<Record<SectionKey, readonly SubDestination[]>> = {
  home: [],
  squad: [
    { path: ROUTES.squad, label: 'Squad', matchPrefix: '/squad' },
    { path: ROUTES.tactics, label: 'Tactics', matchPrefix: '/squad/tactics' },
    { path: ROUTES.training, label: 'Training', matchPrefix: '/squad/training' },
    { path: ROUTES.market, label: 'Market', matchPrefix: '/market' },
    { path: ROUTES.scouting, label: 'Scouting', matchPrefix: '/market/scouting' },
  ],
  matchday: [],
  club: [
    { path: ROUTES.club, label: 'Overview', matchPrefix: '/club' },
    { path: ROUTES.facilities, label: 'Facilities', matchPrefix: '/club/facilities' },
    { path: ROUTES.sponsors, label: 'Sponsors', matchPrefix: '/club/sponsors' },
    { path: ROUTES.fans, label: 'Fans', matchPrefix: '/club/fans' },
    { path: ROUTES.finances, label: 'Finances', matchPrefix: '/club/finances' },
    { path: ROUTES.objectives, label: 'Objectives', matchPrefix: '/objectives' },
    { path: ROUTES.history, label: 'History', matchPrefix: '/club/history' },
  ],
  world: [
    { path: ROUTES.league, label: 'League', matchPrefix: '/league' },
    { path: ROUTES.fixtures, label: 'Fixtures', matchPrefix: '/league/fixtures' },
    { path: ROUTES.rivalries, label: 'Rivalries', matchPrefix: '/league/rivalries' },
    { path: ROUTES.social, label: 'Social', matchPrefix: '/social' },
    { path: ROUTES.media, label: 'Media', matchPrefix: '/social/media' },
  ],
};

/** Which section owns a path, or null on an immersive or pre-game screen. */
export function sectionFor(pathname: string): SectionKey | null {
  let best: NavDestination | null = null;
  let bestLength = -1;
  for (const nav of PRIMARY_NAV) {
    for (const prefix of nav.matchPrefixes) {
      if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
        if (prefix.length > bestLength) { best = nav; bestLength = prefix.length; }
      }
    }
  }
  return best?.key ?? null;
}

/**
 * The active sub-destination. Longest prefix wins, so `/club/facilities` picks
 * Facilities rather than the Overview whose prefix it also starts with.
 */
export function subDestinationFor(pathname: string): SubDestination | null {
  const section = sectionFor(pathname);
  if (!section) return null;
  let best: SubDestination | null = null;
  let bestLength = -1;
  for (const sub of SECTION_NAV[section]) {
    if (pathname === sub.matchPrefix || pathname.startsWith(`${sub.matchPrefix}/`)) {
      if (sub.matchPrefix.length > bestLength) { best = sub; bestLength = sub.matchPrefix.length; }
    }
  }
  return best;
}

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
