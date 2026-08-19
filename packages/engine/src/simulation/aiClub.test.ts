import { describe, expect, it } from 'vitest';
import { Rng } from '../core/rng';
import type { ClubId } from '../core/brand';
import type { GameState, TransferListing } from '../game/state';
import type { Player } from '../players/player';
import type { Position } from '../players/positions';
import { positionGroup } from '../players/positions';
import { emptyAttributes } from '../players/attributes';
import { AI_PROFILES, aiClubTurn, profileFor, type AiActions } from './aiClub';
import { buildTestWorld, makeTestPlayer } from './fixtures';

const MARKET_POSITIONS: readonly Position[] = ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LW', 'RW', 'ST'];

/** A market wide enough that every profile can find what it is looking for. */
function withMarket(state: GameState, count = 60): GameState {
  const players = { ...state.players };
  const listings: Record<string, TransferListing> = { ...state.transfers.listings };
  for (let i = 0; i < count; i++) {
    const age = 17 + (i % 18);
    const overall = 56 + ((i * 7) % 26);
    const position = MARKET_POSITIONS[i % MARKET_POSITIONS.length] as Position;
    const id = `mkt_${i}`;
    const player: Player = makeTestPlayer(id, {
      age,
      position,
      attributes: emptyAttributes(overall),
      potential: Math.min(95, overall + (age <= 21 ? 16 : age <= 26 ? 6 : 0)),
      marketValue: 400_000 + overall * 120_000,
      clubId: null,
    });
    players[id] = player;
    listings[id] = {
      playerId: player.id,
      clubId: null,
      askingPrice: Math.round(player.marketValue * 1.2),
      wageDemand: Math.round(player.marketValue * 0.0012),
      availability: 'AVAILABLE',
      interestedClubIds: [],
      listedCycle: 0,
    };
  }
  return { ...state, players, transfers: { ...state.transfers, listings } };
}

/** Play out a season of turns and collect every intent the profile produced. */
function seasonOfTurns(state: GameState, clubId: ClubId, cycles = 24): AiActions[] {
  const out: AiActions[] = [];
  for (let cycle = 1; cycle <= cycles; cycle++) {
    out.push(aiClubTurn(state, clubId, new Rng(`season-${cycle}`), {
      cycle,
      season: 1,
      leaguePosition: 4,
      clubCount: 8,
      transferWindowOpen: true,
    }));
  }
  return out;
}

interface ProfileStats {
  readonly targets: number;
  readonly meanAge: number;
  readonly meanFee: number;
  readonly defensiveShare: number;
  readonly attackingShare: number;
  readonly youthPromotions: number;
}

