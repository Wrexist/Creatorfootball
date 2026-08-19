import type { Club, ClubVisualIdentity } from '@cf/engine';
import { darken, lighten, readableOn } from '@/design';

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

  const next: KitPalette = {
    clubId,
    primary: visual.primary,
    secondary: visual.secondary,
    accent: visual.accent,
    outline: darken(visual.primary, 0.62),
    ink: readableOn(visual.primary),
    // Keepers are drawn in a lifted, desaturated version of the club accent so
    // the two shot-stoppers never read as outfield players of either side.
    keeper: lighten(visual.accent, 0.25),
    keeperInk: readableOn(lighten(visual.accent, 0.25)),
  };
  paletteCache.set(clubId, next);
  return next;
}

export const paletteFor = (club: Club): KitPalette => kitPalette(club.id, club.visual);
