import type { ClubId, FixtureId } from '../core/brand';
import type { GameState } from './state';
import type { MatchSetup, MatchTeam, MatchConfig, ManagerMatchBonus } from '../matches/simulator';
import type { Fixture } from '../league/types';
import { squadOf, clubTotalReach, arenaSupportShare } from './selectors';
import { counterPlanVsPlayer } from '../simulation/opponentModel';
import { rivalryFor } from '../rivalries/rivalries';
import { attendanceFor } from '../fans/fans';
import { Rng } from '../core/rng';
import { clamp } from '../core/math';
import type { CreatorSeasonConfigDef } from '../content';
import type { CommentaryLine } from '../content/schema';
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

/**
 * What an AI club brings to a match. Deterministic from the save seed, the
 * club and the season, so the same fixture always plays out the same way.
 *
 * Exported so the pre-match screen can show the same holdings the simulation
 * will actually use at fire time — derived once, in one place, or the preview
 * and the pitch quietly disagree.
 */
export function aiRuleCards(state: GameState, clubId: ClubId): SpecialRuleId[] {
  const club = state.clubs[clubId];
  if (!club) return [];
  const competition = state.competitions[state.currentCompetitionId];
  const pool = competition?.enabledSpecialRules ?? [];
  if (pool.length === 0) return [];

  const rng = new Rng(`${state.seed}:aicards:${clubId}:${state.clock.season}`);
  // A better-run club has more to deploy: one card as standard, two for the
  // upper half of the league by reputation.
  const count = club.reputation >= 55 ? 2 : 1;
  return rng.sample(pool, Math.min(count, pool.length));
}

const teamFor = (
  state: GameState,
  clubId: ClubId,
  isPlayerControlled: boolean,
  involvesPlayer: boolean,
): MatchTeam => {
  const club = state.clubs[clubId];
  if (!club) throw new Error(`Unknown club in match setup: ${clubId}`);
  // An AI side meeting the player opens with a lean aimed at the shape the
  // player has actually been playing — read from filed observations of matches
  // already played, never from the player's tactics screen. How much evidence
  // this manager needs before acting on it scales with their adaptability, so
  // a sharp opponent reads you weeks before a poor one does. AI-vs-AI keeps its
  // own identity.
  const counterLean = clubId !== state.playerClubId && involvesPlayer
    ? counterPlanVsPlayer(state, managerBonusFor(state, clubId).adaptability).lean
    : {};
  return {
    clubId,
    name: club.name,
    shortName: club.shortName,
    players: squadOf(state, clubId),
    tactics: { ...club.tactics, ...counterLean },
    managerBonus: managerBonusFor(state, clubId),
    creatorPresence: creatorPresenceFor(state, clubId),
    // Both sides hold cards.
    //
    // Only the player used to carry any, which was harmless while cards
    // measured at zero effect. Now that each one moves the result in the
    // direction its text claims, handing them to one side only is a standing
    // advantage the player did not earn. AI holdings are derived from the club
    // and the season rather than stored, so they cost no save state and a
    // stronger club reliably brings more to the table.
    ruleCards: isPlayerControlled
      ? state.inventory.ruleCards.filter((c) => c.quantity > 0).map((c) => c.ruleId)
      : aiRuleCards(state, clubId),
    isPlayerControlled,
  };
};

export interface BuildMatchSetupOptions {
  /** Live, player-controlled matches get decision prompts; simulated ones do not. */
  readonly live?: boolean;
  readonly maxDecisions?: number;
  /** Registry commentary for the live book; absent means the built-in bank. */
  readonly commentaryLines?: readonly CommentaryLine[];
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
    home: teamFor(state, fixture.homeClubId, live && fixture.homeClubId === playerClubId, involvesPlayer),
    away: teamFor(state, fixture.awayClubId, live && fixture.awayClubId === playerClubId, involvesPlayer),
    config: matchConfig,
    importance: fixture.importance,
    isDerby: fixture.isDerby,
    rivalryIntensity: rivalry?.intensity ?? 0,
    attendance,
    recentDecisionTriggers: state.decisionMemory.recentTriggers,
    // Every fixture is played at the league's single venue, so there is no home
    // advantage to model. The field carries the share of the arena backing the
    // nominal home side — derived from both clubs' creators and fans — which
    // the engine caps at a small swing.
    homeAdvantage: arenaSupportShare(state, fixture.homeClubId, fixture.awayClubId),
    neutralVenue: true,
    enabledSpecialRules: fixture.enabledSpecialRules as readonly SpecialRuleId[],
    tieBreak: fixture.stageLabel ? 'SHOOTOUT' : 'NONE',
    ...(opts.commentaryLines && opts.commentaryLines.length > 0
      ? { commentaryLines: opts.commentaryLines }
      : {}),
  };
}

export const fixtureById = (state: GameState, id: FixtureId): Fixture | undefined => state.fixtures[id];
