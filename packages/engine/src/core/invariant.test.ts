import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  InvariantError, drainViolations, invariant, peekViolations, setInvariantMode,
  setInvariantReporter,
} from './invariant';

afterEach(() => {
  setInvariantMode('throw');
  setInvariantReporter(null);
  drainViolations();
});

describe('invariant modes', () => {
  it('throws by default, so development and tests fail loudly', () => {
    expect(() => invariant(false, 'TEST', 'broken')).toThrow(InvariantError);
    expect(peekViolations()).toHaveLength(0);
  });

  it('collects instead of throwing, and tells the reporter as it happens', () => {
    const reporter = vi.fn();
    setInvariantMode('collect');
    setInvariantReporter(reporter);
    expect(() => invariant(false, 'TEST', 'broken', { at: 1 })).not.toThrow();
    expect(reporter).toHaveBeenCalledWith({ code: 'TEST', message: 'broken', context: { at: 1 } });
    expect(drainViolations()).toEqual([{ code: 'TEST', message: 'broken', context: { at: 1 } }]);
    expect(peekViolations()).toHaveLength(0);
  });

  it('never lets a failing reporter turn a collected violation into a crash', () => {
    setInvariantMode('collect');
    setInvariantReporter(() => { throw new Error('reporter down'); });
    expect(() => invariant(false, 'TEST', 'broken')).not.toThrow();
    expect(peekViolations()).toHaveLength(1);
  });

  it('reports nothing for a condition that holds', () => {
    const reporter = vi.fn();
    setInvariantMode('collect');
    setInvariantReporter(reporter);
    invariant(true, 'TEST', 'fine');
    expect(reporter).not.toHaveBeenCalled();
  });
});
