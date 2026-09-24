import { Ledger } from '../economy/ledger';
import type { CreatorId } from '../core/brand';
import type { GameState } from '../game/state';
import { emptyCreatorAttributes, type Creator } from '../creators/creator';

export const MEMBER_MONTHLY_CASH = 25_000;
export const MEMBER_CREATORS = [
  { id: 'creator_member_mika', name: 'Mika Sol', handle: 'mikasideline', tone: 'ANALYTICAL', bio: 'A fictional local analyst who turns training-ground details into matchday stories.' },
  { id: 'creator_member_remi', name: 'Remi Vale', handle: 'remiontheterrace', tone: 'WHOLESOME', bio: 'A fictional community filmmaker documenting the people behind the club.' },
] as const;
export interface MemberBenefitProof { checkedAt: number; expiresAt: number; trial: boolean }
export function memberRewardKey(kind: 'cash' | 'creator', proof: MemberBenefitProof): string {
  return `creator-club:${kind}:${new Date(proof.checkedAt).toISOString().slice(0, 7)}`;
}
/** Commerce supplies verified store time; advancing game weeks never creates another claim. */
export function claimMemberBenefit(state: GameState, proof: MemberBenefitProof, kind: 'cash' | 'creator', creatorId?: string): GameState {
  if (!Number.isFinite(proof.checkedAt) || !Number.isFinite(proof.expiresAt) || proof.expiresAt <= proof.checkedAt || proof.trial) return state;
  const club = state.clubs[state.playerClubId];
  if (!club) return state;
  const pick = MEMBER_CREATORS.find(c => c.id === creatorId);
  if (kind === 'creator' && !pick) return state;
  const ledger = Ledger.restore(state.ledger);
  const key = memberRewardKey(kind, proof);
  if (ledger.hasApplied(key)) return state;
  const posted = ledger.credit(club.id, 'STORE_PURCHASE', kind === 'cash' ? MEMBER_MONTHLY_CASH : 0,
    kind === 'cash' ? 'Creator Club monthly club funds (in-game)' : `Creator Club collaboration: ${pick!.name}`,
    { cycle: state.clock.cycle, season: state.clock.season, at: proof.checkedAt }, { idempotencyKey: key });
  if (!posted.ok) return state;
  if (kind === 'cash') return { ...state, ledger: ledger.snapshot() };
  const id = pick!.id as CreatorId;
  const existing = state.creators[id];
  // Authored identities are stable. Collaboration lasts four in-game weeks; normal creator simulation applies.
  const creator: Creator = { ...existing, id, identityKind: 'FICTIONAL', sourcePackId: 'creator-club', handle: pick!.handle,
    displayName: pick!.name, roles: ['INFLUENCER', 'CLUB_PERSONALITY'], tier: existing?.tier ?? 'LOCAL',
    followers: existing?.followers ?? 20_000, attributes: existing?.attributes ?? { ...emptyCreatorAttributes(55), controversy: 15, loyalty: 70 },
    style: { tone: pick!.tone, platforms: ['SHORTFORM', 'TEXT'], postingFrequency: 2 },
    clubId: club.id, playerId: null, clubSentiment: Math.max(existing?.clubSentiment ?? 0, 30), marketValue: existing?.marketValue ?? 12000,
    dealWeeksRemaining: Math.max(existing?.dealWeeksRemaining ?? 0, 4), retainerPerCycle: 0, dealSignedCycle: state.clock.cycle,
    avatarSeed: pick!.id, bio: pick!.bio };
  const clubs = { ...state.clubs };
  if (existing?.clubId && existing.clubId !== club.id && clubs[existing.clubId]) {
    // Do not poach an associated creator through a membership claim.
    return state;
  }
  clubs[club.id] = { ...club, creatorIds: [...new Set([...club.creatorIds, id])] };
  return { ...state, ledger: ledger.snapshot(), creators: { ...state.creators, [id]: creator }, clubs };
}
