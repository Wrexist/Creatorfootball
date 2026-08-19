import { memo, type ReactNode } from 'react';
import type { ClubId, StandingRow } from '@cf/engine';
import { ClubBadge, FOCUS_RING, FormGuide, cn, type MatchCardSide } from '@/design';

/**
 * The table.
 *
 * Zones are read off `StandingRow.zone`, which the engine computes from the
 * competition's own playoff and relegation counts — a table that drew its own
 * coloured lines would go wrong the first time a competition changed shape.
 * Rows are memoised because this thing re-renders every matchweek and a league
 * is twelve rows of six numbers each.
 */

const ZONE_BAR: Record<StandingRow['zone'], string> = {
  CHAMPION: 'bg-volt',
  PLAYOFF: 'bg-info',
  MID: 'bg-transparent',
  RELEGATION: 'bg-danger',
};

export interface StandingsRowProps {
  row: StandingRow;
  side: MatchCardSide;
  ours: boolean;
  compact?: boolean;
  onPress?: (clubId: ClubId) => void;
}

export const StandingsRowView = memo(function StandingsRowView({
  row, side, ours, compact = false, onPress,
}: StandingsRowProps): ReactNode {
  const content = (
    <>
      <span aria-hidden="true" className={cn('h-7 w-0.5 shrink-0 rounded-pill', ZONE_BAR[row.zone])} />
      <span className="tnum w-5 shrink-0 text-center text-[13px] font-semibold text-ink-muted">
        {row.position}
      </span>
      <ClubBadge visual={side.visual} size={22} flat />
      <span className={cn('min-w-0 flex-1 truncate text-[14px]', ours ? 'font-bold text-ink' : 'font-medium text-ink-muted')}>
        {compact ? side.shortName : side.name}
      </span>
      {!compact && (
        <span className="hidden shrink-0 sm:block">
          <FormGuide results={row.form} slots={5} size="sm" />
        </span>
      )}
      <span className="tnum w-6 shrink-0 text-right text-[13px] text-ink-dim">{row.played}</span>
      {!compact && (
        <span className="tnum w-8 shrink-0 text-right text-[13px] text-ink-dim">
          {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
        </span>
      )}
      <span className="tnum w-8 shrink-0 text-right text-[14px] font-bold text-ink">{row.points}</span>
    </>
  );

  const classes = cn(
    'flex min-h-11 w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left',
    ours && 'bg-volt/[0.09] ring-1 ring-inset ring-volt/25',
    onPress && 'hover:bg-white/[0.05]',
  );

  if (!onPress) {
    return (
      <li className={classes} aria-current={ours ? 'true' : undefined}>
        {content}
      </li>
    );
  }
  return (
    <li aria-current={ours ? 'true' : undefined}>
      <button type="button" onClick={() => onPress(row.clubId)} className={cn(classes, FOCUS_RING)}>
        {content}
      </button>
    </li>
  );
});

export interface StandingsTableProps {
  rows: readonly StandingRow[];
  side: (id: ClubId) => MatchCardSide;
  ourClubId: ClubId;
  compact?: boolean;
  onPress?: (clubId: ClubId) => void;
  className?: string;
}

export const StandingsTable = memo(function StandingsTable({
  rows, side, ourClubId, compact = false, onPress, className,
}: StandingsTableProps): ReactNode {
  return (
    <div className={className}>
      <div className="flex items-center gap-2 px-1.5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-dim">
        <span aria-hidden="true" className="w-0.5 shrink-0" />
        <span className="w-5 shrink-0 text-center">#</span>
        <span className="w-[22px] shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1">Club</span>
        {!compact && <span className="hidden shrink-0 sm:block w-[76px] text-center">Form</span>}
        <span className="w-6 shrink-0 text-right">P</span>
        {!compact && <span className="w-8 shrink-0 text-right">GD</span>}
        <span className="w-8 shrink-0 text-right">Pts</span>
      </div>
      <ul className="flex flex-col gap-0.5">
        {rows.map((row) => (
          <StandingsRowView
            key={row.clubId}
            row={row}
            side={side(row.clubId)}
            ours={row.clubId === ourClubId}
            compact={compact}
            {...(onPress ? { onPress } : {})}
          />
        ))}
      </ul>
    </div>
  );
});
