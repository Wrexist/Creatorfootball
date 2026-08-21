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
/**
 * `conditions` is how a post declares what has to be true of the save before it
 * is allowed to run — see `saveHistoryFacts` in simulation/cascade.ts. A line
 * that invents a history the save does not have reads as a bug to the player,
 * and it costs the feed all of its credibility at once.
 */
const post = (
  trigger: string,
  authorKind: Author,
  sentiment: number,
  weight: number,
  texts: readonly string[],
  tags: readonly string[] = [],
  conditions?: Readonly<Record<string, string | number | boolean>>,
): SocialTemplate[] =>
  texts.map((text) => ({
    id: `sp_${(counter += 1).toString(36)}_${trigger.toLowerCase()}`,
    trigger, authorKind, text, sentiment, weight, tags,
    ...(conditions ? { conditions } : {}),
  }));

/* =========================================================================
 * THE INTERACTIVE LAYER
 *
 * Everything below is content for something the *player* did. The feed is no
 * longer only a projection of the simulation: the club and the manager post,
 * answer, dunk, defend, ask and promise, and the world answers back.
 *
 * Two conventions make it work.
 *
 * `tone` and `voice` are published as facts by the composer, so a template that
 * declares `{ tone: 'PROVOCATIVE' }` is only ever reachable when the player
 * chose to be provocative. World-generated club posts carry neither fact, so
 * these lines can never be selected for them by accident — an unknown fact
 * never matches.
 *
 * `standing` is published on every hook, so the world can talk to a club it
 * finds funny differently from one it is frightened of.
 * ======================================================================= */

/** Tokens guaranteed for a club-voice statement about anything at all. */
const clubTone = (
  trigger: string,
  tone: string,
  sentiment: number,
  texts: readonly string[],
  extra: Readonly<Record<string, string | number | boolean>> = {},
): SocialTemplate[] => post(trigger, 'CLUB', sentiment, 4, texts, ['authored'], { tone, ...extra });

