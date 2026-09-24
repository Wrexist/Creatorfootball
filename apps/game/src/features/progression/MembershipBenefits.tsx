import type { ReactNode } from 'react';
import { MEMBER_CREATORS, MEMBER_CREATOR_WEEKS, MEMBER_MONTHLY_CASH, MEMBER_SUPERSTAR } from '@cf/engine';
import { ClubBadge } from '@/design';
import { ArtImage } from '@/design/premium/components';
import { PAYWALL_ART } from '@/commerce/paywallAssets';
import { useGameStore } from '@/state/gameStore';
import type { IllustratedGameState } from '@/design/art/identity';

export function MembershipBenefits(): ReactNode {
  const state = useGameStore(s => s.state) as IllustratedGameState | null;
  const club = state?.clubs[state.playerClubId];
  if (!club) return null;
  const creatorArt = (id: string): string => state?.visualIdentity?.creators[id] ?? `character.staff-${String([...id].reduce((n,c) => ((n*31+c.charCodeAt(0)) >>> 0),0)%8+1).padStart(2,'0')}`;
  return <div className="cf-member-rewards" aria-label="Membership rewards">
    <details><summary><span className="cf-member-reward-art"><img src={PAYWALL_ART.funds.src} alt="" onError={e => { e.currentTarget.style.visibility = 'hidden'; }} /><span className="cf-member-coin-crest"><ClubBadge visual={club.visual} size={35} /></span></span><span><strong>£{MEMBER_MONTHLY_CASH.toLocaleString('en-GB')} in club funds</strong><small>A bigger budget. Every paid month.</small></span><span aria-hidden="true">›</span></summary><p>Claim once per UTC calendar month per career during paid membership. Real in-game funds for your club’s decisions, recorded in Finances. Not included in the free trial; no cash value.</p></details>
    <details><summary><span className="cf-member-reward-art cf-member-creator-art">{MEMBER_CREATORS.map(c => <ArtImage key={c.id} asset={creatorArt(c.id)} className="h-full w-1/2 object-cover" />)}</span><span><strong>Sign an established creator</strong><small>500K starting audience. Zero fees.</small></span><span aria-hidden="true">›</span></summary><p>Choose Mika Sol or Remi Vale once per UTC calendar month during paid membership. {MEMBER_CREATOR_WEEKS} in-game weeks, no signing fee or retainer, and a starting audience of at least 500,000. Creator skills affect existing campaign, fan and commercial systems; results depend on your decisions.</p></details>
    <details className="cf-member-superstar"><summary>
      <span className="cf-member-star-art"><ArtImage asset="character.member-kai-arden" className="h-full w-full object-cover" /><span className="cf-member-star-crest"><ClubBadge visual={club.visual} size={30} /></span><span className="cf-member-star-rating">{MEMBER_SUPERSTAR.overall}<small>OVR · ST</small></span></span>
      <span className="cf-member-star-copy"><small>YOUR WELCOME SIGNING</small><strong>KAI<br />ARDEN</strong><span>Superstar quality.<br />Your club colours.</span><span className="cf-member-star-stats"><b>{MEMBER_SUPERSTAR.attributes.finishing}<small>FINISHING</small></b><b>{MEMBER_SUPERSTAR.attributes.pace}<small>PACE</small></b></span></span><span aria-hidden="true">›</span>
    </summary><p>Guaranteed {MEMBER_SUPERSTAR.overall}-rated striker, age {MEMBER_SUPERSTAR.age}, {MEMBER_SUPERSTAR.potential} potential. Claim once per career during verified paid membership; not in the free trial. No transfer or signing fee. {MEMBER_SUPERSTAR.contractWeeks}-week contract at £{MEMBER_SUPERSTAR.wage.toLocaleString('en-GB')} in-game wages per week. He joins your real squad with normal development, injury, transfer and contract rules. No random draw or guaranteed match wins.</p></details>
    <p className="cf-member-library-note">Also included: the growing monthly library, First Lights stories and commentary, and exclusive stadium lighting.</p>
  </div>;
}
