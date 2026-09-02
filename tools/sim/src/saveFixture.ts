/**
 * Emit a real, playable save for the browser smoke test.
 *
 * The end-to-end persistence test needs a career that the app will actually
 * load: correct envelope version, a checksum that matches, and a state that
 * passes the save validator. Driving the onboarding UI to produce one would
 * make the test a hostage to the shape of three creation screens; building it
 * with the engine tests the thing we care about — that a genuine save
 * round-trips through the real storage layer in a real browser — and nothing
 * we do not.
 *
 * Usage: tsx src/saveFixture.ts <out.json>
 */
import { writeFileSync } from 'node:fs';
import { checksum, SAVE_VERSION, SAVE_KEY, META_KEY, validateState } from '@cf/engine';
import { startGame, playWeeks } from './harness';

const out = process.argv[2];
if (!out) {
  console.error('usage: tsx src/saveFixture.ts <out.json>');
  process.exit(1);
}

// A few weeks in, so the save carries played fixtures, a ledger and a table
// rather than a pristine world that exercises none of the loading paths.
const state = playWeeks(startGame('smoke-fixture'), 3, 0).state;

const problems = validateState(state);
if (problems.length > 0) {
  console.error('refusing to emit an invalid fixture:', problems.slice(0, 3).join('; '));
  process.exit(1);
}

const savedAt = 1_700_000_000_000;
const envelope = {
  version: SAVE_VERSION,
  savedAt,
  checksum: checksum(JSON.stringify(state)),
  state,
};
const club = state.clubs[state.playerClubId];
const manager = state.managers[state.playerManagerId];

writeFileSync(out, JSON.stringify({
  [SAVE_KEY]: JSON.stringify(envelope),
  [META_KEY]: JSON.stringify({
    saveId: state.saveId,
    clubName: club?.name ?? 'Unknown Club',
    managerName: manager?.name ?? 'Unknown Manager',
    season: state.clock.season,
    week: state.clock.week,
    cycle: state.clock.cycle,
    savedAt,
    version: SAVE_VERSION,
  }),
  // Read by the assertions so the test knows what it is looking for.
  expect: {
    clubName: club?.name ?? '',
    clubShortName: club?.shortName ?? '',
    season: state.clock.season,
    week: state.clock.week,
    seed: state.seed,
  },
}));
console.log(`save fixture written: ${out} (${club?.shortName ?? '?'}, season ${state.clock.season} week ${state.clock.week})`);
