import type { Club } from '../clubs/club';
import { contractFromTerms, demandedTerms, evaluateTermsOffer, packageValue, type TalksContext } from '../contracts/negotiation';
import type { Contract } from '../contracts/contract';
import type { ClubId, ContractId, TransferId } from '../core/brand';
import type { IdFactory } from '../core/ids';
import { clamp, clamp01 } from '../core/math';
import type { Rng } from '../core/rng';
import { clubAccount, type Ledger, type PostContext } from '../economy/ledger';
import type { CompletedTransfer, Negotiation, NegotiationStage, NegotiationTerms } from '../game/state';
import type { Player } from '../players/player';
import { NEGOTIATION_BALANCE as N } from './balance';
import { askingPrice, type ValuationContext } from './valuation';

/**
 * The transfer negotiation flow.
 *
 * A transfer is never a button. It is a sequence of conversations — the selling
 * club about the fee, the player about wages and role, the agent about his cut —
 * each of which can stall, sour or be gatecrashed. The design intent is that
 * every terminal outcome is a *story*: you did not "fail to buy a striker", you
 * dithered for three cycles and a rival went over the top of you.
 *
 * All chance flows through the injected Rng. The maths that decides whether an
 * offer is good enough is deterministic and lives in contracts/negotiation.ts;
 * this file only decides when the world gets a roll of the dice.
 */

export type NegotiationOutcome =
  | 'ACCEPTED'
  | 'REJECTED'
  | 'COUNTERED'
  | 'DELAYED'
  | 'PLAYER_LOST_INTEREST'
  | 'HIJACKED'
  | 'COLLAPSED'
  | 'AGREED'
  | 'CLOSED';

export interface NegotiationBeat {
  readonly cycle: number;
  readonly actor: string;
  readonly text: string;
}

export interface NegotiationStep {
  readonly negotiation: Negotiation;
  readonly outcome: NegotiationOutcome;
  /** One line the UI can headline. Always story-shaped, never "error". */
  readonly headline: string;
  readonly detail: string;
  readonly counter: NegotiationTerms | null;
  readonly beats: readonly NegotiationBeat[];
}

export interface RivalClub {
  readonly clubId: ClubId;
  readonly name: string;
  readonly reputation: number;
  /** Cash the rival could plausibly commit. Gates whether they can actually hijack. */
  readonly spendingPower: number;
}

export interface NegotiationContext {
  readonly id: string;
  readonly cycle: number;
  readonly season: number;
  readonly player: Player;
  readonly sellingClub: Club | null;
  readonly buyingClub: Club;
  readonly contract: Contract | null;
  readonly valuation: ValuationContext;
  readonly leaguePosition: number;
  readonly leagueSize: number;
  /** Manager charisma — the single attribute that most helps close a deal. */
  readonly managerCharisma: number;
  readonly managerNegotiation: number;
  readonly rivals: readonly RivalClub[];
  /** How the player's current club has used him, -1..+1. Drives push motivation. */
  readonly rolePromiseDelta?: number;
}

const TERMINAL: readonly NegotiationStage[] = ['AGREED', 'FAILED', 'HIJACKED'];
export const isTerminal = (n: Negotiation): boolean => TERMINAL.includes(n.stage);

function talksFrom(ctx: NegotiationContext): TalksContext {
  return {
    valuation: { ...ctx.valuation, buyingClubReputation: ctx.buyingClub.reputation },
    clubReputation: ctx.buyingClub.reputation,
    leaguePosition: ctx.leaguePosition,
    leagueSize: ctx.leagueSize,
    managerCharisma: ctx.managerCharisma,
    currentClubReputation: ctx.sellingClub?.reputation,
    isRenewal: false,
    rolePromiseDelta: ctx.rolePromiseDelta ?? 0,
  };
}

function beat(cycle: number, actor: string, text: string): NegotiationBeat {
  return { cycle, actor, text };
}

