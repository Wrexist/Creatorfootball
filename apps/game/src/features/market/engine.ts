import { useEffect, useMemo, useRef } from 'react';
import {
  BASE_PACK,
  ContentRegistry,
  IdFactory,
  Ledger,
  Rng,
  PHASE_LABELS,
  assignScout,
  buildValuationContext,
  completeTransfer,
  currentCompetition,
  contractFor,
  openNegotiation,
  phaseForWeek,
  refreshMarket,
  scoutCapacity,
  setClub,
  setContract,
  setPlayer,
  shortlist as addToShortlist,
  submitOffer,
  unshortlist as removeFromShortlist,
  type ClubId,
  type Club,
  type GameState,
  type MarketContext,
  type Negotiation,
  type NegotiationContext,
  type NegotiationStep,
  type NegotiationTerms,
  type Player,
  type PlayerId,
  type RivalClub,
  type ScoutDepth,
  type SeasonPhase,
  type TransferOutcome,
  type ValuationContext,
} from '@cf/engine';
import { useGameStore } from '@/state/gameStore';

/**
 * The market's bridge to the engine.
 *
 * Every number a market screen shows and every consequence a market screen
 * causes passes through here, so a component never has to know that a transfer
 * is three negotiations in a trench coat. The rule this file exists to hold:
 * screens describe, the engine decides.
 */

/* --- content registry -------------------------------------------------- */

let cachedRegistry: ContentRegistry | null = null;

/** The loaded content, used for facility-derived scouting capacity. */
export function contentRegistry(): ContentRegistry {
  if (!cachedRegistry) {
    cachedRegistry = new ContentRegistry();
    cachedRegistry.load(BASE_PACK);
  }
  return cachedRegistry;
}

/* --- the transfer window ---------------------------------------------- */

/**
 * The window is a phase of the season calendar, not a countdown.
 *
 * `transfers.windowOpen` is the authority when the world engine has set it;
 * otherwise the calendar answers, because a player looking at "Transfer Window"
 * on the fixture list must not be told the market is shut.
 */
export const WINDOW_PHASES: readonly SeasonPhase[] = ['PRE_SEASON', 'TRANSFER_WINDOW'];

export const isWindowOpen = (s: GameState): boolean =>
  s.transfers.windowOpen || WINDOW_PHASES.includes(s.clock.phase);

export interface WindowState {
  readonly open: boolean;
  readonly phase: SeasonPhase;
  readonly phaseLabel: string;
  /** Matchweek the next window opens on, or null when one is already open. */
  readonly opensWeek: number | null;
  /** Matchweek the current window closes on, or null when it is shut. */
  readonly closesWeek: number | null;
  readonly totalWeeks: number;
  readonly week: number;
}

/** Walks the calendar with the engine's own phase function — never a guess. */
export function windowState(s: GameState): WindowState {
  const season = s.seasons[s.currentSeasonId];
  const totalWeeks = season?.totalWeeks ?? 22;
  const week = s.clock.week;
  const open = isWindowOpen(s);

  let opensWeek: number | null = null;
  let closesWeek: number | null = null;
  for (let w = week + 1; w <= totalWeeks; w++) {
    const phase = phaseForWeek(w, totalWeeks);
    const windowWeek = WINDOW_PHASES.includes(phase);
    if (open && !windowWeek) { closesWeek = w - 1; break; }
    if (!open && windowWeek) { opensWeek = w; break; }
  }

  return {
    open,
    phase: s.clock.phase,
    phaseLabel: PHASE_LABELS[s.clock.phase],
    opensWeek,
    closesWeek,
    totalWeeks,
    week,
  };
}

/* --- valuation & market context ---------------------------------------- */

export function marketContext(s: GameState): MarketContext {
  return {
    cycle: s.clock.cycle,
    season: s.clock.season,
    windowOpen: isWindowOpen(s),
    leagueSize: currentCompetition(s)?.clubIds.length ?? 12,
  };
}

