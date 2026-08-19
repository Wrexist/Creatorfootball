import { asId } from '../core/brand';
import type {
  ClubId, CompetitionId, ContractId, CreatorId, ManagerId, SeasonId,
} from '../core/brand';
import { initialClock } from '../core/clock';
import { Rng } from '../core/rng';
import { clamp } from '../core/math';
import { Ledger } from '../economy/ledger';
import type { GameState, GameSettings } from './state';
import type { Player } from '../players/player';
import type { Club, ClubPhilosophy, ClubVisualIdentity, FanCulture } from '../clubs/club';
import type { Contract, SquadRole } from '../contracts/contract';
import type { Manager } from '../creators/manager';
import type { Creator } from '../creators/creator';
import type { Competition, Fixture, Season } from '../league/types';
import { generateFixtures } from '../league/fixtures';
import { emptyBonuses } from '../contracts/contract';
import { defaultValuationContext, marketValue, wageDemand } from '../transfers/valuation';
import {
  BASE_PACK, ContentRegistry, DEFAULT_FORMATION_ID, clubFromTemplate,
  generateManager, generateSquad, generateCreator,
  type ClubTemplate, type ContentPack, type CreatorSeasonConfigDef,
} from '../content';
import { generateSponsorOffers, inheritedSponsorDeals } from '../sponsors/sponsors';

/**
 * New game creation.
 *
 * Builds an entire living league from content templates and a single seed.
 * Nothing here reads a clock or calls Math.random: the same seed and the same
 * choices produce a byte-identical world, which is what lets the balance
 * harness replay a season and lets a support ticket be reproduced from a seed
 * string alone.
 *
 * The order matters. Clubs must exist before squads (squads need a club id and
 * a strength target), squads before contracts (wages are derived from the
 * player), contracts before the ledger opening (budgets account for the wage
 * bill), and everything before fixtures.
 */

export type ClubChoice =
  | { readonly kind: 'TEMPLATE'; readonly templateId: string }
  | {
      readonly kind: 'CUSTOM';
      readonly name: string;
      readonly shortName: string;
      readonly abbreviation: string;
      readonly city: string;
      readonly philosophy: ClubPhilosophy;
      readonly fanCulture: FanCulture;
      readonly visual: ClubVisualIdentity;
      readonly motto: string;
    };

export type ManagerChoice =
  | { readonly kind: 'PREMADE'; readonly templateId: string }
  | {
      readonly kind: 'CUSTOM';
      readonly name: string;
      readonly archetypeId: string;
      readonly appearance: Manager['appearance'];
      readonly mediaStyle: Manager['mediaStyle'];
      readonly socialPersonality: Manager['socialPersonality'];
    };

export interface NewGameOptions {
  readonly seed: string;
  /** Wall clock, for display only. Never simulated from. */
  readonly now: number;
  readonly manager: ManagerChoice;
  readonly club: ClubChoice;
  /** Extra packs on top of the base pack. */
  readonly packs?: readonly ContentPack[];
  readonly settings?: Partial<GameSettings>;
}

/**
 * A custom club takes the weakest slot in the league rather than becoming a
 * thirteenth team. Two reasons: the fixture list stays a clean round robin, and
 * starting at the bottom is the right opening position for a game whose whole
 * pitch is "I built this club" — inheriting the champion's squad would skip the
 * story.
 */
const CUSTOM_CLUB_STRENGTH_PENALTY = 2;

function resolveClubTemplates(choice: ClubChoice, registry: ContentRegistry): {
  templates: ClubTemplate[];
  playerTemplateId: string;
} {
  const templates = registry.clubs().slice();
  if (choice.kind === 'TEMPLATE') {
    const found = templates.find((t) => t.id === choice.templateId);
    if (!found) throw new Error(`Unknown club template: ${choice.templateId}`);
    return { templates, playerTemplateId: found.id };
  }

  const weakestIndex = templates.reduce(
    (worst, t, i) => (t.strength < (templates[worst] as ClubTemplate).strength ? i : worst),
    0,
  );
  const slot = templates[weakestIndex] as ClubTemplate;
  const custom: ClubTemplate = {
    ...slot,
    id: 'club_player',
    name: choice.name,
    shortName: choice.shortName,
    abbreviation: choice.abbreviation,
    city: choice.city,
    philosophy: choice.philosophy,
    fanCulture: choice.fanCulture,
    motto: choice.motto,
    visual: {
      primary: choice.visual.primary,
      secondary: choice.visual.secondary,
      accent: choice.visual.accent,
      badgeShape: choice.visual.badgeShape,
      badgeMotif: choice.visual.badgeMotif,
      style: choice.visual.style,
      kitPattern: choice.visual.kitPattern,
    },
    // A brand-new club has no history to trade on, so it starts a shade below
    // the slot it inherited — but keeps that slot's rivals, so week one already
    // has someone to hate.
    strength: Math.max(40, slot.strength - CUSTOM_CLUB_STRENGTH_PENALTY),
    reputation: Math.max(20, slot.reputation - 6),
    stadiumName: `${choice.city} Ground`,
    founded: 2026,
  };
  templates[weakestIndex] = custom;
  return { templates, playerTemplateId: custom.id };
}

