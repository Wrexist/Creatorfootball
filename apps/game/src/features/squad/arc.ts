import {
  clubById, contractFor,
  type GameState, type Player,
} from '@cf/engine';
import { formatMoney } from '@/design';

/**
 * The player arc.
 *
 * A profile made of attributes tells you what a player *is*. It does not tell
 * you what he has *been through at your club*, and that is the difference
 * between a row in a database and someone you would be sad to sell. "Joined at
 * 61, four starts, first goal against Verrow, now 66, worth 34% more than you
 * paid" is a story; "PAC 68 SHO 61" is a spreadsheet.
 *
 * Every entry is reconstructed from the engine's own record — the domain event
 * journal (`state.eventLog`), the player's season history and his contract.
 * Nothing here is invented, estimated or simulated: if the world did not emit
 * an event for it, it does not appear.
 */

export type ArcTone = 'neutral' | 'volt' | 'positive' | 'warning' | 'danger' | 'special';

export interface ArcEntry {
  readonly id: string;
  readonly cycle: number;
  readonly title: string;
  readonly detail?: string;
  /** "Season 2 · week 6", or "Now". */
  readonly when: string;
  readonly tone: ArcTone;
}

export interface PlayerArc {
  readonly entries: readonly ArcEntry[];
  /** Fee paid for him by his current club, when the journal recorded one. */
  readonly feePaid: number | null;
  /** Change in market value since that fee, as a percentage. */
  readonly valueChange: number | null;
}

const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many);

const when = (season: number, week: number): string =>
  (week > 0 ? `S${season} · wk ${week}` : `Season ${season}`);

