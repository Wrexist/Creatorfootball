import type { Rng } from '../core/rng';
import { clamp } from '../core/math';
import type { SocialPostKind } from '../simulation/ports';
import { SOCIAL_BALANCE as S } from './balance';

/**
 * How far a post travels, and how big the feed renders it.
 *
 * Extracted so the world's chatter, the player's own posts, press reaction and
 * creator drops are all measured on one scale. Two engagement models would be
 * visible immediately: the player's posts would read either implausibly huge or
 * oddly ignored next to the feed around them, and the illusion the whole
 * surface depends on would be gone.
 */

export interface Engagement { likes: number; reposts: number; replies: number }

/** Derived from reach and stakes; the jitter band is deliberately narrow. */
export function engagementFor(
  reach: number,
  importance: number,
  sentiment: number,
  rng: Rng,
): Engagement {
  const importanceMult = 1 + (importance - 2) * S.importanceEngagement;
  const feelingMult = 1 + Math.abs(sentiment) * S.sentimentEngagement;
  const jitter = rng.float(S.jitter[0], S.jitter[1]);
  const likes = Math.max(1, Math.round(reach * S.baseEngagementRate * importanceMult * feelingMult * jitter));
  const reposts = Math.max(0, Math.round(likes * S.repostRatio * (1 + Math.abs(sentiment) * 0.5)));
  const replyBoost = sentiment < 0 ? S.negativeReplyBoost : 1;
  const replies = Math.max(0, Math.round(likes * S.replyRatio * replyBoost));
  return { likes, reposts, replies };
}

/** Feed weight: importance dominates, engagement is the tiebreak. */
export function weightFor(kind: SocialPostKind, importance: number, likes: number): number {
  const engagementTerm = Math.log10(likes + 10) * S.weightPerEngagementDecade;
  const kindBonus = S.kindWeightBonus[kind] ?? 0;
  return clamp(Math.round(importance * S.weightPerImportance + engagementTerm + kindBonus), 1, 100);
}
