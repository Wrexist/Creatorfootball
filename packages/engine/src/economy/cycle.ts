import type { Club, ClubFinance } from '../clubs/club';
import type { Contract } from '../contracts/contract';
import type { ClubId } from '../core/brand';
import { clamp, clamp01, decayToward } from '../core/math';
import type { Rng } from '../core/rng';
import { advanceFacilities, facilityEffect, type FacilityRegistry } from '../facilities/facilities';
import { attendanceFor, clubReach, matchdayRevenue, updateFanState, type FanInputs, type RevenueBreakdown } from '../fans/fans';
import type { GameState, SponsorState } from '../game/state';
import { traitModifier } from '../players/traits';
import { advanceSponsorDeals, sponsorMarketIndex, type SponsorContext, type SponsorProgress } from '../sponsors/sponsors';
import { ECONOMY_BALANCE as E } from './balance';
import type { Ledger, PostContext } from './ledger';

/**
 * The financial cycle.
 *
 * Everything the club earns and everything it owes passes through here once per
 * cycle, and every single movement is a Ledger transaction with a memo a player
 * could read on a bank statement. Nothing anywhere in this codebase adjusts a
 * balance directly.
 *
 * The shape of the income is the design statement: sponsorship (bought with
 * reach) dominates, merchandise (bought with reach and fandom) follows, and the
 * gate is a minor line. See economy/balance.ts for the research this is drawn
 * from. A club that grows its audience gets rich; a club that grows its
 * *stadium* does not.
 *
 * A club that cannot pay wages does not silently go negative. It draws an
 * emergency board loan — which is recorded, carries interest, and has a ceiling
 * — and past that ceiling it enters a modelled insolvency with sporting
 * consequences. Wages are therefore ALWAYS paid in full, which is what lets
 * `auditEconomy` treat a wage mismatch as a genuine integrity failure.
 */

export type DistressLevel = 'NONE' | 'WATCH' | 'STRAIN' | 'CRISIS' | 'INSOLVENT';

export interface FinancialDistress {
  readonly level: DistressLevel;
  readonly loanDrawn: number;
  readonly debt: number;
  readonly cyclesOfWagesCovered: number;
  readonly message: string;
  /** Set while insolvent: the board blocks incoming transfers. */
  readonly transferEmbargo: boolean;
  /** Set while insolvent: the club must raise money by selling. */
  readonly mustSell: boolean;
}

export interface IncomeBreakdown {
  readonly sponsorship: number;
  readonly merchandise: number;
  readonly matchday: number;
  readonly other: number;
  readonly total: number;
}

export interface ExpenditureBreakdown {
  readonly wages: number;
  readonly facilityUpkeep: number;
  readonly debtService: number;
  readonly penalties: number;
  readonly total: number;
}

export interface FinanceCycleContext {
  readonly clubId: ClubId;
  readonly cycle: number;
  readonly season: number;
  readonly at: number;
  readonly seed: string;
  readonly registry: FacilityRegistry;
  /** Carried on the context so the exported signature stays `(state, ledger, ctx)`. */
  readonly rng: Rng;
  /** Reach delivered by the club's creators this cycle, in impressions. */
  readonly creatorReach: number;
  readonly previousReach?: number;
  /** Mean `fanConversion` of attached creators, 0-1. The reach → fandom lever. */
  readonly creatorFanConversion: number;
  readonly leaguePosition: number;
  readonly leagueSize: number;
  readonly recentResults: readonly ('W' | 'D' | 'L')[];
  /** Present when the club played at home this cycle. */
  readonly homeFixtureImportance?: number;
  readonly entertainment?: number;
  readonly netTransferSpend?: number;
  readonly marqueeSignings?: number;
  readonly cultHeroesSold?: number;
  readonly derbyResult?: 'W' | 'D' | 'L';
  readonly trophyWon?: boolean;
  readonly trophiesWon?: number;
  readonly relegated?: boolean;
  readonly managerBrandBuilding?: number;
  readonly sponsorProgress?: SponsorProgress;
}

export interface FinanceCycleResult {
  readonly club: Club;
  readonly sponsors: SponsorState;
  readonly income: IncomeBreakdown;
  readonly expenditure: ExpenditureBreakdown;
  readonly net: number;
  readonly matchday: RevenueBreakdown | null;
  readonly attendance: number | null;
  readonly distress: FinancialDistress;
  readonly reach: number;
  /** Share of gross income from each line. Asserted against the mix target in tests. */
  readonly mix: Readonly<Record<string, number>>;
  readonly notes: readonly string[];
}