function statsFor(state: GameState, clubId: ClubId): ProfileStats {
  const actions = seasonOfTurns(state, clubId);
  const targets = actions.flatMap((a) => a.transferTargets);
  const players = targets.map((t) => state.players[t.playerId]).filter((p): p is Player => !!p);
  const mean = (xs: readonly number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const groups = players.map((p) => positionGroup(p.position));
  return {
    targets: targets.length,
    meanAge: mean(players.map((p) => p.age)),
    meanFee: mean(targets.map((t) => t.maxFee)),
    defensiveShare: groups.length ? groups.filter((g) => g === 'GK' || g === 'DEF').length / groups.length : 0,
    attackingShare: groups.length ? groups.filter((g) => g === 'ATT').length / groups.length : 0,
    youthPromotions: actions.reduce((total, a) => total + a.youthPromotions.length, 0),
  };
}

describe('AI profiles', () => {
  const { state: base } = buildTestWorld({ clubCount: 8 });
  const state = withMarket(base);
  const byProfile = new Map<string, ProfileStats>();
  for (let i = 0; i < 8; i++) {
    const clubId = `club_${i}` as ClubId;
    const club = state.clubs[clubId];
    if (!club) continue;
    byProfile.set(profileFor(club).id, statsFor(state, clubId));
  }

  it('covers all eight strategies', () => {
    expect(AI_PROFILES).toHaveLength(8);
    expect(new Set(AI_PROFILES.map((p) => p.id)).size).toBe(8);
    expect(byProfile.size).toBe(8);
  });

  it('has every profile actually acting in the market', () => {
    for (const [id, stats] of byProfile) {
      expect(stats.targets, `${id} produced no targets`).toBeGreaterThan(0);
    }
  });

  it('recruits at visibly different ages', () => {
    const youth = byProfile.get('YOUTH_FACTORY');
    const veterans = byProfile.get('VETERAN_CORE');
    expect(youth && veterans).toBeTruthy();
    if (!youth || !veterans) return;
    expect(veterans.meanAge - youth.meanAge).toBeGreaterThan(3);
  });

  it('spends at visibly different levels', () => {
    const spenders = byProfile.get('BIG_SPENDERS');
    const underdog = byProfile.get('LOCAL_UNDERDOG');
    expect(spenders && underdog).toBeTruthy();
    if (!spenders || !underdog) return;
    expect(spenders.meanFee).toBeGreaterThan(underdog.meanFee);
  });

  it('recruits for visibly different shapes', () => {
    const defensive = byProfile.get('DEFENSIVE_SPECIALISTS');
    const showtime = byProfile.get('SHOWTIME');
    expect(defensive && showtime).toBeTruthy();
    if (!defensive || !showtime) return;
    expect(defensive.defensiveShare).toBeGreaterThan(showtime.defensiveShare);
    expect(showtime.attackingShare).toBeGreaterThan(defensive.attackingShare);
  });

  it('trusts the academy at visibly different rates', () => {
    const youth = byProfile.get('YOUTH_FACTORY');
    const spenders = byProfile.get('BIG_SPENDERS');
    expect(youth && spenders).toBeTruthy();
    if (!youth || !spenders) return;
    expect(youth.youthPromotions).toBeGreaterThan(spenders.youthPromotions);
  });
});

describe('aiClubTurn', () => {
  const { state: base } = buildTestWorld({ clubCount: 4 });
  const state = withMarket(base, 20);

  it('is deterministic for a fixed seed', () => {
    const a = aiClubTurn(state, 'club_1' as ClubId, new Rng('fixed'), { cycle: 3, season: 1 });
    const b = aiClubTurn(state, 'club_1' as ClubId, new Rng('fixed'), { cycle: 3, season: 1 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('never mutates the state it is given', () => {
    const before = JSON.stringify(state);
    aiClubTurn(state, 'club_2' as ClubId, new Rng('nomutate'), { cycle: 4, season: 1 });
    expect(JSON.stringify(state)).toBe(before);
  });

  it('reacts to league position by loosening the budget', () => {
    const safe = aiClubTurn(state, 'club_1' as ClubId, new Rng('pos'), { cycle: 5, season: 1, leaguePosition: 1, clubCount: 8 });
    const desperate = aiClubTurn(state, 'club_1' as ClubId, new Rng('pos'), { cycle: 5, season: 1, leaguePosition: 8, clubCount: 8 });
    expect(desperate.budgetPlan.transferSpend).toBeGreaterThan(safe.budgetPlan.transferSpend);
  });

  it('returns an empty plan for a club that does not exist', () => {
    const missing = aiClubTurn(state, 'club_nope' as ClubId, new Rng('x'), { cycle: 1, season: 1 });
    expect(missing.transferTargets).toEqual([]);
    expect(missing.notes).toContain('club not found');
  });

  it('always writes a narrative line for the rumour feed', () => {
    for (let i = 0; i < 4; i++) {
      const actions = aiClubTurn(state, `club_${i}` as ClubId, new Rng(`n${i}`), { cycle: 2, season: 1 });
      expect(actions.narrative.length).toBeGreaterThan(10);
    }
  });

  it('offers only players it can theoretically afford', () => {
    const actions = aiClubTurn(state, 'club_3' as ClubId, new Rng('afford'), { cycle: 6, season: 1 });
    for (const target of actions.transferTargets) {
      expect(target.maxFee).toBeLessThanOrEqual(actions.budgetPlan.transferSpend);
      expect(target.playerId).toBeTruthy();
    }
  });
});

describe('profile resolution', () => {
  it('falls back to philosophy when the id is unknown', () => {
    const { state } = buildTestWorld({ clubCount: 2 });
    const club = state.clubs['club_0'];
    expect(club).toBeDefined();
    if (!club) return;
    const resolved = profileFor({ ...club, aiProfileId: 'not_a_profile' });
    expect(resolved.philosophy).toBe(club.philosophy);
  });
});
