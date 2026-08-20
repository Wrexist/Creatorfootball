import { memo, type ReactNode } from 'react';
import type { Player, PlayerId, TransferListing } from '@cf/engine';
import {
  ClubBadge, FOCUS_RING, MoneyLabel, NameText, PlayerPortrait, PositionChip, cn,
  type PlayerCardClub,
} from '@/design';
import { KnownRating, useKnowledge } from './scouting';

/**
 * The dense market row.
 *
 * Used wherever a list is long enough that a grid of cards would cost more than
 * it communicates: the shortlist, scouting assignments, a club's squad seen
 * from the outside. Memoised, and every prop it takes is a stable reference.
 */
export interface PlayerRowProps {
  player: Player;
  club?: PlayerCardClub;
  listing?: TransferListing;
  onPress?: (playerId: PlayerId) => void;
  /** Right-hand slot: a scout button, a shortlist toggle, a report countdown. */
  trailing?: ReactNode;
  /** Replaces the price line. */
  detail?: ReactNode;
  className?: string;
}

export const PlayerRow = memo(function PlayerRow({
  player, club, listing, onPress, trailing, detail, className,
}: PlayerRowProps): ReactNode {
  const knowledge = useKnowledge(player);
  const price = listing?.askingPrice ?? player.marketValue;

  return (
    <div
      className={cn(
        'relative flex min-h-11 items-center gap-3 rounded-md px-2 py-2',
        onPress && 'hover:bg-white/[0.05]',
        className,
      )}
    >
      {onPress && (
        <button
          type="button"
          onClick={() => onPress(player.id)}
          aria-label={`${player.displayName}, ${player.position}`}
          className={cn('absolute inset-0 rounded-[inherit]', FOCUS_RING)}
        />
      )}
      <PlayerPortrait seed={player.portraitSeed} size={38} shape="squircle" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <NameText
            name={player.displayName}
            short={`${player.firstName.charAt(0)}. ${player.lastName}`}
            abbr={player.lastName}
            role="bodyStrong"
            className="min-w-0 flex-1"
          />
          {club && <ClubBadge visual={club.visual} size={14} flat />}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-ink-muted">
          <PositionChip position={player.position} size="xs" />
          <span className="tnum">{player.age}</span>
          <span aria-hidden="true">·</span>
          {detail ?? <MoneyLabel amount={price} size="sm" />}
        </div>
      </div>
      <KnownRating knowledge={knowledge} size="sm" />
      {trailing !== undefined && <div className="relative z-10 shrink-0">{trailing}</div>}
    </div>
  );
});
