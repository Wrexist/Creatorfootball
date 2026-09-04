import { useMemo } from 'react';
import {
  BENCH_SIZE, aiRuleCards, arenaSupportShare, autoLineup, clubById, computeStandings, currentCompetition,
  formationById, injuredPlayers, leaguePosition, positionContext, recentForm, rivalryFor,
  selectMatchdayBench,
  squadOf, specialRuleById, standings, starPlayer, suspendedPlayers, topScorer,
  type BenchRole, type Club, type ClubId, type Fixture, type FixtureId, type Formation, type FormationSlot,
  type GameState, type Player, type Rivalry, type SpecialRuleDefinition, type SpecialRuleId,
  type StandingRow, type TacticSetup,
} from '@cf/engine';
import { useGameStore } from '@/state/gameStore';
import { ordinalWord } from '@/design/text';

/**
 * Everything matchday needs to know about a fixture, in one derivation.
 *
 * Rule of the workstream: a component may not work anything out for itself.
 * This module is the single place that reaches into `GameState`, and it does so
 * exclusively through engine selectors — including the table arithmetic behind
 * "win this and you go third", which is answered by re-running the engine's own
 * `computeStandings` over a hypothetical fixture list rather than by adding up
 * points in a component.
 */

export interface LineupSlot {
  readonly slot: FormationSlot;
  readonly player: Player | null;
}

export interface KeyBattle {
  readonly id: string;
  readonly headline: string;
  readonly ours: Player;
  readonly theirs: Player;
  readonly edge: 'US' | 'THEM' | 'EVEN';
}

export interface SideAvailability {
  readonly injured: readonly Player[];
  readonly suspended: readonly Player[];
}

export interface StakesLine {
  readonly kind: 'WIN' | 'DRAW' | 'LOSS';
  readonly text: string;
  readonly position: number;
}

export interface MatchdayContext {
  readonly fixture: Fixture;
  readonly home: Club;
  readonly away: Club;
  /** The club the player manages, and the one they are up against. */
  readonly us: Club;
  readonly them: Club;
  readonly playerIsHome: boolean;
  readonly competitionName: string;

  readonly ourForm: readonly ('W' | 'D' | 'L')[];
  readonly theirForm: readonly ('W' | 'D' | 'L')[];
  readonly ourRow: StandingRow | null;
  readonly theirRow: StandingRow | null;
  readonly table: readonly StandingRow[];
  /** clubId -> short name, so a table row never has to render a raw id. */
  readonly clubNames: Readonly<Record<string, string>>;
  readonly ourPosition: ReturnType<typeof leaguePosition>;

  readonly rivalry: Rivalry | null;
  readonly derbyHeat: number;

  readonly stakes: readonly StakesLine[];

  readonly formation: Formation;
  readonly lineup: readonly LineupSlot[];
  readonly bench: readonly Player[];
  /**
   * Why each man is on the bench, by player id, when the game chose it. Empty
   * when the manager named his own substitutes: the reason is then that he
   * picked them, and telling him otherwise would be the game taking credit.
   */
  readonly benchReasons: Readonly<Record<string, BenchRole>>;
  readonly keyBattles: readonly KeyBattle[];

  readonly ourAvailability: SideAvailability;
  readonly theirAvailability: SideAvailability;

  readonly ruleWindows: readonly SpecialRuleDefinition[];
  readonly heldCards: readonly { readonly definition: SpecialRuleDefinition; readonly quantity: number }[];
  /** What the opposition is carrying — derived exactly as the simulation derives it. */
  readonly theirHeldCards: readonly { readonly definition: SpecialRuleDefinition; readonly quantity: number }[];

  /** Share of the arena backing us, 0-1, from the engine's own selector. */
  readonly arenaShare: number;

  readonly ourStar: Player | null;
  readonly theirStar: Player | null;
  readonly theirTopScorer: Player | null;
}

/** Hypothetical table position after a given result. Answered by the engine. */
function projectPosition(
  state: GameState,
  fixture: Fixture,
  clubId: ClubId,
  outcome: 'WIN' | 'DRAW' | 'LOSS',
): number | null {
  const competition = currentCompetition(state);
  if (!competition) return null;

  const isHome = fixture.homeClubId === clubId;
  const winning = outcome === 'WIN';
  const drawing = outcome === 'DRAW';
  const ourGoals = drawing ? 1 : winning ? 1 : 0;
  const theirGoals = drawing ? 1 : winning ? 0 : 1;

  const hypothetical: Fixture = {
    ...fixture,
    status: 'COMPLETED',
    homeScore: isHome ? ourGoals : theirGoals,
    awayScore: isHome ? theirGoals : ourGoals,
  };

  const fixtures = Object.values(state.fixtures)
    .filter((f) => f.competitionId === competition.id && f.seasonId === state.currentSeasonId)
    .map((f) => (f.id === fixture.id ? hypothetical : f));

  const projected = computeStandings(competition.clubIds, fixtures, {
    playoffSpots: competition.playoffSpots,
    relegationSpots: competition.relegationSpots,
  });
  return positionContext(projected, clubId)?.position ?? null;
}

