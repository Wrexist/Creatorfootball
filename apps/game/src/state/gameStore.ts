import { create } from 'zustand';
import {
  createNewGame, advanceCycle, saveGame, loadGame, loadMeta, deleteSave,
  Ledger, ContentRegistry, BASE_PACK, buildMatchSetup, MatchSimulator,
  type GameState, type NewsStory, type SocialPost, type MatchResult,
  type CycleSummary, type Fixture, type SaveMeta, type ClubChoice, type ManagerChoice,
  type CreatorSeasonConfigDef, type FixtureId,
} from '@cf/engine';
import { storage } from '@/platform/storage';

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

  boot: () => Promise<void>;
  startNewGame: (opts: { seed?: string; manager: ManagerChoice; club: ClubChoice }) => Promise<void>;
  advance: (playerResult?: MatchResult | null) => Promise<CycleSummary | null>;
  createSimulator: (fixtureId: FixtureId) => MatchSimulator | null;
  apply: (mutate: (state: GameState) => GameState) => void;
  save: () => Promise<void>;
  abandon: () => Promise<void>;
  clearCycleFeedback: () => void;
}

let registry: ContentRegistry | null = null;
function contentRegistry(): ContentRegistry {
  if (!registry) {
    registry = new ContentRegistry();
    registry.load(BASE_PACK);
  }
  return registry;
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

export const useGameStore = create<GameStoreState>((set, get) => ({
  phase: 'BOOTING',
  state: null,
  meta: null,
  error: null,
  recoveredFromBackup: false,
  busy: false,
  lastCycle: null,

  boot: async () => {
    set({ phase: 'BOOTING', error: null });
    try {
      const loaded = await loadGame(storage);
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
      const meta = await persist(state);
      set({ phase: 'READY', state, meta, busy: false, lastCycle: null });
    } catch (error) {
      set({ phase: 'ERROR', error: String(error), busy: false });
    }
  },

  advance: async (playerResult) => {
    const current = get().state;
    if (!current || get().busy) return null;
    set({ busy: true });
    try {
      const result = advanceCycle(current, {
        now: Date.now(),
        playerResult: playerResult ?? null,
        registry: contentRegistry(),
        ledger: Ledger.restore(current.ledger),
      });
      const meta = await persist(result.state);
      set({
        state: result.state,
        meta,
        busy: false,
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
    return new MatchSimulator(buildMatchSetup(state, fixture, config, { live: true }));
  },

  /**
   * Escape hatch for actions that are a single engine call rather than a whole
   * cycle — accepting a transfer, setting tactics, upgrading a facility. The
   * mutation must still be an engine function; this only owns persistence.
   */
  apply: (mutate) => {
    const current = get().state;
    if (!current) return;
    const next = mutate(current);
    set({ state: next });
    void persist(next);
  },

  save: async () => {
    const state = get().state;
    if (!state) return;
    const meta = await persist(state);
    set({ meta });
  },

  abandon: async () => {
    await deleteSave(storage);
    set({ phase: 'NO_SAVE', state: null, meta: null, lastCycle: null, error: null });
  },

  clearCycleFeedback: () => set({ lastCycle: null }),
}));

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
