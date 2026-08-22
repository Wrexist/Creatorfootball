import { describe, expect, it } from 'vitest';
import { Rng } from '../core/rng';
import { asId } from '../core/brand';
import type { ClubId, EventId, MatchId, PlayerId } from '../core/brand';
import type { GameState } from '../game/state';
import type { Ledger } from '../economy/ledger';
import { WORLD_BALANCE } from './balance';
import { BOARD_BALANCE } from '../progression/balance';
import { ULTIMATUM_OBJECTIVE_PREFIX, buildBoardUltimatum } from '../progression/board';
import { buildTestWorld, makeTestEvent, withFixture } from './fixtures';
import { squadCohesion, squadMoraleSpread, tickWorld, type WorldTickContext } from './worldTick';

const ctxFor = (ledger: Ledger, over: Partial<WorldTickContext> = {}): WorldTickContext => ({
  at: 1_700_000_000_000,
  ledger,
  registry: null,
  transferWindowOpen: true,
  ...over,
});

const redCard = makeTestEvent('RED_CARD', {
  playerId: 'p_0_5' as PlayerId, clubId: 'club_0' as ClubId, matchId: 'm1' as MatchId, minute: 22,
}, { id: 'ev_wt_red', importance: 4 });

describe('tickWorld determinism', () => {
  it('produces byte-identical output for the same seed and inputs', () => {
    const runOnce = (): { state: GameState; json: string } => {
      const world = buildTestWorld({ seed: 'determinism' });
      const result = tickWorld(world.state, new Rng('tick-seed'), ctxFor(world.ledger, { events: [redCard] }));
      return {
        state: result.state,
        json: JSON.stringify({
          events: result.events,
          stories: result.stories,
          posts: result.posts,
          aiActions: result.aiActions,
          summary: result.summary,
          players: result.state.players,
          clubs: result.state.clubs,
          rivalries: result.state.rivalries,
        }),
      };
    };
    const a = runOnce();
    const b = runOnce();
    expect(a.json).toBe(b.json);
  });

  it('diverges for a different seed', () => {
    const world1 = buildTestWorld({ seed: 'x' });
    const world2 = buildTestWorld({ seed: 'x' });
    const a = tickWorld(world1.state, new Rng('seed-a'), ctxFor(world1.ledger));
    const b = tickWorld(world2.state, new Rng('seed-b'), ctxFor(world2.ledger));
    expect(JSON.stringify(a.state.players)).not.toBe(JSON.stringify(b.state.players));
  });

  it('never mutates the state it was given', () => {
    const world = buildTestWorld();
    // The Ledger is an explicitly mutable service handed in through the context;
    // everything else in the state must come back untouched.
    const withoutLedger = (state: GameState): string => {
      const { ledger: _ledger, ...rest } = state;
      return JSON.stringify(rest);
    };
    const before = withoutLedger(world.state);
    tickWorld(world.state, new Rng('nomutate'), ctxFor(world.ledger, { events: [redCard] }));
    expect(withoutLedger(world.state)).toBe(before);
  });
});