/** Below this the arena split is not worth a line — nobody sings about 55%. */
export const NOTABLE_ARENA_SHARE = 0.6;

export const arenaShareLine = (share: number): string | null =>
  share >= NOTABLE_ARENA_SHARE ? `${Math.round(share * 100)}% of the arena is in your colours.` : null;

function stakesFor(state: GameState, fixture: Fixture, clubId: ClubId): StakesLine[] {
  const current = leaguePosition(state, clubId)?.position ?? null;
  const lines: StakesLine[] = [];

  const win = projectPosition(state, fixture, clubId, 'WIN');
  if (win !== null) {
    lines.push({
      kind: 'WIN',
      position: win,
      text:
        current !== null && win < current
          ? `Win this and you go ${ordinalWord(win)}.`
          : `Win this and you hold ${ordinalWord(win)}.`,
    });
  }

  const draw = projectPosition(state, fixture, clubId, 'DRAW');
  if (draw !== null) {
    lines.push({ kind: 'DRAW', position: draw, text: `A draw leaves you ${ordinalWord(draw)}.` });
  }

  const loss = projectPosition(state, fixture, clubId, 'LOSS');
  if (loss !== null) {
    lines.push({
      kind: 'LOSS',
      position: loss,
      text:
        current !== null && loss > current
          ? `Lose and you drop to ${ordinalWord(loss)}.`
          : `Lose and you stay ${ordinalWord(loss)}.`,
    });
  }

  return lines;
}

/** Pairs our strongest attacker against their strongest defender, and so on. */
function buildKeyBattles(ourSquad: readonly Player[], theirSquad: readonly Player[]): KeyBattle[] {
  const best = (squad: readonly Player[], group: readonly string[]): Player | null => {
    const pool = squad.filter((p) => group.includes(p.position) && p.injury === null && p.suspensionMatches === 0);
    if (!pool.length) return null;
    return pool.reduce((a, b) => (b.overall > a.overall ? b : a));
  };

  const pairs: readonly {
    id: string; headline: string;
    ours: readonly string[]; theirs: readonly string[];
  }[] = [
    { id: 'attack', headline: 'Our attack vs their back line', ours: ['ST', 'LW', 'RW'], theirs: ['CB', 'LB', 'RB'] },
    { id: 'midfield', headline: 'The midfield battle', ours: ['CM', 'CDM', 'CAM'], theirs: ['CM', 'CDM', 'CAM'] },
    { id: 'defence', headline: 'Our back line vs their threat', ours: ['CB', 'LB', 'RB'], theirs: ['ST', 'LW', 'RW'] },
  ];

  const battles: KeyBattle[] = [];
  for (const pair of pairs) {
    const ours = best(ourSquad, pair.ours);
    const theirs = best(theirSquad, pair.theirs);
    if (!ours || !theirs) continue;
    const gap = ours.overall - theirs.overall;
    battles.push({
      id: pair.id,
      headline: pair.headline,
      ours,
      theirs,
      edge: gap >= 4 ? 'US' : gap <= -4 ? 'THEM' : 'EVEN',
    });
  }
  return battles;
}

/** A short football word for why a man is sitting down. */
export const BENCH_REASON_LABEL: Partial<Record<BenchRole, string>> = {
  KEEPER_COVER: 'Goalkeeper cover',
  DEFENSIVE_COVER: 'Defensive cover',
  MIDFIELD_COVER: 'Midfield cover',
  ATTACKING_COVER: 'Attacking option',
};

