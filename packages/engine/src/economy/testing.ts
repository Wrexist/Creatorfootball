import type { Club } from '../clubs/club';
import { emptyRecord } from '../clubs/club';
import { emptyBonuses, type Contract, type SquadRole } from '../contracts/contract';
import type { FacilityDef, SponsorTemplate } from '../content/schema';
import { asId, type ClubId, type CompetitionId, type ContractId, type ManagerId, type PlayerId, type SeasonId } from '../core/brand';
import { initialClock } from '../core/clock';
import type { GameState } from '../game/state';
import { emptyAttributes, overallFor, type Attributes } from '../players/attributes';
import { emptyMental } from '../players/mental';
import { emptyForm, type Player } from '../players/player';
import type { Position } from '../players/positions';
import { DEFAULT_TACTICS } from '../tactics/tactics';

/**
 * Deterministic fixture builders for the squad-and-club test suites.
 *
 * These live in src rather than in a test folder because four separate modules
 * (transfers, training, fans, economy) need the same GameState shape, and a
 * shared builder is the only way to stop those suites drifting apart. Nothing
 * in the shipped game imports from here.
 */

export type PlayerOverrides = Omit<Partial<Player>, 'id' | 'clubId' | 'contractId'> & {
  id: string; clubId?: string | null; contractId?: string | null;
};

export function makePlayer(over: PlayerOverrides): Player {
  const attributes: Attributes = over.attributes ?? emptyAttributes(60);
  const position: Position = over.position ?? 'CM';
  const overall = over.overall ?? overallFor(attributes, position);
  return {
    id: asId<PlayerId>(over.id),
    identityKind: 'FICTIONAL',
    firstName: over.firstName ?? 'Test',
    lastName: over.lastName ?? over.id,
    displayName: over.displayName ?? `Test ${over.id}`,
    shirtNumber: over.shirtNumber ?? null,
    age: over.age ?? 25,
    nationality: over.nationality ?? 'AVL',
    position,
    secondaryPositions: over.secondaryPositions ?? [],
    footedness: over.footedness ?? 'right',
    height: over.height ?? 180,
    attributes,
    mental: over.mental ?? emptyMental(55),
    traitIds: over.traitIds ?? [],
    overall,
    potential: over.potential ?? Math.min(99, overall + 6),
    clubId: over.clubId === undefined || over.clubId === null ? null : asId<ClubId>(over.clubId),
    contractId: over.contractId === undefined || over.contractId === null ? null : asId<ContractId>(over.contractId),
    fitness: over.fitness ?? 90,
    injury: over.injury ?? null,
    suspensionMatches: over.suspensionMatches ?? 0,
    form: over.form ?? emptyForm(),
    history: over.history ?? [],
    marketValue: over.marketValue ?? 0,
    reputation: over.reputation ?? 50,
    scouting: over.scouting ?? { confidence: 1, revealed: [] },
    portraitSeed: over.portraitSeed ?? over.id,
  };
}

export type ContractOverrides = Omit<Partial<Contract>, 'id' | 'playerId' | 'clubId'> & {
  id: string; playerId: string; clubId: string;
};

export function makeContract(over: ContractOverrides): Contract {
  return {
    id: asId<ContractId>(over.id),
    playerId: asId<PlayerId>(over.playerId),
    clubId: asId<ClubId>(over.clubId),
    wage: over.wage ?? 10_000,
    weeksRemaining: over.weeksRemaining ?? 76,
    totalWeeks: over.totalWeeks ?? 76,
    signingBonus: over.signingBonus ?? 0,
    bonuses: over.bonuses ?? emptyBonuses(),
    role: (over.role ?? 'STARTER') as SquadRole,
    releaseClause: over.releaseClause ?? null,
    loyaltyBonus: over.loyaltyBonus ?? 0,
    signedCycle: over.signedCycle ?? 0,
    minutesPlayed: over.minutesPlayed ?? 0,
    minutesAvailable: over.minutesAvailable ?? 0,
  };
}

export type ClubOverrides = Omit<Partial<Club>, 'id' | 'squad' | 'youthSquad' | 'managerId'> & {
  id: string; squad?: readonly string[]; youthSquad?: readonly string[];
};

