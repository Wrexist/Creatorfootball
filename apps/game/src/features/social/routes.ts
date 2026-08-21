/**
 * Where this feature's screens want to live.
 *
 * Declared here rather than in the application route table because navigation
 * is being restructured in parallel and this workstream does not own that file.
 * The screens link through these constants, so wiring them up is a matter of
 * pointing the router at the same strings — nothing in the feature has to
 * change.
 */
export const SOCIAL_ROUTES = {
  feed: '/social',
  press: '/social/press',
  creators: '/social/creators',
  community: '/social/community',
  media: '/social/media',
} as const;

export type SocialRouteKey = keyof typeof SOCIAL_ROUTES;
