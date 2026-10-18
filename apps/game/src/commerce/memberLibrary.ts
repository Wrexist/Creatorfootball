import { BASE_PACK, type CommentaryLine, type ContentPack, type MediaTemplate } from '@cf/engine';

/**
 * Saved in careers as the single library toggle. Every monthly issue ships
 * inside this one pack, so a career that enabled the library keeps it enabled
 * as new issues arrive. Never rename: it is persisted in `enabledPackIds`.
 */
export const MEMBER_LIBRARY_ID = 'creator-club-first-lights';

/** [base event type, nth base line of that type, replacement text]. */
type Line = readonly [eventType: string, index: number, text: string];
/** [base trigger, nth base template of that trigger, headline, body]. */
type Story = readonly [trigger: string, index: number, headline: string, body: string];
interface MemberIssue { readonly id: string; readonly title: string; readonly month: `${number}-${number}`; readonly lines: readonly Line[]; readonly stories: readonly Story[] }

/**
 * Each issue replaces the text of existing base lines only. IDs, tones,
 * weights, conditions and outlets are inherited, so an issue cannot change
 * random draws, match rules or media effects. Issues target different base
 * entries from each other and from the one-time packs, so every pack can be
 * enabled together without one silently hiding another.
 */
const ISSUES: readonly MemberIssue[] = [
  {
    id: MEMBER_LIBRARY_ID, title: 'First Lights', month: '2026-09',
    lines: [
      ['GOAL', 0, 'The terrace comes alive. {player} has given {club} a moment to keep.'],
      ['SHOT', 0, '{player} spots the opening. The bench leans forward.'],
      ['SAVE', 0, 'A firm hand from the goalkeeper keeps the story unfinished.'],
      ['MISS', 0, 'The chance passes. {player} takes a breath and looks for the next one.'],
      ['POST', 0, 'The post shakes. So does everyone behind it.'],
      ['FOUL', 0, 'The referee stops play. Both benches use the moment to reorganise.'],
      ['YELLOW_CARD', 0, '{player} is booked. The next challenge needs a cooler head.'],
      ['RED_CARD', 0, '{player} leaves the field. The shape of this match has changed.'],
    ],
    stories: [
      ['MATCH_WON', 0, 'A night for the club journal', '{club} finish ahead of {opponent}, {score}. Beyond the replay, the staff are already discussing what made the difference.'],
      ['MATCH_LOST', 0, 'The chapter after the whistle', '{club} lose to {opponent}, {score}. The club journal keeps the difficult pages too. The response begins on the training ground.'],
      ['MATCH_DRAWN', 0, 'A point and a conversation', '{club} and {opponent} share the points, {score}. Supporters have their own views on what comes next.'],
      ['PLAYER_SIGNED', 0, 'A new face behind the scenes', '{player} arrives at {club} for {fee}. The cameras follow the introduction; the coaches will guide the work.'],
      ['PRESS_CONFERENCE', 0, 'From the media room', '{manager} answers on {topic}: "{quote}". The statement enters the club record, alongside the football.'],
      ['CONTENT_DROP', 0, 'From the club to the community', '{creator} publishes "{title}" with {club}. The release reaches {reach} people and puts another club story into circulation.'],
    ],
  },
  {
    id: 'creator-club-autumn-pages', title: 'Autumn Pages', month: '2026-10',
    lines: [
      ['KICK_OFF', 0, 'The whistle goes. A fresh page of the club journal is open.'],
      ['CORNER', 0, 'Corner to {club}. The box fills and the taker waits for the right moment.'],
      ['FREE_KICK', 0, 'Free kick to {club}. The wall settles and the ground holds its breath.'],
      ['TACKLE', 0, '{player} times the challenge and comes away with the ball. The coaches will want that one on tape.'],
      ['SUBSTITUTION', 0, 'A change for {club}. {player} comes on with instructions and something to prove.'],
      ['HALFTIME', 0, 'Half time, {score}. The conversation starts before the players reach the tunnel.'],
      ['FULLTIME', 0, 'Full time, {score}. Another page is written, and the club journal will remember how.'],
      ['MOMENTUM_SHIFT', 0, 'The match tilts towards {club}. The stands feel it before the scoreboard shows it.'],
    ],
    stories: [
      ['MATCH_WON', 2, 'Pages worth keeping for {club}', '{club} beat {opponent}, {score}. The club journal will mark the date; the staff care more about the habits that produced it, and whether they hold next week.'],
      ['MATCH_LOST', 2, '{manager} and the morning after', '{club} lost {score} to {opponent}. The club journal keeps this page as it was written. What {manager} changes in training decides how the next one reads.'],
      ['MATCH_DRAWN', 2, 'A shared page for {club} and {opponent}', 'It ends {score}. Neither side found the last word, so both leave with a point and a list of moments to replay on the way home.'],
      ['PLAYER_INJURED', 0, 'A quieter week ahead for {player}', '{player} is out of contention for now. The medical staff will set the pace of the return; {club} must find another way through the fixtures in between.'],
      ['PLAYER_BREAKOUT', 0, 'Turning the page: {player} steps forward', 'The training ground saw it first. Now the matches show it too: {player} is playing like someone who knows the next chapter could be theirs.'],
      ['PLAYER_SOLD', 0, '{player} leaves {club} for {fee}', 'A farewell page in the club journal. {player} departs for {fee}; the supporters keep the memories, and the club now has to show what the money becomes.'],
    ],
  },
];

