/**
 * Public surface of the content workstream.
 *
 * The engine's root `index.ts` is owned elsewhere and currently re-exports only
 * `content/schema`. This barrel is the one place other workstreams need to
 * import from to get the base universe, the registry and the generators.
 */

export * from './schema';
export * from './loader';
export * from './validate';
export * from './balance';
export * from './seasonConfig';

export { BASE_PACK } from './packs/base';
export {
  BASE_NAME_BANK, NATIONALITY_NAMES,
  BASE_CLUBS, CLUB_LORE, BASE_CLUB_IDS, AI_PROFILE_IDS,
  BASE_PLAYERS, BASE_PLAYER_IDS,
  BASE_CREATORS, BASE_CREATOR_IDS,
  BASE_SPONSORS, BASE_SPONSOR_IDS,
  BASE_FACILITIES, BASE_FACILITY_IDS, FACILITY_EFFECT_KEYS,
  BASE_OBJECTIVES, BASE_OBJECTIVE_IDS,
  BASE_OFFERS, BASE_OFFER_SKUS,
  BASE_COMMENTARY, BASE_SOCIAL_TEMPLATES, BASE_MEDIA_TEMPLATES, MEDIA_OUTLETS,
} from './packs/base';
export type { AiProfileId, FacilityEffectKey } from './packs/base';

export { COMMUNITY_EXAMPLE_PACK } from './packs/community/example';
export {
  LICENSED_EXAMPLE_PACK, LICENSED_EXAMPLE_PACK_EXPIRED,
  LICENSED_EXAMPLE_BINDINGS, LICENSED_EXAMPLE_EXPIRES_AT,
} from './packs/licensed/example';

export * from './generators/profiles';
export * from './generators/playerGenerator';
export * from './generators/creatorGenerator';
export * from './generators/clubGenerator';
export * from './generators/managerGenerator';
