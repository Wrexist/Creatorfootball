import { lazy, Suspense, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlassButton, GlassPanel, GlassSegmented, Screen, formatMoney } from '@/design';
import { nextUpgrade, pendingProjects } from '@cf/engine';
import { facilityDefs } from '@/features/club/bridge';
import { ArtImage } from '@/design/premium/components';
import { useGameStore } from '@/state/gameStore';
import { useUiStore } from '@/state/uiStore';
import { useCommerceStore } from '@/commerce/store';
import { availablePackIds } from '@/commerce/packs';
import { ROUTES } from '@/app/routes';
import { CAMPUS_PREVIEWS, LIGHTING, type CampusPreviewId, type LightingId, type ModelId } from './manifest';
import './campus.css';

const ModelViewer=lazy(()=>import('./ModelViewer'));
export function Club3DScreen(): ReactNode {
  const navigate=useNavigate();
  const state=useGameStore(s=>s.state);
  const owned=useCommerceStore(s=>s.owned);
  const reduced=useUiStore(s=>s.reducedEffects);
  const [started,setStarted]=useState(false);
  const [scene,setScene]=useState<'campus'|'kit'|'trophy'|'football'>('campus');
  const [lighting,setLighting]=useState<LightingId>('daylight');
  const [pattern,setPattern]=useState<'classic'|'sash'|'hoops'|'pinstripe'>('classic');
  const [silver,setSilver]=useState(false);
  const [preview,setPreview]=useState<'your'|CampusPreviewId>('your');
  if(!state) return null;
  const club=state.clubs[state.playerClubId]!;
  const active=availablePackIds(state.settings.enabledPackIds,owned);
  const nights=active.includes('club-nights'), heritage=active.includes('heritage-collection');
  const model:ModelId=scene==='kit' ? `kit-${heritage?pattern:'classic'}` : scene;
  const example=preview==='your'?null:CAMPUS_PREVIEWS[preview];
  const level=club.facilityLevels.facility_stadium??0;
  const definitions=facilityDefs();
  const stadium=definitions.find(def=>def.id==='facility_stadium');
  const upgrade=nextUpgrade(club,'facility_stadium',{facilities:()=>definitions});
  const project=pendingProjects(club).find(item=>item.facilityId==='facility_stadium');
  return <Screen title="The home we’re building" subtitle={club.name} onBack={()=>navigate(ROUTES.club)} className="cf-campus-screen">
    <div className="cf-campus-stats" aria-label="Your current club">
      <div><strong>{Math.round(club.reputation)}</strong><span>Reputation</span></div>
      <div><strong>{club.stadium.capacity.toLocaleString()}</strong><span>Capacity</span></div>
      <div><strong>Level {level}</strong><span>Your stadium</span></div>
    </div>
    <GlassSegmented aria-label="3D collection" options={[{value:'campus',label:'Campus'},{value:'kit',label:'Kit'},{value:'trophy',label:'Trophy'},{value:'football',label:'Ball'}]} value={scene} onChange={setScene} />
    {started&&scene==='campus'&&<section className="cf-campus-journey" aria-label="Stadium progression">
      <div className="cf-campus-journey-heading"><span>{example?'Progression preview':'Your club today'}</span><strong>{example?`Level ${example.level}`:`Level ${level}`}</strong></div>
      <GlassSegmented size="sm" aria-label="Campus progression" value={preview} onChange={setPreview} options={[{value:'your',label:'Your club'},...Object.entries(CAMPUS_PREVIEWS).map(([value,item])=>({value:value as CampusPreviewId,label:item.name}))]} />
    </section>}
    {started ? <Suspense fallback={<GlassPanel padding="md">Loading 3D renderer…</GlassPanel>}><ModelViewer model={model} lighting={nights?lighting:'daylight'} club={club} levels={scene==='campus'&&example?example.levels:club.facilityLevels} finish={heritage?(silver?'silver':'gold'):'bronze'} /></Suspense> :
      <GlassPanel padding="none" className="overflow-hidden"><ArtImage asset="environment.stadium-day" className="h-56 w-full object-cover"/><div className="space-y-3 p-4"><h2 className="font-display text-2xl font-bold">Walk around your ambition</h2><p className="text-sm text-ink-muted">Explore a 3D scale model in your club colours. Stands and buildings follow your real facility levels. Rotate and zoom at your own pace.</p>{reduced&&<p className="text-sm text-ink-muted">Reduced effects is on. 3D is optional and starts only when you choose.</p>}<GlassButton block variant="primary" onClick={()=>setStarted(true)}>Open interactive 3D</GlassButton></div></GlassPanel>}
    {started&&scene==='campus'&&<div className="cf-campus-caption" aria-live="polite">
      <h2>{example?.title??club.stadium.name}</h2>
      <p>{example?.description??stadium?.levelEffects[level]}</p>
      {example&&<small>Example completed facilities. Your career is unchanged.</small>}
    </div>}
    {scene==='campus'&&<GlassPanel padding="md" className="cf-campus-upgrade">
      <span className="cf-eyebrow">Your stadium journey</span>
      <div className="cf-campus-milestones" role="img" aria-label={`Stadium level ${level} of 5`}>{Array.from({length:6},(_,i)=><span key={i} data-complete={i<=level} data-current={i===level}>{i}</span>)}</div>
      <h2>{project?`Level ${project.targetLevel} is taking shape`:upgrade?`Next chapter: level ${upgrade.level}`:'A home built for legends'}</h2>
      <p>{project?`${project.cyclesRemaining} weeks of construction remaining. The campus changes when the work is complete.`:upgrade?.effect??stadium?.levelEffects[level]}</p>
      {upgrade&&!project&&<div className="cf-campus-upgrade-facts"><span><strong>{formatMoney(upgrade.cost)}</strong>Upgrade cost</span><span><strong>{upgrade.cycles} weeks</strong>Construction</span></div>}
      <GlassButton block variant="primary" className="mt-3" onClick={()=>navigate(ROUTES.facilities)}>Manage facilities</GlassButton>
    </GlassPanel>}
    {started&&<GlassButton block variant="ghost" onClick={()=>setStarted(false)}>Return to illustration</GlassButton>}
    {scene==='trophy'&&<p className="text-sm text-ink-muted">Collection design preview. Your earned honours are recorded in the Trophy room.</p>}
    <GlassPanel padding="md"><h2 className="mb-3 font-display text-lg font-bold">Club atmosphere</h2>
      {nights?<GlassSegmented aria-label="Lighting" options={Object.entries(LIGHTING).map(([value,look])=>({value:value as LightingId,label:look.name}))} value={lighting} onChange={setLighting}/>:<><p className="text-sm text-ink-muted">Daylight is included. Club Nights adds floodlit, sunset and creator-night lighting.</p><GlassButton className="mt-2" block onClick={()=>navigate(owned.includes('cf_club_nights')?ROUTES.contentPacks:ROUTES.store)}>{owned.includes('cf_club_nights')?'Enable Club Nights':'Explore Club Nights'}</GlassButton></>}
    </GlassPanel>
    {(scene==='kit'||scene==='trophy')&&<GlassPanel padding="md"><h2 className="mb-3 font-display text-lg font-bold">Heritage finishes</h2>{heritage ? scene==='kit'?<GlassSegmented aria-label="Shirt pattern" options={(['classic','sash','hoops','pinstripe'] as const).map(value=>({value,label:value}))} value={pattern} onChange={setPattern}/>:<GlassButton block aria-pressed={silver} onClick={()=>setSilver(!silver)}>{silver?'Use antique gold':'Use silver finish'}</GlassButton>:<><p className="text-sm text-ink-muted">Heritage Collection adds three shirt patterns and a silver trophy finish alongside antique gold.</p><GlassButton className="mt-2" block onClick={()=>navigate(owned.includes('cf_heritage_collection')?ROUTES.contentPacks:ROUTES.store)}>Explore Heritage Collection</GlassButton></>}</GlassPanel>}
  </Screen>;
}
