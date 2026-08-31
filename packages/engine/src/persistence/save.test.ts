import { describe, expect, it } from 'vitest';
import type { GameState } from '../game/state';
import { buildTestWorld } from '../simulation/fixtures';
import { MIGRATIONS, SAVE_VERSION, migrate, validateState } from './save';

/** Fields that did not exist yet at each version, newest first. */
const ADDED_AFTER_V1 = ['boardPressure', 'decisionMemory', 'decisionRecord', 'opponentModel'] as const;

const stripFields = (state: GameState, fields: readonly string[]): Record<string, unknown> => {
  const rest = { ...(state as unknown as Record<string, unknown>) };
  for (const field of fields) delete rest[field];
  return rest;
};

/** A save written before the board system existed carries none of its state. */
const stripToV1 = (state: GameState): Record<string, unknown> => stripFields(state, ADDED_AFTER_V1);

/** A v2 save has the board field but predates the decision memory. */
const stripToV2 = (state: GameState): Record<string, unknown> =>
  stripFields(state, ['decisionMemory', 'decisionRecord', 'opponentModel']);

/** A v3 save has both decision fields except the graded record. */
const stripToV3 = (state: GameState): Record<string, unknown> =>
  stripFields(state, ['decisionRecord', 'opponentModel']);

/** A v5 save is complete except for the opponent's observation record. */
const stripToV5 = (state: GameState): Record<string, unknown> => stripFields(state, ['opponentModel']);

describe('save migrations', () => {
  it('has a registered step for every version on the chain', () => {
    for (let v = 1; v < SAVE_VERSION; v++) {
      expect(MIGRATIONS[v], `no migration registered for v${v}`).toBeTypeOf('function');
    }
  });

  it('migrates a pre-board save forward with the fields defaulted in', () => {
    expect(SAVE_VERSION).toBe(6);
    const { state } = buildTestWorld({ clubCount: 4 });
    const raw = stripToV1(state);
    expect('boardPressure' in raw).toBe(false);
    expect('decisionMemory' in raw).toBe(false);
    expect('decisionRecord' in raw).toBe(false);

    const result = migrate(raw, 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.boardPressure).toEqual({ lastUltimatumCycle: null });
    expect(result.value.decisionMemory).toEqual({ recentTriggers: [] });
    expect(result.value.decisionRecord).toEqual({});
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
    expect(result.value.decisionRecord).toEqual({});
    expect(result.value.boardPressure).toEqual({ lastUltimatumCycle: null });
  });

  it('migrates a v3 save by adding only the graded record', () => {
    const { state } = buildTestWorld({ clubCount: 4 });
    const raw = stripToV3(state);
    expect('decisionRecord' in raw).toBe(false);

    const result = migrate(raw, 3);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.decisionRecord).toEqual({});
    expect(result.value.decisionMemory).toEqual(state.decisionMemory);
  });

  it('leaves everything else about the save untouched', () => {
    const { state } = buildTestWorld({ clubCount: 4 });
    const result = migrate(stripToV1(state), 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Everything except the newly added fields must be equal; object spread
    // reorders keys, so this compares structurally rather than by string.
    const migrated = result.value as unknown as Record<string, unknown>;
    const rest = stripFields(result.value, ADDED_AFTER_V1);
    expect(Object.keys(migrated).length).toBeGreaterThan(Object.keys(rest).length);
    expect(rest).toEqual(stripToV1(state));
  });

  /**
   * An existing career has been played, but nobody was writing down how. The
   * honest seed is an empty record: the league starts watching from here,
   * rather than retroactively countering a shape it never saw.
   */
  it('starts an existing career with an empty opponent record', () => {
    const { state } = buildTestWorld({ clubCount: 4 });
    const raw = stripToV5(state);
    expect('opponentModel' in raw).toBe(false);

    const result = migrate(raw, 5);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.opponentModel).toEqual({ samples: [] });
    expect(validateState(result.value)).toEqual([]);
  });
});
