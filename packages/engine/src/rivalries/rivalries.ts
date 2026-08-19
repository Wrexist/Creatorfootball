import type { ClubId } from '../core/brand';
import type { Club } from '../clubs/club';
import type { ClubTemplate } from '../content/schema';
import type { GameState, Rivalry } from '../game/state';
import type { Rng } from '../core/rng';
import { clamp } from '../core/math';
import { RIVALRY_BALANCE as B } from './balance';

/**
 * Rivalries are the world's memory of grudges.
 *
 * A rivalry is seeded from three sources — what the content pack declares,
 * geography (a shared city is always a derby), and league proximity (the club
 * immediately above you in reputation is competing for your oxygen) — and then
 * *earns* its intensity from what actually happens on the pitch. Nothing here
 * is scripted: a proximity rivalry that produces three red cards and two late
 * winners will out-heat a declared derby that keeps ending 0-0.
 */

export type RivalryOrigin = 'DECLARED' | 'CITY' | 'PROXIMITY';

/** Stable key regardless of which club is named first. */
export function rivalryKey(a: ClubId, b: ClubId): string {
  return a < b ? `rv_${a}__${b}` : `rv_${b}__${a}`;
}

const ORIGIN_TEXT: Record<RivalryOrigin, string> = {
  DECLARED: 'A rivalry both sets of supporters were born into.',
  CITY: 'One city, two clubs, no neutrals.',
  PROXIMITY: 'Two clubs chasing the same ceiling.',
};

const baselineFor = (origin: RivalryOrigin): number =>
  (origin === 'CITY' ? B.cityIntensity[0] : origin === 'DECLARED' ? B.declaredIntensity[0] : B.proximityIntensity[0]);

interface SeedPair {
  readonly a: Club;
  readonly b: Club;
  readonly origin: RivalryOrigin;
}

/**
 * Build the rivalry graph for a league. Deterministic given the same clubs,
 * templates and seed. O(n log n) in club count — the proximity pass walks a
 * sorted list rather than every pair.
 */
export function seedRivalries(
  clubs: readonly Club[],
  templates: readonly ClubTemplate[],
  rng: Rng,
): Record<string, Rivalry> {
  const byKey = new Map<string, Club>();
  const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const club of clubs) {
    byKey.set(norm(club.id), club);
    byKey.set(norm(club.name), club);
    byKey.set(norm(club.shortName), club);
    byKey.set(norm(club.abbreviation), club);
  }
  for (const t of templates) {
    const club = byKey.get(norm(t.id)) ?? byKey.get(norm(t.name)) ?? byKey.get(norm(t.shortName));
    if (club) byKey.set(norm(t.id), club);
  }

  const pairs = new Map<string, SeedPair>();
  const add = (a: Club, b: Club, origin: RivalryOrigin): void => {
    if (a.id === b.id) return;
    const key = rivalryKey(a.id, b.id);
    const existing = pairs.get(key);
    // A shared city always wins the origin argument; declared beats proximity.
    if (existing) {
      const rank = { PROXIMITY: 0, DECLARED: 1, CITY: 2 } as const;
      if (rank[origin] <= rank[existing.origin]) return;
    }
    pairs.set(key, { a, b, origin });
  };

  for (const t of templates) {
    const club = byKey.get(norm(t.id));
    if (!club) continue;
    for (const rivalRef of t.rivalOf ?? []) {
      const rival = byKey.get(norm(rivalRef));
      if (rival) add(club, rival, 'DECLARED');
    }
  }

  const byCity = new Map<string, Club[]>();
  for (const club of clubs) {
    const city = norm(club.city);
    const list = byCity.get(city);
    if (list) list.push(club); else byCity.set(city, [club]);
  }
  for (const list of byCity.values()) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        add(list[i] as Club, list[j] as Club, 'CITY');
      }
    }
  }

  const ranked = clubs.slice().sort((x, y) => y.reputation - x.reputation || (x.id < y.id ? -1 : 1));
  for (let i = 0; i + 1 < ranked.length; i++) {
    add(ranked[i] as Club, ranked[i + 1] as Club, 'PROXIMITY');
  }

  const out: Record<string, Rivalry> = {};
  for (const key of [...pairs.keys()].sort()) {
    const pair = pairs.get(key) as SeedPair;
    const band = pair.origin === 'CITY' ? B.cityIntensity
      : pair.origin === 'DECLARED' ? B.declaredIntensity
        : B.proximityIntensity;
    const local = rng.fork(`rivalry:${key}`);
    // Order the pair by id so aWins/bWins never flip meaning across saves.
    const [a, b] = pair.a.id < pair.b.id ? [pair.a, pair.b] : [pair.b, pair.a];
    out[key] = {
      id: key,
      clubAId: a.id,
      clubBId: b.id,
      intensity: Math.round(local.float(band[0], band[1])),
      origin: ORIGIN_TEXT[pair.origin],
      meetings: 0,
      aWins: 0,
      bWins: 0,
      draws: 0,
      incidents: [],
      lastMeetingCycle: null,
    };
  }
  return out;
}

/** Everything about a meeting that can move the needle. */
export interface RivalryMeetingResult {
  readonly cycle: number;
  readonly homeClubId: ClubId;
  readonly awayClubId: ClubId;
  readonly homeScore: number;
  readonly awayScore: number;
  readonly redCards: number;
  readonly yellowCards: number;
  /** A winner after the 80% mark. */
  readonly lateWinner: boolean;
  /** Disputed penalties, brawls, celebrations in front of the wrong end. */
  readonly controversial: boolean;
  /** Stories published about this fixture; media saturation feeds the myth. */
  readonly mediaVolume: number;
  /** 1-5 fixture importance. */
  readonly importance: number;
  readonly incidents: readonly string[];
}

