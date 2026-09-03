import type { Player } from '../players/player';
import type { Position } from '../players/positions';
import { familiarity } from '../players/positions';
import { isAvailable } from '../players/player';
import type { Formation, FormationSlot, TacticSetup } from './tactics';
import { DEFAULT_TACTICS } from './tactics';
import type { PlayerId } from '../core/brand';
import { assignMax } from './assignment';

/**
 * Formation data.
 *
 * Ids are the shape itself: outfield lines back to front, hyphen separated,
 * goalkeeper implied. `'2-3-1'` is two defenders, three midfielders, one
 * forward, plus a keeper. Content, UI and save data all key off that string
 * directly, so it must stay readable and stable — never renumber an existing id.
 *
 * The league's default competition is a 30-minute short format with seven a
 * side (one keeper, six outfielders), so that is where the depth is. Three
 * eleven-a-side shapes ship alongside them purely so nothing downstream — the
 * renderer, `autoLineup`, the AI — can quietly assume a squad size of seven.
 *
 * Coordinates are normalised for the *attacking* team: x = 0 is your own goal
 * line, x = 1 is the opponent's; y = 0 is the left touchline. `positioning.ts`
 * mirrors them for the away side. They are the anchor the renderer eases
 * toward, not a hard position — players drift from here with ball and phase.
 */

const slot = (
  id: string,
  position: Position,
  x: number,
  y: number,
  role: FormationSlot['role'],
): FormationSlot => ({ id, position, x, y, role });

