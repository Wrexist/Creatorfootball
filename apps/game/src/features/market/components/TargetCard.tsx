import { memo, type ReactNode } from 'react';
import type { Player, PlayerId, TransferListing } from '@cf/engine';
import {
  ClubBadge, FOCUS_RING, GlassPill, MoneyLabel, NameText, PlayerPortrait, PositionChip,
  Text, cn, type PlayerCardClub,
} from '@/design';
import { KnownRating, useKnowledge } from './scouting';
import type { TargetStory } from '../story';

/**
 * A player in a market rail.
 *
 * The card leads with the *story* rather than the price: "Priced to move",
 * "3 clubs circling", "Deal running down". The number is still there, but a
 * column of prices tells a manager nothing about which of them is a chance and
 * which is a trap.
 *
 * Where the player is unscouted the rating slot shows a band, not a figure —
 * that is `KnownRating`'s whole job, and the visible difference between a band
 * and a badge is how the value of scouting gets communicated without a tutorial.
 */

export interface TargetCardProps {
  player: Player;
  story: TargetStory;
  club?: PlayerCardClub;
  listing?: TransferListing;
  onPress?: (playerId: PlayerId) => void;
  className?: string;
}

const HEADLINE_TONE = (story: TargetStory): 'volt' | 'warning' | 'danger' | 'info' | 'neutral' => {
  if (story.headline === 'Priced to move' || story.headline === 'Free agent — no fee') return 'volt';
  if (story.headline === 'Priced to stay') return 'danger';
  if (story.headline.endsWith('circling') || story.headline === 'One rival watching') return 'warning';
  if (story.headline === 'Deal running down') return 'info';
  return 'neutral';
};

export const TargetCard = memo(function TargetCard({
  player, story, club, listing, onPress, className,
}: TargetCardProps): ReactNode {
  const knowledge = useKnowledge(player);
  const price = listing?.askingPrice ?? story.asking;

  return (
    <article
      className={cn(
        'glass-1 relative flex h-full w-full flex-col overflow-hidden rounded-lg p-3 text-left',
        className,
      )}
    >
      {onPress && (
        <button
          type="button"
          onClick={() => onPress(player.id)}
          aria-label={`${player.displayName}, ${player.position}, ${story.headline}, ${story.abilityLine}`}
          className={cn('absolute inset-0 z-10 rounded-[inherit]', FOCUS_RING)}
        />
      )}

      <div className="flex items-start gap-2.5">
        <PlayerPortrait seed={player.portraitSeed} size={40} shape="squircle" />
        <div className="min-w-0 flex-1">
          <NameText
            name={player.displayName}
            short={`${player.firstName.charAt(0)}. ${player.lastName}`}
            abbr={player.lastName}
            role="section"
            lines={2}
          />
          <div className="mt-1.5 flex items-center gap-2">
            <PositionChip position={player.position} size="xs" />
            <Text role="micro" as="span">{player.age}</Text>
            {club && <ClubBadge visual={club.visual} size={14} flat label={club.name} />}
          </div>
        </div>
        <KnownRating knowledge={knowledge} size="sm" />
      </div>

      <div className="mt-2.5">
        <GlassPill tone={HEADLINE_TONE(story)} size="xs" filled={HEADLINE_TONE(story) !== 'neutral'}>
          {story.headline}
        </GlassPill>
      </div>

      {/* A short, whole sentence rather than three clamped lines of a long
          one: a card that ends in an ellipsis is a card that did not decide
          what it wanted to say. */}
      <Text role="caption" as="p" className="mt-2 text-pretty">
        {story.cardLine}
      </Text>

      <div className="mt-auto flex items-end justify-between gap-2 pt-3">
        <span>
          <Text role="micro" as="span" className="block">
            {player.clubId ? 'Asking' : 'No fee'}
          </Text>
          {player.clubId ? (
            <MoneyLabel amount={price} size="md" />
          ) : (
            <Text role="bodyStrong" as="span" className="text-volt">Free</Text>
          )}
        </span>
        <span className="text-right">
          <Text role="micro" as="span" className="block">Wages</Text>
          <MoneyLabel amount={story.wage} size="sm" />
        </span>
      </div>
    </article>
  );
});
