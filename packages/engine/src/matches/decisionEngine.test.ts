import { describe, expect, it } from 'vitest';
import { asId } from '../core/brand';
import type { MatchId } from '../core/brand';
import { Rng } from '../core/rng';
import { BALANCE } from './balance';
import { DECISION_RECIPE_COUNT, DecisionEngine, evaluateDecisions } from './decisionEngine';
import type { DecisionSituation, XgTimeline } from './decisionEngine';
import type { DecisionOutcome } from './decisions';
import type { Side } from './events';

const matchId = asId<MatchId>('m1');

const situation = (over: Partial<DecisionSituation> = {}): DecisionSituation => ({
  minute: 10, tick: 100, side: 'home', matchId, scoreFor: 0, scoreAgainst: 1,
  momentum: -0.6, possessionShare: 0.45, fatigue: 0.3, tiredPlayerName: null,
  bookedPlayerName: null, injuredNoSubs: false, minutesToWindow: null, atHalfTime: false,
  opponentChanged: false, creatorMoment: false, elapsedFraction: 0.33,
  opponentName: 'Southgate', ...over,
});

const engine = (max = 3): DecisionEngine => new DecisionEngine(new Rng('d'), {
  matchId, maxDecisions: max, matchMinutes: 30, sides: ['home'], adaptability: 60,
});

describe('prompt generation', () => {
  it('ships a table of distinct triggers', () => {
    expect(DECISION_RECIPE_COUNT).toBeGreaterThanOrEqual(10);
  });

  it('fires when the match is genuinely asking a question', () => {
    const prompt = engine().consider(situation());
    expect(prompt).not.toBeNull();
    expect(prompt?.situation.length).toBeGreaterThan(20);
    expect(prompt?.options.length).toBeGreaterThanOrEqual(2);
    expect(prompt?.options.length).toBeLessThanOrEqual(3);
    expect(prompt?.defaultOptionId).toBe(prompt?.options[0]?.id);
  });

  it('stays silent when nothing is happening', () => {
    const quiet = situation({
      momentum: 0.05, scoreFor: 1, scoreAgainst: 1, possessionShare: 0.5,
      elapsedFraction: 0.3, fatigue: 0.1,
    });
    expect(engine().consider(quiet)).toBeNull();
  });

  it('never issues two prompts within the cooldown', () => {
    const e = engine();
    expect(e.consider(situation({ minute: 10 }))).not.toBeNull();
    for (let m = 11; m < 10 + BALANCE.DECISION_COOLDOWN_MINUTES; m++) {
      expect(e.consider(situation({ minute: m }))).toBeNull();
    }
    expect(e.consider(situation({ minute: 10 + BALANCE.DECISION_COOLDOWN_MINUTES }))).not.toBeNull();
  });

  it('respects the cap', () => {
    const e = engine(2);
    let issued = 0;
    for (let m = 5; m < 28; m++) {
      if (e.consider(situation({ minute: m, elapsedFraction: m / 30 }))) issued += 1;
    }
    expect(issued).toBe(2);
  });

  it('ignores a side it is not managing', () => {
    expect(engine().consider(situation({ side: 'away' }))).toBeNull();
  });

  it('does not interrupt in the opening or closing sliver of the match', () => {
    expect(engine().consider(situation({ minute: 1, elapsedFraction: 0.03 }))).toBeNull();
    expect(engine().consider(situation({ minute: 29, elapsedFraction: 0.98 }))).toBeNull();
  });

  it('gives every option a real downside encoded in its modifiers', () => {
    const seen = new Set<string>();
    const cases: Partial<DecisionSituation>[] = [
      {}, { scoreFor: 2, scoreAgainst: 0, elapsedFraction: 0.8, momentum: 0.1 },
      { tiredPlayerName: 'K. Moro', fatigue: 0.6, elapsedFraction: 0.6, momentum: 0 },
      { possessionShare: 0.3, momentum: 0 }, { bookedPlayerName: 'A. Falk', momentum: 0 },
      { injuredNoSubs: true }, { minutesToWindow: 1 }, { momentum: 0.7 },
      { opponentChanged: true, momentum: 0 }, { atHalfTime: true, elapsedFraction: 0.5 },
      { creatorMoment: true, momentum: 0 },
      { possessionShare: 0.6, momentum: 0, scoreFor: 0, scoreAgainst: 0 },
    ];
    for (let i = 0; i < cases.length; i++) {
      const e = engine(99);
      const prompt = e.consider(situation({ ...cases[i], minute: 10 + i * 20 }));
      if (!prompt) continue;
      seen.add(prompt.trigger);
      for (const option of prompt.options) {
        const values = Object.values(option.modifiers);
        expect(values.length, `${prompt.trigger}/${option.id} has no modifiers`).toBeGreaterThan(0);
        const negatives = values.filter((v) => v < 0).length;
        const positives = values.filter((v) => v > 0).length;
        // Some downsides are expressed as a positive on a cost term (fatigue,
        // fouls, volatility, space behind), so accept either shape but never
        // an option that is purely upside.
        const costKeys = ['fatigueRate', 'foulRate', 'volatility', 'spaceBehind'];
        const hasCost = negatives > 0 || Object.entries(option.modifiers).some(([k, v]) => costKeys.includes(k) && v > 0);
        expect(hasCost, `${prompt.trigger}/${option.id} is pure upside`).toBe(true);
        expect(positives + negatives).toBeGreaterThanOrEqual(2);
        expect(option.effect.length).toBeGreaterThan(15);
        expect(['LOW', 'MEDIUM', 'HIGH']).toContain(option.risk);
        expect(option.durationMinutes).toBeGreaterThan(0);
      }
    }
    expect(seen.size).toBeGreaterThanOrEqual(8);
  });

  it('dilutes an instruction for a limited manager without flipping its sign', () => {
    const sharp = new DecisionEngine(new Rng('s'), { matchId, maxDecisions: 3, matchMinutes: 30, sides: ['home'], adaptability: 95 });
    const blunt = new DecisionEngine(new Rng('s'), { matchId, maxDecisions: 3, matchMinutes: 30, sides: ['home'], adaptability: 10 });
    const mods = { attackVolume: 0.3, defensiveSolidity: -0.2 };
    const a = sharp.scaleModifiers(mods);
    const b = blunt.scaleModifiers(mods);
    expect(a['attackVolume'] as number).toBeGreaterThan(b['attackVolume'] as number);
    expect(a['defensiveSolidity'] as number).toBeLessThan(b['defensiveSolidity'] as number);
    expect(Math.sign(b['defensiveSolidity'] as number)).toBe(-1);
  });
});