/** Seven-a-side: GK + 6. The competitive default. */
const SEVEN: readonly Formation[] = [
  {
    id: '2-3-1',
    name: '2-3-1 Standard',
    shape: 'BALANCED',
    blurb: 'The reference shape. A flat back two, a working three, one out front.',
    slots: [
      slot('gk', 'GK', 0.05, 0.5, 'GK'),
      slot('dl', 'CB', 0.24, 0.34, 'DEF'),
      slot('dr', 'CB', 0.24, 0.66, 'DEF'),
      slot('ml', 'LW', 0.52, 0.18, 'MID'),
      slot('mc', 'CM', 0.48, 0.5, 'MID'),
      slot('mr', 'RW', 0.52, 0.82, 'MID'),
      slot('st', 'ST', 0.78, 0.5, 'ATT'),
    ],
  },
  {
    id: '3-2-1',
    name: '3-2-1 Pyramid',
    shape: 'DEFENSIVE',
    blurb: 'Three at the back, two to screen. Hard to break down, lonely up top.',
    slots: [
      slot('gk', 'GK', 0.05, 0.5, 'GK'),
      slot('dl', 'LB', 0.22, 0.22, 'DEF'),
      slot('dc', 'CB', 0.18, 0.5, 'DEF'),
      slot('dr', 'RB', 0.22, 0.78, 'DEF'),
      slot('ml', 'CM', 0.46, 0.36, 'MID'),
      slot('mr', 'CM', 0.46, 0.64, 'MID'),
      slot('st', 'ST', 0.76, 0.5, 'ATT'),
    ],
  },
  {
    id: '2-1-3',
    name: '2-1-3 Spearhead',
    shape: 'ATTACKING',
    blurb: 'A lone anchor behind a front three. Devastating on the front foot, exposed behind.',
    slots: [
      slot('gk', 'GK', 0.05, 0.5, 'GK'),
      slot('dl', 'CB', 0.24, 0.34, 'DEF'),
      slot('dr', 'CB', 0.24, 0.66, 'DEF'),
      slot('dm', 'CDM', 0.44, 0.5, 'MID'),
      slot('al', 'LW', 0.74, 0.18, 'ATT'),
      slot('st', 'ST', 0.8, 0.5, 'ATT'),
      slot('ar', 'RW', 0.74, 0.82, 'ATT'),
    ],
  },
  {
    id: '3-1-2',
    name: '3-1-2 Anchor',
    shape: 'DEFENSIVE',
    blurb: 'A back three and a screen, with two to run the channels on the break.',
    slots: [
      slot('gk', 'GK', 0.05, 0.5, 'GK'),
      slot('dl', 'LB', 0.22, 0.22, 'DEF'),
      slot('dc', 'CB', 0.18, 0.5, 'DEF'),
      slot('dr', 'RB', 0.22, 0.78, 'DEF'),
      slot('dm', 'CDM', 0.44, 0.5, 'MID'),
      slot('sl', 'ST', 0.76, 0.38, 'ATT'),
      slot('sr', 'ST', 0.76, 0.62, 'ATT'),
    ],
  },
  {
    id: '1-3-2',
    name: '1-3-2 Cavalier',
    shape: 'ATTACKING',
    blurb: 'One defender. Everything forward. Thrilling and completely irresponsible.',
    slots: [
      slot('gk', 'GK', 0.05, 0.5, 'GK'),
      slot('dc', 'CB', 0.2, 0.5, 'DEF'),
      slot('ml', 'LW', 0.5, 0.2, 'MID'),
      slot('mc', 'CM', 0.46, 0.5, 'MID'),
      slot('mr', 'RW', 0.5, 0.8, 'MID'),
      slot('sl', 'ST', 0.78, 0.38, 'ATT'),
      slot('sr', 'ST', 0.78, 0.62, 'ATT'),
    ],
  },
  {
    id: '2-2-2',
    name: '2-2-2 Box',
    shape: 'BALANCED',
    blurb: 'Three clean lines of two. Simple, symmetrical, always in shape.',
    slots: [
      slot('gk', 'GK', 0.05, 0.5, 'GK'),
      slot('dl', 'CB', 0.24, 0.34, 'DEF'),
      slot('dr', 'CB', 0.24, 0.66, 'DEF'),
      slot('ml', 'CM', 0.5, 0.34, 'MID'),
      slot('mr', 'CM', 0.5, 0.66, 'MID'),
      slot('sl', 'ST', 0.76, 0.34, 'ATT'),
      slot('sr', 'ST', 0.76, 0.66, 'ATT'),
    ],
  },
  {
    id: '2-1-2-1',
    name: '2-1-2-1 Diamond',
    shape: 'NARROW',
    blurb: 'Everything through the middle. Owns central areas, invites crosses.',
    slots: [
      slot('gk', 'GK', 0.05, 0.5, 'GK'),
      slot('dl', 'CB', 0.24, 0.36, 'DEF'),
      slot('dr', 'CB', 0.24, 0.64, 'DEF'),
      slot('dm', 'CDM', 0.42, 0.5, 'MID'),
      slot('ml', 'CM', 0.6, 0.34, 'MID'),
      slot('mr', 'CM', 0.6, 0.66, 'MID'),
      slot('st', 'ST', 0.8, 0.5, 'ATT'),
    ],
  },
  {
    id: '3-3',
    name: '3-3 False Nine',
    shape: 'WIDE',
    blurb: 'No recognised striker. The attacking mid drops in and nobody can pick him up.',
    slots: [
      slot('gk', 'GK', 0.05, 0.5, 'GK'),
      slot('dl', 'LB', 0.24, 0.2, 'DEF'),
      slot('dc', 'CB', 0.2, 0.5, 'DEF'),
      slot('dr', 'RB', 0.24, 0.8, 'DEF'),
      slot('al', 'LW', 0.7, 0.16, 'ATT'),
      slot('af', 'CAM', 0.66, 0.5, 'ATT'),
      slot('ar', 'RW', 0.7, 0.84, 'ATT'),
    ],
  },
  {
    id: '2-2-1-1',
    name: '2-2-1-1 Staggered',
    shape: 'BALANCED',
    blurb: 'A ten in the pocket between the lines, a nine on the last shoulder.',
    slots: [
      slot('gk', 'GK', 0.05, 0.5, 'GK'),
      slot('dl', 'CB', 0.24, 0.34, 'DEF'),
      slot('dr', 'CB', 0.24, 0.66, 'DEF'),
      slot('ml', 'CM', 0.44, 0.32, 'MID'),
      slot('mr', 'CM', 0.44, 0.68, 'MID'),
      slot('am', 'CAM', 0.64, 0.5, 'MID'),
      slot('st', 'ST', 0.82, 0.5, 'ATT'),
    ],
  },
  {
    id: '2-4',
    name: '2-4 Overload',
    shape: 'WIDE',
    blurb: 'Four across the middle stretching the pitch. Wins the ball back everywhere, scores from nowhere.',
    slots: [
      slot('gk', 'GK', 0.05, 0.5, 'GK'),
      slot('dl', 'CB', 0.24, 0.36, 'DEF'),
      slot('dr', 'CB', 0.24, 0.64, 'DEF'),
      slot('ml', 'LW', 0.58, 0.14, 'MID'),
      slot('mcl', 'CM', 0.52, 0.4, 'MID'),
      slot('mcr', 'CAM', 0.62, 0.6, 'MID'),
      slot('mr', 'RW', 0.58, 0.86, 'MID'),
    ],
  },
];

