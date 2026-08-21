import type { ClubId, EventId, FixtureId, PlayerId } from '../core/brand';
import type { AnyDomainEvent, EventImportance } from '../core/events';
import type { GameState } from '../game/state';
import { expandCascade } from '../simulation/cascade';
import type { ContentHook, HookFacts, TokenMap } from '../simulation/ports';
import { nextFixture } from '../game/selectors';

/**
 * What there is to talk about.
 *
 * This is the gate that keeps the whole interactive layer honest. The player
 * cannot compose a post, answer a question, run a poll or brief a creator
 * about *nothing* — every one of those actions has to be attached to a moment,
 * and a moment is a real domain event from the journal, expanded through the
 * cascade so it arrives with the same tokens, facts and importance the feed's
 * own reactions were rendered from.
 *
 * The cascade is reused rather than reimplemented deliberately. A second
 * hand-rolled reader of the event log would drift from the first within a
 * fortnight, and the drift would show up as the player posting about a derby
 * the feed had already decided was a friendly.
 */

export interface SocialMoment {
  readonly id: string;
  readonly eventId: EventId;
  readonly trigger: string;
  /** One line, in the player's language: "You beat Verrow Wanderers 4-0." */
  readonly headline: string;
  readonly importance: EventImportance;
  /** -1..1, the world's reading of it before you say anything. */
  readonly sentiment: number;
  readonly tokens: TokenMap;
  readonly facts: HookFacts;
  readonly entities: ContentHook['entities'];
  readonly cycle: number;
  readonly clubId?: ClubId;
  readonly opponentClubId?: ClubId;
  readonly playerId?: PlayerId;
  /** Set on a forward-looking moment: the fixture the talk is about. */
  readonly fixtureId?: FixtureId;
  readonly forward: boolean;
  readonly tags: readonly string[];
}

export interface MomentOptions {
  /** How far back to look. Older than this and nobody wants your take. */
  readonly windowCycles?: number;
  readonly limit?: number;
  /** Restrict to moments involving this club. Defaults to the player's club. */
  readonly clubId?: ClubId;
}

const DEFAULT_WINDOW = 2;
const DEFAULT_LIMIT = 12;

