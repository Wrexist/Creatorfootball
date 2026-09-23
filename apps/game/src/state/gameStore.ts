import { create } from 'zustand';
import {
  createNewGame, advanceCycle, saveGame, loadGame, loadMeta, deleteSave,
  Ledger, buildMatchSetup, MatchSimulator,
  type GameState, type NewsStory, type SocialPost, type MatchResult,
  type CycleSummary, type Fixture, type SaveMeta, type ClubChoice, type ManagerChoice,
  type CreatorSeasonConfigDef, type FixtureId,
} from '@cf/engine';
import { storage } from '@/platform/storage';
import { contentRegistry } from '@/state/content';
import { withVisualIdentity } from '@/design/art/identity';
import { useMatchStore } from './matchStore';
import { SaveCoordinator, SaveConflict } from '@/platform/saveCoordinator';

/**
 * The single bridge between the engine and the interface.
 *
 * Every rule in this game lives in the engine; this store holds the current
 * state, calls engine functions to move it forward, and persists the result.
 * No component may derive a game outcome for itself — if a screen needs a
 * number, it comes from an engine selector, so the headless balance harness and
 * the app can never disagree about what is true.
 */

export type GamePhase = 'BOOTING' | 'NO_SAVE' | 'CREATING' | 'READY' | 'ERROR';

interface CycleFeedback {
  readonly summary: CycleSummary;
  readonly stories: readonly NewsStory[];
  readonly posts: readonly SocialPost[];
  readonly results: readonly MatchResult[];
}

interface GameStoreState {
  phase: GamePhase;
  state: GameState | null;
  meta: SaveMeta | null;
  error: string | null;
  /** True when the previous save was damaged and we fell back to the backup. */
  recoveredFromBackup: boolean;
  busy: boolean;
  lastCycle: CycleFeedback | null;
  /**
   * A write to storage failed. The mutation is already on screen, so play can
   * continue — but the player must know the next crash costs them this week.
   * Consumed (and cleared) by one global toast rather than per-screen handling,
   * because the failure belongs to persistence, not to whatever button ran it.
   */
  persistFailed: boolean;
  unsaved: boolean;
  saveConflict: boolean;
  saveError: string | null;

  boot: () => Promise<void>;
  startNewGame: (opts: { seed?: string; manager: ManagerChoice; club: ClubChoice }) => Promise<void>;
  advance: (playerResult?: MatchResult | null) => Promise<CycleSummary | null>;
  createSimulator: (fixtureId: FixtureId) => MatchSimulator | null;
  apply: (mutate: (state: GameState) => GameState) => void;
  recordMatch: (result: MatchResult) => Promise<boolean>;
  save: () => Promise<boolean>;
  replaceCareer: (state: GameState) => Promise<boolean>;
  abandon: () => Promise<void>;
  clearCycleFeedback: () => void;
  clearPersistFailed: () => void;
}

/**
 * A save is written after every cycle rather than on a timer or on exit. On
 * mobile the app can be killed at any moment, and losing a matchweek because
 * the process was reclaimed is the kind of thing players never forgive.
 */
async function persist(state: GameState): Promise<SaveMeta | null> {
  const result = await saveGame(storage, state, Date.now());
  return result.ok ? result.value : null;
}