/** Eleven-a-side. Present so no consumer may assume a seven-slot formation. */
const ELEVEN: readonly Formation[] = [
  {
    id: '4-4-2',
    name: '4-4-2 Classic',
    shape: 'BALANCED',
    blurb: 'Two banks of four and a front pair. Nothing clever, nothing broken.',
    slots: [
      slot('gk', 'GK', 0.04, 0.5, 'GK'),
      slot('lb', 'LB', 0.2, 0.14, 'DEF'),
      slot('lcb', 'CB', 0.16, 0.38, 'DEF'),
      slot('rcb', 'CB', 0.16, 0.62, 'DEF'),
      slot('rb', 'RB', 0.2, 0.86, 'DEF'),
      slot('lm', 'LW', 0.48, 0.14, 'MID'),
      slot('lcm', 'CM', 0.44, 0.4, 'MID'),
      slot('rcm', 'CM', 0.44, 0.6, 'MID'),
      slot('rm', 'RW', 0.48, 0.86, 'MID'),
      slot('lst', 'ST', 0.76, 0.4, 'ATT'),
      slot('rst', 'ST', 0.76, 0.6, 'ATT'),
    ],
  },
  {
    id: '4-3-3',
    name: '4-3-3 Press',
    shape: 'ATTACKING',
    blurb: 'A front three to squeeze the ball high and a midfield triangle behind it.',
    slots: [
      slot('gk', 'GK', 0.04, 0.5, 'GK'),
      slot('lb', 'LB', 0.22, 0.14, 'DEF'),
      slot('lcb', 'CB', 0.16, 0.38, 'DEF'),
      slot('rcb', 'CB', 0.16, 0.62, 'DEF'),
      slot('rb', 'RB', 0.22, 0.86, 'DEF'),
      slot('cdm', 'CDM', 0.38, 0.5, 'MID'),
      slot('lcm', 'CM', 0.52, 0.34, 'MID'),
      slot('rcm', 'CM', 0.52, 0.66, 'MID'),
      slot('lw', 'LW', 0.74, 0.14, 'ATT'),
      slot('st', 'ST', 0.82, 0.5, 'ATT'),
      slot('rw', 'RW', 0.74, 0.86, 'ATT'),
    ],
  },
  {
    id: '3-5-2',
    name: '3-5-2 Wing-Backs',
    shape: 'WIDE',
    blurb: 'Wing-backs carry the whole flank. Enormous engine required.',
    slots: [
      slot('gk', 'GK', 0.04, 0.5, 'GK'),
      slot('lcb', 'CB', 0.17, 0.3, 'DEF'),
      slot('ccb', 'CB', 0.14, 0.5, 'DEF'),
      slot('rcb', 'CB', 0.17, 0.7, 'DEF'),
      slot('lwb', 'LB', 0.5, 0.1, 'MID'),
      slot('lcm', 'CM', 0.44, 0.36, 'MID'),
      slot('cm', 'CDM', 0.4, 0.5, 'MID'),
      slot('rcm', 'CM', 0.44, 0.64, 'MID'),
      slot('rwb', 'RB', 0.5, 0.9, 'MID'),
      slot('lst', 'ST', 0.78, 0.4, 'ATT'),
      slot('rst', 'ST', 0.78, 0.6, 'ATT'),
    ],
  },
];

export const FORMATIONS: readonly Formation[] = [...SEVEN, ...ELEVEN];

const BY_ID: ReadonlyMap<string, Formation> = new Map(FORMATIONS.map((f) => [f.id, f]));

export const DEFAULT_FORMATION_ID = '2-3-1';

/** Falls back to the default shape rather than throwing: a bad save must still load. */
export function formationById(id: string): Formation {
  return BY_ID.get(id) ?? (BY_ID.get(DEFAULT_FORMATION_ID) as Formation);
}