function withBeats(neg: Negotiation, beats: readonly NegotiationBeat[]): Negotiation {
  // History is bounded: a negotiation that runs long should not bloat the save.
  const history = [...neg.history, ...beats].slice(-24);
  return { ...neg, history };
}

/** Agent's cut, inflated by how many other clubs he can play off against you. */
export function agentFeeFor(fee: number, wage: number, rivalCount: number): number {
  const base = Math.max(N.AGENT_FEE_MIN, (fee > 0 ? fee : wage * 38) * N.AGENT_FEE_SHARE);
  return Math.round(base * (1 + Math.min(3, rivalCount) * N.AGENT_RIVAL_GREED * 0.34));
}

/**
 * Open talks. The opening demand is the selling club's asking price plus the
 * player's own package — you are always negotiating with two counterparties at
 * once, which is what makes a "cheap" signing on huge wages a real trap.
 */
export function openNegotiation(ctx: NegotiationContext, rng: Rng): Negotiation {
  const stream = rng.fork(`negotiation:open:${ctx.id}`);
  const talks = talksFrom(ctx);
  const fee = askingPrice(ctx.player, ctx.sellingClub, {
    ...ctx.valuation,
    buyingClubReputation: ctx.buyingClub.reputation,
    managerNegotiation: ctx.managerNegotiation,
    contract: ctx.contract,
  });
  const demand = demandedTerms(ctx.player, talks, { fee });

  // Rivals already in the room, seeded from real interest rather than noise.
  const rivalBidders = ctx.rivals
    .filter((r) => r.spendingPower >= fee * 0.8 && stream.chance(0.35 + r.reputation / 400))
    .slice(0, 3)
    .map((r) => ({ clubId: r.clubId, bid: Math.round(fee * stream.float(0.82, 1.02)) }));

  const loyaltyBlock =
    ctx.sellingClub !== null &&
    ctx.player.mental.loyalty >= N.LOYALTY_REFUSAL_THRESHOLD &&
    (ctx.rolePromiseDelta ?? 0) >= -0.1;

  const stage: NegotiationStage = ctx.sellingClub === null ? 'PLAYER_TALKS' : 'CLUB_TALKS';

  const neg: Negotiation = {
    id: ctx.id,
    playerId: ctx.player.id,
    fromClubId: ctx.sellingClub?.id ?? null,
    toClubId: ctx.buyingClub.id,
    stage: loyaltyBlock ? 'FAILED' : stage,
    ourOffer: null,
    theirDemand: demand,
    clubPatience: N.CLUB_START_PATIENCE,
    // A settled, well-treated player starts talks already sceptical.
    playerPatience: Math.round(
      N.PLAYER_START_PATIENCE * (1 - clamp01((ctx.player.mental.loyalty - 40) / 140)),
    ),
    agentFeeDemand: agentFeeFor(fee, demand.wage, rivalBidders.length),
    rivalBidders,
    history: [
      beat(
        ctx.cycle,
        ctx.sellingClub?.shortName ?? 'Agent',
        loyaltyBlock
          ? `${ctx.player.displayName} is happy where he is and will not discuss a move.`
          : ctx.sellingClub
            ? `${ctx.sellingClub.shortName} value ${ctx.player.displayName} at ${Math.round(fee).toLocaleString('en-GB')}.`
            : `${ctx.player.displayName} is a free agent. His camp will listen to offers.`,
      ),
    ],
    deadlineCycle: ctx.cycle + N.DEFAULT_DEADLINE_CYCLES,
    startedCycle: ctx.cycle,
  };
  return neg;
}

function hijackChance(neg: Negotiation, ctx: NegotiationContext): number {
  const rounds = Math.max(0, ctx.cycle - neg.startedCycle);
  const raw =
    N.HIJACK_BASE_CHANCE +
    neg.rivalBidders.length * N.HIJACK_PER_SUITOR +
    rounds * N.HIJACK_PER_ROUND;
  return Math.min(N.HIJACK_CHANCE_CAP, raw);
}

