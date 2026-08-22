import { describe, expect, it } from 'vitest';
import type { GameState } from '../game/state';
import { buildTestWorld } from '../simulation/fixtures';
import { MIGRATIONS, SAVE_VERSION, migrate, validateState } from './save';

/** A save written before the board system existed carries none of its state. */
const stripToV1 = (state: GameState): Record<string, unknown> => {
  const { boardPressure: _dropped, decisionMemory: _alsoDropped, ...rest } = state;
  return rest as unknown as Record<string, unknown>;
};

/** A v2 save has the board field but predates the decision memory. */
const stripToV2 = (state: GameState): Record<string, unknown> => {
  const { decisionMemory: _dropped, ...rest } = state;
  return rest as unknown as Record<string, unknown>;
};

describe('save migrations', () => {
  it('has a registered step for every version on the chain', () => {
    for (let v = 1; v < SAVE_VERSION; v++) {
      expect(MIGRATIONS[v], `no migration registered for v${v}`).toBeTypeOf('function');
    }
  });

  it('migrates a pre-board save forward with the fields defaulted in', () => {
    expect(SAVE_VERSION).toBe(3);
    const { state } = buildTestWorld({ clubCount: 4 });
    const raw = stripToV1(state);
    expect('boardPressure' in raw).toBe(false);
    expect('decisionMemory' in raw).toBe(false);

    const result = migrate(raw, 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.boardPressure).toEqual({ lastUltimatumCycle: null });
    expect(result.value.decisionMemory).toEqual({ recentTriggers: [] });
    // The migrated world must pass the same structural checks a fresh save would.
    expect(validateState(result.value)).toEqual([]);
  });

  it('migrates a v2 save by adding only the decision memory', () => {
    const { state } = buildTestWorld({ clubCount: 4 });
    const raw = stripToV2(state);
    expect('decisionMemory' in raw).toBe(false);

    const result = migrate(raw, 2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.decisionMemory).toEqual({ recentTriggers: [] });
    expect(result.value.boardPressure).toEqual({ lastUltimatumCycle: null });
  });

  it('leaves everything else about the save untouched', () => {
    const { state } = buildTestWorld({ clubCount: 4 });
    const result = migrate(stripToV1(state), 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Everything except the newly added fields must be equal; object spread
    // reorders keys, so this compares structurally rather than by string.
    const migrated = result.value as unknown as Record<string, unknown>;
    const rest = { ...migrated };
    delete rest.boardPressure;
    delete rest.decisionMemory;
    expect(rest).toEqual(stripToV1(state));
  });
});
