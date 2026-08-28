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
  press: '/social/press',
  creators: '/social/creators',
  community: '/social/community',
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
 * How many destinations a rail shows before the rest move behind "More".
 *
 * Five tabs at the bottom was already judged to be the limit of what reads as
 * navigation rather than as a wall — and then World grew to eight rail
 * destinations and Club to seven, which is worse, because a rail scrolls
 * sideways and so does not even admit how many there are. A new player sees
 * "Scouting" cut off at the edge and has no way to know whether two things are
 * hidden or six.
 *
 * Four is what fits a 393pt phone without scrolling. Everything past it is one
 * tap away in a sheet that shows the whole list at once, which is a better
 * answer than a rail you have to swipe and count.
 */
const RAIL_LIMIT = 4;

/**
 * The rail inside each section.
 *
 * A section with one destination shows no rail at all — a single tab is chrome
 * that explains nothing. Order runs from the screen you open most to the one
 * you open least: the first item is the one the section lands on, and the
 * first `RAIL_LIMIT` are the ones that stay on the rail.
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
  // Objectives and Finances are what a manager is asked to *act* on, so they
  // lead; Sponsors, Fans and History are things they read, and they can wait
  // behind "More".
  club: [
    { path: ROUTES.club, label: 'Overview', matchPrefix: '/club' },
    { path: ROUTES.objectives, label: 'Objectives', matchPrefix: '/objectives' },
    { path: ROUTES.finances, label: 'Finances', matchPrefix: '/club/finances' },
    { path: ROUTES.facilities, label: 'Facilities', matchPrefix: '/club/facilities' },
    { path: ROUTES.sponsors, label: 'Sponsors', matchPrefix: '/club/sponsors' },
    { path: ROUTES.fans, label: 'Fans', matchPrefix: '/club/fans' },
    { path: ROUTES.history, label: 'History', matchPrefix: '/club/history' },
  ],
  // The table and the fixture list are why anyone opens this section; the five
  // feeds behind them are one family and belong together in the sheet.
  world: [
    { path: ROUTES.league, label: 'League', matchPrefix: '/league' },
    { path: ROUTES.fixtures, label: 'Fixtures', matchPrefix: '/league/fixtures' },
    { path: ROUTES.social, label: 'Social', matchPrefix: '/social' },
    { path: ROUTES.media, label: 'Media', matchPrefix: '/social/media' },
    { path: ROUTES.press, label: 'Press', matchPrefix: '/social/press' },
    { path: ROUTES.creators, label: 'Creators', matchPrefix: '/social/creators' },
    { path: ROUTES.community, label: 'Community', matchPrefix: '/social/community' },
    { path: ROUTES.rivalries, label: 'Rivalries', matchPrefix: '/league/rivalries' },
  ],
};

/**
 * Split a section's destinations into the ones on the rail and the ones behind
 * "More".
 *
 * The active destination is always on the rail, even when its natural place is
 * in the overflow: arriving on a screen whose own tab is hidden behind a button
 * leaves the player with no way to see where they are. When promotion is
 * needed it takes the last rail slot, so the leading destinations — the ones
 * chosen for being the most used — keep their positions and the rail does not
 * reshuffle under the thumb.
 */
export function splitRail(
  items: readonly SubDestination[],
  activePath: string,
): { rail: readonly SubDestination[]; overflow: readonly SubDestination[] } {
  if (items.length <= RAIL_LIMIT) return { rail: items, overflow: [] };

  const active = subDestinationIn(items, activePath);
  const rail = items.slice(0, RAIL_LIMIT);
  const overflow = items.slice(RAIL_LIMIT);
  if (!active || rail.includes(active)) return { rail, overflow };

  return {
    rail: [...rail.slice(0, RAIL_LIMIT - 1), active],
    overflow: [rail[RAIL_LIMIT - 1] as SubDestination, ...overflow.filter((item) => item !== active)],
  };
}

/** Longest-prefix match of `pathname` against a list of destinations. */
function subDestinationIn(
  items: readonly SubDestination[],
  pathname: string,
): SubDestination | null {
  let best: SubDestination | null = null;
  let bestLength = -1;
  for (const sub of items) {
    if (pathname === sub.matchPrefix || pathname.startsWith(`${sub.matchPrefix}/`)) {
      if (sub.matchPrefix.length > bestLength) { best = sub; bestLength = sub.matchPrefix.length; }
    }
  }
  return best;
}

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
  return subDestinationIn(SECTION_NAV[section], pathname);
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
