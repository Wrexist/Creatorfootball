import { describe, expect, it } from 'vitest';
import { createNewGame } from './newGame';
import { advanceCycle } from './cycle';
import { buildMatchSetup } from './matchSetup';
import { simulateMatch } from '../matches/simulator';
import { BASE_PACK, ContentRegistry, type CreatorSeasonConfigDef } from '../content';

describe('result ownership', () => {
  it('rejects a result from a different career without changing the source world', () => {
    const state = createNewGame({ seed:'result-boundary',now:1000,
      manager:{kind:'PREMADE',templateId:BASE_PACK.data.managers![0]!.id},
      club:{kind:'TEMPLATE',templateId:BASE_PACK.data.clubs![0]!.id},
    });
    const fixture = Object.values(state.fixtures).find(f => f.week === 1 &&
      (f.homeClubId === state.playerClubId || f.awayClubId === state.playerClubId))!;
    const registry = new ContentRegistry();
    registry.load(BASE_PACK);
    const config = registry.seasonConfig() as CreatorSeasonConfigDef;
    const result = simulateMatch(buildMatchSetup(state, fixture, config));
    expect(() => advanceCycle(state, {now:2000,playerResult:{...result,seed:'different-career'}})).toThrow('next scheduled fixture');
    expect(state.clock.week).toBe(0);
    const applied = advanceCycle(state,{now:2000,playerResult:result});
    expect(applied.state.fixtures[fixture.id]?.matchId).toBe(result.matchId);
    expect(() => advanceCycle(applied.state,{now:3000,playerResult:result})).toThrow('next scheduled fixture');
  });
});
