import { describe, it } from 'vitest';
import { Rng } from '../core/rng';
import type { ClubId, MatchId, PlayerId } from '../core/brand';
import { buildTestWorld, makeTestEvent } from './fixtures';
import { tickWorld } from './worldTick';

describe('diff', () => {
  it('finds the mutation', () => {
    const world = buildTestWorld();
    const before = JSON.parse(JSON.stringify(world.state));
    tickWorld(world.state, new Rng('nomutate'), {
      at: 0, ledger: world.ledger, registry: null, transferWindowOpen: true,
      events: [makeTestEvent('RED_CARD', { playerId: 'p_0_5' as PlayerId, clubId: 'club_0' as ClubId, matchId: 'm1' as MatchId, minute: 22 }, { id: 'ev_wt_red', importance: 4 })],
    });
    const after = JSON.parse(JSON.stringify(world.state));
    const walk = (a: any, b: any, path: string): void => {
      if (JSON.stringify(a) === JSON.stringify(b)) return;
      if (a && b && typeof a === 'object' && typeof b === 'object') {
        for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) walk(a[key], b[key], `${path}.${key}`);
        return;
      }
      console.log('CHANGED', path, JSON.stringify(a), '->', JSON.stringify(b));
    };
    walk(before, after, '');
  });
});