function resolveLineup(club: Club, squad: readonly Player[]): {
  formation: Formation; lineup: LineupSlot[]; bench: Player[]; benchReasons: Record<string, BenchRole>;
} {
  const available = squad.filter((p) => p.injury === null && p.suspensionMatches === 0);
  const tactics: TacticSetup = club.tactics;
  const formation = formationById(tactics.formationId);

  // A club whose lineup has never been set still deserves a believable
  // predicted eleven, so we fall back to the engine's own auto-selection
  // rather than showing empty slots.
  const hasLineup = Object.values(tactics.lineup).some((id) => id !== null);
  const effective = hasLineup ? tactics : autoLineup(available, formation);

  const byId = new Map(squad.map((p) => [p.id as string, p]));
  const picked = new Set<string>();
  const lineup: LineupSlot[] = formation.slots.map((slot) => {
    const playerId = effective.lineup[slot.id] ?? null;
    const player = playerId ? byId.get(playerId) ?? null : null;
    if (player) picked.add(player.id);
    return { slot, player };
  });

  // The bench the preview shows is the bench the simulator will play with:
  // the same selector, the same eleven in front of it, the same order. This
  // used to be the seven highest-rated reserves, which is a different question
  // and gave a different answer — a manager could study a bench on the preview
  // and find another one waiting when the whistle went.
  const starters = lineup
    .filter((entry): entry is { slot: FormationSlot; player: Player } => entry.player !== null)
    .map((entry) => ({ slot: entry.slot, player: entry.player }));
  const benchReasons: Record<string, BenchRole> = {};
  let bench: Player[];
  if (tactics.bench.length > 0) {
    bench = tactics.bench.map((id) => byId.get(id)).filter((p): p is Player => Boolean(p)).slice(0, BENCH_SIZE);
  } else {
    const seats = selectMatchdayBench(squad, starters, formation, { size: BENCH_SIZE, risk: tactics.risk });
    bench = seats.map((seat) => seat.player);
    for (const seat of seats) benchReasons[seat.player.id as string] = seat.role;
  }

  return { formation, lineup, bench, benchReasons };
}

export function buildMatchdayContext(state: GameState, fixtureId: FixtureId): MatchdayContext | null {
  const fixture = state.fixtures[fixtureId];
  if (!fixture) return null;

  const home = clubById(state, fixture.homeClubId);
  const away = clubById(state, fixture.awayClubId);
  if (!home || !away) return null;

  const playerIsHome = fixture.homeClubId === state.playerClubId;
  const us = playerIsHome ? home : away;
  const them = playerIsHome ? away : home;

  const table = standings(state);
  const ourSquad = squadOf(state, us.id);
  const theirSquad = squadOf(state, them.id);

  const rivalry = rivalryFor(state, home.id, away.id);
  const { formation, lineup, bench, benchReasons } = resolveLineup(us, ourSquad);

  const heldCards = state.inventory.ruleCards
    .filter((card) => card.quantity > 0)
    .map((card) => ({ definition: specialRuleById(card.ruleId), quantity: card.quantity }));

  // The opposition's holdings are never stored — the simulation derives them
  // deterministically at kick-off, so the preview derives them identically and
  // both hands agree when the whistle goes.
  const theirCounts = new Map<SpecialRuleId, number>();
  for (const id of aiRuleCards(state, them.id)) {
    theirCounts.set(id, (theirCounts.get(id) ?? 0) + 1);
  }
  const theirHeldCards = [...theirCounts]
    .map(([id, quantity]) => ({ definition: specialRuleById(id), quantity }));

  return {
    fixture,
    home,
    away,
    us,
    them,
    playerIsHome,
    competitionName: currentCompetition(state)?.name ?? 'League',

    ourForm: recentForm(state, us.id),
    theirForm: recentForm(state, them.id),
    ourRow: table.find((r) => r.clubId === us.id) ?? null,
    theirRow: table.find((r) => r.clubId === them.id) ?? null,
    table,
    clubNames: Object.fromEntries(
      Object.values(state.clubs).map((club) => [club.id as string, club.shortName]),
    ),
    ourPosition: leaguePosition(state, us.id),

    rivalry,
    derbyHeat: fixture.isDerby ? Math.max(rivalry?.intensity ?? 0, 50) : rivalry?.intensity ?? 0,

    stakes: stakesFor(state, fixture, us.id),

    formation,
    lineup,
    bench,
    benchReasons,
    keyBattles: buildKeyBattles(ourSquad, theirSquad),

    ourAvailability: {
      injured: injuredPlayers(state, us.id),
      suspended: suspendedPlayers(state, us.id),
    },
    theirAvailability: {
      injured: injuredPlayers(state, them.id),
      suspended: suspendedPlayers(state, them.id),
    },

    ruleWindows: (fixture.enabledSpecialRules as readonly SpecialRuleId[]).map(specialRuleById),
    heldCards,
    theirHeldCards,

    // The same figure the simulation feeds in as the crowd term, so the
    // flavour line on the preview and the walk-out cannot drift from it.
    arenaShare: arenaSupportShare(state, us.id, them.id),

    ourStar: starPlayer(state, us.id),
    theirStar: starPlayer(state, them.id),
    theirTopScorer: topScorer(state, them.id),
  };
}

/**
 * The hook every matchday screen starts from. Recomputed only when the game
 * state object identity changes — which, because state is immutable, is exactly
 * when something could have changed.
 */
export function useMatchdayContext(fixtureId: FixtureId | undefined): MatchdayContext | null {
  const state = useGameStore((s) => s.state);
  return useMemo(
    () => (state && fixtureId ? buildMatchdayContext(state, fixtureId) : null),
    [state, fixtureId],
  );
}
