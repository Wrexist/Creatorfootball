import { useMemo, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Club, MatchEvent, Side, TacticSetup } from '@cf/engine';
import {
  ClubBadge, GlassPanel, GlassPill, cn, useDesignMotion,
} from '@/design';
import { useMatchStore } from '@/state/matchStore';
import { CompareRow } from '../shared/CompareRow';
import { MomentumWave } from '../shared/MomentumWave';
import { isNoteworthy, minuteLabel, momentumPhrase, one } from '../shared/format';
import type { KitPalette } from '../shared/kit';
import { EventFeed } from './EventFeed';
import { useLiveStats } from './useLiveStats';

/**
 * Broadcast mode.
 *
 * The alternative to watching the shapes move: a studio read of the same
 * simulation. Big scoreline, the commentary line set as the hero, momentum as a
 * two-sided wave, the head-to-head numbers, and what each side is currently
 * *doing* tactically.
 *
 * The visual language is deliberately ours and not television's: no lower
 * thirds, no skewed parallelograms, no wipes, no channel-style ident bar. The
 * identity here comes from the same glass, volt accent and club colours as the
 * rest of the product, and the only motion is the vertical push of a new
 * commentary line arriving — which is information, not decoration.
 */

export interface BroadcastViewProps {
  home: Club;
  away: Club;
  homePalette: KitPalette;
  awayPalette: KitPalette;
  playerSide: Side;
  tactics: TacticSetup;
  /**
   * Rendered inside the live screen's lower panel rather than as the whole
   * stage. The scoreline band and the trailing feed are dropped: the header
   * already carries the score and the sibling tab already carries the feed, and
   * repeating either would cost the numbers the room they need.
   */
  embedded?: boolean;
  className?: string;
}

