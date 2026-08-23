import type { ClubId, PlayerId } from '../core/brand';
import type { GameState } from './state';
import type { Club } from '../clubs/club';
import type { Player } from '../players/player';
import type { Contract } from '../contracts/contract';
import type { Fixture, StandingRow } from '../league/types';
import { computeStandings, positionContext } from '../league/standings';
import { isAvailable } from '../players/player';
import { mean } from '../core/math';

/**
 * Derived reads over GameState.
 *
 * Selectors are the only sanctioned way for the UI to compute anything from
 * state. Keeping them in the engine means the same derivation feeds the React
 * app, the headless balance harness and any future server, and it keeps
 * calculation out of components where it would silently re-run every render.
 */

export const playerClub = (s: GameState): Club => {
  const club = s.clubs[s.playerClubId];
  if (!club) throw new Error('Player club missing from state');
  return club;
};

export const clubById = (s: GameState, id: ClubId): Club | undefined => s.clubs[id];

export const playerById = (s: GameState, id: PlayerId): Player | undefined => s.players[id];

export const squadOf = (s: GameState, clubId: ClubId): Player[] => {
  const club = s.clubs[clubId];
  if (!club) return [];
  return club.squad.map((id) => s.players[id]).filter((p): p is Player => Boolean(p));
};

export const youthOf = (s: GameState, clubId: ClubId): Player[] => {
  const club = s.clubs[clubId];
  if (!club) return [];
  return club.youthSquad.map((id) => s.players[id]).filter((p): p is Player => Boolean(p));
};

export const availableSquad = (s: GameState, clubId: ClubId): Player[] =>
  squadOf(s, clubId).filter(isAvailable);

export const contractFor = (s: GameState, playerId: PlayerId): Contract | undefined => {
  const player = s.players[playerId];
  if (!player?.contractId) return undefined;
  return s.contracts[player.contractId];
};

export const squadWageBill = (s: GameState, clubId: ClubId): number => {
  const club = s.clubs[clubId];
  if (!club) return 0;
  return [...club.squad, ...club.youthSquad].reduce((total, playerId) => {
    const contract = contractFor(s, playerId);
    return total + (contract?.wage ?? 0);
  }, 0);
};

/** How much of the wage budget is committed. Above 1 means the club is overspending. */
export const wageBudgetUsage = (s: GameState, clubId: ClubId): number => {
  const club = s.clubs[clubId];
  if (!club || club.finance.wageBudgetPerCycle <= 0) return 0;
  return squadWageBill(s, clubId) / club.finance.wageBudgetPerCycle;
};

export const squadStrength = (s: GameState, clubId: ClubId): number => {
  const squad = squadOf(s, clubId);
  if (!squad.length) return 0;
  // Weight the likely starting eleven far more heavily than the fringe: a deep
  // bench of 60-rated players should not read as a strong squad.
  const sorted = squad.slice().sort((a, b) => b.overall - a.overall);
  const starters = sorted.slice(0, 7);
  const rest = sorted.slice(7);
  return Math.round(mean(starters.map((p) => p.overall)) * 0.82 + mean(rest.map((p) => p.overall)) * 0.18);
};

export const fixturesFor = (s: GameState, clubId: ClubId): Fixture[] =>
  Object.values(s.fixtures)
    .filter((f) => f.homeClubId === clubId || f.awayClubId === clubId)
    .sort((a, b) => a.week - b.week);

export const nextFixture = (s: GameState, clubId: ClubId = s.playerClubId): Fixture | null =>
  fixturesFor(s, clubId).find((f) => f.status === 'SCHEDULED') ?? null;

export const lastFixture = (s: GameState, clubId: ClubId = s.playerClubId): Fixture | null => {
  const completed = fixturesFor(s, clubId).filter((f) => f.status === 'COMPLETED');
  return completed[completed.length - 1] ?? null;
};

