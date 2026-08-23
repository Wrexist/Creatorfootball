import { describe, expect, it } from 'vitest';
import type { ClubId } from '../core/brand';
import type { GameState, SponsorDeal } from '../game/state';
import { buildTestWorld, makeTestEvent, withEvents, withFixture } from '../simulation/fixtures';
import { BOARD_BALANCE } from './balance';
import {
  ULTIMATUM_OBJECTIVE_PREFIX,
  activeBoardUltimatum,
  applyUltimatumSanctions,
  assessBoard,
  boardMood,
  boardPressure,
  buildBoardUltimatum,
  initialBoardPressure,
  shouldIssueUltimatum,
} from './board';

type Result = 'W' | 'D' | 'L';

/**
 * Put every club on explicit points so the final table is known exactly.
 * Reputation ranking (the pre-season expectation proxy) is left untouched:
 * in the shared fixture the player's club has the highest reputation, so its
 * expected position is 1st and any lower actual place is pure underperformance.
 */
function withTable(base: GameState, playerPlace: number): GameState {
  const ids = Object.keys(base.clubs).sort();
  const others = ids.filter((id) => id !== base.playerClubId);
  const order: string[] = [];
  let oi = 0;
  for (let place = 1; place <= ids.length; place++) {
    if (place === playerPlace) order.push(base.playerClubId);
    else {
      const other = others[oi];
      if (other) order.push(other);
      oi++;
    }
  }
  const played = 12;
  const clubs = { ...base.clubs };
  order.forEach((id, index) => {
    const club = clubs[id];
    if (!club) return;
    const won = Math.max(0, ids.length - index);
    clubs[id] = {
      ...club,
      seasonRecord: {
        ...club.seasonRecord,
        played, won, drawn: 0, lost: Math.max(0, played - won),
        goalsFor: 20, goalsAgainst: 12,
      },
    };
  });
  return { ...base, clubs };
}

function withSentiment(base: GameState, sentiment: number): GameState {
  const club = base.clubs[base.playerClubId];
  if (!club) return base;
  return { ...base, clubs: { ...base.clubs, [club.id]: { ...club, fans: { ...club.fans, sentiment } } } };
}

/** Append completed fixtures realising the given results, oldest first. */
function withForm(base: GameState, form: readonly Result[]): GameState {
  let next = base;
  form.forEach((result, index) => {
    const week = 40 + index;
    const ourGoals = result === 'W' ? 3 : result === 'D' ? 1 : 0;
    const theirGoals = result === 'L' ? 2 : result === 'D' ? 1 : 0;
    next = withFixture(next, {
      id: `fx_form_${week}`,
      week,
      home: next.playerClubId,
      away: 'club_1' as ClubId,
      homeScore: ourGoals,
      awayScore: theirGoals,
    });
  });
  return next;
}

const deal = (id: string, name: string, satisfaction: number): SponsorDeal => ({
  id,
  sponsorId: `sp_${id}`,
  name,
  slot: 'SHIRT',
  valuePerCycle: 100_000,
  weeksRemaining: 20,
  satisfaction,
});

