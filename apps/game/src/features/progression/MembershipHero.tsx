import type { ReactNode } from 'react';
import { ClubBadge, PlayerPortrait } from '@/design';
import { useGameStore } from '@/state/gameStore';
import { PAYWALL_ART } from '@/commerce/paywallAssets';
import { MEMBER_SUPERSTAR } from '@cf/engine';

export function MembershipHero(): ReactNode {
  const state = useGameStore(s => s.state);
  const club = state?.clubs[state.playerClubId];
  if (!club || !state) return null;
  const starters = Object.values(club.tactics.lineup).filter((id): id is NonNullable<typeof id> => !!id);
  const squad = [...new Set([...starters, ...club.squad])].slice(0, 3).map(id => state.players[id]).filter(p => !!p);
  return <header className="cf-member-hero">
    <img className="cf-member-hero-scene" src={PAYWALL_ART.tunnel.src} alt="" onError={event => { if (!event.currentTarget.src.endsWith(PAYWALL_ART.tunnel.fallback)) event.currentTarget.src = PAYWALL_ART.tunnel.fallback; }} />
    <div className="cf-member-hero-copy"><h2 id="creator-club-title">CREATOR<br /><span>CLUB</span></h2><p>YOUR {MEMBER_SUPERSTAR.overall}-RATED<br />SUPERSTAR AWAITS.</p></div>
    <div className="cf-member-shirt-crest" aria-hidden="true"><ClubBadge visual={club.visual} size={50} /></div>
    <div className="cf-member-team"><ClubBadge visual={club.visual} size={42} label={`${club.name} crest`} /><div><strong>{club.name}</strong><span>Your club. Your advantage.</span></div>
      <div className="cf-member-squad" aria-label={`${club.name} squad`}>{squad.map(player => <PlayerPortrait key={player.id} seed={player.portraitSeed} size={42} colors={club.visual} label={`${player.firstName} ${player.lastName}`} />)}</div>
    </div>
  </header>;
}
