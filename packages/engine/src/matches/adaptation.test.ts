import { describe, expect, it } from 'vitest';
import { Rng } from '../core/rng';
import { DEFAULT_TACTICS, type TacticSetup } from '../tactics/tactics';
import { toTacticVector } from '../tactics/vector';
import { counterThreshold } from '../simulation/opponentModel';
import { BALANCE } from './balance';
import type { MatchEvent } from './events';
import { MatchSimulator, simulateMatch, type MatchSetup } from './simulator';
import { makeTestSetup, makeTestTeam } from './testSupport';
import {
  MIN_SAMPLES, WINDOW, decideAdaptation, observeAttack, sampleOf,
  type AdaptationInput, type AttackSample,
} from './adaptation';

/**
 * Mid-match opponent adaptation.
 *
 * The other manager watches the shape the player's side keeps attacking in
 * and, with enough evidence and enough nous, makes one targeted change per
 * half. The decision is a pure function of what was observed, who is
 * deciding, and whether they have already moved this half — and of nothing
 * else. In particular the scoreline is not an input, by construction: see the
 * `@ts-expect-error` below.
 */

const tactics = (over: Partial<TacticSetup> = {}): TacticSetup => ({
  ...DEFAULT_TACTICS,
  formationId: '2-3-1',
  lineup: {},
  bench: [],
  captainId: null,
  setPieceTakerId: null,
  penaltyTakerId: null,
  ...over,
});

const PRESSING: AttackSample = { shape: 'HIGH_PRESS', focus: 'BALANCED' };
const SITTING: AttackSample = { shape: 'LOW_BLOCK', focus: 'BALANCED' };
const LEFT: AttackSample = { shape: 'BALANCED', focus: 'LEFT' };
const RIGHT: AttackSample = { shape: 'BALANCED', focus: 'RIGHT' };
const PLAIN: AttackSample = { shape: 'BALANCED', focus: 'BALANCED' };
const repeat = (sample: AttackSample, n: number): AttackSample[] => Array.from({ length: n }, () => sample);

const input = (over: Partial<AdaptationInput> = {}): AdaptationInput => ({
  observed: [],
  current: tactics(),
  adaptability: 80,
  changedShapeThisPeriod: false,
  adaptedThisPeriod: false,
  ...over,
});

const SHARP = 90;
const BLUNT = 10;

// --------------------------------------------------------------------------
// The decision, in isolation
// --------------------------------------------------------------------------

