import type { Rng } from '../core/rng';
import type { CommentaryLine } from '../content/schema';
import { MATCH_EVENT_TYPES, type MatchEventType } from './events';

/**
 * Commentary.
 *
 * Every line the player reads on the match feed comes from this table. Three
 * rules govern it:
 *
 * 1. **Broadcast voice.** Short, present tense, specific. A commentator says
 *    what he sees; he does not narrate statistics.
 * 2. **Never repeat inside one match while an alternative exists.** Repetition
 *    is the single fastest way to make a simulated match feel simulated, so the
 *    selector tracks what it has already used per event type and only recycles
 *    once the pool for that type is exhausted.
 * 3. **No real names, ever.** Every proper noun in a line arrives through a
 *    token. There is not one hard-coded person, club, competition or
 *    broadcaster anywhere in this file, and there must never be.
 *
 * Tokens: {player} {club} {opponent} {minute} {score} {assist}
 *
 * `tags` are variant filters. A GOAL line tagged `header` is only eligible for
 * a headed goal; an untagged line is eligible for anything. That is what lets
 * the same table cover a tap-in and a thirty-yard screamer without either
 * sounding wrong.
 */

export const COMMENTARY_TONES = ['HYPE', 'DRAMATIC', 'ANALYTICAL', 'WRY', 'NEUTRAL'] as const;
export type CommentaryTone = (typeof COMMENTARY_TONES)[number];

export interface CommentaryTemplate {
  readonly id: string;
  readonly event: MatchEventType;
  readonly tone: CommentaryTone;
  readonly text: string;
  /** Variant filters. Untagged lines are eligible for every variant. */
  readonly tags?: readonly string[];
  readonly weight?: number;
}

export interface CommentaryContext {
  readonly player?: string;
  readonly club?: string;
  readonly opponent?: string;
  readonly minute?: number;
  readonly score?: string;
  readonly assist?: string;
  readonly rule?: string;
  readonly detail?: string;
}

const t = (
  id: string,
  event: MatchEventType,
  tone: CommentaryTone,
  text: string,
  tags?: readonly string[],
): CommentaryTemplate => (tags ? { id, event, tone, text, tags } : { id, event, tone, text });

