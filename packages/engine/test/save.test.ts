import { describe, expect, it } from 'vitest';
import {
  MemoryStorage, saveGame, loadGame, loadMeta, deleteSave, validateState,
  checksum, SAVE_KEY, BACKUP_KEY,
} from '../src/index';
import { makeGameState, makePlayer } from './factories';

describe('save integrity', () => {
  it('round-trips a save and reports its metadata', async () => {
    const storage = new MemoryStorage();
    const state = makeGameState();

    const saved = await saveGame(storage, state, 1000);
    expect(saved.ok).toBe(true);

    const loaded = await loadGame(storage);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.value.recoveredFromBackup).toBe(false);
    expect(loaded.value.state.saveId).toBe(state.saveId);
    expect(Object.keys(loaded.value.state.players)).toHaveLength(8);

    const meta = await loadMeta(storage);
    expect(meta?.clubName).toBe('Club club_a');
    expect(meta?.season).toBe(1);
  });

  it('reports NOT_FOUND when there is nothing saved', async () => {
    const loaded = await loadGame(new MemoryStorage());
    expect(loaded.ok).toBe(false);
    if (loaded.ok) return;
    expect(loaded.error.code).toBe('NOT_FOUND');
  });

  it('refuses to overwrite a good save with invalid state', async () => {
    const storage = new MemoryStorage();
    await saveGame(storage, makeGameState(), 1000);

    const broken = makeGameState({ clubs: {} });
    const result = await saveGame(storage, broken, 2000);
    expect(result.ok).toBe(false);

    // The previously good save must still load.
    const loaded = await loadGame(storage);
    expect(loaded.ok).toBe(true);
  });

  it('recovers from the backup when the primary save is corrupted', async () => {
    const storage = new MemoryStorage();
    await saveGame(storage, makeGameState(), 1000);
    // A second save promotes the first to backup.
    await saveGame(storage, makeGameState(), 2000);

    await storage.set(SAVE_KEY, '{ this is not valid json');

    const loaded = await loadGame(storage);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.value.recoveredFromBackup).toBe(true);
  });

  it('detects a tampered save through the checksum', async () => {
    const storage = new MemoryStorage();
    await saveGame(storage, makeGameState(), 1000);

    const raw = await storage.get(SAVE_KEY);
    const envelope = JSON.parse(raw as string);
    envelope.state.clubs.club_a.finance.transferBudget = 999_999_999;
    await storage.set(SAVE_KEY, JSON.stringify(envelope));
    await storage.remove(BACKUP_KEY);

    const loaded = await loadGame(storage);
    expect(loaded.ok).toBe(false);
    if (loaded.ok) return;
    expect(loaded.error.code).toBe('CORRUPT');
  });

  it('rejects a save written by a newer engine version', async () => {
    const storage = new MemoryStorage();
    const state = makeGameState();
    const payload = JSON.stringify(state);
    await storage.set(SAVE_KEY, JSON.stringify({
      version: 99, savedAt: 1, checksum: checksum(payload), state,
    }));

    const loaded = await loadGame(storage);
    expect(loaded.ok).toBe(false);
    if (loaded.ok) return;
    expect(loaded.error.code).toBe('UNSUPPORTED_VERSION');
  });

  it('clears everything on delete', async () => {
    const storage = new MemoryStorage();
    await saveGame(storage, makeGameState(), 1000);
    await deleteSave(storage);
    expect(await storage.keys()).toHaveLength(0);
  });
});

describe('state validation', () => {
  it('accepts a well-formed state', () => {
    expect(validateState(makeGameState())).toEqual([]);
  });

  it('catches a player owned by two clubs', () => {
    const state = makeGameState();
    const shared = makePlayer('p_shared');
    const problems = validateState({
      ...state,
      players: { ...state.players, [shared.id]: shared },
      clubs: {
        ...state.clubs,
        club_a: { ...state.clubs.club_a!, squad: [...state.clubs.club_a!.squad, shared.id] },
        club_b: { ...state.clubs.club_b!, squad: [...state.clubs.club_b!.squad, shared.id] },
      },
    });
    expect(problems.some((p) => p.includes('both'))).toBe(true);
  });

  it('catches a squad referencing an unknown player', () => {
    const state = makeGameState();
    const problems = validateState({
      ...state,
      clubs: {
        ...state.clubs,
        club_a: { ...state.clubs.club_a!, squad: [...state.clubs.club_a!.squad, 'ghost' as never] },
      },
    });
    expect(problems.some((p) => p.includes('unknown player'))).toBe(true);
  });

  it('catches a missing player club', () => {
    const state = makeGameState();
    const problems = validateState({ ...state, playerClubId: 'nope' as never });
    expect(problems.some((p) => p.includes('Player club missing'))).toBe(true);
  });
});