describe('boardPressure', () => {
  it('is content when the season matches pre-season expectation', () => {
    const { state } = buildTestWorld({ clubCount: 6 });
    const shaped = withForm(withSentiment(state, 62), ['W', 'D', 'W']);
    const pressure = boardPressure(shaped);
    expect(pressure).toBeLessThan(BOARD_BALANCE.thresholds.RESTLESS);
    expect(assessBoard(shaped).mood).toBe('CONTENT');
  });

  it('rises when the club sits below its reputation-implied position', () => {
    const { state } = buildTestWorld({ clubCount: 6 });
    const comfortable = withForm(withTable(withSentiment(state, 60), 1), ['W', 'W', 'D']);
    const struggling = withForm(withTable(withSentiment(state, 60), 6), ['W', 'W', 'D']);
    expect(boardPressure(struggling)).toBeGreaterThan(boardPressure(comfortable));
  });

  it('rises with fan anger and with a losing run, and falls with wins', () => {
    const { state } = buildTestWorld({ clubCount: 6 });
    const calm = withForm(withSentiment(state, 70), ['W', 'W', 'W', 'W', 'W']);
    const angry = withForm(withSentiment(state, 25), ['L', 'L', 'L', 'L', 'L']);
    expect(boardPressure(angry)).toBeGreaterThan(boardPressure(calm));
  });

  it('climbs every rung of the ladder in order, without skipping one', () => {
    const { state } = buildTestWorld({ clubCount: 6 });
    const rungs: GameState[] = [
      withForm(withSentiment(withTable(state, 1), 66), ['W', 'W', 'W']),
      withForm(withSentiment(withTable(state, 4), 52), ['D', 'L', 'W', 'L']),
      withForm(withSentiment(withTable(state, 5), 38), ['L', 'L', 'D', 'L']),
      withForm(withSentiment(withTable(state, 6), 28), ['L', 'L', 'L', 'L', 'L']),
    ];
    const moods = rungs.map((s) => assessBoard(s).mood);
    expect(moods).toEqual(['CONTENT', 'RESTLESS', 'ANGRY', 'ULTIMATUM']);
    for (let i = 1; i < rungs.length; i++) {
      const higher = rungs[i];
      const lower = rungs[i - 1];
      if (!higher || !lower) continue;
      expect(boardPressure(higher)).toBeGreaterThan(boardPressure(lower));
    }
  });

  it('maps explicit pressures onto exactly four moods, threshold-inclusive', () => {
    expect(boardMood(0)).toBe('CONTENT');
    expect(boardMood(BOARD_BALANCE.thresholds.RESTLESS)).toBe('RESTLESS');
    expect(boardMood(BOARD_BALANCE.thresholds.ANGRY)).toBe('ANGRY');
    expect(boardMood(BOARD_BALANCE.thresholds.ULTIMATUM)).toBe('ULTIMATUM');
    expect(boardMood(100)).toBe('ULTIMATUM');
    expect(new Set([boardMood(5), boardMood(30), boardMood(55), boardMood(90)]).size).toBe(4);
  });

  it('never reads or writes the state it is given', () => {
    const { state } = buildTestWorld({ clubCount: 6 });
    const shaped = withForm(withSentiment(state, 30), ['L', 'L', 'L']);
    const before = JSON.stringify(shaped);
    boardPressure(shaped);
    assessBoard(shaped);
    expect(JSON.stringify(shaped)).toBe(before);
  });

  it('reads sentiment trend from recent FAN_SENTIMENT_CHANGED events', () => {
    const { state } = buildTestWorld({ clubCount: 6 });
    const flat = withForm(withSentiment(state, 50), ['D', 'D']);
    const falling = withEvents(
      withForm(withSentiment(state, 50), ['D', 'D']),
      [
        makeTestEvent('FAN_SENTIMENT_CHANGED', {
          clubId: state.playerClubId, from: 60, to: 45, reason: 'supporters turning',
        }, { id: 'ev_mood_drop' }),
      ],
    );
    expect(boardPressure(falling)).toBeGreaterThan(boardPressure(flat));
  });
});

describe('the ultimatum', () => {
  const crisisOf = (): { readonly state: GameState; readonly crisis: GameState } => {
    const world = buildTestWorld({ clubCount: 6 });
    const crisis = withForm(
      withSentiment(withTable(world.state, 6), 28),
      ['L', 'L', 'L', 'L', 'L'],
    );
    return { state: world.state, crisis };
  };

  it('is issued only at ULTIMATUM mood, once, after a cooldown', () => {
    const { crisis } = crisisOf();
    expect(assessBoard(crisis).mood).toBe('ULTIMATUM');
    expect(activeBoardUltimatum(crisis)).toBeNull();
    expect(shouldIssueUltimatum(crisis)).toBe(true);

    const issued: GameState = {
      ...crisis,
      objectives: { ...crisis.objectives, active: [buildBoardUltimatum(crisis)] },
      boardPressure: { lastUltimatumCycle: crisis.clock.cycle },
    };
    expect(activeBoardUltimatum(issued)).not.toBeNull();
    expect(shouldIssueUltimatum(issued)).toBe(false);

    // After a failure the objective leaves the active list, but the cooldown
    // still holds the board back for a while.
    const failedSoon: GameState = {
      ...issued,
      objectives: { ...issued.objectives, active: [] },
      clock: { ...issued.clock, cycle: issued.clock.cycle + 1 },
    };
    expect(activeBoardUltimatum(failedSoon)).toBeNull();
    expect(shouldIssueUltimatum(failedSoon)).toBe(false);

    const cooled: GameState = {
      ...failedSoon,
      clock: {
        ...failedSoon.clock,
        cycle: failedSoon.clock.cycle + BOARD_BALANCE.reissueCooldownCycles,
      },
    };
    expect(shouldIssueUltimatum(cooled)).toBe(true);
  });

  it('never issues below ULTIMATUM mood', () => {
    const { state } = buildTestWorld({ clubCount: 6 });
    expect(shouldIssueUltimatum(state)).toBe(false);
  });

  it('builds a DYNAMIC win-matches objective over the documented window', () => {
    const { state } = buildTestWorld({ clubCount: 6 });
    const objective = buildBoardUltimatum(state);
    expect(objective.id.startsWith(ULTIMATUM_OBJECTIVE_PREFIX)).toBe(true);
    expect(objective.kind).toBe('WIN_MATCHES');
    expect(objective.source).toBe('DYNAMIC');
    expect(objective.status).toBe('ACTIVE');
    expect(objective.importance).toBe(5);
    expect(objective.target).toBe(BOARD_BALANCE.ultimatumTargetWins);
    expect(objective.expiresCycle).toBe(state.clock.cycle + BOARD_BALANCE.ultimatumWindowCycles);
    expect(objective.title.toLowerCase()).toContain('win');
    expect(objective.rewards).toEqual([]);
  });
});

