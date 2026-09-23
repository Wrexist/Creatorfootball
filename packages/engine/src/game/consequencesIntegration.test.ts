import { describe, expect, it } from 'vitest';
import { createNewGame } from './newGame';
import { advanceCycle } from './cycle';
import { buildMatchSetup } from './matchSetup';
import { simulateMatch } from '../matches/simulator';
import { BASE_PACK, ContentRegistry, type CreatorSeasonConfigDef } from '../content';
import { Ledger } from '../economy/ledger';
import { creatorInterest, signCreator, payCreatorRetainers, advanceCreatorRelations } from '../creators/campaigns';
import { Rng } from '../core/rng';
import { settlePoll } from '../social/community';
import { withSocialWorld, socialWorld, type FanPoll } from '../social/worldState';
import { tickSocialWorld } from '../social/socialTick';
import { assignScout } from '../transfers/scouting';
import type { EventId } from '../core/brand';

const career = () => createNewGame({ seed: 'real-consequences', now: 1000,
  manager: { kind: 'PREMADE', templateId: BASE_PACK.data.managers![0]!.id },
  club: { kind: 'TEMPLATE', templateId: BASE_PACK.data.clubs![0]!.id },
});

describe('consequences in real careers', () => {
  it('pays appearances and reconciles all cash, including social rewards and contract liabilities', () => {
    let state = career();
    const club = state.clubs[state.playerClubId]!;
    const contracts = { ...state.contracts };
    for (const id of club.squad) {
      const cid = state.players[id]!.contractId;
      if (cid) contracts[cid] = { ...contracts[cid]!, bonuses: { ...contracts[cid]!.bonuses, appearance: 1234 } };
    }
    state = { ...state, contracts };
    const before = Ledger.restore(state.ledger).cashOf(club.id);
    const week = advanceCycle(state, { now: 2000 });
    const txs = week.state.ledger.transactions.filter(t => t.kind === 'PERFORMANCE_BONUS');
    expect(txs.length).toBeGreaterThan(0);
    expect(txs.every(t => t.amount >= 1234)).toBe(true);
    expect(Ledger.restore(week.state.ledger).cashOf(club.id) - before).toBe(week.summary.income - week.summary.expenditure);
    expect(week.state.clubs[club.id]!.finance.lastCycleExpenditure).toBe(week.summary.expenditure);
  });

  it('counts unused bench minutes toward role promises, with no minutes for injured players', () => {
    const state = career(), club = state.clubs[state.playerClubId]!;
    const fixture = Object.values(state.fixtures).find(f => f.week === 1 && (f.homeClubId === club.id || f.awayClubId === club.id))!;
    const result = simulateMatch(buildMatchSetup(state, fixture, BASE_PACK.data.seasonConfig as CreatorSeasonConfigDef));
    const unused = club.squad.find(id => !result.playerStats[id] && !state.players[id]!.injury)!;
    expect(unused).toBeDefined();
    const next = advanceCycle(state, { now: 2000, playerResult: result }).state;
    const contract = next.contracts[next.players[unused]!.contractId!]!;
    expect(contract.minutesAvailable).toBeGreaterThan(0);
    expect(contract.minutesPlayed).toBe(0);
  });

  it('charges the agreed creator retainer once and releases an expired association', () => {
    let state = career();
    const ledger = Ledger.restore(state.ledger);
    ledger.credit(state.playerClubId, 'GRANT', 100_000_000, 'Test funding', { cycle: 0, season: 1, at: 1000 });
    state = { ...state, ledger: ledger.snapshot() };
    const interest = creatorInterest(state).find(i => i.available)!;
    expect(interest).toBeDefined();
    const signed = signCreator(state, { creatorId: interest.creator.id, at: 1100 });
    expect(signed.ok).toBe(true);
    const paying = Ledger.restore(signed.state.ledger), before = paying.cashOf(state.playerClubId);
    payCreatorRetainers(signed.state, paying, 1200);
    payCreatorRetainers(signed.state, paying, 1200);
    expect(before - paying.cashOf(state.playerClubId)).toBe(interest.retainerPerCycle);
    const lastWeek = { ...signed.state, creators: { ...signed.state.creators,
      [interest.creator.id]: { ...signed.state.creators[interest.creator.id]!, dealWeeksRemaining: 1 } } };
    const expired = advanceCreatorRelations(lastWeek, new Rng('expiry'), 2000).state;
    expect(expired.creators[interest.creator.id]!.clubId).toBeNull();
    expect(expired.clubs[state.playerClubId]!.creatorIds).not.toContain(interest.creator.id);
  });

  it('applies a captain poll once and refuses to reward an unavailable winner', () => {
    const state = career(), club = state.clubs[state.playerClubId]!, id = club.squad[1]!;
    const poll: FanPoll = { id: 'captain-test', topic: 'The armband', question: 'Captain?',
      eventId: 'ev_poll' as EventId, offeredCycle: 0, closesCycle: 0, status: 'CLOSED', winnerId: `opt_${id}`,
      options: [{ id: `opt_${id}`, label: 'Captain', commitment: 'Captain' }] };
    const input = withSocialWorld(state, { polls: [poll] });
    const result = settlePoll(input, { pollId: poll.id, honour: true, at: 2000 });
    expect(result.ok).toBe(true);
    expect(result.state.clubs[club.id]!.tactics.captainId).toBe(id);
    expect(settlePoll(result.state, { pollId: poll.id, honour: true, at: 2001 }).ok).toBe(false);
    const gone = { ...input, players: { ...input.players, [id]: { ...input.players[id]!, clubId: null } } };
    expect(settlePoll(gone, { pollId: poll.id, honour: true, at: 2000 }).ok).toBe(false);
  });

  it('settles a fixture-bound promise in its matchweek and ignores other results', () => {
    const state = career(), clubId = state.playerClubId;
    const fixture = Object.values(state.fixtures).find(f => f.week === 1 && (f.homeClubId === clubId || f.awayClubId === clubId))!;
    const waiting = withSocialWorld(state, { stakes: [{ id: 'fixture-promise', kind: 'GUARANTEE',
      eventId: 'ev_stake' as EventId, openedCycle: 0, settleAfterCycle: 0, tone: 'HYPE', stake: 1, claim: 'We will win', fixtureId: fixture.id }] });
    expect(tickSocialWorld(waiting, { at: 2000 }).settled).toHaveLength(0);
    const completed = { ...waiting, fixtures: { ...waiting.fixtures, [fixture.id]: { ...fixture, status: 'COMPLETED' as const,
      homeScore: fixture.homeClubId === clubId ? 2 : 0, awayScore: fixture.awayClubId === clubId ? 2 : 0 } } };
    const result = tickSocialWorld(completed, { at: 2000 });
    expect(result.settled[0]?.outcome).toBe('VINDICATED');
    expect(socialWorld(result.state).stakes).toHaveLength(0);
  });

  it('redeems a scout credit without cash and leaves it unspent for a rejected assignment', () => {
    const state = career(), registry = new ContentRegistry(); registry.load(BASE_PACK);
    const credited = { ...state, inventory: { ...state.inventory, scoutCredits: 1 } };
    const player = Object.values(state.players).find(p => p.clubId !== state.playerClubId)!;
    const ledger = Ledger.restore(state.ledger), before = ledger.cashOf(state.playerClubId);
    const args = { clubId: state.playerClubId, playerId: player.id, depth: 'DEEP' as const };
    const result = assignScout(credited, args, registry, ledger, { cycle: 0, season: 1, at: 1000 });
    expect(result.ok).toBe(true); expect(result.creditsUsed).toBe(1); expect(result.cost).toBe(0);
    expect(ledger.cashOf(state.playerClubId)).toBe(before);
    const duplicate = assignScout({ ...credited, scouting: result.scouting! }, args, registry, ledger, { cycle: 0, season: 1, at: 1001 });
    expect(duplicate.ok).toBe(false); expect(duplicate.creditsUsed ?? 0).toBe(0);
  });
});
