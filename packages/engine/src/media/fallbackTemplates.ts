import type { MediaTemplate } from '../content/schema';

/**
 * Built-in media templates.
 *
 * Workstream B owns the real, much larger table in the content pack. This set
 * exists so the media engine is never mute: if a pack is missing, unloaded or
 * simply has no line for a trigger, the world still speaks. Every template here
 * uses only tokens the cascade guarantees for that trigger.
 */
export const FALLBACK_MEDIA_TEMPLATES: readonly MediaTemplate[] = [
  // --- discipline ---
  { id: 'fm_red_1', trigger: 'RED_CARD', headline: '{player} sees red as {club} lose their heads', body: 'A {minute}-minute dismissal leaves {club} a man down and {player} facing a {matches}-match absence. The dressing room will not enjoy the review.', outlets: ['Kickback Daily', 'Matchday Wire'], importance: 4, sentiment: -0.7, weight: 10 },
  { id: 'fm_red_2', trigger: 'RED_CARD', headline: 'Sent off: {player} walks in the {minuteOrdinal}', body: '{club} finished the match short after {player} was dismissed. A {matches}-match ban follows, and the timing could hardly be worse.', outlets: ['The Touchline'], importance: 4, sentiment: -0.6, weight: 8 },
  { id: 'fm_red_3', trigger: 'RED_CARD', headline: 'Discipline questions for {club} after {player} red', body: 'Three officials, one decision, and a {matches}-match suspension. {club} have now handed the initiative away for the second time this run.', outlets: ['Counter Press'], importance: 3, sentiment: -0.5, weight: 6 },
  { id: 'fm_susp_1', trigger: 'SUSPENSION_AFTERMATH', headline: 'Life without {player}: {club} reshuffle', body: 'With {player} unavailable, {club} must find an answer from within. Nobody at the club is pretending it is a small loss.', outlets: ['The Touchline', 'Pitchside Weekly'], importance: 3, sentiment: -0.3, weight: 10 },
  { id: 'fm_susp_2', trigger: 'SUSPENSION_AFTERMATH', headline: 'Ban begins: {player} watches on', body: 'The suspension starts now. {club} will be judged on whether they can hold the line without him.', outlets: ['Matchday Wire'], importance: 3, sentiment: -0.35, weight: 8 },

  // --- transfers ---
  { id: 'fm_marquee_1', trigger: 'MARQUEE_SIGNING', headline: '{club} break the bank for {player}', body: 'A {fee} deal takes {player} to {club} and rewrites what this club is supposed to be. Expectation arrives in the same envelope.', outlets: ['Kickback Daily', 'ClipCity'], importance: 4, sentiment: 0.6, weight: 10 },
  { id: 'fm_marquee_2', trigger: 'MARQUEE_SIGNING', headline: 'Statement of intent: {player} signs for {club}', body: '{fee}, a medical, and a queue outside the club shop. {club} have made the signing of their season.', outlets: ['The Touchline'], importance: 4, sentiment: 0.55, weight: 9 },
  { id: 'fm_marquee_3', trigger: 'MARQUEE_SIGNING', headline: 'Is {player} worth {fee}?', body: 'The fee raises eyebrows as much as pulses. {club} have backed a judgement that the table will settle one way or the other.', outlets: ['Counter Press'], importance: 3, sentiment: 0.05, weight: 7 },
  { id: 'fm_sign_1', trigger: 'SIGNING', headline: '{club} add {player}', body: 'A {fee} move completed without fuss. {club} fill a gap they have been carrying for weeks.', outlets: ['Matchday Wire'], importance: 2, sentiment: 0.3, weight: 10 },
  { id: 'fm_sign_2', trigger: 'SIGNING', headline: 'Done deal: {player} to {club}', body: 'Terms agreed at {fee}. Not a headline signing, but squads are built out of these.', outlets: ['Bootroom Digest'], importance: 2, sentiment: 0.25, weight: 8 },
  { id: 'fm_debut_1', trigger: 'DEBUT_WATCH', headline: 'All eyes on {player} as {club} prepare', body: 'The {fee} is the number nobody will stop mentioning until he settles it on the pitch.', outlets: ['Kickback Daily'], importance: 3, sentiment: 0.15, weight: 10 },
  { id: 'fm_hijack_1', trigger: 'TRANSFER_HIJACK', headline: '{rival} hijack {club} move for {player}', body: 'A deal {club} believed was done has been taken from under them by {rival}. This one will be remembered.', outlets: ['Kickback Daily', 'The Terrace'], importance: 4, sentiment: -0.55, weight: 10 },

  // --- results ---
  { id: 'fm_shock_1', trigger: 'SHOCK_DEFEAT', headline: '{opponent} humiliate {club}, {score}', body: 'A {margin}-goal defeat that nobody at {club} can explain away. The questions start now.', outlets: ['Kickback Daily'], importance: 4, sentiment: -0.8, weight: 10 },
  { id: 'fm_shock_2', trigger: 'SHOCK_DEFEAT', headline: 'Collapse: {club} beaten {score}', body: '{club} were second to everything against {opponent}. A result like this leaves a mark on a season.', outlets: ['The Touchline', 'Matchday Wire'], importance: 4, sentiment: -0.75, weight: 9 },
  { id: 'fm_defeat_1', trigger: 'DEFEAT', headline: '{club} fall {score} at {opponent}', body: 'Another afternoon of not quite enough. {club} will feel this one in the table.', outlets: ['Matchday Wire'], importance: 2, sentiment: -0.4, weight: 10 },
  { id: 'fm_derbyl_1', trigger: 'DERBY_DEFEAT', headline: 'Derby day belongs to {opponent}, {score}', body: 'Bragging rights, gone. {club} lost the fixture that their supporters count twice.', outlets: ['The Terrace', 'Kickback Daily'], importance: 4, sentiment: -0.7, weight: 10 },
  { id: 'fm_win_1', trigger: 'WIN', headline: '{club} see off {opponent}, {score}', body: 'Three points, a clean plan, and a squad that looks like it believes it.', outlets: ['Matchday Wire'], importance: 2, sentiment: 0.5, weight: 10 },
  { id: 'fm_state_1', trigger: 'STATEMENT_WIN', headline: '{club} tear {opponent} apart, {score}', body: 'A {margin}-goal statement. On this evidence {club} are not here to make up numbers.', outlets: ['The Touchline', 'ClipCity'], importance: 3, sentiment: 0.7, weight: 10 },
  { id: 'fm_derbyw_1', trigger: 'DERBY_WIN', headline: '{club} take the derby, {score}', body: 'The city is theirs for a while. {opponent} will have to live with it until the return fixture.', outlets: ['The Terrace'], importance: 4, sentiment: 0.75, weight: 10 },
  { id: 'fm_fallout_1', trigger: 'DEFEAT_FALLOUT', headline: 'Inside the {margin}-goal reckoning at {club}', body: 'Training was long and quiet this week. {club} know exactly how the loss to {opponent} looked from outside.', outlets: ['Counter Press', 'Bootroom Digest'], importance: 3, sentiment: -0.45, weight: 10 },

  // --- players ---
  { id: 'fm_kid_1', trigger: 'WONDERKID', headline: '{player} is the real thing', body: 'At {overall} overall and rising, {club} have something they did not have to buy.', outlets: ['Counter Press', 'ClipCity'], importance: 4, sentiment: 0.65, weight: 10 },
  { id: 'fm_kid_2', trigger: 'WONDERKID', headline: '{club} unearth {player}', body: 'Every academy promises one. {club} appear to have actually produced one.', outlets: ['The Touchline'], importance: 4, sentiment: 0.6, weight: 8 },
  { id: 'fm_interest_1', trigger: 'BREAKOUT_INTEREST', headline: 'Scouts circling {player}', body: 'Word travels fast. {club} may find that keeping him becomes the hard part.', outlets: ['Kickback Daily'], importance: 3, sentiment: -0.05, weight: 10 },
  { id: 'fm_inj_1', trigger: 'INJURY_BLOW', headline: '{player} out for {weeks} weeks', body: 'A {severity} injury robs {club} of a player they cannot simply replace.', outlets: ['Matchday Wire'], importance: 3, sentiment: -0.5, weight: 10 },

  // --- club and fans ---
  { id: 'fm_unrest_1', trigger: 'FAN_UNREST', headline: 'Patience wearing thin at {club}', body: 'Supporters have seen enough of {reason}. The mood around the ground has changed.', outlets: ['The Terrace'], importance: 3, sentiment: -0.55, weight: 10 },
  { id: 'fm_buzz_1', trigger: 'FAN_BUZZ', headline: 'Something is happening at {club}', body: 'After {reason}, the place feels different. Season tickets are moving again.', outlets: ['The Terrace', 'Bootroom Digest'], importance: 3, sentiment: 0.55, weight: 10 },
  { id: 'fm_riv_1', trigger: 'RIVALRY_HEAT', headline: '{club} v {rival} is boiling over', body: '{reason}. Whatever this fixture used to be, it is something angrier now.', outlets: ['Kickback Daily', 'The Terrace'], importance: 3, sentiment: -0.25, weight: 10 },
  { id: 'fm_press_1', trigger: 'MANAGER_PRESSURE', headline: 'Questions for {manager} at {club}', body: 'Nobody has said the word yet. Everybody is thinking it.', outlets: ['Kickback Daily'], importance: 3, sentiment: -0.55, weight: 10 },
  { id: 'fm_crisis_1', trigger: 'MANAGER_CRISIS', headline: '{manager} fighting for the {club} job', body: 'The board have gone quiet, which at this club has only ever meant one thing.', outlets: ['Kickback Daily', 'Matchday Wire'], importance: 5, sentiment: -0.85, weight: 10 },
  { id: 'fm_sack_1', trigger: 'MANAGER_SACKED', headline: '{manager} leaves {club}', body: 'The decision was made after the latest result. {club} begin the search immediately.', outlets: ['Matchday Wire', 'The Touchline'], importance: 5, sentiment: -0.4, weight: 10 },
  { id: 'fm_creator_1', trigger: 'CREATOR_JOINED', headline: '{creator} joins {club} as {role}', body: 'A partnership that will be measured in reach as much as results.', outlets: ['ClipCity'], importance: 3, sentiment: 0.5, weight: 10 },

  // --- history ---
  // Built-in cover for a record with nothing behind it yet. Once the book has a
  // previous holder the authored pack has four better lines for the moment, so
  // this one stands down rather than carrying every record story in the season.
  { id: 'fm_rec_1', trigger: 'RECORD_BROKEN', headline: '{record}: {subject} into the record books', body: 'The number is {value}, and the name against it changed today.', outlets: ['The Touchline', 'Bootroom Digest'], importance: 5, sentiment: 0.85, weight: 10, conditions: { hadPreviousHolder: false } },
  { id: 'fm_rec_3', trigger: 'RECORD_BROKEN', headline: '{record} now reads {value}', body: 'The previous mark has gone. {club} will not mind how it looked.', outlets: ['Bootroom Digest', 'Pitchside Weekly'], importance: 4, sentiment: 0.8, weight: 10, conditions: { hadPreviousHolder: true } },
  { id: 'fm_rec_2', trigger: 'RECORD_REACTION', headline: 'What {player} did still does not feel real', body: 'A week on from {record}, {club} are still being asked about it.', outlets: ['Bootroom Digest'], importance: 3, sentiment: 0.6, weight: 10 },
  { id: 'fm_trophy_1', trigger: 'TROPHY_WON', headline: '{club} win the {competition}', body: 'Champions. Every argument about this squad ends here.', outlets: ['The Touchline', 'Matchday Wire'], importance: 5, sentiment: 0.95, weight: 10 },
  { id: 'fm_trophy_2', trigger: 'TROPHY_AFTERGLOW', headline: 'How {club} won the {competition}', body: 'The long version, told by the people who were in the room.', outlets: ['Counter Press'], importance: 3, sentiment: 0.8, weight: 10 },

  // --- emergent ---
  { id: 'fm_em_derby_1', trigger: 'EMERGENT_DERBY_KING', headline: '{player} owns this fixture', body: '{count} derbies, {count} goals. {club} have a player who turns up when it matters most.', outlets: ['The Terrace', 'ClipCity'], importance: 4, sentiment: 0.7, weight: 10 },
  { id: 'fm_em_cs_1', trigger: 'EMERGENT_CLEAN_SHEET_RUN', headline: '{player} has not been beaten in {count} matches', body: 'A wall in {club} colours. The run is beginning to define their season.', outlets: ['Counter Press'], importance: 3, sentiment: 0.65, weight: 10 },
  { id: 'fm_em_flop_1', trigger: 'EMERGENT_FLOP_SIGNING', headline: 'The {fee} question nobody at {club} wants', body: '{count} appearances in, {player} has not delivered. Patience is not infinite.', outlets: ['Kickback Daily'], importance: 4, sentiment: -0.6, weight: 10 },
  { id: 'fm_em_unbeaten_1', trigger: 'EMERGENT_UNBEATEN_RUN', headline: '{club} unbeaten in {count}', body: 'Nobody has laid a glove on them since the run began. The table is starting to notice.', outlets: ['Matchday Wire', 'Bootroom Digest'], importance: 3, sentiment: 0.7, weight: 10 },
  { id: 'fm_em_boil_1', trigger: 'EMERGENT_RIVALRY_BOILING', headline: '{club} v {rival} has crossed a line', body: 'Intensity at {intensity} and rising. Both clubs have been reminded of their responsibilities.', outlets: ['Kickback Daily'], importance: 4, sentiment: -0.4, weight: 10 },
  { id: 'fm_em_chase_1', trigger: 'EMERGENT_RECORD_CHASE', headline: '{player} one from history', body: 'One more and {record} belongs to him. {club} supporters are counting.', outlets: ['The Touchline'], importance: 4, sentiment: 0.6, weight: 10 },
  { id: 'fm_em_arc_1', trigger: 'EMERGENT_BREAKOUT_ARC', headline: 'The rise of {player}', body: 'Up {count} points of overall this season and still {age}. {club} have a decision coming.', outlets: ['Counter Press', 'ClipCity'], importance: 4, sentiment: 0.7, weight: 10 },
  { id: 'fm_em_winless_1', trigger: 'EMERGENT_WINLESS_RUN', headline: '{count} without a win for {club}', body: 'The performances are not the problem any more. The results are.', outlets: ['Kickback Daily'], importance: 4, sentiment: -0.65, weight: 10 },
  { id: 'fm_em_title_1', trigger: 'EMERGENT_TITLE_RACE', headline: '{club} and {rival} cannot be separated', body: 'Two clubs, one point, and a run-in that will not forgive a single slip.', outlets: ['The Touchline', 'Matchday Wire'], importance: 5, sentiment: 0.3, weight: 10 },
];
