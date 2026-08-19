import type { ContentPackId, LicenseId } from '../core/brand';

/**
 * The identity/licensing layer.
 *
 * Nothing in the game's logic may branch on a *specific real name*. Logic
 * branches on IdentityKind and on rights metadata only. The base game ships
 * 100% fictional and must be complete and enjoyable on its own; licensed
 * content is strictly additive and loaded through the same content-pack schema.
 */
export const IDENTITY_KINDS = [
  'FICTIONAL',
  'COMMUNITY_CREATED',
  'LICENSED_CREATOR',
  'LICENSED_FOOTBALLER',
] as const;
export type IdentityKind = (typeof IDENTITY_KINDS)[number];

export const isLicensed = (kind: IdentityKind): boolean =>
  kind === 'LICENSED_CREATOR' || kind === 'LICENSED_FOOTBALLER';

export type LicenseStatus = 'ACTIVE' | 'PENDING' | 'EXPIRED' | 'REVOKED' | 'REGION_BLOCKED';

export interface RightsMetadata {
  readonly licenseId: LicenseId;
  readonly status: LicenseStatus;
  /** ISO-3166 alpha-2 codes; empty means worldwide. */
  readonly regions: readonly string[];
  /** Epoch ms. Undefined means perpetual. */
  readonly expiresAt?: number;
  /** Who supplied the entity — used for takedown and attribution. */
  readonly provider: string;
  /** What the licence actually permits. Enforced at render and simulation time. */
  readonly grants: {
    readonly name: boolean;
    readonly likeness: boolean;
    readonly voice: boolean;
    readonly logo: boolean;
    readonly merchandising: boolean;
  };
  readonly attribution?: string;
}

export interface Identity {
  readonly kind: IdentityKind;
  readonly packId?: ContentPackId;
  readonly rights?: RightsMetadata;
}

/**
 * Whether an entity may be rendered right now. Fictional content is always
 * available; licensed content must have a live, in-region licence. A pack that
 * expires degrades gracefully — the entity is swapped for its fictional
 * fallback rather than corrupting the save.
 */
export function isRenderable(identity: Identity, region: string, now: number): boolean {
  if (!isLicensed(identity.kind)) return true;
  const rights = identity.rights;
  if (!rights) return false;
  if (rights.status !== 'ACTIVE') return false;
  if (rights.expiresAt !== undefined && rights.expiresAt <= now) return false;
  if (rights.regions.length > 0 && !rights.regions.includes(region)) return false;
  return true;
}

/** Every licensed entity must declare a fictional stand-in used when rights lapse. */
export interface LicensedEntityBinding {
  readonly licensedId: string;
  readonly fallbackId: string;
  readonly fallbackDisplayName: string;
}
