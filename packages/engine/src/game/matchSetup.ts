import type { ClubId, FixtureId } from '../core/brand';
import type { GameState } from './state';
import type { MatchSetup, MatchTeam, MatchConfig, ManagerMatchBonus } from '../matches/simulator';
import type { Fixture } from '../league/types';
import { squadOf, clubTotalReach } from './selectors';
import { rivalryFor } from '../rivalries/rivalries';
import { attendanceFor } from '../fans/fans';
import { Rng } from '../core/rng';
import { clamp } from '../core/math';
import type { CreatorSeasonConfigDef } from '../content';
import type { SpecialRuleId } from '../matches/specialRules';

/**
 * Translating game state into a match.
 *
 * This is the seam between the persistent world and the simulation. Everything
 * the match engine knows about a club — squad, tactics, manager, creator pull,
 * rivalry heat, crowd — is assembled here and nowhere else, so the simulator
 * never reaches into GameState and stays runnable from a plain fixture in tests
 * and in the balance harness.
 */

const managerBonusFor = (state: GameState, clubId: ClubId): ManagerMatchBonus => {
  const club = state.clubs[clubId];
  const manager = club?.managerId ? state.managers[club.managerId] : undefined;
  if (!manager) return { tactical: 50, motivation: 50, adaptability: 50, discipline: 50 };
  return {
    tactical: manager.attributes.tacticalKnowledge,
    motivation: manager.attributes.motivation,
    adaptability: manager.attributes.adaptability,
    discipline: manager.attributes.discipline,
  };
};

/**
 * How much the club's creators lift the occasion, 0-1.
 *
 * Deliberately compressed at the top: a club with ten million reach should feel
 * more electric than one with fifty thousand, but not ten times more, or reach
 * would become the only stat that matters.
 */
const creatorPresenceFor = (state: GameState, clubId: ClubId): number => {
  const reach = clubTotalReach(state, clubId);
  return clamp(Math.log10(Math.max(1, reach)) / 8, 0, 1);
};

const teamFor = (state: GameState, clubId: ClubId, isPlayerControlled: boolean): MatchTeam => {
  const club = state.clubs[clubId];
  if (!club) throw new Error(`Unknown club in match setup: ${clubId}`);
  return {
    clubId,
    name: club.name,
    shortName: club.shortName,
    players: squadOf(state, clubId),
    tactics: club.tactics,
    managerBonus: managerBonusFor(state, clubId),
    creatorPresence: creatorPresenceFor(state, clubId),
    ruleCards: isPlayerControlled
      ? state.inventory.ruleCards.filter((c) => c.quantity > 0).map((c) => c.ruleId)
      : [],
    isPlayerControlled,
  };
};

export interface BuildMatchSetupOptions {
  /** Live, player-controlled matches get decision prompts; simulated ones do not. */
  readonly live?: boolean;
  readonly maxDecisions?: number;
}

export function buildMatchSetup(
  state: GameState,
  fixture: Fixture,
  config: CreatorSeasonConfigDef,
  opts: BuildMatchSetupOptions = {},
): MatchSetup {
  const playerClubId = state.playerClubId;
  const involvesPlayer = fixture.homeClubId === playerClubId || fixture.awayClubId === playerClubId;
  const live = opts.live ?? false;

  const rivalry = rivalryFor(state, fixture.homeClubId, fixture.awayClubId);
  const homeClub = state.clubs[fixture.homeClubId];

  // Attendance is a real number the fans system produces, not a decoration:
  // it feeds atmosphere here and matchday revenue in the finance cycle.
  const attendance = homeClub
    ? attendanceFor(homeClub, fixture.importance, new Rng(`${state.seed}:att:${fixture.id}`))
    : 0;

  const matchConfig: MatchConfig = {
    minutes: config.matchMinutes,
    halves: config.halves,
    playersOnPitch: config.playersOnPitch,
    benchSize: config.benchSize,
    substitutions: config.substitutions,
    liveDecisions: live && involvesPlayer,
    maxDecisions: opts.maxDecisions ?? 4,
  };

  return {
    matchId: `match_${fixture.id}` as MatchSetup['matchId'],
    // Seeding from the save seed plus the fixture id means replaying a match
    // reproduces it exactly, and re-simulating a season is bit-for-bit stable.
    seed: `${state.seed}:match:${fixture.id}`,
    home: teamFor(state, fixture.homeClubId, live && fixture.homeClubId === playerClubId),
    away: teamFor(state, fixture.awayClubId, live && fixture.awayClubId === playerClubId),
    config: matchConfig,
    importance: fixture.importance,
    isDerby: fixture.isDerby,
    rivalryIntensity: rivalry?.intensity ?? 0,
    attendance,
    // Every fixture is played at the league's single venue, so there is no home
    // advantage to model. The field carries the share of the arena backing the
    // nominal home side, which the engine caps at a small swing.
    homeAdvantage: 0.5,
    neutralVenue: true,
    enabledSpecialRules: fixture.enabledSpecialRules as readonly SpecialRuleId[],
    tieBreak: fixture.stageLabel ? 'SHOOTOUT' : 'NONE',
  };
}

export const fixtureById = (state: GameState, id: FixtureId): Fixture | undefined => state.fixtures[id];
