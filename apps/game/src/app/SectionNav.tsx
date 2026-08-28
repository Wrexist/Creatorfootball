import { memo, useEffect, useId, useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { FitText, GlassSheet, IconChevronRight, cn, haptics, useDesignMotion } from '@/design';
import { SECTION_NAV, sectionFor, splitRail, type SubDestination } from './routes';

/**
 * The rail inside a section.
 *
 * Collapsing seven bottom tabs into five moved several destinations one level
 * down, and they need somewhere to live that is quicker than a menu. This is
 * that place: a single horizontal row directly under the header.
 *
 * What it is *not* any more is the whole list. World reached eight
 * destinations and Club seven, and a sideways-scrolling rail is the worst
 * possible container for a list that long: it shows four, cuts the fifth in
 * half, and gives no clue whether one more is hidden or four. A player who has
 * never seen the screen cannot know what the game contains, which is exactly
 * the complaint — too much to take in, and none of it countable.
 *
 * So the rail now carries the four destinations a manager opens most, and
 * everything else is one tap away in a sheet that shows all of it at once. The
 * rail no longer scrolls at all, which means it no longer hides anything: what
 * you can see is what is on it, and the button says how many more there are.
 */
export const SectionNav = memo(function SectionNav(): ReactNode {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [more, setMore] = useState(false);
  const section = sectionFor(pathname);
  // One id per mounted rail, so the underline animates between this rail's own
  // destinations and never tries to travel to another section's.
  const underlineId = useId();

  // A sheet that survives the navigation it triggered would sit over the
  // screen it just opened.
  useEffect(() => { setMore(false); }, [pathname]);

  if (!section) return null;
  const items = SECTION_NAV[section];
  if (items.length < 2) return null;

  const { rail, overflow } = splitRail(items, pathname);

  return (
    <>
      <nav aria-label="Section" className="relative -mx-4 border-b border-white/[0.06] px-4">
        <div className="flex items-stretch gap-1">
          {rail.map((item) => (
            <RailLink
              key={item.path}
              item={item}
              items={items}
              pathname={pathname}
              underlineId={underlineId}
            />
          ))}

          {overflow.length > 0 && (
            <button
              type="button"
              onClick={() => { haptics.selection(); setMore(true); }}
              aria-haspopup="dialog"
              aria-expanded={more}
              className={cn(
                'relative ml-auto flex min-h-11 shrink-0 items-center gap-1 whitespace-nowrap pl-3',
                'text-[13px] font-semibold tracking-[-0.005em] text-ink-dim transition-colors',
                'duration-[var(--duration-fast)] ease-out-quint outline-none hover:text-ink-muted',
                'focus-visible:ring-2 focus-visible:ring-volt focus-visible:ring-offset-2',
                'focus-visible:ring-offset-base',
              )}
            >
              More
              {/* The count is the point. "More" alone is the same unanswered
                  question as a rail that scrolls off the edge. */}
              <span className="tnum rounded-pill bg-white/[0.08] px-1.5 py-0.5 text-[11px] font-bold text-ink-muted">
                {overflow.length}
              </span>
            </button>
          )}
        </div>
      </nav>

      <GlassSheet
        open={more}
        onClose={() => setMore(false)}
        title="Everything in this section"
        size="auto"
      >
        <ul className="flex flex-col">
          {overflow.map((item, index) => (
            <li key={item.path}>
              <button
                type="button"
                onClick={() => { haptics.selection(); navigate(item.path); }}
                className={cn(
                  'flex min-h-[52px] w-full items-center justify-between gap-3 text-left',
                  'text-[15px] font-semibold text-ink outline-none',
                  'focus-visible:ring-2 focus-visible:ring-volt',
                  index !== overflow.length - 1 && 'border-b border-white/[0.06]',
                )}
              >
                {item.label}
                <IconChevronRight size={18} className="shrink-0 text-ink-dim" />
              </button>
            </li>
          ))}
        </ul>
      </GlassSheet>
    </>
  );
});

/**
 * One rail destination.
 *
 * Longest-prefix matching, so Overview does not stay lit on every screen whose
 * path happens to begin with the section root.
 */
function RailLink({
  item, items, pathname, underlineId,
}: {
  item: SubDestination;
  items: readonly SubDestination[];
  pathname: string;
  underlineId: string;
}): ReactNode {
  const m = useDesignMotion();
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
      to={item.path}
      onClick={() => haptics.selection()}
      aria-current={active ? 'page' : undefined}
      className={cn(
        // `flex-auto`, not `flex-1`: every label gets at least the width its
        // own word needs and they share what is left over. Equal columns look
        // tidier right up until "Community" has to fit in the same 66px as
        // "Social" — at which point the longest label in the section is the one
        // that gets broken, which is the opposite of what should happen.
        'relative flex min-h-11 min-w-0 flex-auto items-center justify-center px-1.5',
        'font-semibold tracking-[-0.005em] transition-colors',
        'duration-[var(--duration-fast)] ease-out-quint outline-none',
        'focus-visible:ring-2 focus-visible:ring-volt focus-visible:ring-offset-2',
        'focus-visible:ring-offset-base',
        active ? 'text-ink' : 'text-ink-dim hover:text-ink-muted',
      )}
    >
      {/* Fitted, not truncated. A destination is a name, and "Comm…" is the
          exact failure `FitText` exists to prevent: the player cannot read it
          and cannot tell it from "Community" or "Commentary". It shrinks a
          rung or two instead, which a nav label survives and an ellipsis
          does not. */}
      <FitText size={13} min={11} className="text-center">{item.label}</FitText>
      {/* The underline travels between destinations rather than cutting. The
          tab bar's glow already does this, and a rail that jumps under a bar
          that slides reads as two different products. */}
      {active && (
        <motion.span
          layoutId={`rail-underline-${underlineId}`}
          aria-hidden="true"
          className="absolute inset-x-1 bottom-0 h-0.5 rounded-pill bg-volt"
          transition={m.spring.snappy}
        />
      )}
    </NavLink>
  );
}
