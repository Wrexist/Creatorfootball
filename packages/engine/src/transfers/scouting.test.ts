import { describe, expect, it } from 'vitest';
import { Rng } from '../core/rng';
import { Ledger, type PostContext } from '../economy/ledger';
import { makeClub, makePlayer, makeState, testRegistry } from '../economy/testing';
import { ATTRIBUTE_KEYS, emptyAttributes } from '../players/attributes';
import type { Player } from '../players/player';
import { SCOUTING_BALANCE } from './balance';
import {
  advanceScouting, assignScout, estimatedOverall, knowledgeRange, potentialRange, scoutCapacity,
} from './scouting';

const POST: PostContext = { cycle: 1, season: 1, at: 0 };

const withConfidence = (confidence: number, revealed: string[] = []): Player =>
  makePlayer({
    id: 'p_scout',
    attributes: { ...emptyAttributes(60), finishing: 82, pace: 41, defending: 55 },
    overall: 70,
    potential: 86,
    scouting: { confidence, revealed },
  });

describe('knowledgeRange', () => {
  it('shows a wide band at zero confidence and the exact value at full confidence', () => {
    const unknown = withConfidence(0);
    const known = withConfidence(1);

    const [lo, hi] = knowledgeRange(unknown, 'finishing');
    expect(hi - lo).toBeGreaterThan(20);
    expect(lo).toBeLessThanOrEqual(82);
    expect(hi).toBeGreaterThanOrEqual(82);

    expect(knowledgeRange(known, 'finishing')).toEqual([82, 82]);
  });

  it('narrows monotonically as confidence rises, and always contains the truth', () => {
    let previousWidth = Infinity;
    for (const confidence of [0, 0.2, 0.4, 0.6, 0.8, 0.95, 1]) {
      const p = withConfidence(confidence);
      for (const key of ATTRIBUTE_KEYS) {
        const [lo, hi] = knowledgeRange(p, key);
        expect(lo).toBeLessThanOrEqual(p.attributes[key]);
        expect(hi).toBeGreaterThanOrEqual(p.attributes[key]);
      }
      const [lo, hi] = knowledgeRange(p, 'finishing');
      expect(hi - lo).toBeLessThanOrEqual(previousWidth);
      previousWidth = hi - lo;
    }
    expect(previousWidth).toBe(0);
  });

  it('is deterministic — re-reading never re-rolls the band', () => {
    const p = withConfidence(0.3);
    expect(knowledgeRange(p, 'pace')).toEqual(knowledgeRange(p, 'pace'));
  });

  it('reveals individually reported attributes exactly while the rest stay fuzzy', () => {
    const p = withConfidence(0.2, ['finishing']);
    expect(knowledgeRange(p, 'finishing')).toEqual([82, 82]);
    const [lo, hi] = knowledgeRange(p, 'defending');
    expect(hi - lo).toBeGreaterThan(0);
  });

  it('keeps potential fuzzier for longer than current ability — a ceiling is never certain', () => {
    const p = withConfidence(0.5);
    const [alo, ahi] = knowledgeRange(p, 'finishing');
    const [plo, phi] = potentialRange(p);
    expect(phi - plo).toBeGreaterThan(ahi - alo);
    expect(plo).toBeLessThanOrEqual(86);
    expect(phi).toBeGreaterThanOrEqual(86);
  });

  it('gives an estimated overall that converges on the truth', () => {
    expect(estimatedOverall(withConfidence(1))).toBe(70);
    const rough = estimatedOverall(withConfidence(0));
    expect(Math.abs(rough - 70)).toBeLessThanOrEqual(SCOUTING_BALANCE.MAX_BAND);
  });
});