function contractsFor(state: GameState, club: Club): Contract[] {
  const out: Contract[] = [];
  for (const playerId of club.squad) {
    const player = state.players[playerId];
    if (!player?.contractId) continue;
    const contract = state.contracts[player.contractId];
    if (contract && contract.clubId === club.id) out.push(contract);
  }
  return out;
}

/** Merch demand: mostly reach, partly fandom, priced with real elasticity. */
export function merchandiseRevenue(
  club: Club,
  reach: number,
  starCommercialValue: number,
  merchMultiplier: number,
): number {
  const price = Math.max(1, club.finance.merchPrice);
  const priceFactor = clamp(
    (price / E.MERCH_PRICE_REFERENCE) ** E.MERCH_ELASTICITY,
    E.MERCH_FACTOR_MIN,
    E.MERCH_FACTOR_MAX,
  );
  const volume =
    club.fans.base * E.MERCH_PER_FAN +
    Math.pow(Math.max(0, reach), E.MERCH_REACH_EXPONENT) * E.MERCH_PER_REACH;
  const stars = 1 + clamp(starCommercialValue, -0.5, 2) * E.MERCH_STAR_SWING;
  return Math.max(
    0,
    Math.round(volume * (price / E.MERCH_PRICE_REFERENCE) * priceFactor * stars * (1 + merchMultiplier)),
  );
}

/** Summed `commercialValue` trait modifiers across the squad. */
function squadCommercialValue(state: GameState, club: Club): number {
  let total = 0;
  for (const id of club.squad) {
    const player = state.players[id];
    if (player) total += traitModifier(player.traitIds, 'commercialValue');
  }
  return total;
}

/** Summed `fanAppeal` across the squad, normalised to 0-1 for the fan model. */
function squadStarAppeal(state: GameState, club: Club): number {
  let total = 0;
  for (const id of club.squad) {
    const player = state.players[id];
    if (player) total += traitModifier(player.traitIds, 'fanAppeal');
  }
  return clamp01(total / 1.2);
}

/**
 * Run one financial cycle for one club. Returns a new Club and a full set of
 * described movements; nothing passed in is mutated.
 */