function fail(
  neg: Negotiation,
  ctx: NegotiationContext,
  outcome: NegotiationOutcome,
  actor: string,
  headline: string,
  detail: string,
): NegotiationStep {
  const beats = [beat(ctx.cycle, actor, headline)];
  return {
    negotiation: withBeats({ ...neg, stage: outcome === 'HIJACKED' ? 'HIJACKED' : 'FAILED' }, beats),
    outcome,
    headline,
    detail,
    counter: null,
    beats,
  };
}

/**
 * Submit an offer and get the room's reaction. One call = one round of talks.
 * `opts.agentFee` is only read during AGENT_TALKS, where the agent is the one
 * being negotiated with rather than the club or the player.
 */
export function submitOffer(
  neg: Negotiation,
  terms: NegotiationTerms,
  ctx: NegotiationContext,
  rng: Rng,
  opts: { agentFee?: number } = {},
): NegotiationStep {
  if (isTerminal(neg)) {
    return {
      negotiation: neg,
      outcome: 'CLOSED',
      headline: 'These talks are over.',
      detail: 'The negotiation has already reached its conclusion.',
      counter: null,
      beats: [],
    };
  }

  const stream = rng.fork(`negotiation:${neg.id}:${ctx.cycle}:${neg.history.length}`);
  const talks = talksFrom(ctx);
  const round = { ...neg, ourOffer: terms };

  if (ctx.cycle > neg.deadlineCycle) {
    return fail(round, ctx, 'COLLAPSED', 'Agent',
      'The window on this deal has closed.',
      'You left it too long. Everyone has moved on.');
  }

  // A rival can go over the top of you at any point once you have shown your hand.
  if (neg.rivalBidders.length > 0 && stream.chance(hijackChance(neg, ctx))) {
    const rival = stream.pick(neg.rivalBidders);
    const rivalName = ctx.rivals.find((r) => r.clubId === rival.clubId)?.name ?? 'A rival club';
    const bid = Math.round(Math.max(rival.bid, terms.fee * (1 + N.HIJACK_BID_PREMIUM)));
    return fail(round, ctx, 'HIJACKED', rivalName,
      `${rivalName} have gone over the top of you.`,
      `They tabled ${bid.toLocaleString('en-GB')} and got it done while you were still talking.`);
  }

  // The counterparty is entitled to simply not answer this cycle.
  if (stream.chance(N.DELAY_CHANCE)) {
    const stalled = withBeats(
      { ...round, clubPatience: Math.max(0, neg.clubPatience - 3) },
      [beat(ctx.cycle, ctx.sellingClub?.shortName ?? 'Agent', 'They have asked for more time to consider.')],
    );
    return {
      negotiation: stalled,
      outcome: 'DELAYED',
      headline: 'No answer yet.',
      detail: 'They are taking their time — and the deadline is not.',
      counter: null,
      beats: stalled.history.slice(-1),
    };
  }

  if (neg.stage === 'OPENING' || neg.stage === 'CLUB_TALKS') {
    return clubTalks(round, terms, ctx, stream);
  }
  if (neg.stage === 'PLAYER_TALKS') {
    return playerTalks(round, terms, ctx, talks, stream);
  }
  return agentTalks(round, terms, ctx, opts.agentFee ?? neg.agentFeeDemand, stream);
}

