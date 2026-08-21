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
/**
 * `conditions` is how a story declares what has to be true of the save before
 * it is allowed to run. A line about a record that "stood for a generation" is
 * false in season one, and false copy is worse than no copy — it tells the
 * reader that none of it means anything. See `saveHistoryFacts` in
 * simulation/cascade.ts for the vocabulary.
 */
const story = (
  trigger: string,
  importance: number,
  sentiment: number,
  weight: number,
  outlets: readonly string[],
  entries: readonly { headline: string; body: string }[],
  conditions?: Readonly<Record<string, string | number | boolean>>,
): MediaTemplate[] =>
  entries.map((e) => ({
    id: `md_${(counter += 1).toString(36)}_${trigger.toLowerCase()}`,
    trigger, headline: e.headline, body: e.body, outlets, importance, sentiment, weight,
    ...(conditions ? { conditions } : {}),
  }));


/**
 * The press cover the interactive layer too.
 *
 * When the player speaks, promises, asks the supporters something or opens the
 * doors to a creator, that is a story — and it is often a bigger one than the
 * football. Every trigger below is produced by a real action the player took
 * about a real event, so the press are still reporting rather than inventing.
 */
const INTERACTIVE_MEDIA_TEMPLATES: readonly MediaTemplate[] = [
  ...story('PRESS_CONFERENCE', 3, 0.35, 8, ['Touchline Daily', 'Matchday Wire', 'Pressbox'], [
    {
      headline: '{manager} gives the room a straight answer on {topic}',
      body: 'Asked directly about {topic}, the {club} manager did not reach for the usual formula. "{quote}" It was the kind of answer a press officer spends a career trying to prevent and a dressing room hears first, and it will be replayed all week.',
    },
    {
      headline: '"{quote}" — {manager} sets the terms',
      body: 'There was no ambiguity in the {club} press room. {manager} was asked about {topic} and answered it in one sentence, which in this sport is close to a revolutionary act.',
    },
  ], { stance: 'WARM' }),
  ...story('PRESS_CONFERENCE', 4, -0.55, 9, ['Kickback Daily', 'The Terrace Post', 'Frontline Football'], [
    {
      headline: '{manager} turns on his own',
      body: 'Nobody in the room expected it and nobody in the room missed it. On {topic}, {manager} chose a form of words that leaves very little room for interpretation. "{quote}" Somebody inside {club} will have read that this morning and taken it exactly as it sounds.',
    },
    {
      headline: 'The {club} press conference that will not stay in the press room',
      body: '"{quote}" It is a sentence that solves a problem with the supporters and creates a different one with the players, and {manager} said it knowing both of those things.',
    },
  ], { stance: 'COLD' }),
  ...story('PRESS_CONFERENCE', 2, -0.1, 6, ['Counter Press', 'The Long Ball'], [
    {
      headline: '{manager} gives nothing away before the weekend',
      body: 'Twelve minutes, three questions, and a {club} manager who has clearly decided that the interesting version of this week happens on the pitch. "{quote}"',
    },
  ], { stance: 'FLAT' }),

  ...story('CONTENT_DROP', 3, 0.5, 8, ['ClipCity', 'The Signal Box Review', 'Standing Room'], [
    {
      headline: '{creator} takes {club} to an audience that does not watch this league',
      body: '"{title}" has now reached {reach} people, most of whom could not have named the division a week ago. The commercial department at {club} will be reading the numbers with considerable interest; the football department will be hoping nobody asks about the bits that were left in.',
    },
    {
      headline: 'The {club} film everybody is talking about',
      body: '{creator} was given access that clubs at this level do not give, and did something with it. "{title}" is not a promotional video, which is exactly why it has travelled.',
    },
  ], { flopped: false }),
  ...story('CONTENT_DROP', 2, -0.4, 6, ['Counter Press', 'Pitchside Weekly'], [
    {
      headline: 'A misfire for {club} and {creator}',
      body: '"{title}" was supposed to be the piece that widened the audience. It has not been, and somebody at {club} has signed off a budget that did not come back. Not every bet on attention pays.',
    },
  ], { flopped: true }),

  ...story('POLL_HONOURED', 3, 0.6, 8, ['The Terrace', 'Bootroom Digest', 'The Away End'], [
    {
      headline: '{club} asked, and then did what they were told',
      body: 'Supporter consultation is a phrase most clubs use and few clubs mean. {club} put {topic} to a vote, the answer came back {choice}, and the club has gone with it. The interesting part is not the decision. It is that anybody believed them enough to vote.',
    },
  ]),
  ...story('POLL_OVERRULED', 4, -0.7, 9, ['Kickback Daily', 'The Terrace Post'], [
    {
      headline: 'The {club} vote that was never going to change anything',
      body: 'The supporters were asked about {topic}. They answered clearly. The club has done something else. Every consultation this club runs from here will be read through this one, which is a high price for a decision that could have been taken quietly.',
    },
  ]),

  ...story('CAMPAIGN_BACKED', 3, 0.55, 7, ['The Away End', 'The Terrace', 'Standing Room'], [
    {
      headline: '{club} get behind {campaign}',
      body: 'It started with {group} and it has ended with the club’s name on it. Backing something the supporters organised costs a board very little and buys a great deal — provided, and this is the part most clubs get wrong, it is done without trying to take the credit.',
    },
  ]),
  ...story('CAMPAIGN_REFUSED', 3, -0.5, 7, ['Kickback Daily', 'The Terrace Post'], [
    {
      headline: '{club} say no to their own supporters',
      body: '{campaign} will go ahead without the club’s help. {group} were told directly, which is more than most clubs manage, and it will not make the next meeting any warmer.',
    },
  ]),

  ...story('STAKE_VINDICATED', 4, 0.8, 9, ['Frontline Football', 'Matchday Wire', 'Touchline Daily'], [
    {
      headline: '{club} said it out loud, and then went and did it',
      body: 'Talking before a football match is the cheapest thing in the sport and the most expensive when it goes wrong. It did not go wrong. Whatever else happens this season, nobody at {club} will have to apologise for this week.',
    },
  ]),
  ...story('STAKE_EMBARRASSED', 4, -0.8, 10, ['Kickback Daily', 'The Terrace Post', 'ClipCity'], [
    {
      headline: 'The {club} post that is still up',
      body: 'It was confident, it was public, and it was wrong. There is no version of this week where {club} come out of it well, and the part that will sting longest is that none of it was necessary.',
    },
  ]),

  ...story('CLUB_POSTED', 3, -0.3, 6, ['Kickback Daily', 'The Signal Box Review'], [
    {
      headline: '{club} pick a fight before kick-off',
      body: 'Club accounts are usually run by somebody whose entire job is not doing this. Whoever runs {club}’s has done it deliberately, and the reaction has been exactly what you would expect.',
    },
  ], { tone: 'PROVOCATIVE' }),
];

