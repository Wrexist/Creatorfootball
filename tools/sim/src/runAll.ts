import { heading, note } from './report';

/**
 * Runs every audit in sequence and fails the process if any one of them fails.
 * This is what CI calls; a balance change that breaks football, inflates the
 * economy or corrupts state should fail here rather than in review.
 */
const AUDITS = ['./simAudit.js', './economyAudit.js', './invariantAudit.js'];

heading('CREATOR FOOTBALL — FULL AUDIT');
note('  Running the simulation, economy and invariant audits in sequence.\n');

let failed = false;
for (const audit of AUDITS) {
  try {
    await import(audit.replace('.js', '.ts'));
  } catch (error) {
    failed = true;
    console.error(`  audit ${audit} threw: ${String(error)}`);
  }
}

if (failed) globalThis.process?.exit(1);