function baseLine(eventType: string, index: number): CommentaryLine {
  const line = (BASE_PACK.data.commentary ?? []).filter(x => x.eventType === eventType)[index];
  if (!line) throw new Error(`Missing base commentary ${eventType}[${index}]`);
  return line;
}
function baseStory(trigger: string, index: number): MediaTemplate {
  const story = (BASE_PACK.data.mediaTemplates ?? []).filter(x => x.trigger === trigger)[index];
  if (!story) throw new Error(`Missing base story ${trigger}[${index}]`);
  return story;
}

/** Built issue content, in publication order. */
export const MEMBER_ISSUES = ISSUES.map(issue => ({
  id: issue.id, title: issue.title, month: issue.month,
  commentary: issue.lines.map(([eventType, index, text]): CommentaryLine => ({ ...baseLine(eventType, index), text })),
  mediaTemplates: issue.stories.map(([trigger, index, headline, body]): MediaTemplate => ({ ...baseStory(trigger, index), headline, body })),
}));

/**
 * Append an issue only after its real content has been written and checked,
 * in the month it is published. Never prelabel future placeholders as released.
 */
export const MEMBER_RELEASES = MEMBER_ISSUES.map(({ id, title, month, commentary, mediaTemplates }) => ({ id, title, month, commentary: commentary.length, stories: mediaTemplates.length }));

/** "October 2026" for a "2026-10" issue month, independent of the device time zone. */
export function issueMonthLabel(month: string): string {
  const [year, value] = month.split('-').map(Number);
  return new Date(Date.UTC(year!, value! - 1, 1)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

const commentaryCount = MEMBER_RELEASES.reduce((n, issue) => n + issue.commentary, 0);
const storyCount = MEMBER_RELEASES.reduce((n, issue) => n + issue.stories, 0);
export const MEMBER_LIBRARY: ContentPack = {
  manifest: { id: MEMBER_LIBRARY_ID, name: 'Creator Club library', description: `Every released Creator Club issue (${MEMBER_RELEASES.map(issue => issue.title).join(', ')}): ${commentaryCount} commentary variations and ${storyCount} club-journal stories.`, version: `1.${MEMBER_RELEASES.length - 1}.0`, schemaVersion: 1, kind: 'SEASONAL', provider: 'Creator Football', identityKind: 'FICTIONAL', requires: ['base'], overrides: [], regions: [], createdAt: 1790208000000 },
  data: {
    commentary: MEMBER_ISSUES.flatMap(issue => issue.commentary),
    mediaTemplates: MEMBER_ISSUES.flatMap(issue => issue.mediaTemplates),
  },
};
