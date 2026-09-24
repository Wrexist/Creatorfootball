import { lazy, Suspense, useState, type ReactNode } from 'react';
import { GlassButton, GlassSegmented } from '@/design';
import { ArtImage } from '@/design/premium/components';
import { PRODUCTS, type ProductId } from '@/commerce/catalog';
import { CREATOR_PACK } from '@/commerce/packs';
import { useGameStore } from '@/state/gameStore';
import { LIGHTING, type LightingId, type ModelId } from '@/world3d/manifest';
import '@/world3d/campus.css';

const ModelViewer = lazy(() => import('@/world3d/ModelViewer'));

/** Preview never writes ownership, pack settings or career state. */
export function PackPreview({ id }: { id: ProductId }): ReactNode {
  const state = useGameStore(s => s.state);
  const club = state?.clubs[state.playerClubId];
  const [interactive, setInteractive] = useState(false);
  const [lighting, setLighting] = useState<LightingId>('floodlit');
  const [model, setModel] = useState<ModelId>('kit-sash');
  const [finish, setFinish] = useState<'gold' | 'silver'>('gold');
  const product = PRODUCTS.find(p => p.id === id)!;
  if (id === 'cf_creator_stories') {
    const story = CREATOR_PACK.data.mediaTemplates?.find(p => p.trigger === 'PLAYER_SIGNED');
    const replace = (text: string): string => text.replaceAll('{club}', club?.name ?? 'your club').replaceAll('{player}', 'Morgan Vale').replaceAll('{fee}', '£45,000');
    return <div className="cf-pack-story"><ArtImage asset={product.art} className="h-36 w-full object-cover" />
      <div className="p-4"><span className="cf-eyebrow">Example signing story</span><h3>{replace(story?.headline ?? '')}</h3><p>{replace(story?.body ?? '')}</p><small>Sample names and fee. Your stories use real game events.</small></div>
    </div>;
  }
  return <div className="cf-pack-preview">
    {interactive && club ? <>
      <Suspense fallback={<p role="status" className="p-8">Loading preview…</p>}><ModelViewer model={id === 'cf_club_nights' ? 'campus' : model} lighting={id === 'cf_club_nights' ? lighting : 'daylight'} club={club} finish={finish} /></Suspense>
      {id === 'cf_club_nights' ? <GlassSegmented size="sm" aria-label="Preview lighting" value={lighting} onChange={setLighting} options={Object.entries(LIGHTING).filter(([key]) => key !== 'aurora' && key !== 'copper').map(([value, look]) => ({ value: value as LightingId, label: look.name }))} /> : <>
        <GlassSegmented size="sm" aria-label="Preview collection" value={model} onChange={setModel} options={[{ value: 'kit-classic', label: 'Included' }, { value: 'kit-sash', label: 'Sash' }, { value: 'kit-hoops', label: 'Hoops' }, { value: 'kit-pinstripe', label: 'Pinstripe' }, { value: 'trophy', label: 'Trophy' }]} />
        {model === 'trophy' && <GlassSegmented aria-label="Preview trophy finish" value={finish} onChange={setFinish} options={[{ value: 'gold', label: 'Antique gold' }, { value: 'silver', label: 'Silver' }]} />}
      </>}
      <p className="cf-pack-caption">Preview only · Your career is unchanged</p>
    </> : <div className="cf-pack-art"><ArtImage asset={product.art} className="h-56 w-full object-cover" /><span>Atmosphere illustration</span>
      {club && <GlassButton onClick={() => setInteractive(true)}>Preview actual 3D {id === 'cf_club_nights' ? 'lighting' : 'collection'}</GlassButton>}
    </div>}
  </div>;
}
