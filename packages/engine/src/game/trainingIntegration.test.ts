import { describe, expect, it } from 'vitest';
import { createNewGame } from './newGame';
import { advanceCycle } from './cycle';
import { BASE_PACK } from '../content';

describe('weekly player-club training integration', () => {
  it('applies the selected programme to career players and records its results deterministically', () => {
    const state = createNewGame({seed:'redesign-training',now:1000,
      manager:{kind:'PREMADE',templateId:BASE_PACK.data.managers![0]!.id},
      club:{kind:'TEMPLATE',templateId:BASE_PACK.data.clubs![0]!.id},
    });
    const selected = {...state,training:{...state.training,programId:'TECHNICAL',intensity:'HARD' as const}};
    const first = advanceCycle(selected,{now:2000});
    const replay = advanceCycle(selected,{now:2000});
    expect(first.state.training.lastResults.length).toBeGreaterThan(0);
    expect(first.state.training.lastResults).toEqual(replay.state.training.lastResults);
    expect(first.summary.notes.some(note => note.includes('hard'))).toBe(true);
    expect(first.state.clock.cycle).toBe(state.clock.cycle+1);
    expect(state.training.lastResults).toHaveLength(0);
  });
});
