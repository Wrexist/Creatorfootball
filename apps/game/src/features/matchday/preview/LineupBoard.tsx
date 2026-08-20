import { memo, type ReactNode } from 'react';
import { PlayerPortrait, cn } from '@/design';
import type { KitColors } from '../shared/kit';
import type { LineupSlot } from '../shared/context';

/**
 * The predicted eleven, on a board.
 *
 * Static SVG rather than the canvas the live match uses: nothing here moves, it
 * has to be crisp at any size, and each shirt is a real focusable element with
 * a name attached — everything canvas is bad at and SVG plus absolutely
 * positioned DOM is good at. The two renderers are different because the two
 * problems are different, not by accident.
 *
 * Coordinates come straight from the formation's own `x`/`y` slots, so the
 * board and the simulation agree about shape by construction.
 */

export interface LineupBoardProps {
  slots: readonly LineupSlot[];
  kit: KitColors;
  className?: string;
}

export const LineupBoard = memo(function LineupBoard({
  slots, kit, className,
}: LineupBoardProps): ReactNode {
  return (
    <div
      className={cn(
        'relative w-full overflow-hidden rounded-lg border border-white/[0.07]',
        'bg-[linear-gradient(180deg,var(--color-pitch-mid),var(--color-pitch-deep))]',
        className,
      )}
      style={{ aspectRatio: '3 / 4' }}
    >
      <svg
        viewBox="0 0 100 133"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <g fill="none" stroke="var(--color-pitch-line)" strokeWidth="0.5">
          <rect x="4" y="4" width="92" height="125" />
          <line x1="4" y1="66.5" x2="96" y2="66.5" />
          <circle cx="50" cy="66.5" r="14" />
          <rect x="26" y="4" width="48" height="16" />
          <rect x="26" y="113" width="48" height="16" />
          <rect x="38" y="4" width="24" height="7" />
          <rect x="38" y="122" width="24" height="7" />
        </g>
      </svg>

      <ul className="absolute inset-0">
        {slots.map(({ slot, player }) => (
          <li
            key={slot.id}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
            style={{
              // The formation's x runs from own goal to opponent goal; the board
              // shows the team attacking upward, so x is inverted into `top`.
              left: `${slot.y * 100}%`,
              top: `${(1 - slot.x) * 100}%`,
              width: '30%',
            }}
          >
            {player ? (
              <>
                <PlayerPortrait
                  seed={player.portraitSeed}
                  size={34}
                  colors={kit}
                  shape="circle"
                  label={player.displayName}
                />
                {/* Surnames wrap rather than clip. A board that renders
                    "Alvarss…" is worse than one that renders a name on two
                    lines, and no name in the content packs needs three. */}
                <span className="w-full break-words rounded-xs bg-void/60 px-1 text-center text-[10px] font-semibold leading-tight text-ink">
                  {player.displayName.split(' ').slice(-1)[0]}
                </span>
              </>
            ) : (
              <>
                <span
                  className="size-[34px] rounded-pill border border-dashed border-white/25"
                  aria-hidden="true"
                />
                <span className="w-full text-center text-[10px] font-semibold text-ink-dim">
                  {slot.position}
                </span>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
});
