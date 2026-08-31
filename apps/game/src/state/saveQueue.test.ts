import { describe, expect, it } from 'vitest';
import { CANCELLED, createSaveQueue } from './saveQueue';

/** A write we can hold open, so interleaving is deterministic rather than timed. */
function controllable() {
  const started: number[] = [];
  const gates: (() => void)[] = [];
  const write = (value: number): Promise<string> => {
    started.push(value);
    return new Promise<string>((resolve) => {
      gates.push(() => resolve(`wrote:${value}`));
    });
  };
  return {
    write,
    started,
    /** Let the oldest in-flight write finish. */
    async release() {
      const gate = gates.shift();
      gate?.();
      await Promise.resolve();
      await Promise.resolve();
    },
  };
}

describe('save queue', () => {
  it('never runs two writes at once', async () => {
    const c = controllable();
    const q = createSaveQueue(c.write, () => 'failed');

    void q.push(1);
    void q.push(2);
    await Promise.resolve();

    // The second push must wait: only one write has started.
    expect(c.started).toEqual([1]);
    await c.release();
    expect(c.started).toEqual([1, 2]);
  });

  it('coalesces a backlog down to the newest state', async () => {
    const c = controllable();
    const q = createSaveQueue(c.write, () => 'failed');

    void q.push(1);
    await Promise.resolve();
    // Three more arrive while the first is still in flight.
    void q.push(2);
    void q.push(3);
    void q.push(4);
    await c.release();

    // 2 and 3 are dropped: 4 persists everything they would have.
    expect(c.started).toEqual([1, 4]);
    await c.release();
    expect(c.started).toEqual([1, 4]);
  });

  it('resolves a superseded caller with the write that covered it', async () => {
    const c = controllable();
    const q = createSaveQueue(c.write, () => 'failed');

    void q.push(1);
    await Promise.resolve();
    const second = q.push(2);
    const third = q.push(3);
    await c.release();
    await c.release();

    // Both waited on the single write of the newest state.
    expect(await second).toBe('wrote:3');
    expect(await third).toBe('wrote:3');
  });

  it('reports a thrown write as a failure, not a cancellation', async () => {
    const q = createSaveQueue<number, string>(
      () => Promise.reject(new Error('disk on fire')),
      () => 'failed',
    );
    expect(await q.push(1)).toBe('failed');
  });

  it('keeps accepting writes after one fails', async () => {
    let calls = 0;
    const q = createSaveQueue<number, string>(
      (v) => (++calls === 1 ? Promise.reject(new Error('nope')) : Promise.resolve(`wrote:${v}`)),
      () => 'failed',
    );
    expect(await q.push(1)).toBe('failed');
    expect(await q.push(2)).toBe('wrote:2');
  });

  /**
   * The reason this queue exists. Abandoning a career has to be able to stop
   * writers that are already on their way, or the delete is overwritten.
   */
  it('drops queued writes and waits for the one in flight', async () => {
    const c = controllable();
    const q = createSaveQueue(c.write, () => 'failed');

    void q.push(1);
    await Promise.resolve();
    const dropped = q.push(2);

    const drained = q.cancelAndDrain();
    expect(await dropped).toBe(CANCELLED);

    // The in-flight write is still allowed to finish rather than being
    // abandoned mid-transaction.
    await c.release();
    await drained;
    expect(c.started).toEqual([1]);
    expect(q.idle).toBe(true);
  });

  it('is idle once everything settles', async () => {
    const c = controllable();
    const q = createSaveQueue(c.write, () => 'failed');
    const first = q.push(1);
    expect(q.idle).toBe(false);
    await c.release();
    await first;
    expect(q.idle).toBe(true);
  });
});