const INTERACTIVE_SOCIAL_TEMPLATES: readonly SocialTemplate[] = [
  /* ----------------------------------------------- CLUB_STATEMENT | CLUB */
  /* The general-purpose pool. Reachable for any moment the journal holds, so
     these use {club} and nothing else — a line that cannot render is a line
     the player never gets to choose. */
  ...clubTone('CLUB_STATEMENT', 'HYPE', 0.8, [
    'THIS. IS. {club}. 🔊',
    'Everybody who has been waiting for this — today is the day you were waiting for.',
    'Turn it up. Turn all of it up.',
    'We are not doing quiet weeks any more. Not one of them.',
    'If you were not paying attention before, you are now.',
    'Absolutely buzzing. Whole building is buzzing. Come on. 💛',
    'Screenshot this one. You will want it later.',
    'The best part is that we are not finished.',
  ], { voice: 'CLUB' }),
  ...clubTone('CLUB_STATEMENT', 'CLASSY', 0.4, [
    'A word of thanks to everybody who was there. It was noticed.',
    'Quietly proud of this one. Onto the next.',
    'No fuss. Just gratitude, and back to work in the morning.',
    'To the supporters who travelled: thank you. That is all.',
    'A good day for the club. We will let others do the talking.',
    'Grateful, and getting on with it.',
    'Thank you. Genuinely, all of you.',
  ], { voice: 'CLUB' }),
  ...clubTone('CLUB_STATEMENT', 'PROVOCATIVE', -0.3, [
    'Funny how quiet it has gone.',
    'Some of you owe this club an apology and we are happy to wait.',
    'We read everything. All of it. Every word.',
    'Keep talking. It suits us.',
    'The list of people who wrote us off is long and we have it saved.',
    'Nobody has to like us. Preferably nobody does.',
    'You can stop pretending you were not watching.',
  ], { voice: 'CLUB' }),
  ...clubTone('CLUB_STATEMENT', 'FUNNY', 0.35, [
    'The social media manager has been given the afternoon off and is refusing to take it.',
    'We have run out of ways to say this so please imagine something very clever here.',
    'Whoever runs the account of the club we just played is having a worse day than us.',
    'Posting through it, as is tradition.',
    'Our analytics team has confirmed that this was, in fact, good.',
    'We would like to thank the algorithm and nobody else.',
    'This account is legally required to remain calm and is failing.',
  ], { voice: 'CLUB' }),
  ...clubTone('CLUB_STATEMENT', 'DEFIANT', 0.1, [
    'Us. Nobody else. That is the whole message.',
    'Say what you like about {club}. We will be here next week and the week after.',
    'Nobody is coming to help. That has never been a problem for this club.',
    'We know exactly who was with us and we know exactly who was not.',
    'The noise is not new and neither are we.',
    'This club does not fold. Write that down.',
  ], { voice: 'CLUB' }),

  /* The manager, personally. A smaller room and a far more quotable one. */
  ...clubTone('CLUB_STATEMENT', 'HYPE', 0.75, [
    'I have not slept and I do not intend to. What a group of players. 💛',
    'Proud is not the word. There is not a word.',
    'Everything they were told to do, they did. All of it.',
    'I have been doing this a long time and I will remember today.',
  ], { voice: 'MANAGER' }),
  ...clubTone('CLUB_STATEMENT', 'CLASSY', 0.45, [
    'Thank you to the supporters. Whatever else happens, that part was perfect.',
    'A word for the staff, who nobody photographs and without whom none of it works.',
    'Nothing to add beyond well done to the players and thank you to the people who came.',
    'I will keep this short. They earned it, and I did very little.',
  ], { voice: 'MANAGER' }),
  ...clubTone('CLUB_STATEMENT', 'PROVOCATIVE', -0.35, [
    'I would love to hear from some of the people who were very confident a fortnight ago.',
    'I have a good memory. That is my only comment.',
    'Everybody had plenty to say. I notice they have stopped.',
    'They will not enjoy the next one either.',
  ], { voice: 'MANAGER' }),
  ...clubTone('CLUB_STATEMENT', 'FUNNY', 0.3, [
    'I have been told to be measured so I am typing this with one hand behind my back.',
    'My analysis: it was good. That is the analysis.',
    'The club would like me to stop posting and the club is going to be disappointed.',
    'Somebody has taken my phone off me. I have a second phone.',
  ], { voice: 'MANAGER' }),
  ...clubTone('CLUB_STATEMENT', 'DEFIANT', 0.05, [
    'Nobody in that dressing room needs anybody outside it. That is how we work.',
    'I will take the criticism. I will not take it on their behalf.',
    'We are not going anywhere and neither am I.',
    'I have heard all of it before and it was wrong then as well.',
  ], { voice: 'MANAGER' }),

  /* ------------------------------------------------ composer | MATCH_WON */
  ...clubTone('MATCH_WON', 'HYPE', 0.85, [
    '{score}. {club} away, {club} everywhere, {club} for the rest of the week. 🔊',
    'THREE POINTS AND THEY WERE NOT CLOSE. {score}.',
    '{opponent} {score}. Read it again.',
  ]),
  ...clubTone('MATCH_WON', 'CLASSY', 0.5, [
    'Full time: {score}. A hard afternoon, well handled. Thank you to everyone who travelled.',
    '{score} at {opponent}. A good day, quietly taken.',
  ]),
  ...clubTone('MATCH_WON', 'PROVOCATIVE', 0.2, [
    '{score}. Some of you had a lot to say beforehand. We will wait.',
    'Enjoy the trip home, {opponent}. {score}.',
    'We would like to formally thank {opponent} for the motivation.',
  ]),
  ...clubTone('MATCH_WON', 'FUNNY', 0.55, [
    '{score}. Our tactical instruction was "score more than them" and it worked flawlessly.',
    'Result: good. Analysis: also good. Full report to follow, probably never.',
  ]),
  ...clubTone('MATCH_WON', 'DEFIANT', 0.4, [
    '{score}. Nobody outside this building thought that was happening. We did.',
    'Told nobody. Did it anyway. {score}.',
  ]),

  /* ----------------------------------------------- composer | MATCH_LOST */
  ...clubTone('MATCH_LOST', 'HYPE', -0.1, [
    'Not our day. Next one is at home and we are going to make it loud. 💛',
    '{score}. Wrong result, right group. Watch what happens next.',
  ]),
  ...clubTone('MATCH_LOST', 'CLASSY', -0.2, [
    'Full time: {score}. Not good enough today. Thank you to the away support, who were.',
    '{score} at {opponent}. No excuses offered and none available.',
  ]),
  ...clubTone('MATCH_LOST', 'PROVOCATIVE', -0.5, [
    'Congratulations to {opponent} on the best day some of them will ever have.',
    '{score}. We will see them again and it will not look like that.',
  ]),
  ...clubTone('MATCH_LOST', 'FUNNY', -0.15, [
    'We have reviewed the footage and can confirm the ball did not go in enough times.',
    'The account is going to bed. Please do not tag us in the highlights.',
  ]),
  ...clubTone('MATCH_LOST', 'DEFIANT', -0.05, [
    '{score}. Nobody in here is panicking and nobody in here is asking you to either.',
    'One result. This club has had worse weeks than this before breakfast.',
    'We will take the criticism. We will not take being written off.',
  ]),

  /* ---------------------------------------------- composer | MATCH_DRAWN */
  ...clubTone('MATCH_DRAWN', 'HYPE', 0.35, [
    'A point at {opponent} and the away end never stopped. 💛',
  ]),
  ...clubTone('MATCH_DRAWN', 'CLASSY', 0.1, [
    'Full time: {score}. A point taken, and plenty to work on.',
    '{score} at {opponent}. Thank you to everyone who made the trip.',
  ]),
  ...clubTone('MATCH_DRAWN', 'PROVOCATIVE', -0.2, [
    'A point at a ground {opponent} keep telling everybody is a fortress.',
  ]),
  ...clubTone('MATCH_DRAWN', 'FUNNY', 0.2, [
    'A draw. The most polite result in sport. Everybody goes home mildly annoyed.',
  ]),
  ...clubTone('MATCH_DRAWN', 'DEFIANT', 0.15, [
    '{score}. We came here for three and we are not going to pretend otherwise.',
  ]),

  /* ------------------------------------------ composer | MATCH_SCHEDULED */
  /* The forward-looking pool. Everything here opens a stake, which is why
     the lines are written to be quotable back at you. */
  ...clubTone('MATCH_SCHEDULED', 'HYPE', 0.7, [
    '{opponent}. Saturday. Bring everything you have got. 🔊',
    'One sleep. {club} v {opponent}. We are ready and you should be too.',
    'Sell out the away end. That is the whole post.',
  ]),
  ...clubTone('MATCH_SCHEDULED', 'CLASSY', 0.25, [
    '{opponent} next. A serious side and a serious afternoon. Travel safe, all of you.',
    'Preparation done. {club} v {opponent}. See you there.',
  ]),
  ...clubTone('MATCH_SCHEDULED', 'PROVOCATIVE', -0.15, [
    '{opponent} have been talking all week. Saturday is quite a long time to be wrong for.',
    'We will be at {opponent} on Saturday and we will not be there to make up the numbers.',
    'A lot of confidence coming out of {opponent} this week. Noted. Saved.',
  ]),
  ...clubTone('MATCH_SCHEDULED', 'FUNNY', 0.4, [
    'Team news: eleven of them, probably in the right order.',
    '{opponent} away. Historically our favourite place to do something inexplicable.',
  ]),
  ...clubTone('MATCH_SCHEDULED', 'DEFIANT', 0.15, [
    'Nobody outside this club fancies us on Saturday. Good.',
    '{opponent} away, everybody against us, exactly how this club likes it.',
  ]),

  /* -------------------------------------------- composer | GOAL_SCORED */
  ...clubTone('GOAL_SCORED', 'HYPE', 0.9, [
    '{player}. {minuteOrdinal} minute. GET IN. 🔊',
    '{player}!!! {score}!!!',
  ]),
  ...clubTone('GOAL_SCORED', 'CLASSY', 0.6, [
    '{player} with the finish. {score}.',
    'A goal of real quality from {player}.',
  ]),
  ...clubTone('GOAL_SCORED', 'FUNNY', 0.65, [
    'We have watched {player} do that eleven times now and we are going for twelve.',
  ]),
  ...clubTone('GOAL_SCORED', 'PROVOCATIVE', 0.35, [
    '{player}. The one nobody wanted. {score}.',
  ]),
  ...clubTone('GOAL_SCORED', 'DEFIANT', 0.5, [
    '{player}. Everything he has had said about him, answered in one touch.',
  ]),

  /* ------------------------------------------ composer | PLAYER_SIGNED */
  ...clubTone('PLAYER_SIGNED', 'HYPE', 0.85, [
    '{player} IS A {club} PLAYER. 🔊',
    'He is here. {player}. Welcome. 💛',
  ]),
  ...clubTone('PLAYER_SIGNED', 'CLASSY', 0.55, [
    'We are pleased to confirm the signing of {player}. Welcome to {club}.',
    '{player} joins us. A good footballer and, by every account, a better professional.',
  ]),
  ...clubTone('PLAYER_SIGNED', 'PROVOCATIVE', 0.3, [
    '{player} had options. He picked us. Draw your own conclusions.',
  ]),
  ...clubTone('PLAYER_SIGNED', 'FUNNY', 0.6, [
    'We have signed {player} and the announcement graphic took four days, so please engage with it.',
  ]),
  ...clubTone('PLAYER_SIGNED', 'DEFIANT', 0.45, [
    '{player}. To everybody who said this club could not attract a player like this: he is here.',
  ]),

  /* ----------------------------------------------- composer | RED_CARD */
  ...clubTone('RED_CARD', 'CLASSY', -0.3, [
    '{player} will serve his suspension. We will not be commenting further on the decision.',
  ]),
  ...clubTone('RED_CARD', 'DEFIANT', -0.2, [
    '{player} has our full support. He will be back and he will be better.',
    'Ten men for half the match. Not one of them stopped. That is the club.',
  ]),
  ...clubTone('RED_CARD', 'PROVOCATIVE', -0.5, [
    'We have watched it back {matches} times and we still cannot find it.',
  ]),
  ...clubTone('RED_CARD', 'FUNNY', -0.1, [
    'We are told the {minuteOrdinal}-minute incident is under review. We have already reviewed it. Extensively. Loudly.',
  ]),
  ...clubTone('RED_CARD', 'HYPE', -0.05, [
    'Ten men. Same noise. Louder if anything. 💛',
  ]),

  /* ---------------------------------------------- composer | TROPHY_WON */
  ...clubTone('TROPHY_WON', 'HYPE', 0.95, [
    'CHAMPIONS. {club} ARE CHAMPIONS. 🏆',
    '{competition}. Ours. Say it out loud.',
  ]),
  ...clubTone('TROPHY_WON', 'CLASSY', 0.9, [
    '{competition} winners. To everybody who was here before anybody was watching: this is yours.',
  ]),
  ...clubTone('TROPHY_WON', 'PROVOCATIVE', 0.6, [
    '{competition}. A quick word for everybody who found this club funny in August.',
  ]),
  ...clubTone('TROPHY_WON', 'FUNNY', 0.85, [
    'We have won the {competition} and nobody here has any idea what the protocol is.',
  ]),
  ...clubTone('TROPHY_WON', 'DEFIANT', 0.8, [
    '{competition}. Nobody gave us anything. We took all of it.',
  ]),

  /* -------------------------------------------- composer | PLAYER_INJURED */
  ...clubTone('PLAYER_INJURED', 'CLASSY', -0.35, [
    '{player} will be out for around {weeks} weeks. He has the whole building behind him.',
  ]),
  ...clubTone('PLAYER_INJURED', 'DEFIANT', -0.2, [
    '{player} is out. Somebody else steps up. That is how this club has always worked.',
  ]),
  ...clubTone('PLAYER_INJURED', 'HYPE', -0.1, [
    '{player} will be back and the noise when he is will be worth waiting for. 💛',
  ]),

  /* ---------------------------------------------- composer | FAN_UNREST */
  ...clubTone('FAN_UNREST', 'CLASSY', -0.1, [
    'We hear it. It is fair. We will do better.',
    'The supporters are entitled to be unhappy. Nobody here is going to argue with them.',
  ]),
  ...clubTone('FAN_UNREST', 'DEFIANT', -0.25, [
    'We are aware of the mood. We are not going to be managed by it.',
  ]),
  ...clubTone('FAN_UNREST', 'PROVOCATIVE', -0.5, [
    'Everybody is entitled to an opinion. Not everybody is obliged to be listened to.',
  ]),
];

/**
 * The world answering back.
 *
 * Every line below is selected by the *tone the player chose*, which is what
 * makes the tone menu a decision rather than a skin: the same result posted
 * two different ways produces two visibly different arguments underneath it.
 */