/** Turn a trigger and its tokens into a sentence a person would recognise. */
export function headlineFor(hook: ContentHook, state: GameState): string {
  const t = hook.tokens;
  const club = String(t.club ?? state.clubs[state.playerClubId]?.name ?? 'your club');
  const opponent = t.opponent ? String(t.opponent) : t.rival ? String(t.rival) : null;
  const player = t.player ? String(t.player) : t.scorer ? String(t.scorer) : null;
  const score = t.score ? String(t.score) : null;
  const yours = hook.clubId === state.playerClubId;
  const who = yours ? 'You' : club;

  switch (hook.trigger) {
    case 'WIN': case 'MATCH_WON': case 'STATEMENT_WIN': case 'DERBY_WIN':
      return `${who} beat ${opponent ?? 'them'}${score ? ` ${score}` : ''}.`;
    case 'DEFEAT': case 'MATCH_LOST': case 'SHOCK_DEFEAT': case 'DERBY_DEFEAT': case 'DEFEAT_FALLOUT':
      return `${who} lost to ${opponent ?? 'them'}${score ? ` ${score}` : ''}.`;
    case 'MATCH_DRAWN':
      return `${who} drew with ${opponent ?? 'them'}${score ? ` ${score}` : ''}.`;
    case 'MATCH_SCHEDULED':
      return `${opponent ?? 'The next opponent'} are next.`;
    case 'GOAL': case 'GOAL_SCORED': case 'SPECIAL_GOAL':
      return `${player ?? 'Somebody'} scored${t.minuteOrdinal ? ` in the ${String(t.minuteOrdinal)} minute` : ''}.`;
    case 'RED_CARD': case 'SUSPENSION_AFTERMATH':
      return `${player ?? 'A player'} was sent off.`;
    case 'INJURY_BLOW': case 'PLAYER_INJURED':
      return `${player ?? 'A player'} is injured${t.weeks ? ` for ${String(t.weeks)} weeks` : ''}.`;
    case 'SIGNING': case 'PLAYER_SIGNED': case 'MARQUEE_SIGNING': case 'DEBUT_WATCH':
      return `${player ?? 'A signing'} joined${t.fee ? ` for ${String(t.fee)}` : ''}.`;
    case 'PLAYER_SOLD':
      return `${player ?? 'A player'} was sold${t.buyer ? ` to ${String(t.buyer)}` : ''}.`;
    case 'WONDERKID': case 'PLAYER_BREAKOUT': case 'BREAKOUT_INTEREST':
      return `${player ?? 'A young player'} has broken through.`;
    case 'YOUTH_PROSPECT_PROMOTED':
      return `${player ?? 'An academy player'} is in the first team.`;
    case 'RECORD_BROKEN': case 'RECORD_REACTION':
      return `A club record went: ${String(t.record ?? 'a record')}.`;
    case 'TROPHY_WON': case 'TROPHY_AFTERGLOW':
      return `${who} won the ${String(t.competition ?? 'title')}.`;
    case 'FAN_UNREST':
      return 'The supporters are unhappy.';
    case 'FAN_BUZZ':
      return 'The supporters are buzzing.';
    case 'RIVALRY_HEAT': case 'RIVALRY_CREATED':
      return `Things got warmer with ${opponent ?? 'the rivals'}.`;
    case 'PLAYER_UNHAPPY':
      return `${player ?? 'A player'} is unhappy${t.reason ? `: ${String(t.reason)}` : ''}.`;
    case 'PLAYER_LIFTED':
      return `${player ?? 'A player'} is flying.`;
    case 'MANAGER_PRESSURE': case 'MANAGER_CRISIS':
      return 'Your job is being discussed in public.';
    case 'CONTRACT_SIGNED':
      return `${player ?? 'A player'} signed a new deal.`;
    case 'CONTRACT_EXPIRING':
      return `${player ?? 'A player'} is running his deal down.`;
    case 'SPONSOR_SIGNED':
      return `A commercial deal was signed${t.sponsor ? ` with ${String(t.sponsor)}` : ''}.`;
    case 'SPONSOR_LOST':
      return 'A sponsor walked away.';
    case 'TRANSFER_HIJACK':
      return `${opponent ?? 'A rival'} went over the top of a deal.`;
    case 'CREATOR_JOINED':
      return `${t.creator ? String(t.creator) : 'A creator'} joined the club.`;
    case 'CREATOR_MOMENT':
      return `${t.creator ? String(t.creator) : 'A creator'} made something that travelled.`;
    case 'MOTM_AWARDED':
      return `${player ?? 'A player'} was the best on the pitch.`;
    case 'ATTENDANCE_RECORDED':
      return t.attendance ? `${String(t.attendance)} came through the gates.` : 'The gate was recorded.';
    case 'FACILITY_UPGRADED':
      return `The ${String(t.facility ?? 'ground')} work is finished.`;
    case 'SEASON_STARTED':
      return 'A new season starts.';
    case 'SEASON_COMPLETED':
      return 'The season is over.';
    case 'BALANCE_LOW':
      return 'The money is getting tight.';
    default:
      return hook.trigger.replace(/_/g, ' ').toLowerCase();
  }
}

/**
 * Events from the recent journal worth expanding.
 *
 * Filtering here rather than after the cascade keeps the work proportional to
 * the window rather than to the whole retained log.
 */
function recentEvents(state: GameState, window: number, clubId: ClubId): AnyDomainEvent[] {
  const floor = state.clock.cycle - window;
  const out: AnyDomainEvent[] = [];
  for (const event of state.eventLog) {
    if (event.cycle < floor) continue;
    // Derived cascade events are already represented by their parent's hook.
    if (String(event.id).includes('~')) continue;
    const involved = event.entities.some((e) => e.kind === 'club' && e.id === clubId)
      || Object.values(event.payload as Record<string, unknown>).includes(clubId);
    if (!involved) continue;
    out.push(event);
  }
  return out;
}

