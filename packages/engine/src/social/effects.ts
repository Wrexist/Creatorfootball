import type { ClubId, EventId, PlayerId, RivalryId } from '../core/brand';
import type { AnyDomainEvent, DomainEventPayloads, DomainEventType, EntityRef, EventImportance } from '../core/events';
import type { GameState } from '../game/state';
import { clamp } from '../core/math';
import { rivalryKey } from '../rivalries/rivalries';
import { appendEvents, patchClub, patchPlayer } from '../game/mutations';
import { SOCIAL_ACTION_BALANCE as A } from './balance';
import { socialWorld, withSocialWorld } from './worldState';

/**
 * What talking actually does.
 *
 * Every interactive surface in this module ends here. Centralising it buys two
 * things that matter more than the small amount of code saved.
 *
 * First, provenance. A social action never silently mutates a number: it emits
 * the same domain events the rest of the world emits, with ids derived from the
 * event the action was about (`<anchor>~<suffix>`), so the change is in the
 * journal, the history screen can show it, and the run is idempotent — applying
 * the same action twice produces the same event id and the same state.
 *
 * Second, honesty in the UI. `describeEffect` renders the exact same structure
 * the apply path consumes, so the consequences a player is shown before they
 * commit cannot drift from the consequences they get.
 */

export interface SocialEffect {
  readonly fanSentiment?: number;
  readonly fanExcitement?: number;
  readonly fanTrust?: number;
  readonly squadMorale?: number;
  readonly playerMorale?: { readonly playerId: PlayerId; readonly delta: number };
  readonly rivalryHeat?: { readonly opponentClubId: ClubId; readonly delta: number };
  readonly reputation?: number;
  readonly mediaGoodwill?: number;
  readonly supportersTrust?: number;
  readonly followers?: number;
}

export interface EffectContext {
  /** The real event this consequence hangs off. */
  readonly anchorEventId: EventId;
  /** Distinguishes several consequences of one anchor. */
  readonly suffix: string;
  readonly reason: string;
  readonly cycle: number;
  readonly season: number;
  readonly week: number;
  readonly at: number;
  readonly clubId: ClubId;
}

const derived = <T extends DomainEventType>(
  ctx: EffectContext,
  suffix: string,
  type: T,
  payload: DomainEventPayloads[T],
  importance: EventImportance,
  entities: readonly EntityRef[],
): AnyDomainEvent => ({
  id: `${ctx.anchorEventId}~${ctx.suffix}${suffix}` as EventId,
  type,
  payload,
  cycle: ctx.cycle,
  season: ctx.season,
  week: ctx.week,
  at: ctx.at,
  importance,
  entities,
} as unknown as AnyDomainEvent);

const clubRef = (state: GameState, id: ClubId): EntityRef[] => {
  const club = state.clubs[id];
  return club ? [{ kind: 'club', id: club.id, name: club.name }] : [];
};

const playerRef = (state: GameState, id: PlayerId): EntityRef[] => {
  const player = state.players[id];
  return player ? [{ kind: 'player', id: player.id, name: player.displayName }] : [];
};

/**
 * Apply one described consequence.
 *
 * Deltas are clamped at the destination rather than at the source, so a tone
 * that is worth +6 fan sentiment is worth +6 whether the club is at 40 or at
 * 97 — the ceiling absorbs it, the design does not have to know about it.
 */
