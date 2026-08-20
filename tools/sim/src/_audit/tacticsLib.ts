import {
  simulateMatch, generateSquad, Rng, autoLineup, formationById, DEFAULT_TACTICS,
  type MatchSetup, type Player, type ClubId, type MatchId, type TacticSetup, asId,
} from '@cf/engine';

export type Opts = Partial<typeof DEFAULT_TACTICS>;

export function squadOf(seed: string, target: number, size = 18): Player[] {
  return generateSquad(new Rng(seed), { targetOverall: target, size, idPrefix: seed.slice(0, 8) });
}

export function teamOf(name: string, players: Player[], t: Opts, formationId = '2-3-1') {
  const formation = formationById(formationId);
  // autoLineup returns a FULL TacticSetup including ...DEFAULT_TACTICS, so the
  // instruction overrides must be spread AFTER it or they are silently lost.
  const auto = autoLineup(players, formation);
  return {
    clubId: asId<ClubId>(name), name, shortName: name.slice(0, 3).toUpperCase(),
    players,
    tactics: { ...auto, ...DEFAULT_TACTICS, ...t, formationId: formation.id,
      lineup: auto.lineup, bench: auto.bench, captainId: auto.captainId,
      setPieceTakerId: auto.setPieceTakerId, penaltyTakerId: auto.penaltyTakerId } as TacticSetup,
    managerBonus: { tactical: 55, motivation: 55, adaptability: 55, discipline: 55 },
    creatorPresence: 0, ruleCards: [] as never[], isPlayerControlled: false,
  };
}

export function setup(seed: string, home: ReturnType<typeof teamOf>, away: ReturnType<typeof teamOf>,
  over: Partial<MatchSetup> = {}): MatchSetup {
  return {
    matchId: asId<MatchId>(`m_${seed}`), seed, home, away,
    config: { minutes: 30, halves: 2, playersOnPitch: 7, benchSize: 7, substitutions: 5,
      liveDecisions: false, maxDecisions: 0 },
    importance: 3, isDerby: false, rivalryIntensity: 0,
    attendance: 6000, homeAdvantage: 0, neutralVenue: true, enabledSpecialRules: [],
    ...over,
  } as MatchSetup;
}

export interface Rec { w: number; d: number; l: number; gf: number; ga: number; n: number; xgf: number; xga: number }
export const rec = (): Rec => ({ w: 0, d: 0, l: 0, gf: 0, ga: 0, n: 0, xgf: 0, xga: 0 });

/** Play `n` matches of A's tactics vs B's, alternating sides. Returns A's record. */
export function duel(tagA: string, tA: Opts, tagB: string, tB: Opts, n: number,
  squadA: Player[], squadB: Player[], over: Partial<MatchSetup> = {}): Rec {
  const r = rec();
  // Four permutations: each tactic is carried by each squad, in each slot.
  // That removes both any home/away asymmetry and any squad-strength asymmetry.
  const perms = [
    { h: teamOf('home', squadA, tA), a: teamOf('away', squadB, tB), aIsHome: true },
    { h: teamOf('home', squadB, tB), a: teamOf('away', squadA, tA), aIsHome: false },
    { h: teamOf('home', squadB, tA), a: teamOf('away', squadA, tB), aIsHome: true },
    { h: teamOf('home', squadA, tB), a: teamOf('away', squadB, tA), aIsHome: false },
  ];
  for (let i = 0; i < n; i++) {
    const perm = perms[i % 4]!;
    const aHome = perm.aIsHome;
    const home = perm.h;
    const away = perm.a;
    // Common random numbers: the seed depends only on the match index, so
    // every configuration faces the identical sequence of matches.
    const res = simulateMatch(setup(`crn-${i}`, home, away, over));
    const aG = aHome ? res.homeScore : res.awayScore;
    const bG = aHome ? res.awayScore : res.homeScore;
    const aX = aHome ? res.homeStats.xg : res.awayStats.xg;
    const bX = aHome ? res.awayStats.xg : res.homeStats.xg;
    r.n++; r.gf += aG; r.ga += bG; r.xgf += aX; r.xga += bX;
    if (aG > bG) r.w++; else if (aG === bG) r.d++; else r.l++;
  }
  return r;
}

export const pts = (r: Rec): number => (r.w * 3 + r.d) / r.n;
export const winPct = (r: Rec): number => (r.w / r.n) * 100;
export const fmt = (r: Rec): string =>
  `W${((r.w / r.n) * 100).toFixed(1)}% D${((r.d / r.n) * 100).toFixed(1)}% L${((r.l / r.n) * 100).toFixed(1)}%  ` +
  `ppg ${pts(r).toFixed(2)}  GF ${(r.gf / r.n).toFixed(2)} GA ${(r.ga / r.n).toFixed(2)}  ` +
  `xGF ${(r.xgf / r.n).toFixed(2)} xGA ${(r.xga / r.n).toFixed(2)}`;

/** Per-match points for tactic A in the A-vs-B duel, under common random numbers. */
export function duelPoints(tA: Opts, tB: Opts, n: number, squadA: Player[], squadB: Player[],
  over: Partial<MatchSetup> = {}): number[] {
  const perms = [
    { h: teamOf('home', squadA, tA), a: teamOf('away', squadB, tB), aIsHome: true },
    { h: teamOf('home', squadB, tB), a: teamOf('away', squadA, tA), aIsHome: false },
    { h: teamOf('home', squadB, tA), a: teamOf('away', squadA, tB), aIsHome: true },
    { h: teamOf('home', squadA, tB), a: teamOf('away', squadB, tA), aIsHome: false },
  ];
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const p = perms[i % 4]!;
    const res = simulateMatch(setup(`crn-${i}`, p.h, p.a, over));
    const aG = p.aIsHome ? res.homeScore : res.awayScore;
    const bG = p.aIsHome ? res.awayScore : res.homeScore;
    out.push(aG > bG ? 3 : aG === bG ? 1 : 0);
  }
  return out;
}

/** Paired mean difference and standard error between two per-match point vectors. */
export function paired(x: number[], y: number[]): { diff: number; se: number; z: number } {
  const n = Math.min(x.length, y.length);
  let s = 0;
  for (let i = 0; i < n; i++) s += (x[i] as number) - (y[i] as number);
  const mean = s / n;
  let v = 0;
  for (let i = 0; i < n; i++) v += (((x[i] as number) - (y[i] as number)) - mean) ** 2;
  const se = Math.sqrt(v / (n - 1) / n);
  return { diff: mean, se, z: se > 0 ? mean / se : 0 };
}