function clubTalks(
  neg: Negotiation,
  terms: NegotiationTerms,
  ctx: NegotiationContext,
  rng: Rng,
): NegotiationStep {
  const seller = ctx.sellingClub;
  if (!seller) {
    // Free agents have no club to satisfy; go straight to the player.
    const beats = [beat(ctx.cycle, 'Agent', 'There is no fee to agree. Let us talk terms.')];
    return {
      negotiation: withBeats({ ...neg, stage: 'PLAYER_TALKS' }, beats),
      outcome: 'ACCEPTED', headline: 'No fee required.',
      detail: 'He is out of contract — the deal lives or dies on the package.',
      counter: null, beats,
    };
  }

  const asking = neg.theirDemand.fee;
  const ratio = asking <= 0 ? 1 : terms.fee / asking;

  if (ratio >= N.CLUB_ACCEPT_RATIO) {
    const beats = [beat(ctx.cycle, seller.shortName, `${seller.shortName} have accepted your bid.`)];
    return {
      negotiation: withBeats({ ...neg, stage: 'PLAYER_TALKS' }, beats),
      outcome: 'ACCEPTED',
      headline: `Fee agreed with ${seller.shortName}.`,
      detail: `${Math.round(terms.fee).toLocaleString('en-GB')} accepted. Now you have to convince the player.`,
      counter: null, beats,
    };
  }

  const shortfallTenths = Math.max(0, (1 - ratio) * 10);
  const insult = ratio < N.CLUB_INSULT_RATIO;
  const burn =
    N.PATIENCE_PER_ROUND +
    shortfallTenths * N.CLUB_PATIENCE_PER_10_PERCENT_SHORT * (insult ? N.INSULT_PATIENCE_MULTIPLIER : 1);
  const clubPatience = Math.max(0, neg.clubPatience - burn);

  if (clubPatience <= N.PATIENCE_COLLAPSE || insult) {
    if (clubPatience <= N.PATIENCE_COLLAPSE) {
      return fail({ ...neg, clubPatience }, ctx, 'COLLAPSED', seller.shortName,
        `${seller.shortName} have ended talks.`,
        'They will not entertain another bid from you this window.');
    }
    const beats = [beat(ctx.cycle, seller.shortName, 'Your bid was dismissed out of hand.')];
    return {
      negotiation: withBeats({ ...neg, clubPatience }, beats),
      outcome: 'REJECTED',
      headline: `${seller.shortName} rejected the bid.`,
      detail: 'Nowhere near their valuation. They are insulted, and it showed.',
      counter: null, beats,
    };
  }

  if (ratio >= N.CLUB_CONSIDER_RATIO) {
    // They meet you part-way, never all the way.
    const counterFee = Math.round(
      asking + (terms.fee - asking) * N.CLUB_CONCESSION_RATE * rng.float(0.7, 1.15),
    );
    const counter: NegotiationTerms = { ...neg.theirDemand, fee: Math.max(terms.fee, counterFee) };
    const beats = [beat(ctx.cycle, seller.shortName, `${seller.shortName} countered at ${counter.fee.toLocaleString('en-GB')}.`)];
    return {
      negotiation: withBeats({ ...neg, clubPatience, theirDemand: counter }, beats),
      outcome: 'COUNTERED',
      headline: `${seller.shortName} want more.`,
      detail: `They have come down to ${counter.fee.toLocaleString('en-GB')}.`,
      counter, beats,
    };
  }

  const beats = [beat(ctx.cycle, seller.shortName, 'Bid rejected. They expect a serious offer.')];
  return {
    negotiation: withBeats({ ...neg, clubPatience }, beats),
    outcome: 'REJECTED',
    headline: `${seller.shortName} rejected the bid.`,
    detail: `Their valuation is ${asking.toLocaleString('en-GB')} and they are not desperate.`,
    counter: null, beats,
  };
}

