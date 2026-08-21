import {
  assessRenewal, buildValuationContext, clamp, contractFor, currentCompetition, patchPlayer,
  renewContract, respondToRenewal, setContract,
  type GameState, type NegotiationTerms, type PlayerId, type RenewalResponse,
} from '@cf/engine';
import { useGameStore } from '@/state/gameStore';

/**
 * The renewal bridge.
 *
 * The engine has had a complete, tested renewal flow since launch; the
 * interface simply never wired it up, so five different screens warned
 * "renew him or he loses you nothing" while offering no way to try. This file
 * is the missing half: one honest offer ("meet his current demands"), the
 * engine's own verdict, and the consequences applied through the store.
 *
 * Deliberately a single-shot rather than a second negotiation minigame: the
 * transfer market already owns multi-round haggling. A renewal's tension is
 * whether you are willing to pay what he now deserves — and refusing entirely
 * costs morale and loyalty, which the engine prices for us.
 */

/** Offers open well before the six-week panic; a renewal left this late is a crisis. */
export const RENEWAL_OFFER_WINDOW_WEEKS = 30;

export function canOfferRenewal(contractWeeksRemaining: number, isOwnSquad: boolean): boolean {
  return isOwnSquad && contractWeeksRemaining <= RENEWAL_OFFER_WINDOW_WEEKS;
}

export interface RenewalOutcomeCopy {
  readonly tone: 'success' | 'neutral' | 'error';
  readonly title: string;
  readonly detail: string;
}

/** The engine returns a verdict; the interface needs words and a weight. */
export function renewalOutcomeCopy(response: RenewalResponse): RenewalOutcomeCopy {
  switch (response.verdict) {
    case 'SIGNED':
      return { tone: 'success', title: 'Deal done', detail: response.message };
    case 'COUNTERED':
      return { tone: 'neutral', title: 'He wants more', detail: response.message };
    case 'REFUSED':
      return { tone: 'error', title: 'He said no', detail: response.message };
    case 'INSULTED':
      return { tone: 'error', title: 'That went down badly', detail: response.message };
  }
}

function talksContextFor(s: GameState) {
  const club = s.clubs[s.playerClubId];
  const manager = s.managers[s.playerManagerId];
  const competition = currentCompetition(s);
  const position = Math.max(1, (competition?.clubIds.indexOf(s.playerClubId) ?? 0) + 1);
  const valuation = buildValuationContext(s, {
    cycle: s.clock.cycle,
    season: s.clock.season,
    windowOpen: s.transfers.windowOpen,
    leagueSize: competition?.clubIds.length ?? 12,
  });
  return {
    valuation,
    // The engine asks for charisma; the manager model calls it media handling.
    clubReputation: club?.reputation ?? 50,
    leaguePosition: position,
    leagueSize: competition?.clubIds.length ?? 12,
    managerCharisma: manager?.attributes.mediaHandling ?? 50,
    isRenewal: true as const,
  };
}

export interface RenewalResult {
  readonly ok: boolean;
  readonly reason?: string;
  readonly outcome?: RenewalOutcomeCopy;
  /** The wage he signed for, when he signed — for the toast. */
  readonly wage?: number;
  readonly years?: number;
}

/**
 * Offer the player exactly what the engine says he currently deserves.
 * Deterministic end to end: no Rng anywhere in assess → respond → renew, so a
 * given save state always produces the same verdict.
 */
export function offerRenewal(playerId: PlayerId): RenewalResult {
  const store = useGameStore.getState();
  const s = store.state;
  if (!s) return { ok: false, reason: 'No game loaded.' };

  const player = s.players[playerId];
  if (!player) return { ok: false, reason: 'That player is not in the world.' };
  if (player.clubId !== s.playerClubId) return { ok: false, reason: 'He does not play for your club.' };
  const contract = contractFor(s, playerId);
  if (!contract) return { ok: false, reason: 'He has no contract to renew.' };
  if (contract.weeksRemaining > RENEWAL_OFFER_WINDOW_WEEKS) {
    return { ok: false, reason: 'His deal has plenty of time left on it.' };
  }

  const ctx = talksContextFor(s);
  const assessment = assessRenewal(player, contract, ctx);
  const offer: NegotiationTerms = assessment.demand;
  const response = respondToRenewal(player, contract, offer, ctx);

  if (response.verdict === 'SIGNED') {
    store.apply((current) => {
      let next = setContract(current, renewContract(contract, offer, current.clock.cycle));
      next = patchPlayer(next, playerId, (p) => ({
        mental: {
          ...p.mental,
          morale: clamp(p.mental.morale + response.moraleDelta, 1, 99),
          loyalty: clamp(p.mental.loyalty + response.loyaltyDelta, 1, 99),
        },
      }));
      return next;
    });
  } else {
    // A refused or insulted player still remembers the meeting: the engine's
    // deltas are the consequence, and they apply even though nothing signed.
    store.apply((current) =>
      patchPlayer(current, playerId, (p) => ({
        mental: {
          ...p.mental,
          morale: clamp(p.mental.morale + response.moraleDelta, 1, 99),
          loyalty: clamp(p.mental.loyalty + response.loyaltyDelta, 1, 99),
        },
      })),
    );
  }

  return {
    ok: true,
    outcome: renewalOutcomeCopy(response),
    ...(response.verdict === 'SIGNED' ? { wage: Math.round(offer.wage), years: offer.years } : {}),
  };
}
