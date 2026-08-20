import type { ClubId, EventId, PlayerId, RivalryId } from '../core/brand';
import type {
  AnyDomainEvent, DomainEvent, DomainEventPayloads, DomainEventType, EntityRef, EventImportance,
} from '../core/events';
import type { GameState } from '../game/state';
import { formatMoney } from '../economy/ledger';
import { clamp } from '../core/math';
import { fanReactionMultiplier, rivalryFor, rivalryKey } from '../rivalries/rivalries';
import { CASCADE_BALANCE as C } from './balance';
import {
  clubToken, personToken,
  type ClubToken, type ContentHook, type HookFacts, type PersonToken, type SocialPostKind,
  type PlainToken, type TokenMap,
} from './ports';
import { ordinal, sentimentBand } from './templating';

/**
 * The cascade.
 *
 * This is the mechanism that turns a simulation into a story. A single domain
 * event does not map to a single post; it opens a chain. A red card suspends a
 * player, which knocks his morale, which angers the fans, which the press write
 * up, which a rival creator dunks on, which raises the rivalry's temperature,
 * which produces a *different* story next cycle about the suspension he is
 * serving. Each link is itself an event, so each link can spawn its own links.
 *
 * Three properties make this safe:
 *  - Derived event ids are a pure function of their source (`<source>~<rule>`),
 *    so running the cascade twice over the same inputs is idempotent.
 *  - Depth and node budgets stop a chaotic matchday from melting the feed.
 *  - Follow-ups are *derived from the event log* rather than stored, so the
 *    frozen GameState needs no new field and a reloaded save behaves the same.
 */

export type CascadeEffectKind =
  | 'SUSPENSION' | 'MORALE' | 'FAN_SENTIMENT' | 'FAN_EXCITEMENT' | 'RIVALRY'
  | 'REPUTATION' | 'PRESSURE' | 'MEDIA' | 'SOCIAL' | 'FOLLOW_UP';

/** One traced link in a chain. Kept for tests, the debug view and the UI. */
export interface CascadeNode {
  readonly id: string;
  readonly kind: CascadeEffectKind;
  readonly label: string;
  readonly sourceEventId: EventId;
  readonly rootEventId: EventId;
  readonly depth: number;
}

/** A described change for the world tick to apply. Never applied in place here. */
export type WorldDelta =
  | { readonly kind: 'PLAYER_SUSPENSION'; readonly playerId: PlayerId; readonly matches: number; readonly reason: string }
  | { readonly kind: 'PLAYER_MORALE'; readonly playerId: PlayerId; readonly delta: number; readonly reason: string }
  | { readonly kind: 'SQUAD_MORALE'; readonly clubId: ClubId; readonly delta: number; readonly reason: string }
  | { readonly kind: 'FAN_SENTIMENT'; readonly clubId: ClubId; readonly delta: number; readonly reason: string }
  | { readonly kind: 'FAN_EXCITEMENT'; readonly clubId: ClubId; readonly delta: number; readonly reason: string }
  | { readonly kind: 'FAN_EXPECTATION'; readonly clubId: ClubId; readonly delta: number; readonly reason: string }
  | { readonly kind: 'CLUB_REPUTATION'; readonly clubId: ClubId; readonly delta: number; readonly reason: string }
  | { readonly kind: 'MANAGER_PRESSURE'; readonly clubId: ClubId; readonly delta: number; readonly reason: string }
  | { readonly kind: 'RIVALRY_INTENSITY'; readonly clubA: ClubId; readonly clubB: ClubId; readonly delta: number; readonly reason: string };

export interface CascadeResult {
  /** Events the cascade itself produced. The caller emits them on the bus. */
  readonly derivedEvents: readonly AnyDomainEvent[];
  readonly nodes: readonly CascadeNode[];
  readonly deltas: readonly WorldDelta[];
  readonly mediaHooks: readonly ContentHook[];
  readonly socialHooks: readonly ContentHook[];
  /** Chains keyed by root event id — "what did this red card actually cause?" */
  readonly chains: Readonly<Record<string, readonly CascadeNode[]>>;
}

export const EMPTY_CASCADE: CascadeResult = {
  derivedEvents: [], nodes: [], deltas: [], mediaHooks: [], socialHooks: [], chains: {},
};

interface CascadeCtx {
  readonly state: GameState;
  readonly cycle: number;
  readonly playerClubId: ClubId;
  readonly pressure: ReadonlyMap<string, number>;
  /**
   * Entity names come back *tagged*. A club name can then never be assigned to
   * a `{player}` slot without the compiler saying so, which is the fix for
   * "Northgate Rovers writes his name into the history of Northgate Rovers".
   */
  clubName(id: string | undefined): ClubToken;
  playerName(id: string | undefined): PersonToken;
  derbyHeat(a: ClubId | undefined, b: ClubId | undefined): number;
  /** Who the club was playing in this match, when the fixture is known. */
  opponentIn(matchId: string | undefined, clubId: ClubId): ClubId | undefined;
}

interface CascadeStep {
  readonly nodes?: readonly Omit<CascadeNode, 'rootEventId' | 'depth'>[];
  readonly deltas?: readonly WorldDelta[];
  readonly media?: readonly Partial<ContentHook>[];
  readonly social?: readonly Partial<ContentHook>[];
  readonly derived?: readonly AnyDomainEvent[];
}

type RuleFor<T extends DomainEventType> = (e: DomainEvent<T>, ctx: CascadeCtx) => CascadeStep | null;

// --- helpers ---------------------------------------------------------------

const derive = <T extends DomainEventType>(
  source: AnyDomainEvent,
  suffix: string,
  type: T,
  payload: DomainEventPayloads[T],
  importance: EventImportance,
  entities: readonly EntityRef[],
): AnyDomainEvent => ({
  id: `${source.id}~${suffix}` as EventId,
  type,
  payload,
  cycle: source.cycle,
  season: source.season,
  week: source.week,
  at: source.at,
  importance,
  entities,
  ...(source.matchId ? { matchId: source.matchId } : {}),
} as unknown as AnyDomainEvent);

const clubEntity = (ctx: CascadeCtx, id: string | undefined): EntityRef[] =>
  (id ? [{ kind: 'club' as const, id, name: ctx.clubName(id) }] : []);

const playerEntity = (ctx: CascadeCtx, id: string | undefined): EntityRef[] =>
  (id ? [{ kind: 'player' as const, id, name: ctx.playerName(id) }] : []);

/** Reach and attendance figures, short enough to sit inside a headline. */
const compactCount = (n: number): string => (
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000 ? `${Math.round(n / 1_000)}K`
      : String(Math.round(n))
);

/** Fill in the boilerplate every hook shares so rules stay readable. */
function completeHook(
  partial: Partial<ContentHook>,
  source: AnyDomainEvent,
  rootEventId: EventId,
  depth: number,
  cycle: number,
): ContentHook {
  const sentiment = partial.sentiment ?? 0;
  const importance = partial.importance ?? source.importance;
  const facts: HookFacts = {
    trigger: partial.trigger ?? source.type,
    importance,
    sentiment,
    sentimentBand: sentimentBand(sentiment),
    depth,
    ...(partial.facts ?? {}),
  };
  return {
    trigger: partial.trigger ?? source.type,
    sourceEventId: source.id,
    rootEventId,
    depth,
    importance,
    sentiment,
    tokens: partial.tokens ?? {},
    facts,
    entities: partial.entities ?? source.entities,
    ...(partial.clubId ? { clubId: partial.clubId } : {}),
    ...(partial.opponentClubId ? { opponentClubId: partial.opponentClubId } : {}),
    ...(partial.playerId ? { playerId: partial.playerId } : {}),
    ...(source.matchId ? { matchId: source.matchId } : {}),
    audiences: partial.audiences ?? ['MEDIA'],
    tags: partial.tags ?? [],
    cycle: partial.cycle ?? cycle,
  };
}

const FAN_ANGER: readonly SocialPostKind[] = ['FAN', 'RIVAL', 'CREATOR', 'MEDIA'];
const FAN_JOY: readonly SocialPostKind[] = ['FAN', 'CLUB', 'CREATOR', 'PLAYER', 'MEDIA'];

// --- rules -----------------------------------------------------------------

/**
 * The required cascade, in full. Everything downstream of a red card is here:
 * suspension, morale, fan anger, media, rival dunk, rivalry heat — and, via the
 * follow-up table below, a different story next cycle about serving the ban.
 */
const redCardRule: RuleFor<'RED_CARD'> = (e, ctx) => {
  const p = e.payload;
  // Prefer the real opponent in this fixture; fall back to the club's hottest
  // rivalry when the fixture is not in state (a friendly, or a replayed event).
  const opponent = ctx.opponentIn(p.matchId, p.clubId);
  const heat = ctx.derbyHeat(p.clubId, opponent);
  const isDerbyMoment = heat >= C.derby.intensityThreshold;
  const player = ctx.playerName(p.playerId);
  const club = ctx.clubName(p.clubId);
  const matches = C.redCard.suspensionMatches + (isDerbyMoment ? C.redCard.derbySuspensionBonus : 0);
  // Fan reaction scales continuously with rivalry temperature rather than
  // stepping at a threshold: a red card in a warm fixture stings proportionally.
  const fanDelta = C.redCard.fanSentiment * fanReactionMultiplier(heat);
  const tokens: TokenMap = { player, club, minute: p.minute, minuteOrdinal: ordinal(p.minute), matches };
  const facts: HookFacts = { minute: p.minute, derby: isDerbyMoment, matches, intensity: Math.round(heat) };
  const entities = [...playerEntity(ctx, p.playerId), ...clubEntity(ctx, p.clubId)];

  const rival = opponent ?? hottestRival(ctx, p.clubId);
  const derived: AnyDomainEvent[] = [
    derive(e, 'morale', 'PLAYER_MORALE_CHANGED', {
      playerId: p.playerId, clubId: p.clubId, from: 0, to: C.redCard.playerMorale, reason: 'sent off',
    }, 2, entities),
    derive(e, 'fans', 'FAN_SENTIMENT_CHANGED', {
      clubId: p.clubId, from: 0, to: fanDelta, reason: `${player} sent off`,
    }, 3, clubEntity(ctx, p.clubId)),
  ];
  if (rival) {
    derived.push(derive(e, 'rivalry', 'RIVALRY_INTENSIFIED', {
      rivalryId: rivalryKey(p.clubId, rival) as RivalryId,
      clubA: p.clubId, clubB: rival,
      intensity: C.redCard.rivalryIntensity,
      reason: `${player} saw red against ${ctx.clubName(rival)}`,
    }, 3, [...clubEntity(ctx, p.clubId), ...clubEntity(ctx, rival)]));
  }

  return {
    nodes: [
      { id: 'suspension', kind: 'SUSPENSION', label: `${player} banned for ${matches} match(es)`, sourceEventId: e.id },
      { id: 'morale', kind: 'MORALE', label: `${player} morale hit`, sourceEventId: e.id },
      { id: 'fans', kind: 'FAN_SENTIMENT', label: `${club} supporters furious`, sourceEventId: e.id },
    ],
    deltas: [
      { kind: 'PLAYER_SUSPENSION', playerId: p.playerId, matches, reason: 'Red card' },
      { kind: 'PLAYER_MORALE', playerId: p.playerId, delta: C.redCard.playerMorale, reason: 'Sent off' },
      { kind: 'SQUAD_MORALE', clubId: p.clubId, delta: C.redCard.squadMorale, reason: 'Team-mate sent off' },
      { kind: 'FAN_SENTIMENT', clubId: p.clubId, delta: fanDelta, reason: 'Red card' },
    ],
    media: [{
      trigger: 'RED_CARD', importance: (isDerbyMoment ? 5 : C.redCard.mediaImportance) as EventImportance,
      sentiment: -0.65, tokens, facts, entities, clubId: p.clubId, playerId: p.playerId,
      tags: ['discipline', 'match'],
    }],
    social: [{
      trigger: 'RED_CARD', importance: (isDerbyMoment ? 5 : 4) as EventImportance,
      sentiment: -0.7, tokens, facts, entities, clubId: p.clubId, playerId: p.playerId,
      audiences: FAN_ANGER, tags: ['discipline'],
    }],
    derived,
  };
};

