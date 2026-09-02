import { describe, expect, it } from 'vitest';
import { Rng } from '../core/rng';
import { MatchSimulator, simulateMatch } from './simulator';
import { makeTestSetup, makeTestTeam } from './testSupport';

/**
 * Substitutions, as the manager experiences them.
 *
 * A real player was shown "5 changes left", tapped their goalkeeper, tapped a
 * keeper on the bench, and was told the change was not allowed and to check
 * their remaining substitutions. Three things were wrong at once: the sheet
 * listed the whole squad as "the bench" while the simulator had its own seven,
 * the count was a number the interface made up and kept, and the simulator
 * answered every refusal with the same `false`. These tests pin the contract
 * that fixes all three: the simulator says exactly why a change is refused,
 * exposes the bench and the count it actually uses, and a legal goalkeeper
 * change goes through.
 */

function fixture(seed: string, extra: Partial<Parameters<typeof makeTestSetup>[0]> = {}) {
  const rng = new Rng(seed);
  const home = makeTestTeam(rng, { prefix: `${seed}h`, name: 'Northside', target: 66, isPlayerControlled: true });
  const away = makeTestTeam(rng, { prefix: `${seed}a`, name: 'Southgate', target: 62 });
  return makeTestSetup({ seed, home, away, config: { maxDecisions: 0 }, ...extra });
}

/** Step to a minute, resolving any prompt with the engine's own default. */
function playTo(sim: MatchSimulator, minute: number): void {
  let guard = 0;
  while (!sim.isComplete && sim.minute() < minute && guard++ < 5000) {
    sim.step();
    const prompt = sim.pendingDecision();
    if (prompt) sim.resolveDecision(prompt.id, prompt.defaultOptionId);
  }
}

const keeperOnPitch = (sim: MatchSimulator, side: 'home' | 'away') => {
  const status = sim.substitutionStatus(side);
  const setup = sim.setup;
  const team = side === 'home' ? setup.home : setup.away;
  const onPitch = new Set(sim.frame().players.filter((p) => p.side === side).map((p) => p.playerId));
  const gk = team.players.find((p) => onPitch.has(p.id) && p.position === 'GK');
  const benchGk = status.bench.find((seat) => team.players.find((p) => p.id === seat.playerId)?.position === 'GK');
  return { gk, benchGk, status, team };
};

