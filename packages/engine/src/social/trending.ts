import type { EventId } from '../core/brand';
import type { GameState, SocialPost } from '../game/state';
import type { Rng } from '../core/rng';
import { clamp } from '../core/math';
import { seedFrom } from '../simulation/templating';
import { recentForm, leaguePosition, standings } from '../game/selectors';
import { PUNDITS, SOCIAL_ACTION_BALANCE as A } from './balance';
import { socialStanding } from './standing';
import { socialMoments } from './moments';
import {
  socialWorld,
  type PunditStance, type RumourItem, type ShowSegment, type WeeklyShow,
} from './worldState';

/**
 * What the internet is talking about.
 *
 * Everything on this surface is *measured* rather than authored. A trend is a
 * count over the week's real posts and the real events behind them; the weekly
 * show's rating is arithmetic over results, reach and mood; the pundit's stance
 * is a running argument that the results either back or embarrass.
 *
 * The failure mode being designed against is a "trending" panel that is really
 * a random word generator. Every row here can be tapped through to the event it
 * counted, which is only possible because nothing here was invented.
 */

/* --- trends -------------------------------------------------------------- */

export interface TrendTopic {
  readonly id: string;
  readonly label: string;
  readonly blurb: string;
  readonly score: number;
  readonly posts: number;
  readonly sentiment: number;
  readonly eventId: EventId | null;
  readonly kind: 'RESULT' | 'PLAYER' | 'CLUB' | 'CREATOR' | 'ROW' | 'MONEY' | 'FANS' | 'OTHER';
}

const TAG_TOPICS: readonly { tag: string; label: string; kind: TrendTopic['kind']; blurb: string }[] = [
  { tag: 'result', label: 'The result', kind: 'RESULT', blurb: 'Ninety minutes that everybody has an opinion about.' },
  { tag: 'discipline', label: 'The red card', kind: 'ROW', blurb: 'One decision, replayed from four angles, still argued about.' },
  { tag: 'rivalry', label: 'The derby', kind: 'ROW', blurb: 'Two sets of supporters who cannot let each other alone.' },
  { tag: 'transfer', label: 'The transfer', kind: 'PLAYER', blurb: 'Somebody is moving, or somebody would like you to think so.' },
  { tag: 'injury', label: 'The injury', kind: 'PLAYER', blurb: 'A treatment table with a queue at it.' },
  { tag: 'creator', label: 'The content', kind: 'CREATOR', blurb: 'Something got made and it travelled further than the football.' },
  { tag: 'fans', label: 'The supporters', kind: 'FANS', blurb: 'The stands have found their voice about something.' },
  { tag: 'commercial', label: 'The money', kind: 'MONEY', blurb: 'Somebody has read the accounts out loud.' },
  { tag: 'record', label: 'The record', kind: 'CLUB', blurb: 'A number in the book that has just been rewritten.' },
  { tag: 'manager', label: 'The manager', kind: 'CLUB', blurb: 'A job being discussed by people who do not have to do it.' },
  { tag: 'trophy', label: 'The trophy', kind: 'CLUB', blurb: 'Silverware, and everything that comes with it.' },
  { tag: 'youth', label: 'The academy', kind: 'PLAYER', blurb: 'Somebody young enough to still be excited about all of this.' },
  { tag: 'goal', label: 'The goal', kind: 'RESULT', blurb: 'A finish that is being watched on loop.' },
  { tag: 'press', label: 'The press conference', kind: 'ROW', blurb: 'A room, a question, and an answer somebody regrets.' },
  { tag: 'poll', label: 'The vote', kind: 'FANS', blurb: 'The supporters were asked something and they answered.' },
  { tag: 'contract', label: 'The contract', kind: 'PLAYER', blurb: 'A deal with a clock on it.' },
  { tag: 'content-drop', label: 'The drop', kind: 'CREATOR', blurb: 'A piece of content the whole timeline has watched.' },
  { tag: 'campaign', label: 'The campaign', kind: 'FANS', blurb: 'Something the supporters organised without being asked.' },
];

