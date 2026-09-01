import {
  createNewGame, advanceCycle, Ledger, ContentRegistry,
  type GameState, type CycleSummary,
} from '@cf/engine';
// The pack is reached by its own path on purpose: the engine's barrel no
// longer carries it, so nothing can pull it into the engine bundle by accident.
import { BASE_PACK } from '@cf/engine/content/packs/base/index';

/**
 * Shared harness for the headless audits.
 *
 * These run the real engine with no UI at all, which is only possible because
 * `packages/engine` carries no React, DOM or platform dependency. Time is
 * injected rather than read, so a hundred simulated seasons are byte-for-byte
 * reproducible from their seeds.
 */

/** A fixed epoch so runs are comparable and nothing reads a real clock. */
export const EPOCH = 1_700_000_000_000;
export const CYCLE_MS = 604_800_000;

let sharedRegistry: ContentRegistry | null = null;
export function registry(): ContentRegistry {
  if (!sharedRegistry) {
    sharedRegistry = new ContentRegistry();
    sharedRegistry.load(BASE_PACK);
  }
  return sharedRegistry;
}

export interface SeasonRun {
  readonly state: GameState;
  readonly summaries: readonly CycleSummary[];
  readonly seed: string;
}

export function startGame(seed: string, clubTemplateId = 'club_cinderwick_town'): GameState {
  return createNewGame({
    registry: registry(),
    seed,
    now: EPOCH,
    manager: { kind: 'PREMADE', templateId: 'manager_vera_lindqvist' },
    club: { kind: 'TEMPLATE', templateId: clubTemplateId },
  });
}

/** Play `weeks` matchweeks from a given state. */
export function playWeeks(state: GameState, weeks: number, startCycle = 0): SeasonRun {
  let current = state;
  const summaries: CycleSummary[] = [];
  const reg = registry();

  for (let i = 0; i < weeks; i++) {
    const result = advanceCycle(current, {
      now: EPOCH + (startCycle + i) * CYCLE_MS,
      registry: reg,
      ledger: Ledger.restore(current.ledger),
    });
    current = result.state;
    summaries.push(result.summary);
  }
  return { state: current, summaries, seed: state.seed };
}

/** Play a full season from a fresh save. */
export function playSeason(seed: string, clubTemplateId?: string): SeasonRun {
  const state = startGame(seed, clubTemplateId);
  const season = state.seasons[state.currentSeasonId];
  return playWeeks(state, season?.totalWeeks ?? 22);
}

export const ledgerOf = (state: GameState): Ledger => Ledger.restore(state.ledger);

/** Progress line that overwrites itself, so a long audit does not spam the log. */
export function progress(label: string, done: number, total: number): void {
  const width = 28;
  const filled = Math.round((done / total) * width);
  const bar = '#'.repeat(filled) + '.'.repeat(width - filled);
  const pct = ((done / total) * 100).toFixed(0).padStart(3);
  const out = globalThis.process?.stdout;
  if (out?.isTTY) {
    out.write(`\r  ${label} [${bar}] ${pct}%  `);
    if (done >= total) out.write('\n');
  } else if (done >= total) {
    console.log(`  ${label}: ${total} complete`);
  }
}
