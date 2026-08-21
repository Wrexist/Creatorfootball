import type { CommentaryLine } from '../../schema';

/**
 * Broadcast commentary.
 *
 * Two hundred and fifty-odd lines across the match event stream and five tones.
 * The match engine picks by event type and by tone, weighting toward the tone
 * that fits the moment, and never repeats a line inside one match while an
 * alternative exists — so the bank has to be deep where the events are frequent
 * (goals, shots, saves) and can be thinner where they are rare (red cards).
 *
 * Tokens available: {player} {club} {opponent} {minute} {score} {assist} {creator}
 *
 * Nothing here names a real person, club, competition or broadcaster.
 */

type Tone = CommentaryLine['tone'];

let counter = 0;
const lines = (eventType: string, tone: Tone, weight: number, texts: readonly string[]): CommentaryLine[] =>
  texts.map((text) => ({ id: `cm_${(counter += 1).toString(36)}_${eventType.toLowerCase()}`, eventType, text, tone, weight }));

export const BASE_COMMENTARY: readonly CommentaryLine[] = [
  /* --------------------------------------------------------------- GOAL */
  ...lines('GOAL', 'HYPE', 10, [
    '{player}! Straight through the middle of it and {club} are in front!',
    'Oh, that is a GOAL. {player} from distance and the far corner never had a chance.',
    '{player} — first time — and the net is still moving. {score}.',
    'They have been threatening it for five minutes and {player} finally does it!',
    '{assist} sees it early, {player} does the rest. Beautifully worked.',
    '{player}! Off the underside and in! The {club} end has lost its mind.',
    'What a finish. {player} had one yard and took it.',
    'It is in! {player} with the sort of goal that ends up on every feed in the country.',
    '{club} score, {player} claims it, and this match has turned on its head.',
    'Ninety seconds after the restart! {player} punishes them immediately.',
  ]),
  ...lines('GOAL', 'DRAMATIC', 8, [
    'Minute {minute}. {player}. And that, you suspect, is the whole afternoon.',
    'A goal that will be talked about long after the result is forgotten. {player}.',
    'They will remember where they were for this one. {player}, {minute} minutes gone.',
    '{club} have waited all season for a moment like it — and {player} delivers it.',
    'Everything this club has been building toward, condensed into one touch by {player}.',
    'From nothing. From absolutely nothing. {player} makes it {score}.',
    'The {club} bench are on the pitch. Every one of them. {player} has done it.',
  ]),
  ...lines('GOAL', 'NEUTRAL', 12, [
    'Goal, {club}. {player} the scorer, {assist} with the assist. {score}.',
    '{player} finishes. That is {score} at the {minute}-minute mark.',
    'Simple in the end. {player} taps in and {club} lead.',
    'A goal for {club} — {player}, unmarked at the back post.',
    'Deflected in off {player}. They will all count the same.',
    '{player} converts. {club} back level.',
    'That is a well-taken goal by {player}. Good delivery from {assist}.',
    '{club} score through {player}. It is {score}.',
  ]),
  ...lines('GOAL', 'CRITICAL', 6, [
    'And {opponent} will be furious about that. Nobody within five yards of {player}.',
    '{player} scores, but the defending is genuinely poor. Three chances to clear.',
    'That is a gift. {opponent} have handed {player} the simplest finish he will ever have.',
    'The keeper has to do better. {player} will take it, but that should be saved.',
    '{opponent} switched off completely and {player} made them pay.',
  ]),
  ...lines('GOAL', 'WRY', 6, [
    'Well. {player} will be dining out on that for some time.',
    '{player} scores, and immediately looks for a camera. Of course he does.',
    'He meant it. He says he meant it. {player} did not mean it.',
    'That is the second time this half {opponent} have defended a corner like strangers.',
  ]),

  /* --------------------------------------------------------------- SHOT */
  ...lines('SHOT', 'NEUTRAL', 12, [
    '{player} shoots — and it is dealt with.',
    'A chance for {player}, first time, no power on it.',
    '{player} tries his luck from range.',
    'Shot from {player}, blocked on its way through.',
    '{player} winds up and lets fly.',
    'Effort from {player}, gathered comfortably.',
    '{player} gets a shot away under pressure.',
  ]),
  ...lines('SHOT', 'HYPE', 8, [
    '{player} FANCIES this one!',
    'Oh he has hit that! {player} from thirty!',
    '{player} takes it on and the crowd rises with him!',
    'He is going to shoot — {player} — and it is a fierce one!',
  ]),
  ...lines('SHOT', 'CRITICAL', 6, [
    '{player} shoots when there were three better options. He knows it.',
    'Snatched at by {player}. He had time he did not think he had.',
    'That is a poor decision from {player}. Nobody in the crowd wanted a shot there.',
    'Ambitious from {player}, and by ambitious I mean pointless.',
  ]),
  ...lines('SHOT', 'WRY', 5, [
    '{player} shoots. The people behind that goal are having an eventful evening.',
    'Struck with real conviction by {player}, which is more than can be said for the direction.',
    'That is the fourth time {player} has tried that. It has not worked yet.',
  ]),
  ...lines('SHOT', 'DRAMATIC', 6, [
    '{player} lets go and the whole end rises with it.',
    'It falls to {player}, and there is no hesitation in it.',
    '{player} snatches at the chance the move deserved.',
    'Half a second of space, and {player} spent it on a shot.',
    '{player} shapes to shoot from a place no coach would approve of.',
    'The ball runs to {player} at the edge of the box — shot!',
    '{player} goes for it from somewhere only he believed was in range.',
    'One step off the defender\'s shoulder and {player} hits it first time!',
    'The clearance lands at the feet of {player}, who asks no questions.',
    'A sight of goal opens for a heartbeat, and {player} takes the shot on!',
  ]),

  /* --------------------------------------------------------------- SAVE */
  ...lines('SAVE', 'HYPE', 10, [
    'SAVED! How has he kept that out?',
    'Enormous save! {player} denied at point-blank range!',
    'He has got a strong hand to it! That was going in!',
    'Unbelievable. The keeper is not supposed to reach that.',
    'What a stop! {club} are still level because of that alone!',
  ]),
  ...lines('SAVE', 'NEUTRAL', 10, [
    'Saved. Comfortable enough in the end.',
    'Held well. No rebound, no danger.',
    'Pushed away and behind for a corner.',
    'The keeper reads it early and smothers.',
    '{player} sees his effort turned aside.',
  ]),
  ...lines('SAVE', 'DRAMATIC', 6, [
    'He has saved the match. It is minute {minute} and he has saved the match.',
    'That save will be worth three points and everybody in here knows it.',
    'A goalkeeper deciding a game with his hands and his nerve.',
  ]),
  ...lines('SAVE', 'WRY', 5, [
    'Saved, and the keeper looks more surprised than anybody.',
    'He got a boot to it. Not elegant. Entirely effective.',
  ]),
  ...lines('SAVE', 'CRITICAL', 6, [
    '{player} gave the keeper the eyes and the keeper did not buy it.',
    'Good position all the way through, and that is why the save looks simple.',
    'The strike was clean. The hands behind it were cleaner.',
    '{club} will wonder how that stayed out. The answer is goalkeeping.',
    'He waited, he set himself, and then he won it.',
    'That should have beaten him, and everybody in the ground knows it.',
  ]),
  ...lines('SAVE', 'DRAMATIC', 4, [
    '{player} cannot believe it. The keeper never doubted for a second.',
    'The rebound fell somewhere safe, and that is down to how he punched it.',
    'A save with the match on the line, and {opponent} cannot believe their luck.',
    'The crowd thought it was in. He knew otherwise from the moment it left the boot.',
  ]),

  /* --------------------------------------------------------------- MISS */
  ...lines('MISS', 'CRITICAL', 10, [
    '{player} has to score. There is no other way to describe it.',
    'Wide. And that is a dreadful miss from {player}.',
    'Over the bar from six yards. {player} will not sleep tonight.',
    'How has he missed? {player} had the whole goal.',
    'That is the miss of the season and it belongs to {player}.',
  ]),
  ...lines('MISS', 'NEUTRAL', 10, [
    '{player} drags it wide of the far post.',
    'High and handsome from {player}.',
    'Just past the upright. {player} holds his head.',
    'Off target. {club} will feel that was a chance.',
    'Wide by a yard. Good move, poor end.',
  ]),
  ...lines('MISS', 'WRY', 6, [
    '{player} has put that closer to the corner flag than the goal.',
    'The row behind the goal has been evacuated. {player} again.',
    'That is one for the archive, and not the good archive.',
  ]),
  ...lines('MISS', 'DRAMATIC', 5, [
    'He will see that one for the rest of his career. {player}, minute {minute}, and it is wide.',
    'A moment {player} would trade everything to have back.',
  ]),
  ...lines('MISS', 'HYPE', 6, [
    'Wide! And {club} had the whole goal to aim at!',
    'Just past the post from {player} — so close the net moved!',
    '{player} bends it inches wide and the groan is enormous!',
    'It has to go in from {player} — it does not!',
    'Millimetres. That is what separated {player} from the goal.',
    'Off target, but {opponent} defended none of that.',
  ]),
  ...lines('MISS', 'CRITICAL', 5, [
    'That was the chance, and {player} will know it before he reaches halfway.',
    'The move deserved better than {player} managed at the end of it.',
    'All that work, and {club} finish it with a miss from six yards.',
    'Nobody in the ground can quite believe {player} did not score there.',
    'A bad one to miss, and {player} missed it badly.',
  ]),

  /* --------------------------------------------------------------- POST */
  ...lines('POST', 'DRAMATIC', 8, [
    'Off the post! An inch either side and that is a goal!',
    'The woodwork! {player} cannot believe it!',
    'Post, and out. {club} are cursing the carpentry.',
    'Crossbar! And it bounces to safety!',
  ]),
  ...lines('POST', 'WRY', 6, [
    'The post has had a busier evening than either goalkeeper.',
    '{player} finds the frame of the goal for the second time. He may prefer the net.',
  ]),
  ...lines('POST', 'NEUTRAL', 8, [
    '{player} strikes the upright.',
    'Off the bar and away. Nothing given.',
  ]),

  /* -------------------------------------------------------------- BLOCK */
  ...lines('BLOCK', 'NEUTRAL', 10, [
    'Blocked. Brave defending.',
    '{player} throws himself in front of it.',
    'Charged down at the last moment.',
  ]),
  ...lines('BLOCK', 'HYPE', 8, [
    'BLOCKED! {player} has put his whole body in the way!',
    'What a block! That is worth as much as a goal!',
  ]),
  ...lines('BLOCK', 'DRAMATIC', 5, [
    'A block that says everything about what this fixture means.',
  ]),

  /* ------------------------------------------------------------- TACKLE */
  ...lines('TACKLE', 'NEUTRAL', 10, [
    'Excellent tackle by {player}. All ball.',
    '{player} wins it back cleanly.',
    'Dispossessed. {player} times it perfectly.',
    'Strong in the challenge, {player}.',
  ]),
  ...lines('TACKLE', 'HYPE', 7, [
    'THAT is a tackle! {player} takes ball, man and half the advertising hoarding!',
    '{player} with an absolutely thunderous challenge and the crowd loves it!',
  ]),
  ...lines('TACKLE', 'CRITICAL', 5, [
    '{player} got there, but he was late and he was lucky.',
  ]),
  ...lines('TACKLE', 'WRY', 5, [
    '{player} wins the ball and then, regrettably, keeps going.',
  ]),

  /* -------------------------------------------------------- INTERCEPTION */
  ...lines('INTERCEPTION', 'NEUTRAL', 10, [
    'Read beautifully by {player}. Intercepted.',
    '{player} steps in front and cuts it out.',
    'Cut out. {player} saw that coming a long way off.',
  ]),
  ...lines('INTERCEPTION', 'WRY', 6, [
    '{player} intercepts, mostly because the pass was addressed to him.',
  ]),
  ...lines('INTERCEPTION', 'CRITICAL', 6, [
    'A careless ball, and {player} punishes it.',
    'That is a terrible pass, intercepted before it travelled ten yards.',
  ]),

  /* --------------------------------------------------------------- FOUL */
  ...lines('FOUL', 'NEUTRAL', 10, [
    'Free kick. {player} caught his man.',
    'Whistle goes. Foul by {player}.',
    'A clumsy one from {player}.',
    'Pulled back by {player}. No argument.',
  ]),
  ...lines('FOUL', 'CRITICAL', 7, [
    '{player} is going to get himself into trouble here.',
    'That is needless from {player}. Nowhere near the goal, no danger at all.',
    'A cynical one. {player} knew exactly what he was doing.',
  ]),
  ...lines('FOUL', 'WRY', 5, [
    '{player} appeals for the free kick he has just conceded. Bold.',
  ]),

  /* -------------------------------------------------------- YELLOW_CARD */
  ...lines('YELLOW_CARD', 'NEUTRAL', 10, [
    'Yellow card for {player}.',
    'Booked. {player} goes into the book at {minute} minutes.',
    'That is a caution for {player}, and it was coming.',
  ]),
  ...lines('YELLOW_CARD', 'CRITICAL', 8, [
    '{player} is booked and he has only himself to blame.',
    'Reckless from {player}. He is one bad decision from an early bath.',
    'A yellow for dissent. {player} has to be smarter than that.',
  ]),
  ...lines('YELLOW_CARD', 'DRAMATIC', 5, [
    '{player} is booked, and {club} will now play the rest of this on a knife edge.',
  ]),
  ...lines('YELLOW_CARD', 'WRY', 5, [
    '{player} is booked for the tackle. He is lucky he was not booked for the celebration of the tackle.',
  ]),

  /* ----------------------------------------------------------- RED_CARD */
  ...lines('RED_CARD', 'DRAMATIC', 10, [
    'Red card! {player} is off, and {club} are down to six!',
    'He is sent off. {player} walks, and this match has changed completely.',
    'A second yellow and the inevitable red. {player} has cost his side everything.',
    'Straight red for {player}. There can be no complaints and there will be plenty.',
  ]),
  ...lines('RED_CARD', 'CRITICAL', 8, [
    'Indefensible from {player}. He has let his team down entirely.',
    'A red card that was visible five minutes ago to everyone except {player}.',
  ]),

  /* --------------------------------------------------- PENALTY_AWARDED */
  ...lines('PENALTY_AWARDED', 'DRAMATIC', 10, [
    'Penalty! And the {club} supporters are already celebrating!',
    'He points to the spot. {player} was brought down and it is a penalty.',
    'The whistle. The arm. The spot. {club} have a penalty at {minute} minutes.',
  ]),
  ...lines('PENALTY_AWARDED', 'CRITICAL', 7, [
    'That is soft. {player} felt contact and made the most of every ounce of it.',
    'A penalty, and {opponent} are surrounding the referee. They have a case.',
  ]),

  /* ---------------------------------------------------- PENALTY_SCORED */
  ...lines('PENALTY_SCORED', 'HYPE', 10, [
    'Buried! {player} never looked like missing!',
    'Straight down the middle and {player} makes it {score}!',
    '{player} sends him the wrong way. Ice cold.',
  ]),
  ...lines('PENALTY_SCORED', 'NEUTRAL', 8, [
    'Scored. {player} converts from the spot. {score}.',
    'Into the bottom corner. {player} does the job.',
  ]),

  /* ---------------------------------------------------- PENALTY_MISSED */
  ...lines('PENALTY_MISSED', 'DRAMATIC', 10, [
    'SAVED! The keeper has saved the penalty and {player} is on his knees!',
    'Missed! {player} has put it over the bar and the ground cannot believe it!',
    'Off the post and away. {player} has spurned it.',
  ]),
  ...lines('PENALTY_MISSED', 'CRITICAL', 7, [
    'A dreadful penalty from {player}. No pace, no placement, no excuse.',
    '{player} changed his mind halfway through the run-up. You cannot do that.',
  ]),

  /* ------------------------------------------------------------- CORNER */
  ...lines('CORNER', 'NEUTRAL', 10, [
    'Corner to {club}.',
    'It deflects behind. {club} have a corner.',
    'Everybody up for this one.',
  ]),
  ...lines('CORNER', 'WRY', 6, [
    'Another corner, and {club} have not threatened from one all evening.',
  ]),
  ...lines('CORNER', 'HYPE', 6, [
    'The keeper is coming up! Everything on this one!',
  ]),

  /* --------------------------------------------------------- FREE_KICK */
  ...lines('FREE_KICK', 'NEUTRAL', 10, [
    'Free kick in a dangerous area for {club}.',
    '{player} stands over it.',
    'The wall is set. This is a real opportunity.',
  ]),
  ...lines('FREE_KICK', 'HYPE', 7, [
    '{player} is going to have a go from here and he is very good at this!',
  ]),
  ...lines('FREE_KICK', 'WRY', 5, [
    'Three players standing over it, which usually means none of them wants it.',
  ]),

  /* ----------------------------------------------------------- OFFSIDE */
  ...lines('OFFSIDE', 'NEUTRAL', 10, [
    'Flag is up. {player} was offside.',
    'Offside, and the celebration is cut short.',
    'Marginal, but the flag has gone up against {player}.',
  ]),
  ...lines('OFFSIDE', 'CRITICAL', 6, [
    '{player} was two yards off. That is careless.',
  ]),
  ...lines('OFFSIDE', 'WRY', 6, [
    'Offside. {player} has been living in that position all evening and has finally been caught.',
  ]),

  /* ------------------------------------------------------------ INJURY */
  ...lines('INJURY', 'DRAMATIC', 8, [
    '{player} is down and this looks bad. The physio is on immediately.',
    'He is holding the back of his leg. {player} will not continue.',
  ]),
  ...lines('INJURY', 'NEUTRAL', 10, [
    '{player} needs treatment. Play is stopped.',
    '{player} is up and walking. He will try to run it off.',
    'A knock for {player}. The bench are already preparing.',
  ]),

  /* ------------------------------------------------------ SUBSTITUTION */
  ...lines('SUBSTITUTION', 'NEUTRAL', 10, [
    'Change for {club}. {player} comes on.',
    '{player} is introduced with {minute} minutes played.',
    'Fresh legs for {club} as {player} enters.',
  ]),
  ...lines('SUBSTITUTION', 'DRAMATIC', 6, [
    'This is the change the whole ground has been asking for. {player} comes on.',
  ]),
  ...lines('SUBSTITUTION', 'CRITICAL', 5, [
    '{player} comes off and he is not happy about it. Not one bit.',
  ]),
  ...lines('SUBSTITUTION', 'WRY', 5, [
    '{player} takes a very leisurely walk to the touchline. Nobody is fooled.',
  ]),

  /* ---------------------------------------------------- TACTICAL_CHANGE */
  ...lines('TACTICAL_CHANGE', 'NEUTRAL', 10, [
    '{club} have changed shape. They are pushing bodies forward.',
    'A tactical adjustment from the {club} bench.',
    'They have gone to a back two. Bold at {minute} minutes.',
  ]),
  ...lines('TACTICAL_CHANGE', 'DRAMATIC', 6, [
    'This is the moment the manager has decided to gamble the season.',
  ]),
  ...lines('TACTICAL_CHANGE', 'WRY', 5, [
    'A tactical change, which in this case means shouting a different word.',
  ]),

  /* -------------------------------------------------- SPECIAL_RULE_START */
  ...lines('SPECIAL_RULE_START', 'HYPE', 10, [
    'Here we go — the rule is live and everything about this match just changed!',
    'The board is up! {club} have activated it and the ground has gone up a level!',
    'Three minutes of chaos, starting now!',
  ]),
  ...lines('SPECIAL_RULE_START', 'NEUTRAL', 8, [
    'The special rule is now in effect for {club}.',
    'Rule active from minute {minute}.',
  ]),
  ...lines('SPECIAL_RULE_START', 'DRAMATIC', 7, [
    'And now the whole season narrows to the next three minutes.',
  ]),

  /* ---------------------------------------------------- SPECIAL_RULE_END */
  ...lines('SPECIAL_RULE_END', 'NEUTRAL', 10, [
    'And that window closes. Back to normal.',
    'The rule expires. {score}.',
  ]),
  ...lines('SPECIAL_RULE_END', 'WRY', 7, [
    'The window closes with absolutely nothing having happened in it.',
    'Three minutes of pandemonium and the scoreline is exactly where it started.',
  ]),

  /* ----------------------------------------------------- MOMENTUM_SHIFT */
  ...lines('MOMENTUM_SHIFT', 'DRAMATIC', 8, [
    'The whole feel of this match has turned. {club} are all over them now.',
    'You can hear it in the ground. Something has shifted.',
  ]),
  ...lines('MOMENTUM_SHIFT', 'NEUTRAL', 10, [
    '{club} have the ascendancy here.',
    'A real spell of pressure building for {club}.',
    '{opponent} cannot get out. They need a foul or a whistle.',
  ]),

  /* ----------------------------------------------------- CHANCE_CREATED */
  ...lines('CHANCE_CREATED', 'HYPE', 9, [
    'That is a wonderful ball from {player} and the chance is there!',
    '{player} carves them open!',
    'Brilliant from {player} — how is that not a goal?',
  ]),
  ...lines('CHANCE_CREATED', 'NEUTRAL', 10, [
    'Good work from {player} creates an opening.',
    '{player} slides it through. The chance is on.',
    'A big chance for {club}.',
  ]),
  ...lines('CHANCE_CREATED', 'CRITICAL', 6, [
    '{opponent} have left the door wide open there.',
    'That is far too easy. Straight through the middle of them.',
  ]),

  /* ----------------------------------------------------- CREATOR_MOMENT */
  ...lines('CREATOR_MOMENT', 'HYPE', 10, [
    '{creator} is on his feet and that clip is going everywhere tonight!',
    'The camera finds {creator} and the reaction says it all!',
    '{creator} has completely lost it in the stand and who can blame him!',
  ]),
  ...lines('CREATOR_MOMENT', 'WRY', 8, [
    '{creator} has been filming himself for four minutes. The football is over there.',
    '{creator} reacts. That is the thumbnail sorted.',
  ]),
  ...lines('CREATOR_MOMENT', 'DRAMATIC', 6, [
    'A moment {creator} will build an entire week of content around, and rightly so.',
  ]),

  /* -------------------------------------------------------- MATCH_START */
  ...lines('MATCH_START', 'NEUTRAL', 10, [
    'We are under way. {club} against {opponent}.',
    'Good evening, and welcome. {club} host {opponent}.',
    'The teams are out and this ground is full.',
  ]),
  ...lines('MATCH_START', 'DRAMATIC', 8, [
    'Everything both of these clubs have done this season has led here.',
    'The noise as these two walk out tells you what this fixture is.',
  ]),

  /* ----------------------------------------------------------- KICK_OFF */
  ...lines('KICK_OFF', 'NEUTRAL', 10, [
    'And away we go.',
    '{club} get us started.',
    'The whistle goes. Thirty minutes.',
  ]),
  ...lines('KICK_OFF', 'HYPE', 7, [
    'Here we go! Hold on to something!',
  ]),

  /* ----------------------------------------------------------- HALFTIME */
  ...lines('HALFTIME', 'NEUTRAL', 10, [
    'Half time. {score}.',
    'That is the half. Plenty to talk about in both dressing rooms.',
    'The whistle for the interval, {score}.',
  ]),
  ...lines('HALFTIME', 'CRITICAL', 7, [
    'Half time, and that was a poor fifteen minutes by any standard.',
  ]),
  ...lines('HALFTIME', 'DRAMATIC', 6, [
    'Fifteen minutes to decide what kind of season this becomes. Half time, {score}.',
  ]),
  ...lines('HALFTIME', 'WRY', 6, [
    'Half time. If you have just joined us, you have not missed a great deal.',
  ]),

  /* ------------------------------------------------------- PERIOD_START */
  ...lines('PERIOD_START', 'NEUTRAL', 10, [
    'Back under way.',
    'Second half. {score}.',
    'No changes at the break. Straight back into it.',
  ]),

  /* --------------------------------------------------------- PERIOD_END */
  ...lines('PERIOD_END', 'NEUTRAL', 10, [
    'That brings the period to a close.',
    'The whistle sounds to end the period. {score}.',
    'Period over. A breath, and then more of this.',
  ]),

  /* ----------------------------------------------------------- FULLTIME */
  ...lines('FULLTIME', 'NEUTRAL', 10, [
    'Full time. {score}.',
    'That is it. {club} take the points.',
    'The whistle. {score} the final score.',
  ]),
  ...lines('FULLTIME', 'DRAMATIC', 8, [
    'Full time, and this is a result that will be remembered for a long time.',
    'They are on the pitch. Full time, {score}, and {club} have done something extraordinary.',
  ]),
  ...lines('FULLTIME', 'CRITICAL', 6, [
    'Full time, and there will be difficult conversations after that one.',
    'It finishes {score}, and {opponent} were the better side by a distance.',
  ]),
  ...lines('FULLTIME', 'WRY', 6, [
    'Full time. Thirty minutes of our lives, and one of them was quite good.',
  ]),

  /* --------------------------------------------------------------- PASS */
  ...lines('PASS', 'NEUTRAL', 10, [
    '{player} finds the switch.',
    'Neat from {player}.',
    '{player} keeps it moving.',
    'Short to {assist}, and {club} build again from {player}.',
    'The simple ball, taken by {player}. Often the right one.',
    '{player} recycles it backwards while the space is still closed.',
  ]),
  ...lines('PASS', 'HYPE', 6, [
    'Oh, that is a lovely ball from {player}!',
    'Ripped into {assist} feet by {player} — no backlift, no warning!',
    'That is a pass only three players in this league see, and {player} is one of them!',
    'Fifty yards, one bounce, straight to the badge. Wonderful from {player}!',
  ]),
  ...lines('PASS', 'CRITICAL', 6, [
    'Sloppy from {player}. That has to find a shirt.',
    'A loose one from {player}, and it puts everybody under pressure.',
    '{player} tried the brave option when the sensible one was on.',
    'That is twice {player} has overhit the simple pass.',
    'Careless in possession from {club}. {player} will get the blame.',
  ]),
  ...lines('PASS', 'WRY', 4, [
    'Ten passes, none of them risky, all of them {player}\'s idea.',
    '{player} passes it to somebody in more room than him. Civilised.',
    'The crowd wanted it forward. {player} went sideways anyway.',
    'A hospital ball is at least delivered promptly. {player} obliged.',
  ]),

  /* -------------------------------------------------------------- CARRY */
  ...lines('CARRY', 'NEUTRAL', 10, [
    '{player} drives forward.',
    '{player} carries it through midfield.',
    'Space for {player}, and he takes it.',
    '{player} strides out of pressure that had already arrived.',
    'Twenty metres of open grass, and {player} eats it up.',
    '{player} takes a touch and suddenly the pitch opens.',
  ]),
  ...lines('CARRY', 'HYPE', 8, [
    '{player} is off! Nobody can get near him!',
    'Look at this run from {player}!',
    '{player} surges past the first man, then the second — he is flying!',
    'He knocks it into space and simply out-runs all of them!',
    'The {opponent} midfield part like a curtain for {player}!',
    'This is direct. This is {player} at full sprint with the ball glued down!',
  ]),
  ...lines('CARRY', 'WRY', 5, [
    '{player} runs a very long way without actually going anywhere.',
    'He dribbles into the one defender who had stayed home. Bold from {player}.',
    '{player} carries it forward, then carries his breath back.',
    'Three touches, four defenders converging. {player} fancies the hard way.',
    'That run deserved an exit plan, and {player} did not bring one.',
  ]),

  /* -------------------------------------------------------------- CROSS */
  ...lines('CROSS', 'NEUTRAL', 10, [
    '{player} whips it in.',
    'A cross from {player}, cleared at the near post.',
    'Delivered by {player} — and headed away.',
    '{player} swings it toward the far post.',
    'Deep from {player}, and it is punched clear.',
    'Early from {player}, looking for the run in behind.',
  ]),
  ...lines('CROSS', 'HYPE', 8, [
    'What a ball from {player}!',
    'Whipped in by {player} with real venom — anybody\'s touch wins it!',
    'That is a delivery worth a striker\'s fee from {player}!',
    'Flat, fast, and begging to be attacked. Superb from {player}!',
    '{player} puts it exactly where the panic starts!',
  ]),
  ...lines('CROSS', 'CRITICAL', 6, [
    'Poor delivery from {player}. Nobody attacked it because nobody could.',
    'The first defender dealt with that easily. {player} has to do better.',
    'Overhit badly by {player}, out for a goal kick.',
    'That cross needed pace or precision and {player} found neither.',
    'Straight into the keeper\'s arms from {player}. Wasted.',
  ]),
  ...lines('CROSS', 'WRY', 4, [
    '{player} crosses early. Very early. The forwards are still jogging.',
    'A cross so deep it nearly became a throw-in.',
    '{player} aims for the far post and finds a sponsor board.',
    'Somewhere under that flight of the ball, a plan quietly died.',
  ]),

  /* --------------------------------------------------- POSSESSION_CHANGE */
  ...lines('POSSESSION_CHANGE', 'NEUTRAL', 10, [
    '{club} turn it over.',
    'Possession changes hands.',
    'Won back by {club} in a dangerous area.',
  ]),
  ...lines('POSSESSION_CHANGE', 'CRITICAL', 6, [
    'Given away far too cheaply.',
  ]),

  /* ----------------------------------------------------- DECISION_PROMPT */
  ...lines('DECISION_PROMPT', 'DRAMATIC', 10, [
    'The bench are up. A decision is coming.',
    'This is a moment for the manager, right now, at {minute} minutes.',
    'Something has to change here, and the {club} staff know it.',
  ]),

  /* --------------------------------------------------- DECISION_RESOLVED */
  ...lines('DECISION_RESOLVED', 'NEUTRAL', 10, [
    'The instruction goes out and the shape shifts.',
    'The decision is made. Now we find out.',
    'That is the call. It will look brilliant or it will look reckless.',
  ]),
];

export const BASE_COMMENTARY_COUNT = BASE_COMMENTARY.length;
