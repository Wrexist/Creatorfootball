import { useMemo } from 'react';
import {
  estimatedOverall,
  potentialRange,
  squadNeeds,
  type GameState,
  type Player,
  type Position,
  type TransferListing,
} from '@cf/engine';

/**
 * The market, curated.
 *
 * A search box is a tool for someone who already knows what they want. A market
 * screen has to be interesting to somebody who does not — so the front door is
 * six rails, each of which is an *answer to a question a manager actually asks*
 * rather than a sort order:
 *
 *   Featured      the best players you could realistically go and get
 *   Rising        form is up; the price will follow
 *   Undervalued   the asking price is below what the market says he is worth
 *   Trending      the ones every other club is looking at
 *   Creators      players who are also creators — reach as well as ability
 *   Prospects     young, unfinished, and cheap while they still are
 *
 * Every rail is a filter over engine state. Ability filters run on
 * `estimatedOverall`, never on the true rating, so an unscouted player cannot
 * leak his real ability by appearing in a "best available" list.
 */

export type RailId = 'FEATURED' | 'RISING' | 'UNDERVALUED' | 'TRENDING' | 'CREATORS' | 'PROSPECTS';

export interface Rail {
  readonly id: RailId;
  readonly title: string;
  /** What the rail is, in one plain line. Always shown — never a mystery. */
  readonly blurb: string;
  readonly players: readonly Player[];
  /** Shown instead of the rail when nothing qualifies. */
  readonly emptyLine: string;
}

export interface RailEntry {
  readonly player: Player;
  readonly listing: TransferListing | undefined;
}

const RAIL_SIZE = 8;

/** A player the club could actually buy: not ours, and on the market. */
const isTarget = (state: GameState, player: Player): boolean =>
  player.clubId !== state.playerClubId;

export function useMarketRails(state: GameState): Rail[] {
  return useMemo(() => {
    const listings = state.transfers.listings;
    const all = Object.values(state.players).filter((p) => isTarget(state, p));
    const listed = all.filter((p) => listings[p.id] !== undefined);
    const needs: readonly Position[] = squadNeeds(state, state.playerClubId);

    const featured = listed
      .filter((p) => {
        const listing = listings[p.id];
        return listing?.availability === 'AVAILABLE' || listing?.availability === 'WANTED_BY_OTHERS';
      })
      .sort((a, b) => {
        // A player in a position we are thin at is more interesting than a
        // better player we already have three of.
        const need = (p: Player): number => (needs.includes(p.position) ? 6 : 0);
        return estimatedOverall(b) + need(b) - (estimatedOverall(a) + need(a));
      })
      .slice(0, RAIL_SIZE);

    const rising = all
      .filter((p) => p.form.appearances > 0 && p.form.rating > 0.12)
      .sort((a, b) => b.form.rating - a.form.rating)
      .slice(0, RAIL_SIZE);

    const undervalued = listed
      .filter((p) => {
        const listing = listings[p.id];
        return listing !== undefined && listing.askingPrice < p.marketValue * 0.92;
      })
      .sort((a, b) => {
        const da = (listings[a.id]?.askingPrice ?? 0) / Math.max(1, a.marketValue);
        const db = (listings[b.id]?.askingPrice ?? 0) / Math.max(1, b.marketValue);
        return da - db;
      })
      .slice(0, RAIL_SIZE);

    const trending = listed
      .filter((p) => (listings[p.id]?.interestedClubIds.length ?? 0) > 0)
      .sort(
        (a, b) =>
          (listings[b.id]?.interestedClubIds.length ?? 0) -
          (listings[a.id]?.interestedClubIds.length ?? 0),
      )
      .slice(0, RAIL_SIZE);

    const creators = all
      .filter((p) => p.creatorId !== undefined && state.creators[p.creatorId] !== undefined)
      .sort((a, b) => {
        const fa = a.creatorId ? state.creators[a.creatorId]?.followers ?? 0 : 0;
        const fb = b.creatorId ? state.creators[b.creatorId]?.followers ?? 0 : 0;
        return fb - fa;
      })
      .slice(0, RAIL_SIZE);

    const prospects = all
      .filter((p) => p.age <= 21)
      .sort((a, b) => {
        // Sorted on the disclosed ceiling, which is what the player is allowed
        // to know. An unscouted wonderkid does not jump the queue.
        const [, ceilingA] = potentialRange(a);
        const [, ceilingB] = potentialRange(b);
        return ceilingB - ceilingA;
      })
      .slice(0, RAIL_SIZE);

    return [
      {
        id: 'FEATURED',
        title: 'Featured',
        blurb: needs.length > 0
          ? `The best players on the market, with your thin positions (${needs.join(', ')}) pushed to the front.`
          : 'The best players currently available to buy.',
        players: featured,
        emptyLine: 'Nothing is listed for sale yet. Clubs list players when the window opens.',
      },
      {
        id: 'RISING',
        title: 'Rising',
        blurb: 'Playing well right now. Form pushes a valuation up, so these get more expensive the longer you wait.',
        players: rising,
        emptyLine: 'Nobody has played enough football yet for form to mean anything.',
      },
      {
        id: 'UNDERVALUED',
        title: 'Undervalued',
        blurb: 'The asking price is below what the market says the player is worth — usually a club that needs the cash.',
        players: undervalued,
        emptyLine: 'Every listed player is priced at or above his value at the moment.',
      },
      {
        id: 'TRENDING',
        title: 'Trending',
        blurb: 'Other clubs are already circling. Move early or bid against them later.',
        players: trending,
        emptyLine: 'No club has declared an interest in anyone yet.',
      },
      {
        id: 'CREATORS',
        title: 'Creators',
        blurb: 'Players who are also creators. They bring an audience with them, and it posts about you either way.',
        players: creators,
        emptyLine: 'No creator-players are on the market right now.',
      },
      {
        id: 'PROSPECTS',
        title: 'Prospects',
        blurb: 'Twenty-one and under. Cheap while nobody is sure how good they will be — which is the entire point of scouting.',
        players: prospects,
        emptyLine: 'No young players are available yet.',
      },
    ];
  }, [state]);
}
