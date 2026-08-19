import type { SocialTemplate } from '../../schema';

/**
 * Social post templates, keyed to domain events.
 *
 * Every template is attached to a trigger that is a real `DomainEventType`.
 * That constraint is the whole design rule for the feed: a post that does not
 * trace back to something that actually happened is a bug, so there is no
 * "generic chatter" bucket here for the engine to pad the feed with.
 *
 * Authors are typed so the feed can mix voices: your own fans, a rival's fans,
 * the media, an attached creator, the club account, the player himself, a
 * sponsor, and the occasional leak. Sentiment is -1..1 and drives the colour of
 * the post; weight drives how large the UI renders it.
 *
 * Tokens: {club} {opponent} {player} {creator} {manager} {score} {fee}
 *         {sponsor} {amount} {position} {minute}
 */

type Author = SocialTemplate['authorKind'];

let counter = 0;
const post = (
  trigger: string,
  authorKind: Author,
  sentiment: number,
  weight: number,
  texts: readonly string[],
  tags: readonly string[] = [],
): SocialTemplate[] =>
  texts.map((text) => ({
    id: `sp_${(counter += 1).toString(36)}_${trigger.toLowerCase()}`,
    trigger, authorKind, text, sentiment, weight, tags,
  }));

export const BASE_SOCIAL_TEMPLATES: readonly SocialTemplate[] = [
  /* --------------------------------------------------------- MATCH_WON */
  ...post('MATCH_WON', 'FAN', 0.8, 3, [
    'THREE POINTS. Do not talk to me about anything else today.',
    'We were awful for twenty minutes and won anyway. That is what good teams do, apparently. {club}.',
    '{player} was unplayable today. Genuinely unplayable.',
    'Best I have felt walking out of that ground in two years.',
    'I have watched {club} for nineteen years and I have never enjoyed a {score} more.',
  ], ['result']),
  ...post('MATCH_WON', 'CLUB', 0.7, 2, [
    'Full time: {club} {score} {opponent}. Back to work.',
    'Job done. Thank you to everyone who travelled.',
    'Three points, and a word for the away end who were outstanding.',
  ], ['result']),
  ...post('MATCH_WON', 'CREATOR', 0.7, 4, [
    'Told you. Told all of you. {club}.',
    'That is what happens when you let us have the ball. Enjoy the clip.',
    'I have been shouting about {player} for six weeks and now everybody has discovered him.',
  ], ['result']),
  ...post('MATCH_WON', 'RIVAL', -0.5, 2, [
    'Congratulations to {club} on beating a side with four players out. Historic.',
    'Enjoy it. You will not be there in May.',
  ], ['result', 'rivalry']),
  ...post('MATCH_WON', 'MEDIA', 0.2, 2, [
    '{club} take the points against {opponent}, {score}. Report and ratings shortly.',
  ], ['result']),

  /* -------------------------------------------------------- MATCH_LOST */
  ...post('MATCH_LOST', 'FAN', -0.8, 3, [
    'Same story every single week. No idea, no shape, no fight.',
    'I am not angry. I have run out of angry. {club} {score} {opponent}.',
    'Paid forty quid for that. Forty.',
    'We are not good enough and pretending otherwise is how we ended up here.',
    'Genuinely thought we had turned a corner. We had not turned a corner.',
  ], ['result']),
  ...post('MATCH_LOST', 'CLUB', -0.2, 2, [
    'Full time: {club} {score} {opponent}. Not good enough today. We go again.',
    'A disappointing afternoon. Thank you to the supporters who stayed to the end.',
  ], ['result']),
  ...post('MATCH_LOST', 'RIVAL', 0.7, 3, [
    'Comfortable. Genuinely comfortable. Thanks for the hospitality, {club}.',
    'Some of you were very loud at 1-0. Where did you go?',
    'Every year. Every single year.',
  ], ['result', 'rivalry']),
  ...post('MATCH_LOST', 'CREATOR', -0.6, 4, [
    'I am not doing a reaction video. There is nothing to react to.',
    'Watched that live and I am still processing it. {club} have to be better.',
  ], ['result']),
  ...post('MATCH_LOST', 'MEDIA', -0.2, 2, [
    'Defeat for {club}, who have now taken one point from a possible nine.',
  ], ['result']),

  /* -------------------------------------------------------- MATCH_DRAWN */
  ...post('MATCH_DRAWN', 'FAN', 0, 2, [
    'A point. Somehow both a good result and an insult.',
    'Drew that having been outplayed for the whole thing. I will take it.',
    'Two points dropped, and everyone in that ground knows it.',
  ], ['result']),
  ...post('MATCH_DRAWN', 'MEDIA', 0, 2, [
    '{club} and {opponent} share the points, {score}.',
  ], ['result']),
  ...post('MATCH_DRAWN', 'CREATOR', 0.1, 3, [
    'Draws do not trend and that is the tragedy of my job.',
  ], ['result']),

  /* -------------------------------------------------------- GOAL_SCORED */
  ...post('GOAL_SCORED', 'FAN', 0.9, 3, [
    'GOOOOOO ON {player}!!!',
    '{player} again. He is carrying this football club.',
    'That is the goal of the season and I will not be debating it.',
    'Off the seat, drink everywhere, worth it.',
  ], ['goal']),
  ...post('GOAL_SCORED', 'CLUB', 0.8, 2, [
    '⚽ {player} — {minute}\'. {score}.',
    'GOAL. {player} makes it {score}.',
  ], ['goal']),
  ...post('GOAL_SCORED', 'CREATOR', 0.8, 4, [
    'THE CLIP. THE CLIP. {player} you absolute menace.',
    '{player} scoring in front of the away end is exactly why I bought into this club.',
  ], ['goal']),
  ...post('GOAL_SCORED', 'PLAYER', 0.7, 3, [
    'For the fans who travelled. 🙏',
    'Three points was all that mattered today.',
  ], ['goal']),

  /* --------------------------------------------------------- RED_CARD */
  ...post('RED_CARD', 'FAN', -0.7, 4, [
    '{player} has to think. He has to THINK.',
    'Down to six with fifteen minutes left. Every week something.',
    'That is not passion, that is stupidity, and it has cost us.',
  ], ['discipline']),
  ...post('RED_CARD', 'RIVAL', 0.6, 3, [
    'Predictable from {player}. Absolutely predictable.',
    'Six against seven and they still could not manage it.',
  ], ['discipline', 'rivalry']),
  ...post('RED_CARD', 'MEDIA', -0.3, 3, [
    '{player} is sent off in the {minute}th minute. He will now serve a suspension.',
  ], ['discipline']),
  ...post('RED_CARD', 'CREATOR', -0.4, 3, [
    'I have watched it four times. It is a red. It is a clear red. Move on.',
  ], ['discipline']),

  /* ----------------------------------------------------- PLAYER_SIGNED */
  ...post('PLAYER_SIGNED', 'CLUB', 0.6, 3, [
    'Welcome to {club}, {player}. ✍️',
    '{player} has signed. Welcome to the family.',
  ], ['transfer']),
  ...post('PLAYER_SIGNED', 'FAN', 0.5, 2, [
    'Never heard of him. Trusting the process. Reluctantly.',
    '{player}?! For {fee}?! That is outstanding business.',
    'I have watched every clip on the internet of {player} and I am now an expert.',
    'Right position, wrong player, and I will be delighted to be wrong.',
  ], ['transfer']),
  ...post('PLAYER_SIGNED', 'CREATOR', 0.5, 4, [
    'I have been asking for exactly this signing for two windows. You are all welcome.',
    'Big statement from {club}. This is not a club settling for mid-table.',
  ], ['transfer']),
  ...post('PLAYER_SIGNED', 'MEDIA', 0.1, 3, [
    '{club} complete the signing of {player} for a reported {fee}.',
  ], ['transfer']),
  ...post('PLAYER_SIGNED', 'RIVAL', -0.3, 2, [
    'Buying our rejects again, I see.',
  ], ['transfer', 'rivalry']),

  /* -------------------------------------------------------- PLAYER_SOLD */
  ...post('PLAYER_SOLD', 'FAN', -0.6, 3, [
    'Selling {player} tells you everything about the ambition here.',
    'Gutted. Genuinely gutted. Best of luck {player}, you were one of us.',
    '{fee}. For HIM. We have been robbed and I am furious.',
    'Every time we get someone good, this happens. Every time.',
  ], ['transfer']),
  ...post('PLAYER_SOLD', 'CLUB', 0.1, 2, [
    '{player} has left the club. Thank you for everything.',
  ], ['transfer']),
  ...post('PLAYER_SOLD', 'PLAYER', 0.3, 3, [
    'Thank you for four years I will never forget. This club will always be mine.',
    'A new chapter. Nothing but love for everyone at {club}.',
  ], ['transfer']),
  ...post('PLAYER_SOLD', 'MEDIA', 0, 2, [
    '{player} departs {club} in a deal worth {fee}.',
  ], ['transfer']),

  /* --------------------------------------------------- TRANSFER_HIJACKED */
  ...post('TRANSFER_HIJACKED', 'FAN', -0.7, 4, [
    'Hijacked. Again. We are a stepping stone in our own transfer window.',
    'Everyone knew this would happen the second the story leaked.',
  ], ['transfer']),
  ...post('TRANSFER_HIJACKED', 'LEAK', -0.2, 4, [
    'Understand {player} was at the training ground this morning and left without signing. Make of that what you will.',
    'Told that a second club came in late with a significantly improved package. It is done.',
  ], ['transfer', 'rumour']),
  ...post('TRANSFER_HIJACKED', 'RIVAL', 0.6, 3, [
    'Thanks for doing the scouting for us. ❤️',
  ], ['transfer', 'rivalry']),

  /* ---------------------------------------------- TRANSFER_BID_REJECTED */
  ...post('TRANSFER_BID_REJECTED', 'LEAK', 0, 3, [
    'Bid rejected. Second offer expected within forty-eight hours. Nobody is panicking yet.',
    'Understand the valuation gap is significant and the player has not been told.',
  ], ['transfer', 'rumour']),
  ...post('TRANSFER_BID_REJECTED', 'FAN', -0.2, 2, [
    'Rejected, obviously. Now pay what he is worth or stop wasting everyone\'s time.',
  ], ['transfer']),

  /* ------------------------------------------------------ PLAYER_INJURED */
  ...post('PLAYER_INJURED', 'FAN', -0.6, 3, [
    'Not {player}. Anyone but {player}.',
    'Of course. The one week we needed him fit.',
    'Get well soon lad. We will hold the fort. Badly.',
  ], ['injury']),
  ...post('PLAYER_INJURED', 'CLUB', -0.3, 2, [
    '{player} will be assessed in the coming days. Everyone at {club} is behind him.',
  ], ['injury']),
  ...post('PLAYER_INJURED', 'MEDIA', -0.2, 3, [
    '{player} is expected to miss a significant period after picking up an injury.',
  ], ['injury']),

  /* ---------------------------------------------------- PLAYER_RECOVERED */
  ...post('PLAYER_RECOVERED', 'FAN', 0.6, 2, [
    '{player} is back and it is like a new signing. Actual quote from my dad.',
    'Fit again. Now stay fit. Please. I am asking nicely.',
  ], ['injury']),
  ...post('PLAYER_RECOVERED', 'CLUB', 0.5, 2, [
    '{player} has returned to full training. 💚',
  ], ['injury']),

  /* ----------------------------------------------------- PLAYER_BREAKOUT */
  ...post('PLAYER_BREAKOUT', 'CREATOR', 0.7, 4, [
    'Remember the name. I am not going to say it twice — actually I am. {player}. {player}.',
    'Six months ago nobody outside this city had heard of {player}. Watch what happens next.',
  ], ['development']),
  ...post('PLAYER_BREAKOUT', 'FAN', 0.8, 3, [
    'We are not selling {player}. I do not care what the offer is.',
    '{player} is the best thing to come out of this club in a decade.',
  ], ['development']),
  ...post('PLAYER_BREAKOUT', 'MEDIA', 0.4, 3, [
    '{player} has emerged as one of the most improved players in the competition.',
  ], ['development']),

  /* ---------------------------------------------- YOUTH_PROSPECT_PROMOTED */
  ...post('YOUTH_PROSPECT_PROMOTED', 'CLUB', 0.6, 2, [
    'Academy graduate {player} has been promoted to the first-team squad. 🌱',
  ], ['academy']),
  ...post('YOUTH_PROSPECT_PROMOTED', 'FAN', 0.7, 2, [
    'One of our own. That still means something here.',
    'I watched {player} score six in an under-18 game two years ago. Told everyone. Nobody listened.',
  ], ['academy']),

  /* ------------------------------------------------------ MOTM_AWARDED */
  ...post('MOTM_AWARDED', 'CLUB', 0.6, 2, [
    'Your player of the match: {player}. ⭐',
  ], ['performance']),
  ...post('MOTM_AWARDED', 'FAN', 0.6, 2, [
    'Could not have been anyone else. {player} ran that on his own.',
  ], ['performance']),
  ...post('MOTM_AWARDED', 'CREATOR', 0.6, 3, [
    'Player of the match and it was not close. {player} is a problem for this league.',
  ], ['performance']),

  /* -------------------------------------------------- SPECIAL_RULE_TRIGGERED */
  ...post('SPECIAL_RULE_TRIGGERED', 'FAN', 0.3, 3, [
    'Rule window and we have decided to defend our own box. Cowards.',
    'Three minutes of absolute lunacy incoming. This is why I watch.',
  ], ['rules']),
  ...post('SPECIAL_RULE_TRIGGERED', 'CREATOR', 0.5, 4, [
    'THIS is the format. Nobody has left their seat. Nobody.',
    'Whoever designed this rule window deserves a raise and a lie-down.',
  ], ['rules']),
  ...post('SPECIAL_RULE_TRIGGERED', 'MEDIA', 0.1, 2, [
    'The rule window opens at {minute} minutes with the score at {score}.',
  ], ['rules']),

  /* ------------------------------------------------------ CREATOR_JOINED */
  ...post('CREATOR_JOINED', 'CREATOR', 0.7, 5, [
    'I am joining {club}. I have thought about this for a long time and I am all in.',
    'New badge, same me. Let us go, {club}.',
  ], ['creator']),
  ...post('CREATOR_JOINED', 'FAN', 0.2, 3, [
    'Not sure how I feel about {creator} being attached to us, if I am honest.',
    '{creator} at {club} is either the best thing that has happened to this club or the end of it.',
    'The follower count is nice. The football is what I am here for.',
  ], ['creator']),
  ...post('CREATOR_JOINED', 'MEDIA', 0.3, 3, [
    '{creator} has formally joined {club}, adding significant reach to the club\'s platform.',
  ], ['creator']),
  ...post('CREATOR_JOINED', 'RIVAL', -0.4, 2, [
    'A football club signing a camera. Marvellous.',
  ], ['creator', 'rivalry']),

  /* ----------------------------------------------------- CREATOR_MOMENT */
  ...post('CREATOR_MOMENT', 'CREATOR', 0.6, 4, [
    'I have never screamed like that in my life and it is on four cameras.',
    'That is going in the year-end video and you can all be there when it does.',
  ], ['creator']),
  ...post('CREATOR_MOMENT', 'FAN', 0.4, 2, [
    '{creator} losing his mind in the stand is my favourite thing about this whole league.',
  ], ['creator']),

  /* ------------------------------------------------------ SPONSOR_SIGNED */
  ...post('SPONSOR_SIGNED', 'CLUB', 0.5, 2, [
    'We are delighted to announce {sponsor} as a partner of {club}.',
  ], ['commercial']),
  ...post('SPONSOR_SIGNED', 'SPONSOR', 0.6, 2, [
    'Proud to be backing {club} this season. Big things ahead.',
  ], ['commercial']),
  ...post('SPONSOR_SIGNED', 'FAN', 0.1, 2, [
    'Another sponsor, another logo. Where does it actually go, though? Where?',
    'Money is money. Spend it on a left back.',
  ], ['commercial']),

  /* -------------------------------------------------------- SPONSOR_LOST */
  ...post('SPONSOR_LOST', 'MEDIA', -0.4, 3, [
    '{sponsor} will not renew with {club}, leaving a significant gap in the commercial plan.',
  ], ['commercial']),
  ...post('SPONSOR_LOST', 'FAN', -0.4, 2, [
    'When the sponsors start walking, it is never just about the sponsors.',
  ], ['commercial']),

  /* --------------------------------------------------- FACILITY_UPGRADED */
  ...post('FACILITY_UPGRADED', 'CLUB', 0.5, 2, [
    'Work is complete. Our upgraded facilities open this week. 🏗️',
  ], ['infrastructure']),
  ...post('FACILITY_UPGRADED', 'FAN', 0.4, 2, [
    'Finally. Some of us have been asking for that for six years.',
    'Bricks over players. I understand it. I do not have to like it.',
  ], ['infrastructure']),

  /* ------------------------------------------------ FAN_SENTIMENT_CHANGED */
  ...post('FAN_SENTIMENT_CHANGED', 'FAN', -0.5, 3, [
    'The mood around this club has completely collapsed and nobody at the top seems to have noticed.',
    'Something has shifted in there. You can hear it. There is no noise any more.',
  ], ['mood']),
  ...post('FAN_SENTIMENT_CHANGED', 'FAN', 0.6, 3, [
    'For the first time in ages I am actually looking forward to Saturday.',
    'Whatever they have changed, keep doing it. The place feels alive again.',
  ], ['mood']),

  /* ------------------------------------------------- ATTENDANCE_RECORDED */
  ...post('ATTENDANCE_RECORDED', 'CLUB', 0.4, 1, [
    'Attendance today: a full house. Thank you. 🙏',
  ], ['matchday']),
  ...post('ATTENDANCE_RECORDED', 'FAN', -0.3, 2, [
    'Look at the empty seats. That is the real story of this season.',
  ], ['matchday']),

  /* ------------------------------------------------ RIVALRY_INTENSIFIED */
  ...post('RIVALRY_INTENSIFIED', 'FAN', -0.4, 4, [
    'Whatever this was before, it is properly personal now.',
    'I did not care about {opponent} until this season. I care now.',
  ], ['rivalry']),
  ...post('RIVALRY_INTENSIFIED', 'RIVAL', -0.5, 4, [
    'We will remember this. Every single one of us will remember this.',
  ], ['rivalry']),
  ...post('RIVALRY_INTENSIFIED', 'MEDIA', -0.2, 4, [
    'What was a fixture is now a feud. {club} and {opponent} meet again in weeks.',
  ], ['rivalry']),

  /* ------------------------------------------------------ MANAGER_SACKED */
  ...post('MANAGER_SACKED', 'MEDIA', -0.3, 4, [
    '{manager} has left {club} by mutual consent following a run of one win in nine.',
  ], ['management']),
  ...post('MANAGER_SACKED', 'FAN', 0.2, 3, [
    'It had to happen. I liked him. It still had to happen.',
    'Sacking the manager does not fix a squad this thin and everybody knows it.',
  ], ['management']),
  ...post('MANAGER_SACKED', 'CREATOR', -0.2, 4, [
    'Nobody wins here. Genuinely one of the good ones and the club failed him.',
  ], ['management']),

  /* -------------------------------------------------------- TROPHY_WON */
  ...post('TROPHY_WON', 'FAN', 1, 5, [
    'WE HAVE WON IT. I am forty-one years old and I am crying in a car park.',
    'Every away day. Every bad night. Every single one of them was worth it.',
    'Tell your children about this one.',
  ], ['trophy']),
  ...post('TROPHY_WON', 'CLUB', 0.9, 5, [
    'CHAMPIONS. 🏆 Thank you, all of you.',
  ], ['trophy']),
  ...post('TROPHY_WON', 'CREATOR', 0.9, 5, [
    'I built this club to prove a point and it has just won a trophy. I am done. I am absolutely done.',
  ], ['trophy']),
  ...post('TROPHY_WON', 'RIVAL', -0.6, 3, [
    'Congratulations. Sincerely. It will not happen again.',
  ], ['trophy', 'rivalry']),

  /* ------------------------------------------------------------ PROMOTED */
  ...post('PROMOTED', 'FAN', 0.9, 5, [
    'Up. UP. I do not know what else to say.',
  ], ['season']),
  ...post('PROMOTED', 'CLUB', 0.8, 4, [
    'Promotion secured. What a season. What a group.',
  ], ['season']),

  /* ----------------------------------------------------------- RELEGATED */
  ...post('RELEGATED', 'FAN', -0.9, 5, [
    'Down. And we deserved it, which is the worst part.',
    'I will be there next season and the season after that. That is all I have got.',
  ], ['season']),
  ...post('RELEGATED', 'MEDIA', -0.5, 4, [
    '{club} are relegated after a season that unravelled long before the final week.',
  ], ['season']),
  ...post('RELEGATED', 'RIVAL', 0.5, 3, [
    'Have a lovely time down there. Send a postcard.',
  ], ['season', 'rivalry']),

  /* ---------------------------------------------------------- BALANCE_LOW */
  ...post('BALANCE_LOW', 'LEAK', -0.5, 4, [
    'Understand {club} have missed a payment deadline. Club declined to comment.',
    'Told the wage bill is now the single largest problem at {club} and it is not close.',
  ], ['finance', 'rumour']),
  ...post('BALANCE_LOW', 'FAN', -0.6, 3, [
    'Not being dramatic but this club is in genuine trouble and nobody will say it out loud.',
  ], ['finance']),

  /* --------------------------------------------------- OBJECTIVE_COMPLETED */
  ...post('OBJECTIVE_COMPLETED', 'CLUB', 0.5, 2, [
    'Target hit. On to the next one.',
  ], ['objective']),
  ...post('OBJECTIVE_COMPLETED', 'FAN', 0.5, 1, [
    'Small step. But a step.',
  ], ['objective']),

  /* ------------------------------------------------------ OBJECTIVE_FAILED */
  ...post('OBJECTIVE_FAILED', 'MEDIA', -0.3, 3, [
    '{club} have missed the target set for them, and questions will follow.',
  ], ['objective']),
  ...post('OBJECTIVE_FAILED', 'FAN', -0.4, 2, [
    'Missed it. Of course we did.',
  ], ['objective']),

  /* --------------------------------------------------- REPUTATION_CHANGED */
  ...post('REPUTATION_CHANGED', 'MEDIA', 0.3, 2, [
    '{club} are being taken seriously in a way they simply were not eighteen months ago.',
  ], ['reputation']),
  ...post('REPUTATION_CHANGED', 'CREATOR', 0.4, 3, [
    'People used to laugh when I said the name of this club out loud. They have stopped.',
  ], ['reputation']),

  /* ------------------------------------------------------- RECORD_BROKEN */
  ...post('RECORD_BROKEN', 'CLUB', 0.7, 4, [
    'A club record. {player} writes his name into the history of {club}. 📖',
  ], ['record']),
  ...post('RECORD_BROKEN', 'FAN', 0.7, 3, [
    'That record stood for thirty-one years. Thirty-one.',
  ], ['record']),
  ...post('RECORD_BROKEN', 'MEDIA', 0.4, 3, [
    'A record that has stood for a generation falls to {player}.',
  ], ['record']),

  /* ------------------------------------------------------ CONTRACT_SIGNED */
  ...post('CONTRACT_SIGNED', 'CLUB', 0.6, 2, [
    '{player} has signed a new deal. Staying where he belongs. ✍️',
  ], ['contract']),
  ...post('CONTRACT_SIGNED', 'FAN', 0.6, 2, [
    'Best signing of the window and we did not have to buy anyone.',
  ], ['contract']),

  /* ---------------------------------------------------- CONTRACT_EXPIRING */
  ...post('CONTRACT_EXPIRING', 'LEAK', -0.2, 3, [
    'Understand talks between {club} and {player} have stalled. Six months left.',
    'Told {player} has not been offered anything close to what he is asking. Two clubs already circling.',
  ], ['contract', 'rumour']),
  ...post('CONTRACT_EXPIRING', 'FAN', -0.4, 2, [
    'Sort the contract out. It is genuinely not complicated.',
  ], ['contract']),

  /* --------------------------------------------------- SCOUT_REPORT_READY */
  ...post('SCOUT_REPORT_READY', 'LEAK', 0, 2, [
    'Scouts from {club} spotted at a match this week. Nobody is saying who they were watching.',
  ], ['scouting', 'rumour']),

  /* ------------------------------------------------------- SEASON_STARTED */
  ...post('SEASON_STARTED', 'FAN', 0.6, 3, [
    'New season. New unfounded optimism. Let us go.',
    'Every one of us thinks we are making the playoffs. Four of us are right.',
  ], ['season']),
  ...post('SEASON_STARTED', 'CLUB', 0.5, 3, [
    'Season one, week one. Here we go. 🔵',
  ], ['season']),
  ...post('SEASON_STARTED', 'CREATOR', 0.6, 4, [
    'Twelve clubs. Twenty-two matches. One of us ends this holding something. See you Sunday.',
  ], ['season']),

  /* ----------------------------------------------------- SEASON_COMPLETED */
  ...post('SEASON_COMPLETED', 'MEDIA', 0.1, 4, [
    'The season ends with {club} finishing {position}. The review starts tomorrow.',
  ], ['season']),
  ...post('SEASON_COMPLETED', 'FAN', 0.1, 3, [
    'Finished {position}. About right, if I am honest with myself. Which I rarely am.',
  ], ['season']),

  /* --------------------------------------------------- PLAYER_DEVELOPED */
  ...post('PLAYER_DEVELOPED', 'CREATOR', 0.5, 2, [
    'Whatever they are doing with {player} on the training ground is working.',
  ], ['development']),

  /* ----------------------------------------------- PLAYER_MORALE_CHANGED */
  ...post('PLAYER_MORALE_CHANGED', 'LEAK', -0.4, 3, [
    'Understand {player} is unhappy and has made that clear internally.',
    'Told there was an incident at the training ground involving {player}. Club say it is routine.',
  ], ['squad', 'rumour']),
  ...post('PLAYER_MORALE_CHANGED', 'FAN', -0.3, 2, [
    '{player} has been sulking for six weeks and it is visible from the back row.',
  ], ['squad']),

  /* ------------------------------------------------------ PLAYER_RELEASED */
  ...post('PLAYER_RELEASED', 'FAN', -0.2, 2, [
    'Released. Never quite worked out here but he never hid, and that counts for something.',
  ], ['transfer']),
  ...post('PLAYER_RELEASED', 'PLAYER', 0.2, 2, [
    'Disappointed to be leaving but grateful for the chance. On to the next one.',
  ], ['transfer']),

  /* ------------------------------------------------------- MATCH_STARTED */
  ...post('MATCH_STARTED', 'CLUB', 0.3, 1, [
    'We are under way at home to {opponent}. ⚪️',
  ], ['matchday']),
  ...post('MATCH_STARTED', 'FAN', 0.3, 1, [
    'In the ground, in the seat, in absolute pieces already.',
  ], ['matchday']),

  /* ----------------------------------------------------- MATCH_SCHEDULED */
  ...post('MATCH_SCHEDULED', 'MEDIA', 0, 1, [
    '{club} host {opponent} in what is already being framed as a defining fixture.',
  ], ['fixture']),

  /* -------------------------------------------------- TRANSFER_BID_MADE */
  ...post('TRANSFER_BID_MADE', 'LEAK', 0.1, 3, [
    'Bid submitted. Structure includes add-ons. Not close yet, but talking.',
    'Understand a formal offer has landed for {player}. No response expected today.',
  ], ['transfer', 'rumour']),
  ...post('TRANSFER_BID_MADE', 'FAN', 0.3, 2, [
    'If this one happens I will forgive an awful lot.',
  ], ['transfer']),

  /* --------------------------------------------------- TRANSFER_COMPLETED */
  ...post('TRANSFER_COMPLETED', 'MEDIA', 0.2, 3, [
    'Done. {player} joins {club} in a deal worth {fee}.',
  ], ['transfer']),

  /* ------------------------------------------------------- REWARD_CLAIMED */
  ...post('REWARD_CLAIMED', 'CLUB', 0.3, 1, [
    'Reward banked. Straight back into the club.',
  ], ['reward']),

  /* -------------------------------------------------- LIVE_DECISION_MADE */
  ...post('LIVE_DECISION_MADE', 'CREATOR', 0.2, 3, [
    'He has actually gone for it. In this format. At this scoreline. Enormous call.',
  ], ['tactics']),
  ...post('LIVE_DECISION_MADE', 'FAN', -0.2, 2, [
    'What is that change. WHAT is that change.',
  ], ['tactics']),

  /* --------------------------------------------------------- GAME_STARTED */
  ...post('GAME_STARTED', 'CLUB', 0.5, 3, [
    '{manager} is appointed at {club}. Welcome. The work starts now.',
  ], ['management']),
  ...post('GAME_STARTED', 'FAN', 0.2, 2, [
    'Never heard of {manager}. That is not necessarily a bad thing.',
    'Give them time. We say that every year and mean it for about six weeks.',
  ], ['management']),

  /* --------------------------------------------------------- CLUB_CREATED */
  ...post('CLUB_CREATED', 'MEDIA', 0.2, 2, [
    'A new club enters the competition. The reaction from the old guard has been predictably warm.',
  ], ['league']),

  /* ------------------------------------------------------- RIVALRY_CREATED */
  ...post('RIVALRY_CREATED', 'MEDIA', 0, 3, [
    'Two clubs who had no history now have one. {club} and {opponent}.',
  ], ['rivalry']),

  /* ------------------------------------------------------ CYCLE_ADVANCED */
  ...post('CYCLE_ADVANCED', 'CREATOR', 0.2, 1, [
    'Wildcard week. I have changed my mind four times and it is not close to being resolved.',
  ], ['squad']),

  /* --------------------------------------------------- STORY_PUBLISHED */
  ...post('STORY_PUBLISHED', 'FAN', -0.2, 2, [
    'Read the piece. Not sure any of us come out of it well.',
  ], ['media']),
];

export const BASE_SOCIAL_TEMPLATE_COUNT = BASE_SOCIAL_TEMPLATES.length;
