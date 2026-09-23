import type { ReactNode } from 'react';
import type { Club } from '@cf/engine';
import { ArtImage } from './components';
import { ClubBadge } from '../domain/ClubBadge';
import { facilityArt } from '../art/manifest';

/** Campus destinations read owned levels; no pretend construction or rewards. */
export function ClubCampus({club,onNavigate}: {club:Club;onNavigate:(path:string)=>void}): ReactNode {
  const rooms = [
    {name:'Stadium',key:'facility_stadium',path:'/club/facilities',position:'stadium'},
    {name:'Academy',key:'facility_academy',path:'/club/facilities',position:'academy'},
    {name:'Fan zone',key:'facility_fan_zone',path:'/club/fans',position:'fans'},
  ];
  return <section className="cf-campus" aria-label="Your club campus">
    <div className="cf-campus-world">
      <ArtImage asset={facilityArt('facility_stadium',club.facilityLevels.facility_stadium ?? 0)} crop="hero" eager />
      <div className="cf-campus-identity"><ClubBadge visual={club.visual} size={48}/><div><span className="cf-eyebrow">Your club. Your story.</span><h2>{club.name}</h2></div></div>
      {rooms.map(room=>{
        const level = club.facilityLevels[room.key] ?? 0;
        return <button key={room.key} className={`cf-campus-pin cf-campus-${room.position}`} onClick={()=>onNavigate(room.path)}>
          <span className="cf-campus-buildings" aria-hidden="true">{Array.from({length:Math.min(5,Math.max(1,level))},(_,i)=><i key={i} style={{height:8+i*3}}/>)}</span>
          <strong>{room.name}</strong><small>{level ? `Level ${level}` : 'Not built'}</small>
        </button>;
      })}
    </div>
    <p className="cf-campus-motto">“{club.motto}”</p>
    <nav className="cf-campus-links" aria-label="Club departments">
      <button onClick={()=>onNavigate('/club/3d')}>Explore in 3D <span aria-hidden="true">↗</span></button>
      {[['Sponsors','/club/sponsors'],['Finances','/club/finances'],['History','/club/history']].map(([label,path])=><button key={path} onClick={()=>onNavigate(path!)}>{label}<span aria-hidden="true">↗</span></button>)}
    </nav>
  </section>;
}