export function valuationContext(s: GameState): ValuationContext {
  return buildValuationContext(s, marketContext(s));
}

/* --- keeping the market current ---------------------------------------- */

/**
 * The market re-prices itself once per matchweek.
 *
 * `refreshMarket` is a pure engine function returning a delta, so running it
 * from the app layer is safe and deterministic: the seed is the save's seed
 * plus the cycle, which means two devices on the same save see the same
 * shop window. The module-level guard stops a render loop if a refresh ever
 * legitimately produces nothing.
 */
const refreshedAt = new Map<string, number>();

export function refreshMarketNow(force = false): void {
  const store = useGameStore.getState();
  const s = store.state;
  if (!s) return;
  const key = s.saveId;
  if (!force && refreshedAt.get(key) === s.clock.cycle) return;
  refreshedAt.set(key, s.clock.cycle);

  const rng = new Rng(`${s.seed}:market:${s.clock.cycle}`);
  const delta = refreshMarket(s, rng, marketContext(s));

  store.apply((current) => {
    const players: Record<string, Player> = { ...current.players };
    for (const [id, value] of Object.entries(delta.playerValues)) {
      const player = players[id];
      if (player && player.marketValue !== value) players[id] = { ...player, marketValue: value };
    }
    return {
      ...current,
      players,
      transfers: { ...current.transfers, listings: delta.listings, rumours: delta.rumours },
    };
  });
}

/** Mount-time hook for any screen that reads listings, rumours or valuations. */
export function useLiveMarket(): void {
  const cycle = useGameStore((s) => s.state?.clock.cycle ?? -1);
  const ready = useGameStore((s) => s.phase === 'READY');
  useEffect(() => {
    if (ready) refreshMarketNow();
  }, [ready, cycle]);
}

/* --- shortlist ---------------------------------------------------------- */

export function toggleShortlist(playerId: PlayerId): void {
  useGameStore.getState().apply((s) => ({
    ...s,
    scouting: s.scouting.shortlist.includes(playerId)
      ? removeFromShortlist(s.scouting, playerId)
      : addToShortlist(s.scouting, playerId),
  }));
}

/* --- scouting ----------------------------------------------------------- */

export interface ScoutOrderResult {
  readonly ok: boolean;
  readonly reason: string;
}

export function orderScoutReport(playerId: PlayerId, depth: ScoutDepth): ScoutOrderResult {
  const store = useGameStore.getState();
  const s = store.state;
  if (!s) return { ok: false, reason: 'No game loaded.' };

  const ledger = Ledger.restore(s.ledger);
  const result = assignScout(
    s,
    { clubId: s.playerClubId, playerId, depth },
    contentRegistry(),
    ledger,
    { cycle: s.clock.cycle, season: s.clock.season, at: Date.now() },
  );
  if (!result.ok || !result.scouting) return { ok: false, reason: result.reason };

  const scouting = result.scouting;
  store.apply((current) => ({ ...current, scouting, ledger: ledger.snapshot() }));
  return { ok: true, reason: result.reason };
}

export function scoutingCapacity(s: GameState): number {
  return scoutCapacity(s.clubs[s.playerClubId], contentRegistry());
}

/* --- negotiation -------------------------------------------------------- */

function rivalsFor(s: GameState, player: Player): RivalClub[] {
  const out: RivalClub[] = [];
  for (const club of Object.values(s.clubs)) {
    if (club.id === s.playerClubId || club.id === player.clubId) continue;
    out.push({
      clubId: club.id,
      name: club.shortName,
      reputation: club.reputation,
      spendingPower: club.finance.transferBudget,
    });
  }
  // Richest first: these are the clubs that can actually go over the top of you.
  return out.sort((a, b) => b.spendingPower - a.spendingPower).slice(0, 6);
}

