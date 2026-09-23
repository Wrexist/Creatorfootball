import { useEffect, useRef, useState, type ReactNode } from 'react';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Club } from '@cf/engine';
import { GlassButton } from '@/design';
import { ArtImage } from '@/design/premium/components';
import { useUiStore } from '@/state/uiStore';
import { facilityVisible, LIGHTING, MODEL_ASSETS, type LightingId, type ModelId } from './manifest';

type Command = 'left' | 'right' | 'in' | 'out' | 'reset';
export default function ModelViewer({ model, lighting, club, finish, levels=club.facilityLevels }: { model: ModelId; lighting: LightingId; club: Club; finish: 'bronze'|'gold'|'silver'; levels?: Readonly<Record<string,number>> }): ReactNode {
  const host = useRef<HTMLDivElement>(null);
  const reduced=useUiStore(s=>s.reducedEffects);
  const levelsRef=useRef(levels); levelsRef.current=levels;
  const updateFacilities=useRef<() => void>(()=>{});
  const command = useRef<(value: Command) => void>(() => {});
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let disposed = false, lost = false, frame = 0, visible = true;
    let renderer: T.WebGLRenderer;
    let controls: OrbitControls | null = null;
    let root: T.Group | null = null;
    const scene = new T.Scene();
    const look = LIGHTING[lighting];
    element.style.background=`radial-gradient(ellipse at 50% 32%, ${look.background}, #0b1518 90%)`;
    const camera = new T.PerspectiveCamera(36,1,.05,180);
    setStatus('loading');
    delete element.dataset.model;
    const disposeObject = (object: T.Object3D): void => object.traverse(node => {
      if (node instanceof T.Mesh) { node.geometry.dispose(); for (const mat of Array.isArray(node.material) ? node.material : [node.material]) mat.dispose(); }
    });
    try { renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' }); }
    catch { setStatus('error'); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, reduced?1:1.5));
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled=model==='campus'&&!reduced;
    renderer.shadowMap.type=T.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate=false;
    renderer.shadowMap.needsUpdate=true;
    renderer.domElement.setAttribute('aria-label', `${MODEL_ASSETS[model].label}, interactive 3D view`);
    renderer.domElement.setAttribute('role', 'img');
    element.append(renderer.domElement);
    const render = (): void => {
      if (disposed || lost || frame || !visible || document.hidden) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (disposed) return;
        const start = performance.now();
        renderer.render(scene,camera);
        element.dataset.drawCalls = String(renderer.info.render.calls);
        element.dataset.triangles = String(renderer.info.render.triangles);
        element.dataset.renderMs = (performance.now()-start).toFixed(2);
        element.dataset.frames = String(Number(element.dataset.frames ?? '0')+1);
      });
    };
    scene.add(new T.HemisphereLight(look.fill, '#25342d', 1.7));
    const key = new T.DirectionalLight(look.key,look.intensity); key.position.set(-12,20,7); scene.add(key);
    key.castShadow=model==='campus'&&!reduced;
    key.shadow.mapSize.set(1024,1024);
    Object.assign(key.shadow.camera,{left:-21,right:21,top:20,bottom:-20,near:1,far:70});
    key.shadow.bias=-.0002; key.shadow.normalBias=.04; key.shadow.radius=2;
    const rim = new T.DirectionalLight('#c5dce9',1.3); rim.position.set(8,8,-10); scene.add(rim);
    const fill=new T.DirectionalLight('#e0d9bd',.8); fill.position.set(10,5,15); scene.add(fill);
    const resize = (): void => {
      const width = Math.max(1,element.clientWidth), height = Math.max(1,element.clientHeight);
      renderer.setSize(width,height); camera.aspect=width/height; camera.updateProjectionMatrix(); render();
    };
    const observer = new ResizeObserver(resize); observer.observe(element);
    const intersection = new IntersectionObserver(entries => { visible=!!entries[0]?.isIntersecting; if(visible) render(); }); intersection.observe(element);
    const onVisibility = (): void => { if (!document.hidden) render(); };
    document.addEventListener('visibilitychange', onVisibility);
    const onLost = (event: Event): void => { event.preventDefault(); lost=true; visible=false; cancelAnimationFrame(frame); frame=0; setStatus('error'); };
    renderer.domElement.addEventListener('webglcontextlost',onLost);
    new GLTFLoader().load(MODEL_ASSETS[model].src, gltf => {
      if (disposed || lost) { disposeObject(gltf.scene); return; }
      root=gltf.scene;
      root.traverse(node => {
        node.visible=facilityVisible(node.name,levelsRef.current);
        if (node instanceof T.Mesh) {
          const materials=Array.isArray(node.material)?node.material:[node.material];
          node.castShadow=materials.some(mat=>['edge','roof','foliage','campusStone'].includes(mat.name)); node.receiveShadow=true;
          for (const mat of Array.isArray(node.material) ? node.material : [node.material]) {
          if (!(mat instanceof T.MeshStandardMaterial)) continue;
          if(mat.name==='primary') mat.color.set(club.visual.primary);
          if(mat.name==='secondary') mat.color.set(club.visual.secondary);
          // Metal needs image-based lighting in a full production scene. A modest
          // metalness here keeps authored gold readable with these cheap lights.
          if(mat.name==='gold') {
            mat.metalness=.4;
            if(model==='trophy') mat.color.set(finish==='silver'?'#c5d0d3':finish==='gold'?'#e6b847':'#aa724f');
          }
        }
        }
      });
      scene.add(root);
      const box = new T.Box3().setFromObject(root), centre = box.getCenter(new T.Vector3());
      if(model==='campus') centre.y=.5;
      const size = box.getSize(new T.Vector3()).length();
      const angle = (model.startsWith('kit-') ? new T.Vector3(.3,.12,1) : new T.Vector3(.72,model==='campus'?1.28:.95,1.25)).normalize();
      // Fit the actual site to the viewport instead of using its diagonal as distance.
      const right=new T.Vector3().crossVectors(camera.up,angle).normalize();
      const up=new T.Vector3().crossVectors(angle,right).normalize();
      const tangent=Math.tan(T.MathUtils.degToRad(camera.fov/2));
      const aspect=Math.max(.5,element.clientWidth/Math.max(1,element.clientHeight));
      let distance=0;
      for(const x of [box.min.x,box.max.x]) for(const y of model==='campus'?[0]:[box.min.y,box.max.y]) for(const z of [box.min.z,box.max.z]) {
        const point=new T.Vector3(x,y,z).sub(centre);
        distance=Math.max(distance,Math.abs(point.dot(right))/(tangent*aspect)+point.dot(angle),Math.abs(point.dot(up))/tangent+point.dot(angle));
      }
      distance*=model==='campus'?1.02:1.18;
      camera.position.copy(centre).add(angle.clone().multiplyScalar(distance));
      camera.near=Math.max(.01,size/200); camera.far=size*20; camera.updateProjectionMatrix();
      controls=new OrbitControls(camera,renderer.domElement);
      controls.target.copy(centre); controls.enableDamping=false; controls.enablePan=false;
      controls.minDistance=distance*.55; controls.maxDistance=distance*1.5; controls.minPolarAngle=.3; controls.maxPolarAngle=Math.PI*.46;
      controls.update(); controls.saveState(); controls.addEventListener('change',render);
      command.current = value => {
        if(!controls) return;
        if(value==='reset') controls.reset();
        else {
          const offset=camera.position.clone().sub(controls.target);
          if(value==='left' || value==='right') offset.applyAxisAngle(new T.Vector3(0,1,0),value==='left'?-.28:.28);
          else offset.multiplyScalar(value==='in'?.85:1.15).clampLength(controls.minDistance,controls.maxDistance);
          camera.position.copy(controls.target).add(offset); controls.update();
        }
        render();
      };
      element.dataset.model = model;
      element.dataset.lighting = lighting;
      element.dataset.finish = finish;
      updateFacilities.current=()=>{
        root?.traverse(node=>{node.visible=facilityVisible(node.name,levelsRef.current);});
        element.dataset.stadiumLevel=String(levelsRef.current.facility_stadium??0);
        renderer.shadowMap.needsUpdate=true; render();
      };
      updateFacilities.current();
      setStatus('ready'); resize();
    },undefined,() => { if(!disposed) setStatus('error'); });
    resize();
    return () => {
      disposed=true; cancelAnimationFrame(frame); command.current=()=>{}; updateFacilities.current=()=>{};
      observer.disconnect(); intersection.disconnect(); document.removeEventListener('visibilitychange',onVisibility);
      renderer.domElement.removeEventListener('webglcontextlost',onLost);
      controls?.dispose(); if(root) disposeObject(root); key.shadow.map?.dispose();
      renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    };
  }, [model,lighting,club.visual.primary,club.visual.secondary,finish,reduced]);
  useEffect(()=>{updateFacilities.current();},[levels]);
  return <div className="cf-model-viewer overflow-hidden rounded-3xl border border-white/10 bg-base">
    <div className="cf-model-stage relative" data-testid="model-viewer">
      <div ref={host} className="h-full w-full" style={{touchAction:'none'}} />
      {status==='loading' && <p className="absolute inset-0 grid place-items-center bg-base text-sm" role="status">Opening your club world…</p>}
      {status==='error' && <div className="absolute inset-0"><ArtImage asset={MODEL_ASSETS[model].fallback} className="h-full w-full object-cover" /><p role="status" className="absolute inset-x-0 bottom-0 bg-base/95 p-4 text-sm">3D is unavailable on this device right now. Your club illustration and every management screen remain available.</p></div>}
    </div>
    {status==='ready' && <div className="cf-model-toolbar"><p>Drag to orbit · Pinch to zoom</p><div className="grid grid-cols-5 gap-1">{(['left','right','in','out','reset'] as const).map((value,i)=><GlassButton key={value} size="sm" aria-label={['Rotate left','Rotate right','Zoom in','Zoom out','Reset view'][i]} onClick={()=>command.current(value)}>{['↶','↷','+','−','Reset'][i]}</GlassButton>)}</div></div>}
  </div>;
}
