import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { cn } from '../cn';
import { useDesignMotion } from '../motion';
import { GlassButton } from '../glass/GlassButton';
import { IconInfo, IconWarning } from '../icons';

export interface EmptyStateProps {
  title: ReactNode;
  /** One or two sentences. Say what to do next, not just what is missing. */
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Empty states are a design surface, not an error.
 *
 * Every one in this product answers "what do I do now?" — an empty shortlist
 * offers to open the market, an empty trophy cabinet says which competition is
 * next. The `action` slot is therefore encouraged rather than optional-by-habit.
 */
export function EmptyState({
  title,
  description,
  icon,
  action,
  size = 'md',
  className,
}: EmptyStateProps): ReactNode {
  const m = useDesignMotion();
  return (
    <motion.div
      variants={m.variants.fade}
      initial="hidden"
      animate="visible"
      className={cn(
        'flex flex-col items-center justify-center text-center',
        size === 'sm' ? 'gap-2 px-5 py-8' : 'gap-3 px-6 py-14',
        className,
      )}
    >
      <span
        className={cn(
          'flex items-center justify-center rounded-pill bg-white/[0.05] text-ink-dim',
          size === 'sm' ? 'size-11 [&_svg]:size-5' : 'size-16 [&_svg]:size-7',
        )}
        aria-hidden="true"
      >
        {icon ?? <IconInfo />}
      </span>
      <h3 className={cn('font-semibold text-ink', size === 'sm' ? 'text-body' : 'text-section')}>
        {title}
      </h3>
      {description !== undefined && (
        <p className="max-w-[36ch] text-caption leading-relaxed text-ink-muted text-pretty">
          {description}
        </p>
      )}
      {action !== undefined && <div className="mt-2">{action}</div>}
    </motion.div>
  );
}

export interface ErrorStateProps {
  title?: ReactNode;
  description?: ReactNode;
  /** The raw failure. Shown in a monospace block — never a stack trace to users. */
  detail?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

/**
 * `role="alert"` so a failure that appears after an action is announced without
 * the user having to go looking for it.
 */
export function ErrorState({
  title = 'Something went wrong',
  description = 'The action could not be completed. Your save is safe.',
  detail,
  onRetry,
  retryLabel = 'Try again',
  className,
}: ErrorStateProps): ReactNode {
  return (
    <div
      role="alert"
      className={cn('flex flex-col items-center justify-center gap-3 px-6 py-12 text-center', className)}
    >
      <span
        className="flex size-16 items-center justify-center rounded-pill bg-danger/12 text-danger [&_svg]:size-7"
        aria-hidden="true"
      >
        <IconWarning />
      </span>
      <h3 className="text-section font-semibold text-ink">{title}</h3>
      <p className="max-w-[38ch] text-caption leading-relaxed text-ink-muted text-pretty">{description}</p>
      {detail !== undefined && (
        <code className="max-w-full overflow-x-auto rounded-sm bg-white/[0.05] px-2.5 py-1.5 font-mono text-micro text-ink-dim">
          {detail}
        </code>
      )}
      {onRetry && (
        <GlassButton variant="secondary" size="md" onClick={onRetry} className="mt-2">
          {retryLabel}
        </GlassButton>
      )}
    </div>
  );
}
