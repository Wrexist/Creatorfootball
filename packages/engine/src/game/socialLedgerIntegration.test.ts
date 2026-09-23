import { describe, expect, it } from 'vitest';
import { createNewGame } from './newGame';
import { advanceCycle } from './cycle';
import { BASE_PACK } from '../content';

describe('social rewards survive the matchweek ledger', () => {
  it('retains paid follower milestones alongside ordinary weekly transactions', () => {
    const state = createNewGame({seed:'social-ledger',now:1000,
      manager:{kind:'PREMADE',templateId:BASE_PACK.data.managers![0]!.id},
      club:{kind:'TEMPLATE',templateId:BASE_PACK.data.clubs![0]!.id},
    });
    const club = state.clubs[state.playerClubId]!;
    const established = {...state,clubs:{...state.clubs,[club.id]:{...club,fans:{...club.fans,onlineFollowers:600000}}}};
    const week = advanceCycle(established,{now:2000});
    const paid = week.state.ledger.transactions.filter(tx=>tx.idempotencyKey?.startsWith('follower-milestone:'));
    expect(paid.length).toBeGreaterThan(0);
    expect(paid.every(tx=>week.state.ledger.appliedKeys[tx.idempotencyKey!] !== undefined)).toBe(true);
    expect(week.state.ledger.transactions.length).toBeGreaterThan(state.ledger.transactions.length+paid.length);
    const next = advanceCycle(week.state,{now:3000});
    for (const tx of paid) expect(next.state.ledger.transactions.filter(t=>t.idempotencyKey===tx.idempotencyKey)).toHaveLength(1);
  });
});