describe('failing the ultimatum has teeth', () => {
  const sponsoredWorld = () => {
    const { state } = buildTestWorld({ clubCount: 6 });
    return {
      ...state,
      sponsors: { available: [], active: [deal('d1', 'ShirtCo', 70), deal('d2', 'KitCo', 55)] },
    };
  };

  it('cuts the wage budget, wounds sponsors and force-lists the best player', () => {
    const state = sponsoredWorld();
    const sanctions = applyUltimatumSanctions(state);
    const clubBefore = state.clubs[state.playerClubId];
    const clubAfter = sanctions.club;
    if (!clubBefore || !clubAfter) throw new Error('fixture club missing');

    const expectedCut = Math.max(
      BOARD_BALANCE.wageBudgetFloor,
      Math.round(clubBefore.finance.wageBudgetPerCycle * (1 - BOARD_BALANCE.wageBudgetCutFraction)),
    );
    expect(clubAfter.finance.wageBudgetPerCycle).toBe(expectedCut);
    expect(clubAfter.finance.wageBudgetPerCycle).toBeLessThan(clubBefore.finance.wageBudgetPerCycle);

    // Every active deal takes the hit well below the renewal threshold, so at
    // its next renewal the sponsor walks through the existing renewal logic.
    expect(state.sponsors.active.length).toBeGreaterThan(0);
    for (const after of sanctions.sponsors.active) {
      const before = state.sponsors.active.find((d) => d.id === after.id);
      expect(after.satisfaction).toBe(
        Math.max(0, (before?.satisfaction ?? 0) - BOARD_BALANCE.sponsorSatisfactionPenalty),
      );
      expect(after.satisfaction).toBeLessThan(60); // SPONSOR_BALANCE.RENEWAL_THRESHOLD
    }

    const listing = sanctions.listing;
    expect(listing).not.toBeNull();
    if (!listing) return;
    expect(listing.clubId).toBe(state.playerClubId);
    expect(listing.availability).toBe('AVAILABLE');
    const listed = state.players[listing.playerId];
    expect(listed).toBeTruthy();
    // The highest-value squad member is the one on the market.
    const bestValue = clubBefore.squad.reduce(
      (best, id) => Math.max(best, state.players[id]?.marketValue ?? 0),
      0,
    );
    expect(listed?.marketValue).toBe(bestValue);
    expect(listing.askingPrice).toBe(Math.round(bestValue * BOARD_BALANCE.forcedListingPriceFactor));
    expect(listing.listedCycle).toBe(state.clock.cycle);
  });

  it('survives an empty squad and an empty sponsor portfolio', () => {
    const { state } = buildTestWorld({ clubCount: 6 });
    const hollow: GameState = {
      ...state,
      sponsors: { available: [], active: [] },
      clubs: {
        ...state.clubs,
        [state.playerClubId]: {
          ...state.clubs[state.playerClubId]!,
          squad: [],
          finance: { ...state.clubs[state.playerClubId]!.finance, wageBudgetPerCycle: BOARD_BALANCE.wageBudgetFloor },
        },
      },
    };
    const sanctions = applyUltimatumSanctions(hollow);
    expect(sanctions.listing).toBeNull();
    expect(sanctions.sponsors.active).toEqual([]);
    expect(sanctions.club.finance.wageBudgetPerCycle).toBe(BOARD_BALANCE.wageBudgetFloor);
  });

  it('does not mutate the state it reads', () => {
    const state = sponsoredWorld();
    const before = JSON.stringify(state);
    applyUltimatumSanctions(state);
    expect(JSON.stringify(state)).toBe(before);
  });
});

describe('initialBoardPressure', () => {
  it('starts with no ultimatum history', () => {
    expect(initialBoardPressure()).toEqual({ lastUltimatumCycle: null });
  });
});