export const COMMENTARY_TEMPLATES: readonly CommentaryTemplate[] = [
  // ------------------------------------------------------------- openings ---
  t('start1', 'MATCH_START', 'HYPE', "{club} against {opponent}. Thirty minutes. Let's go."),
  t('start2', 'MATCH_START', 'NEUTRAL', "Teams are out. {club} in front of us, {opponent} at the far end."),
  t('start3', 'MATCH_START', 'DRAMATIC', "The lights are up, the arena is full, and nobody here is sitting down."),
  t('start4', 'MATCH_START', 'ANALYTICAL', "Two very different shapes tonight. This one is about who imposes theirs first."),
  t('start5', 'MATCH_START', 'WRY', "Somebody is going to have a very long night. Let's find out who."),
  t('kick1', 'KICK_OFF', 'NEUTRAL', "And we're away."),
  t('kick2', 'KICK_OFF', 'HYPE', "Here we go! {club} get us started."),
  t('kick3', 'KICK_OFF', 'NEUTRAL', "{club} roll it forward and this is under way."),
  t('kick4', 'KICK_OFF', 'DRAMATIC', "Whistle goes. Thirty minutes that decide everything."),
  t('per1', 'PERIOD_START', 'NEUTRAL', "Second half. {score}."),
  t('per2', 'PERIOD_START', 'HYPE', "Back out they come — and {club} look like they've been told something."),
  t('per3', 'PERIOD_START', 'ANALYTICAL', "Same shape, higher line. Somebody's had a word."),
  t('per4', 'PERIOD_START', 'DRAMATIC', "Fifteen minutes left of this. {score}."),

  // ----------------------------------------------------------------- goals ---
  t('goal1', 'GOAL', 'HYPE', "GOAL! {player} buries it! {club} lead the celebration, {score}."),
  t('goal2', 'GOAL', 'HYPE', "{player}! Oh, that is emphatic! {score}."),
  t('goal3', 'GOAL', 'DRAMATIC', "It's there! {player} finds the corner and this arena has lost its mind. {score}."),
  t('goal4', 'GOAL', 'NEUTRAL', "{player} scores for {club}. {score} on {minute} minutes."),
  t('goal5', 'GOAL', 'ANALYTICAL', "Textbook. {assist} draws the defender, {player} takes the space. {score}."),
  t('goal6', 'GOAL', 'HYPE', "GET IN! {player} with the finish and {club} are in front of the whole building. {score}."),
  t('goal7', 'GOAL', 'WRY', "{player} scores, and the {opponent} bench suddenly finds the floor very interesting. {score}."),
  t('goal8', 'GOAL', 'DRAMATIC', "{player}. {minute} minutes. {score}. He will remember that one."),
  t('goal9', 'GOAL', 'ANALYTICAL', "Three passes from turnover to net. That is exactly what {club} drill."),
  t('goal10', 'GOAL', 'HYPE', "He's done it again! {player} makes it {score} and he is unplayable tonight."),
  t('goal11', 'GOAL', 'NEUTRAL', "Assisted by {assist}, finished by {player}. {score}."),
  t('goal12', 'GOAL', 'DRAMATIC', "Everything about this match just changed. {player} scores. {score}."),
  t('goal13', 'GOAL', 'WRY', "Well, the keeper will want a word with somebody about that. {player}, {score}."),
  t('goal14', 'GOAL', 'HYPE', "{club}! {player}! The place is bouncing! {score}!"),
  t('goal15', 'GOAL', 'ANALYTICAL', "Perfect weight from {assist}. All {player} had to do was arrive, and he did."),
  t('goal16', 'GOAL', 'HYPE', "SCREAMER! {player} from distance and that never looked like missing! {score}.", ['longRange']),
  t('goal17', 'GOAL', 'DRAMATIC', "From nowhere! {player} lets fly and it flies in off the underside! {score}.", ['longRange']),
  t('goal18', 'GOAL', 'ANALYTICAL', "Nobody closed him down. Give {player} that much room from there and it's a goal.", ['longRange']),
  t('goal19', 'GOAL', 'HYPE', "He rises! {player} attacks the delivery and heads {club} in front! {score}.", ['header']),
  t('goal20', 'GOAL', 'NEUTRAL', "{assist} floats it, {player} heads home. {score}.", ['header']),
  t('goal21', 'GOAL', 'WRY', "Simplest finish he'll ever have. {player} taps in and takes the applause anyway. {score}.", ['tapIn']),
  t('goal22', 'GOAL', 'NEUTRAL', "Rolled across, and {player} cannot miss. {score}.", ['tapIn']),
  t('goal23', 'GOAL', 'DRAMATIC', "EQUALISER! {player}! {club} are level and this is a different match! {score}.", ['equaliser']),
  t('goal24', 'GOAL', 'HYPE', "They're back in it! {player} makes it {score} and the noise is unreal!", ['equaliser']),
  t('goal25', 'GOAL', 'DRAMATIC', "In front! {player} turns this on its head. {score}.", ['leadTaken']),
  t('goal26', 'GOAL', 'HYPE', "{player} puts {club} ahead! {score}! What a time for it!", ['leadTaken']),
  t('goal27', 'GOAL', 'DRAMATIC', "On {minute} minutes! {player}! You cannot script this! {score}.", ['late']),
  t('goal28', 'GOAL', 'HYPE', "LATE! LATE! {player} with the last kick that matters! {score}.", ['late']),
  t('goal29', 'GOAL', 'ANALYTICAL', "{opponent} pushed everybody up and {club} punished it in four seconds. {score}.", ['counter']),
  t('goal30', 'GOAL', 'HYPE', "Breakaway, and {player} finishes it off! That is a knockout blow! {score}.", ['counter']),
  t('goal31', 'GOAL', 'WRY', "That's the thing about a high line. {player} says thank you. {score}.", ['counter']),
  t('goal32', 'GOAL', 'DRAMATIC', "And it counts double. {player} may have just won this on his own. {score}.", ['doubled']),
  t('goal33', 'GOAL', 'HYPE', "Double! DOUBLE! {player} scores in the window and {club} go {score}!", ['doubled']),
  t('goal34', 'GOAL', 'NEUTRAL', "Set piece, first contact, {player}. {score}.", ['setPiece']),
  t('goal35', 'GOAL', 'ANALYTICAL', "Routine off the training ground. {assist} delivers, {player} attacks it. {score}.", ['setPiece']),

  // ---------------------------------------------------------------- shots ---
  t('shot1', 'SHOT', 'NEUTRAL', "{player} shoots."),
  t('shot2', 'SHOT', 'HYPE', "{player} has a go!"),
  t('shot3', 'SHOT', 'DRAMATIC', "{player} pulls the trigger!"),
  t('shot4', 'SHOT', 'ANALYTICAL', "{player} takes it early — half a yard was all he wanted."),
  t('shot5', 'SHOT', 'NEUTRAL', "Worked into space for {player}, and he lets go."),
  t('shot6', 'SHOT', 'WRY', "{player} fancies it from there. Bold."),
  t('miss1', 'MISS', 'NEUTRAL', "Wide. {player} drags it past the far post."),
  t('miss2', 'MISS', 'DRAMATIC', "How has that stayed out?! {player} cannot believe it!"),
  t('miss3', 'MISS', 'WRY', "{player} has put that into the third row. Somewhere, a coach is aging."),
  t('miss4', 'MISS', 'ANALYTICAL', "Leaned back on it. All the power, none of the placement."),
  t('miss5', 'MISS', 'HYPE', "So close! Inches away from {player}!"),
  t('miss6', 'MISS', 'NEUTRAL', "Over the bar from {player}."),
  t('miss7', 'MISS', 'DRAMATIC', "He'll see that one tonight. {player} had the goal at his mercy.", ['big']),
  t('miss8', 'MISS', 'WRY', "That was easier to score. Genuinely.", ['big']),
  t('miss9', 'MISS', 'ANALYTICAL', "Big chance, and the finish never matched the build-up.", ['big']),
  t('save1', 'SAVE', 'HYPE', "SAVED! What a stop from {player}!"),
  t('save2', 'SAVE', 'DRAMATIC', "{player} throws a glove at it and somehow keeps it out!"),
  t('save3', 'SAVE', 'NEUTRAL', "Straight at {player}, and he holds it."),
  t('save4', 'SAVE', 'ANALYTICAL', "Set early, hands strong. That is textbook goalkeeping from {player}."),
  t('save5', 'SAVE', 'HYPE', "{player} is keeping {club} in this on his own!"),
  t('save6', 'SAVE', 'WRY', "The keeper's had nothing to do all night, and then that."),
  t('save7', 'SAVE', 'DRAMATIC', "Point blank! {player} refuses to be beaten!", ['big']),
  t('post1', 'POST', 'DRAMATIC', "OFF THE POST! {player} is inches from it!"),
  t('post2', 'POST', 'HYPE', "The woodwork! It rattles and stays out!"),
  t('post3', 'POST', 'WRY', "Frame of the goal, one. {player}, nil."),
  t('post4', 'POST', 'NEUTRAL', "{player} strikes the bar and it bounces clear."),
  t('block1', 'BLOCK', 'NEUTRAL', "Blocked. {player} gets a body behind it."),
  t('block2', 'BLOCK', 'HYPE', "Brilliant block! {player} throws himself in front of that!"),
  t('block3', 'BLOCK', 'ANALYTICAL', "Front-foot defending. {player} closes the shooting lane before the swing."),
  t('block4', 'BLOCK', 'DRAMATIC', "That is a goal-saving block from {player}!"),
  t('chance1', 'CHANCE_CREATED', 'HYPE', "{player} carves it open!"),
  t('chance2', 'CHANCE_CREATED', 'ANALYTICAL', "{player} finds the pass nobody else on the pitch saw."),
  t('chance3', 'CHANCE_CREATED', 'NEUTRAL', "{player} slips it through for {club}."),
  t('chance4', 'CHANCE_CREATED', 'DRAMATIC', "Here's the opening — {player} has picked the lock!"),
  t('chance5', 'CHANCE_CREATED', 'WRY', "{player} again. He's the only one on this pitch playing forward."),
  t('chance6', 'CHANCE_CREATED', 'HYPE', "In behind! {player} is away and there is nobody with him!", ['throughBall']),
  t('chance7', 'CHANCE_CREATED', 'ANALYTICAL', "That is the ball over the top all night, and {player} has finally been given it.", ['throughBall']),
  t('chance8', 'CHANCE_CREATED', 'DRAMATIC', "The line steps up, {player} steps through it, and it is one against one!", ['throughBall']),
  t('chance9', 'CHANCE_CREATED', 'WRY', "You can play a high line. You just have to be quicker than {player}.", ['throughBall']),
  t('chance10', 'CHANCE_CREATED', 'NEUTRAL', "Straight through the last line for {player}, who has the keeper to beat."),

  // ---------------------------------------------------------- ball battles ---
  t('tackle1', 'TACKLE', 'NEUTRAL', "{player} wins it back."),
  t('tackle2', 'TACKLE', 'HYPE', "Superb challenge from {player}!"),
  t('tackle3', 'TACKLE', 'ANALYTICAL', "Perfectly timed. Ball first, all of it, from {player}."),
  t('tackle4', 'TACKLE', 'DRAMATIC', "{player} arrives like a train and takes everything except the man!"),
  t('tackle5', 'TACKLE', 'WRY', "{player} has decided that's quite enough of that."),
  t('int1', 'INTERCEPTION', 'NEUTRAL', "Read by {player}, and {club} have it."),
  t('int2', 'INTERCEPTION', 'ANALYTICAL', "{player} was moving before the pass was struck. That is anticipation."),
  t('int3', 'INTERCEPTION', 'HYPE', "Intercepted! {player} pounces!"),
  t('int4', 'INTERCEPTION', 'WRY', "Straight to {player}. Generous."),
  t('poss1', 'POSSESSION_CHANGE', 'NEUTRAL', "{club} turn it over."),
  t('poss2', 'POSSESSION_CHANGE', 'ANALYTICAL', "Possession flips, and the shape hasn't caught up yet."),
  t('poss3', 'POSSESSION_CHANGE', 'HYPE', "Won high! {club} are away!", ['high']),
  t('poss4', 'POSSESSION_CHANGE', 'DRAMATIC', "Turnover in a terrible area — and {club} are running!", ['high']),
  t('pass1', 'PASS', 'NEUTRAL', "{player} switches it wide."),
  t('pass2', 'PASS', 'ANALYTICAL', "{player} plays the safe one and keeps the shape."),
  t('pass3', 'PASS', 'HYPE', "Lovely from {player} — first time, no look."),
  t('pass4', 'PASS', 'NEUTRAL', "{player} finds {assist} between the lines."),
  t('pass5', 'PASS', 'WRY', "Sideways. Backwards. Sideways again. {club} are in no hurry."),
  t('carry1', 'CARRY', 'HYPE', "{player} drives at them!"),
  t('carry2', 'CARRY', 'NEUTRAL', "{player} carries it into the half."),
  t('carry3', 'CARRY', 'DRAMATIC', "{player} is through the middle and nobody can get near him!"),
  t('carry4', 'CARRY', 'ANALYTICAL', "{player} eliminates two with one touch. That is why he plays."),
  t('cross1', 'CROSS', 'NEUTRAL', "{player} whips it in."),
  t('cross2', 'CROSS', 'HYPE', "Great ball from {player}!"),
  t('cross3', 'CROSS', 'WRY', "{player} crosses it into the one place nobody was standing."),
  t('cross4', 'CROSS', 'ANALYTICAL', "Cut back rather than the hopeful one. Better idea from {player}."),

  // -------------------------------------------------------------- discipline ---
  t('foul1', 'FOUL', 'NEUTRAL', "Free kick. {player} caught his man."),
  t('foul2', 'FOUL', 'ANALYTICAL', "Cynical, and effective. {player} takes one for the shape."),
  t('foul3', 'FOUL', 'DRAMATIC', "Ooh, that's a big one from {player}!"),
  t('foul4', 'FOUL', 'WRY', "{player} calls it a challenge. Nobody else in the building does."),
  t('foul5', 'FOUL', 'NEUTRAL', "Whistle goes against {club}."),
  t('foul6', 'FOUL', 'HYPE', "Tempers going here! {player} in the middle of it!", ['heated']),
  t('yellow1', 'YELLOW_CARD', 'NEUTRAL', "Booked. {player} goes into the book on {minute} minutes."),
  t('yellow2', 'YELLOW_CARD', 'DRAMATIC', "Yellow! And {player} has to be careful now."),
  t('yellow3', 'YELLOW_CARD', 'WRY', "{player} argues. {player} loses. That's a booking."),
  t('yellow4', 'YELLOW_CARD', 'ANALYTICAL', "He was beaten and he knew it. The card was the cheapest option for {club}."),
  t('yellow5', 'YELLOW_CARD', 'HYPE', "Card comes out! The temperature just went up!"),
  t('red1', 'RED_CARD', 'DRAMATIC', "RED! {player} is off! {club} have to see this out a man short!"),
  t('red2', 'RED_CARD', 'NEUTRAL', "Second yellow, and {player} walks. {club} down to ten men on the pitch."),
  t('red3', 'RED_CARD', 'DRAMATIC', "That is a straight red. {player} cannot argue and he isn't trying to."),
  t('red4', 'RED_CARD', 'WRY', "{player} has had ninety seconds of madness and thirty minutes to think about it."),
  t('red5', 'RED_CARD', 'ANALYTICAL', "Everything about this match changes now. {club} have to reshape completely."),
  t('pen1', 'PENALTY_AWARDED', 'DRAMATIC', "PENALTY! {club} have their chance!"),
  t('pen2', 'PENALTY_AWARDED', 'NEUTRAL', "Given. {player} was brought down and {club} go one-on-one."),
  t('pen3', 'PENALTY_AWARDED', 'HYPE', "One-on-one from the mark! This is the moment!"),
  t('pen4', 'PENALTY_AWARDED', 'WRY', "The defender's protest lasted about as long as his standing leg."),
  t('penScore1', 'PENALTY_SCORED', 'HYPE', "{player} makes no mistake! {score}!"),
  t('penScore2', 'PENALTY_SCORED', 'DRAMATIC', "Ice cold. {player} sends the keeper the wrong way. {score}."),
  t('penScore3', 'PENALTY_SCORED', 'NEUTRAL', "Scored by {player}. {score}."),
  t('penMiss1', 'PENALTY_MISSED', 'DRAMATIC', "SAVED! The keeper wins it! {player} is on his knees!"),
  t('penMiss2', 'PENALTY_MISSED', 'WRY', "{player} has taken that penalty like a man who wanted to be somewhere else."),
  t('penMiss3', 'PENALTY_MISSED', 'HYPE', "He's missed it! What a moment for {opponent}!"),
  t('corner1', 'CORNER', 'NEUTRAL', "Corner to {club}."),
  t('corner2', 'CORNER', 'ANALYTICAL', "Everybody up for this one, keeper included."),
  t('corner3', 'CORNER', 'HYPE', "Big chance to load the box here!"),
  t('fk1', 'FREE_KICK', 'NEUTRAL', "Free kick in a dangerous spot for {club}."),
  t('fk2', 'FREE_KICK', 'HYPE', "{player} stands over it. He'll shoot."),
  t('fk3', 'FREE_KICK', 'ANALYTICAL', "Right on the angle. Delivery is the percentage play here."),
  t('off1', 'OFFSIDE', 'NEUTRAL', "Flag's up. {player} was early."),
  t('off2', 'OFFSIDE', 'WRY', "{player} was offside before the pass, during the pass, and after it."),
  t('off3', 'OFFSIDE', 'ANALYTICAL', "The line steps up and catches him. That is coached."),
  t('off4', 'OFFSIDE', 'DRAMATIC', "It's in the net — but it doesn't count. {player} strayed."),

  // --------------------------------------------------------------- squad ---
  t('inj1', 'INJURY', 'NEUTRAL', "{player} is down and the physio is on."),
  t('inj2', 'INJURY', 'DRAMATIC', "{player} has pulled up. He's holding the back of his leg and this looks bad."),
  t('inj3', 'INJURY', 'ANALYTICAL', "Thirty minutes at that intensity. Something was going to give."),
  t('inj4', 'INJURY', 'WRY', "{player} wants to carry on. His hamstring has other plans."),
  t('inj5', 'INJURY', 'NEUTRAL', "Treatment for {player}, and {club} may have to make a change."),
  t('sub1', 'SUBSTITUTION', 'NEUTRAL', "Change for {club}: {assist} on, {player} off."),
  t('sub2', 'SUBSTITUTION', 'ANALYTICAL', "Fresh legs where {club} were losing the second ball."),
  t('sub3', 'SUBSTITUTION', 'HYPE', "Here comes a change — and the crowd approve!"),
  t('sub4', 'SUBSTITUTION', 'WRY', "{player} comes off at walking pace. Every second counts, apparently."),
  t('sub5', 'SUBSTITUTION', 'DRAMATIC', "This is the move. {assist} is thrown on to change the game."),
  t('tac1', 'TACTICAL_CHANGE', 'ANALYTICAL', "{club} reshape. Higher line, more bodies past the ball."),
  t('tac2', 'TACTICAL_CHANGE', 'NEUTRAL', "Instruction from the touchline and {club} adjust."),
  t('tac3', 'TACTICAL_CHANGE', 'DRAMATIC', "{club} have gone for it. There is no plan B behind this."),
  t('tac4', 'TACTICAL_CHANGE', 'WRY', "A lot of pointing from the bench. We'll see if anybody was watching."),
  t('tac5', 'TACTICAL_CHANGE', 'HYPE', "{club} are turning the dial up!"),
  // The other manager solving you. These are chosen exclusively when the
  // simulator tags an adaptation, so the feed says what actually changed
  // rather than a generic reshuffle line.
  t('adaptPress1', 'TACTICAL_CHANGE', 'ANALYTICAL', "{club} have pushed up. They're pressing that block now, full-backs high, everybody forward.", ['adaptPressHigh']),
  t('adaptPress2', 'TACTICAL_CHANGE', 'NEUTRAL', "{club} have seen enough of the low block. The line goes up and the press goes on.", ['adaptPressHigh']),
  t('adaptPress3', 'TACTICAL_CHANGE', 'WRY', "{club} are done waiting. They've gone wide and high to drag that back line apart.", ['adaptPressHigh']),
  t('adaptLong1', 'TACTICAL_CHANGE', 'ANALYTICAL', "{club} have stopped playing through the press. Straight over the top now, into the space behind.", ['adaptGoLong']),
  t('adaptLong2', 'TACTICAL_CHANGE', 'NEUTRAL', "{club} sit off and go long. They've worked out where the space is.", ['adaptGoLong']),
  t('adaptLong3', 'TACTICAL_CHANGE', 'WRY', "{club} have had a word about that high press. They're inviting it on and hitting the runners.", ['adaptGoLong']),
  t('adaptFlank1', 'TACTICAL_CHANGE', 'ANALYTICAL', "{club} have doubled up on that flank. Every time it goes wide there are two on it.", ['adaptFlank']),
  t('adaptFlank2', 'TACTICAL_CHANGE', 'NEUTRAL', "{club} tuck in and pick up their runners. That side has been closed off.", ['adaptFlank']),
  t('adaptFlank3', 'TACTICAL_CHANGE', 'WRY', "{club} have noticed which side it keeps coming down. Suddenly there's a body on every touch.", ['adaptFlank']),
  t('adaptMiddle1', 'TACTICAL_CHANGE', 'ANALYTICAL', "{club} have packed the middle. Nothing through there now.", ['adaptMiddle']),
  t('adaptMiddle2', 'TACTICAL_CHANGE', 'NEUTRAL', "{club} go man for man in the centre and spread the shape. The ball will have to go round.", ['adaptMiddle']),
  t('adaptMiddle3', 'TACTICAL_CHANGE', 'WRY', "{club} have seen enough of that through the middle. There's a marker on everyone in there.", ['adaptMiddle']),

  // ------------------------------------------------------- format moments ---
  t('rule1', 'SPECIAL_RULE_START', 'HYPE', "Here it comes — {rule}! The closing minutes are live!"),
  t('rule2', 'SPECIAL_RULE_START', 'DRAMATIC', "{rule} is active. Everything that happens now is worth more."),
  t('rule3', 'SPECIAL_RULE_START', 'ANALYTICAL', "{rule}. This rewards whichever side keeps its head, not whichever side runs hardest."),
  t('rule4', 'SPECIAL_RULE_START', 'NEUTRAL', "{rule} begins on {minute} minutes. {score}."),
  t('rule5', 'SPECIAL_RULE_START', 'WRY', "{rule}. Right, everybody forget everything you know about defending."),
  t('ruleEnd1', 'SPECIAL_RULE_END', 'NEUTRAL', "{rule} is over. Back to normal. {score}."),
  t('ruleEnd2', 'SPECIAL_RULE_END', 'DRAMATIC', "And the window closes. {score}. That changed everything."),
  t('ruleEnd3', 'SPECIAL_RULE_END', 'ANALYTICAL', "{club} survived that. Whether they've got legs left is another question."),
  t('ruleEnd4', 'SPECIAL_RULE_END', 'WRY', "{rule} done. Somebody go and check on the goalkeepers."),
  t('mom1', 'MOMENTUM_SHIFT', 'DRAMATIC', "The whole feel of this has turned. {club} have got hold of it."),
  t('mom2', 'MOMENTUM_SHIFT', 'ANALYTICAL', "{club} have found the pressure valve — third man runs, every time."),
  t('mom3', 'MOMENTUM_SHIFT', 'HYPE', "{club} are all over them now!"),
  t('mom4', 'MOMENTUM_SHIFT', 'NEUTRAL', "A spell of sustained pressure from {club}."),
  t('mom5', 'MOMENTUM_SHIFT', 'WRY', "{opponent} have not touched the ball in two minutes and they know it."),
  t('creator1', 'CREATOR_MOMENT', 'HYPE', "The whole end is on its feet — {player} has lifted this place!"),
  t('creator2', 'CREATOR_MOMENT', 'DRAMATIC', "Listen to that. {club} have twelve players tonight."),
  t('creator3', 'CREATOR_MOMENT', 'WRY', "Half this crowd came for that one moment and they've just got it."),
  t('creator4', 'CREATOR_MOMENT', 'NEUTRAL', "A huge reaction in the stands for {player}."),
  t('creator5', 'CREATOR_MOMENT', 'ANALYTICAL', "You can measure this — the press gets ten per cent sharper when it's this loud."),

  // ------------------------------------------------------------ decisions ---
  t('dec1', 'DECISION_PROMPT', 'DRAMATIC', "Big call for the {club} bench, and it has to be now."),
  t('dec2', 'DECISION_PROMPT', 'NEUTRAL', "{club} have a decision to make on {minute} minutes."),
  t('dec3', 'DECISION_PROMPT', 'ANALYTICAL', "This is the moment the match asks a question of the touchline."),
  t('decDone1', 'DECISION_RESOLVED', 'NEUTRAL', "{club} make the call: {detail}."),
  t('decDone2', 'DECISION_RESOLVED', 'DRAMATIC', "They've gone for it — {detail}."),
  t('decDone3', 'DECISION_RESOLVED', 'ANALYTICAL', "{detail}. Sensible, and it costs them somewhere else."),
  t('decDone4', 'DECISION_RESOLVED', 'WRY', "{detail}. Brave. We'll call it brave."),

  // ------------------------------------------------------------- endings ---
  t('half1', 'HALFTIME', 'NEUTRAL', "Half time. {score}."),
  t('half2', 'HALFTIME', 'ANALYTICAL', "{score} at the break, and the numbers say that flatters somebody."),
  t('half3', 'HALFTIME', 'DRAMATIC', "Fifteen minutes gone and we've already had a match. {score}."),
  t('half4', 'HALFTIME', 'WRY', "{score}. Both benches will claim they meant that."),
  t('end1', 'PERIOD_END', 'NEUTRAL', "That's the period. {score}."),
  t('end2', 'PERIOD_END', 'DRAMATIC', "The whistle goes and nobody wants to leave the pitch."),
  t('ft1', 'FULLTIME', 'HYPE', "FULL TIME! {club} take it, {score}!"),
  t('ft2', 'FULLTIME', 'DRAMATIC', "It's over. {score}. {club} have done it."),
  t('ft3', 'FULLTIME', 'NEUTRAL', "Full time: {score}."),
  t('ft4', 'FULLTIME', 'ANALYTICAL', "{score}. On the balance of chances, that is about right."),
  t('ft5', 'FULLTIME', 'WRY', "{score}. Somebody's getting a very quiet coach journey home."),
  t('ft6', 'FULLTIME', 'DRAMATIC', "Honours even at {score}, and neither side will sleep on it.", ['draw']),
  t('ft7', 'FULLTIME', 'NEUTRAL', "It finishes level. {score}.", ['draw']),
  t('ft8', 'FULLTIME', 'HYPE', "They've held on! {club} win it {score}!", ['narrow']),
  t('ft9', 'FULLTIME', 'ANALYTICAL', "Comfortable in the end. {score} does not overstate it.", ['comfortable']),
  t('ft10', 'FULLTIME', 'DRAMATIC', "A hammering. {score}, and {opponent} will want that one deleted.", ['comfortable']),

  // ------------------------------------------------------------- filler ---
  t('com1', 'COMMENTARY', 'ANALYTICAL', "{club} have settled into it now, controlling the middle."),
  t('com2', 'COMMENTARY', 'NEUTRAL', "A quieter spell here on {minute} minutes."),
  t('com3', 'COMMENTARY', 'WRY', "Somebody in this arena is enjoying this more than the two benches."),
  t('com4', 'COMMENTARY', 'HYPE', "End to end! You cannot take your eyes off this!"),
  t('com5', 'COMMENTARY', 'DRAMATIC', "You can feel the next goal coming."),
  t('com6', 'COMMENTARY', 'ANALYTICAL', "{club} are winning the second ball, and that is the whole game right now."),
  t('com7', 'COMMENTARY', 'NEUTRAL', "{score} with {minute} on the clock."),
  t('com8', 'COMMENTARY', 'WRY', "The tempo has dropped. Legs, mostly."),
];

