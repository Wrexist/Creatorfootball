import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlassButton, GlassPanel, GlassPill, GlassSheet, Screen, SectionHeader } from '@/design';
import { ArtImage } from '@/design/premium/components';
import { ROUTES } from '@/app/routes';
import { PRODUCTS, type ProductId } from '@/commerce/catalog';
import { useCommerceStore } from '@/commerce/store';
import { purchaseAvailability } from '@/commerce/revenuecat';

export function StoreScreen(): ReactNode {
  const navigate = useNavigate();
  const store = useCommerceStore();
  const availability = purchaseAvailability();
  const [selected, setSelected] = useState<ProductId | null>(null);
  const product = PRODUCTS.find(p => p.id === selected);
  const quote = store.quotes.find(q => q.id === selected);
  return <Screen title="Club collection" subtitle="Make this world yours" onBack={() => navigate(ROUTES.club)}>
    <GlassPanel padding="md" accent="volt">
      <p className="font-display text-[22px] font-bold">More character. Same beautiful game.</p>
      <p className="mt-2 text-sm text-ink-muted">Original looks and storytelling. One-time purchases, with no subscriptions or random rewards. Your complete career is included.</p>
      <GlassButton className="mt-3" block onClick={() => navigate(ROUTES.contentPacks)}>Your content packs</GlassButton>
    </GlassPanel>
    {!availability.enabled && <p className="text-sm text-ink-muted" role="status">{availability.reason}</p>}
    {(store.message || store.error) && <GlassPanel padding="md"><p role={store.error ? 'alert' : 'status'} className="text-sm">{store.error || store.message}</p></GlassPanel>}
    <SectionHeader title="Original collections" subtitle="Every item, explained" />
    {PRODUCTS.map(p => {
      const owned = store.owned.includes(p.id);
      const price = store.quotes.find(q => q.id === p.id)?.price;
      return <GlassPanel key={p.id} padding="none" className="overflow-hidden">
        <ArtImage asset={p.art} className="h-36 w-full object-cover" />
        <div className="p-4">
          <div className="flex items-center justify-between gap-2"><h2 className="font-display text-xl font-bold">{p.name}</h2><GlassPill tone={owned ? 'positive' : 'neutral'}>{owned ? 'Owned' : 'One-time'}</GlassPill></div>
          <p className="mt-2 text-sm text-ink-muted">{p.description}</p>
          <GlassButton className="mt-3" block onClick={() => owned ? navigate(ROUTES.contentPacks) : setSelected(p.id)}>
            {owned ? 'Manage pack' : price ? `View pack · ${price}` : 'Explore pack'}
          </GlassButton>
        </div>
      </GlassPanel>;
    })}
    {availability.enabled && <div className="grid grid-cols-2 gap-3">
      <GlassButton loading={store.busy} onClick={() => void store.restore()}>Restore purchases</GlassButton>
      <GlassButton disabled={store.busy} onClick={() => void store.refresh()}>Refresh store</GlassButton>
    </div>}
    <p className="text-xs leading-relaxed text-ink-muted">Purchases use your Apple or Google store account through RevenueCat. Restore on the same store platform. Career files stay on this device and are backed up separately in Local saves.</p>
    <GlassSheet open={!!product} onClose={() => !store.busy && setSelected(null)} title={product?.name} dismissible={!store.busy}>
      {product && <div className="space-y-4 p-4">
        <ArtImage asset={product.art} className="h-40 w-full rounded-xl object-cover" />
        <p className="text-sm text-ink-muted">{product.description}</p>
        <ul className="list-inside list-disc space-y-2 text-sm">{product.contents.map(item => <li key={item}>{item}</li>)}</ul>
        <p className="text-sm">One-time unlock. No gameplay advantage. Enable your pack after purchase.</p>
        {store.error && <p role="alert" className="text-sm text-danger">{store.error}</p>}
        {store.message && <p role="status" className="text-sm">{store.message}</p>}
        {store.owned.includes(product.id) ? <GlassButton variant="primary" block onClick={() => navigate(ROUTES.contentPacks)}>Choose your content</GlassButton> :
          <GlassButton variant="primary" block disabled={!availability.enabled || !quote || store.busy} loading={store.busy} onClick={() => void store.buy(product.id)}>{quote ? `Buy once · ${quote.price}` : 'Purchase unavailable'}</GlassButton>}
        {!availability.enabled ? <p className="text-sm text-ink-muted">{availability.reason}</p> : !quote && <p className="text-sm text-ink-muted">Your store has not returned a price for this pack. Refresh the store when connected.</p>}
      </div>}
    </GlassSheet>
  </Screen>;
}