export function BroadcastView({
  home, away, homePalette, awayPalette, playerSide, tactics, embedded = false, className,
}: BroadcastViewProps): ReactNode {
  const m = useDesignMotion();
  const stats = useLiveStats();
  const feed = useMatchStore((s) => s.feed);
  const momentum = useMatchStore((s) => s.momentum);
  const homeScore = useMatchStore((s) => s.homeScore);
  const awayScore = useMatchStore((s) => s.awayScore);

  const headline = useMemo(() => feed.find(isNoteworthy) ?? null, [feed]);
  const activeRules = useMemo(() => collectActiveRules(feed), [feed]);
  const subs = useMemo(() => feed.filter((e) => e.type === 'SUBSTITUTION').slice(0, 4), [feed]);

  return (
    <div className={cn(embedded ? 'flex flex-col gap-2.5 py-2' : 'scroll-y flex flex-col gap-3 pb-2', className)}>
      {/* --- scoreline band ------------------------------------------- */}
      {!embedded && (
      <div className="relative overflow-hidden rounded-lg border border-white/[0.07]">
        <span
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background: `linear-gradient(100deg, ${homePalette.primary}2e 0%, transparent 42%, transparent 58%, ${awayPalette.primary}2e 100%)`,
          }}
        />
        <div className="relative flex items-center justify-between gap-3 bg-surface-1/70 px-4 py-4">
          <TeamColumn club={home} align="start" />
          <div className="flex flex-col items-center">
            <span className="tnum font-display text-[44px] font-bold leading-none tracking-[-0.05em] text-ink">
              {homeScore}<span className="px-1.5 text-ink-faint">–</span>{awayScore}
            </span>
            <span className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-dim">
              {momentumPhrase(momentum, home.shortName, away.shortName)}
            </span>
          </div>
          <TeamColumn club={away} align="end" />
        </div>
      </div>
      )}

      {/* --- the commentary hero -------------------------------------- */}
      <GlassPanel nested level={2} padding="md" accent="volt" radius="lg">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={headline?.id ?? 'idle'}
            initial={m.reduced ? { opacity: 0 } : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={m.reduced ? { opacity: 0 } : { opacity: 0, y: -10 }}
            transition={m.transition.medium}
            className="text-balance text-[19px] font-semibold leading-[1.25] tracking-[-0.015em] text-ink"
          >
            {headline?.text ?? 'Teams are out. Waiting for the whistle.'}
          </motion.p>
        </AnimatePresence>
        {headline && (
          <p className="mt-1.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-dim">
            {minuteLabel(headline.minute)} · {headline.type.replace(/_/g, ' ').toLowerCase()}
          </p>
        )}
      </GlassPanel>

      {/* --- momentum ------------------------------------------------- */}
      <GlassPanel nested level={2} padding="md" title="Momentum">
        <MomentumWave
          values={stats.momentumHistory}
          homeColor={homePalette.primary}
          awayColor={awayPalette.primary}
          homeLabel={home.abbreviation}
          awayLabel={away.abbreviation}
          height={72}
        />
      </GlassPanel>

      {/* --- key numbers ---------------------------------------------- */}
      <GlassPanel nested level={2} padding="md" title="Key numbers">
        <CompareRow
          label="Possession"
          homeValue={stats.homePossession * 100}
          awayValue={(1 - stats.homePossession) * 100}
          homeColor={homePalette.primary}
          awayColor={awayPalette.primary}
          format={(v) => `${Math.round(v)}%`}
        />
        <CompareRow
          label="Shots"
          homeValue={stats.home.shots}
          awayValue={stats.away.shots}
          homeColor={homePalette.primary}
          awayColor={awayPalette.primary}
        />
        <CompareRow
          label="On target"
          homeValue={stats.home.onTarget}
          awayValue={stats.away.onTarget}
          homeColor={homePalette.primary}
          awayColor={awayPalette.primary}
        />
        <CompareRow
          label="xG"
          homeValue={stats.home.xg}
          awayValue={stats.away.xg}
          homeColor={homePalette.primary}
          awayColor={awayPalette.primary}
          format={one}
        />
        <CompareRow
          label="Corners"
          homeValue={stats.home.corners}
          awayValue={stats.away.corners}
          homeColor={homePalette.primary}
          awayColor={awayPalette.primary}
        />
        <CompareRow
          label="Fouls"
          homeValue={stats.home.fouls}
          awayValue={stats.away.fouls}
          homeColor={homePalette.primary}
          awayColor={awayPalette.primary}
          invert
        />
        <p className="mt-2 text-[11px] text-ink-dim">
          Live tally from the match feed. The final figures come from the result.
        </p>
      </GlassPanel>

      {/* --- what we are doing ---------------------------------------- */}
      <GlassPanel nested level={2} padding="md" title="Your shape">
        <div className="flex flex-wrap gap-1.5">
          <GlassPill tone="neutral" size="sm">{label(tactics.tempo)}</GlassPill>
          <GlassPill tone="neutral" size="sm">{label(tactics.press)} press</GlassPill>
          <GlassPill tone="neutral" size="sm">{label(tactics.line)} line</GlassPill>
          <GlassPill tone="neutral" size="sm">{label(tactics.width)}</GlassPill>
          <GlassPill tone={tactics.risk === 'RECKLESS' ? 'danger' : 'neutral'} size="sm">
            {label(tactics.risk)}
          </GlassPill>
        </div>

        {activeRules.length > 0 && (
          <div className="mt-3">
            <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-dim">
              Rule window open
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {activeRules.map((rule) => (
                <GlassPill key={rule} tone="special" size="sm" filled>{label(rule)}</GlassPill>
              ))}
            </div>
          </div>
        )}

        {subs.length > 0 && (
          <div className="mt-3">
            <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-dim">
              Changes
            </h4>
            <ul className="flex flex-col gap-1">
              {subs.map((sub) => (
                <li key={sub.id} className="flex gap-2 text-[13px] text-ink-muted">
                  <span className="tnum shrink-0 text-ink-dim">{minuteLabel(sub.minute)}</span>
                  <span className="min-w-0 flex-1">{sub.text}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </GlassPanel>

      {/* --- feed ------------------------------------------------------ */}
      {!embedded && (
        <GlassPanel nested level={2} padding="sm" title="Match feed">
          <EventFeed perspective={playerSide} limit={24} />
        </GlassPanel>
      )}
    </div>
  );
}

function TeamColumn({ club, align }: { club: Club; align: 'start' | 'end' }): ReactNode {
  return (
    <div className={cn('flex min-w-0 flex-1 flex-col gap-1.5', align === 'end' ? 'items-end' : 'items-start')}>
      <ClubBadge visual={club.visual} size={38} flat label={club.name} />
      <span
        className="w-full text-[13px] font-bold leading-tight tracking-[-0.01em] text-ink text-pretty"
        style={{ textAlign: align === 'end' ? 'right' : 'left' }}
      >
        {club.shortName}
      </span>
    </div>
  );
}

/**
 * Which rule windows are open right now, read back off the feed.
 *
 * The store keeps a bounded tail, so a window that opened more than sixty
 * events ago and is still running will not appear here. That is acceptable for
 * a live indicator — the authoritative list of every window and its exact
 * bounds is on `MatchResult.specialRules`, which is what analytics reads.
 */
function collectActiveRules(feed: readonly MatchEvent[]): string[] {
  const ended = new Set<string>();
  const active: string[] = [];
  // Feed is newest-first, so an END seen before its START means it is closed.
  for (const event of feed) {
    const ruleId = typeof event.detail?.ruleId === 'string' ? event.detail.ruleId : null;
    if (!ruleId) continue;
    if (event.type === 'SPECIAL_RULE_END') ended.add(ruleId);
    else if (event.type === 'SPECIAL_RULE_START' && !ended.has(ruleId) && !active.includes(ruleId)) {
      active.push(ruleId);
    }
  }
  return active;
}

const label = (value: string): string =>
  value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ');
