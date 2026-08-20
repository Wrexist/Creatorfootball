import {
  forwardRef, useRef, useState, type ReactNode, type RefObject,
} from 'react';
import { motion, useMotionValueEvent, useScroll, useTransform } from 'motion/react';
import { cn } from '../cn';
import { useDesignMotion } from '../motion';
import { useBreakpoint } from '../useBreakpoint';
import { GlassIcon } from '../glass/GlassIcon';
import { IconChevronLeft } from '../icons';
import { FitText } from '../typography/FitText';
import { TYPE_CLASS } from '../typography/type';

/**
 * The screen scaffold. Every route in the product is one of these.
 *
 * Structure, top to bottom: a fixed glass header that respects the notch, a
 * scrolling body whose first element is the large title, and an optional sticky
 * footer action that clears the home indicator. The large title scrolls away
 * and hands off to a compact title in the header — the iOS behaviour, and the
 * reason it is worth building rather than shipping a static header: it gives
 * back 52px of vertical space on a phone the moment the player starts reading.
 *
 * The collapse is driven by motion values written straight to `style`, so
 * scrolling a 40-row squad list does not re-render the screen once.
 *
 * On tablet and desktop the same component widens into a centred two-column
 * composition (`aside` becomes a real sidebar) and the header loses its
 * translucency, because at that width there is nothing scrolling underneath it
 * to justify the cost of a blur.
 */

export interface ScreenProps {
  title: ReactNode;
  /** Sits under the large title. One line. */
  subtitle?: ReactNode;
  /** Back button or club badge. */
  leading?: ReactNode;
  onBack?: () => void;
  /** Header controls, right aligned. Use `GlassIcon` — they must be labelled. */
  actions?: ReactNode;
  /** Pinned directly under the header: tabs, a segmented control, a search field. */
  headerAccessory?: ReactNode;
  /** Sticky bottom action area. Never put navigation here. */
  footer?: ReactNode;
  /** Desktop/tablet second column. Ignored on mobile, so never put anything
   *  essential in it. */
  aside?: ReactNode;
  /** Full-bleed content rendered above the large title (a hero, a pitch). */
  hero?: ReactNode;
  /** Adds bottom padding to clear the tab bar. Off inside a sheet or modal. */
  withTabBar?: boolean;
  children?: ReactNode;
  className?: string;
  contentClassName?: string;
}

/** Scroll offset at which the large title has fully handed off. */
const HANDOFF = 44;

