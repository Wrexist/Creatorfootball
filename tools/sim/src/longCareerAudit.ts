import { performance } from 'node:perf_hooks';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { encodeStoredSave, decodeStoredSave } from '../../../apps/game/src/platform/saveCodec';
import { createNewGame, advanceCycle, BASE_PACK, saveGame, loadGame, MemoryStorage, SAVE_KEY, Ledger } from '@cf/engine';

const checkpoints = new Set([1, 5, 10, 20, 50]);
let state = createNewGame({ seed: 'release-endurance', now: 1000,
  manager: { kind: 'PREMADE', templateId: BASE_PACK.data.managers![0]!.id },
  club: { kind: 'TEMPLATE', templateId: BASE_PACK.data.clubs![0]!.id },
});
const rows: unknown[] = [], cycleTimes: number[] = [];
const output = resolve(process.cwd(), '../../artifacts/redesign/long-career.json');
mkdirSync(resolve(output, '..'), { recursive: true });
while (state.clock.season <= 50) {
  const before = state.clock.season;
  const start = performance.now();
  state = advanceCycle(state, { now: 1000 + state.clock.cycle * 1000 }).state;
  cycleTimes.push(performance.now() - start);
  if (state.clock.season === before) continue;
  if (!checkpoints.has(before)) { cycleTimes.length = 0; continue; }
  const memory = new MemoryStorage(), saveStart = performance.now();
  const saved = await saveGame(memory, state, state.clock.updatedAt);
  if (!saved.ok) throw new Error(JSON.stringify(saved.error));
  const saveMs = performance.now() - saveStart;
  const raw = (await memory.get(SAVE_KEY))!;
  const encodeStart = performance.now(), encoded = await encodeStoredSave(raw);
  const storageEncodeMs = performance.now() - encodeStart;
  if (await decodeStoredSave(encoded) !== raw) throw new Error('Compressed save roundtrip failed');
  const loadStart = performance.now(), loaded = await loadGame(memory);
  if (!loaded.ok) throw new Error(JSON.stringify(loaded.error));
  const loadMs = performance.now() - loadStart;
  if (Ledger.restore(state.ledger).verify().length) throw new Error(`Ledger failed at season ${before}`);
  const ordered = cycleTimes.slice().sort((a,b) => a-b);
  const row = { completedSeasons: before, cycles: state.clock.cycle, bytes: Buffer.byteLength(raw),
    compressedPrimaryAndBackupUtf16Bytes: encoded.length * 4, storageEncodeMs,
    smallestSeniorSquad: Math.min(...Object.values(state.clubs).map(c => c.squad.length)),
    seniorsWithoutContracts: Object.values(state.clubs).flatMap(c => c.squad).filter(id => !state.contracts[state.players[id]?.contractId ?? '']).length,
    localStorageUtf16Bytes: raw.length * 2, primaryAndBackupUtf16Bytes: raw.length * 4,
    saveMs, loadMs, cycleMedianMs: ordered[Math.floor(ordered.length / 2)],
    cycleP95Ms: ordered[Math.min(ordered.length - 1, Math.floor(ordered.length * .95))],
    players: Object.keys(state.players).length, contracts: Object.keys(state.contracts).length,
    heapBytes: process.memoryUsage().heapUsed, ledgerVerified: true, reloadVerified: true };
  rows.push(row); console.log(JSON.stringify(row));
  if (before === 50) writeFileSync(resolve(output, '../long-career-save.json'), raw);
  writeFileSync(output, JSON.stringify({ seed: 'release-endurance', rows }, null, 2));
  state = loaded.value.state;
  cycleTimes.length = 0;
}
