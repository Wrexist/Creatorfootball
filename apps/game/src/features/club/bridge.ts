import {
  BASE_PACK, ContentRegistry, Ledger,
  type FacilityDef, type GameState, type PostContext,
} from '@cf/engine';

/**
 * The club screens' bridge to the engine.
 *
 * Facilities and sponsorship are content-driven: their names, costs, levels and
 * effects live in a content pack, not in this app. The registry is built once
 * and shared, because loading a pack validates it end to end and doing that per
 * render would be absurd.
 *
 * Nothing here derives a game outcome. It hands screens the same objects the
 * engine's own systems read, so a screen can never disagree with the simulation
 * about what an upgrade costs or what it does.
 */

let cached: ContentRegistry | null = null;

export function contentRegistry(): ContentRegistry {
  if (!cached) {
    const registry = new ContentRegistry();
    registry.load(BASE_PACK);
    cached = registry;
  }
  return cached;
}

export const facilityDefs = (): readonly FacilityDef[] => contentRegistry().facilities();

/** A live Ledger rehydrated from the save. Read-only unless the caller posts. */
export const ledgerOf = (state: GameState): Ledger => Ledger.restore(state.ledger);

/** Timestamps arrive from the app layer; the engine never reads a clock itself. */
export const postContextOf = (state: GameState): PostContext => ({
  cycle: state.clock.cycle,
  season: state.clock.season,
  at: Date.now(),
});