export function runFinancialCycle(
  state: GameState,
  ledger: Ledger,
  ctx: FinanceCycleContext,
): FinanceCycleResult {
  const original = state.clubs[ctx.clubId];
  if (!original) throw new Error(`runFinancialCycle: unknown club ${ctx.clubId}`);

  const postCtx: PostContext = { cycle: ctx.cycle, season: ctx.season, at: ctx.at };
  const stream = ctx.rng.fork(`finance:${ctx.clubId}:${ctx.cycle}`);
  const notes: string[] = [];

  const contracts = contractsFor(state, original);
  const wageBill = contracts.reduce((sum, c) => sum + Math.max(0, c.wage), 0);

  // --- 1. Facilities: finish builds, pay upkeep -----------------------------
  const facilityResult = advanceFacilities(original, ctx.registry, ledger, postCtx, stream);
  let club = facilityResult.club;
  for (const done of facilityResult.completed) {
    notes.push(`${done.name} upgrade completed (level ${done.level}).`);
  }
  for (const bad of facilityResult.degraded) {
    notes.push(`${bad.name} has fallen into disrepair — you skipped the upkeep.`);
  }

  const reach = clubReach(club.fans, ctx.creatorReach) *
    (1 + facilityEffect(club, 'creatorReach', ctx.registry));

  // --- 2. Sponsorship: the dominant line ------------------------------------
  const sponsorCtx: SponsorContext = {
    cycle: ctx.cycle,
    season: ctx.season,
    reach,
    previousReach: ctx.previousReach ?? reach,
    leaguePosition: ctx.leaguePosition,
    leagueSize: ctx.leagueSize,
    brandBuilding: ctx.managerBrandBuilding ?? 50,
    creatorReachBonus: facilityEffect(club, 'creatorReach', ctx.registry),
    seed: ctx.seed,
  };
  const sponsorResult = advanceSponsorDeals(
    club,
    state.sponsors,
    ctx.sponsorProgress ?? {},
    stream,
    ledger,
    sponsorCtx,
    postCtx,
  );
  notes.push(...sponsorResult.notes);
  const sponsorship = sponsorResult.income + sponsorResult.bonusesPaid;

  // --- 3. Matchday: real, felt, and deliberately small -----------------------
  let attendance: number | null = null;
  let matchday: RevenueBreakdown | null = null;
  if (ctx.homeFixtureImportance !== undefined) {
    attendance = attendanceFor(club, ctx.homeFixtureImportance, stream);
    matchday = matchdayRevenue(club, attendance);
    const matchdayBonus = facilityEffect(club, 'matchdayRevenue', ctx.registry);
    const gross = Math.round(matchday.total * (1 + matchdayBonus));
    ledger.credit(club.id, 'TICKET_REVENUE', gross,
      `Matchday income vs. ${attendance.toLocaleString('en-GB')} in the ground`, postCtx,
      { idempotencyKey: `matchday:${club.id}:${ctx.cycle}` });
    matchday = { ...matchday, total: gross };
    club = { ...club, fans: { ...club.fans, lastAttendance: attendance } };
  }

  // --- 4. Merchandise --------------------------------------------------------
  const merchandise = merchandiseRevenue(
    club,
    reach,
    squadCommercialValue(state, club),
    facilityEffect(club, 'merchMultiplier', ctx.registry),
  );
  ledger.credit(club.id, 'MERCH_REVENUE', merchandise,
    `Retail and licensing (reach ${(reach / 1000).toFixed(0)}k)`, postCtx,
    { idempotencyKey: `merch:${club.id}:${ctx.cycle}` });

  const grossIncome = sponsorship + merchandise + (matchday?.total ?? 0);

  // --- 5. Wages: always paid, borrowing if it comes to that ------------------
  const cashBefore = ledger.cashOf(club.id);
  let loanDrawn = 0;
  let debt = club.finance.debt;

  if (cashBefore < wageBill && wageBill > 0) {
    const shortfall = wageBill - cashBefore;
    loanDrawn = Math.round(shortfall + wageBill * E.LOAN_BUFFER_CYCLES);
    ledger.credit(club.id, 'GRANT', loanDrawn,
      `Emergency board loan to cover the wage bill`, postCtx,
      { metadata: { kind: 'emergency-loan' } });
    debt += Math.round(loanDrawn * (1 + E.LOAN_INTEREST));
    notes.push(`The board covered a ${shortfall.toLocaleString('en-GB')} shortfall. It is a loan, not a gift.`);
  }

  if (wageBill > 0) {
    ledger.debit(club.id, 'WAGES', wageBill,
      `Squad wages, ${contracts.length} players`, postCtx,
      { idempotencyKey: `wages:${club.id}:${ctx.cycle}`, allowOverdraft: false });
  }

  // --- 6. Debt service -------------------------------------------------------
  let debtService = 0;
  const reserve = wageBill * E.DEBT_REPAYMENT_RESERVE_CYCLES;
  if (debt > 0 && ledger.cashOf(club.id) > reserve) {
    const affordable = Math.min(
      Math.round(debt * E.DEBT_REPAYMENT_RATE),
      Math.round(ledger.cashOf(club.id) - reserve),
    );
    if (affordable > 0) {
      const posted = ledger.debit(club.id, 'ADJUSTMENT', affordable,
        'Debt repayment to the board', postCtx);
      if (posted.ok) {
        debtService = affordable;
        debt = Math.max(0, debt - affordable);
      }
    }
  }

  // --- 7. Distress ------------------------------------------------------------
  const cashAfter = ledger.cashOf(club.id);
  const cyclesCovered = wageBill > 0 ? cashAfter / wageBill : Infinity;
  const ceiling = Math.max(1, wageBill) * E.DEBT_CEILING_WAGE_MULTIPLE;
  const insolvent = debt > ceiling;

  const level: DistressLevel = insolvent
    ? 'INSOLVENT'
    : loanDrawn > 0
      ? 'CRISIS'
      : cyclesCovered < E.STRAIN_RATIO
        ? 'STRAIN'
        : cyclesCovered < E.WATCH_RATIO
          ? 'WATCH'
          : 'NONE';

  const distress: FinancialDistress = {
    level,
    loanDrawn,
    debt: Math.round(debt),
    cyclesOfWagesCovered: Number.isFinite(cyclesCovered) ? Math.round(cyclesCovered * 10) / 10 : 99,
    transferEmbargo: insolvent,
    mustSell: insolvent || level === 'CRISIS',
    message: distressMessage(level, cyclesCovered),
  };
  if (level !== 'NONE') notes.push(distress.message);

  // --- 8. Fans, reputation and budgets ---------------------------------------
  const fanInputs: FanInputs = {
    cycle: ctx.cycle,
    recentResults: ctx.recentResults,
    leaguePosition: ctx.leaguePosition,
    leagueSize: ctx.leagueSize,
    reputation: club.reputation,
    creatorReach: ctx.creatorReach,
    creatorFanConversion: ctx.creatorFanConversion,
    entertainment: ctx.entertainment ?? 0.5,
    starAppeal: squadStarAppeal(state, club),
    ticketPrice: club.finance.ticketPrice,
    netTransferSpend: ctx.netTransferSpend ?? 0,
    marqueeSignings: ctx.marqueeSignings ?? 0,
    cultHeroesSold: ctx.cultHeroesSold ?? 0,
    derbyResult: ctx.derbyResult,
    trophyWon: ctx.trophyWon,
    relegated: ctx.relegated,
    trophiesWon: ctx.trophiesWon ?? 0,
    stadiumCapacity: club.stadium.capacity,
  };
  let fans = updateFanState(club, fanInputs, stream);
  fans = {
    ...fans,
    sentiment: clamp(
      fans.sentiment + sponsorResult.sentimentDelta - (insolvent ? E.INSOLVENCY_SENTIMENT_HIT : 0),
      0,
      100,
    ),
  };

  const positional = clamp01(1 - (ctx.leaguePosition - 1) / Math.max(1, ctx.leagueSize - 1));
  const reputationTarget = clamp(
    positional * E.REPUTATION_FROM_POSITION +
      clamp01(reach / 4_000_000) * E.REPUTATION_FROM_REACH +
      (fans.sentiment / 100) * E.REPUTATION_FROM_SENTIMENT,
    1,
    100,
  );
  const reputation = clamp(
    decayToward(club.reputation, reputationTarget, E.REPUTATION_DRIFT) +
      sponsorResult.reputationDelta -
      (insolvent ? E.INSOLVENCY_REPUTATION_HIT : 0),
    1,
    100,
  );

  const expenditureTotal =
    wageBill + facilityResult.upkeepPaid + debtService + sponsorResult.penalties;
  const net = grossIncome - expenditureTotal;

  const sustainableIncome = sponsorship + merchandise;
  const wageBudgetTarget = insolvent
    ? wageBill * E.INSOLVENCY_WAGE_BUDGET_RATIO
    : sustainableIncome * E.WAGE_BUDGET_INCOME_SHARE;
  const finance: ClubFinance = {
    ...club.finance,
    wageBudgetPerCycle: Math.round(
      decayToward(club.finance.wageBudgetPerCycle, wageBudgetTarget, E.WAGE_BUDGET_DRIFT),
    ),
    transferBudget: Math.max(
      0,
      Math.round(
        club.finance.transferBudget + (net > 0 && !insolvent ? net * E.SURPLUS_TO_TRANSFER_BUDGET : net),
      ),
    ),
    lastCycleIncome: grossIncome,
    lastCycleExpenditure: expenditureTotal,
    debt: Math.round(debt),
  };

  if (wageBill > 0 && cashAfter < wageBill * E.LOW_BALANCE_WARNING_CYCLES) {
    notes.push(`Cash is down to ${Math.round(cashAfter).toLocaleString('en-GB')} — barely a cycle of wages.`);
  }

  const income: IncomeBreakdown = {
    sponsorship,
    merchandise,
    matchday: matchday?.total ?? 0,
    other: 0,
    total: grossIncome,
  };
  const expenditure: ExpenditureBreakdown = {
    wages: wageBill,
    facilityUpkeep: facilityResult.upkeepPaid,
    debtService,
    penalties: sponsorResult.penalties,
    total: expenditureTotal,
  };
  const denominator = Math.max(1, grossIncome);

  return {
    club: { ...club, fans, reputation, finance },
    sponsors: sponsorResult.sponsors,
    income,
    expenditure,
    net,
    matchday,
    attendance,
    distress,
    reach,
    mix: {
      sponsorship: income.sponsorship / denominator,
      merchandise: income.merchandise / denominator,
      matchday: income.matchday / denominator,
    },
    notes,
  };
}

function distressMessage(level: DistressLevel, cyclesCovered: number): string {
  switch (level) {
    case 'INSOLVENT':
      return 'The club is insolvent. The board has frozen incoming transfers and wants players sold.';
    case 'CRISIS':
      return 'You could not meet the wage bill from your own money. The board stepped in, and they will want it back.';
    case 'STRAIN':
      return `Under a cycle and a half of wages in the bank. Something has to give.`;
    case 'WATCH':
      return `Cash covers roughly ${Math.max(0, Math.round(cyclesCovered))} cycles of wages. The board is watching.`;
    default:
      return 'Finances are in good order.';
  }
}

/** The current sponsorship climate, surfaced for the finance screen. */
export const commercialClimate = (seed: string, cycle: number): number =>
  sponsorMarketIndex(seed, cycle);