export function formationsFor(playersOnPitch: number): readonly Formation[] {
  return FORMATIONS.filter((f) => f.slots.length === playersOnPitch);
}

/** How well this player fills this slot. Overall alone would put a striker at centre back. */
export function slotFit(player: Player, s: FormationSlot): number {
  const fam = familiarity(player.position, s.position);
  const secondary = player.secondaryPositions.includes(s.position) ? 0.12 : 0;
  const fitness = 0.7 + 0.3 * (player.fitness / 100);
  // Form is a light thumb on the scale — never enough to bench a much better player.
  const form = 1 + 0.05 * player.form.rating;
  return player.overall * Math.min(1, fam + secondary) * fitness * form;
}

/**
 * How much worse than his best a player is when he cannot last the match.
 *
 * `slotFit` already carries a mild fitness term because the simulator wants it
 * there: a tired player really is a slightly worse player. Selection is a
 * different question. "Who is best right now" and "who should start" diverge
 * exactly when somebody is too spent to finish, and a team sheet that starts a
 * 30%-fit star because he still out-rates a fresh reserve is one nobody would
 * pick by hand.
 *
 * So selection applies a second, steeper penalty that the simulator never sees:
 * nothing below full freshness is free, and below `TIRED` it bites hard enough
 * to lose a duel with a rested player of similar quality — without ever
 * overturning a large gap in ability, because a knackered world-class player is
 * still often the right call.
 */
const TIRED = 70;

function freshness(fitness: number): number {
  const clamped = Math.max(0, Math.min(100, fitness));
  if (clamped >= TIRED) return 1 - (100 - clamped) * 0.002; // 100 -> 1.00, 70 -> 0.94
  return 0.94 - (TIRED - clamped) * 0.006; // 70 -> 0.94, 0 -> 0.52
}

/**
 * What a player is worth in a slot when *picking a side*, as opposed to when
 * simulating one.
 *
 * Availability is a cliff rather than a penalty. An injured or suspended player
 * cannot play at all, so he is never preferred to somebody who can — but the
 * score stays finite and ordered, because a squad with more slots than fit
 * bodies still has to field a team, and when it does it should field its best
 * unavailable players rather than an arbitrary one.
 */
export function selectionFit(player: Player, s: FormationSlot): number {
  const base = slotFit(player, s) * freshness(player.fitness);
  return isAvailable(player) ? base : base * 0.01;
}

/**
 * Pick the best possible side, and mean it.
 *
 * This is what "Pick a team for me" runs, what a club's manager AI falls back
 * to when it has no valid sheet, and what the onboarding squad screen shows a
 * new player as their first eleven. It used to be greedy — fill the hardest
 * slots first, best remaining player each time — and greedy is not a rounding
 * error on this problem. Filling the defence first hands it the best
 * all-rounder in the squad and leaves a slot only he could play to somebody who
 * cannot play it. See `assignment.ts` for the worked case.
 *
 * It is now an exact solve: the assignment of players to slots with the highest
 * total fit, out of every possible assignment. Not a better heuristic — no
 * heuristic at all.
 *
 * Three things it weighs that the old one did not:
 *
 *   - **Freshness**, steeply, so a spent star does not start ahead of a rested
 *     deputy of similar quality.
 *   - **Availability**, as a cliff, so an injured player is only ever selected
 *     when there is nobody fit to take the shirt.
 *   - **The bench**, as cover rather than as a ranking. Seven of the best
 *     remaining players by rating can leave a side with no defender to bring
 *     on; the bench is chosen to answer the question "what happens if somebody
 *     goes off", one role at a time.
 */
