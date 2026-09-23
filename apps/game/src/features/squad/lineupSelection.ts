import type { PlayerId, TacticSetup } from '@cf/engine';

/** Mirror the named match bench without silently dropping a different substitute. */
export function placeInLineup(tactics: TacticSetup, slotId: string, playerId: PlayerId, benchLimit: number): Partial<TacticSetup> {
  const outgoing = tactics.lineup[slotId] ?? null;
  const fromSlot = Object.keys(tactics.lineup).find(id => tactics.lineup[id] === playerId);
  const lineup = { ...tactics.lineup, [slotId]: playerId };
  if (fromSlot) return { lineup: { ...lineup, [fromSlot]: outgoing } };
  const benchIndex = tactics.bench.indexOf(playerId);
  const bench = tactics.bench.filter(id => id !== playerId);
  if (outgoing && bench.length < benchLimit) bench.splice(benchIndex < 0 ? bench.length : benchIndex, 0, outgoing);
  return { lineup, bench };
}