/**
 * The week, counted.
 *
 * Engagement is log-scaled so one enormous post does not own the whole panel,
 * and importance is weighted heavily so that a quiet but genuinely significant
 * story is not buried under a viral joke.
 */
export function trendingTopics(state: GameState, cycle: number = state.clock.cycle): TrendTopic[] {
  const floor = cycle - A.trending.windowCycles + 1;
  const buckets = new Map<string, { score: number; posts: number; sentiment: number; eventId: EventId | null }>();

  for (const post of state.social.posts) {
    if (post.cycle < floor) continue;
    const engagement = Math.log10(post.likes + post.reposts * 3 + 10) * A.trending.engagementWeight;
    const importance = (post.weight / 100) * A.trending.importanceWeight;
    for (const row of TAG_TOPICS) {
      if (!post.tags.includes(row.tag)) continue;
      const held = buckets.get(row.tag) ?? { score: 0, posts: 0, sentiment: 0, eventId: null };
      buckets.set(row.tag, {
        score: held.score + engagement + importance,
        posts: held.posts + 1,
        sentiment: held.sentiment + post.sentiment,
        eventId: held.eventId ?? (post.relatedEventId as EventId | undefined) ?? null,
      });
    }
  }

  const out: TrendTopic[] = [];
  for (const row of TAG_TOPICS) {
    const bucket = buckets.get(row.tag);
    if (!bucket || bucket.score < A.trending.floor) continue;
    out.push({
      id: `tr_${row.tag}`,
      label: row.label,
      blurb: row.blurb,
      kind: row.kind,
      score: Math.round(bucket.score * 10) / 10,
      posts: bucket.posts,
      sentiment: Math.round((bucket.sentiment / bucket.posts) * 100) / 100,
      eventId: bucket.eventId,
    });
  }
  return out.sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1)).slice(0, A.trending.slots);
}

/* --- the pundit ---------------------------------------------------------- */

interface ThesisDef {
  readonly id: string;
  readonly text: (club: string) => string;
  /** True when the week's evidence supports him. */
  readonly proven: (c: PunditEvidence) => boolean;
  readonly disproven: (c: PunditEvidence) => boolean;
  readonly applies: (c: PunditEvidence) => boolean;
  readonly stance: number;
}

interface PunditEvidence {
  readonly wins: number;
  readonly losses: number;
  readonly draws: number;
  readonly position: number;
  readonly leagueSize: number;
  readonly sentiment: number;
  readonly followers: number;
  readonly standing: string;
}

const THESES: readonly ThesisDef[] = [
  {
    id: 'th_fraud',
    text: (club) => `${club} are getting away with it, and one day soon somebody is going to work out how.`,
    proven: (c) => c.losses >= 2,
    disproven: (c) => c.wins >= 3,
    applies: (c) => c.position <= Math.ceil(c.leagueSize / 2),
    stance: -45,
  },
  {
    id: 'th_real',
    text: (club) => `I have watched ${club} four times now. This is not a fluke and I would like that noted.`,
    proven: (c) => c.wins >= 2,
    disproven: (c) => c.losses >= 2,
    applies: (c) => c.wins >= 2,
    stance: 55,
  },
  {
    id: 'th_content',
    text: (club) => `${club} are a media company that has accidentally been entered into a football competition.`,
    proven: (c) => c.followers > 250_000 && c.wins < 2,
    disproven: (c) => c.wins >= 3,
    applies: (c) => c.followers > 80_000,
    stance: -30,
  },
  {
    id: 'th_relegation',
    text: (club) => `${club} are going down. I said it in August and nothing since has moved me off it.`,
    proven: (c) => c.losses >= 2,
    disproven: (c) => c.wins >= 2,
    applies: (c) => c.position > c.leagueSize - 4,
    stance: -70,
  },
  {
    id: 'th_soft',
    text: (club) => `The moment ${club} go a goal down, they stop. Watch for it, you will not un-see it.`,
    proven: (c) => c.losses >= 1,
    disproven: (c) => c.wins >= 2 && c.losses === 0,
    applies: (c) => c.losses >= 1,
    stance: -25,
  },
  {
    id: 'th_manager',
    text: (club) => `Whoever is picking the ${club} side has more nerve than most people in this sport, and it will either look brilliant or it will look ridiculous.`,
    proven: (c) => c.wins >= 2,
    disproven: (c) => c.losses >= 2,
    applies: () => true,
    stance: 15,
  },
  {
    id: 'th_title',
    text: (club) => `I am putting my name to it: ${club} win this league.`,
    proven: (c) => c.wins >= 2 && c.position <= 3,
    disproven: (c) => c.losses >= 1 || c.position > 5,
    applies: (c) => c.position <= 4,
    stance: 80,
  },
  {
    id: 'th_crowd',
    text: (club) => `The best thing at ${club} is in the stands, and it is carrying a squad that does not deserve it.`,
    proven: (c) => c.sentiment >= 60 && c.wins < 2,
    disproven: (c) => c.sentiment < 40,
    applies: (c) => c.sentiment >= 50,
    stance: 20,
  },
  {
    id: 'th_bubble',
    text: (club) => `Everybody is going to feel a bit silly about ${club} in about six weeks.`,
    proven: (c) => c.losses >= 2,
    disproven: (c) => c.wins >= 3,
    applies: (c) => c.followers > 150_000,
    stance: -40,
  },
  {
    id: 'th_overdue',
    text: (club) => `${club} have been better than their results for a month. That corrects itself, it always does.`,
    proven: (c) => c.wins >= 2,
    disproven: (c) => c.losses >= 3,
    applies: (c) => c.losses >= 2,
    stance: 35,
  },
];

