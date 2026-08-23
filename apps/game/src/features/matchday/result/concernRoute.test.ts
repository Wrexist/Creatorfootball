import { describe, expect, it } from 'vitest';
import type { PlayerId } from '@cf/engine';
import { concernRoute } from './concernRoute';

describe('concernRoute', () => {
  const base = { severity: 50, headline: 'h', detail: 'd' } as const;
  const pid = (id: string): PlayerId => id as PlayerId;

  it('sends a player-shaped problem to that player', () => {
    expect(concernRoute({ ...base, kind: 'INJURY', playerId: pid('p1') })).toBe('/squad/player/p1');
    expect(concernRoute({ ...base, kind: 'CONTRACT', playerId: pid('p2') })).toBe('/squad/player/p2');
  });

  it('routes each non-player concern to the screen that can act on it', () => {
    expect(concernRoute({ ...base, kind: 'FINANCE' })).toBe('/club/finances');
    expect(concernRoute({ ...base, kind: 'MORALE' })).toBe('/squad');
    expect(concernRoute({ ...base, kind: 'FORM' })).toBe('/squad/tactics');
    expect(concernRoute({ ...base, kind: 'FANS' })).toBe('/club/fans');
  });

  it('gives no route when there is nothing to decide', () => {
    expect(concernRoute({ ...base, kind: 'NONE' })).toBeNull();
    expect(concernRoute({ ...base, kind: 'CONTRACT' })).toBeNull();
  });
});