const moraleRule: RuleFor<'PLAYER_MORALE_CHANGED'> = (e, ctx) => {
  const p = e.payload;
  const magnitude = Math.abs(p.to - p.from);
  if (magnitude < 10) return null;
  const player = ctx.playerName(p.playerId);
  return {
    nodes: [{ id: 'mood', kind: 'MORALE', label: `${player} mood shift`, sourceEventId: e.id }],
    social: [{
      trigger: p.to < p.from ? 'PLAYER_UNHAPPY' : 'PLAYER_LIFTED',
      importance: 2, sentiment: p.to < p.from ? -0.4 : 0.4,
      tokens: { player, club: ctx.clubName(p.clubId), reason: p.reason },
      facts: { reason: p.reason, magnitude: Math.round(magnitude) },
      entities: [...playerEntity(ctx, p.playerId), ...clubEntity(ctx, p.clubId)],
      clubId: p.clubId, playerId: p.playerId,
      audiences: ['LEAK', 'CREATOR', 'FAN'], tags: ['dressing-room'],
    }],
  };
};

const fanSentimentRule: RuleFor<'FAN_SENTIMENT_CHANGED'> = (e, ctx) => {
  const p = e.payload;
  const delta = p.to - p.from;
  if (Math.abs(delta) < 3) return null;
  const club = ctx.clubName(p.clubId);
  const negative = delta < 0;
  return {
    nodes: [{ id: 'mood', kind: 'FAN_SENTIMENT', label: `${club} fan mood ${negative ? 'sours' : 'lifts'}`, sourceEventId: e.id }],
    media: Math.abs(delta) >= 6 ? [{
      trigger: negative ? 'FAN_UNREST' : 'FAN_BUZZ', importance: 3,
      sentiment: negative ? -0.5 : 0.5,
      tokens: { club, reason: p.reason },
      facts: { reason: p.reason, magnitude: Math.round(Math.abs(delta)) },
      entities: clubEntity(ctx, p.clubId), clubId: p.clubId, tags: ['fans'],
    }] : [],
    social: [{
      trigger: negative ? 'FAN_UNREST' : 'FAN_BUZZ', importance: 2,
      sentiment: negative ? -0.6 : 0.6,
      tokens: { club, reason: p.reason },
      facts: { reason: p.reason, magnitude: Math.round(Math.abs(delta)) },
      entities: clubEntity(ctx, p.clubId), clubId: p.clubId,
      audiences: ['FAN', 'CREATOR'], tags: ['fans'],
    }],
  };
};

const rivalryRule: RuleFor<'RIVALRY_INTENSIFIED'> = (e, ctx) => {
  const p = e.payload;
  const a = ctx.clubName(p.clubA);
  const b = ctx.clubName(p.clubB);
  return {
    nodes: [{ id: 'heat', kind: 'RIVALRY', label: `${a} v ${b} temperature up`, sourceEventId: e.id }],
    deltas: [{ kind: 'RIVALRY_INTENSITY', clubA: p.clubA, clubB: p.clubB, delta: p.intensity, reason: p.reason }],
    media: [{
      trigger: 'RIVALRY_HEAT', importance: 3, sentiment: -0.2,
      tokens: { club: a, opponent: b, rival: b, reason: p.reason },
      facts: { reason: p.reason, intensity: p.intensity, derby: true },
      entities: [...clubEntity(ctx, p.clubA), ...clubEntity(ctx, p.clubB)],
      clubId: p.clubA, opponentClubId: p.clubB, tags: ['rivalry'],
    }],
    social: [{
      trigger: 'RIVALRY_HEAT', importance: 3, sentiment: -0.3,
      tokens: { club: a, opponent: b, rival: b, reason: p.reason },
      facts: { reason: p.reason, intensity: p.intensity, derby: true },
      entities: [...clubEntity(ctx, p.clubA), ...clubEntity(ctx, p.clubB)],
      clubId: p.clubA, opponentClubId: p.clubB,
      audiences: ['RIVAL', 'FAN', 'CREATOR'], tags: ['rivalry'],
    }],
  };
};

const signingRule: RuleFor<'PLAYER_SIGNED'> = (e, ctx) => {
  const p = e.payload;
  const club = ctx.state.clubs[p.clubId];
  const wageBudget = Math.max(1, club?.finance.wageBudgetPerCycle ?? 1);
  const marquee = p.fee >= wageBudget * C.marqueeSigning.feeToWageBudgetRatio;
  const player = ctx.playerName(p.playerId);
  const clubName = ctx.clubName(p.clubId);
  const tokens: TokenMap = { player, club: clubName, fee: formatMoney(p.fee), wage: formatMoney(p.wage) };
  const facts: HookFacts = { fee: p.fee, marquee, fromClub: p.fromClubId ?? 'free-agent' };
  const entities = [...playerEntity(ctx, p.playerId), ...clubEntity(ctx, p.clubId)];
  if (!marquee) {
    return {
      nodes: [{ id: 'signing', kind: 'SOCIAL', label: `${player} joins ${clubName}`, sourceEventId: e.id }],
      media: [{ trigger: 'SIGNING', importance: 2, sentiment: 0.3, tokens, facts, entities, clubId: p.clubId, playerId: p.playerId, tags: ['transfer'] }],
      social: [{
        trigger: 'SIGNING', importance: 2, sentiment: 0.35, tokens, facts, entities,
        clubId: p.clubId, playerId: p.playerId,
        audiences: ['CLUB', 'FAN', 'MEDIA', 'CREATOR'], tags: ['transfer'],
      }],
    };
  }
  return {
    nodes: [
      { id: 'marquee', kind: 'MEDIA', label: `${clubName} land ${player}`, sourceEventId: e.id },
      { id: 'excitement', kind: 'FAN_EXCITEMENT', label: `${clubName} supporters buzzing`, sourceEventId: e.id },
      { id: 'expectation', kind: 'PRESSURE', label: 'Expectation rises with the fee', sourceEventId: e.id },
    ],
    deltas: [
      { kind: 'FAN_EXCITEMENT', clubId: p.clubId, delta: C.marqueeSigning.fanExcitement, reason: `Signed ${player}` },
      { kind: 'FAN_EXPECTATION', clubId: p.clubId, delta: C.marqueeSigning.fanExpectation, reason: 'Marquee signing' },
      { kind: 'CLUB_REPUTATION', clubId: p.clubId, delta: C.marqueeSigning.reputation, reason: 'Marquee signing' },
    ],
    media: [{
      trigger: 'MARQUEE_SIGNING', importance: C.marqueeSigning.mediaImportance as EventImportance,
      sentiment: 0.55, tokens, facts, entities, clubId: p.clubId, playerId: p.playerId, tags: ['transfer', 'marquee'],
    }],
    social: [{
      trigger: 'MARQUEE_SIGNING', importance: C.marqueeSigning.mediaImportance as EventImportance,
      sentiment: 0.6, tokens, facts, entities, clubId: p.clubId, playerId: p.playerId,
      audiences: ['CLUB', 'FAN', 'CREATOR', 'SPONSOR', 'RIVAL'], tags: ['transfer', 'marquee'],
    }],
    derived: [derive(e, 'fans', 'FAN_SENTIMENT_CHANGED', {
      clubId: p.clubId, from: 0, to: C.marqueeSigning.fanSentiment, reason: `Signed ${player}`,
    }, 3, clubEntity(ctx, p.clubId))],
  };
};

const matchLostRule: RuleFor<'MATCH_LOST'> = (e, ctx) => {
  const p = e.payload;
  const club = ctx.state.clubs[p.clubId];
  const opponent = ctx.state.clubs[p.opponentId];
  const heat = ctx.derbyHeat(p.clubId, p.opponentId);
  const isDerbyMoment = heat >= C.derby.intensityThreshold;
  const repGap = (club?.reputation ?? 50) - (opponent?.reputation ?? 50);
  const shock = p.margin >= C.shockDefeat.marginThreshold || repGap >= C.shockDefeat.reputationGap;
  const clubName = ctx.clubName(p.clubId);
  const oppName = ctx.clubName(p.opponentId);
  const score = `${p.homeScore}-${p.awayScore}`;
  const tokens: TokenMap = { club: clubName, opponent: oppName, rival: oppName, score, margin: p.margin };
  const facts: HookFacts = { margin: p.margin, derby: isDerbyMoment, shock, intensity: Math.round(heat), result: 'LOSS' };
  const entities = [...clubEntity(ctx, p.clubId), ...clubEntity(ctx, p.opponentId)];
  const fanDelta = (shock ? C.shockDefeat.fanSentiment : C.shockDefeat.fanSentiment / 2)
    * fanReactionMultiplier(heat);

  const derived: AnyDomainEvent[] = [
    derive(e, 'fans', 'FAN_SENTIMENT_CHANGED', {
      clubId: p.clubId, from: 0, to: fanDelta, reason: `Lost ${score} to ${oppName}`,
    }, shock ? 3 : 2, clubEntity(ctx, p.clubId)),
  ];
  if (isDerbyMoment) {
    derived.push(derive(e, 'rivalry', 'RIVALRY_INTENSIFIED', {
      rivalryId: rivalryKey(p.clubId, p.opponentId) as RivalryId,
      clubA: p.clubId, clubB: p.opponentId,
      intensity: C.derby.rivalryLossBump,
      reason: `${oppName} won the derby ${score}`,
    }, 3, entities));
  }

  return {
    nodes: [
      { id: shock ? 'shock' : 'defeat', kind: 'MEDIA', label: `${clubName} beaten ${score}`, sourceEventId: e.id },
      { id: 'pressure', kind: 'PRESSURE', label: 'Pressure on the manager rises', sourceEventId: e.id },
    ],
    deltas: [
      { kind: 'FAN_SENTIMENT', clubId: p.clubId, delta: fanDelta, reason: 'Defeat' },
      { kind: 'SQUAD_MORALE', clubId: p.clubId, delta: shock ? C.shockDefeat.squadMorale : C.shockDefeat.squadMorale / 2, reason: 'Defeat' },
      { kind: 'MANAGER_PRESSURE', clubId: p.clubId, delta: shock ? C.shockDefeat.managerPressure : C.shockDefeat.managerPressure / 3, reason: 'Defeat' },
    ],
    media: [{
      trigger: shock ? 'SHOCK_DEFEAT' : isDerbyMoment ? 'DERBY_DEFEAT' : 'DEFEAT',
      importance: (shock ? C.shockDefeat.mediaImportance : isDerbyMoment ? 3 : 2) as EventImportance,
      sentiment: shock ? -0.75 : -0.4, tokens, facts, entities,
      clubId: p.clubId, opponentClubId: p.opponentId, tags: ['match', 'result'],
    }],
    social: [{
      trigger: shock ? 'SHOCK_DEFEAT' : isDerbyMoment ? 'DERBY_DEFEAT' : 'DEFEAT',
      importance: (shock ? 4 : isDerbyMoment ? 4 : 2) as EventImportance,
      sentiment: shock ? -0.8 : -0.45, tokens, facts, entities,
      clubId: p.clubId, opponentClubId: p.opponentId,
      audiences: FAN_ANGER, tags: ['match', 'result'],
    }],
    derived,
  };
};

