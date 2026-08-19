import { isRenderable, type Identity } from '../licensing/identity';
import type {
  ClubTemplate, CommentaryLine, ContentPack, ContentPackManifest, CreatorTemplate,
  FacilityDef, ManagerTemplate, MediaTemplate, NameBankDef, ObjectiveTemplate,
  PlayerTemplate, SeasonConfigDef, SocialTemplate, SponsorTemplate, StoreOfferDef,
  ValidationIssue,
} from './schema';
import { collectReferences, validatePack } from './validate';
import { BASE_SEASON_CONFIG } from './seasonConfig';

/**
 * The content registry.
 *
 * Packs are layered in load order: a later pack replaces an earlier entity with
 * the same id and adds everything else. That single rule is what makes a
 * licensed pack an *additive load* rather than a rewrite — the licensed pack
 * declares the ids it replaces, ships alongside the fictional base, and the
 * game logic never learns which layer an entity came from.
 *
 * Two behaviours matter more than they look:
 *  - `load` is idempotent. Loading the same pack id twice replaces it in place
 *    rather than duplicating it, because a UI that re-enables a pack must not
 *    silently double the name bank.
 *  - `visibleFor` returns a *new* registry rather than mutating this one, so
 *    rights expiry can never corrupt the loaded set. When a licence lapses the
 *    entity disappears from the view and the underlying pack is untouched.
 */

const EMPTY_NAME_BANK: NameBankDef = {
  firstNames: [], lastNames: [], clubPrefixes: [], clubSuffixes: [],
  cities: [], handles: [], nationalities: [],
};

interface Merged {
  clubs: ClubTemplate[];
  players: PlayerTemplate[];
  creators: CreatorTemplate[];
  managers: ManagerTemplate[];
  sponsors: SponsorTemplate[];
  facilities: FacilityDef[];
  objectives: ObjectiveTemplate[];
  offers: StoreOfferDef[];
  commentary: CommentaryLine[];
  social: SocialTemplate[];
  media: MediaTemplate[];
  nameBank: NameBankDef;
  seasonConfig: SeasonConfigDef;
}

/** Later entries with the same key replace earlier ones; order is preserved. */
function layer<T>(groups: readonly (readonly T[])[], key: (item: T) => string): T[] {
  const index = new Map<string, number>();
  const out: T[] = [];
  for (const group of groups) {
    for (const item of group) {
      const id = key(item);
      const existing = index.get(id);
      if (existing === undefined) {
        index.set(id, out.length);
        out.push(item);
      } else {
        out[existing] = item;
      }
    }
  }
  return out;
}

function mergeNameBanks(banks: readonly NameBankDef[]): NameBankDef {
  if (banks.length === 0) return EMPTY_NAME_BANK;
  const dedupe = <T>(items: readonly T[], key: (t: T) => string): T[] => {
    const seen = new Set<string>();
    const out: T[] = [];
    for (const item of items) {
      const k = key(item);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(item);
    }
    return out;
  };
  return {
    firstNames: dedupe(banks.flatMap((b) => b.firstNames), (n) => n.value),
    lastNames: dedupe(banks.flatMap((b) => b.lastNames), (n) => n.value),
    clubPrefixes: dedupe(banks.flatMap((b) => b.clubPrefixes), (s) => s),
    clubSuffixes: dedupe(banks.flatMap((b) => b.clubSuffixes), (s) => s),
    cities: dedupe(banks.flatMap((b) => b.cities), (s) => s),
    handles: dedupe(banks.flatMap((b) => b.handles), (s) => s),
    nationalities: dedupe(banks.flatMap((b) => b.nationalities), (n) => n.code),
  };
}

export class ContentRegistry {
  private readonly loaded = new Map<string, ContentPack>();
  private order: string[] = [];
  private merged: Merged | null = null;

  /**
   * Validate and load a pack. Errors block the load entirely — a half-loaded
   * pack is far worse than an absent one. Warnings are returned and the pack
   * still loads.
   */
  load(pack: ContentPack): ValidationIssue[] {
    const issues = [...validatePack(pack)];

    for (const requiredId of pack.manifest.requires) {
      if (!this.loaded.has(requiredId)) {
        issues.push({
          path: `manifest.requires`,
          message: `pack "${pack.manifest.id}" requires "${requiredId}", which is not loaded`,
          severity: 'error',
        });
      }
    }

    // An override that matches nothing is not fatal, but it is always a mistake:
    // the pack author believed they were replacing something.
    const knownIds = new Set(this.allEntityIds());
    if (pack.manifest.overrides.length > 0) {
      for (const id of pack.manifest.overrides) {
        if (!knownIds.has(id)) {
          issues.push({
            path: 'manifest.overrides',
            message: `override target "${id}" is not present in any loaded pack`,
            severity: 'warning',
          });
        }
      }
    }

    // `validatePack` can only see inside one pack, so a reference into a
    // dependency comes back as a warning. This is the place that actually knows
    // what is loaded, so this is where an unresolved reference becomes an error.
    const resolvable = new Set([...knownIds, ...this.packEntityIds(pack)]);
    for (const ref of collectReferences(pack)) {
      if (!resolvable.has(ref.id)) {
        issues.push({
          path: ref.path,
          message: `unresolved ${ref.kind} reference "${ref.id}" — not in this pack or any loaded dependency`,
          severity: 'error',
        });
      }
    }

    if (issues.some((i) => i.severity === 'error')) return issues;

    this.loadUnchecked(pack);
    return issues;
  }

  /** Internal: skips validation. Used by load() and by visibleFor(). */
  private loadUnchecked(pack: ContentPack): void {
    const id = pack.manifest.id;
    if (!this.loaded.has(id)) this.order.push(id);
    this.loaded.set(id, pack);
    this.merged = null;
  }