describe('the world moves on its own', () => {
  it('evolves over a run of cycles with no player input', () => {
    const world = buildTestWorld({ clubCount: 8, seed: 'evolve' });
    let state = world.state;
    const totals = { transfers: 0, injuries: 0, developments: 0, promotions: 0, aiTurns: 0 };
    for (let cycle = 0; cycle < 14; cycle++) {
      const result = tickWorld(
        { ...state, clock: { ...state.clock, cycle: 10 + cycle } },
        new Rng(`cycle-${cycle}`),
        ctxFor(world.ledger),
      );
      state = result.state;
      totals.transfers += result.summary.transfersCompleted;
      totals.injuries += result.summary.injuries;
      totals.developments += result.summary.developments;
      totals.promotions += result.summary.promotions;
      totals.aiTurns += result.summary.aiTurns;
    }
    expect(totals.aiTurns).toBeGreaterThan(0);
    expect(totals.transfers + totals.injuries + totals.developments + totals.promotions).toBeGreaterThan(0);
    // Squads and the market both changed shape without the player doing anything.
    expect(JSON.stringify(state.players)).not.toBe(JSON.stringify(world.state.players));
  });

  it('keeps the AI workload linear in club count', () => {
    const small = buildTestWorld({ clubCount: 4, seed: 'lin' });
    const large = buildTestWorld({ clubCount: 12, seed: 'lin' });
    const a = tickWorld(small.state, new Rng('l'), ctxFor(small.ledger));
    const b = tickWorld(large.state, new Rng('l'), ctxFor(large.ledger));
    expect(a.summary.aiTurns).toBe(3);
    expect(b.summary.aiTurns).toBe(Math.min(11, WORLD_BALANCE.maxAiTurnsPerCycle));
  });

  it('moves AI money only through the ledger', () => {
    const world = buildTestWorld({ clubCount: 8, seed: 'money' });
    const openingCash = world.ledger.cashOf('club_1' as ClubId);
    let state = world.state;
    for (let cycle = 0; cycle < 8; cycle++) {
      state = tickWorld(
        { ...state, clock: { ...state.clock, cycle: 10 + cycle } },
        new Rng(`m-${cycle}`),
        ctxFor(world.ledger),
      ).state;
    }
    expect(world.ledger.verify()).toEqual([]);
    const spent = world.ledger.all().filter((tx) => tx.from.kind === 'club' && tx.from.clubId === 'club_1');
    if (world.ledger.cashOf('club_1' as ClubId) !== openingCash) {
      expect(spent.length).toBeGreaterThan(0);
    }
  });

  it('leaves the human club\'s players alone in AI transfers', () => {
    const world = buildTestWorld({ clubCount: 8, seed: 'protect' });
    const ourSquad = world.state.clubs[world.state.playerClubId]?.squad ?? [];
    let state = world.state;
    for (let cycle = 0; cycle < 10; cycle++) {
      state = tickWorld(
        { ...state, clock: { ...state.clock, cycle: 10 + cycle } },
        new Rng(`p-${cycle}`),
        ctxFor(world.ledger),
      ).state;
    }
    for (const id of ourSquad) {
      expect(state.players[id]?.clubId).toBe(world.state.playerClubId);
    }
  });
});

describe('the tick wires the cascade into state', () => {
  it('applies a red card all the way through to suspension, morale and fan mood', () => {
    const world = buildTestWorld({ seed: 'cascade-wire' });
    const before = world.state.players['p_0_5'];
    const clubBefore = world.state.clubs['club_0'];
    const result = tickWorld(world.state, new Rng('wire'), ctxFor(world.ledger, { events: [redCard] }));
    const after = result.state.players['p_0_5'];
    const clubAfter = result.state.clubs['club_0'];
    expect(after?.suspensionMatches).toBeGreaterThan(before?.suspensionMatches ?? 0);
    expect(after?.mental.morale).toBeLessThan(before?.mental.morale ?? 100);
    expect(clubAfter?.fans.sentiment).toBeLessThan(clubBefore?.fans.sentiment ?? 100);
    expect(result.stories.length).toBeGreaterThan(0);
    expect(result.posts.length).toBeGreaterThan(0);
    expect(result.state.media.stories.length).toBe(result.stories.length);
    expect(result.state.social.posts.length).toBe(result.posts.length);
  });

  it('publishes only stories that trace to an event in the journal', () => {
    const world = buildTestWorld({ seed: 'trace' });
    const result = tickWorld(world.state, new Rng('trace'), ctxFor(world.ledger, { events: [redCard] }));
    const known = new Set(result.state.eventLog.map((e) => e.id));
    for (const post of result.posts) {
      expect(known.has(asId<EventId>(post.relatedEventId ?? ''))).toBe(true);
    }
  });

  it('reports reach and moves followers', () => {
    const world = buildTestWorld({ seed: 'reach' });
    const win = makeTestEvent('MATCH_WON', {
      matchId: 'm2' as MatchId, clubId: 'club_0' as ClubId, opponentId: 'club_1' as ClubId,
      homeScore: 5, awayScore: 0, margin: 5,
    }, { id: 'ev_wt_win', importance: 4 });
    const result = tickWorld(world.state, new Rng('reach'), ctxFor(world.ledger, { events: [win] }));
    expect(result.summary.impressions).toBeGreaterThan(0);
    expect(result.state.social.weeklyImpressions).toBe(result.summary.impressions);
    expect(result.state.clubs['club_0']?.fans.onlineFollowers).not.toBe(world.state.clubs['club_0']?.fans.onlineFollowers);
  });

  it('bounds retained history', () => {
    const world = buildTestWorld({ clubCount: 8, seed: 'retain' });
    let state = world.state;
    for (let cycle = 0; cycle < 20; cycle++) {
      state = tickWorld(
        { ...state, clock: { ...state.clock, cycle: 10 + cycle } },
        new Rng(`r-${cycle}`),
        ctxFor(world.ledger, { events: [{ ...redCard, id: asId<EventId>(`ev_r_${cycle}`), cycle: 10 + cycle }] }),
      ).state;
    }
    expect(state.media.stories.length).toBeLessThanOrEqual(WORLD_BALANCE.retention.stories);
    expect(state.social.posts.length).toBeLessThanOrEqual(WORLD_BALANCE.retention.posts);
    expect(state.eventLog.length).toBeLessThanOrEqual(WORLD_BALANCE.retention.eventLog);
  });

  it('can skip content generation for fast-forwarding', () => {
    const world = buildTestWorld({ seed: 'skip' });
    const result = tickWorld(world.state, new Rng('skip'), ctxFor(world.ledger, { events: [redCard], skipContent: true }));
    expect(result.stories).toEqual([]);
    expect(result.posts).toEqual([]);
    expect(result.emergent).toEqual([]);
  });
});