describe('adaptation decision', () => {
  it('fires once the same shape has been seen enough, for a manager sharp enough to read it', () => {
    const decision = decideAdaptation(input({ observed: repeat(PRESSING, 6), adaptability: SHARP }));
    expect(decision).not.toBeNull();
    expect(decision?.read).toBe('SHAPE');
    expect(decision?.pattern).toBe('HIGH_PRESS');
    // Invite the press on and go over it: the line drops, the ball goes long.
    expect(decision?.change.line).toBe('DEEP');
    expect(decision?.change.passing).toBe('DIRECT');
    expect(decision?.recap.length).toBeGreaterThan(0);
    expect(decision?.tag).toBe('adaptGoLong');
  });

  it('does not react to too little evidence', () => {
    expect(decideAdaptation(input({ observed: repeat(PRESSING, MIN_SAMPLES - 1), adaptability: SHARP }))).toBeNull();
    expect(decideAdaptation(input({ observed: [], adaptability: SHARP }))).toBeNull();
  });

  it('does not react to a mixed, ambiguous pattern', () => {
    const mixed: AttackSample[] = [PRESSING, SITTING, PLAIN, SITTING, PRESSING, PLAIN];
    expect(decideAdaptation(input({ observed: mixed, adaptability: SHARP }))).toBeNull();
    // A bare half is not a habit either: a plurality must not trigger a commitment.
    const half: AttackSample[] = [LEFT, LEFT, LEFT, RIGHT, RIGHT, RIGHT];
    expect(decideAdaptation(input({ observed: half, adaptability: SHARP }))).toBeNull();
  });

  it('leaves a balanced approach alone: there is nothing in it to attack', () => {
    expect(decideAdaptation(input({ observed: repeat(PLAIN, WINDOW), adaptability: SHARP }))).toBeNull();
  });

  it('needs more evidence the less adaptable the manager is', () => {
    // The minimum evidence is enough for a sharp manager and not for a blunt one.
    const minimum = repeat(PRESSING, MIN_SAMPLES);
    expect(decideAdaptation(input({ observed: minimum, adaptability: SHARP }))).not.toBeNull();
    expect(decideAdaptation(input({ observed: minimum, adaptability: BLUNT }))).toBeNull();
    // Less capable is not incapable: a full window of the same thing gets through
    // to anybody eventually.
    expect(decideAdaptation(input({ observed: repeat(PRESSING, WINDOW), adaptability: BLUNT }))).not.toBeNull();
    expect(counterThreshold(BLUNT)).toBeGreaterThan(counterThreshold(SHARP));
  });

  it('makes at most one move per half, and none if the side has already changed shape this half', () => {
    const strong = repeat(SITTING, WINDOW);
    expect(decideAdaptation(input({ observed: strong, adaptedThisPeriod: true }))).toBeNull();
    expect(decideAdaptation(input({ observed: strong, changedShapeThisPeriod: true }))).toBeNull();
    expect(decideAdaptation(input({ observed: strong }))).not.toBeNull();
  });

  it('answers one thing at a time: the shape first, the flank only when the shape gave nothing', () => {
    const both: AttackSample = { shape: 'HIGH_PRESS', focus: 'LEFT' };
    const shape = decideAdaptation(input({ observed: repeat(both, WINDOW), adaptability: SHARP }));
    expect(shape?.read).toBe('SHAPE');
    expect(shape?.change.marking).toBeUndefined();

    const flank = decideAdaptation(input({ observed: repeat(LEFT, WINDOW), adaptability: SHARP }));
    expect(flank?.read).toBe('FOCUS');
    expect(flank?.pattern).toBe('LEFT');
    expect(flank?.change.marking).toBe('MAN');
    expect(flank?.change.width).toBe('NARROW');
    expect(flank?.change.line).toBeUndefined();
    expect(flank?.tag).toBe('adaptFlank');
  });

  it('does nothing about a pattern it already came in set up to counter', () => {
    // The pre-match scouting report may already have brought the answer. The
    // in-match read then has nothing to add — and a side already set up that way
    // still gets to answer the *other* thing it sees.
    const answered = tactics({ line: 'DEEP', passing: 'DIRECT', buildUp: 'BYPASS', counter: 'ALWAYS', tempo: 'QUICK' });
    expect(decideAdaptation(input({ observed: repeat(PRESSING, WINDOW), current: answered, adaptability: SHARP }))).toBeNull();
    const both: AttackSample = { shape: 'HIGH_PRESS', focus: 'LEFT' };
    expect(decideAdaptation(input({ observed: repeat(both, WINDOW), current: answered, adaptability: SHARP }))?.read).toBe('FOCUS');
  });

  it('keeps the observation window bounded, and files what was actually played', () => {
    let log: readonly AttackSample[] = [];
    for (let i = 0; i < WINDOW * 3; i++) log = observeAttack(log, sampleOf(tactics({ press: 'HIGH_PRESS', focus: 'RIGHT' })));
    expect(log).toHaveLength(WINDOW);
    expect(log[0]).toEqual({ shape: 'HIGH_PRESS', focus: 'RIGHT' });
    expect(sampleOf(tactics({ line: 'DEEP' })).shape).toBe('LOW_BLOCK');
  });

  it('cannot be told the score', () => {
    // The scoreline is not merely ignored, it is not representable. A future
    // author cannot add "and if we are losing" without changing this type.
    const bad: AdaptationInput = {
      ...input(),
      // @ts-expect-error - the score is deliberately not an input to adaptation
      scoreFor: 0,
    };
    expect(decideAdaptation(bad)).toBeNull();
  });
});

// --------------------------------------------------------------------------
// The targeted response, against the model's own arithmetic
// --------------------------------------------------------------------------

const ctx = { squadQuality: 65, managerTactical: 60 };