export const Screen = forwardRef<HTMLDivElement, ScreenProps>(function Screen(
  {
    title,
    subtitle,
    leading,
    onBack,
    actions,
    headerAccessory,
    footer,
    aside,
    hero,
    withTabBar = true,
    children,
    className,
    contentClassName,
  },
  forwardedRef,
) {
  const m = useDesignMotion();
  const breakpoint = useBreakpoint();
  const wide = breakpoint !== 'mobile';
  const localRef = useRef<HTMLDivElement>(null);
  const scrollRef = (forwardedRef as RefObject<HTMLDivElement> | null) ?? localRef;
  const [scrolled, setScrolled] = useState(false);

  const { scrollY } = useScroll({ container: scrollRef });
  const compactTitleOpacity = useTransform(scrollY, [HANDOFF * 0.55, HANDOFF], [0, 1]);
  const largeTitleOpacity = useTransform(scrollY, [0, HANDOFF], [1, 0]);

  // A boolean for the hairline only — this flips at most twice per scroll, so
  // the re-render cost is negligible and the CSS stays declarative.
  useMotionValueEvent(scrollY, 'change', (latest) => {
    const next = latest > 6;
    setScrolled((current) => (current === next ? current : next));
  });

  return (
    <div className={cn('relative flex h-full flex-col overflow-hidden bg-base', className)}>
      <header
        className={cn(
          'relative z-20 shrink-0 pt-[var(--safe-top)]',
          // Wide layouts sit on a static background: no scrolling content
          // passes beneath the header, so the blur would be pure cost.
          wide ? 'bg-base/95' : 'glass-3',
          scrolled ? 'border-b border-white/[0.07]' : 'border-b border-transparent',
          'transition-colors duration-[var(--duration-fast)] ease-out-quint',
        )}
      >
        <div className="mx-auto flex w-full max-w-[1180px] items-center gap-2 px-4 sm:px-6" style={{ minHeight: 52 }}>
          <div className="flex min-w-11 items-center">
            {onBack ? (
              <GlassIcon label="Back" icon={<IconChevronLeft />} variant="ghost" size="md" onClick={onBack} />
            ) : (
              leading
            )}
          </div>

          <motion.h1
            className="flex min-w-0 flex-1 justify-center text-center"
            // On wide layouts there is no large title to hand off from, so the
            // compact title is simply always present.
            style={wide ? undefined : { opacity: compactTitleOpacity }}
            aria-hidden={wide ? undefined : true}
          >
            {/* A screen title is a name. It shrinks to fit the gap between the
                back button and the header actions; it does not get cut. */}
            {typeof title === 'string' ? (
              <FitText size={17} min={13} className="text-center font-display font-bold tracking-[-0.02em] text-ink">
                {title}
              </FitText>
            ) : (
              <span className="font-display text-section font-bold tracking-[-0.02em] text-ink">{title}</span>
            )}
          </motion.h1>

          <div className="flex min-w-11 items-center justify-end gap-1">{actions}</div>
        </div>

        {headerAccessory !== undefined && (
          <div className="mx-auto w-full max-w-[1180px] px-4 pb-2.5 sm:px-6">{headerAccessory}</div>
        )}
      </header>

      <div
        ref={scrollRef}
        className={cn(
          'scroll-y relative flex-1',
          withTabBar && !wide && 'pb-nav-safe',
          withTabBar && wide && 'pb-8',
        )}
      >
        {hero}

        <div
          className={cn(
            'mx-auto w-full max-w-[1180px] px-4 sm:px-6',
            wide && aside !== undefined && 'grid grid-cols-[minmax(0,1fr)_320px] gap-6 lg:grid-cols-[minmax(0,1fr)_360px]',
          )}
        >
          <div className="min-w-0">
            {!wide && (
              <motion.div style={{ opacity: largeTitleOpacity }} className="pb-3 pt-2">
                <h2 className={cn(TYPE_CLASS.hero, 'text-balance')}>{title}</h2>
                {subtitle !== undefined && (
                  <p className="mt-1 text-body text-ink-muted text-pretty">{subtitle}</p>
                )}
              </motion.div>
            )}
            {wide && subtitle !== undefined && (
              <p className="pb-3 pt-4 text-body text-ink-muted text-pretty">{subtitle}</p>
            )}
            <motion.div
              variants={m.variants.listContainer}
              initial="hidden"
              animate="visible"
              className={cn('flex flex-col gap-4 pb-6', wide && subtitle === undefined && 'pt-4', contentClassName)}
            >
              {children}
            </motion.div>
          </div>

          {wide && aside !== undefined && (
            <aside className="flex flex-col gap-4 pt-4">{aside}</aside>
          )}
        </div>
      </div>

      {footer !== undefined && (
        <div
          className={cn(
            'relative z-20 shrink-0 border-t border-white/[0.07]',
            wide ? 'bg-base/95' : 'chrome-surface',
          )}
          style={{
            // The tab bar is fixed at z-40, so a footer left in normal flow ends
            // up underneath it and the screen's primary action becomes
            // unreachable. Lift it to sit directly on top of the bar. The bar
            // already clears the home indicator, so the footer must not add the
            // safe-area inset a second time.
            marginBottom:
              withTabBar && !wide ? 'calc(var(--nav-height) + var(--safe-bottom))' : undefined,
            paddingBottom: withTabBar || wide ? undefined : 'var(--safe-bottom)',
          }}
        >
          <div className="mx-auto w-full max-w-[1180px] px-4 py-3 sm:px-6">{footer}</div>
        </div>
      )}
    </div>
  );
});

/** Section content that should sit outside the standard gutters. */
export function ScreenBleed({ children, className }: { children: ReactNode; className?: string }): ReactNode {
  return <div className={cn('-mx-4 sm:-mx-6', className)}>{children}</div>;
}
