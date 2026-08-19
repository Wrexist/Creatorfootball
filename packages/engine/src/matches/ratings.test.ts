import { describe, expect, it } from 'vitest';
import { asId } from '../core/brand';
import type { PlayerId } from '../core/brand';
import { BALANCE } from './balance';
import { pickManOfTheMatch, ratePlayer } from './ratings';
import type { RatingInput } from './ratings';

const base = (over: Partial<RatingInput> = {}): RatingInput => ({
  playerId: asId<PlayerId>('p'), role: 'MID', minutes: 30, goals: 0, assists: 0, shots: 0,
  shotsOnTarget: 0, keyPasses: 0, passes: 20, passesCompleted: 16, tackles: 0, interceptions: 0,
  duelsWon: 0, duelsLost: 0, saves: 0, yellowCards: 0, redCards: 0, bigChancesMissed: 0,
  goalsConcededWhileOn: 0, cleanSheet: false, matchMinutes: 30, ...over,
});

describe('player ratings', () => {
  it('start from the baseline for an anonymous performance', () => {
    expect(ratePlayer(base())).toBeCloseTo(BALANCE.RATING_BASE, 0);
  });

  it('stay inside 1.0 - 10.0 whatever happens', () => {
    const monster = ratePlayer(base({ goals: 9, assists: 6, keyPasses: 20, shotsOnTarget: 15, duelsWon: 40 }));
    const disaster = ratePlayer(base({ redCards: 1, yellowCards: 1, bigChancesMissed: 6, duelsLost: 40, goalsConcededWhileOn: 9, role: 'DEF' }));
    expect(monster).toBeLessThanOrEqual(10);
    expect(disaster).toBeGreaterThanOrEqual(1);
    expect(monster).toBeGreaterThan(disaster);
  });

  it('reward contribution, not the scoreline', () => {
    // Same keeper performance, opposite results. The rating must barely move.
    const heroInDefeat = ratePlayer(base({ role: 'GK', saves: 8, goalsConcededWhileOn: 4 }));
    const passengerInAWin = ratePlayer(base({ role: 'GK', saves: 0, goalsConcededWhileOn: 0, cleanSheet: true }));
    expect(heroInDefeat).toBeGreaterThan(BALANCE.RATING_BASE);
    expect(passengerInAWin).toBeGreaterThan(BALANCE.RATING_BASE);

    const strikerWhoMissed = ratePlayer(base({ role: 'ATT', shots: 5, shotsOnTarget: 1, bigChancesMissed: 3 }));
    expect(strikerWhoMissed).toBeLessThan(BALANCE.RATING_BASE);
  });

  it('rate a goal above an assist above a key pass', () => {
    expect(ratePlayer(base({ goals: 1 }))).toBeGreaterThan(ratePlayer(base({ assists: 1 })));
    expect(ratePlayer(base({ assists: 1 }))).toBeGreaterThan(ratePlayer(base({ keyPasses: 1 })));
  });

  it('punish a red card hard and a booking lightly', () => {
    expect(ratePlayer(base({ yellowCards: 1 }))).toBeLessThan(ratePlayer(base()));
    expect(ratePlayer(base({ redCards: 1 }))).toBeLessThan(ratePlayer(base({ yellowCards: 1 })));
  });

  it('pull a cameo back toward the baseline', () => {
    const full = ratePlayer(base({ goals: 2, minutes: 30 }));
    const cameo = ratePlayer(base({ goals: 2, minutes: 3 }));
    expect(cameo).toBeLessThan(full);
    expect(cameo).toBeGreaterThan(BALANCE.RATING_BASE);
  });

  it('read passing accuracy only once there are enough passes to mean anything', () => {
    const sloppy = ratePlayer(base({ passes: 40, passesCompleted: 20 }));
    const tidy = ratePlayer(base({ passes: 40, passesCompleted: 38 }));
    expect(tidy).toBeGreaterThan(sloppy);
    expect(ratePlayer(base({ passes: 2, passesCompleted: 0 }))).toBeCloseTo(BALANCE.RATING_BASE, 1);
  });

  it('credit a clean sheet to the keeper and the defence, not the striker', () => {
    expect(ratePlayer(base({ role: 'GK', cleanSheet: true }))).toBeGreaterThan(ratePlayer(base({ role: 'GK' })));
    expect(ratePlayer(base({ role: 'ATT', cleanSheet: true }))).toBeCloseTo(ratePlayer(base({ role: 'ATT' })), 5);
  });
});

describe('man of the match', () => {
  const c = (id: string, side: 'home' | 'away', rating: number, goals = 0) => ({
    playerId: asId<PlayerId>(id), side, rating, goals, assists: 0, minutes: 30,
  });

  it('picks the best rating, with a nod to the winner', () => {
    expect(pickManOfTheMatch([c('a', 'home', 8.4), c('b', 'away', 8.1)], 'home')).toBe('a');
    expect(pickManOfTheMatch([c('a', 'home', 8.0), c('b', 'away', 8.5)], 'home')).toBe('b');
  });

  it('can still award it to a losing player who was clearly the best', () => {
    expect(pickManOfTheMatch([c('a', 'home', 7.0), c('b', 'away', 9.2)], 'home')).toBe('b');
  });

  it('ignores players who never got on', () => {
    const bench = { playerId: asId<PlayerId>('z'), side: 'home' as const, rating: 10, goals: 0, assists: 0, minutes: 0 };
    expect(pickManOfTheMatch([bench, c('a', 'home', 6.5)], 'draw')).toBe('a');
  });

  it('returns null when nobody played', () => {
    expect(pickManOfTheMatch([], 'draw')).toBeNull();
  });
});
