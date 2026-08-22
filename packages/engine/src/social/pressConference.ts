import type { ClubId, EventId, PlayerId } from '../core/brand';
import type { AnyDomainEvent } from '../core/events';
import type { GameState, SocialPost } from '../game/state';
import type { Club } from '../clubs/club';
import type { Player } from '../players/player';
import type { Manager } from '../creators/manager';
import { Rng } from '../core/rng';
import { clamp } from '../core/math';
import { clubToken, personToken, type ContentRegistryPort } from '../simulation/ports';
import { seedFrom } from '../simulation/templating';
import { creatorReach } from '../creators/creator';
import { nextFixture, recentForm, injuredPlayers, expiringContracts, squadOf } from '../game/selectors';
import { rivalriesOf, rivalOpponent } from '../rivalries/rivalries';
import { OUTLETS } from '../media/balance';
import { FAN_PERSONAS, SOCIAL_ACTION_BALANCE as A, SOCIAL_BALANCE as S } from './balance';
import { applySocialEffect, describeEffect, mergeEffects, scaleEffect, type EffectLine, type SocialEffect } from './effects';
import { appendPosts, postRenderContext, renderPost, type PostAuthor } from './postFactory';
import { socialStanding } from './standing';
import { socialWorld, withSocialWorld, type PlayerAction, type PressConferenceRecord, type SocialStake } from './worldState';

/**
 * The press conference.
 *
 * Three questions, and every answer is a trade. The room wants a headline, the
 * dressing room wants protecting and the supporters want to hear that somebody
 * is angry — and there is no answer that gives all three of them what they
 * want. Defending a struggling player lifts him and costs you with the press;
 * throwing him under the bus does exactly the reverse. That is the whole game
 * of this screen, and it is why the effects are always shown before the answer
 * is given.
 *
 * Questions are *earned*. Each one declares what has to be true of the save
 * before it can be asked, so a reporter never asks about an injury crisis you
 * do not have, and the answer options are always about a specific named person
 * or fixture rather than about football in general.
 */

export type PressSlot = 'PRE' | 'POST';

export interface PressContext {
  readonly state: GameState;
  readonly club: Club;
  readonly manager: Manager | null;
  readonly slot: PressSlot;
  readonly anchorEventId: EventId;
  readonly opponent: Club | null;
  readonly opponentId: ClubId | null;
  readonly derby: boolean;
  readonly rivalryHeat: number;
  readonly form: readonly ('W' | 'D' | 'L')[];
  readonly winless: number;
  readonly unbeaten: number;
  readonly lastResult: 'W' | 'D' | 'L' | null;
  readonly lastScore: string | null;
  readonly lastMargin: number;
  readonly worstMorale: Player | null;
  readonly bestPlayer: Player | null;
  readonly injured: readonly Player[];
  readonly expiring: readonly Player[];
  readonly fanSentiment: number;
  readonly goodwill: number;
  readonly trust: number;
  readonly standing: string;
  readonly newSigning: Player | null;
  readonly hostileCreator: string | null;
}

export interface PressAnswer {
  readonly id: string;
  readonly label: string;
  /** What the manager actually says, in the room. */
  readonly line: string;
  readonly effect: SocialEffect;
  readonly lines: readonly EffectLine[];
  /** Set when the answer is a promise the results will be measured against. */
  readonly stake: { readonly kind: SocialStake['kind']; readonly claim: string; readonly weight: number } | null;
  readonly warmth: number;
  readonly credibility: number;
}

export interface PressQuestion {
  readonly id: string;
  readonly topic: string;
  readonly reporter: string;
  readonly outlet: string;
  readonly avatarSeed: string;
  readonly text: string;
  readonly answers: readonly PressAnswer[];
  readonly subjectPlayerId?: PlayerId;
}

export interface PressConference {
  readonly id: string;
  readonly slot: PressSlot;
  readonly anchorEventId: EventId;
  readonly title: string;
  readonly subtitle: string;
  readonly cycle: number;
  readonly questions: readonly PressQuestion[];
  readonly goodwill: number;
}

/* --- the question bank --------------------------------------------------- */

interface AnswerDef {
  readonly id: string;
  readonly label: string;
  readonly line: (c: PressContext) => string;
  /**
   * Alternate readings of the same answer. When present, one is chosen at
   * random per conference, so a manager who gives the same instruction two
   * weeks running does not verbatim repeat himself to the same room.
   */
  readonly variants?: readonly ((c: PressContext) => string)[];
  /** Raw weights, scaled by importance and softened by media handling. */
  readonly effect: (c: PressContext) => SocialEffect;
  readonly warmth: number;
  readonly credibility: number;
  readonly stake?: { readonly kind: SocialStake['kind']; readonly weight: number; readonly claim: (c: PressContext) => string };
}

interface QuestionDef {
  readonly id: string;
  readonly topic: string;
  readonly slots: readonly PressSlot[];
  readonly weight: number;
  readonly applies: (c: PressContext) => boolean;
  readonly text: (c: PressContext) => string;
  readonly subject?: (c: PressContext) => PlayerId | undefined;
  readonly answers: readonly AnswerDef[];
}

const name = (p: Player | null): string => p?.displayName ?? 'him';
const opp = (c: PressContext): string => c.opponent?.shortName ?? 'them';

/**
 * Home form, read from completed fixtures rather than asserted. Questions about
 * a fortress or a leaky ground are only askable when the record actually
 * exists — inventing either is how a press room loses a manager's trust.
 */
const homeRecord = (c: PressContext): { played: number; wins: number; winlessRun: number; unbeatenRun: number } => {
  const played = Object.values(c.state.fixtures)
    .filter((f) => f.status === 'COMPLETED' && f.homeScore !== null && f.awayScore !== null && f.homeClubId === c.club.id)
    .sort((a, b) => a.week - b.week);
  const resultOf = (f: (typeof played)[number]): 'W' | 'D' | 'L' => {
    const us = f.homeScore as number;
    const them = f.awayScore as number;
    return us > them ? 'W' : us < them ? 'L' : 'D';
  };
  let winlessRun = 0;
  for (let i = played.length - 1; i >= 0 && resultOf(played[i]!) !== 'W'; i--) winlessRun += 1;
  let unbeatenRun = 0;
  for (let i = played.length - 1; i >= 0 && resultOf(played[i]!) !== 'L'; i--) unbeatenRun += 1;
  return { played: played.length, wins: played.filter((f) => resultOf(f) === 'W').length, winlessRun, unbeatenRun };
};

/** The player's club's live sponsorship deals. Empty for AI clubs by design. */
const activeDeals = (c: PressContext) =>
  c.state.sponsors.active.filter((d) => d.sponsorId);

/** Season week, for questions that only make sense at a particular time. */
const seasonWeek = (c: PressContext): number =>
  c.state.seasons[c.state.currentSeasonId]?.currentWeek ?? c.state.clock.week;

/**
 * Answer weights, read as a design table.
 *
 * `squadMorale` is what the dressing room hears, `mediaGoodwill` is what the
 * room hears, `fanSentiment` is what the stands hear. Almost every row trades
 * at least one of them against another; the few that do not are deliberately
 * bland and cost reach instead.
 */
