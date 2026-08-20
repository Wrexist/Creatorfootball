import { Fragment, memo, type ReactNode } from 'react';
import type { ClubId, StandingRow } from '@cf/engine';
import {
  ClubBadge, FOCUS_RING, FormGuide, NameText, Numeric, Text, cn, type MatchCardSide,
} from '@/design';

/**
 * The table, as a story rather than a spreadsheet.
 *
 * Three things carry that. Zones are drawn as *bands* with a named rule between
 * them — "Playoff places" and "Relegation" are lines you can see the club sit
 * above or below, which is how a table is actually read, rather than a colour
 * key you have to memorise. The player's own club is pulled out with a filled
 * accent rail, a tinted row and a "You" marker, so finding yourself is instant.
 * And no club name is ever cut: `FitText` steps the type down instead.
 *
 * Zones come off `StandingRow.zone`, which the engine derives from the
 * competition's own playoff and relegation counts — a table drawing its own
 * lines would go wrong the first time a competition changed shape.
 */

const ZONE_RAIL: Record<StandingRow['zone'], string> = {
  CHAMPION: 'bg-volt',
  PLAYOFF: 'bg-info',
  MID: 'bg-white/12',
  RELEGATION: 'bg-danger',
};

const ZONE_ROW: Record<StandingRow['zone'], string> = {
  CHAMPION: 'bg-volt/[0.05]',
  PLAYOFF: 'bg-info/[0.05]',
  MID: '',
  RELEGATION: 'bg-danger/[0.05]',
};

/** The rule drawn *above* a zone, naming what the clubs below it are playing for. */
const ZONE_ENTRY: Record<StandingRow['zone'], { label: string; className: string } | null> = {
  CHAMPION: null,
  PLAYOFF: { label: 'Playoff places', className: 'text-info' },
  MID: { label: 'Mid-table', className: 'text-ink-dim' },
  RELEGATION: { label: 'Relegation', className: 'text-danger' },
};

function ZoneRule({ zone }: { zone: StandingRow['zone'] }): ReactNode {
  const entry = ZONE_ENTRY[zone];
  if (!entry) return null;
  return (
    <li aria-hidden="true" className="flex items-center gap-2 px-1.5 pb-1 pt-2">
      <Text role="micro" as="span" className={entry.className}>
        {entry.label}
      </Text>
      <span
        className={cn(
          'h-px flex-1',
          zone === 'RELEGATION' ? 'bg-danger/30' : zone === 'PLAYOFF' ? 'bg-info/30' : 'bg-white/[0.08]',
        )}
      />
    </li>
  );
}

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
      <span
        aria-hidden="true"
        className={cn('h-8 w-1 shrink-0 rounded-pill', ours ? 'bg-volt' : ZONE_RAIL[row.zone])}
      />
      <Numeric role="stat" tone="muted" className="w-5 shrink-0 text-center text-[13px]">
        {row.position}
      </Numeric>
      <ClubBadge visual={side.visual} size={22} flat />
      <span className="min-w-0 flex-1">
        <NameText
          name={side.name}
          short={side.shortName}
          abbr={side.abbreviation}
          role="bodyStrong"
          lines={compact ? 1 : 2}
          className={ours ? 'text-ink' : 'font-medium text-ink-muted'}
        />
        {ours && (
          <Text role="micro" as="span" className="mt-0.5 block tracking-[0.18em] text-volt">
            You
          </Text>
        )}
      </span>
      {!compact && (
        <span className="hidden shrink-0 sm:block">
          <FormGuide results={row.form} slots={5} size="sm" />
        </span>
      )}
      <Numeric role="stat" tone="dim" className="w-6 shrink-0 text-right text-[13px]">
        {row.played}
      </Numeric>
      {!compact && (
        <Numeric role="stat" tone="dim" className="w-8 shrink-0 text-right text-[13px]">
          {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
        </Numeric>
      )}
      <Numeric role="stat" className="w-8 shrink-0 text-right">{row.points}</Numeric>
    </>
  );

  const classes = cn(
    'flex min-h-11 w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left',
    ZONE_ROW[row.zone],
    ours && 'bg-volt/[0.1] ring-1 ring-inset ring-volt/30',
    onPress && 'hover:bg-white/[0.06]',
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
  /** Draws the named rules between zones. Off when rows are not in table order. */
  zones?: boolean;
  onPress?: (clubId: ClubId) => void;
  className?: string;
}

export const StandingsTable = memo(function StandingsTable({
  rows, side, ourClubId, compact = false, zones = true, onPress, className,
}: StandingsTableProps): ReactNode {
  return (
    <div className={className}>
      <div className="flex items-center gap-2 px-1.5 pb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-dim">
        <span aria-hidden="true" className="w-1 shrink-0" />
        <span className="w-5 shrink-0 text-center">#</span>
        <span className="w-[22px] shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1">Club</span>
        {!compact && <span className="hidden w-[76px] shrink-0 text-center sm:block">Form</span>}
        <span className="w-6 shrink-0 text-right">P</span>
        {!compact && <span className="w-8 shrink-0 text-right">GD</span>}
        <span className="w-8 shrink-0 text-right">Pts</span>
      </div>
      <ul className="flex flex-col gap-0.5">
        {rows.map((row, index) => {
          const previous = rows[index - 1];
          const newZone = zones && previous !== undefined && previous.zone !== row.zone;
          return (
            <Fragment key={row.clubId}>
              {newZone && <ZoneRule zone={row.zone} />}
              <StandingsRowView
                row={row}
                side={side(row.clubId)}
                ours={row.clubId === ourClubId}
                compact={compact}
                {...(onPress ? { onPress } : {})}
              />
            </Fragment>
          );
        })}
      </ul>
    </div>
  );
});
