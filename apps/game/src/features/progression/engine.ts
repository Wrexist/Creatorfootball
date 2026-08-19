import { useMemo } from 'react';
import {
  BASE_PACK,
  ContentRegistry,
  Ledger,
  claimObjective,
  isLicensed,
  isRenderable,
  patchClub,
  type ClaimResult,
  type ContentPack,
  type ContentPackManifest,
  type GameSettings,
  type GameState,
  type Objective,
  type RewardGrant,
  type StoreOfferDef,
} from '@cf/engine';
import { useGameStore } from '@/state/gameStore';

/**
 * Progression's bridge to the engine.
 *
 * Claiming, settings and the content catalogue all live here so the screens
 * stay declarative. The important rule this file holds: a reward is claimed by
 * the engine, exactly once, and the interface's job is to report what the
 * engine said rather than to keep its own idea of what has been paid out.
 */

/* --- content ------------------------------------------------------------ */

const PACKS: readonly ContentPack[] = [BASE_PACK];

let cached: ContentRegistry | null = null;

export function contentRegistry(): ContentRegistry {
  if (!cached) {
    cached = new ContentRegistry();
    for (const pack of PACKS) cached.load(pack);
  }
  return cached;
}

export interface PackView {
  readonly manifest: ContentPackManifest;
  readonly installed: boolean;
  readonly enabled: boolean;
  /** False when a licence has lapsed, been revoked, or never covered this region. */
  readonly available: boolean;
  readonly reason: string;
  readonly counts: {
    readonly clubs: number; readonly players: number; readonly creators: number;
    readonly managers: number; readonly sponsors: number; readonly facilities: number;
    readonly objectives: number; readonly offers: number; readonly commentary: number;
    readonly social: number; readonly media: number;
  };
}

/**
 * What is installed, and whether it may actually be shown.
 *
 * A licensed pack whose rights have lapsed is listed as unavailable rather than
 * quietly vanishing: a player who paid for it deserves to be told what happened
 * to it, and a save that silently loses entities is a save that looks corrupted.
 */
export function usePacks(state: GameState, now: number): PackView[] {
  return useMemo(() => {
    const region = state.settings.region || 'GLOBAL';
    return PACKS.map((pack) => {
      const manifest = pack.manifest;
      const identity = manifest.rights
        ? { kind: manifest.identityKind, rights: manifest.rights }
        : { kind: manifest.identityKind };
      const renderable = isRenderable(identity, region, now);
      const inRegion = manifest.regions.length === 0 || manifest.regions.includes(region);
      const available = renderable && inRegion;

      let reason = 'Available';
      if (!renderable && manifest.rights) {
        const status = manifest.rights.status;
        reason =
          status === 'EXPIRED' ? 'The licence for this pack has expired.'
            : status === 'REVOKED' ? 'The licence for this pack was withdrawn.'
              : status === 'PENDING' ? 'The licence for this pack is not live yet.'
                : status === 'REGION_BLOCKED' ? 'This pack is not licensed in your region.'
                  : 'This pack is not currently licensed.';
      } else if (!renderable) {
        reason = 'This pack declares licensed content with no rights attached.';
      } else if (!inRegion) {
        reason = 'This pack is not distributed in your region.';
      }

      const data = pack.data;
      return {
        manifest,
        installed: true,
        enabled: state.settings.enabledPackIds.length === 0
          || state.settings.enabledPackIds.includes(manifest.id),
        available,
        reason,
        counts: {
          clubs: data.clubs?.length ?? 0,
          players: data.players?.length ?? 0,
          creators: data.creators?.length ?? 0,
          managers: data.managers?.length ?? 0,
          sponsors: data.sponsors?.length ?? 0,
          facilities: data.facilities?.length ?? 0,
          objectives: data.objectives?.length ?? 0,
          offers: data.offers?.length ?? 0,
          commentary: data.commentary?.length ?? 0,
          social: data.socialTemplates?.length ?? 0,
          media: data.mediaTemplates?.length ?? 0,
        },
      };
    });
  }, [state.settings.region, state.settings.enabledPackIds, now]);
}

export const anyLicensed = (packs: readonly PackView[]): boolean =>
  packs.some((p) => isLicensed(p.manifest.identityKind));

/* --- store -------------------------------------------------------------- */

/** The catalogue rotates every four matchweeks and every offer comes back. */
export const ROTATION_LENGTH = 4;

export const rotationWeek = (cycle: number): number => (cycle % ROTATION_LENGTH) + 1;

export interface StoreView {
  readonly thisRotation: readonly StoreOfferDef[];
  readonly rest: readonly StoreOfferDef[];
  readonly week: number;
  readonly nextRotationCycle: number;
}