const matchWonRule: RuleFor<'MATCH_WON'> = (e, ctx) => {
  const p = e.payload;
  const heat = ctx.derbyHeat(p.clubId, p.opponentId);
  const isDerbyMoment = heat >= C.derby.intensityThreshold;
  const big = p.margin >= C.bigWin.marginThreshold;
  const clubName = ctx.clubName(p.clubId);
  const oppName = ctx.clubName(p.opponentId);
  const score = `${p.homeScore}-${p.awayScore}`;
  const tokens: TokenMap = { club: clubName, opponent: oppName, rival: oppName, score, margin: p.margin };
  const facts: HookFacts = { margin: p.margin, derby: isDerbyMoment, big, intensity: Math.round(heat), result: 'WIN' };
  const entities = [...clubEntity(ctx, p.clubId), ...clubEntity(ctx, p.opponentId)];
  const fanDelta = C.bigWin.fanSentiment * (big ? 1.4 : 1) * fanReactionMultiplier(heat);

  const derived: AnyDomainEvent[] = [
    derive(e, 'fans', 'FAN_SENTIMENT_CHANGED', {
      clubId: p.clubId, from: 0, to: fanDelta, reason: `Beat ${oppName} ${score}`,
    }, big || isDerbyMoment ? 3 : 2, clubEntity(ctx, p.clubId)),
  ];
  if (isDerbyMoment) {
    derived.push(derive(e, 'rivalry', 'RIVALRY_INTENSIFIED', {
      rivalryId: rivalryKey(p.clubId, p.opponentId) as RivalryId,
      clubA: p.clubId, clubB: p.opponentId,
      intensity: C.derby.rivalryWinBump + (big ? 3 : 0),
      reason: `${clubName} took the derby ${score}`,
    }, 3, entities));
  }

  return {
    nodes: [{ id: big ? 'statement' : 'win', kind: 'MEDIA', label: `${clubName} win ${score}`, sourceEventId: e.id }],
    deltas: [
      { kind: 'FAN_SENTIMENT', clubId: p.clubId, delta: fanDelta, reason: 'Win' },
      { kind: 'SQUAD_MORALE', clubId: p.clubId, delta: C.bigWin.squadMorale, reason: 'Win' },
      { kind: 'MANAGER_PRESSURE', clubId: p.clubId, delta: C.bigWin.managerPressure, reason: 'Win' },
      ...(big ? [{ kind: 'CLUB_REPUTATION' as const, clubId: p.clubId, delta: C.bigWin.reputation, reason: 'Statement win' }] : []),
    ],
    media: [{
      trigger: isDerbyMoment ? 'DERBY_WIN' : big ? 'STATEMENT_WIN' : 'WIN',
      // The derby and rout bonuses are added by the media engine's stakes pass;
      // the base is what the result would be worth on a normal weekend.
      importance: (isDerbyMoment ? 3 : big ? 3 : 2) as EventImportance,
      sentiment: 0.6, tokens, facts, entities,
      clubId: p.clubId, opponentClubId: p.opponentId, tags: ['match', 'result'],
    }],
    social: [{
      trigger: isDerbyMoment ? 'DERBY_WIN' : big ? 'STATEMENT_WIN' : 'WIN',
      importance: (isDerbyMoment ? 4 : big ? 3 : 2) as EventImportance,
      sentiment: 0.7, tokens, facts, entities,
      clubId: p.clubId, opponentClubId: p.opponentId,
      audiences: FAN_JOY, tags: ['match', 'result'],
    }],
    derived,
  };
};

const breakoutRule: RuleFor<'PLAYER_BREAKOUT'> = (e, ctx) => {
  const p = e.payload;
  const player = ctx.playerName(p.playerId);
  const clubName = ctx.clubName(p.clubId);
  const tokens: TokenMap = { player, club: clubName, overall: p.overall };
  const facts: HookFacts = { overall: p.overall, age: ctx.state.players[p.playerId]?.age ?? 0 };
  const entities = [...playerEntity(ctx, p.playerId), ...clubEntity(ctx, p.clubId)];
  return {
    nodes: [
      { id: 'breakout', kind: 'MEDIA', label: `${player} breaks through`, sourceEventId: e.id },
      { id: 'buzz', kind: 'FAN_EXCITEMENT', label: `${clubName} fans excited`, sourceEventId: e.id },
    ],
    deltas: [
      { kind: 'FAN_EXCITEMENT', clubId: p.clubId, delta: C.breakout.fanExcitement, reason: `${player} breakout` },
      { kind: 'CLUB_REPUTATION', clubId: p.clubId, delta: C.breakout.reputation, reason: 'Academy graduate impresses' },
      { kind: 'PLAYER_MORALE', playerId: p.playerId, delta: 6, reason: 'Breakout form' },
    ],
    media: [{
      trigger: 'WONDERKID', importance: C.breakout.mediaImportance as EventImportance, sentiment: 0.6,
      tokens, facts, entities, clubId: p.clubId, playerId: p.playerId, tags: ['youth', 'breakout'],
    }],
    social: [{
      trigger: 'WONDERKID', importance: C.breakout.mediaImportance as EventImportance, sentiment: 0.7,
      tokens, facts, entities, clubId: p.clubId, playerId: p.playerId,
      audiences: ['FAN', 'CREATOR', 'CLUB', 'LEAK'], tags: ['youth', 'breakout'],
    }],
  };
};

const injuryRule: RuleFor<'PLAYER_INJURED'> = (e, ctx) => {
  const p = e.payload;
  const player = ctx.playerName(p.playerId);
  const clubName = ctx.clubName(p.clubId);
  const newsworthy = p.weeksOut >= C.injury.newsworthyWeeks;
  const tokens: TokenMap = { player, club: clubName, weeks: p.weeksOut, severity: p.severity };
  const facts: HookFacts = { weeksOut: p.weeksOut, severity: p.severity };
  const entities = [...playerEntity(ctx, p.playerId), ...clubEntity(ctx, p.clubId)];
  return {
    nodes: [{ id: 'injury', kind: 'MORALE', label: `${player} out ${p.weeksOut} weeks`, sourceEventId: e.id }],
    deltas: [
      { kind: 'PLAYER_MORALE', playerId: p.playerId, delta: C.injury.playerMorale, reason: 'Injured' },
      { kind: 'SQUAD_MORALE', clubId: p.clubId, delta: C.injury.squadMorale, reason: 'Injury blow' },
      ...(newsworthy ? [{ kind: 'FAN_SENTIMENT' as const, clubId: p.clubId, delta: C.injury.fanSentiment, reason: 'Injury blow' }] : []),
    ],
    media: newsworthy ? [{
      trigger: 'INJURY_BLOW', importance: 3 as EventImportance, sentiment: -0.5,
      tokens, facts, entities, clubId: p.clubId, playerId: p.playerId, tags: ['injury'],
    }] : [],
    social: [{
      trigger: 'INJURY_BLOW', importance: (newsworthy ? 3 : 2) as EventImportance, sentiment: -0.5,
      tokens, facts, entities, clubId: p.clubId, playerId: p.playerId,
      audiences: ['FAN', 'CLUB', 'CREATOR', 'MEDIA'], tags: ['injury'],
    }],
  };
};

const recordRule: RuleFor<'RECORD_BROKEN'> = (e, ctx) => {
  const p = e.payload;
  const clubName = ctx.clubName(p.clubId);
  // A club record has no person in it. Filling `{player}` with the club name
  // produced "Cinderwick Town writes his name into the history of Cinderwick
  // Town"; leaving the token absent instead makes player-shaped templates
  // unrenderable for a club record, which is the correct outcome — `subject`
  // lets the pack pick a club-shaped line deliberately.
  const holder = p.holderId ? ctx.playerName(p.holderId) : null;
  // How long the record it replaced had actually stood. Zero means there was no
  // previous holder at all — a first entry in the book, which is a very
  // different sentence from a mark that survived a generation.
  const previous = ctx.state.legacy.records[p.record];
  const recordAgeSeasons = previous ? Math.max(0, ctx.state.clock.season - previous.season) : 0;
  const tokens: TokenMap = {
    club: clubName, record: p.record, value: p.value,
    ...(holder ? { player: holder } : {}),
    subject: holder ?? clubName,
    ...(recordAgeSeasons > 0 ? { recordAge: recordAgeSeasons } : {}),
  };
  const facts: HookFacts = {
    record: p.record,
    value: p.value,
    subjectKind: holder ? 'PLAYER' : 'CLUB',
    hadPreviousHolder: previous !== undefined,
    recordAgeSeasons,
  };
  const entities = [...clubEntity(ctx, p.clubId), ...playerEntity(ctx, p.holderId)];
  return {
    nodes: [{ id: 'record', kind: 'MEDIA', label: `${p.record} record broken`, sourceEventId: e.id }],
    deltas: [
      { kind: 'FAN_SENTIMENT', clubId: p.clubId, delta: C.record.fanSentiment, reason: 'Club record broken' },
      ...(p.holderId ? [{ kind: 'PLAYER_MORALE' as const, playerId: p.holderId, delta: 8, reason: 'Record broken' }] : []),
    ],
    media: [{
      trigger: 'RECORD_BROKEN', importance: C.record.mediaImportance as EventImportance, sentiment: 0.8,
      tokens, facts, entities, clubId: p.clubId, ...(p.holderId ? { playerId: p.holderId } : {}), tags: ['record', 'history'],
    }],
    social: [{
      trigger: 'RECORD_BROKEN', importance: C.record.mediaImportance as EventImportance, sentiment: 0.85,
      tokens, facts, entities, clubId: p.clubId, ...(p.holderId ? { playerId: p.holderId } : {}),
      audiences: ['CLUB', 'FAN', 'CREATOR', 'MEDIA', 'SPONSOR'], tags: ['record', 'history'],
    }],
  };
};

const hijackRule: RuleFor<'TRANSFER_HIJACKED'> = (e, ctx) => {
  const p = e.payload;
  const thief = ctx.clubName(p.byClubId);
  const victim = ctx.clubName(p.fromClubId);
  const player = ctx.playerName(p.playerId);
  const entities = [...playerEntity(ctx, p.playerId), ...clubEntity(ctx, p.byClubId), ...clubEntity(ctx, p.fromClubId)];
  return {
    nodes: [{ id: 'hijack', kind: 'RIVALRY', label: `${thief} hijack ${player}`, sourceEventId: e.id }],
    media: [{
      trigger: 'TRANSFER_HIJACK', importance: 4, sentiment: -0.5,
      tokens: { player, club: victim, opponent: thief, rival: thief },
      facts: { hijack: true }, entities, clubId: p.fromClubId, opponentClubId: p.byClubId, tags: ['transfer', 'rivalry'],
    }],
    social: [{
      trigger: 'TRANSFER_HIJACK', importance: 4, sentiment: -0.6,
      tokens: { player, club: victim, opponent: thief, rival: thief },
      facts: { hijack: true }, entities, clubId: p.fromClubId, opponentClubId: p.byClubId,
      audiences: ['RIVAL', 'FAN', 'LEAK', 'CREATOR'], tags: ['transfer', 'rivalry'],
    }],
    derived: [derive(e, 'rivalry', 'RIVALRY_INTENSIFIED', {
      rivalryId: rivalryKey(p.fromClubId, p.byClubId) as RivalryId,
      clubA: p.fromClubId, clubB: p.byClubId, intensity: 4,
      reason: `${thief} hijacked the ${player} deal`,
    }, 3, entities)],
  };
};

