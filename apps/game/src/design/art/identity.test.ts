import { describe, expect, it } from 'vitest';
import { BASE_PACK, PREMADE_MANAGERS, createNewGame } from '@cf/engine';
import { withVisualIdentity } from './identity';
import { assetFor, managerAssetFor } from './manifest';
import { crestForVisual } from './club-art';

const fresh = (managerId = BASE_PACK.data.managers![0]!.id) => createNewGame({seed:'art-identities',now:1000,
  manager:{kind:'PREMADE',templateId:managerId},
  club:{kind:'TEMPLATE',templateId:BASE_PACK.data.clubs![0]!.id},
});

describe('persistent illustrated identities', () => {
  it('provides every premade manager with all five expressions and three crops', () => {
    for (const manager of PREMADE_MANAGERS) {
      const state = fresh(manager.id);
      const neutral = managerAssetFor(state.managers[state.playerManagerId]!.appearance);
      expect(neutral, manager.name).toBeTruthy();
      for (const expression of ['neutral', 'focused', 'happy', 'disappointed', 'celebrating']) {
        for (const crop of ['hero','card','thumb'] as const) expect(assetFor(neutral!.replace(/neutral$/, expression), crop), `${manager.name}: ${expression}/${crop}`).toBeTruthy();
      }
    }
  });
  it('keeps every assignment after a save reload and a squad reorder', () => {
    const original = withVisualIdentity(fresh());
    const saved = JSON.parse(JSON.stringify(original));
    saved.clubs[saved.playerClubId].squad.reverse();
    const restored = withVisualIdentity(saved);
    expect(restored.visualIdentity).toEqual(original.visualIdentity);
    expect(withVisualIdentity(restored)).toBe(restored);
    for (const key of Object.values(restored.visualIdentity!.players)) {
      if (key !== 'procedural') expect(assetFor(key,'thumb')).toBeTruthy();
    }
  });
  it('retains a saved face when the player transfers to another club', () => {
    const state = withVisualIdentity(fresh());
    const id = state.clubs[state.playerClubId]!.squad[0]!;
    const key = state.visualIdentity!.players[id];
    const destination = Object.values(state.clubs).find(c => c.id !== state.playerClubId)!;
    const next = withVisualIdentity({...state,players:{...state.players,[id]:{...state.players[id]!,clubId:destination.id}}});
    expect(next.visualIdentity!.players[id]).toBe(key);
  });
  it('uses distinct faces when one position pool is exhausted in a new senior squad', () => {
    const state = fresh();
    const own = state.clubs[state.playerClubId]!.squad;
    const players = {...state.players};
    for (const id of own) players[id] = {...players[id]!, age:24, position:'CB'};
    const next = withVisualIdentity({...state,players});
    const illustrated = own.map(id => next.visualIdentity!.players[id]).filter(key => key !== 'procedural');
    expect(new Set(illustrated).size).toBe(illustrated.length);
    expect(illustrated.length).toBe(Math.min(24, own.length));
  });
  it('does not rewrite historical faces, even if the old save contains a collision', () => {
    const state = withVisualIdentity(fresh());
    const [first, second] = state.clubs[state.playerClubId]!.squad;
    const historical = {...state,visualIdentity:{...state.visualIdentity!, players:{...state.visualIdentity!.players,[second!]:state.visualIdentity!.players[first!]!}}};
    expect(withVisualIdentity(historical).visualIdentity!.players).toEqual(historical.visualIdentity.players);
  });
  it('preserves custom manager and club appearances through vector fallbacks', () => {
    const state = fresh();
    const manager = state.managers[state.playerManagerId]!;
    expect(managerAssetFor({...manager.appearance,hairColor:'#ab129f'})).toBeUndefined();
    expect(crestForVisual({...state.clubs[state.playerClubId]!.visual,primary:'#ab129f'})).toBeUndefined();
    expect(assetFor('missing.asset')).toBeUndefined();
  });
  it('does not assign an adult generated portrait to a youth prospect', () => {
    const state = fresh();const id=Object.keys(state.players)[0]!;
    const next=withVisualIdentity({...state,players:{...state.players,[id]:{...state.players[id]!,age:16}}});
    expect(next.visualIdentity!.players[id]).toBe('procedural');
  });
});
