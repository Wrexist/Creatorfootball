import type { MatchId } from '../core/brand';
import type { Rng } from '../core/rng';
import { clamp } from '../core/math';
import type { DecisionOption, DecisionOutcome, DecisionPrompt, DecisionTrigger } from './decisions';
import type { Side } from './events';
import { BALANCE } from './balance';

/**
 * Live decisions.
 *
 * The player is not a joystick. Across a thirty-minute match he gets a handful
 * of moments where the game stops and asks him a real question, and the
 * questions have to arrive when the match is actually asking them — not on a
 * timer.
 *
 * Two invariants hold this together:
 *
 * 1. **Every option has a downside encoded in its modifiers.** There is no
 *    option in this file that only adds. If one ever appears, it stops being a
 *    decision and becomes a button, and the whole feature dies.
 * 2. **Never two prompts inside six match minutes**, and never more than the
 *    fixture's cap. Interrupting a match too often is worse than not
 *    interrupting it at all.
 *
 * After the match each choice is graded by comparing xG for and against in the
 * window that followed it against the window that preceded it. That is a
 * genuinely honest measure — it can and does return BACKFIRED for choices that
 * felt right at the time.
 */

export interface DecisionSituation {
  readonly minute: number;
  readonly tick: number;
  readonly side: Side;
  readonly matchId: MatchId;
  readonly scoreFor: number;
  readonly scoreAgainst: number;
  /** Signed for this side: +1 this side is dominant, -1 it is being battered. */
  readonly momentum: number;
  /** 0-1 share of possession over the recent window. */
  readonly possessionShare: number;
  /** Mean fatigue of this side's outfielders, 0-1. */
  readonly fatigue: number;
  /** Name of the most tired important player, if any. */
  readonly tiredPlayerName: string | null;
  /** Name of a booked player at risk of a second, if any. */
  readonly bookedPlayerName: string | null;
  /** True while a player is on the pitch injured with no substitutions left. */
  readonly injuredNoSubs: boolean;
  /** Minutes until the next swing window opens, or null. */
  readonly minutesToWindow: number | null;
  /** Set on the tick a period restarts. */
  readonly atHalfTime: boolean;
  /** Set when the opponent has just changed shape. */
  readonly opponentChanged: boolean;
  /** Set for a tick after a creator moment. */
  readonly creatorMoment: boolean;
  readonly elapsedFraction: number;
  readonly opponentName: string;
}

interface Recipe {
  readonly trigger: DecisionTrigger;
  /** Higher wins when several triggers fire on the same tick. */
  readonly priority: number;
  readonly applies: (s: DecisionSituation) => boolean;
  readonly situation: (s: DecisionSituation) => string;
  readonly options: (s: DecisionSituation) => readonly DecisionOption[];
}

const opt = (
  id: string,
  label: string,
  effect: string,
  modifiers: Record<string, number>,
  durationMinutes: number,
  risk: DecisionOption['risk'],
): DecisionOption => ({ id, label, effect, modifiers, durationMinutes, risk });

/**
 * The recipe table. Read the `effect` strings alongside the `modifiers` — they
 * must always agree, because the effect string is the promise the UI makes and
 * the modifiers are the promise the engine keeps.
 */