function playerTalks(
  neg: Negotiation,
  terms: NegotiationTerms,
  ctx: NegotiationContext,
  talks: TalksContext,
  rng: Rng,
): NegotiationStep {
  const evaluation = evaluateTermsOffer(ctx.player, terms, talks, neg.playerPatience);
  const name = ctx.player.displayName;

  if (evaluation.verdict === 'ACCEPT') {
    const agentFee = agentFeeFor(terms.fee, terms.wage, neg.rivalBidders.length);
    const beats = [beat(ctx.cycle, name, `${name} has agreed personal terms.`)];
    return {
      negotiation: withBeats({ ...neg, stage: 'AGENT_TALKS', agentFeeDemand: agentFee }, beats),
      outcome: 'ACCEPTED',
      headline: `${name} wants the move.`,
      detail: `${evaluation.reason} His agent is asking ${agentFee.toLocaleString('en-GB')} to make it happen.`,
      counter: null, beats,
    };
  }

  const demandValue = packageValue(neg.theirDemand);
  const shortfallTenths = Math.max(0, (1 - packageValue(terms) / Math.max(1, demandValue)) * 10);
  const playerPatience = Math.max(
    0,
    neg.playerPatience - N.PATIENCE_PER_ROUND - shortfallTenths * N.PLAYER_PATIENCE_PER_10_PERCENT_SHORT,
  );

  // Low patience is where a deal quietly dies: he stops returning calls.
  if (playerPatience <= N.LOSE_INTEREST_PATIENCE_THRESHOLD && rng.chance(N.LOSE_INTEREST_CHANCE)) {
    return fail({ ...neg, playerPatience }, ctx, 'PLAYER_LOST_INTEREST', name,
      `${name} has lost interest in the move.`,
      `Too many rounds of haggling. ${evaluation.reason}`);
  }

  if (evaluation.verdict === 'REJECT' || playerPatience <= N.PATIENCE_COLLAPSE) {
    return fail({ ...neg, playerPatience }, ctx, 'COLLAPSED', name,
      `${name} has turned you down.`,
      evaluation.reason);
  }

  const counter = evaluation.counter ?? neg.theirDemand;
  const beats = [beat(ctx.cycle, `${name}'s agent`, `Counter: ${counter.wage.toLocaleString('en-GB')}/week as a ${counter.role}.`)];
  return {
    negotiation: withBeats({ ...neg, playerPatience, theirDemand: { ...counter, fee: neg.theirDemand.fee } }, beats),
    outcome: 'COUNTERED',
    headline: `${name}'s camp countered.`,
    detail: evaluation.reason,
    counter: { ...counter, fee: neg.theirDemand.fee },
    beats,
  };
}

function agentTalks(
  neg: Negotiation,
  terms: NegotiationTerms,
  ctx: NegotiationContext,
  agentFee: number,
  rng: Rng,
): NegotiationStep {
  const demand = neg.agentFeeDemand;
  const name = ctx.player.displayName;

  if (agentFee >= demand * 0.92) {
    const beats = [beat(ctx.cycle, 'Agent', 'Everything is agreed. Get it signed.')];
    return {
      negotiation: withBeats({ ...neg, stage: 'AGREED', agentFeeDemand: Math.round(agentFee), ourOffer: terms }, beats),
      outcome: 'AGREED',
      headline: `${name} is yours.`,
      detail: `Fee, terms and agent fee all settled.`,
      counter: null, beats,
    };
  }

  if (agentFee >= demand * 0.65) {
    const softened = Math.round(demand * rng.float(0.86, 0.95));
    const beats = [beat(ctx.cycle, 'Agent', `He will do it for ${softened.toLocaleString('en-GB')}.`)];
    return {
      negotiation: withBeats({ ...neg, agentFeeDemand: softened, clubPatience: Math.max(0, neg.clubPatience - N.PATIENCE_PER_ROUND) }, beats),
      outcome: 'COUNTERED',
      headline: 'The agent wants more.',
      detail: `He has come down to ${softened.toLocaleString('en-GB')}.`,
      counter: neg.theirDemand, beats,
    };
  }

  return fail(neg, ctx, 'COLLAPSED', 'Agent',
    'The agent has walked away.',
    `He was asking ${demand.toLocaleString('en-GB')} and you were not close.`);
}

/**
 * What the world does between your offers: patience decays, rivals sniff around,
 * and a deal you leave sitting gets taken off the table. Call this once per
 * cycle for every live negotiation.
 */