function evidenceFor(state: GameState): PunditEvidence {
  const form = recentForm(state, state.playerClubId, 4);
  const club = state.clubs[state.playerClubId];
  const position = leaguePosition(state);
  return {
    wins: form.filter((r) => r === 'W').length,
    losses: form.filter((r) => r === 'L').length,
    draws: form.filter((r) => r === 'D').length,
    position: position?.position ?? 6,
    leagueSize: standings(state).length || 12,
    sentiment: club?.fans.sentiment ?? 50,
    followers: club?.fans.onlineFollowers ?? 0,
    standing: socialStanding(state).standing,
  };
}

/**
 * Move the pundit on a week.
 *
 * His stance is checked against the evidence rather than drifting at random,
 * so a run of wins visibly humiliates a man who wrote you off and a collapse
 * visibly vindicates him. He picks a new thesis when the old one has stood
 * long enough that continuing to repeat it would be embarrassing.
 */
export function advancePundit(state: GameState, rng: Rng, cycle: number): PunditStance | null {
  const world = socialWorld(state);
  const club = state.clubs[state.playerClubId];
  if (!club) return world.pundit;
  const evidence = evidenceFor(state);

  let pundit = world.pundit;
  if (!pundit) {
    const person = rng.fork('who').pick(PUNDITS);
    const eligible = THESES.filter((t) => t.applies(evidence));
    const thesis = rng.fork('thesis').pick(eligible.length > 0 ? eligible : THESES);
    const anchor = socialMoments(state, { windowCycles: 3, limit: 4 })[0]?.eventId;
    if (!anchor) return null;
    return {
      name: person.name,
      handle: person.handle,
      avatarSeed: seedFrom('pundit', person.name),
      stance: thesis.stance,
      thesis: thesis.text(club.shortName),
      thesisId: thesis.id,
      thesisSetCycle: cycle,
      thesisEventId: anchor,
      proven: 0,
      disproven: 0,
    };
  }

  const current = THESES.find((t) => t.id === pundit?.thesisId);
  let proven = pundit.proven;
  let disproven = pundit.disproven;
  let stance = pundit.stance;

  if (current) {
    if (current.proven(evidence)) { proven++; stance += A.pundit.provenSwing * Math.sign(current.stance || 1); }
    else if (current.disproven(evidence)) { disproven++; stance += A.pundit.disprovenSwing * Math.sign(current.stance || 1); }
  }
  // He is also just a person watching football, and form pulls him around.
  const formTarget = (evidence.wins - evidence.losses) * 22;
  stance += (formTarget - stance) * A.pundit.formPull;
  pundit = { ...pundit, stance: clamp(stance, -100, 100), proven, disproven };

  const stale = cycle - pundit.thesisSetCycle >= A.pundit.thesisLife;
  const humiliated = disproven >= 2;
  if (stale || humiliated) {
    const eligible = THESES.filter((t) => t.applies(evidence) && t.id !== pundit?.thesisId);
    if (eligible.length > 0) {
      const thesis = rng.fork(`newthesis:${cycle}`).weighted(
        eligible,
        // He gravitates toward a thesis that matches where he has ended up.
        (t) => 1 + Math.max(0, 100 - Math.abs(t.stance - (pundit?.stance ?? 0))) / 25,
      );
      const anchor = socialMoments(state, { windowCycles: 3, limit: 4 })[0]?.eventId ?? pundit.thesisEventId;
      pundit = {
        ...pundit,
        thesis: thesis.text(club.shortName),
        thesisId: thesis.id,
        thesisSetCycle: cycle,
        thesisEventId: anchor,
        proven: 0,
        disproven: 0,
      };
    }
  }
  return pundit;
}

