import { memo, useMemo, useRef, type ReactNode } from 'react';
import { motion, useInView } from 'motion/react';
import type { ClubVisualIdentity, Player } from '@cf/engine';
import { ATTRIBUTE_LABELS, TRAIT_BY_ID, keyAttributes } from '@cf/engine';
import { cn } from '../cn';
import { useDesignMotion } from '../motion';
import { haptics } from '../haptics';
import { darken, rgba } from '../color';
import { FOCUS_RING } from '../glass/glassLevel';
import { PlayerPortrait } from './PlayerPortrait';
import { ClubBadge } from './ClubBadge';
import { PositionChip, RatingBadge, TraitChip } from './chips';
import { MoneyLabel } from './numbers';
import { IconCard, IconFlame, IconInjury, IconTrendDown, IconTrendUp } from '../icons';

/**
 * The collectible player card.
 *
 * Design brief for this object specifically: it must feel like something you
 * would want to own, and it must be *ours*. The construction is deliberately
 * unlike the horizontal-band card layout every football game has converged on —
 * here the identity lives in an asymmetric diagonal plate at the top-left
 * carrying the overall, a portrait that bleeds off the top-right corner, and a
 * hairline-divided attribute strip at the foot. Nothing is centred, nothing is
 * chromed, and the club colour arrives as a single directional wash rather than
 * a frame.
 *
 * All six variants share that construction so a player is recognisably the same
 * object whether it appears in a squad list, a transfer result or a signing
 * reveal.
 */

export type PlayerCardVariant =
  | 'compact'
  | 'standard'
  | 'featured'
  | 'transfer'
  | 'matchday'
  | 'legendary';

export interface PlayerCardClub {
  readonly name: string;
  readonly abbreviation: string;
  readonly visual: ClubVisualIdentity;
}

export interface PlayerCardProps {
  player: Player;
  club?: PlayerCardClub;
  variant?: PlayerCardVariant;
  onPress?: (playerId: Player['id']) => void;
  /** Transfer variant: the fee to show instead of the market value. */
  price?: number;
  /** Transfer/market status, e.g. "Wanted by 3 clubs". */
  statusLabel?: ReactNode;
  /** Matchday variant: minutes, rating so far, or a substitution control. */
  trailing?: ReactNode;
  /** Squad screens use this to grey out unavailable players. */
  dimmed?: boolean;
  selected?: boolean;
  className?: string;
}

function useCardData(player: Player, club?: PlayerCardClub) {
  return useMemo(() => {
    const keys = keyAttributes(player.attributes, player.position, 3);
    const primary = club?.visual.primary ?? '#1c2026';
    const trait = player.traitIds
      .map((id) => TRAIT_BY_ID.get(id))
      .find((t) => t !== undefined && t.kind !== 'negative');
    return {
      attrs: keys.map((key) => ({
        key,
        label: ATTRIBUTE_LABELS[key],
        short: ATTRIBUTE_LABELS[key].slice(0, 3).toUpperCase(),
        value: player.attributes[key],
      })),
      primary,
      trait,
      hot: player.form.rating >= 0.45,
      cold: player.form.rating <= -0.45,
    };
  }, [player, club]);
}

function StatusFlag({ player }: { player: Player }): ReactNode {
  if (player.injury) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-pill bg-danger/85 px-1.5 py-0.5 text-[10px] font-bold text-ink"
        title={player.injury.description}
      >
        <IconInjury size={11} />
        {player.injury.weeksRemaining}w
      </span>
    );
  }
  if (player.suspensionMatches > 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-pill bg-warning/85 px-1.5 py-0.5 text-[10px] font-bold text-void">
        <IconCard size={11} />
        {player.suspensionMatches}
      </span>
    );
  }
  return null;
}

/* --- compact: the squad-list row ------------------------------------- */