const QUESTIONS: readonly QuestionDef[] = [
  {
    id: 'q_form_bad',
    topic: 'Form',
    slots: ['PRE', 'POST'],
    weight: 5,
    applies: (c) => c.winless >= 3,
    text: (c) => `${c.winless} without a win. At what point does this stop being a bad run and start being a problem?`,
    answers: [
      {
        id: 'a_own_it', label: 'Take it on yourself',
        line: () => 'It is on me. The players have been asked to do something and I have not made it clear enough. That is my job and I am not going to hide behind them.',
        variants: [
          () => 'They will hear it from me in the morning before they hear it from anybody else, and it will not be about effort. The plan is mine.',
        ],
        effect: () => ({ squadMorale: 2.4, mediaGoodwill: 2.6, fanSentiment: -0.8 }),
        warmth: 0.7, credibility: 0.6,
      },
      {
        id: 'a_blame_room', label: 'Say the standards slipped',
        line: () => 'The plan is fine. The application has not been. Some of them know exactly who they are and they have heard it already this week.',
        effect: () => ({ squadMorale: -3.2, mediaGoodwill: 1.8, fanSentiment: 2.6 }),
        warmth: -0.6, credibility: 0.4,
      },
      {
        id: 'a_promise', label: 'Promise it turns on Saturday',
        line: (c) => `We will beat ${opp(c)}. Write it down, print it, I do not mind. We will beat them.`,
        effect: () => ({ fanSentiment: 3.4, fanExcitement: 3, mediaGoodwill: -2.2, squadMorale: 1.2 }),
        warmth: 0.2, credibility: -0.3,
        stake: {
          kind: 'GUARANTEE', weight: 0.85,
          claim: (c) => `You guaranteed a win over ${opp(c)} in front of the whole room.`,
        },
      },
      {
        id: 'a_stonewall', label: 'Give them nothing',
        line: () => 'Next question.',
        variants: [
          () => 'You have asked four people that question today and printed four versions of the same nothing. Here is a fifth.',
          () => 'There are days when saying less is the entire job. Today is one of them.',
        ],
        effect: () => ({ mediaGoodwill: -3.4, squadMorale: 0.8, fanSentiment: -0.4 }),
        warmth: -0.2, credibility: 0.1,
      },
    ],
  },
  {
    id: 'q_form_good',
    topic: 'Form',
    slots: ['PRE', 'POST'],
    weight: 4,
    applies: (c) => c.unbeaten >= 3,
    text: (c) => `${c.unbeaten} unbeaten. Is this squad better than anyone outside the building realised?`,
    answers: [
      {
        id: 'a_stay_grounded', label: 'Refuse to get carried away',
        line: () => 'It is three games. I have been in this sport long enough to know what three games is worth in March. Ask me again in April.',
        effect: () => ({ mediaGoodwill: 2.4, squadMorale: 0.6, fanExcitement: -0.6 }),
        warmth: 0.3, credibility: 0.7,
      },
      {
        id: 'a_credit_them', label: 'Credit the players',
        line: () => 'They have been outstanding. Not one of them has asked me for anything except more work, and you can print that.',
        variants: [
          () => 'Every drill, every recovery day, every meeting. If there is a better group in this division I have not coached it.',
        ],
        effect: () => ({ squadMorale: 3, fanSentiment: 1.6, mediaGoodwill: 1 }),
        warmth: 0.8, credibility: 0.4,
      },
      {
        id: 'a_declare', label: 'Say the quiet part',
        line: (c) => `We are going to be a problem for everybody this season, ${opp(c)} included. That is not arrogance, that is just where we are.`,
        effect: () => ({ fanExcitement: 4, fanSentiment: 2.4, mediaGoodwill: -2, squadMorale: -0.8 }),
        warmth: 0, credibility: -0.2,
        stake: { kind: 'PRE_MATCH_TALK', weight: 0.7, claim: () => 'You told the sport to take you seriously. It is now watching.' },
      },
    ],
  },
  {
    id: 'q_player_struggling',
    topic: 'A player',
    slots: ['PRE', 'POST'],
    weight: 6,
    applies: (c) => c.worstMorale !== null && c.worstMorale.mental.morale < 40,
    subject: (c) => c.worstMorale?.id,
    text: (c) => `${name(c.worstMorale)} has looked short of it for weeks. Is he still one of your best players?`,
    answers: [
      {
        id: 'a_defend', label: 'Defend him without qualification',
        line: (c) => `${name(c.worstMorale)} will play on Saturday and he will play the week after. He has earned that, and the people questioning him have earned nothing.`,
        effect: (c) => ({
          ...(c.worstMorale ? { playerMorale: { playerId: c.worstMorale.id, delta: 11 } } : {}),
          squadMorale: 2.2, mediaGoodwill: -3, fanSentiment: -1.6,
        }),
        warmth: 0.9, credibility: 0.2,
        stake: {
          kind: 'PUBLIC_BACKING', weight: 0.8,
          claim: (c) => `You staked yourself on ${name(c.worstMorale)}. What he does next is now your judgement.`,
        },
      },
      {
        id: 'a_honest', label: 'Be honest about the level',
        line: () => `He is below where he should be and he knows it. He is working. That is all I will say about it here.`,
        variants: [
          () => 'His standards have dropped and he is the first to admit it. That conversation happened on Monday, between us, where it belongs.',
        ],
        effect: (c) => ({
          ...(c.worstMorale ? { playerMorale: { playerId: c.worstMorale.id, delta: -3 } } : {}),
          mediaGoodwill: 2.6, fanSentiment: 0.8, squadMorale: -0.4,
        }),
        warmth: 0.1, credibility: 0.8,
      },
      {
        id: 'a_bury', label: 'Say what everyone is thinking',
        line: (c) => `Nobody is guaranteed anything here. If ${name(c.worstMorale)} wants to be picked he can show me on Thursday like everybody else.`,
        effect: (c) => ({
          ...(c.worstMorale ? { playerMorale: { playerId: c.worstMorale.id, delta: -13 } } : {}),
          squadMorale: -2.6, mediaGoodwill: 3.2, fanSentiment: 2.8,
        }),
        warmth: -0.85, credibility: 0.3,
      },
    ],
  },
  {
    id: 'q_star_wanted',
    topic: 'Transfers',
    slots: ['PRE', 'POST'],
    weight: 4,
    applies: (c) => c.bestPlayer !== null && c.bestPlayer.overall >= 68,
    subject: (c) => c.bestPlayer?.id,
    text: (c) => `There is talk about ${name(c.bestPlayer)}. Can you promise he is still here in a month?`,
    answers: [
      {
        id: 'a_not_for_sale', label: 'He is not for sale',
        line: (c) => `${name(c.bestPlayer)} is not for sale. Not at any number anybody has said out loud, and not at the numbers they have not.`,
        effect: (c) => ({
          fanSentiment: 3.2,
          ...(c.bestPlayer ? { playerMorale: { playerId: c.bestPlayer.id, delta: 5 } } : {}),
          mediaGoodwill: -1, squadMorale: 1.2,
        }),
        warmth: 0.6, credibility: -0.1,
        stake: { kind: 'GUARANTEE', weight: 0.6, claim: (c) => `You told everybody ${name(c.bestPlayer)} is staying.` },
      },
      {
        id: 'a_every_player', label: 'Every player has a price',
        line: () => 'Every player at every club in this sport has a number. That is not a scandal, it is arithmetic. Nobody has come close to ours.',
        effect: () => ({ mediaGoodwill: 2.8, fanSentiment: -2.2, squadMorale: -0.6 }),
        warmth: -0.2, credibility: 0.8,
      },
      {
        id: 'a_deflect', label: 'Refuse to discuss it',
        line: () => 'I am not doing transfer questions in a football press conference. Ask me about Saturday.',
        effect: () => ({ mediaGoodwill: -2, fanSentiment: -0.4, squadMorale: 0.6 }),
        warmth: 0, credibility: 0.3,
      },
    ],
  },
  {
    id: 'q_derby',
    topic: 'The derby',
    slots: ['PRE'],
    weight: 7,
    applies: (c) => c.derby && c.opponent !== null,
    text: (c) => `${opp(c)} have said they are not remotely worried about you. Any response?`,
    answers: [
      {
        id: 'a_fire_back', label: 'Fire straight back',
        line: () => `They should be worried. They have been worried since the last one and everybody in that building knows it. We will see them on Saturday.`,
        effect: (c) => ({
          fanExcitement: 5, fanSentiment: 2.6, mediaGoodwill: -3,
          ...(c.opponentId ? { rivalryHeat: { opponentClubId: c.opponentId, delta: 7 } } : {}),
        }),
        warmth: -0.7, credibility: -0.1,
        stake: { kind: 'CALL_OUT', weight: 1, claim: (c) => `You went at ${opp(c)} on the record. Saturday settles it.` },
      },
      {
        id: 'a_dead_bat', label: 'Refuse the bait',
        line: (c) => `They can say what they like. I have no interest in a war of words with ${opp(c)} or anybody else. There is a match on Saturday.`,
        effect: (c) => ({
          mediaGoodwill: 3, squadMorale: 0.8, fanExcitement: -1.4,
          ...(c.opponentId ? { rivalryHeat: { opponentClubId: c.opponentId, delta: -2 } } : {}),
        }),
        warmth: 0.3, credibility: 0.7,
      },
      {
        id: 'a_joke', label: 'Laugh it off',
        line: () => `Good. I would hate for them to be worried. I would hate for them to prepare at all, in fact.`,
        effect: (c) => ({
          fanExcitement: 3.4, fanSentiment: 1.8, mediaGoodwill: -0.6,
          ...(c.opponentId ? { rivalryHeat: { opponentClubId: c.opponentId, delta: 3.5 } } : {}),
        }),
        warmth: 0.1, credibility: -0.4,
      },
    ],
  },
  {
    id: 'q_defeat',
    topic: 'The result',
    slots: ['POST'],
    weight: 8,
    applies: (c) => c.lastResult === 'L',
    text: (c) => `${c.lastScore ?? 'That'}. What did you actually see out there?`,
    answers: [
      {
        id: 'a_ref', label: 'Point at the officials',
        line: () => 'I will get fined for saying what I think about the second goal, so I will say this instead: we deserved better from the people in the middle.',
        effect: () => ({ mediaGoodwill: -4, fanSentiment: 2.4, squadMorale: 1.8, reputation: -0.6 }),
        warmth: -0.3, credibility: -0.6,
      },
      {
        id: 'a_truth', label: 'Say they were beaten',
        line: (c) => `We were second to everything for an hour. ${opp(c)} were better. There is no version of that where I stand here and pretend otherwise.`,
        variants: [
          () => 'The better team won, comfortably, and any other answer would insult everybody who watched it.',
        ],
        effect: () => ({ mediaGoodwill: 3.4, fanSentiment: -1, squadMorale: -1.4 }),
        warmth: 0, credibility: 0.9,
      },
      {
        id: 'a_shield', label: 'Shield the players',
        line: () => 'They ran until they could not run. I am not standing here criticising a group who gave me that. The setup was mine and it did not work.',
        effect: () => ({ squadMorale: 3.2, mediaGoodwill: 1.4, fanSentiment: -1.8 }),
        warmth: 0.85, credibility: 0.4,
      },
      {
        id: 'a_furious', label: 'Be visibly furious',
        line: () => 'Embarrassing. That is the word. If any of them are unhappy about hearing it out here, they had ninety minutes to stop me saying it.',
        effect: () => ({ squadMorale: -3.6, fanSentiment: 3.2, mediaGoodwill: 2, fanExcitement: 1.4 }),
        warmth: -0.8, credibility: 0.5,
      },
    ],
  },
  {
    id: 'q_win',
    topic: 'The result',
    slots: ['POST'],
    weight: 7,
    applies: (c) => c.lastResult === 'W',
    text: (c) => `${c.lastScore ?? 'A win'}. Was that the best you have been?`,
    answers: [
      {
        id: 'a_yes', label: 'Say yes, loudly',
        line: () => 'Yes. Best we have played, best we have looked, best we have been at it. I have waited a while to say that.',
        effect: () => ({ fanExcitement: 3.6, fanSentiment: 2.4, squadMorale: 2, mediaGoodwill: -0.8 }),
        warmth: 0.5, credibility: -0.2,
      },
      {
        id: 'a_more', label: 'Say there is more to come',
        line: () => 'No. Not close. There were twenty minutes in there where we forgot how we got in front, and they know about it already.',
        variants: [
          () => 'I enjoyed it for about four minutes. Then I started listing the things that will cost us against anyone better.',
        ],
        effect: () => ({ squadMorale: -0.8, mediaGoodwill: 2.8, fanSentiment: 0.6 }),
        warmth: -0.1, credibility: 0.8,
      },
      {
        id: 'a_credit_fans', label: 'Give it to the away end',
        line: () => 'The supporters were the best thing on that pitch for the first twenty minutes. We were chasing them, not the other way round.',
        effect: () => ({ fanSentiment: 3.8, supportersTrust: 4, mediaGoodwill: 0.6 }),
        warmth: 0.9, credibility: 0.3,
      },
    ],
  },
  {
    id: 'q_draw',
    topic: 'The result',
    slots: ['POST'],
    weight: 5,
    applies: (c) => c.lastResult === 'D',
    text: () => 'A point. Two dropped, or one gained?',
    answers: [
      {
        id: 'a_two_dropped', label: 'Two dropped',
        line: () => 'Two dropped. We had the game, we stopped playing, and that is a habit I have to get out of them.',
        effect: () => ({ mediaGoodwill: 2.2, squadMorale: -1.4, fanSentiment: 0.8 }),
        warmth: -0.1, credibility: 0.7,
      },
      {
        id: 'a_one_gained', label: 'One gained',
        line: (c) => `A point at ${opp(c)} is a point. I have watched better sides than us leave that ground with nothing.`,
        effect: () => ({ squadMorale: 1.4, fanSentiment: -1.2, mediaGoodwill: 0.4 }),
        warmth: 0.4, credibility: 0.2,
      },
      {
        id: 'a_neither', label: 'Refuse the framing',
        line: () => 'It is a point in November. It will be worth something or it will be worth nothing and neither of us knows which yet.',
        variants: [
          () => 'You want a headline and I have a table that moves one place either way. Ask me in the spring which of us was right.',
        ],
        effect: () => ({ mediaGoodwill: 1.2, fanExcitement: -1 }),
        warmth: 0.1, credibility: 0.6,
      },
    ],
  },
  {
    id: 'q_injury',
    topic: 'Injuries',
    slots: ['PRE', 'POST'],
    weight: 4,
    applies: (c) => c.injured.length >= 2,
    text: (c) => `${c.injured.length} of them are in the treatment room. Is that bad luck or is something wrong with how you work them?`,
    answers: [
      {
        id: 'a_luck', label: 'Call it luck',
        line: () => 'Bad luck. I have been doing this long enough to know the difference between a run of injuries and a problem, and this is a run.',
        variants: [
          () => 'Three of them in tackles nobody would have flagged a decade ago. That is not our medical department, that is the sport getting heavier.',
        ],
        effect: () => ({ mediaGoodwill: 0.4, squadMorale: 0.8 }),
        warmth: 0.2, credibility: 0.1,
      },
      {
        id: 'a_review', label: 'Admit you are reviewing it',
        line: () => 'We are looking at everything. Loads, surfaces, the lot. If something we do is contributing then I would rather find it than defend it.',
        effect: () => ({ mediaGoodwill: 3, fanSentiment: -0.6, reputation: 0.5 }),
        warmth: 0.3, credibility: 0.85,
      },
      {
        id: 'a_facilities', label: 'Point at the budget',
        line: () => 'We do not have what the clubs above us have. That is not an excuse, it is a fact, and everybody in this room knows it.',
        effect: () => ({ mediaGoodwill: -1.6, fanSentiment: 1.4, supportersTrust: 2 }),
        warmth: 0, credibility: 0.5,
      },
    ],
  },
  {
    id: 'q_fan_unrest',
    topic: 'The supporters',
    slots: ['PRE', 'POST'],
    weight: 6,
    applies: (c) => c.fanSentiment < A.campaign.unrestSentiment,
    text: () => 'There were plenty leaving early again. What do you say to the people paying for this?',
    answers: [
      {
        id: 'a_apologise', label: 'Apologise properly',
        line: () => 'They are right and I am sorry. Nobody should pay to watch that and nobody should have to be told to stay to the end of it.',
        effect: () => ({ fanSentiment: 4, supportersTrust: 6, mediaGoodwill: 1.6, squadMorale: -1 }),
        warmth: 0.9, credibility: 0.6,
      },
      {
        id: 'a_ask_for_time', label: 'Ask for time',
        line: () => 'I understand it. I would ask for a bit longer, because what we are building does not look like anything yet and it will.',
        effect: () => ({ fanSentiment: 0.6, supportersTrust: 1.4, mediaGoodwill: 0.6 }),
        warmth: 0.4, credibility: 0.2,
      },
      {
        id: 'a_challenge', label: 'Challenge them back',
        line: () => 'They can leave early if they want. The ones who stay are the ones the players hear, and that is who I am doing this for.',
        effect: () => ({ fanSentiment: -3.4, supportersTrust: -5, squadMorale: 2.4, mediaGoodwill: -1.4 }),
        warmth: -0.8, credibility: 0.3,
      },
    ],
  },
  {
    id: 'q_job',
    topic: 'Your job',
    slots: ['PRE', 'POST'],
    weight: 6,
    applies: (c) => c.winless >= 4 || c.fanSentiment < 30,
    text: () => 'Do you still believe you are the right person for this job?',
    answers: [
      {
        id: 'a_absolutely', label: 'Absolutely',
        line: () => 'Yes. Completely. I have never been less confused about that and I do not need this room to agree with me.',
        effect: () => ({ mediaGoodwill: -1.4, squadMorale: 2, fanSentiment: 0.6, reputation: 0.4 }),
        warmth: -0.1, credibility: 0.4,
      },
      {
        id: 'a_results', label: 'Say results decide it',
        line: () => 'That is not mine to answer. I work, they decide. If it is not good enough, it is not good enough.',
        variants: [
          () => 'Boards answer that question with statements and supporters answer it with turnstiles. Both are more accurate than I am.',
        ],
        effect: () => ({ mediaGoodwill: 2.4, squadMorale: -1.6, fanSentiment: -0.8 }),
        warmth: 0, credibility: 0.7,
      },
      {
        id: 'a_deadline', label: 'Set yourself a deadline',
        line: () => 'Give me until the end of this month. If it looks like this at the end of this month then somebody should be asking a different question.',
        effect: () => ({ mediaGoodwill: 3.4, fanSentiment: 2.6, squadMorale: -2.2 }),
        warmth: 0.2, credibility: 0.6,
        stake: { kind: 'GUARANTEE', weight: 0.9, claim: () => 'You gave yourself a public deadline. The room wrote it down.' },
      },
    ],
  },
  {
    id: 'q_creator',
    topic: 'The content',
    slots: ['PRE', 'POST'],
    weight: 3,
    applies: (c) => c.hostileCreator !== null,
    text: (c) => `${c.hostileCreator} has built a fortnight of content out of your club. Do you watch it?`,
    answers: [
      {
        id: 'a_watch', label: 'Say you watch it',
        line: () => `I watch it. Some of it is funny, some of it is fair, and one of them was neither. That is the deal we all signed up to.`,
        effect: () => ({ mediaGoodwill: 2, fanSentiment: 1.4, fanExcitement: 1.2 }),
        warmth: 0.6, credibility: 0.5,
      },
      {
        id: 'a_dismiss', label: 'Dismiss it',
        line: () => 'I have a job. People who make videos about my job also have a job. They are not the same job.',
        effect: () => ({ mediaGoodwill: 0.8, fanExcitement: 1.8, supportersTrust: -0.8 }),
        warmth: -0.5, credibility: 0.3,
      },
      {
        id: 'a_invite', label: 'Invite them in',
        line: (c) => `${c.hostileCreator} can come to the training ground any Thursday they like. I would rather they were wrong about us from close up.`,
        effect: () => ({ fanExcitement: 3.2, mediaGoodwill: 1.6, reputation: 0.6 }),
        warmth: 0.8, credibility: 0.4,
      },
    ],
  },
  {
    id: 'q_contract',
    topic: 'Contracts',
    slots: ['PRE', 'POST'],
    weight: 3,
    applies: (c) => c.expiring.length > 0,
    subject: (c) => c.expiring[0]?.id,
    text: (c) => `${name(c.expiring[0] ?? null)} is into the last months of his deal. Is that being handled?`,
    answers: [
      {
        id: 'a_close', label: 'Say it is close',
        line: (c) => `Conversations are happening and they are good ones. ${name(c.expiring[0] ?? null)} wants to be here, which is most of the work done.`,
        effect: (c) => ({
          fanSentiment: 1.8,
          ...(c.expiring[0] ? { playerMorale: { playerId: c.expiring[0].id, delta: 4 } } : {}),
          mediaGoodwill: 0.6,
        }),
        warmth: 0.5, credibility: -0.2,
      },
      {
        id: 'a_his_call', label: 'Put it on him',
        line: (c) => `The offer has been there for some time. It is with ${name(c.expiring[0] ?? null)} and his people now, not with me.`,
        effect: (c) => ({
          ...(c.expiring[0] ? { playerMorale: { playerId: c.expiring[0].id, delta: -6 } } : {}),
          mediaGoodwill: 2.2, fanSentiment: 1, squadMorale: -0.8,
        }),
        warmth: -0.5, credibility: 0.6,
      },
      {
        id: 'a_no_comment', label: 'Keep it inside',
        line: () => 'Contracts are done in an office, not in here. When there is something, you will get it.',
        variants: [
          () => 'The moment there is a signature, you will have it before his agent does. Until then, nothing from me serves anybody.',
        ],
        effect: () => ({ mediaGoodwill: -1, squadMorale: 1.2 }),
        warmth: 0.2, credibility: 0.4,
      },
    ],
  },
  {
    id: 'q_youngster',
    topic: 'The academy',
    slots: ['PRE', 'POST'],
    weight: 3,
    applies: (c) => squadOf(c.state, c.club.id).some((p) => p.age <= 20 && p.overall >= 58),
    subject: (c) => squadOf(c.state, c.club.id)
      .filter((p) => p.age <= 20 && p.overall >= 58)
      .sort((a, b) => b.overall - a.overall)[0]?.id,
    text: (c) => {
      const kid = squadOf(c.state, c.club.id)
        .filter((p) => p.age <= 20 && p.overall >= 58)
        .sort((a, b) => b.overall - a.overall)[0];
      return `Everyone wants to talk about ${kid?.displayName ?? 'the young one'}. Is he ready for all of this?`;
    },
    answers: [
      {
        id: 'a_protect', label: 'Protect him',
        line: () => 'He is nineteen. He is going to have bad afternoons and I would like everybody to remember today that they were told that in advance.',
        effect: () => ({ mediaGoodwill: 2.2, squadMorale: 1, fanExcitement: -1 }),
        warmth: 0.8, credibility: 0.7,
      },
      {
        id: 'a_hype', label: 'Let the hype run',
        line: () => 'He is the best young player I have worked with. I am not going to sit here and pretend I have not noticed just to keep the temperature down.',
        effect: () => ({ fanExcitement: 4.4, fanSentiment: 2, mediaGoodwill: -1.8 }),
        warmth: 0.5, credibility: -0.4,
      },
      {
        id: 'a_earn', label: 'Make him earn it',
        line: () => 'He has played four games. There are men in that dressing room who have played four hundred and nobody is doing features on them.',
        effect: () => ({ squadMorale: 1.8, fanExcitement: -1.6, mediaGoodwill: 1.4 }),
        warmth: -0.2, credibility: 0.6,
      },
    ],
  },
  {
    id: 'q_finance',
    topic: 'Money',
    slots: ['PRE', 'POST'],
    weight: 3,
    applies: (c) => c.club.finance.transferBudget <= 0 || c.club.finance.debt > 0,
    text: () => 'There is a view that this club is running on attention rather than income. Fair?',
    answers: [
      {
        id: 'a_fair', label: 'Concede the point',
        line: () => 'Broadly, yes. Reach is not revenue until somebody converts it, and that is a job somebody upstairs does, not me.',
        effect: () => ({ mediaGoodwill: 3, fanSentiment: -1.4, reputation: 0.4 }),
        warmth: 0.1, credibility: 0.9,
      },
      {
        id: 'a_reject', label: 'Reject it',
        line: () => 'We are a football club that people happen to watch. Reverse those two and you get a very different building to the one I work in.',
        effect: () => ({ fanSentiment: 2.6, supportersTrust: 3, mediaGoodwill: -1.2 }),
        warmth: 0.5, credibility: 0.2,
      },
      {
        id: 'a_ambition', label: 'Turn it into a pitch',
        line: () => 'Come and look at the training ground in two years. Then ask me that question again and I will enjoy answering it.',
        effect: () => ({ fanExcitement: 2.8, reputation: 0.8, mediaGoodwill: 0.6 }),
        warmth: 0.4, credibility: -0.1,
      },
    ],
  },
  {
    id: 'q_tactics',
    topic: 'Tactics',
    slots: ['PRE', 'POST'],
    weight: 3,
    applies: () => true,
    text: (c) => `You keep setting up the same way against sides like ${opp(c)}. Is that conviction or stubbornness?`,
    answers: [
      {
        id: 'a_conviction', label: 'Conviction',
        line: () => 'Conviction. If I change it every time somebody asks me a question in here, the players will never know what we are.',
        variants: [
          () => 'The system is not the problem and I will defend that position with results rather than adjectives.',
        ],
        effect: () => ({ squadMorale: 1.8, mediaGoodwill: -0.8 }),
        warmth: 0.2, credibility: 0.5,
      },
      {
        id: 'a_flexible', label: 'Say you will change it',
        line: (c) => `We will look different on Saturday. ${opp(c)} will have prepared for something and I would rather it was the wrong thing.`,
        effect: () => ({ mediaGoodwill: 1.4, fanExcitement: 1.6, squadMorale: -0.6 }),
        warmth: 0.2, credibility: 0.2,
      },
      {
        id: 'a_mock', label: 'Have some fun with it',
        line: () => 'If you would like to name the eleven I would genuinely love to hear it. Take your time.',
        effect: () => ({ fanExcitement: 2.4, mediaGoodwill: -2.4, supportersTrust: 1 }),
        warmth: -0.4, credibility: -0.3,
      },
    ],
  },
  {
    id: 'q_standing_clown',
    topic: 'Your image',
    slots: ['PRE', 'POST'],
    weight: 4,
    applies: (c) => c.standing === 'CLOWN' || c.standing === 'DIVISIVE',
    text: () => 'Your club has become a running joke online. Does that bother you?',
    answers: [
      {
        id: 'a_lean_in', label: 'Lean all the way in',
        line: () => 'It is free advertising and I did not pay for a second of it. Keep going.',
        effect: () => ({ fanExcitement: 3.6, mediaGoodwill: -1.6, supportersTrust: -1.2, fanSentiment: 1 }),
        warmth: 0.2, credibility: -0.6,
      },
      {
        id: 'a_hate_it', label: 'Say it bothers you',
        line: () => 'Yes. There are people in that building who read all of it and it is not a joke to them. I would like that considered occasionally.',
        effect: () => ({ squadMorale: 2.6, mediaGoodwill: 2, fanExcitement: -1.4 }),
        warmth: 0.8, credibility: 0.7,
      },
      {
        id: 'a_reframe', label: 'Turn it around',
        line: () => 'A joke is a club nobody talks about. We were that four years ago and I do not remember anybody enjoying it.',
        effect: () => ({ fanSentiment: 2, supportersTrust: 2.4, reputation: 0.6 }),
        warmth: 0.5, credibility: 0.5,
      },
    ],
  },
  {
    id: 'q_rival_manager',
    topic: 'The other bench',
    slots: ['PRE'],
    weight: 4,
    applies: (c) => c.opponent !== null && c.rivalryHeat >= 25,
    text: (c) => `Do you actually like the manager of ${opp(c)}?`,
    answers: [
      {
        id: 'a_respect', label: 'Say the respectful thing',
        line: (c) => `I like him. I like what he has built at ${opp(c)} and I would like to beat it very badly on Saturday. Both of those are true.`,
        effect: (c) => ({
          mediaGoodwill: 2.6, reputation: 0.5,
          ...(c.opponentId ? { rivalryHeat: { opponentClubId: c.opponentId, delta: -1.5 } } : {}),
        }),
        warmth: 0.8, credibility: 0.6,
      },
      {
        id: 'a_no', label: 'Say no',
        line: () => 'No.',
        effect: (c) => ({
          fanExcitement: 4.2, mediaGoodwill: -1,
          ...(c.opponentId ? { rivalryHeat: { opponentClubId: c.opponentId, delta: 6 } } : {}),
        }),
        warmth: -0.7, credibility: 0.6,
      },
      {
        id: 'a_dodge', label: 'Not answer it',
        line: () => 'I do not know him well enough to like him or not like him, and I suspect that is how he would like it kept.',
        effect: () => ({ mediaGoodwill: 0.8 }),
        warmth: 0.1, credibility: 0.2,
      },
    ],
  },
  {
    id: 'q_signing',
    topic: 'The new man',
    slots: ['PRE', 'POST'],
    weight: 4,
    applies: (c) => c.newSigning !== null,
    subject: (c) => c.newSigning?.id,
    text: (c) => `${name(c.newSigning)} cost real money. What does he actually give you?`,
    answers: [
      {
        id: 'a_specific', label: 'Be specific about him',
        line: (c) => `${name(c.newSigning)} gives us somebody who can receive it under pressure. We have not had that and it has cost us points.`,
        effect: (c) => ({
          mediaGoodwill: 2.4,
          ...(c.newSigning ? { playerMorale: { playerId: c.newSigning.id, delta: 5 } } : {}),
          fanExcitement: 1.4,
        }),
        warmth: 0.5, credibility: 0.8,
      },
      {
        id: 'a_sell', label: 'Sell him to the supporters',
        line: () => `Watch him for twenty minutes on Saturday and you will not need me to explain it. They are going to love him.`,
        effect: (c) => ({
          fanExcitement: 4, fanSentiment: 2,
          ...(c.newSigning ? { playerMorale: { playerId: c.newSigning.id, delta: 3 } } : {}),
          mediaGoodwill: -1,
        }),
        warmth: 0.6, credibility: -0.3,
        stake: { kind: 'GUARANTEE', weight: 0.5, claim: (c) => `You promised the crowd ${name(c.newSigning)} on Saturday.` },
      },
      {
        id: 'a_temper', label: 'Lower the temperature',
        line: () => 'He is a footballer, not a solution. He will need a month like every other player who has ever moved clubs.',
        variants: [
          () => 'Give him six weeks before deciding what he is. That advice is free and it applies to everybody writing about him too.',
        ],
        effect: () => ({ mediaGoodwill: 1.8, fanExcitement: -1.6, squadMorale: 0.8 }),
        warmth: 0.2, credibility: 0.7,
      },
    ],
  },
  {
    id: 'q_ambition',
    topic: 'The season',
    slots: ['PRE'],
    weight: 2,
    applies: () => true,
    text: () => 'Give us a target. What is a good season for this club?',
    answers: [
      {
        id: 'a_bold', label: 'Name something bold',
        line: () => 'Top of it. I am not standing here talking about consolidation to people who pay to come and watch us.',
        effect: () => ({ fanExcitement: 4.4, fanSentiment: 2.4, mediaGoodwill: -2, squadMorale: -1 }),
        warmth: 0.3, credibility: -0.4,
        stake: { kind: 'GUARANTEE', weight: 0.75, claim: () => 'You named a target in public. Every result is now measured against it.' },
      },
      {
        id: 'a_process', label: 'Talk about the process',
        line: () => 'A good season is one where we are better in May than we were in August. I know that is a boring answer. It is also the true one.',
        variants: [
          () => 'A good season is one where nobody in this room can work out which of our players we can afford to lose. That is how you know it worked.',
        ],
        effect: () => ({ mediaGoodwill: 1.6, squadMorale: 1.2, fanExcitement: -1.4 }),
        warmth: 0.3, credibility: 0.8,
      },
      {
        id: 'a_deflect2', label: 'Give them nothing',
        line: () => 'Points. As many as we can get. Next.',
        effect: () => ({ mediaGoodwill: -1.8, supportersTrust: -0.8 }),
        warmth: -0.2, credibility: 0.2,
      },
    ],
  },
  {
    id: 'q_reach',
    topic: 'The audience',
    slots: ['PRE', 'POST'],
    weight: 3,
    applies: (c) => c.club.fans.onlineFollowers >= 40_000,
    text: (c) => `You have ${c.club.fans.onlineFollowers.toLocaleString('en-GB')} following this club online and a ground that holds ${c.club.stadium.capacity.toLocaleString('en-GB')}. Which number matters?`,
    answers: [
      {
        id: 'a_gate', label: 'The gate',
        line: () => 'The gate. Every time. The people online are welcome and I am glad they are there, but the ones in the ground are the ones the players can hear.',
        effect: () => ({ supportersTrust: 5, fanSentiment: 2.2, mediaGoodwill: 1.4, fanExcitement: -1 }),
        warmth: 0.7, credibility: 0.6,
      },
      {
        id: 'a_both', label: 'Both, honestly',
        line: () => 'Both. One pays for the other, and anybody who pretends otherwise has not looked at what this sport costs.',
        effect: () => ({ mediaGoodwill: 2.4, reputation: 0.6 }),
        warmth: 0.3, credibility: 0.9,
      },
      {
        id: 'a_online', label: 'The audience',
        line: () => 'The bigger one. That is not romantic but it is how this club exists at all, and I would rather say it than have somebody find it in the accounts.',
        effect: () => ({ supportersTrust: -4, fanSentiment: -1.8, reputation: 1.2, mediaGoodwill: 2 }),
        warmth: -0.3, credibility: 0.8,
      },
    ],
  },

  /* -----------------------------------------------------------------------
   * The wider bank.
   *
   * Every question below is earned the same way the originals are: the gate
   * reads real facts off the save, and a reporter never asks about a fortress
   * that does not exist or an injury crisis nobody has. Cups are not modelled
   * in this league, so nothing here references one — a question about a
   * competition the engine cannot see would be invented news.
   * -------------------------------------------------------------------- */
  {
    id: 'q_home_fortress',
    topic: 'At home',
    slots: ['PRE', 'POST'],
    weight: 3,
    applies: (c) => homeRecord(c).played >= 4 && homeRecord(c).unbeatenRun === homeRecord(c).played,
    text: () => 'You have not lost at your own ground all season. Is that the foundation everything else sits on?',
    answers: [
      {
        id: 'a_own_fortress', label: 'Own it',
        line: () => 'The ground has won us more points than any player has. Teams arrive careful and leave beaten, and that is not an accident, that is weeks of work.',
        effect: () => ({ fanSentiment: 2.6, supportersTrust: 3, mediaGoodwill: 0.8 }),
        warmth: 0.7, credibility: 0.5,
      },
      {
        id: 'a_table_math', label: 'Call it table maths',
        line: () => 'It is three points at a time, same as away from home. I would rather we were boring about it than precious.',
        effect: () => ({ mediaGoodwill: 2.4, fanExcitement: -1, squadMorale: 0.4 }),
        warmth: -0.1, credibility: 0.8,
      },
      {
        id: 'a_louder', label: 'Ask for even more',
        line: () => 'It can be better. The day that place is full and ugly for ninety minutes, somebody will get beaten by the noise before they are beaten by us.',
        variants: [
          () => 'Fill it. Every week. The players hear the difference before kick-off and so do the opposition.',
        ],
        effect: () => ({ fanExcitement: 3.6, supportersTrust: 2.4, mediaGoodwill: -1 }),
        warmth: 0.5, credibility: -0.2,
      },
    ],
  },
  {
    id: 'q_home_leaks',
    topic: 'At home',
    slots: ['PRE', 'POST'],
    weight: 4,
    applies: (c) => homeRecord(c).winlessRun >= 4,
    text: () => 'Four home games without a win, in front of your own support every time. What do you say to the people who paid for that?',
    answers: [
      {
        id: 'a_face_them', label: 'Face them directly',
        line: () => 'They have been let down and they know it better than anybody, because they watched all of it. All I can offer is that nobody here enjoys collecting money for this.',
        effect: () => ({ fanSentiment: 3, supportersTrust: 4, squadMorale: -1, mediaGoodwill: 1.2 }),
        warmth: 0.85, credibility: 0.55,
      },
      {
        id: 'a_blame_anything', label: 'Blame everything but football',
        line: () => 'You have all seen the pitch, the schedule, the turnaround times. Anybody who thinks none of that matters has never prepared a team for Wednesday after Sunday.',
        effect: () => ({ mediaGoodwill: -2.8, fanSentiment: 0.8, credibility: 0, reputation: -0.2 }),
        warmth: -0.3, credibility: -0.5,
      },
      {
        id: 'a_promise_home_win', label: 'Promise the next one',
        line: (c) => `The next home game, we win. Write whatever you like around that sentence.`,
        effect: () => ({ fanSentiment: 2.8, fanExcitement: 2.4, mediaGoodwill: -2 }),
        warmth: 0.1, credibility: -0.4,
        stake: { kind: 'GUARANTEE', weight: 0.8, claim: () => 'You guaranteed a home win with the whole room listening.' },
      },
    ],
  },
  {
    id: 'q_sponsor_unhappy',
    topic: 'Commercial',
    slots: ['PRE', 'POST'],
    weight: 4,
    applies: (c) => activeDeals(c).some((d) => d.satisfaction < 40),
    text: () => 'Your principal partner is understood to be unhappy with how their investment currently looks. Does that pressure reach you?',
    answers: [
      {
        id: 'a_business_answer', label: 'Keep it as business',
        line: () => 'Partnerships have good quarters and bad quarters, exactly like form. The conversations are professional and they stay professional.',
        effect: () => ({ mediaGoodwill: 2, fanSentiment: -1, squadMorale: -0.6 }),
        warmth: -0.1, credibility: 0.7,
      },
      {
        id: 'a_shield_room', label: 'Keep it out of the dressing room',
        line: () => 'Nothing from the commercial department reaches my players through me. They have a job; the accountants have theirs.',
        variants: [
          () => 'My players will not be reading a sponsor\'s mood anywhere near a training pitch. That is a promise, not a policy.',
        ],
        effect: () => ({ squadMorale: 2.6, mediaGoodwill: 1.4, fanSentiment: -0.6 }),
        warmth: 0.5, credibility: 0.6,
      },
      {
        id: 'a_results_are_the_advert', label: 'Results are the advert',
        line: () => 'Nobody buys a shirt because the chief executive is comfortable. We fix the football, the rest of it follows us around.',
        effect: () => ({ fanSentiment: 1.8, mediaGoodwill: -1.4, fanExcitement: 1.2 }),
        warmth: 0, credibility: 0.3,
      },
    ],
  },
  {
    id: 'q_sponsor_delight',
    topic: 'Commercial',
    slots: ['PRE', 'POST'],
    weight: 2,
    applies: (c) => activeDeals(c).some((d) => d.satisfaction > 75) && c.unbeaten >= 3,
    text: () => 'Your partner could not have bought better exposure this month. Are you allowed to enjoy that?',
    answers: [
      {
        id: 'a_enjoy_it', label: 'Enjoy it briefly',
        line: () => 'I will enjoy it until Thursday morning, which is when the next session decides what we actually are.',
        effect: () => ({ fanExcitement: 2.4, mediaGoodwill: 1.6 }),
        warmth: 0.6, credibility: -0.2,
      },
      {
        id: 'a_points_pay_wages', label: 'Points pay wages',
        line: () => 'Reach numbers are lovely and I am glad everybody is happy. Points are what pay for this building.',
        effect: () => ({ mediaGoodwill: 2.2, supportersTrust: 1.6, fanExcitement: -0.6 }),
        warmth: 0.2, credibility: 0.7,
      },
      {
        id: 'a_supporters_are_the_product', label: 'Credit the support',
        line: () => 'What they are actually buying is our supporters. Those people film, sing and travel better than any campaign we could commission.',
        effect: () => ({ fanSentiment: 2.6, supportersTrust: 3 }),
        warmth: 0.8, credibility: 0.3,
      },
    ],
  },
  {
    id: 'q_academy_intake',
    topic: 'The academy',
    slots: ['PRE'],
    weight: 3,
    applies: (c) => seasonWeek(c) <= 2 && c.club.youthSquad.length > 0,
    text: () => 'The new intake reported this week. Realistically, how many of them will ever play here?',
    answers: [
      {
        id: 'a_honest_odds', label: 'Give the honest odds',
        line: () => 'If two of this group ever start a league match for us, the academy has had a very good decade. People call that bleak. I call it the actual job.',
        effect: () => ({ mediaGoodwill: 2.8, supportersTrust: 2, fanExcitement: -0.8 }),
        warmth: 0.5, credibility: 0.9,
      },
      {
        id: 'a_back_my_judgement', label: 'Back your judgement',
        line: () => 'One of them. I would not like to name him yet, but there is one in this group the coaches already talk about in the wrong tenses.',
        effect: () => ({ fanExcitement: 2.6, mediaGoodwill: -0.8 }),
        warmth: 0.6, credibility: 0,
      },
      {
        id: 'a_point_pathway', label: 'Point to the last graduate',
        line: () => 'We promoted one into the squad within living memory of this question being asked last year. The pathway is not a poster on a wall here.',
        effect: () => ({ supportersTrust: 2.6, mediaGoodwill: 1.4 }),
        warmth: 0.4, credibility: 0.5,
      },
    ],
  },
  {
    id: 'q_heavy_win',
    topic: 'The result',
    slots: ['POST'],
    weight: 4,
    applies: (c) => c.lastResult === 'W' && c.lastMargin >= 3,
    text: (c) => `Winning by ${c.lastMargin} sends a message nobody has to interpret. Did you mean it as one?`,
    answers: [
      {
        id: 'a_message_meant', label: 'Admit it was meant',
        line: () => 'Yes. There were people outside this ground who decided how our season would go months ago. That was for them.',
        effect: (c) => ({
          fanExcitement: 4, mediaGoodwill: -1.8,
          ...(c.opponentId ? { rivalryHeat: { opponentClubId: c.opponentId, delta: 4 } } : {}),
        }),
        warmth: -0.3, credibility: -0.3,
        stake: { kind: 'CALL_OUT', weight: 0.6, claim: () => 'You dedicated a scoreline to the club\'s doubters. Loudly.' },
      },
      {
        id: 'a_no_messages', label: 'Refuse the framing',
        line: () => 'Messages are for phones. We were good at football for ninety minutes, which is the entire story I recognise.',
        variants: [
          () => 'I have never worked out what a statement win is. We scored more goals than they did. Next question.',
        ],
        effect: () => ({ mediaGoodwill: 2.6, squadMorale: 1 }),
        warmth: 0.2, credibility: 0.7,
      },
      {
        id: 'a_spread_credit', label: 'Spread the credit',
        line: () => 'The ones who ran themselves into the ground on Tuesday when nobody was watching did that today. It always starts somewhere quieter.',
        effect: () => ({ squadMorale: 3, fanSentiment: 1.8 }),
        warmth: 0.8, credibility: 0.4,
      },
    ],
  },
  {
    id: 'q_heavy_loss',
    topic: 'The result',
    slots: ['POST'],
    weight: 5,
    applies: (c) => c.lastResult === 'L' && c.lastMargin >= 3,
    text: () => 'Beaten heavily, again by a margin everyone in the ground could see coming. At what point does that become worse than a bad result?',
    answers: [
      {
        id: 'a_outlier', label: 'Insist it is an outlier',
        line: () => 'Strip that one out and look at the rest of the run. One afternoon where everything went wrong does not delete eleven other performances.',
        variants: [
          () => 'You will write that it is a pattern. I have looked at the data and I am telling you it is one afternoon that went catastrophically.',
        ],
        effect: () => ({ mediaGoodwill: -2.2, squadMorale: 1.4, fanSentiment: -1.6 }),
        warmth: 0.1, credibility: -0.4,
      },
      {
        id: 'a_structural', label: 'Admit the structure failed',
        line: () => 'It was structural. We were opened up the way we have been opened up before, which means the plan is failing rather than the personnel, and that is mine to fix.',
        effect: () => ({ mediaGoodwill: 3.2, fanSentiment: -0.8, squadMorale: -1.8 }),
        warmth: 0, credibility: 0.9,
      },
      {
        id: 'a_response_guarantee', label: 'Promise fury in response',
        line: () => 'There will be a reaction. I cannot tell you the result of it, but I can tell you nobody in that dressing room enjoyed today and nobody will enjoy Thursday either.',
        effect: () => ({ fanSentiment: 2.6, fanExcitement: 2, squadMorale: -2, mediaGoodwill: 1.6 }),
        warmth: -0.2, credibility: 0.2,
        stake: { kind: 'GUARANTEE', weight: 0.85, claim: () => 'You promised a response in public. The next result now measures it.' },
      },
    ],
  },
  {
    id: 'q_crisis_deep',
    topic: 'Your job',
    slots: ['PRE', 'POST'],
    weight: 6,
    applies: (c) => c.winless >= 6,
    text: () => 'Six matches without a win and the board have stopped repeating their statement of support. What is actually happening at this club?',
    answers: [
      {
        id: 'a_tell_truth', label: 'Tell the room the truth',
        line: () => 'A group that has stopped believing a plan that was working in training and nowhere else. That is the honest answer, and honestly is the only currency I have left.',
        effect: () => ({ mediaGoodwill: 3.6, fanSentiment: 1, squadMorale: -2.4 }),
        warmth: 0, credibility: 0.9,
      },
      {
        id: 'a_defend_record', label: 'Defend the record',
        line: () => 'I have heard six games described as a verdict. My body of work is considerably longer than six games and I will stand on all of it.',
        effect: () => ({ mediaGoodwill: -2.6, squadMorale: 2.4, fanSentiment: -1.4 }),
        warmth: -0.4, credibility: -0.2,
      },
      {
        id: 'a_hint_door', label: 'Hint you might walk',
        line: () => 'If the people who employ me decide a change helps, nobody here should pretend I would chain myself to the desk. I care about this place more than the job title.',
        variants: [
          () => 'Managers do not resign in press conferences, but I am not going to insult you by pretending the thought has not crossed my mind.',
        ],
        effect: () => ({ fanSentiment: -2.6, mediaGoodwill: 2.4, squadMorale: -3.4 }),
        warmth: -0.2, credibility: 0.2,
      },
    ],
  },
  {
    id: 'q_run_long',
    topic: 'Form',
    slots: ['PRE', 'POST'],
    weight: 3,
    applies: (c) => c.unbeaten >= 6,
    text: (c) => `${c.unbeaten} unbeaten. When are you allowed to say out loud that this is a genuinely good side?`,
    answers: [
      {
        id: 'a_say_now', label: 'Say it now',
        line: () => 'Now, apparently, since you have asked me nine times. This is a genuinely good side. If that ages badly, print that too.',
        variants: [
          () => 'Fine: we are good. I have been waiting six weeks to stop pretending otherwise and the table says I can stop.',
        ],
        effect: () => ({ fanExcitement: 4.4, fanSentiment: 2, mediaGoodwill: -1.6 }),
        warmth: 0.3, credibility: -0.3,
        stake: { kind: 'PRE_MATCH_TALK', weight: 0.65, claim: () => 'You called your own side good in public. Everyone wrote it down.' },
      },
      {
        id: 'a_ask_in_may', label: 'Ask again in spring',
        line: () => 'Ask me when the fixtures run out. Unbeaten runs are judged at the end of things, not in the middle of them.',
        effect: () => ({ mediaGoodwill: 2.6, fanExcitement: -1 }),
        warmth: 0, credibility: 0.8,
      },
      {
        id: 'a_quote_record', label: 'Quote the numbers',
        line: () => 'Clean sheets travel further than opinions. Look at what we have conceded since August and then ask me about luck.',
        effect: () => ({ mediaGoodwill: 1.8, fanSentiment: 1.2 }),
        warmth: 0.1, credibility: 0.6,
      },
    ],
  },
  {
    id: 'q_fans_euphoric',
    topic: 'The supporters',
    slots: ['PRE', 'POST'],
    weight: 3,
    applies: (c) => c.fanSentiment >= 78,
    text: () => 'Your support currently believes this is the best thing to happen to this club in its history. Do you correct them?',
    answers: [
      {
        id: 'a_stoke_it', label: 'Stoke it',
        line: () => 'Why would I talk them out of happiness? They have earned the right to feel ten feet tall on a Saturday.',
        effect: () => ({ fanSentiment: 3.4, fanExcitement: 3, mediaGoodwill: -2 }),
        warmth: 0.5, credibility: -0.3,
      },
      {
        id: 'a_channel_it', label: 'Channel it carefully',
        line: () => 'Belief is fuel and fuel burns. My job is making sure it lasts until April instead of peaking in September.',
        effect: () => ({ mediaGoodwill: 2.2, fanExcitement: -1.2, supportersTrust: 1.6 }),
        warmth: 0.1, credibility: 0.7,
      },
      {
        id: 'a_fill_the_ground', label: 'Ask them to fill the ground',
        line: () => 'Then prove it with bodies. Nothing protects a squad midwinter like a home end that refuses to go quiet.',
        effect: () => ({ supportersTrust: 3.4, fanSentiment: 1.6 }),
        warmth: 0.7, credibility: 0.4,
      },
    ],
  },
  {
    id: 'q_room_cold',
    topic: 'Your image',
    slots: ['PRE', 'POST'],
    weight: 4,
    applies: (c) => c.goodwill <= 35,
    text: () => 'This room has turned. Three weeks of hostile briefings and cold open questions. What happened between you and the press?',
    answers: [
      {
        id: 'a_own_coldness', label: 'Own your share',
        line: () => 'I stopped giving you access and started managing headlines, and you noticed. That one is fair. I would still make most of the same calls again.',
        effect: () => ({ mediaGoodwill: 2.8, fanSentiment: 1.4 }),
        warmth: 0.2, credibility: 0.6,
      },
      {
        id: 'a_go_at_press', label: 'Go at the press corps',
        line: () => 'What happened is that you discovered conflict travels further than context. I have read this week\'s coverage. Nobody in this room believes it was your finest work either.',
        effect: () => ({ mediaGoodwill: -4, fanSentiment: 2.8, fanExcitement: 1.6 }),
        warmth: -0.7, credibility: -0.4,
      },
      {
        id: 'a_freeze_politely', label: 'Freeze them out politely',
        line: () => 'I will answer every question put to me, as always, and I will continue to say precisely nothing worth printing.',
        effect: () => ({ mediaGoodwill: -1.8, squadMorale: 1 }),
        warmth: -0.2, credibility: 0.2,
      },
    ],
  },
  {
    id: 'q_pals_accusation',
    topic: 'Your image',
    slots: ['PRE', 'POST'],
    weight: 3,
    applies: (c) => c.goodwill >= 72,
    text: () => 'Some supporters think you are too comfortable in this room — friendly interviews, soft rides. Is that criticism fair?',
    answers: [
      {
        id: 'a_laugh_off', label: 'Laugh it off',
        line: () => 'If I were as charming as all that, we would have conceded fewer late goals. Ask the harder questions whenever you like; I will still give you the same face.',
        effect: () => ({ fanSentiment: -1.2, mediaGoodwill: -1.4, fanExcitement: 1 }),
        warmth: 0.4, credibility: -0.2,
      },
      {
        id: 'a_defend_access', label: 'Defend access',
        line: () => 'This club opens its doors more than most, and I will not apologise for a manager answering questions honestly. You are describing trust as if it were a scandal.',
        effect: () => ({ mediaGoodwill: 2.4, supportersTrust: -0.6 }),
        warmth: 0.3, credibility: 0.6,
      },
      {
        id: 'a_show_edge', label: 'Show a harder edge',
        line: () => 'Alright. From today, expect shorter answers and longer memories. Was that unfriendly enough for the highlight clip?',
        effect: () => ({ mediaGoodwill: -2, fanSentiment: 2 }),
        warmth: -0.4, credibility: 0.3,
      },
    ],
  },
  {
    id: 'q_standing_feared',
    topic: 'Your image',
    slots: ['PRE', 'POST'],
    weight: 3,
    applies: (c) => c.standing === 'FEARED',
    text: () => 'Opposition supporters dread playing you and rival managers prepare differently for you. Is being feared better than being liked?',
    answers: [
      {
        id: 'a_feared_compliment', label: 'Take it as the compliment',
        line: () => 'Being liked gets you nice messages. Being feared gets you results nobody fancies contesting. I know which one pays the bills.',
        effect: () => ({ fanExcitement: 3.2, fanSentiment: 2, mediaGoodwill: -1.4 }),
        warmth: -0.2, credibility: 0,
      },
      {
        id: 'a_want_both', label: 'Want both',
        line: () => 'They are not opposites. Fear gets you the first tackle; respect gets you the second ball. We work on both.',
        effect: () => ({ mediaGoodwill: 1.6, fanSentiment: 1.4 }),
        warmth: 0.2, credibility: 0.3,
      },
      {
        id: 'a_respect_first', label: 'Respect first, fear later',
        line: () => 'Fear fades by February. Respect survives bad results, and respect is what I am actually building here.',
        effect: () => ({ mediaGoodwill: 2.6, supportersTrust: 1.4 }),
        warmth: 0.5, credibility: 0.6,
      },
    ],
  },
  {
    id: 'q_standing_beloved',
    topic: 'Your image',
    slots: ['PRE', 'POST'],
    weight: 3,
    applies: (c) => c.standing === 'BELOVED',
    text: () => 'Neutrals adopt your club, pundits protect it, and rivals complain nobody lets them dislike you. Ideal, or a problem?',
    answers: [
      {
        id: 'a_ideal_obviously', label: 'Ideal, obviously',
        line: () => 'Every away trip feels like a home fixture with cheaper pies. Long may it annoy everybody else.',
        effect: () => ({ fanSentiment: 2.4, mediaGoodwill: 1.4 }),
        warmth: 0.7, credibility: 0.3,
      },
      {
        id: 'a_lose_the_edge', label: 'Worry about the edge',
        line: () => 'Slightly a problem. Lovable sides get kicked out of cups by teams who have decided niceness is a weakness. We will not be that team.',
        variants: [
          () => 'The affection is welcome and the softness would not be. Somebody remind me to keep training horrible.',
        ],
        effect: () => ({ fanExcitement: 1.6, mediaGoodwill: -1, squadMorale: 0.8 }),
        warmth: 0, credibility: 0.2,
      },
      {
        id: 'a_guard_it', label: 'Say it must be guarded',
        line: () => 'Reputations like that take years and one stupid evening to lose. Everybody in this building knows the standard we protect.',
        effect: () => ({ supportersTrust: 2.8, mediaGoodwill: 2 }),
        warmth: 0.6, credibility: 0.6,
      },
    ],
  },
  {
    id: 'q_rivalry_boiling',
    topic: 'The feud',
    slots: ['PRE', 'POST'],
    weight: 5,
    applies: (c) => c.rivalryHeat >= 60 && c.opponent !== null,
    text: (c) => `Feelings around ${opp(c)} have reached the point where authorities take notice. Do you have a duty to cool it down?`,
    answers: [
      {
        id: 'a_call_for_calm', label: 'Make the calm call',
        line: (c) => `Everybody follows the football on Saturday and goes home safe. That includes the people who have been winding each other up all fortnight, me included. ${opp(c)} want to beat us; that should be enough.`,
        effect: (c) => ({
          supportersTrust: 2, mediaGoodwill: 2.8, fanExcitement: -1.4,
          ...(c.opponentId ? { rivalryHeat: { opponentClubId: c.opponentId, delta: -6 } } : {}),
        }),
        warmth: 0.5, credibility: 0.7,
      },
      {
        id: 'a_feed_it', label: 'Feed it instead',
        line: () => 'I am not going to pretend this is just another fixture, because nobody in this city believes that. Bring everything. Both ends.',
        effect: (c) => ({
          fanExcitement: 4.6, mediaGoodwill: -2.6,
          ...(c.opponentId ? { rivalryHeat: { opponentClubId: c.opponentId, delta: 7 } } : {}),
        }),
        warmth: -0.6, credibility: -0.3,
        stake: { kind: 'CALL_OUT', weight: 0.9, claim: () => 'You poured petrol on the biggest fixture in the league, on the record.' },
      },
      {
        id: 'a_only_football', label: 'Talk only football',
        line: () => 'Selection, shape, set pieces — those are the subjects I am qualified for. Everything else is for people paid to manage it.',
        effect: (c) => ({
          mediaGoodwill: 1.2,
          ...(c.opponentId ? { rivalryHeat: { opponentClubId: c.opponentId, delta: -2 } } : {}),
        }),
        warmth: 0, credibility: 0.4,
      },
    ],
  },
  {
    id: 'q_window_money',
    topic: 'Transfers',
    slots: ['PRE'],
    weight: 3,
    applies: (c) => Boolean(c.state.transfers.windowOpen) && c.club.finance.transferBudget > 400_000,
    text: () => 'There is genuine money sitting unspent in this window. Spend it, or hold it?',
    answers: [
      {
        id: 'a_spend_now', label: 'Spend it now',
        line: () => 'Money does not defend anything from a bench. If the right player is available this month, we move, and I will happily explain the fee afterwards.',
        effect: () => ({ fanExcitement: 3.4, fanSentiment: 2.2, mediaGoodwill: -0.8 }),
        warmth: 0.4, credibility: -0.1,
        stake: { kind: 'GUARANTEE', weight: 0.5, claim: () => 'You promised incoming business while the window is open.' },
      },
      {
        id: 'a_hold_for_value', label: 'Hold for value',
        line: () => 'Panic spending is how clubs like ours fund bigger clubs for a decade. The budget exists; the price has to exist too.',
        variants: [
          () => 'There is no prize for using the whole envelope. If January prices stay silly, the bravest thing I can do is nothing loudly.',
        ],
        effect: () => ({ mediaGoodwill: 2.4, fanSentiment: -1.4 }),
        warmth: 0, credibility: 0.7,
      },
      {
        id: 'a_refuse_numbers', label: 'Refuse to discuss numbers',
        line: () => 'Budgets are discussed in buildings without cameras. Anything else becomes the asking price by lunchtime.',
        effect: () => ({ mediaGoodwill: -1.4 }),
        warmth: -0.1, credibility: 0.2,
      },
    ],
  },
  {
    id: 'q_injury_crisis',
    topic: 'Injuries',
    slots: ['PRE', 'POST'],
    weight: 4,
    applies: (c) => c.injured.length >= 4,
    text: (c) => `${c.injured.length} players in the treatment room and the calendar does not care. How do you field a team this weekend?`,
    answers: [
      {
        id: 'a_promote_kids', label: 'Promote the youngsters',
        line: () => 'Somebody gets a shirt who did not expect one on Monday. That is either a crisis or an audition, and history says some of our best stories started as emergencies.',
        effect: () => ({ fanExcitement: 2.2, mediaGoodwill: 1.2, squadMorale: 1.4 }),
        warmth: 0.5, credibility: 0.3,
      },
      {
        id: 'a_reshape_system', label: 'Reshape the system',
        line: () => 'We stop trying to replace individuals and change how the whole thing works instead. Fewer heroes required, more discipline demanded.',
        effect: () => ({ mediaGoodwill: 2.6 }),
        warmth: 0.2, credibility: 0.7,
      },
      {
        id: 'a_fury_at_schedule', label: 'Fury at the schedule',
        line: () => 'Ask the people who built a calendar with no slack in it why four of my squad broke at once. I am finished pretending this is misfortune.',
        effect: () => ({ mediaGoodwill: -2.4, fanSentiment: 2.2, supportersTrust: 1.6 }),
        warmth: -0.4, credibility: -0.2,
      },
    ],
  },
  {
    id: 'q_expiring_mass',
    topic: 'Contracts',
    slots: ['PRE', 'POST'],
    weight: 3,
    applies: (c) => c.expiring.length >= 3,
    text: () => 'Half a dressing room is inside the final months of its deal. Whose mess is this — yours or the club\'s?',
    answers: [
      {
        id: 'a_mine_to_fix', label: 'Take ownership',
        line: () => 'Mine. I know exactly who wants to stay and who is waiting, and I know which conversations I should have had sooner.',
        effect: () => ({ mediaGoodwill: 2, squadMorale: 1.6 }),
        warmth: 0.4, credibility: 0.3,
      },
      {
        id: 'a_clubs_desk', label: 'Point at the club',
        line: () => 'Contract strategy is decided well above my office. I coach whoever is under contract on Saturday, which at current speed may be a different list every week.',
        effect: () => ({ mediaGoodwill: 1.4, fanSentiment: -1.2 }),
        warmth: 0, credibility: 0.6,
      },
      {
        id: 'a_admit_messy', label: 'Admit it is messy',
        line: () => 'It is messy. Deals, agents, wage structure — pick one and I will give you an honest answer that will not fit in a headline.',
        effect: () => ({ mediaGoodwill: 2.8, fanSentiment: -2 }),
        warmth: 0.1, credibility: 0.8,
      },
    ],
  },
];

