import { memo, useMemo, type ReactNode } from 'react';
import {
  ATTRIBUTE_KEYS,
  ATTRIBUTE_LABELS,
  estimatedOverall,
  keyAttributes,
  knowledgeConfidence,
  knowledgeRange,
  potentialRange,
  type AttributeKey,
  type Player,
} from '@cf/engine';
import {
  AttributeBar, GlassPill, ProgressBar, RatingBadge, cn,
} from '@/design';

/**
 * Scouting confidence, rendered honestly.
 *
 * The one rule this file protects: a player nobody has watched must never show
 * an exact number. Everything below is an aggregation of the engine's own
 * `knowledgeRange` output — no information is invented here, and the same
 * player always shows the same band because the engine's bands are
 * deterministic rather than re-rolled per render.
 */

export interface Knowledge {
  readonly confidence: number;
  /** True once the engine's bands have collapsed to a point. */
  readonly exact: boolean;
  readonly estimate: number;
  readonly band: readonly [number, number];
  readonly potential: readonly [number, number];
  readonly keys: readonly AttributeKey[];
  readonly label: string;
}

const CONFIDENCE_LABEL = (c: number): string => {
  if (c >= 0.95) return 'Fully scouted';
  if (c >= 0.7) return 'Well scouted';
  if (c >= 0.45) return 'Watched once';
  if (c > 0) return 'Thin report';
  return 'Unscouted';
};

export function useKnowledge(player: Player): Knowledge {
  return useMemo(() => {
    const confidence = knowledgeConfidence(player);
    // Half-width of the overall band is the mean half-width of the engine's
    // per-attribute bands: the aggregate of what our scouts do not know.
    let spread = 0;
    for (const key of ATTRIBUTE_KEYS) {
      const [lo, hi] = knowledgeRange(player, key);
      spread += (hi - lo) / 2;
    }
    const half = Math.round(spread / ATTRIBUTE_KEYS.length);
    const estimate = estimatedOverall(player);
    return {
      confidence,
      exact: half === 0,
      estimate,
      band: [Math.max(1, estimate - half), Math.min(99, estimate + half)] as const,
      potential: potentialRange(player),
      keys: keyAttributes(player.attributes, player.position, 4),
      label: CONFIDENCE_LABEL(confidence),
    };
  }, [player]);
}

/* --- the rating slot -------------------------------------------------- */

export interface KnownRatingProps {
  knowledge: Knowledge;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Either a rating badge or a band. Never a badge with a guess inside it —
 * the whole competitive edge of scouting rests on the player being able to see
 * at a glance which of the two they are looking at.
 */
export const KnownRating = memo(function KnownRating({
  knowledge, size = 'md', className,
}: KnownRatingProps): ReactNode {
  if (knowledge.exact) {
    return <RatingBadge value={knowledge.estimate} size={size} className={className} />;
  }
  const [lo, hi] = knowledge.band;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border border-dashed border-white/20 bg-white/[0.04] px-2 py-1',
        className,
      )}
      aria-label={`Estimated ability between ${lo} and ${hi}, ${knowledge.label.toLowerCase()}`}
    >
      <span className={cn('tnum font-display font-bold leading-none text-ink-muted', size === 'lg' ? 'text-[22px]' : 'text-[15px]')}>
        {lo}–{hi}
      </span>
    </span>
  );
});

/* --- confidence meter ------------------------------------------------- */

export interface ConfidenceMeterProps {
  knowledge: Knowledge;
  className?: string;
}

export const ConfidenceMeter = memo(function ConfidenceMeter({
  knowledge, className,
}: ConfidenceMeterProps): ReactNode {
  const pct = Math.round(knowledge.confidence * 100);
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <ProgressBar
        value={pct}
        tone={pct >= 85 ? 'positive' : pct >= 45 ? 'volt' : 'warning'}
        size="xs"
        label={knowledge.label}
        valueLabel={`${pct}%`}
      />
    </div>
  );
});

/* --- the progressive-disclosure payoff -------------------------------- */

export interface AttributeDossierProps {
  player: Player;
  knowledge: Knowledge;
  /** Show every attribute rather than the position's key four. */
  full?: boolean;
  className?: string;
}

/**
 * The band narrowing as confidence rises is the whole point of paying for a
 * report, so the bars are the payoff screen — not a footnote under a number.
 */
export const AttributeDossier = memo(function AttributeDossier({
  player, knowledge, full = false, className,
}: AttributeDossierProps): ReactNode {
  const keys = full ? ATTRIBUTE_KEYS : knowledge.keys;
  const emphasised = new Set(knowledge.keys);
  return (
    <div className={cn('flex flex-col gap-2.5', className)}>
      {keys.map((key) => {
        const [lo, hi] = knowledgeRange(player, key);
        const exact = lo === hi;
        return (
          <AttributeBar
            key={key}
            label={ATTRIBUTE_LABELS[key]}
            value={exact ? player.attributes[key] : Math.round((lo + hi) / 2)}
            {...(exact ? {} : { range: [lo, hi] as const })}
            emphasis={emphasised.has(key)}
          />
        );
      })}
    </div>
  );
});

/* --- potential ---------------------------------------------------------- */

export const PotentialPill = memo(function PotentialPill({
  knowledge,
}: { knowledge: Knowledge }): ReactNode {
  const [lo, hi] = knowledge.potential;
  const known = lo === hi;
  return (
    <GlassPill tone={known ? 'special' : 'neutral'} size="xs">
      {known ? `Potential ${lo}` : `Potential ${lo}–${hi}`}
    </GlassPill>
  );
});