const INTERACTIVE_REACTION_TEMPLATES: readonly SocialTemplate[] = [
  /* ------------------------------------------------ CLUB_POSTED | RIVAL */
  ...post('CLUB_POSTED', 'RIVAL', -0.8, 5, [
    'Imagine being this pleased with yourselves. Genuinely, imagine it.',
    'Saved. Printed. Laminated. See you at ours.',
    'The {club} account has gone. Somebody take the phone off them.',
    'This will not age well and we will be here when it does not.',
  ], ['rivalry'], { tone: 'HYPE' }),
  ...post('CLUB_POSTED', 'RIVAL', -0.65, 4, [
    'Very restrained. Very dignified. Very much a club that knows it got away with one.',
    'Classy. Boring. Both of those things at once.',
  ], ['rivalry'], { tone: 'CLASSY' }),
  ...post('CLUB_POSTED', 'RIVAL', -0.95, 6, [
    'Oh they have actually posted that. They have actually gone and posted that.',
    'Right. That is going on the wall in our away end. Thank you {club}.',
    'Every single one of us has screenshotted it. Every single one.',
    'You do not get to say that and then turn up on Saturday like nothing happened.',
    'This is the most {club} thing that has ever happened and it is not close.',
  ], ['rivalry'], { tone: 'PROVOCATIVE' }),
  ...post('CLUB_POSTED', 'RIVAL', -0.7, 5, [
    'Hilarious. Genuinely. Now do the league table.',
    'A comedy account with a stadium attached.',
    'Whoever runs that account is the best player at the club.',
  ], ['rivalry'], { tone: 'FUNNY' }),
  ...post('CLUB_POSTED', 'RIVAL', -0.75, 5, [
    'Nobody is against you. Nobody is thinking about you at all.',
    'The persecution complex is doing a lot of heavy lifting over there.',
  ], ['rivalry'], { tone: 'DEFIANT' }),

  /* -------------------------------------------------- CLUB_POSTED | FAN */
  ...post('CLUB_POSTED', 'FAN', 0.8, 4, [
    'WHOEVER RUNS THIS ACCOUNT GIVE THEM A CONTRACT',
    'Screaming. The club account is screaming. We are all screaming.',
    'I have never felt closer to a social media manager in my life.',
  ], ['fans'], { tone: 'HYPE' }),
  ...post('CLUB_POSTED', 'FAN', 0.6, 3, [
    'Understated and exactly right. That is our club.',
    'No gloating, no nonsense. Good.',
    'Every other club would have made a meal of that. We did not.',
  ], ['fans'], { tone: 'CLASSY' }),
  ...post('CLUB_POSTED', 'FAN', 0.35, 4, [
    'Oh we are doing THIS now are we. I am absolutely here for it.',
    'Nervous. Excited. Mostly nervous. Slightly excited.',
    'Bold. Very bold. Please win on Saturday. Please.',
    'I love it and I am also going to be physically ill until kick-off.',
  ], ['fans'], { tone: 'PROVOCATIVE' }),
  ...post('CLUB_POSTED', 'FAN', 0.7, 4, [
    'Crying. Actually crying at a football club’s social media account.',
    'Sending this to my group chat and ruining eleven people’s productivity.',
  ], ['fans'], { tone: 'FUNNY' }),
  ...post('CLUB_POSTED', 'FAN', 0.65, 4, [
    'THIS is what I want from my football club. Not one word of apology.',
    'Us against the lot of them, and I would not have it any other way.',
  ], ['fans'], { tone: 'DEFIANT' }),

  /* ------------------------------------------------ CLUB_POSTED | MEDIA */
  ...post('CLUB_POSTED', 'MEDIA', 0.1, 3, [
    '{club} have posted a statement that is, by any measure, extremely confident.',
    'The {club} account has entered the conversation. Reaction to follow.',
  ], ['media'], { tone: 'HYPE' }),
  ...post('CLUB_POSTED', 'MEDIA', 0.25, 3, [
    '{club} respond with a short, measured line. Notably short.',
    'A brief statement from {club}, and nothing more.',
  ], ['media'], { tone: 'CLASSY' }),
  ...post('CLUB_POSTED', 'MEDIA', -0.4, 5, [
    'That is a significant escalation from {club}, and it will not have gone unnoticed.',
    '{club} have gone on the record in terms that will be read very carefully elsewhere.',
    'Rare to see a club account go that far. Rarer still for it to end quietly.',
  ], ['media'], { tone: 'PROVOCATIVE' }),
  ...post('CLUB_POSTED', 'MEDIA', -0.1, 3, [
    '{club} continue to run one of the more unusual club accounts in the division.',
  ], ['media'], { tone: 'FUNNY' }),
  ...post('CLUB_POSTED', 'MEDIA', -0.15, 3, [
    'A defiant line from {club}, aimed squarely at everybody outside the building.',
  ], ['media'], { tone: 'DEFIANT' }),

  /* ---------------------------------------------- CLUB_POSTED | CREATOR */
  ...post('CLUB_POSTED', 'CREATOR', 0.5, 4, [
    'Whoever is running {club}’s account has understood the assignment and then some.',
    'Making a video about this specifically. Not the football. This.',
  ], ['creator'], { tone: 'HYPE' }),
  ...post('CLUB_POSTED', 'CREATOR', 0.3, 3, [
    'Restrained club account in a sport that has forgotten how. Respect where it is due.',
  ], ['creator'], { tone: 'CLASSY' }),
  ...post('CLUB_POSTED', 'CREATOR', -0.3, 5, [
    'Bookmarking this so I can put it in a video in about three weeks. One way or the other.',
    'Enormous swing from {club} there. Enormous. I have no notes and several concerns.',
    'This is either the best thing a club has posted all season or the worst. No middle.',
  ], ['creator'], { tone: 'PROVOCATIVE' }),
  ...post('CLUB_POSTED', 'CREATOR', 0.45, 4, [
    'Genuinely funnier than most of what I make, which is a problem for me specifically.',
  ], ['creator'], { tone: 'FUNNY' }),
  ...post('CLUB_POSTED', 'CREATOR', 0.15, 3, [
    'Say what you like about {club}, they do not flinch.',
  ], ['creator'], { tone: 'DEFIANT' }),

  /* --------------------------------------------------- QUOTE_DUNK | CLUB */
  ...post('QUOTE_DUNK', 'CLUB', -0.55, 5, [
    'We will keep this one. 📌',
    'Noted, {critic}. Genuinely, noted.',
    'Posting this so it is easy to find later.',
    'Thank you {critic}. Pinned.',
    'We do not normally do this. We are making an exception.',
    'This is going in the tunnel.',
    'Screenshot taken. Framed. Hung.',
    'Somebody printed this out and put it on the wall. It was not us. It was them.',
    'Reading this one out on Friday.',
  ], ['authored']),

  /* ------------------------------------------------ MANAGER_REPLY | CLUB */
  ...post('MANAGER_REPLY', 'CLUB', 0.65, 5, [
    '{player} plays on Saturday. He plays the week after as well. That is the end of it.',
    'I will say this once. {player} has my complete backing and anybody who does not like it can take it up with me.',
    'Every one of you has had a bad month at work. Not many of you had forty thousand people watching.',
    '{player} is one of ours. We do not do this to our own.',
    'I have been in that dressing room every day. You have not. {player} is fine.',
  ], ['dressing-room', 'authored'], { stance: 'BACK_HIM' }),
  ...post('MANAGER_REPLY', 'CLUB', -0.6, 5, [
    'Nobody at {club} is guaranteed anything. {player} included.',
    'If {player} wants to be picked, he can show me on Thursday like the rest of them.',
    'I have said everything I need to say to {player} and I said it to his face first.',
    'Standards are standards. They apply to {player} the same as they apply to me.',
  ], ['dressing-room', 'authored'], { stance: 'CALL_HIM_OUT' }),

  /* ------------------------------------------- PRESS_CONFERENCE | MEDIA */
  ...post('PRESS_CONFERENCE', 'MEDIA', 0.3, 4, [
    '{manager}, on {topic}: "{quote}"',
    'The {club} manager gave the room something today. "{quote}"',
    'Straight answer from {manager} when he did not have to give one: "{quote}"',
  ], ['press'], { stance: 'WARM' }),
  ...post('PRESS_CONFERENCE', 'MEDIA', -0.45, 5, [
    '{manager} did not hold back on {topic}. "{quote}"',
    'A pointed afternoon from {manager}. "{quote}"',
    '{manager} has just said something that a number of people at {club} will read twice. "{quote}"',
  ], ['press'], { stance: 'COLD' }),
  ...post('PRESS_CONFERENCE', 'MEDIA', 0, 3, [
    '{manager} on {topic}: "{quote}" — make of that what you will.',
    'Not much given away by {manager} today. "{quote}"',
  ], ['press'], { stance: 'FLAT' }),
  ...post('PRESS_CONFERENCE', 'MEDIA', -0.2, 3, [
    'Full {club} press conference is up. {manager} took three questions and answered two of them.',
    '{manager} previews the weekend. The headline is not the football.',
  ], ['press'], { slot: 'PRE' }),
  ...post('PRESS_CONFERENCE', 'MEDIA', -0.1, 3, [
    '{manager} in the post-match room: "{quote}"',
    'Reaction from {manager} at full time. He was not in the mood to elaborate.',
  ], ['press'], { slot: 'POST' }),

  /* --------------------------------------------- PRESS_CONFERENCE | FAN */
  ...post('PRESS_CONFERENCE', 'FAN', 0.7, 4, [
    'Finally. Somebody at this club said the thing out loud.',
    '"{quote}" — put it on a shirt. I will buy two.',
    'That is a manager. That is what one sounds like.',
    'I have watched that clip four times. It gets better.',
  ], ['press', 'fans'], { stance: 'WARM' }),
  ...post('PRESS_CONFERENCE', 'FAN', -0.55, 4, [
    'Throwing your own players under the bus in a press conference. Brilliant. Really brilliant.',
    '"{quote}". In public. About one of our own.',
    'You do not do that. Whatever else, you do not do that.',
  ], ['press', 'fans'], { stance: 'COLD' }),
  ...post('PRESS_CONFERENCE', 'FAN', -0.2, 3, [
    'Watched the whole press conference and learned precisely nothing. Again.',
    'Twelve minutes of that and not one straight answer.',
  ], ['press', 'fans'], { stance: 'FLAT' }),

  /* ----------------------------------------- PRESS_CONFERENCE | CREATOR */
  ...post('PRESS_CONFERENCE', 'CREATOR', 0.4, 4, [
    'Clipping that whole answer. "{quote}" is doing numbers by tonight.',
    'That is the most honest thing anybody in this league has said in a month.',
  ], ['press', 'creator'], { stance: 'WARM' }),
  ...post('PRESS_CONFERENCE', 'CREATOR', -0.5, 5, [
    'He has genuinely said "{quote}" into a microphone. On purpose. Video up in an hour.',
    'I want to be clear that {manager} chose to say that. Nobody made him.',
  ], ['press', 'creator'], { stance: 'COLD' }),

  /* ------------------------------------------ PRESS_CONFERENCE | PLAYER */
  ...post('PRESS_CONFERENCE', 'PLAYER', 0.75, 5, [
    'Nothing more to say. Back in on Monday. 💛',
    'Appreciate that more than I can put here.',
    'Heard it. Won’t forget it.',
  ], ['dressing-room'], { stance: 'WARM' }),
  ...post('PRESS_CONFERENCE', 'PLAYER', -0.7, 5, [
    'Interesting. Nobody said any of that to me.',
    'Was not aware there was a problem. Clearly there is.',
    'Everything gets said in the papers first at this club.',
  ], ['dressing-room'], { stance: 'COLD' }),

  /* --------------------------------------------- CONTENT_DROP | CREATOR */
  ...post('CONTENT_DROP', 'CREATOR', 0.7, 5, [
    '"{title}" is live. {reach} of you have already watched it and I have not stopped shaking.',
    '{title} — out now. {club} gave me access nobody has had and I did not waste it.',
    'Right. {title}. Watch it, then tell me {club} are a joke.',
    'This is the best thing I have made and it is about {club}, which I did not see coming.',
    '{title}. Four weeks of work. Go easy.',
  ], ['creator', 'content-drop'], { flopped: false }),
  ...post('CONTENT_DROP', 'CREATOR', -0.35, 4, [
    'Well. {title} is out. Nobody watched it. That is the update.',
    'Put four weeks into {title} and the internet has decided it prefers a clip of a dog. Fair enough.',
    'Numbers on {title} are grim. That one is on me, not on {club}.',
  ], ['creator', 'content-drop'], { flopped: true }),
  ...post('CONTENT_DROP', 'CREATOR', 0.55, 4, [
    '{title}, with {sponsor}. Yes it is an ad. It is also genuinely good, which is rarer.',
    'Made {title} with {sponsor}. They paid, {club} opened the doors, you get the video.',
  ], ['creator', 'content-drop', 'commercial'], { sponsored: true, flopped: false }),
  ...post('CONTENT_DROP', 'CREATOR', 0.65, 4, [
    '{title} — a full day inside {club} and about nine minutes of it was legally usable.',
  ], ['creator', 'content-drop'], { format: 'TRAINING_DAY', flopped: false }),
  ...post('CONTENT_DROP', 'CREATOR', 0.6, 4, [
    'Wired one of them up for the whole ninety. {title}. I am not going to tell you who.',
  ], ['creator', 'content-drop'], { format: 'MIC_UP', flopped: false }),
  ...post('CONTENT_DROP', 'CREATOR', 0.75, 5, [
    '{title}. The long one. This is why I started doing this in the first place.',
  ], ['creator', 'content-drop'], { format: 'DOCUMENTARY', flopped: false }),
  ...post('CONTENT_DROP', 'CREATOR', 0.55, 4, [
    'Just cameras and the concourse. {title}. The supporters carried it entirely.',
  ], ['creator', 'content-drop'], { format: 'FAN_CAM', flopped: false }),
  ...post('CONTENT_DROP', 'CREATOR', 0.5, 4, [
    '{title}: exactly how {club} did that, with the pause button, slowly, for twenty minutes.',
  ], ['creator', 'content-drop'], { format: 'TACTICS_BREAKDOWN', flopped: false }),

  /* ------------------------------------------------ POLL_HONOURED | FAN */
  ...post('POLL_HONOURED', 'FAN', 0.8, 5, [
    'They asked us and then they actually did it. When has that ever happened.',
    'We voted for {choice} and we got {choice}. Small thing. Enormous thing.',
    'Every club says they listen. This one has now proved it once, which is once more than most.',
    'Genuinely did not think they would go through with it.',
  ], ['fans', 'poll'], { honoured: true }),
  ...post('POLL_OVERRULED', 'FAN', -0.85, 6, [
    'So why ask.',
    'We voted. They noted it. They did the opposite. Do not ask us again.',
    'The vote was clear and the vote has been ignored. That is worse than never running it.',
    'I would genuinely rather they had not bothered.',
    'Consultation, they called it.',
  ], ['fans', 'poll'], { honoured: false }),

  /* ---------------------------------------------- CAMPAIGN_BACKED | FAN */
  ...post('CAMPAIGN_BACKED', 'FAN', 0.8, 5, [
    'The club have got behind it. Properly behind it. That is not nothing.',
    '{group} started it, the club finished it. More of this.',
    'They did not have to do that and they did it anyway.',
    'Whatever happens on the pitch, they got that right.',
  ], ['fans', 'campaign'], { backed: true }),
  ...post('CAMPAIGN_REFUSED', 'FAN', -0.7, 5, [
    'Refused. At least they said it to our faces this time.',
    'A no is a no. I would rather have it straight than be strung along.',
    'That will be remembered for a lot longer than a result will.',
    '{group} will be back and it will be bigger.',
  ], ['fans', 'campaign'], { backed: false }),

  /* -------------------------------------------- STAKE_VINDICATED | FAN */
  ...post('STAKE_VINDICATED', 'FAN', 0.9, 6, [
    'THEY SAID IT AND THEN THEY DID IT.',
    'Called it. Out loud. In public. And then went and did it.',
    'This is the best week of my life and I have children.',
    'Nobody in this sport talks like that any more and nobody in this sport backs it up like that either.',
    'Going to be insufferable about this for a fortnight minimum.',
  ], ['stake', 'fans'], { won: true }),
  ...post('STAKE_EMBARRASSED', 'RIVAL', -0.95, 6, [
    'They said it. They actually said it. And then that happened.',
    'Reading that {club} post back with a cup of tea and a smile.',
    'Never talk before a football match. Ever. {club} have just taught an entire generation.',
    'Framing it. Printing it. Bringing it to the return fixture on an eight foot banner.',
    'The post is still up. That is the funniest part. The post is STILL UP.',
    'Somebody at {club} is having the worst afternoon of their professional life and it is not a player.',
  ], ['stake', 'rivalry'], { won: false }),
];