const RECIPES: readonly Recipe[] = [
  {
    trigger: 'UNDER_PRESSURE',
    priority: 8,
    applies: (s) => s.momentum <= -0.45 && s.elapsedFraction > 0.15,
    situation: () => "You're getting pinned back. Every clearance is coming straight back at you.",
    options: () => [
      opt('drop', 'Drop the block', 'Sit deeper and make them play round you. You will barely see the ball.',
        { defensiveSolidity: 0.2, spaceBehind: -0.16, aggression: -0.2, possessionBias: -0.16, attackVolume: -0.14 }, 8, 'LOW'),
      opt('press', 'Press out of it', 'Squeeze up and try to win it high. It costs legs and leaves space in behind.',
        { pressRecovery: 0.22, aggression: 0.22, spaceBehind: 0.2, fatigueRate: 0.28, defensiveSolidity: -0.08 }, 6, 'HIGH'),
      opt('hold', 'Ride it out', 'Keep the shape and save your legs. You hand them the initiative to do it.',
        { defensiveSolidity: 0.06, fatigueRate: -0.08, attackVolume: -0.1, volatility: 0.08 }, 6, 'MEDIUM'),
    ],
  },
  {
    trigger: 'CHASING_GAME',
    priority: 9,
    applies: (s) => s.scoreFor < s.scoreAgainst && s.elapsedFraction > 0.55,
    situation: (s) => `You're ${s.scoreAgainst - s.scoreFor} down with the clock against you. This is the moment to decide how much you gamble.`,
    options: () => [
      opt('overload', 'Push everyone up', 'Commit bodies forward. You will create more and concede the counter.',
        { attackVolume: 0.3, spaceBehind: 0.26, defensiveSolidity: -0.24, counterWeight: -0.1, fatigueRate: 0.2 }, 10, 'HIGH'),
      opt('direct', 'Go direct', 'Skip the middle and attack the box early. Cruder chances, but more of them.',
        { attackVolume: 0.16, chanceQuality: -0.16, possessionBias: -0.18, counterWeight: 0.12 }, 8, 'MEDIUM'),
      opt('patient', 'Keep the shape', 'Work an opening properly. Fewer chances, better ones, less time.',
        { chanceQuality: 0.16, possessionBias: 0.12, attackVolume: -0.08 }, 8, 'LOW'),
    ],
  },
  {
    trigger: 'PROTECTING_LEAD',
    priority: 7,
    applies: (s) => s.scoreFor > s.scoreAgainst && s.elapsedFraction > 0.62,
    situation: () => "You're in front and they're coming. How do you want to see this out?",
    options: () => [
      opt('shut', 'Shut the door', 'Everything behind the ball. You will not threaten again all match.',
        { defensiveSolidity: 0.26, aggression: -0.22, attackVolume: -0.26, possessionBias: -0.12 }, 10, 'MEDIUM'),
      opt('keep', 'Keep the ball', 'Play keep-ball in their half. It works until you lose it in a bad area.',
        { possessionBias: 0.22, chanceQuality: 0.08, attackVolume: -0.12, volatility: 0.12 }, 10, 'LOW'),
      opt('kill', 'Go and kill it', 'Chase the second goal. The best defence, until it is not.',
        { attackVolume: 0.2, defensiveSolidity: -0.16, spaceBehind: 0.14, fatigueRate: 0.14 }, 8, 'HIGH'),
    ],
  },
  {
    trigger: 'KEY_PLAYER_TIRED',
    priority: 6,
    applies: (s) => s.tiredPlayerName !== null && s.fatigue > BALANCE.SUB_FATIGUE_THRESHOLD && s.elapsedFraction > 0.45,
    situation: (s) => `${s.tiredPlayerName ?? 'Your best player'} is running on empty and the whole shape is dropping with him.`,
    options: (s) => [
      opt('rest', 'Take the tempo out', 'Slow it down and protect the legs. You surrender the initiative for it.',
        { fatigueRate: -0.2, possessionBias: 0.12, attackVolume: -0.16, aggression: -0.14 }, 8, 'LOW'),
      opt('ride', 'Ride him', `Ask ${s.tiredPlayerName ?? 'him'} for ten more minutes. He will give them, and pay for it.`,
        { attackVolume: 0.12, fatigueRate: 0.3, volatility: 0.12 }, 8, 'HIGH'),
    ],
  },
  {
    trigger: 'LOSING_MIDFIELD',
    priority: 5,
    applies: (s) => s.possessionShare < 0.4 && s.elapsedFraction > 0.2,
    situation: () => "You've lost the middle of the pitch. Everything they do starts in there.",
    options: () => [
      opt('congest', 'Congest the middle', 'Narrow up and outnumber them centrally. The flanks are theirs.',
        { defensiveSolidity: 0.16, widthBias: -0.4, chanceQuality: 0.06, attackVolume: -0.1 }, 9, 'LOW'),
      opt('bypass', 'Bypass it', 'Stop trying to play through them and go over the top instead.',
        { counterWeight: 0.22, possessionBias: -0.16, chanceQuality: -0.12, attackVolume: 0.1 }, 9, 'MEDIUM'),
      opt('man', 'Go man for man', 'Follow them everywhere. Wins the ball earlier, gives away more fouls.',
        { pressRecovery: 0.2, foulRate: 0.25, spaceBehind: 0.14, fatigueRate: 0.18 }, 7, 'HIGH'),
    ],
  },
  {
    trigger: 'STRIKER_ISOLATED',
    priority: 4,
    applies: (s) => s.possessionShare > 0.52 && s.momentum > -0.2 && s.elapsedFraction > 0.25 && s.scoreFor <= s.scoreAgainst,
    situation: () => "You have the ball and nothing to show for it. Your front man is getting no support at all.",
    options: () => [
      opt('runners', 'Send runners past him', 'Bodies beyond the striker. It opens you up on the turnover.',
        { attackVolume: 0.2, chanceQuality: 0.08, defensiveSolidity: -0.14, spaceBehind: 0.12 }, 9, 'MEDIUM'),
      opt('wide', 'Get it wide', 'Stretch them and cross. More entries, lower-value chances.',
        { widthBias: 0.45, attackVolume: 0.12, chanceQuality: -0.12 }, 9, 'LOW'),
    ],
  },
  {
    trigger: 'CARD_RISK',
    priority: 7,
    applies: (s) => s.bookedPlayerName !== null && s.elapsedFraction > 0.3,
    situation: (s) => `${s.bookedPlayerName ?? 'One of yours'} is booked and still flying into everything. The next one is red.`,
    options: (s) => [
      opt('calm', 'Tell him to pull out', 'He stops committing. He also stops winning anything.',
        { foulRate: -0.35, defensiveSolidity: -0.12, pressRecovery: -0.14 }, 12, 'LOW'),
      opt('leave', 'Leave him to it', `${s.bookedPlayerName ?? 'He'} keeps his game. You keep the risk.`,
        { foulRate: 0.08, defensiveSolidity: 0.06, volatility: 0.14 }, 12, 'HIGH'),
    ],
  },
  {
    trigger: 'INJURY_DECISION',
    priority: 9,
    applies: (s) => s.injuredNoSubs,
    situation: () => "He can't run and you have nobody left to bring on. You are playing this out one way or another.",
    options: () => [
      opt('hide', 'Hide him up front', 'Park him where he can do least damage. You defend a man light.',
        { defensiveSolidity: -0.18, attackVolume: -0.06, spaceBehind: 0.12 }, 12, 'MEDIUM'),
      opt('grit', 'Ask him to hold a position', 'He stays in the block and limps through it. Nothing works properly.',
        { defensiveSolidity: -0.08, pressRecovery: -0.2, fatigueRate: 0.12 }, 12, 'MEDIUM'),
    ],
  },
  {
    trigger: 'SPECIAL_RULE_CHOICE',
    priority: 10,
    applies: (s) => s.minutesToWindow !== null && s.minutesToWindow <= 2 && s.minutesToWindow > 0,
    situation: () => "The swing window is about to open. Everything that happens in the next few minutes counts for more.",
    options: () => [
      opt('front', 'Go at it', 'Attack the window. The rewards are doubled and so is the damage.',
        { attackVolume: 0.26, defensiveSolidity: -0.2, volatility: 0.2, fatigueRate: 0.16 }, 5, 'HIGH'),
      opt('survive', 'Survive it', 'Batten down for three minutes. You will not score during it either.',
        { defensiveSolidity: 0.26, attackVolume: -0.24, aggression: -0.14 }, 5, 'LOW'),
      opt('legs', 'Save the legs', 'Coast into the window fresh. You concede the minutes before it.',
        { fatigueRate: -0.3, attackVolume: -0.16, pressRecovery: -0.2 }, 4, 'MEDIUM'),
    ],
  },
  {
    trigger: 'MOMENTUM_SWING',
    priority: 6,
    applies: (s) => s.momentum >= 0.5 && s.elapsedFraction > 0.2,
    situation: () => "You've got them. The crowd knows it and so do they.",
    options: () => [
      opt('press_on', 'Go for the throat', 'Turn the screw while it lasts. If it breaks, you are exposed.',
        { attackVolume: 0.24, aggression: 0.18, fatigueRate: 0.24, defensiveSolidity: -0.14 }, 7, 'HIGH'),
      opt('bank', 'Bank it', 'Take the sting out and keep what you have. The spell ends here.',
        { possessionBias: 0.16, defensiveSolidity: 0.12, attackVolume: -0.16 }, 7, 'LOW'),
    ],
  },
  {
    trigger: 'OPPONENT_SHAPE_CHANGE',
    priority: 5,
    applies: (s) => s.opponentChanged && s.elapsedFraction > 0.2,
    situation: (s) => `${s.opponentName} have changed shape. You can react now or find out the hard way.`,
    options: () => [
      opt('mirror', 'Match them', 'Copy the change and neutralise it. You also give up whatever you were doing well.',
        { defensiveSolidity: 0.14, attackVolume: -0.1, chanceQuality: 0.06 }, 8, 'LOW'),
      opt('ignore', 'Back your own plan', 'Stick to it and force them to solve you instead.',
        { attackVolume: 0.12, volatility: 0.14, defensiveSolidity: -0.08 }, 8, 'MEDIUM'),
    ],
  },
  {
    trigger: 'HALFTIME_TALK',
    priority: 8,
    applies: (s) => s.atHalfTime,
    situation: (s) => s.scoreFor < s.scoreAgainst
      ? "Fifteen minutes left and you're behind. What do they hear in there?"
      : "Half time. What do they hear in there?",
    options: () => [
      opt('rockets', 'Tear into them', 'They come out furious. Furious players foul.',
        { aggression: 0.16, pressRecovery: 0.16, foulRate: 0.3, fatigueRate: 0.14 }, 8, 'HIGH'),
      opt('arm', 'Arm round the shoulder', 'Calm heads, better decisions, less intensity.',
        { chanceQuality: 0.12, foulRate: -0.2, aggression: -0.12, attackVolume: -0.06 }, 8, 'LOW'),
      opt('tactical', 'Talk them through it', 'Fix the shape rather than the mood. Slower to take effect.',
        { defensiveSolidity: 0.12, chanceQuality: 0.08, volatility: -0.12, attackVolume: -0.04 }, 12, 'MEDIUM'),
    ],
  },
  {
    trigger: 'CREATOR_OPPORTUNITY',
    priority: 4,
    applies: (s) => s.creatorMoment,
    situation: () => "The arena has just come alive. There is a window here while the noise lasts.",
    options: () => [
      opt('ride_noise', 'Feed off it', 'Ask for everything while the place is bouncing. It will cost them later.',
        { aggression: 0.2, attackVolume: 0.18, fatigueRate: 0.26 }, 5, 'MEDIUM'),
      opt('settle', 'Settle them down', 'Take the emotion out and play. You waste the moment.',
        { chanceQuality: 0.1, volatility: -0.16, attackVolume: -0.1 }, 5, 'LOW'),
    ],
  },
  {
    trigger: 'SET_PIECE_CALL',
    priority: 3,
    applies: (s) => s.elapsedFraction > 0.3 && s.momentum > -0.3 && s.possessionShare > 0.45,
    situation: () => "Dead ball in a dangerous area. How do you want it delivered?",
    options: () => [
      opt('load', 'Load the box', 'Everyone up including the keeper. Nobody is home if it comes back.',
        { attackVolume: 0.16, defensiveSolidity: -0.2, spaceBehind: 0.18 }, 3, 'HIGH'),
      opt('short', 'Work it short', 'Keep possession and rebuild. Safe, and rarely a goal.',
        { possessionBias: 0.14, chanceQuality: 0.06, attackVolume: -0.08 }, 3, 'LOW'),
    ],
  },
];