export function aiCounter(neg: Negotiation, ctx: NegotiationContext, rng: Rng): Negotiation {
  if (isTerminal(neg)) return neg;
  const stream = rng.fork(`negotiation:ai:${neg.id}:${ctx.cycle}`);

  if (ctx.cycle > neg.deadlineCycle) {
    return withBeats({ ...neg, stage: 'FAILED' }, [
      beat(ctx.cycle, ctx.sellingClub?.shortName ?? 'Agent', 'Talks expired without agreement.'),
    ]);
  }

  let next: Negotiation = {
    ...neg,
    clubPatience: Math.max(0, neg.clubPatience - N.PATIENCE_PER_ROUND * 0.5),
    playerPatience: Math.max(0, neg.playerPatience - N.PATIENCE_PER_ROUND * 0.5),
  };
  const beats: NegotiationBeat[] = [];

  // A new suitor may join, which hardens the demand and fattens the agent.
  const newcomer = ctx.rivals.find(
    (r) => !next.rivalBidders.some((b) => b.clubId === r.clubId) && r.spendingPower >= next.theirDemand.fee,
  );
  if (newcomer && stream.chance(0.18)) {
    const bid = Math.round(next.theirDemand.fee * stream.float(0.9, 1.08));
    next = {
      ...next,
      rivalBidders: [...next.rivalBidders, { clubId: newcomer.clubId, bid }],
      theirDemand: { ...next.theirDemand, fee: Math.round(next.theirDemand.fee * 1.06) },
      agentFeeDemand: agentFeeFor(next.theirDemand.fee, next.theirDemand.wage, next.rivalBidders.length + 1),
    };
    beats.push(beat(ctx.cycle, newcomer.name, `${newcomer.name} have entered the race.`));
  }

  // With the deadline closing and nobody else interested, a seller softens.
  const cyclesLeft = next.deadlineCycle - ctx.cycle;
  if (cyclesLeft <= 1 && next.rivalBidders.length === 0 && stream.chance(0.5)) {
    const softened = Math.round(next.theirDemand.fee * stream.float(0.88, 0.96));
    next = { ...next, theirDemand: { ...next.theirDemand, fee: softened } };
    beats.push(beat(ctx.cycle, ctx.sellingClub?.shortName ?? 'Agent', `They have dropped their valuation to ${softened.toLocaleString('en-GB')}.`));
  }

  if (next.playerPatience <= 0 || next.clubPatience <= 0) {
    return withBeats({ ...next, stage: 'FAILED' }, [
      ...beats,
      beat(ctx.cycle, 'Agent', 'Patience ran out. The deal is dead.'),
    ]);
  }

  return withBeats(next, beats);
}

// --- Completion -------------------------------------------------------------

export interface TransferOutcome {
  readonly ok: boolean;
  readonly reason: string;
  readonly transferId: TransferId | null;
  readonly player: Player | null;
  readonly contract: Contract | null;
  readonly fromClub: Club | null;
  readonly toClub: Club | null;
  readonly completed: CompletedTransfer | null;
  /** Memos of every ledger movement, in order. Handy for the transfer receipt UI. */
  readonly transactions: readonly string[];
  readonly totalCost: number;
}

const failedOutcome = (reason: string): TransferOutcome => ({
  ok: false, reason, transferId: null, player: null, contract: null,
  fromClub: null, toClub: null, completed: null, transactions: [], totalCost: 0,
});

/**
 * Settle an AGREED negotiation: move the money, move the registration, write
 * the contract. Every movement goes through the Ledger — the club balance is
 * never touched directly, which is what makes `auditEconomy` meaningful.
 */
