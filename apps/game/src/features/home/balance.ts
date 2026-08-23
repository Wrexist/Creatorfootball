/**
 * Home-feed shape tuning.
 *
 * The priority engine scores every candidate on four axes and renders the top
 * few. These numbers decide how the axes trade against each other and how much
 * screen a single week may fill; they change what the player sees first, never
 * what is true.
 */
export const HOME_BALANCE = {
  /**
   * Axis weights. Urgency and importance dominate, novelty and emotion break
   * ties — a repeat warning should lose to a fresh crisis of the same size.
   */
  weight: { urgency: 0.32, importance: 0.3, novelty: 0.14, emotion: 0.24 },
  /** Below this a card is not worth a slot; the screen is better off shorter. */
  floor: 0.26,
  /** Cards rendered at most, so the page stays a summary rather than a list. */
  maxCards: 5,
  /** Two from any one part of the game — otherwise a bad week is six squad cards. */
  maxPerFamily: 2,
} as const;