/* --- assembling a conference --------------------------------------------- */

function buildContext(state: GameState, slot: PressSlot, anchorEventId: EventId): PressContext | null {
  const club = state.clubs[state.playerClubId];
  if (!club) return null;
  const manager = state.managers[state.playerManagerId] ?? null;
  const upcoming = nextFixture(state);
  const opponentId = upcoming
    ? (upcoming.homeClubId === club.id ? upcoming.awayClubId : upcoming.homeClubId)
    : (rivalriesOf(state, club.id)[0] ? rivalOpponent(rivalriesOf(state, club.id)[0]!, club.id) : null);
  const opponent = opponentId ? state.clubs[opponentId] ?? null : null;
  const rivalry = opponentId ? rivalriesOf(state, club.id).find(
    (r) => r.clubAId === opponentId || r.clubBId === opponentId,
  ) : undefined;

  const form = recentForm(state, club.id, 6);
  let winless = 0;
  for (let i = form.length - 1; i >= 0; i--) { if (form[i] === 'W') break; winless++; }
  let unbeaten = 0;
  for (let i = form.length - 1; i >= 0; i--) { if (form[i] === 'L') break; unbeaten++; }

  const squad = squadOf(state, club.id);
  const worstMorale = squad.length
    ? squad.slice().sort((a, b) => a.mental.morale - b.mental.morale)[0] ?? null
    : null;
  const bestPlayer = squad.length
    ? squad.slice().sort((a, b) => b.overall - a.overall)[0] ?? null
    : null;

  const lastResultEvent = [...state.eventLog].reverse().find(
    (e) => (e.type === 'MATCH_WON' || e.type === 'MATCH_LOST' || e.type === 'MATCH_DRAWN')
      && (e.payload as { clubId: ClubId }).clubId === club.id,
  );
  const lastResult = lastResultEvent
    ? lastResultEvent.type === 'MATCH_WON' ? 'W' : lastResultEvent.type === 'MATCH_LOST' ? 'L' : 'D'
    : null;
  const lastScore = lastResultEvent
    ? lastResultEvent.type === 'MATCH_DRAWN'
      ? `${lastResultEvent.payload.score}-${lastResultEvent.payload.score}`
      : `${(lastResultEvent.payload as { homeScore: number }).homeScore}-${(lastResultEvent.payload as { awayScore: number }).awayScore}`
    : null;
  const lastMargin = lastResultEvent && lastResultEvent.type !== 'MATCH_DRAWN'
    ? (lastResultEvent.payload as { margin: number }).margin : 0;

  const newSigning = [...state.eventLog].reverse()
    .filter((e) => e.type === 'PLAYER_SIGNED' && e.payload.clubId === club.id && e.cycle >= state.clock.cycle - 3)
    .map((e) => state.players[(e.payload as { playerId: PlayerId }).playerId])
    .find((p): p is Player => Boolean(p)) ?? null;

  const hostile = Object.values(state.creators)
    .filter((c) => c.clubSentiment <= -25)
    .sort((a, b) => a.clubSentiment - b.clubSentiment)[0];

  const world = socialWorld(state);
  return {
    state,
    club,
    manager,
    slot,
    anchorEventId,
    opponent,
    opponentId: opponentId ?? null,
    derby: (rivalry?.intensity ?? 0) >= 45,
    rivalryHeat: rivalry?.intensity ?? 0,
    form,
    winless,
    unbeaten,
    lastResult,
    lastScore,
    lastMargin,
    worstMorale,
    bestPlayer,
    injured: injuredPlayers(state, club.id),
    expiring: expiringContracts(state, club.id, 8),
    fanSentiment: club.fans.sentiment,
    goodwill: world.mediaGoodwill,
    trust: world.supportersTrust,
    standing: socialStanding(state).standing,
    newSigning,
    hostileCreator: hostile?.displayName ?? null,
  };
}