export const currentSeason = (s: GameState) => s.seasons[s.currentSeasonId];
export const currentCompetition = (s: GameState) => s.competitions[s.currentCompetitionId];

export const standings = (s: GameState): StandingRow[] => {
  const competition = currentCompetition(s);
  if (!competition) return [];
  const fixtures = Object.values(s.fixtures).filter(
    (f) => f.competitionId === competition.id && f.seasonId === s.currentSeasonId,
  );
  return computeStandings(competition.clubIds, fixtures, {
    playoffSpots: competition.playoffSpots,
    relegationSpots: competition.relegationSpots,
  });
};

export const leaguePosition = (s: GameState, clubId: ClubId = s.playerClubId) =>
  positionContext(standings(s), clubId);

/** Newest first, capped — the form guide the home screen shows. */
export const recentForm = (s: GameState, clubId: ClubId, limit = 5): ('W' | 'D' | 'L')[] => {
  const played = fixturesFor(s, clubId)
    .filter((f) => f.status === 'COMPLETED' && f.homeScore !== null && f.awayScore !== null)
    .slice(-limit);
  return played.map((f) => {
    const isHome = f.homeClubId === clubId;
    const us = (isHome ? f.homeScore : f.awayScore) as number;
    const them = (isHome ? f.awayScore : f.homeScore) as number;
    return us > them ? 'W' : us < them ? 'L' : 'D';
  });
};

export const topScorer = (s: GameState, clubId: ClubId): Player | null => {
  const squad = squadOf(s, clubId);
  if (!squad.length) return null;
  return squad.reduce((best, p) => (p.form.goals > best.form.goals ? p : best), squad[0] as Player);
};

export const starPlayer = (s: GameState, clubId: ClubId): Player | null => {
  const squad = squadOf(s, clubId);
  if (!squad.length) return null;
  return squad.reduce((best, p) => (p.overall > best.overall ? p : best), squad[0] as Player);
};

export const injuredPlayers = (s: GameState, clubId: ClubId): Player[] =>
  squadOf(s, clubId).filter((p) => p.injury !== null);

export const suspendedPlayers = (s: GameState, clubId: ClubId): Player[] =>
  squadOf(s, clubId).filter((p) => p.suspensionMatches > 0);

export const expiringContracts = (s: GameState, clubId: ClubId, withinCycles = 8): Player[] =>
  squadOf(s, clubId).filter((p) => {
    const contract = contractFor(s, p.id);
    return contract !== undefined && contract.weeksRemaining <= withinCycles;
  });

export const clubCreators = (s: GameState, clubId: ClubId) =>
  Object.values(s.creators).filter((c) => c.clubId === clubId);

/** Total reach the club commands through its creators — drives sponsor tiers. */
export const clubTotalReach = (s: GameState, clubId: ClubId): number =>
  clubCreators(s, clubId).reduce((total, c) => total + c.followers, 0) +
  (s.clubs[clubId]?.fans.onlineFollowers ?? 0);

/**
 * Share of the arena backing `clubA` against `clubB`, 0-1.
 *
 * The arena is filled by both clubs' people: attached creators' reach plus the
 * fans themselves (`clubTotalReach`). This is the number the match engine uses
 * to size the crowd's effect on the pitch and the one the UI quotes —
 * "78% of the arena is in your colours" is this selector, formatted.
 */
export function arenaSupportShare(s: GameState, clubAId: ClubId, clubBId: ClubId): number {
  const a = Math.max(0, clubTotalReach(s, clubAId));
  const b = Math.max(0, clubTotalReach(s, clubBId));
  if (a + b <= 0) return 0.5;
  return a / (a + b);
}

export const activeObjectives = (s: GameState) =>
  s.objectives.active.filter((o) => o.status === 'ACTIVE');

export const claimableObjectives = (s: GameState) =>
  s.objectives.active.filter((o) => o.status === 'COMPLETED');

