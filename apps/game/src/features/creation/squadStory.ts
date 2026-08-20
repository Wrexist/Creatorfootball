import {
  POSITION_GROUPS, autoLineup, positionGroup,
  type Formation, type Player, type PositionGroup,
} from '@cf/engine';

/**
 * The three players the game introduces, and the one sentence about the squad
 * that the tactical choice on the same screen answers.
 *
 * This is presentation logic over engine data and it lives outside the
 * component on purpose: nothing here computes a rating, a valuation or an
 * outcome. `overall`, `potential`, `age` and the starting eleven all come from
 * the engine — `autoLineup` decides who actually starts, so "the problem" is
 * the weakest player the player will really field, not the worst name on a
 * spreadsheet they were never going to pick.
 */

export type StoryRole = 'STAR' | 'PROSPECT' | 'PROBLEM';

export interface SquadStoryCard {
  readonly role: StoryRole;
  readonly player: Player;
  /** The eyebrow above the card. Two words at most. */
  readonly label: string;
  /** One honest line. Never a number. */
  readonly line: string;
}

const GROUP_LABEL: Record<PositionGroup, string> = {
  GK: 'goalkeepers',
  DEF: 'defence',
  MID: 'midfield',
  ATT: 'attack',
};

const GROUP_ORDER: readonly PositionGroup[] = ['GK', 'DEF', 'MID', 'ATT'];

/** Cover the 7-a-side format actually needs: a spare keeper, then depth per line. */
const MINIMUM_COVER: Record<PositionGroup, number> = { GK: 2, DEF: 4, MID: 5, ATT: 3 };

/** Anybody at or under this is young enough that the ceiling is the story. */
const PROSPECT_AGE = 22;

const byOverall = (a: Player, b: Player): number => b.overall - a.overall;

/**
 * The three cards, in the order the brief asks for them: the best, the future,
 * and the one who is going to cost you a game. All three are always distinct —
 * on a very small squad the fallbacks walk down the list rather than repeating
 * a face, because seeing the same player three times is worse than seeing an
 * imperfect third pick.
 */
export function squadStory(
  squad: readonly Player[],
  formation: Formation,
): readonly SquadStoryCard[] {
  if (squad.length === 0) return [];

  const ranked = [...squad].sort(byOverall);
  const taken = new Set<Player['id']>();
  const claim = (player: Player | undefined): Player | undefined => {
    if (!player || taken.has(player.id)) return undefined;
    taken.add(player.id);
    return player;
  };

  const star = claim(ranked[0]);

  // Highest ceiling among the young. Potential is the engine's number and it is
  // never shown — it only decides which face goes here.
  const young = squad
    .filter((p) => p.age <= PROSPECT_AGE)
    .sort((a, b) => b.potential - a.potential || b.overall - a.overall);
  const prospect =
    claim(young.find((p) => !taken.has(p.id))) ??
    claim([...squad].sort((a, b) => a.age - b.age || b.overall - a.overall).find((p) => !taken.has(p.id)));

  // The weakest player who is actually going to start. `autoLineup` is the same
  // function that fills the team sheet, so this is a real starter every week.
  const lineup = autoLineup(squad, formation);
  const byId = new Map(squad.map((p) => [p.id, p]));
  const starters = Object.values(lineup.lineup)
    .map((id) => (id ? byId.get(id) : undefined))
    .filter((p): p is Player => p !== undefined);
  const weakestStarter = [...starters].sort((a, b) => a.overall - b.overall)
    .find((p) => !taken.has(p.id));
  const problem =
    claim(weakestStarter) ??
    claim([...ranked].reverse().find((p) => !taken.has(p.id)));

  const cards: SquadStoryCard[] = [];
  if (star) {
    cards.push({
      role: 'STAR',
      player: star,
      label: 'Your best',
      line: 'Build the side around him until somebody better walks through the door.',
    });
  }
  if (prospect) {
    cards.push({
      role: 'PROSPECT',
      player: prospect,
      label: 'The prospect',
      line: `${prospect.age} years old and nowhere near finished. Play him and find out.`,
    });
  }
  if (problem) {
    cards.push({
      role: 'PROBLEM',
      player: problem,
      label: 'The problem',
      line: 'He starts every week whether you like it or not, and this is where they will aim.',
    });
  }
  return cards;
}

export interface SquadShapeNote {
  readonly headline: string;
  readonly detail: string;
}

/**
 * The one thing about the squad worth saying out loud, phrased so the shape
 * choice underneath it is obviously the answer.
 *
 * A gap in cover beats a weak average, because one injury there ends the week —
 * and if neither is true we say so rather than inventing a crisis.
 */
export function squadShapeNote(squad: readonly Player[]): SquadShapeNote {
  const groups = GROUP_ORDER.map((group) => {
    const players = squad.filter((p) => positionGroup(p.position) === group);
    const total = players.reduce((sum, p) => sum + p.overall, 0);
    return {
      group,
      count: players.length,
      average: players.length > 0 ? Math.round(total / players.length) : 0,
      short: Math.max(0, MINIMUM_COVER[group] - players.length),
    };
  });

  const missing = [...groups].filter((g) => g.short > 0).sort((a, b) => b.short - a.short)[0];
  if (missing) {
    return {
      headline: `You are short in ${GROUP_LABEL[missing.group]}`,
      detail:
        `${missing.count} fit for ${POSITION_GROUPS[missing.group].length} shirts. ` +
        'One injury there and you are improvising. Pick a shape that hides it.',
    };
  }

  const weakest = [...groups]
    .filter((g) => g.count > 0)
    .sort((a, b) => a.average - b.average)[0];
  if (!weakest) return { headline: 'No squad yet', detail: '' };
  return {
    headline: `Your ${GROUP_LABEL[weakest.group]} is the weak link`,
    detail: 'It is the first thing every rival in this league will aim at. Set up accordingly.',
  };
}

/**
 * The three shapes offered at the first team talk, defensive to attacking.
 *
 * Six seven-a-side formations exist and all six are on the tactics screen. Three
 * is what the first three minutes can carry, and these three are the three that
 * differ in the only way a newcomer can feel: how many bodies are behind the
 * ball.
 */
export const FIRST_SHAPE_IDS: readonly string[] = ['3-2-1', '2-3-1', '2-1-3'];

/** The plain-language framing for each opening shape. Not a stat, a consequence. */
export const SHAPE_CONSEQUENCE: Readonly<Record<string, string>> = {
  '3-2-1': 'Safest start. You will be very hard to beat and you may not score.',
  '2-3-1': 'The neutral option. Nothing is exaggerated and nothing is exposed.',
  '2-1-3': 'Front foot from the first whistle. More goals, in both directions.',
};
