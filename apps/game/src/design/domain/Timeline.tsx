import { memo, type ReactNode } from 'react';
import { motion } from 'motion/react';
import type { MatchEvent, MatchEventType } from '@cf/engine';
import { cn } from '../cn';
import { useDesignMotion } from '../motion';
import {
  IconBall, IconCard, IconCheck, IconFlame, IconInjury, IconInfo, IconShield,
  IconStar, IconSwap, IconTactics, IconWarning, IconWhistle, type IconComponent,
} from '../icons';

/* --- MatchEventRow ---------------------------------------------------- */

/**
 * Event → glyph. Only events a spectator would notice get a distinct icon;
 * everything else falls through to a neutral dot, because a timeline where
 * every row shouts is a timeline where nothing does.
 */
const EVENT_ICON: Partial<Record<MatchEventType, IconComponent>> = {
  GOAL: IconBall,
  PENALTY_SCORED: IconBall,
  PENALTY_MISSED: IconWarning,
  MISS: IconWarning,
  SHOT: IconBall,
  SAVE: IconShield,
  POST: IconWarning,
  YELLOW_CARD: IconCard,
  RED_CARD: IconCard,
  FOUL: IconWhistle,
  INJURY: IconInjury,
  SUBSTITUTION: IconSwap,
  TACTICAL_CHANGE: IconTactics,
  SPECIAL_RULE_START: IconStar,
  SPECIAL_RULE_END: IconStar,
  CREATOR_MOMENT: IconFlame,
  MOMENTUM_SHIFT: IconFlame,
  HALFTIME: IconWhistle,
  FULLTIME: IconWhistle,
  MATCH_START: IconWhistle,
  DECISION_RESOLVED: IconCheck,
  CHANCE_CREATED: IconInfo,
};

const EVENT_TONE: Partial<Record<MatchEventType, string>> = {
  GOAL: 'text-volt',
  PENALTY_SCORED: 'text-volt',
  RED_CARD: 'text-danger',
  YELLOW_CARD: 'text-warning',
  INJURY: 'text-danger',
  SAVE: 'text-info',
  CREATOR_MOMENT: 'text-special',
  SPECIAL_RULE_START: 'text-special',
  SUBSTITUTION: 'text-ink-muted',
};

export interface MatchEventRowProps {
  event: MatchEvent;
  /** Which side is "ours" — drives left/right alignment in the match timeline. */
  perspective?: 'home' | 'away' | 'neutral';
  /** Compact single-line form for the in-match ticker. */
  dense?: boolean;
  onPress?: (eventId: string) => void;
  className?: string;
}

export const MatchEventRow = memo(function MatchEventRow({
  event,
  perspective = 'neutral',
  dense = false,
  onPress,
  className,
}: MatchEventRowProps): ReactNode {
  const m = useDesignMotion();
  const Icon = EVENT_ICON[event.type] ?? IconInfo;
  const tone = EVENT_TONE[event.type] ?? 'text-ink-dim';
  const major = event.importance >= 4;
  const mirrored = perspective !== 'neutral' && event.side !== undefined && event.side !== perspective;

  return (
    <motion.div
      variants={m.variants.listItem}
      onClick={onPress ? () => onPress(event.id) : undefined}
      className={cn(
        'flex items-start gap-3 py-2',
        mirrored && 'flex-row-reverse text-right',
        onPress && 'cursor-pointer',
        className,
      )}
    >
      <span
        className={cn(
          'tnum shrink-0 pt-0.5 text-[12px] font-semibold text-ink-dim',
          dense ? 'w-7' : 'w-8',
        )}
      >
        {event.minute}&apos;
      </span>
      <span
        className={cn(
          'flex shrink-0 items-center justify-center rounded-pill',
          major ? 'size-7 bg-white/[0.08]' : 'size-6',
          tone,
        )}
        aria-hidden="true"
      >
        <Icon size={major ? 16 : 14} />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block leading-snug text-pretty',
            major ? 'text-[15px] font-semibold text-ink' : 'text-[13px] text-ink-muted',
          )}
        >
          {event.text}
        </span>
        {!dense && major && (
          <span className="tnum mt-0.5 block text-[11px] text-ink-dim">
            {event.homeScore}–{event.awayScore}
            {event.xg !== undefined && ` · ${event.xg.toFixed(2)} xG`}
          </span>
        )}
      </span>
    </motion.div>
  );
});

/* --- Timeline --------------------------------------------------------- */

export interface TimelineItem {
  readonly id: string;
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly time?: ReactNode;
  readonly icon?: ReactNode;
  readonly tone?: 'neutral' | 'volt' | 'positive' | 'warning' | 'danger' | 'special';
  /** Renders the node hollow — used for future/pending steps. */
  readonly pending?: boolean;
}

export interface TimelineProps {
  items: readonly TimelineItem[];
  /** Staggered reveal on mount. Off for long histories. */
  animate?: boolean;
  className?: string;
}

const NODE_TONE = {
  neutral: 'bg-ink-faint',
  volt: 'bg-volt',
  positive: 'bg-positive',
  warning: 'bg-warning',
  danger: 'bg-danger',
  special: 'bg-special',
} as const;

/**
 * Vertical history: negotiation steps, season milestones, a player's career.
 *
 * The connecting rail is drawn per-item rather than as one absolutely
 * positioned line, so it stops exactly at the last node no matter how the list
 * wraps — the failure mode of the single-line approach is a rail dangling past
 * the final entry.
 */
export const Timeline = memo(function Timeline({
  items,
  animate = true,
  className,
}: TimelineProps): ReactNode {
  const m = useDesignMotion();
  return (
    <motion.ol
      variants={animate ? m.variants.listContainer : undefined}
      initial={animate ? 'hidden' : undefined}
      animate={animate ? 'visible' : undefined}
      className={cn('flex flex-col', className)}
    >
      {items.map((item, index) => {
        const last = index === items.length - 1;
        return (
          <motion.li
            key={item.id}
            variants={animate ? m.variants.listItem : undefined}
            className="flex gap-3"
          >
            <div className="flex w-4 shrink-0 flex-col items-center">
              <span
                className={cn(
                  'mt-1.5 size-2.5 shrink-0 rounded-pill',
                  item.pending ? 'border border-ink-faint bg-transparent' : NODE_TONE[item.tone ?? 'neutral'],
                )}
                aria-hidden="true"
              />
              {!last && <span className="w-px flex-1 bg-white/[0.1]" aria-hidden="true" />}
            </div>
            <div className={cn('min-w-0 flex-1', last ? 'pb-0' : 'pb-4')}>
              <div className="flex items-baseline justify-between gap-3">
                <span className={cn('text-[14px] font-semibold text-ink', item.pending && 'text-ink-muted')}>
                  {item.title}
                </span>
                {item.time !== undefined && (
                  <span className="tnum shrink-0 text-[11px] text-ink-dim">{item.time}</span>
                )}
              </div>
              {item.description !== undefined && (
                <p className="mt-0.5 text-[13px] leading-snug text-ink-muted text-pretty">
                  {item.description}
                </p>
              )}
            </div>
          </motion.li>
        );
      })}
    </motion.ol>
  );
});