const BY_EVENT = new Map<MatchEventType, CommentaryTemplate[]>();
for (const template of COMMENTARY_TEMPLATES) {
  const list = BY_EVENT.get(template.event) ?? [];
  list.push(template);
  BY_EVENT.set(template.event, list);
}

/**
 * The content schema's tone vocabulary and the live book's differ by exactly
 * one voice: packs author CRITICAL (a cold verdict on a mistake), the match
 * feed expresses that as ANALYTICAL. The mapping is a table rather than an
 * identity function so the disagreement between the two enums is answered in
 * one reviewable place instead of being papered over with a cast.
 */
export const PACK_TONE_TO_LIVE: Readonly<Record<CommentaryLine['tone'], CommentaryTone>> = {
  NEUTRAL: 'NEUTRAL',
  HYPE: 'HYPE',
  DRAMATIC: 'DRAMATIC',
  WRY: 'WRY',
  CRITICAL: 'ANALYTICAL',
};

const PACK_EVENT_TYPES = new Set<string>(MATCH_EVENT_TYPES);

/**
 * Translate schema `CommentaryLine`s into live templates.
 *
 * Two kinds of line are deliberately dropped: ones bound to an event type the
 * engine never emits, and ones carrying `conditions`, because there is no
 * cascade fact source mid-match to evaluate conditions against and playing a
 * gated line unconditionally would lie about the world it describes.
 */
