import { useMemo } from 'react';
import { recentForm, type Club, type ClubId, type GameState } from '@cf/engine';
import type { MatchCardSide } from '@/design';

/**
 * Stable club descriptors for the league screens.
 *
 * `MatchCard`, `ClubBadge` and `ClubCard` are memoised; a fixture list that
 * built a fresh side object per row would re-render every card on every state
 * change. One map, built once per club set, handed out by reference.
 */
export interface ClubLookup {
  readonly club: (id: ClubId) => Club | undefined;
  readonly side: (id: ClubId) => MatchCardSide;
  readonly name: (id: ClubId) => string;
}

const UNKNOWN: MatchCardSide = {
  clubId: 'unknown',
  name: 'Unknown club',
  shortName: 'Unknown',
  abbreviation: '???',
  visual: {
    primary: '#1c2026', secondary: '#0e1013', accent: '#c8ff2e',
    badgeShape: 'SHIELD', badgeMotif: 'STAR', style: 'MINIMAL', kitPattern: 'SOLID',
  },
};

export function useClubLookup(state: GameState): ClubLookup {
  return useMemo(() => {
    const sides = new Map<string, MatchCardSide>();
    for (const club of Object.values(state.clubs)) {
      sides.set(club.id, {
        clubId: club.id,
        name: club.name,
        shortName: club.shortName,
        abbreviation: club.abbreviation,
        visual: club.visual,
        form: recentForm(state, club.id, 5),
      });
    }
    return {
      club: (id) => state.clubs[id],
      side: (id) => sides.get(id) ?? UNKNOWN,
      name: (id) => state.clubs[id]?.shortName ?? 'Unknown',
    };
    // Form comes off completed fixtures, so the map must rebuild when they do.
  }, [state]);
}
