import { memo, type ReactNode } from 'react';
import type { Player, PlayerId, TransferListing } from '@cf/engine';
import {
  ClubBadge, FOCUS_RING, GlassPill, MoneyLabel, PlayerCard, PlayerPortrait, PositionChip,
  cn, type PlayerCardClub,
} from '@/design';
import { AttributeDossier, ConfidenceMeter, KnownRating, useKnowledge } from './scouting';

/**
 * A market result.
 *
 * Two renderings, chosen by what we actually know. A fully scouted player gets
 * the real transfer card, exact numbers and all. A player nobody has watched
 * gets a dossier of the same size showing the engine's ranges, so the shape of
 * the grid never changes but the information plainly does — that contrast is
 * how the value of scouting is communicated without a tutorial.
 */

export const AVAILABILITY: Record<
  TransferListing['availability'],
  { readonly label: string; readonly tone: 'neutral' | 'volt' | 'warning' | 'danger' }
> = {
  AVAILABLE: { label: 'Available', tone: 'volt' },
  WANTED_BY_OTHERS: { label: 'Wanted elsewhere', tone: 'warning' },
  RELUCTANT: { label: 'Not for sale', tone: 'neutral' },
  UNAVAILABLE: { label: 'Unavailable', tone: 'danger' },
};

export interface MarketPlayerCardProps {
  player: Player;
  club?: PlayerCardClub;
  listing?: TransferListing;
  onPress?: (playerId: PlayerId) => void;
  className?: string;
}

export const MarketPlayerCard = memo(function MarketPlayerCard({
  player, club, listing, onPress, className,
}: MarketPlayerCardProps): ReactNode {
  const knowledge = useKnowledge(player);
  const availability = listing ? AVAILABILITY[listing.availability] : null;
  const price = listing?.askingPrice ?? player.marketValue;

  if (knowledge.exact) {
    return (
      <PlayerCard
        player={player}
        {...(club ? { club } : {})}
        variant="transfer"
        price={price}
        {...(availability ? { statusLabel: availability.label } : {})}
        {...(onPress ? { onPress } : {})}
        className={className}
      />
    );
  }

  const [lo, hi] = knowledge.band;

  return (
    <article
      className={cn(
        'glass-2 glass-sheen relative flex w-full flex-col overflow-hidden rounded-lg p-3 text-left',
        className,
      )}
    >
      {/* Stretched link keeps the card keyboard-reachable without wrapping a
          stack of block content in a <button>. */}
      {onPress && (
        <button
          type="button"
          onClick={() => onPress(player.id)}
          aria-label={`${player.displayName}, ${player.position}, estimated ability ${lo} to ${hi}, ${knowledge.label}`}
          className={cn('absolute inset-0 z-10 rounded-[inherit]', FOCUS_RING)}
        />
      )}

      <div className="flex items-start gap-2.5">
        <PlayerPortrait seed={player.portraitSeed} size={44} shape="squircle" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] uppercase tracking-[0.16em] text-ink-dim">
            {player.firstName}
          </p>
          <p className="truncate font-display text-[16px] font-bold leading-tight text-ink">
            {player.lastName}
          </p>
          <p className="mt-1 flex items-center gap-1.5">
            <PositionChip position={player.position} size="xs" />
            <span className="tnum text-[12px] text-ink-muted">{player.age}</span>
          </p>
        </div>
        {club && <ClubBadge visual={club.visual} size={22} flat />}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <KnownRating knowledge={knowledge} />
        <GlassPill tone="neutral" size="xs">{knowledge.label}</GlassPill>
      </div>

      <AttributeDossier player={player} knowledge={knowledge} className="mt-3" />

      <div className="mt-auto pt-3">
        <ConfidenceMeter knowledge={knowledge} />
        <div className="mt-2 flex items-center justify-between gap-2">
          <MoneyLabel amount={price} size="sm" />
          {availability && (
            <span className="truncate text-[11px] text-ink-muted">{availability.label}</span>
          )}
        </div>
      </div>
    </article>
  );
});