export function packLinesToTemplates(lines: readonly CommentaryLine[]): CommentaryTemplate[] {
  const out: CommentaryTemplate[] = [];
  for (const line of lines) {
    if (!PACK_EVENT_TYPES.has(line.eventType)) continue;
    if (line.conditions && Object.keys(line.conditions).length > 0) continue;
    out.push({
      id: line.id,
      event: line.eventType as MatchEventType,
      tone: PACK_TONE_TO_LIVE[line.tone],
      text: line.text,
      weight: line.weight,
    });
  }
  return out;
}

/** Built-in pools plus pack lines; on an id collision the built-in wins. */
function mergePools(
  base: ReadonlyMap<MatchEventType, CommentaryTemplate[]>,
  extra: readonly CommentaryTemplate[],
): Map<MatchEventType, CommentaryTemplate[]> {
  const merged = new Map<MatchEventType, CommentaryTemplate[]>();
  for (const [event, list] of base) merged.set(event, list.slice());
  const ids = new Set(COMMENTARY_TEMPLATES.map((tpl) => tpl.id));
  for (const tpl of extra) {
    if (ids.has(tpl.id)) continue;
    const list = merged.get(tpl.event) ?? [];
    list.push(tpl);
    merged.set(tpl.event, list);
  }
  return merged;
}

