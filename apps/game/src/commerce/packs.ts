import { BASE_PACK, type ContentPack, type CommentaryLine } from '@cf/engine';
import { PRODUCTS, type ProductId } from './catalog';

export const FREE_PACK_ID = 'touchline-voices';
const voiceText: Record<string, readonly string[]> = {
  GOAL: ['{player} finds the net! That is one for the {club} archive.', 'Every screen in the {club} end lights up. {player} scores!'],
  SHOT: ['{player} takes the chance to test the goalkeeper.', 'A shooting chance for {player}. The crowd holds its breath.'],
  SAVE: ['The goalkeeper has an answer. That chance is denied.', 'Saved! The supporters behind the goal applaud the reaction.'],
  MISS: ['{player} misses the target. A moment to reset.', 'No goal this time. {player} looks back at the chance.'],
  POST: ['The frame of the goal! The noise carries into the stands.', 'Off the woodwork. A collective gasp around the ground.'],
  FOUL: ['The whistle interrupts play. A foul is given.', 'A free kick, and a moment for both sides to organise.'],
  YELLOW_CARD: ['A booking for {player}. The referee makes the warning clear.', '{player} goes into the book. That changes the margin for error.'],
  RED_CARD: ['{player} is sent off. The bench has a decision to make.', 'A red card for {player}. A difficult walk back to the tunnel.'],
};
// Replace text only. IDs, weights, tones, conditions and ordering are identical,
// so a cosmetic pack cannot change random draws, match rules or media effects.
const commentary = Object.entries(voiceText).flatMap(([eventType, texts]) =>
  (BASE_PACK.data.commentary ?? []).filter(line => line.eventType === eventType).slice(0, 2)
    .map((line, index): CommentaryLine => ({ ...line, text: texts[index]! })),
);
const storyCopy: readonly [string, number, string, string][] = [
  ['MATCH_WON',0,'The {club} journal gets a winning chapter','Final score: {score}. {club} have beaten {opponent}, and the next entry in the season journal begins with three points. The replay is ready; the work behind it belongs to the squad.'],
  ['MATCH_WON',1,'Three points for {club}, a story for the supporters','The fixture is finished: {club} win against {opponent}. A result to share, and a useful reminder that the best club content starts on the pitch.'],
  ['MATCH_LOST',0,'Behind the result: a difficult chapter for {club}','{opponent} have beaten {club}. The score, {score}, goes into the record. There is no edit that changes the points; the response now belongs to the manager and players.'],
  ['MATCH_LOST',1,'The {club} story keeps its difficult pages','A defeat against {opponent} leaves {club} with questions to answer. The cameras can record what happened. Only the next set of decisions can improve what happens next.'],
  ['MATCH_DRAWN',0,'One point, two versions of the story','{club} and {opponent} finish level at {score}. Both clubs leave with a point and their own interpretation of the afternoon. The league table keeps the simpler version.'],
  ['MATCH_DRAWN',1,'The journal records a draw for {club}','The final whistle leaves {club} and {opponent} tied. A shared result, {score}, becomes another chapter in a season still being written.'],
  ['GOAL_SCORED',0,'A new goal for the {player} collection','{player} scores for {club}. Another finish enters the club archive, a moment with a name attached to it and a team behind it.'],
  ['RED_CARD',0,'The moment {club} would rather leave out','{player} has been sent off. It is part of the match story, however uncomfortable the replay, and a decision the club must now manage around.'],
  ['PLAYER_SIGNED',0,'Meet {player}: the next face of the {club} story','{club} have signed {player} for {fee}. The introduction is complete. The more interesting part begins when the new arrival joins the squad and finds a place in its plans.'],
  ['PRESS_CONFERENCE',0,'In their own words: {manager} on {topic}','The club journal records the answer from {manager}: "{quote}". This is what the {club} manager chose to say about {topic}; the next chapter will show how those words meet the football.'],
  ['CONTENT_DROP',0,'{creator} adds a new lens to the {club} story','"{title}" is out. The collaboration between {creator} and {club} has reached {reach} people, carrying a piece of club life beyond the match report.'],
  ['POLL_HONOURED',0,'Supporters help write the next {club} chapter','{club} put {topic} to a vote and followed the supporters\' choice: {choice}. This entry in the club journal belongs to the people who answered.'],
];
const media = storyCopy.map(([trigger,index,headline,body]) => {
  const template = (BASE_PACK.data.mediaTemplates ?? []).filter(t=>t.trigger===trigger)[index];
  if (!template) throw new Error(`Missing base story for ${trigger}`);
  return { ...template, headline, body };
});
function pack(id: string, name: string, description: string, data: ContentPack['data']): ContentPack {
  return { manifest: { id, name, description, version: '1.0.0', schemaVersion: 1, kind: 'SEASONAL',
    provider: 'Creator Football', identityKind: 'FICTIONAL', requires: ['base'], overrides: [], regions: [], createdAt: 1790035200000 }, data };
}
export const FREE_PACK = pack(FREE_PACK_ID, 'Touchline Voices', 'Eight alternate match commentary lines. Included, ready to enable.', {
  commentary: commentary.slice(0, 8).map((line,index) => ({ ...line, text: [
    'Goal! {player} gives the touchline something to shout about.',
    '{club} score through {player}. The bench rises as one.',
    '{player} shoots. A chance to make this spell count.',
    'A shot from {player}. The coaching staff watch its flight.',
    'The keeper stops it. An important intervention.',
    'Saved, and a chance for the defence to regroup.',
    '{player} cannot find the target this time.',
    'The chance goes wide. Back to work for {club}.',
  ][index]! })),
});
export const CREATOR_PACK = pack('creator-stories', 'Creator Stories', '16 alternate commentary lines and 12 club-journal versions of real media events.', { commentary, mediaTemplates: media });
export const EXPANSION_PACKS = [FREE_PACK, CREATOR_PACK] as const;
export function availablePackIds(enabled: readonly string[], owned: readonly ProductId[]): readonly string[] {
  const allowed = new Set([FREE_PACK_ID, ...PRODUCTS.filter(p => owned.includes(p.id)).map(p => p.packId)]);
  return [...new Set(enabled)].filter(id => allowed.has(id));
}
