import { asId } from '../core/brand';
import type { ClubId, MatchId, PlayerId } from '../core/brand';
import type { Rng } from '../core/rng';
import { clamp } from '../core/math';
import type { Attributes } from '../players/attributes';
import { ATTRIBUTE_KEYS, overallFor } from '../players/attributes';
import type { MentalProfile } from '../players/mental';
import { MENTAL_KEYS } from '../players/mental';
import type { Position } from '../players/positions';
import { emptyForm } from '../players/player';
import type { Player } from '../players/player';
import { TRAITS } from '../players/traits';
import { DEFAULT_FORMATION_ID, autoLineup, formationById, formationsFor } from '../tactics/formations';
import type { SpecialRuleId } from './specialRules';
import type { MatchConfig, MatchSetup, MatchTeam } from './simulator';
import { DEFAULT_MATCH_CONFIG, NEUTRAL_MANAGER_BONUS } from './simulator';

/**
 * Deterministic fixtures for the balance tests and the tuning harness.
 *
 * These exist so the aggregate validation runs against squads whose quality is
 * a *known input* rather than whatever the content pack happens to ship. That
 * matters: "a fifteen-point edge wins 60-70%" is only a meaningful assertion if
 * the fifteen points are real. Nothing here is used by the game itself.
 */

const FIRST = ['Renn', 'Kavi', 'Tobi', 'Sable', 'Marek', 'Dovan', 'Isko', 'Halim', 'Bryn', 'Corso',
  'Vessel', 'Nio', 'Ardan', 'Fenn', 'Juro', 'Malik', 'Osei', 'Pavo', 'Quill', 'Rafe',
  'Sava', 'Tero', 'Umar', 'Viggo', 'Wren', 'Yannick', 'Zeno', 'Adeo', 'Bertol', 'Ciro'];
const LAST = ['Varane', 'Okonjo', 'Strand', 'Belliard', 'Ferrow', 'Aldino', 'Kessler', 'Moro',
  'Nkemi', 'Prieto', 'Quintan', 'Rask', 'Solberg', 'Tavares', 'Urbano', 'Vasko', 'Weir',
  'Xanthe', 'Yerlan', 'Zaric', 'Brannon', 'Corvin', 'Delano', 'Eberhart', 'Falk', 'Grieve',
  'Haldor', 'Ivarsen', 'Jorda', 'Kalu'];

const SEVEN_SHAPE: readonly Position[] = ['GK', 'CB', 'CB', 'CM', 'LW', 'RW', 'ST'];
const BENCH_SHAPE: readonly Position[] = ['GK', 'CB', 'CM', 'CM', 'RW', 'ST', 'LW'];

export function makeTestPlayer(
  rng: Rng,
  opts: { id: string; position: Position; target: number; age?: number; traitIds?: readonly string[] },
): Player {
  const spread = 6;
  const raw: Record<string, number> = {};
  for (const key of ATTRIBUTE_KEYS) {
    raw[key] = clamp(rng.normalClamped(opts.target, spread, 12, 96), 12, 96);
  }
  let attributes = raw as Attributes;

  // One correction pass is enough: overall is a weighted mean of these values.
  const drift = opts.target - overallFor(attributes, opts.position);
  const corrected: Record<string, number> = {};
  for (const key of ATTRIBUTE_KEYS) corrected[key] = clamp((attributes[key] ?? 50) + drift, 8, 98);
  attributes = corrected as Attributes;

  const mental: Record<string, number> = {};
  for (const key of MENTAL_KEYS) mental[key] = rng.normalClamped(opts.target * 0.85 + 8, 9, 18, 95);

  const age = opts.age ?? rng.int(19, 32);
  const overall = overallFor(attributes, opts.position);
  const first = rng.pick(FIRST);
  const last = rng.pick(LAST);

  return {
    id: asId<PlayerId>(opts.id),
    identityKind: 'FICTIONAL',
    firstName: first,
    lastName: last,
    displayName: `${first.charAt(0)}. ${last}`,
    shirtNumber: rng.int(1, 30),
    age,
    nationality: 'Astoval',
    position: opts.position,
    secondaryPositions: [],
    footedness: rng.chance(0.75) ? 'right' : 'left',
    height: rng.int(168, 194),
    attributes,
    mental: mental as MentalProfile,
    traitIds: opts.traitIds ? [...opts.traitIds] : rng.chance(0.35) ? [rng.pick(TRAITS).id] : [],
    overall,
    potential: clamp(overall + (age <= 21 ? rng.int(4, 14) : rng.int(0, 3)), 1, 99),
    clubId: null,
    contractId: null,
    fitness: rng.int(88, 100),
    injury: null,
    suspensionMatches: 0,
    form: emptyForm(),
    history: [],
    marketValue: overall * 25000,
    reputation: clamp(overall - 15, 1, 99),
    scouting: { confidence: 1, revealed: [] },
    portraitSeed: opts.id,
  };
}

