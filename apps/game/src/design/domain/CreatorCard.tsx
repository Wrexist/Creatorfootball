import { memo, type ReactNode } from 'react';
import { motion } from 'motion/react';
import type { Creator, CreatorTier } from '@cf/engine';
import { cn } from '../cn';
import { useDesignMotion } from '../motion';
import { haptics } from '../haptics';
import { FOCUS_RING } from '../glass/glassLevel';
import { GlassPill } from '../glass/GlassPill';
import { CreatorAvatar } from './PlayerPortrait';
import { formatCount } from './numbers';
import { IconFans, IconFlame } from '../icons';
import { NameText } from '../typography/Text';
import { TYPE_CLASS } from '../typography/type';

/**
 * Creators are the product's second currency and need to read as *people*
 * first, stat blocks second — so the bio line is never truncated away in the
 * standard variant, and reach is shown as a single rounded number rather than a
 * bar. The tier is the only ranked signal on the card.
 */

export type CreatorCardVariant = 'compact' | 'standard' | 'featured';

const TIER_LABEL: Record<CreatorTier, string> = {
  LOCAL: 'Local', RISING: 'Rising', ESTABLISHED: 'Established', MAJOR: 'Major', GLOBAL: 'Global',
};

const TIER_TONE = {
  LOCAL: 'neutral', RISING: 'neutral', ESTABLISHED: 'info', MAJOR: 'special', GLOBAL: 'volt',
} as const;

const TONE_LABEL: Record<Creator['style']['tone'], string> = {
  HYPE: 'Hype', ANALYTICAL: 'Analytical', COMEDIC: 'Comedy',
  PROVOCATIVE: 'Provocative', WHOLESOME: 'Wholesome', DRAMATIC: 'Dramatic',
};

export interface CreatorCardProps {
  creator: Creator;
  variant?: CreatorCardVariant;
  onPress?: (creatorId: Creator['id']) => void;
  /** Right-hand slot: a sign button, a deal countdown, a remove control. */
  trailing?: ReactNode;
  selected?: boolean;
  className?: string;
}

function SentimentDot({ value }: { value: number }): ReactNode {
  const tone = value >= 25 ? 'bg-positive' : value <= -25 ? 'bg-danger' : 'bg-ink-faint';
  const label = value >= 25 ? 'Supportive' : value <= -25 ? 'Hostile' : 'Neutral';
  return (
    <span className="inline-flex items-center gap-1 text-micro text-ink-muted" title={`Sentiment: ${label}`}>
      <span className={cn('size-1.5 rounded-pill', tone)} aria-hidden="true" />
      {label}
    </span>
  );
}

export const CreatorCard = memo(function CreatorCard({
  creator,
  variant = 'standard',
  onPress,
  trailing,
  selected,
  className,
}: CreatorCardProps): ReactNode {
  const m = useDesignMotion();
  const featured = variant === 'featured';
  const compact = variant === 'compact';

  const interactive = Boolean(onPress);
  const Element = interactive ? motion.button : motion.div;

  return (
    <Element
      type={interactive ? 'button' : undefined}
      onClick={interactive ? () => { haptics.selection(); onPress?.(creator.id); } : undefined}
      whileTap={interactive && !m.reduced ? { scale: 0.985 } : undefined}
      transition={m.spring.press}
      aria-label={interactive ? `${creator.displayName}, ${TIER_LABEL[creator.tier]} creator` : undefined}
      className={cn(
        'relative flex w-full items-start gap-3 overflow-hidden rounded-lg text-left',
        compact ? 'px-2 py-2' : 'glass-2 glass-sheen p-3.5',
        featured && 'p-4',
        interactive && cn('hover:bg-white/[0.05]', FOCUS_RING),
        selected && 'ring-1 ring-volt/50',
        className,
      )}
    >
      <CreatorAvatar
        seed={creator.avatarSeed}
        size={compact ? 40 : featured ? 58 : 48}
        tier={creator.tier}
        verified={creator.tier === 'MAJOR' || creator.tier === 'GLOBAL'}
      />

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <NameText
            name={creator.displayName}
            short={creator.handle}
            role="bodyStrong"
            floor={0.8}
            className="min-w-0 flex-1"
          />
          <GlassPill tone={TIER_TONE[creator.tier]} size="xs">
            {TIER_LABEL[creator.tier]}
          </GlassPill>
        </span>

        <span className={cn(TYPE_CLASS.label, 'mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 font-normal')}>
          <NameText name={creator.handle} role="caption" floor={0.85} className="min-w-0 shrink" />
          <span className="inline-flex items-center gap-1">
            <IconFans size={13} />
            <span className="tnum">{formatCount(creator.followers)}</span>
          </span>
          {!compact && <SentimentDot value={creator.clubSentiment} />}
        </span>

        {!compact && (
          <span className={cn(TYPE_CLASS.commentary, 'mt-2 block text-caption text-pretty')}>
            {creator.bio}
          </span>
        )}

        {featured && (
          <span className="mt-3 flex flex-wrap items-center gap-1.5">
            <GlassPill size="xs" icon={<IconFlame />}>{TONE_LABEL[creator.style.tone]}</GlassPill>
            {creator.roles.slice(0, 3).map((role) => (
              <GlassPill key={role} size="xs">
                {role.replace('_', ' ').toLowerCase()}
              </GlassPill>
            ))}
          </span>
        )}
      </span>

      {trailing !== undefined && <span className="shrink-0">{trailing}</span>}
    </Element>
  );
});