const goalRule: RuleFor<'GOAL_SCORED'> = (e, ctx) => {
  const p = e.payload;
  const scorer = ctx.playerName(p.scorerId);
  const clubName = ctx.clubName(p.clubId);
  const late = p.minute >= 25;
  const entities = [...playerEntity(ctx, p.scorerId), ...clubEntity(ctx, p.clubId)];
  return {
    nodes: [{ id: 'goal', kind: 'SOCIAL', label: `${scorer} scores`, sourceEventId: e.id }],
    social: [{
      trigger: p.special ? 'SPECIAL_GOAL' : 'GOAL', importance: (p.special ? 3 : 2) as EventImportance,
      sentiment: 0.7,
      tokens: { player: scorer, club: clubName, minute: p.minute, minuteOrdinal: ordinal(p.minute), score: `${p.homeScore}-${p.awayScore}` },
      facts: { minute: p.minute, late, special: p.special ?? 'none' },
      entities, clubId: p.clubId, playerId: p.scorerId,
      audiences: ['FAN', 'CLUB', 'CREATOR', 'PLAYER', 'MEDIA'], tags: ['goal'],
    }],
  };
};

const trophyRule: RuleFor<'TROPHY_WON'> = (e, ctx) => {
  const p = e.payload;
  const clubName = ctx.clubName(p.clubId);
  const entities = clubEntity(ctx, p.clubId);
  const tokens: TokenMap = { club: clubName, competition: p.competition, season: p.season };
  return {
    nodes: [{ id: 'trophy', kind: 'MEDIA', label: `${clubName} win ${p.competition}`, sourceEventId: e.id }],
    deltas: [
      { kind: 'FAN_SENTIMENT', clubId: p.clubId, delta: 15, reason: 'Trophy won' },
      { kind: 'CLUB_REPUTATION', clubId: p.clubId, delta: 6, reason: 'Trophy won' },
      { kind: 'SQUAD_MORALE', clubId: p.clubId, delta: 12, reason: 'Trophy won' },
    ],
    media: [{ trigger: 'TROPHY_WON', importance: 5, sentiment: 0.95, tokens, facts: { competition: p.competition }, entities, clubId: p.clubId, tags: ['trophy', 'history'] }],
    social: [{
      trigger: 'TROPHY_WON', importance: 5, sentiment: 0.95, tokens, facts: { competition: p.competition },
      entities, clubId: p.clubId, audiences: ['CLUB', 'FAN', 'CREATOR', 'PLAYER', 'SPONSOR', 'MEDIA'], tags: ['trophy'],
    }],
  };
};

const sackRule: RuleFor<'MANAGER_SACKED'> = (e, ctx) => {
  const p = e.payload;
  const clubName = ctx.clubName(p.clubId);
  const entities = clubEntity(ctx, p.clubId);
  return {
    nodes: [{ id: 'sack', kind: 'MEDIA', label: `${p.managerName} leaves ${clubName}`, sourceEventId: e.id }],
    deltas: [{ kind: 'FAN_SENTIMENT', clubId: p.clubId, delta: 2, reason: 'Change at the top' }],
    media: [{ trigger: 'MANAGER_SACKED', importance: 5, sentiment: -0.4, tokens: { club: clubName, manager: personToken(p.managerName) }, facts: {}, entities, clubId: p.clubId, tags: ['manager'] }],
    social: [{
      trigger: 'MANAGER_SACKED', importance: 4, sentiment: -0.3,
      tokens: { club: clubName, manager: personToken(p.managerName) }, facts: {}, entities, clubId: p.clubId,
      audiences: ['MEDIA', 'FAN', 'RIVAL', 'CREATOR'], tags: ['manager'],
    }],
  };
};

const sponsorRule: RuleFor<'SPONSOR_SIGNED'> = (e, ctx) => {
  const p = e.payload;
  const clubName = ctx.clubName(p.clubId);
  const sponsorName = ctx.state.sponsors.active.find((d) => d.sponsorId === p.sponsorId)?.name ?? null;
  return {
    nodes: [{ id: 'sponsor', kind: 'SOCIAL', label: `${clubName} sign a sponsor`, sourceEventId: e.id }],
    social: [{
      trigger: 'SPONSOR_SIGNED', importance: 3, sentiment: 0.4,
      tokens: {
        club: clubName, value: formatMoney(p.value), amount: formatMoney(p.value),
        // Only the player's club has a named deal on the save. For an AI club
        // the signing is real but the brand is not modelled, so the token is
        // left absent and `{sponsor}` lines simply do not render — never a
        // made-up name.
        ...(sponsorName ? { sponsor: sponsorName } : {}),
      },
      facts: { value: p.value, named: sponsorName !== null },
      entities: clubEntity(ctx, p.clubId), clubId: p.clubId,
      audiences: ['SPONSOR', 'CLUB', 'FAN'], tags: ['commercial'],
    }],
  };
};

const creatorJoinRule: RuleFor<'CREATOR_JOINED'> = (e, ctx) => {
  const p = e.payload;
  const creator = ctx.state.creators[p.creatorId];
  const clubName = ctx.clubName(p.clubId);
  if (!creator) return null;
  const entities: EntityRef[] = [
    { kind: 'creator', id: creator.id, name: creator.displayName },
    ...clubEntity(ctx, p.clubId),
  ];
  return {
    nodes: [{ id: 'creator', kind: 'SOCIAL', label: `${creator.displayName} joins ${clubName}`, sourceEventId: e.id }],
    deltas: [{ kind: 'FAN_EXCITEMENT', clubId: p.clubId, delta: 4, reason: 'Creator signing' }],
    media: [{
      trigger: 'CREATOR_JOINED', importance: 3, sentiment: 0.5,
      tokens: { creator: personToken(creator.displayName), club: clubName, role: p.role },
      facts: { tier: creator.tier, role: p.role }, entities, clubId: p.clubId, tags: ['creator'],
    }],
    social: [{
      trigger: 'CREATOR_JOINED', importance: 3, sentiment: 0.6,
      tokens: { creator: personToken(creator.displayName), club: clubName, role: p.role },
      facts: { tier: creator.tier, role: p.role }, entities, clubId: p.clubId,
      audiences: ['CREATOR', 'CLUB', 'FAN'], tags: ['creator'],
    }],
  };
};


// --- the rest of the world's news ------------------------------------------

/**
 * Below this line are the rules for the *ordinary* week: a draw, a squad
 * player sold, a contract signed, a facility finished, a prospect promoted.
 *
 * They exist because an audit found that 85% of the authored library never
 * reached a player. The cause was not the writing and not the selector — it
 * was that two thirds of the events the world actually emits had no cascade
 * rule at all, so they produced no hook, so no template could ever be chosen
 * for them however good it was. Each rule here is small on purpose: low
 * importance, a narrow audience, no world deltas unless the moment earns one.
 * The point is coverage, not volume.
 */

const matchDrawnRule: RuleFor<'MATCH_DRAWN'> = (e, ctx) => {
  const p = e.payload;
  const club = ctx.clubName(p.clubId);
  const opponent = ctx.clubName(p.opponentId);
  const heat = ctx.derbyHeat(p.clubId, p.opponentId);
  const isDerbyMoment = heat >= C.derby.intensityThreshold;
  const tokens: TokenMap = { club, opponent, score: `${p.score}-${p.score}` };
  const facts: HookFacts = { derby: isDerbyMoment, score: p.score, intensity: Math.round(heat) };
  const entities = [...clubEntity(ctx, p.clubId), ...clubEntity(ctx, p.opponentId)];
  return {
    nodes: [{ id: 'draw', kind: 'MEDIA', label: `${club} draw with ${opponent}`, sourceEventId: e.id }],
    media: [{
      trigger: 'MATCH_DRAWN', importance: (isDerbyMoment ? 3 : 2) as EventImportance, sentiment: 0,
      tokens, facts, entities, clubId: p.clubId, opponentClubId: p.opponentId, tags: ['match'],
    }],
    social: [{
      trigger: 'MATCH_DRAWN', importance: (isDerbyMoment ? 3 : 2) as EventImportance, sentiment: 0,
      tokens, facts, entities, clubId: p.clubId, opponentClubId: p.opponentId,
      audiences: ['FAN', 'MEDIA', 'CREATOR'], tags: ['match'],
    }],
  };
};

const playerSoldRule: RuleFor<'PLAYER_SOLD'> = (e, ctx) => {
  const p = e.payload;
  const player = ctx.playerName(p.playerId);
  const from = ctx.clubName(p.fromClubId);
  const to = ctx.clubName(p.toClubId);
  const seller = ctx.state.clubs[p.fromClubId];
  // A club losing a player it rated is a story; clearing a fringe contract is not.
  const wageBudget = Math.max(1, seller?.finance.wageBudgetPerCycle ?? 1);
  const big = p.fee >= wageBudget * C.playerSold.feeToWageBudgetRatio;
  const tokens: TokenMap = { player, club: from, opponent: to, buyer: to, fee: formatMoney(p.fee) };
  const facts: HookFacts = { fee: p.fee, big };
  const entities = [
    ...playerEntity(ctx, p.playerId), ...clubEntity(ctx, p.fromClubId), ...clubEntity(ctx, p.toClubId),
  ];
  return {
    nodes: [{ id: 'sale', kind: 'SOCIAL', label: `${from} sell ${player}`, sourceEventId: e.id }],
    deltas: big
      ? [
        { kind: 'FAN_SENTIMENT', clubId: p.fromClubId, delta: C.playerSold.fanSentiment, reason: `${player} sold` },
        { kind: 'SQUAD_MORALE', clubId: p.fromClubId, delta: C.playerSold.squadMorale, reason: 'Key player sold' },
      ]
      : [],
    media: [{
      trigger: 'PLAYER_SOLD', importance: (big ? 3 : 2) as EventImportance, sentiment: big ? -0.3 : 0.05,
      tokens, facts, entities, clubId: p.fromClubId, opponentClubId: p.toClubId, playerId: p.playerId,
      tags: ['transfer'],
    }],
    social: [{
      trigger: 'PLAYER_SOLD', importance: (big ? 3 : 2) as EventImportance, sentiment: big ? -0.4 : 0,
      tokens, facts, entities, clubId: p.fromClubId, opponentClubId: p.toClubId, playerId: p.playerId,
      audiences: big ? ['FAN', 'MEDIA', 'PLAYER', 'CLUB'] : ['CLUB', 'MEDIA', 'FAN', 'PLAYER'],
      tags: ['transfer'],
    }],
  };
};

const motmRule: RuleFor<'MOTM_AWARDED'> = (e, ctx) => {
  const p = e.payload;
  const player = ctx.playerName(p.playerId);
  const club = ctx.clubName(p.clubId);
  const tokens: TokenMap = { player, club, rating: p.rating.toFixed(1) };
  const facts: HookFacts = { rating: p.rating };
  const entities = [...playerEntity(ctx, p.playerId), ...clubEntity(ctx, p.clubId)];
  return {
    nodes: [{ id: 'motm', kind: 'SOCIAL', label: `${player} man of the match`, sourceEventId: e.id }],
    deltas: [{ kind: 'PLAYER_MORALE', playerId: p.playerId, delta: C.motm.playerMorale, reason: 'Man of the match' }],
    media: [{
      trigger: 'MOTM_AWARDED', importance: 2, sentiment: 0.5,
      tokens, facts, entities, clubId: p.clubId, playerId: p.playerId, tags: ['match', 'rating'],
    }],
    social: [{
      trigger: 'MOTM_AWARDED', importance: 2, sentiment: 0.6,
      tokens, facts, entities, clubId: p.clubId, playerId: p.playerId,
      audiences: ['FAN', 'CLUB', 'CREATOR'], tags: ['match', 'rating'],
    }],
  };
};

