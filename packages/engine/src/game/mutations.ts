import type { ClubId, ContractId, CreatorId, PlayerId } from '../core/brand';
import type { GameState } from './state';
import type { Player } from '../players/player';
import type { Club } from '../clubs/club';
import type { Creator } from '../creators/creator';
import type { Contract } from '../contracts/contract';
import type { Fixture } from '../league/types';

/**
 * Immutable state updates.
 *
 * Every write to GameState goes through one of these. Two reasons: it keeps the
 * copy-on-write shape shallow so React re-renders only the slice that actually
 * changed, and it means there is exactly one place to add an invariant check if
 * a class of corruption ever appears.
 */

export const setPlayer = (s: GameState, player: Player): GameState => ({
  ...s,
  players: { ...s.players, [player.id]: player },
});

export const setPlayers = (s: GameState, players: readonly Player[]): GameState => {
  if (!players.length) return s;
  const next = { ...s.players };
  for (const p of players) next[p.id] = p;
  return { ...s, players: next };
};

export const patchPlayer = (
  s: GameState,
  id: PlayerId,
  patch: Partial<Player> | ((p: Player) => Partial<Player>),
): GameState => {
  const player = s.players[id];
  if (!player) return s;
  const delta = typeof patch === 'function' ? patch(player) : patch;
  return setPlayer(s, { ...player, ...delta });
};

export const setClub = (s: GameState, club: Club): GameState => ({
  ...s,
  clubs: { ...s.clubs, [club.id]: club },
});

export const setClubs = (s: GameState, clubs: readonly Club[]): GameState => {
  if (!clubs.length) return s;
  const next = { ...s.clubs };
  for (const c of clubs) next[c.id] = c;
  return { ...s, clubs: next };
};

export const patchClub = (
  s: GameState,
  id: ClubId,
  patch: Partial<Club> | ((c: Club) => Partial<Club>),
): GameState => {
  const club = s.clubs[id];
  if (!club) return s;
  const delta = typeof patch === 'function' ? patch(club) : patch;
  return setClub(s, { ...club, ...delta });
};

export const setCreator = (s: GameState, creator: Creator): GameState => ({
  ...s,
  creators: { ...s.creators, [creator.id]: creator },
});

export const patchCreator = (
  s: GameState,
  id: CreatorId,
  patch: Partial<Creator>,
): GameState => {
  const creator = s.creators[id];
  if (!creator) return s;
  return setCreator(s, { ...creator, ...patch });
};

export const setContract = (s: GameState, contract: Contract): GameState => ({
  ...s,
  contracts: { ...s.contracts, [contract.id]: contract },
});

export const removeContract = (s: GameState, id: ContractId): GameState => {
  if (!s.contracts[id]) return s;
  const next = { ...s.contracts };
  delete next[id];
  return { ...s, contracts: next };
};

export const setFixture = (s: GameState, fixture: Fixture): GameState => ({
  ...s,
  fixtures: { ...s.fixtures, [fixture.id]: fixture },
});

/**
 * Move a player between clubs.
 *
 * This is the single sanctioned path for changing ownership, because doing it
 * by hand is how a player ends up in two squads — the corruption that silently
 * duplicates value and that the save validator specifically hunts for.
 */
export function transferPlayer(
  s: GameState,
  playerId: PlayerId,
  toClubId: ClubId | null,
  opts: { toYouth?: boolean } = {},
): GameState {
  const player = s.players[playerId];
  if (!player) return s;

  let next = s;

  // Remove from every club, not just the recorded one: if state has already
  // drifted, this repairs it rather than compounding it.
  for (const club of Object.values(s.clubs)) {
    const inSquad = club.squad.includes(playerId);
    const inYouth = club.youthSquad.includes(playerId);
    if (!inSquad && !inYouth) continue;
    next = patchClub(next, club.id, {
      squad: club.squad.filter((id) => id !== playerId),
      youthSquad: club.youthSquad.filter((id) => id !== playerId),
    });
  }

  if (toClubId) {
    const target = next.clubs[toClubId];
    if (target) {
      next = patchClub(next, toClubId, opts.toYouth
        ? { youthSquad: [...target.youthSquad, playerId] }
        : { squad: [...target.squad, playerId] });
    }
  }

  return patchPlayer(next, playerId, { clubId: toClubId });
}

/** Append to the bounded event log the UI and history screens read from. */
export const appendEvents = (
  s: GameState,
  events: readonly GameState['eventLog'][number][],
  cap = 400,
): GameState => {
  if (!events.length) return s;
  const combined = [...s.eventLog, ...events];
  return { ...s, eventLog: combined.slice(-cap) };
};