/**
 * Depth on the triggers the press cover most often.
 *
 * A season produces the same handful of stories dozens of times, and a shallow
 * pool is why an audit found one headline carrying a quarter of a season. These
 * exist purely so the archive reads like a newspaper rather than a template.
 */
const DEPTH_MEDIA_TEMPLATES: readonly MediaTemplate[] = [
  ...story('MATCH_WON', 3, 0.45, 9, ['Matchday Wire', 'Bootroom Digest', 'Pitchside Weekly'], [
    {
      headline: '{club} find a way past {opponent}',
      body: 'It was not pretty and for a long spell it was not likely, but {club} have three points and a considerably calmer week ahead of them. {opponent} will feel they gave it away; {club} will not care in the slightest.',
    },
    {
      headline: 'Three points and a bit of belief for {club}',
      body: '{score}. The performance will not be studied in years to come, but the reaction at full time told you what it meant to a squad that had been asked a lot of questions lately.',
    },
    {
      headline: '{club} take the points, and the argument',
      body: 'For an hour this was a match nobody deserved to win. Then {club} did something about it. {opponent} had no answer and, in truth, had not looked like finding one.',
    },
  ]),
  ...story('MATCH_LOST', 3, -0.5, 9, ['The Terrace Post', 'Kickback Daily', 'Touchline Daily'], [
    {
      headline: '{club} come up short at {opponent}',
      body: '{score}. The margin flatters nobody and the manner will worry a support that has watched several versions of this already. {opponent} did not have to be excellent, which is the part that will sting.',
    },
    {
      headline: 'Familiar problems, familiar afternoon for {club}',
      body: 'There is nothing new in the way {club} lost this. That is precisely the problem, and it is now a problem with a growing audience.',
    },
    {
      headline: '{opponent} take it as {club} fade',
      body: 'A bright twenty minutes, an hour of nothing, and a scoreline that will be quoted at {club} all week.',
    },
  ]),
  ...story('MATCH_DRAWN', 2, 0, 8, ['Counter Press', 'The Long Ball', 'Pitchside Weekly'], [
    {
      headline: 'Honours even between {club} and {opponent}',
      body: 'A point each, and two managers who will both privately believe they should have had three. On the balance of chances, neither is wrong.',
    },
    {
      headline: '{club} and {opponent} cancel each other out',
      body: 'A tactical afternoon in the least flattering sense of the phrase. Whatever the plan was on both benches, it worked, which is why nothing happened.',
    },
  ]),
  ...story('MANAGER_PRESSURE', 4, -0.6, 9, ['Kickback Daily', 'Frontline Football'], [
    {
      headline: 'The questions around {manager} are getting louder',
      body: 'Nobody at {club} has said anything, which is not the same as nobody thinking anything. The next fortnight will decide whether this is a wobble or the start of the other thing.',
    },
  ]),
  ...story('CREATOR_JOINED', 3, 0.5, 8, ['ClipCity', 'The Signal Box Review', 'Standing Room'], [
    {
      headline: '{creator} joins {club}',
      body: 'An audience arrives at a football club, which is a sentence that would have made no sense twenty years ago and makes perfect commercial sense now. What it is worth depends entirely on whether any of that audience ever buys a ticket.',
    },
  ]),
  ...story('CREATOR_MOMENT', 3, 0.4, 8, ['ClipCity', 'Standing Room'], [
    {
      headline: '{creator} puts {club} in front of {reach} people',
      body: 'Reach is not fandom and fandom is not revenue, and everybody in this industry now says both of those sentences while quietly checking the numbers anyway. These particular numbers are very good.',
    },
  ]),
];

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

  // Three record stories, and which one runs is decided by what the save can
  // actually claim: a mark that has stood for seasons, a mark taken off a named
  // predecessor, or a first entry in an empty book.
  ...story('RECORD_BROKEN', 4, 0.7, 8, ['Boot & Ball Weekly', 'The Signal Box Review'], [
    {
      headline: '{player} breaks a record that stood for a generation',
      body: 'It had stood for {recordAge} seasons, through everything this club has been through since. It did not survive {player}, and the ovation when it fell lasted a full two minutes.',
    },
  ], { recordAgeSeasons_gte: 3 }),
  ...story('RECORD_BROKEN', 3, 0.7, 8, ['The Signal Box Review', 'Pressbox', 'The Chalkboard'], [
    {
      headline: '{subject} takes {record} off the books',
      body: 'The mark that stood before this one is gone. It reads {value} now, and the name against it has changed.',
    },
    {
      headline: '{record} is rewritten at {value}',
      body: 'Not the sort of number anybody sets out to chase, and not the sort anybody forgets either. {club} have a new entry against it.',
    },
    {
      headline: 'The book gets a new line: {record}',
      body: '{value}. Somebody in the archive will be updating a page tonight, and somebody in the stand will be telling anyone who will listen that they were there.',
    },
    {
      headline: '{club} push {record} to {value}',
      body: 'Records like this move in steps, and this was a large one. It will stand until it does not.',
    },
  ], { hadPreviousHolder: true }),
  ...story('RECORD_BROKEN', 3, 0.6, 8, ['Boot & Ball Weekly', 'Pressbox'], [
    {
      headline: '{record}: {subject} sets the first mark',
      body: 'Nobody has held this one before. {value} is the number to beat now, and somebody eventually will.',
    },
    {
      headline: 'A first entry in the book for {club}',
      body: '{record} stands at {value}. A young club writing the first line of a page it will spend years arguing about.',
    },
  ], { hadPreviousHolder: false }),

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
      body: 'Another player-of-the-match award, and a growing sense that {club} are a considerably worse side on the days he does not play.',
    },
    {
      headline: 'Rated {rating}: the afternoon belonged to {player}',
      body: 'There are performances that win a match and performances that decide how a team thinks about itself. This was closer to the second.',
    },
    {
      headline: '{player} carries {club} again',
      body: 'A one-man argument for a squad that keeps asking the same player to make it. That is a compliment and a warning in the same sentence.',
    },
    {
      headline: 'Quietly, {player} has become the first name on the team sheet',
      body: 'No fanfare, no viral clip, just the highest rating on the pitch for the third time in a month. {club} are building around him whether they meant to or not.',
    },
  ]),

  ...story('ATTENDANCE_RECORDED', 2, 0.2, 4, ['The Terrace Post'], [
    {
      headline: 'Full house at {club}',
      body: 'Every seat sold and a waiting list behind it. At a ground this size that is less a commercial achievement than a cultural one.',
    },
    {
      headline: '{attendance} in, and not a seat spare',
      body: 'A capacity crowd of {attendance} against a ground that holds {capacity}. The club will tell you the atmosphere is worth a goal a game. On this evidence they are not wrong.',
    },
    {
      headline: 'The demand for {club} tickets has outrun the ground',
      body: 'Sold out again. Somewhere in a boardroom a spreadsheet about stand capacity is being reopened.',
    },
  ]),
  ...story('ATTENDANCE_RECORDED', 2, -0.35, 4, ['Kickback Daily', 'The Away End'], [
    {
      headline: 'Empty seats tell the {club} story better than the table does',
      body: '{attendance} through the turnstiles in a ground built for {capacity}. Supporters vote with their feet long before they vote with a banner.',
    },
    {
      headline: 'Gaps in the stands at {club}',
      body: 'The lower tier was patchy, the upper tier barely opened. Nobody inside the club will say it out loud, but the gate is a scoreboard too.',
    },
  ]),

  ...story('REPUTATION_CHANGED', 3, 0.4, 6, ['The Chalkboard', 'Boot & Ball Weekly'], [
    {
      headline: '{club} are being taken seriously now',
      body: 'Two years ago their approach for a player of that calibre would not have been answered. It was answered this week, and that is what reputation actually buys.',
    },
    {
      headline: 'The name {club} opens doors it did not open last season',
      body: 'Reputation is the slowest currency in football and the hardest to fake. Theirs is up to {reputation}, and agents have noticed before the supporters did.',
    },
  ]),
  ...story('REPUTATION_CHANGED', 3, -0.4, 6, ['Kickback Daily'], [
    {
      headline: 'Standing still is costing {club}',
      body: 'A club is only ever as big as the last three years say it is. Theirs now read {reputation}, and the players they used to be able to sign are taking other calls.',
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
    {
      headline: 'Week {week}: {opponent} away, and no hiding place',
      body: 'The fixture list has been pointing at this one for a month. Team news follows; so, inevitably, does an argument about the shape.',
    },
    {
      headline: 'What {club} need from the {opponent} game',
      body: 'Not a performance — a result. There is a difference and everyone inside the building knows which one is being asked for.',
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
    {
      headline: '{club} and {opponent} have found each other',
      body: 'Rivalries are not declared, they accumulate. Enough bad afternoons in a row and two clubs who had no history at all discover they have one.',
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

  /* The press covering the interactive layer, and depth on the regulars. */
  ...INTERACTIVE_MEDIA_TEMPLATES,
  ...DEPTH_MEDIA_TEMPLATES,
];

export const BASE_MEDIA_TEMPLATE_COUNT = BASE_MEDIA_TEMPLATES.length;