const contractSignedRule: RuleFor<'CONTRACT_SIGNED'> = (e, ctx) => {
  const p = e.payload;
  const player = ctx.playerName(p.playerId);
  const club = ctx.clubName(p.clubId);
  const tokens: TokenMap = { player, club, years: p.years, wage: formatMoney(p.wage) };
  const facts: HookFacts = { years: p.years, wage: p.wage };
  const entities = [...playerEntity(ctx, p.playerId), ...clubEntity(ctx, p.clubId)];
  return {
    nodes: [{ id: 'contract', kind: 'SOCIAL', label: `${player} signs on`, sourceEventId: e.id }],
    media: [{
      trigger: 'CONTRACT_SIGNED', importance: 2, sentiment: 0.4,
      tokens, facts, entities, clubId: p.clubId, playerId: p.playerId, tags: ['contract'],
    }],
    social: [{
      trigger: 'CONTRACT_SIGNED', importance: 2, sentiment: 0.5,
      tokens, facts, entities, clubId: p.clubId, playerId: p.playerId,
      audiences: ['CLUB', 'FAN'], tags: ['contract'],
    }],
  };
};

const contractExpiringRule: RuleFor<'CONTRACT_EXPIRING'> = (e, ctx) => {
  const p = e.payload;
  const player = ctx.playerName(p.playerId);
  const club = ctx.clubName(p.clubId);
  const tokens: TokenMap = { player, club, weeks: p.weeksLeft };
  const facts: HookFacts = { weeksLeft: p.weeksLeft };
  const entities = [...playerEntity(ctx, p.playerId), ...clubEntity(ctx, p.clubId)];
  return {
    nodes: [{ id: 'expiring', kind: 'SOCIAL', label: `${player} running down his deal`, sourceEventId: e.id }],
    media: [{
      trigger: 'CONTRACT_EXPIRING', importance: 2, sentiment: -0.3,
      tokens, facts, entities, clubId: p.clubId, playerId: p.playerId, tags: ['contract'],
    }],
    social: [{
      trigger: 'CONTRACT_EXPIRING', importance: 2, sentiment: -0.35,
      tokens, facts, entities, clubId: p.clubId, playerId: p.playerId,
      audiences: ['LEAK', 'FAN'], tags: ['contract'],
    }],
  };
};

const facilityRule: RuleFor<'FACILITY_UPGRADED'> = (e, ctx) => {
  const p = e.payload;
  const club = ctx.clubName(p.clubId);
  const facility = String(p.facilityId).replace(/_/g, ' ');
  const tokens: TokenMap = { club, facility, level: p.level };
  const facts: HookFacts = { level: p.level, facility };
  return {
    nodes: [{ id: 'facility', kind: 'SOCIAL', label: `${club} upgrade the ${facility}`, sourceEventId: e.id }],
    media: [{
      trigger: 'FACILITY_UPGRADED', importance: 2, sentiment: 0.35,
      tokens, facts, entities: clubEntity(ctx, p.clubId), clubId: p.clubId, tags: ['facility'],
    }],
    social: [{
      trigger: 'FACILITY_UPGRADED', importance: 2, sentiment: 0.4,
      tokens, facts, entities: clubEntity(ctx, p.clubId), clubId: p.clubId,
      audiences: ['CLUB', 'FAN'], tags: ['facility'],
    }],
  };
};

const recoveredRule: RuleFor<'PLAYER_RECOVERED'> = (e, ctx) => {
  const p = e.payload;
  const player = ctx.playerName(p.playerId);
  const club = ctx.clubName(p.clubId);
  const tokens: TokenMap = { player, club };
  const entities = [...playerEntity(ctx, p.playerId), ...clubEntity(ctx, p.clubId)];
  return {
    nodes: [{ id: 'recovered', kind: 'MORALE', label: `${player} back in training`, sourceEventId: e.id }],
    deltas: [{ kind: 'PLAYER_MORALE', playerId: p.playerId, delta: C.recovery.playerMorale, reason: 'Back in training' }],
    media: [{
      trigger: 'PLAYER_RECOVERED', importance: 2, sentiment: 0.4,
      tokens, facts: {}, entities, clubId: p.clubId, playerId: p.playerId, tags: ['injury'],
    }],
    social: [{
      trigger: 'PLAYER_RECOVERED', importance: 2, sentiment: 0.45,
      tokens, facts: {}, entities, clubId: p.clubId, playerId: p.playerId,
      audiences: ['CLUB', 'FAN'], tags: ['injury'],
    }],
  };
};

const releasedRule: RuleFor<'PLAYER_RELEASED'> = (e, ctx) => {
  const p = e.payload;
  const player = ctx.playerName(p.playerId);
  const club = ctx.clubName(p.clubId);
  const entities = [...playerEntity(ctx, p.playerId), ...clubEntity(ctx, p.clubId)];
  return {
    nodes: [{ id: 'released', kind: 'SOCIAL', label: `${club} release ${player}`, sourceEventId: e.id }],
    media: [{
      trigger: 'PLAYER_RELEASED', importance: 2, sentiment: -0.25,
      tokens: { player, club }, facts: {}, entities, clubId: p.clubId, playerId: p.playerId, tags: ['squad'],
    }],
    social: [{
      trigger: 'PLAYER_RELEASED', importance: 2, sentiment: -0.3,
      tokens: { player, club }, facts: {}, entities, clubId: p.clubId, playerId: p.playerId,
      audiences: ['FAN', 'PLAYER'], tags: ['squad'],
    }],
  };
};

const developedRule: RuleFor<'PLAYER_DEVELOPED'> = (e, ctx) => {
  const p = e.payload;
  const player = ctx.playerName(p.playerId);
  const club = ctx.clubName(p.clubId);
  const tokens: TokenMap = {
    player, club, attribute: p.attribute.replace(/([A-Z])/g, ' $1').toLowerCase().trim(), value: p.to,
  };
  const facts: HookFacts = { attribute: p.attribute, from: p.from, to: p.to, gain: p.to - p.from };
  const entities = [...playerEntity(ctx, p.playerId), ...clubEntity(ctx, p.clubId)];
  return {
    nodes: [{ id: 'developed', kind: 'SOCIAL', label: `${player} improving`, sourceEventId: e.id }],
    media: [{
      trigger: 'PLAYER_DEVELOPED', importance: 1, sentiment: 0.35,
      tokens, facts, entities, clubId: p.clubId, playerId: p.playerId, tags: ['development'],
    }],
    social: [{
      trigger: 'PLAYER_DEVELOPED', importance: 1, sentiment: 0.4,
      tokens, facts, entities, clubId: p.clubId, playerId: p.playerId,
      audiences: ['CREATOR', 'FAN'], tags: ['development'],
    }],
  };
};

const attendanceRule: RuleFor<'ATTENDANCE_RECORDED'> = (e, ctx) => {
  const p = e.payload;
  const club = ctx.clubName(p.clubId);
  const fillRate = p.capacity > 0 ? p.attendance / p.capacity : 0;
  // Only a full house or a visibly empty ground is worth a line.
  if (fillRate > C.attendance.emptyThreshold && fillRate < C.attendance.fullThreshold) return null;
  const full = fillRate >= C.attendance.fullThreshold;
  const tokens: TokenMap = { club, attendance: p.attendance, capacity: p.capacity };
  const facts: HookFacts = { attendance: p.attendance, capacity: p.capacity, sellOut: full };
  return {
    nodes: [{ id: 'gate', kind: 'SOCIAL', label: full ? `${club} sell out` : `${club} play to empty seats`, sourceEventId: e.id }],
    media: [{
      trigger: 'ATTENDANCE_RECORDED', importance: 2, sentiment: full ? 0.4 : -0.4,
      tokens, facts, entities: clubEntity(ctx, p.clubId), clubId: p.clubId, tags: ['fans'],
    }],
    social: [{
      trigger: 'ATTENDANCE_RECORDED', importance: 2, sentiment: full ? 0.45 : -0.45,
      tokens, facts, entities: clubEntity(ctx, p.clubId), clubId: p.clubId,
      audiences: ['CLUB', 'FAN'], tags: ['fans'],
    }],
  };
};

const seasonStartRule: RuleFor<'SEASON_STARTED'> = (e, ctx) => {
  const club = ctx.clubName(ctx.playerClubId);
  const tokens: TokenMap = { club, season: e.payload.season };
  const facts: HookFacts = { season: e.payload.season };
  return {
    nodes: [{ id: 'kickoff', kind: 'MEDIA', label: `Season ${e.payload.season} begins`, sourceEventId: e.id }],
    media: [{
      trigger: 'SEASON_STARTED', importance: 3, sentiment: 0.4,
      tokens, facts, entities: clubEntity(ctx, ctx.playerClubId), clubId: ctx.playerClubId, tags: ['season'],
    }],
    social: [{
      trigger: 'SEASON_STARTED', importance: 3, sentiment: 0.45,
      tokens, facts, entities: clubEntity(ctx, ctx.playerClubId), clubId: ctx.playerClubId,
      audiences: ['CLUB', 'FAN', 'CREATOR'], tags: ['season'],
    }],
  };
};

const seasonEndRule: RuleFor<'SEASON_COMPLETED'> = (e, ctx) => {
  const p = e.payload;
  const club = ctx.clubName(ctx.playerClubId);
  const champion = ctx.clubName(p.championClubId);
  const won = p.championClubId === ctx.playerClubId;
  const tokens: TokenMap = { club, champion, position: p.playerPosition, season: p.season };
  const facts: HookFacts = { position: p.playerPosition, season: p.season, champion: won };
  return {
    nodes: [{ id: 'seasonend', kind: 'MEDIA', label: `Season ${p.season} ends`, sourceEventId: e.id }],
    media: [{
      trigger: 'SEASON_COMPLETED', importance: 4, sentiment: won ? 0.9 : p.playerPosition <= 6 ? 0.2 : -0.4,
      tokens, facts, entities: clubEntity(ctx, ctx.playerClubId), clubId: ctx.playerClubId, tags: ['season'],
    }],
    social: [{
      trigger: 'SEASON_COMPLETED', importance: 4, sentiment: won ? 0.9 : p.playerPosition <= 6 ? 0.2 : -0.45,
      tokens, facts, entities: clubEntity(ctx, ctx.playerClubId), clubId: ctx.playerClubId,
      audiences: ['FAN', 'MEDIA', 'CREATOR'], tags: ['season'],
    }],
  };
};

const youthPromotionRule: RuleFor<'YOUTH_PROSPECT_PROMOTED'> = (e, ctx) => {
  const p = e.payload;
  const player = ctx.playerName(p.playerId);
  const club = ctx.clubName(p.clubId);
  const prospect = ctx.state.players[p.playerId];
  const tokens: TokenMap = { player, club, age: prospect?.age ?? 17 };
  const facts: HookFacts = { age: prospect?.age ?? 17, potential: prospect?.potential ?? 0 };
  const entities = [...playerEntity(ctx, p.playerId), ...clubEntity(ctx, p.clubId)];
  return {
    nodes: [{ id: 'promoted', kind: 'SOCIAL', label: `${player} promoted to the first team`, sourceEventId: e.id }],
    deltas: [{ kind: 'FAN_EXCITEMENT', clubId: p.clubId, delta: C.youthPromotion.fanExcitement, reason: 'Academy promotion' }],
    media: [{
      trigger: 'YOUTH_PROSPECT_PROMOTED', importance: 2, sentiment: 0.5,
      tokens, facts, entities, clubId: p.clubId, playerId: p.playerId, tags: ['youth'],
    }],
    social: [{
      trigger: 'YOUTH_PROSPECT_PROMOTED', importance: 2, sentiment: 0.55,
      tokens, facts, entities, clubId: p.clubId, playerId: p.playerId,
      audiences: ['CLUB', 'FAN'], tags: ['youth'],
    }],
  };
};