/**
 * How the world talks to a club it has already made its mind up about.
 *
 * Every hook now carries the club's social standing as a fact, so these lines
 * are only reachable once the player has *earned* a reputation by acting. A
 * club nobody has an opinion about gets none of them, which is correct: an
 * unknown quantity is written about in the ordinary way.
 */
const STANDING_SOCIAL_TEMPLATES: readonly SocialTemplate[] = [
  /* ------------------------------------------------------------- CLOWN */
  ...post('MATCH_LOST', 'RIVAL', -0.95, 5, [
    'Of course. Of course that is how {club} lose a football match.',
    'Every week. Every single week they find a new one.',
    'At this point {club} are a content farm with a stadium.',
  ], ['result', 'rivalry'], { standing: 'CLOWN' }),
  ...post('MATCH_WON', 'RIVAL', -0.8, 4, [
    'Broken clock. {club}. Twice a day.',
    'They have won one and they are going to talk about it until May.',
  ], ['result', 'rivalry'], { standing: 'CLOWN' }),
  ...post('MATCH_LOST', 'CREATOR', -0.6, 5, [
    'I do not even have to write anything for {club} videos any more. I just point the camera.',
    'Genuinely my most reliable source of material in this league.',
  ], ['result', 'creator'], { standing: 'CLOWN' }),
  ...post('MATCH_WON', 'MEDIA', 0.15, 3, [
    'A rare straightforward afternoon for a club that has not had many of them.',
  ], ['result'], { standing: 'CLOWN' }),

  /* ------------------------------------------------------------ FEARED */
  ...post('MATCH_WON', 'RIVAL', -0.85, 5, [
    'Nobody enjoys playing {club} and nobody enjoys talking about them either.',
    'They will be unbearable about this and, irritatingly, they have earned it.',
  ], ['result', 'rivalry'], { standing: 'FEARED' }),
  ...post('MATCH_SCHEDULED', 'RIVAL', -0.7, 4, [
    'Absolutely dreading this one and I am not going to pretend otherwise.',
    '{club} away. Wonderful. Cannot wait. Thrilled.',
  ], ['preview', 'rivalry'], { standing: 'FEARED' }),
  ...post('MATCH_LOST', 'CREATOR', -0.3, 4, [
    'First time {club} have looked human in a while. Worth noting purely because it is rare.',
  ], ['result', 'creator'], { standing: 'FEARED' }),
  ...post('MATCH_WON', 'MEDIA', 0.35, 4, [
    'Another one for {club}, who are becoming genuinely difficult to write about neutrally.',
  ], ['result'], { standing: 'FEARED' }),

  /* ----------------------------------------------------------- BELOVED */
  ...post('MATCH_WON', 'CREATOR', 0.8, 5, [
    'Everybody outside their own division is quietly rooting for {club} and you all know it.',
    'The neutral’s club. I do not make the rules.',
  ], ['result', 'creator'], { standing: 'BELOVED' }),
  ...post('MATCH_LOST', 'CREATOR', 0.2, 4, [
    'Gutted for {club}, and I have no allegiance to them whatsoever. That is the effect they have.',
  ], ['result', 'creator'], { standing: 'BELOVED' }),
  ...post('MATCH_LOST', 'RIVAL', -0.5, 4, [
    'Everybody feels sorry for {club}. Nobody feels sorry for us. Explain that.',
  ], ['result', 'rivalry'], { standing: 'BELOVED' }),

  /* --------------------------------------------------------- RESPECTED */
  ...post('MATCH_WON', 'MEDIA', 0.4, 4, [
    'When {club} say something is happening, it tends to happen. That is a rarer commodity than it sounds.',
  ], ['result'], { standing: 'RESPECTED' }),
  ...post('MATCH_LOST', 'MEDIA', -0.2, 4, [
    'A bad afternoon for {club}, who will say so plainly and be believed, which is half the battle.',
  ], ['result'], { standing: 'RESPECTED' }),

  /* --------------------------------------------------------- DIVISIVE */
  ...post('MATCH_WON', 'CREATOR', 0.1, 5, [
    'My comments are already at war about {club} and the match finished nine minutes ago.',
    'No club splits a timeline like {club}. Enormous for engagement. Terrible for my sanity.',
  ], ['result', 'creator'], { standing: 'DIVISIVE' }),
  ...post('MATCH_LOST', 'FAN', -0.7, 4, [
    'Everybody has an opinion about us and half of them are enjoying this.',
  ], ['result', 'fans'], { standing: 'DIVISIVE' }),
];

