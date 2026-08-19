import { useMemo } from 'react';
import {
  autoLineup, clubById, computeStandings, currentCompetition, formationById, injuredPlayers,
  leaguePosition, positionContext, recentForm, rivalryFor, squadOf, standings, starPlayer,
  suspendedPlayers, topScorer,
  type Club, type ClubId, type Fixture, type FixtureId, type Formation, type FormationSlot,
  type GameState, type Player, type Rivalry, type SpecialRuleDefinition, type SpecialRuleId,
  type StandingRow, type TacticSetup,
  specialRuleById,
} from '@cf/engine';
import { useGameStore } from '@/state/gameStore';

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
  readonly keyBattles: readonly KeyBattle[];

  readonly ourAvailability: SideAvailability;
  readonly theirAvailability: SideAvailability;

  readonly ruleWindows: readonly SpecialRuleDefinition[];
  readonly heldCards: readonly { readonly definition: SpecialRuleDefinition; readonly quantity: number }[];

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

const ORDINALS = [
  '', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth',
  'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth',
] as const;

const ordinal = (n: number): string => ORDINALS[n] ?? `${n}th`;

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
          ? `Win this and you go ${ordinal(win)}.`
          : `Win this and you hold ${ordinal(win)}.`,
    });
  }

  const draw = projectPosition(state, fixture, clubId, 'DRAW');
  if (draw !== null) {
    lines.push({ kind: 'DRAW', position: draw, text: `A draw leaves you ${ordinal(draw)}.` });
  }

  const loss = projectPosition(state, fixture, clubId, 'LOSS');
  if (loss !== null) {
    lines.push({
      kind: 'LOSS',
      position: loss,
      text:
        current !== null && loss > current
          ? `Lose and you drop to ${ordinal(loss)}.`
          : `Lose and you stay ${ordinal(loss)}.`,
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

function resolveLineup(club: Club, squad: readonly Player[]): {
  formation: Formation; lineup: LineupSlot[]; bench: Player[];
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

  const bench = available
    .filter((p) => !picked.has(p.id))
    .sort((a, b) => b.overall - a.overall)
    .slice(0, 7);

  return { formation, lineup, bench };
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
  const { formation, lineup, bench } = resolveLineup(us, ourSquad);

  const heldCards = state.inventory.ruleCards
    .filter((card) => card.quantity > 0)
    .map((card) => ({ definition: specialRuleById(card.ruleId), quantity: card.quantity }));

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
