// Development-only presentation fixture. Not a production route or billing simulator.
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { createNewGame } from '@cf/engine';
import { useMembershipStore } from '../src/commerce/membershipStore';
import { CreatorClub } from '../src/features/progression/CreatorClub';
import { useGameStore } from '../src/state/gameStore';
import { withVisualIdentity } from '../src/design/art/identity';
import { MemberCelebration, type MemberCelebrationKind } from '../src/features/progression/MemberCelebration';
import '../src/design/tokens.css';
import '../src/design/premium.css';
import '../src/features/progression/membership.css';
const params = new URLSearchParams(location.search);
const state = withVisualIdentity(createNewGame({ seed: 'reward-visual-test', now: 1790000000000, manager: { kind: 'PREMADE', templateId: 'manager_vera_lindqvist' }, club: { kind: 'TEMPLATE', templateId: 'club_larkspur_wolves' } }));
useGameStore.setState({ state: { ...state, settings: { ...state.settings, reducedEffects: params.has('simple') } } });
const kind = (params.get('kind') ?? 'paid') as MemberCelebrationKind;
if (params.has('flow')) {
  // Isolated UI integration fixture: engine rewards are real; persistence and
  // verified billing responses are explicit test doubles, never native proof.
  useMembershipStore.setState({ member: { productId: 'cf_creator_club_yearly', checkedAt: Date.now(), expiresAt: Date.now() + 86400000, trial: kind === 'trial', willRenew: true, billingIssue: false }, ready: true, refresh: async () => {} });
  useGameStore.setState({ busy: false, unsaved: false, saveConflict: false, saveError: null,
    apply: mutate => { useGameStore.setState(s => ({ state: withVisualIdentity(mutate(s.state!)) })); },
    save: async () => !params.has('save-failure'),
  });
}
createRoot(document.getElementById('root')!).render(params.has('flow') ? <MemoryRouter><CreatorClub initiallyOpen hideBanner /></MemoryRouter> : <div className="cf-paywall-backdrop"><section className="cf-paywall" role="dialog" aria-modal="true" aria-labelledby="member-reward-title"><MemberCelebration event={{ kind, creator: 'creator_member_mika' }} onDone={() => { document.getElementById('root')!.textContent = 'Celebration dismissed'; }} /></section></div>);
