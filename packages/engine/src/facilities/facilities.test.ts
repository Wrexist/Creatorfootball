import { describe, expect, it } from 'vitest';
import { Rng } from '../core/rng';
import { Ledger, type PostContext } from '../economy/ledger';
import { makeClub, testRegistry, TEST_FACILITIES } from '../economy/testing';
import {
  advanceFacilities, facilityEffect, facilityEffectOr, nextUpgrade, pendingProjects,
  totalUpkeep, upgradeFacility,
} from './facilities';

const POST: PostContext = { cycle: 3, season: 1, at: 0 };

describe('facilityEffect', () => {
  it('reads the level-indexed effects map from the content pack, never a hardcoded number', () => {
    const club = makeClub({ id: 'c', facilityLevels: { training_centre: 3 } });
    const def = TEST_FACILITIES.find((d) => d.id === 'training_centre')!;
    expect(facilityEffect(club, 'trainingGain', testRegistry)).toBe(def.effects.trainingGain![3]);
    expect(facilityEffect(makeClub({ id: 'c' }), 'trainingGain', testRegistry)).toBe(0);
  });

  it('sums contributions when more than one building declares the same key', () => {
    const club = makeClub({ id: 'c', facilityLevels: { training_centre: 4, medical: 4 } });
    const training = TEST_FACILITIES.find((d) => d.id === 'training_centre')!.effects.injuryResistance![4]!;
    const medical = TEST_FACILITIES.find((d) => d.id === 'medical')!.effects.injuryResistance![4]!;
    expect(facilityEffect(club, 'injuryResistance', testRegistry)).toBeCloseTo(training + medical, 6);
  });

  it('clamps to the top of the table rather than reading past the end', () => {
    const club = makeClub({ id: 'c', facilityLevels: { training_centre: 99 } });
    expect(facilityEffect(club, 'trainingGain', testRegistry)).toBe(0.6);
  });

  it('falls back only when no facility declares the key at all', () => {
    const club = makeClub({ id: 'c' });
    expect(facilityEffectOr(club, 'trainingGain', testRegistry, 5)).toBe(0);
    expect(facilityEffectOr(club, 'nonexistentKey', testRegistry, 5)).toBe(5);
  });
});

describe('upgradeFacility', () => {
  it('takes the money now and delivers the benefit cycles later', () => {
    const club = makeClub({ id: 'c', facilityLevels: { training_centre: 1 } });
    const ledger = new Ledger();
    ledger.open(club.id, 10_000_000, POST);

    const outcome = upgradeFacility(club, 'training_centre', testRegistry, ledger, POST);
    expect(outcome.ok).toBe(true);
    expect(ledger.cashOf(club.id)).toBe(10_000_000 - outcome.cost);
    // The level has NOT moved yet — that is the whole point of the delay.
    expect(outcome.club!.facilityLevels.training_centre).toBe(1);
    expect(pendingProjects(outcome.club!)).toHaveLength(1);
    expect(facilityEffect(outcome.club!, 'trainingGain', testRegistry)).toBe(0.12);

    let current = outcome.club!;
    for (let i = 0; i < outcome.cycles; i++) {
      current = advanceFacilities(current, testRegistry, ledger, POST, new Rng(`build-${i}`)).club;
    }
    expect(current.facilityLevels.training_centre).toBe(2);
    expect(pendingProjects(current)).toHaveLength(0);
    expect(facilityEffect(current, 'trainingGain', testRegistry)).toBe(0.25);
  });

  it('refuses when the club cannot pay, and takes nothing', () => {
    const club = makeClub({ id: 'c' });
    const ledger = new Ledger();
    ledger.open(club.id, 1_000, POST);
    const outcome = upgradeFacility(club, 'stadium', testRegistry, ledger, POST);
    expect(outcome.ok).toBe(false);
    expect(ledger.cashOf(club.id)).toBe(1_000);
  });

  it('refuses to run more than the allowed number of projects at once', () => {
    const ledger = new Ledger();
    let club = makeClub({ id: 'c' });
    ledger.open(club.id, 50_000_000, POST);
    club = upgradeFacility(club, 'training_centre', testRegistry, ledger, POST).club!;
    club = upgradeFacility(club, 'medical', testRegistry, ledger, POST).club!;
    const third = upgradeFacility(club, 'academy', testRegistry, ledger, POST);
    expect(third.ok).toBe(false);
    expect(third.reason).toMatch(/Too many/);
  });

  it('will not go past the maximum level', () => {
    const club = makeClub({ id: 'c', facilityLevels: { training_centre: 5 } });
    const ledger = new Ledger();
    ledger.open(club.id, 50_000_000, POST);
    expect(upgradeFacility(club, 'training_centre', testRegistry, ledger, POST).ok).toBe(false);
    expect(nextUpgrade(club, 'training_centre', testRegistry)).toBeNull();
  });

  it('rushes for a premium and completes immediately', () => {
    const club = makeClub({ id: 'c' });
    const ledger = new Ledger();
    ledger.open(club.id, 50_000_000, POST);
    const normal = upgradeFacility(club, 'medical', testRegistry, ledger, POST);
    const rushed = upgradeFacility(club, 'medical', testRegistry, ledger, POST, { rush: true });
    expect(rushed.cost).toBeGreaterThan(normal.cost);
    expect(rushed.cycles).toBe(0);
    expect(rushed.club!.facilityLevels.medical).toBe(1);
  });
});

describe('upkeep', () => {
  it('charges every level the club owns, every cycle', () => {
    const club = makeClub({ id: 'c', facilityLevels: { training_centre: 3, medical: 2 } });
    const ledger = new Ledger();
    ledger.open(club.id, 1_000_000, POST);
    const result = advanceFacilities(club, testRegistry, ledger, POST, new Rng('upkeep'));
    expect(result.upkeepPaid).toBe(totalUpkeep(club, testRegistry));
    expect(result.upkeepPaid).toBeGreaterThan(0);
    expect(ledger.cashOf(club.id)).toBe(1_000_000 - result.upkeepPaid);
  });

  it('lets a facility decay when the club cannot afford to maintain it', () => {
    const club = makeClub({ id: 'c', facilityLevels: { training_centre: 5, medical: 5, academy: 5, stadium: 5 } });
    const ledger = new Ledger();
    ledger.open(club.id, 0, POST);
    let degraded = 0;
    for (let seed = 0; seed < 25; seed++) {
      const result = advanceFacilities(club, testRegistry, ledger, POST, new Rng(`decay-${seed}`));
      expect(result.upkeepUnpaid).toBeGreaterThan(0);
      degraded += result.degraded.length;
    }
    expect(degraded).toBeGreaterThan(0);
    expect(ledger.cashOf(club.id)).toBe(0);
  });
});