const objectiveDoneRule: RuleFor<'OBJECTIVE_COMPLETED'> = (e, ctx) => {
  const p = e.payload;
  const club = ctx.clubName(ctx.playerClubId);
  const tokens: TokenMap = { club, objective: p.title, reward: p.rewardSummary };
  const facts: HookFacts = { objective: p.title };
  return {
    nodes: [{ id: 'objective', kind: 'SOCIAL', label: `${p.title} completed`, sourceEventId: e.id }],
    media: [{
      trigger: 'OBJECTIVE_COMPLETED', importance: 2, sentiment: 0.5,
      tokens, facts, entities: clubEntity(ctx, ctx.playerClubId), clubId: ctx.playerClubId, tags: ['objective'],
    }],
    social: [{
      trigger: 'OBJECTIVE_COMPLETED', importance: 2, sentiment: 0.55,
      tokens, facts, entities: clubEntity(ctx, ctx.playerClubId), clubId: ctx.playerClubId,
      audiences: ['CLUB', 'FAN'], tags: ['objective'],
    }],
  };
};

const objectiveFailedRule: RuleFor<'OBJECTIVE_FAILED'> = (e, ctx) => {
  const p = e.payload;
  const club = ctx.clubName(ctx.playerClubId);
  const tokens: TokenMap = { club, objective: p.title };
  return {
    nodes: [{ id: 'objective', kind: 'SOCIAL', label: `${p.title} missed`, sourceEventId: e.id }],
    media: [{
      trigger: 'OBJECTIVE_FAILED', importance: 3, sentiment: -0.5,
      tokens, facts: { objective: p.title }, entities: clubEntity(ctx, ctx.playerClubId),
      clubId: ctx.playerClubId, tags: ['objective'],
    }],
    social: [{
      trigger: 'OBJECTIVE_FAILED', importance: 3, sentiment: -0.55,
      tokens, facts: { objective: p.title }, entities: clubEntity(ctx, ctx.playerClubId),
      clubId: ctx.playerClubId, audiences: ['FAN', 'MEDIA'], tags: ['objective'],
    }],
  };
};

const reputationRule: RuleFor<'REPUTATION_CHANGED'> = (e, ctx) => {
  const p = e.payload;
  const club = ctx.clubName(p.clubId);
  const rising = p.to > p.from;
  const tokens: TokenMap = { club, reputation: Math.round(p.to), reason: p.reason };
  const facts: HookFacts = { from: Math.round(p.from), to: Math.round(p.to), rising };
  return {
    nodes: [{ id: 'reputation', kind: 'REPUTATION', label: `${club} reputation ${rising ? 'up' : 'down'}`, sourceEventId: e.id }],
    media: [{
      trigger: 'REPUTATION_CHANGED', importance: 2, sentiment: rising ? 0.4 : -0.4,
      tokens, facts, entities: clubEntity(ctx, p.clubId), clubId: p.clubId, tags: ['reputation'],
    }],
    social: [{
      trigger: 'REPUTATION_CHANGED', importance: 2, sentiment: rising ? 0.4 : -0.4,
      tokens, facts, entities: clubEntity(ctx, p.clubId), clubId: p.clubId,
      audiences: ['MEDIA', 'CREATOR'], tags: ['reputation'],
    }],
  };
};

const sponsorLostRule: RuleFor<'SPONSOR_LOST'> = (e, ctx) => {
  const p = e.payload;
  const club = ctx.clubName(p.clubId);
  const sponsor = ctx.state.sponsors.active.find((d) => d.sponsorId === p.sponsorId)?.name
    ?? 'the shirt sponsor';
  const tokens: TokenMap = { club, sponsor, reason: p.reason };
  return {
    nodes: [{ id: 'sponsorlost', kind: 'SOCIAL', label: `${sponsor} walk away from ${club}`, sourceEventId: e.id }],
    deltas: [{ kind: 'FAN_SENTIMENT', clubId: p.clubId, delta: C.sponsorLost.fanSentiment, reason: 'Sponsor walked' }],
    media: [{
      trigger: 'SPONSOR_LOST', importance: 3, sentiment: -0.5,
      tokens, facts: { reason: p.reason }, entities: clubEntity(ctx, p.clubId), clubId: p.clubId,
      tags: ['commercial'],
    }],
    social: [{
      trigger: 'SPONSOR_LOST', importance: 3, sentiment: -0.5,
      tokens, facts: { reason: p.reason }, entities: clubEntity(ctx, p.clubId), clubId: p.clubId,
      audiences: ['FAN', 'MEDIA'], tags: ['commercial'],
    }],
  };
};

const balanceLowRule: RuleFor<'BALANCE_LOW'> = (e, ctx) => {
  const p = e.payload;
  const club = ctx.clubName(p.clubId);
  const tokens: TokenMap = { club, balance: formatMoney(p.balance) };
  return {
    nodes: [{ id: 'balance', kind: 'PRESSURE', label: `${club} are running out of money`, sourceEventId: e.id }],
    media: [{
      trigger: 'BALANCE_LOW', importance: 3, sentiment: -0.6,
      tokens, facts: { balance: p.balance }, entities: clubEntity(ctx, p.clubId), clubId: p.clubId,
      tags: ['finance'],
    }],
    social: [{
      trigger: 'BALANCE_LOW', importance: 3, sentiment: -0.6,
      tokens, facts: { balance: p.balance }, entities: clubEntity(ctx, p.clubId), clubId: p.clubId,
      audiences: ['LEAK', 'FAN'], tags: ['finance'],
    }],
  };
};

const rivalryCreatedRule: RuleFor<'RIVALRY_CREATED'> = (e, ctx) => {
  const p = e.payload;
  const club = ctx.clubName(p.clubA);
  const opponent = ctx.clubName(p.clubB);
  const entities = [...clubEntity(ctx, p.clubA), ...clubEntity(ctx, p.clubB)];
  return {
    nodes: [{ id: 'rivalryborn', kind: 'RIVALRY', label: `${club} v ${opponent} is a fixture now`, sourceEventId: e.id }],
    media: [{
      trigger: 'RIVALRY_CREATED', importance: 3, sentiment: -0.2,
      tokens: { club, opponent }, facts: {}, entities, clubId: p.clubA, opponentClubId: p.clubB,
      tags: ['rivalry'],
    }],
    social: [{
      trigger: 'RIVALRY_CREATED', importance: 3, sentiment: -0.2,
      tokens: { club, opponent }, facts: {}, entities, clubId: p.clubA, opponentClubId: p.clubB,
      audiences: ['MEDIA', 'FAN', 'RIVAL'], tags: ['rivalry'],
    }],
  };
};

const transferCompletedRule: RuleFor<'TRANSFER_COMPLETED'> = (e, ctx) => {
  const p = e.payload;
  const player = ctx.playerName(p.playerId);
  const club = ctx.clubName(p.toClubId);
  const from = ctx.clubName(p.fromClubId);
  const entities = [
    ...playerEntity(ctx, p.playerId), ...clubEntity(ctx, p.toClubId), ...clubEntity(ctx, p.fromClubId),
  ];
  return {
    nodes: [{ id: 'done', kind: 'MEDIA', label: `${player} deal done`, sourceEventId: e.id }],
    media: [{
      trigger: 'TRANSFER_COMPLETED', importance: 2, sentiment: 0.25,
      tokens: { player, club, opponent: from, fee: formatMoney(p.fee) },
      facts: { fee: p.fee }, entities, clubId: p.toClubId, opponentClubId: p.fromClubId,
      playerId: p.playerId, tags: ['transfer'],
    }],
    social: [{
      trigger: 'TRANSFER_COMPLETED', importance: 2, sentiment: 0.25,
      tokens: { player, club, opponent: from, fee: formatMoney(p.fee) },
      facts: { fee: p.fee }, entities, clubId: p.toClubId, opponentClubId: p.fromClubId,
      playerId: p.playerId, audiences: ['MEDIA', 'LEAK'], tags: ['transfer'],
    }],
  };
};

const bidMadeRule: RuleFor<'TRANSFER_BID_MADE'> = (e, ctx) => {
  const p = e.payload;
  const player = ctx.playerName(p.playerId);
  const club = ctx.clubName(p.toClubId);
  const entities = [...playerEntity(ctx, p.playerId), ...clubEntity(ctx, p.toClubId)];
  return {
    nodes: [{ id: 'bid', kind: 'SOCIAL', label: `${club} bid for ${player}`, sourceEventId: e.id }],
    social: [{
      trigger: 'TRANSFER_BID_MADE', importance: 2, sentiment: 0.1,
      tokens: { player, club, amount: formatMoney(p.amount), fee: formatMoney(p.amount) },
      facts: { amount: p.amount }, entities, clubId: p.toClubId, opponentClubId: p.fromClubId,
      playerId: p.playerId, audiences: ['LEAK', 'FAN'], tags: ['transfer', 'rumour'],
    }],
  };
};

const bidRejectedRule: RuleFor<'TRANSFER_BID_REJECTED'> = (e, ctx) => {
  const p = e.payload;
  const player = ctx.playerName(p.playerId);
  const owner = ctx.state.players[p.playerId]?.clubId;
  const club = ctx.clubName(owner ?? undefined);
  const entities = [...playerEntity(ctx, p.playerId), ...clubEntity(ctx, owner ?? undefined)];
  return {
    nodes: [{ id: 'rejected', kind: 'SOCIAL', label: `Bid for ${player} rejected`, sourceEventId: e.id }],
    media: [{
      trigger: 'TRANSFER_BID_REJECTED', importance: 2, sentiment: -0.1,
      tokens: { player, club, reason: p.reason }, facts: { reason: p.reason },
      entities, ...(owner ? { clubId: owner } : {}), playerId: p.playerId, tags: ['transfer'],
    }],
    social: [{
      trigger: 'TRANSFER_BID_REJECTED', importance: 2, sentiment: -0.15,
      tokens: { player, club, reason: p.reason }, facts: { reason: p.reason },
      entities, ...(owner ? { clubId: owner } : {}), playerId: p.playerId,
      audiences: ['LEAK', 'FAN'], tags: ['transfer'],
    }],
  };
};

const scoutReportRule: RuleFor<'SCOUT_REPORT_READY'> = (e, ctx) => {
  const p = e.payload;
  const player = ctx.playerName(p.playerId);
  const club = ctx.clubName(p.clubId);
  const entities = [...playerEntity(ctx, p.playerId), ...clubEntity(ctx, p.clubId)];
  return {
    nodes: [{ id: 'scout', kind: 'SOCIAL', label: `${club} file a report on ${player}`, sourceEventId: e.id }],
    media: [{
      trigger: 'SCOUT_REPORT_READY', importance: 2, sentiment: 0.1,
      tokens: { player, club, confidence: Math.round(p.confidence * 100) },
      facts: { confidence: p.confidence }, entities, clubId: p.clubId, playerId: p.playerId,
      tags: ['scouting'],
    }],
    social: [{
      trigger: 'SCOUT_REPORT_READY', importance: 2, sentiment: 0.1,
      tokens: { player, club, confidence: Math.round(p.confidence * 100) },
      facts: { confidence: p.confidence }, entities, clubId: p.clubId, playerId: p.playerId,
      audiences: ['LEAK'], tags: ['scouting'],
    }],
  };
};