function CompactCard({ player, club, onPress, trailing, dimmed, selected, className }: PlayerCardProps): ReactNode {
  const m = useDesignMotion();
  const colors = useMemo(
    () => (club ? { primary: club.visual.primary, secondary: club.visual.secondary } : undefined),
    [club],
  );
  const Element = onPress ? motion.button : motion.div;

  return (
    <Element
      type={onPress ? 'button' : undefined}
      onClick={onPress ? () => { haptics.selection(); onPress(player.id); } : undefined}
      whileTap={onPress && !m.reduced ? { scale: 0.985 } : undefined}
      transition={m.spring.press}
      className={cn(
        'relative flex w-full items-center gap-3 rounded-md px-2 py-2 text-left',
        'transition-colors duration-[var(--duration-fast)] ease-out-quint',
        onPress && cn('hover:bg-white/[0.05]', FOCUS_RING),
        selected && 'bg-volt/10 ring-1 ring-volt/40',
        dimmed && 'opacity-50',
        className,
      )}
    >
      <PlayerPortrait seed={player.portraitSeed} size={40} shape="squircle" {...(colors ? { colors } : {})} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[15px] font-semibold text-ink">{player.displayName}</span>
          <StatusFlag player={player} />
        </span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[12px] text-ink-muted">
          <PositionChip position={player.position} size="xs" />
          <span className="tnum">{player.age}</span>
          {player.shirtNumber !== null && <span className="tnum text-ink-dim">#{player.shirtNumber}</span>}
        </span>
      </span>
      {trailing ?? <RatingBadge value={player.overall} size="sm" />}
    </Element>
  );
}

/* --- matchday: the horizontal in-match row ---------------------------- */

function MatchdayCard({ player, club, onPress, trailing, dimmed, className }: PlayerCardProps): ReactNode {
  const colors = useMemo(
    () => (club ? { primary: club.visual.primary, secondary: club.visual.secondary } : undefined),
    [club],
  );
  const fitnessTone =
    player.fitness >= 75 ? 'bg-positive' : player.fitness >= 45 ? 'bg-warning' : 'bg-danger';

  return (
    <div
      className={cn(
        'glass-1 relative flex items-center gap-3 rounded-md px-3 py-2.5',
        dimmed && 'opacity-50',
        className,
      )}
    >
      {/* Stretched link, so the row is keyboard-navigable while the trailing
          slot (often a substitution button) keeps its own focus stop. */}
      {onPress && (
        <button
          type="button"
          onClick={() => onPress(player.id)}
          aria-label={`${player.displayName}, ${player.position}`}
          className={cn('absolute inset-0 rounded-[inherit]', FOCUS_RING)}
        />
      )}
      <span className="tnum w-6 shrink-0 text-center font-display text-[17px] font-bold text-ink-dim">
        {player.shirtNumber ?? '–'}
      </span>
      <PlayerPortrait seed={player.portraitSeed} size={36} shape="circle" {...(colors ? { colors } : {})} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-semibold text-ink">{player.displayName}</span>
        <span className="mt-1 flex items-center gap-2">
          <PositionChip position={player.position} size="xs" />
          <span className="h-1 w-14 overflow-hidden rounded-pill bg-white/10" title={`Fitness ${Math.round(player.fitness)}%`}>
            <span className={cn('block h-full rounded-pill', fitnessTone)} style={{ width: `${player.fitness}%` }} />
          </span>
        </span>
      </span>
      <span className="relative z-10">{trailing}</span>
    </div>
  );
}

/* --- the vertical card family ---------------------------------------- */

function VerticalCard(props: PlayerCardProps): ReactNode {
  const {
    player, club, variant = 'standard', onPress, price, statusLabel, dimmed, selected, className,
  } = props;
  const m = useDesignMotion();
  const data = useCardData(player, club);
  // One ref serves both the <article> and <button> branches; a callback ref
  // keeps it type-correct without casting either element.
  const ref = useRef<HTMLElement | null>(null);
  const setRef = (node: HTMLElement | null): void => { ref.current = node; };
  // Continuous effects only run while the card is actually on screen. A rail of
  // twenty legendary cards animating off-screen is pure battery drain.
  const inView = useInView(ref, { amount: 0.35 });

  const featured = variant === 'featured' || variant === 'legendary';
  const legendary = variant === 'legendary';
  const colors = useMemo(
    () => (club ? { primary: club.visual.primary, secondary: club.visual.secondary } : undefined),
    [club],
  );

  const body = (
    <>
      {/* Directional club wash. One layer, no blur — this sits inside a
          scrolling rail and must stay cheap. */}
      <span
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background: `linear-gradient(158deg, ${rgba(data.primary, featured ? 0.55 : 0.4)} 0%, ${rgba(darken(data.primary, 0.5), 0.16)} 46%, transparent 72%)`,
        }}
      />

      {/* Portrait bleeds off the top-right corner. */}
      <span aria-hidden="true" className="absolute -right-3 -top-2 opacity-95">
        <PlayerPortrait
          seed={player.portraitSeed}
          size={featured ? 138 : 104}
          shape="bare"
          kit
          {...(colors ? { colors } : {})}
          className="[mask-image:radial-gradient(78%_78%_at_58%_38%,#000_58%,transparent_100%)]"
        />
      </span>

      {/* The diagonal identity plate. This asymmetric cut is the card's
          signature — it is what makes the object recognisable at thumbnail
          size without any branding. */}
      <span
        aria-hidden="true"
        className="absolute left-0 top-0 flex flex-col items-center gap-1 bg-void/55 px-3 pb-3.5 pt-3 backdrop-blur-[2px] [clip-path:polygon(0_0,100%_0,100%_calc(100%-16px),0_100%)]"
      >
        <span
          className={cn(
            'tnum font-display font-bold leading-none tracking-[-0.05em]',
            featured ? 'text-[42px]' : 'text-[30px]',
            player.overall >= 88 ? 'text-volt' : 'text-ink',
          )}
        >
          {player.overall}
        </span>
        <PositionChip position={player.position} size="xs" />
      </span>

      {/* Status corner, opposite the plate so it never collides with it. */}
      <span className="absolute right-2 top-2 flex flex-col items-end gap-1">
        <StatusFlag player={player} />
        {data.hot && !player.injury && (
          <span className="inline-flex items-center gap-0.5 rounded-pill bg-volt/18 px-1.5 py-0.5 text-[10px] font-bold text-volt">
            <IconFlame size={11} />
            {featured ? 'In form' : ''}
          </span>
        )}
      </span>

      {/* Foot: scrim, name, club, attribute strip. */}
      <span className="absolute inset-x-0 bottom-0 flex flex-col bg-gradient-to-t from-void via-void/85 to-transparent pt-8">
        <span className="flex items-end gap-2 px-3">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[11px] uppercase tracking-[0.16em] text-ink-dim">
              {player.firstName}
            </span>
            <span className="block truncate font-display text-[17px] font-bold leading-tight tracking-[-0.02em] text-ink">
              {player.lastName}
            </span>
          </span>
          {club && <ClubBadge visual={club.visual} size={featured ? 28 : 22} flat />}
        </span>

        {featured && data.trait && (
          <span className="mt-2 px-3">
            <TraitChip trait={data.trait} />
          </span>
        )}

        <span className="mt-2.5 flex divide-x divide-white/[0.08] border-t border-white/[0.08]">
          {data.attrs.map((attr) => (
            <span key={attr.key} className="flex flex-1 flex-col items-center gap-0.5 py-1.5">
              <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-ink-dim">
                {attr.short}
              </span>
              <span className="tnum text-[13px] font-bold text-ink">{attr.value}</span>
            </span>
          ))}
        </span>

        {variant === 'transfer' && (
          <span className="flex items-center justify-between gap-2 border-t border-white/[0.08] px-3 py-2">
            <MoneyLabel amount={price ?? player.marketValue} size="sm" />
            {statusLabel !== undefined && (
              <span className="truncate text-[11px] text-ink-muted">{statusLabel}</span>
            )}
          </span>
        )}
      </span>

      {legendary && (
        <>
          {/* Conic sheen: the one place in the whole kit where a continuous
              animation is allowed, and only while visible. */}
          <span
            aria-hidden="true"
            className={cn(
              'pointer-events-none absolute -inset-px rounded-[inherit] opacity-70',
              '[background:conic-gradient(from_0deg,transparent_0deg,rgb(200_255_46/0.9)_28deg,transparent_78deg,transparent_180deg,rgb(200_255_46/0.5)_212deg,transparent_260deg)]',
              '[mask:linear-gradient(#000_0_0)_content-box,linear-gradient(#000_0_0)] [mask-composite:exclude] p-px',
              inView && !m.reduced && 'animate-crest',
            )}
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0_0_36px_-12px_rgb(200_255_46/0.6)]"
          />
        </>
      )}
    </>
  );

  const shell = cn(
    'relative flex w-full flex-col overflow-hidden text-left',
    featured ? 'aspect-[3/4.15] rounded-xl' : 'aspect-[3/4] rounded-lg',
    'glass-2 glass-sheen',
    selected && 'ring-2 ring-volt',
    dimmed && 'opacity-55',
    className,
  );

  if (!onPress) {
    return (
      <article
        ref={setRef}
        className={shell}
        aria-label={`${player.displayName}, ${player.position}, overall ${player.overall}`}
      >
        {body}
      </article>
    );
  }

  return (
    <motion.button
      ref={setRef}
      type="button"
      onClick={() => { haptics.impact(); onPress(player.id); }}
      whileTap={m.reduced ? undefined : { scale: 0.97 }}
      transition={m.spring.press}
      aria-label={`${player.displayName}, ${player.position}, overall ${player.overall}`}
      className={cn(shell, FOCUS_RING)}
    >
      {body}
    </motion.button>
  );
}

export const PlayerCard = memo(function PlayerCard(props: PlayerCardProps): ReactNode {
  switch (props.variant ?? 'standard') {
    case 'compact':
      return <CompactCard {...props} />;
    case 'matchday':
      return <MatchdayCard {...props} />;
    default:
      return <VerticalCard {...props} />;
  }
});

/* --- a small companion used by squad and market rows ------------------ */

export interface PlayerFormPipProps {
  /** `PlayerForm.rating`, -1..1. */
  rating: number;
  className?: string;
}

export function PlayerFormPip({ rating, className }: PlayerFormPipProps): ReactNode {
  if (Math.abs(rating) < 0.2) {
    return <span className={cn('text-[12px] text-ink-dim', className)}>—</span>;
  }
  const Icon = rating > 0 ? IconTrendUp : IconTrendDown;
  return (
    <Icon
      size={14}
      className={cn(rating > 0 ? 'text-positive' : 'text-danger', className)}
      label={rating > 0 ? 'In form' : 'Out of form'}
    />
  );
}
