import type {
  ClubId, CompetitionId, ContractId, CreatorId, EventId, FixtureId, ManagerId, MatchId, PlayerId, SeasonId,
} from '../core/brand';
import { asId } from '../core/brand';
import type { AnyDomainEvent, DomainEventPayloads, DomainEventType, EntityRef, EventImportance } from '../core/events';
import type { GameState } from '../game/state';
import type { Club } from '../clubs/club';
import { emptyRecord } from '../clubs/club';
import type { Player } from '../players/player';
import { emptyForm } from '../players/player';
import type { Creator } from '../creators/creator';
import { emptyCreatorAttributes } from '../creators/creator';
import type { Position } from '../players/positions';
import { emptyAttributes, overallFor } from '../players/attributes';
import { emptyMental } from '../players/mental';
import type { ClubTemplate } from '../content/schema';
import type { Fixture } from '../league/types';
import { initialClock } from '../core/clock';
import { Ledger } from '../economy/ledger';
import { Rng } from '../core/rng';
import { DEFAULT_TACTICS } from '../tactics/tactics';
import { seedRivalries } from '../rivalries/rivalries';
import { AI_PROFILES } from './aiClub';

/**
 * Test scaffolding for the living-world modules.
 *
 * Deliberately hand-built rather than routed through the real new-game flow: a
 * world-engine test that breaks because content generation changed is measuring
 * the wrong thing. Not used by shipping code.
 */

