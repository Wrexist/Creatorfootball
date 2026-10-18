import { drainViolations, setInvariantMode, setInvariantReporter } from '@cf/engine';

/**
 * How a broken engine invariant behaves in this build.
 *
 * Development and the test suites keep the engine's default, `'throw'`: a
 * violation there is a bug to fix now, and a crash is the loudest way to say
 * so. A shipping build must not crash on one — losing a save to a wrong number
 * is worse than the wrong number (docs/RISKS.md, R14) — so it collects instead,
 * and every violation is written to the log as it happens. The log line is the
 * record (analytics is console-only today), so the engine's buffer is drained
 * each time rather than left to grow for the whole session.
 */
export function installInvariantMode(production: boolean = import.meta.env.PROD): void {
  setInvariantMode(production ? 'collect' : 'throw');
  setInvariantReporter(production ? (violation) => {
    console.error(`[invariant] ${violation.code}: ${violation.message}`, violation.context ?? {});
    drainViolations();
  } : null);
}
