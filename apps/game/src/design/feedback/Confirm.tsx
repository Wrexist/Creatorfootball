import {
  createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode,
} from 'react';
import { GlassModal } from '../glass/GlassModal';
import { GlassButton } from '../glass/GlassButton';

export interface ConfirmOptions {
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive actions get the danger button and no backdrop dismissal. */
  destructive?: boolean;
  /** Extra content between the description and the buttons (a cost summary). */
  body?: ReactNode;
}

export interface ConfirmProps extends ConfirmOptions {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

/**
 * Confirmation dialog.
 *
 * Cancel sits on the left and is a ghost button; confirm is on the right and
 * carries the weight. For destructive actions the confirm button is `danger`
 * and backdrop dismissal is disabled — selling a cult hero should require an
 * actual decision, not a mis-tap outside the card.
 */
export function Confirm({
  open,
  title,
  description,
  body,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmProps): ReactNode {
  return (
    <GlassModal
      open={open}
      onClose={onCancel}
      title={title}
      {...(description !== undefined ? { description } : {})}
      dismissible={!destructive && !loading}
      size="sm"
      footer={
        <div className="flex gap-2.5">
          <GlassButton variant="ghost" size="md" block onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </GlassButton>
          <GlassButton
            variant={destructive ? 'danger' : 'primary'}
            size="md"
            block
            loading={loading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </GlassButton>
        </div>
      }
    >
      {body}
    </GlassModal>
  );
}

/* --- imperative form -------------------------------------------------- */

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
  const fn = useContext(ConfirmContext);
  if (!fn) throw new Error('useConfirm must be used inside <ConfirmProvider>');
  return fn;
}

/**
 * `const ok = await confirm({ ... })` reads far better at the call site than
 * threading two pieces of state and a callback through a screen component, and
 * confirmations almost always sit inside an async handler already.
 */
export function ConfirmProvider({ children }: { children: ReactNode }): ReactNode {
  const [state, setState] = useState<(ConfirmOptions & { open: boolean }) | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const settle = useCallback((value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    // Keep the options mounted through the exit animation, drop `open` only.
    setState((current) => (current ? { ...current, open: false } : null));
  }, []);

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setState({ ...options, open: true });
    });
  }, []);

  const value = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {state && (
        <Confirm
          {...state}
          onConfirm={() => settle(true)}
          onCancel={() => settle(false)}
        />
      )}
    </ConfirmContext.Provider>
  );
}