/**
 * More of the ordinary week.
 *
 * An audit found the feed repeating itself inside a fortnight because the pools
 * for the highest-frequency triggers were too shallow — a matchweek fires the
 * same trigger a dozen times and a five-line pool cannot survive that. These
 * are pure depth on the lines the player sees most often.
 */
const DEPTH_SOCIAL_TEMPLATES: readonly SocialTemplate[] = [
  ...post('MATCH_WON', 'FAN', 0.8, 3, [
    'Walked out of there and could not tell you a single thing about the second half. Superb.',
    'Six of us in the car and not one word said until junction 14.',
    'Ninety minutes of absolute nonsense and three points at the end of it. Take it.',
    'That is the first time this season I have enjoyed the last ten minutes.',
    'My dad has phoned me twice. He never phones me.',
    'Sunburnt, hoarse, three points. Perfect.',
    'We were terrible. We won. I do not want to hear another word about it.',
  ], ['result']),
  ...post('MATCH_WON', 'CREATOR', 0.65, 4, [
    'Clipping the last fifteen minutes of that and putting it out tonight. Unreal atmosphere.',
    'Whatever you think about {club}, that away end was the best thing in this league today.',
    'The number of you asking me about {club} has gone up about four hundred percent this month.',
  ], ['result', 'creator']),
  ...post('MATCH_LOST', 'FAN', -0.8, 3, [
    'Left on 78 and I have never left early in my life.',
    'It is not the losing. It is that none of them looked like they minded.',
    'That is comfortably the worst ninety minutes I have paid for this season.',
    'The bloke next to me did not say a word for an hour and then just left.',
    'Two hundred miles for that. Two hundred.',
    'I am fine. I am completely fine. Everything is fine.',
  ], ['result']),
  ...post('MATCH_LOST', 'MEDIA', -0.35, 3, [
    '{club} beaten {score} at {opponent}. Questions that were quiet a month ago are not quiet now.',
    'A flat afternoon for {club}, who never looked likely once {opponent} settled.',
    '{score}. On this evidence {club} have work to do and not much time to do it in.',
  ], ['result']),
  ...post('MATCH_DRAWN', 'FAN', -0.1, 3, [
    'A point. Nobody is happy. Nobody is furious. The most forgettable ninety minutes of my life.',
    'Drew that having been better for an hour, which is the most us thing imaginable.',
    'Away end sang for the full ninety for a 1-1. Best supporters in this league, no debate.',
  ], ['result']),
  ...post('MATCH_DRAWN', 'CREATOR', 0, 3, [
    'A draw that told you almost nothing about either side. I will still make a video about it.',
    'Not much to say about that one and I am contractually obliged to say something.',
  ], ['result', 'creator']),
  ...post('GOAL_SCORED', 'FAN', 0.85, 3, [
    'I have hugged a man I have never met and I would do it again.',
    'My drink is on the floor and on three other people. Worth it.',
    'Never in doubt. Absolutely never in doubt. I was crying.',
    'The noise when that went in. The actual noise.',
  ], ['goal']),
  ...post('GOAL_SCORED', 'CREATOR', 0.75, 4, [
    'Watch {player} before the ball even arrives. He has already decided. That is the whole clip.',
    'That finish is going to be on my feed for a week and I am not going to complain once.',
  ], ['goal', 'creator']),
  ...post('RED_CARD', 'FAN', -0.75, 3, [
    'Ten men, forty minutes, and somehow the longest afternoon of the season.',
    'You cannot do that. You simply cannot do that there.',
    'He has let everybody down and he knows it, which is the only mitigation available.',
  ], ['discipline']),
  ...post('RED_CARD', 'MEDIA', -0.5, 3, [
    '{player} sent off in the {minuteOrdinal} minute. {club} play the rest with ten.',
    'A red card for {player} that leaves {club} short for the next {matches}.',
  ], ['discipline']),
  ...post('PLAYER_SIGNED', 'FAN', 0.6, 3, [
    'Do not know a thing about him. Already love him.',
    'Watched forty minutes of compilation and I am now an expert. He is unbelievable.',
    'A signing that says something about where this club thinks it is going.',
  ], ['transfer']),
  ...post('PLAYER_INJURED', 'FAN', -0.6, 3, [
    'Not him. Anybody but him.',
    'You could hear the whole ground go quiet when the stretcher came on.',
    'Get well soon. Genuinely. Forget the football.',
  ], ['injury']),
  ...post('CONTRACT_SIGNED', 'FAN', 0.6, 3, [
    'Best bit of business we have done all year and it did not cost a penny in fees.',
    'He could have gone anywhere. He stayed. That means something.',
  ], ['contract']),
  ...post('ATTENDANCE_RECORDED', 'FAN', 0.5, 3, [
    'Full house. Every seat. You could feel the floor moving.',
    'Never seen it like that. Not once in twenty years.',
  ], ['fans'], { sellOut: true }),
  ...post('ATTENDANCE_RECORDED', 'FAN', -0.5, 3, [
    'Half the ground empty and the half that turned up wish they had not.',
    'You can hear individual conversations from the other stand. That is where we are.',
  ], ['fans'], { sellOut: false }),
  ...post('MANAGER_PRESSURE', 'FAN', -0.6, 4, [
    'I do not want him gone. I want somebody to tell me what the plan is.',
    'Every manager we have ever sacked, we sacked eight weeks too late or three months too early.',
  ], ['manager']),
  ...post('MANAGER_CRISIS', 'MEDIA', -0.75, 5, [
    'The mood around {club} has moved past patience and into something colder.',
    'Nobody at {club} is saying it out loud yet. Everybody at {club} is thinking it.',
  ], ['manager']),
  ...post('CREATOR_MOMENT', 'FAN', 0.55, 3, [
    'That clip has been in front of about four million people who could not name this league.',
    'Our club is on timelines that have never seen a football match. Strange feeling.',
  ], ['creator']),
  ...post('SPONSOR_SIGNED', 'FAN', 0.2, 3, [
    'A sponsor. An actual sponsor. Somebody has looked at us and decided we are worth money.',
  ], ['commercial']),
  ...post('FAN_BUZZ', 'FAN', 0.7, 3, [
    'Cannot remember the last time I looked forward to a Saturday this much.',
    'Something is happening at this club and everybody can feel it.',
  ], ['fans']),
  ...post('FAN_UNREST', 'FAN', -0.8, 4, [
    'It is not the results. It is that nobody has explained anything to anybody in six months.',
    'We are not asking to win every week. We are asking to recognise the team.',
  ], ['fans']),
];