const SHAPE: readonly Position[] = ['GK', 'CB', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LW', 'RW', 'ST', 'CM', 'CB', 'ST'];
const TONES = ['HYPE', 'ANALYTICAL', 'COMEDIC', 'PROVOCATIVE', 'WHOLESOME', 'DRAMATIC'] as const;

export interface TestWorldOptions {
  readonly clubCount?: number;
  readonly squadSize?: number;
  readonly seed?: string;
  readonly creatorCount?: number;
}

export interface TestWorld {
  readonly state: GameState;
  readonly ledger: Ledger;
  readonly clubIds: readonly ClubId[];
  readonly templates: readonly ClubTemplate[];
}

export function makeTestPlayer(id: string, over: Partial<Player> = {}): Player {
  const attributes = over.attributes ?? emptyAttributes(60);
  const position = over.position ?? 'CM';
  return {
    id: asId<PlayerId>(id),
    identityKind: 'FICTIONAL',
    firstName: 'Test',
    lastName: id,
    displayName: `T. ${id}`,
    shirtNumber: 10,
    age: 24,
    nationality: 'VLD',
    position,
    secondaryPositions: [],
    footedness: 'right',
    height: 181,
    attributes,
    mental: emptyMental(60),
    traitIds: [],
    overall: overallFor(attributes, position),
    potential: 78,
    clubId: null,
    contractId: null,
    fitness: 100,
    injury: null,
    suspensionMatches: 0,
    form: emptyForm(),
    history: [],
    marketValue: 2_000_000,
    reputation: 45,
    scouting: { confidence: 1, revealed: [] },
    portraitSeed: id,
    ...over,
  };
}

export function makeTestClub(id: string, index: number, over: Partial<Club> = {}): Club {
  const profile = AI_PROFILES[index % AI_PROFILES.length];
  return {
    id: asId<ClubId>(id),
    name: `Club ${index}`,
    shortName: `C${index}`,
    abbreviation: `C${index}`.toUpperCase().slice(0, 3),
    // Clubs 0 and 1 share a city so the seeder always produces a real derby.
    city: index <= 1 ? 'Vellmar' : `City ${index}`,
    founded: 1900 + index,
    isPlayerClub: index === 0,
    visual: {
      primary: '#c8ff2e', secondary: '#08090b', accent: '#ffffff',
      badgeShape: 'SHIELD', badgeMotif: 'BOLT', style: 'MODERN', kitPattern: 'SOLID',
    },
    philosophy: profile?.philosophy ?? 'LOCAL_ROOTS',
    fanCulture: 'TRADITIONAL',
    reputation: 70 - index * 3,
    stadium: { name: `Ground ${index}`, capacity: 20_000, quality: 55, atmosphere: 60, pitchQuality: 60 },
    fans: {
      sentiment: 60, trust: 58, excitement: 52, loyalty: 62, base: 40_000,
      expectation: 55, lastAttendance: 15_000, seasonTicketHolders: 9_000, onlineFollowers: 400_000,
    },
    finance: {
      wageBudgetPerCycle: 300_000, transferBudget: 12_000_000, ticketPrice: 24,
      merchPrice: 45, lastCycleIncome: 0, lastCycleExpenditure: 0, debt: 0,
    },
    managerId: null,
    squad: [],
    youthSquad: [],
    creatorIds: [],
    tactics: { formationId: '3-2-1', ...DEFAULT_TACTICS, lineup: {}, bench: [], captainId: null, setPieceTakerId: null, penaltyTakerId: null },
    facilityLevels: {},
    sponsorDealIds: [],
    rivalryIds: [],
    aiProfileId: profile?.id ?? null,
    seasonRecord: emptyRecord(),
    allTimeRecord: emptyRecord(),
    motto: 'Test motto',
    ...over,
  };
}

/** Build a small but complete league: clubs, squads, creators, rivalries, ledger. */
export function buildTestWorld(opts: TestWorldOptions = {}): TestWorld {
  const clubCount = opts.clubCount ?? 6;
  const squadSize = opts.squadSize ?? 14;
  const rng = new Rng(opts.seed ?? 'test-world');

  const players: Record<string, Player> = {};
  const clubs: Record<string, Club> = {};
  const contracts: Record<string, GameState['contracts'][string]> = {};
  const templates: ClubTemplate[] = [];
  const clubIds: ClubId[] = [];

  for (let c = 0; c < clubCount; c++) {
    const clubId = asId<ClubId>(`club_${c}`);
    clubIds.push(clubId);
    const squad: PlayerId[] = [];
    for (let p = 0; p < squadSize; p++) {
      const position = SHAPE[p % SHAPE.length] as Position;
      const base = 68 - c * 2 + (p < 11 ? 4 : -4);
      const attributes = emptyAttributes(base);
      const player = makeTestPlayer(`p_${c}_${p}`, {
        position,
        attributes,
        clubId,
        age: 20 + ((c + p) % 14),
        potential: Math.min(95, base + 12),
        marketValue: 1_000_000 + base * 40_000,
        contractId: asId<ContractId>(`ct_${c}_${p}`),
      });
      players[player.id] = player;
      squad.push(player.id);
      contracts[`ct_${c}_${p}`] = {
        id: asId<ContractId>(`ct_${c}_${p}`),
        playerId: player.id,
        clubId,
        wage: 12_000,
        weeksRemaining: 40,
        totalWeeks: 44,
        signingBonus: 0,
        bonuses: { appearance: 0, goal: 0, cleanSheet: 0, seasonPerformance: 0, trophy: 0, promotion: 0 },
        role: 'STARTER',
        releaseClause: null,
        loyaltyBonus: 0,
        signedCycle: 0,
        minutesPlayed: 0,
        minutesAvailable: 0,
      };
    }
    // A couple of academy players so youth promotion has something to do.
    const youth: PlayerId[] = [];
    for (let y = 0; y < 2; y++) {
      const prospect = makeTestPlayer(`y_${c}_${y}`, {
        position: 'CAM', age: 17, potential: 88, attributes: emptyAttributes(52), clubId,
      });
      players[prospect.id] = prospect;
      youth.push(prospect.id);
    }
    const club = makeTestClub(`club_${c}`, c, { squad, youthSquad: youth });
    clubs[clubId] = club;
    templates.push({
      id: `club_${c}`,
      name: club.name,
      shortName: club.shortName,
      abbreviation: club.abbreviation,
      city: club.city,
      founded: club.founded,
      philosophy: club.philosophy,
      fanCulture: club.fanCulture,
      reputation: club.reputation,
      strength: club.reputation,
      budget: club.finance.transferBudget,
      stadiumName: club.stadium.name,
      stadiumCapacity: club.stadium.capacity,
      visual: {
        primary: club.visual.primary, secondary: club.visual.secondary, accent: club.visual.accent,
        badgeShape: club.visual.badgeShape, badgeMotif: club.visual.badgeMotif,
        style: club.visual.style, kitPattern: club.visual.kitPattern,
      },
      aiProfileId: club.aiProfileId ?? 'analytics',
      motto: club.motto,
      ...(c === 0 ? { rivalOf: ['club_1'] } : c === 2 ? { rivalOf: ['club_3'] } : {}),
    });
  }

  const creators: Record<string, Creator> = {};
  const creatorCount = opts.creatorCount ?? 8;
  for (let i = 0; i < creatorCount; i++) {
    const id = asId<CreatorId>(`creator_${i}`);
    const attachedTo = i < clubCount ? clubIds[i] ?? null : null;
    creators[id] = {
      id,
      identityKind: 'FICTIONAL',
      handle: `@creator${i}`,
      displayName: `Creator ${i}`,
      roles: ['INFLUENCER'],
      tier: i % 5 === 0 ? 'GLOBAL' : i % 3 === 0 ? 'MAJOR' : 'ESTABLISHED',
      followers: 200_000 * (i + 2),
      attributes: emptyCreatorAttributes(60),
      style: { tone: TONES[i % TONES.length] as Creator['style']['tone'], platforms: ['SHORTFORM'], postingFrequency: 0.8 },
      clubId: attachedTo,
      playerId: null,
      clubSentiment: i % 2 === 0 ? 40 : -40,
      marketValue: 500_000,
      dealWeeksRemaining: null,
      avatarSeed: `creator_${i}`,
      bio: 'A creator built for tests.',
    };
  }

  const managerId = asId<ManagerId>('mgr_1');
  const seasonId = asId<SeasonId>('season_1');
  const competitionId = asId<CompetitionId>('comp_1');
  const playerClubId = clubIds[0] as ClubId;

  const ledger = new Ledger();
  for (const clubId of clubIds) {
    ledger.open(clubId, 20_000_000, { cycle: 0, season: 1, at: 0 });
  }

  const firstClub = clubs[playerClubId];
  if (firstClub) clubs[playerClubId] = { ...firstClub, managerId, creatorIds: [asId<CreatorId>('creator_0')] };

  const state: GameState = {
    version: 1,
    saveId: 'save_world_test',
    seed: opts.seed ?? 'test-world',
    createdAt: 0,
    clock: { ...initialClock(0), cycle: 10, week: 10, season: 1, phase: 'MID_SEASON_PUSH' },
    playerClubId,
    playerManagerId: managerId,
    players,
    creators,
    managers: {
      [managerId]: {
        id: managerId, identityKind: 'FICTIONAL', name: 'Alex Kerrin', isPlayer: true,
        archetypeId: 'tactician',
        attributes: {
          tacticalKnowledge: 65, motivation: 60, playerDevelopment: 60, mediaHandling: 50,
          negotiation: 55, scouting: 55, discipline: 60, riskTolerance: 50, adaptability: 60,
          brandBuilding: 50,
        },
        appearance: {
          skinTone: 3, hairStyle: 'short', hairColor: 'black', facialHair: 'none',
          outfit: 'suit', accessory: 'none', accentColor: '#c8ff2e',
        },
        mediaStyle: 'HONEST', socialPersonality: 'ACTIVE', clubId: playerClubId,
        reputation: 45, careerWins: 0, careerDraws: 0, careerLosses: 0, trophies: [],
        bio: 'Built for tests.',
      },
    },
    clubs,
    contracts,
    competitions: {
      [competitionId]: {
        id: competitionId, name: 'Test League', shortName: 'TL', format: 'LEAGUE', tier: 1,
        clubIds, rounds: 2, playoffSpots: 2, relegationSpots: 1,
        prizeMoney: [2_000_000, 1_000_000], accent: '#c8ff2e', enabledSpecialRules: [],
      },
    },
    fixtures: {},
    seasons: {
      [seasonId]: {
        id: seasonId, number: 1, competitionId, totalWeeks: 22, currentWeek: 10,
        phase: 'MID_SEASON_PUSH', completed: false, championClubId: null, playerFinalPosition: null,
      },
    },
    currentSeasonId: seasonId,
    currentCompetitionId: competitionId,
    ledger: ledger.snapshot(),
    transfers: { listings: {}, negotiations: {}, completed: [], windowOpen: true, rumours: [] },
    scouting: { assignments: [], shortlist: [], weeklyCapacity: 2, network: 40 },
    training: { programId: 'balanced', intensity: 'NORMAL', individualFocus: {}, lastResults: [] },
    sponsors: { available: [], active: [] },
    media: { stories: [] },
    social: { posts: [], clubFollowers: 400_000, weeklyImpressions: 0 },
    rivalries: {},
    objectives: { active: [], completed: [], seasonTargets: [] },
    legacy: { trophies: [], records: {}, seasonSummaries: [], legends: [], milestones: [] },
    inventory: { ruleCards: [], scoutCredits: 3, cosmeticIds: [], facilityCredits: 0 },
    settings: {
      reducedMotion: false, haptics: true, matchSpeed: 'NORMAL', presentation: 'PITCH',
      commentary: true, autoDecisionTimeout: true, region: 'GB', enabledPackIds: ['base'],
      difficulty: 'STANDARD',
    },
    eventLog: [],
    idCounters: {},
    analytics: { sessionCount: 1, matchesPlayed: 0, decisionsMade: 0, lastSeenCycle: 0 },
  };

  const rivalries = seedRivalries(Object.values(clubs), templates, rng);
  return { state: { ...state, rivalries }, ledger, clubIds, templates };
}

let eventCounter = 0;

/** Build a domain event for tests. Ids are unique within a test run. */
export function makeTestEvent<T extends DomainEventType>(
  type: T,
  payload: DomainEventPayloads[T],
  over: Partial<{ cycle: number; season: number; week: number; importance: EventImportance; entities: readonly EntityRef[]; matchId: MatchId; id: string }> = {},
): AnyDomainEvent {
  return {
    id: asId<EventId>(over.id ?? `ev_${(eventCounter++).toString(36)}`),
    type,
    payload,
    cycle: over.cycle ?? 10,
    season: over.season ?? 1,
    week: over.week ?? 10,
    at: 0,
    importance: over.importance ?? 3,
    entities: over.entities ?? [],
    ...(over.matchId ? { matchId: over.matchId } : {}),
  } as unknown as AnyDomainEvent;
}

/** Append a completed fixture, so history-based detectors have something to read. */
export function withFixture(
  state: GameState,
  spec: {
    id: string; week: number; home: ClubId; away: ClubId; homeScore: number; awayScore: number;
    isDerby?: boolean; matchId?: string;
  },
): GameState {
  const fixture: Fixture = {
    id: asId<FixtureId>(spec.id),
    competitionId: state.currentCompetitionId,
    seasonId: state.currentSeasonId,
    week: spec.week,
    phase: 'MID_SEASON_PUSH',
    homeClubId: spec.home,
    awayClubId: spec.away,
    status: 'COMPLETED',
    matchId: asId<MatchId>(spec.matchId ?? `match_${spec.id}`),
    homeScore: spec.homeScore,
    awayScore: spec.awayScore,
    importance: spec.isDerby ? 5 : 3,
    isDerby: spec.isDerby ?? false,
    enabledSpecialRules: [],
  };
  return { ...state, fixtures: { ...state.fixtures, [fixture.id]: fixture } };
}

/** Append events to the journal, as the orchestration layer would. */
export const withEvents = (state: GameState, events: readonly AnyDomainEvent[]): GameState =>
  ({ ...state, eventLog: [...state.eventLog, ...events] });
