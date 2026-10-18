/**
 * In-process FIFO mutex.
 *
 * Each task starts only after every earlier task has settled, and one task's
 * failure never blocks the next. The native shell has exactly one WebView, so
 * this is a complete substitute for Web Locks there (which iOS 15.0–15.3
 * WKWebView does not implement).
 */
export type Mutex = <T>(task: () => Promise<T>) => Promise<T>;

export function createMutex(): Mutex {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(task: () => Promise<T>): Promise<T> => {
    const run = tail.then(task);
    tail = run.then(() => undefined, () => undefined);
    return run;
  };
}