export function autoLineup(players: readonly Player[], formation: Formation): TacticSetup {
  const slots = formation.slots;
  const lineup: Record<string, PlayerId | null> = {};
  for (const s of slots) lineup[s.id] = null;

  // A squad too small to field the shape is a real state — an injury crisis, a
  // half-built save — and the answer is the best partial side we can name, not
  // an exception. The solver needs at least as many players as slots, so the
  // shortfall is handled here rather than there.
  const candidates = [...players];
  const fieldable = Math.min(slots.length, candidates.length);
  const picked: Player[] = [];

  if (fieldable > 0) {
    // Only as many slots as we can actually fill, hardest to cover first, so a
    // short squad leaves an attacking slot empty rather than the goal.
    const filling = [...slots]
      .sort((a, b) => slotPriority(a) - slotPriority(b))
      .slice(0, fieldable);

    const score = filling.map((s) => candidates.map((p) => selectionFit(p, s)));
    const { columnFor } = assignMax(score);

    filling.forEach((s, index) => {
      const player = candidates[columnFor[index] ?? -1];
      if (player) {
        lineup[s.id] = player.id;
        picked.push(player);
      }
    });
  }

  // The bench answers a different question from the eleven, and one function
  // answers it everywhere — here, in the match preview and in the simulator.
  const starters: MatchdayStarter[] = [];
  for (const s of slots) {
    const id = lineup[s.id];
    const player = id ? picked.find((p) => p.id === id) : undefined;
    if (player) starters.push({ slot: s, player });
  }
  const bench = selectMatchdayBench(candidates, starters, formation, { risk: DEFAULT_TACTICS.risk })
    .map((seat) => seat.player);

  const captain = best(picked, (p) => p.mental.leadership * 1.5 + p.overall + p.age);
  const setPiece = best(picked, (p) => p.attributes.crossing + p.attributes.technique + p.attributes.passing * 0.5);
  const penalty = best(picked, (p) => p.attributes.finishing * 1.4 + p.mental.confidence * 0.6 + p.attributes.composure);

  return {
    ...DEFAULT_TACTICS,
    formationId: formation.id,
    lineup,
    bench: bench.map((p) => p.id),
    captainId: captain?.id ?? null,
    setPieceTakerId: setPiece?.id ?? null,
    penaltyTakerId: penalty?.id ?? null,
  };
}

/** How many players sit on the bench. Enough to cover every line once, plus one. */
export const BENCH_SIZE = 7;

/**
 * Familiarity at or above this is "he can play there". Below it he is a body
 * in the right half of the pitch, which is not cover. The value is the tier the
 * position table itself uses for a real second position — a centre-back at
 * left-back is 0.75, a centre-back screening midfield 0.7, a midfielder at
 * centre-back 0.7 — and one step above the 0.45 fallback for two positions with
 * nothing in common.
 */
const COVER_THRESHOLD = 0.7;

/**
 * How much the manager's appetite for risk moves the bench. A thumb, nothing
 * more: it decides which line gets the next seat when two lines are equally
 * exposed, and it can never take a line's cover away or beat a clearly better
 * player. Twelve per cent is smaller than the gap between any two lines that
 * are not already tied.
 */
const TACTICAL_LEAN = 0.12;

/** Why a man is on the bench, in the order the seats are filled. */
export type BenchRole =
  | 'KEEPER_COVER'
  | 'DEFENSIVE_COVER'
  | 'MIDFIELD_COVER'
  | 'ATTACKING_COVER'
  | 'BEST_AVAILABLE';

/** One of the starting side, and the slot he is starting in. */
export interface MatchdayStarter {
  readonly slot: FormationSlot;
  readonly player: Player;
}

export interface MatchdaySeat {
  readonly player: Player;
  readonly role: BenchRole;
}

export interface MatchdayBenchOptions {
  /** How many seats there are. Defaults to `BENCH_SIZE`. */
  readonly size?: number;
  /** The manager's risk setting, for the tactical lean. */
  readonly risk?: TacticSetup['risk'];
}

type OutfieldLine = 'DEF' | 'MID' | 'ATT';
const LINES: readonly OutfieldLine[] = ['DEF', 'MID', 'ATT'];
const COVER_ROLE: Record<OutfieldLine, BenchRole> = {
  DEF: 'DEFENSIVE_COVER', MID: 'MIDFIELD_COVER', ATT: 'ATTACKING_COVER',
};
const ROLE_ORDER: readonly BenchRole[] = [
  'KEEPER_COVER', 'DEFENSIVE_COVER', 'MIDFIELD_COVER', 'ATTACKING_COVER', 'BEST_AVAILABLE',
];

