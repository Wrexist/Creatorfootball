import type { Player } from '../players/player';
import type { Position } from '../players/positions';
import { familiarity } from '../players/positions';
import { isAvailable } from '../players/player';
import type { Formation, FormationSlot, TacticSetup } from './tactics';
import { DEFAULT_TACTICS } from './tactics';
import type { PlayerId } from '../core/brand';

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
 * Greedy best-fit selection: fill the slots that are hardest to cover first
 * (keeper, then defence, then attack) so the algorithm never strands itself
 * with a winger in goal. Good enough to be the AI's permanent team sheet and
 * the human player's one-tap "auto pick".
 */
export function autoLineup(players: readonly Player[], formation: Formation): TacticSetup {
  const pool = players.filter(isAvailable);
  const usable = pool.length >= formation.slots.length ? pool : players.slice();
  const remaining = new Set(usable);

  const order: FormationSlot[] = [...formation.slots].sort(
    (a, b) => slotPriority(a) - slotPriority(b),
  );

  const lineup: Record<string, PlayerId | null> = {};
  for (const s of formation.slots) lineup[s.id] = null;

  const picked: Player[] = [];
  for (const s of order) {
    let best: Player | null = null;
    let bestScore = -1;
    for (const p of remaining) {
      const score = slotFit(p, s);
      if (score > bestScore) { bestScore = score; best = p; }
    }
    if (best) {
      lineup[s.id] = best.id;
      picked.push(best);
      remaining.delete(best);
    }
  }

  // Bench keeps one spare keeper first, then the best of the rest.
  const rest = [...remaining].sort((a, b) => b.overall - a.overall);
  const spareKeeper = rest.find((p) => p.position === 'GK');
  const bench = [
    ...(spareKeeper ? [spareKeeper] : []),
    ...rest.filter((p) => p !== spareKeeper),
  ].slice(0, 7);

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