export function negotiationContext(s: GameState, negId: string, player: Player): NegotiationContext | null {
  const buyingClub = s.clubs[s.playerClubId];
  if (!buyingClub) return null;
  const manager = s.managers[s.playerManagerId];
  const sellingClub: Club | null = player.clubId ? s.clubs[player.clubId] ?? null : null;
  const competition = currentCompetition(s);
  const position = competition
    ? Math.max(1, competition.clubIds.indexOf(s.playerClubId) + 1)
    : 1;

  return {
    id: negId,
    cycle: s.clock.cycle,
    season: s.clock.season,
    player,
    sellingClub,
    buyingClub,
    contract: contractFor(s, player.id) ?? null,
    valuation: valuationContext(s),
    leaguePosition: position,
    leagueSize: competition?.clubIds.length ?? 12,
    // The engine asks for charisma; the manager model calls that media handling.
    managerCharisma: manager?.attributes.mediaHandling ?? 50,
    managerNegotiation: manager?.attributes.negotiation ?? 50,
    rivals: rivalsFor(s, player),
  };
}

/** Table stakes for the offer composer: what the other side is asking for. */
export function openTalks(playerId: PlayerId): { ok: boolean; negotiationId?: string; reason: string } {
  const store = useGameStore.getState();
  const s = store.state;
  if (!s) return { ok: false, reason: 'No game loaded.' };
  const player = s.players[playerId];
  if (!player) return { ok: false, reason: 'That player is not in the world.' };
  if (player.clubId === s.playerClubId) return { ok: false, reason: 'He already plays for you.' };

  const existing = Object.values(s.transfers.negotiations).find(
    (n) => n.playerId === playerId && n.stage !== 'FAILED' && n.stage !== 'HIJACKED',
  );
  if (existing) return { ok: true, negotiationId: existing.id, reason: 'Talks are already open.' };

  const ids = IdFactory.restore(s.saveId, s.idCounters);
  const negId = ids.next<string>('negotiation');
  const ctx = negotiationContext(s, negId, player);
  if (!ctx) return { ok: false, reason: 'Your club could not be found.' };

  const negotiation = openNegotiation(ctx, new Rng(`${s.seed}:negotiation:${negId}`));
  const counters = { ...s.idCounters, ...ids.serialize() };

  store.apply((current) => ({
    ...current,
    idCounters: counters,
    transfers: {
      ...current.transfers,
      negotiations: { ...current.transfers.negotiations, [negId]: negotiation },
    },
  }));
  return { ok: true, negotiationId: negId, reason: 'Talks are open.' };
}

/**
 * One round of talks.
 *
 * The player's own move is written into the transcript before the room
 * answers, because a negotiation you can only read one half of is a form with
 * extra steps.
 */
export function submitTerms(
  negId: string,
  terms: NegotiationTerms,
  opts: { agentFee?: number; ourLine: string } ,
): NegotiationStep | null {
  const store = useGameStore.getState();
  const s = store.state;
  if (!s) return null;
  const negotiation = s.transfers.negotiations[negId];
  if (!negotiation) return null;
  const player = s.players[negotiation.playerId];
  if (!player) return null;
  const ctx = negotiationContext(s, negId, player);
  if (!ctx) return null;

  const us = s.clubs[s.playerClubId]?.shortName ?? 'Your club';
  const withOurLine: Negotiation = {
    ...negotiation,
    history: [...negotiation.history, { cycle: s.clock.cycle, actor: us, text: opts.ourLine }].slice(-24),
  };

  const rng = new Rng(`${s.seed}:negotiation:${negId}:${negotiation.history.length}`);
  const step = submitOffer(
    withOurLine,
    terms,
    ctx,
    rng,
    opts.agentFee !== undefined ? { agentFee: opts.agentFee } : {},
  );

  store.apply((current) => ({
    ...current,
    transfers: {
      ...current.transfers,
      negotiations: { ...current.transfers.negotiations, [negId]: step.negotiation },
    },
  }));
  return step;
}