/**
 * The matchday bench.
 *
 * One function, called by everything that needs to know who is sitting down:
 * the team-sheet suggestion, the match preview, and the simulator itself. There
 * used to be three answers to this question — a cover-based pick inside
 * `autoLineup`, the seven highest-rated reserves in the preview, and whatever
 * squad order gave the simulator when a sheet named a side but no substitutes.
 * A manager could therefore be shown one bench and given another, and the
 * benches the league's other eleven clubs played with were the order their
 * players happened to be stored in.
 *
 * A bench is an insurance policy, not a ranking, and what it insures depends on
 * the side in front of it. So the shape of the starting eleven is an input:
 * cover is measured against the players who are actually on the pitch, line by
 * line, rather than against the formation in the abstract.
 *
 * The seats go, in order:
 *
 *   1. **The reserve goalkeeper.** One, and only one, and only a real keeper —
 *      losing yours with nobody to replace him is the single substitution
 *      problem with no recovery. A squad with no second keeper does not have
 *      the seat taken by whichever outfielder is least bad in goal; the seat
 *      goes back to the pool, because a defender who cannot keep goal is worth
 *      more as a defender.
 *   2. **One option for each line**, most exposed first, and only somebody who
 *      can genuinely play there (`COVER_THRESHOLD`). A line with nobody able to
 *      cover it stays uncovered rather than being given a token.
 *   3. **The rest, by exposure.** Each remaining seat goes to the line with the
 *      most starters still uncovered, and within it to the best man for the
 *      job. A pick is credited against every line he can really play, so a
 *      utility player is cover twice over.
 *   4. **Best available**, once every starter has cover — quality decides, as
 *      it should once the insurance is bought.
 *
 * Quality, position familiarity and match readiness all enter through
 * `selectionFit`, the same score that picks the side: they are not weighed
 * again here, and there is no second position model. Versatility helps a player
 * reach a seat he would not otherwise be considered for; it never beats a much
 * better specialist for the same seat, because both are scored by the same fit.
 *
 * Nothing here is random, timed or stateful. Ties break on player id.
 */
