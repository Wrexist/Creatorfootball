/**
 * One writer, latest state wins.
 *
 * Persistence is fired without being awaited on the hot path: a tap must not
 * wait on a disk write. That was safe while saves went to localStorage, whose
 * writes complete on a microtask in call order. Careers now live in IndexedDB,
 * where a write completes on transaction commit, and several saves can be in
 * flight at once.
 *
 * Two things go wrong without a queue, and one of them is not theoretical:
 *
 *  - Abandoning a career could be undone by a save that was already in flight.
 *    The delete ran, the app showed "no save", and the next boot loaded the
 *    career the player had just deleted. This was reproduced before the queue
 *    existed and is covered by a test.
 *  - Overlapping writes have no guaranteed completion order, so an older state
 *    can land on top of a newer one.
 *
 * The queue holds at most one unstarted write. A newer state replaces a queued
 * one rather than joining a backlog: intermediate snapshots of the same world
 * have no value once a later one exists, and writing all of them is pure cost.
 * Callers waiting on a superseded write are resolved with the result of the
 * write that covered them, because that write persisted their state and more.
 */

/** Resolved to a caller whose write was dropped rather than performed. */
export const CANCELLED = Symbol('save-cancelled');
export type Cancelled = typeof CANCELLED;

export interface SaveQueue<T, R> {
  /**
   * Queue `value` for writing. Resolves with the result of the write that
   * persisted it — which may be a later write that superseded it — or
   * `CANCELLED` if it was dropped by `cancelAndDrain`.
   */
  push(value: T): Promise<R | Cancelled>;
  /**
   * Drop anything not yet written, then wait for any write already in flight.
   *
   * This is what makes deleting a save safe: once this resolves, nothing else
   * is going to touch storage, so the delete cannot be overwritten.
   */
  cancelAndDrain(): Promise<void>;
  /** Exposed for tests and diagnostics. */
  readonly idle: boolean;
}

export function createSaveQueue<T, R>(
  write: (value: T) => Promise<R>,
  /** What a thrown write resolves to. A failure, not a cancellation. */
  onThrow: () => R,
): SaveQueue<T, R> {
  let pending: { value: T } | null = null;
  let waiters: ((result: R | Cancelled) => void)[] = [];
  let running = false;
  /** Resolves when the current drain finishes. Null while nothing is running. */
  let settled: Promise<void> | null = null;

  /**
   * `running` is cleared in a `finally` inside the loop's own async scope, not
   * from a `.finally()` on the returned promise. That distinction is the whole
   * correctness of this file: a `.finally()` callback is itself a microtask, so
   * it runs *after* the continuations of the callers this drain just resolved.
   * A push from one of those continuations would see the queue as still
   * running, decline to start it, and then never be started by anyone — the
   * write is silently lost. Clearing it inside the body means the flag is
   * already false by the time any caller resumes.
   */
  const kick = (): void => {
    if (running) return;
    running = true;
    let done: () => void = () => {};
    settled = new Promise<void>((resolve) => { done = resolve; });

    void (async () => {
      try {
        while (pending) {
          const value = pending.value;
          pending = null;
          // Claim the current waiters before awaiting: anyone who pushes during
          // this write belongs to the next one, not this one.
          const claimed = waiters;
          waiters = [];

          let result: R;
          try {
            result = await write(value);
          } catch {
            result = onThrow();
          }
          for (const resolve of claimed) resolve(result);
        }
      } finally {
        running = false;
        settled = null;
        done();
      }
    })();
  };

  return {
    push(value) {
      pending = { value };
      const result = new Promise<R | Cancelled>((resolve) => waiters.push(resolve));
      kick();
      return result;
    },

    async cancelAndDrain() {
      pending = null;
      const dropped = waiters;
      waiters = [];
      for (const resolve of dropped) resolve(CANCELLED);
      // Captured before awaiting: `settled` is nulled out by the drain itself.
      const inFlight = settled;
      if (inFlight) await inFlight;
    },

    get idle() { return pending === null && !running; },
  };
}