/** Settle an agreed deal. Money, registration and contract all move together. */
export function finaliseTransfer(negId: string): TransferOutcome | null {
  const store = useGameStore.getState();
  const s = store.state;
  if (!s) return null;
  const negotiation = s.transfers.negotiations[negId];
  if (!negotiation) return null;
  const player = s.players[negotiation.playerId];
  if (!player) return null;
  const ctx = negotiationContext(s, negId, player);
  if (!ctx) return null;

  const ledger = Ledger.restore(s.ledger);
  const ids = IdFactory.restore(s.saveId, s.idCounters);
  const postCtx = { cycle: s.clock.cycle, season: s.clock.season, at: Date.now() };
  const outcome = completeTransfer(negotiation, ctx, ledger, postCtx, ids);
  if (!outcome.ok) return outcome;

  const counters = { ...s.idCounters, ...ids.serialize() };
  const signed = outcome.player;
  const contract = outcome.contract;
  const toClub = outcome.toClub;
  const fromClub = outcome.fromClub;
  const completed = outcome.completed;
  if (!signed || !contract || !toClub || !completed) return outcome;

  store.apply((current) => {
    let next = setPlayer(current, signed);
    next = setContract(next, contract);
    if (fromClub) next = setClub(next, fromClub);
    next = setClub(next, toClub);
    const negotiations = { ...next.transfers.negotiations };
    delete negotiations[negId];
    return {
      ...next,
      ledger: ledger.snapshot(),
      idCounters: counters,
      transfers: {
        ...next.transfers,
        negotiations,
        completed: [...next.transfers.completed, completed].slice(-60),
      },
    };
  });
  return outcome;
}

/** Walk away. The record of the talks goes with it — this is not a soft close. */
export function abandonTalks(negId: string): void {
  useGameStore.getState().apply((s) => {
    const negotiations = { ...s.transfers.negotiations };
    delete negotiations[negId];
    return { ...s, transfers: { ...s.transfers, negotiations } };
  });
}

/* --- reads used by more than one market screen -------------------------- */

export interface Headroom {
  readonly transferBudget: number;
  readonly wageBudget: number;
  readonly wageCommitted: number;
  readonly wageFree: number;
  readonly usage: number;
}

export function useHeadroom(s: GameState): Headroom {
  return useMemo(() => {
    const club = s.clubs[s.playerClubId];
    const wageBudget = club?.finance.wageBudgetPerCycle ?? 0;
    let committed = 0;
    for (const id of [...(club?.squad ?? []), ...(club?.youthSquad ?? [])]) {
      const player = s.players[id];
      const contract = player?.contractId ? s.contracts[player.contractId] : undefined;
      committed += contract?.wage ?? 0;
    }
    return {
      transferBudget: club?.finance.transferBudget ?? 0,
      wageBudget,
      wageCommitted: committed,
      wageFree: Math.max(0, wageBudget - committed),
      usage: wageBudget > 0 ? committed / wageBudget : 0,
    };
  }, [s]);
}

/** Live negotiations for the player's club, hottest deadline first. */
export function useOurNegotiations(s: GameState): Negotiation[] {
  return useMemo(
    () =>
      Object.values(s.transfers.negotiations)
        .filter((n) => n.toClubId === s.playerClubId)
        .sort((a, b) => a.deadlineCycle - b.deadlineCycle),
    [s.transfers.negotiations, s.playerClubId],
  );
}

export const clubOf = (s: GameState, id: ClubId | null | undefined): Club | undefined =>
  (id ? s.clubs[id] : undefined);

/** Stable identity for a value that only changes when the cycle does. */
export function useCycleMemo<T>(s: GameState, factory: () => T): T {
  const cycleRef = useRef(-1);
  const valueRef = useRef<T | null>(null);
  if (cycleRef.current !== s.clock.cycle || valueRef.current === null) {
    cycleRef.current = s.clock.cycle;
    valueRef.current = factory();
  }
  return valueRef.current;
}
