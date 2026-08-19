/**
 * Invariants are assertions about state that must never be false. They are
 * checked in development and in the automated audit suite; in production they
 * report rather than crash, because losing a save is worse than a wrong number.
 */

export interface InvariantViolation {
  readonly code: string;
  readonly message: string;
  readonly context?: Record<string, unknown>;
}

export class InvariantError extends Error {
  constructor(readonly violation: InvariantViolation) {
    super(`[${violation.code}] ${violation.message}`);
    this.name = 'InvariantError';
  }
}

export type InvariantMode = 'throw' | 'collect';

let mode: InvariantMode = 'throw';
const collected: InvariantViolation[] = [];

export const setInvariantMode = (next: InvariantMode): void => { mode = next; };
export const drainViolations = (): InvariantViolation[] => collected.splice(0, collected.length);
export const peekViolations = (): readonly InvariantViolation[] => collected;

export function invariant(
  condition: unknown,
  code: string,
  message: string,
  context?: Record<string, unknown>,
): asserts condition {
  if (condition) return;
  const violation: InvariantViolation = { code, message, context };
  if (mode === 'throw') throw new InvariantError(violation);
  collected.push(violation);
}

export function assertNever(value: never, code = 'EXHAUSTIVE'): never {
  throw new InvariantError({
    code,
    message: `Unhandled variant: ${JSON.stringify(value)}`,
  });
}