/**
 * The board step. A crisis world is one where the player's club sits bottom
 * of a six-club league on terrible form with angry fans — deep enough into
 * the ladder that the mood derives as ULTIMATUM.
 */
describe('the board watches the player and acts', () => {
  const SPONSORED_DEALS = [
    { id: 'deal_d1', sponsorId: 'sp_1', name: 'ShirtCo', slot: 'SHIRT' as const, valuePerCycle: 100_000, weeksRemaining: 20, satisfaction: 70 },
    { id: 'deal_d2', sponsorId: 'sp_2', name: 'KitCo', slot: 'SLEEVE' as const, valuePerCycle: 40_000, weeksRemaining: 30, satisfaction: 55 },
  ];

  const crisisWorld = (): {
    readonly state: GameState;
    readonly ledger: Ledger;
  } => {
    const world = buildTestWorld({ clubCount: 6, seed: 'board-crisis' });
    let st = world.state;
    // Bottom of the table: zero points while everyone else collects some.
    const clubs = { ...st.clubs };
    for (const [id, club] of Object.entries(clubs)) {
      if (!club) continue;
      const won = id === st.playerClubId ? 0 : 6 + Number(id.split('_')[1] ?? 0);
      clubs[id] = { ...club, seasonRecord: { ...club.seasonRecord, played: 12, won, drawn: 0, lost: 12 - won, goalsFor: 6, goalsAgainst: 30 } };
    }
    st = { ...st, clubs };
    // Angry fans and a losing run.
    const club = st.clubs[st.playerClubId];
    if (club) {
      st = { ...st, clubs: { ...st.clubs, [club.id]: { ...club, fans: { ...club.fans, sentiment: 25 } } } };
    }
    for (let i = 0; i < 5; i++) {
      st = withFixture(st, {
        id: `fx_crisis_${i}`,
        week: 50 + i,
        home: st.playerClubId,
        away: 'club_5' as ClubId,
        homeScore: 0,
        awayScore: 3,
      });
    }
    // Commercial partners who can be wounded later.
    st = { ...st, sponsors: { available: [], active: SPONSORED_DEALS } };
    return { state: st, ledger: world.ledger };
  };

  it('issues a public ultimatum when the season becomes indefensible', () => {
    const { state, ledger } = crisisWorld();
    const result = tickWorld(state, new Rng('issue'), ctxFor(ledger));
    const issued = result.state.objectives.active.find((o) => o.id.startsWith(ULTIMATUM_OBJECTIVE_PREFIX));
    expect(issued).toBeTruthy();
    if (!issued) return;
    expect(issued.status).toBe('ACTIVE');
    expect(issued.target).toBe(BOARD_BALANCE.ultimatumTargetWins);
    expect(issued.expiresCycle).toBe(state.clock.cycle + BOARD_BALANCE.ultimatumWindowCycles);
    expect(result.state.boardPressure.lastUltimatumCycle).toBe(state.clock.cycle);
    expect(result.events.some((e) => e.type === 'BOARD_ULTIMATUM_ISSUED')).toBe(true);
    // Announced loudly enough that the feed reacts.
    const event = result.events.find((e) => e.type === 'BOARD_ULTIMATUM_ISSUED');
    expect(event?.importance).toBe(5);
  });

  it('does not issue twice while an ultimatum is live', () => {
    const { state, ledger } = crisisWorld();
    const first = tickWorld(state, new Rng('first'), ctxFor(ledger));
    // Advance the clock like the cycle would, keeping the objective live.
    const nextClock = { ...first.state.clock, cycle: first.state.clock.cycle + 1 };
    const second = tickWorld({ ...first.state, clock: nextClock }, new Rng('second'), ctxFor(ledger));
    const live = second.state.objectives.active.filter((o) => o.id.startsWith(ULTIMATUM_OBJECTIVE_PREFIX));
    expect(live.length).toBe(1);
  });

  it('announces a mood change when the ladder moves', () => {
    const { state, ledger } = crisisWorld();
    // Seed the journal with a prior announcement from a calmer week.
    const seeded: GameState = {
      ...state,
      eventLog: [
        makeTestEvent('BOARD_MOOD_CHANGED', { clubId: state.playerClubId, mood: 'RESTLESS', pressure: 25 }, { id: 'ev_prev_mood' }),
      ],
    };
    const result = tickWorld(seeded, new Rng('mood'), ctxFor(ledger));
    const changes = result.events.filter((e) => e.type === 'BOARD_MOOD_CHANGED');
    expect(changes.length).toBeGreaterThan(0);
    const last = changes.at(-1);
    if (!last) return;
    expect((last.payload as { mood: string }).mood).not.toBe('RESTLESS');
  });

  it('failing the ultimatum cuts wages, lists the best player and wounds sponsors', () => {
    const { state, ledger } = crisisWorld();
    const budgetBefore = state.clubs[state.playerClubId]?.finance.wageBudgetPerCycle ?? 0;
    // An ultimatum already out and just expired with no wins banked.
    const failedObjective = { ...buildBoardUltimatum(state), expiresCycle: state.clock.cycle, progress: 0 };
    const doomed: GameState = {
      ...state,
      objectives: { ...state.objectives, active: [failedObjective] },
    };
    const result = tickWorld(doomed, new Rng('fail'), ctxFor(ledger));
    const clubAfter = result.state.clubs[state.playerClubId];
    expect(clubAfter?.finance.wageBudgetPerCycle).toBeLessThan(budgetBefore);

    // The highest-value player is now on the market (values as of this tick,
    // since the world drifts them before the board acts).
    const listingIds = Object.keys(result.state.transfers.listings);
    expect(listingIds.length).toBeGreaterThan(0);
    const squadAfter = result.state.clubs[state.playerClubId]?.squad ?? [];
    let bestId: string | null = null;
    let bestValue = -1;
    for (const id of squadAfter) {
      const value = result.state.players[id]?.marketValue ?? 0;
      if (value > bestValue) {
        bestValue = value;
        bestId = id;
      }
    }
    expect(bestId).not.toBeNull();
    if (!bestId) return;
    const listed = result.state.transfers.listings[bestId];
    expect(listed).toBeTruthy();
    expect(listed?.askingPrice).toBe(Math.round(bestValue * BOARD_BALANCE.forcedListingPriceFactor));

    for (const deal of result.state.sponsors.active) {
      expect(deal.satisfaction).toBeLessThan(60); // below renewal willingness
    }

    expect(result.events.some((e) => e.type === 'BOARD_ULTIMATUM_FAILED')).toBe(true);
    // And the sanctions fire exactly once — the failed objective is gone.
    expect(result.state.objectives.active.some((o) => o.id.startsWith(ULTIMATUM_OBJECTIVE_PREFIX))).toBe(false);
  });
});

