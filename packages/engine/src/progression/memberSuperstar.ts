import type { ContractId, PlayerId } from '../core/brand';
import type { GameState } from '../game/state';
import { Ledger } from '../economy/ledger';
import { emptyAttributes, overallFor } from '../players/attributes';
import { emptyMental } from '../players/mental';
import { emptyForm, type Player } from '../players/player';
import { emptyBonuses, type Contract } from '../contracts/contract';
import { defaultValuationContext, marketValue } from '../transfers/valuation';
import type { MemberBenefitProof } from './membership';

const attributes = { ...emptyAttributes(80), pace: 91, acceleration: 92, shooting: 92, finishing: 94, composure: 90, positioning: 90, strength: 80, technique: 88, dribbling: 89, defending: 42, reflexes: 20 };
export const MEMBER_SUPERSTAR = {
  id: 'player_member_kai_arden' as PlayerId, contractId: 'contract_member_kai_arden' as ContractId,
  firstName: 'Kai', lastName: 'Arden', name: 'Kai Arden', position: 'ST' as const,
  age: 22, potential: 95, attributes, overall: overallFor(attributes, 'ST'),
  wage: 5000, contractWeeks: 52, claimKey: 'creator-club:superstar:welcome',
} as const;

/** A guaranteed authored signing, once per career. Existing players are never replaced or cloned. */
export function claimMemberSuperstar(state: GameState, proof: MemberBenefitProof): GameState {
  if (proof.trial || !Number.isFinite(proof.checkedAt) || !Number.isFinite(proof.expiresAt) || proof.expiresAt <= proof.checkedAt) return state;
  const club = state.clubs[state.playerClubId], star = MEMBER_SUPERSTAR;
  if (!club || state.players[star.id] || state.contracts[star.contractId]) return state;
  const ledger = Ledger.restore(state.ledger);
  if (ledger.hasApplied(star.claimKey)) return state;
  const posted = ledger.credit(club.id, 'STORE_PURCHASE', 0, `Creator Club welcome signing: ${star.name}`, { cycle: state.clock.cycle, season: state.clock.season, at: proof.checkedAt }, { idempotencyKey: star.claimKey });
  if (!posted.ok) return state;
  const usedNumbers = new Set(club.squad.map(id => state.players[id]?.shirtNumber));
  const shirtNumber = [...new Set([9,10,11,...Array.from({ length: 99 },(_,i)=>i+1)])].find(n => !usedNumbers.has(n)) ?? null;
  const contract: Contract = { id: star.contractId, playerId: star.id, clubId: club.id, wage: star.wage, weeksRemaining: star.contractWeeks, totalWeeks: star.contractWeeks, signingBonus: 0, bonuses: emptyBonuses(), role: 'STAR', releaseClause: null, loyaltyBonus: 0, signedCycle: state.clock.cycle, minutesPlayed: 0, minutesAvailable: 0 };
  const player: Player = {
    id: star.id, identityKind: 'FICTIONAL', sourcePackId: 'creator-club', firstName: star.firstName, lastName: star.lastName, displayName: star.name,
    shirtNumber, age: star.age, nationality: 'VLD', position: star.position, secondaryPositions: ['LW'], footedness: 'both', height: 184,
    attributes: { ...star.attributes }, mental: { ...emptyMental(80), confidence: 85, morale: 85, professionalism: 90, loyalty: 85 }, traitIds: [],
    overall: star.overall, potential: star.potential, clubId: club.id, contractId: contract.id, fitness: 100, injury: null, suspensionMatches: 0,
    form: emptyForm(), history: [], marketValue: 0, reputation: 85, scouting: { confidence: 1, revealed: [] }, portraitSeed: star.id,
  };
  return { ...state, ledger: ledger.snapshot(),
    players: { ...state.players, [star.id]: { ...player, marketValue: marketValue(player, defaultValuationContext({ cycle: state.clock.cycle, season: state.clock.season, contract })) } },
    contracts: { ...state.contracts, [contract.id]: contract },
    clubs: { ...state.clubs, [club.id]: { ...club, squad: [...club.squad, star.id] } },
  };
}
