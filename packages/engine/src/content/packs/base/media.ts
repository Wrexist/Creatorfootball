import type { MediaTemplate } from '../../schema';

/**
 * Media story templates.
 *
 * The press are a slower, heavier voice than the social feed: fewer stories,
 * more weight, and an outlet attached so the same event can be reported warmly
 * by one publication and viciously by another. `importance` drives how large the
 * UI renders the story; `sentiment` is -1..1 and is what a good media department
 * dampens.
 *
 * Tokens: {club} {opponent} {player} {creator} {manager} {score} {fee}
 *         {sponsor} {amount} {position} {record}
 *
 * Outlets are invented publications. None refers to any real title.
 */

export const MEDIA_OUTLETS: readonly string[] = [
  'The Terrace Post',
  'Standing Room',
  'Matchday Wire',
  'The Chalkboard',
  'Boot & Ball Weekly',
  'The Away End',
  'Frontline Football',
  'Touchline Daily',
  'The Long Ball',
  'Pressbox',
  'The Signal Box Review',
  'Common Ground Quarterly',
];

let counter = 0;
const story = (
  trigger: string,
  importance: number,
  sentiment: number,
  weight: number,
  outlets: readonly string[],
  entries: readonly { headline: string; body: string }[],
): MediaTemplate[] =>
  entries.map((e) => ({
    id: `md_${(counter += 1).toString(36)}_${trigger.toLowerCase()}`,
    trigger, headline: e.headline, body: e.body, outlets, importance, sentiment, weight,
  }));