export function makeTestSquad(
  rng: Rng,
  opts: { prefix: string; target: number; playersOnPitch?: number; benchSize?: number },
): Player[] {
  const onPitch = opts.playersOnPitch ?? 7;
  const benchSize = opts.benchSize ?? 7;
  const shape = onPitch === 7 ? SEVEN_SHAPE : SEVEN_SHAPE;
  const players: Player[] = [];

  for (let i = 0; i < onPitch; i++) {
    players.push(makeTestPlayer(rng, {
      id: `${opts.prefix}_s${i}`,
      position: (shape[i] ?? 'CM') as Position,
      target: clamp(opts.target + rng.normal(0, 3), 20, 95),
    }));
  }
  for (let i = 0; i < benchSize; i++) {
    players.push(makeTestPlayer(rng, {
      id: `${opts.prefix}_b${i}`,
      position: (BENCH_SHAPE[i] ?? 'CM') as Position,
      // Bench players are meaningfully worse; otherwise substitutions are free.
      target: clamp(opts.target - 6 + rng.normal(0, 3), 18, 92),
    }));
  }
  return players;
}

export function makeTestTeam(
  rng: Rng,
  opts: {
    prefix: string; name: string; target: number; formationId?: string;
    creatorPresence?: number; isPlayerControlled?: boolean;
    ruleCards?: readonly SpecialRuleId[]; playersOnPitch?: number;
  },
): MatchTeam {
  // Each team draws from its own derived stream. Generating both squads from
  // one sequential stream couples them, and a coupled fixture makes a fairness
  // measurement impossible to interpret.
  const players = makeTestSquad(rng.fork(`team:${opts.prefix}`), {
    prefix: opts.prefix, target: opts.target, playersOnPitch: opts.playersOnPitch,
  });
  const formation = opts.formationId
    ? formationById(opts.formationId)
    : (formationsFor(opts.playersOnPitch ?? 7)[0] ?? formationById(DEFAULT_FORMATION_ID));
  return {
    clubId: asId<ClubId>(`club_${opts.prefix}`),
    name: opts.name,
    shortName: opts.name,
    players,
    tactics: autoLineup(players, formation),
    managerBonus: NEUTRAL_MANAGER_BONUS,
    creatorPresence: opts.creatorPresence ?? 0,
    ruleCards: opts.ruleCards ?? [],
    isPlayerControlled: opts.isPlayerControlled ?? false,
  };
}

export function makeTestSetup(opts: {
  seed: string;
  home: MatchTeam;
  away: MatchTeam;
  config?: Partial<MatchConfig>;
  importance?: number;
  isDerby?: boolean;
  rivalryIntensity?: number;
  attendance?: number;
  homeAdvantage?: number;
  enabledSpecialRules?: readonly SpecialRuleId[];
  neutralVenue?: boolean;
  tieBreak?: MatchSetup['tieBreak'];
}): MatchSetup {
  return {
    matchId: asId<MatchId>(`m_${opts.seed}`),
    seed: opts.seed,
    home: opts.home,
    away: opts.away,
    config: { ...DEFAULT_MATCH_CONFIG, ...(opts.config ?? {}) },
    importance: opts.importance ?? 3,
    isDerby: opts.isDerby ?? false,
    rivalryIntensity: opts.rivalryIntensity ?? 20,
    attendance: opts.attendance ?? 12000,
    // Zero by default: this competition is played at one neutral venue.
    homeAdvantage: opts.homeAdvantage ?? 0,
    enabledSpecialRules: opts.enabledSpecialRules ?? ['DOUBLE_GOAL', 'NUMBERS_GAME', 'LONG_RANGE', 'SUDDEN_SPARK'],
    neutralVenue: opts.neutralVenue ?? true,
    ...(opts.tieBreak ? { tieBreak: opts.tieBreak } : {}),
  };
}
