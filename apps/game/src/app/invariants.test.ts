import { afterEach, describe, expect, it, vi } from 'vitest';
import { InvariantError, invariant, peekViolations } from '@cf/engine';
import { installInvariantMode } from './invariants';

afterEach(() => {
  installInvariantMode(false);
  vi.restoreAllMocks();
});

describe('invariant mode at startup', () => {
  it('keeps throwing outside a production build', () => {
    installInvariantMode();
    expect(() => invariant(false, 'TEST', 'broken')).toThrow(InvariantError);
  });

  it('collects and logs in a production build instead of crashing', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    installInvariantMode(true);
    expect(() => invariant(false, 'TEST', 'broken', { week: 3 })).not.toThrow();
    expect(log).toHaveBeenCalledWith('[invariant] TEST: broken', { week: 3 });
    // Logged, then drained: a long session must not accumulate them.
    expect(peekViolations()).toHaveLength(0);
  });
});
