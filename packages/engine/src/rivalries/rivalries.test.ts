import { describe, expect, it } from 'vitest';
import { Rng } from '../core/rng';
import type { ClubId } from '../core/brand';
import type { Rivalry } from '../game/state';
import { buildTestWorld } from '../simulation/fixtures';
import { RIVALRY_BALANCE } from './balance';
import {
  addRivalryIncident, atmosphereBonus, cardRateMultiplier, decayRivalry, fanReactionMultiplier,
  headToHead, pressureMultiplier, rivalriesOf, rivalryFor, rivalryKey, seedRivalries, topRival,
  updateRivalry, type RivalryMeetingResult,
} from './rivalries';

const meeting = (over: Partial<RivalryMeetingResult> = {}): RivalryMeetingResult => ({
  cycle: 12,
  homeClubId: 'club_0' as ClubId,
  awayClubId: 'club_1' as ClubId,
  homeScore: 1,
  awayScore: 1,
  redCards: 0,
  yellowCards: 2,
  lateWinner: false,
  controversial: false,
  mediaVolume: 0,
  importance: 3,
  incidents: [],
  ...over,
});

describe('seedRivalries', () => {
  const { state, templates, clubIds } = buildTestWorld({ clubCount: 6 });
  const rivalries = seedRivalries(Object.values(state.clubs), templates, new Rng('seed'));

  it('makes two clubs from the same city a derby', () => {
    const derby = rivalries[rivalryKey(clubIds[0] as ClubId, clubIds[1] as ClubId)];
    expect(derby).toBeDefined();
    expect(derby?.intensity).toBeGreaterThanOrEqual(RIVALRY_BALANCE.cityIntensity[0]);
    expect(derby?.origin).toContain('city');
  });

  it('honours rivalries a club template declares', () => {
    const declared = rivalries[rivalryKey('club_2' as ClubId, 'club_3' as ClubId)];
    expect(declared).toBeDefined();
    expect(declared?.intensity).toBeGreaterThanOrEqual(RIVALRY_BALANCE.declaredIntensity[0]);
  });

  it('creates proximity rivalries without connecting every club to every other', () => {
    const count = Object.keys(rivalries).length;
    const clubs = Object.keys(state.clubs).length;
    expect(count).toBeGreaterThanOrEqual(clubs - 1);
    expect(count).toBeLessThan((clubs * (clubs - 1)) / 2);
  });

  it('is deterministic and order-independent in its keys', () => {
    const again = seedRivalries(Object.values(state.clubs), templates, new Rng('seed'));
    expect(JSON.stringify(rivalries)).toBe(JSON.stringify(again));
    expect(rivalryKey('club_1' as ClubId, 'club_0' as ClubId)).toBe(rivalryKey('club_0' as ClubId, 'club_1' as ClubId));
  });

  it('starts every rivalry with no history', () => {
    for (const rivalry of Object.values(rivalries)) {
      expect(rivalry.meetings).toBe(0);
      expect(rivalry.lastMeetingCycle).toBeNull();
      expect(rivalry.clubAId < rivalry.clubBId).toBe(true);
    }
  });
});