export const useGameStore = create<GameStoreState>((set, get) => {
  let generation = 0;
  let writes: Promise<unknown> = Promise.resolve();
  const coordinator = new SaveCoordinator(storage);
  /**
   * Shared by every write path. `null` means storage rejected the write; the
   * caller has usually already shown the new state, so all that is left is to
   * make sure the player hears about it.
   */
  const notePersist = async (next: GameState): Promise<SaveMeta | null> => {
    const ownGeneration = generation;
    const pending = writes.then(async () => {
      if (ownGeneration !== generation) return null;
      try {
        const meta = await coordinator.write(() => persist(next));
        if (ownGeneration === generation) set({ ...(meta ? { meta } : {}), persistFailed: meta === null, saveError: meta ? null : 'Storage rejected the write.', unsaved: meta === null || get().state !== next });
        return meta;
      } catch (error) {
        if (ownGeneration === generation) set({ persistFailed: true, unsaved: true, saveError: String(error),
          ...(error instanceof SaveConflict ? { saveConflict: true, error: error.message } : {}),
        });
        return null;
      }
    });
    writes = pending;
    return pending;
  };

  return {
  phase: 'BOOTING',
  state: null,
  meta: null,
  error: null,
  recoveredFromBackup: false,
  busy: false,
  lastCycle: null,
  persistFailed: false,
  unsaved: false,
  saveConflict: false,
  saveError: null,

  boot: async () => {
    const ownGeneration = ++generation;
    set({ phase: 'BOOTING', error: null, busy: false });
    try {
      await writes;
      const revision = await coordinator.readRevision();
      const loaded = await loadGame(storage);
      if (ownGeneration !== generation) return;
      if (revision !== await coordinator.readRevision()) throw new SaveConflict();
      coordinator.acceptRevision(revision);
      set({ saveConflict: false, unsaved: false, persistFailed: false, saveError: null });
      if (loaded.ok) {
        const meta = await loadMeta(storage);
        if (ownGeneration !== generation) return;
        set({
          phase: 'READY',
          state: withVisualIdentity(loaded.value.state),
          meta,
          recoveredFromBackup: loaded.value.recoveredFromBackup,
        });
        return;
      }
      if (loaded.error.code === 'NOT_FOUND') {
        set({ phase: 'NO_SAVE', state: null, meta: null });
        return;
      }
      // A damaged save is surfaced honestly rather than silently discarded:
      // the player decides whether to start again.
      set({
        phase: 'ERROR',
        error:
          loaded.error.code === 'UNSUPPORTED_VERSION'
            ? 'This save was created by a newer version of the game.'
            : 'Your save could not be read and no usable backup was found.',
      });
    } catch (error) {
      if (ownGeneration !== generation) return;
      set({ phase: 'ERROR', error: String(error) });
    }
  },

  startNewGame: async ({ seed, manager, club }) => {
    if (get().saveConflict) return;
    const ownGeneration = ++generation;
    useMatchStore.getState().reset();
    set({ phase: 'CREATING', busy: true, error: null });
    try {
      const state = withVisualIdentity(createNewGame({
        // A player-visible seed makes worlds shareable and bugs reproducible.
        seed: seed ?? Math.floor(Date.now() % 1e9).toString(36),
        now: Date.now(),
        manager,
        club,
      }));
      set({ state });
      const meta = await notePersist(state);
      if (ownGeneration !== generation) return;
      set({ phase: 'READY', state, meta, busy: false, lastCycle: null });
    } catch (error) {
      set({ phase: 'ERROR', error: String(error), busy: false });
    }
  },

  advance: async (playerResult) => {
    const current = get().state;
    if (!current || get().busy || get().saveConflict) return null;
    if (playerResult && Object.values(current.fixtures).some((f) =>
      f.status === 'COMPLETED' && f.matchId === playerResult.matchId)) return null;
    const ownGeneration = generation;
    set({ busy: true });
    try {
      // Paint the busy state before the synchronous engine runs.
      if (typeof requestAnimationFrame === 'function') await new Promise<void>(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
      if (ownGeneration !== generation) return null;
      const result = advanceCycle(current, {
        now: Date.now(),
        playerResult: playerResult ?? null,
        registry: contentRegistry(),
        ledger: Ledger.restore(current.ledger),
      });
      const illustrated = withVisualIdentity(playerResult
        ? { ...result.state, latestMatchReport: playerResult } : result.state);
      set({
        state: illustrated,
        error: null,
        lastCycle: {
          summary: result.summary,
          stories: result.stories,
          posts: result.posts,
          results: result.results,
        },
      });
      await notePersist(illustrated);
      if (ownGeneration !== generation) return null;
      set({ busy: false });
      return result.summary;
    } catch (error) {
      set({ busy: false, error: String(error) });
      return null;
    }
  },

  createSimulator: (fixtureId) => {
    const state = get().state;
    if (!state) return null;
    const fixture: Fixture | undefined = state.fixtures[fixtureId];
    if (!fixture || fixture.status !== 'SCHEDULED' || fixture.week !== state.clock.week + 1
      || fixture.seasonId !== state.currentSeasonId
      || (fixture.homeClubId !== state.playerClubId && fixture.awayClubId !== state.playerClubId)) return null;
    const config = contentRegistry().seasonConfig() as CreatorSeasonConfigDef;
    // The authored commentary bank reaches the player's own match too — the
    // cycle wires it for AI fixtures; without this the live game stayed on
    // the built-in table only.
    return new MatchSimulator(buildMatchSetup(state, fixture, config, {
      live: true,
      commentaryLines: contentRegistry().commentary(),
    }));
  },

  /**
   * Escape hatch for actions that are a single engine call rather than a whole
   * cycle — accepting a transfer, setting tactics, upgrading a facility. The
   * mutation must still be an engine function; this only owns persistence.
   */
  apply: (mutate) => {
    const current = get().state;
    if (!current || get().busy || get().saveConflict) return;
    const next = withVisualIdentity(mutate(current));
    set({ state: next, unsaved: true });
    void notePersist(next);
  },

  recordMatch: async (result) => {
    const current = get().state;
    if (!current || get().saveConflict) return false;
    if (current.latestMatchReport?.matchId === result.matchId) return get().save();
    const fixture = Object.values(current.fixtures).find((f) => `match_${f.id}` === result.matchId);
    if (!fixture || fixture.status !== 'SCHEDULED' || fixture.week !== current.clock.week + 1
      || result.homeClubId !== fixture.homeClubId || result.awayClubId !== fixture.awayClubId
      || result.seed !== `${current.seed}:match:${fixture.id}`
      || (fixture.homeClubId !== current.playerClubId && fixture.awayClubId !== current.playerClubId)) return false;
    const next = { ...current, latestMatchReport: result };
    set({ state: next, unsaved: true });
    return await notePersist(next) !== null;
  },

  save: async () => {
    const state = get().state;
    if (!state || get().saveConflict) return false;
    const meta = await notePersist(state);
    return meta !== null;
  },

  replaceCareer: async (candidate) => {
    if (get().busy || get().saveConflict) return false;
    const ownGeneration = ++generation;
    set({ busy: true });
    await writes;
    if (ownGeneration !== generation) return false;
    const next = withVisualIdentity(candidate);
    const meta = await notePersist(next);
    if (ownGeneration !== generation) return false;
    if (!meta) { set({ busy: false }); return false; }
    useMatchStore.getState().reset();
    set({ state: next, meta, phase: 'READY', busy: false, unsaved: false,
      lastCycle: null, error: null, recoveredFromBackup: false });
    return true;
  },

  abandon: async () => {
    if (get().saveConflict) throw new SaveConflict();
    ++generation;
    useMatchStore.getState().reset();
    const deletion = writes.then(() => coordinator.write(() => deleteSave(storage)));
    writes = deletion.catch(() => undefined);
    await deletion;
    set({ phase: 'NO_SAVE', state: null, meta: null, lastCycle: null, error: null, busy: false, unsaved: false, saveConflict: false });
  },

  clearCycleFeedback: () => set({ lastCycle: null }),
  clearPersistFailed: () => set({ persistFailed: false }),
  };
});

/**
 * Read the current state or throw.
 *
 * Screens behind the READY gate always have state; making that explicit is far
 * better than threading a null check through every component and quietly
 * rendering an empty club when something has gone wrong.
 */
export function useGame(): GameState {
  const state = useGameStore((s) => s.state);
  if (!state) throw new Error('useGame called before a game was loaded');
  return state;
}
