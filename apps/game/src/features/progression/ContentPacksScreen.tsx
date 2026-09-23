import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlassButton, GlassPanel, GlassPill, Screen, SectionHeader } from '@/design';
import { ArtImage } from '@/design/premium/components';
import { ROUTES } from '@/app/routes';
import { PRODUCTS } from '@/commerce/catalog';
import { FREE_PACK, FREE_PACK_ID } from '@/commerce/packs';
import { useCommerceStore } from '@/commerce/store';
import { useGameStore } from '@/state/gameStore';

export function ContentPacksScreen(): ReactNode {
  const navigate = useNavigate();
  const state = useGameStore(s => s.state);
  const busy = useGameStore(s => s.busy || s.saveConflict);
  const saving = useGameStore(s => s.unsaved && !s.saveError && !s.saveConflict);
  const owned = useCommerceStore(s => s.owned);
  if (!state) return null;
  const enabled = state.settings.enabledPackIds;
  const toggle = (id: string): void => useGameStore.getState().apply(current => ({ ...current, settings: { ...current.settings,
    enabledPackIds: current.settings.enabledPackIds.includes(id) ? current.settings.enabledPackIds.filter(key => key !== id) : [...current.settings.enabledPackIds, id],
  } }));
  const packs = [{ id: FREE_PACK_ID, name: FREE_PACK.manifest.name, description: FREE_PACK.manifest.description, art: 'story.matchday', available: true },
    ...PRODUCTS.map(p => ({ id: p.packId, name: p.name, description: p.description, art: p.art, available: owned.includes(p.id) }))];
  return <Screen title="Content packs" subtitle="Your club, your edition" onBack={() => navigate(ROUTES.settings)}>
    <GlassPanel padding="md" accent="volt"><h2 className="font-display text-xl font-bold">The whole game is yours</h2><p className="mt-2 text-sm text-ink-muted">The fictional base universe is always active. Optional collections change the presentation, never player ability or match results.</p><GlassPill className="mt-3" tone="positive">Base universe · Included</GlassPill></GlassPanel>
    <SectionHeader title="Choose your atmosphere" subtitle="Saved with this career" />
    {packs.map(pack => <GlassPanel key={pack.id} padding="none" className="overflow-hidden">
      <ArtImage asset={pack.art} className="h-32 w-full object-cover" />
      <div className="space-y-3 p-4"><div className="flex items-start justify-between gap-2"><h2 className="font-display text-xl font-bold">{pack.name}</h2><GlassPill tone={!saving && pack.available && enabled.includes(pack.id) ? 'positive' : 'neutral'}>{!pack.available ? 'Locked' : saving ? 'Saving' : enabled.includes(pack.id) ? 'Enabled' : 'Available'}</GlassPill></div>
        <p className="text-sm text-ink-muted">{pack.description}</p>
        {pack.available ? <GlassButton block aria-pressed={enabled.includes(pack.id)} disabled={busy} loading={saving} onClick={() => toggle(pack.id)}>{saving ? 'Saving choice…' : `${enabled.includes(pack.id) ? 'Disable' : 'Enable'} ${pack.name}`}</GlassButton> : <GlassButton block onClick={() => navigate(ROUTES.store)}>View in collection</GlassButton>}
      </div></GlassPanel>)}
    <p className="text-sm text-ink-muted">3D looks appear in Club → Explore in 3D. Commentary changes apply to the next match; story versions appear when real events produce them. Disabling a pack keeps existing career history.</p>
  </Screen>;
}