export function completeTransfer(
  neg: Negotiation,
  ctx: NegotiationContext,
  ledger: Ledger,
  postCtx: PostContext,
  ids: IdFactory,
): TransferOutcome {
  if (neg.stage !== 'AGREED') return failedOutcome('Terms are not agreed.');
  const terms = neg.ourOffer;
  if (!terms) return failedOutcome('No agreed terms on record.');

  const buyer = ctx.buyingClub;
  const seller = ctx.sellingClub;
  const player = ctx.player;

  const fee = Math.max(0, Math.round(terms.fee));
  const agentFee = Math.max(0, Math.round(neg.agentFeeDemand));
  const signingBonus = Math.max(0, Math.round(terms.signingBonus));
  const totalCost = fee + agentFee + signingBonus;

  if (!ledger.canAfford(buyer.id, totalCost)) {
    return failedOutcome(
      `${buyer.shortName} cannot cover ${totalCost.toLocaleString('en-GB')} — the deal falls through.`,
    );
  }

  const memos: string[] = [];

  if (fee > 0 && seller) {
    const posted = ledger.post(
      {
        kind: 'TRANSFER_OUT',
        amount: fee,
        from: clubAccount(buyer.id),
        to: clubAccount(seller.id),
        memo: `Transfer fee for ${player.displayName}: ${buyer.shortName} to ${seller.shortName}`,
        metadata: { playerId: player.id, fromClubId: seller.id, toClubId: buyer.id },
      },
      postCtx,
    );
    if (!posted.ok) return failedOutcome('The fee could not be settled.');
    memos.push(`Fee ${fee.toLocaleString('en-GB')} to ${seller.shortName}`);
  }

  if (signingBonus > 0) {
    const posted = ledger.debit(buyer.id, 'SIGNING_BONUS', signingBonus,
      `Signing-on fee for ${player.displayName}`, postCtx,
      { metadata: { playerId: player.id } });
    if (posted.ok) memos.push(`Signing-on fee ${signingBonus.toLocaleString('en-GB')}`);
  }

  if (agentFee > 0) {
    const posted = ledger.debit(buyer.id, 'AGENT_FEE', agentFee,
      `Agent fee for ${player.displayName}`, postCtx,
      { metadata: { playerId: player.id } });
    if (posted.ok) memos.push(`Agent fee ${agentFee.toLocaleString('en-GB')}`);
  }

  const contract = contractFromTerms(
    ids.next<ContractId>('contract'),
    player.id,
    buyer.id,
    terms,
    postCtx.cycle,
  );

  const nextPlayer: Player = {
    ...player,
    clubId: buyer.id,
    contractId: contract.id,
    mental: {
      ...player.mental,
      // A move he pushed for lifts him; the settling-in period is handled by form.
      morale: clamp(player.mental.morale + 6, 0, 100),
      loyalty: clamp(player.mental.loyalty - 4, 0, 100),
    },
    form: { ...player.form, rating: player.form.rating * 0.6 },
  };

  const nextFrom: Club | null = seller
    ? { ...seller, squad: seller.squad.filter((id) => id !== player.id) }
    : null;
  const nextTo: Club = {
    ...buyer,
    squad: buyer.squad.includes(player.id) ? buyer.squad : [...buyer.squad, player.id],
  };

  const completed: CompletedTransfer = {
    playerId: player.id,
    fromClubId: seller?.id ?? null,
    toClubId: buyer.id,
    fee,
    cycle: postCtx.cycle,
    season: postCtx.season,
  };

  return {
    ok: true,
    reason: `${player.displayName} has signed for ${buyer.shortName}.`,
    transferId: ids.next<TransferId>('transfer'),
    player: nextPlayer,
    contract,
    fromClub: nextFrom,
    toClub: nextTo,
    completed,
    transactions: memos,
    totalCost,
  };
}

/** Convenience for the UI: a single sentence describing where talks stand. */
export function negotiationSummary(neg: Negotiation): string {
  switch (neg.stage) {
    case 'OPENING': return 'Talks are about to open.';
    case 'CLUB_TALKS': return `Negotiating a fee of ${neg.theirDemand.fee.toLocaleString('en-GB')}.`;
    case 'PLAYER_TALKS': return `Discussing terms: ${neg.theirDemand.wage.toLocaleString('en-GB')}/week as a ${neg.theirDemand.role}.`;
    case 'AGENT_TALKS': return `The agent wants ${neg.agentFeeDemand.toLocaleString('en-GB')}.`;
    case 'AGREED': return 'Everything is agreed.';
    case 'HIJACKED': return 'A rival club took him.';
    case 'FAILED': return 'Talks broke down.';
    default: return 'Talks are ongoing.';
  }
}
