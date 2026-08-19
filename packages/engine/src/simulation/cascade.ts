import type { ClubId, EventId, PlayerId, RivalryId } from '../core/brand';
import type {
  AnyDomainEvent, DomainEvent, DomainEventPayloads, DomainEventType, EntityRef, EventImportance,
} from '../core/events';
import type { GameState } from '../game/state';
import { formatMoney } from '../economy/ledger';
import { clamp } from '../core/math';
import { rivalryFor, rivalryKey } from '../rivalries/rivalries';
import { CASCADE_BALANCE as C } from './balance';
import type { ContentHook, HookFacts, SocialPostKind, TokenMap } from './ports';
import { sentimentBand } from './templating';

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
  clubName(id: string | undefined): string;
  playerName(id: string | undefined): string;
  derbyHeat(a: ClubId | undefined, b: ClubId | undefined): number;
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
  const heat = ctx.derbyHeat(p.clubId, undefined);
  const isDerbyMoment = heat >= C.derby.intensityThreshold;
  const player = ctx.playerName(p.playerId);
  const club = ctx.clubName(p.clubId);
  const matches = C.redCard.suspensionMatches + (isDerbyMoment ? C.redCard.derbySuspensionBonus : 0);
  const fanDelta = C.redCard.fanSentiment * (isDerbyMoment ? C.derby.fanSentimentMultiplier : 1);
  const tokens: TokenMap = { player, club, minute: p.minute, matches };
  const facts: HookFacts = { minute: p.minute, derby: isDerbyMoment, matches, intensity: Math.round(heat) };
  const entities = [...playerEntity(ctx, p.playerId), ...clubEntity(ctx, p.clubId)];

  const rival = hottestRival(ctx, p.clubId);
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
      social: [{ trigger: 'SIGNING', importance: 2, sentiment: 0.35, tokens, facts, entities, clubId: p.clubId, playerId: p.playerId, audiences: ['CLUB', 'FAN'], tags: ['transfer'] }],
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
    * (isDerbyMoment ? C.derby.fanSentimentMultiplier : 1);

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
      importance: (shock ? C.shockDefeat.mediaImportance : isDerbyMoment ? 4 : 2) as EventImportance,
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
  const fanDelta = C.bigWin.fanSentiment * (big ? 1.4 : 1) * (isDerbyMoment ? C.derby.fanSentimentMultiplier : 1);

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
      importance: (isDerbyMoment ? 4 : big ? 3 : 2) as EventImportance,
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
      audiences: ['FAN', 'CLUB', 'CREATOR'], tags: ['injury'],
    }],
  };
};

const recordRule: RuleFor<'RECORD_BROKEN'> = (e, ctx) => {
  const p = e.payload;
  const clubName = ctx.clubName(p.clubId);
  const holder = p.holderId ? ctx.playerName(p.holderId) : clubName;
  const tokens: TokenMap = { club: clubName, player: holder, record: p.record, value: p.value };
  const facts: HookFacts = { record: p.record, value: p.value };
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
      tokens: { player: scorer, club: clubName, minute: p.minute, score: `${p.homeScore}-${p.awayScore}` },
      facts: { minute: p.minute, late, special: p.special ?? 'none' },
      entities, clubId: p.clubId, playerId: p.scorerId,
      audiences: ['FAN', 'CLUB', 'CREATOR'], tags: ['goal'],
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
    media: [{ trigger: 'MANAGER_SACKED', importance: 5, sentiment: -0.4, tokens: { club: clubName, manager: p.managerName }, facts: {}, entities, clubId: p.clubId, tags: ['manager'] }],
    social: [{
      trigger: 'MANAGER_SACKED', importance: 4, sentiment: -0.3,
      tokens: { club: clubName, manager: p.managerName }, facts: {}, entities, clubId: p.clubId,
      audiences: ['MEDIA', 'FAN', 'RIVAL', 'CREATOR'], tags: ['manager'],
    }],
  };
};

const sponsorRule: RuleFor<'SPONSOR_SIGNED'> = (e, ctx) => {
  const p = e.payload;
  const clubName = ctx.clubName(p.clubId);
  return {
    nodes: [{ id: 'sponsor', kind: 'SOCIAL', label: `${clubName} sign a sponsor`, sourceEventId: e.id }],
    social: [{
      trigger: 'SPONSOR_SIGNED', importance: 2, sentiment: 0.4,
      tokens: { club: clubName, value: formatMoney(p.value) }, facts: { value: p.value },
      entities: clubEntity(ctx, p.clubId), clubId: p.clubId,
      audiences: ['SPONSOR', 'CLUB'], tags: ['commercial'],
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
      tokens: { creator: creator.displayName, club: clubName, role: p.role },
      facts: { tier: creator.tier, role: p.role }, entities, clubId: p.clubId, tags: ['creator'],
    }],
    social: [{
      trigger: 'CREATOR_JOINED', importance: 3, sentiment: 0.6,
      tokens: { creator: creator.displayName, club: clubName, role: p.role },
      facts: { tier: creator.tier, role: p.role }, entities, clubId: p.clubId,
      audiences: ['CREATOR', 'CLUB', 'FAN'], tags: ['creator'],
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
};

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
      tokens: { club: ctx.clubName(p.clubId), record: p.record, value: p.value, player: p.holderId ? ctx.playerName(p.holderId) : ctx.clubName(p.clubId) },
      facts: { followUp: true, record: p.record },
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

  const ctx: CascadeCtx = {
    state,
    cycle,
    playerClubId: state.playerClubId,
    pressure,
    clubName: (id) => (id ? state.clubs[id]?.name ?? 'the club' : 'the club'),
    playerName: (id) => (id ? state.players[id]?.displayName ?? 'the player' : 'the player'),
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
      tokens: { club: clubName, manager },
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

  return { derivedEvents, nodes, deltas, mediaHooks, socialHooks, chains };
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
