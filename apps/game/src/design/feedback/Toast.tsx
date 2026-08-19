import {
  createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode,
} from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '../cn';
import { useDesignMotion } from '../motion';
import { haptics } from '../haptics';
import { Portal } from '../glass/Portal';
import { FOCUS_RING } from '../glass/glassLevel';
import { IconCheck, IconInfo, IconWarning, IconX } from '../icons';

export type ToastTone = 'neutral' | 'success' | 'warning' | 'error' | 'volt';

export interface ToastOptions {
  title: ReactNode;
  description?: ReactNode;
  tone?: ToastTone;
  /** ms. 0 keeps it until dismissed — use only for errors that need action. */
  duration?: number;
  action?: { label: string; onPress: () => void };
  icon?: ReactNode;
}

interface ToastRecord extends ToastOptions {
  id: number;
}

interface ToastApi {
  show: (options: ToastOptions) => number;
  dismiss: (id: number) => void;
  success: (title: ReactNode, description?: ReactNode) => number;
  error: (title: ReactNode, description?: ReactNode) => number;
  warning: (title: ReactNode, description?: ReactNode) => number;
}

const ToastContext = createContext<ToastApi | null>(null);

/** Throws rather than no-ops: a missing provider is a wiring bug, not a state. */
export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast must be used inside <ToastProvider>');
  return api;
}

const TONE_STYLE: Record<ToastTone, { bar: string; icon: ReactNode; haptic: () => void }> = {
  neutral: { bar: 'bg-ink-faint', icon: <IconInfo />, haptic: haptics.impact },
  success: { bar: 'bg-positive', icon: <IconCheck />, haptic: haptics.success },
  warning: { bar: 'bg-warning', icon: <IconWarning />, haptic: haptics.warning },
  error: { bar: 'bg-danger', icon: <IconWarning />, haptic: haptics.error },
  volt: { bar: 'bg-volt', icon: <IconInfo />, haptic: haptics.impact },
};

/** At most three at once — a taller stack covers the header it is reporting on. */
const MAX_VISIBLE = 3;

export function ToastProvider({ children }: { children: ReactNode }): ReactNode {
  const [toasts, setToasts] = useState<readonly ToastRecord[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (options: ToastOptions): number => {
      const id = nextId.current;
      nextId.current += 1;
      const record: ToastRecord = { ...options, id };
      TONE_STYLE[options.tone ?? 'neutral'].haptic();
      setToasts((current) => [...current, record].slice(-MAX_VISIBLE));
      const duration = options.duration ?? 4200;
      if (duration > 0) {
        timers.current.set(id, setTimeout(() => dismiss(id), duration));
      }
      return id;
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      show,
      dismiss,
      success: (title, description) => show({ title, tone: 'success', ...(description !== undefined ? { description } : {}) }),
      error: (title, description) => show({ title, tone: 'error', duration: 0, ...(description !== undefined ? { description } : {}) }),
      warning: (title, description) => show({ title, tone: 'warning', ...(description !== undefined ? { description } : {}) }),
    }),
    [show, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: readonly ToastRecord[];
  onDismiss: (id: number) => void;
}): ReactNode {
  const m = useDesignMotion();

  return (
    <Portal>
      {/*
        Toasts enter from the top on this product, not the bottom: the bottom of
        a phone screen is occupied by the tab bar and the primary action, and a
        toast there covers exactly the control the user is about to press.
      */}
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-4 pt-[calc(var(--safe-top)+10px)]"
        role="region"
        aria-label="Notifications"
      >
        <AnimatePresence initial={false}>
          {toasts.map((toast) => {
            const tone = TONE_STYLE[toast.tone ?? 'neutral'];
            return (
              <motion.div
                key={toast.id}
                layout={!m.reduced}
                variants={m.variants.toast}
                initial="hidden"
                animate="visible"
                exit="exit"
                transition={m.spring.snappy}
                // `status` (polite) rather than `alert`: a toast should not
                // interrupt whatever the screen reader is mid-sentence on.
                role={toast.tone === 'error' ? 'alert' : 'status'}
                className="glass-3 glass-sheen pointer-events-auto relative flex w-full max-w-md items-start gap-3 overflow-hidden rounded-lg py-3 pl-3.5 pr-2"
              >
                <span className={cn('absolute inset-y-0 left-0 w-0.5', tone.bar)} aria-hidden="true" />
                <span className="mt-px shrink-0 text-ink-muted [&_svg]:size-[18px]" aria-hidden="true">
                  {toast.icon ?? tone.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-semibold leading-snug text-ink">{toast.title}</span>
                  {toast.description !== undefined && (
                    <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-muted text-pretty">
                      {toast.description}
                    </span>
                  )}
                  {toast.action && (
                    <button
                      type="button"
                      onClick={() => {
                        toast.action?.onPress();
                        onDismiss(toast.id);
                      }}
                      className={cn('mt-1.5 min-h-11 text-[13px] font-semibold text-volt', FOCUS_RING)}
                    >
                      {toast.action.label}
                    </button>
                  )}
                </span>
                <button
                  type="button"
                  aria-label="Dismiss notification"
                  onClick={() => onDismiss(toast.id)}
                  className={cn(
                    'flex size-11 shrink-0 items-center justify-center rounded-md text-ink-dim hover:text-ink',
                    FOCUS_RING,
                  )}
                >
                  <IconX size={16} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </Portal>
  );
}