const creatorMomentRule: RuleFor<'CREATOR_MOMENT'> = (e, ctx) => {
  const p = e.payload;
  const creator = ctx.state.creators[p.creatorId];
  if (!creator) return null;
  const club = ctx.clubName(p.clubId);
  const entities: EntityRef[] = [
    { kind: 'creator', id: creator.id, name: creator.displayName },
    ...clubEntity(ctx, p.clubId),
  ];
  const tokens: TokenMap = {
    creator: personToken(creator.displayName), club, reach: compactCount(p.reach), kind: p.kind,
  };
  return {
    nodes: [{ id: 'moment', kind: 'SOCIAL', label: `${creator.displayName} goes viral`, sourceEventId: e.id }],
    media: [{
      trigger: 'CREATOR_MOMENT', importance: 2, sentiment: 0.45,
      tokens, facts: { reach: p.reach, tier: creator.tier }, entities, clubId: p.clubId, tags: ['creator'],
    }],
    social: [{
      trigger: 'CREATOR_MOMENT', importance: 2, sentiment: 0.5,
      tokens, facts: { reach: p.reach, tier: creator.tier }, entities, clubId: p.clubId,
      audiences: ['CREATOR', 'FAN'], tags: ['creator'],
    }],
  };
};

const fixtureRule: RuleFor<'MATCH_SCHEDULED'> = (e, ctx) => {
  const p = e.payload;
  const club = ctx.clubName(p.homeClubId);
  const opponent = ctx.clubName(p.awayClubId);
  const heat = ctx.derbyHeat(p.homeClubId, p.awayClubId);
  const isDerbyMoment = heat >= C.derby.intensityThreshold;
  const entities = [...clubEntity(ctx, p.homeClubId), ...clubEntity(ctx, p.awayClubId)];
  const tokens: TokenMap = { club, opponent, week: p.week };
  const facts: HookFacts = { derby: isDerbyMoment, week: p.week, intensity: Math.round(heat) };
  return {
    nodes: [{ id: 'preview', kind: 'MEDIA', label: `${club} v ${opponent} coming up`, sourceEventId: e.id }],
    media: [{
      trigger: 'MATCH_SCHEDULED', importance: (isDerbyMoment ? 3 : 2) as EventImportance, sentiment: 0,
      tokens, facts, entities, clubId: p.homeClubId, opponentClubId: p.awayClubId, tags: ['preview'],
    }],
    social: [{
      trigger: 'MATCH_SCHEDULED', importance: (isDerbyMoment ? 3 : 2) as EventImportance, sentiment: 0,
      tokens, facts, entities, clubId: p.homeClubId, opponentClubId: p.awayClubId,
      audiences: ['MEDIA', 'FAN'], tags: ['preview'],
    }],
  };
};

const RULES: { [K in DomainEventType]?: RuleFor<K> } = {
  RED_CARD: redCardRule,
  PLAYER_MORALE_CHANGED: moraleRule,
  FAN_SENTIMENT_CHANGED: fanSentimentRule,
  RIVALRY_INTENSIFIED: rivalryRule,
  PLAYER_SIGNED: signingRule,
  MATCH_LOST: matchLostRule,
  MATCH_WON: matchWonRule,
  PLAYER_BREAKOUT: breakoutRule,
  PLAYER_INJURED: injuryRule,
  RECORD_BROKEN: recordRule,
  TRANSFER_HIJACKED: hijackRule,
  GOAL_SCORED: goalRule,
  TROPHY_WON: trophyRule,
  MANAGER_SACKED: sackRule,
  SPONSOR_SIGNED: sponsorRule,
  CREATOR_JOINED: creatorJoinRule,
  MATCH_DRAWN: matchDrawnRule,
  PLAYER_SOLD: playerSoldRule,
  MOTM_AWARDED: motmRule,
  CONTRACT_SIGNED: contractSignedRule,
  CONTRACT_EXPIRING: contractExpiringRule,
  FACILITY_UPGRADED: facilityRule,
  PLAYER_RECOVERED: recoveredRule,
  PLAYER_RELEASED: releasedRule,
  PLAYER_DEVELOPED: developedRule,
  ATTENDANCE_RECORDED: attendanceRule,
  SEASON_STARTED: seasonStartRule,
  SEASON_COMPLETED: seasonEndRule,
  YOUTH_PROSPECT_PROMOTED: youthPromotionRule,
  OBJECTIVE_COMPLETED: objectiveDoneRule,
  OBJECTIVE_FAILED: objectiveFailedRule,
  REPUTATION_CHANGED: reputationRule,
  SPONSOR_LOST: sponsorLostRule,
  BALANCE_LOW: balanceLowRule,
  RIVALRY_CREATED: rivalryCreatedRule,
  TRANSFER_COMPLETED: transferCompletedRule,
  TRANSFER_BID_MADE: bidMadeRule,
  TRANSFER_BID_REJECTED: bidRejectedRule,
  SCOUT_REPORT_READY: scoutReportRule,
  CREATOR_MOMENT: creatorMomentRule,
  MATCH_SCHEDULED: fixtureRule,
};

/**
 * Every domain event type the cascade can turn into content, derived from the
 * rule table itself.
 *
 * Exported so tests can walk the real inventory instead of a hand-maintained
 * list. A hand-written list of "what we emit" stayed green while two thirds of
 * the authored library was unreachable, because it only ever proved that
 * somebody had written a list.
 */
export const CASCADE_RULE_TYPES: readonly DomainEventType[] =
  Object.keys(RULES).sort() as DomainEventType[];

// --- follow-ups ------------------------------------------------------------

/**
 * Second-cycle reactions. These are derived by re-reading last cycle's events
 * rather than stored, so they survive a save/load round trip untouched and can
 * never desynchronise from the journal.
 */
type FollowUpRule = (e: AnyDomainEvent, ctx: CascadeCtx) => Partial<ContentHook> | null;

const FOLLOW_UPS: { [K in DomainEventType]?: FollowUpRule } = {
  RED_CARD: (e, ctx) => {
    const p = e.payload as DomainEventPayloads['RED_CARD'];
    const player = ctx.playerName(p.playerId);
    return {
      trigger: 'SUSPENSION_AFTERMATH', importance: 3, sentiment: -0.35,
      tokens: { player, club: ctx.clubName(p.clubId) },
      facts: { followUp: true },
      entities: [...playerEntity(ctx, p.playerId), ...clubEntity(ctx, p.clubId)],
      clubId: p.clubId, playerId: p.playerId,
      audiences: ['MEDIA', 'FAN', 'CREATOR'], tags: ['discipline', 'follow-up'],
    };
  },
  PLAYER_SIGNED: (e, ctx) => {
    const p = e.payload as DomainEventPayloads['PLAYER_SIGNED'];
    const club = ctx.state.clubs[p.clubId];
    const wageBudget = Math.max(1, club?.finance.wageBudgetPerCycle ?? 1);
    if (p.fee < wageBudget * C.marqueeSigning.feeToWageBudgetRatio) return null;
    return {
      trigger: 'DEBUT_WATCH', importance: 3, sentiment: 0.2,
      tokens: { player: ctx.playerName(p.playerId), club: ctx.clubName(p.clubId), fee: formatMoney(p.fee) },
      facts: { followUp: true, fee: p.fee },
      entities: [...playerEntity(ctx, p.playerId), ...clubEntity(ctx, p.clubId)],
      clubId: p.clubId, playerId: p.playerId,
      audiences: ['MEDIA', 'CREATOR', 'FAN'], tags: ['transfer', 'follow-up'],
    };
  },
  MATCH_LOST: (e, ctx) => {
    const p = e.payload as DomainEventPayloads['MATCH_LOST'];
    if (p.margin < C.shockDefeat.marginThreshold) return null;
    return {
      trigger: 'DEFEAT_FALLOUT', importance: 3, sentiment: -0.5,
      tokens: { club: ctx.clubName(p.clubId), opponent: ctx.clubName(p.opponentId), margin: p.margin },
      facts: { followUp: true, margin: p.margin },
      entities: [...clubEntity(ctx, p.clubId), ...clubEntity(ctx, p.opponentId)],
      clubId: p.clubId, opponentClubId: p.opponentId,
      audiences: ['MEDIA', 'FAN', 'CREATOR'], tags: ['match', 'follow-up'],
    };
  },
  PLAYER_BREAKOUT: (e, ctx) => {
    const p = e.payload as DomainEventPayloads['PLAYER_BREAKOUT'];
    return {
      trigger: 'BREAKOUT_INTEREST', importance: 3, sentiment: 0.1,
      tokens: { player: ctx.playerName(p.playerId), club: ctx.clubName(p.clubId) },
      facts: { followUp: true, overall: p.overall },
      entities: [...playerEntity(ctx, p.playerId), ...clubEntity(ctx, p.clubId)],
      clubId: p.clubId, playerId: p.playerId,
      audiences: ['LEAK', 'MEDIA', 'CREATOR'], tags: ['transfer', 'follow-up'],
    };
  },
  RECORD_BROKEN: (e, ctx) => {
    const p = e.payload as DomainEventPayloads['RECORD_BROKEN'];
    return {
      trigger: 'RECORD_REACTION', importance: 3, sentiment: 0.6,
      tokens: {
        club: ctx.clubName(p.clubId), record: p.record, value: p.value,
        ...(p.holderId ? { player: ctx.playerName(p.holderId) } : {}),
        subject: p.holderId ? ctx.playerName(p.holderId) : ctx.clubName(p.clubId),
      },
      facts: { followUp: true, record: p.record, subjectKind: p.holderId ? 'PLAYER' : 'CLUB' },
      entities: [...clubEntity(ctx, p.clubId), ...playerEntity(ctx, p.holderId)],
      clubId: p.clubId,
      audiences: ['MEDIA', 'FAN', 'CREATOR'], tags: ['record', 'follow-up'],
    };
  },
  TROPHY_WON: (e, ctx) => {
    const p = e.payload as DomainEventPayloads['TROPHY_WON'];
    return {
      trigger: 'TROPHY_AFTERGLOW', importance: 3, sentiment: 0.8,
      tokens: { club: ctx.clubName(p.clubId), competition: p.competition },
      facts: { followUp: true },
      entities: clubEntity(ctx, p.clubId), clubId: p.clubId,
      audiences: ['MEDIA', 'FAN', 'SPONSOR'], tags: ['trophy', 'follow-up'],
    };
  },
};

// --- manager pressure ------------------------------------------------------

/**
 * Pressure is not stored anywhere, it is *read from history*: recent defeats,
 * heavy defeats and fan sentiment. That keeps it honest — you cannot end up
 * with a "manager under pressure" story that the results do not justify.
 */