describe('post-match evaluation', () => {
  const flat = (v: number): number[] => Array.from({ length: 30 }, () => v);
  const timelines = (forSide: number[], against: number[]): Record<Side, XgTimeline> => ({
    home: { forSide, against },
    away: { forSide: flat(0), against: flat(0) },
  });
  const outcome: DecisionOutcome = { promptId: 'p1', optionId: 'o1', minute: 15 };

  it('says it worked when the side created more and conceded less afterwards', () => {
    const forSide = flat(0.1).map((v, i) => (i >= 15 ? 0.4 : v));
    const result = evaluateDecisions([outcome], timelines(forSide, flat(0.2)), () => 'home', 30);
    expect(result[0]?.evaluation?.verdict).toBe('WORKED');
    expect(result[0]?.evaluation?.xgDelta as number).toBeGreaterThan(0);
  });

  it('says it backfired when the other end lit up instead', () => {
    const against = flat(0.1).map((v, i) => (i >= 15 ? 0.5 : v));
    const result = evaluateDecisions([outcome], timelines(flat(0.2), against), () => 'home', 30);
    expect(result[0]?.evaluation?.verdict).toBe('BACKFIRED');
    expect(result[0]?.evaluation?.xgAgainstDelta as number).toBeGreaterThan(0);
  });

  it('says nothing much happened rather than inventing a verdict', () => {
    const result = evaluateDecisions([outcome], timelines(flat(0.2), flat(0.2)), () => 'home', 30);
    expect(result[0]?.evaluation?.verdict).toBe('NEUTRAL');
  });

  it('keeps the prompt and option it is grading', () => {
    const result = evaluateDecisions([outcome], timelines(flat(0.2), flat(0.2)), () => 'home', 30);
    expect(result[0]?.promptId).toBe('p1');
    expect(result[0]?.optionId).toBe('o1');
    expect(result[0]?.minute).toBe(15);
  });
});
