import { CONTENT_PACK_VERSION, type ContentPack } from '../../schema';
import { PREMADE_MANAGERS } from '../../generators/managerGenerator';
import { BASE_SEASON_CONFIG } from '../../seasonConfig';
import { BASE_NAME_BANK } from './nameBank';
import { BASE_CLUBS } from './clubs';
import { BASE_PLAYERS } from './players';
import { BASE_CREATORS } from './creators';
import { BASE_SPONSORS } from './sponsors';
import { BASE_FACILITIES } from './facilities';
import { BASE_OBJECTIVES } from './objectives';
import { BASE_OFFERS } from './offers';
import { BASE_COMMENTARY } from './commentary';
import { BASE_SOCIAL_TEMPLATES } from './social';
import { BASE_MEDIA_TEMPLATES } from './media';

/**
 * The base content pack: the whole fictional universe, complete on its own.
 *
 * The game must be finished and enjoyable with only this pack loaded. Nothing
 * in here is a placeholder for licensed content and nothing depends on a
 * licence ever being signed — a licensed pack is strictly additive on top.
 *
 * `createdAt` is a fixed constant rather than a clock read. Content data must be
 * byte-identical across runs so that save hashes, pack checksums and the
 * determinism tests remain stable.
 */
const BASE_PACK_CREATED_AT = 1_735_689_600_000; // fixed release stamp, never Date.now()

export const BASE_PACK: ContentPack = {
  manifest: {
    id: 'base',
    version: '1.0.0',
    schemaVersion: CONTENT_PACK_VERSION,
    kind: 'BASE',
    name: 'Creator Football — Base Universe',
    description:
      'Twelve clubs, twenty-eight creators, ten managers and the whole invented world they argue in. One hundred per cent original fiction.',
    provider: 'Creator Football',
    identityKind: 'FICTIONAL',
    requires: [],
    overrides: [],
    regions: [],
    createdAt: BASE_PACK_CREATED_AT,
  },
  data: {
    nameBanks: BASE_NAME_BANK,
    clubs: BASE_CLUBS,
    players: BASE_PLAYERS,
    creators: BASE_CREATORS,
    managers: PREMADE_MANAGERS,
    sponsors: BASE_SPONSORS,
    facilities: BASE_FACILITIES,
    objectives: BASE_OBJECTIVES,
    offers: BASE_OFFERS,
    commentary: BASE_COMMENTARY,
    socialTemplates: BASE_SOCIAL_TEMPLATES,
    mediaTemplates: BASE_MEDIA_TEMPLATES,
    seasonConfig: BASE_SEASON_CONFIG,
  },
};

export { BASE_NAME_BANK, NATIONALITY_NAMES } from './nameBank';
export { BASE_CLUBS, CLUB_LORE, BASE_CLUB_IDS, AI_PROFILE_IDS } from './clubs';
export type { AiProfileId } from './clubs';
export { BASE_PLAYERS, BASE_PLAYER_IDS } from './players';
export { BASE_CREATORS, BASE_CREATOR_IDS } from './creators';
export { BASE_SPONSORS, BASE_SPONSOR_IDS } from './sponsors';
export { BASE_FACILITIES, BASE_FACILITY_IDS, FACILITY_EFFECT_KEYS } from './facilities';
export type { FacilityEffectKey } from './facilities';
export { BASE_OBJECTIVES, BASE_OBJECTIVE_IDS } from './objectives';
export { BASE_OFFERS, BASE_OFFER_SKUS } from './offers';
export { BASE_COMMENTARY } from './commentary';
export { BASE_SOCIAL_TEMPLATES } from './social';
export { BASE_MEDIA_TEMPLATES, MEDIA_OUTLETS } from './media';