describe('the response is targeted, not a buff', () => {
  it('sitting off a high press buys counters and costs the ball', () => {
    const before = toTacticVector(tactics(), ctx);
    const answer = decideAdaptation(input({ observed: repeat(PRESSING, 6), adaptability: SHARP }));
    const after = toTacticVector(tactics(answer?.change), ctx);

    expect(after.counterWeight).toBeGreaterThan(before.counterWeight);
    expect(after.spaceBehind).toBeLessThan(before.spaceBehind);
    // Not free: they see less of the ball and the chances they make are worse.
    expect(after.possessionBias).toBeLessThan(before.possessionBias);
    expect(after.chanceQuality).toBeLessThan(before.chanceQuality);
  });

  it('pressing a low block stretches it and leaves space behind to be run into', () => {
    const before = toTacticVector(tactics(), ctx);
    const answer = decideAdaptation(input({ observed: repeat(SITTING, 6), adaptability: SHARP }));
    const after = toTacticVector(tactics(answer?.change), ctx);

    expect(after.aggression).toBeGreaterThan(before.aggression);
    expect(after.widthBias).toBeGreaterThan(before.widthBias);
    // Not free: a high line is a high line, and the block behind it is thinner.
    expect(after.spaceBehind).toBeGreaterThan(before.spaceBehind);
    expect(after.defensiveSolidity).toBeLessThan(before.defensiveSolidity);
  });

  it('crowding a flank narrows the shape and costs discipline and legs', () => {
    const before = toTacticVector(tactics(), ctx);
    const answer = decideAdaptation(input({ observed: repeat(LEFT, 6), adaptability: SHARP }));
    const after = toTacticVector(tactics(answer?.change), ctx);

    expect(after.widthBias).toBeLessThan(before.widthBias);
    expect(after.pressRecovery).toBeGreaterThan(before.pressRecovery);
    expect(after.foulRate).toBeGreaterThan(before.foulRate);
    expect(after.fatigueRate).toBeGreaterThan(before.fatigueRate);
  });
});

// --------------------------------------------------------------------------
// Inside a real match
// --------------------------------------------------------------------------

const ADAPTATIONS = (events: readonly MatchEvent[]): MatchEvent[] =>
  events.filter((e) => e.type === 'TACTICAL_CHANGE' && e.detail?.['trigger'] === 'AI_ADAPTATION');

/**
 * Every attack ends in exactly one SHOT, and that event carries the shape the
 * opposition logged for it — so the SHOTs before an adaptation *are* the window
 * the other bench was looking at, reconstructed from the replay alone.
 */
const attacks = (events: readonly MatchEvent[], side: 'home' | 'away'): MatchEvent[] =>
  events.filter((e) => e.side === side && e.type === 'SHOT');

/** The attacks the bench had seen when it moved: everything before the event, in replay order. */
const windowBefore = (events: readonly MatchEvent[], a: MatchEvent, side: 'home' | 'away'): MatchEvent[] =>
  attacks(events.slice(0, events.indexOf(a)), side).slice(-WINDOW);

/**
 * A player side that presses high all match, against an AI side set up
 * plainly with a manager sharp enough to notice. The player is at home, so
 * the AI is the visitor.
 */
function pressFixture(seed: string, over: { adaptability?: number; adaptation?: boolean; focus?: TacticSetup['focus'] } = {}): MatchSetup {
  const rng = new Rng(seed);
  const home = makeTestTeam(rng, { prefix: `${seed}h`, name: 'Northside', target: 70 });
  const away = makeTestTeam(rng, { prefix: `${seed}a`, name: 'Southgate', target: 64 });
  return makeTestSetup({
    seed,
    home: {
      ...home,
      isPlayerControlled: true,
      tactics: { ...home.tactics, press: 'HIGH_PRESS', line: 'HIGH', focus: over.focus ?? 'BALANCED' },
    },
    away: {
      ...away,
      isPlayerControlled: false,
      managerBonus: { ...away.managerBonus, adaptability: over.adaptability ?? SHARP },
    },
    config: { maxDecisions: 0, ...(over.adaptation === undefined ? {} : { adaptation: over.adaptation }) },
  });
}

const SEEDS = ['adapt-a', 'adapt-b', 'adapt-c', 'adapt-d', 'adapt-e', 'adapt-f', 'adapt-g', 'adapt-h', 'adapt-i', 'adapt-j'];

