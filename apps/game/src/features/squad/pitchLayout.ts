import type { FormationSlot } from '@cf/engine';

/** Readable schematic lines; engine anchors remain untouched for simulation. */
export function pitchRows(slots: readonly FormationSlot[]): FormationSlot[][] {
  const rows: FormationSlot[][] = [];
  for (const slot of [...slots].sort((a,b) => a.x - b.x || a.y - b.y)) {
    const last = rows[rows.length - 1];
    if (last && last[0]!.role !== 'GK' && slot.role !== 'GK' && slot.x - last[0]!.x <= 0.11) last.push(slot);
    else rows.push([slot]);
  }
  return rows.reverse().map(row => row.sort((a,b) => a.y - b.y));
}
