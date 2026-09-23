import { createContext, useContext, type ReactNode } from 'react';
import { ArtImage } from './components';

export interface WorldScene { asset: string; eyebrow: string; compact?: boolean }
const SceneContext = createContext<WorldScene | null>(null);
export const WorldSceneProvider = SceneContext.Provider;
export const useWorldScene = (): WorldScene | null => useContext(SceneContext);

/** Route owners opt in together, so subroutes and their states share a world. */
export function sceneForPath(path: string): WorldScene | null {
  if (path.startsWith('/create/manager')) return {asset:'environment.office',eyebrow:'Your story starts here',compact:true};
  if (path.startsWith('/create/club')) return {asset:'environment.stadium-day',eyebrow:'Build somewhere to belong',compact:true};
  if (path.startsWith('/create/squad')) return {asset:'environment.dressing-room',eyebrow:'Your first team',compact:true};
  if (path.startsWith('/squad/tactics')) return {asset:'environment.tactics-room',eyebrow:'The tactics room',compact:true};
  if (path.startsWith('/squad/training')) return {asset:'environment.training-ground',eyebrow:'Develop your future'};
  if (path.startsWith('/squad/player/')) return {asset:'environment.dressing-room',eyebrow:'Player dossier',compact:true};
  if (path.startsWith('/squad')) return {asset:'environment.dressing-room',eyebrow:'Inside the dressing room',compact:true};
  if (path.startsWith('/market/negotiation')) return {asset:'environment.transfer-stage',eyebrow:'The next chapter',compact:true};
  if (path.startsWith('/market')) return {asset:'environment.scouting-office',eyebrow:'Find your next difference-maker',compact:path !== '/market'};
  if (path.startsWith('/club/finances')) return {asset:'environment.boardroom',eyebrow:'Build a sustainable club'};
  if (path.startsWith('/club/sponsors')) return {asset:'environment.transfer-stage',eyebrow:'Partnerships with purpose'};
  if (path.startsWith('/matchday/preview')) return {asset:'environment.tunnel',eyebrow:'The stage is yours',compact:true};
  if (path.startsWith('/matchday')) return {asset:'environment.stadium-night',eyebrow:'Under the lights'};
  if (path.startsWith('/club/facilities')) return {asset:'environment.stadium-day',eyebrow:'Room to grow',compact:true};
  if (path.startsWith('/club/fans')) return {asset:'environment.fan-zone',eyebrow:'More than a club'};
  if (path.startsWith('/club/history') || path.startsWith('/club/trophies')) return {asset:'environment.trophy-room',eyebrow:'Build a legacy'};
  if (path.startsWith('/objectives') || path.startsWith('/rewards')) return {asset:'environment.trophy-room',eyebrow:'Your season journey',compact:true};
  if (path.startsWith('/store')) return {asset:'environment.fan-zone',eyebrow:'The club shop',compact:true};
  if (path.startsWith('/social/community')) return {asset:'environment.fan-zone',eyebrow:'The people behind the badge',compact:true};
  if (path.startsWith('/social/press')) return {asset:'environment.media-studio',eyebrow:'Your words carry weight',compact:true};
  if (path.startsWith('/social')) return {asset:'environment.media-studio',eyebrow:'Make the world listen',compact:path !== '/social'};
  if (path.startsWith('/league/season')) return {asset:'environment.trophy-room',eyebrow:'Every week writes the story',compact:true};
  if (path.startsWith('/league')) return {asset:'environment.stadium-night',eyebrow:'The creator football world',compact:path !== '/league'};
  if (path.startsWith('/settings')) return {asset:'environment.office',eyebrow:'Make yourself at home',compact:true};
  return null;
}

export function PageHero({scene,title,subtitle}: {scene:WorldScene; title:ReactNode; subtitle?:ReactNode}): ReactNode {
  return <div className={`cf-page-hero ${scene.compact ? 'cf-page-hero-compact' : ''}`}>
    <ArtImage asset={scene.asset} crop="hero" eager/>
    <div><span className="cf-eyebrow">{scene.eyebrow}</span><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
  </div>;
}
