import { useCallback, useId, useRef, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '../cn';
import { useDesignMotion } from '../motion';
import { haptics } from '../haptics';
import { Portal } from './Portal';
import { useEscapeKey, useFocusTrap, useScrollLock } from './useOverlay';
import { GlassIcon } from './GlassIcon';
import { IconX } from '../icons';

export interface GlassModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  /** Confirmations that must not be dismissed by a stray backdrop tap. */
  dismissible?: boolean;
  size?: 'sm' | 'md' | 'lg';
  children?: ReactNode;
  className?: string;
}

const SIZE: Record<NonNullable<GlassModalProps['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-xl',
};

/**
 * Centred dialog.
 *
 * On phones a bottom sheet is almost always the better control — it is
 * reachable one-handed. `GlassModal` exists for the cases where the content is
 * a *statement* rather than a task (a confirmation, a result, a reveal), where
 * centring carries the right weight.
 */
export function GlassModal({
  open,
  onClose,
  title,
  description,
  footer,
  dismissible = true,
  size = 'sm',
  children,
  className,
}: GlassModalProps): ReactNode {
  const m = useDesignMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();

  useScrollLock(open);
  useFocusTrap(open, panelRef);

  const close = useCallback(() => {
    haptics.impact();
    onClose();
  }, [onClose]);

  useEscapeKey(open && dismissible, close);

  return (
    <Portal>
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-5">
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
                'absolute inset-0 bg-void/72 backdrop-blur-[3px]',
                !dismissible && 'cursor-default',
              )}
            />
            <motion.div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={title ? titleId : undefined}
              aria-describedby={description ? descId : undefined}
              tabIndex={-1}
              variants={m.variants.modal}
              initial="hidden"
              animate="visible"
              exit="exit"
              className={cn(
                'glass-4 glass-sheen relative flex max-h-[84svh] w-full flex-col rounded-2xl',
                SIZE[size],
                className,
              )}
            >
              {dismissible && (
                <div className="absolute right-3 top-3 z-1">
                  <GlassIcon
                    label="Close"
                    icon={<IconX />}
                    variant="ghost"
                    size="sm"
                    onClick={close}
                  />
                </div>
              )}
              {(title !== undefined || description !== undefined) && (
                <header className="px-6 pb-2 pt-6 pr-14">
                  {title !== undefined && (
                    <h2 id={titleId} className="text-title font-bold tracking-[-0.02em] text-ink">
                      {title}
                    </h2>
                  )}
                  {description !== undefined && (
                    <p id={descId} className="mt-1.5 text-body leading-relaxed text-ink-muted text-pretty">
                      {description}
                    </p>
                  )}
                </header>
              )}
              {children !== undefined && (
                <div className="scroll-y min-h-0 flex-1 px-6 py-3">{children}</div>
              )}
              {footer !== undefined && <div className="px-6 pb-6 pt-3">{footer}</div>}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Portal>
  );
}
