import { useState, type ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';
import { useNavigate } from 'react-router-dom';
import { claimMemberBenefit, Ledger, MEMBER_CREATORS, MEMBER_MONTHLY_CASH, memberRewardKey } from '@cf/engine';
import { GlassButton, GlassPanel, GlassPill, GlassSheet } from '@/design';
import { useMembershipStore } from '@/commerce/membershipStore';
import { MEMBER_PLANS, membershipActive, yearlySaving, type MemberPlanId } from '@/commerce/membership';
import { MEMBER_LIBRARY_ID, MEMBER_RELEASES } from '@/commerce/memberLibrary';
import { purchaseAvailability } from '@/commerce/revenuecat';
import { useGameStore } from '@/state/gameStore';
import { ROUTES } from '@/app/routes';

export function CreatorClub(): ReactNode {
  const store = useMembershipStore();
  const game = useGameStore();
  const navigate = useNavigate();
  const [planId, setPlan] = useState<MemberPlanId>('cf_creator_club_yearly');
  const [open, setOpen] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [message, setMessage] = useState('');
  const active = membershipActive(store.member);
  const paid = active && !store.member?.trial;
  const quote = store.quotes.find(q => q.id === planId);
  const plan = MEMBER_PLANS.find(p => p.id === planId)!;
  const saving = yearlySaving(store.quotes);
  const disabled = claiming || store.busy || game.busy || game.unsaved || game.saveConflict || !!game.saveError;
  const claimed = (kind: 'cash' | 'creator'): boolean => !!game.state && !!store.member && Ledger.restore(game.state.ledger).hasApplied(memberRewardKey(kind, store.member));
  const claim = async (kind: 'cash' | 'creator', creator?: string): Promise<void> => {
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
      if (next === current.state) { setMessage('Already claimed this month, or this creator is unavailable.'); return; }
      current.apply(s => s === current.state ? next : s);
      setMessage(await useGameStore.getState().save() ? 'Benefit saved to this career.' : 'Benefit applied, but saving failed. Retry saving before leaving.');
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
  const checkout = <div className="cf-member-checkout cf-member-footer">
        {store.error && <p role="alert">{store.error}</p>}
        {store.message && <p role="status">{store.message}</p>}
        {option('cf_creator_club_yearly')}{option('cf_creator_club_monthly')}
        <details><summary>More plans · Weekly</summary>{option('cf_creator_club_weekly')}</details>
        {quote && <p>{quote.trialDays ? `7 days free, then ${quote.price} per ${plan.unit}.` : `${quote.price} per ${plan.unit}, charged now.`} Automatically renews until cancelled through your store account. All plans include the same benefits.</p>}
        <GlassButton block variant="primary" disabled={!quote || store.busy || !purchaseAvailability().enabled} loading={store.busy} onClick={() => void store.buy(planId)}>{quote ? quote.trialDays ? 'Start 7-day free trial' : `Subscribe · ${quote.price} / ${plan.unit}` : 'Membership unavailable'}</GlassButton>
        {!quote && <p className="text-sm">Membership purchases are not available in this build or store yet. Your complete free career is available.</p>}
        <GlassButton variant="ghost" disabled={store.busy} onClick={() => setOpen(false)}>Continue free</GlassButton>
      </div>;
  return <><GlassPanel padding="md" accent="volt"><GlassPill tone="positive">{active ? 'Your membership' : 'Optional membership'}</GlassPill><h2 className="font-display text-3xl font-bold mt-3">Creator Club</h2><p className="mt-2">Build with more stories, club funds and creator collaborations.</p><p className="my-3 text-sm text-ink-muted">Monthly library · £25,000 in-game funds · Choose a creator · Exclusive campus lighting</p><GlassButton block variant="primary" onClick={() => setOpen(true)}>{active ? 'Open your benefits' : 'Explore membership'}</GlassButton><p className="mt-2 text-xs text-ink-muted">Paid-period funds and creators. Full career stays free.</p></GlassPanel>
    <GlassSheet open={open} onClose={() => { if (!store.busy && !claiming) setOpen(false); }} dismissible={!store.busy && !claiming} title="Creator Club" size="tall" footer={!active ? checkout : undefined}>
    <section className="cf-membership" aria-labelledby="creator-club-title">
    <div>
      <GlassPill tone="positive">{active ? store.member?.trial ? 'Trial active' : 'Member' : 'Optional membership'}</GlassPill>
      <h3 id="creator-club-title" className="font-display text-xl font-bold mt-3">Your membership includes</h3>
      <ul className="cf-member-benefits">
        <li><strong>£{MEMBER_MONTHLY_CASH.toLocaleString('en-GB')} in club funds</strong><span>In-game money, once per UTC calendar month per career during paid membership.</span></li>
        <li><strong>Choose a creator collaboration</strong><span>Mika Sol or Remi Vale, once per UTC calendar month per career. Four in-game weeks, with no retainer fee.</span></li>
        <li><strong>A growing monthly library</strong><span>First Lights is ready: 8 commentary variations and 6 story variations. New content every month.</span></li>
        <li><strong>Aurora & Copper dusk</strong><span>Two exclusive lighting looks for your interactive 3D campus.</span></li>
      </ul>
      <p className="text-sm text-ink-muted">Money and creators affect your career. These are gameplay benefits. Trial access includes the library and lighting only.</p>
      {active && <div className="cf-member-checkout">
        <p>{store.member!.willRenew ? 'Renews' : 'Access ends'} {new Date(store.member!.expiresAt).toLocaleDateString()}.{store.member!.billingIssue && ' Your store has reported a billing issue. Check your payment method.'}</p>
        <h3>Your library</h3>
        {MEMBER_RELEASES.map(issue => <p key={issue.id}><strong>{issue.title}</strong> · {issue.commentary} commentary and {issue.stories} story variations</p>)}
        <GlassButton disabled={disabled || !!game.state?.settings.enabledPackIds.includes(MEMBER_LIBRARY_ID)} onClick={enable}>{game.state?.settings.enabledPackIds.includes(MEMBER_LIBRARY_ID) ? 'First Lights enabled' : 'Enable First Lights'}</GlassButton>
        <GlassButton onClick={() => navigate(`${ROUTES.club3d}?open=1`)}>Explore member lighting</GlassButton>
        <h3>Monthly career benefits</h3>
        <GlassButton disabled={disabled || !paid || claimed('cash')} onClick={() => void claim('cash')}>{claimed('cash') ? 'Club funds claimed this month' : `Claim £${MEMBER_MONTHLY_CASH.toLocaleString('en-GB')} in-game funds`}</GlassButton>
        {MEMBER_CREATORS.map(creator => <div key={creator.id}><strong>{creator.name}</strong><p className="text-sm text-ink-muted">{creator.bio}</p><GlassButton disabled={disabled || !paid || claimed('creator')} onClick={() => void claim('creator', creator.id)}>{claimed('creator') ? 'Creator collaboration claimed' : `Choose ${creator.name}`}</GlassButton></div>)}
        {!paid && <p>Club funds and creator collaborations unlock after the trial becomes a paid membership.</p>}
        <GlassButton variant="ghost" onClick={() => navigate(ROUTES.creators)}>Manage your creators</GlassButton>
      </div>}
      {(message || store.message) && <p role="status">{message || store.message}</p>}
      {store.error && <p role="alert">{store.error}</p>}
      <div className="cf-store-links">
        {purchaseAvailability().enabled && <><GlassButton variant="ghost" disabled={store.busy} onClick={() => void store.restore()}>Restore membership</GlassButton><GlassButton variant="ghost" disabled={store.busy} onClick={() => void store.refresh()}>Refresh membership</GlassButton></>}
        <a href={Capacitor.getPlatform() === 'android' ? 'https://play.google.com/store/account/subscriptions' : 'https://apps.apple.com/account/subscriptions'} target="_blank" rel="noreferrer">Manage subscription</a>
        <a href="https://wrexist.github.io/Creatorfootball/terms.html" target="_blank" rel="noreferrer">Terms</a><a href="https://wrexist.github.io/Creatorfootball/privacy.html" target="_blank" rel="noreferrer">Privacy</a>
      </div>
      <p className="text-sm text-ink-muted">Library and exclusive lighting require active membership. Claimed funds, signed collaborations and existing career history remain after expiry. Unclaimed monthly bonuses do not accumulate. In-game funds have no cash value. One-time collections below are sold separately and remain yours.</p>
    </div>
  </section></GlassSheet></>;
}
