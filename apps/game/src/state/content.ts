import { create, type StoreApi, type UseBoundStore } from 'zustand';
import { ContentRegistry, type ContentPack, type ValidationIssue } from '@cf/engine';

/**
 * The one content loader.
 *
 * The base universe is the largest static payload in the app and is read for
 * exactly one reason: to build a world. So it is not in the engine's bundle.
 * It is its own chunk, fetched the first time somebody needs it, validated
 * exactly once, and then shared by everything that asks afterwards.
 *
 * One lifecycle, owned here and nowhere else:
 *
 *   REQUEST → LOAD (dynamic import) → VALIDATE (the registry) → CACHE → READY
 *
 * Whoever asks while a load is in flight gets the same promise; whoever asks
 * afterwards gets the same registry. The promise resolves only once the pack
 * has passed the same validation every pack passes — an import that succeeds
 * is not a pack that is usable — and it never resolves with a partial
 * registry, because a partial registry is never constructed: the pack goes
 * into a fresh registry, and that registry is handed out or thrown away.
 *
 * A failure is a state, not a dead end. The in-flight promise is dropped, so
 * the next request tries the import again; the UI is told, in a status it can
 * subscribe to, and the player is told in their own language.
 *
 * The engine is not involved. It receives a `ContentRegistry` through
 * `createNewGame` and `advanceCycle`; where that registry came from — this
 * chunk, a static import in the headless harness, a fixture in a test — is
 * not its business, which is what keeps loading timing out of the simulation.
 */

/**
 * What the lazily loaded pack module has to look like. Typed, not trusted: a
 * module that imports is not a pack that is valid, and validation below is
 * what decides that.
 */
export interface BasePackModule {
  readonly BASE_PACK: ContentPack;
  readonly CLUB_LORE: Readonly<Record<string, string>>;
}

export interface LoadedContent {
  /** The base pack, validated and loaded. Every consumer shares this instance. */
  readonly registry: ContentRegistry;
  /** The packs the registry was built from, in load order. */
  readonly packs: readonly ContentPack[];
  /** The base pack's authored club histories, keyed by club template id. */
  readonly lore: Readonly<Record<string, string>>;
}

export type ContentFailureKind =
  /** The chunk did not arrive: the connection, or a stale deployment. */
  | 'UNAVAILABLE'
  /** The chunk arrived and the pack inside it failed validation. */
  | 'INVALID';

export class ContentError extends Error {
  override readonly name = 'ContentError';
  constructor(
    readonly kind: ContentFailureKind,
    message: string,
    readonly issues: readonly ValidationIssue[] = [],
    override readonly cause?: unknown,
  ) {
    super(message);
  }
}

export type ContentStatus = 'IDLE' | 'LOADING' | 'READY' | 'FAILED';

export interface ContentStoreState {
  readonly status: ContentStatus;
  readonly failure: ContentError | null;
}

export interface ContentLoader {
  /** Begin loading, or join the load already in flight. Rejects with a `ContentError`. */
  load(): Promise<LoadedContent>;
  /** `load()` for a caller that only wants it started: a failure is recorded, never thrown. */
  prefetch(): void;
  /** The loaded content, or null until it is. Never a partial value. */
  ready(): LoadedContent | null;
  /** The registry, for code that runs only once a career exists. Throws otherwise. */
  registry(): ContentRegistry;
  /** Status for the interface, subscribable. */
  readonly store: UseBoundStore<StoreApi<ContentStoreState>>;
  /**
   * Test seam. Forget everything and, optionally, load from somewhere else
   * next time. Production code never calls this.
   */
  reset(importer?: () => Promise<BasePackModule>): void;
}

/** What the player is told. The football, never the bundler. */
export function playerMessageFor(failure: ContentError | null): string {
  if (failure?.kind === 'INVALID') {
    return 'This version of the game has a problem with its content. Updating or reinstalling should fix it.';
  }
  return 'Your league could not be prepared. Check your connection and try again.';
}

function validateAndLoad(module: BasePackModule): LoadedContent {
  const pack = module.BASE_PACK;
  if (!pack || typeof pack !== 'object' || !pack.manifest || !pack.data) {
    throw new ContentError('INVALID', 'the content module did not contain a pack');
  }
  const registry = new ContentRegistry();
  const issues = registry.load(pack);
  const errors = issues.filter((i) => i.severity === 'error');
  if (errors.length > 0 || !registry.has(pack.manifest.id)) {
    throw new ContentError('INVALID', `pack "${pack.manifest.id}" failed validation`, errors);
  }
  return { registry, packs: [pack], lore: module.CLUB_LORE ?? {} };
}

export function createContentLoader(initialImporter: () => Promise<BasePackModule>): ContentLoader {
  let importer = initialImporter;
  let inflight: Promise<LoadedContent> | null = null;
  let loaded: LoadedContent | null = null;
  const store = create<ContentStoreState>(() => ({ status: 'IDLE', failure: null }));

  const load = (): Promise<LoadedContent> => {
    if (loaded) return Promise.resolve(loaded);
    if (inflight) return inflight;
    store.setState({ status: 'LOADING', failure: null });
    const attempt = (async () => {
      let module: BasePackModule;
      try {
        module = await importer();
      } catch (cause) {
        throw new ContentError('UNAVAILABLE', 'the content chunk could not be loaded', [], cause);
      }
      return validateAndLoad(module);
    })();
    const tracked: Promise<LoadedContent> = attempt.then(
      (result) => {
        // A reset while this was in flight means nobody wants this result.
        if (inflight === tracked) { loaded = result; store.setState({ status: 'READY', failure: null }); }
        return result;
      },
      (error: unknown) => {
        const failure = error instanceof ContentError
          ? error
          : new ContentError('UNAVAILABLE', 'the content could not be loaded', [], error);
        if (inflight === tracked) {
          inflight = null;
          store.setState({ status: 'FAILED', failure });
        }
        // Logs keep the detail the player is spared.
        console.error('[content] load failed', failure.kind, failure.message, failure.issues, failure.cause);
        throw failure;
      },
    );
    inflight = tracked;
    return tracked;
  };

  return {
    load,
    prefetch: () => { void load().catch(() => undefined); },
    ready: () => loaded,
    registry: () => {
      if (!loaded) throw new Error('[CONTENT_NOT_READY] the content registry was read before the pack was loaded');
      return loaded.registry;
    },
    store,
    reset: (next) => {
      importer = next ?? initialImporter;
      inflight = null;
      loaded = null;
      store.setState({ status: 'IDLE', failure: null });
    },
  };
}

/**
 * The app's loader. The import is the only place the pack's path is written,
 * and it is a dynamic import on purpose: that is what makes the pack a chunk
 * the bundler can emit separately from the engine.
 */
export const content: ContentLoader = createContentLoader(
  () => import('@cf/engine/content/packs/base/index'),
);

/**
 * The registry, for code that runs once a career exists.
 *
 * Every consumer of this runs behind the save guard, and a career is READY
 * only after its content has loaded — `boot` and `startNewGame` both wait for
 * it — so by the time a screen reads this, it is here. The throw is the
 * invariant's alarm, not a path anyone is expected to take.
 */
export const contentRegistry = (): ContentRegistry => content.registry();

/** Status and a retry, for the one screen that shows content arriving. */
export function useContent(): {
  status: ContentStatus;
  failure: ContentError | null;
  loaded: LoadedContent | null;
  retry: () => void;
} {
  const { status, failure } = content.store();
  return { status, failure, loaded: content.ready(), retry: content.prefetch };
}