/**
 * Everything the player could credibly say something about right now.
 *
 * Ordered by how much the moment is worth talking about: importance first,
 * then how recent it is, then strength of feeling. A forward-looking moment —
 * the fixture that has not been played — is deliberately promoted, because it
 * is the only one where talking carries a risk.
 */
export function socialMoments(state: GameState, opts: MomentOptions = {}): SocialMoment[] {
  const clubId = opts.clubId ?? state.playerClubId;
  const window = opts.windowCycles ?? DEFAULT_WINDOW;
  const limit = opts.limit ?? DEFAULT_LIMIT;
  const cycle = state.clock.cycle;

  const events = recentEvents(state, window, clubId);
  if (events.length === 0) return [];

  const cascade = expandCascade(events, state, { cycle, skipFollowUps: true });
  const upcoming = nextFixture(state, clubId);

  const best = new Map<string, ContentHook>();
  for (const hook of cascade.socialHooks) {
    const key = String(hook.sourceEventId);
    const held = best.get(key);
    if (!held || hook.importance > held.importance || (hook.importance === held.importance && hook.depth < held.depth)) {
      best.set(key, hook);
    }
  }

  const byId = new Map(events.map((e) => [String(e.id), e] as const));
  const moments: SocialMoment[] = [];
  for (const [eventId, hook] of best) {
    const event = byId.get(eventId);
    if (!event) continue;
    const forward = hook.trigger === 'MATCH_SCHEDULED';
    const fixtureMatches = forward && upcoming
      && (upcoming.homeClubId === hook.clubId || upcoming.awayClubId === hook.clubId);
    moments.push({
      id: `mo_${eventId}`.toLowerCase(),
      eventId: event.id,
      trigger: hook.trigger,
      headline: headlineFor(hook, state),
      importance: hook.importance,
      sentiment: hook.sentiment,
      tokens: hook.tokens,
      facts: hook.facts,
      entities: hook.entities,
      cycle: event.cycle,
      ...(hook.clubId ? { clubId: hook.clubId } : {}),
      ...(hook.opponentClubId ? { opponentClubId: hook.opponentClubId } : {}),
      ...(hook.playerId ? { playerId: hook.playerId } : {}),
      ...(fixtureMatches && upcoming ? { fixtureId: upcoming.id } : {}),
      forward,
      tags: hook.tags,
    });
  }

  return moments
    .sort((a, b) => {
      if (a.forward !== b.forward) return a.forward ? -1 : 1;
      return b.importance - a.importance
        || b.cycle - a.cycle
        || Math.abs(b.sentiment) - Math.abs(a.sentiment)
        || (a.id < b.id ? -1 : 1);
    })
    .slice(0, limit);
}

/** One moment by id, for an action that names the thing it is about. */
export const momentById = (state: GameState, id: string, opts: MomentOptions = {}): SocialMoment | null =>
  socialMoments(state, { ...opts, limit: 64 }).find((m) => m.id === id) ?? null;

/** Convert a moment back into a hook the rendering layer can consume. */
export function hookFromMoment(moment: SocialMoment, extra: Partial<ContentHook> = {}): ContentHook {
  return {
    trigger: extra.trigger ?? moment.trigger,
    sourceEventId: moment.eventId,
    rootEventId: moment.eventId,
    depth: 0,
    importance: extra.importance ?? moment.importance,
    sentiment: extra.sentiment ?? moment.sentiment,
    tokens: { ...moment.tokens, ...(extra.tokens ?? {}) },
    facts: { ...moment.facts, ...(extra.facts ?? {}) },
    entities: extra.entities ?? moment.entities,
    ...(moment.clubId ? { clubId: moment.clubId } : {}),
    ...(moment.opponentClubId ? { opponentClubId: moment.opponentClubId } : {}),
    ...(moment.playerId ? { playerId: moment.playerId } : {}),
    audiences: extra.audiences ?? ['FAN', 'CREATOR', 'MEDIA'],
    tags: extra.tags ?? moment.tags,
    cycle: extra.cycle ?? moment.cycle,
  };
}
