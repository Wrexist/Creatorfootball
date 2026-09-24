import { BASE_PACK, type ContentPack } from '@cf/engine';

export const MEMBER_LIBRARY_ID = 'creator-club-first-lights';
const lines = [
  ['GOAL', 'The terrace comes alive. {player} has given {club} a moment to keep.'],
  ['SHOT', '{player} spots the opening. The bench leans forward.'],
  ['SAVE', 'A firm hand from the goalkeeper keeps the story unfinished.'],
  ['MISS', 'The chance passes. {player} takes a breath and looks for the next one.'],
  ['POST', 'The post shakes. So does everyone behind it.'],
  ['FOUL', 'The referee stops play. Both benches use the moment to reorganise.'],
  ['YELLOW_CARD', '{player} is booked. The next challenge needs a cooler head.'],
  ['RED_CARD', '{player} leaves the field. The shape of this match has changed.'],
] as const;
const stories = [
  ['MATCH_WON', 'A night for the club journal', '{club} finish ahead of {opponent}, {score}. Beyond the replay, the staff are already discussing what made the difference.'],
  ['MATCH_LOST', 'The chapter after the whistle', '{club} lose to {opponent}, {score}. The club journal keeps the difficult pages too. The response begins on the training ground.'],
  ['MATCH_DRAWN', 'A point and a conversation', '{club} and {opponent} share the points, {score}. Supporters have their own views on what comes next.'],
  ['PLAYER_SIGNED', 'A new face behind the scenes', '{player} arrives at {club} for {fee}. The cameras follow the introduction; the coaches will guide the work.'],
  ['PRESS_CONFERENCE', 'From the media room', '{manager} answers on {topic}: "{quote}". The statement enters the club record, alongside the football.'],
  ['CONTENT_DROP', 'From the club to the community', '{creator} publishes "{title}" with {club}. The release reaches {reach} people and puts another club story into circulation.'],
] as const;
export const MEMBER_LIBRARY: ContentPack = {
  manifest: { id: MEMBER_LIBRARY_ID, name: 'First Lights', description: 'The opening Creator Club issue: eight commentary variations and six club-journal stories.', version: '1.0.0', schemaVersion: 1, kind: 'SEASONAL', provider: 'Creator Football', identityKind: 'FICTIONAL', requires: ['base'], overrides: [], regions: [], createdAt: 1790208000000 },
  data: {
    commentary: lines.map(([eventType, text]) => ({ ...BASE_PACK.data.commentary!.find(x => x.eventType === eventType)!, text })),
    mediaTemplates: stories.map(([trigger, headline, body]) => ({ ...BASE_PACK.data.mediaTemplates!.find(x => x.trigger === trigger)!, headline, body })),
  },
};
/** Append only after the real content has been built and checked. Never prelabel future placeholders as released. */
export const MEMBER_RELEASES = [{ id: MEMBER_LIBRARY_ID, title: 'First Lights', month: '2026-09', commentary: 8, stories: 6 }] as const;