describe('updateRivalry', () => {
  const { state, clubIds } = buildTestWorld({ clubCount: 4 });
  const base = state.rivalries[rivalryKey(clubIds[0] as ClubId, clubIds[1] as ClubId)] as Rivalry;

  it('heats up more from a violent thrashing than from a dull draw', () => {
    const dull = updateRivalry(base, meeting(), new Rng('a'));
    const ugly = updateRivalry(base, meeting({
      homeScore: 5, awayScore: 0, redCards: 2, yellowCards: 7,
      lateWinner: true, controversial: true, mediaVolume: 6, importance: 5,
    }), new Rng('a'));
    expect(ugly.intensity - base.intensity).toBeGreaterThan((dull.intensity - base.intensity) * 3);
  });

  it('tracks head-to-head from the perspective of either club', () => {
    const homeWin = updateRivalry(base, meeting({ homeScore: 3, awayScore: 1 }), new Rng('b'));
    const fromHome = headToHead(homeWin, base.clubAId);
    const fromAway = headToHead(homeWin, base.clubBId);
    expect(fromHome.wins + fromAway.wins).toBe(1);
    expect(fromHome.meetings).toBe(1);
    expect(fromHome.wins).toBe(fromAway.losses);
  });

  it('remembers notable incidents and caps the list', () => {
    let rivalry = base;
    for (let i = 0; i < 40; i++) {
      rivalry = updateRivalry(rivalry, meeting({ homeScore: 5, awayScore: 0, incidents: [`Incident ${i}`] }), new Rng(`c${i}`));
    }
    expect(rivalry.incidents.length).toBeLessThanOrEqual(RIVALRY_BALANCE.maxIncidents);
    expect(rivalry.intensity).toBeLessThanOrEqual(RIVALRY_BALANCE.ceiling);
  });

  it('never mutates the rivalry it is given', () => {
    const snapshot = JSON.stringify(base);
    updateRivalry(base, meeting({ homeScore: 4, awayScore: 0 }), new Rng('d'));
    expect(JSON.stringify(base)).toBe(snapshot);
  });

  it('records off-pitch incidents too', () => {
    const after = addRivalryIncident(base, 14, 'Hijacked a transfer', 4);
    expect(after.intensity).toBeGreaterThan(base.intensity);
    expect(after.incidents.at(-1)?.text).toBe('Hijacked a transfer');
  });
});

describe('decay and derived effects', () => {
  const { state, clubIds } = buildTestWorld({ clubCount: 4 });
  const base = state.rivalries[rivalryKey(clubIds[0] as ClubId, clubIds[1] as ClubId)] as Rivalry;

  it('cools slowly once the clubs stop meeting, but never below its baseline', () => {
    let hot: Rivalry = { ...base, intensity: 100, lastMeetingCycle: 0 };
    for (let cycle = 1; cycle < 60; cycle++) hot = decayRivalry(hot, cycle);
    expect(hot.intensity).toBeLessThan(100);
    expect(hot.intensity).toBeGreaterThanOrEqual(RIVALRY_BALANCE.cityIntensity[0]);
  });

  it('does not decay inside the grace window', () => {
    const fresh: Rivalry = { ...base, intensity: 95, lastMeetingCycle: 10 };
    expect(decayRivalry(fresh, 12).intensity).toBe(95);
  });

  it('feeds atmosphere, pressure, cards and fan reaction', () => {
    expect(atmosphereBonus(100)).toBeGreaterThan(atmosphereBonus(0));
    expect(pressureMultiplier(100)).toBeGreaterThan(pressureMultiplier(0));
    expect(cardRateMultiplier(100)).toBeGreaterThan(cardRateMultiplier(0));
    expect(fanReactionMultiplier(100)).toBeGreaterThan(fanReactionMultiplier(0));
    expect(pressureMultiplier(0)).toBe(1);
  });
});

describe('lookups', () => {
  const { state } = buildTestWorld({ clubCount: 6 });

  it('finds a rivalry from either direction and returns null when there is none', () => {
    expect(rivalryFor(state, 'club_0' as ClubId, 'club_1' as ClubId)).not.toBeNull();
    expect(rivalryFor(state, 'club_1' as ClubId, 'club_0' as ClubId)).not.toBeNull();
    expect(rivalryFor(state, 'club_0' as ClubId, 'club_nope' as ClubId)).toBeNull();
  });

  it('orders a club\'s rivalries by heat', () => {
    const list = rivalriesOf(state, 'club_0' as ClubId);
    expect(list.length).toBeGreaterThan(0);
    for (let i = 1; i < list.length; i++) {
      expect((list[i - 1] as Rivalry).intensity).toBeGreaterThanOrEqual((list[i] as Rivalry).intensity);
    }
    expect(topRival(state, 'club_0' as ClubId)?.id).toBe(list[0]?.id);
  });
});
