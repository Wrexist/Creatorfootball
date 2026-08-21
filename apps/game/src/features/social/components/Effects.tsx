import { memo, type ReactNode } from 'react';
import type { EffectLine } from '@cf/engine';
import { GlassPill, Text, cn } from '@/design';

/**
 * The price, before you pay it.
 *
 * Every interactive surface in this feature shows the same component, fed by
 * the same structure the engine will actually apply. A screen that computed its
 * own preview would drift from the apply path within a fortnight, and the
 * player would learn — correctly — not to trust the numbers.
 */

export interface EffectLinesProps {
  lines: readonly EffectLine[];
  /** Rendered when a choice genuinely changes nothing. */
  emptyLabel?: string;
  className?: string;
}

const format = (delta: number): string =>
  `${delta > 0 ? '+' : ''}${Math.abs(delta) >= 10 ? Math.round(delta) : delta.toFixed(1)}`;

export const EffectLines = memo(function EffectLines({
  lines, emptyLabel = 'Nothing measurable moves.', className,
}: EffectLinesProps): ReactNode {
  if (lines.length === 0) {
    return (
      <Text role="caption" as="p" className={cn('text-ink-dim text-pretty', className)}>
        {emptyLabel}
      </Text>
    );
  }
  return (
    <ul className={cn('flex flex-wrap gap-1.5', className)}>
      {lines.map((line) => (
        <li key={line.key}>
          <GlassPill size="xs" tone={line.good ? 'positive' : 'danger'}>
            {`${line.label} ${format(line.delta)}`}
          </GlassPill>
        </li>
      ))}
    </ul>
  );
});