describe('scout assignments', () => {
  function baseState() {
    const club = makeClub({ id: 'club_home', isPlayerClub: true, facilityLevels: { scouting: 0 } });
    const player = withConfidence(0);
    return makeState({
      clubs: { [club.id]: club },
      players: { [player.id]: player },
      playerClubId: club.id,
    });
  }

  it('charges for the report and delivers it after the stated delay', () => {
    const state = baseState();
    const ledger = new Ledger();
    ledger.open(state.playerClubId, 1_000_000, POST);

    const assigned = assignScout(
      state,
      { clubId: state.playerClubId, playerId: makePlayer({ id: 'p_scout' }).id, depth: 'DEEP' },
      testRegistry, ledger, POST,
    );

    expect(assigned.ok).toBe(true);
    expect(assigned.cost).toBe(SCOUTING_BALANCE.DEPTH_COST.DEEP);
    expect(ledger.cashOf(state.playerClubId)).toBe(1_000_000 - assigned.cost);

    let next = { ...state, scouting: assigned.scouting! };
    const rng = new Rng('scout');
    let reports: readonly { confidenceAfter: number }[] = [];
    for (let cycle = 0; cycle < assigned.cycles; cycle++) {
      const advanced = advanceScouting(next, rng, {
        clubId: state.playerClubId, cycle, registry: testRegistry, managerScouting: 50,
      });
      reports = advanced.reports;
      next = { ...next, scouting: advanced.scouting, players: { ...next.players, ...advanced.players } };
    }

    expect(reports).toHaveLength(1);
    expect(reports[0]!.confidenceAfter).toBeGreaterThan(0.8);
    const scouted = next.players.p_scout!;
    expect(knowledgeRange(scouted, 'finishing')[1] - knowledgeRange(scouted, 'finishing')[0])
      .toBeLessThan(3);
  });

  it('refuses to exceed the scouting network capacity, which the facility raises', () => {
    const state = baseState();
    const ledger = new Ledger();
    ledger.open(state.playerClubId, 10_000_000, POST);

    const smallClub = state.clubs[state.playerClubId]!;
    expect(scoutCapacity(smallClub, testRegistry)).toBe(SCOUTING_BALANCE.BASE_CAPACITY);
    const bigClub = { ...smallClub, facilityLevels: { scouting: 4 } };
    expect(scoutCapacity(bigClub, testRegistry)).toBeGreaterThan(SCOUTING_BALANCE.BASE_CAPACITY);

    const full = {
      ...state,
      scouting: {
        ...state.scouting,
        assignments: [
          { playerId: makePlayer({ id: 'a' }).id, cyclesRemaining: 2, depth: 'BASIC' as const, startedCycle: 0 },
          { playerId: makePlayer({ id: 'b' }).id, cyclesRemaining: 2, depth: 'BASIC' as const, startedCycle: 0 },
        ],
      },
    };
    const rejected = assignScout(
      full, { clubId: state.playerClubId, playerId: makePlayer({ id: 'p_scout' }).id, depth: 'BASIC' },
      testRegistry, ledger, POST,
    );
    expect(rejected.ok).toBe(false);
    expect(rejected.reason).toMatch(/capacity/);
  });

  it('will not send a scout the club cannot pay for', () => {
    const state = baseState();
    const ledger = new Ledger();
    ledger.open(state.playerClubId, 100, POST);
    const result = assignScout(
      state, { clubId: state.playerClubId, playerId: makePlayer({ id: 'p_scout' }).id, depth: 'DEEP' },
      testRegistry, ledger, POST,
    );
    expect(result.ok).toBe(false);
    expect(ledger.cashOf(state.playerClubId)).toBe(100);
  });

  it('lets knowledge decay so an old report stops being current', () => {
    const player = withConfidence(0.9);
    const state = makeState({ players: { [player.id]: player }, clubs: {} });
    const advanced = advanceScouting(state, new Rng('decay'), {
      clubId: state.playerClubId, cycle: 5, registry: testRegistry, managerScouting: 50,
    });
    expect(advanced.players.p_scout!.scouting.confidence).toBeLessThan(0.9);
  });
});
