import { describe, expect, it } from 'vitest';
import { projectCyclesKey, projectTargetKey } from '@cf/engine';
import { CAMPUS_PREVIEWS, facilityVisible } from './manifest';
describe('3D campus uses actual facilities', () => {
  it('keeps the base stadium and adds only purchased levels/buildings', () => {
    expect(facilityVisible('campus',{})).toBe(true);
    expect(facilityVisible('facility_stadium_1',{})).toBe(true);
    expect(facilityVisible('facility_stadium_2',{})).toBe(false);
    expect(facilityVisible('facility_stadium_4',{facility_stadium:4})).toBe(true);
    expect(facilityVisible('facility_academy_1',{})).toBe(false);
    expect(facilityVisible('facility_academy_1',{facility_academy:1})).toBe(true);
  });
  it('shows exactly one complete stadium at every purchased level', () => {
    for(let level=0;level<=5;level++) {
      const visible=Array.from({length:6},(_,i)=>i).filter(i=>facilityVisible(`facility_stadium_stage_${i}_${i}`,{facility_stadium:level}));
      expect(visible).toEqual([level]);
    }
  });
  it('does not show an upgrade before construction finishes or unlock unrelated buildings', () => {
    const levels={facility_stadium:3,facility_academy:1,[projectTargetKey('facility_stadium')]:4,[projectCyclesKey('facility_stadium')]:2};
    expect(facilityVisible('facility_stadium_stage_4_4',levels)).toBe(false);
    expect(facilityVisible('facility_academy_3',levels)).toBe(false);
    expect(facilityVisible('facility_academy_1',levels)).toBe(true);
  });
  it('handles missing and out-of-range levels without displaying overlapping stages', () => {
    expect(facilityVisible('facility_stadium_stage_0_0',{})).toBe(true);
    expect(facilityVisible('facility_stadium_stage_5_5',{facility_stadium:20})).toBe(true);
    expect(facilityVisible('facility_stadium_stage_0_0',{facility_stadium:NaN})).toBe(true);
    expect(facilityVisible('facility_stadium_stage_3_3',{facility_stadium:3.9})).toBe(true);
    expect(facilityVisible('facility_stadium_stage_0_0',{facility_stadium:-1})).toBe(true);
  });
  it('defines previews independently from live save data', () => {
    expect(Object.values(CAMPUS_PREVIEWS).map(preview=>preview.level)).toEqual([0,3,5]);
    for(const preview of Object.values(CAMPUS_PREVIEWS)) {
      expect(facilityVisible(`facility_stadium_stage_${preview.level}_${preview.level}`,preview.levels)).toBe(true);
      expect(Object.keys(preview.levels).some(key=>key.startsWith('__'))).toBe(false);
    }
  });
});