export function applySocialEffect(
  state: GameState,
  effect: SocialEffect,
  ctx: EffectContext,
): { state: GameState; events: readonly AnyDomainEvent[] } {
  let next = state;
  const events: AnyDomainEvent[] = [];
  const club = state.clubs[ctx.clubId];
  if (!club) return { state, events };

  const fanSentiment = effect.fanSentiment ?? 0;
  const fanExcitement = effect.fanExcitement ?? 0;
  const fanTrust = effect.fanTrust ?? 0;
  const followers = effect.followers ?? 0;

  if (fanSentiment !== 0 || fanExcitement !== 0 || fanTrust !== 0 || followers !== 0) {
    const from = club.fans.sentiment;
    const to = clamp(from + fanSentiment, 0, 100);
    next = patchClub(next, ctx.clubId, (c) => ({
      fans: {
        ...c.fans,
        sentiment: to,
        excitement: clamp(c.fans.excitement + fanExcitement, 0, 100),
        trust: clamp(c.fans.trust + fanTrust, 0, 100),
        onlineFollowers: Math.max(0, Math.round(c.fans.onlineFollowers + followers)),
      },
    }));
    if (Math.abs(to - from) >= 0.5) {
      events.push(derived(ctx, ':fans', 'FAN_SENTIMENT_CHANGED', {
        clubId: ctx.clubId, from, to, reason: ctx.reason,
      }, 2, clubRef(state, ctx.clubId)));
    }
    if (followers !== 0) {
      next = {
        ...next,
        social: {
          ...next.social,
          clubFollowers: next.clubs[ctx.clubId]?.fans.onlineFollowers ?? next.social.clubFollowers,
        },
      };
    }
  }

  if (effect.squadMorale) {
    for (const playerId of club.squad) {
      next = patchPlayer(next, playerId, (p) => ({
        mental: { ...p.mental, morale: clamp(p.mental.morale + (effect.squadMorale ?? 0), 1, 99) },
      }));
    }
  }

  if (effect.playerMorale && effect.playerMorale.delta !== 0) {
    const target = next.players[effect.playerMorale.playerId];
    if (target) {
      const from = target.mental.morale;
      const to = clamp(from + effect.playerMorale.delta, 1, 99);
      next = patchPlayer(next, target.id, (p) => ({ mental: { ...p.mental, morale: to } }));
      events.push(derived(ctx, ':morale', 'PLAYER_MORALE_CHANGED', {
        playerId: target.id, clubId: ctx.clubId, from, to, reason: ctx.reason,
      }, 2, playerRef(state, target.id)));
    }
  }

  if (effect.rivalryHeat && effect.rivalryHeat.delta !== 0) {
    const otherId = effect.rivalryHeat.opponentClubId;
    const key = rivalryKey(ctx.clubId, otherId);
    const existing = next.rivalries[key];
    if (existing) {
      const intensity = clamp(existing.intensity + effect.rivalryHeat.delta, 0, 100);
      next = {
        ...next,
        rivalries: { ...next.rivalries, [key]: { ...existing, intensity } },
      };
      events.push(derived(ctx, ':rivalry', 'RIVALRY_INTENSIFIED', {
        rivalryId: key as RivalryId,
        clubA: ctx.clubId, clubB: otherId,
        intensity: effect.rivalryHeat.delta,
        reason: ctx.reason,
      }, 3, [...clubRef(state, ctx.clubId), ...clubRef(state, otherId)]));
    }
  }

  if (effect.reputation) {
    const from = club.reputation;
    const to = clamp(from + effect.reputation, 0, 100);
    next = patchClub(next, ctx.clubId, () => ({ reputation: to }));
    if (Math.abs(to - from) >= 0.5) {
      events.push(derived(ctx, ':rep', 'REPUTATION_CHANGED', {
        clubId: ctx.clubId, from, to, reason: ctx.reason,
      }, 2, clubRef(state, ctx.clubId)));
    }
  }

  if (effect.mediaGoodwill || effect.supportersTrust) {
    const world = socialWorld(next);
    next = withSocialWorld(next, {
      mediaGoodwill: clamp(world.mediaGoodwill + (effect.mediaGoodwill ?? 0), 0, 100),
      supportersTrust: clamp(world.supportersTrust + (effect.supportersTrust ?? 0), 0, 100),
    });
  }

  if (events.length > 0) next = appendEvents(next, events);
  return { state: next, events };
}

/** Sum a list of effects into one, so a screen can preview a combined choice. */
export function mergeEffects(effects: readonly SocialEffect[]): SocialEffect {
  const out: {
    fanSentiment: number; fanExcitement: number; fanTrust: number; squadMorale: number;
    reputation: number; mediaGoodwill: number; supportersTrust: number; followers: number;
    playerMorale?: { playerId: PlayerId; delta: number };
    rivalryHeat?: { opponentClubId: ClubId; delta: number };
  } = {
    fanSentiment: 0, fanExcitement: 0, fanTrust: 0, squadMorale: 0,
    reputation: 0, mediaGoodwill: 0, supportersTrust: 0, followers: 0,
  };
  for (const e of effects) {
    out.fanSentiment += e.fanSentiment ?? 0;
    out.fanExcitement += e.fanExcitement ?? 0;
    out.fanTrust += e.fanTrust ?? 0;
    out.squadMorale += e.squadMorale ?? 0;
    out.reputation += e.reputation ?? 0;
    out.mediaGoodwill += e.mediaGoodwill ?? 0;
    out.supportersTrust += e.supportersTrust ?? 0;
    out.followers += e.followers ?? 0;
    if (e.playerMorale) {
      out.playerMorale = out.playerMorale && out.playerMorale.playerId === e.playerMorale.playerId
        ? { playerId: e.playerMorale.playerId, delta: out.playerMorale.delta + e.playerMorale.delta }
        : e.playerMorale;
    }
    if (e.rivalryHeat) {
      out.rivalryHeat = out.rivalryHeat && out.rivalryHeat.opponentClubId === e.rivalryHeat.opponentClubId
        ? { opponentClubId: e.rivalryHeat.opponentClubId, delta: out.rivalryHeat.delta + e.rivalryHeat.delta }
        : e.rivalryHeat;
    }
  }
  return out;
}