/** How the pundit is currently describing himself, for the UI. */
export function punditSummary(pundit: PunditStance | null): string {
  if (!pundit) return 'Nobody has picked a side on your club yet.';
  if (pundit.disproven >= 2) return 'He has been wrong about you twice running and has not yet said so.';
  if (pundit.proven >= 2) return 'He has been right about you twice running and will not let it go.';
  if (pundit.stance >= 50) return 'He is all in on your club and is starting to sound like a supporter.';
  if (pundit.stance <= -50) return 'He has written you off in print and would enjoy being proved right.';
  return 'He has an argument about your club and he is watching to see whether it holds.';
}

/* --- the weekly show ------------------------------------------------------ */

const SHOW_TITLES: readonly string[] = [
  'The Rundown', 'Full Time, Full Volume', 'Seven Days', 'The Sunday Post',
  'Weekly Business', 'The Table Talk', 'Matchweek', 'Extra Time',
];

const VERDICTS: readonly { at: number; verdict: string }[] = [
  { at: 9, verdict: 'A week this club will still be talking about in a decade.' },
  { at: 8, verdict: 'Very close to a perfect seven days.' },
  { at: 7, verdict: 'A good week, and there were not many of those a year ago.' },
  { at: 6, verdict: 'Solid. Nothing here anybody will remember, and nothing anybody regrets.' },
  { at: 5, verdict: 'A week that happened. That is genuinely the kindest reading.' },
  { at: 4, verdict: 'More went wrong than went right, and the mood has noticed.' },
  { at: 3, verdict: 'A bad week, and not the kind that fixes itself.' },
  { at: 2, verdict: 'About as poor as a week gets without anybody losing a job.' },
  { at: 0, verdict: 'Grim. Every single number moved the wrong way.' },
];

/**
 * Rate the week.
 *
 * Results are most of it, because they are most of it in reality — but reach,
 * fan mood and the club's own conduct all move the number, which is what makes
 * a 0-0 draw in a week you handled well rate higher than a win in a week you
 * spent arguing with your own supporters.
 */