export interface LineOptions {
  /**
   * Restrict the pool to templates carrying one of `tags`, instead of merely
   * preferring them. Used when the line must say a specific football thing —
   * an adaptation the player is meant to notice — and a generic line would
   * quietly hide it.
   */
  readonly exclusive?: boolean;
  /** Variant filters. Templates tagged with any of these are preferred. */
  readonly tags?: readonly string[];
  /** Bias toward a tone without forbidding the others. */
  readonly tone?: CommentaryTone;
}

/**
 * One book per match. It remembers what it has already said so the same line
 * never lands twice in a single game while an unused alternative exists.
 *
 * A book built with registry commentary speaks from the merged bank; without
 * one it falls back to the built-in table, so the engine runs headless with no
 * pack loaded at all.
 */
export class CommentaryBook {
  private used = new Map<MatchEventType, Set<string>>();
  private readonly pools: ReadonlyMap<MatchEventType, CommentaryTemplate[]>;

  constructor(private readonly rng: Rng, pack?: readonly CommentaryLine[]) {
    const extra = packLinesToTemplates(pack ?? []);
    this.pools = extra.length === 0 ? BY_EVENT : mergePools(BY_EVENT, extra);
  }

  line(event: MatchEventType, ctx: CommentaryContext, opts: LineOptions = {}): string {
    const pool = this.pools.get(event);
    if (!pool || pool.length === 0) return fallback(event, ctx);

    const tagged = opts.tags?.length
      ? pool.filter((tpl) =>
        opts.exclusive
          ? Boolean(tpl.tags?.some((tag) => opts.tags?.includes(tag)))
          : !tpl.tags || tpl.tags.some((tag) => opts.tags?.includes(tag)))
      : pool.filter((tpl) => !tpl.tags);
    const candidates = tagged.length > 0 ? tagged : pool;

    let seen = this.used.get(event);
    if (!seen) { seen = new Set(); this.used.set(event, seen); }

    let fresh = candidates.filter((tpl) => !seen?.has(tpl.id));
    if (fresh.length === 0) {
      // Pool exhausted for this event type: forget it and start again rather
      // than going silent. Repetition is only allowed once nothing else is left.
      for (const tpl of candidates) seen.delete(tpl.id);
      fresh = candidates.slice();
    }

    const chosen = this.rng.weighted(fresh, (tpl) => {
      const toneBias = opts.tone && tpl.tone === opts.tone ? 2.5 : 1;
      const tagBias = tpl.tags && opts.tags?.length ? 1.8 : 1;
      return (tpl.weight ?? 1) * toneBias * tagBias;
    });
    seen.add(chosen.id);

    return render(chosen.text, ctx);
  }
}

const TOKEN = /\{(player|club|opponent|minute|score|assist|rule|detail)\}/g;

export function render(text: string, ctx: CommentaryContext): string {
  return text.replace(TOKEN, (_match, key: string) => {
    switch (key) {
      case 'player': return ctx.player ?? 'the striker';
      case 'club': return ctx.club ?? 'the home side';
      case 'opponent': return ctx.opponent ?? 'the visitors';
      case 'minute': return String(ctx.minute ?? 0);
      case 'score': return ctx.score ?? '0-0';
      case 'assist': return ctx.assist ?? 'his team-mate';
      case 'rule': return ctx.rule ?? 'the rule window';
      case 'detail': return ctx.detail ?? 'a change';
      default: return '';
    }
  });
}

const fallback = (event: MatchEventType, ctx: CommentaryContext): string =>
  `${event.replace(/_/g, ' ').toLowerCase()}${ctx.player ? ` — ${ctx.player}` : ''}`;

/** Every distinct line in the book. Used by the content lint and by tests. */
export const COMMENTARY_LINE_COUNT = COMMENTARY_TEMPLATES.length;
