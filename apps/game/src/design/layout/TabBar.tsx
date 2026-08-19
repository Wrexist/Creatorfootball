import { useId, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { cn } from '../cn';
import { useDesignMotion } from '../motion';
import { haptics } from '../haptics';
import { FOCUS_RING } from '../glass/glassLevel';
import {
  IconClub, IconHome, IconLeague, IconMarket, IconMatchday, IconSocial, IconSquad,
  type IconComponent,
} from '../icons';

/**
 * The seven destinations. Seven is the ceiling: an eighth would drop each
 * target below the width a thumb can hit reliably on a 375pt phone, and the
 * product does not have an eighth thing worth permanent navigation.
 */
export const TAB_DESTINATIONS = [
  { id: 'home', label: 'Home', icon: IconHome },
  { id: 'club', label: 'Club', icon: IconClub },
  { id: 'squad', label: 'Squad', icon: IconSquad },
  { id: 'matchday', label: 'Match', icon: IconMatchday },
  { id: 'market', label: 'Market', icon: IconMarket },
  { id: 'league', label: 'League', icon: IconLeague },
  { id: 'social', label: 'Social', icon: IconSocial },
] as const satisfies readonly { id: string; label: string; icon: IconComponent }[];

export type TabId = (typeof TAB_DESTINATIONS)[number]['id'];

export interface TabBarProps {
  value: TabId;
  onChange: (id: TabId) => void;
  /** Unread/attention counts keyed by destination. */
  badges?: Partial<Record<TabId, number>>;
  /** Hidden during a live match; the match owns the whole screen. */
  hidden?: boolean;
  className?: string;
}

/**
 * Bottom navigation.
 *
 * The active indicator is a volt dot above the icon rather than a filled pill:
 * at this size a pill behind a 22px glyph turns the whole bar into a row of
 * buttons, and the bar should read as chrome, not as seven controls.
 */
export function TabBar({ value, onChange, badges, hidden = false, className }: TabBarProps): ReactNode {
  const m = useDesignMotion();
  const layoutId = useId();

  return (
    <nav
      aria-label="Primary"
      className={cn(
        'glass-3 fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.07]',
        'transition-transform duration-[var(--duration-fast)] ease-out-quint',
        hidden && 'translate-y-full',
        className,
      )}
      style={{ paddingBottom: 'var(--safe-bottom)' }}
    >
      <ul className="mx-auto flex w-full max-w-lg items-stretch" style={{ height: 'var(--nav-height)' }}>
        {TAB_DESTINATIONS.map((tab) => {
          const active = tab.id === value;
          const badge = badges?.[tab.id] ?? 0;
          const Icon = tab.icon;
          return (
            <li key={tab.id} className="flex flex-1">
              <button
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => {
                  if (active) return;
                  haptics.selection();
                  onChange(tab.id);
                }}
                className={cn(
                  'relative flex min-h-11 w-full flex-col items-center justify-center gap-1 pt-1.5',
                  'transition-colors duration-[var(--duration-fast)] ease-out-quint',
                  active ? 'text-ink' : 'text-ink-dim hover:text-ink-muted',
                  FOCUS_RING,
                )}
              >
                <span className="relative">
                  <Icon size={23} strokeWidth={active ? 1.9 : 1.5} />
                  {badge > 0 && (
                    <span
                      className="absolute -right-2 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-pill bg-volt px-1 text-[9px] font-bold leading-none text-volt-ink"
                      aria-label={`${badge} new`}
                    >
                      {badge > 9 ? '9+' : badge}
                    </span>
                  )}
                </span>
                <span className="text-[10px] font-semibold tracking-[0.01em]">{tab.label}</span>
                {active && (
                  <motion.span
                    layoutId={`tabbar-${layoutId}`}
                    className="absolute top-0 h-0.5 w-6 rounded-pill bg-volt"
                    transition={m.spring.snappy}
                  />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/* --- wide-layout equivalent ------------------------------------------- */

export interface SideNavProps {
  value: TabId;
  onChange: (id: TabId) => void;
  badges?: Partial<Record<TabId, number>>;
  /** Club identity block pinned to the top of the rail. */
  header?: ReactNode;
  footer?: ReactNode;
  className?: string;
}

/**
 * Tablet and desktop navigation.
 *
 * Same destinations, same order, same volt active marker — deliberately the
 * same product rather than a "desktop version". The rail is 88px on tablet
 * (icons plus micro-labels) and 240px on desktop (full labels), which is the
 * only thing that changes between the two.
 */
export function SideNav({ value, onChange, badges, header, footer, className }: SideNavProps): ReactNode {
  const m = useDesignMotion();
  const layoutId = useId();

  return (
    <nav
      aria-label="Primary"
      className={cn(
        'flex h-full shrink-0 flex-col border-r border-white/[0.07] bg-surface-1/60',
        'w-[88px] lg:w-[240px]',
        className,
      )}
      style={{ paddingTop: 'var(--safe-top)', paddingBottom: 'var(--safe-bottom)' }}
    >
      {header !== undefined && <div className="px-3 py-4 lg:px-4">{header}</div>}
      <ul className="flex flex-1 flex-col gap-1 px-2 lg:px-3">
        {TAB_DESTINATIONS.map((tab) => {
          const active = tab.id === value;
          const badge = badges?.[tab.id] ?? 0;
          const Icon = tab.icon;
          return (
            <li key={tab.id}>
              <button
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => {
                  if (active) return;
                  haptics.selection();
                  onChange(tab.id);
                }}
                className={cn(
                  'relative flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2.5',
                  'flex-col lg:flex-row',
                  'transition-colors duration-[var(--duration-fast)] ease-out-quint',
                  active ? 'text-ink' : 'text-ink-dim hover:bg-white/[0.05] hover:text-ink-muted',
                  FOCUS_RING,
                )}
              >
                {active && (
                  <motion.span
                    layoutId={`sidenav-${layoutId}`}
                    className="absolute inset-0 -z-1 rounded-lg bg-white/[0.08]"
                    transition={m.spring.snappy}
                  />
                )}
                <span className="relative">
                  <Icon size={22} strokeWidth={active ? 1.9 : 1.5} />
                  {badge > 0 && (
                    <span className="absolute -right-2 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-pill bg-volt px-1 text-[9px] font-bold leading-none text-volt-ink">
                      {badge > 9 ? '9+' : badge}
                    </span>
                  )}
                </span>
                <span className="text-[10px] font-semibold lg:text-[14px]">{tab.label}</span>
                {active && (
                  <span className="absolute inset-y-2 left-0 hidden w-0.5 rounded-pill bg-volt lg:block" aria-hidden="true" />
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {footer !== undefined && <div className="px-3 py-3 lg:px-4">{footer}</div>}
    </nav>
  );
}

/* --- shell ------------------------------------------------------------- */

export interface AppShellProps {
  value: TabId;
  onChange: (id: TabId) => void;
  badges?: Partial<Record<TabId, number>>;
  navHeader?: ReactNode;
  navFooter?: ReactNode;
  /** Hides navigation entirely — used by the live match and onboarding. */
  immersive?: boolean;
  children: ReactNode;
}

/**
 * Chooses the navigation for the viewport and gives the screen the rest.
 * Screens never decide this themselves; they just render a `Screen`.
 */
export function AppShell({
  value, onChange, badges, navHeader, navFooter, immersive = false, children,
}: AppShellProps): ReactNode {
  return (
    <div className="flex h-full w-full overflow-hidden bg-base">
      {!immersive && (
        <div className="hidden md:flex">
          <SideNav
            value={value}
            onChange={onChange}
            {...(badges ? { badges } : {})}
            {...(navHeader !== undefined ? { header: navHeader } : {})}
            {...(navFooter !== undefined ? { footer: navFooter } : {})}
          />
        </div>
      )}
      <div className="relative min-w-0 flex-1">{children}</div>
      {!immersive && (
        <div className="md:hidden">
          <TabBar value={value} onChange={onChange} {...(badges ? { badges } : {})} />
        </div>
      )}
    </div>
  );
}
