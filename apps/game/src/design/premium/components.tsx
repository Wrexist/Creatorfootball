import { useState, type ReactNode } from 'react';
import type { Club, GameState, Manager } from '@cf/engine';
import { Ledger } from '@cf/engine';
import { ClubBadge } from '../domain/ClubBadge';
import { formatMoney } from '../domain/numbers';
import { GlassButton, type GlassButtonProps } from '../glass/GlassButton';
import { IconChevronRight, IconSocial, IconSettings } from '../icons';
import { assetFor, art, managerAssetFor, type AssetCrop } from '../art/manifest';
import { ManagerPortrait } from '@/features/creation/ManagerPortrait';

export function ArtImage({asset, crop = 'card', className = '', eager = false, alt = '', fallback}: {
  asset: string; crop?: AssetCrop; className?: string; eager?: boolean; alt?: string; fallback?: ReactNode;
}): ReactNode {
  const src = assetFor(asset, crop);
  const [failed, setFailed] = useState<string>();
  if (!src || failed === src) return <span className={`cf-art-fallback ${className}`} role={alt ? 'img' : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true}>{fallback}</span>;
  return <img className={className} src={src} alt={alt} loading={eager ? 'eager' : 'lazy'} decoding="async" onError={() => setFailed(src)} />;
}

export function TopClubBar({state, club, onNavigate}: {state: GameState; club: Club; onNavigate: (path: string) => void}): ReactNode {
  const unread = state.media.stories.filter(story => !story.read).length;
  const balance = Ledger.restore(state.ledger).cashOf(club.id);
  return <header className="cf-club-bar">
    <button className="cf-club-identity" onClick={() => onNavigate('/club')} aria-label={`${club.name}, club overview`}>
      <ClubBadge visual={club.visual} size={37} />
      <span><strong>{club.shortName}</strong><small>S{state.clock.season} · Week {Math.max(1, state.clock.week)}</small></span>
    </button>
    <button className="cf-balance" onClick={() => onNavigate('/club/finances')} aria-label={`Club balance ${formatMoney(balance)}`}><strong>{formatMoney(balance)}</strong><small>Balance</small></button>
    <button className="cf-icon-button" onClick={() => onNavigate('/social/media')} aria-label={`Club inbox, ${unread} unread`}><IconSocial size={21}/>{unread > 0 && <i aria-hidden="true" />}</button>
    <button className="cf-icon-button" onClick={() => onNavigate('/settings')} aria-label="Settings"><IconSettings size={20}/></button>
  </header>;
}

export function CharacterHero({manager, expression = 'neutral', className = ''}: {manager?: Manager | undefined; expression?: string; className?: string}): ReactNode {
  const base = manager ? managerAssetFor(manager.appearance) : art.manager;
  if (!base && manager) return <div className={`cf-character ${className}`}><ManagerPortrait appearance={manager.appearance} size={172} label={manager.name}/></div>;
  const asset = base?.replace(/neutral$/, expression) ?? `manager.${expression}`;
  return <ArtImage asset={assetFor(asset) ? asset : base ?? art.manager} crop="hero" eager className={`cf-character ${className}`} fallback={manager ? <ManagerPortrait appearance={manager.appearance} size={144} label={manager.name}/> : undefined} />;
}

export function ProgressRing({value, label, tone = 'lime'}: {value: number; label: string; tone?: 'lime' | 'gold'}): ReactNode {
  const safe = Math.max(0, Math.min(100, Math.round(value)));
  return <div className={`cf-pulse-item cf-${tone}`}>
    <div className="cf-ring"><svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="27" className="cf-ring-track"/><circle cx="32" cy="32" r="27" pathLength="100" strokeDasharray={`${safe} 100`} className="cf-ring-value"/></svg><strong>{safe}<small>%</small></strong></div>
    <span>{label}</span>
  </div>;
}

export function ObjectAssetCard({asset, title, description, onClick}: {asset: string; title: string; description: string; onClick: () => void}): ReactNode {
  return <button className="cf-object-card" onClick={onClick}>
    <ArtImage asset={asset}/><span><strong>{title}</strong><small>{description}</small></span><IconChevronRight size={16} aria-hidden="true"/>
  </button>;
}

export function StoryCard({title, description, eyebrow, onClick, asset = art.office}: {title: string; description: string; eyebrow: string; onClick: () => void; asset?: string}): ReactNode {
  return <button className="cf-story" onClick={onClick}><ArtImage asset={asset}/><span className="cf-story-copy"><small className="cf-eyebrow">{eyebrow}</small><strong>{title}</strong><span>{description}</span><b>Read more <IconChevronRight size={16}/></b></span></button>;
}

export function PrimaryButton(props: GlassButtonProps): ReactNode {return <GlassButton {...props} variant="primary"/>;}
export function SecondaryButton(props: GlassButtonProps): ReactNode {return <GlassButton {...props} variant="secondary"/>;}
