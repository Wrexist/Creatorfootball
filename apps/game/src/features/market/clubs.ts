import { useMemo } from 'react';
import type { ClubId, GameState } from '@cf/engine';
import type { PlayerCardClub } from '@/design';

/**
 * Stable club descriptors.
 *
 * `PlayerCard`, `ClubBadge` and `PlayerPortrait` are all memoised, and a fresh
 * `{ primary, secondary }` object built inside a `.map()` defeats every one of
 * them. Building the descriptors once per club and handing the same reference
 * to every row is the difference between a market list that scrolls and one
 * that re-renders forty cards on every keystroke.
 */
export type ClubLookup = (id: ClubId | null | undefined) => PlayerCardClub | undefined;

export function useClubLookup(state: GameState): ClubLookup {
  const cards = useMemo(() => {
    const map = new Map<string, PlayerCardClub>();
    for (const club of Object.values(state.clubs)) {
      map.set(club.id, {
        name: club.shortName,
        abbreviation: club.abbreviation,
        visual: club.visual,
      });
    }
    return map;
  }, [state.clubs]);

  return useMemo(() => (id) => (id ? cards.get(id) : undefined), [cards]);
}
