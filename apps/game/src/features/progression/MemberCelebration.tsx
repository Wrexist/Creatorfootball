import { useRef, type CSSProperties, type ReactNode } from 'react';
import { MEMBER_CREATORS, MEMBER_CREATOR_WEEKS, MEMBER_MONTHLY_CASH, MEMBER_SUPERSTAR } from '@cf/engine';
import { GlassButton, ClubBadge } from '@/design';
import { ArtImage } from '@/design/premium/components';
import { useDesignMotion } from '@/design/motion';
import { useFocusTrap } from '@/design/glass/useOverlay';
import { useGameStore } from '@/state/gameStore';
import { PAYWALL_ART } from '@/commerce/paywallAssets';
import { creatorPortraitAsset } from '@/design/art/identity';

export type MemberCelebrationKind = 'trial' | 'paid' | 'cash' | 'superstar' | 'creator';
export interface MemberCelebrationEvent { kind: MemberCelebrationKind; creator?: string }

/** Presentation only: the caller must verify a purchase or persist a claim first. */
export function MemberCelebration({ event, onDone }: { event: MemberCelebrationEvent; onDone: () => void }): ReactNode {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(true, ref);
  const state = useGameStore(s => s.state);
  const club = state?.clubs[state.playerClubId];
  const motion = useDesignMotion();
  const simple = motion.reduced || !!state?.settings.reducedMotion || !!state?.settings.reducedEffects;
  const creator = MEMBER_CREATORS.find(c => c.id === event.creator);
  const welcome = event.kind === 'trial' || event.kind === 'paid';
  const title = {
    trial: 'Your next chapter starts here', paid: 'Welcome to Creator Club',
    cash: `+£${MEMBER_MONTHLY_CASH.toLocaleString('en-GB')}`,
    superstar: `${MEMBER_SUPERSTAR.name} is yours`, creator: `${creator?.name ?? 'Your creator'} joins the club`,
  }[event.kind];
  return <div ref={ref} className="cf-member-celebration" data-simple={simple} tabIndex={-1}>
    <button type="button" className="cf-paywall-close" aria-label="Close reward celebration" onClick={onDone}>×</button>
    <div className="cf-member-celebration-content">
      {!simple && <div className="cf-reward-sparks" aria-hidden="true">{Array.from({ length: 14 }, (_, i) => <i key={i} style={{ '--i': i } as CSSProperties} />)}</div>}
      <p className="cf-reward-eyebrow">{welcome ? event.kind === 'trial' ? 'TRIAL ACTIVATED' : 'MEMBERSHIP CONFIRMED' : 'CLAIMED & SAVED'}</p>
      <div className="cf-reward-hero" data-kind={event.kind} aria-hidden="true">
        {event.kind === 'superstar' ? <ArtImage asset="character.member-kai-arden" className="cf-reward-player" />
          : event.kind === 'creator' && creator ? <ArtImage asset={creatorPortraitAsset(state, creator.id)} crop="hero" className="cf-reward-player" />
          : event.kind === 'cash' ? <img src={PAYWALL_ART.funds.src} alt="" onError={e => { e.currentTarget.style.visibility = 'hidden'; }} />
            : <img src={PAYWALL_ART.tunnel.src} alt="" onError={e => { e.currentTarget.style.visibility = 'hidden'; }} />}
        {club && <div className="cf-reward-club"><ClubBadge visual={club.visual} size={64} /></div>}
        {event.kind === 'superstar' && <strong className="cf-reward-rating">90<small>OVR · ST</small></strong>}
      </div>
      <h2 id="member-reward-title">{title}</h2>
      <p className="cf-reward-subtitle">{club?.name ?? 'Your club'}. A new chapter.</p>
      {event.kind === 'trial' && <><p>Your member library and exclusive stadium lighting are ready to explore.</p><p className="cf-reward-note">The superstar, club funds and creator deals unlock during paid membership. They have not been granted during your trial.</p></>}
      {event.kind === 'paid' && <><p>Your member library and stadium lighting are unlocked.</p><ul><li>Claim your 90-rated welcome signing</li><li>Claim £{MEMBER_MONTHLY_CASH.toLocaleString('en-GB')} in-game club funds</li><li>Choose your creator collaboration</li></ul><p className="cf-reward-note">Choose and claim your career rewards on the benefits screen. Unclaimed rewards have not yet been added to your save.</p></>}
      {event.kind === 'cash' && <p>Added to your club balance and saved to this career. Put your new budget to work.</p>}
      {event.kind === 'superstar' && <><p>Your guaranteed {MEMBER_SUPERSTAR.overall}-rated striker has joined the squad.</p><div className="cf-reward-stats"><span><b>{MEMBER_SUPERSTAR.attributes.finishing}</b>Finishing</span><span><b>{MEMBER_SUPERSTAR.attributes.pace}</b>Pace</span></div><p className="cf-reward-note">{MEMBER_SUPERSTAR.contractWeeks}-week contract · £{MEMBER_SUPERSTAR.wage.toLocaleString('en-GB')} weekly in-game wages. Saved to this career.</p></>}
      {event.kind === 'creator' && <p>Your {MEMBER_CREATOR_WEEKS}-week collaboration is saved. No signing fee or retainer. Build your next campaign together.</p>}
    </div>
    <footer><GlassButton block variant="primary" onClick={onDone}>{welcome ? 'Explore my benefits' : 'Back to my benefits'}</GlassButton></footer>
  </div>;
}
