import type { Club, ClubVisualIdentity, Position } from '@cf/engine';
import { darken, lighten, mix, readableOn } from '@/design';

/**
 * Kit colours, interned.
 *
 * `PlayerPortrait`, `PlayerCard` and `ClubBadge` are all memoised, and every
 * one of them takes an object prop. Building `{ primary, secondary }` inside a
 * `.map()` hands each of them a brand-new object on every render and defeats
 * the memoisation entirely — for a 20-row squad list that is 20 avoided
 * re-renders per tick during a live match. So kits are interned by club id and
 * handed out as stable references.
 */

export interface KitColors {
  readonly primary: string;
  readonly secondary: string;
}

/** The four bands the pitch colours a token by. */
export type PitchRole = 'GK' | 'DEF' | 'MID' | 'ATT';

const ROLE_OF: Readonly<Record<Position, PitchRole>> = {
  GK: 'GK',
  CB: 'DEF', LB: 'DEF', RB: 'DEF',
  CDM: 'MID', CM: 'MID', CAM: 'MID',
  LW: 'ATT', RW: 'ATT', ST: 'ATT',
};

export const roleOfPosition = (position: Position): PitchRole => ROLE_OF[position] ?? 'MID';

export const ROLE_LABEL: Readonly<Record<PitchRole, string>> = {
  GK: 'Keeper',
  DEF: 'Defence',
  MID: 'Midfield',
  ATT: 'Attack',
};

/** The same four bands where the pitch has room for three letters and no more. */
export const ROLE_SHORT: Readonly<Record<PitchRole, string>> = {
  GK: 'GK',
  DEF: 'Def',
  MID: 'Mid',
  ATT: 'Att',
};

/** What the pitch renderer needs to draw one team, precomputed once. */
export interface KitPalette extends KitColors {
  readonly clubId: string;
  readonly accent: string;
  /** Outline that separates a shirt from the grass at 8px radius. */
  readonly outline: string;
  /** Text colour that clears 4.5:1 on `primary`. */
  readonly ink: string;
  /** Keeper strip: deliberately far from both outfield kits. */
  readonly keeper: string;
  readonly keeperInk: string;
  /**
   * Ground-plate colours by role.
   *
   * A token's fill stays the club's colour — identity must survive — so the
   * unit a player belongs to is carried by the marker on the grass beneath him:
   * defenders cool, midfield the club's own colour, attackers warm. Because the
   * tint is *mixed into* the kit rather than replacing it, two clubs never end
   * up with the same "attacker" colour, and the pitch still reads as two teams
   * before it reads as eight units.
   */
  readonly plate: Readonly<Record<PitchRole, string>>;
}

const kitCache = new Map<string, KitColors>();
const paletteCache = new Map<string, KitPalette>();

/** Stable `{ primary, secondary }` for the memoised portrait/card components. */
export function kitColors(clubId: string, visual: ClubVisualIdentity): KitColors {
  const existing = kitCache.get(clubId);
  if (existing && existing.primary === visual.primary && existing.secondary === visual.secondary) {
    return existing;
  }
  const next: KitColors = { primary: visual.primary, secondary: visual.secondary };
  kitCache.set(clubId, next);
  return next;
}

export function kitPalette(clubId: string, visual: ClubVisualIdentity): KitPalette {
  const existing = paletteCache.get(clubId);
  if (existing && existing.primary === visual.primary) return existing;

  const keeper = lighten(visual.accent, 0.25);
  const next: KitPalette = {
    clubId,
    primary: visual.primary,
    secondary: visual.secondary,
    accent: visual.accent,
    outline: darken(visual.primary, 0.62),
    ink: readableOn(visual.primary),
    // Keepers are drawn in a lifted, desaturated version of the club accent so
    // the two shot-stoppers never read as outfield players of either side.
    keeper,
    keeperInk: readableOn(keeper),
    plate: {
      GK: lighten(keeper, 0.1),
      DEF: mix(lighten(visual.primary, 0.18), '#7c8cff', 0.3),
      MID: lighten(visual.primary, 0.24),
      ATT: mix(lighten(visual.primary, 0.2), '#ffcf5c', 0.34),
    },
  };
  paletteCache.set(clubId, next);
  return next;
}

export const paletteFor = (club: Club): KitPalette => kitPalette(club.id, club.visual);
