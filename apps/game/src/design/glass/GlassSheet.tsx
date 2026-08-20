import { useCallback, useId, useRef, type ReactNode } from 'react';
import { AnimatePresence, motion, useDragControls } from 'motion/react';
import type { PanInfo } from 'motion/react';
import { cn } from '../cn';
import { useDesignMotion } from '../motion';
import { haptics } from '../haptics';
import { Portal } from './Portal';
import { useEscapeKey, useFocusTrap, useScrollLock } from './useOverlay';
import { FOCUS_RING } from './glassLevel';

export type SheetSize = 'auto' | 'half' | 'tall' | 'full';

export interface GlassSheetProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  /** Rendered small under the title. Keep to one line. */
  subtitle?: ReactNode;
  /** Sticky action area pinned above the home indicator. */
  footer?: ReactNode;
  size?: SheetSize;
  /** Hides the grabber and disables drag — for sheets that must be dismissed
   *  by an explicit choice (destructive confirmations). */
  dismissible?: boolean;
  children?: ReactNode;
  className?: string;
}

const SIZE_CLASS: Record<SheetSize, string> = {
  auto: 'max-h-[86svh]',
  half: 'h-[52svh]',
  tall: 'h-[86svh]',
  full: 'h-[96svh]',
};

/** Past this many px, or this many px/s, the release becomes a dismissal. */
const DISMISS_DISTANCE = 110;
const DISMISS_VELOCITY = 750;

/**
 * The iOS-native bottom sheet.
 *
 * Two details do most of the work. First, drag is started from the grabber and
 * header only (`dragListener={false}` + `dragControls`), so a flick inside a
 * scrolling body scrolls the body instead of fighting the sheet — the single
 * most common way a web sheet gives itself away. Second, the downward elastic
 * is 0.9 while the upward elastic is 0.02: the sheet follows the finger almost
 * exactly on the way out and refuses to be pulled past its top edge.
 *
 * Performance: the backdrop's blur is static and only its opacity animates.
 * Animating `backdrop-filter` recomposites the entire surface behind the sheet
 * every frame, which on a mid-range phone costs more than the whole rest of the
 * screen combined.
 */
export function GlassSheet({
  open,
  onClose,
  title,
  subtitle,
  footer,
  size = 'auto',
  dismissible = true,
  children,
  className,
}: GlassSheetProps): ReactNode {
  const m = useDesignMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();
  const titleId = useId();

  useScrollLock(open);
  useFocusTrap(open, panelRef);

  const close = useCallback(() => {
    haptics.impact();
    onClose();
  }, [onClose]);

  useEscapeKey(open && dismissible, close);

  const onDragEnd = (_event: unknown, info: PanInfo): void => {
    if (info.offset.y > DISMISS_DISTANCE || info.velocity.y > DISMISS_VELOCITY) close();
  };

  return (
    <Portal>
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 flex items-end justify-center">
            <motion.button
              type="button"
              aria-label="Close"
              tabIndex={-1}
              variants={m.variants.backdrop}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={dismissible ? close : undefined}
              className={cn(
                'absolute inset-0 bg-void/70 backdrop-blur-[3px]',
                !dismissible && 'cursor-default',
              )}
            />

            <motion.div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={title ? titleId : undefined}
              tabIndex={-1}
              variants={m.variants.sheet}
              initial="hidden"
              animate="visible"
              exit="exit"
              drag={dismissible && !m.reduced ? 'y' : false}
              dragControls={dragControls}
              dragListener={false}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0.02, bottom: 0.9 }}
              onDragEnd={onDragEnd}
              className={cn(
                'glass-4 glass-sheen relative flex w-full max-w-[min(100%,40rem)] flex-col',
                'rounded-t-2xl',
                // Desktop: the sheet becomes a centred, fully rounded card —
                // a full-width drawer on a 27" display looks like a bug.
                'sm:mb-6 sm:rounded-2xl',
                SIZE_CLASS[size],
                className,
              )}
              style={{ paddingBottom: 'var(--safe-bottom)' }}
            >
              {/* Grab area. Generous 28px strip so a thumb does not have to be
                  precise; the visible grabber is only 5px tall. */}
              <div
                onPointerDown={(event) => {
                  if (dismissible && !m.reduced) dragControls.start(event);
                }}
                className={cn(
                  'shrink-0 touch-none px-5 pt-2.5',
                  dismissible ? 'cursor-grab active:cursor-grabbing' : '',
                )}
              >
                {dismissible && (
                  <div className="mx-auto h-1.5 w-10 rounded-pill bg-white/20" aria-hidden="true" />
                )}
                {(title !== undefined || subtitle !== undefined) && (
                  <header className="pb-3 pt-3">
                    {title !== undefined && (
                      <h2 id={titleId} className="text-title font-bold tracking-[-0.02em] text-ink">
                        {title}
                      </h2>
                    )}
                    {subtitle !== undefined && (
                      <p className="mt-0.5 text-caption text-ink-muted">{subtitle}</p>
                    )}
                  </header>
                )}
              </div>

              <div className="scroll-y min-h-0 flex-1 px-5 pb-5">{children}</div>

              {footer !== undefined && (
                <div className="shrink-0 border-t border-white/[0.07] px-5 py-3.5">{footer}</div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Portal>
  );
}

/** Convenience close affordance for sheets with no explicit footer action. */
export function SheetCloseRow({ onClose, label = 'Close' }: { onClose: () => void; label?: string }): ReactNode {
  return (
    <button
      type="button"
      onClick={onClose}
      className={cn(
        'min-h-11 w-full rounded-lg text-body font-semibold text-ink-muted hover:text-ink',
        FOCUS_RING,
      )}
    >
      {label}
    </button>
  );
}