/**
 * How hard an answer lands.
 *
 * A manager who handles the media well does not get different questions — he
 * gets the same questions and pays less for the wrong answer. Media ability
 * raises the ceiling on a good one. Both are read straight off the manager the
 * player built at creation, which is the point of having built him.
 */
function damping(ctx: PressContext): { downside: number; upside: number } {
  const handling = ctx.manager?.attributes.mediaHandling ?? 50;
  const brand = ctx.manager?.attributes.brandBuilding ?? 50;
  return {
    downside: clamp(1 - (handling / 100) * A.press.handlingSoftening, 0.5, 1.05),
    upside: clamp(1 + (brand / 100) * A.press.handlingUpside, 1, 1.4),
  };
}

const splitEffect = (effect: SocialEffect, ctx: PressContext): SocialEffect => {
  const { downside, upside } = damping(ctx);
  const out: Record<string, unknown> = {};
  const scaleNumber = (v: number | undefined): number | undefined =>
    (v === undefined ? undefined : v * (v < 0 ? downside : upside));
  for (const key of ['fanSentiment', 'fanExcitement', 'fanTrust', 'squadMorale', 'reputation', 'mediaGoodwill', 'supportersTrust', 'followers'] as const) {
    const value = scaleNumber(effect[key]);
    if (value !== undefined) out[key] = value;
  }
  if (effect.playerMorale) {
    out.playerMorale = { ...effect.playerMorale, delta: (scaleNumber(effect.playerMorale.delta) ?? 0) };
  }
  // Rivalry heat is not softened by charm. Picking a fight is picking a fight.
  if (effect.rivalryHeat) out.rivalryHeat = effect.rivalryHeat;
  return out as SocialEffect;
};