export function selectMatchdayBench(
  squad: readonly Player[],
  starters: readonly MatchdayStarter[],
  formation: Formation,
  options: MatchdayBenchOptions = {},
): readonly MatchdaySeat[] {
  const size = options.size ?? BENCH_SIZE;
  if (size <= 0) return [];

  // --- squad -> starting eleven -> remaining available ---------------------
  //
  // An injured or suspended name among the substitutes is not cover, it is a
  // seat, and it reads as cover on the team sheet — worse than an obviously
  // short bench. Candidate order is by id so that the answer cannot depend on
  // how the squad happens to be stored.
  const started = new Set<string>(starters.map((s) => s.player.id as string));
  const remaining = new Set(
    squad.filter((p) => !started.has(p.id as string) && isAvailable(p))
      .sort((a, b) => (a.id as string).localeCompare(b.id as string)),
  );
  if (remaining.size === 0) return [];

  const seats: MatchdaySeat[] = [];
  const take = (player: Player, role: BenchRole): void => {
    seats.push({ player, role });
    remaining.delete(player);
  };

  /**
   * Who is in the running for an outfield seat. A third keeper is not cover for
   * anything: once one is sitting down, the others are only considered when
   * there is literally nobody else left, which is a squad crisis rather than a
   * selection.
   */
  const pool = (): Player[] => {
    const outfield = [...remaining].filter((p) => p.position !== 'GK');
    return outfield.length > 0 ? outfield : [...remaining];
  };

  // --- 1. the reserve goalkeeper ------------------------------------------
  const keeperSlot = formation.slots.find((s) => s.role === 'GK');
  if (keeperSlot) {
    const keeper = pick([...remaining].filter((p) => p.position === 'GK'), (p) => selectionFit(p, keeperSlot));
    if (keeper) take(keeper, 'KEEPER_COVER');
  }

  // --- position cover analysis, against the side that is actually playing ---
  const slotsFor = new Map<OutfieldLine, FormationSlot[]>(
    LINES.map((line) => [line, formation.slots.filter((s) => s.role === line)]),
  );
  /** How well this player would do in the best slot of a line. */
  const coverValue = (player: Player, line: OutfieldLine): number =>
    Math.max(0, ...(slotsFor.get(line) ?? []).map((s) => selectionFit(player, s)));
  /** Whether he can genuinely play there at all. */
  const covers = (player: Player, line: OutfieldLine): boolean =>
    (slotsFor.get(line) ?? []).some((s) => Math.min(1,
      familiarity(player.position, s.position)
      + (player.secondaryPositions.includes(s.position) ? 0.12 : 0),
    ) >= COVER_THRESHOLD);

  /** Starters in each line: two centre-backs need more cover than one striker. */
  const exposed = new Map<OutfieldLine, number>(
    LINES.map((line) => [line, starters.filter((s) => s.slot.role === line).length]),
  );
  const creditCover = (player: Player): void => {
    for (const line of LINES) {
      if (covers(player, line)) exposed.set(line, (exposed.get(line) ?? 0) - 1);
    }
  };

  // The tactical lean. A bold side would rather have another way to score; a
  // cautious one another way to stop it. Applied to exposure, so it only ever
  // decides between lines that are already close.
  const lean: Record<OutfieldLine, number> = { DEF: 0, MID: 0, ATT: 0 };
  const shape = formation.shape;
  const bold = options.risk === 'BOLD' || options.risk === 'RECKLESS' || shape === 'ATTACKING';
  const cautious = options.risk === 'CAUTIOUS' || shape === 'DEFENSIVE';
  if (bold && !cautious) lean.ATT = TACTICAL_LEAN;
  if (cautious && !bold) lean.DEF = TACTICAL_LEAN;
  const pressure = (line: OutfieldLine): number => (exposed.get(line) ?? 0) * (1 + lean[line]);

  // --- 2. one option per line, most exposed first --------------------------
  const byExposure = [...LINES].sort((a, b) =>
    pressure(b) - pressure(a) || LINES.indexOf(a) - LINES.indexOf(b));
  for (const line of byExposure) {
    if (seats.length >= size) break;
    if ((exposed.get(line) ?? 0) <= 0) continue;
    const choice = pick(pool().filter((p) => covers(p, line)), (p) => coverValue(p, line));
    if (!choice) continue;
    take(choice, COVER_ROLE[line]);
    creditCover(choice);
  }

  // --- 3. the rest, by exposure, then by quality ---------------------------
  const anyFit = (player: Player): number =>
    Math.max(0, ...formation.slots.map((s) => selectionFit(player, s)));

  while (seats.length < size && remaining.size > 0) {
    const line = [...LINES]
      .filter((l) => (exposed.get(l) ?? 0) > 0)
      .sort((a, b) => pressure(b) - pressure(a) || LINES.indexOf(a) - LINES.indexOf(b))[0];

    const choice = line
      ? pick(pool().filter((p) => covers(p, line)), (p) => coverValue(p, line)) ?? pick(pool(), anyFit)
      : pick(pool(), anyFit);
    if (!choice) break;

    // A seat taken while a line was still exposed is that line's cover; a seat
    // taken once every starter has an answer is simply the best man left.
    take(choice, line && covers(choice, line) ? COVER_ROLE[line] : 'BEST_AVAILABLE');
    creditCover(choice);
  }

  // --- 4. bench order: keeper, defence, midfield, attack, then the rest -----
  //
  // Stable within each group, so the order is the order they were chosen in.
  return seats
    .map((seat, index) => ({ seat, index }))
    .sort((a, b) =>
      ROLE_ORDER.indexOf(a.seat.role) - ROLE_ORDER.indexOf(b.seat.role) || a.index - b.index)
    .map(({ seat }) => seat);
}

/** Highest score wins; an exact tie goes to the lower player id. */
function pick(players: readonly Player[], score: (p: Player) => number): Player | null {
  let chosen: Player | null = null;
  let chosenScore = -Infinity;
  for (const player of players) {
    const value = score(player);
    if (value > chosenScore
      || (value === chosenScore && chosen !== null
        && (player.id as string).localeCompare(chosen.id as string) < 0)) {
      chosen = player;
      chosenScore = value;
    }
  }
  return chosen;
}

const slotPriority = (s: FormationSlot): number =>
  s.role === 'GK' ? 0 : s.role === 'DEF' ? 1 : s.role === 'MID' ? 2 : 3;

function best<T>(items: readonly T[], score: (item: T) => number): T | null {
  let bestItem: T | null = null;
  let bestScore = -Infinity;
  for (const item of items) {
    const s = score(item);
    if (s > bestScore) { bestScore = s; bestItem = item; }
  }
  return bestItem;
}
