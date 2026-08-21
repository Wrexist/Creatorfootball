import { memo, type ReactNode } from 'react';
import {
  nextMilestone, socialStanding, socialWorld, trustSummary,
  type GameState, type Standing,
} from '@cf/engine';
import {
  GlassPanel, GlassPill, ProgressBar, StatBlock, Text, formatCount,
} from '@/design';

/**
 * How the sport currently sees you.
 *
 * Standing is not a score to maximise — it is a description of the character
 * the player has built out of their own choices, and each of the five is a
 * genuinely different way to be famous. So it is rendered as a sentence with a
 * label attached rather than as a bar with a number, and the two axes
 * underneath it are shown as what they are: how kind you are in public, and
 * whether what you say turns out to be true.
 */

const TONE: Record<Standing, 'neutral' | 'volt' | 'positive' | 'warning' | 'danger' | 'info'> = {
  UNKNOWN: 'neutral',
  BELOVED: 'positive',
  RESPECTED: 'info',
  FEARED: 'warning',
  DIVISIVE: 'volt',
  CLOWN: 'danger',
};

export const StandingCard = memo(function StandingCard({
  state,
}: { state: GameState }): ReactNode {
  const standing = socialStanding(state);
  const world = socialWorld(state);
  const trust = trustSummary(state);
  const next = nextMilestone(state);

  return (
    <GlassPanel title="Standing" padding="md" accent={standing.standing === 'CLOWN' ? 'danger' : 'volt'}>
      <div className="flex flex-wrap items-center gap-2">
        <GlassPill tone={TONE[standing.standing]} size="sm" filled>{standing.label}</GlassPill>
        <Text role="micro" as="span">{`${standing.acts} recorded acts`}</Text>
      </div>
      <Text role="caption" as="p" className="mt-2 text-pretty">{standing.blurb}</Text>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <StatBlock
          label="Warmth"
          value={standing.warmth > 0 ? 'Generous' : standing.warmth < 0 ? 'Cutting' : 'Even'}
          caption="How you treat people in public"
          tone={standing.warmth >= 0 ? 'positive' : 'danger'}
        />
        <StatBlock
          label="Credibility"
          value={standing.credibility > 0 ? 'Believed' : standing.credibility < 0 ? 'Discounted' : 'Untested'}
          caption="Whether what you say turns out to be true"
          tone={standing.credibility >= 0 ? 'info' : 'warning'}
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <StatBlock
          label="Media goodwill"
          value={Math.round(world.mediaGoodwill)}
          unit="/100"
          caption="Spent in the press room, earned by candour"
          tone={world.mediaGoodwill >= 55 ? 'positive' : world.mediaGoodwill <= 35 ? 'danger' : 'neutral'}
        />
        <StatBlock
          label="Supporters' trust"
          value={trust.label}
          caption={`${trust.value} out of 100`}
          tone={trust.value >= 60 ? 'positive' : trust.value <= 35 ? 'danger' : 'neutral'}
        />
      </div>

      {next && (
        <div className="mt-3.5">
          <div className="flex items-baseline justify-between gap-2">
            <Text role="label" as="span">{`Next door: ${next.milestone.label}`}</Text>
            <Text role="micro" as="span">{`${formatCount(next.remaining)} to go`}</Text>
          </div>
          <ProgressBar value={next.progress * 100} max={100} tone="volt" className="mt-1.5" />
          {next.milestone.unlocks[0] && (
            <Text role="caption" as="p" className="mt-1.5 text-ink-dim text-pretty">
              {next.milestone.unlocks[0]}
            </Text>
          )}
        </div>
      )}
    </GlassPanel>
  );
});