export function playerArc(state: GameState, player: Player): PlayerArc {
  const entries: ArcEntry[] = [];
  const log = state.eventLog;
  let feePaid: number | null = null;

  /* --- arrival ------------------------------------------------------- */

  const signed = [...log]
    .reverse()
    .find((e) => e.type === 'PLAYER_SIGNED' && e.payload.playerId === player.id);
  if (signed && signed.type === 'PLAYER_SIGNED') {
    const from = signed.payload.fromClubId ? clubById(state, signed.payload.fromClubId) : undefined;
    const to = clubById(state, signed.payload.clubId);
    feePaid = signed.payload.fee;
    entries.push({
      id: `signed:${signed.id}`,
      cycle: signed.cycle,
      when: when(signed.season, signed.week),
      tone: 'volt',
      title: `Signed for ${to?.shortName ?? 'the club'}`,
      detail: from
        ? `From ${from.name}${signed.payload.fee > 0 ? ` for ${formatMoney(signed.payload.fee)}` : ' on a free transfer'}.`
        : 'His first professional contract.',
    });
  } else {
    const promoted = [...log]
      .reverse()
      .find((e) => e.type === 'YOUTH_PROSPECT_PROMOTED' && e.payload.playerId === player.id);
    if (promoted && promoted.type === 'YOUTH_PROSPECT_PROMOTED') {
      entries.push({
        id: `promoted:${promoted.id}`,
        cycle: promoted.cycle,
        when: when(promoted.season, promoted.week),
        tone: 'special',
        title: 'Promoted from the academy',
        detail: 'He came through your own youth setup rather than being bought.',
      });
    } else {
      const contract = contractFor(state, player.id);
      const club = player.clubId ? clubById(state, player.clubId) : undefined;
      if (contract && club) {
        entries.push({
          id: `joined:${contract.id}`,
          cycle: contract.signedCycle,
          when: contract.signedCycle === 0 ? 'At the start' : `Cycle ${contract.signedCycle}`,
          tone: 'neutral',
          title: `On the books at ${club.shortName}`,
          detail: contract.signedCycle === 0
            ? 'He was already here when you took the job.'
            : 'Signed his current deal.',
        });
      }
    }
  }

  /* --- goals, awards, cards, injuries ------------------------------- */

  const goals = log.filter((e) => e.type === 'GOAL_SCORED' && e.payload.scorerId === player.id);
  const firstGoal = goals[0];
  if (firstGoal && firstGoal.type === 'GOAL_SCORED') {
    entries.push({
      id: `firstgoal:${firstGoal.id}`,
      cycle: firstGoal.cycle,
      when: when(firstGoal.season, firstGoal.week),
      tone: 'positive',
      title: 'First goal for the club',
      detail: `Scored on ${firstGoal.payload.minute} minutes.`,
    });
  }
  for (const milestone of [5, 10, 25, 50]) {
    const event = goals[milestone - 1];
    if (event) {
      entries.push({
        id: `goal${milestone}:${event.id}`,
        cycle: event.cycle,
        when: when(event.season, event.week),
        tone: 'positive',
        title: `${milestone}th goal`,
        detail: 'Another one for the record.',
      });
    }
  }

  const motm = log.filter((e) => e.type === 'MOTM_AWARDED' && e.payload.playerId === player.id);
  const lastMotm = motm[motm.length - 1];
  if (lastMotm && lastMotm.type === 'MOTM_AWARDED') {
    entries.push({
      id: `motm:${lastMotm.id}`,
      cycle: lastMotm.cycle,
      when: when(lastMotm.season, lastMotm.week),
      tone: 'volt',
      title: motm.length > 1 ? `Player of the match, for the ${motm.length}th time` : 'Player of the match',
      detail: `Rated ${lastMotm.payload.rating.toFixed(1)} in that game.`,
    });
  }

  const breakout = [...log]
    .reverse()
    .find((e) => e.type === 'PLAYER_BREAKOUT' && e.payload.playerId === player.id);
  if (breakout && breakout.type === 'PLAYER_BREAKOUT') {
    entries.push({
      id: `breakout:${breakout.id}`,
      cycle: breakout.cycle,
      when: when(breakout.season, breakout.week),
      tone: 'volt',
      title: 'Took a big step forward',
      detail: `His overall jumped to ${breakout.payload.overall}.`,
    });
  }

  const developed = log.filter((e) => e.type === 'PLAYER_DEVELOPED' && e.payload.playerId === player.id);
  const bigGain = [...developed]
    .filter((e): e is Extract<typeof e, { type: 'PLAYER_DEVELOPED' }> => e.type === 'PLAYER_DEVELOPED')
    .sort((a, b) => (b.payload.to - b.payload.from) - (a.payload.to - a.payload.from))[0];
  if (bigGain) {
    entries.push({
      id: `dev:${bigGain.id}`,
      cycle: bigGain.cycle,
      when: when(bigGain.season, bigGain.week),
      tone: 'positive',
      title: 'Training paid off',
      detail: `${bigGain.payload.attribute} improved from ${Math.round(bigGain.payload.from)} to ${Math.round(bigGain.payload.to)}.`,
    });
  }

  const injuries = log.filter((e) => e.type === 'PLAYER_INJURED' && e.payload.playerId === player.id);
  const worstInjury = [...injuries]
    .filter((e): e is Extract<typeof e, { type: 'PLAYER_INJURED' }> => e.type === 'PLAYER_INJURED')
    .sort((a, b) => b.payload.weeksOut - a.payload.weeksOut)[0];
  if (worstInjury) {
    entries.push({
      id: `injury:${worstInjury.id}`,
      cycle: worstInjury.cycle,
      when: when(worstInjury.season, worstInjury.week),
      tone: 'danger',
      title: injuries.length > 1 ? `Injured — the worst of ${injuries.length}` : 'Injured',
      detail: `Out for ${worstInjury.payload.weeksOut} ${plural(worstInjury.payload.weeksOut, 'week', 'weeks')}.`,
    });
  }

  const red = [...log]
    .reverse()
    .find((e) => e.type === 'RED_CARD' && e.payload.playerId === player.id);
  if (red && red.type === 'RED_CARD') {
    entries.push({
      id: `red:${red.id}`,
      cycle: red.cycle,
      when: when(red.season, red.week),
      tone: 'danger',
      title: 'Sent off',
      detail: `Red card on ${red.payload.minute} minutes.`,
    });
  }

  /* --- completed seasons ---------------------------------------------- */

  for (const season of player.history) {
    entries.push({
      id: `season:${season.season}`,
      // Season summaries carry no cycle of their own. A synthetic negative key
      // ordered by season number files them ahead of anything from the current
      // campaign, in the order they were actually lived.
      cycle: season.season - 1000,
      when: `Season ${season.season}`,
      tone: 'neutral',
      title: `${season.appearances} ${plural(season.appearances, 'appearance', 'appearances')}, ${season.goals} ${plural(season.goals, 'goal', 'goals')}`,
      detail: `${season.clubId ? clubById(state, season.clubId)?.shortName ?? 'Another club' : 'No club'} · average rating ${season.averageRating.toFixed(1)}${season.motm > 0 ? ` · ${season.motm} player of the match` : ''}.`,
    });
  }

  /* --- where he is now ------------------------------------------------- */

  const valueChange = feePaid !== null && feePaid > 0
    ? Math.round(((player.marketValue - feePaid) / feePaid) * 100)
    : null;

  entries.push({
    id: 'now',
    cycle: state.clock.cycle,
    when: 'Now',
    tone: 'volt',
    title: `Rated ${player.overall}, ${player.age} years old`,
    detail: player.form.appearances > 0
      ? `${player.form.appearances} ${plural(player.form.appearances, 'appearance', 'appearances')} this season, ${player.form.goals} ${plural(player.form.goals, 'goal', 'goals')} and ${player.form.assists} ${plural(player.form.assists, 'assist', 'assists')}.`
      : 'He has not played a competitive game for you yet.',
  });

  entries.sort((a, b) => a.cycle - b.cycle);
  return { entries, feePaid, valueChange };
}