export interface DecisionEngineOptions {
  readonly matchId: MatchId;
  readonly maxDecisions: number;
  readonly matchMinutes: number;
  /** Which side the human is managing; prompts are only raised for that side. */
  readonly sides: readonly Side[];
  /** 0-100. Scales how large the chosen option's effect actually lands. */
  readonly adaptability: number;
}

export class DecisionEngine {
  private issued = 0;
  private lastMinute = -Infinity;
  private counter = 0;
  private readonly outcomes: DecisionOutcome[] = [];

  constructor(private readonly rng: Rng, private readonly opts: DecisionEngineOptions) {}

  get prompted(): number { return this.issued; }

  /** Returns a prompt if this tick is genuinely worth interrupting for. */
  consider(s: DecisionSituation): DecisionPrompt | null {
    if (this.issued >= this.opts.maxDecisions) return null;
    if (!this.opts.sides.includes(s.side)) return null;
    if (s.minute - this.lastMinute < BALANCE.DECISION_COOLDOWN_MINUTES) return null;
    if (s.elapsedFraction < BALANCE.DECISION_EARLIEST_FRACTION && !s.atHalfTime) return null;
    if (s.elapsedFraction > BALANCE.DECISION_LATEST_FRACTION) return null;

    const eligible = RECIPES.filter((r) => r.applies(s));
    if (eligible.length === 0) return null;

    // Highest priority wins; ties are broken by the seeded stream so the same
    // match always asks the same question at the same moment.
    const topPriority = Math.max(...eligible.map((r) => r.priority));
    const top = eligible.filter((r) => r.priority === topPriority);
    const recipe = top.length === 1 ? (top[0] as Recipe) : this.rng.pick(top);

    const options = recipe.options(s);
    if (options.length < 2) return null;

    this.issued += 1;
    this.lastMinute = s.minute;
    this.counter += 1;

    return {
      id: `${this.opts.matchId as unknown as string}:dec:${this.counter}`,
      matchId: this.opts.matchId,
      minute: s.minute,
      tick: s.tick,
      side: s.side,
      trigger: recipe.trigger,
      situation: recipe.situation(s),
      options,
      timeoutSeconds: BALANCE.DECISION_TIMEOUT_SECONDS,
      defaultOptionId: (options[0] as DecisionOption).id,
    };
  }

