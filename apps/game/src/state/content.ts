import { BASE_PACK, ContentRegistry } from '@cf/engine';

/**
 * The one loaded content pack, shared by every feature bridge.
 *
 * Loading a pack validates it end to end, so it happens exactly once, lazily,
 * on first read — never per render, never per screen. Every consumer gets the
 * same registry instance, which is what lets a screen agree with the
 * simulation about what an upgrade costs or what a facility does.
 */

let registry: ContentRegistry | null = null;

export function contentRegistry(): ContentRegistry {
  if (!registry) {
    registry = new ContentRegistry();
    registry.load(BASE_PACK);
  }
  return registry;
}
