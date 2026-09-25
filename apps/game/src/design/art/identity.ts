import { MEMBER_SUPERSTAR, positionGroup, type GameState } from '@cf/engine';
import { managerAssetFor } from './manifest';
import { clubArtIdentity, type ClubArtIdentity } from './club-art';

export interface VisualIdentity {
  readonly version: 1;
  readonly players: Readonly<Record<string, string>>;
  readonly creators: Readonly<Record<string, string>>;
  readonly manager: string;
  readonly clubs?: Readonly<Record<string,ClubArtIdentity>>;
}
export type IllustratedGameState = GameState & { readonly visualIdentity?: VisualIdentity };
const hash = (id: string): number => [...id].reduce((n,c) => ((n*31+c.charCodeAt(0)) >>> 0), 0);
export const creatorPortraitAsset = (state: IllustratedGameState | null, id: string): string =>
  state?.visualIdentity?.creators[id] ?? `character.staff-${String(hash(id)%8+1).padStart(2,'0')}`;

/** Additive save metadata, independent of engine rules and schema migrations. */
export function withVisualIdentity(state: GameState): IllustratedGameState {
  const saved = (state as IllustratedGameState).visualIdentity;
  const players = {...saved?.players};
  const creators = {...saved?.creators};
  const clubs = {...saved?.clubs};
  let changed = !saved;
  const own = state.clubs[state.playerClubId]?.squad ?? [];
  const ids = [...own, ...Object.keys(state.players).filter(id => !own.some(p => p === id)).sort()];
  const roleSlots = {GK:[1,2],DEF:[3,4,5,6,7,8],MID:[9,10,11,12,13,14,15,16],ATT:[17,18,19,20,21,22,23,24]};
  const assigned = new Set(own.map(id=>players[id]).filter(Boolean));
  for (const [index,id] of ids.entries()) {
    const p = state.players[id];
    if (!p || players[id]) continue;
    if (id === MEMBER_SUPERSTAR.id) { players[id] = 'character.member-kai-arden'; changed = true; continue; }
    // Junior faces retain their existing age-appropriate vector identity.
    const pool = roleSlots[positionGroup(p.position)];
    // Prefer the role's art, then any unused adult portrait. Exhausting a role
    // must not give two teammates the same face while other portraits are free.
    const ownPool = [...pool, ...Array.from({length:24},(_,i)=>i+1).filter(slot=>!pool.includes(slot))];
    const available = index < own.length ? ownPool.find(slot=>!assigned.has(`character.player-${String(slot).padStart(2,'0')}`)) : undefined;
    const slot = available ?? pool[hash(id)%pool.length] ?? 1;
    players[id] = p.age < 18 || (index < own.length && available === undefined) ? 'procedural' : `character.player-${String(slot).padStart(2,'0')}`;
    if (index < own.length) assigned.add(players[id]);
    changed = true;
  }
  for (const id of Object.keys(state.creators).sort()) {
    if (creators[id]) continue;
    creators[id] = `character.staff-${String(hash(id)%8+1).padStart(2,'0')}`;
    changed = true;
  }
  for (const club of Object.values(state.clubs)) {
    const identity = clubArtIdentity(club.visual);
    if (JSON.stringify(clubs[club.id]) !== JSON.stringify(identity)) {
      clubs[club.id] = identity;
      changed = true;
    }
  }
  const manager = state.managers[state.playerManagerId];
  const managerKey = manager ? managerAssetFor(manager.appearance) ?? 'procedural' : 'procedural';
  if (!changed && saved?.manager === managerKey) return state;
  return {...state, visualIdentity:{version:1,players,creators,clubs,manager:managerKey}};
}
