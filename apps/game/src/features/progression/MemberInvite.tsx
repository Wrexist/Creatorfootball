import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClubBadge } from '@/design';
import { useGameStore } from '@/state/gameStore';
import { useMembershipStore } from '@/commerce/membershipStore';
import { membershipActive } from '@/commerce/membership';
import { MEMBER_SUPERSTAR } from '@cf/engine';
import { ROUTES } from '@/app/routes';
import './membership.css';

export function MemberInvite(): ReactNode {
  const club = useGameStore(s => s.state?.clubs[s.state.playerClubId]);
  const membership = useMembershipStore();
  const member = membershipActive(membership.member);
  const navigate = useNavigate();
  if (!club) return null;
  return <button type="button" className="cf-member-invite" onClick={() => navigate(`${ROUTES.store}?membership=1`)}>
    <ClubBadge visual={club.visual} size={44} /><span><strong>{member ? 'Your Creator Club benefits' : `A ${MEMBER_SUPERSTAR.overall}-rated superstar. Your club.`}</strong><small>{member ? 'Open your signings and career rewards' : `Unlock ${MEMBER_SUPERSTAR.name}, club funds and creator deals with Creator Club`}</small></span><span aria-hidden="true">›</span>
  </button>;
}
