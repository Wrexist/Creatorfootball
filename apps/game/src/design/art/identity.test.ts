import { describe, expect, it } from 'vitest';
import { BASE_PACK, createNewGame } from '@cf/engine';
import { withVisualIdentity } from './identity';
import { assetFor, managerAssetFor } from './manifest';
import { crestForVisual } from './club-art';

const fresh = () => createNewGame({seed:'art-identities',now:1000,
  manager:{kind:'PREMADE',templateId:BASE_PACK.data.managers![0]!.id},
  club:{kind:'TEMPLATE',templateId:BASE_PACK.data.clubs![0]!.id},
});

describe('persistent illustrated identities', () => {
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
