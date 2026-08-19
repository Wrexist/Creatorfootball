import {
  SQUAD_ROLE_LABELS,
  totalCommitment,
  type NegotiationStage,
  type NegotiationTerms,
  type SquadRole,
} from '@cf/engine';
import { plainMoney } from './format';

/**
 * Turning an offer into a sentence.
 *
 * The transcript only reads like a negotiation if both halves of it are in the
 * player's own voice. These are pure formatters over terms the player chose —
 * they describe a decision, they never make one.
 */

export const ROLE_ORDER: readonly SquadRole[] = ['PROSPECT', 'SQUAD', 'ROTATION', 'STARTER', 'STAR'];

export const roleLabel = (role: string): string =>
  SQUAD_ROLE_LABELS[role as SquadRole] ?? role;

export function describeOffer(
  stage: NegotiationStage,
  terms: NegotiationTerms,
  agentFee: number,
  playerName: string,
): string {
  if (stage === 'AGENT_TALKS') {
    return `We can go to ${plainMoney(agentFee)} for the agent, and not a penny more.`;
  }
  if (stage === 'PLAYER_TALKS') {
    const extras: string[] = [];
    if (terms.signingBonus > 0) extras.push(`${plainMoney(terms.signingBonus)} to sign`);
    if (terms.goalBonus > 0) extras.push(`${plainMoney(terms.goalBonus)} a goal`);
    if (terms.appearanceBonus > 0) extras.push(`${plainMoney(terms.appearanceBonus)} an appearance`);
    if (terms.releaseClause !== null) extras.push(`a ${plainMoney(terms.releaseClause)} release clause`);
    const tail = extras.length ? `, plus ${extras.join(', ')}` : '';
    return `Our offer to ${playerName}: ${plainMoney(terms.wage)} a week for ${terms.years} year${terms.years === 1 ? '' : 's'} as a ${roleLabel(terms.role).toLowerCase()}${tail}.`;
  }
  return `We have bid ${plainMoney(terms.fee)} for ${playerName}.`;
}

/** What this deal costs across its whole life, not just today. */
export const lifetimeCost = (terms: NegotiationTerms, agentFee: number): number =>
  totalCommitment(terms.fee, terms.wage, terms.years, terms.signingBonus) + agentFee;

export interface Gap {
  readonly delta: number;
  readonly ratio: number;
  readonly label: string;
  readonly tone: 'positive' | 'warning' | 'danger' | 'neutral';
}

/** How far apart the two sides are on one number. Description, not prediction. */
export function gapBetween(offer: number, demand: number): Gap {
  if (demand <= 0) return { delta: 0, ratio: 1, label: 'No demand', tone: 'neutral' };
  const ratio = offer / demand;
  const delta = offer - demand;
  if (ratio >= 1) return { delta, ratio, label: 'At or above their number', tone: 'positive' };
  const short = Math.round((1 - ratio) * 100);
  return {
    delta,
    ratio,
    label: `${short}% short`,
    tone: short <= 10 ? 'warning' : 'danger',
  };
}