export function makeClub(over: ClubOverrides): Club {
  return {
    id: asId<ClubId>(over.id),
    name: over.name ?? `${over.id} FC`,
    shortName: over.shortName ?? over.id,
    abbreviation: over.abbreviation ?? over.id.slice(0, 3).toUpperCase(),
    city: over.city ?? 'Testown',
    founded: over.founded ?? 1990,
    isPlayerClub: over.isPlayerClub ?? false,
    visual: over.visual ?? {
      primary: '#123456', secondary: '#654321', accent: '#abcdef',
      badgeShape: 'SHIELD', badgeMotif: 'STAR', style: 'MODERN', kitPattern: 'SOLID',
    },
    philosophy: over.philosophy ?? 'LOCAL_ROOTS',
    fanCulture: over.fanCulture ?? 'TRADITIONAL',
    reputation: over.reputation ?? 50,
    stadium: over.stadium ?? {
      name: 'Test Park', capacity: 8_000, quality: 55, atmosphere: 60, pitchQuality: 60,
    },
    fans: over.fans ?? {
      sentiment: 55, trust: 55, excitement: 45, loyalty: 55,
      base: 22_000, expectation: 50, lastAttendance: 0,
      seasonTicketHolders: 1_500, onlineFollowers: 900_000,
    },
    finance: over.finance ?? {
      wageBudgetPerCycle: 180_000, transferBudget: 4_000_000, ticketPrice: 14,
      merchPrice: 55, lastCycleIncome: 0, lastCycleExpenditure: 0, debt: 0,
    },
    managerId: null,
    squad: (over.squad ?? []).map((id) => asId<PlayerId>(id)),
    youthSquad: (over.youthSquad ?? []).map((id) => asId<PlayerId>(id)),
    creatorIds: over.creatorIds ?? [],
    tactics: over.tactics ?? {
      ...DEFAULT_TACTICS, formationId: '4-2-1', lineup: {}, bench: [],
      captainId: null, setPieceTakerId: null, penaltyTakerId: null,
    },
    facilityLevels: over.facilityLevels ?? {},
    sponsorDealIds: over.sponsorDealIds ?? [],
    rivalryIds: over.rivalryIds ?? [],
    aiProfileId: over.aiProfileId ?? 'local_underdog',
    seasonRecord: over.seasonRecord ?? emptyRecord(),
    allTimeRecord: over.allTimeRecord ?? emptyRecord(),
    motto: over.motto ?? 'For the test',
  };
}

export function makeState(over: Partial<GameState> = {}): GameState {
  return {
    version: 1,
    saveId: 'test-save',
    seed: 'test-seed',
    createdAt: 0,
    clock: initialClock(0),
    playerClubId: asId<ClubId>('club_home'),
    playerManagerId: asId<ManagerId>('manager_1'),
    players: {},
    creators: {},
    managers: {},
    clubs: {},
    contracts: {},
    competitions: {},
    fixtures: {},
    seasons: {},
    currentSeasonId: asId<SeasonId>('season_1'),
    currentCompetitionId: asId<CompetitionId>('competition_1'),
    ledger: { balances: {}, transactions: [], idCounters: {}, appliedKeys: {}, permanentKeys: [], seasonTotals: [] },
    transfers: { listings: {}, negotiations: {}, completed: [], windowOpen: true, rumours: [] },
    scouting: { assignments: [], shortlist: [], weeklyCapacity: 2, network: 40 },
    training: { programId: 'TECHNICAL', intensity: 'NORMAL', individualFocus: {}, lastResults: [] },
    sponsors: { available: [], active: [] },
    media: { stories: [] },
    social: { posts: [], clubFollowers: 0, weeklyImpressions: 0 },
    rivalries: {},
    objectives: { active: [], completed: [], seasonTargets: [] },
    boardPressure: { lastUltimatumCycle: null },
    decisionMemory: { recentTriggers: [] },
    decisionRecord: {},
    legacy: { trophies: [], records: {}, seasonSummaries: [], legends: [], milestones: [] },
    inventory: { ruleCards: [], scoutCredits: 0, cosmeticIds: [], facilityCredits: 0 },
    settings: {
      reducedMotion: false, haptics: true, sound: true, matchSpeed: 'NORMAL', presentation: 'PITCH',
      commentary: true, autoDecisionTimeout: false, region: 'GB', enabledPackIds: ['base'],
      difficulty: 'STANDARD',
    },
    eventLog: [],
    opponentModel: { samples: [] },
    idToken: 'testing',
    idCounters: {},
    analytics: { sessionCount: 0, matchesPlayed: 0, decisionsMade: 0, lastSeenCycle: 0 },
    ...over,
  };
}