/** The event a conference hangs off: the fixture ahead, or the result behind. */
function anchorFor(state: GameState, slot: PressSlot): EventId | null {
  const clubId = state.playerClubId;
  const floor = state.clock.cycle - 1;
  for (let i = state.eventLog.length - 1; i >= 0; i--) {
    const event = state.eventLog[i];
    if (!event || event.cycle < floor) break;
    if (slot === 'PRE' && event.type === 'MATCH_SCHEDULED'
      && (event.payload.homeClubId === clubId || event.payload.awayClubId === clubId)) return event.id;
    if (slot === 'POST'
      && (event.type === 'MATCH_WON' || event.type === 'MATCH_LOST' || event.type === 'MATCH_DRAWN')
      && (event.payload as { clubId: ClubId }).clubId === clubId) return event.id;
  }
  return null;
}

/**
 * The conference that is waiting, if there is one.
 *
 * A post-match conference is offered whenever a result landed in the current
 * or previous cycle; otherwise the pre-match one, keyed to the fixture the
 * world has already announced. Both are anchored to real events, which is what
 * lets the reaction posts cite something.
 */
export function pressConference(state: GameState): PressConference | null {
  const world = socialWorld(state);
  const cycle = state.clock.cycle;
  const done = new Set(world.conferences.filter((c) => c.cycle === cycle).map((c) => c.slot));

  for (const slot of ['POST', 'PRE'] as const) {
    if (done.has(slot)) continue;
    const anchor = anchorFor(state, slot);
    if (!anchor) continue;
    const ctx = buildContext(state, slot, anchor);
    if (!ctx) continue;
    const questions = chooseQuestions(ctx, new Rng(`${state.seed}:press:${anchor}:${slot}`));
    if (questions.length === 0) continue;
    return {
      id: `pc_${anchor}_${slot}`.toLowerCase(),
      slot,
      anchorEventId: anchor,
      title: slot === 'PRE' ? 'Pre-match press conference' : 'After the final whistle',
      subtitle: slot === 'PRE'
        ? ctx.opponent
          ? `Three questions before ${ctx.opponent.shortName}. Every answer is a trade.`
          : 'Three questions before the weekend. Every answer is a trade.'
        : 'They have watched the same match you have. Three questions.',
      cycle,
      questions,
      goodwill: Math.round(world.mediaGoodwill),
    };
  }
  return null;
}

