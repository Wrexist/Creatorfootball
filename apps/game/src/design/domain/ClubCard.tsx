import { memo, useMemo, type ReactNode } from 'react';
import { motion } from 'motion/react';
import type { Club, StandingRow } from '@cf/engine';
import { PHILOSOPHY_LABELS } from '@cf/engine';
import { cn } from '../cn';
import { useDesignMotion } from '../motion';
import { haptics } from '../haptics';
import { rgba, darken } from '../color';
import { FOCUS_RING } from '../glass/glassLevel';
import { GlassPill } from '../glass/GlassPill';
import { ClubBadge } from './ClubBadge';
import { FormGuide } from './chips';
import { formatCount } from './numbers';
import { IconFans, IconStadium } from '../icons';

export type ClubCardVariant = 'compact' | 'standard' | 'featured' | 'standings';

export interface ClubCardProps {
  club: Club;
  variant?: ClubCardVariant;
  /** Supplied on the league table; drives position, points and form. */
  standing?: StandingRow;
  onPress?: (clubId: Club['id']) => void;
  trailing?: ReactNode;
  /** Highlights the user's own club wherever it appears. */
  isOwn?: boolean;
  className?: string;
}

const ZONE_TONE = {
  CHAMPION: 'bg-volt',
  PLAYOFF: 'bg-positive',
  MID: 'bg-transparent',
  RELEGATION: 'bg-danger',
} as const;

/**
 * One club, four densities.
 *
 * `standings` is its own variant rather than a table row component because the
 * league table is the screen players stare at most, and it earns a purpose-built
 * layout: a zone bar down the left edge, tabular figures, and the user's club
 * lifted by a volt hairline instead of a full highlight (a filled row would
 * fight the twelve badges next to it).
 */
export const ClubCard = memo(function ClubCard({
  club,
  variant = 'standard',
  standing,
  onPress,
  trailing,
  isOwn = false,
  className,
}: ClubCardProps): ReactNode {
  const m = useDesignMotion();
  const interactive = Boolean(onPress);
  const wash = useMemo(
    () =>
      `linear-gradient(112deg, ${rgba(club.visual.primary, 0.42)} 0%, ${rgba(darken(club.visual.primary, 0.55), 0.1)} 52%, transparent 78%)`,
    [club.visual.primary],
  );

  const press = interactive
    ? {
        type: 'button' as const,
        onClick: () => { haptics.selection(); onPress?.(club.id); },
        whileTap: m.reduced ? undefined : { scale: 0.985 },
        transition: m.spring.press,
      }
    : {};
  const Element = interactive ? motion.button : motion.div;

  if (variant === 'standings') {
    return (
      <Element
        {...press}
        className={cn(
          'relative flex w-full items-center gap-3 overflow-hidden rounded-md py-2 pl-3 pr-2 text-left',
          interactive && cn('hover:bg-white/[0.05]', FOCUS_RING),
          isOwn && 'bg-volt/[0.07]',
          className,
        )}
      >
        {standing && (
          <span
            aria-hidden="true"
            className={cn('absolute inset-y-1 left-0 w-0.5 rounded-pill', ZONE_TONE[standing.zone])}
          />
        )}
        <span className="tnum w-5 shrink-0 text-center text-[13px] font-semibold text-ink-muted">
          {standing?.position ?? '–'}
        </span>
        <ClubBadge visual={club.visual} size={26} flat />
        <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink">
          {club.shortName}
          {isOwn && <span className="ml-1.5 text-[11px] font-bold uppercase tracking-wider text-volt">You</span>}
        </span>
        {standing && (
          <>
            <span className="hidden sm:block"><FormGuide results={standing.form} slots={5} /></span>
            <span className="tnum w-7 text-right text-[13px] text-ink-muted">{standing.played}</span>
            <span className="tnum w-8 text-right text-[13px] text-ink-muted">
              {standing.goalDifference > 0 ? '+' : ''}{standing.goalDifference}
            </span>
            <span className="tnum w-8 text-right text-[15px] font-bold text-ink">{standing.points}</span>
          </>
        )}
        {trailing}
      </Element>
    );
  }

  if (variant === 'compact') {
    return (
      <Element
        {...press}
        className={cn(
          'flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left',
          interactive && cn('hover:bg-white/[0.05]', FOCUS_RING),
          className,
        )}
      >
        <ClubBadge visual={club.visual} size={24} flat />
        <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-ink">{club.shortName}</span>
        {trailing}
      </Element>
    );
  }

  const featured = variant === 'featured';

  return (
    <Element
      {...press}
      aria-label={interactive ? club.name : undefined}
      className={cn(
        'glass-2 glass-sheen relative w-full overflow-hidden rounded-lg text-left',
        featured ? 'p-5' : 'p-3.5',
        isOwn && 'ring-1 ring-volt/35',
        interactive && FOCUS_RING,
        className,
      )}
    >
      <span aria-hidden="true" className="absolute inset-0" style={{ background: wash }} />
      <span className="relative flex items-center gap-3.5">
        <ClubBadge visual={club.visual} size={featured ? 64 : 44} label={featured ? club.name : undefined} />
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              'block truncate font-display font-bold tracking-[-0.02em] text-ink',
              featured ? 'text-[22px]' : 'text-[16px]',
            )}
          >
            {club.name}
          </span>
          <span className="mt-0.5 block truncate text-[12px] text-ink-muted">
            {club.city} · est. {club.founded}
          </span>
          {featured && (
            <span className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <GlassPill size="xs" tone="volt">{PHILOSOPHY_LABELS[club.philosophy]}</GlassPill>
              <GlassPill size="xs" icon={<IconStadium />}>{formatCount(club.stadium.capacity)}</GlassPill>
              <GlassPill size="xs" icon={<IconFans />}>{formatCount(club.fans.base)}</GlassPill>
            </span>
          )}
        </span>
        {trailing}
      </span>
      {featured && club.motto && (
        <p className="relative mt-4 border-l-2 border-volt/40 pl-3 text-[13px] italic leading-snug text-ink-muted">
          {club.motto}
        </p>
      )}
    </Element>
  );
});
