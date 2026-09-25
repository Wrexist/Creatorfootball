import { useCallback, useRef, useState, type ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { claimMemberBenefit, Ledger, MEMBER_CREATORS, MEMBER_MONTHLY_CASH, MEMBER_SUPERSTAR, memberRewardKey } from '@cf/engine';
import { GlassButton, GlassPanel, ClubBadge } from '@/design';
import { useMembershipStore } from '@/commerce/membershipStore';
import { MEMBER_PLANS, membershipActive, yearlySaving, type MemberPlanId } from '@/commerce/membership';
import { MEMBER_LIBRARY_ID, MEMBER_RELEASES } from '@/commerce/memberLibrary';
import { purchaseAvailability } from '@/commerce/revenuecat';
import { useGameStore } from '@/state/gameStore';
import { ROUTES } from '@/app/routes';
import { Portal } from '@/design/glass/Portal';
import { useEscapeKey, useFocusTrap, useScrollLock } from '@/design/glass/useOverlay';
import { MembershipHero } from './MembershipHero';
import { MembershipBenefits } from './MembershipBenefits';
import { MemberCelebration, type MemberCelebrationEvent } from './MemberCelebration';
import { sfx } from '@/design/audio';
import { haptics } from '@/design/haptics';
import './membership.css';

export function CreatorClub({ initiallyOpen = false, hideBanner = false }: { initiallyOpen?: boolean; hideBanner?: boolean } = {}): ReactNode {
  const store = useMembershipStore();
  const game = useGameStore();
  const navigate = useNavigate();
  const [planId, setPlan] = useState<MemberPlanId>('cf_creator_club_yearly');
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(initiallyOpen || params.get('membership') === '1');
  const panelRef = useRef<HTMLElement>(null);
  const [claiming, setClaiming] = useState(false);
  const [message, setMessage] = useState('');
  const [celebration, setCelebration] = useState<MemberCelebrationEvent | null>(null);
  const benefitsRef = useRef<HTMLDivElement>(null);
  const dismissCelebration = useCallback(() => {
    setCelebration(null);
    requestAnimationFrame(() => { benefitsRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' }); });
  }, []);
  const celebrate = (event: MemberCelebrationEvent): void => {
    setCelebration(event);
    if (event.kind === 'superstar') sfx.signing(); else sfx.reward();
    haptics.success();
  };
  const buy = async (): Promise<void> => {
    const purchased = await store.buy(planId);
    if (purchased) celebrate({ kind: purchased.trial ? 'trial' : 'paid' });
  };
  const close = useCallback(() => { if (store.busy || claiming) return; setOpen(false); const next = new URLSearchParams(params); next.delete('membership'); setParams(next, { replace: true }); }, [store.busy, claiming, params, setParams]);
  useScrollLock(open); useFocusTrap(open && !celebration, panelRef); useEscapeKey(open && !store.busy && !claiming, celebration ? dismissCelebration : close);
  const club = game.state?.clubs[game.state.playerClubId];
  const active = membershipActive(store.member);
  const paid = active && !store.member?.trial;
  const quote = store.quotes.find(q => q.id === planId);
  const plan = MEMBER_PLANS.find(p => p.id === planId)!;
  const saving = yearlySaving(store.quotes);
  const disabled = claiming || store.busy || game.busy || game.unsaved || game.saveConflict || !!game.saveError;
  const claimed = (kind: 'cash' | 'creator' | 'superstar'): boolean => !!game.state && !!store.member && Ledger.restore(game.state.ledger).hasApplied(memberRewardKey(kind, store.member));
  const claim = async (kind: 'cash' | 'creator' | 'superstar', creator?: string): Promise<void> => {
    if (disabled || !game.state) return;
    const saveId = game.state.saveId;
    setClaiming(true); setMessage('');
    try {
      await store.refresh();
      const verified = useMembershipStore.getState();
      const current = useGameStore.getState();
      if (verified.error || !membershipActive(verified.member) || verified.member!.trial || Math.abs(Date.now() - verified.member!.checkedAt) > 300000) {
        setMessage('Connect to verify a paid membership before claiming. Free trials do not include these bonuses.'); return;
      }
      if (!current.state || current.state.saveId !== saveId || current.busy || current.unsaved || current.saveConflict || current.saveError) {
        setMessage('Finish saving this career, then try again.'); return;
      }
      const next = claimMemberBenefit(current.state, verified.member!, kind, creator);
      if (next === current.state) { setMessage(kind === 'superstar' ? 'This welcome signing has already been claimed or is unavailable in this career.' : 'Already claimed this month, or this creator is unavailable.'); return; }
      current.apply(s => s === current.state ? next : s);
      if (useGameStore.getState().state?.ledger !== next.ledger) { setMessage('Your career changed. Check your benefits and try again.'); return; }
      if (await useGameStore.getState().save()) {
        setMessage('Benefit saved to this career.');
        if (useGameStore.getState().state?.saveId === saveId) celebrate({ kind, creator });
      } else setMessage('Benefit applied, but saving failed. Retry saving before leaving.');
    } catch {
      setMessage('The reward could not be confirmed as saved. Check your career and save status before trying again.');
    } finally { setClaiming(false); }
  };
  const enable = (): void => game.apply(s => ({ ...s, settings: { ...s.settings, enabledPackIds: [...new Set([...s.settings.enabledPackIds, MEMBER_LIBRARY_ID])] } }));
  const option = (id: MemberPlanId): ReactNode => {
    const p = MEMBER_PLANS.find(x => x.id === id)!;
    const q = store.quotes.find(x => x.id === id);
    return <button type="button" className="cf-member-plan" key={id} aria-pressed={planId === id} onClick={() => setPlan(id)} disabled={store.busy}>
      <span>{p.label}{id === 'cf_creator_club_yearly' && saving && <small>Save {saving}% vs 12 monthly payments</small>}</span>
      <strong>{q ? `${q.price} / ${p.unit}` : 'Price unavailable'}</strong>
    </button>;
  };
  const checkout = <footer className="cf-paywall-purchase" aria-label="Membership checkout">
    <div className="cf-paywall-plans" aria-label="Choose billing period">{MEMBER_PLANS.map(p => <button type="button" key={p.id} aria-pressed={planId === p.id} disabled={store.busy} onClick={() => setPlan(p.id)}>{p.label}<strong>{store.quotes.find(q => q.id === p.id)?.price ?? 'Unavailable'}</strong></button>)}</div>
    {quote && <p className="cf-paywall-billing">{quote.trialDays ? `7 days free, then ${quote.price} per ${plan.unit}.` : `${quote.price} per ${plan.unit}, charged now.`} Auto-renews until cancelled.</p>}
    <GlassButton block variant="primary" disabled={!quote || store.busy || !purchaseAvailability().enabled} loading={store.busy} onClick={() => void buy()}>{quote ? quote.trialDays ? 'Start 7-day free trial' : `Subscribe · ${quote.price} / ${plan.unit}` : 'Membership unavailable'}</GlassButton>
    {quote?.trialDays === 7 && <p className="cf-paywall-trial">Trial: library + lighting. Player, funds and creator rewards unlock when paid.</p>}
    {store.error && <p role="alert">{store.error}</p>}
    {store.message && <p role="status">{store.message}</p>}
  </footer>;
  return <>{!hideBanner && <GlassPanel padding="md" accent="volt" className="cf-member-store-banner"><div className="cf-member-banner-title">{club && <ClubBadge visual={club.visual} size={52} />}<h2 className="font-display text-3xl font-bold">Creator Club</h2></div><p className="mt-2">Sign Kai Arden. Your 90-rated superstar awaits.</p><p className="my-3 text-sm">{'\u00a3'}{MEMBER_MONTHLY_CASH.toLocaleString('en-GB')} monthly in-game funds, established creator deals and a growing member library.</p><GlassButton block variant="primary" onClick={() => setOpen(true)}>{active ? 'Open your benefits' : 'Unlock your club advantage'}</GlassButton></GlassPanel>}
    <Portal>{open && <div className="cf-paywall-backdrop"><section ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={celebration ? 'member-reward-title' : 'creator-club-title'} tabIndex={-1} className="cf-paywall">
      {celebration ? <MemberCelebration event={celebration} onDone={dismissCelebration} /> : <>
      <button type="button" className="cf-paywall-close" aria-label="Close membership" disabled={store.busy || claiming} onClick={close}><svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg></button>
      <div className="cf-paywall-scroll"><MembershipHero /><div className="cf-paywall-body"><MembershipBenefits />
      {!active && <div className="cf-member-checkout cf-member-footer">{option('cf_creator_club_yearly')}{option('cf_creator_club_monthly')}{option('cf_creator_club_weekly')}<p>All plans include the same benefits. Cancel through your store account.</p></div>}
      {active && <div ref={benefitsRef} className="cf-member-checkout">
        <p>{store.member!.willRenew ? 'Renews' : 'Access ends'} {new Date(store.member!.expiresAt).toLocaleDateString()}.{store.member!.billingIssue && ' Your store has reported a billing issue. Check your payment method.'}</p>
        <h3>Your library</h3>
        {MEMBER_RELEASES.map(issue => <p key={issue.id}><strong>{issue.title}</strong> · {issue.commentary} commentary and {issue.stories} story variations</p>)}
        <GlassButton disabled={disabled || !!game.state?.settings.enabledPackIds.includes(MEMBER_LIBRARY_ID)} onClick={enable}>{game.state?.settings.enabledPackIds.includes(MEMBER_LIBRARY_ID) ? 'First Lights enabled' : 'Enable First Lights'}</GlassButton>
        <GlassButton onClick={() => navigate(`${ROUTES.club3d}?open=1`)}>Explore member lighting</GlassButton>
        <h3>Your superstar signing</h3>
        <p>{MEMBER_SUPERSTAR.name} · {MEMBER_SUPERSTAR.overall} OVR · {MEMBER_SUPERSTAR.contractWeeks}-week contract. No transfer or signing fee. £{MEMBER_SUPERSTAR.wage.toLocaleString('en-GB')} in-game wages per week; regular football, injury and contract rules apply. Once per career, during paid membership.</p>
        <GlassButton variant="primary" disabled={disabled || !paid || claimed('superstar')} onClick={() => void claim('superstar')}>{claimed('superstar') ? 'Welcome signing claimed' : `Sign ${MEMBER_SUPERSTAR.name} · £${MEMBER_SUPERSTAR.wage.toLocaleString('en-GB')}/week`}</GlassButton>
        {claimed('superstar') && <GlassButton onClick={() => navigate(ROUTES.squad)}>Open your squad</GlassButton>}
        <h3>Monthly career benefits</h3>
        <GlassButton disabled={disabled || !paid || claimed('cash')} onClick={() => void claim('cash')}>{claimed('cash') ? 'Club funds claimed this month' : `Claim £${MEMBER_MONTHLY_CASH.toLocaleString('en-GB')} in-game funds`}</GlassButton>
        {MEMBER_CREATORS.map(creator => <div key={creator.id}><strong>{creator.name}</strong><p className="text-sm text-ink-muted">{creator.bio}</p><GlassButton disabled={disabled || !paid || claimed('creator')} onClick={() => void claim('creator', creator.id)}>{claimed('creator') ? 'Creator collaboration claimed' : `Choose ${creator.name}`}</GlassButton></div>)}
        {!paid && <p>The superstar signing, club funds and creator collaborations unlock after the trial becomes a paid membership.</p>}
        <GlassButton variant="ghost" onClick={() => navigate(ROUTES.creators)}>Manage your creators</GlassButton>
      </div>}
      {(message || store.message) && <p role="status">{message || store.message}</p>}
      {store.error && <p role="alert">{store.error}</p>}
      <div className="cf-store-links">
        {purchaseAvailability().enabled && <><GlassButton variant="ghost" disabled={store.busy} onClick={() => void store.restore()}>Restore membership</GlassButton><GlassButton variant="ghost" disabled={store.busy} onClick={() => void store.refresh()}>Refresh membership</GlassButton></>}
        <a href={Capacitor.getPlatform() === 'android' ? 'https://play.google.com/store/account/subscriptions' : 'https://apps.apple.com/account/subscriptions'} target="_blank" rel="noreferrer">Manage subscription</a>
        <a href="https://wrexist.github.io/Creatorfootball/terms.html" target="_blank" rel="noreferrer">Terms</a><a href="https://wrexist.github.io/Creatorfootball/privacy.html" target="_blank" rel="noreferrer">Privacy</a>
      </div>
      <p className="text-sm text-ink-muted">Library and exclusive lighting require active membership. Claimed funds, signed player contracts, creator collaborations and career history remain after expiry. Unclaimed monthly bonuses do not accumulate. In-game funds have no cash value. One-time collections are sold separately.</p>
    </div></div>
    {!active && checkout}
    </>}
  </section></div>}</Portal></>;
}
