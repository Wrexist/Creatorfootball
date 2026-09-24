import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { GlassButton, GlassPanel, GlassPill, GlassSheet, Screen } from '@/design';
import { ArtImage } from '@/design/premium/components';
import { ROUTES } from '@/app/routes';
import { PRODUCTS } from '@/commerce/catalog';
import { useCommerceStore } from '@/commerce/store';
import { purchaseAvailability } from '@/commerce/revenuecat';
import { collectionReturn, quoteState, selectedPack } from '@/commerce/presentation';
import { useGameStore } from '@/state/gameStore';
import { PackPreview } from './PackPreview';
import './collection.css';
import { CreatorClub } from './CreatorClub';

const HEADLINES = {
  cf_club_nights: 'Your arena. A different kind of night.',
  cf_heritage_collection: 'Give your club a signature look.',
  cf_creator_stories: 'Make every chapter feel more personal.',
} as const;

export function StoreScreen(): ReactNode {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const store = useCommerceStore();
  const game = useGameStore();
  const availability = purchaseAvailability();
  const product = PRODUCTS.find(p => p.id === selectedPack(params));
  const quote = store.quotes.find(q => q.id === product?.id);
  const status = quoteState(availability.enabled, store.ready, !!quote);
  const [activating, setActivating] = useState(false);
  const close = (): void => { if (!store.busy) { setActivating(false); const next = new URLSearchParams(params); next.delete('pack'); setParams(next, { replace: true }); } };
  useEffect(() => {
    if (!activating || game.busy || game.unsaved || game.saveError || game.saveConflict) return;
    setActivating(false);
    navigate(product?.id === 'cf_creator_stories' ? ROUTES.social : `${ROUTES.club3d}?scene=${product?.id === 'cf_heritage_collection' ? 'kit' : 'campus'}&open=1`);
  }, [activating, game.busy, game.unsaved, game.saveError, game.saveConflict, navigate, product?.id]);
  const activate = (): void => {
    if (!product || !store.owned.includes(product.id) || !game.state || game.busy || game.saveConflict) return;
    game.apply(current => ({ ...current, settings: { ...current.settings, enabledPackIds: [...new Set([...current.settings.enabledPackIds, product.packId])] } }));
    setActivating(true);
  };
  const footer = product && <div className="cf-purchase-block">
    {store.error && <p role="alert">{store.error}</p>}{store.message && <p role="status">{store.message}</p>}
    {game.saveError && activating && <p role="alert">Your choice could not be saved. Retry from Content packs.</p>}
    {store.owned.includes(product.id) ? <GlassButton variant="primary" block disabled={game.busy || game.saveConflict || activating} loading={activating && !game.saveError} onClick={activate}>Activate and explore</GlassButton> :
      <GlassButton variant="primary" block disabled={status !== 'available' || store.busy} loading={store.busy || status === 'loading'} onClick={() => void store.buy(product.id)}>{status === 'loading' ? 'Loading store price…' : quote && availability.enabled ? `Buy once · ${quote.price}` : 'Purchase unavailable'}</GlassButton>}
    <p>One-time purchase · No subscription · Full career included</p>
    {availability.enabled && status === 'unavailable' && <GlassButton disabled={store.busy} onClick={() => void store.refresh()}>Retry price</GlassButton>}
    <GlassButton variant="ghost" disabled={store.busy} onClick={close}>Not now</GlassButton>
  </div>;
  return <Screen title="Club collection" subtitle="Make this world yours" onBack={() => navigate(collectionReturn(params))}>
    <div className="cf-collection-intro"><span className="cf-eyebrow">Your club. Your signature.</span><h2>More atmosphere.<br />More of your story.</h2><p>Explore original looks and storytelling. Your complete career stays free.</p></div>
    {!availability.enabled && <p className="text-sm text-ink-muted" role="status">{availability.reason}</p>}
    <CreatorClub />
    {(store.message || store.error) && !product && <GlassPanel padding="md"><p role={store.error ? 'alert' : 'status'} className="text-sm">{store.error || store.message}</p></GlassPanel>}
    {PRODUCTS.map(p => {
      const owned = store.owned.includes(p.id);
      const price = store.quotes.find(q => q.id === p.id)?.price;
      return <article key={p.id} className="cf-collection-card">
        <ArtImage asset={p.art} className="h-44 w-full object-cover" />
        <div className="cf-collection-card-body"><div className="flex items-center justify-between gap-2"><h2>{p.name}</h2><GlassPill tone={owned ? 'positive' : 'neutral'}>{owned ? 'Owned' : 'One-time'}</GlassPill></div>
          <p>{p.description}</p><GlassButton block onClick={() => { const next = new URLSearchParams(params); next.set('pack', p.id); setParams(next, { replace: true }); }}>
            {owned ? 'View owned pack' : price ? `View pack · ${price}` : 'Explore pack'}
          </GlassButton></div>
      </article>;
    })}
    <div className="cf-store-links"><GlassButton variant="ghost" onClick={() => navigate(ROUTES.contentPacks)}>Your content packs</GlassButton>
      {availability.enabled && <><GlassButton variant="ghost" loading={store.busy} onClick={() => void store.restore()}>Restore purchases</GlassButton><GlassButton variant="ghost" disabled={store.busy} onClick={() => void store.refresh()}>Refresh store</GlassButton></>}
    </div>
    <p className="text-xs leading-relaxed text-ink-muted">These collections are one-time purchases, with no random rewards or gameplay advantage. Restore with the same Apple or Google store account. Local careers are backed up separately in Local saves.</p>
    <GlassSheet open={!!product} onClose={close} title={product?.name} dismissible={!store.busy} size="tall" footer={footer}>
      {product && <div className="cf-collection-detail p-4"><h2>{HEADLINES[product.id]}</h2><PackPreview key={product.id} id={product.id} />
        <ul className="space-y-2">{product.contents.map(item => <li key={item}>{item}</li>)}</ul>
        {!availability.enabled && <p className="text-sm text-ink-muted">{availability.reason}</p>}
        {availability.enabled && status === 'unavailable' && <p className="text-sm text-ink-muted">Your store has not returned a price. Check your connection and try again.</p>}
      </div>}
    </GlassSheet>
  </Screen>;
}
