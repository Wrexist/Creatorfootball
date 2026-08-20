import { useMemo } from 'react';
import {
  SQUAD_ROLE_LABELS,
  agentFeeFor,
  askingPrice,
  contractFor,
  deservedRole,
  estimatedOverall,
  knowledgeConfidence,
  marketValue,
  potentialRange,
  wageDemand,
  type GameState,
  type Player,
  type TransferListing,
} from '@cf/engine';
import { valuationContext } from './engine';

/**
 * The story around a target.
 *
 * A transfer is not a price. It is a club that does or does not want to sell, a
 * player who thinks he is worth a particular role, an agent taking his cut, and
 * a queue of other clubs behind you. Every one of those is a number the engine
 * already computes — `askingPrice`, `marketValue`, `wageDemand`, `deservedRole`,
 * `agentFeeFor` — and this file's whole job is to ask the engine for them and
 * turn each into a sentence. Nothing below decides anything.
 *
 * The scouting rule holds throughout: where the engine's knowledge bands have
 * not collapsed, the story says "around" and shows a range. It never prints a
 * confident figure over an unscouted player.
 */

export interface TargetStory {
  /** What the selling club will quote. 0 for a free agent — there is no fee. */
  readonly asking: number;
  /** What the wider market thinks he is worth, ignoring who is buying. */
  readonly value: number;
  /** asking ÷ value. Above 1 means the seller is holding out. */
  readonly priceRatio: number;
  readonly priceLine: string;
  readonly wage: number;
  readonly wageLine: string;
  /** Role he believes he is entitled to, in the engine's own words. */
  readonly roleLine: string;
  /** How many clubs are visibly circling. */
  readonly suitors: number;
  readonly suitorLine: string;
  /** What the agent takes on top, at the quoted price. */
  readonly agentFee: number;
  readonly agentLine: string;
  readonly contractLine: string;
  /** Ability, honestly: exact when scouted, a band when not. */
  readonly abilityLine: string;
  readonly scouted: boolean;
  /** The single line worth leading a card with. */
  readonly headline: string;
  /** A short second line for a rail card, sized to fit without clamping. */
  readonly cardLine: string;
}

const money = (value: number): string => {
  if (value >= 1_000_000) return `£${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}m`;
  if (value >= 1_000) return `£${Math.round(value / 1_000)}k`;
  return `£${Math.round(value)}`;
};

export function buildTargetStory(
  state: GameState,
  player: Player,
  listing: TransferListing | undefined,
): TargetStory {
  const ctx = valuationContext(state);
  const sellingClub = player.clubId ? state.clubs[player.clubId] ?? null : null;
  const value = marketValue(player, ctx);
  const asking = listing?.askingPrice ?? (sellingClub ? askingPrice(player, sellingClub, ctx) : 0);
  const wage = listing?.wageDemand ?? wageDemand(player, ctx);
  const suitors = listing?.interestedClubIds.length ?? 0;
  const contract = contractFor(state, player.id);
  const confidence = knowledgeConfidence(player);
  const scouted = confidence >= 0.95;
  const estimate = estimatedOverall(player);
  const [potentialLow, potentialHigh] = potentialRange(player);
  const ratio = value > 0 ? asking / value : 1;
  const agentFee = agentFeeFor(asking, wage, suitors);

  const priceLine = sellingClub === null
    ? 'A free agent. No fee to anyone — only wages and the agent.'
    : ratio >= 1.35
      ? `They want ${money(asking)}, well above the ${money(value)} the market says he is worth. This club does not need to sell.`
      : ratio >= 1.1
        ? `They want ${money(asking)} against a market value of ${money(value)} — a premium, but a negotiable one.`
        : ratio <= 0.9
          ? `They will take ${money(asking)} for a player the market values at ${money(value)}. Somebody needs the money.`
          : `They want ${money(asking)}, which is about what he is worth.`;

  const roleLine = `He expects to be a ${SQUAD_ROLE_LABELS[deservedRole(player, ctx)].toLowerCase()}. Offer him less and the wage demand goes up.`;

  const suitorLine = suitors === 0
    ? 'No other club is visibly interested. You are not bidding against anyone yet.'
    : suitors === 1
      ? 'One other club is watching him. A second bidder changes the price.'
      : `${suitors} other clubs are watching him. The more of them there are, the more his agent takes.`;

  const contractLine = !contract
    ? 'No contract to buy out.'
    : contract.weeksRemaining <= 8
      ? `His deal runs out in ${contract.weeksRemaining} weeks, which is exactly why he is this cheap.`
      : `He has ${contract.weeksRemaining} weeks left on his current deal.`;

  const abilityLine = scouted
    ? `Rated ${player.overall}, with a ceiling of ${player.potential}.`
    : `Our scouts put him around ${estimate}, ceiling somewhere between ${potentialLow} and ${potentialHigh}. Send a scout to narrow it.`;

  // Ordered by how much the signal actually changes what you would do. Price
  // band comes last: with a role premium and a big-club tax on top, most quotes
  // sit above market value, so leading with it made every card say the same
  // thing — which is the sameness this screen was rebuilt to remove.
  const runningDown = contract !== undefined && contract.weeksRemaining <= 8;
  const headline = sellingClub === null
    ? 'Free agent — no fee'
    : runningDown ? 'Deal running down'
      : suitors >= 2 ? `${suitors} clubs circling`
        : ratio <= 0.9 ? 'Priced to move'
          : suitors === 1 ? 'One rival watching'
            : ratio >= 1.35 ? 'Priced to stay'
              : 'Available at his value';

  // The asking price is already on the card. This line says what the price
  // *means* — repeating the number is the "form, not a story" failure again.
  const cardLine = sellingClub === null
    ? 'No fee to anyone. He is free to talk to whoever he likes.'
    : runningDown
      ? `Only ${contract.weeksRemaining} weeks left on his deal, which is why he is this cheap.`
      : suitors >= 2
        ? `Every extra bidder puts the agent's cut up.`
        : ratio <= 0.9
          ? `Below his ${money(value)} valuation — somebody needs the cash.`
          : ratio >= 1.35
            ? `Well above his ${money(value)} valuation. They do not need to sell.`
            : `About the ${money(value)} the market says he is worth.`;

  return {
    asking,
    value,
    priceRatio: ratio,
    priceLine,
    wage,
    wageLine: `He wants ${money(wage)} a week. That comes out of every week of the deal, not once.`,
    roleLine,
    suitors,
    suitorLine,
    agentFee,
    agentLine: `His agent will want about ${money(agentFee)} on top of the fee.`,
    contractLine,
    abilityLine,
    scouted,
    headline,
    cardLine,
  };
}

export function useTargetStory(
  state: GameState,
  player: Player | undefined,
  listing: TransferListing | undefined,
): TargetStory | null {
  return useMemo(
    () => (player ? buildTargetStory(state, player, listing) : null),
    [state, player, listing],
  );
}
