import { memo, type ReactNode } from 'react';
import { cn } from '../cn';
import { rgba } from '../color';
import { TYPE_CLASS } from '../typography/type';
import { NameText } from '../typography/Text';

export interface ScorePanelSide {
  readonly name: string;
  readonly shortName?: string;
  readonly abbreviation?: string;
  /** Club primary; drives the colour bar and the ambient bleed on that half. */
  readonly color?: string;
  readonly score?: number | null;
  /** Badge, kit swatch, anything 22-34px. */
  readonly emblem?: ReactNode;
}

export interface ScorePanelProps {
  home: ScorePanelSide;
  away: ScorePanelSide;
  /** The minute, "HT", "FT", or a kickoff time. */
  status?: ReactNode;
  live?: boolean;
  /** Competition, round, venue. Sentence case. */
  context?: ReactNode;
  size?: 'md' | 'lg';
  className?: string;
}

/**
 * The broadcast score panel.
 *
 * This is the one object in the kit modelled on television rather than on iOS.
 * It is a bar, not a card: square-cut on three corners with a single chamfer at
 * the bottom-left, a solid colour post for each club, and the scoreline set in
 * tightly-tracked tabular figures so the two numbers read as one unit. No
 * radius to speak of, no sheen, no hairline border - it deliberately looks
 * nothing like the cards it sits between, because a score is not a card.
 *
 * Club names go through `NameText`, so "Saltpine Harriers" becomes "Saltpine"
 * and then "SPH" as the slot narrows. It never becomes "Saltp...".
 */
export const ScorePanel = memo(function ScorePanel({
  home, away, status, live = false, context, size = 'md', className,
}: ScorePanelProps): ReactNode {
  const played = typeof home.score === 'number' && typeof away.score === 'number';
  const big = size === 'lg';

  return (
    <div
      className={cn(
        'relative isolate w-full overflow-hidden bg-void/70',
        // The chamfer. One cut corner is the whole silhouette.
        '[clip-path:polygon(0_0,100%_0,100%_100%,14px_100%,0_calc(100%-14px))]',
        'rounded-sm',
        className,
      )}
      role="group"
      aria-label={`${home.name} ${home.score ?? ''} versus ${away.name} ${away.score ?? ''}`}
    >
      {/* Both clubs' light meets in the middle. Flat gradients, no blur: this
          panel is often on screen during a live simulation. */}
      <span
        aria-hidden="true"
        className="absolute inset-0 -z-1"
        style={{
          background: [
            home.color ? `linear-gradient(96deg, ${rgba(home.color, 0.5)} 0%, transparent 42%)` : '',
            away.color ? `linear-gradient(264deg, ${rgba(away.color, 0.5)} 0%, transparent 42%)` : '',
            'linear-gradient(180deg, rgb(255 255 255 / 0.06) 0%, transparent 40%)',
          ].filter(Boolean).join(', '),
        }}
      />

      {context !== undefined && (
        <div className={cn(TYPE_CLASS.label, 'flex items-center gap-2 px-3.5 pt-2.5 text-ink-dim')}>
          {context}
        </div>
      )}

      <div className={cn('flex items-stretch gap-2 px-3.5', big ? 'py-4' : 'py-3')}>
        <Half side={home} align="left" big={big} />

        <div className="flex shrink-0 flex-col items-center justify-center px-1">
          <div className={cn(big ? TYPE_CLASS.score : TYPE_CLASS.score, big ? '' : 'text-[30px]', 'flex items-baseline gap-2')} aria-hidden="true">
            <span>{played ? home.score : '-'}</span>
            <span className="text-ink-faint">:</span>
            <span>{played ? away.score : '-'}</span>
          </div>
          {(status !== undefined || live) && (
            <div className="mt-1.5 flex items-center gap-1.5">
              {live && (
                <span className="relative flex size-1.5" aria-hidden="true">
                  <span className="absolute inline-flex size-full animate-ping rounded-pill bg-danger opacity-70" />
                  <span className="relative inline-flex size-1.5 rounded-pill bg-danger" />
                </span>
              )}
              <span className={cn(TYPE_CLASS.live, live ? 'text-danger' : 'text-ink-muted')}>
                {status}
              </span>
            </div>
          )}
        </div>

        <Half side={away} align="right" big={big} />
      </div>
    </div>
  );
});

function Half({ side, align, big }: { side: ScorePanelSide; align: 'left' | 'right'; big: boolean }): ReactNode {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-1 items-center gap-2.5',
        align === 'right' && 'flex-row-reverse',
      )}
    >
      {/* The colour post. A club is a colour before it is a name. */}
      <span
        aria-hidden="true"
        className={cn('w-1 shrink-0 self-stretch rounded-pill', big ? 'min-h-9' : 'min-h-7')}
        style={{ background: side.color ?? 'var(--color-ink-faint)' }}
      />
      {side.emblem !== undefined && <span className="shrink-0">{side.emblem}</span>}
      <NameText
        name={side.name}
        {...(side.shortName ? { short: side.shortName } : {})}
        {...(side.abbreviation ? { abbr: side.abbreviation } : {})}
        role={big ? 'section' : 'bodyStrong'}
        lines={2}
        className={cn('min-w-0 flex-1', align === 'right' && 'text-right')}
      />
    </div>
  );
}
