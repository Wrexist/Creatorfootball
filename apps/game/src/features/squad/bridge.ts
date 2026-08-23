import type { FacilityDef } from '@cf/engine';
import { contentRegistry } from '@/state/content';

/**
 * Facility data for the squad screens.
 *
 * Training gains, injury resistance and academy quality all come out of the
 * club's buildings, and the engine reads them through a registry rather than a
 * hardcoded table. The training preview has to read them the same way or it
 * would promise growth the simulation will not deliver.
 */

export const facilityRegistry = (): { facilities: () => readonly FacilityDef[] } => ({
  facilities: () => contentRegistry().facilities(),
});
