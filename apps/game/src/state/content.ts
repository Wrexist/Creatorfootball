import { BASE_PACK, ContentRegistry } from '@cf/engine';
import { EXPANSION_PACKS, availablePackIds } from '@/commerce/packs';
import type { ProductId } from '@/commerce/catalog';
import { MEMBER_LIBRARY, MEMBER_LIBRARY_ID } from '@/commerce/memberLibrary';

/**
 * The active content registry, shared by every feature bridge.
 *
 * Loading validates packs end to end, on first read or a selection change,
 * never per render or per screen. Every consumer gets the
 * same registry instance, which is what lets a screen agree with the
 * simulation about what an upgrade costs or what a facility does.
 */

let registry: ContentRegistry | null = null;
let selection = '';

export function configureExpansionPacks(enabled: readonly string[], owned: readonly ProductId[], member = false): void {
  const ids = [...availablePackIds(enabled, owned)];
  if (member && enabled.includes(MEMBER_LIBRARY_ID)) ids.push(MEMBER_LIBRARY_ID);
  const key = ids.slice().sort().join(',');
  if (key === selection) return;
  const next = new ContentRegistry();
  next.load(BASE_PACK);
  for (const pack of EXPANSION_PACKS) if (ids.includes(pack.manifest.id)) next.load(pack);
  if (ids.includes(MEMBER_LIBRARY_ID)) next.load(MEMBER_LIBRARY);
  registry = next;
  selection = key;
}

export function contentRegistry(): ContentRegistry {
  if (!registry) {
    registry = new ContentRegistry();
    registry.load(BASE_PACK);
  }
  return registry;
}
