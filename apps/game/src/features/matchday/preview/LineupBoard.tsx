import { memo, type ReactNode } from 'react';
import { FitText, PlayerPortrait, cn } from '@/design';
import type { KitColors } from '../shared/kit';
import type { LineupSlot } from '../shared/context';
import { pitchRows } from '@/features/squad/pitchLayout';

export interface LineupBoardProps {
  slots: readonly LineupSlot[];
  kit: KitColors;
  className?: string;
}

/** A readable team sheet at the card's actual width. Simulation anchors stay unchanged. */
export const LineupBoard = memo(function LineupBoard({slots, kit, className}: LineupBoardProps): ReactNode {
  const rows = pitchRows(slots.map(({slot}) => slot));
  const players = new Map(slots.map(({slot,player}) => [slot.id,player]));
  return <div className={cn('cf-preview-lineup relative w-full overflow-hidden rounded-lg border border-white/[0.07] bg-[linear-gradient(180deg,var(--color-pitch-mid),var(--color-pitch-deep))]',className)}>
    <svg viewBox="0 0 100 133" preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden="true">
      <g fill="none" stroke="var(--color-pitch-line)" strokeWidth="0.5">
        <rect x="4" y="4" width="92" height="125"/><line x1="4" y1="66.5" x2="96" y2="66.5"/>
        <circle cx="50" cy="66.5" r="14"/><rect x="26" y="4" width="48" height="16"/><rect x="26" y="113" width="48" height="16"/>
        <rect x="38" y="4" width="24" height="7"/><rect x="38" y="122" width="24" height="7"/>
      </g>
    </svg>
    <div role="list" aria-label="Predicted starting team" className="relative flex flex-col gap-3 p-3">
      {rows.map((row,index) => <div key={index} className="grid items-center gap-1" style={{gridTemplateColumns:`repeat(${row.length},minmax(0,1fr))`}}>
        {row.map(slot => {
          const player=players.get(slot.id);
          return <div role="listitem" key={slot.id} className="mx-auto flex min-h-24 w-full max-w-20 flex-col items-center gap-1 rounded-md bg-void/40 p-1 text-center" aria-label={player ? `${player.displayName}, ${slot.position}, overall ${player.overall}` : `Empty ${slot.position}`}>
            {player ? <><PlayerPortrait seed={player.portraitSeed} size={36} colors={kit} shape="circle" label={player.displayName}/>
              <FitText size={13} min={12} lines={2} className="font-semibold text-ink">{player.lastName}</FitText>
              <span className="text-caption text-ink-muted">{slot.position} · {player.overall}</span></> : <span className="text-caption text-ink-muted">{slot.position}</span>}
          </div>;
        })}
      </div>)}
    </div>
  </div>;
});
