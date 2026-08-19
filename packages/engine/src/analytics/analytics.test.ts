import { afterEach, describe, expect, it } from 'vitest';
import type { ClubId, MatchId, ObjectiveId, PlayerId } from '../core/brand';
import { makeTestEvent } from '../simulation/fixtures';
import {
  ANALYTICS_EVENTS, analyticsForDomainEvent, bufferedEvents, evaluateChurnRisk,
  rejectedEventNames, resetAnalytics, setAnalyticsSink, trackDomainEvents, trackEvent,
} from './analytics';

afterEach(() => resetAnalytics());

const collector = () => {
  const seen: { name: string; props: Record<string, unknown> }[] = [];
  setAnalyticsSink((name, props) => seen.push({ name, props }));
  return seen;
};

describe('the event schema', () => {
  it('covers the product brief', () => {
    const required = [
      'session_start', 'onboarding_start', 'onboarding_complete', 'club_created', 'first_match',
      'match_started', 'match_completed', 'live_decision', 'goal', 'transfer_viewed',
      'transfer_started', 'transfer_completed', 'social_story_opened', 'objective_completed',
      'season_completed', 'offer_viewed', 'purchase_started', 'purchase_completed',
      'churn_risk_flagged', 'inactivity_detected', 'session_abandoned',
    ];
    for (const name of required) expect(ANALYTICS_EVENTS).toContain(name);
  });

  it('has no duplicates', () => {
    expect(new Set(ANALYTICS_EVENTS).size).toBe(ANALYTICS_EVENTS.length);
  });
});

describe('the sink', () => {
  it('is pluggable and receives events synchronously', () => {
    const seen = collector();
    trackEvent('match_started', { matchId: 'm1' });
    expect(seen).toHaveLength(1);
    expect(seen[0]?.name).toBe('match_started');
    expect(seen[0]?.props).toEqual({ matchId: 'm1' });
  });

  it('buffers events fired before a sink exists and replays them in order', () => {
    trackEvent('session_start', { n: 1 });
    trackEvent('club_created', { n: 2 });
    expect(bufferedEvents()).toHaveLength(2);
    const seen = collector();
    expect(seen.map((e) => e.name)).toEqual(['session_start', 'club_created']);
    expect(bufferedEvents()).toHaveLength(0);
  });

  it('rejects names that are not in the schema', () => {
    const seen = collector();
    trackEvent('definitely_not_an_event', { a: 1 });
    expect(seen).toHaveLength(0);
    expect(rejectedEventNames()).toContain('definitely_not_an_event');
  });

  it('can be detached', () => {
    const seen = collector();
    setAnalyticsSink(null);
    trackEvent('goal', {});
    expect(seen).toHaveLength(0);
    expect(bufferedEvents()).toHaveLength(1);
  });
});

describe('domain event mapping', () => {
  it('maps simulation events onto analytics events', () => {
    const goal = makeTestEvent('GOAL_SCORED', {
      matchId: 'm1' as MatchId, clubId: 'club_0' as ClubId, scorerId: 'p_0_1' as PlayerId,
      minute: 10, homeScore: 1, awayScore: 0,
    }, { id: 'ev_g' });
    expect(analyticsForDomainEvent(goal)?.name).toBe('goal');

    const objective = makeTestEvent('OBJECTIVE_COMPLETED', {
      objectiveId: 'obj_1' as ObjectiveId, title: 'Win 3', rewardSummary: 'Cash',
    }, { id: 'ev_o' });
    expect(analyticsForDomainEvent(objective)?.name).toBe('objective_completed');
  });

  it('returns null for events with no analytics counterpart', () => {
    const morale = makeTestEvent('PLAYER_MORALE_CHANGED', {
      playerId: 'p_0_1' as PlayerId, clubId: 'club_0' as ClubId, from: 60, to: 50, reason: 'benched',
    }, { id: 'ev_m' });
    expect(analyticsForDomainEvent(morale)).toBeNull();
  });

  it('pipes a batch through the sink', () => {
    const seen = collector();
    trackDomainEvents([
      makeTestEvent('MATCH_STARTED', {
        matchId: 'm1' as MatchId, homeClubId: 'club_0' as ClubId, awayClubId: 'club_1' as ClubId,
      }, { id: 'ev_s' }),
      makeTestEvent('PLAYER_MORALE_CHANGED', {
        playerId: 'p_0_1' as PlayerId, clubId: 'club_0' as ClubId, from: 60, to: 50, reason: 'benched',
      }, { id: 'ev_m2' }),
    ]);
    expect(seen.map((e) => e.name)).toEqual(['match_started']);
  });
});

describe('churn signals', () => {
  it('flags a stalled, losing, unhappy save', () => {
    const seen = collector();
    const reasons = evaluateChurnRisk({
      cyclesSinceProgress: 4, consecutiveDefeats: 5, fanSentiment: 18, sessionSeconds: 90,
    });
    expect(reasons).toContain('stalled_progress');
    expect(reasons).toContain('losing_streak');
    expect(reasons).toContain('fan_sentiment_collapse');
    expect(seen[0]?.name).toBe('churn_risk_flagged');
  });

  it('stays quiet for a healthy save', () => {
    const seen = collector();
    expect(evaluateChurnRisk({
      cyclesSinceProgress: 0, consecutiveDefeats: 1, fanSentiment: 70, sessionSeconds: 600,
    })).toEqual([]);
    expect(seen).toHaveLength(0);
  });
});
