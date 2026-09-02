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
 * "Tries again" has to mean a real second request. A browser remembers a
 * module fetch that failed and rejects the next `import()` of the same URL
 * without touching the network (Chromium does; the HTML module map allows
 * it), which would turn every "try again" into a lie. So a retry imports the
 * chunk under a fresh query string — same file, a URL the browser has not
 * given up on — with the URL taken from the preload link the bundler's own
 * helper adds to the document, or from the browser's error message. That is
 * the one place this module knows it is running in a bundle, and it is kept
 * to the importer, not the lifecycle.
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

/**
 * How the pack is fetched. `attempt` counts the failures before this call
 * (0 on the first try) and `previous` is the failure that prompted a retry,
 * so an importer can choose a different route the second time.
 */
export type PackImporter = (attempt: number, previous: unknown) => Promise<BasePackModule>;

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
  reset(importer?: PackImporter): void;
  /** How many attempts have failed since the last success or reset. Tests and diagnostics. */
  failures(): number;
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

export function createContentLoader(initialImporter: PackImporter): ContentLoader {
  let importer = initialImporter;
  let inflight: Promise<LoadedContent> | null = null;
  let loaded: LoadedContent | null = null;
  let failed = 0;
  let lastFailure: unknown = null;
  const store = create<ContentStoreState>(() => ({ status: 'IDLE', failure: null }));

  const load = (): Promise<LoadedContent> => {
    if (loaded) return Promise.resolve(loaded);
    if (inflight) return inflight;
    store.setState({ status: 'LOADING', failure: null });
    const attempt = (async () => {
      let module: BasePackModule;
      try {
        module = await importer(failed, lastFailure);
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
          failed += 1;
          lastFailure = failure.cause ?? failure;
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
      failed = 0;
      lastFailure = null;
      store.setState({ status: 'IDLE', failure: null });
    },
    failures: () => failed,
  };
}

/** The content chunk, as the bundler names it (see `manualChunks` in vite.config.ts). */
const PACK_CHUNK = /\/content-[^/?#]*\.js/;

/**
 * Where the content chunk lives, once a load has been attempted.
 *
 * Two sources, tried in order. The bundler's preload helper adds a
 * `<link rel="modulepreload">` for every chunk a dynamic import needs before
 * it runs the import, and the link stays in the document whether or not the
 * fetch succeeded. Failing that, Chromium and Firefox name the URL in the
 * error they throw. Neither is guaranteed everywhere, which is why a retry
 * that cannot find the URL simply imports the specifier again — the honest
 * fallback, and enough in a browser that does not remember failures.
 */
export function packChunkUrl(previous: unknown): string | null {
  if (typeof document !== 'undefined') {
    for (const link of Array.from(document.querySelectorAll('link[rel="modulepreload"]'))) {
      const href = link.getAttribute('href');
      if (href && PACK_CHUNK.test(href)) return new URL(href, document.baseURI).href;
    }
  }
  const message = previous instanceof Error ? previous.message : String(previous ?? '');
  const named = message.match(/https?:\/\/[^\s'"()]*content-[^\s'"()?#]*\.js/);
  return named ? named[0] : null;
}

/**
 * The app's importer. The static specifier is the only place the pack's path
 * is written, and it is a dynamic import on purpose: that is what makes the
 * pack a chunk the bundler can emit separately from the engine. A retry
 * reaches the same file under a URL the browser has not given up on.
 */
export const importBasePack: PackImporter = (attempt, previous) => {
  const url = retryUrl(attempt, previous);
  if (url) return import(/* @vite-ignore */ url) as Promise<BasePackModule>;
  return import('@cf/engine/content/packs/base/index');
};

/** The URL a retry imports: the chunk under a query the browser has not seen. Null on a first attempt or when the chunk cannot be located. */
export function retryUrl(attempt: number, previous: unknown): string | null {
  if (attempt <= 0) return null;
  const url = packChunkUrl(previous);
  return url ? `${url}?retry=${attempt}` : null;
}

export const content: ContentLoader = createContentLoader(importBasePack);

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
  /**
   * How many attempts have failed. A screen keys its failure alert on this
   * so a second failure is a new element — and so a new announcement — rather
   * than the first one with its words quietly changed.
   */
  failures: number;
  loaded: LoadedContent | null;
  retry: () => void;
} {
  const { status, failure } = content.store();
  return { status, failure, failures: content.failures(), loaded: content.ready(), retry: content.prefetch };
}
