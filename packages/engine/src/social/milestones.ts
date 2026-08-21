import type { AnyDomainEvent } from '../core/events';
import type { EventId } from '../core/brand';
import type { GameState } from '../game/state';
import { Ledger, clubAccount, formatMoney, worldAccount } from '../economy/ledger';
import { CREATOR_BALANCE as CB } from '../creators/balance';
import { SOCIAL_ACTION_BALANCE as A } from './balance';
import { applySocialEffect } from './effects';
import { socialWorld, withSocialWorld } from './worldState';

/**
 * Follower milestones.
 *
 * A milestone is a *door*, never a trophy. Passing one raises the sponsor tier
 * the club can be offered, brings a class of creator who would not previously
 * take the call, and pays a one-off commercial dividend — because that is what
 * an audience threshold does in reality: it changes who will do business with
 * you, not how good your team is.
 *
 * The dividend moves through the ledger with an idempotency key derived from
 * the threshold, so a milestone can be paid exactly once per save no matter how
 * often followers cross back and forth over the line.
 */

export interface Milestone {
  readonly threshold: number;
  readonly label: string;
  readonly unlocks: readonly string[];
  readonly reached: boolean;
  readonly cash: number;
}

const UNLOCK_TEXT: Readonly<Record<number, readonly string[]>> = {
  10_000: ['Local creators will now take the call', 'Small brands start asking about sleeve space'],
  25_000: ['Rising creators are reachable', 'Sponsors will negotiate rather than dictate'],
  50_000: ['A second sponsor slot becomes worth selling', 'Away-day content actually travels'],
  100_000: ['Established creators will work with you', 'Brand partners approach you instead of the reverse'],
  250_000: ['Sponsors bid against each other for the shirt', 'Documentary-scale productions become viable'],
  500_000: ['National press treat your club as a story rather than a novelty', 'Major creators return calls'],
  1_000_000: ['Major creators will sign', 'Commercial income stops being the constraint'],
  2_500_000: ['Global brands enter the conversation', 'Your fixtures are somebody else’s content calendar'],
  5_000_000: ['Global creators will consider a deal', 'Every match is covered whether it deserves it or not'],
  10_000_000: ['You are the story the sport tells about itself', 'Nothing you do goes unwatched'],
};

const labelFor = (threshold: number): string =>
  threshold >= 1_000_000
    ? `${threshold / 1_000_000}M followers`
    : `${threshold / 1_000}K followers`;

/** Every milestone, with the ones already passed marked. */
export function milestones(state: GameState): Milestone[] {
  const world = socialWorld(state);
  const claimed = new Set(world.milestones);
  const followers = state.clubs[state.playerClubId]?.fans.onlineFollowers ?? state.social.clubFollowers;
  return A.milestones.map((threshold) => ({
    threshold,
    label: labelFor(threshold),
    unlocks: UNLOCK_TEXT[threshold] ?? [],
    reached: claimed.has(threshold) || followers >= threshold,
    cash: Math.round(threshold * A.milestoneCashPerFollower),
  }));
}

/** The next door, and how far away it is. */
export function nextMilestone(state: GameState): { milestone: Milestone; remaining: number; progress: number } | null {
  const followers = state.clubs[state.playerClubId]?.fans.onlineFollowers ?? state.social.clubFollowers;
  const all = milestones(state);
  const previous = all.filter((m) => followers >= m.threshold).at(-1);
  const next = all.find((m) => followers < m.threshold);
  if (!next) return null;
  const floor = previous?.threshold ?? 0;
  return {
    milestone: next,
    remaining: next.threshold - followers,
    progress: Math.max(0, Math.min(1, (followers - floor) / Math.max(1, next.threshold - floor))),
  };
}

export interface MilestoneAward {
  readonly threshold: number;
  readonly label: string;
  readonly cash: number;
  readonly unlocks: readonly string[];
}

export interface MilestoneResult {
  readonly state: GameState;
  readonly awarded: readonly MilestoneAward[];
  readonly events: readonly AnyDomainEvent[];
  readonly notes: readonly string[];
}

/**
 * Recognise any threshold the club has crossed since last time.
 *
 * Run once per cycle from the social tick. The anchor for the reputation and
 * sentiment movement is the most recent real event involving the club, so even
 * a milestone — which is a state of the world rather than an occurrence — hangs
 * off something that actually happened.
 */
export function awardMilestones(state: GameState, at: number, anchor: EventId | null): MilestoneResult {
  const world = socialWorld(state);
  const claimed = new Set(world.milestones);
  const followers = state.clubs[state.playerClubId]?.fans.onlineFollowers ?? state.social.clubFollowers;
  const due = A.milestones.filter((t) => followers >= t && !claimed.has(t));
  if (due.length === 0 || !anchor) {
    return { state, awarded: [], events: [], notes: [] };
  }

  const ledger = Ledger.restore(state.ledger);
  const awarded: MilestoneAward[] = [];
  const events: AnyDomainEvent[] = [];
  const notes: string[] = [];
  let next = state;

  for (const threshold of due) {
    const cash = Math.round(threshold * A.milestoneCashPerFollower);
    const posted = ledger.post({
      kind: 'SPONSOR_REVENUE',
      amount: cash,
      from: worldAccount('audience-dividend'),
      to: clubAccount(state.playerClubId),
      memo: `Commercial uplift on reaching ${labelFor(threshold)}`,
      metadata: { milestone: threshold },
      idempotencyKey: `follower-milestone:${threshold}`,
    }, { cycle: state.clock.cycle, season: state.clock.season, at });
    // A duplicate simply means this save already paid it; the door still opens.
    const paid = posted.ok ? cash : 0;

    const applied = applySocialEffect(next, {
      reputation: A.milestoneReputation,
      fanExcitement: 2.5,
    }, {
      anchorEventId: anchor,
      suffix: `milestone${threshold}`,
      reason: `Passed ${labelFor(threshold)}`,
      cycle: state.clock.cycle,
      season: state.clock.season,
      week: state.clock.week,
      at,
      clubId: state.playerClubId,
    });
    next = applied.state;
    events.push(...applied.events);

    awarded.push({
      threshold,
      label: labelFor(threshold),
      cash: paid,
      unlocks: UNLOCK_TEXT[threshold] ?? [],
    });
    notes.push(
      paid > 0
        ? `${labelFor(threshold)}. Commercial uplift of ${formatMoney(paid)}.`
        : `${labelFor(threshold)}.`,
    );
  }

  next = withSocialWorld({ ...next, ledger: ledger.snapshot() }, (w) => ({
    milestones: [...w.milestones, ...due],
  }));

  return { state: next, awarded, events, notes };
}

/**
 * Which creator tiers the club's audience currently opens.
 *
 * Read straight off the same table the roster uses, so the milestone screen and
 * the creator screen can never disagree about who will take the call.
 */
export function unlockedCreatorTiers(state: GameState): { tier: string; open: boolean; needed: number }[] {
  const followers = state.clubs[state.playerClubId]?.fans.onlineFollowers ?? state.social.clubFollowers;
  return Object.entries(CB.roster.requiredFollowers).map(([tier, needed]) => ({
    tier,
    open: followers >= needed,
    needed,
  }));
}