/** A minimal facility set covering every effect key the systems read. */
export const TEST_FACILITIES: readonly FacilityDef[] = [
  {
    id: 'training_centre', name: 'Training Centre', description: 'Where the work happens.',
    icon: 'dumbbell', maxLevel: 5,
    upgradeCosts: [500_000, 1_200_000, 2_600_000, 5_000_000, 9_000_000],
    upgradeCycles: [2, 3, 4, 5, 6],
    upkeepPerCycle: [0, 4_000, 9_000, 16_000, 26_000, 40_000],
    levelEffects: ['Basic pitches', 'Better pitches', 'Full gym', 'Sports science', 'Elite complex'],
    effects: { trainingGain: [0, 0.12, 0.25, 0.4, 0.6], injuryResistance: [0, 0.05, 0.1, 0.16, 0.24] },
    category: 'DEVELOPMENT',
  },
  {
    id: 'medical', name: 'Medical Department', description: 'Gets them back faster.',
    icon: 'cross', maxLevel: 5,
    upgradeCosts: [300_000, 800_000, 1_700_000, 3_200_000, 6_000_000],
    upgradeCycles: [1, 2, 3, 4, 5],
    upkeepPerCycle: [0, 3_000, 7_000, 13_000, 21_000, 33_000],
    levelEffects: ['A physio', 'Two physios', 'Rehab suite', 'Sports medicine', 'World class'],
    effects: { injuryRecovery: [0, 0.3, 0.7, 1.2, 1.8], injuryResistance: [0, 0.04, 0.09, 0.15, 0.22] },
    category: 'PERFORMANCE',
  },
  {
    id: 'scouting', name: 'Scouting Network', description: 'Knowledge is the edge.',
    icon: 'binoculars', maxLevel: 5,
    upgradeCosts: [200_000, 600_000, 1_400_000, 2_800_000, 5_200_000],
    upgradeCycles: [1, 2, 3, 4, 5],
    upkeepPerCycle: [0, 2_500, 6_000, 11_000, 18_000, 28_000],
    levelEffects: ['One scout', 'Regional', 'National', 'Continental', 'Global'],
    effects: { scoutSpeed: [0, 0.3, 0.7, 1.1, 1.6], scoutAccuracy: [0, 0.1, 0.22, 0.36, 0.55] },
    category: 'DEVELOPMENT',
  },
  {
    id: 'academy', name: 'Academy', description: 'The next generation.',
    icon: 'sprout', maxLevel: 5,
    upgradeCosts: [400_000, 1_000_000, 2_200_000, 4_400_000, 8_000_000],
    upgradeCycles: [2, 3, 4, 5, 6],
    upkeepPerCycle: [0, 5_000, 11_000, 19_000, 30_000, 46_000],
    levelEffects: ['Local kids', 'Regional intake', 'Residential', 'Category two', 'Category one'],
    effects: { youthQuality: [0, 0.15, 0.3, 0.5, 0.75] },
    category: 'DEVELOPMENT',
  },
  {
    id: 'merchandising', name: 'Merchandising', description: 'Turning attention into revenue.',
    icon: 'shirt', maxLevel: 5,
    upgradeCosts: [250_000, 700_000, 1_500_000, 3_000_000, 5_600_000],
    upgradeCycles: [1, 2, 3, 4, 5],
    upkeepPerCycle: [0, 2_000, 5_000, 9_000, 15_000, 24_000],
    levelEffects: ['Club shop', 'Online store', 'Third-party retail', 'Own label', 'Global distribution'],
    effects: { merchMultiplier: [0, 0.12, 0.26, 0.44, 0.68] },
    category: 'COMMERCIAL',
  },
  {
    id: 'creator_studio', name: 'Creator Studio', description: 'Where the audience is made.',
    icon: 'camera', maxLevel: 5,
    upgradeCosts: [350_000, 900_000, 2_000_000, 3_900_000, 7_200_000],
    upgradeCycles: [1, 2, 3, 4, 5],
    upkeepPerCycle: [0, 4_000, 9_000, 16_000, 26_000, 40_000],
    levelEffects: ['A camera', 'Edit suite', 'Studio', 'Production team', 'Broadcast grade'],
    effects: { creatorReach: [0, 0.15, 0.32, 0.55, 0.85] },
    category: 'COMMERCIAL',
  },
  {
    id: 'stadium', name: 'Stadium', description: 'It buys atmosphere, not solvency.',
    icon: 'stadium', maxLevel: 5,
    upgradeCosts: [1_000_000, 3_000_000, 7_000_000, 14_000_000, 26_000_000],
    upgradeCycles: [3, 4, 5, 6, 8],
    upkeepPerCycle: [0, 8_000, 17_000, 30_000, 48_000, 74_000],
    levelEffects: ['Terraces', 'Covered stand', 'Two stands', 'Modern bowl', 'Landmark'],
    effects: {
      stadiumCapacity: [0, 1_500, 3_500, 7_000, 12_000],
      matchdayRevenue: [0, 0.08, 0.18, 0.3, 0.45],
      atmosphere: [0, 4, 9, 15, 22],
    },
    category: 'FAN',
  },
];

export const TEST_SPONSORS: readonly SponsorTemplate[] = [
  { id: 'sp_local', name: 'Northgate Tools', sector: 'Trade', tier: 1, slots: ['SLEEVE', 'TRAINING'], baseValue: 60_000, accent: '#8899aa', requiresReputation: 0, blurb: 'Local firm, local pride.' },
  { id: 'sp_mid', name: 'Volta Energy', sector: 'Drinks', tier: 2, slots: ['SHIRT', 'STADIUM'], baseValue: 150_000, accent: '#ffcc00', requiresReputation: 35, requiresFollowers: 250_000, blurb: 'Fuel for the ninety.' },
  { id: 'sp_big', name: 'Halcyon Bank', sector: 'Finance', tier: 4, slots: ['SHIRT'], baseValue: 320_000, accent: '#0055ff', requiresReputation: 65, requiresFollowers: 2_000_000, blurb: 'Backing the game.' },
  { id: 'sp_creator', name: 'Loop Studios', sector: 'Media', tier: 3, slots: ['CREATOR'], baseValue: 120_000, accent: '#ff2266', requiresReputation: 45, requiresFollowers: 800_000, blurb: 'Made for the feed.' },
];

export const testRegistry = {
  facilities: (): readonly FacilityDef[] => TEST_FACILITIES,
  sponsors: (): readonly SponsorTemplate[] => TEST_SPONSORS,
};