export const unreadStories = (s: GameState) => s.media.stories.filter((story) => !story.read);

export const rivalsOf = (s: GameState, clubId: ClubId) =>
  Object.values(s.rivalries)
    .filter((r) => r.clubAId === clubId || r.clubBId === clubId)
    .sort((a, b) => b.intensity - a.intensity);

/**
 * The single most pressing problem facing the club, used by the home screen to
 * lead with something that actually matters rather than a generic dashboard.
 */
export interface ClubConcern {
  readonly kind: 'INJURY' | 'CONTRACT' | 'MORALE' | 'FINANCE' | 'FORM' | 'FANS' | 'NONE';
  readonly severity: number;
  readonly headline: string;
  readonly detail: string;
  readonly playerId?: PlayerId;
}

export function topConcern(s: GameState): ClubConcern {
  const clubId = s.playerClubId;
  const club = s.clubs[clubId];
  if (!club) return { kind: 'NONE', severity: 0, headline: 'All quiet', detail: '' };

  const concerns: ClubConcern[] = [];

  const injured = injuredPlayers(s, clubId).sort((a, b) => b.overall - a.overall);
  const keyInjury = injured[0];
  if (keyInjury) {
    concerns.push({
      kind: 'INJURY',
      severity: 40 + keyInjury.overall * 0.5 + (keyInjury.injury?.weeksRemaining ?? 0) * 3,
      headline: `${keyInjury.displayName} is out`,
      detail: `${keyInjury.injury?.description ?? 'Injured'} — ${keyInjury.injury?.weeksRemaining ?? 0} weeks`,
      playerId: keyInjury.id,
    });
  }

  const expiring = expiringContracts(s, clubId, 6).sort((a, b) => b.overall - a.overall);
  const keyExpiry = expiring[0];
  if (keyExpiry) {
    concerns.push({
      kind: 'CONTRACT',
      severity: 30 + keyExpiry.overall * 0.6,
      headline: `${keyExpiry.displayName}'s deal is running down`,
      detail: 'Renew now or risk losing him for nothing.',
      playerId: keyExpiry.id,
    });
  }

  const unhappy = squadOf(s, clubId)
    .filter((p) => p.mental.morale < 35)
    .sort((a, b) => a.mental.morale - b.mental.morale);
  const keyUnhappy = unhappy[0];
  if (keyUnhappy) {
    concerns.push({
      kind: 'MORALE',
      severity: 25 + (40 - keyUnhappy.mental.morale) + keyUnhappy.overall * 0.3,
      headline: `${keyUnhappy.displayName} is unhappy`,
      detail: 'Minutes, role or results — something needs to change.',
      playerId: keyUnhappy.id,
    });
  }

  const usage = wageBudgetUsage(s, clubId);
  if (usage > 1) {
    concerns.push({
      kind: 'FINANCE',
      severity: 45 + (usage - 1) * 100,
      headline: 'Wage bill is over budget',
      detail: `You are spending ${Math.round(usage * 100)}% of your wage allowance.`,
    });
  }

  if (club.fans.sentiment < 35) {
    concerns.push({
      kind: 'FANS',
      severity: 30 + (40 - club.fans.sentiment),
      headline: 'The stands are turning',
      detail: 'Fan sentiment is low and attendance is falling with it.',
    });
  }

  const form = recentForm(s, clubId, 5);
  const losses = form.filter((r) => r === 'L').length;
  if (form.length >= 3 && losses >= 3) {
    concerns.push({
      kind: 'FORM',
      severity: 35 + losses * 8,
      headline: `${losses} defeats in your last ${form.length}`,
      detail: 'The run needs to stop this week.',
    });
  }

  if (!concerns.length) {
    return { kind: 'NONE', severity: 0, headline: 'Everything is under control', detail: 'Focus on the next fixture.' };
  }
  return concerns.sort((a, b) => b.severity - a.severity)[0] as ClubConcern;
}
