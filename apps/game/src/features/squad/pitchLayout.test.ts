import { describe, expect, it } from 'vitest';
import { formationsFor } from '@cf/engine';
import { pitchRows } from './pitchLayout';

describe('readable formation layout', () => {
  for (const size of [7,11] as const) for (const formation of formationsFor(size)) {
    it(`preserves every ${formation.id} slot and isolates the goalkeeper`, () => {
      const original = JSON.stringify(formation.slots);
      const rows = pitchRows(formation.slots);
      expect(rows.flat().map(slot => slot.id).sort()).toEqual(formation.slots.map(slot => slot.id).sort());
      expect(rows.at(-1)!.map(slot => slot.role)).toEqual(['GK']);
      expect(Math.max(...rows.map(row => row.length))).toBeLessThanOrEqual(5);
      expect(JSON.stringify(formation.slots)).toBe(original);
    });
  }
});