/** Squad role from where a player sits in his own squad's pecking order. */
function roleForRank(rank: number, size: number): SquadRole {
  const share = rank / Math.max(1, size);
  if (rank === 0) return 'STAR';
  if (share < 0.45) return 'STARTER';
  if (share < 0.7) return 'ROTATION';
  return 'SQUAD';
}

export function createNewGame(opts: NewGameOptions): GameState {
  const rng = new Rng(opts.seed);
  const registry = new ContentRegistry();
  registry.load(BASE_PACK);
  for (const pack of opts.packs ?? []) registry.load(pack);

  const config = registry.seasonConfig() as CreatorSeasonConfigDef;
  const nameBank = registry.nameBank();
  const { templates, playerTemplateId } = resolveClubTemplates(opts.club, registry);

  const clubs: Record<string, Club> = {};
  const players: Record<string, Player> = {};
  const contracts: Record<string, Contract> = {};
  const managers: Record<string, Manager> = {};
  const creators: Record<string, Creator> = {};

  const templateToClubId = new Map<string, ClubId>();
  const ledger = new Ledger();
  const ledgerCtx = { cycle: 0, season: 1, at: opts.now };

  // --- clubs and squads -------------------------------------------------
  const clubRng = rng.fork('clubs');
  const squadRng = rng.fork('squads');

  templates.forEach((template, index) => {
    const clubId = asId<ClubId>(`club_${index}`);
    templateToClubId.set(template.id, clubId);
    const isPlayerClub = template.id === playerTemplateId;

    const club = clubFromTemplate(clubRng, template, clubId, {
      isPlayerClub,
      startingBudget: template.budget,
    });

    const squad = generateSquad(squadRng, {
      targetOverall: template.strength,
      size: config.squadSize,
      clubId,
      nameBank,
      homeNation: nameBank.nationalities[index % nameBank.nationalities.length]?.code,
      idPrefix: `p${index}`,
      // Stronger clubs are top-heavy; strugglers are flat. This is what makes a
      // weak squad feel like a weak squad rather than a uniformly poor one.
      talentSpread: clamp(14 - (template.strength - 55) * 0.12, 6, 14),
    });

    const ranked = squad.slice().sort((a, b) => b.overall - a.overall);
    const squadOveralls = ranked.map((p) => p.overall);

    ranked.forEach((player, rank) => {
      const role = roleForRank(rank, ranked.length);
      const valuationCtx = defaultValuationContext({
        leagueAverageOverall: 62,
        sellingSquadOveralls: squadOveralls,
      });
      const wage = Math.round(wageDemand(player, valuationCtx) * (role === 'STAR' ? 1.15 : 1));
      const contractId = asId<ContractId>(`ct_${clubId}_${rank}`);

      contracts[contractId] = {
        id: contractId,
        playerId: player.id,
        clubId,
        wage,
        // Stagger expiry so the first transfer window is not the entire league
        // out of contract at once.
        weeksRemaining: squadRng.int(config.rounds * 11, config.rounds * 11 * 3),
        totalWeeks: config.rounds * 11 * 3,
        signingBonus: 0,
        bonuses: emptyBonuses(),
        role,
        releaseClause: rank < 3 && squadRng.chance(0.35)
          ? Math.round(marketValue(player, valuationCtx) * 1.8)
          : null,
        loyaltyBonus: 0,
        signedCycle: 0,
        minutesPlayed: 0,
        minutesAvailable: 0,
      };

      players[player.id] = {
        ...player,
        clubId,
        contractId,
        marketValue: marketValue(player, valuationCtx),
        // The player only knows his own squad in full. Everyone else starts
        // behind a scouting fog, which is what makes scouting worth paying for.
        scouting: isPlayerClub ? { confidence: 1, revealed: [] } : { confidence: 0, revealed: [] },
      };
    });

    // Wage budgets are derived from the squad the club actually has, not from
    // the template's guess. Valuation is the source of truth for what a player
    // costs, so a hand-authored budget would drift out of step with it the
    // moment wages are retuned — and a club that starts the game unable to pay
    // its own squad is a broken start, not a difficulty setting. Headroom
    // scales with reputation: a rich club can absorb a signing, a poor one
    // must sell first.
    const squadWageBill = ranked.reduce(
      (total, _p, rank) => total + (contracts[`ct_${clubId}_${rank}`]?.wage ?? 0),
      0,
    );
    const headroom = 1.08 + clamp((template.reputation - 30) / 70, 0, 1) * 0.28;

    clubs[clubId] = {
      ...club,
      squad: ranked.map((p) => p.id),
      tactics: { ...club.tactics, formationId: DEFAULT_FORMATION_ID },
      finance: {
        ...club.finance,
        wageBudgetPerCycle: Math.round(squadWageBill * headroom),
        transferBudget: Math.round(template.budget * 0.55),
      },
    };

    ledger.open(clubId, template.budget, ledgerCtx);
  });

  const playerClubId = templateToClubId.get(playerTemplateId) as ClubId;

  // --- managers ---------------------------------------------------------
  const managerRng = rng.fork('managers');
  const premade = registry.managers();

  const playerManagerId = asId<ManagerId>('mgr_player');
  const choice = opts.manager;
  const playerManager = choice.kind === 'PREMADE'
    ? generateManager(managerRng, {
        template: premade.find((m) => m.id === choice.templateId),
        isPlayer: true,
        clubId: playerClubId,
        id: playerManagerId,
      })
    : generateManager(managerRng, {
        name: choice.name,
        archetypeId: choice.archetypeId,
        appearance: choice.appearance,
        mediaStyle: choice.mediaStyle,
        socialPersonality: choice.socialPersonality,
        isPlayer: true,
        clubId: playerClubId,
        id: playerManagerId,
      } as Parameters<typeof generateManager>[1]);

  managers[playerManagerId] = playerManager;
  clubs[playerClubId] = { ...(clubs[playerClubId] as Club), managerId: playerManagerId, isPlayerClub: true };

  for (const [templateId, clubId] of templateToClubId) {
    if (clubId === playerClubId) continue;
    const template = templates.find((t) => t.id === templateId) as ClubTemplate;
    const managerId = asId<ManagerId>(`mgr_${clubId}`);
    managers[managerId] = generateManager(managerRng, {
      clubId,
      id: managerId,
      isPlayer: false,
      // Better clubs employ better managers. Anything else makes reputation
      // meaningless as a progression currency.
      quality: clamp((template.reputation - 30) / 70, 0.1, 0.95),
      reputation: template.reputation,
    });
    clubs[clubId] = { ...(clubs[clubId] as Club), managerId };
  }

  // --- creators ---------------------------------------------------------
  const creatorRng = rng.fork('creators');
  registry.creators().forEach((template, index) => {
    const creatorId = asId<CreatorId>(`cr_${index}`);
    const clubId = template.clubTemplateId ? templateToClubId.get(template.clubTemplateId) ?? null : null;
    const creator = generateCreator(creatorRng, {
      template,
      id: creatorId,
      clubId,
    } as Parameters<typeof generateCreator>[1]);
    creators[creatorId] = creator;
    if (clubId && clubs[clubId]) {
      const club = clubs[clubId] as Club;
      clubs[clubId] = { ...club, creatorIds: [...club.creatorIds, creatorId] };
    }
  });

  // --- competition, season, fixtures -----------------------------------
  const competitionId = asId<CompetitionId>('comp_premier');
  const seasonId = asId<SeasonId>('season_1');
  const clubIds = [...templateToClubId.values()];

  const rivalPairs: (readonly [ClubId, ClubId])[] = [];
  for (const template of templates) {
    const a = templateToClubId.get(template.id);
    if (!a) continue;
    for (const rivalTemplateId of template.rivalOf ?? []) {
      const b = templateToClubId.get(rivalTemplateId);
      if (!b || a === b) continue;
      const exists = rivalPairs.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
      if (!exists) rivalPairs.push([a, b]);
    }
  }

  const competition: Competition = {
    id: competitionId,
    name: 'The Creator League',
    shortName: 'CL',
    format: 'LEAGUE',
    tier: 1,
    clubIds,
    rounds: config.rounds,
    playoffSpots: config.playoffSpots,
    relegationSpots: config.relegationSpots,
    prizeMoney: config.prizeMoney,
    accent: '#c8ff2e',
    enabledSpecialRules: ['DOUBLE_GOAL', 'POWER_PLAY', 'LAST_STAND', 'ALL_IN', 'CREATOR_MOMENT'],
  };

  const totalWeeks = ((clubIds.length - 1) * config.rounds);
  const fixtureList = generateFixtures(
    {
      competitionId,
      seasonId,
      clubIds,
      rounds: config.rounds,
      rivalPairs,
      enabledSpecialRules: competition.enabledSpecialRules,
      // Rules fire in a handful of designated weeks so they stay an event.
      specialRuleWeeks: [3, 7, 11, 15, 19, totalWeeks],
    },
    rng.fork('fixtures'),
  );

  const fixtures: Record<string, Fixture> = {};
  for (const fixture of fixtureList) fixtures[fixture.id] = fixture;

  const season: Season = {
    id: seasonId,
    number: 1,
    competitionId,
    totalWeeks,
    currentWeek: 0,
    phase: 'PRE_SEASON',
    completed: false,
    championClubId: null,
    playerFinalPosition: null,
  };

  // --- opening sponsorship ---------------------------------------------
  // Every real club already has a shirt sponsor on the day you take over, so
  // the inherited deal is built directly rather than drawn from the offer
  // generator — that generator is gated by the market climate and on some
  // seeds legitimately returns nothing, which is right for a club shopping for
  // a new partner and wrong for the deal it already has.
  const sponsorRng = rng.fork('openingSponsors');
  const playerClub = clubs[playerClubId] as Club;
  const openingCreators = Object.values(creators).filter((c) => c.clubId === playerClubId);
  const sponsorCtx = {
    cycle: 0,
    season: 1,
    // Reach is club followers plus everything the attached creators command;
    // using the club's own following alone undervalued every deal.
    reach:
      playerClub.fans.onlineFollowers +
      openingCreators.reduce((total, c) => total + c.followers, 0),
    leaguePosition: templates.length,
    leagueSize: templates.length,
    brandBuilding: playerManager.attributes.brandBuilding,
    seed: opts.seed,
  };

  // A club arrives with a portfolio, not a single shirt deal — real clubs
  // monetise several slots, and starting with one left sponsorship, the
  // dominant income line by design, at a fifth of what it should be.
  const activeDeals = inheritedSponsorDeals(playerClub, registry, sponsorRng, sponsorCtx);
  const openingOffers = generateSponsorOffers(
    playerClub, registry, sponsorRng, sponsorCtx, activeDeals,
  );

  const settings: GameSettings = {
    reducedMotion: false,
    haptics: true,
    matchSpeed: 'NORMAL',
    presentation: 'PITCH',
    commentary: true,
    autoDecisionTimeout: true,
    region: 'GB',
    enabledPackIds: [BASE_PACK.manifest.id, ...(opts.packs ?? []).map((p) => p.manifest.id)],
    difficulty: 'STANDARD',
    ...opts.settings,
  };

  return {
    version: 1,
    saveId: `save_${opts.seed}`,
    seed: opts.seed,
    createdAt: opts.now,
    clock: initialClock(opts.now),
    playerClubId,
    playerManagerId,
    players,
    creators,
    managers,
    clubs,
    contracts,
    competitions: { [competitionId]: competition },
    fixtures,
    seasons: { [seasonId]: season },
    currentSeasonId: seasonId,
    currentCompetitionId: competitionId,
    ledger: ledger.snapshot(),
    transfers: { listings: {}, negotiations: {}, completed: [], windowOpen: false, rumours: [] },
    scouting: { assignments: [], shortlist: [], weeklyCapacity: 2, network: 25 },
    training: { programId: 'balanced', intensity: 'NORMAL', individualFocus: {}, lastResults: [] },
    sponsors: { available: openingOffers, active: activeDeals },
    media: { stories: [] },
    social: {
      posts: [],
      clubFollowers: (clubs[playerClubId] as Club).fans.onlineFollowers,
      weeklyImpressions: 0,
    },
    rivalries: {},
    objectives: { active: [], completed: [], seasonTargets: [] },
    legacy: { trophies: [], records: {}, seasonSummaries: [], legends: [], milestones: [] },
    inventory: { ruleCards: [], scoutCredits: 3, cosmeticIds: [], facilityCredits: 0 },
    settings,
    eventLog: [],
    idCounters: {},
    analytics: { sessionCount: 1, matchesPlayed: 0, decisionsMade: 0, lastSeenCycle: 0 },
  };
}
