import { memo, useEffect, useRef, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn, haptics } from '@/design';
import { SECTION_NAV, sectionFor } from './routes';

/**
 * The rail inside a section.
 *
 * Collapsing seven bottom tabs into five moved several destinations one level
 * down, and they need somewhere to live that is quicker than a menu. This is
 * that place: a single horizontal row directly under the header, always
 * visible, never more than one tap from any sibling screen.
 *
 * It renders nothing for a section with fewer than two destinations — a rail
 * showing one tab is chrome that explains nothing.
 */
export const SectionNav = memo(function SectionNav(): ReactNode {
  const { pathname } = useLocation();
  const section = sectionFor(pathname);
  const railRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLAnchorElement>(null);

  // Keep the current destination on screen. With five items on a small phone
  // the last one sits past the fold, and arriving on a screen whose own tab is
  // invisible is disorienting.
  useEffect(() => {
    const rail = railRef.current;
    const active = activeRef.current;
    if (!rail || !active) return;
    const railBox = rail.getBoundingClientRect();
    const box = active.getBoundingClientRect();
    if (box.left < railBox.left || box.right > railBox.right) {
      active.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'auto' });
    }
  }, [pathname]);

  if (!section) return null;
  const items = SECTION_NAV[section];
  if (items.length < 2) return null;

  return (
    <nav
      aria-label="Section"
      className="relative -mx-4 border-b border-white/[0.06] px-4"
    >
      {/* A fade at the trailing edge, so a rail with more destinations than fit
          looks scrollable instead of looking truncated. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8
                   bg-gradient-to-l from-base to-transparent"
      />
      <div
        ref={railRef}
        className="scroll-x flex items-stretch gap-1 overflow-x-auto"
        style={{ scrollbarWidth: 'none' }}
      >
        {items.map((item) => {
          // Longest-prefix matching, so Overview does not stay lit on every
          // screen whose path happens to begin with the section root.
          const exact = pathname === item.matchPrefix;
          const nested = pathname.startsWith(`${item.matchPrefix}/`);
          const deeper = items.some(
            (other) =>
              other !== item &&
              other.matchPrefix.length > item.matchPrefix.length &&
              (pathname === other.matchPrefix || pathname.startsWith(`${other.matchPrefix}/`)),
          );
          const active = (exact || nested) && !deeper;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              ref={active ? activeRef : undefined}
              onClick={() => haptics.selection()}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex min-h-11 shrink-0 items-center whitespace-nowrap px-3',
                'text-[13px] font-semibold tracking-[-0.005em] transition-colors',
                'duration-[var(--duration-fast)] ease-out-quint outline-none',
                'focus-visible:ring-2 focus-visible:ring-volt focus-visible:ring-offset-2',
                'focus-visible:ring-offset-base',
                active ? 'text-ink' : 'text-ink-dim hover:text-ink-muted',
              )}
            >
              {item.label}
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-2 bottom-0 h-0.5 rounded-pill bg-volt"
                />
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
});