  unload(packId: string): void {
    if (!this.loaded.has(packId)) return;
    this.loaded.delete(packId);
    this.order = this.order.filter((id) => id !== packId);
    this.merged = null;
  }

  packs(): readonly ContentPackManifest[] {
    return this.orderedPacks().map((p) => p.manifest);
  }

  has(packId: string): boolean { return this.loaded.has(packId); }

  private orderedPacks(): ContentPack[] {
    const out: ContentPack[] = [];
    for (const id of this.order) {
      const pack = this.loaded.get(id);
      if (pack) out.push(pack);
    }
    return out;
  }

  private packEntityIds(pack: ContentPack): string[] {
    const d = pack.data;
    return [
      ...(d.clubs ?? []).map((c) => c.id), ...(d.players ?? []).map((p) => p.id),
      ...(d.creators ?? []).map((c) => c.id), ...(d.managers ?? []).map((m) => m.id),
      ...(d.sponsors ?? []).map((s) => s.id), ...(d.facilities ?? []).map((f) => f.id),
      ...(d.objectives ?? []).map((o) => o.id), ...(d.offers ?? []).map((o) => o.sku),
    ];
  }

  private allEntityIds(): string[] {
    const m = this.view();
    return [
      ...m.clubs.map((c) => c.id), ...m.players.map((p) => p.id),
      ...m.creators.map((c) => c.id), ...m.managers.map((x) => x.id),
      ...m.sponsors.map((s) => s.id), ...m.facilities.map((f) => f.id),
      ...m.objectives.map((o) => o.id), ...m.offers.map((o) => o.sku),
    ];
  }

  private view(): Merged {
    if (this.merged) return this.merged;
    const packs = this.orderedPacks();
    const data = packs.map((p) => p.data);
    const banks = data.map((d) => d.nameBanks).filter((b): b is NameBankDef => !!b);
    const configs = data.map((d) => d.seasonConfig).filter((c): c is SeasonConfigDef => !!c);

    this.merged = {
      clubs: layer(data.map((d) => d.clubs ?? []), (c) => c.id),
      players: layer(data.map((d) => d.players ?? []), (p) => p.id),
      creators: layer(data.map((d) => d.creators ?? []), (c) => c.id),
      managers: layer(data.map((d) => d.managers ?? []), (m) => m.id),
      sponsors: layer(data.map((d) => d.sponsors ?? []), (s) => s.id),
      facilities: layer(data.map((d) => d.facilities ?? []), (f) => f.id),
      objectives: layer(data.map((d) => d.objectives ?? []), (o) => o.id),
      offers: layer(data.map((d) => d.offers ?? []), (o) => o.sku),
      commentary: layer(data.map((d) => d.commentary ?? []), (c) => c.id),
      social: layer(data.map((d) => d.socialTemplates ?? []), (s) => s.id),
      media: layer(data.map((d) => d.mediaTemplates ?? []), (m) => m.id),
      nameBank: mergeNameBanks(banks),
      // Last pack to declare a season config wins; the base config is the
      // documented fallback so an empty registry is still usable.
      seasonConfig: configs[configs.length - 1] ?? BASE_SEASON_CONFIG,
    };
    return this.merged;
  }

  clubs(): readonly ClubTemplate[] { return this.view().clubs; }
  players(): readonly PlayerTemplate[] { return this.view().players; }
  creators(): readonly CreatorTemplate[] { return this.view().creators; }
  managers(): readonly ManagerTemplate[] { return this.view().managers; }
  sponsors(): readonly SponsorTemplate[] { return this.view().sponsors; }
  facilities(): readonly FacilityDef[] { return this.view().facilities; }
  objectives(): readonly ObjectiveTemplate[] { return this.view().objectives; }
  offers(): readonly StoreOfferDef[] { return this.view().offers; }
  commentary(): readonly CommentaryLine[] { return this.view().commentary; }
  socialTemplates(): readonly SocialTemplate[] { return this.view().social; }
  mediaTemplates(): readonly MediaTemplate[] { return this.view().media; }
  nameBank(): NameBankDef { return this.view().nameBank; }
  seasonConfig(): SeasonConfigDef { return this.view().seasonConfig; }

  /** Lookup helpers used by the generators and the world engine. */
  clubById(id: string): ClubTemplate | undefined { return this.view().clubs.find((c) => c.id === id); }
  creatorById(id: string): CreatorTemplate | undefined { return this.view().creators.find((c) => c.id === id); }
  facilityById(id: string): FacilityDef | undefined { return this.view().facilities.find((f) => f.id === id); }

  /**
   * A view of this registry as it should appear in `region` at time `now`.
   *
   * Licensed packs whose rights have lapsed, been revoked, or never covered
   * this region are dropped wholesale, along with any pack that depended on
   * them — a pack whose dependency has been filtered out would otherwise
   * present dangling references. Fictional content is never filtered.
   */
  visibleFor(region: string, now: number): ContentRegistry {
    const next = new ContentRegistry();
    const admitted = new Set<string>();

    for (const pack of this.orderedPacks()) {
      const manifest = pack.manifest;
      const identity: Identity = manifest.rights
        ? { kind: manifest.identityKind, rights: manifest.rights }
        : { kind: manifest.identityKind };

      if (!isRenderable(identity, region, now)) continue;
      if (manifest.regions.length > 0 && !manifest.regions.includes(region)) continue;
      if (manifest.requires.some((id) => !admitted.has(id))) continue;

      admitted.add(manifest.id);
      next.loadUnchecked(pack);
    }
    return next;
  }
}

export { validatePack } from './validate';
