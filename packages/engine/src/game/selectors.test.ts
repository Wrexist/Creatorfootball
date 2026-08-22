import { describe, expect, it } from 'vitest';
import type { ClubId } from '../core/brand';
import type { Creator } from '../creators/creator';
import type { GameState } from './state';
import { buildTestWorld } from '../simulation/fixtures';
import { arenaSupportShare } from './selectors';

/**
 * Detach every creator (`clubTotalReach` scans the creators record by club,
 * not the club's id list) and set follower counts directly, so the share is
 * arithmetic over known inputs rather than whatever the generator shipped.
 */
const withAudience = (
  state: GameState,
  audiences: Readonly<Record<string, number>>,
): GameState => {
  const clubs = { ...state.clubs };
  const creators: Record<string, Creator> = {};
  for (const [id, creator] of Object.entries(state.creators)) {
    creators[id] = { ...creator, clubId: null };
  }
  for (const [id, followers] of Object.entries(audiences)) {
    const club = clubs[id];
    if (!club) throw new Error(`fixture club missing: ${id}`);
    clubs[id as ClubId] = { ...club, fans: { ...club.fans, onlineFollowers: followers } };
  }
  return { ...state, clubs, creators };
};

describe('arenaSupportShare', () => {
  it('splits the arena by audience weight', () => {
    const { state } = buildTestWorld({ clubCount: 2 });
    const even = withAudience(state, { club_0: 500_000, club_1: 500_000 });
    expect(arenaSupportShare(even, 'club_0' as ClubId, 'club_1' as ClubId)).toBeCloseTo(0.5, 6);
  });

  it('hands the bigger audience the bigger share', () => {
    let { state } = buildTestWorld({ clubCount: 2 });
    state = withAudience(state, { club_0: 900_000, club_1: 100_000 });

    const share = arenaSupportShare(state, 'club_0' as ClubId, 'club_1' as ClubId);
    expect(share).toBeCloseTo(0.9, 6);
    // Swapping the order asks the complementary question.
    expect(arenaSupportShare(state, 'club_1' as ClubId, 'club_0' as ClubId)).toBeCloseTo(0.1, 6);
  });

  it('is defined even when neither side has any audience', () => {
    let { state } = buildTestWorld({ clubCount: 2 });
    state = withAudience(state, { club_0: 0, club_1: 0 });
    expect(arenaSupportShare(state, 'club_0' as ClubId, 'club_1' as ClubId)).toBe(0.5);
  });

  it('reads creator reach as well as follower counts', () => {
    let { state } = buildTestWorld({ clubCount: 2 });
    state = withAudience(state, { club_0: 400_000, club_1: 400_000 });
    const base = arenaSupportShare(state, 'club_0' as ClubId, 'club_1' as ClubId);

    const creator = Object.values(state.creators)[0];
    if (!creator) throw new Error('no creators in world');
    const attached = {
      ...state,
      creators: {
        ...state.creators,
        [creator.id]: { ...creator, clubId: 'club_0' as ClubId, followers: 400_000 },
      },
      clubs: {
        ...state.clubs,
        ['club_0' as ClubId]: {
          ...state.clubs['club_0' as ClubId]!,
          creatorIds: [...state.clubs['club_0' as ClubId]!.creatorIds, creator.id],
        },
      },
    };

    expect(arenaSupportShare(attached, 'club_0' as ClubId, 'club_1' as ClubId)).toBeGreaterThan(base);
  });
});