  /**
   * Scale an option's modifiers by the manager's adaptability. A tactically
   * limited manager gets a diluted version of the same instruction — the sign
   * is never flipped, so a downside stays a downside.
   */
  scaleModifiers(modifiers: Readonly<Record<string, number>>): Record<string, number> {
    const gain = 1 - BALANCE.MANAGER_ADAPTABILITY_WEIGHT
      + BALANCE.MANAGER_ADAPTABILITY_WEIGHT * 2 * clamp(this.opts.adaptability / 100, 0, 1);
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(modifiers)) out[k] = v * gain;
    return out;
  }

  record(promptId: string, optionId: string, minute: number): void {
    this.outcomes.push({ promptId, optionId, minute });
  }

  recorded(): readonly DecisionOutcome[] { return this.outcomes; }
}

/** Per-minute xG generated for and against a side. Index 0 is minute 0. */
export interface XgTimeline {
  readonly forSide: readonly number[];
  readonly against: readonly number[];
}

/**
 * Grade every decision by comparing the window after it with the window before
 * it, in xG created minus xG conceded, per minute. Anything inside the noise
 * band is NEUTRAL — claiming a verdict the data does not support would be worse
 * than admitting nothing much happened.
 */
export function evaluateDecisions(
  outcomes: readonly DecisionOutcome[],
  timelines: Readonly<Record<Side, XgTimeline>>,
  sideOf: (promptId: string) => Side,
  matchMinutes: number,
): DecisionOutcome[] {
  const window = BALANCE.DECISION_EVAL_WINDOW;

  return outcomes.map((o) => {
    const side = sideOf(o.promptId);
    const timeline = timelines[side];

    const beforeStart = Math.max(0, o.minute - window);
    const beforeEnd = o.minute;
    const afterStart = o.minute;
    const afterEnd = Math.min(matchMinutes, o.minute + window);

    const beforeMinutes = Math.max(1, beforeEnd - beforeStart);
    const afterMinutes = Math.max(1, afterEnd - afterStart);

    const forBefore = slice(timeline.forSide, beforeStart, beforeEnd) / beforeMinutes;
    const forAfter = slice(timeline.forSide, afterStart, afterEnd) / afterMinutes;
    const againstBefore = slice(timeline.against, beforeStart, beforeEnd) / beforeMinutes;
    const againstAfter = slice(timeline.against, afterStart, afterEnd) / afterMinutes;

    const xgDelta = forAfter - forBefore;
    const xgAgainstDelta = againstAfter - againstBefore;
    const net = xgDelta - xgAgainstDelta;

    const verdict: 'WORKED' | 'NEUTRAL' | 'BACKFIRED' =
      net > BALANCE.DECISION_WORKED_THRESHOLD ? 'WORKED'
      : net < -BALANCE.DECISION_WORKED_THRESHOLD ? 'BACKFIRED'
      : 'NEUTRAL';

    return {
      promptId: o.promptId,
      optionId: o.optionId,
      minute: o.minute,
      evaluation: {
        xgDelta: round3(xgDelta),
        xgAgainstDelta: round3(xgAgainstDelta),
        verdict,
      },
    };
  });
}

const slice = (xs: readonly number[], from: number, to: number): number => {
  let total = 0;
  for (let i = Math.max(0, Math.floor(from)); i < Math.min(xs.length, Math.ceil(to)); i++) {
    total += xs[i] ?? 0;
  }
  return total;
};

const round3 = (v: number): number => Math.round(v * 1000) / 1000;

export const DECISION_RECIPE_COUNT = RECIPES.length;