export function buildWeeklyShow(
  state: GameState,
  rng: Rng,
  cycle: number,
): WeeklyShow | null {
  const club = state.clubs[state.playerClubId];
  if (!club) return null;
  const moments = socialMoments(state, { windowCycles: 1, limit: 10 }).filter((m) => !m.forward);
  if (moments.length === 0) return null;

  const form = recentForm(state, club.id, 2);
  const last = form[form.length - 1] ?? null;
  const world = socialWorld(state);
  const standing = socialStanding(state);

  const weekPosts = state.social.posts.filter((p) => p.cycle === cycle);
  const impressions = weekPosts.reduce((sum, p) => sum + p.likes * 26 + p.reposts * 90, 0);
  const mood = weekPosts.length
    ? weekPosts.reduce((sum, p) => sum + p.sentiment, 0) / weekPosts.length
    : 0;

  const rating = clamp(
    5
    + (last === 'W' ? 2.2 : last === 'L' ? -2.4 : 0)
    + mood * 1.8
    + (club.fans.sentiment - 50) / 28
    + Math.log10(impressions + 10) / 3.4
    + (world.supportersTrust - 55) / 40,
    A.show.ratingRange[0], A.show.ratingRange[1],
  );

  const segments: ShowSegment[] = [];
  for (const moment of moments.slice(0, A.show.segments)) {
    segments.push({
      id: `seg_${moment.id}`,
      label: segmentLabel(moment.trigger),
      line: moment.headline,
      tone: moment.sentiment > 0.15 ? 'GOOD' : moment.sentiment < -0.15 ? 'BAD' : 'NEUTRAL',
      eventId: moment.eventId,
    });
  }
  if (world.pundit) {
    segments.push({
      id: 'seg_pundit',
      label: `${world.pundit.name}'s take`,
      line: world.pundit.thesis,
      tone: world.pundit.stance > 20 ? 'GOOD' : world.pundit.stance < -20 ? 'BAD' : 'NEUTRAL',
      eventId: world.pundit.thesisEventId,
    });
  }
  segments.push({
    id: 'seg_standing',
    label: 'How you are coming across',
    line: standing.blurb,
    tone: standing.standing === 'BELOVED' || standing.standing === 'RESPECTED' ? 'GOOD'
      : standing.standing === 'CLOWN' ? 'BAD' : 'NEUTRAL',
  });

  const guest = Object.values(state.creators)
    .filter((c) => c.clubId === club.id)
    .sort((a, b) => b.followers - a.followers)[0];

  return {
    cycle,
    title: rng.fork('title').pick(SHOW_TITLES),
    verdict: VERDICTS.find((v) => rating >= v.at)?.verdict ?? VERDICTS[VERDICTS.length - 1]!.verdict,
    rating: Math.round(rating * 10) / 10,
    segments,
    ...(guest ? { guestCreatorId: guest.id } : {}),
  };
}

const segmentLabel = (trigger: string): string => {
  if (trigger.includes('WIN')) return 'The win';
  if (trigger.includes('DEFEAT') || trigger.includes('LOST')) return 'The defeat';
  if (trigger.includes('DRAWN')) return 'The draw';
  if (trigger.includes('GOAL')) return 'The goal';
  if (trigger.includes('RED')) return 'The red card';
  if (trigger.includes('SIGN')) return 'The signing';
  if (trigger.includes('INJUR')) return 'The injury';
  if (trigger.includes('FAN')) return 'The stands';
  if (trigger.includes('CREATOR')) return 'The content';
  if (trigger.includes('RECORD')) return 'The record';
  return 'Also this week';
};

/* --- the rumour mill ------------------------------------------------------ */

const RUMOUR_SOURCES: readonly string[] = [
  'Transfer Room', 'A regional reporter', 'A well-connected account', 'Somebody in the building',
  'A recruitment newsletter', 'An agent, off the record', 'Two separate podcasts',
];

const RUMOUR_SHAPES: readonly ((subject: string, club: string) => string)[] = [
  (s, c) => `${s} has been offered to two clubs above ${c}, and one of them has asked for numbers.`,
  (s) => `Talks over ${s} have been happening for longer than anybody has admitted.`,
  (s, c) => `${c} have set a figure on ${s}. Nobody has met it. Somebody will.`,
  (s) => `${s} has changed representation, which is never the end of a story.`,
  (s, c) => `An approach for ${s} was made and turned down without ${c} ever confirming it happened.`,
  (s) => `${s} was seen somewhere he had no reason to be, and the internet has done the rest.`,
  (s, c) => `The relationship between ${s} and ${c} is described by three separate people as "workable".`,
  (s) => `A medical has been pencilled in for ${s}. Pencilled, not booked.`,
];

/**
 * Rumours, with the confidence attached.
 *
 * A rumour is generated from a real transfer-adjacent event and carries a
 * stated credibility, so the surface never presents a guess as a fact. Three
 * cycles later the world checks it against what actually happened, and the
 * source's record is visible — which is the whole point of a rumour mill.
 */