/**
 * `chemistry`, `teammateMorale` and `moraleResilience` were three trait
 * modifier keys read by no code anywhere in the repo, while being labelled on
 * the player profile screen — the product advertising effects that did not
 * exist. These are their consumers.
 */
describe('the dressing room reads the world trait keys', () => {
  const withTraits = (state: GameState, traitId: string | null): GameState => {
    const club = state.clubs[state.playerClubId];
    if (!club) throw new Error('fixture club missing');
    const players = { ...state.players };
    for (const player of Object.values(state.players)) {
      players[player.id] = {
        ...player,
        traitIds: player.clubId === club.id && traitId ? [traitId] : [],
      };
    }
    return { ...state, players };
  };

  const meanMorale = (state: GameState): number => {
    const club = state.clubs[state.playerClubId];
    const squad = (club?.squad ?? []).map((id) => state.players[id]).filter((p) => !!p);
    return squad.reduce((total, p) => total + (p?.mental.morale ?? 0), 0) / Math.max(1, squad.length);
  };

  const drift = (traitId: string | null, cycles: number, startMorale?: number): GameState => {
    const world = buildTestWorld();
    let state = withTraits(world.state, traitId);
    if (startMorale !== undefined) {
      const club = state.clubs[state.playerClubId];
      const players = { ...state.players };
      for (const id of club?.squad ?? []) {
        const player = players[id];
        if (player) players[id] = { ...player, mental: { ...player.mental, morale: startMorale } };
      }
      state = {
        ...state,
        players,
        clubs: {
          ...state.clubs,
          [state.playerClubId]: {
            ...club!,
            seasonRecord: { played: 10, won: 0, drawn: 0, lost: 10, goalsFor: 3, goalsAgainst: 28 },
          },
        },
      };
    }
    for (let i = 0; i < cycles; i++) {
      state = tickWorld(state, new Rng(`drift:${i}`), ctxFor(world.ledger, { skipContent: true })).state;
      state = { ...state, clock: { ...state.clock, cycle: state.clock.cycle + 1 } };
    }
    return state;
  };

  it('chemistry moves squad cohesion in both directions', () => {
    const cohesive = drift('team_player', 1);
    const fractious = drift('selfish', 1);
    const neutral = drift(null, 1);
    const club = (s: GameState) => s.clubs[s.playerClubId]!;
    expect(squadCohesion(club(cohesive), cohesive.players))
      .toBeGreaterThan(squadCohesion(club(neutral), neutral.players));
    expect(squadCohesion(club(fractious), fractious.players))
      .toBeLessThan(squadCohesion(club(neutral), neutral.players));
  });

  it('cohesion pulls form, which the match model reads', () => {
    const cohesive = drift('team_player', 8);
    const fractious = drift('selfish', 8);
    const meanForm = (s: GameState): number => {
      const squad = s.clubs[s.playerClubId]!.squad.map((id) => s.players[id]);
      return squad.reduce((t, p) => t + (p?.form.rating ?? 0), 0) / squad.length;
    };
    expect(meanForm(cohesive) - meanForm(fractious)).toBeGreaterThan(0.15);
  });

  it('teammateMorale raises the level the whole squad settles at', () => {
    const led = drift('leader', 10);
    const neutral = drift(null, 10);
    expect(squadMoraleSpread(led.clubs[led.playerClubId]!, led.players)).toBeGreaterThan(0);
    expect(meanMorale(led) - meanMorale(neutral)).toBeGreaterThan(5);
  });

  it('moraleResilience decides how far a bad run drags a player down', () => {
    const fragile = meanMorale(drift('glass_confidence', 8, 90));
    const neutral = meanMorale(drift(null, 8, 90));
    const resilient = meanMorale(drift('cult_hero', 8, 90));
    expect(fragile).toBeLessThan(neutral);
    expect(resilient).toBeGreaterThan(neutral);
    // Large enough that a player could notice it, not a rounding error.
    expect(resilient - fragile).toBeGreaterThan(8);
  });
});
