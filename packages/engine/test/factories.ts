import {
  asId, emptyAttributes, emptyMental, emptyForm, emptyRecord, initialClock,
  Ledger, DEFAULT_TACTICS,
  type ClubId, type PlayerId, type ManagerId, type SeasonId, type CompetitionId,
  type ContractId, type GameState, type Player, type Club, type Contract,
} from '../src/index';

/**
 * Minimal-but-valid state builders for tests.
 *
 * These deliberately do NOT go through the real new-game flow: a test that
 * breaks because content generation changed is a test that is measuring the
 * wrong thing.
 */

export const makePlayer = (id: string, over: Partial<Player> = {}): Player => ({
  id: asId<PlayerId>(id),
  identityKind: 'FICTIONAL',
  firstName: 'Test',
  lastName: id,
  displayName: `T. ${id}`,
  shirtNumber: 10,
  age: 24,
  nationality: 'TSV',
  position: 'CM',
  secondaryPositions: [],
  footedness: 'right',
  height: 180,
  attributes: emptyAttributes(60),
  mental: emptyMental(60),
  traitIds: [],
  overall: 60,
  potential: 70,
  clubId: null,
  contractId: null,
  fitness: 100,
  injury: null,
  suspensionMatches: 0,
  form: emptyForm(),
  history: [],
  marketValue: 1_000_000,
  reputation: 40,
  scouting: { confidence: 1, revealed: [] },
  portraitSeed: id,
  ...over,
});

export const makeClub = (id: string, over: Partial<Club> = {}): Club => ({
  id: asId<ClubId>(id),
  name: `Club ${id}`,
  shortName: `C${id}`,
  abbreviation: id.slice(0, 3).toUpperCase(),
  city: 'Testville',
  founded: 1990,
  isPlayerClub: false,
  visual: {
    primary: '#c8ff2e', secondary: '#08090b', accent: '#ffffff',
    badgeShape: 'SHIELD', badgeMotif: 'BOLT', style: 'MODERN', kitPattern: 'SOLID',
  },
  philosophy: 'LOCAL_ROOTS',
  fanCulture: 'TRADITIONAL',
  reputation: 50,
  stadium: { name: 'Test Arena', capacity: 8000, quality: 50, atmosphere: 50, pitchQuality: 50 },
  fans: {
    sentiment: 60, trust: 60, excitement: 50, loyalty: 60, base: 20000,
    expectation: 50, lastAttendance: 6000, seasonTicketHolders: 3000, onlineFollowers: 50000,
  },
  finance: {
    wageBudgetPerCycle: 200_000, transferBudget: 5_000_000, ticketPrice: 20,
    merchPrice: 45, lastCycleIncome: 0, lastCycleExpenditure: 0, debt: 0,
  },
  managerId: null,
  squad: [],
  youthSquad: [],
  creatorIds: [],
  tactics: {
    formationId: 'default',
    lineup: {},
    bench: [],
    captainId: null,
    setPieceTakerId: null,
    penaltyTakerId: null,
    ...DEFAULT_TACTICS,
  },
  facilityLevels: {},
  sponsorDealIds: [],
  rivalryIds: [],
  aiProfileId: 'balanced',
  seasonRecord: emptyRecord(),
  allTimeRecord: emptyRecord(),
  motto: 'For the test',
  ...over,
});

export const makeContract = (id: string, playerId: string, clubId: string): Contract => ({
  id: asId<ContractId>(id),
  playerId: asId<PlayerId>(playerId),
  clubId: asId<ClubId>(clubId),
  wage: 10_000,
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
});

