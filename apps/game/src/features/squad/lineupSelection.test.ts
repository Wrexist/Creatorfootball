import { describe, expect, it } from 'vitest';
import { DEFAULT_TACTICS, type PlayerId } from '@cf/engine';
import { placeInLineup } from './lineupSelection';

const id = (value: string) => value as PlayerId;
const tactics = { ...DEFAULT_TACTICS, formationId:'2-3-1', captainId:null, setPieceTakerId:null, penaltyTakerId:null, lineup: { ST: id('starter'), GK: id('keeper') }, bench: Array.from({length:7},(_,i) => id(`sub${i}`)) };
describe('lineup and named bench movement', () => {
  it('keeps a full named bench when a reserve replaces a starter', () => {
    const patch = placeInLineup(tactics, 'ST', id('reserve'), 7);
    expect(patch.lineup!.ST).toBe('reserve');
    expect(patch.bench).toEqual(tactics.bench);
    expect(Object.values(patch.lineup!)).not.toContain('starter');
  });
  it('swaps a named substitute with the starter in the same bench place', () => {
    expect(placeInLineup(tactics, 'ST', id('sub2'), 7).bench).toEqual(['sub0','sub1','starter','sub3','sub4','sub5','sub6']);
  });
  it('uses a free bench place and swaps two starting positions without changing substitutes', () => {
    expect(placeInLineup({...tactics,bench:[]},'ST',id('reserve'),7).bench).toEqual(['starter']);
    expect(placeInLineup(tactics,'GK',id('starter'),7)).toEqual({lineup:{ST:'keeper',GK:'starter'}});
    expect(tactics.lineup.ST).toBe('starter');
  });
});