export interface EffectLine {
  readonly key: string;
  readonly label: string;
  readonly delta: number;
  readonly good: boolean;
}

/**
 * The consequences, in the player's language.
 *
 * Everything is stated before it is committed. A system that hid the downside
 * of the provocative option and let the player discover it later would be a
 * trick rather than a decision, and the whole point of the tone menu is that it
 * is a decision.
 */
export function describeEffect(effect: SocialEffect, state?: GameState): EffectLine[] {
  const lines: EffectLine[] = [];
  const add = (key: string, label: string, delta: number | undefined, goodWhenPositive = true) => {
    if (!delta || Math.abs(delta) < 0.25) return;
    lines.push({
      key, label, delta: Math.round(delta * 10) / 10,
      good: goodWhenPositive ? delta > 0 : delta < 0,
    });
  };
  add('fanSentiment', 'Fan mood', effect.fanSentiment);
  add('fanExcitement', 'Excitement', effect.fanExcitement);
  add('fanTrust', 'Fan trust', effect.fanTrust);
  add('squadMorale', 'Dressing room', effect.squadMorale);
  add('reputation', 'Club reputation', effect.reputation);
  add('mediaGoodwill', 'Media goodwill', effect.mediaGoodwill);
  add('supportersTrust', "Supporters' trust", effect.supportersTrust);
  add('followers', 'Followers', effect.followers);
  if (effect.playerMorale) {
    const name = state?.players[effect.playerMorale.playerId]?.displayName;
    add('playerMorale', name ? `${name}'s morale` : 'His morale', effect.playerMorale.delta);
  }
  if (effect.rivalryHeat) {
    const name = state?.clubs[effect.rivalryHeat.opponentClubId]?.shortName;
    lines.push({
      key: 'rivalryHeat',
      label: name ? `Heat with ${name}` : 'Rivalry heat',
      delta: Math.round(effect.rivalryHeat.delta * 10) / 10,
      // More heat is neither good nor bad on its own; it is stated as a rise.
      good: effect.rivalryHeat.delta < 0,
    });
  }
  return lines;
}

/** Scale every numeric field of an effect. Used for importance and damping. */
export function scaleEffect(effect: SocialEffect, factor: number): SocialEffect {
  return {
    ...(effect.fanSentiment !== undefined ? { fanSentiment: effect.fanSentiment * factor } : {}),
    ...(effect.fanExcitement !== undefined ? { fanExcitement: effect.fanExcitement * factor } : {}),
    ...(effect.fanTrust !== undefined ? { fanTrust: effect.fanTrust * factor } : {}),
    ...(effect.squadMorale !== undefined ? { squadMorale: effect.squadMorale * factor } : {}),
    ...(effect.reputation !== undefined ? { reputation: effect.reputation * factor } : {}),
    ...(effect.mediaGoodwill !== undefined ? { mediaGoodwill: effect.mediaGoodwill * factor } : {}),
    ...(effect.supportersTrust !== undefined ? { supportersTrust: effect.supportersTrust * factor } : {}),
    ...(effect.followers !== undefined ? { followers: effect.followers * factor } : {}),
    ...(effect.playerMorale
      ? { playerMorale: { ...effect.playerMorale, delta: effect.playerMorale.delta * factor } }
      : {}),
    ...(effect.rivalryHeat
      ? { rivalryHeat: { ...effect.rivalryHeat, delta: effect.rivalryHeat.delta * factor } }
      : {}),
  };
}

/** Importance 1-5 to the multiplier every social consequence is scaled by. */
export const importanceScale = (importance: number): number =>
  A.importanceScale[clamp(Math.round(importance), 1, 5)] ?? 1;
