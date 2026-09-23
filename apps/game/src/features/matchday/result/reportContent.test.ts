import { describe, expect, it } from 'vitest';
import { partitionClubCoverage } from './reportContent';

describe('post-match club coverage', () => {
  it('keeps unrelated results out of club reaction without losing the roundup', () => {
    const other = {id:'other', entities:[{kind:'club',id:'other-club'}]};
    const own = {id:'own', entities:[{kind:'club',id:'our-club'}, {kind:'club',id:'opponent'}]};
    const lookalike = {id:'name-only', entities:[{kind:'creator',id:'our-club'}]};
    const result = partitionClubCoverage([other, own, lookalike], 'our-club');
    expect(result.club).toEqual([own]);
    expect(result.world).toEqual([other, lookalike]);
  });
  it('leaves an honest empty reaction when only world news exists', () => {
    expect(partitionClubCoverage([{entities:[]}], 'our-club').club).toEqual([]);
    expect(partitionClubCoverage([], 'our-club')).toEqual({club:[],world:[]});
  });
});