function chooseQuestions(ctx: PressContext, rng: Rng): PressQuestion[] {
  const eligible = QUESTIONS.filter((q) => q.slots.includes(ctx.slot) && q.applies(ctx));
  if (eligible.length === 0) return [];
  const wanted = Math.min(A.press.questions, eligible.length);
  const chosen: QuestionDef[] = [];
  const remaining = eligible.slice();
  const topics = new Set<string>();
  for (let i = 0; i < wanted && remaining.length > 0; i++) {
    const pick = rng.forkSequential('q', i).weighted(
      remaining,
      // A room that asks three questions about the same subject is not a room.
      (q) => q.weight * (topics.has(q.topic) ? 0.15 : 1),
    );
    remaining.splice(remaining.indexOf(pick), 1);
    topics.add(pick.topic);
    chosen.push(pick);
  }

  return chosen.map((def, index) => {
    const reporterRng = rng.forkSequential('reporter', index);
    const outlet = reporterRng.weighted(OUTLETS, (o) => o.reach / 1_000_000);
    const reporter = reporterRng.pick(REPORTERS);
    const subject = def.subject?.(ctx);
    return {
      id: def.id,
      topic: def.topic,
      reporter,
      outlet: outlet.name,
      avatarSeed: seedFrom('reporter', reporter, outlet.name),
      text: def.text(ctx),
      ...(subject ? { subjectPlayerId: subject } : {}),
      answers: def.answers.map((answer, ai) => {
        const raw = scaleEffect(answer.effect(ctx), 1);
        const effect = splitEffect(raw, ctx);
        // One reading per conference, chosen before anything else reads the rng.
        const readings = [answer.line, ...(answer.variants ?? [])];
        const said = readings.length > 1
          ? rng.forkSequential('line', index * 8 + ai).pick(readings)(ctx)
          : answer.line(ctx);
        return {
          id: answer.id,
          label: answer.label,
          line: said,
          effect,
          lines: describeEffect(effect, ctx.state),
          stake: answer.stake
            ? { kind: answer.stake.kind, claim: answer.stake.claim(ctx), weight: answer.stake.weight }
            : null,
          warmth: answer.warmth,
          credibility: answer.credibility,
        };
      }),
    };
  });
}

