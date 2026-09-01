import { create } from 'zustand';
import {
  createNewGame, advanceCycle, saveGame, loadGame, loadMeta, deleteSave,
  Ledger, buildMatchSetup, MatchSimulator,
  type GameState, type NewsStory, type SocialPost, type MatchResult,
  type CycleSummary, type Fixture, type SaveMeta, type ClubChoice, type ManagerChoice,
  type CreatorSeasonConfigDef, type FixtureId,
  isMatchResultApplied,
} from '@cf/engine';
import { storage } from '@/platform/storage';
import { contentRegistry } from '@/state/content';
import { CANCELLED, createSaveQueue } from './saveQueue';

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
  /**
   * Storage exists but nothing written to it will survive the session —
   * private browsing, or a device that has already refused a write and pushed
   * us to the in-memory fallback. The player is mid-career and has no reason
   * to suspect it, so this is surfaced once rather than left for them to
   * discover when they reopen the app to an empty save slot.
   */
  ephemeralStorage: boolean;

  boot: () => Promise<void>;
  startNewGame: (opts: { seed?: string; manager: ManagerChoice; club: ClubChoice }) => Promise<void>;
  advance: (playerResult?: MatchResult | null) => Promise<CycleSummary | null>;
  createSimulator: (fixtureId: FixtureId) => MatchSimulator | null;
  apply: (mutate: (state: GameState) => GameState) => void;
  save: () => Promise<void>;
  abandon: () => Promise<void>;
  clearCycleFeedback: () => void;
  clearPersistFailed: () => void;
  clearEphemeralWarning: () => void;
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

/**
 * Every write in the app goes through this one queue, so two saves can never
 * be in flight together and abandoning a career cannot be undone by a save
 * that was already on its way. See saveQueue.ts.
 */
const saveQueue = createSaveQueue(persist, () => null);

export const useGameStore = create<GameStoreState>((set, get) => {
  /**
   * Shared by every write path. `null` means storage rejected the write; the
   * caller has usually already shown the new state, so all that is left is to
   * make sure the player hears about it.
   */
  const notePersist = async (next: GameState): Promise<SaveMeta | null> => {
    const outcome = await saveQueue.push(next);
    // The write was dropped because the career was abandoned. Nothing failed,
    // and there is no longer a save for this state to belong to.
    if (outcome === CANCELLED) return null;
    if (outcome === null) set({ persistFailed: true });
    // A device can fall back to memory *during* a write, so this is re-read
    // after every save rather than only at boot.
    if (storage.isEphemeral && !get().ephemeralStorage) set({ ephemeralStorage: true });
    return outcome;
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
  ephemeralStorage: false,

  boot: async () => {
    set({ phase: 'BOOTING', error: null });
    try {
      const loaded = await loadGame(storage);
      // The adapter probes real storage on first access, so by now it knows
      // whether this session can persist at all.
      if (storage.isEphemeral) set({ ephemeralStorage: true });
      if (loaded.ok) {
        set({
          phase: 'READY',
          state: loaded.value.state,
          meta: await loadMeta(storage),
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
      set({ phase: 'ERROR', error: String(error) });
    }
  },

  startNewGame: async ({ seed, manager, club }) => {
    set({ phase: 'CREATING', busy: true, error: null });
    try {
      const state = createNewGame({
        // A player-visible seed makes worlds shareable and bugs reproducible.
        seed: seed ?? Math.floor(Date.now() % 1e9).toString(36),
        now: Date.now(),
        manager,
        club,
      });
      const meta = await notePersist(state);
      set({ phase: 'READY', state, meta, busy: false, lastCycle: null });
    } catch (error) {
      set({ phase: 'ERROR', error: String(error), busy: false });
    }
  },

  advance: async (playerResult) => {
    const current = get().state;
    if (!current || get().busy) return null;
    /**
     * Committing a match result is not idempotent — it advances the week — so
     * the same result must never be handed over twice. `busy` covers the
     * in-flight window (a remount while the first call is still awaiting the
     * save); this covers everything after it, including a reload, by asking
     * the world whether that match has already been played rather than
     * trusting a counter that lives only as long as the tab does.
     */
    if (playerResult && isMatchResultApplied(current, playerResult.matchId)) return null;
    set({ busy: true });
    try {
      const result = advanceCycle(current, {
        now: Date.now(),
        playerResult: playerResult ?? null,
        registry: contentRegistry(),
        ledger: Ledger.restore(current.ledger),
      });
      const meta = await notePersist(result.state);
      set({
        state: result.state,
        meta,
        busy: false,
        error: null,
        lastCycle: {
          summary: result.summary,
          stories: result.stories,
          posts: result.posts,
          results: result.results,
        },
      });
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
    if (!fixture) return null;
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
   *
   * INVARIANT — snapshot, compute and apply must run synchronously.
   *
   * Callers overwhelmingly read state first, compute a result from that
   * snapshot, then merge the result in here. `mutate` receives the *live*
   * state, so if execution yields between the snapshot and this call, the
   * world can move and the merge writes snapshot-derived data over a newer
   * state — money computed against an older ledger, a squad written over one
   * that has since changed. It would not throw and it would not fail a test.
   *
   * So a module that commits through `apply` must contain no async boundary.
   * Enforced by `engineInvariant.test.ts`, which finds those modules by
   * looking for this call rather than from a list. Async work belongs before
   * the snapshot, never inside it.
   */
  apply: (mutate) => {
    const current = get().state;
    if (!current) return;
    const next = mutate(current);
    set({ state: next });
    // Deliberately not awaited: the mutation is already on screen and blocking
    // a tap on a disk write would be worse than the write being late. The catch
    // is a backstop — `saveGame` returns its failures rather than throwing, so
    // reaching here means something below the adapter broke, and an unhandled
    // rejection would take the persist-failure toast down with it.
    void notePersist(next).catch(() => set({ persistFailed: true }));
  },

  save: async () => {
    const state = get().state;
    if (!state) return;
    const meta = await notePersist(state);
    set({ meta });
  },

  abandon: async () => {
    // Stop the writers before deleting, or a save already in flight lands on
    // top of the delete and the "abandoned" career is back on the next boot.
    await saveQueue.cancelAndDrain();
    await deleteSave(storage);
    set({ phase: 'NO_SAVE', state: null, meta: null, lastCycle: null, error: null });
  },

  clearCycleFeedback: () => set({ lastCycle: null }),
  clearPersistFailed: () => set({ persistFailed: false }),
  clearEphemeralWarning: () => set({ ephemeralStorage: false }),
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