/**
 * Fold a meeting into a rivalry. Pure: returns a new record and never mutates
 * the argument. `rng` adds only a small amount of texture — the bulk of the
 * movement is deterministic from what happened.
 */
export function updateRivalry(r: Rivalry, result: RivalryMeetingResult, rng: Rng): Rivalry {
  const margin = Math.abs(result.homeScore - result.awayScore);
  const importanceScale = 1 + (clamp(result.importance, 1, 5) - 3) * B.importanceScale;

  let delta = B.meetingBump;
  delta += Math.min(B.maxMarginBump, Math.max(0, margin - 1) * B.marginBump);
  if (result.lateWinner) delta += B.lateWinnerBump;
  delta += result.redCards * B.redCardBump;
  delta += Math.max(0, result.yellowCards - 2) * B.yellowBump;
  if (result.controversial) delta += B.controversyBump;
  delta += Math.min(B.maxMediaBump, result.mediaVolume * B.mediaVolumeBump);
  delta *= importanceScale;
  // Texture, not noise: at most ±15% of the earned movement.
  delta *= rng.float(0.85, 1.15);

  const homeIsA = result.homeClubId === r.clubAId;
  const homeWon = result.homeScore > result.awayScore;
  const drawn = result.homeScore === result.awayScore;

  const incidents = [...r.incidents];
  for (const text of result.incidents) {
    incidents.push({ cycle: result.cycle, text, severity: Math.min(5, Math.round(delta / 4) + 1) });
  }
  if (margin >= 4) {
    incidents.push({
      cycle: result.cycle,
      text: `${margin}-goal humiliation, ${result.homeScore}-${result.awayScore}.`,
      severity: 4,
    });
  }

  return {
    ...r,
    intensity: clamp(r.intensity + delta, B.floor, B.ceiling),
    meetings: r.meetings + 1,
    aWins: r.aWins + (drawn ? 0 : homeWon === homeIsA ? 1 : 0),
    bWins: r.bWins + (drawn ? 0 : homeWon === homeIsA ? 0 : 1),
    draws: r.draws + (drawn ? 1 : 0),
    incidents: incidents.slice(-B.maxIncidents),
    lastMeetingCycle: result.cycle,
  };
}

/** Record an off-pitch incident (a transfer hijack, a manager's press jab). */
export function addRivalryIncident(
  r: Rivalry,
  cycle: number,
  text: string,
  severity: number,
): Rivalry {
  return {
    ...r,
    intensity: clamp(r.intensity + severity, B.floor, B.ceiling),
    incidents: [...r.incidents, { cycle, text, severity: clamp(Math.round(severity), 1, 5) }].slice(-B.maxIncidents),
  };
}

/** Slow cool-down for rivalries that have not met recently. */
export function decayRivalry(r: Rivalry, cycle: number): Rivalry {
  const since = r.lastMeetingCycle === null ? cycle : cycle - r.lastMeetingCycle;
  if (since <= B.decayGraceCycles) return r;
  const baseline = r.origin === ORIGIN_TEXT.CITY ? baselineFor('CITY')
    : r.origin === ORIGIN_TEXT.DECLARED ? baselineFor('DECLARED') : baselineFor('PROXIMITY');
  if (r.intensity <= baseline) return r;
  return { ...r, intensity: Math.max(baseline, r.intensity - B.decayPerCycle) };
}

export function rivalryFor(state: GameState, a: ClubId, b: ClubId): Rivalry | null {
  return state.rivalries[rivalryKey(a, b)] ?? null;
}

export function rivalriesOf(state: GameState, clubId: ClubId): Rivalry[] {
  const out: Rivalry[] = [];
  for (const r of Object.values(state.rivalries)) {
    if (r.clubAId === clubId || r.clubBId === clubId) out.push(r);
  }
  return out.sort((x, y) => y.intensity - x.intensity);
}

/** The other club in a rivalry. */
export const rivalOpponent = (r: Rivalry, clubId: ClubId): ClubId =>
  (r.clubAId === clubId ? r.clubBId : r.clubAId);

/** The hottest rivalry a club has, if any. */
export function topRival(state: GameState, clubId: ClubId): Rivalry | null {
  return rivalriesOf(state, clubId)[0] ?? null;
}

export const isDerbyPair = (state: GameState, a: ClubId, b: ClubId): boolean =>
  (rivalryFor(state, a, b)?.intensity ?? 0) >= B.declaredIntensity[0];

// --- derived effects the rest of the simulation reads ---
export const atmosphereBonus = (intensity: number): number => intensity * B.atmospherePerIntensity;
export const pressureMultiplier = (intensity: number): number => 1 + intensity * B.pressurePerIntensity;
export const cardRateMultiplier = (intensity: number): number => 1 + intensity * B.cardRatePerIntensity;
export const fanReactionMultiplier = (intensity: number): number => 1 + intensity * B.fanReactionPerIntensity;

/** Head-to-head summary for the rivalry screen. */
export interface HeadToHead {
  readonly meetings: number;
  readonly wins: number;
  readonly draws: number;
  readonly losses: number;
  readonly lastMeetingCycle: number | null;
  readonly intensity: number;
  readonly notableIncidents: readonly { cycle: number; text: string; severity: number }[];
}

export function headToHead(r: Rivalry, clubId: ClubId): HeadToHead {
  const isA = r.clubAId === clubId;
  return {
    meetings: r.meetings,
    wins: isA ? r.aWins : r.bWins,
    draws: r.draws,
    losses: isA ? r.bWins : r.aWins,
    lastMeetingCycle: r.lastMeetingCycle,
    intensity: r.intensity,
    notableIncidents: r.incidents.slice().sort((x, y) => y.severity - x.severity).slice(0, 5),
  };
}