describe('adaptation inside a match', () => {
  it('fires for a sharp manager against a side that keeps pressing, and says so in football', () => {
    const fired = SEEDS.filter((seed) => ADAPTATIONS(simulateMatch(pressFixture(seed)).events).length > 0);
    expect(fired.length, `fired in ${fired.length} of ${SEEDS.length}`).toBe(SEEDS.length);

    const one = ADAPTATIONS(simulateMatch(pressFixture(fired[0] as string)).events)[0] as MatchEvent;
    expect(one.side).toBe('away');
    expect(one.detail?.['read']).toBe('SHAPE');
    expect(one.detail?.['pattern']).toBe('HIGH_PRESS');
    expect(String(one.detail?.['recap'])).toMatch(/press/i);
    // The feed line is the football, never the mechanism.
    expect(one.text).toMatch(/press|long|over the top|space|runners/i);
    expect(one.text).not.toMatch(/adapt|activated|pattern|counter plan/i);
    // And not in the first minute: the evidence had to be played first.
    expect(one.minute).toBeGreaterThanOrEqual(5);
  });

  it('reads a flank the same way, and crowds it', () => {
    const rng = new Rng('flank');
    const home = makeTestTeam(rng, { prefix: 'flankh', name: 'Northside', target: 70 });
    const away = makeTestTeam(rng, { prefix: 'flanka', name: 'Southgate', target: 64 });
    const r = simulateMatch(makeTestSetup({
      seed: 'flank',
      home: { ...home, isPlayerControlled: true, tactics: { ...home.tactics, focus: 'RIGHT' } },
      away: { ...away, isPlayerControlled: false, managerBonus: { ...away.managerBonus, adaptability: SHARP } },
      config: { maxDecisions: 0 },
    }));
    const one = ADAPTATIONS(r.events)[0] as MatchEvent;
    expect(one).toBeDefined();
    expect(one.detail?.['read']).toBe('FOCUS');
    expect(one.detail?.['pattern']).toBe('RIGHT');
    expect(one.text).toMatch(/flank|side|wide|runners|touch/i);
    expect(String(one.detail?.['recap'])).toMatch(/right/i);
  });

  it('is deterministic: same setup, same adaptation, same match, stepped or whole', () => {
    const setup = pressFixture('adapt-a');
    const a = simulateMatch(setup);
    const b = simulateMatch(setup);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));

    const sim = new MatchSimulator(setup);
    let guard = 0;
    while (!sim.isComplete && guard++ < 5000) sim.step();
    expect(JSON.stringify(sim.result().events)).toBe(JSON.stringify(a.events));
    expect(ADAPTATIONS(a.events).map((e) => [e.tick, e.detail?.['pattern']]))
      .toEqual(ADAPTATIONS(sim.result().events).map((e) => [e.tick, e.detail?.['pattern']]));
  });

  it('never fires more than once per half for a side', () => {
    for (const seed of SEEDS) {
      const r = simulateMatch(pressFixture(seed));
      const half = r.events.find((e) => e.type === 'HALFTIME')?.tick ?? Number.POSITIVE_INFINITY;
      const first = ADAPTATIONS(r.events).filter((e) => e.tick <= half && e.side === 'away').length;
      const second = ADAPTATIONS(r.events).filter((e) => e.tick > half && e.side === 'away').length;
      expect(first, `${seed} first half`).toBeLessThanOrEqual(1);
      expect(second, `${seed} second half`).toBeLessThanOrEqual(1);
    }
  });

  it('only reacts to behaviour it has actually watched: enough attacks, mostly in that shape, precede it', () => {
    let checked = 0;
    for (const seed of SEEDS) {
      const r = simulateMatch(pressFixture(seed));
      for (const a of ADAPTATIONS(r.events)) {
        const before = attacks(r.events.slice(0, r.events.indexOf(a)), 'home');
        expect(before.length, seed).toBeGreaterThanOrEqual(MIN_SAMPLES);
        const window = windowBefore(r.events, a, 'home');
        const matching = window.filter((e) => e.detail?.['shape'] === a.detail?.['pattern']).length;
        expect(matching / window.length, `${seed}: majority of the window was that shape`).toBeGreaterThan(0.5);
        expect(a.detail?.['matching']).toBe(matching);
        expect(a.detail?.['samples']).toBe(window.length);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('does not counter a change the player has only just made', () => {
    // Play to a point before any adaptation, have the player change approach,
    // and require that whatever follows was earned under the new setup: at
    // least the minimum number of attacks after the change precede any answer
    // to it, and the window at that moment is mostly the new shape. A change
    // is invisible until it has been played.
    const setup = pressFixture('adapt-a');
    const sim = new MatchSimulator(setup);
    const seen: MatchEvent[] = [];
    const changeAt = 3 * BALANCE.TICKS_PER_MINUTE;
    let guard = 0;
    while (!sim.isComplete && guard++ < changeAt) seen.push(...sim.step());
    expect(ADAPTATIONS(seen)).toHaveLength(0);

    sim.applyTacticalChange('home', { press: 'LOW_BLOCK', line: 'DEEP' });
    const changeIndex = seen.length;

    guard = 0;
    while (!sim.isComplete && guard++ < 5000) seen.push(...sim.step());
    const answers = ADAPTATIONS(seen.slice(changeIndex)).filter((e) => e.detail?.['pattern'] === 'LOW_BLOCK');
    expect(answers.length).toBeGreaterThan(0);
    for (const a of answers) {
      const since = attacks(seen.slice(changeIndex, seen.indexOf(a)), 'home');
      expect(since.length).toBeGreaterThanOrEqual(MIN_SAMPLES);
      const window = windowBefore(seen, a, 'home');
      expect(window.filter((e) => e.detail?.['shape'] === 'LOW_BLOCK').length / window.length).toBeGreaterThan(0.5);
    }
    // And the old read was not answered after it stopped being true.
    expect(ADAPTATIONS(seen.slice(changeIndex)).filter((e) => e.detail?.['pattern'] === 'HIGH_PRESS')).toHaveLength(0);
  });

  it('a blunt manager reads the same match later, or not at all', () => {
    let sharpFirst = 0; let bluntFirst = 0; let bluntNever = 0; let compared = 0;
    for (const seed of SEEDS) {
      const sharp = ADAPTATIONS(simulateMatch(pressFixture(seed, { adaptability: SHARP })).events)[0];
      const blunt = ADAPTATIONS(simulateMatch(pressFixture(seed, { adaptability: BLUNT })).events)[0];
      if (!sharp) continue;
      compared += 1;
      if (!blunt) { bluntNever += 1; continue; }
      if (sharp.tick <= blunt.tick) sharpFirst += 1; else bluntFirst += 1;
    }
    expect(compared).toBeGreaterThan(0);
    expect(bluntFirst).toBe(0);
    expect(sharpFirst + bluntNever).toBe(compared);
  });

  it('changes exactly what it said it would, and nothing before it fired', () => {
    let seen = 0;
    for (const seed of SEEDS) {
      const on = simulateMatch(pressFixture(seed, { adaptation: true }));
      const off = simulateMatch(pressFixture(seed, { adaptation: false }));
      const a = ADAPTATIONS(on.events)[0];
      if (!a) continue;
      seen += 1;
      expect(ADAPTATIONS(off.events)).toHaveLength(0);
      // Identical up to the moment of the change: the decision consumed no
      // randomness and altered nothing before it fired.
      const upTo = (evs: readonly MatchEvent[]) =>
        JSON.stringify(evs.filter((e) => e.tick < a.tick).map((e) => [e.tick, e.type, e.playerId ?? null]));
      expect(upTo(off.events)).toBe(upTo(on.events));
    }
    expect(seen).toBe(SEEDS.length);

    // The change on the pitch is the counter plan's lean, applied to the
    // adapting side only, and the other side's tactics are untouched.
    const setup = pressFixture('adapt-a');
    const sim = new MatchSimulator(setup);
    const events: MatchEvent[] = [];
    let guard = 0;
    while (!sim.isComplete && guard++ < 5000 && ADAPTATIONS(events).length === 0) events.push(...sim.step());
    const a = ADAPTATIONS(events)[0] as MatchEvent;
    expect(a.side).toBe('away');
    expect(a.detail?.['pattern']).toBe('HIGH_PRESS');
    expect(a.detail?.['changes']).toBe('line=DEEP passing=DIRECT buildUp=BYPASS counter=ALWAYS tempo=QUICK');
    // The player's side was never touched, and it is still attacking in the
    // shape it chose: the next attack files as a high press, not as anything else.
    expect(events.filter((e) => e.type === 'TACTICAL_CHANGE' && e.side === 'home')).toHaveLength(0);
    const next: MatchEvent[] = [];
    guard = 0;
    while (!sim.isComplete && guard++ < 5000 && attacks(next, 'home').length === 0) next.push(...sim.step());
    expect(attacks(next, 'home')[0]?.detail?.['shape']).toBe('HIGH_PRESS');
  });

  it('is not triggered by the scoreline: a losing side with nothing to read never adapts', () => {
    // A heavy home favourite in a plain, balanced shape: the visitors trail all
    // evening and get their one scripted scoreline response, but there is no
    // pattern for them to answer, so they never "adapt".
    let homeGoals = 0; let awayGoals = 0; let trailingResponses = 0;
    for (const seed of SEEDS) {
      const rng = new Rng(seed);
      const home = makeTestTeam(rng, { prefix: `${seed}h`, name: 'Northside', target: 82 });
      const away = makeTestTeam(rng, { prefix: `${seed}a`, name: 'Southgate', target: 50 });
      const r = simulateMatch(makeTestSetup({
        seed: `score-${seed}`,
        home: { ...home, isPlayerControlled: true },
        away: { ...away, isPlayerControlled: false, managerBonus: { ...away.managerBonus, adaptability: SHARP } },
        config: { maxDecisions: 0 },
      }));
      homeGoals += r.homeScore; awayGoals += r.awayScore;
      trailingResponses += r.events.filter((e) => e.detail?.['trigger'] === 'AI_TRAILING_RESPONSE').length;
      expect(ADAPTATIONS(r.events), seed).toHaveLength(0);
    }
    expect(homeGoals).toBeGreaterThan(awayGoals);
    expect(trailingResponses).toBeGreaterThan(0);
  });
});