/**
 * The second half of the interactive library.
 *
 * Volume is not decoration here. A matchweek fires the same trigger a dozen
 * times over, and a shallow pool is the single reason a generated feed starts
 * reading as generated inside a fortnight. Every block below exists so that the
 * anti-repetition machinery has somewhere to go.
 */
const INTERACTIVE_SOCIAL_TEMPLATES_2: readonly SocialTemplate[] = [
  /* ------------------------------------------- composer | derby specifics */
  ...clubTone('DERBY_WIN', 'HYPE', 0.95, [
    'THE CITY IS OURS. {score}. 🔊',
    '{opponent} {score}. Sing it until Monday.',
    'Derby day and the away end has not sat down once. {score}.',
  ]),
  ...clubTone('DERBY_WIN', 'CLASSY', 0.6, [
    'Full time in the derby: {score}. Thank you to every one of you who made the trip.',
    '{score}. A word for {opponent} — they made it exactly as hard as it should have been.',
  ]),
  ...clubTone('DERBY_WIN', 'PROVOCATIVE', 0.35, [
    'The bus is warm, the boys are singing, and {opponent} are already talking about next season.',
    '{score}. To everybody at {opponent} who spent the week talking: thank you, genuinely.',
    'We would just like to check that everyone at {opponent} is alright.',
  ]),
  ...clubTone('DERBY_WIN', 'FUNNY', 0.65, [
    'Derby win. The account is now legally a hazard.',
    '{score}. Somebody go and check on the {opponent} social media manager, it is not their fault.',
  ]),
  ...clubTone('DERBY_WIN', 'DEFIANT', 0.55, [
    '{score}. Everybody outside this city had us down. Everybody inside it knew.',
  ]),
  ...clubTone('DERBY_DEFEAT', 'CLASSY', -0.25, [
    'Full time: {score}. Well played to {opponent}. We will see them again.',
    '{score}. Nothing to say beyond thank you to the away end, who did not deserve that.',
  ]),
  ...clubTone('DERBY_DEFEAT', 'DEFIANT', -0.1, [
    'A derby, and we lost it. This club has lost derbies before and gone on to have the season anyway.',
    'They can have today. They are not having the rest of it.',
  ]),
  ...clubTone('DERBY_DEFEAT', 'PROVOCATIVE', -0.55, [
    'Congratulations to {opponent}. Enjoy this one. You have earned a night of it.',
  ]),
  ...clubTone('DERBY_DEFEAT', 'FUNNY', -0.2, [
    'Turning the comments off, going for a lie down, see you all in a week.',
  ]),
  ...clubTone('DERBY_DEFEAT', 'HYPE', -0.05, [
    'Home game next. Fill it. Make it deafening. 💛',
  ]),

  /* ----------------------------------- composer | statement and shock results */
  ...clubTone('STATEMENT_WIN', 'HYPE', 0.9, [
    '{score}. That is a statement and we are not going to pretend it is not. 🔊',
  ]),
  ...clubTone('STATEMENT_WIN', 'CLASSY', 0.55, [
    '{score}. A complete performance. Thank you to everybody who came.',
  ]),
  ...clubTone('STATEMENT_WIN', 'PROVOCATIVE', 0.3, [
    '{score} away from home. We will let the rest of the division work out what that means.',
  ]),
  ...clubTone('STATEMENT_WIN', 'DEFIANT', 0.45, [
    '{score}. Remember who was saying what in August.',
  ]),
  ...clubTone('STATEMENT_WIN', 'FUNNY', 0.6, [
    '{score}. We have checked and yes, they all count the same as a one-nil.',
  ]),
  ...clubTone('SHOCK_DEFEAT', 'CLASSY', -0.4, [
    'Full time: {score}. That was not good enough and everybody in that dressing room knows it.',
    '{score}. Apologies to everyone who travelled. That is not the standard.',
  ]),
  ...clubTone('SHOCK_DEFEAT', 'DEFIANT', -0.2, [
    '{score}. One afternoon. We will be judged on the season, not on this.',
  ]),
  ...clubTone('SHOCK_DEFEAT', 'FUNNY', -0.3, [
    'The account has seen the same match you have and has nothing witty prepared.',
  ]),
  ...clubTone('SHOCK_DEFEAT', 'PROVOCATIVE', -0.6, [
    'Plenty of people are going to enjoy that. Write the names down.',
  ]),
  ...clubTone('SHOCK_DEFEAT', 'HYPE', -0.15, [
    'Home. Next week. Every seat. We fix this together. 💛',
  ]),

  /* ---------------------------------------- composer | marquee and squad news */
  ...clubTone('MARQUEE_SIGNING', 'HYPE', 0.95, [
    '{player}. HERE. NOW. 🔊',
    'We said we would go and get one. {player} is a {club} player. {fee}.',
  ]),
  ...clubTone('MARQUEE_SIGNING', 'CLASSY', 0.6, [
    'We are delighted to confirm {player} has signed for {club}. Welcome.',
  ]),
  ...clubTone('MARQUEE_SIGNING', 'PROVOCATIVE', 0.35, [
    '{player} could have gone anywhere. He is here. That should worry a few people.',
  ]),
  ...clubTone('MARQUEE_SIGNING', 'DEFIANT', 0.5, [
    'Everybody said a club our size could not do this. {player}.',
  ]),
  ...clubTone('MARQUEE_SIGNING', 'FUNNY', 0.7, [
    'We have signed {player} and the graphics team have gone home early to lie down.',
  ]),
  ...clubTone('PLAYER_SOLD', 'CLASSY', 0.1, [
    '{player} has joined {buyer}. He gave this club everything and he leaves with our thanks.',
    'Good luck, {player}. Always welcome back.',
  ]),
  ...clubTone('PLAYER_SOLD', 'DEFIANT', -0.05, [
    '{player} has gone. This club has been here before and it has always been fine.',
  ]),
  ...clubTone('PLAYER_SOLD', 'PROVOCATIVE', -0.2, [
    '{player} joins {buyer}. We wish him well and we will enjoy the fixture.',
  ]),
  ...clubTone('YOUTH_PROSPECT_PROMOTED', 'HYPE', 0.8, [
    '{player}. {age} years old. One of ours. 💛',
  ]),
  ...clubTone('YOUTH_PROSPECT_PROMOTED', 'CLASSY', 0.55, [
    '{player} joins the first-team squad. He has earned every bit of it.',
  ]),
  ...clubTone('YOUTH_PROSPECT_PROMOTED', 'DEFIANT', 0.4, [
    'People said we would have to buy our way out of this. {player} is {age}.',
  ]),
  ...clubTone('MOTM_AWARDED', 'HYPE', 0.85, [
    '{player}. {rating}. Nobody near him. 🔊',
  ]),
  ...clubTone('MOTM_AWARDED', 'CLASSY', 0.55, [
    'Man of the match: {player}, and it was not close.',
  ]),
  ...clubTone('MOTM_AWARDED', 'FUNNY', 0.6, [
    '{player} rated {rating}. The other twenty-one players have been informed.',
  ]),
  ...clubTone('RECORD_BROKEN', 'HYPE', 0.9, [
    '{record}. In the book. Forever. 🔊',
  ]),
  ...clubTone('RECORD_BROKEN', 'CLASSY', 0.7, [
    'A new club record: {record}. To everybody who has been part of this — thank you.',
  ]),
  ...clubTone('RECORD_BROKEN', 'DEFIANT', 0.5, [
    '{record}. Built here, by people who were told this club would never do any of it.',
  ]),
  ...clubTone('CONTRACT_SIGNED', 'CLASSY', 0.6, [
    '{player} has signed a new {years}-year deal. Delighted.',
  ]),
  ...clubTone('CONTRACT_SIGNED', 'HYPE', 0.8, [
    'HE HAS SIGNED. {player}. {years} more years. 💛',
  ]),
  ...clubTone('CONTRACT_SIGNED', 'PROVOCATIVE', 0.35, [
    '{player} has signed a new deal. A number of clubs will be extremely irritated by this.',
  ]),
  ...clubTone('CONTRACT_EXPIRING', 'CLASSY', -0.2, [
    'Conversations with {player} are ongoing. That is genuinely all there is to say today.',
  ]),
  ...clubTone('CONTRACT_EXPIRING', 'DEFIANT', -0.15, [
    'Nobody at this club is bigger than this club. That has never once been complicated.',
  ]),
  ...clubTone('CREATOR_JOINED', 'HYPE', 0.85, [
    '{creator} IS WITH US. 🔊',
  ]),
  ...clubTone('CREATOR_JOINED', 'CLASSY', 0.55, [
    'Pleased to say {creator} has joined the club as {role}. Welcome.',
  ]),
  ...clubTone('CREATOR_JOINED', 'FUNNY', 0.65, [
    '{creator} has joined us, which means the training ground is now permanently on camera. Sorry, everyone.',
  ]),
  ...clubTone('SPONSOR_SIGNED', 'CLASSY', 0.45, [
    'Delighted to welcome {sponsor} to {club}.',
  ]),
  ...clubTone('SPONSOR_SIGNED', 'FUNNY', 0.55, [
    'A sponsor. A real one. With money and everything.',
  ]),
  ...clubTone('FACILITY_UPGRADED', 'CLASSY', 0.5, [
    'The {facility} work is finished. Small thing, long time coming.',
  ]),
  ...clubTone('FACILITY_UPGRADED', 'HYPE', 0.7, [
    'New {facility}. Come and have a look at what this club is building. 💛',
  ]),
  ...clubTone('ATTENDANCE_RECORDED', 'CLASSY', 0.5, [
    '{attendance} of you. Thank you. That is the whole post.',
  ], { sellOut: true }),
  ...clubTone('ATTENDANCE_RECORDED', 'HYPE', 0.75, [
    '{attendance}. FULL HOUSE. Every single seat. 🔊',
  ], { sellOut: true }),
  ...clubTone('SEASON_STARTED', 'HYPE', 0.8, [
    'Season {season}. Here we go. 🔊',
  ]),
  ...clubTone('SEASON_STARTED', 'CLASSY', 0.5, [
    'Season {season} begins. Thank you to everybody who renewed.',
  ]),
  ...clubTone('SEASON_STARTED', 'DEFIANT', 0.45, [
    'Nobody outside this building fancies us this season. Perfect.',
  ]),
  ...clubTone('SEASON_COMPLETED', 'CLASSY', 0.3, [
    'That is season {season}. Finished {position}. Thank you, all of you.',
  ]),
  ...clubTone('SEASON_COMPLETED', 'DEFIANT', 0.2, [
    '{position}. Not where we wanted. Not where we were, either.',
  ]),
  ...clubTone('MANAGER_PRESSURE', 'DEFIANT', -0.1, [
    'The manager has the full support of this club. That is not a statement, it is a fact.',
  ]),
  ...clubTone('MANAGER_PRESSURE', 'CLASSY', -0.15, [
    'We are aware of the speculation. We will not be adding to it.',
  ]),
  ...clubTone('MANAGER_PRESSURE', 'PROVOCATIVE', -0.4, [
    'A lot of people are very keen to write this. They can keep waiting.',
  ]),

  /* --------------------------------------------- more of the world answering */
  ...post('CLUB_POSTED', 'RIVAL', -0.85, 5, [
    'Nine replies and eight of them are from us. Enjoying this enormously.',
    'They have blocked half our fanbase and left the post up. Incredible commitment.',
    'Bold from a club that finished below us. Bold.',
  ], ['rivalry'], { tone: 'PROVOCATIVE' }),
  ...post('CLUB_POSTED', 'RIVAL', -0.7, 4, [
    'Every year. Every single year they do this in November.',
    'Screenshot, folder, done. See you in April.',
  ], ['rivalry'], { tone: 'HYPE' }),
  ...post('CLUB_POSTED', 'FAN', 0.55, 3, [
    'Whoever writes these has been reading the forum and I respect it.',
    'That is a proper club account. Not a brand. A club.',
    'Right, that has given me the fear and the joy simultaneously.',
  ], ['fans'], { tone: 'DEFIANT' }),
  ...post('CLUB_POSTED', 'FAN', 0.5, 3, [
    'Nice to have a club account that talks like a person.',
    'Straight to the point. Good.',
  ], ['fans'], { tone: 'CLASSY' }),
  ...post('CLUB_POSTED', 'MEDIA', -0.25, 4, [
    'The {club} account has been busy again this week, and not everybody at the club is delighted about it.',
    'Worth noting that {club} chose to say that publicly rather than let it pass.',
  ], ['media'], { tone: 'DEFIANT' }),
  ...post('CLUB_POSTED', 'CREATOR', 0.35, 4, [
    'I have watched club accounts for eight years. That is top five, easily.',
    'Whoever is behind the {club} account, my inbox is open and my rates are reasonable.',
  ], ['creator'], { tone: 'FUNNY' }),

  /* ------------------------------------------------ more quote-dunk material */
  ...post('QUOTE_DUNK', 'CLUB', -0.6, 5, [
    'Still up. Still there. Still wrong.',
    'We would never normally do this. We are doing this.',
    'Sorry — could you say that again for the room?',
    'This has been sent to us four hundred times so here it is officially.',
    'One for the archive.',
  ], ['authored']),

  /* -------------------------------------------- more manager reply material */
  ...post('MANAGER_REPLY', 'CLUB', 0.6, 4, [
    'He has been in every day, first in, last out. Nobody outside sees that and nobody outside gets a vote.',
    'You do not throw a footballer to the wolves because a graph went the wrong way.',
    'I would rather be wrong about {player} than right about all of you.',
  ], ['dressing-room', 'authored'], { stance: 'BACK_HIM' }),
  ...post('MANAGER_REPLY', 'CLUB', -0.55, 4, [
    'I pick a side on Thursday, not on a timeline. {player} knows what Thursday needs to look like.',
    'There is a standard here and it applies to everyone. That is not a threat, it is the job.',
  ], ['dressing-room', 'authored'], { stance: 'CALL_HIM_OUT' }),

  /* ----------------------------------------- more press conference reaction */
  ...post('PRESS_CONFERENCE', 'MEDIA', 0.2, 3, [
    'Twelve minutes with {manager}, and the last two are the ones you want.',
    '{manager} answered every question put to him today, which is worth saying out loud in this sport.',
  ], ['press'], { stance: 'WARM' }),
  ...post('PRESS_CONFERENCE', 'MEDIA', -0.5, 4, [
    'That will be on the wall of a dressing room by Friday, and not the one {manager} intended.',
    'A sentence {manager} will be asked about again in about four weeks.',
  ], ['press'], { stance: 'COLD' }),
  ...post('PRESS_CONFERENCE', 'FAN', 0.6, 3, [
    'Thank you. Somebody finally said it.',
    'Playing that clip at my own wedding.',
  ], ['press', 'fans'], { stance: 'WARM' }),
  ...post('PRESS_CONFERENCE', 'FAN', -0.5, 3, [
    'Not a fan of that at all, and I have defended him all season.',
    'You handle that inside the building. Everybody knows that.',
  ], ['press', 'fans'], { stance: 'COLD' }),
  ...post('PRESS_CONFERENCE', 'CREATOR', 0.35, 4, [
    'Genuinely refreshing. Most of them say nothing for ten minutes and call it media training.',
  ], ['press', 'creator'], { stance: 'WARM' }),
  ...post('PRESS_CONFERENCE', 'PLAYER', 0.65, 4, [
    'Gaffer. 🤝',
    'Nothing needs saying. Back in Monday.',
  ], ['dressing-room'], { stance: 'WARM' }),
  ...post('PRESS_CONFERENCE', 'PLAYER', -0.65, 4, [
    'Some things are for the training ground.',
    'No comment, obviously.',
  ], ['dressing-room'], { stance: 'COLD' }),

  /* --------------------------------------------------- more content drops */
  ...post('CONTENT_DROP', 'CREATOR', 0.6, 4, [
    '{title} is up. {reach} views and the comments are the best part.',
    'New one about {club}. {title}. Genuinely proud of this.',
    '{title} — the access on this was unreal and I still cannot believe they let me.',
    'You asked for more {club} content. {title}. Enjoy.',
  ], ['creator', 'content-drop'], { flopped: false }),
  ...post('CONTENT_DROP', 'CREATOR', -0.4, 4, [
    'Honest update: {title} did not work. Back to the drawing board.',
    'Some you win. {title} was not one.',
  ], ['creator', 'content-drop'], { flopped: true }),
  ...post('CONTENT_DROP', 'CREATOR', 0.5, 4, [
    'Derby week with {club}. {title}. Filmed the whole build-up and about a third of it is usable.',
  ], ['creator', 'content-drop'], { format: 'DERBY_BUILD_UP', flopped: false }),
  ...post('CONTENT_DROP', 'CREATOR', 0.6, 4, [
    '{title} — brought a mate in. Two audiences, one very long argument about {club}.',
  ], ['creator', 'content-drop'], { format: 'COLLAB', flopped: false }),
  ...post('CONTENT_DROP', 'CREATOR', 0.55, 4, [
    'Streamed for six hours for a cause the {club} support picked themselves. {title}.',
  ], ['creator', 'content-drop'], { format: 'CHARITY_STREAM', flopped: false }),
  ...post('CONTENT_DROP', 'FAN', 0.6, 3, [
    'Watched {title} twice. Do yourselves a favour.',
    'People who do not follow football are sending me {title}. What is happening.',
  ], ['creator', 'content-drop'], { flopped: false }),
  ...post('CONTENT_DROP', 'MEDIA', 0.3, 3, [
    '{creator} has put {club} in front of {reach} people this week, most of whom do not watch this division.',
  ], ['creator', 'content-drop'], { flopped: false }),

  /* -------------------------------------------------------- more fan votes */
  ...post('POLL_HONOURED', 'FAN', 0.75, 4, [
    'Asked. Answered. Done. Simple as that and yet nobody else manages it.',
    'The turnout on that was enormous and they respected it. Good club.',
    'They ran a vote about {topic} and then did the thing. Revolutionary.',
  ], ['fans', 'poll'], { honoured: true }),
  ...post('POLL_HONOURED', 'CREATOR', 0.6, 4, [
    'Every club should be doing this and almost none of them are. Credit where it is due.',
  ], ['fans', 'poll'], { honoured: true }),
  ...post('POLL_OVERRULED', 'FAN', -0.8, 5, [
    'A vote is not a suggestion box.',
    'They will run another one in three months and nobody will fill it in.',
    'That is the last time any of us take one of these seriously.',
  ], ['fans', 'poll'], { honoured: false }),
  ...post('POLL_OVERRULED', 'MEDIA', -0.5, 4, [
    '{club} asked their supporters about {topic}, received a clear answer, and have gone the other way.',
  ], ['fans', 'poll'], { honoured: false }),

  /* ---------------------------------------------------- more fan campaigns */
  ...post('CAMPAIGN_BACKED', 'FAN', 0.75, 4, [
    'Club paid for the fabric and opened the gates the night before. That is all we ever ask.',
    'Somebody at that club actually understands what this is.',
    'They could have quietly let it die. They did not.',
  ], ['fans', 'campaign'], { backed: true }),
  ...post('CAMPAIGN_BACKED', 'CREATOR', 0.55, 4, [
    'This is the bit of football that people who do not watch football never get to see.',
  ], ['fans', 'campaign'], { backed: true }),
  ...post('CAMPAIGN_REFUSED', 'FAN', -0.65, 4, [
    'We will do it ourselves. We always do it ourselves.',
    'Refused, and the reason given was insulting. It will not be forgotten.',
  ], ['fans', 'campaign'], { backed: false }),
  ...post('CAMPAIGN_REFUSED', 'MEDIA', -0.35, 3, [
    '{club} have declined to support {campaign}. It will go ahead regardless.',
  ], ['fans', 'campaign'], { backed: false }),

  /* -------------------------------------------------------- more stakes */
  ...post('STAKE_VINDICATED', 'FAN', 0.85, 5, [
    'They said it and I did not sleep for four days and it was worth every second.',
    'Do not ever change. Say it again next week.',
    'That is the most fun I have had following this club.',
  ], ['stake', 'fans'], { won: true }),
  ...post('STAKE_VINDICATED', 'CREATOR', 0.7, 5, [
    'Say what you like about {club}, they backed it up and almost nobody in this sport does.',
    'That took nerve. Genuine nerve. Respect.',
  ], ['stake', 'creator'], { won: true }),
  ...post('STAKE_VINDICATED', 'MEDIA', 0.5, 4, [
    '{club} said it out loud in advance and then delivered it, which is rare enough to be worth a paragraph.',
  ], ['stake'], { won: true }),
  ...post('STAKE_EMBARRASSED', 'RIVAL', -0.9, 5, [
    'Going to be quoting that {club} post at them for the next decade.',
    'A masterclass in why you keep your mouth shut until Saturday.',
    'The tifo for the return fixture writes itself. Thank you {club}.',
  ], ['stake', 'rivalry'], { won: false }),
  ...post('STAKE_EMBARRASSED', 'CREATOR', -0.7, 5, [
    'This is going in the video. Obviously it is going in the video.',
    'Never talk before a match. It is the only rule. {club} have just proved it again.',
  ], ['stake', 'creator'], { won: false }),
  ...post('STAKE_EMBARRASSED', 'FAN', -0.75, 4, [
    'I begged them not to post it. Begged.',
    'Deleting my account until roughly March.',
  ], ['stake', 'fans'], { won: false }),
];