export function useStore(state: GameState): StoreView {
  return useMemo(() => {
    const offers = contentRegistry().offers();
    const week = rotationWeek(state.clock.cycle);
    const inWindow = (offer: StoreOfferDef): boolean => {
      if (offer.startCycle !== null && state.clock.cycle < offer.startCycle) return false;
      if (offer.endCycle !== null && state.clock.cycle > offer.endCycle) return false;
      return true;
    };
    const live = offers.filter(inWindow);
    return {
      thisRotation: live.filter((o) => (o.rotationWeek ?? week) === week),
      rest: live.filter((o) => (o.rotationWeek ?? week) !== week),
      week,
      nextRotationCycle: state.clock.cycle + 1,
    };
  }, [state.clock.cycle]);
}

/** Everything the player already owns, so nothing is ever sold to them twice. */
export function useOwned(state: GameState): ReadonlySet<string> {
  return useMemo(() => new Set(state.inventory.cosmeticIds), [state.inventory.cosmeticIds]);
}

/* --- objectives --------------------------------------------------------- */

/**
 * Apply the non-cash half of a claim.
 *
 * `claimObjective` moves the money and marks the objective claimed; the grants
 * it hands back are the things the ledger cannot hold — a rule card, a cosmetic,
 * scouting credits. Applying them here keeps the engine free of inventory
 * policy while still going through one, auditable claim.
 */
function applyGrants(state: GameState, grants: readonly RewardGrant[], cycle: number): GameState {
  if (grants.length === 0) return state;
  let next = state;
  let inventory = next.inventory;

  for (const grant of grants) {
    switch (grant.kind) {
      case 'SCOUT_CREDIT':
        inventory = { ...inventory, scoutCredits: inventory.scoutCredits + grant.amount };
        break;
      case 'FACILITY_CREDIT':
        inventory = { ...inventory, facilityCredits: inventory.facilityCredits + grant.amount };
        break;
      case 'COSMETIC':
        if (grant.ref && !inventory.cosmeticIds.includes(grant.ref)) {
          inventory = { ...inventory, cosmeticIds: [...inventory.cosmeticIds, grant.ref] };
        }
        break;
      case 'RULE_CARD': {
        if (!grant.ref) break;
        const existing = inventory.ruleCards.find((card) => card.ruleId === grant.ref);
        inventory = {
          ...inventory,
          ruleCards: existing
            ? inventory.ruleCards.map((card) =>
                card.ruleId === grant.ref
                  ? { ...card, quantity: card.quantity + grant.amount }
                  : card)
            : [
                ...inventory.ruleCards,
                {
                  ruleId: grant.ref as (typeof inventory.ruleCards)[number]['ruleId'],
                  quantity: grant.amount,
                  acquiredCycle: cycle,
                },
              ],
        };
        break;
      }
      case 'REPUTATION':
        next = patchClub(next, next.playerClubId, (club) => ({
          reputation: Math.min(100, club.reputation + grant.amount),
        }));
        break;
      default:
        break;
    }
  }

  return { ...next, inventory };
}

export interface ClaimReport {
  readonly ok: boolean;
  readonly title: string;
  readonly detail: string;
}

const CLAIM_ERROR: Record<NonNullable<ClaimResult['error']>, string> = {
  NOT_FOUND: 'That objective is no longer on the board.',
  NOT_COMPLETE: 'That objective is not finished yet.',
  ALREADY_CLAIMED: 'This reward has already been paid out. It cannot be claimed twice.',
  LEDGER_REJECTED: 'The reward could not be posted to your accounts.',
};

export function claimReward(objective: Objective): ClaimReport {
  const store = useGameStore.getState();
  const s = store.state;
  if (!s) return { ok: false, title: 'No game loaded', detail: '' };

  const ledger = Ledger.restore(s.ledger);
  const result = claimObjective(s, ledger, objective.id, {
    cycle: s.clock.cycle,
    season: s.clock.season,
    at: Date.now(),
  });

  if (!result.ok || !result.state) {
    return {
      ok: false,
      title: 'Nothing was paid out',
      detail: result.error ? CLAIM_ERROR[result.error] : 'The claim was refused.',
    };
  }

  const claimed = result.state;
  store.apply(() => applyGrants(claimed, result.grants, claimed.clock.cycle));

  return {
    ok: true,
    title: `${objective.title} claimed`,
    detail: objective.rewards.map((r) => r.label).join(', ') || 'Recorded in your accounts.',
  };
}

/* --- settings ----------------------------------------------------------- */

export function updateSettings(patch: Partial<GameSettings>): void {
  useGameStore.getState().apply((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
}