export function makeGameState(over: Partial<GameState> = {}): GameState {
  const clubId = asId<ClubId>('club_a');
  const otherId = asId<ClubId>('club_b');
  const seasonId = asId<SeasonId>('season_1');
  const competitionId = asId<CompetitionId>('comp_1');
  const managerId = asId<ManagerId>('mgr_1');

  const players = Object.fromEntries(
    Array.from({ length: 8 }, (_, i) => {
      const p = makePlayer(`p${i}`, { clubId: i < 4 ? clubId : otherId });
      return [p.id, p];
    }),
  );

  const ledger = new Ledger();
  ledger.open(clubId, 5_000_000, { cycle: 0, season: 1, at: 0 });
  ledger.open(otherId, 5_000_000, { cycle: 0, season: 1, at: 0 });

  return {
    version: 1,
    saveId: 'save_test',
    seed: 'test-seed',
    createdAt: 0,
    clock: initialClock(0),
    playerClubId: clubId,
    playerManagerId: managerId,
    players,
    creators: {},
    managers: {
      [managerId]: {
        id: managerId, identityKind: 'FICTIONAL', name: 'Test Manager', isPlayer: true,
        archetypeId: 'tactician',
        attributes: {
          tacticalKnowledge: 60, motivation: 60, playerDevelopment: 60, mediaHandling: 60,
          negotiation: 60, scouting: 60, discipline: 60, riskTolerance: 50, adaptability: 60,
          brandBuilding: 50,
        },
        appearance: {
          skinTone: 3, hairStyle: 'short', hairColor: 'black', facialHair: 'none',
          outfit: 'suit', accessory: 'none', accentColor: '#c8ff2e',
        },
        mediaStyle: 'HONEST', socialPersonality: 'ACTIVE', clubId,
        reputation: 40, careerWins: 0, careerDraws: 0, careerLosses: 0, trophies: [],
        bio: 'A manager for testing.',
      },
    },
    clubs: {
      [clubId]: makeClub('club_a', {
        isPlayerClub: true,
        managerId,
        squad: Object.values(players).filter((p) => p.clubId === clubId).map((p) => p.id),
      }),
      [otherId]: makeClub('club_b', {
        squad: Object.values(players).filter((p) => p.clubId === otherId).map((p) => p.id),
      }),
    },
    contracts: {},
    competitions: {
      [competitionId]: {
        id: competitionId, name: 'Test League', shortName: 'TL', format: 'LEAGUE',
        tier: 1, clubIds: [clubId, otherId], rounds: 2, playoffSpots: 1,
        relegationSpots: 0, prizeMoney: [1_000_000, 500_000], accent: '#c8ff2e',
        enabledSpecialRules: [],
      },
    },
    fixtures: {},
    seasons: {
      [seasonId]: {
        id: seasonId, number: 1, competitionId, totalWeeks: 2, currentWeek: 0,
        phase: 'PRE_SEASON', completed: false, championClubId: null, playerFinalPosition: null,
      },
    },
    currentSeasonId: seasonId,
    currentCompetitionId: competitionId,
    ledger: ledger.snapshot(),
    transfers: { listings: {}, negotiations: {}, completed: [], windowOpen: true, rumours: [] },
    scouting: { assignments: [], shortlist: [], weeklyCapacity: 2, network: 30 },
    training: { programId: 'balanced', intensity: 'NORMAL', individualFocus: {}, lastResults: [] },
    sponsors: { available: [], active: [] },
    media: { stories: [] },
    social: { posts: [], clubFollowers: 50_000, weeklyImpressions: 0 },
    rivalries: {},
    objectives: { active: [], completed: [], seasonTargets: [] },
    boardPressure: { lastUltimatumCycle: null },
    decisionMemory: { recentTriggers: [] },
    decisionRecord: {},
    legacy: { trophies: [], records: {}, seasonSummaries: [], legends: [], milestones: [] },
    inventory: { ruleCards: [], scoutCredits: 2, cosmeticIds: [], facilityCredits: 0 },
    settings: {
      reducedMotion: false, haptics: true, matchSpeed: 'NORMAL', presentation: 'PITCH',
      commentary: true, autoDecisionTimeout: true, region: 'GB', enabledPackIds: ['base'],
      difficulty: 'STANDARD',
    },
    eventLog: [],
    idCounters: {},
    analytics: { sessionCount: 1, matchesPlayed: 0, decisionsMade: 0, lastSeenCycle: 0 },
    ...over,
  };
}