/** Fictional reporters. Invented, like everything else in this world. */
const REPORTERS: readonly string[] = [
  'Mireille Kaddour', 'Stefan Oyelaran', 'Priya Ashgrove', 'Dermot Vane', 'Halla Ingvarsdottir',
  'Callum Petrie', 'Nadia Sorrell', 'Theo Bracken', 'Rosalind Quay', 'Marcus Vellum',
  'Junie Okonkwo', 'Piers Hallam', 'Ada Trenholme', 'Louis Ferrand', 'Sonja Vukic',
];

/* --- answering ----------------------------------------------------------- */

export interface PressAnswerInput {
  readonly conferenceId: string;
  readonly answers: readonly { readonly questionId: string; readonly answerId: string }[];
  readonly at: number;
  readonly registry?: ContentRegistryPort | null;
}

export interface PressResult {
  readonly state: GameState;
  readonly ok: boolean;
  readonly reason?: string;
  readonly posts: readonly SocialPost[];
  readonly effect?: SocialEffect;
  readonly events: readonly AnyDomainEvent[];
  readonly headline?: string;
  readonly stakes: readonly SocialStake[];
}

/**
 * Give the answers and live with them.
 *
 * The whole conference is applied as one merged effect so the player is judged
 * on the shape of the session rather than on any one line — a manager who
 * shields the squad three times running has taken a coherent position, and the
 * press write about that rather than about a sentence.
 */
