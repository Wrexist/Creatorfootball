import { BASE_PACK, ContentRegistry, type FacilityDef } from '@cf/engine';

/**
 * Facility data for the squad screens.
 *
 * Training gains, injury resistance and academy quality all come out of the
 * club's buildings, and the engine reads them through a registry rather than a
 * hardcoded table. The training preview has to read them the same way or it
 * would promise growth the simulation will not deliver.
 */

let cached: ContentRegistry | null = null;

function registry(): ContentRegistry {
  if (!cached) {
    const loaded = new ContentRegistry();
    loaded.load(BASE_PACK);
    cached = loaded;
  }
  return cached;
}

export const facilityRegistry = (): { facilities: () => readonly FacilityDef[] } => ({
  facilities: () => registry().facilities(),
});