export const BASE_SOCIAL_TEMPLATES: readonly SocialTemplate[] = [
  /* --------------------------------------------------------- MATCH_WON */
  ...post('MATCH_WON', 'FAN', 0.8, 3, [
    'THREE POINTS. Do not talk to me about anything else today.',
    'We were awful for twenty minutes and won anyway. That is what good teams do, apparently. {club}.',
    '{player} was unplayable today. Genuinely unplayable.',
    'Best I have felt walking out of that ground in two years.',
    'Every one of those points was earned. {score}. Nothing sweeter than that.',
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
    'FULL TIME: {club} {score} {opponent}. Player ratings in the thread.',
    'Three points for {club}, who beat {opponent} {score}.',
    '{club} see off {opponent}. {score} the final score.',
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
    // This line used to read "who have now taken one point from a possible
    // nine" — a specific claim about a run the template has no way of knowing.
    // A press account may only assert what the event carries.
    'Defeat for {club}, beaten {score} by {opponent}. Report and ratings to follow.',
    'FULL TIME: {club} {score} {opponent}. Questions for the home dressing room.',
    '{opponent} take all three at the expense of {club}. Reaction shortly.',
    'Another one gets away from {club}. {score} the final score against {opponent}.',
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
    '{player} is sent off in the {minuteOrdinal} minute. He will now serve a suspension.',
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
  // Player records and club records are written separately on purpose. Filling
  // a {player} slot with the club's own name produced "Cinderwick Town writes
  // his name into the history of Cinderwick Town"; the club lines below take
  // {subject} instead, which the hook fills with whichever it actually is.
  ...post('RECORD_BROKEN', 'CLUB', 0.7, 4, [
    'A club record. {player} writes his name into the history of {club}. 📖',
    '{player}. {record}. One for the wall in the tunnel. 📖',
  ], ['record']),
  ...post('RECORD_BROKEN', 'CLUB', 0.7, 4, [
    '{record}. A new mark for {club}, set today. 📖',
    'Into the record books: {club}, {record}, {value}.',
  ], ['record']),
  ...post('RECORD_BROKEN', 'FAN', 0.7, 3, [
    'I was there for {record}. Framing the ticket.',
    'Whatever else happens this season, {subject} did that.',
  ], ['record']),
  // Only sayable once the record book has something in it worth beating.
  ...post('RECORD_BROKEN', 'FAN', 0.7, 3, [
    'That record stood for {recordAge} seasons. {recordAge}.',
    'Grew up with that record. Never thought I would see it go.',
  ], ['record'], { recordAgeSeasons_gte: 2 }),
  ...post('RECORD_BROKEN', 'MEDIA', 0.4, 3, [
    'RECORD | {subject} sets a new mark: {record} ({value}).',
    '{club} rewrite their own history: {record} now stands at {value}.',
    'New entry in the {club} record book — {record}, {value}.',
    '{record} moves to {value}. The old number lasted longer than most.',
  ], ['record']),
  ...post('RECORD_BROKEN', 'CREATOR', 0.5, 4, [
    'Records are the only thing in this sport nobody can argue with. {record}: {value}.',
    'Put {value} on a shirt. {record}. Done.',
  ], ['record']),
  ...post('RECORD_BROKEN', 'MEDIA', 0.4, 3, [
    'A record that has stood for a generation falls to {player}.',
  ], ['record'], { recordAgeSeasons_gte: 3 }),

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

  /* The interactive layer: everything the player does, and the world's answer. */
  ...INTERACTIVE_SOCIAL_TEMPLATES,
  ...INTERACTIVE_SOCIAL_TEMPLATES_2,
  ...INTERACTIVE_REACTION_TEMPLATES,
  ...STANDING_SOCIAL_TEMPLATES,
  ...DEPTH_SOCIAL_TEMPLATES,
];

export const BASE_SOCIAL_TEMPLATE_COUNT = BASE_SOCIAL_TEMPLATES.length;