export function managerPressure(state: GameState, clubId: ClubId): number {
  const window = state.clock.cycle - 8;
  let pressure = 0;
  let winless = 0;
  let sawWin = false;
  for (let i = state.eventLog.length - 1; i >= 0; i--) {
    const e = state.eventLog[i];
    if (!e || e.cycle < window) break;
    if (e.type === 'MATCH_WON' && e.payload.clubId === clubId) { sawWin = true; }
    if (!sawWin && (e.type === 'MATCH_LOST' || e.type === 'MATCH_DRAWN') && e.payload.clubId === clubId) winless++;
    if (e.type === 'MATCH_LOST' && e.payload.clubId === clubId) {
      pressure += e.payload.margin >= C.shockDefeat.marginThreshold
        ? C.shockDefeat.managerPressure
        : C.shockDefeat.managerPressure / 3;
    }
    if (e.type === 'MATCH_WON' && e.payload.clubId === clubId) pressure += C.bigWin.managerPressure;
  }
  if (winless >= C.managerPressure.winlessRun) {
    pressure += (winless - C.managerPressure.winlessRun + 1) * C.managerPressure.winlessPressurePerMatch;
  }
  const club = state.clubs[clubId];
  if (club) pressure += (50 - club.fans.sentiment) * 0.4;
  return clamp(pressure, 0, 100);
}

function hottestRival(ctx: CascadeCtx, clubId: ClubId): ClubId | null {
  let best: ClubId | null = null;
  let bestHeat: number = C.derby.intensityThreshold;
  for (const r of Object.values(ctx.state.rivalries)) {
    if (r.clubAId !== clubId && r.clubBId !== clubId) continue;
    if (r.intensity >= bestHeat) {
      bestHeat = r.intensity;
      best = r.clubAId === clubId ? r.clubBId : r.clubAId;
    }
  }
  return best;
}


/**
 * What this save can honestly claim about itself.
 *
 * A template that says a record "stood for a generation — it had survived four
 * managers, two relegations and a rebuild" is *false* in season one of a club
 * founded this year, and content that is transparently false is worse than no
 * content: it tells the player none of it means anything. So the save publishes
 * its real history as facts, and any line that asserts longevity has to declare
 * a condition against them. An unknown fact never matches, so a template that
 * keys on history a save does not have is skipped rather than printed.
 *
 * Vocabulary published here — usable in any template's `conditions`:
 *   seasonsPlayed, managersEmployed, relegations, trophiesWon, clubEverPromoted
 */
function saveHistoryFacts(state: GameState): HookFacts {
  const clubId = state.playerClubId;
  let managerChanges = 0;
  let relegations = 0;
  let promotions = 0;
  for (const e of state.eventLog) {
    if (e.type === 'MANAGER_SACKED' && e.payload.clubId === clubId) managerChanges++;
    if (e.type === 'RELEGATED' && e.payload.clubId === clubId) relegations++;
    if (e.type === 'PROMOTED' && e.payload.clubId === clubId) promotions++;
  }
  return {
    seasonsPlayed: Math.max(0, state.clock.season - 1),
    managersEmployed: managerChanges + 1,
    relegations,
    trophiesWon: state.legacy.trophies.length,
    clubEverPromoted: promotions > 0,
  };
}

/**
 * Drop an entity token that is really the same entity as another slot in the
 * same sentence. "{club} and {opponent} cannot be separated" is a fine line and
 * a terrible one when both slots hold the same club.
 */
function withoutDuplicateEntities(tokens: TokenMap): TokenMap {
  const club = tokens.club;
  if (!club) return tokens;
  const out: Record<string, PlainToken | undefined> = { ...tokens };
  for (const key of ['opponent', 'rival', 'buyer', 'champion'] as const) {
    if (out[key] === club) delete out[key];
  }
  return out as TokenMap;
}

// --- driver ----------------------------------------------------------------

export interface CascadeOptions {
  /** Defaults to the clock cycle on the state. */
  readonly cycle?: number;
  /** Skip the previous-cycle follow-up scan (used when replaying a batch). */
  readonly skipFollowUps?: boolean;
}

/**
 * Expand a batch of events into everything the world does about them.
 *
 * Deterministic and side-effect free — no rng, no clock — so it can safely be
 * run twice over the same inputs (the media and social engines each call it
 * when they are not handed a precomputed result).
 */
export function expandCascade(
  events: readonly AnyDomainEvent[],
  state: GameState,
  opts: CascadeOptions = {},
): CascadeResult {
  const cycle = opts.cycle ?? state.clock.cycle;
  const pressure = new Map<string, number>();
  for (const club of Object.values(state.clubs)) {
    pressure.set(club.id, managerPressure(state, club.id));
  }

  // One pass over fixtures; every rule then resolves an opponent in O(1).
  const matchIndex = new Map<string, { home: ClubId; away: ClubId }>();
  for (const fixture of Object.values(state.fixtures)) {
    if (fixture.matchId) matchIndex.set(fixture.matchId, { home: fixture.homeClubId, away: fixture.awayClubId });
  }

  const ctx: CascadeCtx = {
    state,
    cycle,
    playerClubId: state.playerClubId,
    pressure,
    clubName: (id) => clubToken(id ? state.clubs[id]?.name ?? 'the club' : 'the club'),
    playerName: (id) => personToken(id ? state.players[id]?.displayName ?? 'the player' : 'the player'),
    derbyHeat: (a, b) => {
      if (!a) return 0;
      if (!b) {
        let max = 0;
        for (const r of Object.values(state.rivalries)) {
          if ((r.clubAId === a || r.clubBId === a) && r.intensity > max) max = r.intensity;
        }
        return max;
      }
      return rivalryFor(state, a, b)?.intensity ?? 0;
    },
    opponentIn: (matchId, clubId) => {
      if (!matchId) return undefined;
      const fixture = matchIndex.get(matchId);
      if (!fixture) return undefined;
      if (fixture.home === clubId) return fixture.away;
      if (fixture.away === clubId) return fixture.home;
      return undefined;
    },
  };

  const derivedEvents: AnyDomainEvent[] = [];
  const nodes: CascadeNode[] = [];
  const deltas: WorldDelta[] = [];
  const mediaHooks: ContentHook[] = [];
  const socialHooks: ContentHook[] = [];
  const chains: Record<string, CascadeNode[]> = {};
  const seen = new Set<string>();

  const process = (event: AnyDomainEvent, rootId: EventId, depth: number): void => {
    if (depth > C.maxDepth) return;
    if (nodes.length >= C.maxNodesPerCycle) return;
    if (seen.has(event.id)) return;
    seen.add(event.id);

    const rule = RULES[event.type] as ((e: AnyDomainEvent, c: CascadeCtx) => CascadeStep | null) | undefined;
    const step = rule ? rule(event, ctx) : null;
    if (!step) return;

    const falloff = C.depthFalloff ** depth;
    const chain = chains[rootId] ?? (chains[rootId] = []);

    for (const n of step.nodes ?? []) {
      const node: CascadeNode = { ...n, id: `${event.id}:${n.id}`, rootEventId: rootId, depth };
      nodes.push(node);
      chain.push(node);
    }
    for (const d of step.deltas ?? []) {
      // Knock-on effects are damped: the third-order reaction to a red card
      // must not weigh as much as the red card itself.
      deltas.push(scaleDelta(d, falloff));
    }
    for (const h of step.media ?? []) {
      mediaHooks.push(completeHook(h, event, rootId, depth, cycle));
      const node: CascadeNode = { id: `${event.id}:media`, kind: 'MEDIA', label: `Story: ${h.trigger ?? event.type}`, sourceEventId: event.id, rootEventId: rootId, depth };
      nodes.push(node); chain.push(node);
    }
    for (const h of step.social ?? []) {
      socialHooks.push(completeHook(h, event, rootId, depth, cycle));
      const node: CascadeNode = { id: `${event.id}:social`, kind: 'SOCIAL', label: `Chatter: ${h.trigger ?? event.type}`, sourceEventId: event.id, rootEventId: rootId, depth };
      nodes.push(node); chain.push(node);
    }
    for (const child of step.derived ?? []) {
      derivedEvents.push(child);
      process(child, rootId, depth + 1);
    }
  };

  for (const event of events) process(event, event.id, 0);

  if (!opts.skipFollowUps) {
    for (const past of state.eventLog) {
      if (past.cycle !== cycle - 1) continue;
      const rule = FOLLOW_UPS[past.type];
      if (!rule) continue;
      const partial = rule(past, ctx);
      if (!partial) continue;
      const hook = completeHook(partial, past, past.id, 1, cycle);
      mediaHooks.push(hook);
      socialHooks.push(hook);
      const node: CascadeNode = {
        id: `${past.id}:followup`, kind: 'FOLLOW_UP',
        label: `Follow-up: ${hook.trigger}`, sourceEventId: past.id, rootEventId: past.id, depth: 1,
      };
      nodes.push(node);
      (chains[past.id] ?? (chains[past.id] = [])).push(node);
    }
  }

  // Manager pressure is a *state* the results imply, so it is anchored to the
  // most recent real result event rather than invented from nothing.
  const anchor = lastResultEvent(state, state.playerClubId, events);
  const clubPressure = pressure.get(state.playerClubId) ?? 0;
  if (anchor && clubPressure >= C.managerPressure.storyThreshold) {
    const crisis = clubPressure >= C.managerPressure.crisisThreshold;
    const clubName = ctx.clubName(state.playerClubId);
    const manager = state.managers[state.playerManagerId]?.name ?? 'the manager';
    const hook = completeHook({
      trigger: crisis ? 'MANAGER_CRISIS' : 'MANAGER_PRESSURE',
      importance: (crisis ? 5 : 3) as EventImportance,
      sentiment: crisis ? -0.85 : -0.5,
      tokens: { club: clubName, manager: personToken(manager) },
      facts: { pressure: Math.round(clubPressure), crisis },
      entities: clubEntity(ctx, state.playerClubId),
      clubId: state.playerClubId,
      audiences: ['MEDIA', 'FAN', 'CREATOR', 'RIVAL'],
      tags: ['manager', 'pressure'],
    }, anchor, anchor.id, 1, cycle);
    mediaHooks.push(hook);
    socialHooks.push(hook);
    const node: CascadeNode = {
      id: `${anchor.id}:pressure`, kind: 'PRESSURE', label: `Pressure on ${manager}`,
      sourceEventId: anchor.id, rootEventId: anchor.id, depth: 1,
    };
    nodes.push(node);
    (chains[anchor.id] ?? (chains[anchor.id] = [])).push(node);
  }

  // Every hook carries the save's real history, so a template may declare what
  // it needs to be true before it is allowed to say it.
  const history = saveHistoryFacts(state);
  const grounded = (h: ContentHook): ContentHook => ({
    ...h,
    facts: { ...history, ...h.facts },
    tokens: withoutDuplicateEntities(h.tokens),
  });

  return {
    derivedEvents,
    nodes,
    deltas,
    mediaHooks: mediaHooks.map(grounded),
    socialHooks: socialHooks.map(grounded),
    chains,
  };
}

function scaleDelta(d: WorldDelta, factor: number): WorldDelta {
  if (factor >= 1) return d;
  switch (d.kind) {
    case 'PLAYER_SUSPENSION': return d;
    case 'RIVALRY_INTENSITY': return { ...d, delta: d.delta * factor };
    default: return { ...d, delta: d.delta * factor };
  }
}

function lastResultEvent(
  state: GameState,
  clubId: ClubId,
  fresh: readonly AnyDomainEvent[],
): AnyDomainEvent | null {
  const isResult = (e: AnyDomainEvent): boolean =>
    (e.type === 'MATCH_LOST' || e.type === 'MATCH_DRAWN' || e.type === 'MATCH_WON')
    && (e.payload as { clubId: ClubId }).clubId === clubId;
  for (let i = fresh.length - 1; i >= 0; i--) {
    const e = fresh[i];
    if (e && isResult(e)) return e;
  }
  for (let i = state.eventLog.length - 1; i >= 0; i--) {
    const e = state.eventLog[i];
    if (e && isResult(e)) return e;
  }
  return null;
}