export function generateRumour(state: GameState, rng: Rng, cycle: number): RumourItem | null {
  const candidates = socialMoments(state, { windowCycles: 2, limit: 12 }).filter(
    (m) => m.tags.includes('transfer') || m.tags.includes('contract') || m.trigger === 'BREAKOUT_INTEREST',
  );
  if (candidates.length === 0) return null;
  const world = socialWorld(state);
  if (world.rumours.some((r) => r.cycle === cycle)) return null;

  const moment = rng.fork('moment').weighted(candidates, (m) => m.importance);
  const subject = moment.tokens.player ? String(moment.tokens.player) : null;
  if (!subject) return null;
  const club = state.clubs[state.playerClubId];
  const shape = rng.fork('shape').pick(RUMOUR_SHAPES);
  const credibility = rng.fork('cred').float(A.rumour.credibility[0], A.rumour.credibility[1]);

  return {
    id: `rm_${moment.eventId}_${cycle}`.toLowerCase(),
    text: shape(subject, club?.shortName ?? 'the club'),
    credibility: Math.round(credibility * 100) / 100,
    cycle,
    eventId: moment.eventId,
    source: rng.fork('source').pick(RUMOUR_SOURCES),
  };
}

/**
 * Judge old rumours against what actually happened.
 *
 * A rumour about a player who then moved was true; one about a player still on
 * the books was not. Nothing is invented — the verdict is read off the journal.
 */
export function resolveRumours(state: GameState, cycle: number): RumourItem[] {
  const world = socialWorld(state);
  return world.rumours.map((rumour) => {
    if (rumour.resolved || cycle - rumour.cycle < A.rumour.resolveAfter) return rumour;
    const moved = state.eventLog.some(
      (e) => e.cycle > rumour.cycle
        && (e.type === 'PLAYER_SOLD' || e.type === 'TRANSFER_COMPLETED' || e.type === 'CONTRACT_SIGNED')
        && e.entities.some((ent) => ent.kind === 'player' && rumour.text.includes(ent.name)),
    );
    return { ...rumour, resolved: (moved ? 'TRUE' : 'FALSE') as RumourItem['resolved'] };
  }).slice(-A.rumour.retention);
}

/** The source's actual record, so credibility is earned rather than claimed. */
export function rumourAccuracy(state: GameState): { source: string; right: number; wrong: number }[] {
  const tally = new Map<string, { right: number; wrong: number }>();
  for (const rumour of socialWorld(state).rumours) {
    if (!rumour.resolved) continue;
    const held = tally.get(rumour.source) ?? { right: 0, wrong: 0 };
    if (rumour.resolved === 'TRUE') held.right++; else held.wrong++;
    tally.set(rumour.source, held);
  }
  return [...tally.entries()]
    .map(([source, record]) => ({ source, ...record }))
    .sort((a, b) => b.right - a.right || (a.source < b.source ? -1 : 1));
}

/* --- viral --------------------------------------------------------------- */

/**
 * Whether a post escapes its own audience, and by how much.
 *
 * Never rolled from nothing: it needs a genuinely significant underlying event
 * and genuine feeling in the post. A lukewarm line about a 1-1 draw cannot go
 * viral in this model, and it should not be able to.
 */
export function viralRoll(
  post: SocialPost,
  importance: number,
  rng: Rng,
): { viral: boolean; multiplier: number } {
  const v = A.viral;
  if (importance < v.minImportance) return { viral: false, multiplier: 1 };
  const chance = clamp(
    (v.baseChance + (importance - v.minImportance) * v.perImportance)
    * (0.3 + Math.abs(post.sentiment) * v.sentimentWeight * 2),
    0, 0.6,
  );
  if (!rng.chance(chance)) return { viral: false, multiplier: 1 };
  return { viral: true, multiplier: rng.float(v.multiplier[0], v.multiplier[1]) };
}

export type { WeeklyShow, PunditStance, RumourItem };