export const BASE_MEDIA_TEMPLATES: readonly MediaTemplate[] = [
  ...story('MATCH_WON', 3, 0.5, 10, ['Matchday Wire', 'Touchline Daily', 'Frontline Football'], [
    {
      headline: '{club} see off {opponent} to build momentum',
      body: 'A {score} win at a ground that has not been kind to them lifts {club} and settles, for a week at least, a conversation that had been getting louder. {player} was the difference and knew it.',
    },
    {
      headline: 'Ruthless {club} punish a passive {opponent}',
      body: 'This was not close, whatever the scoreline suggests. {club} pressed from the first whistle, took the two chances that mattered and were never seriously threatened after.',
    },
  ]),
  ...story('MATCH_WON', 4, 0.6, 8, ['The Terrace Post', 'Standing Room'], [
    {
      headline: 'A win that changes the shape of the season for {club}',
      body: 'Results like this are how a mid-table club stops being a mid-table club. Whether {club} can repeat it in eleven days against far better opposition is the only question that now matters.',
    },
  ]),

  ...story('MATCH_LOST', 3, -0.5, 10, ['Pressbox', 'Touchline Daily', 'The Long Ball'], [
    {
      headline: '{club} beaten again as familiar problems resurface',
      body: 'The same weaknesses, in the same areas, against a side who did nothing unexpected. {club} were second to everything for twenty minutes and the game was gone before they noticed.',
    },
    {
      headline: 'Questions for {club} after {score} defeat',
      body: 'Nobody is calling this a crisis yet. Everybody in the ground was thinking about the word. {opponent} did not have to be good; they only had to turn up.',
    },
  ]),
  ...story('MATCH_LOST', 4, -0.7, 7, ['The Away End', 'The Chalkboard'], [
    {
      headline: 'The performance that will define {manager}\'s reign at {club}',
      body: 'There is a difference between losing and looking like a side who no longer believe the plan. This was the second, and the away support said so loudly enough that everybody heard it.',
    },
  ]),

  ...story('MATCH_DRAWN', 2, 0, 10, ['Matchday Wire', 'Frontline Football'], [
    {
      headline: 'Honours even as {club} and {opponent} cancel each other out',
      body: 'A cautious, tightly-refereed {score} in which both managers appeared happier with a point than either would admit publicly.',
    },
    {
      headline: '{club} rescue a point they barely deserved',
      body: 'Late, scrappy and entirely necessary. {club} were outplayed for long spells and will regard this as a night survived rather than a night enjoyed.',
    },
  ]),

  ...story('GOAL_SCORED', 3, 0.5, 6, ['Frontline Football', 'Boot & Ball Weekly'], [
    {
      headline: '{player} produces the moment of the round',
      body: 'It is the kind of finish that ends up detached from its match entirely, watched by people who could not name either side. {player} has now scored in consecutive fixtures.',
    },
  ]),

  ...story('RED_CARD', 4, -0.6, 10, ['Pressbox', 'Touchline Daily'], [
    {
      headline: '{player} sees red as {club} lose their heads',
      body: 'A dismissal that was coming from the moment the fixture kicked off. {player} will now miss the next match, and the club will spend the week explaining a decision that had no explanation.',
    },
    {
      headline: 'Discipline the story again for {club}',
      body: 'This is not an isolated incident and the numbers say so. {club} have now had more players sent off than any side in the competition, which is a record nobody wanted to be near.',
    },
  ]),

  ...story('PLAYER_SIGNED', 3, 0.3, 10, ['Matchday Wire', 'The Long Ball', 'Pressbox'], [
    {
      headline: '{club} complete {fee} move for {player}',
      body: 'The deal has been quietly progressing for a fortnight. {player} becomes one of the club\'s more significant recent outlays, and the expectation attached to that figure will arrive immediately.',
    },
    {
      headline: 'A signing that tells you where {club} think they are going',
      body: 'You do not pay {fee} for a squad player. This is a statement, and the rest of the competition will have read it as one.',
    },
  ]),
  ...story('PLAYER_SIGNED', 2, -0.2, 6, ['The Chalkboard'], [
    {
      headline: 'Is {player} really the answer for {club}?',
      body: 'The underlying numbers are less flattering than the highlight reel. {player} arrives with a reputation built on a small sample and a fee built on the reputation.',
    },
  ]),

  ...story('PLAYER_SOLD', 3, -0.4, 10, ['The Terrace Post', 'Standing Room'], [
    {
      headline: '{club} cash in on {player} for {fee}',
      body: 'Financially defensible, competitively difficult, and emotionally very hard for a support who had adopted him. The club insist the money will be reinvested. The support have heard that before.',
    },
    {
      headline: 'Selling club, again: {player} departs {club}',
      body: 'Another season, another best player leaving in the summer. Until that pattern breaks, everything else the club says about ambition is noise.',
    },
  ]),

  ...story('TRANSFER_HIJACKED', 4, -0.5, 8, ['Pressbox', 'The Long Ball'], [
    {
      headline: 'Hijacked: {player} deal collapses at the last',
      body: 'A rival moved late, moved harder and moved with better terms. {club} were left holding a medical slot and a press release that will now never be sent.',
    },
  ]),

  ...story('PLAYER_INJURED', 3, -0.4, 10, ['Matchday Wire', 'Touchline Daily'], [
    {
      headline: 'Blow for {club} as {player} faces spell out',
      body: 'The initial assessment is not encouraging. {club} have limited cover in that position and a run of fixtures that will not wait for anybody to recover.',
    },
    {
      headline: '{player} injury exposes the thinnest squad in the competition',
      body: 'One injury should not be a crisis. At {club} it is, and that is a squad-building problem rather than a medical one.',
    },
  ]),

  ...story('PLAYER_BREAKOUT', 3, 0.6, 8, ['Boot & Ball Weekly', 'The Chalkboard'], [
    {
      headline: 'The rise of {player}',
      body: 'Six months ago he was a squad number. He is now the first name on the teamsheet and the subject of three separate conversations at clubs with more money than this one.',
    },
    {
      headline: 'Everyone has noticed {player} now',
      body: 'The numbers were visible to anybody paying attention a season ago. The difference is that people are paying attention, and that changes what happens next.',
    },
  ]),

  ...story('YOUTH_PROSPECT_PROMOTED', 2, 0.5, 6, ['Common Ground Quarterly', 'The Signal Box Review'], [
    {
      headline: 'Academy graduate {player} promoted at {club}',
      body: 'A quiet piece of news that matters more than it looks. Clubs at this level survive on the pathway working, and at {club} it visibly does.',
    },
  ]),

  ...story('CREATOR_JOINED', 4, 0.3, 9, ['Frontline Football', 'Pressbox'], [
    {
      headline: '{creator} joins {club} in a deal that changes their reach overnight',
      body: 'The football stays the same. Everything around it does not. {club} have just acquired an audience larger than their entire supporter base, and now have to work out what to do with it.',
    },
    {
      headline: 'Reach is not fandom: what {creator} actually brings to {club}',
      body: 'The follower number is enormous and mostly irrelevant. The question is conversion, and on that measure the early evidence at other clubs has been sobering.',
    },
  ]),

  ...story('SPONSOR_SIGNED', 2, 0.4, 8, ['Matchday Wire', 'The Long Ball'], [
    {
      headline: '{club} announce {sponsor} partnership',
      body: 'A deal reported at {amount} per cycle, and a meaningful step up in class from the club\'s previous commercial ceiling.',
    },
  ]),
  ...story('SPONSOR_LOST', 3, -0.5, 8, ['Pressbox', 'The Chalkboard'], [
    {
      headline: '{sponsor} walk away from {club}',
      body: 'The deal was not renewed and neither party is saying why. Sponsors leaving is rarely about the sponsor; it is almost always about what the club has become.',
    },
  ]),

  ...story('MANAGER_SACKED', 5, -0.4, 10, ['Touchline Daily', 'Pressbox', 'The Away End'], [
    {
      headline: '{manager} sacked by {club}',
      body: 'The decision was taken after a run that had become impossible to defend internally. Whether the squad was ever good enough for the objectives set is a question the board have avoided answering.',
    },
    {
      headline: 'The end at {club}: what went wrong for {manager}',
      body: 'It was not one thing. It was a recruitment window that missed, a fixture list that did not forgive, and a dressing room that stopped believing somewhere around the turn of the year.',
    },
  ]),

  ...story('TROPHY_WON', 5, 0.9, 10, ['The Terrace Post', 'Frontline Football', 'Standing Room'], [
    {
      headline: '{club} are champions',
      body: 'They were not the biggest club in this competition and for most of the season they were not the best. They were, at the end of it, the only ones still standing, and that is the only measure that lasts.',
    },
    {
      headline: 'How {club} won it',
      body: 'A defence that conceded less than anybody, a wildcard slot used better than anybody, and a manager who made the right call in the two fixtures where a wrong one would have ended it.',
    },
  ]),

  ...story('RELEGATED', 5, -0.8, 10, ['Pressbox', 'The Away End'], [
    {
      headline: '{club} relegated',
      body: 'Confirmed with a week to spare, which somehow made it worse. The rebuild starts now and it will be harder than anyone at the club is currently saying out loud.',
    },
    {
      headline: 'The season {club} lost long before the final week',
      body: 'The decisions that relegated this club were taken in a transfer window nine months ago. Everything since has been consequence.',
    },
  ]),

  ...story('PROMOTED', 5, 0.8, 9, ['Standing Room', 'The Signal Box Review'], [
    {
      headline: '{club} go up',
      body: 'A club that was written off in pre-season by almost everyone, this publication included, has spent the year quietly proving all of us wrong.',
    },
  ]),

  ...story('RIVALRY_INTENSIFIED', 4, -0.3, 9, ['The Away End', 'Boot & Ball Weekly'], [
    {
      headline: 'Bad blood: {club} and {opponent} is now personal',
      body: 'What began as a fixture between two clubs who happened to be near each other has acquired an edge, and the next meeting will be policed accordingly.',
    },
    {
      headline: 'The feud nobody planned',
      body: 'Two incidents, one interview and a very badly judged post. {club} and {opponent} now genuinely dislike each other, which is excellent for everyone except the people who have to referee it.',
    },
  ]),

  ...story('FAN_SENTIMENT_CHANGED', 3, -0.5, 8, ['The Terrace Post', 'Common Ground Quarterly'], [
    {
      headline: 'The mood has turned at {club}',
      body: 'Attendances are holding, for now. What has gone is the noise, and every manager in the game will tell you that the silence arrives before the banners do.',
    },
  ]),
  ...story('FAN_SENTIMENT_CHANGED', 3, 0.5, 6, ['Standing Room'], [
    {
      headline: 'Something has shifted at {club}',
      body: 'A support who spent the autumn arguing with each other have spent the last month singing. It is not the results alone; it is that the plan is finally legible from the stands.',
    },
  ]),

  ...story('BALANCE_LOW', 4, -0.7, 9, ['Pressbox', 'The Chalkboard'], [
    {
      headline: 'Finances at {club} under genuine strain',
      body: 'Filings show a wage bill that has outgrown the income supporting it. The club say there is no cause for concern. The numbers say the next window will be a selling one.',
    },
  ]),

  ...story('RECORD_BROKEN', 4, 0.7, 8, ['Boot & Ball Weekly', 'The Signal Box Review'], [
    {
      headline: '{player} breaks a record that stood for a generation',
      body: 'It had survived four managers, two relegations and a rebuild. It did not survive {player}, and the ovation when it fell lasted a full two minutes.',
    },
  ]),

  ...story('SPECIAL_RULE_TRIGGERED', 3, 0.2, 7, ['Frontline Football', 'Matchday Wire'], [
    {
      headline: 'The three minutes that decided it',
      body: 'The rule window opened at {score} and closed somewhere else entirely. Whatever you think of the format, nobody in that arena looked away.',
    },
  ]),

  ...story('SEASON_STARTED', 3, 0.3, 8, ['Touchline Daily', 'The Long Ball'], [
    {
      headline: 'Twelve clubs, one table: the season ahead',
      body: 'One clear favourite, four clubs who could challenge if things break their way, and two who will spend the year looking downward. Same as every year, and it never plays out that way.',
    },
  ]),

  ...story('SEASON_COMPLETED', 4, 0.1, 9, ['Pressbox', 'The Terrace Post'], [
    {
      headline: '{club} finish {position}: the season reviewed',
      body: 'Twenty-two matches, one long argument about whether this squad was ever capable of more. The honest answer sits somewhere between the optimists and the people who were shouting in November.',
    },
  ]),

  ...story('OBJECTIVE_FAILED', 3, -0.4, 7, ['Touchline Daily'], [
    {
      headline: '{club} miss the target set by the board',
      body: 'Stated publicly in pre-season, missed comprehensively, and now the subject of a review that everybody involved would rather not be having.',
    },
  ]),

  ...story('OBJECTIVE_COMPLETED', 2, 0.4, 6, ['Matchday Wire'], [
    {
      headline: '{club} deliver on their season target',
      body: 'Hit with fixtures to spare. It buys the manager credit, and in this competition credit is the only currency that spends in February.',
    },
  ]),

  ...story('CONTRACT_EXPIRING', 3, -0.3, 8, ['The Long Ball', 'Pressbox'], [
    {
      headline: 'Talks stall between {club} and {player}',
      body: 'Six months to run and a gap between the offer and the demand that both sides describe privately as significant. Two clubs are already watching.',
    },
  ]),

  ...story('CONTRACT_SIGNED', 2, 0.5, 6, ['Matchday Wire', 'Standing Room'], [
    {
      headline: '{player} commits his future to {club}',
      body: 'A relief rather than a triumph, but at a club this size the two are frequently the same thing.',
    },
  ]),

  ...story('FACILITY_UPGRADED', 2, 0.3, 5, ['Common Ground Quarterly', 'The Signal Box Review'], [
    {
      headline: '{club} complete facility investment',
      body: 'Unglamorous, invisible on a matchday and almost certainly the most consequential thing the club has done this year.',
    },
  ]),

  ...story('MOTM_AWARDED', 2, 0.5, 5, ['Frontline Football'], [
    {
      headline: '{player} the difference again',
      body: 'A third player-of-the-match award in five outings, and a growing sense that {club} are a considerably worse side on the days he does not play.',
    },
  ]),

  ...story('ATTENDANCE_RECORDED', 2, 0.2, 4, ['The Terrace Post'], [
    {
      headline: 'Full house at {club}',
      body: 'Every seat sold and a waiting list behind it. At a ground this size that is less a commercial achievement than a cultural one.',
    },
  ]),

  ...story('REPUTATION_CHANGED', 3, 0.4, 6, ['The Chalkboard', 'Boot & Ball Weekly'], [
    {
      headline: '{club} are being taken seriously now',
      body: 'Two years ago their approach for a player of that calibre would not have been answered. It was answered this week, and that is what reputation actually buys.',
    },
  ]),

  ...story('TRANSFER_BID_REJECTED', 2, 0, 6, ['The Long Ball'], [
    {
      headline: '{club} reject opening bid for {player}',
      body: 'Described internally as derisory, which is the standard description of an opening bid. An improved offer is expected and the player has not yet been consulted.',
    },
  ]),

  ...story('PLAYER_RELEASED', 2, -0.2, 4, ['Pressbox'], [
    {
      headline: '{player} released by {club}',
      body: 'A short statement, no interview, and the end of a spell that never quite happened for either party.',
    },
  ]),

  ...story('CREATOR_MOMENT', 2, 0.4, 5, ['Frontline Football', 'Matchday Wire'], [
    {
      headline: 'The clip that travelled further than the result',
      body: '{creator}\'s reaction has been seen more times than the highlights of the match it came from, which tells you something about this competition that the table never will.',
    },
  ]),

  ...story('MATCH_SCHEDULED', 2, 0, 4, ['Touchline Daily'], [
    {
      headline: 'Preview: {club} v {opponent}',
      body: 'Two clubs in wildly different places arriving at the same fixture with the same amount to lose. The wildcard selections will be published an hour before kick-off and both will be scrutinised.',
    },
  ]),

  ...story('GAME_STARTED', 3, 0.2, 6, ['The Terrace Post', 'Pressbox'], [
    {
      headline: '{manager} takes charge at {club}',
      body: 'An appointment that will be judged on a timescale considerably shorter than the one it deserves. The first fixture is in a week.',
    },
  ]),

  ...story('SCOUT_REPORT_READY', 1, 0.1, 3, ['The Chalkboard'], [
    {
      headline: 'The player {club} have been watching',
      body: 'A full report has landed and the recommendation is not what the recruitment meeting expected. Whether anybody acts on it is a separate matter.',
    },
  ]),

  ...story('PLAYER_MORALE_CHANGED', 3, -0.5, 7, ['Pressbox', 'The Away End'], [
    {
      headline: 'Unrest at {club} as {player} makes his position clear',
      body: 'The club describe it as a routine conversation. Three separate people at the training ground describe it as considerably less routine than that.',
    },
    {
      headline: 'Inside a dressing room that has stopped agreeing with itself',
      body: 'Nobody has said anything publicly and nobody needs to. The body language on Sunday did the work, and {player} was at the centre of all of it.',
    },
  ]),

  ...story('RIVALRY_CREATED', 3, -0.2, 6, ['Boot & Ball Weekly'], [
    {
      headline: 'A new rivalry is born between {club} and {opponent}',
      body: 'Nobody asked for it, both sets of supporters have enthusiastically adopted it, and the fixture list has helpfully given us three meetings this season.',
    },
  ]),

  ...story('TRANSFER_COMPLETED', 3, 0.2, 7, ['Matchday Wire', 'Pressbox'], [
    {
      headline: 'Deal done: {player} to {club} for {fee}',
      body: 'Completed after a fortnight of increasingly public negotiation. Both clubs will privately claim to have won it, which is generally the sign of a fair price.',
    },
  ]),

  ...story('PLAYER_DEVELOPED', 2, 0.4, 5, ['The Chalkboard', 'Common Ground Quarterly'], [
    {
      headline: 'What {club} have quietly done with {player}',
      body: 'A twelve-month improvement curve that has not been matched anywhere else in the competition. The coaching staff will not discuss the method, which is itself informative.',
    },
  ]),

  ...story('LIVE_DECISION_MADE', 3, 0.1, 6, ['Touchline Daily', 'Frontline Football'], [
    {
      headline: 'The call that decided it',
      body: 'One change, made at exactly the point where doing nothing would have been forgivable. It worked, and if it had not, this piece would have been written in a very different register.',
    },
  ]),
];

export const BASE_MEDIA_TEMPLATE_COUNT = BASE_MEDIA_TEMPLATES.length;
