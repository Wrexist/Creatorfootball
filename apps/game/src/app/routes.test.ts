import { describe, expect, it } from 'vitest';
import { SECTION_NAV, splitRail, subDestinationFor, type SectionKey } from './routes';

/**
 * Section navigation, as data.
 *
 * The rail used to show everything a section had, which on World meant eight
 * destinations in a sideways scroller: four visible, the fifth cut in half, and
 * no way for a player to tell whether one more was hidden or four. Splitting it
 * fixes the count — and introduces the one way navigation can now genuinely
 * break, which is a destination that is neither on the rail nor in the sheet,
 * or a screen whose own tab is nowhere to be seen.
 */

const SECTIONS = Object.keys(SECTION_NAV) as SectionKey[];

describe('the section rail', () => {
  it('never loses a destination between the rail and the sheet', () => {
    for (const section of SECTIONS) {
      const items = SECTION_NAV[section];
      const { rail, overflow } = splitRail(items, '/nowhere');
      expect(
        [...rail, ...overflow].map((i) => i.path).sort(),
        `${section} does not account for all of its destinations`,
      ).toEqual(items.map((i) => i.path).sort());
    }
  });

  it('never shows a destination twice', () => {
    for (const section of SECTIONS) {
      for (const item of SECTION_NAV[section]) {
        const { rail, overflow } = splitRail(SECTION_NAV[section], item.path);
        const paths = [...rail, ...overflow].map((i) => i.path);
        expect(new Set(paths).size, `${section} duplicates something at ${item.path}`)
          .toBe(paths.length);
      }
    }
  });

  it('keeps the rail short enough to read without scrolling', () => {
    for (const section of SECTIONS) {
      for (const item of SECTION_NAV[section]) {
        const { rail } = splitRail(SECTION_NAV[section], item.path);
        expect(rail.length, `${section}'s rail is too long at ${item.path}`)
          .toBeLessThanOrEqual(4);
      }
    }
  });

  it('always shows the destination you are actually on', () => {
    // Landing on a screen whose own tab is hidden behind a button leaves you
    // with nothing on screen saying where you are — which is worse than the
    // crowded rail this replaced.
    for (const section of SECTIONS) {
      for (const item of SECTION_NAV[section]) {
        const { rail } = splitRail(SECTION_NAV[section], item.path);
        expect(rail.map((i) => i.path), `${section} hides ${item.path} while you are on it`)
          .toContain(item.path);
      }
    }
  });

  it('shows a promoted destination without reshuffling the ones before it', () => {
    // World is the section with an overflow, so it is the one that can shuffle.
    const world = SECTION_NAV.world;
    const buried = world[world.length - 1];
    expect(buried).toBeDefined();
    const { rail } = splitRail(world, buried?.path ?? '');
    // The leading destinations keep their slots; only the last one gives way.
    expect(rail.slice(0, 3).map((i) => i.path)).toEqual(world.slice(0, 3).map((i) => i.path));
    expect(rail[rail.length - 1]?.path).toBe(buried?.path);
  });

  it('leaves a short section alone', () => {
    const squad = SECTION_NAV.squad;
    const { rail, overflow } = splitRail(squad.slice(0, 3), '/squad');
    expect(rail).toHaveLength(3);
    expect(overflow).toHaveLength(0);
  });

  it('lands every destination in the section that owns it', () => {
    // A rail item pointing at a path a different section claims would light up
    // one section's tab while showing another's rail.
    for (const section of SECTIONS) {
      for (const item of SECTION_NAV[section]) {
        expect(subDestinationFor(item.path)?.path, `${item.path} resolves elsewhere`)
          .toBe(item.path);
      }
    }
  });
});