export function answerPressConference(state: GameState, input: PressAnswerInput): PressResult {
  const conference = pressConference(state);
  if (!conference || conference.id !== input.conferenceId) {
    return { state, ok: false, reason: 'That conference is over.', posts: [], events: [], stakes: [] };
  }

  const chosen: { question: PressQuestion; answer: PressAnswer }[] = [];
  for (const question of conference.questions) {
    const pick = input.answers.find((a) => a.questionId === question.id);
    const answer = pick ? question.answers.find((a) => a.id === pick.answerId) : undefined;
    if (!answer) {
      return { state, ok: false, reason: 'Every question needs an answer.', posts: [], events: [], stakes: [] };
    }
    chosen.push({ question, answer });
  }

  const cycle = state.clock.cycle;
  const merged = mergeEffects(chosen.map((c) => c.answer.effect));
  const applied = applySocialEffect(state, merged, {
    anchorEventId: conference.anchorEventId,
    suffix: `press${conference.slot.toLowerCase()}`,
    reason: conference.slot === 'PRE' ? 'Pre-match press conference' : 'Post-match press conference',
    cycle,
    season: state.clock.season,
    week: state.clock.week,
    at: input.at,
    clubId: state.playerClubId,
  });

  let next = applied.state;
  const rng = new Rng(`${state.seed}:pressanswer:${conference.id}`);
  const ctx = postRenderContext(next, input.registry ?? null, cycle);
  const club = state.clubs[state.playerClubId];
  const manager = state.managers[state.playerManagerId];

  // The line the room leads with is the strongest thing that was said.
  const lead = chosen.slice().sort(
    (a, b) => magnitude(b.answer.effect) - magnitude(a.answer.effect),
  )[0] ?? chosen[0];
  const headline = lead ? lead.answer.line : 'The manager spoke.';

  const posts: SocialPost[] = [];
  if (club && lead) {
    const tokens = {
      club: clubToken(club.name),
      ...(manager ? { manager: personToken(manager.name) } : {}),
      ...(ctxOpponentName(state) ? { opponent: clubToken(ctxOpponentName(state) as string) } : {}),
      ...(lead.question.subjectPlayerId && state.players[lead.question.subjectPlayerId]
        ? { player: personToken(state.players[lead.question.subjectPlayerId]?.displayName ?? '') }
        : {}),
      quote: lead.answer.line,
      topic: lead.question.topic.toLowerCase(),
    };
    const hook = {
      trigger: 'PRESS_CONFERENCE',
      sourceEventId: conference.anchorEventId,
      rootEventId: conference.anchorEventId,
      depth: 0,
      importance: 3 as const,
      sentiment: merged.mediaGoodwill && merged.mediaGoodwill > 0 ? 0.2 : -0.3,
      tokens,
      facts: {
        slot: conference.slot,
        answer: lead.answer.id,
        topic: lead.question.topic,
        stance: lead.answer.warmth >= 0.4 ? 'WARM' : lead.answer.warmth <= -0.4 ? 'COLD' : 'FLAT',
      },
      entities: [
        { kind: 'club' as const, id: club.id, name: club.name },
        ...(lead.question.subjectPlayerId && state.players[lead.question.subjectPlayerId]
          ? [{ kind: 'player' as const, id: lead.question.subjectPlayerId, name: state.players[lead.question.subjectPlayerId]?.displayName ?? '' }]
          : []),
      ],
      clubId: state.playerClubId,
      audiences: ['MEDIA' as const],
      tags: ['press', 'authored'],
      cycle,
    };

    const authors: { author: PostAuthor; sentiment: number }[] = [];
    const outlet = rng.fork('outlet').weighted(OUTLETS, (o) => o.reach / 1_000_000);
    authors.push({
      author: {
        kind: 'MEDIA', name: outlet.name, handle: outlet.handle,
        avatarSeed: seedFrom('outlet', outlet.name), verified: true, reach: outlet.reach,
      },
      sentiment: (merged.mediaGoodwill ?? 0) > 0 ? 0.3 : -0.4,
    });
    const persona = rng.fork('fan').pick(FAN_PERSONAS);
    authors.push({
      author: {
        kind: 'FAN', name: persona,
        handle: `@${persona.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12)}${club.abbreviation.toLowerCase()}`,
        avatarSeed: seedFrom('fan', persona, club.abbreviation), verified: false,
        reach: Math.round(clamp(club.fans.onlineFollowers * S.fanReachFromFollowers, S.fanReachFloor, S.fanReachCeiling) * 1.5),
      },
      sentiment: (merged.fanSentiment ?? 0) > 0 ? 0.55 : -0.5,
    });
    const creators = Object.values(state.creators).filter((c) => c.style.postingFrequency > 0);
    if (creators.length > 0) {
      const creator = rng.fork('creator').weighted(creators, (c) => (c.clubId === club.id ? 3 : 1));
      authors.push({
        author: {
          kind: 'CREATOR', name: creator.displayName,
          handle: creator.handle.startsWith('@') ? creator.handle : `@${creator.handle}`,
          avatarSeed: creator.avatarSeed,
          verified: creator.tier === 'MAJOR' || creator.tier === 'GLOBAL',
          reach: creatorReach(creator),
        },
        sentiment: (creator.clubSentiment / 100) * 0.6,
      });
    }
    if (lead.question.subjectPlayerId) {
      const subject = state.players[lead.question.subjectPlayerId];
      if (subject) {
        authors.push({
          author: {
            kind: 'PLAYER', name: subject.displayName,
            handle: `@${subject.displayName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12)}`,
            avatarSeed: subject.portraitSeed, verified: subject.reputation >= 55,
            reach: Math.round(subject.reputation * S.playerReachPerReputation),
          },
          sentiment: (merged.playerMorale?.delta ?? 0) >= 0 ? 0.55 : -0.6,
        });
      }
    }

    authors.forEach((entry, index) => {
      const post = renderPost(ctx, rng.forkSequential('press', index), {
        id: `sp_press_${conference.id}_${index}`.toLowerCase(),
        author: entry.author,
        hook,
        facts: { answer: lead.answer.id, slot: conference.slot, topic: lead.question.topic },
        sentiment: entry.sentiment,
        trigger: 'PRESS_CONFERENCE',
        fallbackTriggers: ['CLUB_STATEMENT'],
        extraTags: ['press-reaction'],
        weightBonus: 5,
      });
      if (post) posts.push(post);
    });
    next = appendPosts(next, posts);
  }

  const stakes: SocialStake[] = [];
  for (const entry of chosen) {
    if (!entry.answer.stake) continue;
    stakes.push({
      id: `stk_press_${conference.id}_${entry.question.id}`,
      kind: entry.answer.stake.kind,
      eventId: conference.anchorEventId,
      openedCycle: cycle,
      settleAfterCycle: cycle,
      tone: entry.answer.warmth < 0 ? 'PROVOCATIVE' : 'DEFIANT',
      stake: entry.answer.stake.weight,
      claim: entry.answer.stake.claim,
      ...(entry.question.subjectPlayerId ? { playerId: entry.question.subjectPlayerId } : {}),
      ...(ctxOpponentId(state) ? { opponentClubId: ctxOpponentId(state) as ClubId } : {}),
    });
  }

  const record: PressConferenceRecord = {
    id: conference.id,
    cycle,
    slot: conference.slot,
    eventId: conference.anchorEventId,
    answers: chosen.map((c) => ({ questionId: c.question.id, answerId: c.answer.id })),
    headline,
    goodwillDelta: Math.round((merged.mediaGoodwill ?? 0) * 10) / 10,
  };

  const warmth = chosen.reduce((sum, c) => sum + c.answer.warmth, 0) / chosen.length;
  const credibility = chosen.reduce((sum, c) => sum + c.answer.credibility, 0) / chosen.length;
  const action: PlayerAction = {
    id: `pa_${conference.id}`,
    kind: 'PRESS_ANSWER',
    cycle,
    eventId: conference.anchorEventId,
    volume: 0.7,
    warmth,
    credibility,
    summary: `${conference.slot === 'PRE' ? 'Pre-match' : 'Post-match'} press: ${lead?.question.topic ?? 'answered'}`,
  };

  next = withSocialWorld(next, (w) => ({
    conferences: [...w.conferences, record].slice(-40),
    actions: [...w.actions, action].slice(-240),
    stakes: [...w.stakes, ...stakes],
  }));

  return { state: next, ok: true, posts, effect: merged, events: applied.events, headline, stakes };
}

/** Walk out without taking questions. Cheap once; a habit the press remember. */
export function skipPressConference(state: GameState, input: { at: number }): PressResult {
  const conference = pressConference(state);
  if (!conference) {
    return { state, ok: false, reason: 'Nothing to skip.', posts: [], events: [], stakes: [] };
  }
  const world = socialWorld(state);
  const repeats = world.conferences.filter((c) => c.answers.length === 0).length;
  // Every skip is worse than the last. A manager who never speaks is a story.
  const multiplier = 1 + repeats * 0.4;
  const effect: SocialEffect = {
    mediaGoodwill: A.press.skipGoodwill * multiplier,
    supportersTrust: A.press.skipTrust * multiplier,
  };
  const applied = applySocialEffect(state, effect, {
    anchorEventId: conference.anchorEventId,
    suffix: `pressskip${conference.slot.toLowerCase()}`,
    reason: 'Declined to take questions',
    cycle: state.clock.cycle,
    season: state.clock.season,
    week: state.clock.week,
    at: input.at,
    clubId: state.playerClubId,
  });

  const record: PressConferenceRecord = {
    id: conference.id,
    cycle: state.clock.cycle,
    slot: conference.slot,
    eventId: conference.anchorEventId,
    answers: [],
    headline: 'Declined to take questions.',
    goodwillDelta: Math.round(A.press.skipGoodwill * multiplier * 10) / 10,
  };
  const next = withSocialWorld(applied.state, (w) => ({
    conferences: [...w.conferences, record].slice(-40),
    actions: [...w.actions, {
      id: `pa_skip_${conference.id}`,
      kind: 'PRESS_ANSWER' as const,
      cycle: state.clock.cycle,
      eventId: conference.anchorEventId,
      volume: 0.2,
      warmth: -0.3,
      credibility: -0.2,
      summary: 'Walked past the press',
    }].slice(-240),
  }));

  return {
    state: next, ok: true, posts: [], effect, events: applied.events,
    headline: record.headline, stakes: [],
  };
}

const magnitude = (effect: SocialEffect): number =>
  Math.abs(effect.fanSentiment ?? 0) + Math.abs(effect.squadMorale ?? 0) * 1.4
  + Math.abs(effect.mediaGoodwill ?? 0) + Math.abs(effect.playerMorale?.delta ?? 0) * 0.5
  + Math.abs(effect.rivalryHeat?.delta ?? 0) * 0.6;

const ctxOpponentId = (state: GameState): ClubId | null => {
  const fixture = nextFixture(state);
  if (!fixture) return null;
  return fixture.homeClubId === state.playerClubId ? fixture.awayClubId : fixture.homeClubId;
};

const ctxOpponentName = (state: GameState): string | null => {
  const id = ctxOpponentId(state);
  return id ? state.clubs[id]?.name ?? null : null;
};

/** Every question the bank can ask. Exported so tests can walk the real list. */
export const PRESS_QUESTION_IDS: readonly string[] = QUESTIONS.map((q) => q.id);
export const PRESS_ANSWER_COUNT = QUESTIONS.reduce((n, q) => n + q.answers.length, 0);
