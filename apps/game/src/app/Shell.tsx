import { Suspense, useEffect, useMemo, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useLocation, useNavigate } from 'react-router-dom';
import { playerClub, unreadStories } from '@cf/engine';
import {
  AppShell, ClubBadge, HeaderSlotProvider, NameText, useDesignMotion, type TabId,
} from '@/design';
import { useGameStore } from '@/state/gameStore';
import { useUiStore } from '@/state/uiStore';
import { PRIMARY_NAV, isImmersive, screenNameFor, sectionFor } from './routes';
import { SectionNav } from './SectionNav';
import { trackScreenView } from './analytics';
import { AppRoutes, ScreenFallback } from './router';
import { preloadMatchday } from './featureModules';

/**
 * The shell: navigation, screen transitions and screen tracking.
 *
 * Screens never decide whether they are inside a tab bar or a side rail, never
 * animate their own entrance, and never report their own name to analytics.
 * All three of those are properties of *navigating*, not of a screen, and
 * every one of them is the kind of thing that drifts the moment it is copied
 * into forty files.
 */

/** The tab that owns this path. Sections claim several prefixes, so ask routes. */
const activeTab = (pathname: string): TabId => (sectionFor(pathname) ?? 'home') as TabId;

function NavHeader(): ReactNode {
  const state = useGameStore((s) => s.state);
  if (!state) return null;
  const club = playerClub(state);
  return (
    <div className="flex items-center gap-2.5 lg:gap-3">
      <ClubBadge visual={club.visual} size={32} label={club.name} />
      <div className="hidden min-w-0 lg:block">
        {/* A club name is identity, so it is fitted rather than cut. This is a
            fixed-width sidebar slot and "Saltp…" is not a shorter name — it is
            an unreadable one. */}
        <NameText
          name={club.shortName}
          {...(club.abbreviation ? { abbr: club.abbreviation } : {})}
          role="bodyStrong"
          lines={1}
          className="text-ink"
        />
        <p className="tnum truncate text-[11px] text-ink-dim">
          Season {state.clock.season} · Week {state.clock.week}
        </p>
      </div>
    </div>
  );
}

export function Shell(): ReactNode {
  const m = useDesignMotion();
  const location = useLocation();
  const navigate = useNavigate();
  const state = useGameStore((s) => s.state);
  const cinematic = useUiStore((s) => s.cinematic);
  const navHidden = useUiStore((s) => s.navHidden);

  const pathname = location.pathname;
  const immersive = isImmersive(pathname) || cinematic !== null || navHidden;

  /* One screen-view event per navigation, named from the frozen route table. */
  useEffect(() => {
    trackScreenView(pathname);
  }, [pathname]);

  /* The next thing a player on the home screen does is play a match, and the
     match chunk is the biggest one. Fetch it while they are reading. */
  useEffect(() => {
    if (pathname === '/home') preloadMatchday();
  }, [pathname]);

  const badges = useMemo(
    () => (state ? { world: unreadStories(state).length } : undefined),
    [state],
  );

  /**
   * Screens cross-fade with a short rise. Deliberately asymmetric — the outgoing
   * screen leaves at `micro` and the incoming arrives at `medium` — because a
   * symmetrical wait makes every navigation feel like it is loading something.
   * Both collapse to nothing under reduced motion via the design tokens.
   */
  const variants = useMemo(
    () => ({
      hidden: { opacity: 0, y: m.reduced ? 0 : 10 },
      visible: { opacity: 1, y: 0, transition: m.transition.medium },
      exit: { opacity: 0, y: m.reduced ? 0 : -6, transition: m.transition.micro },
    }),
    [m],
  );

  return (
    <AppShell
      value={activeTab(pathname)}
      onChange={(tab) => {
        const destination = PRIMARY_NAV.find((nav) => nav.key === tab);
        if (destination) navigate(destination.path);
      }}
      immersive={immersive}
      {...(badges ? { badges } : {})}
      navHeader={<NavHeader />}
    >
      <HeaderSlotProvider accessory={immersive ? null : <SectionNav />}>
        <AnimatePresence mode="wait" initial={false}>
        <motion.main
          key={screenNameFor(pathname)}
          variants={variants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="h-full w-full"
        >
          <Suspense fallback={<ScreenFallback />}>
            <AppRoutes location={location} />
          </Suspense>
        </motion.main>
        </AnimatePresence>
      </HeaderSlotProvider>
    </AppShell>
  );
}