describe('goalkeeper substitutions', () => {
  it('TEST A: a legal goalkeeper change is allowed, and says so', () => {
    const sim = new MatchSimulator(fixture('gk-ok'));
    playTo(sim, 5);
    const { gk, benchGk, status } = keeperOnPitch(sim, 'home');
    expect(gk).toBeDefined();
    expect(benchGk).toBeDefined();
    expect(status.remaining).toBeGreaterThan(0);

    const verdict = sim.checkSubstitution('home', gk!.id, benchGk!.playerId);
    expect(verdict).toEqual({ ok: true });
    expect(sim.makeSubstitution('home', gk!.id, benchGk!.playerId)).toBe(true);
  });

  it('TEST B: with no substitutions left the refusal is about the count, and only then', () => {
    const sim = new MatchSimulator(fixture('gk-none', { config: { maxDecisions: 0, substitutions: 0 } }));
    playTo(sim, 5);
    const { gk, benchGk } = keeperOnPitch(sim, 'home');
    expect(sim.checkSubstitution('home', gk!.id, benchGk!.playerId)).toEqual({ ok: false, reason: 'NO_SUBS_LEFT' });
    expect(sim.makeSubstitution('home', gk!.id, benchGk!.playerId)).toBe(false);
    expect(sim.substitutionStatus('home')).toMatchObject({ used: 0, allowed: 0, remaining: 0 });
  });

  it('TEST C: an invalid incoming player is refused for its own reason, never "check your substitutions"', () => {
    const sim = new MatchSimulator(fixture('gk-bad-in'));
    playTo(sim, 5);
    const { gk, benchGk, status, team } = keeperOnPitch(sim, 'home');
    const onPitch = new Set(sim.frame().players.filter((p) => p.side === 'home').map((p) => p.playerId));
    // Somebody who is on neither the pitch nor this side's bench: a name from
    // the club's wider squad, here stood in by the opposition's squad, since
    // the test squads are exactly a pitch and a bench deep.
    const outsider = sim.setup.away.players[0]!;
    void team;
    expect(sim.checkSubstitution('home', gk!.id, outsider.id)).toEqual({ ok: false, reason: 'NOT_ON_BENCH' });
    expect(status.remaining).toBeGreaterThan(0);

    // A player already on the pitch cannot come on.
    const other = [...onPitch].find((id) => id !== gk!.id)!;
    expect(sim.checkSubstitution('home', gk!.id, other)).toEqual({ ok: false, reason: 'NOT_ON_BENCH' });
    // Somebody not on the pitch cannot come off.
    const otherSeat = status.bench.find((s) => s.playerId !== benchGk!.playerId)!;
    expect(sim.checkSubstitution('home', benchGk!.playerId, otherSeat.playerId)).toEqual({ ok: false, reason: 'NOT_ON_PITCH' });
    // And a man cannot replace himself.
    expect(sim.checkSubstitution('home', gk!.id, gk!.id)).toEqual({ ok: false, reason: 'SAME_PLAYER' });
    // The same man twice: the second attempt finds him used, not "no subs left".
    expect(sim.makeSubstitution('home', gk!.id, benchGk!.playerId)).toBe(true);
    expect(sim.checkSubstitution('home', gk!.id, benchGk!.playerId)).toEqual({ ok: false, reason: 'NOT_ON_PITCH' });
    // The keeper who came off has been used; the one who came on is now on the pitch.
    const another = sim.frame().players.find((p) => p.side === 'home' && p.playerId !== benchGk!.playerId)!;
    expect(sim.checkSubstitution('home', another.playerId, gk!.id)).toEqual({ ok: false, reason: 'ALREADY_USED' });
    expect(sim.checkSubstitution('home', another.playerId, benchGk!.playerId)).toEqual({ ok: false, reason: 'NOT_ON_BENCH' });
  });

  it('TEST D: a goalkeeper change updates the pitch, the count and the bench', () => {
    const sim = new MatchSimulator(fixture('gk-state'));
    playTo(sim, 5);
    const { gk, benchGk } = keeperOnPitch(sim, 'home');
    const before = sim.substitutionStatus('home');
    const events = sim.step();
    void events;
    expect(sim.makeSubstitution('home', gk!.id, benchGk!.playerId)).toBe(true);

    const frameIds = sim.frame().players.filter((p) => p.side === 'home').map((p) => p.playerId);
    expect(frameIds).toContain(benchGk!.playerId);
    expect(frameIds).not.toContain(gk!.id);
    expect(frameIds).toHaveLength(7);
    expect(new Set(frameIds).size).toBe(7);

    const after = sim.substitutionStatus('home');
    expect(after.used).toBe(before.used + 1);
    expect(after.remaining).toBe(before.remaining - 1);
    expect(after.bench.find((s) => s.playerId === benchGk!.playerId)).toBeUndefined();
    expect(after.bench.length).toBe(before.bench.length - 1);

    // The next tick carries the change into the events the feed shows.
    const later = sim.step();
    const sub = [...events, ...later].find((e) => e.type === 'SUBSTITUTION' && e.side === 'home');
    expect(sub?.playerId).toBe(gk!.id);
    expect(sub?.secondaryPlayerId).toBe(benchGk!.playerId);
  });
});

describe('the count the interface shows is the simulator\'s', () => {
  it('a live human side keeps its substitutions for the human: the engine spends none on fatigue', () => {
    const setup = fixture('human-live', { config: { maxDecisions: 0, liveDecisions: true } });
    const sim = new MatchSimulator(setup);
    playTo(sim, 999);
    const r = sim.result();
    const injured = new Set(r.events.filter((e) => e.type === 'INJURY' && e.side === 'home').map((e) => e.playerId));
    const subs = r.events.filter((e) => e.type === 'SUBSTITUTION' && e.side === 'home');
    // Every change the engine made for the human was an injury replacement.
    for (const s of subs) expect(s.playerId !== undefined && injured.has(s.playerId)).toBe(true);
    expect(sim.substitutionStatus('home').used).toBe(subs.length);
    // The AI opponent still manages its own tired legs.
    const awaySubs = r.events.filter((e) => e.type === 'SUBSTITUTION' && e.side === 'away');
    expect(sim.substitutionStatus('away').used).toBe(awaySubs.length);
  });

  it('a simulated fixture is unchanged: the engine still manages both benches when nobody is watching', () => {
    const a = simulateMatch(fixture('sim-unchanged'));
    const b = simulateMatch(fixture('sim-unchanged'));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('the bench the status reports is the bench the simulator will accept', () => {
    const sim = new MatchSimulator(fixture('bench-truth'));
    playTo(sim, 3);
    const status = sim.substitutionStatus('home');
    const anyOut = sim.frame().players.find((p) => p.side === 'home')!.playerId;
    for (const seat of status.bench) {
      const verdict = sim.checkSubstitution('home', anyOut, seat.playerId);
      expect(verdict.ok).toBe(seat.available);
    }
    expect(status.bench.length).toBeGreaterThan(0);
    expect(status.bench.length).toBeLessThanOrEqual(sim.setup.config.benchSize);
  });
});
